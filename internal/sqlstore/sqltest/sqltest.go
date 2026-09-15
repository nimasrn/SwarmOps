// Package sqltest gives each test its own migrated, throwaway database on a
// real MySQL or MariaDB server. Stores are tested against the engine, not a
// fake, because the behaviour under test — constraints, locking, SKIP LOCKED,
// isolation — only exists in the engine.
package sqltest

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"os"
	"sync"
	"testing"
	"time"

	"github.com/go-sql-driver/mysql"
	"github.com/nimasrn/SwarmOps/internal/sqlstore"
)

// DefaultServerDSN matches the local development container started by
// `make dev-db`. It names no database; each test creates its own.
const DefaultServerDSN = "root:devroot@tcp(127.0.0.1:3307)/"

// Key is the data-encryption key tests seal columns with.
func Key() []byte {
	key := make([]byte, 32)
	for index := range key {
		key[index] = byte(index + 1)
	}
	return key
}

// Open returns a migrated database that is dropped when the test ends.
//
// SWARMOPS_TEST_DATABASE_DSN selects the server. When the server cannot be
// reached the test is skipped, unless SWARMOPS_TEST_DATABASE_REQUIRED is set,
// as it is in CI, where an unreachable database must fail rather than let a
// storage suite pass by not running.
func Open(t testing.TB) *sqlstore.DB {
	t.Helper()
	return OpenWithKey(t, Key())
}

func OpenWithKey(t testing.TB, key []byte) *sqlstore.DB {
	t.Helper()
	name, serverDSN := Create(t)
	config, err := mysql.ParseDSN(serverDSN)
	if err != nil {
		t.Fatalf("parse test database DSN: %v", err)
	}
	config.DBName = name
	db, err := sqlstore.Open(context.Background(), config.FormatDSN(), key, sqlstore.Options{MaxOpenConns: 30})
	if err != nil {
		t.Fatalf("open test database: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	if err := db.Migrate(context.Background()); err != nil {
		t.Fatalf("migrate test database: %v", err)
	}
	return db
}

var shared sync.Map

// Shared returns one migrated database per test: every call made with the same
// t gets the same database. A test that assembles several stores, as one
// controller process does, needs them all to see the same rows.
func Shared(t testing.TB) *sqlstore.DB {
	t.Helper()
	if db, found := shared.Load(t); found {
		return db.(*sqlstore.DB)
	}
	db := Open(t)
	shared.Store(t, db)
	t.Cleanup(func() { shared.Delete(t) })
	return db
}

// Create makes an empty database and returns its name and the server DSN.
func Create(t testing.TB) (string, string) {
	t.Helper()
	serverDSN := os.Getenv("SWARMOPS_TEST_DATABASE_DSN")
	if serverDSN == "" {
		serverDSN = DefaultServerDSN
	}
	config, err := mysql.ParseDSN(serverDSN)
	if err != nil {
		t.Fatalf("parse SWARMOPS_TEST_DATABASE_DSN: %v", err)
	}
	config.DBName = ""
	config.Timeout = 3 * time.Second
	admin, err := sql.Open("mysql", config.FormatDSN())
	if err != nil {
		t.Fatalf("open test server: %v", err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := admin.PingContext(ctx); err != nil {
		_ = admin.Close()
		if os.Getenv("SWARMOPS_TEST_DATABASE_REQUIRED") != "" {
			t.Fatalf("test database server is unreachable: %v", err)
		}
		t.Skipf("test database server is unreachable (set SWARMOPS_TEST_DATABASE_DSN or run make dev-db): %v", err)
	}
	suffix := make([]byte, 6)
	_, _ = rand.Read(suffix)
	name := "swarmops_test_" + hex.EncodeToString(suffix)
	if _, err := admin.ExecContext(context.Background(), "CREATE DATABASE `"+name+"` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"); err != nil {
		_ = admin.Close()
		t.Fatalf("create test database: %v", err)
	}
	t.Cleanup(func() {
		_, _ = admin.ExecContext(context.Background(), "DROP DATABASE IF EXISTS `"+name+"`")
		_ = admin.Close()
	})
	return name, config.FormatDSN()
}
