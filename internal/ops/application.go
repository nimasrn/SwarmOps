package ops

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"regexp"
	"sort"
	"strconv"
	"strings"

	"gopkg.in/yaml.v3"
)

// An application is the one thing SwarmOps generates rather than reviews. The
// operator supplies a small, closed spec — image, domain, port, health path,
// which managed databases to attach — and SwarmOps renders the Compose. The
// rendered document is then put through exactly the same ValidateCompose and
// stack-admission checks as hand-written Compose, so generation is a
// convenience over the policy rather than a way around it.
const (
	// ApplicationServiceName is fixed so router names, DNS names, and metrics
	// targets are predictable from the stack name alone.
	ApplicationServiceName = "app"

	// DeliverySecret mounts each database URI as a file and passes its path.
	// DeliveryEnv puts the URI directly in the service environment, where
	// anyone who can run `docker service inspect` can read it.
	DeliverySecret = "secret"
	DeliveryEnv    = "env"

	// DefaultResolver is the certificate resolver a routed application takes
	// when it names none. HTTP-01 needs no DNS credential and is what such a
	// hostname would be issued through anyway, so a domain never has to wait
	// for a DNS provider to be configured first.
	DefaultResolver = "http"

	// KindWeb is a routed HTTP service: it has a port, a health path, and a
	// Traefik route. KindWorker runs continuously with no port or route of its
	// own. KindJob runs to completion once per rendered change and is retried
	// only on failure, which is what a migration needs.
	KindWeb    = "web"
	KindWorker = "worker"
	KindJob    = "job"

	// ProtocolHTTP routes a web application through Traefik's HTTP
	// entrypoints. ProtocolTCP gives it an internal-only TCP route on an
	// allocated listen port instead; it can never take a public domain.
	ProtocolHTTP = "http"
	ProtocolTCP  = "tcp"

	maxApplicationDependencies = 8

	defaultHealthPath  = "/healthz"
	defaultMetricsPath = "/metrics"
	maxApplicationEnv  = 50
	maxDatabaseEnvKeys = 8
	maxSecretEnvValue  = 4096
	jobMaxAttempts     = 10
)

var (
	applicationNamePattern = regexp.MustCompile(`^[a-z][a-z0-9-]{0,40}$`)
	environmentKeyPattern  = regexp.MustCompile(`^[A-Za-z_][A-Za-z0-9_]{0,63}$`)
	httpPathPattern        = regexp.MustCompile(`^/[A-Za-z0-9._~/-]{0,200}$`)
	applicationHostPattern = regexp.MustCompile(`^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$`)
)

// ApplicationSpec is the operator-facing description of one application. Every
// field is either a bounded scalar or a name drawn from a closed set; there is
// no free-form Compose, label, or command anywhere in it.
type ApplicationSpec struct {
	// Backend names another application whose in-cluster and public URLs are
	// injected into this one. It is how a frontend finds its API.
	Backend string `json:"backend,omitempty"`
	// CPUs and MemoryMiB become both the reservation and the hard limit.
	CPUs float64 `json:"cpus"`
	// Databases attaches managed engines by name; the connection URI is
	// delivered as chosen by DatabaseDelivery.
	Databases []string `json:"databases,omitempty"`
	// DependsOn lists the applications this one calls; see ApplicationDependency.
	DependsOn        []ApplicationDependency `json:"dependsOn,omitempty"`
	DatabaseDelivery string                  `json:"databaseDelivery,omitempty"`
	// DatabaseEnv names, per engine, the environment variables this
	// application actually reads its connection string from. SwarmOps used to
	// deliver only POSTGRES_URL and hope; an application that reads
	// DATABASE_URL would start, fail to connect, and restart forever. The
	// discovery step reads these names out of the source Compose file, and
	// delivering the URI under them is what makes the attachment work.
	DatabaseEnv map[string][]string `json:"databaseEnv,omitempty"`
	// DatabaseOwner names the application whose managed database accounts this
	// one uses. Processes of one product — an API, its worker, its migration
	// job — share a database; without it each would get an empty one.
	DatabaseOwner string `json:"databaseOwner,omitempty"`
	Domain        string `json:"domain,omitempty"`
	Env           map[string]string
	// HealthCommand overrides the rendered probe for an image without a shell.
	HealthCommand []string `json:"healthCommand,omitempty"`
	HealthPath    string   `json:"healthPath,omitempty"`
	Image         string   `json:"image"`
	// Kind is web (default), worker, or job; see KindWeb.
	Kind        string `json:"kind,omitempty"`
	MemoryMiB   int64  `json:"memoryMiB"`
	Metrics     bool   `json:"metrics"`
	MetricsPath string `json:"metricsPath,omitempty"`
	MetricsPort uint16 `json:"metricsPort,omitempty"`
	Name        string `json:"name"`
	// Plan names the reviewed size this application runs at. Explicit CPUs and
	// MemoryMiB still win, so an operator who needs a size that is not offered
	// states the numbers; an empty plan and no numbers is the default plan.
	Plan string `json:"plan,omitempty"`
	Port uint16 `json:"port"`
	// Protocol is http (default) or tcp, and only for a web application.
	Protocol string `json:"protocol,omitempty"`
	Replicas uint64 `json:"replicas"`
	Resolver string `json:"resolver,omitempty"`
	// SecretEnv values are sealed at rest, copied into stack-scoped Swarm
	// secrets, and delivered as NAME_FILE paths; the value itself never
	// appears in the service environment. An empty value on redeployment
	// keeps the stored one. Status responses carry names only.
	SecretEnv map[string]string `json:"secretEnv,omitempty"`
	Tracing   bool              `json:"tracing"`
}

// ApplicationDependency names another application this one calls. SwarmOps
// binds the route and delivers its address as <NAME>_ADDRESS (the name in
// upper case with hyphens as underscores) and under every variable in Env.
type ApplicationDependency struct {
	Application string   `json:"application"`
	Env         []string `json:"env,omitempty"`
}

// Routed reports whether the application receives its own Traefik route.
func (s ApplicationSpec) Routed() bool { return s.Kind == "" || s.Kind == KindWeb }

// HTTPRouted reports whether the route is the generated HTTP one whose
// labels live in the rendered Compose.
func (s ApplicationSpec) HTTPRouted() bool { return s.Routed() && s.Protocol != ProtocolTCP }

// dependencyAddressVariable is the canonical variable carrying a dependency's
// in-cluster address.
func dependencyAddressVariable(application string) string {
	return strings.ToUpper(strings.ReplaceAll(application, "-", "_")) + "_ADDRESS"
}

// SecretEnvKeys lists the secret variable names in a stable order.
func (s ApplicationSpec) SecretEnvKeys() []string {
	keys := make([]string, 0, len(s.SecretEnv))
	for key := range s.SecretEnv {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}

// Redacted is the spec as it may leave the controller: secret values are
// replaced by empty strings so only their names are visible.
func (s ApplicationSpec) Redacted() ApplicationSpec {
	if len(s.SecretEnv) == 0 {
		return s
	}
	redacted := make(map[string]string, len(s.SecretEnv))
	for key := range s.SecretEnv {
		redacted[key] = ""
	}
	s.SecretEnv = redacted
	return s
}

// secretEnvSecretName is the stack-scoped Swarm secret holding one value. The
// digest covers the value, so a changed value is a new immutable secret and
// the service update that references it is what rotates it.
func secretEnvSecretName(stack, key, value string) string {
	sum := sha256.Sum256([]byte(key + "\x00" + value))
	return stack + "_s" + hex.EncodeToString(sum[:8])
}

// StackName is the Swarm stack this application deploys as. The namespace
// prefix is what platform admission matches against the reviewed manifest.
func (s ApplicationSpec) StackName(namespace string) string {
	return namespace + "-" + s.Name
}

// ServiceDNSName is how other services in the cluster reach this application.
func (s ApplicationSpec) ServiceDNSName(namespace string) string {
	return s.StackName(namespace) + "_" + ApplicationServiceName
}

// Normalize fills defaults and returns the spec that will actually be
// rendered, so the console and the audit trail describe the same thing that
// was deployed.
func (s ApplicationSpec) Normalize() ApplicationSpec {
	s.Backend = strings.TrimSpace(s.Backend)
	s.DatabaseDelivery = strings.TrimSpace(s.DatabaseDelivery)
	s.DatabaseOwner = strings.ToLower(strings.TrimSpace(s.DatabaseOwner))
	if s.DatabaseOwner == s.Name {
		s.DatabaseOwner = ""
	}
	s.Domain = strings.ToLower(strings.TrimSuffix(strings.TrimSpace(s.Domain), "."))
	s.HealthPath = strings.TrimSpace(s.HealthPath)
	s.Image = strings.TrimSpace(s.Image)
	s.MetricsPath = strings.TrimSpace(s.MetricsPath)
	s.Name = strings.ToLower(strings.TrimSpace(s.Name))
	s.Resolver = strings.TrimSpace(s.Resolver)
	s.Kind = strings.ToLower(strings.TrimSpace(s.Kind))
	if s.Kind == "" {
		s.Kind = KindWeb
	}
	s.Protocol = strings.ToLower(strings.TrimSpace(s.Protocol))
	if s.Protocol == "" && s.Kind == KindWeb {
		s.Protocol = ProtocolHTTP
	}
	if len(s.DependsOn) > 0 {
		dependencies := make([]ApplicationDependency, 0, len(s.DependsOn))
		for _, dependency := range s.DependsOn {
			dependency.Application = strings.ToLower(strings.TrimSpace(dependency.Application))
			env := make([]string, 0, len(dependency.Env))
			for _, key := range dependency.Env {
				if key = strings.TrimSpace(key); key != "" {
					env = append(env, key)
				}
			}
			sort.Strings(env)
			dependency.Env = env
			if len(env) == 0 {
				dependency.Env = nil
			}
			dependencies = append(dependencies, dependency)
		}
		sort.Slice(dependencies, func(i, j int) bool { return dependencies[i].Application < dependencies[j].Application })
		s.DependsOn = dependencies
	}
	// A routed application with no resolver named takes HTTP-01, which needs no
	// credential. Refusing instead made every domain require a DNS section the
	// install may never have.
	if s.Domain != "" && s.Resolver == "" {
		s.Resolver = DefaultResolver
	}
	if s.DatabaseDelivery == "" {
		s.DatabaseDelivery = DeliverySecret
	}
	if s.Kind == KindWeb && s.Protocol == ProtocolHTTP && s.HealthPath == "" && len(s.HealthCommand) == 0 {
		s.HealthPath = defaultHealthPath
	}
	if s.Kind == KindJob {
		s.Replicas = 1
	}
	if s.Metrics && s.MetricsPath == "" {
		s.MetricsPath = defaultMetricsPath
	}
	if s.Metrics && s.MetricsPort == 0 {
		s.MetricsPort = s.Port
	}
	if s.Replicas == 0 {
		s.Replicas = 1
	}
	// Size comes from the chosen plan, and anything stated explicitly overrides
	// it. An unknown plan name is left for Validate to refuse by name rather
	// than silently resolving to the default.
	s.Plan = strings.ToLower(strings.TrimSpace(s.Plan))
	if plan, err := LookupResourcePlan(s.Plan); err == nil {
		if s.CPUs == 0 {
			s.CPUs = plan.CPUCores
		}
		if s.MemoryMiB == 0 {
			s.MemoryMiB = plan.MemoryMiB
		}
	}
	databases := make([]string, 0, len(s.Databases))
	seen := map[string]bool{}
	for _, engine := range s.Databases {
		engine = strings.ToLower(strings.TrimSpace(engine))
		if engine != "" && !seen[engine] {
			seen[engine] = true
			databases = append(databases, engine)
		}
	}
	sort.Strings(databases)
	s.Databases = databases
	if len(s.DatabaseEnv) > 0 {
		normalized := make(map[string][]string, len(s.DatabaseEnv))
		for engine, keys := range s.DatabaseEnv {
			engine = strings.ToLower(strings.TrimSpace(engine))
			if !seen[engine] {
				continue
			}
			unique := map[string]bool{}
			cleaned := make([]string, 0, len(keys))
			for _, key := range keys {
				key = strings.TrimSpace(key)
				if key == "" || unique[key] {
					continue
				}
				unique[key] = true
				cleaned = append(cleaned, key)
			}
			if len(cleaned) > 0 {
				sort.Strings(cleaned)
				normalized[engine] = cleaned
			}
		}
		s.DatabaseEnv = normalized
		if len(normalized) == 0 {
			s.DatabaseEnv = nil
		}
	}
	return s
}

// Validate checks the spec on its own terms. The rendered Compose is checked
// again by ValidateCompose and platform admission before anything is deployed.
func (s ApplicationSpec) Validate() error {
	if !applicationNamePattern.MatchString(s.Name) {
		return fmt.Errorf("application name must be lowercase letters, digits, and hyphens")
	}
	if err := validateImage(s.Image); err != nil {
		return fmt.Errorf("application image: %w", err)
	}
	switch s.Kind {
	case KindWeb, "":
		if s.Port == 0 {
			return fmt.Errorf("application port is required")
		}
		switch s.Protocol {
		case "", ProtocolHTTP:
		case ProtocolTCP:
			if s.Domain != "" {
				return fmt.Errorf("a TCP application is internal and cannot claim a domain")
			}
			if s.HealthPath != "" || s.Metrics {
				return fmt.Errorf("a TCP application has no HTTP health path or metrics endpoint; give it a health command")
			}
		default:
			return fmt.Errorf("application protocol must be %q or %q", ProtocolHTTP, ProtocolTCP)
		}
	case KindWorker, KindJob:
		if s.Protocol != "" {
			return fmt.Errorf("a %s has no route, so it takes no protocol", s.Kind)
		}
		if s.Domain != "" {
			return fmt.Errorf("a %s has no route of its own and cannot claim a domain", s.Kind)
		}
		if s.Metrics {
			return fmt.Errorf("a %s has no route for metrics to be scraped through", s.Kind)
		}
		if s.Kind == KindJob && (s.HealthPath != "" || len(s.HealthCommand) > 0) {
			return fmt.Errorf("a job runs to completion and takes no health probe")
		}
		if s.Kind == KindWorker && s.HealthPath != "" {
			return fmt.Errorf("a worker has no HTTP route; give it a health command instead of a health path")
		}
	default:
		return fmt.Errorf("application kind must be %q, %q, or %q", KindWeb, KindWorker, KindJob)
	}
	if _, err := LookupResourcePlan(s.Plan); err != nil {
		return err
	}
	if s.Domain != "" && !applicationHostPattern.MatchString(s.Domain) {
		return fmt.Errorf("application domain must be a fully qualified hostname")
	}
	if s.Domain != "" && strings.TrimSpace(s.Resolver) == "" {
		return fmt.Errorf("a routed application needs a certificate resolver")
	}
	if s.Resolver != "" && !dockerReferenceName.MatchString(s.Resolver) {
		return fmt.Errorf("certificate resolver name is invalid")
	}
	if s.HealthPath != "" && !httpPathPattern.MatchString(s.HealthPath) {
		return fmt.Errorf("health path must be an absolute HTTP path")
	}
	if err := validateHealthCommand(s.HealthCommand); err != nil {
		return err
	}
	if s.Metrics {
		if !httpPathPattern.MatchString(s.MetricsPath) {
			return fmt.Errorf("metrics path must be an absolute HTTP path")
		}
		if s.MetricsPort == 0 {
			return fmt.Errorf("metrics port is required when metrics are enabled")
		}
		if s.MetricsPort != s.Port {
			return fmt.Errorf("application metrics must use the routed application port")
		}
	}
	if s.Replicas > 1000 {
		return fmt.Errorf("replicas must be 1000 or fewer")
	}
	if s.CPUs <= 0 || s.CPUs > 64 {
		return fmt.Errorf("cpus must be between 0 and 64")
	}
	if s.MemoryMiB < 64 || s.MemoryMiB > 262144 {
		return fmt.Errorf("memory must be between 64 MiB and 256 GiB")
	}
	if s.DatabaseDelivery != DeliverySecret && s.DatabaseDelivery != DeliveryEnv {
		return fmt.Errorf("database delivery must be %q or %q", DeliverySecret, DeliveryEnv)
	}
	for _, engine := range s.Databases {
		if _, err := DatabaseDefinitionFor(engine); err != nil {
			return err
		}
	}
	for engine, keys := range s.DatabaseEnv {
		if _, err := DatabaseDefinitionFor(engine); err != nil {
			return err
		}
		if len(keys) > maxDatabaseEnvKeys {
			return fmt.Errorf("a managed database may be delivered under at most %d environment variables", maxDatabaseEnvKeys)
		}
		for _, key := range keys {
			if !environmentKeyPattern.MatchString(key) {
				return fmt.Errorf("database environment variable %q has an invalid name", key)
			}
			if _, taken := s.Env[key]; taken {
				return fmt.Errorf("environment variable %q is set both directly and by a managed database", key)
			}
		}
	}
	if s.DatabaseOwner != "" && (!applicationNamePattern.MatchString(s.DatabaseOwner) || len(s.Databases) == 0) {
		return fmt.Errorf("database owner must name another application, and the application must attach a database")
	}
	if s.Backend != "" && !applicationNamePattern.MatchString(s.Backend) {
		return fmt.Errorf("backend must name another application")
	}
	if s.Backend == s.Name && s.Backend != "" {
		return fmt.Errorf("an application cannot be its own backend")
	}
	if err := validateApplicationEnv(s.Env); err != nil {
		return err
	}
	if err := validateDependencies(s); err != nil {
		return err
	}
	return validateSecretEnv(s)
}

func validateDependencies(s ApplicationSpec) error {
	if len(s.DependsOn) > maxApplicationDependencies {
		return fmt.Errorf("an application may depend on at most %d applications", maxApplicationDependencies)
	}
	seen := map[string]bool{}
	for _, dependency := range s.DependsOn {
		if !applicationNamePattern.MatchString(dependency.Application) || dependency.Application == s.Name {
			return fmt.Errorf("a dependency must name another application")
		}
		if seen[dependency.Application] {
			return fmt.Errorf("dependency %q is listed twice", dependency.Application)
		}
		seen[dependency.Application] = true
		if dependency.Application == s.Backend {
			return fmt.Errorf("%q is already the backend; list it once", dependency.Application)
		}
		for _, key := range append([]string{dependencyAddressVariable(dependency.Application)}, dependency.Env...) {
			if !environmentKeyPattern.MatchString(key) {
				return fmt.Errorf("dependency environment variable %q has an invalid name", key)
			}
			if _, taken := s.Env[key]; taken {
				return fmt.Errorf("environment variable %q is set both directly and by dependency %q", key, dependency.Application)
			}
			if _, taken := s.SecretEnv[key]; taken {
				return fmt.Errorf("environment variable %q is set both as secret and by dependency %q", key, dependency.Application)
			}
		}
		if len(dependency.Env) > maxDatabaseEnvKeys {
			return fmt.Errorf("a dependency may be delivered under at most %d environment variables", maxDatabaseEnvKeys)
		}
	}
	return nil
}

func validateSecretEnv(s ApplicationSpec) error {
	if len(s.Env)+len(s.SecretEnv) > maxApplicationEnv {
		return fmt.Errorf("an application may declare at most %d environment variables", maxApplicationEnv)
	}
	folded := make(map[string]bool, len(s.SecretEnv))
	for key, value := range s.SecretEnv {
		if folded[strings.ToLower(key)] {
			return fmt.Errorf("secret environment variables must differ by more than letter case")
		}
		folded[strings.ToLower(key)] = true
		if !environmentKeyPattern.MatchString(key) || len(key) > 58 {
			return fmt.Errorf("secret environment variable %q has an invalid name", key)
		}
		if _, taken := s.Env[key]; taken {
			return fmt.Errorf("environment variable %q is set both as plain and secret", key)
		}
		if _, taken := s.Env[key+"_FILE"]; taken {
			return fmt.Errorf("environment variable %q collides with secret %q", key+"_FILE", key)
		}
		for _, keys := range s.DatabaseEnv {
			for _, databaseKey := range keys {
				if databaseKey == key {
					return fmt.Errorf("environment variable %q is set both as secret and by a managed database", key)
				}
			}
		}
		if len(value) > maxSecretEnvValue || strings.ContainsRune(value, 0) {
			return fmt.Errorf("secret environment variable %q has an invalid value", key)
		}
	}
	return nil
}

func validateHealthCommand(command []string) error {
	if len(command) == 0 {
		return nil
	}
	if len(command) > 12 {
		return fmt.Errorf("health command may have at most 12 arguments")
	}
	for _, argument := range command {
		if argument == "" || len(argument) > 256 || strings.ContainsAny(argument, "\x00\r\n") {
			return fmt.Errorf("health command arguments must be short, single-line text")
		}
	}
	return nil
}

func validateApplicationEnv(env map[string]string) error {
	if len(env) > maxApplicationEnv {
		return fmt.Errorf("an application may declare at most %d environment variables", maxApplicationEnv)
	}
	for key, value := range env {
		if !environmentKeyPattern.MatchString(key) {
			return fmt.Errorf("environment variable %q has an invalid name", key)
		}
		if secretLikeKey.MatchString(key) {
			return fmt.Errorf("environment variable %q looks like a credential; declare it in secretEnv or attach a managed database", key)
		}
		if len(value) > 2048 || strings.ContainsAny(value, "\x00\r\n") {
			return fmt.Errorf("environment variable %q has an invalid value", key)
		}
	}
	return nil
}

// ApplicationRenderInput carries everything the renderer needs that does not
// come from the spec itself: the reviewed namespace, the sealed database URIs,
// and the backend application this one points at.
type ApplicationRenderInput struct {
	// BackendDomain and BackendPort describe the referenced backend, when the
	// spec names one.
	BackendDomain string
	BackendPort   uint16
	// DependencyAddresses maps each dependency to its in-cluster address.
	DependencyAddresses map[string]string
	// DatabaseURIs maps engine name to the sealed connection URI.
	DatabaseURIs map[string]string
	// URISecretVersions names each engine's connection-secret generation;
	// an absent engine is "v1".
	URISecretVersions map[string]string
	Namespace         string
	Route             *RouteSpec
	Spec              ApplicationSpec
}

// RenderApplication produces the Compose document for one application. It is
// deterministic: the same spec and inputs always render byte-identical YAML,
// so an unchanged application redeploys as a no-op.
func RenderApplication(input ApplicationRenderInput) ([]byte, error) {
	spec := input.Spec.Normalize()
	if err := spec.Validate(); err != nil {
		return nil, err
	}
	if !dockerReferenceName.MatchString(input.Namespace) {
		return nil, fmt.Errorf("platform namespace is invalid")
	}
	stack := spec.StackName(input.Namespace)

	environment := map[string]string{}
	if spec.Port != 0 {
		environment["PORT"] = strconv.Itoa(int(spec.Port))
	}
	for key, value := range spec.Env {
		environment[key] = value
	}
	serviceSecrets := make([]map[string]any, 0, len(spec.Databases))
	topSecrets := map[string]any{}

	for _, engine := range spec.Databases {
		definition, err := DatabaseDefinitionFor(engine)
		if err != nil {
			return nil, err
		}
		uri, found := input.DatabaseURIs[engine]
		if !found || strings.TrimSpace(uri) == "" {
			return nil, fmt.Errorf("managed %s is not deployed; deploy it before attaching it to %q", definition.DisplayName, spec.Name)
		}
		// The canonical name is always delivered, and every name the discovery
		// step found this application actually reading is delivered beside it.
		// A repository that reads DATABASE_URL now receives DATABASE_URL.
		variables := append([]string{strings.ToUpper(engine) + "_URL"}, spec.DatabaseEnv[engine]...)
		if spec.DatabaseDelivery == DeliveryEnv {
			for _, variable := range variables {
				environment[variable] = uri
			}
			continue
		}
		// The URI is copied into a stack-scoped secret so the application can
		// only ever mount its own. Sharing one cluster-wide secret would break
		// the namespace rule that stops a workload reading another's material.
		logical := engine + "_uri"
		version := input.URISecretVersions[engine]
		if version == "" {
			version = "v1"
		}
		physical := stack + "_" + engine + "_uri_" + version
		topSecrets[logical] = map[string]any{"external": true, "name": physical}
		// Compose reads `mode` as a plain integer, so this marshals as 292 —
		// the same value a hand-written `0444` produces once YAML parses it.
		serviceSecrets = append(serviceSecrets, map[string]any{"source": logical, "target": logical, "mode": 0o444})
		for _, variable := range variables {
			environment[variable+"_FILE"] = "/run/secrets/" + logical
		}
	}

	for _, key := range spec.SecretEnvKeys() {
		value := spec.SecretEnv[key]
		if value == "" {
			return nil, fmt.Errorf("secret environment variable %q has no value; supply it once and later deployments keep it", key)
		}
		logical := "env_" + strings.ToLower(key)
		topSecrets[logical] = map[string]any{"external": true, "name": secretEnvSecretName(stack, key, value)}
		serviceSecrets = append(serviceSecrets, map[string]any{"source": logical, "target": logical, "mode": 0o444})
		environment[key+"_FILE"] = "/run/secrets/" + logical
	}

	for _, dependency := range spec.DependsOn {
		address := input.DependencyAddresses[dependency.Application]
		if address == "" {
			return nil, fmt.Errorf("dependency %q has no route yet; deploy it before %q", dependency.Application, spec.Name)
		}
		for _, key := range append([]string{dependencyAddressVariable(dependency.Application)}, dependency.Env...) {
			environment[key] = address
		}
	}

	if spec.Backend != "" {
		backendService := input.Namespace + "-" + spec.Backend + "_" + ApplicationServiceName
		environment["BACKEND_INTERNAL_URL"] = "http://" + defaultRouteKey(backendService) + ".swarmops.internal:8081"
		if input.BackendDomain != "" {
			environment["BACKEND_PUBLIC_URL"] = "https://" + input.BackendDomain
		}
	}
	if spec.Tracing {
		environment["OTEL_EXPORTER_OTLP_ENDPOINT"] = "http://swarmops-jaeger-otlp.swarmops.internal:8081"
		environment["OTEL_EXPORTER_OTLP_PROTOCOL"] = "http/protobuf"
		environment["OTEL_SERVICE_NAME"] = stack
	}

	serviceKey := spec.ServiceDNSName(input.Namespace)
	routeNetwork := RouteNetworkName(serviceKey)
	// A generated application joins only its own encrypted route overlay. For
	// every declared dependency SwarmOps gives Traefik a derived alias on this
	// same overlay, so databases, backends, telemetry, and metrics remain routed
	// without putting otherwise unrelated services on a shared network.
	networks := []string{"traefik-route"}
	topNetworks := map[string]any{
		"traefik-route": map[string]any{"external": true, "name": routeNetwork},
	}

	service := map[string]any{
		"image":       spec.Image,
		"environment": environment,
		"networks":    networks,
		"deploy":      applicationDeploy(spec, stack, input.Route),
	}
	if probe := applicationHealthcheck(spec); probe != nil {
		service["healthcheck"] = probe
	}
	if len(serviceSecrets) > 0 {
		service["secrets"] = serviceSecrets
	}

	document := map[string]any{
		"version":  "3.9",
		"services": map[string]any{ApplicationServiceName: service},
		"networks": topNetworks,
	}
	if len(topSecrets) > 0 {
		document["secrets"] = topSecrets
	}
	rendered, err := yaml.Marshal(document)
	if err != nil {
		return nil, fmt.Errorf("render application compose: %w", err)
	}
	return rendered, nil
}

// applicationHealthcheck renders a portable HTTP probe. It needs a shell with
// wget or curl in the image; an image without either must supply an explicit
// HealthCommand instead.
func applicationHealthcheck(spec ApplicationSpec) map[string]any {
	var test []string
	switch {
	case len(spec.HealthCommand) > 0:
		test = append([]string{"CMD"}, spec.HealthCommand...)
	case spec.HealthPath != "":
		target := fmt.Sprintf("http://127.0.0.1:%d%s", spec.Port, spec.HealthPath)
		test = []string{"CMD-SHELL", fmt.Sprintf("wget -q -O - %s > /dev/null 2>&1 || curl -fsS %s > /dev/null 2>&1 || exit 1", target, target)}
	default:
		return nil
	}
	return map[string]any{
		"test":         test,
		"interval":     "15s",
		"timeout":      "5s",
		"retries":      5,
		"start_period": "30s",
	}
}

func applicationDeploy(spec ApplicationSpec, stack string, requested *RouteSpec) map[string]any {
	resources := map[string]any{
		"reservations": map[string]any{"cpus": formatCPUs(spec.CPUs), "memory": fmt.Sprintf("%dM", spec.MemoryMiB)},
		"limits":       map[string]any{"cpus": formatCPUs(spec.CPUs), "memory": fmt.Sprintf("%dM", spec.MemoryMiB)},
	}
	switch spec.Kind {
	case KindJob:
		// Neither a job nor a worker carries Traefik labels: it has no route,
		// and Traefik ignores a service it was never told about.
		//
		// A replicated job runs once per service change: a new image or a
		// changed setting is what makes Swarm run it again.
		return map[string]any{
			"mode":           "replicated-job",
			"replicas":       1,
			"restart_policy": map[string]any{"condition": "on-failure", "delay": "10s", "max_attempts": jobMaxAttempts},
			"resources":      resources,
		}
	case KindWorker:
		return map[string]any{
			"replicas": spec.Replicas,
			"update_config": map[string]any{
				"order":          "start-first",
				"parallelism":    1,
				"failure_action": "rollback",
				"monitor":        "45s",
			},
			"rollback_config": map[string]any{"order": "start-first"},
			"restart_policy":  map[string]any{"condition": "any", "delay": "5s"},
			"resources":       resources,
		}
	}
	deploy := map[string]any{
		"replicas": spec.Replicas,
		"update_config": map[string]any{
			"order":          "start-first",
			"parallelism":    1,
			"failure_action": "rollback",
			"monitor":        "45s",
		},
		"rollback_config": map[string]any{"order": "start-first"},
		"restart_policy":  map[string]any{"condition": "any", "delay": "5s"},
		"resources": map[string]any{
			"reservations": map[string]any{"cpus": formatCPUs(spec.CPUs), "memory": fmt.Sprintf("%dM", spec.MemoryMiB)},
			"limits":       map[string]any{"cpus": formatCPUs(spec.CPUs), "memory": fmt.Sprintf("%dM", spec.MemoryMiB)},
		},
	}
	// A TCP route's labels are applied by the route reconciliation after the
	// stack is deployed, exactly like a managed database's.
	if spec.Protocol != ProtocolTCP {
		if labels := applicationLabels(spec, stack, requested); len(labels) > 0 {
			deploy["labels"] = labels
		}
	}
	return deploy
}

// applicationLabels renders only the Traefik subset platform admission
// accepts: one HTTPS router on the approved domain and resolver, and the
// service port. The HTTP-to-HTTPS redirect is handled by Traefik's own
// entrypoint configuration rather than per-application middleware labels,
// which admission does not allow a browser-originated stack to define.
func applicationLabels(spec ApplicationSpec, stack string, requested *RouteSpec) map[string]string {
	route := applicationRouteSpec(spec, stack)
	if requested != nil {
		route = requested.Normalize()
	}
	labels, err := RenderRouteLabels(route, RouteNetworkName(route.ServiceKey))
	if err != nil {
		return map[string]string{"traefik.enable": "false"}
	}
	return labels
}

func applicationRouteSpec(spec ApplicationSpec, stack string) RouteSpec {
	serviceKey := stack + "_" + ApplicationServiceName
	host := spec.Domain
	if host == "" {
		host = spec.Name + ".swarmops.internal"
	}
	healthPath := spec.HealthPath
	if healthPath == "" {
		healthPath = "/"
	}
	return RouteSpec{
		AccessLogs:  true,
		Enabled:     true,
		Health:      RouteHealthProof{Kind: "response", Path: healthPath, TimeoutSeconds: 5},
		Key:         defaultRouteKey(serviceKey),
		Managed:     true,
		Match:       RouteMatch{Hosts: []string{host}, PathPrefix: "/"},
		Metrics:     true,
		Protocol:    RouteHTTP,
		PublicAllow: spec.Domain != "",
		Resolver:    "",
		Scope:       RouteInternal,
		ServiceKey:  serviceKey,
		TLS:         RouteTLSOff,
		TargetPort:  spec.Port,
		Version:     RoutingSchemaVersion,
	}.Normalize()
}

// applicationTCPRouteSpec is the internal TCP route of a tcp application. The
// listen port is left for PlanRoute to allocate within the reviewed range.
func applicationTCPRouteSpec(spec ApplicationSpec, stack string) RouteSpec {
	serviceKey := stack + "_" + ApplicationServiceName
	return RouteSpec{
		AccessLogs: false,
		Enabled:    true,
		Health:     RouteHealthProof{Kind: "handshake", TimeoutSeconds: 5},
		Key:        defaultRouteKey(serviceKey),
		Managed:    true,
		Metrics:    true,
		Protocol:   RouteTCP,
		Scope:      RouteInternal,
		ServiceKey: serviceKey,
		TLS:        RouteTLSOff,
		TargetPort: spec.Port,
		Version:    RoutingSchemaVersion,
	}.Normalize()
}

func formatCPUs(value float64) string {
	return strconv.FormatFloat(value, 'f', -1, 64)
}
