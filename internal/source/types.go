// Package source turns authenticated Git-provider evidence into the small,
// closed application specs SwarmOps already knows how to render and admit.
// Provider Compose is inspected, never executed.
package source

import "time"

const ScannerVersion = "swarmops-source-v2"

// The managed engines a discovered data service can be mapped onto. They
// mirror the reviewed catalogue in internal/ops; the scanner names them
// without importing the control plane, which knows nothing about providers.
const (
	DatabaseMongo    = "mongo"
	DatabasePostgres = "postgres"
	DatabaseRedis    = "redis"
)

type ProviderKind string

const (
	ProviderGitHub ProviderKind = "github"
	ProviderGitLab ProviderKind = "gitlab"
	// ProviderGitea also covers Forgejo and compatible private installations.
	ProviderGitea ProviderKind = "gitea"
)

// Connection is the browser-safe view of one provider connection. It cannot
// carry a token by construction.
type Connection struct {
	Account         string       `json:"account,omitempty"`
	BaseURL         string       `json:"baseUrl"`
	CreatedAt       time.Time    `json:"createdAt"`
	CredentialState string       `json:"credentialState"`
	ID              string       `json:"id"`
	Kind            ProviderKind `json:"kind"`
	Name            string       `json:"name"`
	UpdatedAt       time.Time    `json:"updatedAt"`
}

type ConnectionInput struct {
	BaseURL string       `json:"baseUrl"`
	Kind    ProviderKind `json:"kind"`
	Name    string       `json:"name"`
	Token   string       `json:"token"`
}

// Repository is the bounded provider-neutral project record returned to the
// console. ID is the stable provider identifier and Path is the provider path
// needed for subsequent read-only calls.
type Repository struct {
	DefaultBranch string `json:"defaultBranch,omitempty"`
	ID            string `json:"id"`
	Name          string `json:"name"`
	Path          string `json:"path"`
	Private       bool   `json:"private"`
	WebURL        string `json:"webUrl,omitempty"`
}

type Revision struct {
	SHA     string `json:"sha"`
	TreeSHA string `json:"treeSha,omitempty"`
}

type TreeEntry struct {
	Mode string `json:"mode,omitempty"`
	Path string `json:"path"`
	SHA  string `json:"sha,omitempty"`
	Size int64  `json:"size,omitempty"`
	Type string `json:"type"`
}

type DiscoverRequest struct {
	ConnectionID string `json:"connectionId"`
	Ref          string `json:"ref"`
	RepositoryID string `json:"repositoryId"`
}

type Selection struct {
	ComposePath  string `json:"composePath"`
	ConnectionID string `json:"connectionId"`
	PlanID       string `json:"planId"`
	RepositoryID string `json:"repositoryId"`
	Revision     string `json:"revision"`
	Service      string `json:"service"`
}

type EvidenceFile struct {
	Digest string `json:"digest"`
	Path   string `json:"path"`
	Size   int64  `json:"size"`
}

type Classification string

const (
	ClassificationApplication    Classification = "application"
	ClassificationManagedData    Classification = "managed_data"
	ClassificationSharedPlatform Classification = "shared_platform"
	ClassificationUnsupported    Classification = "unsupported"
)

type FindingLevel string

const (
	FindingInfo    FindingLevel = "info"
	FindingWarning FindingLevel = "warning"
	FindingBlocker FindingLevel = "blocker"
)

type Finding struct {
	Code    string       `json:"code"`
	Level   FindingLevel `json:"level"`
	Message string       `json:"message"`
	Subject string       `json:"subject,omitempty"`
}

type BuildPlan struct {
	ContextPath    string `json:"contextPath"`
	DockerfilePath string `json:"dockerfilePath"`
	Image          string `json:"image"`
	// Push is false when no push registry is configured. The image is then
	// built under LocalImagePrefix and stays on the host that built it, which
	// is why the deployment pins itself to that node.
	Push     bool `json:"push"`
	Required bool `json:"required"`
}

// DockerfilePlan is the validated summary of one Dockerfile: derived facts
// only, never the file's own text, environment values, or build arguments.
type DockerfilePlan struct {
	BaseImages   []string `json:"baseImages,omitempty"`
	Entrypoint   bool     `json:"entrypoint"`
	ExposedPorts []uint16 `json:"exposedPorts,omitempty"`
	HealthPath   string   `json:"healthPath,omitempty"`
	Healthcheck  bool     `json:"healthcheck"`
	Path         string   `json:"path"`
	RunsAsRoot   bool     `json:"runsAsRoot"`
	Stages       int      `json:"stages"`
	WorkDir      string   `json:"workDir,omitempty"`
}

// RoutePlan is the public entry SwarmOps proposes for one service.
//
// Hostnames are the one label value the plan retains. A route cannot be
// proposed without the name it serves, a hostname is not a credential, and the
// operator has to see it to approve it. Source is how it was found, so the
// console can say whether SwarmOps read the route or invented it.
type RoutePlan struct {
	Hosts      []string `json:"hosts,omitempty"`
	PathPrefix string   `json:"pathPrefix,omitempty"`
	Resolver   string   `json:"resolver,omitempty"`
	// Source is "traefik_labels" when the repository already declared the
	// route, and "proposed" when SwarmOps derived an internal-only one.
	Source     string `json:"source"`
	TargetPort uint16 `json:"targetPort,omitempty"`
	TLS        bool   `json:"tls"`
}

// DatabaseRequirement maps one managed engine to the environment variable
// NAMES the application reads its connection string from.
//
// This is what stops an application from starting against a database it cannot
// find. SwarmOps used to inject POSTGRES_URL_FILE and hope; an application
// that reads DATABASE_URL would start, fail to connect, and restart forever.
// Now the managed URI is delivered under the names the repository actually
// uses. Only key names are carried — values are classified and discarded.
type DatabaseRequirement struct {
	Engine  string   `json:"engine"`
	EnvVars []string `json:"envVars,omitempty"`
	// Source is "compose_service", "environment", or "depends_on".
	Source string `json:"source"`
}

// TelemetryPlan is what the repository already says about its own signals.
type TelemetryPlan struct {
	MetricsPath string `json:"metricsPath,omitempty"`
	MetricsPort uint16 `json:"metricsPort,omitempty"`
	// TracingEnvVars names the OTLP or Jaeger variables the application reads,
	// so SwarmOps can point exactly those at the managed collector.
	TracingEnvVars []string `json:"tracingEnvVars,omitempty"`
}

// ServicePlan contains only evidence summaries and normalized intent. It does
// not retain Compose, Dockerfile, environment, label, or secret values; the
// route hostnames are the single documented exception, explained on RoutePlan.
type ServicePlan struct {
	Build                *BuildPlan            `json:"build,omitempty"`
	Classification       Classification        `json:"classification"`
	ComposePath          string                `json:"composePath"`
	CPUs                 float64               `json:"cpus,omitempty"`
	Databases            []string              `json:"databases,omitempty"`
	DatabaseRequirements []DatabaseRequirement `json:"databaseRequirements,omitempty"`
	Dockerfile           *DockerfilePlan       `json:"dockerfile,omitempty"`
	Findings             []Finding             `json:"findings,omitempty"`
	HealthPath           string                `json:"healthPath,omitempty"`
	Image                string                `json:"image,omitempty"`
	MemoryMiB            int64                 `json:"memoryMiB,omitempty"`
	Metrics              bool                  `json:"metrics"`
	Name                 string                `json:"name"`
	Port                 uint16                `json:"port,omitempty"`
	Replicas             uint64                `json:"replicas,omitempty"`
	Route                *RoutePlan            `json:"route,omitempty"`
	Service              string                `json:"service"`
	SharedStacks         []string              `json:"sharedStacks,omitempty"`
	Telemetry            TelemetryPlan         `json:"telemetry"`
	Tracing              bool                  `json:"tracing"`
}

type Plan struct {
	ComposeFiles []EvidenceFile `json:"composeFiles"`
	Dockerfiles  []EvidenceFile `json:"dockerfiles"`
	Findings     []Finding      `json:"findings,omitempty"`
	GeneratedAt  time.Time      `json:"generatedAt"`
	ID           string         `json:"id"`
	Ready        bool           `json:"ready"`
	Repository   Repository     `json:"repository"`
	Revision     Revision       `json:"revision"`
	Scanner      string         `json:"scanner"`
	Services     []ServicePlan  `json:"services"`
	SharedStacks []string       `json:"sharedStacks,omitempty"`
}

func (p Plan) Service(composePath, service string) (ServicePlan, bool) {
	for _, candidate := range p.Services {
		if candidate.ComposePath == composePath && candidate.Service == service {
			return candidate, true
		}
	}
	return ServicePlan{}, false
}
