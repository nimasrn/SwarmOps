// Package source turns authenticated Git-provider evidence into the small,
// closed application specs SwarmOps already knows how to render and admit.
// Provider Compose is inspected, never executed.
package source

import "time"

const ScannerVersion = "swarmops-source-v1"

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
	Required       bool   `json:"required"`
}

// ServicePlan contains only evidence summaries and normalized intent. It does
// not retain Compose, Dockerfile, environment, label, or secret values.
type ServicePlan struct {
	Build          *BuildPlan     `json:"build,omitempty"`
	Classification Classification `json:"classification"`
	ComposePath    string         `json:"composePath"`
	Databases      []string       `json:"databases,omitempty"`
	Findings       []Finding      `json:"findings,omitempty"`
	HealthPath     string         `json:"healthPath,omitempty"`
	Image          string         `json:"image,omitempty"`
	Metrics        bool           `json:"metrics"`
	Name           string         `json:"name"`
	Port           uint16         `json:"port,omitempty"`
	Service        string         `json:"service"`
	SharedStacks   []string       `json:"sharedStacks,omitempty"`
	Tracing        bool           `json:"tracing"`
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
