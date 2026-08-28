package source

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"strings"
	"testing"
)

func TestScannerClassifiesMonorepoAndNeverReturnsSourceValues(t *testing.T) {
	compose := `services:
  api:
    build:
      context: apps/api
      dockerfile: Dockerfile
    ports:
      - "8080:8080"
    depends_on:
      - postgres
      - redis
      - prometheus
      - jaeger
    environment:
      DATABASE_URL: postgres://do-not-return-this-value
      METRICS_PORT: "8080"
      OTEL_EXPORTER_OTLP_ENDPOINT: http://jaeger:4318
    healthcheck:
      test: ["CMD-SHELL", "curl -fsS http://127.0.0.1:8080/healthz"]
  postgres:
    image: postgres:18
  redis:
    image: valkey/valkey:9
  prometheus:
    image: prom/prometheus:v3.14.0
  jaeger:
    image: jaegertracing/jaeger:2.20.0
`
	revision := Revision{SHA: strings.Repeat("a", 40), TreeSHA: strings.Repeat("b", 40)}
	provider := &fixtureProvider{
		files: map[string][]byte{
			"deploy/compose.yaml":        []byte(compose),
			"deploy/apps/api/Dockerfile": []byte("FROM scratch\n"),
		},
		repository: Repository{DefaultBranch: "main", ID: "acme/mono", Name: "mono", Path: "acme/mono", Private: true},
		revision:   revision,
		tree: []TreeEntry{
			{Mode: "100644", Path: "deploy/compose.yaml", Type: "blob"},
			{Mode: "100644", Path: "deploy/apps/api/Dockerfile", Type: "blob"},
		},
	}
	plan, err := scanRepository(context.Background(), provider, provider.repository, revision, Options{ImagePrefix: "ghcr.io/acme", MaxFileBytes: 1 << 20, MaxDiscoveryBytes: 2 << 20, MaxDiscoveryFiles: 20, MaxTreeEntries: 100}.withDefaults())
	if err != nil {
		t.Fatal(err)
	}
	api, found := plan.Service("deploy/compose.yaml", "api")
	if !found {
		t.Fatalf("application service not found: %#v", plan.Services)
	}
	if api.Classification != ClassificationApplication || api.Build == nil || api.Build.ContextPath != "deploy/apps/api" || api.Build.DockerfilePath != "Dockerfile" {
		t.Fatalf("unexpected app build plan: %#v", api)
	}
	if strings.Join(api.Databases, ",") != "postgres,redis" {
		t.Fatalf("managed database mapping = %#v", api.Databases)
	}
	if strings.Join(api.SharedStacks, ",") != "swarmops-observability" || !api.Metrics || !api.Tracing || api.Port != 8080 || api.HealthPath != "/healthz" {
		t.Fatalf("shared capability mapping = %#v", api)
	}
	classes := map[string]Classification{}
	for _, service := range plan.Services {
		classes[service.Service] = service.Classification
	}
	if classes["postgres"] != ClassificationManagedData || classes["redis"] != ClassificationManagedData || classes["prometheus"] != ClassificationSharedPlatform || classes["jaeger"] != ClassificationSharedPlatform {
		t.Fatalf("service classifications = %#v", classes)
	}
	encoded, err := json.Marshal(plan)
	if err != nil {
		t.Fatal(err)
	}
	if bytes.Contains(encoded, []byte("do-not-return-this-value")) || bytes.Contains(encoded, []byte("postgres://")) {
		t.Fatalf("source environment value leaked into plan: %s", encoded)
	}
	if !plan.Ready || !strings.HasPrefix(plan.ID, "sha256:") {
		t.Fatalf("plan was not finalized: %#v", plan)
	}
}

func TestScannerReplacesKnownSourceLoggingInfrastructure(t *testing.T) {
	for _, service := range []string{"loki", "alloy", "promtail", "fluentd", "fluent-bit", "fluentbit"} {
		classification, databases, stacks := classifyService(service, "vendor/"+service+":pinned")
		if classification != ClassificationSharedPlatform || len(databases) != 0 || strings.Join(stacks, ",") != "swarmops-logs" {
			t.Fatalf("%s classification = %q, databases=%v stacks=%v", service, classification, databases, stacks)
		}
	}
}

func TestScannerFindsEveryStandaloneDockerfileInMonorepo(t *testing.T) {
	revision := Revision{SHA: strings.Repeat("c", 40)}
	provider := &fixtureProvider{
		files: map[string][]byte{
			"apps/api/Dockerfile":    []byte("FROM scratch\n"),
			"apps/worker/Dockerfile": []byte("FROM scratch\n"),
		},
		repository: Repository{DefaultBranch: "main", ID: "acme/mono", Name: "mono", Path: "acme/mono"},
		revision:   revision,
		tree: []TreeEntry{
			{Path: "apps/api/Dockerfile", Type: "blob"},
			{Path: "apps/worker/Dockerfile", Type: "blob"},
		},
	}
	plan, err := scanRepository(context.Background(), provider, provider.repository, revision, Options{ImagePrefix: "registry.example/team"}.withDefaults())
	if err != nil {
		t.Fatal(err)
	}
	if len(plan.Dockerfiles) != 2 || len(plan.Services) != 2 {
		t.Fatalf("standalone discovery = %#v", plan)
	}
	if plan.Services[0].Build == nil || plan.Services[1].Build == nil || !plan.Ready {
		t.Fatalf("standalone Dockerfiles were not deployable: %#v", plan.Services)
	}
}

func TestScannerGivesDuplicateServiceNamesDistinctBuildImages(t *testing.T) {
	revision := Revision{SHA: strings.Repeat("d", 40)}
	compose := []byte("services:\n  api:\n    build: .\n    ports: [8080]\n")
	provider := &fixtureProvider{
		files: map[string][]byte{
			"apps/one/compose.yml": compose, "apps/one/Dockerfile": []byte("FROM scratch\n"),
			"apps/two/compose.yml": compose, "apps/two/Dockerfile": []byte("FROM scratch\n"),
		},
		repository: Repository{DefaultBranch: "main", ID: "acme/mono", Name: "mono", Path: "acme/mono"},
		revision:   revision,
		tree: []TreeEntry{
			{Path: "apps/one/compose.yml", Type: "blob"}, {Path: "apps/one/Dockerfile", Type: "blob"},
			{Path: "apps/two/compose.yml", Type: "blob"}, {Path: "apps/two/Dockerfile", Type: "blob"},
		},
	}
	plan, err := scanRepository(context.Background(), provider, provider.repository, revision, Options{ImagePrefix: "ghcr.io/acme"}.withDefaults())
	if err != nil {
		t.Fatal(err)
	}
	if len(plan.Services) != 2 || plan.Services[0].Build == nil || plan.Services[1].Build == nil || plan.Services[0].Build.Image == plan.Services[1].Build.Image || plan.Services[0].Name == plan.Services[1].Name {
		t.Fatalf("duplicate services were not disambiguated: %#v", plan.Services)
	}
}

func TestScannerFindsNamedComposeVariantsWithoutBuildCollisions(t *testing.T) {
	revision := Revision{SHA: strings.Repeat("e", 40)}
	compose := []byte("services:\n  api:\n    build: .\n    ports: [8080]\n")
	provider := &fixtureProvider{
		files: map[string][]byte{
			"apps/api/compose.production.yaml": compose,
			"apps/api/docker-compose.dev.yml":  compose,
			"apps/api/Dockerfile":              []byte("FROM scratch\n"),
		},
		repository: Repository{DefaultBranch: "main", ID: "acme/mono", Name: "mono", Path: "acme/mono"},
		revision:   revision,
		tree: []TreeEntry{
			{Path: "apps/api/compose.production.yaml", Type: "blob"},
			{Path: "apps/api/docker-compose.dev.yml", Type: "blob"},
			{Path: "apps/api/Dockerfile", Type: "blob"},
		},
	}
	plan, err := scanRepository(context.Background(), provider, provider.repository, revision, Options{ImagePrefix: "ghcr.io/acme"}.withDefaults())
	if err != nil {
		t.Fatal(err)
	}
	if len(plan.ComposeFiles) != 2 || len(plan.Services) != 2 {
		t.Fatalf("named Compose variants were not found: %#v", plan)
	}
	left, right := plan.Services[0], plan.Services[1]
	if left.Build == nil || right.Build == nil || left.Build.Image == right.Build.Image || left.Name == right.Name {
		t.Fatalf("named Compose variants collided: %#v", plan.Services)
	}
}

type fixtureProvider struct {
	files      map[string][]byte
	repository Repository
	revision   Revision
	tree       []TreeEntry
}

func (p *fixtureProvider) Identity(context.Context) (string, error) { return "fixture", nil }

func (p *fixtureProvider) ListRepositories(context.Context) ([]Repository, error) {
	return []Repository{p.repository}, nil
}

func (p *fixtureProvider) Repository(context.Context, string) (Repository, error) {
	return p.repository, nil
}

func (p *fixtureProvider) ResolveRevision(context.Context, string, string) (Revision, error) {
	return p.revision, nil
}

func (p *fixtureProvider) ListTree(context.Context, string, Revision) ([]TreeEntry, error) {
	return append([]TreeEntry(nil), p.tree...), nil
}

func (p *fixtureProvider) ReadFile(_ context.Context, _ string, _ Revision, filename string) ([]byte, error) {
	data, found := p.files[filename]
	if !found {
		return nil, fmt.Errorf("fixture file missing")
	}
	return append([]byte(nil), data...), nil
}

func (p *fixtureProvider) OpenArchive(context.Context, string, Revision) (io.ReadCloser, error) {
	return nil, fmt.Errorf("not implemented")
}
