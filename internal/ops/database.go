package ops

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"net"
	"net/url"
	"os"
	"sort"
	"strconv"
	"strings"
)

// Managed databases are the one stateful capability SwarmOps operates from the
// console. The rule that stateful Compose is never authored in a browser is
// unchanged: these three stacks are reviewed assets checked into the
// repository and mounted read-only into the API, exactly like the Traefik and
// observability stacks. The console decides only whether one runs.
const (
	DatabaseMongo    = "mongo"
	DatabasePostgres = "postgres"
	DatabaseRedis    = "redis"
)

// databaseCatalog is the closed set of managed engines. A database that is not
// listed here cannot be deployed or removed through the API at all.
var databaseCatalog = []DatabaseDefinition{
	{
		Engine:      DatabasePostgres,
		DisplayName: "PostgreSQL",
		Stack:       "swarmops-postgres",
		Service:     "swarmops-postgres_postgres",
		Host:        "swarmops-postgres-postgres.swarmops.internal",
		Port:        15432,
		TargetPort:  5432,
		Username:    "swarmops",
		Database:    "swarmops",
		Volume:      "swarmops-postgres_swarmops_postgres_data",
	},
	{
		Engine:      DatabaseMongo,
		DisplayName: "MongoDB",
		Stack:       "swarmops-mongo",
		Service:     "swarmops-mongo_mongo",
		Host:        "swarmops-mongo-mongo.swarmops.internal",
		Port:        17017,
		TargetPort:  27017,
		Username:    "swarmops",
		Database:    "swarmops",
		Volume:      "swarmops-mongo_swarmops_mongo_data",
	},
	{
		Engine:      DatabaseRedis,
		DisplayName: "Redis",
		Stack:       "swarmops-redis",
		Service:     "swarmops-redis_redis",
		Host:        "swarmops-redis-redis.swarmops.internal",
		Port:        16379,
		TargetPort:  6379,
		Volume:      "swarmops-redis_swarmops_redis_data",
	},
}

// DatabaseDefinition describes one managed engine. Every field is fixed at
// build time; nothing here is derived from a request.
type DatabaseDefinition struct {
	Database    string
	DisplayName string
	Engine      string
	Host        string
	Port        uint16
	Service     string
	Stack       string
	TargetPort  uint16
	Username    string
	Volume      string
}

// DatabaseSettings carries the per-engine asset path, image, and generated
// password secret name from configuration. Keeping them in the API
// environment stops a remote manager from resolving these templates with its
// own shell environment.
type DatabaseSettings struct {
	// The AppBootstrap files are the reviewed per-application provisioning
	// scripts. They are read by the controller and shipped to the cluster as
	// an immutable Docker config, never referenced as a path on a manager.
	MongoAppBootstrapFile string
	MongoImage            string
	MongoPasswordSecret   string
	// MongoReplicaSet runs managed MongoDB as a single-member replica set so
	// applications can use transactions. Connection strings then carry
	// directConnection=true: a driver must keep using the in-cluster address
	// it was given rather than the member hostname in the replica-set config.
	MongoReplicaSet          bool
	MongoStackFile           string
	PostgresAppBootstrapFile string
	PostgresImage            string
	PostgresPasswordSecret   string
	PostgresStackFile        string
	RedisAppBootstrapFile    string
	RedisImage               string
	RedisPasswordSecret      string
	RedisStackFile           string
}

func (s DatabaseSettings) forEngine(engine string) (file, image, secret string, err error) {
	switch engine {
	case DatabaseMongo:
		return s.MongoStackFile, s.MongoImage, s.MongoPasswordSecret, nil
	case DatabasePostgres:
		return s.PostgresStackFile, s.PostgresImage, s.PostgresPasswordSecret, nil
	case DatabaseRedis:
		return s.RedisStackFile, s.RedisImage, s.RedisPasswordSecret, nil
	default:
		return "", "", "", fmt.Errorf("unsupported managed database %q", engine)
	}
}

func (s DatabaseSettings) bootstrapFile(engine string) (string, error) {
	switch engine {
	case DatabaseMongo:
		return s.MongoAppBootstrapFile, nil
	case DatabasePostgres:
		return s.PostgresAppBootstrapFile, nil
	case DatabaseRedis:
		return s.RedisAppBootstrapFile, nil
	default:
		return "", fmt.Errorf("unsupported managed database %q", engine)
	}
}

// DatabaseDefinitionFor returns the fixed definition for a requested engine.
func DatabaseDefinitionFor(engine string) (DatabaseDefinition, error) {
	for _, definition := range databaseCatalog {
		if definition.Engine == strings.TrimSpace(engine) {
			return definition, nil
		}
	}
	return DatabaseDefinition{}, fmt.Errorf("unsupported managed database %q", engine)
}

// DatabaseURISecretName is the Swarm secret holding a managed database's
// full in-cluster connection URI. Applications receive this secret rather than
// the raw password, so a rendered application never contains a credential.
func DatabaseURISecretName(engine string) string {
	return "swarmops_" + engine + "_uri_v1"
}

// DatabaseRemovalConfirmation is the exact phrase an operator must type to
// remove one managed database. Removing the stack leaves its named volume in
// place, but it stops the only process serving that data.
func DatabaseRemovalConfirmation(engine string) string {
	return "REMOVE_DATABASE_" + strings.ToUpper(engine)
}

// generatedPassword returns URL-safe base64 over 32 random bytes, which fits
// the managed-secret vocabulary the agent accepts.
func generatedPassword() (string, error) {
	buffer := make([]byte, 32)
	if _, err := rand.Read(buffer); err != nil {
		return "", fmt.Errorf("generate managed database password")
	}
	return base64.RawURLEncoding.EncodeToString(buffer), nil
}

// swarmSecretNames reads the cluster's Swarm secret names. It is the only
// read SwarmOps performs against secrets: a Swarm secret's value cannot be
// read back at all, which is why the password and its connection URI must be
// created together in one pass.
func (c *ControlPlane) swarmSecretNames(ctx context.Context) (map[string]bool, error) {
	output, err := c.CLI.Run(ctx, "secret", "ls", "--format", "{{.Name}}")
	if err != nil {
		return nil, fmt.Errorf("read Swarm secret names: %w", err)
	}
	names := make(map[string]bool)
	for _, line := range strings.Split(output, "\n") {
		if trimmed := strings.TrimSpace(line); trimmed != "" {
			names[trimmed] = true
		}
	}
	return names, nil
}

// ensureManagedCredentials creates a managed database's generated password and
// the matching connection URI as two Swarm secrets, in one pass, only when the
// cluster has neither. They must be created together: Swarm secrets are
// write-only, so once the password exists SwarmOps can no longer read it to
// build the URI. Existing credentials are never rotated or overwritten — a
// running database depends on the value it was created with.
func (c *ControlPlane) ensureManagedCredentials(ctx context.Context, definition DatabaseDefinition, passwordSecret, uriSecret string) error {
	names, err := c.swarmSecretNames(ctx)
	if err != nil {
		return err
	}
	switch {
	case names[passwordSecret] && names[uriSecret]:
		return nil
	case names[passwordSecret] != names[uriSecret]:
		return fmt.Errorf(
			"managed %s credentials are half-created: %q and %q must exist together, and a Swarm secret cannot be read back to rebuild the other. Remove both secrets and the %s stack, then deploy it again",
			definition.Engine, passwordSecret, uriSecret, definition.Stack,
		)
	}
	password, err := generatedPassword()
	if err != nil {
		return err
	}
	uri, err := definition.connectionURI(password)
	if err != nil {
		return err
	}
	// Seal the URI before creating anything in the cluster. A Swarm secret
	// cannot be read back, so a crash between the two creates would otherwise
	// leave a database whose credential nothing can recover.
	if err := c.Credentials.Put(definition.Engine, uri); err != nil {
		return err
	}
	if _, err := c.CLI.RunInput(ctx, strings.NewReader(password), "secret", "create", passwordSecret, "-"); err != nil {
		return fmt.Errorf("create managed database password secret: %w", err)
	}
	if _, err := c.CLI.RunInput(ctx, strings.NewReader(uri), "secret", "create", uriSecret, "-"); err != nil {
		return fmt.Errorf("create managed database connection secret: %w", err)
	}
	return nil
}

// connectionURI builds the in-cluster connection string an application uses.
// The generated password is URL-safe base64 by construction, so it needs no
// escaping; the check below keeps that guarantee explicit rather than assumed.
func (d DatabaseDefinition) connectionURI(password string) (string, error) {
	if password != url.QueryEscape(password) {
		return "", fmt.Errorf("generated password is not URL-safe")
	}
	authority := net.JoinHostPort(d.Host, strconv.Itoa(int(d.Port)))
	switch d.Engine {
	case DatabaseMongo:
		return fmt.Sprintf("mongodb://%s:%s@%s/%s?authSource=admin", d.Username, password, authority, d.Database), nil
	case DatabasePostgres:
		return fmt.Sprintf("postgres://%s:%s@%s/%s?sslmode=disable", d.Username, password, authority, d.Database), nil
	case DatabaseRedis:
		return fmt.Sprintf("redis://:%s@%s/0", password, authority), nil
	default:
		return "", fmt.Errorf("unsupported managed database %q", d.Engine)
	}
}

// Databases reports every managed engine and whether its service is currently
// running. It never returns a password, connection secret, or volume content.
func (c *ControlPlane) Databases(ctx context.Context) ([]DatabaseStatus, error) {
	services, err := c.Services(ctx)
	if err != nil {
		return nil, err
	}
	running := make(map[string]uint64, len(services))
	for _, service := range services {
		running[service.Name] = service.RunningTasks
	}
	statuses := make([]DatabaseStatus, 0, len(databaseCatalog))
	for _, definition := range databaseCatalog {
		_, image, _, err := c.DatabaseSettings.forEngine(definition.Engine)
		if err != nil {
			return nil, err
		}
		tasks, installed := running[definition.Service]
		statuses = append(statuses, DatabaseStatus{
			Database:     definition.Database,
			DisplayName:  definition.DisplayName,
			Engine:       definition.Engine,
			Host:         definition.Host,
			Image:        image,
			Installed:    installed,
			Port:         definition.Port,
			TargetPort:   definition.TargetPort,
			RunningTasks: tasks,
			Service:      definition.Service,
			Stack:        definition.Stack,
			URISecret:    DatabaseURISecretName(definition.Engine),
			Username:     definition.Username,
			Volume:       definition.Volume,
		})
	}
	sort.Slice(statuses, func(left, right int) bool { return statuses[left].Engine < statuses[right].Engine })
	return statuses, nil
}

// deployDatabaseStack renders the reviewed asset for one engine and feeds it
// to Docker through stdin, the same trusted-asset boundary the Traefik and
// observability stacks use.
func (c *ControlPlane) deployDatabaseStack(ctx context.Context, definition DatabaseDefinition, file string) error {
	raw, err := os.ReadFile(file)
	if err != nil {
		return fmt.Errorf("read managed database stack asset: %w", err)
	}
	raw, err = RenderDatabaseStack(definition.Engine, raw, c.DatabaseSettings)
	if err != nil {
		return fmt.Errorf("render managed database stack asset: %w", err)
	}
	return c.deployTrustedContent(ctx, raw, definition.Stack)
}

// MongoKeyFileSecret is the generated internal-authentication key a replica
// set member needs whenever authorization is on.
const MongoKeyFileSecret = "swarmops_mongo_keyfile_v1"

// mongoReplicaSetHost is the member address in the replica-set config. It is
// the task's own hostname, which only the member itself needs to resolve.
const mongoReplicaSetHost = "swarmops-mongo-rs0:27017"

// DeliveredURI is the connection string an application receives for engine.
func (s DatabaseSettings) DeliveredURI(engine, uri string) string {
	if engine != DatabaseMongo || !s.MongoReplicaSet || strings.Contains(uri, "directConnection=") || strings.HasPrefix(uri, "managed://") {
		return uri
	}
	separator := "?"
	if strings.Contains(uri, "?") {
		separator = "&"
	}
	return uri + separator + "directConnection=true"
}

// URISecretVersion names the stack-scoped connection secret generation. The
// replica-set URI differs from the standalone one, so switching modes must not
// reuse a secret created under the other.
func (s DatabaseSettings) URISecretVersion(engine string) string {
	if engine == DatabaseMongo && s.MongoReplicaSet {
		return "v2"
	}
	return "v1"
}

// RenderDatabaseStack replaces only the two documented templates in a managed
// database asset: its pinned image and its generated password secret name. As
// with the other trusted stacks an unresolved expression fails closed instead
// of reaching a remote manager's shell.
func RenderDatabaseStack(engine string, source []byte, settings DatabaseSettings) ([]byte, error) {
	definition, err := DatabaseDefinitionFor(engine)
	if err != nil {
		return nil, err
	}
	_, image, secret, err := settings.forEngine(definition.Engine)
	if err != nil {
		return nil, err
	}
	if err := validateImage(image); err != nil {
		return nil, fmt.Errorf("%s image: %w", definition.DisplayName, err)
	}
	if err := validateTrustedNames(map[string]string{definition.DisplayName + " password secret": secret}); err != nil {
		return nil, err
	}
	upper := strings.ToUpper(definition.Engine)
	routeNetwork := RouteNetworkName(definition.Service)
	rendered := strings.NewReplacer(
		"${"+upper+"_IMAGE:-"+databaseDefaultImage[definition.Engine]+"}", image,
		"${SWARMOPS_"+upper+"_PASSWORD_SECRET:-swarmops_"+definition.Engine+"_password_v1}", secret,
		"${SWARMOPS_"+upper+"_ROUTE_NETWORK:-"+databaseDefaultRouteNetwork[definition.Engine]+"}", routeNetwork,
	).Replace(string(source))
	if strings.Contains(rendered, "${") {
		return nil, fmt.Errorf("managed %s stack has an unresolved template expression", definition.Engine)
	}
	if definition.Engine == DatabaseMongo && settings.MongoReplicaSet {
		if rendered, err = renderMongoReplicaSet(rendered); err != nil {
			return nil, err
		}
	}
	return renderManagedRouteTemplates([]byte(rendered), map[string]RouteSpec{definition.Engine: managedDatabaseRoute(definition)})
}

// renderMongoReplicaSet turns the reviewed standalone asset into a
// single-member replica set: the keyfile, a fixed hostname for the member,
// and a health probe that initiates the set once and then reports its state.
// Each edit must find its exact anchor, so a changed asset fails closed.
func renderMongoReplicaSet(stack string) (string, error) {
	initiate := `try { rs.status().ok } catch (e) { rs.initiate({_id: \"rs0\", members: [{_id: 0, host: \"` + mongoReplicaSetHost + `\"}]}).ok }`
	edits := []struct{ anchor, replacement string }{
		{`    command: ["mongod", "--bind_ip_all", "--auth"]`, `    command: ["mongod", "--bind_ip_all", "--auth", "--replSet", "rs0", "--keyFile", "/run/secrets/mongo_keyfile"]
    hostname: swarmops-mongo-rs0`},
		{`      - source: mongo_password
        target: mongo_password
        mode: 0400`, `      - source: mongo_password
        target: mongo_password
        mode: 0400
      - source: mongo_keyfile
        target: mongo_keyfile
        uid: "999"
        gid: "999"
        mode: 0400`},
		{`      test: ["CMD-SHELL", "mongosh --quiet --eval 'db.adminCommand({ping:1}).ok' || exit 1"]`, `      test: ["CMD-SHELL", "mongosh --quiet -u swarmops -p \"$$(cat /run/secrets/mongo_password)\" --authenticationDatabase admin --eval '` + initiate + `' | grep -qx 1"]`},
		{`secrets:
  mongo_password:`, `secrets:
  mongo_keyfile:
    external: true
    name: ` + MongoKeyFileSecret + `
  mongo_password:`},
	}
	for _, edit := range edits {
		if strings.Count(stack, edit.anchor) != 1 {
			return "", fmt.Errorf("managed MongoDB asset does not match the replica-set rendering; review deploy/stacks/swarmops-mongo.yml")
		}
		stack = strings.Replace(stack, edit.anchor, edit.replacement, 1)
	}
	return stack, nil
}

// databaseDefaultImage mirrors the default written into each checked-in asset.
// The renderer must know it to match the exact template expression.
var databaseDefaultImage = map[string]string{
	DatabaseMongo:    "mongo:8.2.3",
	DatabasePostgres: "postgres:18.2-alpine",
	DatabaseRedis:    "redis:8.4-alpine",
}

var databaseDefaultRouteNetwork = map[string]string{
	DatabaseMongo:    "swarmops-route-swarmops-mongo-mongo-d5664c78",
	DatabasePostgres: "swarmops-route-swarmops-postgres-postgres-75a65713",
	DatabaseRedis:    "swarmops-route-swarmops-redis-redis-aeec253a",
}

// DatabaseStatus is the browser-safe view of one managed engine.
type DatabaseStatus struct {
	Database     string `json:"database,omitempty"`
	DisplayName  string `json:"displayName"`
	Engine       string `json:"engine"`
	Host         string `json:"host"`
	Image        string `json:"image"`
	Installed    bool   `json:"installed"`
	Port         uint16 `json:"port"`
	TargetPort   uint16 `json:"targetPort"`
	RunningTasks uint64 `json:"runningTasks"`
	Service      string `json:"service"`
	Stack        string `json:"stack"`
	URISecret    string `json:"uriSecret"`
	Username     string `json:"username,omitempty"`
	Volume       string `json:"volume"`
}

// SetDatabase deploys or removes one reviewed managed database stack. Enabling
// generates the password secret if the cluster does not already have it;
// removing requires the exact typed confirmation for that engine because it
// stops the only process serving that data.
func (c *ControlPlane) SetDatabase(ctx context.Context, actor, requestID, engine string, enabled bool, confirmation string) error {
	if !c.Mutations {
		return fmt.Errorf("cluster mutations are disabled")
	}
	if err := c.requireAudit(); err != nil {
		return err
	}
	if err := c.requireRouting(); err != nil {
		return err
	}
	definition, err := DatabaseDefinitionFor(engine)
	if err != nil {
		return err
	}
	file, _, secret, err := c.DatabaseSettings.forEngine(definition.Engine)
	if err != nil {
		return err
	}
	if enabled {
		if strings.TrimSpace(file) == "" {
			return fmt.Errorf("%s stack file is not configured", definition.DisplayName)
		}
		routes := map[string]RouteSpec{definition.Engine: managedDatabaseRoute(definition)}
		if err = c.prepareManagedRouteNetworks(ctx, routes); err == nil {
			err = c.ensureManagedCredentials(ctx, definition, secret, DatabaseURISecretName(definition.Engine))
		}
		if err == nil && definition.Engine == DatabaseMongo && c.DatabaseSettings.MongoReplicaSet {
			err = c.ensureMongoKeyFile(ctx)
		}
		if err == nil {
			err = c.deployDatabaseStack(ctx, definition, file)
		}
		if err == nil {
			err = c.activateManagedRoutes(ctx, routes, nil)
		}
	} else {
		if confirmation != DatabaseRemovalConfirmation(definition.Engine) {
			return fmt.Errorf("removal requires confirmation %s", DatabaseRemovalConfirmation(definition.Engine))
		}
		state, stateErr := c.Routing.Snapshot(c.ServerID)
		if stateErr != nil {
			return stateErr
		}
		route := managedDatabaseRoute(definition)
		for _, binding := range state.Bindings {
			if binding.TargetRoute == route.Key {
				return fmt.Errorf("managed %s remains referenced by %s", definition.Engine, binding.CallerService)
			}
		}
		for _, existing := range state.Routes {
			if existing.Key == route.Key {
				existing.Enabled = false
				plan, planErr := c.PlanRoute(ctx, existing)
				if planErr == nil {
					planErr = c.applyRoutePlan(ctx, plan)
				}
				if planErr != nil {
					return planErr
				}
			}
		}
		_, err = c.CLI.Run(ctx, "stack", "rm", definition.Stack)
		if err == nil {
			err = c.Routing.RemoveRoute(c.ServerID, route.Key)
		}
		if err == nil {
			// The Swarm secrets survive removal so an operator can inspect or
			// reattach the volume, but the controller stops holding a
			// credential for a database that is no longer running.
			c.Credentials.Forget(definition.Engine)
		}
	}
	c.record(actor, requestID, "database."+definition.Engine, "stack/"+definition.Stack, err, map[string]string{"enabled": fmt.Sprint(enabled)})
	return err
}

// ensureMongoKeyFile creates the replica-set keyfile once. Like the password it
// is generated here, written only into a Swarm secret, and never rotated: the
// running member depends on the value it started with.
func (c *ControlPlane) ensureMongoKeyFile(ctx context.Context) error {
	names, err := c.swarmSecretNames(ctx)
	if err != nil {
		return err
	}
	if names[MongoKeyFileSecret] {
		return nil
	}
	key := make([]byte, 756)
	if _, err := rand.Read(key); err != nil {
		return fmt.Errorf("generate MongoDB keyfile: %w", err)
	}
	encoded := base64.StdEncoding.EncodeToString(key)
	if _, err := c.CLI.RunInput(ctx, strings.NewReader(encoded), "secret", "create", MongoKeyFileSecret, "-"); err != nil {
		return fmt.Errorf("create MongoDB keyfile secret: %w", err)
	}
	return nil
}
