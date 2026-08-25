package ops

import (
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
// platform-admission checks as hand-written Compose, so generation is a
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

	defaultHealthPath  = "/healthz"
	defaultMetricsPath = "/metrics"
	maxApplicationEnv  = 50
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
	Databases        []string `json:"databases,omitempty"`
	DatabaseDelivery string   `json:"databaseDelivery,omitempty"`
	Domain           string   `json:"domain,omitempty"`
	Env              map[string]string
	// HealthCommand overrides the rendered probe for an image without a shell.
	HealthCommand []string `json:"healthCommand,omitempty"`
	HealthPath    string   `json:"healthPath,omitempty"`
	Image         string   `json:"image"`
	MemoryMiB     int64    `json:"memoryMiB"`
	Metrics       bool     `json:"metrics"`
	MetricsPath   string   `json:"metricsPath,omitempty"`
	MetricsPort   uint16   `json:"metricsPort,omitempty"`
	Name          string   `json:"name"`
	Port          uint16   `json:"port"`
	Replicas      uint64   `json:"replicas"`
	Resolver      string   `json:"resolver,omitempty"`
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
	s.Domain = strings.ToLower(strings.TrimSuffix(strings.TrimSpace(s.Domain), "."))
	s.HealthPath = strings.TrimSpace(s.HealthPath)
	s.Image = strings.TrimSpace(s.Image)
	s.MetricsPath = strings.TrimSpace(s.MetricsPath)
	s.Name = strings.ToLower(strings.TrimSpace(s.Name))
	s.Resolver = strings.TrimSpace(s.Resolver)
	if s.DatabaseDelivery == "" {
		s.DatabaseDelivery = DeliverySecret
	}
	if s.HealthPath == "" && len(s.HealthCommand) == 0 {
		s.HealthPath = defaultHealthPath
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
	if s.CPUs == 0 {
		s.CPUs = 0.5
	}
	if s.MemoryMiB == 0 {
		s.MemoryMiB = 512
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
	if s.Port == 0 {
		return fmt.Errorf("application port is required")
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
	if s.Backend != "" && !applicationNamePattern.MatchString(s.Backend) {
		return fmt.Errorf("backend must name another application")
	}
	if s.Backend == s.Name && s.Backend != "" {
		return fmt.Errorf("an application cannot be its own backend")
	}
	return validateApplicationEnv(s.Env)
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
			return fmt.Errorf("environment variable %q looks like a credential; attach a managed database or use a reviewed Git stack for other secrets", key)
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
	// DatabaseURIs maps engine name to the sealed connection URI.
	DatabaseURIs map[string]string
	Namespace    string
	Spec         ApplicationSpec
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

	environment := map[string]string{"PORT": strconv.Itoa(int(spec.Port))}
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
		variable := strings.ToUpper(engine) + "_URL"
		if spec.DatabaseDelivery == DeliveryEnv {
			environment[variable] = uri
			continue
		}
		// The URI is copied into a stack-scoped secret so the application can
		// only ever mount its own. Sharing one cluster-wide secret would break
		// the namespace rule that stops a workload reading another's material.
		logical := engine + "_uri"
		physical := stack + "_" + engine + "_uri_v1"
		topSecrets[logical] = map[string]any{"external": true, "name": physical}
		// Compose reads `mode` as a plain integer, so this marshals as 292 —
		// the same value a hand-written `0444` produces once YAML parses it.
		serviceSecrets = append(serviceSecrets, map[string]any{"source": logical, "target": logical, "mode": 0o444})
		environment[variable+"_FILE"] = "/run/secrets/" + logical
	}

	if spec.Backend != "" {
		environment["BACKEND_INTERNAL_URL"] = fmt.Sprintf("http://%s-%s_%s:%d", input.Namespace, spec.Backend, ApplicationServiceName, input.BackendPort)
		if input.BackendDomain != "" {
			environment["BACKEND_PUBLIC_URL"] = "https://" + input.BackendDomain
		}
	}

	networks := []string{"swarmops-data"}
	topNetworks := map[string]any{"swarmops-data": map[string]any{"external": true, "name": "swarmops-data"}}
	if spec.Domain != "" {
		networks = append([]string{"traefik"}, networks...)
		topNetworks["traefik"] = map[string]any{"external": true, "name": "traefik"}
	}

	service := map[string]any{
		"image":       spec.Image,
		"environment": environment,
		"networks":    networks,
		"deploy":      applicationDeploy(spec, stack),
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

func applicationDeploy(spec ApplicationSpec, stack string) map[string]any {
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
	if labels := applicationLabels(spec, stack); len(labels) > 0 {
		deploy["labels"] = labels
	}
	return deploy
}

// applicationLabels renders only the Traefik subset platform admission
// accepts: one HTTPS router on the approved domain and resolver, and the
// service port. The HTTP-to-HTTPS redirect is handled by Traefik's own
// entrypoint configuration rather than per-application middleware labels,
// which admission does not allow a browser-originated stack to define.
func applicationLabels(spec ApplicationSpec, stack string) map[string]string {
	if spec.Domain == "" {
		return nil
	}
	router := stack + "-web"
	return map[string]string{
		"traefik.enable":                                                "true",
		"traefik.docker.network":                                        "traefik",
		"traefik.http.routers." + router + ".rule":                      "Host(`" + spec.Domain + "`)",
		"traefik.http.routers." + router + ".entrypoints":               "websecure",
		"traefik.http.routers." + router + ".tls.certresolver":          spec.Resolver,
		"traefik.http.services." + router + ".loadbalancer.server.port": strconv.Itoa(int(spec.Port)),
	}
}

func formatCPUs(value float64) string {
	return strconv.FormatFloat(value, 'f', -1, 64)
}
