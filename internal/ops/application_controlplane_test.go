package ops

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/nimasrn/SwarmOps/internal/audit"
	"github.com/nimasrn/SwarmOps/internal/securestore"
)

func newApplicationControlPlane(t *testing.T, runner *recordingRunner) *ControlPlane {
	t.Helper()
	store, err := audit.Open(t.TempDir(), bytes.Repeat([]byte{11}, 32), 100)
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

// Deploying a repository this controller has never heard of is the first
// thing an operator does with a new application, and it is the whole of what
// they have to do: name the image and the project, and it plans. Nothing has
// to be declared anywhere first.
func TestANewApplicationPlansWithNothingDeclaredInAdvance(t *testing.T) {
	control := newApplicationControlPlane(t, &recordingRunner{})
	spec := ApplicationSpec{
		Domain:     "invoices.vlora.ir",
		HealthPath: "/healthz",
		Image:      "ghcr.io/nimasrn/invoices:2026.09.01",
		Name:       "invoices",
		Port:       8080,
	}
	rendered, err := control.PlanApplication(context.Background(), spec)
	if err != nil {
		t.Fatalf("plan a never-seen application: %v", err)
	}
	if !strings.Contains(string(rendered), "production-invoices-app.swarmops.internal") {
		t.Fatalf("planned stack has no route at all:\n%s", rendered)
	}
	// The size and the certificate resolver the operator never stated are
	// filled in from the defaults rather than demanded from them.
	normalized := spec.Normalize()
	plan, err := LookupResourcePlan("")
	if err != nil {
		t.Fatal(err)
	}
	if normalized.Resolver != DefaultResolver || normalized.CPUs != plan.CPUCores || normalized.MemoryMiB != plan.MemoryMiB {
		t.Fatalf("defaults were not applied: %#v", normalized)
	}
}

// An application that failed to start is kept, and says so.
//
// It used to be stored only after a deployment succeeded, so a failure left
// nothing behind: not listed, not inspectable, not removable, and no different
// from an application that had never been asked for.
func TestAFailedApplicationIsKeptAndNamedAsFailed(t *testing.T) {
	t.Parallel()
	dataDir := t.TempDir()
	key := bytes.Repeat([]byte{12}, 32)
	store, err := NewApplicationStore(dataDir, key)
	if err != nil {
		t.Fatal(err)
	}
	spec := ApplicationSpec{Image: "ghcr.io/example/api:1", Name: "api", Port: 8080}
	if err := store.Put(spec); err != nil {
		t.Fatal(err)
	}
	if err := store.PutOutcome("api", ApplicationOutcome{FailureSummary: "the managed Traefik gateway is required", LastCommandID: "cmd-1", LastAttemptAt: time.Now().UTC()}); err != nil {
		t.Fatal(err)
	}
	outcome, found := store.Outcome("api")
	if !found || outcome.Started || outcome.LastCommandID != "cmd-1" {
		t.Fatalf("outcome = %#v, found=%t", outcome, found)
	}
	if state := applicationState(outcome, false, 0); state != ApplicationFailed {
		t.Fatalf("state = %q, want %q", state, ApplicationFailed)
	}
	// A later success clears the failure and marks it started.
	if err := store.PutOutcome("api", ApplicationOutcome{Started: true, StartedAt: time.Now().UTC(), LastAttemptAt: time.Now().UTC()}); err != nil {
		t.Fatal(err)
	}
	outcome, _ = store.Outcome("api")
	if !outcome.Started || outcome.FailureSummary != "" {
		t.Fatalf("after success outcome = %#v", outcome)
	}
	if state := applicationState(outcome, true, 2); state != ApplicationServing {
		t.Fatalf("state = %q", state)
	}
	// Stopping is not the same as never having started, and the store
	// remembers which of the two this is.
	if err := store.PutOutcome("api", ApplicationOutcome{FailureSummary: "stack deploy refused", LastAttemptAt: time.Now().UTC()}); err != nil {
		t.Fatal(err)
	}
	outcome, _ = store.Outcome("api")
	if !outcome.Started {
		t.Fatal("an application that has started must keep having started")
	}
	if state := applicationState(outcome, false, 0); state != ApplicationStopped {
		t.Fatalf("state = %q, want %q", state, ApplicationStopped)
	}
}

func TestAnOutcomeSurvivesAReloadAndIsForgottenWithItsApplication(t *testing.T) {
	t.Parallel()
	dataDir := t.TempDir()
	key := bytes.Repeat([]byte{9}, 32)
	store, err := NewApplicationStore(dataDir, key)
	if err != nil {
		t.Fatal(err)
	}
	if err := store.Put(ApplicationSpec{Image: "ghcr.io/example/api:1", Name: "api", Port: 8080}); err != nil {
		t.Fatal(err)
	}
	if err := store.PutOutcome("api", ApplicationOutcome{FailureSummary: "gateway required", LastCommandID: "cmd-7"}); err != nil {
		t.Fatal(err)
	}
	reloaded, err := NewApplicationStore(dataDir, key)
	if err != nil {
		t.Fatal(err)
	}
	outcome, found := reloaded.Outcome("api")
	if !found || outcome.LastCommandID != "cmd-7" || outcome.FailureSummary != "gateway required" {
		t.Fatalf("after reload outcome = %#v, found=%t", outcome, found)
	}
	if err := reloaded.Remove("api"); err != nil {
		t.Fatal(err)
	}
	if _, found := reloaded.Outcome("api"); found {
		t.Fatal("the outcome outlived the application it described")
	}
	again, err := NewApplicationStore(dataDir, key)
	if err != nil {
		t.Fatal(err)
	}
	if _, found := again.Outcome("api"); found {
		t.Fatal("the removed outcome came back after a reload")
	}
}

// An older store held specs alone, and every spec in it was written only after
// a deployment succeeded. Reading one forward has to say so, or every existing
// application would be reported as never having started.
func TestAnOlderStoreReadsAsApplicationsThatHaveStarted(t *testing.T) {
	t.Parallel()
	dataDir := t.TempDir()
	key := bytes.Repeat([]byte{5}, 32)
	sealer, err := securestore.New(key)
	if err != nil {
		t.Fatal(err)
	}
	legacy, err := json.Marshal(map[string]any{
		"applications": []ApplicationSpec{{CPUs: 0.5, Image: "ghcr.io/example/api:1", MemoryMiB: 512, Name: "api", Port: 8080, Replicas: 1}},
		"version":      1,
	})
	if err != nil {
		t.Fatal(err)
	}
	if err := sealer.WriteFile(filepath.Join(dataDir, "applications.sealed"), applicationStateKey, legacy); err != nil {
		t.Fatal(err)
	}
	store, err := NewApplicationStore(dataDir, key)
	if err != nil {
		t.Fatal(err)
	}
	outcome, found := store.Outcome("api")
	if !found || !outcome.Started {
		t.Fatalf("a version 1 application read as %#v, found=%t", outcome, found)
	}
	if state := applicationState(outcome, false, 0); state != ApplicationStopped {
		t.Fatalf("state = %q, want %q — it started once, so it is stopped rather than failed", state, ApplicationStopped)
	}
}

// Removing what is already gone is the outcome the caller asked for. Refusing
// it left an operator holding a record they could not delete, which is how
// keeping failed applications turns into collecting them.
func TestAStackThatWasNeverCreatedDoesNotBlockRemoval(t *testing.T) {
	t.Parallel()
	for _, message := range []string{
		"Nothing found in stack: production-api",
		"no such stack: production-api",
	} {
		if !stackAlreadyAbsent(errors.New(message)) {
			t.Errorf("%q was not recognised as an absent stack", message)
		}
	}
	for _, message := range []string{"permission denied", "cannot connect to the Docker daemon"} {
		if stackAlreadyAbsent(errors.New(message)) {
			t.Errorf("%q was treated as an absent stack", message)
		}
	}
	if stackAlreadyAbsent(nil) {
		t.Error("a nil error was treated as an absent stack")
	}
}
