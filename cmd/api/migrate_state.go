package main

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/nimasrn/SwarmOps/internal/agentpull"
	"github.com/nimasrn/SwarmOps/internal/audit"
	"github.com/nimasrn/SwarmOps/internal/config"
	"github.com/nimasrn/SwarmOps/internal/coretopology"
	"github.com/nimasrn/SwarmOps/internal/ops"
	"github.com/nimasrn/SwarmOps/internal/queue"
	"github.com/nimasrn/SwarmOps/internal/remote"
	"github.com/nimasrn/SwarmOps/internal/source"
	"github.com/nimasrn/SwarmOps/internal/sqlstore"
)

// openDatabase connects to the controller database and brings its schema up
// to date with this binary.
func openDatabase(ctx context.Context, cfg config.Config) (*sqlstore.DB, error) {
	db, err := sqlstore.Open(ctx, cfg.DatabaseDSN, cfg.DataEncryptionKey, sqlstore.Options{MaxOpenConns: cfg.DatabaseMaxOpenConns})
	if err != nil {
		return nil, err
	}
	migrateContext, cancel := context.WithTimeout(ctx, 2*time.Minute)
	defer cancel()
	if err := db.Migrate(migrateContext); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("migrate controller database: %w", err)
	}
	return db, nil
}

// migrationStep is one store's import from the pre-database sealed files.
type migrationStep struct {
	name    string
	import_ func(context.Context, *sqlstore.DB, config.Config) (string, error)
}

// runMigrateState copies a controller's sealed state files into the controller
// database, one store at a time, and prints what each held. It is run once, with
// the controller stopped, when an existing installation upgrades to the
// database-backed release. Every step skips or overwrites what an earlier,
// interrupted run already imported, so it is safe to re-run. The sealed files
// are left untouched as the rollback copy.
func runMigrateState(arguments []string) {
	if len(arguments) != 0 {
		fmt.Fprintln(os.Stderr, "Usage: swarmops-core migrate-state")
		os.Exit(2)
	}
	cfg, err := config.Load()
	if err != nil {
		fmt.Fprintln(os.Stderr, "swarmops-core migrate-state: load configuration:", err)
		os.Exit(1)
	}
	ctx := context.Background()
	db, err := openDatabase(ctx, cfg)
	if err != nil {
		fmt.Fprintln(os.Stderr, "swarmops-core migrate-state:", err)
		os.Exit(1)
	}
	defer db.Close()
	count := func(n int, err error) (string, error) { return fmt.Sprintf("%d", n), err }
	key := cfg.DataEncryptionKey
	dir := cfg.DataDir
	// Topology and the agent registry first: they carry the authority epoch
	// and the CA every later record is judged against.
	steps := []migrationStep{
		{"core topology members", func(ctx context.Context, db *sqlstore.DB, cfg config.Config) (string, error) {
			return count(coretopology.ImportFiles(ctx, db, dir, key))
		}},
		{"enrolled outbound agents", func(ctx context.Context, db *sqlstore.DB, cfg config.Config) (string, error) {
			return count(agentpull.ImportFiles(ctx, db, dir, key))
		}},
		{"server profiles and retained keys", func(ctx context.Context, db *sqlstore.DB, cfg config.Config) (string, error) {
			profiles, keys, err := remote.ImportServerFiles(ctx, db, dir, key)
			return fmt.Sprintf("%d profiles, %d keys", profiles, keys), err
		}},
		{"audit events", func(ctx context.Context, db *sqlstore.DB, cfg config.Config) (string, error) {
			return count(audit.ImportFiles(ctx, db, dir, key))
		}},
		{"applications", func(ctx context.Context, db *sqlstore.DB, cfg config.Config) (string, error) {
			return count(ops.ImportApplicationFiles(ctx, db, dir, key))
		}},
		{"database credentials", func(ctx context.Context, db *sqlstore.DB, cfg config.Config) (string, error) {
			return count(ops.ImportCredentialFiles(ctx, db, dir, key))
		}},
		{"source connections", func(ctx context.Context, db *sqlstore.DB, cfg config.Config) (string, error) {
			return count(source.ImportConnectionFiles(ctx, db, dir, key))
		}},
		{"source settings", func(ctx context.Context, db *sqlstore.DB, cfg config.Config) (string, error) {
			return count(source.ImportSettingsFiles(ctx, db, dir, key))
		}},
		{"routing clusters", func(ctx context.Context, db *sqlstore.DB, cfg config.Config) (string, error) {
			return count(ops.ImportRoutingFiles(ctx, db, dir, key, cfg.TraefikACMEEmail))
		}},
		{"commands", func(ctx context.Context, db *sqlstore.DB, cfg config.Config) (string, error) {
			return count(queue.ImportFiles(ctx, db, dir, key))
		}},
	}
	for _, step := range steps {
		result, err := step.import_(ctx, db, cfg)
		if err != nil {
			fmt.Fprintf(os.Stderr, "swarmops-core migrate-state: %s: %v\n", step.name, err)
			os.Exit(1)
		}
		fmt.Printf("imported %-36s %s\n", step.name, result)
	}
	version, err := db.SchemaVersion(ctx)
	if err != nil {
		fmt.Fprintln(os.Stderr, "swarmops-core migrate-state:", err)
		os.Exit(1)
	}
	fmt.Printf("controller database is at schema version %d; the sealed files in %s are unchanged\n", version, dir)
}
