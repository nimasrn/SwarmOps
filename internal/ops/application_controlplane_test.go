package ops

import (
	"bytes"
	"context"
	"os"
	"strings"
	"testing"

	"github.com/nimasrn/SwarmOps/internal/audit"
)

func newApplicationControlPlane(t *testing.T, runner *recordingRunner) *ControlPlane {
	t.Helper()
	store, err := audit.Open(t.TempDir(), bytes.Repeat([]byte{11}, 32), 100)
	if err != nil {
		t.Fatal(err)
	}
	admission, err := NewPlatformAdmission(routedApplicationManifest())
	if err != nil {
		t.Fatal(err)
	}
	dataDir := t.TempDir()
	credentials, err := NewCredentialStore(dataDir, bytes.Repeat([]byte{12}, 32))
	if err != nil {
		t.Fatal(err)
	}
	applications, err := NewApplicationStore(dataDir, bytes.Repeat([]byte{12}, 32))
	if err != nil {
		t.Fatal(err)
	}
	return NewControlPlane(nil, DockerCLI{Runner: runner}, store, ControlPlaneOptions{
		Admission:   admission,
		Apps:        applications,
		Credentials: credentials,
		DataDir:     dataDir,
		Mutations:   true,
	})
}

func TestPlanApplicationCreatesOnlyStackScopedConnectionSecrets(t *testing.T) {
	runner := &recordingRunner{}
	control := newApplicationControlPlane(t, runner)
	if err := control.Credentials.Put(DatabaseMongo, "mongodb://swarmops:pw@swarmops-mongo_mongo:27017/swarmops?authSource=admin"); err != nil {
		t.Fatal(err)
	}
	if err := control.Credentials.Put(DatabaseRedis, "redis://:pw@swarmops-redis_redis:6379/0"); err != nil {
		t.Fatal(err)
	}
	rendered, err := control.PlanApplication(context.Background(), vloraBackendSpec())
	if err != nil {
		t.Fatalf("plan: %v", err)
	}
	if !strings.Contains(string(rendered), "production-vlora-backend_mongo_uri_v1") {
		t.Fatalf("rendered stack does not reference its scoped secret:\n%s", rendered)
	}
	created := map[string]bool{}
	for _, call := range runner.calls {
		if len(call) >= 3 && call[0] == "secret" && call[1] == "create" {
			created[call[2]] = true
		}
	}
	if !created["production-vlora-backend_mongo_uri_v1"] || !created["production-vlora-backend_redis_uri_v1"] {
		t.Fatalf("scoped connection secrets were not created: %v", runner.calls)
	}
	for name := range created {
		if !strings.HasPrefix(name, "production-vlora-backend_") {
			t.Fatalf("created a secret outside the application namespace: %q", name)
		}
	}
}

func TestPlanApplicationRefusesADatabaseThatIsNotDeployed(t *testing.T) {
	control := newApplicationControlPlane(t, &recordingRunner{})
	_, err := control.PlanApplication(context.Background(), vloraBackendSpec())
	if err == nil || !strings.Contains(err.Error(), "not deployed") {
		t.Fatalf("expected an undeployed-database error, got %v", err)
	}
}

func TestApplicationRemovalNeedsItsOwnConfirmation(t *testing.T) {
	control := newApplicationControlPlane(t, &recordingRunner{})
	if err := control.Apps.Put(vloraBackendSpec()); err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()
	if err := control.RemoveApplication(ctx, "operator", "request", "vlora-backend", "REMOVE_APPLICATION_VLORA_APP"); err == nil {
		t.Fatal("another application's confirmation was accepted")
	}
	if err := control.RemoveApplication(ctx, "operator", "request", "vlora-backend", "REMOVE_APPLICATION_VLORA_BACKEND"); err != nil {
		t.Fatalf("remove: %v", err)
	}
	if _, found := control.Apps.Get("vlora-backend"); found {
		t.Fatal("a removed application is still listed")
	}
}

func TestMetricsDiscoveryListsOnlyApplicationsThatPublishMetrics(t *testing.T) {
	control := newApplicationControlPlane(t, &recordingRunner{})
	if err := control.Apps.Put(vloraBackendSpec()); err != nil {
		t.Fatal(err)
	}
	frontend := ApplicationSpec{CPUs: 0.5, Domain: "vlora.ir", Image: "ghcr.io/nimasrn/vlora-app:2026.08.25", MemoryMiB: 256, Name: "vlora-app", Port: 80, Resolver: "le"}
	if err := control.Apps.Put(frontend); err != nil {
		t.Fatal(err)
	}
	targets := control.MetricsTargets()
	if len(targets) != 1 {
		t.Fatalf("expected only the metrics-enabled application, got %#v", targets)
	}
	if targets[0].Targets[0] != "tasks.production-vlora-backend_app:8080" {
		t.Fatalf("unexpected discovery target %q", targets[0].Targets[0])
	}
	if targets[0].Labels["__metrics_path__"] != "/metrics" || targets[0].Labels["application"] != "vlora-backend" {
		t.Fatalf("unexpected discovery labels %#v", targets[0].Labels)
	}
}

func TestSealedApplicationsSurviveARestart(t *testing.T) {
	dataDir := t.TempDir()
	key := bytes.Repeat([]byte{12}, 32)
	store, err := NewApplicationStore(dataDir, key)
	if err != nil {
		t.Fatal(err)
	}
	if err := store.Put(vloraBackendSpec()); err != nil {
		t.Fatal(err)
	}
	reloaded, err := NewApplicationStore(dataDir, key)
	if err != nil {
		t.Fatal(err)
	}
	spec, found := reloaded.Get("vlora-backend")
	if !found || spec.Domain != "api.vlora.ir" || len(spec.Databases) != 2 {
		t.Fatalf("application did not survive a restart: %#v", spec)
	}
}

func TestSealedDatabaseCredentialsAreNotStoredInTheClear(t *testing.T) {
	dataDir := t.TempDir()
	key := bytes.Repeat([]byte{12}, 32)
	store, err := NewCredentialStore(dataDir, key)
	if err != nil {
		t.Fatal(err)
	}
	const uri = "mongodb://swarmops:super-secret-password@swarmops-mongo_mongo:27017/swarmops?authSource=admin"
	if err := store.Put(DatabaseMongo, uri); err != nil {
		t.Fatal(err)
	}
	sealed, err := readFileBytes(dataDir + "/database-credentials.sealed")
	if err != nil {
		t.Fatal(err)
	}
	if bytes.Contains(sealed, []byte("super-secret-password")) {
		t.Fatal("a database credential was written in the clear")
	}
	reloaded, err := NewCredentialStore(dataDir, key)
	if err != nil {
		t.Fatal(err)
	}
	if value, found := reloaded.Get(DatabaseMongo); !found || value != uri {
		t.Fatalf("credential did not survive a restart: %q", value)
	}
	reloaded.Forget(DatabaseMongo)
	if _, found := reloaded.Get(DatabaseMongo); found {
		t.Fatal("a forgotten credential is still available")
	}
}

func readFileBytes(path string) ([]byte, error) { return os.ReadFile(path) }
