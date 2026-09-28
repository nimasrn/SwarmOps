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
	Backend       string                      `json:"backend,omitempty"`
	CPUs          float64                     `json:"cpus,omitempty"`
	DatabaseOwner string                      `json:"databaseOwner,omitempty"`
	DependsOn     []ops.ApplicationDependency `json:"dependsOn,omitempty"`
	Databases     []string                    `json:"databases,omitempty"`
	Domain        string                      `json:"domain,omitempty"`
	Env           map[string]string           `json:"env,omitempty"`
	HealthCommand []string                    `json:"healthCommand,omitempty"`
	HealthPath    string                      `json:"healthPath,omitempty"`
	Image         string                      `json:"image,omitempty"`
	Kind          string                      `json:"kind,omitempty"`
	MemoryMiB     int64                       `json:"memoryMiB,omitempty"`
	Metrics       bool                        `json:"metrics,omitempty"`
	MetricsPath   string                      `json:"metricsPath,omitempty"`
	MetricsPort   uint16                      `json:"metricsPort,omitempty"`
	Name          string                      `json:"name"`
	Plan          string                      `json:"plan,omitempty"`
	Port          uint16                      `json:"port,omitempty"`
	Protocol      string                      `json:"protocol,omitempty"`
	Replicas      uint64                      `json:"replicas,omitempty"`
	Resolver      string                      `json:"resolver,omitempty"`
	// SecretEnv names secret variables only. Their values are read from the
	// operator's environment at deploy time, so swarmops.json never holds a
	// secret; a name that is unset keeps the value the controller stored.
	SecretEnv []string        `json:"secretEnv,omitempty"`
	Server    string          `json:"server,omitempty"`
	Source    *ManifestSource `json:"source,omitempty"`
	Tracing   bool            `json:"tracing,omitempty"`
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
		DatabaseOwner: strings.ToLower(strings.TrimSpace(m.DatabaseOwner)),
		DependsOn:     m.DependsOn,
		Databases:     m.Databases,
		Domain:        strings.TrimSpace(m.Domain),
		Env:           m.Env,
		HealthCommand: m.HealthCommand,
		HealthPath:    strings.TrimSpace(m.HealthPath),
		Image:         strings.TrimSpace(m.Image),
		Kind:          strings.ToLower(strings.TrimSpace(m.Kind)),
		MemoryMiB:     m.MemoryMiB,
		Metrics:       m.Metrics,
		MetricsPath:   strings.TrimSpace(m.MetricsPath),
		MetricsPort:   m.MetricsPort,
		Name:          strings.ToLower(strings.TrimSpace(m.Name)),
		Plan:          strings.ToLower(strings.TrimSpace(m.Plan)),
		Port:          m.Port,
		Protocol:      strings.ToLower(strings.TrimSpace(m.Protocol)),
		Replicas:      m.Replicas,
		Resolver:      strings.TrimSpace(m.Resolver),
		SecretEnv:     m.secretEnv(os.LookupEnv),
		Tracing:       m.Tracing,
	}
}

// secretEnv resolves the named secrets from the environment. An unset name is
// sent empty, which tells the controller to keep its stored value; no names
// at all leaves the field out so the stored secrets are kept untouched.
func (m Manifest) secretEnv(lookup func(string) (string, bool)) map[string]string {
	if len(m.SecretEnv) == 0 {
		return nil
	}
	values := make(map[string]string, len(m.SecretEnv))
	for _, name := range m.SecretEnv {
		name = strings.TrimSpace(name)
		if name == "" {
			continue
		}
		value, _ := lookup(name)
		values[name] = value
	}
	return values
}

// ManifestFromSpec is how `init` turns an existing application, or a
// discovered service, into a file the operator can edit and commit.
func ManifestFromSpec(spec ops.ApplicationSpec) Manifest {
	return Manifest{
		Backend:       spec.Backend,
		CPUs:          spec.CPUs,
		DatabaseOwner: spec.DatabaseOwner,
		DependsOn:     spec.DependsOn,
		Databases:     spec.Databases,
		Domain:        spec.Domain,
		Env:           spec.Env,
		HealthCommand: spec.HealthCommand,
		HealthPath:    spec.HealthPath,
		Image:         spec.Image,
		Kind:          spec.Kind,
		MemoryMiB:     spec.MemoryMiB,
		Metrics:       spec.Metrics,
		MetricsPath:   spec.MetricsPath,
		MetricsPort:   spec.MetricsPort,
		Name:          spec.Name,
		Plan:          spec.Plan,
		Port:          spec.Port,
		Protocol:      spec.Protocol,
		Replicas:      spec.Replicas,
		Resolver:      spec.Resolver,
		SecretEnv:     spec.SecretEnvKeys(),
		Tracing:       spec.Tracing,
	}
}
