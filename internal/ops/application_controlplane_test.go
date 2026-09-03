package ops

import (
	"bytes"
	"context"
	"os"
	"strings"
	"testing"
	"time"

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

func TestPlanApplicationReferencesStackScopedSecretsWithoutMutatingTheCluster(t *testing.T) {
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
	if len(created) != 0 {
		t.Fatalf("read-only planning created secrets: %v", runner.calls)
	}
}

func TestPlanApplicationCanPreviewPendingManagedDatabaseSecret(t *testing.T) {
	control := newApplicationControlPlane(t, &recordingRunner{})
	rendered, err := control.PlanApplication(context.Background(), vloraBackendSpec())
	if err != nil {
		t.Fatalf("pending managed database preview: %v", err)
	}
	if !strings.Contains(string(rendered), "production-vlora-backend_mongo_uri_v1") || strings.Contains(string(rendered), "managed://pending") {
		t.Fatalf("pending secret preview is unsafe or incomplete:\n%s", rendered)
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
	if targets[0].Targets[0] != "production-vlora-backend-app.swarmops.internal:8081" {
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

func TestApplicationStoreRejectsDuplicateDomain(t *testing.T) {
	directory := t.TempDir()
	store, err := NewApplicationStore(directory, bytes.Repeat([]byte{19}, 32))
	if err != nil {
		t.Fatal(err)
	}
	first := ApplicationSpec{Name: "first", Image: "ghcr.io/acme/first:2026.08.25", Port: 8080, Domain: "app.example.com", Resolver: "le"}
	second := ApplicationSpec{Name: "second", Image: "ghcr.io/acme/second:2026.08.25", Port: 8080, Domain: "app.example.com", Resolver: "le"}
	if err := store.Put(first); err != nil {
		t.Fatal(err)
	}
	if err := store.Put(second); err == nil || !strings.Contains(err.Error(), "already assigned") {
		t.Fatalf("duplicate domain error = %v", err)
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

// Deploying a repository the platform definition has never heard of is the
// first thing an operator does with a new application. The slot is declared
// from the deployment, and the same admission that refused it a moment earlier
// then admits it — nothing is skipped, something is written down.
func TestEnsureApplicationSlotMakesANewApplicationDeployable(t *testing.T) {
	control := newApplicationControlPlane(t, &recordingRunner{})
	store, err := NewPlatformStore(t.TempDir(), bytes.Repeat([]byte{13}, 32), nil)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := store.Save("admin", PlatformInput{Manifest: routedApplicationManifest(), Mode: PlatformModeManifest}, time.Now()); err != nil {
		t.Fatal(err)
	}
	control.Platform = store
	spec := ApplicationSpec{
		CPUs:       0.5,
		Domain:     "invoices.vlora.ir",
		HealthPath: "/healthz",
		Image:      "ghcr.io/nimasrn/invoices:2026.09.01",
		MemoryMiB:  512,
		Name:       "invoices",
		Port:       8080,
		Replicas:   1,
		Resolver:   "le",
	}
	if _, err := control.PlanApplication(context.Background(), spec); err == nil || !strings.Contains(err.Error(), "not declared") {
		t.Fatalf("undeclared application error = %v", err)
	}
	if err := control.EnsureApplicationSlot("admin", "request-1", spec); err != nil {
		t.Fatalf("declare slot: %v", err)
	}
	if _, err := control.PlanApplication(context.Background(), spec); err != nil {
		t.Fatalf("plan after declaration: %v", err)
	}
	declared := control.ApprovedApplications()
	if len(declared) != 3 {
		t.Fatalf("slots after declaration = %#v", declared)
	}
	// A hostname a reviewed workload already owns stays refused, and leaves
	// the definition as it was.
	taken := spec
	taken.Name = "billing"
	taken.Domain = "api.vlora.ir"
	if err := control.EnsureApplicationSlot("admin", "request-2", taken); err == nil || !strings.Contains(err.Error(), "already belongs") {
		t.Fatalf("colliding declaration error = %v", err)
	}
	if len(control.ApprovedApplications()) != 3 {
		t.Fatalf("refused declaration changed the slots in force: %#v", control.ApprovedApplications())
	}
}
