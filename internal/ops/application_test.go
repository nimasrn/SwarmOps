package ops

import (
	"strings"
	"testing"

	"github.com/nimasrn/SwarmOps/internal/preflight"
	"gopkg.in/yaml.v3"
)

// applicationManifest mirrors a reviewed platform manifest with two routed
// application workloads, so a rendered stack can be put through real admission.
func routedApplicationManifest() preflight.Manifest {
	return preflight.Manifest{
		APIVersion: preflight.APIVersion,
		Kind:       preflight.Kind,
		Namespace:  "production",
		Registry:   preflight.Registry{Mode: "ghcr", Host: "ghcr.io", Namespace: "nimasrn"},
		DNS: preflight.DNS{
			Providers: []preflight.DNSProvider{{Name: "cloudflare", Type: "cloudflare", CredentialSecret: "traefik_cf_dns_token_v1"}},
			Resolvers: []preflight.CertificateResolver{{Name: "le", Challenge: "dns", Provider: "cloudflare"}},
		},
		Nodes: []preflight.Node{{
			Name: "node-01", CPUCores: 8, AvailableCPUCores: 6, MemoryMiB: 16384, AvailableMemoryMiB: 12288, AvailableDiskGiB: 200, Labels: map[string]string{},
		}},
		Workloads: []preflight.Workload{
			{Name: "vlora-backend", Profile: "application", Replicas: 1, Domain: "api.vlora.ir", Resolver: "le", Resources: preflight.Resources{CPUCores: 2, MemoryMiB: 1024, DiskGiB: 10}},
			{Name: "vlora-app", Profile: "application", Replicas: 1, Domain: "vlora.ir", Resolver: "le", Resources: preflight.Resources{CPUCores: 1, MemoryMiB: 512, DiskGiB: 5}},
		},
	}
}

func vloraBackendSpec() ApplicationSpec {
	return ApplicationSpec{
		CPUs:      1,
		Databases: []string{DatabaseMongo, DatabaseRedis},
		Domain:    "api.vlora.ir",
		Env:       map[string]string{"HTTP_PORT": "8080"},
		Image:     "ghcr.io/nimasrn/vlora-backend:2026.08.25",
		MemoryMiB: 768,
		Metrics:   true,
		Name:      "vlora-backend",
		Port:      8080,
		Replicas:  1,
		Resolver:  "le",
	}
}

// This is the property the whole application model rests on: SwarmOps renders
// the Compose, but the rendered document still has to survive the same policy
// and admission a hand-written one does.
func TestRenderedApplicationPassesComposePolicyAndAdmission(t *testing.T) {
	admission, err := NewPlatformAdmission(routedApplicationManifest())
	if err != nil {
		t.Fatalf("admission: %v", err)
	}
	rendered, err := RenderApplication(ApplicationRenderInput{
		DatabaseURIs: map[string]string{
			DatabaseMongo: "mongodb://swarmops:pw@swarmops-mongo_mongo:27017/swarmops?authSource=admin",
			DatabaseRedis: "redis://:pw@swarmops-redis_redis:6379/0",
		},
		Namespace: "production",
		Spec:      vloraBackendSpec(),
	})
	if err != nil {
		t.Fatalf("render: %v", err)
	}
	plan, err := ValidateCompose(rendered)
	if err != nil {
		t.Fatalf("rendered compose was refused by policy: %v\n%s", err, rendered)
	}
	if len(plan.Services) != 1 || plan.Services[0] != ApplicationServiceName {
		t.Fatalf("unexpected rendered services %v", plan.Services)
	}
	if err := admission.ValidateStack("production-vlora-backend", rendered); err != nil {
		t.Fatalf("rendered compose was refused by admission: %v\n%s", err, rendered)
	}
}

func TestRenderedApplicationWiresDatabasesByFileAndByEnvironment(t *testing.T) {
	uris := map[string]string{
		DatabaseMongo: "mongodb://swarmops:pw@swarmops-mongo_mongo:27017/swarmops?authSource=admin",
		DatabaseRedis: "redis://:pw@swarmops-redis_redis:6379/0",
	}

	secretSpec := vloraBackendSpec()
	rendered, err := RenderApplication(ApplicationRenderInput{DatabaseURIs: uris, Namespace: "production", Spec: secretSpec})
	if err != nil {
		t.Fatalf("render: %v", err)
	}
	environment := renderedEnvironment(t, rendered)
	if environment["MONGO_URL_FILE"] != "/run/secrets/mongo_uri" || environment["REDIS_URL_FILE"] != "/run/secrets/redis_uri" {
		t.Fatalf("secret delivery did not pass file paths: %#v", environment)
	}
	if strings.Contains(string(rendered), "pw@") {
		t.Fatal("secret delivery leaked a credential into the rendered compose")
	}

	envSpec := vloraBackendSpec()
	envSpec.DatabaseDelivery = DeliveryEnv
	rendered, err = RenderApplication(ApplicationRenderInput{DatabaseURIs: uris, Namespace: "production", Spec: envSpec})
	if err != nil {
		t.Fatalf("render: %v", err)
	}
	environment = renderedEnvironment(t, rendered)
	if environment["MONGO_URL"] != uris[DatabaseMongo] || environment["REDIS_URL"] != uris[DatabaseRedis] {
		t.Fatalf("environment delivery did not inject the URIs: %#v", environment)
	}
}

func TestRenderedApplicationUsesOnlyItsDedicatedRouteNetworkAndRoutedTracing(t *testing.T) {
	spec := vloraBackendSpec()
	spec.Tracing = true
	rendered, err := RenderApplication(ApplicationRenderInput{
		DatabaseURIs: map[string]string{DatabaseMongo: "mongodb://a", DatabaseRedis: "redis://b"},
		Namespace:    "production",
		Spec:         spec,
	})
	if err != nil {
		t.Fatal(err)
	}
	var document struct {
		Networks map[string]any `yaml:"networks"`
		Services map[string]struct {
			Environment map[string]string `yaml:"environment"`
			Networks    []string          `yaml:"networks"`
		} `yaml:"services"`
	}
	if err := yaml.Unmarshal(rendered, &document); err != nil {
		t.Fatal(err)
	}
	service := document.Services[ApplicationServiceName]
	if len(service.Networks) != 1 || service.Networks[0] != "traefik-route" || len(document.Networks) != 1 || document.Networks["traefik-route"] == nil {
		t.Fatalf("application escaped its dedicated route network: %#v", document)
	}
	if got := service.Environment["OTEL_EXPORTER_OTLP_ENDPOINT"]; got != "http://swarmops-jaeger-otlp.swarmops.internal:8081" {
		t.Fatalf("OTEL endpoint = %q", got)
	}
	admission, err := NewPlatformAdmission(routedApplicationManifest())
	if err != nil {
		t.Fatal(err)
	}
	if err := admission.ValidateStack("production-vlora-backend", rendered); err != nil {
		t.Fatalf("isolated routed application was refused: %v", err)
	}
}

func TestRenderedFrontendPointsAtItsBackend(t *testing.T) {
	spec := ApplicationSpec{
		Backend:   "vlora-backend",
		CPUs:      0.5,
		Domain:    "vlora.ir",
		Image:     "ghcr.io/nimasrn/vlora-app:2026.08.25",
		MemoryMiB: 256,
		Name:      "vlora-app",
		Port:      80,
		Resolver:  "le",
	}
	rendered, err := RenderApplication(ApplicationRenderInput{
		BackendDomain: "api.vlora.ir",
		BackendPort:   8080,
		Namespace:     "production",
		Spec:          spec,
	})
	if err != nil {
		t.Fatalf("render: %v", err)
	}
	environment := renderedEnvironment(t, rendered)
	if environment["BACKEND_INTERNAL_URL"] != "http://production-vlora-backend-app.swarmops.internal:8081" {
		t.Fatalf("frontend was not wired to its backend: %#v", environment)
	}
	if environment["BACKEND_PUBLIC_URL"] != "https://api.vlora.ir" {
		t.Fatalf("frontend did not receive the public backend URL: %#v", environment)
	}
	admission, err := NewPlatformAdmission(routedApplicationManifest())
	if err != nil {
		t.Fatal(err)
	}
	if err := admission.ValidateStack("production-vlora-app", rendered); err != nil {
		t.Fatalf("rendered frontend was refused by admission: %v\n%s", err, rendered)
	}
}

func TestRenderApplicationRefusesUnapprovedInput(t *testing.T) {
	base := vloraBackendSpec()
	mutations := map[string]func(*ApplicationSpec){
		"mutable image tag":         func(s *ApplicationSpec) { s.Image = "ghcr.io/nimasrn/vlora-backend:latest" },
		"credential in environment": func(s *ApplicationSpec) { s.Env = map[string]string{"API_TOKEN": "abc"} },
		"routed without a resolver": func(s *ApplicationSpec) { s.Resolver = "" },
		"unknown database":          func(s *ApplicationSpec) { s.Databases = []string{"mysql"} },
		"invalid health path":       func(s *ApplicationSpec) { s.HealthPath = "http://elsewhere/health" },
		"name with an underscore":   func(s *ApplicationSpec) { s.Name = "vlora_backend" },
	}
	for name, mutate := range mutations {
		t.Run(name, func(t *testing.T) {
			spec := base
			mutate(&spec)
			_, err := RenderApplication(ApplicationRenderInput{
				DatabaseURIs: map[string]string{DatabaseMongo: "mongodb://x", DatabaseRedis: "redis://x"},
				Namespace:    "production",
				Spec:         spec,
			})
			if err == nil {
				t.Fatalf("expected %s to be refused", name)
			}
		})
	}
}

func TestRenderApplicationRefusesAnUndeployedDatabase(t *testing.T) {
	_, err := RenderApplication(ApplicationRenderInput{DatabaseURIs: map[string]string{}, Namespace: "production", Spec: vloraBackendSpec()})
	if err == nil || !strings.Contains(err.Error(), "not deployed") {
		t.Fatalf("expected a clear undeployed-database error, got %v", err)
	}
}

func TestRenderApplicationIsDeterministic(t *testing.T) {
	input := ApplicationRenderInput{
		DatabaseURIs: map[string]string{DatabaseMongo: "mongodb://a", DatabaseRedis: "redis://b"},
		Namespace:    "production",
		Spec:         vloraBackendSpec(),
	}
	first, err := RenderApplication(input)
	if err != nil {
		t.Fatal(err)
	}
	for range 8 {
		next, err := RenderApplication(input)
		if err != nil {
			t.Fatal(err)
		}
		if string(next) != string(first) {
			t.Fatal("rendering the same spec twice produced different Compose")
		}
	}
}

func renderedEnvironment(t *testing.T, rendered []byte) map[string]string {
	t.Helper()
	var document struct {
		Services map[string]struct {
			Environment map[string]string `yaml:"environment"`
		} `yaml:"services"`
	}
	if err := yaml.Unmarshal(rendered, &document); err != nil {
		t.Fatalf("parse rendered compose: %v", err)
	}
	return document.Services[ApplicationServiceName].Environment
}

func containsString(values []string, wanted string) bool {
	for _, value := range values {
		if value == wanted {
			return true
		}
	}
	return false
}
