// Package sqlstore owns the controller's relational state: one MySQL or
// MariaDB connection pool, the transaction discipline every store follows,
// the embedded schema migrations, and column-level sealing for secrets.
//
// The data-encryption key never enters the database. A secret column holds
// securestore ciphertext whose associated data names the table, the column,
// and the row, so a value copied into another row or column fails to open
// instead of being silently accepted.
package sqlstore

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/go-sql-driver/mysql"
	"github.com/nimasrn/SwarmOps/internal/securestore"
)

// Engine names the server flavour behind the pool. Both are supported; the
// schema uses only what MariaDB 11.4 and MySQL 8.4 have in common.
type Engine string

const (
	EngineMariaDB Engine = "mariadb"
	EngineMySQL   Engine = "mysql"
)

// maxTransactionAttempts bounds retries of a transaction the server aborted
// to break a deadlock or a lock wait. Each attempt re-runs the whole function,
// so a function passed to WithTx must not have effects outside the database.
const maxTransactionAttempts = 4

type Options struct {
	ConnMaxLifetime time.Duration
	MaxIdleConns    int
	MaxOpenConns    int
}

type DB struct {
	engine  Engine
	pool    *sql.DB
	sealer  *securestore.Sealer
	version string
}

// Open connects with the settings every store relies on: UTC timestamps
// parsed into time.Time, utf8mb4, and no multi-statement queries. A DSN that
// asks for any of those differently is overridden rather than trusted.
func Open(ctx context.Context, dsn string, dataEncryptionKey []byte, options Options) (*DB, error) {
	config, err := mysql.ParseDSN(strings.TrimSpace(dsn))
	if err != nil {
		return nil, errors.New("database DSN is invalid")
	}
	if config.DBName == "" {
		return nil, errors.New("database DSN must name a database")
	}
	sealer, err := securestore.New(dataEncryptionKey)
	if err != nil {
		return nil, fmt.Errorf("configure sealed columns: %w", err)
	}
	applyRequiredParameters(config)
	connector, err := mysql.NewConnector(config)
	if err != nil {
		return nil, errors.New("database DSN is invalid")
	}
	pool := sql.OpenDB(connector)
	if options.MaxOpenConns <= 0 {
		options.MaxOpenConns = 20
	}
	if options.MaxIdleConns <= 0 {
		options.MaxIdleConns = options.MaxOpenConns / 2
	}
	if options.ConnMaxLifetime <= 0 {
		options.ConnMaxLifetime = 30 * time.Minute
	}
	pool.SetMaxOpenConns(options.MaxOpenConns)
	pool.SetMaxIdleConns(options.MaxIdleConns)
	pool.SetConnMaxLifetime(options.ConnMaxLifetime)

	pingContext, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	var version string
	if err := pool.QueryRowContext(pingContext, "SELECT VERSION()").Scan(&version); err != nil {
		_ = pool.Close()
		return nil, fmt.Errorf("connect to database: %w", redact(err))
	}
	engine := EngineMySQL
	if strings.Contains(strings.ToLower(version), "mariadb") {
		engine = EngineMariaDB
	}
	return &DB{engine: engine, pool: pool, sealer: sealer, version: version}, nil
}

func applyRequiredParameters(config *mysql.Config) {
	config.ParseTime = true
	config.Loc = time.UTC
	config.MultiStatements = false
	config.Collation = "utf8mb4_unicode_ci"
	if config.Params == nil {
		config.Params = map[string]string{}
	}
	config.Params["time_zone"] = "'+00:00'"
	if config.Timeout == 0 {
		config.Timeout = 10 * time.Second
	}
	if config.ReadTimeout == 0 {
		config.ReadTimeout = 60 * time.Second
	}
	if config.WriteTimeout == 0 {
		config.WriteTimeout = 60 * time.Second
	}
}

func (db *DB) Close() error { return db.pool.Close() }

// Pool exposes the connection pool for read queries. Writes go through WithTx.
func (db *DB) Pool() *sql.DB { return db.pool }

func (db *DB) Engine() Engine { return db.engine }

func (db *DB) Version() string { return db.version }

// Ready reports whether the database answers within the caller's deadline.
// The readiness probe uses it so a controller that lost its database stops
// being routed to rather than failing every mutation.
func (db *DB) Ready(ctx context.Context) error {
	if db == nil {
		return errors.New("database is not configured")
	}
	return db.pool.PingContext(ctx)
}

// WithTx runs fn in one READ COMMITTED transaction and commits it. The server
// may abort a transaction to resolve a deadlock or a lock-wait timeout; that
// is retried from the start, which is why fn must only touch the database.
func (db *DB) WithTx(ctx context.Context, fn func(*sql.Tx) error) error {
	var lastErr error
	for attempt := 1; attempt <= maxTransactionAttempts; attempt++ {
		lastErr = db.runTx(ctx, fn)
		if lastErr == nil || !retryable(lastErr) {
			return lastErr
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(time.Duration(attempt*attempt) * 15 * time.Millisecond):
		}
	}
	return lastErr
}

func (db *DB) runTx(ctx context.Context, fn func(*sql.Tx) error) (err error) {
	tx, err := db.pool.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelReadCommitted})
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	defer func() {
		if recovered := recover(); recovered != nil {
			_ = tx.Rollback()
			panic(recovered)
		}
		if err != nil {
			_ = tx.Rollback()
		}
	}()
	if err = fn(tx); err != nil {
		return err
	}
	if err = tx.Commit(); err != nil {
		return fmt.Errorf("commit transaction: %w", err)
	}
	return nil
}

// MySQL error numbers the stores branch on.
const (
	ErrDuplicateEntry      = 1062
	ErrLockWaitTimeout     = 1205
	ErrDeadlock            = 1213
	ErrForeignKeyViolation = 1452
	ErrRowIsReferenced     = 1451
	ErrCheckViolation      = 3819
	ErrMariaDBCheck        = 4025
)

func retryable(err error) bool {
	return IsCode(err, ErrDeadlock) || IsCode(err, ErrLockWaitTimeout)
}

// IsCode reports whether err is a server error with the given number.
func IsCode(err error, code uint16) bool {
	var mysqlErr *mysql.MySQLError
	return errors.As(err, &mysqlErr) && mysqlErr.Number == code
}

// IsServerError reports whether err came from the database server itself, as
// opposed to a domain error a transaction function returned to abort.
func IsServerError(err error) bool {
	var mysqlErr *mysql.MySQLError
	return errors.As(err, &mysqlErr)
}

// IsDuplicate reports a UNIQUE or PRIMARY KEY violation.
func IsDuplicate(err error) bool { return IsCode(err, ErrDuplicateEntry) }

// IsCheckViolation reports a CHECK constraint violation on either engine.
func IsCheckViolation(err error) bool {
	return IsCode(err, ErrCheckViolation) || IsCode(err, ErrMariaDBCheck)
}

// redact keeps a connection failure's cause without echoing the DSN, which
// carries the database password.
func redact(err error) error {
	var mysqlErr *mysql.MySQLError
	if errors.As(err, &mysqlErr) {
		return fmt.Errorf("server error %d", mysqlErr.Number)
	}
	return errors.New(strings.SplitN(err.Error(), "@", 2)[0])
}
