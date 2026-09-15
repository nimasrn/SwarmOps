package sqlstore_test

import (
	"context"
	"database/sql"
	"errors"
	"sync"
	"testing"

	"github.com/nimasrn/SwarmOps/internal/sqlstore"
	"github.com/nimasrn/SwarmOps/internal/sqlstore/sqltest"
)

func TestMigrationsAreContiguousAndSplitCleanly(t *testing.T) {
	migrations, err := sqlstore.Migrations()
	if err != nil {
		t.Fatal(err)
	}
	if len(migrations) == 0 {
		t.Fatal("no embedded migrations")
	}
	for _, migration := range migrations {
		if len(sqlstore.SplitStatements(migration.SQL)) == 0 {
			t.Fatalf("%s has no statements", migration.Name)
		}
	}
}

func TestSplitStatementsDropsCommentsAndKeepsMultilineStatements(t *testing.T) {
	statements := sqlstore.SplitStatements("-- heading\nCREATE TABLE a (\n  id INT\n);\n\n-- next\nCREATE TABLE b (id INT);\n")
	if len(statements) != 2 {
		t.Fatalf("statements = %#v", statements)
	}
	if statements[0] != "CREATE TABLE a (\n  id INT\n)" {
		t.Fatalf("first statement = %q", statements[0])
	}
}

func TestMigrateIsIdempotentAndRecordsEveryVersion(t *testing.T) {
	db := sqltest.Open(t)
	ctx := context.Background()
	if err := db.Migrate(ctx); err != nil {
		t.Fatalf("second migrate: %v", err)
	}
	migrations, err := sqlstore.Migrations()
	if err != nil {
		t.Fatal(err)
	}
	version, err := db.SchemaVersion(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if version != len(migrations) {
		t.Fatalf("schema version = %d, want %d", version, len(migrations))
	}
}

func TestMigrateRefusesAModifiedAppliedMigration(t *testing.T) {
	db := sqltest.Open(t)
	ctx := context.Background()
	if _, err := db.Pool().ExecContext(ctx, "UPDATE schema_migrations SET checksum = REPEAT('0', 64) WHERE version = 1"); err != nil {
		t.Fatal(err)
	}
	if err := db.Migrate(ctx); err == nil {
		t.Fatal("migrate accepted a migration whose checksum changed after it ran")
	}
}

func TestMigrateRefusesADatabaseNewerThanTheController(t *testing.T) {
	db := sqltest.Open(t)
	ctx := context.Background()
	if _, err := db.Pool().ExecContext(ctx, "INSERT INTO schema_migrations (version, name, checksum, applied_at) VALUES (9999, 'future', REPEAT('0', 64), UTC_TIMESTAMP(6))"); err != nil {
		t.Fatal(err)
	}
	if err := db.Migrate(ctx); err == nil {
		t.Fatal("migrate accepted a schema from a newer controller")
	}
}

func TestSealedColumnIsBoundToTableColumnAndRow(t *testing.T) {
	db := sqltest.Open(t)
	sealed, err := db.SealString(sqlstore.Purpose("source_connections", "token", "conn-1"), "ghp_secret")
	if err != nil {
		t.Fatal(err)
	}
	opened, err := db.OpenString(sqlstore.Purpose("source_connections", "token", "conn-1"), sealed)
	if err != nil || opened != "ghp_secret" {
		t.Fatalf("open = %q, %v", opened, err)
	}
	if _, err := db.OpenString(sqlstore.Purpose("source_connections", "token", "conn-2"), sealed); err == nil {
		t.Fatal("ciphertext opened under another row's purpose")
	}
	if _, err := db.OpenString(sqlstore.Purpose("source_settings", "token", "conn-1"), sealed); err == nil {
		t.Fatal("ciphertext opened under another table's purpose")
	}
	empty, err := db.SealString(sqlstore.Purpose("t", "c", "k"), "")
	if err != nil || empty != nil {
		t.Fatalf("empty secret sealed to %v, %v; want NULL", empty, err)
	}
}

func TestWithTxRollsBackOnErrorAndCommitsOnSuccess(t *testing.T) {
	db := sqltest.Open(t)
	ctx := context.Background()
	if _, err := db.Pool().ExecContext(ctx, "CREATE TABLE tx_probe (id INT PRIMARY KEY) ENGINE=InnoDB"); err != nil {
		t.Fatal(err)
	}
	failure := errors.New("abort")
	err := db.WithTx(ctx, func(tx *sql.Tx) error {
		if _, err := tx.ExecContext(ctx, "INSERT INTO tx_probe (id) VALUES (1)"); err != nil {
			return err
		}
		return failure
	})
	if !errors.Is(err, failure) {
		t.Fatalf("WithTx error = %v", err)
	}
	if err := db.WithTx(ctx, func(tx *sql.Tx) error {
		_, err := tx.ExecContext(ctx, "INSERT INTO tx_probe (id) VALUES (2)")
		return err
	}); err != nil {
		t.Fatal(err)
	}
	var count int
	if err := db.Pool().QueryRowContext(ctx, "SELECT COUNT(*) FROM tx_probe").Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 1 {
		t.Fatalf("rows = %d, want only the committed one", count)
	}
}

// TestWithTxRetriesADeadlockVictim forces a real InnoDB deadlock between two
// transactions that lock the same two rows in opposite order. The server
// aborts one; WithTx must re-run it so both finally commit.
func TestWithTxRetriesADeadlockVictim(t *testing.T) {
	db := sqltest.Open(t)
	ctx := context.Background()
	for _, statement := range []string{
		"CREATE TABLE deadlock_probe (id INT PRIMARY KEY, n INT NOT NULL) ENGINE=InnoDB",
		"INSERT INTO deadlock_probe (id, n) VALUES (1, 0), (2, 0)",
	} {
		if _, err := db.Pool().ExecContext(ctx, statement); err != nil {
			t.Fatal(err)
		}
	}
	firstLocked := make(chan struct{})
	secondLocked := make(chan struct{})
	var once1, once2 sync.Once
	run := func(first, second int, mine *sync.Once, locked chan struct{}, other chan struct{}) error {
		return db.WithTx(ctx, func(tx *sql.Tx) error {
			if _, err := tx.ExecContext(ctx, "UPDATE deadlock_probe SET n = n + 1 WHERE id = ?", first); err != nil {
				return err
			}
			mine.Do(func() { close(locked) })
			<-other
			_, err := tx.ExecContext(ctx, "UPDATE deadlock_probe SET n = n + 1 WHERE id = ?", second)
			return err
		})
	}
	var wg sync.WaitGroup
	errs := make([]error, 2)
	wg.Add(2)
	go func() { defer wg.Done(); errs[0] = run(1, 2, &once1, firstLocked, secondLocked) }()
	go func() { defer wg.Done(); errs[1] = run(2, 1, &once2, secondLocked, firstLocked) }()
	wg.Wait()
	for index, err := range errs {
		if err != nil {
			t.Fatalf("transaction %d: %v", index+1, err)
		}
	}
	var total int
	if err := db.Pool().QueryRowContext(ctx, "SELECT SUM(n) FROM deadlock_probe").Scan(&total); err != nil {
		t.Fatal(err)
	}
	if total != 4 {
		t.Fatalf("sum = %d, want 4 (both transactions fully applied exactly once)", total)
	}
}

func TestOpenRejectsADSNWithoutADatabase(t *testing.T) {
	if _, err := sqlstore.Open(context.Background(), "root:pw@tcp(127.0.0.1:1)/", sqltest.Key(), sqlstore.Options{}); err == nil {
		t.Fatal("Open accepted a DSN that names no database")
	}
}
