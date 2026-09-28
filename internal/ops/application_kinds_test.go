package ops

import (
	"strings"
	"testing"

	"gopkg.in/yaml.v3"
)

func renderedAppService(t *testing.T, rendered []byte) map[string]any {
	t.Helper()
	var document map[string]any
	if err := yaml.Unmarshal(rendered, &document); err != nil {
		t.Fatalf("parse rendered compose: %v", err)
	}
	services, _ := document["services"].(map[string]any)
	service, _ := services[ApplicationServiceName].(map[string]any)
	if service == nil {
		t.Fatalf("rendered compose has no %q service:\n%s", ApplicationServiceName, rendered)
	}
	return service
}

func mongoURIs() map[string]string {
	return map[string]string{DatabaseMongo: "mongodb://app:pw@swarmops-mongo-mongo.swarmops.internal:27017/app?authSource=app&directConnection=true"}
}

// A worker and a run-once job are still generated, admitted stacks: they only
// lose the route, and the job becomes a replicated job retried on failure.
func TestWorkerAndJobRenderWithoutRoutesAndPassAdmission(t *testing.T) {
	for _, kind := range []string{KindWorker, KindJob} {
		spec := ApplicationSpec{Name: "ilc-" + kind, Kind: kind, Image: "ghcr.io/nimasrn/ilc-" + kind + ":2026.09.28", Databases: []string{DatabaseMongo}, Plan: "small"}
		if kind == KindWorker {
			spec.HealthCommand = []string{"pidof", "worker"}
		}
		rendered, err := RenderApplication(ApplicationRenderInput{DatabaseURIs: mongoURIs(), Namespace: "production", Spec: spec})
		if err != nil {
			t.Fatalf("%s render: %v", kind, err)
		}
		if _, err := ValidateCompose(rendered); err != nil {
			t.Fatalf("%s refused by policy: %v\n%s", kind, err, rendered)
		}
		if err := ValidateApplicationStack("production-ilc-"+kind, rendered); err != nil {
			t.Fatalf("%s refused by admission: %v\n%s", kind, err, rendered)
		}
		text := string(rendered)
		if strings.Contains(text, "traefik.http.routers") || strings.Contains(text, "PORT:") {
			t.Fatalf("%s rendered a route or port:\n%s", kind, rendered)
		}
		deploy, _ := renderedAppService(t, rendered)["deploy"].(map[string]any)
		if kind == KindJob {
			restart, _ := deploy["restart_policy"].(map[string]any)
			if deploy["mode"] != "replicated-job" || restart["condition"] != "on-failure" || deploy["update_config"] != nil {
				t.Fatalf("job deploy settings = %#v", deploy)
			}
			if _, probed := renderedAppService(t, rendered)["healthcheck"]; probed {
				t.Fatal("a job must not carry a health probe")
			}
		}
	}
}

func TestWorkerAndJobRefuseRoutesAndMetrics(t *testing.T) {
	for name, spec := range map[string]ApplicationSpec{
		"job with domain":     {Name: "job", Kind: KindJob, Image: "ghcr.io/example/job:1", Domain: "job.example.com"},
		"worker with metrics": {Name: "worker", Kind: KindWorker, Image: "ghcr.io/example/worker:1", Metrics: true},
		"job with health":     {Name: "job", Kind: KindJob, Image: "ghcr.io/example/job:1", HealthCommand: []string{"true"}},
		"worker health path":  {Name: "worker", Kind: KindWorker, Image: "ghcr.io/example/worker:1", HealthPath: "/healthz"},
		"unknown kind":        {Name: "cron", Kind: "cron", Image: "ghcr.io/example/cron:1", Port: 80},
		"web without port":    {Name: "web", Image: "ghcr.io/example/web:1"},
	} {
		if err := spec.Normalize().Validate(); err == nil {
			t.Fatalf("%s was accepted", name)
		}
	}
}

// Secret variables never appear as values in the rendered Compose: each is a
// content-addressed, stack-scoped external secret delivered as NAME_FILE.
func TestSecretEnvRendersAsExternalSecretFiles(t *testing.T) {
	spec := vloraBackendSpec()
	spec.SecretEnv = map[string]string{"JWT_SECRET": "super-secret-value", "KAVENEGAR_API_KEY": "key-value"}
	uris := map[string]string{DatabaseMongo: "mongodb://a:b@h:1/d", DatabaseRedis: "redis://:b@h:1/0"}
	rendered, err := RenderApplication(ApplicationRenderInput{DatabaseURIs: uris, Namespace: "production", Spec: spec})
	if err != nil {
		t.Fatalf("render: %v", err)
	}
	text := string(rendered)
	if strings.Contains(text, "super-secret-value") || strings.Contains(text, "key-value") {
		t.Fatalf("a secret value reached the Compose:\n%s", rendered)
	}
	for _, want := range []string{"JWT_SECRET_FILE: /run/secrets/env_jwt_secret", "KAVENEGAR_API_KEY_FILE: /run/secrets/env_kavenegar_api_key", secretEnvSecretName("production-vlora-backend", "JWT_SECRET", "super-secret-value")} {
		if !strings.Contains(text, want) {
			t.Fatalf("rendered compose lacks %q:\n%s", want, rendered)
		}
	}
	if _, err := ValidateCompose(rendered); err != nil {
		t.Fatalf("secret-file environment refused by policy: %v", err)
	}
	if err := ValidateApplicationStack("production-vlora-backend", rendered); err != nil {
		t.Fatalf("secret-file environment refused by admission: %v", err)
	}
	if secretEnvSecretName("s", "K", "a") == secretEnvSecretName("s", "K", "b") {
		t.Fatal("a changed value must be a new secret")
	}
	redacted := spec.Redacted()
	if redacted.SecretEnv["JWT_SECRET"] != "" || len(redacted.SecretEnv) != 2 || spec.SecretEnv["JWT_SECRET"] == "" {
		t.Fatalf("redaction = %#v, original = %#v", redacted.SecretEnv, spec.SecretEnv)
	}
}

func TestSecretEnvValidation(t *testing.T) {
	base := vloraBackendSpec()
	for name, secrets := range map[string]map[string]string{
		"collides with plain":   {"HTTP_PORT": "x"},
		"case-folded duplicate": {"TOKEN": "a", "token": "b"},
		"invalid name":          {"1BAD": "x"},
		"oversized value":       {"BIG": strings.Repeat("x", maxSecretEnvValue+1)},
	} {
		spec := base
		spec.SecretEnv = secrets
		if err := spec.Normalize().Validate(); err == nil {
			t.Fatalf("%s was accepted", name)
		}
	}
	spec := base
	spec.SecretEnv = map[string]string{"JWT_SECRET": ""}
	if _, err := RenderApplication(ApplicationRenderInput{DatabaseURIs: map[string]string{DatabaseMongo: "m", DatabaseRedis: "r"}, Namespace: "production", Spec: spec}); err == nil {
		t.Fatal("a secret without a stored or submitted value rendered")
	}
}

// Policy still refuses a secret-looking variable that carries a value; only a
// NAME_FILE path into /run/secrets is exempt.
func TestPolicyAllowsOnlySecretFilePaths(t *testing.T) {
	compose := func(key, value string) []byte {
		return []byte("version: \"3.9\"\nservices:\n  app:\n    image: ghcr.io/example/app:1\n    deploy:\n      resources:\n        limits: {cpus: \"1\", memory: 256M}\n        reservations: {cpus: \"0.25\", memory: 128M}\n    environment:\n      " + key + ": " + value + "\n")
	}
	if _, err := ValidateCompose(compose("JWT_SECRET_FILE", "/run/secrets/env_jwt_secret")); err != nil {
		t.Fatalf("secret file path refused: %v", err)
	}
	for key, value := range map[string]string{"JWT_SECRET": "value", "JWT_SECRET_FILE": "/etc/passwd"} {
		if _, err := ValidateCompose(compose(key, value)); err == nil {
			t.Fatalf("%s=%s was accepted", key, value)
		}
	}
}

func TestMongoReplicaSetRenderingAndDelivery(t *testing.T) {
	raw := databaseAsset(t, DatabaseMongo)
	settings := testDatabaseSettings()
	settings.MongoReplicaSet = true
	rendered, err := RenderDatabaseStack(DatabaseMongo, raw, settings)
	if err != nil {
		t.Fatalf("render: %v", err)
	}
	text := string(rendered)
	for _, want := range []string{"--replSet", "--keyFile", "hostname: swarmops-mongo-rs0", MongoKeyFileSecret, "rs.initiate", `uid: "999"`} {
		if !strings.Contains(text, want) {
			t.Fatalf("replica-set stack lacks %q:\n%s", want, rendered)
		}
	}
	var parsed map[string]any
	if err := yaml.Unmarshal(rendered, &parsed); err != nil {
		t.Fatalf("replica-set stack is not valid YAML: %v", err)
	}
	standalone, err := RenderDatabaseStack(DatabaseMongo, raw, testDatabaseSettings())
	if err != nil || strings.Contains(string(standalone), "--replSet") {
		t.Fatalf("standalone rendering changed: %v", err)
	}
	if _, err := renderMongoReplicaSet("services: {}\n"); err == nil {
		t.Fatal("a changed asset must fail closed")
	}
	if got := settings.DeliveredURI(DatabaseMongo, "mongodb://a:b@h:1/d?authSource=d"); got != "mongodb://a:b@h:1/d?authSource=d&directConnection=true" {
		t.Fatalf("delivered URI = %q", got)
	}
	if got := testDatabaseSettings().DeliveredURI(DatabaseMongo, "mongodb://a:b@h:1/d"); strings.Contains(got, "directConnection") {
		t.Fatalf("standalone URI changed: %q", got)
	}
	if settings.URISecretVersion(DatabaseMongo) != "v2" || settings.URISecretVersion(DatabaseRedis) != "v1" {
		t.Fatal("replica-set URIs must use a new secret generation")
	}
}

// A TCP application renders no Traefik labels of its own — its route is
// applied after the stack deploys — and a caller receives the dependency's
// address under the canonical name and every name it asked for.
func TestTCPApplicationAndDependencyAddresses(t *testing.T) {
	clamav := ApplicationSpec{Name: "ilc-clamav", Image: "clamav/clamav:1.4.3", Port: 3310, Protocol: ProtocolTCP, HealthCommand: []string{"clamdcheck.sh"}, Plan: "small"}
	rendered, err := RenderApplication(ApplicationRenderInput{Namespace: "production", Spec: clamav})
	if err != nil {
		t.Fatalf("render tcp: %v", err)
	}
	if strings.Contains(string(rendered), "traefik.") {
		t.Fatalf("a TCP application carried route labels:\n%s", rendered)
	}
	if err := ValidateApplicationStack("production-ilc-clamav", rendered); err != nil {
		t.Fatalf("tcp application refused by admission: %v", err)
	}
	if route := applicationTCPRouteSpec(clamav.Normalize(), "production-ilc-clamav"); route.Protocol != RouteTCP || route.Scope != RouteInternal || route.TargetPort != 3310 || route.Validate() == nil && route.ListenPort != 0 {
		t.Fatalf("tcp route = %+v", route)
	}
	for name, spec := range map[string]ApplicationSpec{
		"tcp with domain": {Name: "tcp", Image: "ghcr.io/example/tcp:1", Port: 1, Protocol: ProtocolTCP, Domain: "tcp.example.com"},
		"worker protocol": {Name: "worker", Kind: KindWorker, Image: "ghcr.io/example/worker:1", Protocol: ProtocolTCP},
		"self dependency": {Name: "api", Image: "ghcr.io/example/api:1", Port: 1, DependsOn: []ApplicationDependency{{Application: "api"}}},
		"env collision":   {Name: "api", Image: "ghcr.io/example/api:1", Port: 1, Env: map[string]string{"CLAMAV_ADDRESS": "x"}, DependsOn: []ApplicationDependency{{Application: "ilc-clamav", Env: []string{"CLAMAV_ADDRESS"}}}},
	} {
		if err := spec.Normalize().Validate(); err == nil {
			t.Fatalf("%s was accepted", name)
		}
	}

	api := ApplicationSpec{Name: "ilc-api", Image: "ghcr.io/nimasrn/ilc-api:1", Port: 8080, Plan: "small", DependsOn: []ApplicationDependency{{Application: "ilc-clamav", Env: []string{"CLAMAV_ADDRESS"}}}}
	if _, err := RenderApplication(ApplicationRenderInput{Namespace: "production", Spec: api}); err == nil {
		t.Fatal("a caller rendered before its dependency had a route")
	}
	rendered, err = RenderApplication(ApplicationRenderInput{Namespace: "production", Spec: api, DependencyAddresses: map[string]string{"ilc-clamav": "clamav-route.swarmops.internal:10310"}})
	if err != nil {
		t.Fatalf("render caller: %v", err)
	}
	for _, want := range []string{"CLAMAV_ADDRESS: clamav-route.swarmops.internal:10310", "ILC_CLAMAV_ADDRESS: clamav-route.swarmops.internal:10310"} {
		if !strings.Contains(string(rendered), want) {
			t.Fatalf("caller lacks %q:\n%s", want, rendered)
		}
	}
}
