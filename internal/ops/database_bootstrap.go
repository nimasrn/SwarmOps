package ops

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// Per-application database provisioning.
//
// Until this existed, every generated application received the managed
// engine's own superuser URI, copied into a stack-scoped secret. The secret
// was scoped; the credential inside it was not. Any application could read,
// alter, or drop any other application's data, and a leaked URI was a leak of
// the whole engine.
//
// SwarmOps now gives each application its own database user, its own logical
// database, and exactly the grants that user needs. The provisioning runs
// inside a one-shot Swarm job on the managed engine's OWN image, executing a
// reviewed, checked-in script. That is the whole reason for the job: the
// controller does not speak Postgres, Mongo, or Redis, and the alternative —
// an agent operation that runs a command inside a container — would have been
// a general execution path built for one feature.
//
// Nothing about the job is operator-supplied. The image is the reviewed engine
// image, the script is a checked-in asset shipped as an immutable Docker
// config, and the only parameters are the application's own name and two
// mounted secrets.

const (
	// bootstrapNetwork is the internal data overlay the managed databases sit
	// on. The job talks to the engine's Swarm DNS name directly rather than
	// through its Traefik route, because provisioning is a control-plane act
	// and should not depend on the routing mesh being healthy.
	bootstrapNetwork = "swarmops-data"
	// bootstrapTimeout bounds one provisioning run. The scripts themselves
	// wait up to two minutes for the engine to accept connections.
	bootstrapTimeout = 5 * time.Minute
	// databaseReadyTimeout bounds the wait for the managed engine's own task
	// to pass its healthcheck. Swarm holds a task in "starting" until the
	// healthcheck succeeds, which makes this a real readiness gate.
	databaseReadyTimeout = 4 * time.Minute
)

// databaseIdentifier is the shape a generated role, user, and database name
// may take. It is deliberately narrower than any engine's own rules: lowercase
// letters, digits, and underscores, starting with a letter.
var databaseIdentifier = regexp.MustCompile(`^[a-z][a-z0-9_]{0,48}$`)

// ApplicationDatabaseIdentity is the account one application owns on one
// managed engine. Both names are derived from the application name alone, so
// they are stable across redeployments and predictable to an operator reading
// the engine directly.
type ApplicationDatabaseIdentity struct {
	Database string
	Engine   string
	Username string
}

// ApplicationDatabaseIdentityFor derives the account names for one
// application. Hyphens become underscores because a hyphenated identifier has
// to be quoted in SQL, and an unquoted-by-accident identifier is exactly the
// class of bug this code must not have.
func ApplicationDatabaseIdentityFor(application, engine string) (ApplicationDatabaseIdentity, error) {
	if !applicationNamePattern.MatchString(application) {
		return ApplicationDatabaseIdentity{}, fmt.Errorf("application name is invalid")
	}
	if _, err := DatabaseDefinitionFor(engine); err != nil {
		return ApplicationDatabaseIdentity{}, err
	}
	name := "app_" + strings.ReplaceAll(application, "-", "_")
	if !databaseIdentifier.MatchString(name) {
		return ApplicationDatabaseIdentity{}, fmt.Errorf("application name does not produce a usable database identifier")
	}
	return ApplicationDatabaseIdentity{Database: name, Engine: engine, Username: name}, nil
}

// applicationConnectionURI builds the URI the application will receive. Redis
// has no per-application database to address, so its account differs from
// Postgres and Mongo only in credential and privilege — see the reviewed
// redis-app-bootstrap.sh for why a key-prefix ACL is not used.
func (d DatabaseDefinition) applicationConnectionURI(identity ApplicationDatabaseIdentity, password string) (string, error) {
	if err := validateGeneratedPassword(password); err != nil {
		return "", err
	}
	authority := net.JoinHostPort(d.Host, strconv.Itoa(int(d.Port)))
	switch d.Engine {
	case DatabaseMongo:
		return fmt.Sprintf("mongodb://%s:%s@%s/%s?authSource=%s", identity.Username, password, authority, identity.Database, identity.Database), nil
	case DatabasePostgres:
		return fmt.Sprintf("postgres://%s:%s@%s/%s?sslmode=disable", identity.Username, password, authority, identity.Database), nil
	case DatabaseRedis:
		return fmt.Sprintf("redis://%s:%s@%s/0", identity.Username, password, authority), nil
	default:
		return "", fmt.Errorf("unsupported managed database %q", d.Engine)
	}
}

// validateGeneratedPassword keeps the URL-safe guarantee explicit. Every
// password reaching a URI or a provisioning script is generated here, so a
// value that could need escaping is a bug rather than an input.
func validateGeneratedPassword(password string) error {
	if password == "" {
		return fmt.Errorf("generated database password is empty")
	}
	for _, character := range password {
		switch {
		case character >= 'a' && character <= 'z',
			character >= 'A' && character <= 'Z',
			character >= '0' && character <= '9',
			character == '-', character == '_':
		default:
			return fmt.Errorf("generated database password is not URL-safe")
		}
	}
	return nil
}

// applicationPasswordSecretName is the Swarm secret the provisioning job reads
// the new password from. It is versioned by the application and engine so a
// rerun mounts the same value the controller sealed.
func applicationPasswordSecretName(application, engine string) string {
	return "swarmops_app_" + strings.ReplaceAll(application, "-", "_") + "_" + engine + "_password_v1"
}

// EnsureApplicationDatabases provisions every engine an application attaches
// to and returns the URI to deliver for each one.
//
// It is the startup guarantee: by the time it returns, each engine is deployed
// and healthy, the application's own user and database exist with their
// grants, and the credential is sealed. An application that reaches its first
// connection after this has a database to connect to.
func (c *ControlPlane) EnsureApplicationDatabases(ctx context.Context, actor, requestID string, spec ApplicationSpec) (map[string]string, error) {
	result := make(map[string]string, len(spec.Databases))
	for _, engine := range spec.Databases {
		uri, err := c.ensureApplicationDatabase(ctx, actor, requestID, spec.Name, engine)
		if err != nil {
			return nil, err
		}
		result[engine] = uri
	}
	return result, nil
}

func (c *ControlPlane) ensureApplicationDatabase(ctx context.Context, actor, requestID, application, engine string) (string, error) {
	definition, err := DatabaseDefinitionFor(engine)
	if err != nil {
		return "", err
	}
	identity, err := ApplicationDatabaseIdentityFor(application, engine)
	if err != nil {
		return "", err
	}
	if _, found := c.Credentials.Get(engine); !found {
		return "", fmt.Errorf("managed %s is not deployed; deploy it before attaching it to %q", definition.DisplayName, application)
	}
	secretName := applicationPasswordSecretName(application, engine)
	existing, sealed := c.Credentials.GetApplication(application, engine)
	secrets, err := c.swarmSecretNames(ctx)
	if err != nil {
		return "", err
	}
	// The sealed URI and its Swarm secret must agree. When both are present
	// the account was already provisioned and nothing here has to run again;
	// when they disagree an earlier run was interrupted, and re-provisioning
	// from the sealed value is what repairs it.
	if sealed && secrets[secretName] {
		return existing, nil
	}
	password, err := generatedPassword()
	if err != nil {
		return "", err
	}
	if sealed {
		// Reuse the password already sealed rather than rotating a credential
		// the application may currently be running with.
		if recovered := passwordFromURI(existing); recovered != "" {
			password = recovered
		}
	}
	uri, err := definition.applicationConnectionURI(identity, password)
	if err != nil {
		return "", err
	}
	// Seal before anything is created in the cluster: a Swarm secret cannot be
	// read back, so a crash after the create would otherwise leave an account
	// whose password nothing can recover.
	if err := c.Credentials.PutApplication(application, engine, uri); err != nil {
		return "", err
	}
	if !secrets[secretName] {
		if _, err := c.CLI.RunInput(ctx, strings.NewReader(password), "secret", "create", secretName, "-"); err != nil {
			return "", fmt.Errorf("create application database password secret: %w", err)
		}
	}
	if err := c.waitForDatabaseReady(ctx, definition); err != nil {
		return "", err
	}
	err = c.runDatabaseBootstrap(ctx, definition, identity, application, secretName)
	c.record(actor, requestID, "database.application-bootstrap", "application/"+application, err, map[string]string{
		"database": identity.Database,
		"engine":   engine,
		"username": identity.Username,
	})
	if err != nil {
		return "", err
	}
	return uri, nil
}

// passwordFromURI recovers the generated password from a sealed URI so a
// repeated provisioning run reuses it. It reads only the controller's own
// sealed value and never leaves this package.
func passwordFromURI(uri string) string {
	_, rest, found := strings.Cut(uri, "://")
	if !found {
		return ""
	}
	authority, _, found := strings.Cut(rest, "@")
	if !found {
		return ""
	}
	_, password, found := strings.Cut(authority, ":")
	if !found {
		return ""
	}
	if validateGeneratedPassword(password) != nil {
		return ""
	}
	return password
}

// waitForDatabaseReady blocks until the managed engine has a running task.
// Swarm holds a task in "starting" until its healthcheck passes, and every
// managed database asset defines one, so this is the engine actually
// answering rather than merely a container existing.
func (c *ControlPlane) waitForDatabaseReady(ctx context.Context, definition DatabaseDefinition) error {
	deadline := time.Now().Add(databaseReadyTimeout)
	var lastState string
	for {
		services, err := c.Docker.ListServices(ctx)
		if err != nil {
			return fmt.Errorf("read managed %s service: %w", definition.Engine, err)
		}
		serviceID := ""
		for _, service := range services {
			if service.Spec.Name == definition.Service {
				serviceID = service.ID
				break
			}
		}
		if serviceID != "" {
			tasks, err := c.Docker.ListTasks(ctx, map[string][]string{"service": {definition.Service}})
			if err != nil {
				return fmt.Errorf("read managed %s tasks: %w", definition.Engine, err)
			}
			for _, task := range tasks {
				if task.ServiceID != serviceID || task.DesiredState != "running" {
					continue
				}
				lastState = task.Status.State
				if task.Status.State == "running" {
					return nil
				}
			}
		}
		if time.Now().After(deadline) {
			if lastState == "" {
				lastState = "no task"
			}
			return fmt.Errorf("managed %s did not become ready within %s (last task state: %s)", definition.DisplayName, databaseReadyTimeout, lastState)
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(3 * time.Second):
		}
	}
}

// runDatabaseBootstrap ships the reviewed script to the cluster as an
// immutable Docker config and runs it once, on the engine's own image, with
// no restart. It waits for the task to finish and reports a non-zero exit as
// a failed deployment rather than letting the application start against a
// database it has no account on.
func (c *ControlPlane) runDatabaseBootstrap(ctx context.Context, definition DatabaseDefinition, identity ApplicationDatabaseIdentity, application, passwordSecret string) error {
	file, err := c.DatabaseSettings.bootstrapFile(definition.Engine)
	if err != nil {
		return err
	}
	if strings.TrimSpace(file) == "" {
		return fmt.Errorf("%s per-application bootstrap asset is not configured", definition.DisplayName)
	}
	script, err := os.ReadFile(file)
	if err != nil {
		return fmt.Errorf("read reviewed %s bootstrap asset: %w", definition.Engine, err)
	}
	_, image, adminSecret, err := c.DatabaseSettings.forEngine(definition.Engine)
	if err != nil {
		return err
	}
	if err := validateImage(image); err != nil {
		return fmt.Errorf("%s image: %w", definition.DisplayName, err)
	}
	configName, err := c.ensureBootstrapConfig(ctx, definition.Engine, script)
	if err != nil {
		return err
	}
	target, arguments := bootstrapCommand(definition, identity)
	name := bootstrapServiceName(application, definition.Engine)
	// A previous interrupted run leaves its service behind; removing it first
	// is what makes a retry converge instead of colliding on the name.
	_, _ = c.CLI.Run(ctx, "service", "rm", name)
	args := []string{
		"service", "create",
		"--name", name,
		"--detach",
		"--restart-condition", "none",
		"--network", bootstrapNetwork,
		"--config", "source=" + configName + ",target=" + target + ",mode=0444",
		"--secret", "source=" + adminSecret + ",target=admin_password,mode=0400",
		"--secret", "source=" + passwordSecret + ",target=app_password,mode=0400",
		"--env", "SWARMOPS_APP_USER=" + identity.Username,
		"--env", "SWARMOPS_APP_DB=" + identity.Database,
	}
	args = append(args, bootstrapEnvironment(definition)...)
	args = append(args, image)
	args = append(args, arguments...)
	if _, err := c.CLI.Run(ctx, args...); err != nil {
		return fmt.Errorf("start %s provisioning for %s: %w", definition.DisplayName, application, err)
	}
	defer func() { _, _ = c.CLI.Run(context.WithoutCancel(ctx), "service", "rm", name) }()
	return c.waitForBootstrapCompletion(ctx, definition, name)
}

// ensureBootstrapConfig creates the Docker config holding the reviewed script,
// named by its own digest. Naming it by content makes the config immutable and
// means an edited asset ships as a new object rather than silently reusing an
// old one.
func (c *ControlPlane) ensureBootstrapConfig(ctx context.Context, engine string, script []byte) (string, error) {
	digest := sha256.Sum256(script)
	name := "swarmops_" + engine + "_app_bootstrap_" + hex.EncodeToString(digest[:6])
	configs, err := c.Docker.ListConfigs(ctx)
	if err != nil {
		return "", fmt.Errorf("read Swarm configs: %w", err)
	}
	for _, config := range configs {
		if config.Spec.Name == name {
			return name, nil
		}
	}
	if _, err := c.CLI.RunInput(ctx, strings.NewReader(string(script)), "config", "create", name, "-"); err != nil {
		return "", fmt.Errorf("create reviewed %s bootstrap config: %w", engine, err)
	}
	return name, nil
}

// bootstrapCommand returns the in-container path the script is mounted at and
// the argv that runs it. Both are fixed per engine.
func bootstrapCommand(definition DatabaseDefinition, _ ApplicationDatabaseIdentity) (string, []string) {
	switch definition.Engine {
	case DatabaseMongo:
		target := "/swarmops/bootstrap.js"
		return target, []string{"mongosh", "--quiet", "--nodb", "--file", target}
	case DatabasePostgres:
		target := "/swarmops/bootstrap.sh"
		return target, []string{"sh", target}
	default:
		target := "/swarmops/bootstrap.sh"
		return target, []string{"sh", target}
	}
}

// bootstrapEnvironment names the engine on the internal overlay. The job
// reaches the managed database at its Swarm service name and target port,
// never through the routing mesh.
func bootstrapEnvironment(definition DatabaseDefinition) []string {
	port := strconv.Itoa(int(definition.TargetPort))
	switch definition.Engine {
	case DatabaseMongo:
		return []string{
			"--env", "SWARMOPS_MONGO_HOST=" + definition.Service,
			"--env", "SWARMOPS_MONGO_PORT=" + port,
			"--env", "SWARMOPS_MONGO_ADMIN_USER=" + definition.Username,
		}
	case DatabasePostgres:
		return []string{
			"--env", "PGHOST=" + definition.Service,
			"--env", "PGPORT=" + port,
			"--env", "PGUSER=" + definition.Username,
			"--env", "PGDATABASE=" + definition.Database,
		}
	default:
		return []string{
			"--env", "SWARMOPS_REDIS_HOST=" + definition.Service,
			"--env", "SWARMOPS_REDIS_PORT=" + port,
		}
	}
}

func bootstrapServiceName(application, engine string) string {
	return "swarmops-bootstrap-" + application + "-" + engine
}

// waitForBootstrapCompletion polls the one-shot job's task until it completes
// or fails. A job with restart-condition none leaves exactly one task, whose
// terminal state is the provisioning result.
func (c *ControlPlane) waitForBootstrapCompletion(ctx context.Context, definition DatabaseDefinition, name string) error {
	deadline := time.Now().Add(bootstrapTimeout)
	for {
		tasks, err := c.Docker.ListTasks(ctx, map[string][]string{"service": {name}})
		if err != nil {
			return fmt.Errorf("read %s provisioning task: %w", definition.Engine, err)
		}
		for _, task := range tasks {
			switch task.Status.State {
			case "complete":
				return nil
			case "failed", "rejected", "orphaned":
				detail := strings.TrimSpace(task.Status.Err)
				if detail == "" {
					detail = strings.TrimSpace(task.Status.Message)
				}
				return fmt.Errorf("%s provisioning did not complete: %s", definition.DisplayName, detail)
			}
		}
		if time.Now().After(deadline) {
			return fmt.Errorf("%s provisioning did not finish within %s", definition.DisplayName, bootstrapTimeout)
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(3 * time.Second):
		}
	}
}
