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

// The route, the database variable names, and the container port are the three
// things an operator previously had to supply by hand for a repository that
// already stated all three. This is the whole discovery path in one fixture.
func TestScannerDiscoversRouteDatabaseVariablesAndPort(t *testing.T) {
	compose := `services:
  api:
    build: .
    environment:
      DATABASE_URL: postgres://someone:do-not-return-this-value@db:5432/app
      CACHE_REDIS_URL: redis://cache:6379/0
      OTEL_EXPORTER_OTLP_ENDPOINT: http://collector:4318
    labels:
      traefik.enable: "true"
      traefik.http.routers.api.rule: "Host(` + "`api.example.com`" + `) && PathPrefix(` + "`/v1`" + `)"
      traefik.http.routers.api.entrypoints: websecure
      traefik.http.routers.api.tls.certresolver: letsencrypt
      traefik.http.services.api.loadbalancer.server.port: "9000"
      prometheus.io/scrape: "true"
      prometheus.io/path: /internal/metrics
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: "1.5"
          memory: 768M
  db:
    image: postgres:18
  cache:
    image: redis:8-alpine
`
	dockerfile := "FROM golang:1.26-alpine AS build\nRUN true\n\nFROM alpine:3.22\nUSER 10001\nEXPOSE 9000\nENTRYPOINT [\"/app\"]\n"
	revision := Revision{SHA: strings.Repeat("c", 40)}
	provider := &fixtureProvider{
		files: map[string][]byte{
			"compose.yaml":  []byte(compose),
			"Dockerfile":    []byte(dockerfile),
			".dockerignore": []byte(".git\n"),
		},
		repository: Repository{DefaultBranch: "main", ID: "acme/api", Name: "api", Path: "acme/api"},
		revision:   revision,
		tree: []TreeEntry{
			{Path: "compose.yaml", Type: "blob"},
			{Path: "Dockerfile", Type: "blob"},
			{Path: ".dockerignore", Type: "blob"},
		},
	}
	plan, err := scanRepository(context.Background(), provider, provider.repository, revision, Options{ImagePrefix: "ghcr.io/acme"}.withDefaults())
	if err != nil {
		t.Fatal(err)
	}
	api, found := plan.Service("compose.yaml", "api")
	if !found {
		t.Fatalf("api service not found: %#v", plan.Services)
	}
	if api.Route == nil || api.Route.Source != "traefik_labels" || strings.Join(api.Route.Hosts, ",") != "api.example.com" {
		t.Fatalf("route = %#v", api.Route)
	}
	if api.Route.PathPrefix != "/v1" || api.Route.Resolver != "letsencrypt" || !api.Route.TLS || api.Route.TargetPort != 9000 {
		t.Fatalf("route detail = %#v", api.Route)
	}
	// The load-balancer label names the port, so it wins over the Dockerfile.
	if api.Port != 9000 {
		t.Fatalf("port = %d", api.Port)
	}
	if !api.Metrics || api.Telemetry.MetricsPath != "/internal/metrics" || api.Telemetry.MetricsPort != 9000 {
		t.Fatalf("telemetry = %#v", api.Telemetry)
	}
	if !api.Tracing || strings.Join(api.Telemetry.TracingEnvVars, ",") != "OTEL_EXPORTER_OTLP_ENDPOINT" {
		t.Fatalf("tracing = %v %#v", api.Tracing, api.Telemetry)
	}
	if api.Replicas != 3 || api.CPUs != 1.5 || api.MemoryMiB != 768 {
		t.Fatalf("resources = %d %v %d", api.Replicas, api.CPUs, api.MemoryMiB)
	}
	if api.Dockerfile == nil || api.Dockerfile.Stages != 2 || api.Dockerfile.RunsAsRoot {
		t.Fatalf("dockerfile plan = %#v", api.Dockerfile)
	}
	mapped := map[string]string{}
	for _, requirement := range api.DatabaseRequirements {
		mapped[requirement.Engine] = strings.Join(requirement.EnvVars, ",")
	}
	if mapped["postgres"] != "DATABASE_URL" || mapped["redis"] != "CACHE_REDIS_URL" {
		t.Fatalf("database requirements = %#v", api.DatabaseRequirements)
	}
	encoded, err := json.Marshal(plan)
	if err != nil {
		t.Fatal(err)
	}
	// A hostname is carried because a route cannot be proposed without one; an
	// environment value never is.
	if !bytes.Contains(encoded, []byte("api.example.com")) {
		t.Fatal("the discovered route hostname must reach the plan")
	}
	if bytes.Contains(encoded, []byte("do-not-return-this-value")) {
		t.Fatalf("plan retained a source environment value: %s", encoded)
	}
}

func TestScannerBlocksStatefulServiceAndFallsBackToDockerfilePort(t *testing.T) {
	compose := `services:
  worker:
    build: .
    volumes:
      - ./data:/data
    env_file: .env
    command: ["./worker", "--verbose"]
`
	revision := Revision{SHA: strings.Repeat("d", 40)}
	provider := &fixtureProvider{
		files: map[string][]byte{
			"compose.yaml": []byte(compose),
			"Dockerfile":   []byte("FROM alpine:3.22\nEXPOSE 3000\nCMD [\"/worker\"]\n"),
		},
		repository: Repository{DefaultBranch: "main", ID: "acme/worker", Name: "worker", Path: "acme/worker"},
		revision:   revision,
		tree: []TreeEntry{
			{Path: "compose.yaml", Type: "blob"},
			{Path: "Dockerfile", Type: "blob"},
		},
	}
	plan, err := scanRepository(context.Background(), provider, provider.repository, revision, Options{ImagePrefix: "ghcr.io/acme"}.withDefaults())
	if err != nil {
		t.Fatal(err)
	}
	worker, found := plan.Service("compose.yaml", "worker")
	if !found {
		t.Fatalf("worker service not found: %#v", plan.Services)
	}
	if worker.Port != 3000 {
		t.Fatalf("port should come from the Dockerfile EXPOSE, got %d", worker.Port)
	}
	codes := map[string]FindingLevel{}
	for _, finding := range worker.Findings {
		codes[finding.Code] = finding.Level
	}
	if codes["volumes_ignored"] != FindingBlocker {
		t.Fatalf("a volume-mounting service must block: %#v", codes)
	}
	for _, code := range []string{"env_file_ignored", "command_ignored", "dockerfile_root_user"} {
		if codes[code] != FindingWarning {
			t.Fatalf("%s = %q, want warning: %#v", code, codes[code], codes)
		}
	}
	if codes["dockerignore_missing"] != FindingInfo || codes["port_from_dockerfile"] != FindingInfo {
		t.Fatalf("expected info findings: %#v", codes)
	}
	if plan.Ready {
		t.Fatal("a plan whose only application is blocked must not be ready")
	}
}
