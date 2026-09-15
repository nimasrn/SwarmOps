package sqlstore

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"embed"
	"encoding/hex"
	"errors"
	"fmt"
	"io/fs"
	"path"
	"sort"
	"strconv"
	"strings"
	"time"
)

//go:embed migrations/*.sql
var migrationFiles embed.FS

// migrationLockName serialises migrations across controller processes that
// start against the same database at the same time.
const migrationLockName = "swarmops_schema_migrations"

type Migration struct {
	Checksum string
	Name     string
	SQL      string
	Version  int
}

// Migrations returns the embedded schema history in version order. File names
// are NNNN_description.sql; a gap or a duplicate version is a build error
// caught by the package tests, not something discovered on a production start.
func Migrations() ([]Migration, error) {
	entries, err := fs.ReadDir(migrationFiles, "migrations")
	if err != nil {
		return nil, fmt.Errorf("read embedded migrations: %w", err)
	}
	migrations := make([]Migration, 0, len(entries))
	for _, entry := range entries {
		name := entry.Name()
		if entry.IsDir() || !strings.HasSuffix(name, ".sql") {
			continue
		}
		prefix, _, found := strings.Cut(name, "_")
		version, err := strconv.Atoi(prefix)
		if !found || err != nil || version < 1 {
			return nil, fmt.Errorf("migration %s must be named NNNN_description.sql", name)
		}
		body, err := migrationFiles.ReadFile(path.Join("migrations", name))
		if err != nil {
			return nil, fmt.Errorf("read migration %s: %w", name, err)
		}
		sum := sha256.Sum256(body)
		migrations = append(migrations, Migration{Checksum: hex.EncodeToString(sum[:]), Name: name, SQL: string(body), Version: version})
	}
	sort.Slice(migrations, func(i, j int) bool { return migrations[i].Version < migrations[j].Version })
	for index, migration := range migrations {
		if migration.Version != index+1 {
			return nil, fmt.Errorf("migration versions must be contiguous from 1; %s is out of sequence", migration.Name)
		}
	}
	return migrations, nil
}

// Migrate applies every embedded migration the database has not recorded.
// MySQL commits DDL implicitly, so a migration is not atomic: each statement
// runs in order and the version is recorded only after the last one. An
// applied migration whose checksum changed is refused, because the schema it
// produced no longer matches the file that claims to describe it.
func (db *DB) Migrate(ctx context.Context) error {
	migrations, err := Migrations()
	if err != nil {
		return err
	}
	conn, err := db.pool.Conn(ctx)
	if err != nil {
		return fmt.Errorf("reserve migration connection: %w", err)
	}
	defer conn.Close()

	var locked sql.NullInt64
	if err := conn.QueryRowContext(ctx, "SELECT GET_LOCK(?, 60)", migrationLockName).Scan(&locked); err != nil {
		return fmt.Errorf("acquire migration lock: %w", err)
	}
	if !locked.Valid || locked.Int64 != 1 {
		return errors.New("another controller is migrating the database; retry after it finishes")
	}
	defer func() {
		_, _ = conn.ExecContext(context.WithoutCancel(ctx), "SELECT RELEASE_LOCK(?)", migrationLockName)
	}()

	if _, err := conn.ExecContext(ctx, `CREATE TABLE IF NOT EXISTS schema_migrations (
		version INT UNSIGNED NOT NULL PRIMARY KEY,
		name VARCHAR(200) NOT NULL,
		checksum CHAR(64) NOT NULL,
		applied_at DATETIME(6) NOT NULL
	) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`); err != nil {
		return fmt.Errorf("create schema_migrations: %w", err)
	}
	applied := map[int]string{}
	rows, err := conn.QueryContext(ctx, "SELECT version, checksum FROM schema_migrations")
	if err != nil {
		return fmt.Errorf("read schema_migrations: %w", err)
	}
	for rows.Next() {
		var version int
		var checksum string
		if err := rows.Scan(&version, &checksum); err != nil {
			_ = rows.Close()
			return fmt.Errorf("read schema_migrations: %w", err)
		}
		applied[version] = checksum
	}
	if err := rows.Close(); err != nil {
		return fmt.Errorf("read schema_migrations: %w", err)
	}
	for version := range applied {
		if version > len(migrations) {
			return fmt.Errorf("database schema version %d is newer than this controller; upgrade the controller", version)
		}
	}
	for _, migration := range migrations {
		if checksum, ok := applied[migration.Version]; ok {
			if checksum != migration.Checksum {
				return fmt.Errorf("applied migration %s was modified after it ran", migration.Name)
			}
			continue
		}
		for index, statement := range SplitStatements(migration.SQL) {
			if _, err := conn.ExecContext(ctx, statement); err != nil {
				return fmt.Errorf("migration %s statement %d: %w", migration.Name, index+1, err)
			}
		}
		if _, err := conn.ExecContext(ctx, "INSERT INTO schema_migrations (version, name, checksum, applied_at) VALUES (?, ?, ?, ?)",
			migration.Version, migration.Name, migration.Checksum, time.Now().UTC()); err != nil {
			return fmt.Errorf("record migration %s: %w", migration.Name, err)
		}
	}
	return nil
}

// SchemaVersion reports the highest applied migration, or 0 before any.
func (db *DB) SchemaVersion(ctx context.Context) (int, error) {
	var version sql.NullInt64
	err := db.pool.QueryRowContext(ctx, "SELECT MAX(version) FROM schema_migrations").Scan(&version)
	if IsCode(err, 1146) {
		return 0, nil
	}
	if err != nil {
		return 0, fmt.Errorf("read schema version: %w", err)
	}
	return int(version.Int64), nil
}

// SplitStatements splits a migration file on semicolons that end a line.
// Migrations are written so that no string literal or routine body contains
// such a semicolon; "--" line comments and blank lines are dropped.
func SplitStatements(body string) []string {
	var statements []string
	var current strings.Builder
	for _, line := range strings.Split(body, "\n") {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" || strings.HasPrefix(trimmed, "--") {
			continue
		}
		current.WriteString(line)
		current.WriteByte('\n')
		if strings.HasSuffix(trimmed, ";") {
			statement := strings.TrimSuffix(strings.TrimSpace(current.String()), ";")
			if statement != "" {
				statements = append(statements, statement)
			}
			current.Reset()
		}
	}
	if rest := strings.TrimSpace(current.String()); rest != "" {
		statements = append(statements, rest)
	}
	return statements
}
