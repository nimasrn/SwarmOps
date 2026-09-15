package ops

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/nimasrn/SwarmOps/internal/securestore"
	"github.com/nimasrn/SwarmOps/internal/sqlstore"
)

// appStoreTimeout bounds one application-store operation. The store's method
// set takes no context, so each call carries its own deadline.
const appStoreTimeout = 10 * time.Second

// ApplicationStore is the controller's record of the applications it renders.
// It exists for three reasons: the console lists them, a redeploy reuses the
// previous spec, and Prometheus discovers their metrics endpoints. The specs
// hold no credential — a database URI is referenced by engine name, never
// copied here — and environment values, which may, are sealed per row.
type ApplicationStore struct {
	db  *sqlstore.DB
	now func() time.Time
}

// ApplicationOutcome is what happened the last time an application was
// deployed.
//
// Without it a deployment that failed left nothing behind: the spec was stored
// only on success, so an application that could not start simply did not exist
// — not listed, not inspectable, not removable, and indistinguishable from one
// that had never been asked for. Keeping the spec alone would be almost as
// misleading, because an application that never started looks exactly like one
// whose stack was removed. This is the difference between them.
type ApplicationOutcome struct {
	// FailureSummary is the controller's own account of the last failure. It
	// is empty once a deployment succeeds.
	FailureSummary string    `json:"failureSummary,omitempty"`
	LastAttemptAt  time.Time `json:"lastAttemptAt,omitempty"`
	// LastCommandID names the run that explains the outcome in full — its
	// steps, its classified failure, and its execution log.
	LastCommandID string `json:"lastCommandId,omitempty"`
	// Started records whether this application has ever deployed successfully.
	// Prometheus discovery reads it: advertising a scrape target for an
	// application that never started would leave a permanently down target
	// standing in for a deployment that never happened.
	Started   bool      `json:"started"`
	StartedAt time.Time `json:"startedAt,omitempty"`
}

func NewApplicationStore(db *sqlstore.DB) (*ApplicationStore, error) {
	if db == nil {
		return nil, fmt.Errorf("application store requires a database")
	}
	return &ApplicationStore{db: db, now: time.Now}, nil
}

// List returns every stored application, ordered by name.
func (s *ApplicationStore) List() []ApplicationSpec {
	if s == nil {
		return nil
	}
	ctx, cancel := context.WithTimeout(context.Background(), appStoreTimeout)
	defer cancel()
	specs, err := s.load(ctx, "")
	if err != nil {
		return nil
	}
	return specs
}

// Get returns one stored application.
func (s *ApplicationStore) Get(name string) (ApplicationSpec, bool) {
	if s == nil {
		return ApplicationSpec{}, false
	}
	name = strings.ToLower(strings.TrimSpace(name))
	if name == "" {
		return ApplicationSpec{}, false
	}
	ctx, cancel := context.WithTimeout(context.Background(), appStoreTimeout)
	defer cancel()
	specs, err := s.load(ctx, name)
	if err != nil || len(specs) != 1 {
		return ApplicationSpec{}, false
	}
	return specs[0], true
}

// Put stores a normalized, validated spec.
func (s *ApplicationStore) Put(spec ApplicationSpec) error {
	if s == nil {
		return fmt.Errorf("application store is not configured")
	}
	normalized := spec.Normalize()
	if err := normalized.Validate(); err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(context.Background(), appStoreTimeout)
	defer cancel()
	return s.db.WithTx(ctx, func(tx *sql.Tx) error {
		return s.putTx(ctx, tx, normalized)
	})
}

func (s *ApplicationStore) putTx(ctx context.Context, tx *sql.Tx, spec ApplicationSpec) error {
	if spec.Domain != "" {
		if err := domainAvailableTx(ctx, tx, spec.Name, spec.Domain); err != nil {
			return err
		}
	}
	now := s.now().UTC()
	_, err := tx.ExecContext(ctx, `INSERT INTO applications
		(name, image, port, replicas, cpus, memory_mib, plan, domain, resolver, backend, database_delivery,
		 health_path, metrics, metrics_path, metrics_port, tracing, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON DUPLICATE KEY UPDATE image = VALUES(image), port = VALUES(port), replicas = VALUES(replicas),
		 cpus = VALUES(cpus), memory_mib = VALUES(memory_mib), plan = VALUES(plan), domain = VALUES(domain),
		 resolver = VALUES(resolver), backend = VALUES(backend), database_delivery = VALUES(database_delivery),
		 health_path = VALUES(health_path), metrics = VALUES(metrics), metrics_path = VALUES(metrics_path),
		 metrics_port = VALUES(metrics_port), tracing = VALUES(tracing), updated_at = VALUES(updated_at)`,
		spec.Name, spec.Image, spec.Port, spec.Replicas, spec.CPUs, spec.MemoryMiB, nullableText(spec.Plan),
		nullableText(spec.Domain), nullableText(spec.Resolver), nullableText(spec.Backend), nullableText(spec.DatabaseDelivery),
		nullableText(spec.HealthPath), spec.Metrics, nullableText(spec.MetricsPath), nullablePort(spec.MetricsPort), spec.Tracing, now, now)
	if sqlstore.IsDuplicate(err) {
		// Two plans raced for one hostname; the UNIQUE key decided.
		return fmt.Errorf("domain %q is already assigned to another application", spec.Domain)
	}
	if err != nil {
		return fmt.Errorf("save application: %w", err)
	}
	for _, table := range []string{"application_env", "application_health_command", "application_databases", "application_database_env"} {
		if _, err := tx.ExecContext(ctx, "DELETE FROM "+table+" WHERE application_name = ?", spec.Name); err != nil {
			return fmt.Errorf("save application: %w", err)
		}
	}
	for key, value := range spec.Env {
		sealed, err := s.db.Seal(sqlstore.Purpose("application_env", "env_value_sealed", spec.Name, key), []byte(value))
		if err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, "INSERT INTO application_env (application_name, env_key, env_value_sealed) VALUES (?, ?, ?)", spec.Name, key, sealed); err != nil {
			return fmt.Errorf("save application environment: %w", err)
		}
	}
	for position, argument := range spec.HealthCommand {
		if _, err := tx.ExecContext(ctx, "INSERT INTO application_health_command (application_name, position, argument) VALUES (?, ?, ?)", spec.Name, position, argument); err != nil {
			return fmt.Errorf("save application health command: %w", err)
		}
	}
	for position, engine := range spec.Databases {
		if _, err := tx.ExecContext(ctx, "INSERT INTO application_databases (application_name, engine, position) VALUES (?, ?, ?)", spec.Name, engine, position); err != nil {
			return fmt.Errorf("save application databases: %w", err)
		}
	}
	for engine, names := range spec.DatabaseEnv {
		for position, name := range names {
			if _, err := tx.ExecContext(ctx, "INSERT INTO application_database_env (application_name, engine, position, env_name) VALUES (?, ?, ?, ?)", spec.Name, engine, position, name); err != nil {
				return fmt.Errorf("save application database environment: %w", err)
			}
		}
	}
	return nil
}

// PutOutcome records what happened the last time this application was
// deployed. A successful deployment clears the failure it replaces.
func (s *ApplicationStore) PutOutcome(name string, outcome ApplicationOutcome) error {
	if s == nil {
		return fmt.Errorf("application store is not configured")
	}
	name = strings.ToLower(strings.TrimSpace(name))
	ctx, cancel := context.WithTimeout(context.Background(), appStoreTimeout)
	defer cancel()
	return s.db.WithTx(ctx, func(tx *sql.Tx) error {
		var exists int
		err := tx.QueryRowContext(ctx, "SELECT 1 FROM applications WHERE name = ? FOR UPDATE", name).Scan(&exists)
		if errors.Is(err, sql.ErrNoRows) {
			return fmt.Errorf("application %q is not stored", name)
		}
		if err != nil {
			return fmt.Errorf("save application outcome: %w", err)
		}
		return putOutcomeTx(ctx, tx, name, outcome)
	})
}

func putOutcomeTx(ctx context.Context, tx *sql.Tx, name string, outcome ApplicationOutcome) error {
	var previousStarted bool
	var previousStartedAt sql.NullTime
	err := tx.QueryRowContext(ctx, "SELECT started, started_at FROM application_outcomes WHERE application_name = ? FOR UPDATE", name).Scan(&previousStarted, &previousStartedAt)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return fmt.Errorf("save application outcome: %w", err)
	}
	// A deployment that has ever started keeps having started. The flag
	// answers "has this ever run", not "did the last attempt run".
	if previousStarted {
		outcome.Started = true
		if outcome.StartedAt.IsZero() && previousStartedAt.Valid {
			outcome.StartedAt = previousStartedAt.Time
		}
	}
	_, err = tx.ExecContext(ctx, `INSERT INTO application_outcomes
		(application_name, started, started_at, last_attempt_at, last_command_id, failure_summary)
		VALUES (?, ?, ?, ?, ?, ?)
		ON DUPLICATE KEY UPDATE started = VALUES(started), started_at = VALUES(started_at),
		 last_attempt_at = VALUES(last_attempt_at), last_command_id = VALUES(last_command_id),
		 failure_summary = VALUES(failure_summary)`,
		name, outcome.Started, nullableTime(outcome.StartedAt), nullableTime(outcome.LastAttemptAt),
		nullableText(outcome.LastCommandID), nullableText(outcome.FailureSummary))
	if err != nil {
		return fmt.Errorf("save application outcome: %w", err)
	}
	return nil
}

// Outcome reports the last deployment result for one application.
func (s *ApplicationStore) Outcome(name string) (ApplicationOutcome, bool) {
	if s == nil {
		return ApplicationOutcome{}, false
	}
	ctx, cancel := context.WithTimeout(context.Background(), appStoreTimeout)
	defer cancel()
	var outcome ApplicationOutcome
	var startedAt, lastAttemptAt sql.NullTime
	var lastCommandID, failureSummary sql.NullString
	err := s.db.Pool().QueryRowContext(ctx, `SELECT started, started_at, last_attempt_at, last_command_id, failure_summary
		FROM application_outcomes WHERE application_name = ?`, strings.ToLower(strings.TrimSpace(name))).
		Scan(&outcome.Started, &startedAt, &lastAttemptAt, &lastCommandID, &failureSummary)
	if err != nil {
		return ApplicationOutcome{}, false
	}
	outcome.StartedAt = startedAt.Time
	outcome.LastAttemptAt = lastAttemptAt.Time
	outcome.LastCommandID = lastCommandID.String
	outcome.FailureSummary = failureSummary.String
	return outcome, true
}

// DomainAvailable enforces controller-wide uniqueness before a deploy mutates
// Traefik. Put repeats the check, and the UNIQUE key on applications.domain
// settles a race between two plans for one hostname.
func (s *ApplicationStore) DomainAvailable(application, domain string) error {
	if s == nil {
		return fmt.Errorf("application store is not configured")
	}
	application = strings.ToLower(strings.TrimSpace(application))
	domain = strings.ToLower(strings.TrimSuffix(strings.TrimSpace(domain), "."))
	if domain == "" {
		return nil
	}
	ctx, cancel := context.WithTimeout(context.Background(), appStoreTimeout)
	defer cancel()
	var owner string
	err := s.db.Pool().QueryRowContext(ctx, "SELECT name FROM applications WHERE domain = ? AND name <> ?", domain, application).Scan(&owner)
	if errors.Is(err, sql.ErrNoRows) {
		return nil
	}
	if err != nil {
		return fmt.Errorf("check application domain: %w", err)
	}
	return fmt.Errorf("domain %q is already assigned to application %q", domain, owner)
}

func domainAvailableTx(ctx context.Context, tx *sql.Tx, application, domain string) error {
	var owner string
	err := tx.QueryRowContext(ctx, "SELECT name FROM applications WHERE domain = ? AND name <> ? FOR UPDATE", domain, application).Scan(&owner)
	if errors.Is(err, sql.ErrNoRows) {
		return nil
	}
	if err != nil {
		return fmt.Errorf("check application domain: %w", err)
	}
	return fmt.Errorf("domain %q is already assigned to application %q", domain, owner)
}

// Remove forgets one application; its environment, databases and outcome go
// with it through ON DELETE CASCADE. Callers remove the stack first, so a
// failure here leaves a listed application that is no longer running rather
// than a running application nothing lists.
func (s *ApplicationStore) Remove(name string) error {
	if s == nil {
		return fmt.Errorf("application store is not configured")
	}
	ctx, cancel := context.WithTimeout(context.Background(), appStoreTimeout)
	defer cancel()
	if _, err := s.db.Pool().ExecContext(ctx, "DELETE FROM applications WHERE name = ?", strings.ToLower(strings.TrimSpace(name))); err != nil {
		return fmt.Errorf("remove application: %w", err)
	}
	return nil
}

// load reads every application, or only the named one, with its child rows.
func (s *ApplicationStore) load(ctx context.Context, only string) ([]ApplicationSpec, error) {
	filter, args := "", []any{}
	if only != "" {
		filter, args = " WHERE name = ?", []any{only}
	}
	rows, err := s.db.Pool().QueryContext(ctx, `SELECT name, image, port, replicas, cpus, memory_mib, plan, domain, resolver,
		backend, database_delivery, health_path, metrics, metrics_path, metrics_port, tracing
		FROM applications`+filter+` ORDER BY name`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var specs []ApplicationSpec
	index := map[string]int{}
	for rows.Next() {
		var spec ApplicationSpec
		var plan, domain, resolver, backend, delivery, healthPath, metricsPath sql.NullString
		var metricsPort sql.NullInt32
		if err := rows.Scan(&spec.Name, &spec.Image, &spec.Port, &spec.Replicas, &spec.CPUs, &spec.MemoryMiB, &plan, &domain,
			&resolver, &backend, &delivery, &healthPath, &spec.Metrics, &metricsPath, &metricsPort, &spec.Tracing); err != nil {
			return nil, err
		}
		spec.Plan, spec.Domain, spec.Resolver, spec.Backend = plan.String, domain.String, resolver.String, backend.String
		spec.DatabaseDelivery, spec.HealthPath, spec.MetricsPath = delivery.String, healthPath.String, metricsPath.String
		spec.MetricsPort = uint16(metricsPort.Int32)
		index[spec.Name] = len(specs)
		specs = append(specs, spec)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(specs) == 0 {
		return specs, nil
	}
	childFilter := ""
	if only != "" {
		childFilter = " WHERE application_name = ?"
	}
	if err := eachRow(ctx, s.db.Pool(), "SELECT application_name, env_key, env_value_sealed FROM application_env"+childFilter, args, func(rows *sql.Rows) error {
		var name, key string
		var sealed []byte
		if err := rows.Scan(&name, &key, &sealed); err != nil {
			return err
		}
		value, err := s.db.Open(sqlstore.Purpose("application_env", "env_value_sealed", name, key), sealed)
		if err != nil {
			return err
		}
		spec := &specs[index[name]]
		if spec.Env == nil {
			spec.Env = map[string]string{}
		}
		spec.Env[key] = string(value)
		return nil
	}); err != nil {
		return nil, err
	}
	if err := eachRow(ctx, s.db.Pool(), "SELECT application_name, argument FROM application_health_command"+childFilter+" ORDER BY application_name, position", args, func(rows *sql.Rows) error {
		var name, argument string
		if err := rows.Scan(&name, &argument); err != nil {
			return err
		}
		specs[index[name]].HealthCommand = append(specs[index[name]].HealthCommand, argument)
		return nil
	}); err != nil {
		return nil, err
	}
	if err := eachRow(ctx, s.db.Pool(), "SELECT application_name, engine FROM application_databases"+childFilter+" ORDER BY application_name, position", args, func(rows *sql.Rows) error {
		var name, engine string
		if err := rows.Scan(&name, &engine); err != nil {
			return err
		}
		specs[index[name]].Databases = append(specs[index[name]].Databases, engine)
		return nil
	}); err != nil {
		return nil, err
	}
	if err := eachRow(ctx, s.db.Pool(), "SELECT application_name, engine, env_name FROM application_database_env"+childFilter+" ORDER BY application_name, engine, position", args, func(rows *sql.Rows) error {
		var name, engine, envName string
		if err := rows.Scan(&name, &engine, &envName); err != nil {
			return err
		}
		spec := &specs[index[name]]
		if spec.DatabaseEnv == nil {
			spec.DatabaseEnv = map[string][]string{}
		}
		spec.DatabaseEnv[engine] = append(spec.DatabaseEnv[engine], envName)
		return nil
	}); err != nil {
		return nil, err
	}
	for position := range specs {
		specs[position] = specs[position].Normalize()
	}
	return specs, nil
}

func eachRow(ctx context.Context, pool *sql.DB, query string, args []any, fn func(*sql.Rows) error) error {
	rows, err := pool.QueryContext(ctx, query, args...)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		if err := fn(rows); err != nil {
			return err
		}
	}
	return rows.Err()
}

func nullableText(value string) sql.NullString {
	return sql.NullString{String: value, Valid: value != ""}
}

func nullableTime(value time.Time) sql.NullTime {
	return sql.NullTime{Time: value.UTC(), Valid: !value.IsZero()}
}

func nullablePort(value uint16) sql.NullInt32 {
	return sql.NullInt32{Int32: int32(value), Valid: value != 0}
}

// applicationStateKey is the purpose the pre-database sealed file was bound to.
const applicationStateKey = "applications"

type applicationFile struct {
	Applications []ApplicationSpec             `json:"applications"`
	Outcomes     map[string]ApplicationOutcome `json:"outcomes,omitempty"`
	Version      int                           `json:"version"`
}

// ImportApplicationFiles copies a pre-database applications.sealed file into
// the database and reports how many applications it held. Re-running it
// overwrites each spec with the file's copy, so an interrupted import
// converges. The file itself is kept as the backup.
func ImportApplicationFiles(ctx context.Context, db *sqlstore.DB, dataDir string, dataEncryptionKey []byte) (int, error) {
	sealer, err := securestore.New(dataEncryptionKey)
	if err != nil {
		return 0, err
	}
	data, err := sealer.ReadFile(filepath.Join(dataDir, "applications.sealed"), applicationStateKey)
	if errors.Is(err, os.ErrNotExist) {
		return 0, nil
	}
	if err != nil {
		return 0, fmt.Errorf("read sealed applications: %w", err)
	}
	var saved applicationFile
	if err := json.Unmarshal(data, &saved); err != nil {
		return 0, fmt.Errorf("read sealed applications: %w", err)
	}
	// Version 1 held specs alone, and every spec in it was stored only after a
	// deployment succeeded. Reading one forward means each application it
	// carries has started, which is exactly what the outcome records.
	if saved.Version != 1 && saved.Version != 2 {
		return 0, fmt.Errorf("unsupported sealed application version")
	}
	store, err := NewApplicationStore(db)
	if err != nil {
		return 0, err
	}
	specs := make([]ApplicationSpec, 0, len(saved.Applications))
	for _, spec := range saved.Applications {
		normalized := spec.Normalize()
		if err := normalized.Validate(); err != nil {
			return 0, fmt.Errorf("read sealed applications: %w", err)
		}
		specs = append(specs, normalized)
	}
	sort.Slice(specs, func(left, right int) bool { return specs[left].Name < specs[right].Name })
	err = db.WithTx(ctx, func(tx *sql.Tx) error {
		for _, spec := range specs {
			if err := store.putTx(ctx, tx, spec); err != nil {
				return err
			}
			outcome, found := saved.Outcomes[spec.Name]
			if saved.Version == 1 {
				outcome, found = ApplicationOutcome{Started: true}, true
			}
			if found {
				if err := putOutcomeTx(ctx, tx, spec.Name, outcome); err != nil {
					return err
				}
			}
		}
		return nil
	})
	if err != nil {
		return 0, fmt.Errorf("import applications: %w", err)
	}
	return len(specs), nil
}
