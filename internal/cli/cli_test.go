package cli

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/nimasrn/SwarmOps/internal/domain"
	"github.com/nimasrn/SwarmOps/internal/ops"
)

// coreStub answers the handful of controller endpoints the client speaks to,
// recording what it was sent so a test can assert on the request rather than
// on the client's own bookkeeping.
type coreStub struct {
	commandStates []domain.CommandState
	lastBody      []byte
	lastHeaders   http.Header
	polls         int
	server        *httptest.Server
}

func newCoreStub(t *testing.T, states ...domain.CommandState) *coreStub {
	t.Helper()
	stub := &coreStub{commandStates: states}
	stub.server = httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		switch {
		case request.URL.Path == "/api/v1/auth/login":
			http.SetCookie(response, &http.Cookie{Name: "swarmops_session", Value: "session-value", Path: "/"})
			_ = json.NewEncoder(response).Encode(map[string]string{"csrfToken": "csrf-value"})
		case strings.HasPrefix(request.URL.Path, "/api/v1/commands/"):
			state := domain.CommandSucceeded
			if stub.polls < len(stub.commandStates) {
				state = stub.commandStates[stub.polls]
			}
			stub.polls++
			_ = json.NewEncoder(response).Encode(domain.Command{
				Action:         "application.deploy",
				FailureSummary: failureSummaryFor(state),
				ID:             "cmd-1",
				RecoveryHint:   recoveryHintFor(state),
				State:          state,
			})
		case request.URL.Path == "/api/v1/applications":
			stub.lastHeaders = request.Header.Clone()
			stub.lastBody, _ = readAll(request)
			response.WriteHeader(http.StatusAccepted)
			_ = json.NewEncoder(response).Encode(domain.Command{Action: "application.deploy", ID: "cmd-1", State: domain.CommandQueued})
		default:
			response.WriteHeader(http.StatusNotFound)
			_ = json.NewEncoder(response).Encode(map[string]string{"error": "no such endpoint " + request.URL.Path})
		}
	}))
	t.Cleanup(stub.server.Close)
	return stub
}

func failureSummaryFor(state domain.CommandState) string {
	if state == domain.CommandFailed {
		return "the image could not be pulled"
	}
	return ""
}

func recoveryHintFor(state domain.CommandState) string {
	if state == domain.CommandFailed {
		return "check the registry credential"
	}
	return ""
}

func readAll(request *http.Request) ([]byte, error) {
	defer request.Body.Close()
	buffer := make([]byte, 0, 1024)
	chunk := make([]byte, 512)
	for {
		read, err := request.Body.Read(chunk)
		buffer = append(buffer, chunk[:read]...)
		if err != nil {
			return buffer, nil
		}
	}
}

func loggedInClient(t *testing.T, stub *coreStub) *Client {
	t.Helper()
	client, err := New(stub.server.URL, "", 5*time.Second)
	if err != nil {
		t.Fatal(err)
	}
	if err := client.Login(context.Background(), "operator", "a password"); err != nil {
		t.Fatal(err)
	}
	return client.WithServer("server-1")
}

func TestLoginCapturesTheSessionAndSurvivesAProfileRoundTrip(t *testing.T) {
	stub := newCoreStub(t)
	client := loggedInClient(t, stub)
	session := client.Session(time.Hour)
	if session.Cookie != "session-value" || session.CSRF != "csrf-value" || session.CookieName != "swarmops_session" {
		t.Fatalf("login did not capture the session: %+v", session)
	}
	if !session.Valid(time.Now()) || session.Valid(time.Now().Add(2*time.Hour)) {
		t.Fatal("session validity does not follow its expiry")
	}

	directory := t.TempDir()
	t.Setenv("SWARMOPS_CONFIG", filepath.Join(directory, "config.json"))
	config, err := LoadConfig()
	if err != nil {
		t.Fatal(err)
	}
	config.Put("prod", Profile{Session: session, URL: stub.server.URL, Username: "operator"})
	if err := config.Save(); err != nil {
		t.Fatal(err)
	}
	info, err := os.Stat(config.Path())
	if err != nil {
		t.Fatal(err)
	}
	if info.Mode().Perm() != ConfigFileMode {
		t.Fatalf("config mode = %v, want %v", info.Mode().Perm(), ConfigFileMode)
	}
	reloaded, err := LoadConfig()
	if err != nil {
		t.Fatal(err)
	}
	name, profile, err := reloaded.Resolve("")
	if err != nil {
		t.Fatal(err)
	}
	if name != "prod" || profile.Session.CSRF != "csrf-value" {
		t.Fatalf("resolved profile %q = %+v", name, profile)
	}
}

func TestLoadConfigRefusesAGroupReadableFile(t *testing.T) {
	path := filepath.Join(t.TempDir(), "config.json")
	if err := os.WriteFile(path, []byte(`{"profiles":{}}`), 0o644); err != nil {
		t.Fatal(err)
	}
	t.Setenv("SWARMOPS_CONFIG", path)
	if _, err := LoadConfig(); err == nil || !strings.Contains(err.Error(), "readable by other users") {
		t.Fatalf("LoadConfig accepted a world-readable profile file: %v", err)
	}
}

func TestResolveReportsWhatIsMissingRatherThanGuessing(t *testing.T) {
	t.Setenv("SWARMOPS_CONFIG", filepath.Join(t.TempDir(), "config.json"))
	config, err := LoadConfig()
	if err != nil {
		t.Fatal(err)
	}
	if _, _, err := config.Resolve(""); err == nil || !strings.Contains(err.Error(), "swarmops login") {
		t.Fatalf("empty config did not point at login: %v", err)
	}
	config.Put("one", Profile{URL: "https://one.example.com"})
	config.Put("two", Profile{URL: "https://two.example.com"})
	config.Current = ""
	if _, _, err := config.Resolve(""); err == nil || !strings.Contains(err.Error(), "several profiles") {
		t.Fatalf("ambiguous config did not ask which profile: %v", err)
	}
}

func TestSubmitSignsEveryCommandTheControllerRequires(t *testing.T) {
	stub := newCoreStub(t)
	client := loggedInClient(t, stub)
	spec := ops.ApplicationSpec{Env: map[string]string{"LOG_LEVEL": "info"}, Image: "ghcr.io/example/api:1", Name: "api", Port: 8080}
	command, err := client.Submit(context.Background(), "/api/v1/applications", "deploy", spec)
	if err != nil {
		t.Fatal(err)
	}
	if command.ID != "cmd-1" {
		t.Fatalf("command ID = %q", command.ID)
	}
	if got := stub.lastHeaders.Get("X-SwarmOps-Cluster-ID"); got != ClusterID {
		t.Errorf("cluster header = %q", got)
	}
	if got := stub.lastHeaders.Get("X-SwarmOps-Server-ID"); got != "server-1" {
		t.Errorf("server header = %q", got)
	}
	if got := stub.lastHeaders.Get("X-CSRF-Token"); got != "csrf-value" {
		t.Errorf("csrf header = %q", got)
	}
	key := stub.lastHeaders.Get("Idempotency-Key")
	if !strings.HasPrefix(key, "deploy-") || len(key) != len("deploy-")+32 {
		t.Errorf("idempotency key = %q", key)
	}
	// The spec's Env field carries no struct tag, so it must travel as "Env".
	// The console reads it under that name, and a CLI that sent "env" would
	// deploy an application with no environment at all.
	if !strings.Contains(string(stub.lastBody), `"Env":{"LOG_LEVEL":"info"}`) {
		t.Errorf("environment was not sent under Env: %s", stub.lastBody)
	}
}

func TestSubmitRefusesWithoutASelectedMachine(t *testing.T) {
	stub := newCoreStub(t)
	client, err := New(stub.server.URL, "", 5*time.Second)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := client.Submit(context.Background(), "/api/v1/applications", "deploy", nil); err == nil ||
		!strings.Contains(err.Error(), "server use") {
		t.Fatalf("submit without a machine did not name the fix: %v", err)
	}
}

func TestFollowReportsTheControllersOwnFailure(t *testing.T) {
	stub := newCoreStub(t, domain.CommandRunning, domain.CommandFailed)
	client := loggedInClient(t, stub)
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	states := make([]domain.CommandState, 0, 2)
	_, err := client.Follow(ctx, "cmd-1", func(command domain.Command) {
		states = append(states, command.State)
	})
	if err == nil {
		t.Fatal("Follow reported success for a failed command")
	}
	for _, want := range []string{"the image could not be pulled", "check the registry credential", "failed"} {
		if !strings.Contains(err.Error(), want) {
			t.Errorf("failure did not mention %q: %v", want, err)
		}
	}
	if len(states) != 2 || states[0] != domain.CommandRunning {
		t.Errorf("state changes = %v", states)
	}
}

func TestResponseErrorKeepsTheControllersMessage(t *testing.T) {
	stub := newCoreStub(t)
	client := loggedInClient(t, stub)
	err := client.Get(context.Background(), "/api/v1/nowhere", nil)
	if err == nil || !strings.Contains(err.Error(), "no such endpoint") {
		t.Fatalf("controller message was discarded: %v", err)
	}
}

func TestManifestRoundTripsThroughTheSpec(t *testing.T) {
	directory := t.TempDir()
	manifest := cliManifestFixture()
	if err := manifest.Save(directory, false); err != nil {
		t.Fatal(err)
	}
	if err := manifest.Save(directory, false); err == nil {
		t.Fatal("Save replaced an existing manifest without --force")
	}
	loaded, err := LoadManifest(directory)
	if err != nil {
		t.Fatal(err)
	}
	spec := loaded.Spec()
	if spec.Name != "api" || spec.Port != 8080 || spec.Env["LOG_LEVEL"] != "info" || spec.Plan != "small" {
		t.Fatalf("spec = %+v", spec)
	}
	if back := ManifestFromSpec(spec); back.Name != manifest.Name || back.Port != manifest.Port {
		t.Fatalf("round trip lost fields: %+v", back)
	}
	encoded, err := os.ReadFile(ManifestPath(directory))
	if err != nil {
		t.Fatal(err)
	}
	// The file an operator edits is lower-camel throughout, whatever the
	// controller's own field names happen to be.
	if !strings.Contains(string(encoded), `"env"`) || strings.Contains(string(encoded), `"Env"`) {
		t.Errorf("manifest is not lower-camel: %s", encoded)
	}
}

func TestLoadManifestRejectsUnknownFields(t *testing.T) {
	directory := t.TempDir()
	if err := os.WriteFile(ManifestPath(directory), []byte(`{"name":"api","platform":"node"}`), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := LoadManifest(directory); err == nil || !strings.Contains(err.Error(), "platform") {
		t.Fatalf("an unknown field was accepted silently: %v", err)
	}
}

func cliManifestFixture() Manifest {
	return Manifest{
		Env:  map[string]string{"LOG_LEVEL": "info"},
		Name: "api",
		Plan: "small",
		Port: 8080,
	}
}

func TestCommandFailureKeepsOnlyWhatTheLastErrorAdds(t *testing.T) {
	t.Parallel()
	summary := "The managed Traefik gateway is required before this stack can create private routes."
	err := CommandFailure(domain.Command{
		FailureCode:    "gateway_required",
		FailureSummary: summary,
		ID:             "cmd-1",
		LastError:      summary + " Attempt 8 of 8 failed and no retry is scheduled; inspect the target before retrying.",
		RecoveryHint:   "Install and verify Traefik under Gateway, routes & DNS, then retry.",
		State:          domain.CommandNeedsAttention,
	})
	text := err.Error()
	// The last error restates the summary and appends the attempt count, so
	// printing both put the same sentence in the line twice.
	if strings.Index(text, summary) != strings.LastIndex(text, summary) {
		t.Errorf("the summary appears twice: %s", text)
	}
	for _, want := range []string{"gateway_required", "Attempt 8 of 8 failed", "Install and verify Traefik", "needs_attention"} {
		if !strings.Contains(text, want) {
			t.Errorf("failure did not mention %q: %s", want, text)
		}
	}
}
