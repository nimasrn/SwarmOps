package cli

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/nimasrn/SwarmOps/internal/ops"
)

// ManifestFile is the repo-root document that describes one application. It is
// deliberately smaller than the spec it produces: an operator states what is
// true of their application, and the controller decides everything about how
// it is placed, routed, and sized beyond the chosen plan.
const ManifestFile = "swarmops.json"

// ManifestSource pins which repository, revision, and Compose service a
// source deploy reads. Every field is optional; what is absent is inferred
// from the working directory's Git remote and the controller's discovery.
type ManifestSource struct {
	ComposePath string `json:"composePath,omitempty"`
	Connection  string `json:"connection,omitempty"`
	Ref         string `json:"ref,omitempty"`
	Repository  string `json:"repository,omitempty"`
	Service     string `json:"service,omitempty"`
}

// Manifest is swarmops.json. Its JSON names are lower-camel throughout, which
// is why it is a distinct type from ops.ApplicationSpec rather than an alias:
// the spec's Env field carries no struct tag and therefore travels as "Env" on
// the wire, and the console reads it under that name.
type Manifest struct {
	Backend       string            `json:"backend,omitempty"`
	CPUs          float64           `json:"cpus,omitempty"`
	Databases     []string          `json:"databases,omitempty"`
	Domain        string            `json:"domain,omitempty"`
	Env           map[string]string `json:"env,omitempty"`
	HealthCommand []string          `json:"healthCommand,omitempty"`
	HealthPath    string            `json:"healthPath,omitempty"`
	Image         string            `json:"image,omitempty"`
	MemoryMiB     int64             `json:"memoryMiB,omitempty"`
	Metrics       bool              `json:"metrics,omitempty"`
	MetricsPath   string            `json:"metricsPath,omitempty"`
	MetricsPort   uint16            `json:"metricsPort,omitempty"`
	Name          string            `json:"name"`
	Plan          string            `json:"plan,omitempty"`
	Port          uint16            `json:"port,omitempty"`
	Replicas      uint64            `json:"replicas,omitempty"`
	Resolver      string            `json:"resolver,omitempty"`
	Server        string            `json:"server,omitempty"`
	Source        *ManifestSource   `json:"source,omitempty"`
	Tracing       bool              `json:"tracing,omitempty"`
}

// LoadManifest reads swarmops.json from a directory.
func LoadManifest(directory string) (Manifest, error) {
	path := ManifestPath(directory)
	content, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return Manifest{}, fmt.Errorf("no %s in %s; run `swarmops init` first", ManifestFile, directory)
	}
	if err != nil {
		return Manifest{}, fmt.Errorf("read %s: %w", path, err)
	}
	var manifest Manifest
	decoder := json.NewDecoder(strings.NewReader(string(content)))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&manifest); err != nil {
		return Manifest{}, fmt.Errorf("parse %s: %w", path, err)
	}
	if strings.TrimSpace(manifest.Name) == "" {
		return Manifest{}, fmt.Errorf("%s must set a name", path)
	}
	return manifest, nil
}

// ManifestPath is where LoadManifest and Save look.
func ManifestPath(directory string) string { return filepath.Join(directory, ManifestFile) }

// Save writes the manifest, refusing to clobber an existing one unless asked.
func (m Manifest) Save(directory string, overwrite bool) error {
	path := ManifestPath(directory)
	if !overwrite {
		if _, err := os.Stat(path); err == nil {
			return fmt.Errorf("%s already exists; pass --force to replace it", path)
		}
	}
	content, err := json.MarshalIndent(m, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, append(content, '\n'), 0o644)
}

// Spec renders the manifest as the application spec the controller accepts.
// Anything the manifest leaves empty stays empty, so the controller's own
// defaults and, on a source deploy, the discovered Compose still decide it.
func (m Manifest) Spec() ops.ApplicationSpec {
	return ops.ApplicationSpec{
		Backend:       strings.TrimSpace(m.Backend),
		CPUs:          m.CPUs,
		Databases:     m.Databases,
		Domain:        strings.TrimSpace(m.Domain),
		Env:           m.Env,
		HealthCommand: m.HealthCommand,
		HealthPath:    strings.TrimSpace(m.HealthPath),
		Image:         strings.TrimSpace(m.Image),
		MemoryMiB:     m.MemoryMiB,
		Metrics:       m.Metrics,
		MetricsPath:   strings.TrimSpace(m.MetricsPath),
		MetricsPort:   m.MetricsPort,
		Name:          strings.ToLower(strings.TrimSpace(m.Name)),
		Plan:          strings.ToLower(strings.TrimSpace(m.Plan)),
		Port:          m.Port,
		Replicas:      m.Replicas,
		Resolver:      strings.TrimSpace(m.Resolver),
		Tracing:       m.Tracing,
	}
}

// ManifestFromSpec is how `init` turns an existing application, or a
// discovered service, into a file the operator can edit and commit.
func ManifestFromSpec(spec ops.ApplicationSpec) Manifest {
	return Manifest{
		Backend:       spec.Backend,
		CPUs:          spec.CPUs,
		Databases:     spec.Databases,
		Domain:        spec.Domain,
		Env:           spec.Env,
		HealthCommand: spec.HealthCommand,
		HealthPath:    spec.HealthPath,
		Image:         spec.Image,
		MemoryMiB:     spec.MemoryMiB,
		Metrics:       spec.Metrics,
		MetricsPath:   spec.MetricsPath,
		MetricsPort:   spec.MetricsPort,
		Name:          spec.Name,
		Plan:          spec.Plan,
		Port:          spec.Port,
		Replicas:      spec.Replicas,
		Resolver:      spec.Resolver,
		Tracing:       spec.Tracing,
	}
}
