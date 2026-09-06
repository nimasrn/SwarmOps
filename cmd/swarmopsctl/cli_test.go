package main

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/nimasrn/SwarmOps/internal/cli"
	"github.com/nimasrn/SwarmOps/internal/domain"
	"github.com/nimasrn/SwarmOps/internal/ops"
)

// controllerStub answers the endpoints the application commands read and
// write, and keeps the last deploy body so a test can assert on what the CLI
// actually sent rather than on what it printed.
type controllerStub struct {
	deployed   []byte
	deployPath string
	server     *httptest.Server
}

func newControllerStub(t *testing.T, applications []ops.ApplicationStatus) *controllerStub {
	t.Helper()
	stub := &controllerStub{}
	stub.server = httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		switch {
		case request.URL.Path == "/api/v1/applications" && request.Method == http.MethodGet:
			_ = json.NewEncoder(response).Encode(applications)
		case request.Method == http.MethodPost && strings.HasPrefix(request.URL.Path, "/api/v1/"):
			stub.deployPath = request.URL.Path
			stub.deployed, _ = io.ReadAll(request.Body)
			response.WriteHeader(http.StatusAccepted)
			_ = json.NewEncoder(response).Encode(domain.Command{Action: "application.deploy", ID: "cmd-1", State: domain.CommandQueued})
		case strings.HasPrefix(request.URL.Path, "/api/v1/commands/"):
			_ = json.NewEncoder(response).Encode(domain.Command{Action: "application.deploy", ID: "cmd-1", State: domain.CommandSucceeded})
		default:
			response.WriteHeader(http.StatusNotFound)
			_ = json.NewEncoder(response).Encode(map[string]string{"error": "no such endpoint " + request.URL.Path})
		}
	}))
	t.Cleanup(stub.server.Close)
	return stub
}

// useStub points the CLI at the stub through a throwaway profile file, which
// is the same path a real invocation takes.
func useStub(t *testing.T, stub *controllerStub) {
	t.Helper()
	t.Setenv("SWARMOPS_CONFIG", filepath.Join(t.TempDir(), "config.json"))
	config, err := cli.LoadConfig()
	if err != nil {
		t.Fatal(err)
	}
	config.Put("test", cli.Profile{
		ServerID: "server-1",
		Session:  cli.Session{Cookie: "session", CookieName: "swarmops_session", CSRF: "csrf", ExpiresAt: time.Now().Add(time.Hour)},
		URL:      stub.server.URL,
		Username: "operator",
	})
	if err := config.Save(); err != nil {
		t.Fatal(err)
	}
}

// captureStdout runs a command with stdout redirected, so a test can assert on
// what an operator would see.
func captureStdout(t *testing.T, run func() error) (string, error) {
	t.Helper()
	reader, writer, err := os.Pipe()
	if err != nil {
		t.Fatal(err)
	}
	previous := os.Stdout
	os.Stdout = writer
	runErr := run()
	os.Stdout = previous
	_ = writer.Close()
	output, err := io.ReadAll(reader)
	if err != nil {
		t.Fatal(err)
	}
	_ = reader.Close()
	return string(output), runErr
}

func deployedApplication() ops.ApplicationStatus {
	return ops.ApplicationStatus{
		Deployed:     true,
		RunningTasks: 1,
		Service:      "production-api_app",
		Spec: ops.ApplicationSpec{
			CPUs:      0.5,
			Env:       map[string]string{"LOG_LEVEL": "info"},
			Image:     "ghcr.io/example/api:1",
			MemoryMiB: 512,
			Name:      "api",
			Plan:      "small",
			Port:      8080,
			Replicas:  1,
		},
		Stack: "production-api",
		URL:   "https://api.example.com",
	}
}

func TestEnvSetRedeploysTheSpecTheControllerHolds(t *testing.T) {
	stub := newControllerStub(t, []ops.ApplicationStatus{deployedApplication()})
	useStub(t, stub)
	if _, err := captureStdout(t, func() error {
		return runEnv([]string{"set", "FEATURE_X=on", "--app", "api"})
	}); err != nil {
		t.Fatal(err)
	}
	if stub.deployPath != "/api/v1/applications" {
		t.Fatalf("env set posted to %q", stub.deployPath)
	}
	var sent ops.ApplicationSpec
	if err := json.Unmarshal(stub.deployed, &sent); err != nil {
		t.Fatal(err)
	}
	// A set must carry the deployed spec forward: dropping the image, the plan,
	// or an existing variable would turn one environment change into an
	// unrelated redeployment.
	if sent.Env["FEATURE_X"] != "on" || sent.Env["LOG_LEVEL"] != "info" {
		t.Errorf("environment sent = %v", sent.Env)
	}
	if sent.Image != "ghcr.io/example/api:1" || sent.Plan != "small" || sent.Port != 8080 {
		t.Errorf("env set did not preserve the deployed spec: %+v", sent)
	}
}

func TestEnvUnsetRemovesOnlyTheNamedKey(t *testing.T) {
	stub := newControllerStub(t, []ops.ApplicationStatus{deployedApplication()})
	useStub(t, stub)
	if _, err := captureStdout(t, func() error {
		return runEnv([]string{"unset", "LOG_LEVEL", "--app", "api"})
	}); err != nil {
		t.Fatal(err)
	}
	var sent ops.ApplicationSpec
	if err := json.Unmarshal(stub.deployed, &sent); err != nil {
		t.Fatal(err)
	}
	if _, found := sent.Env["LOG_LEVEL"]; found {
		t.Errorf("unset kept the variable: %v", sent.Env)
	}
}

func TestEnvSetRefusesAnAssignmentWithoutAValue(t *testing.T) {
	stub := newControllerStub(t, []ops.ApplicationStatus{deployedApplication()})
	useStub(t, stub)
	_, err := captureStdout(t, func() error { return runEnv([]string{"set", "FEATURE_X", "--app", "api"}) })
	if err == nil || !strings.Contains(err.Error(), "KEY=VALUE") {
		t.Fatalf("a malformed assignment was accepted: %v", err)
	}
	if stub.deployed != nil {
		t.Error("a malformed assignment still queued a deploy")
	}
}

func TestReadCommandsOfferMachineReadableOutput(t *testing.T) {
	stub := newControllerStub(t, []ops.ApplicationStatus{deployedApplication()})
	useStub(t, stub)
	output, err := captureStdout(t, func() error { return runApp([]string{"list", "--json"}) })
	if err != nil {
		t.Fatal(err)
	}
	var decoded []ops.ApplicationStatus
	if err := json.Unmarshal([]byte(output), &decoded); err != nil {
		t.Fatalf("--json output does not parse: %v\n%s", err, output)
	}
	if len(decoded) != 1 || decoded[0].Spec.Name != "api" {
		t.Fatalf("--json output = %s", output)
	}
}

func TestApplicationListPrintsATable(t *testing.T) {
	stub := newControllerStub(t, []ops.ApplicationStatus{deployedApplication()})
	useStub(t, stub)
	output, err := captureStdout(t, func() error { return runApp([]string{"list"}) })
	if err != nil {
		t.Fatal(err)
	}
	for _, want := range []string{"NAME", "api", "running", "https://api.example.com"} {
		if !strings.Contains(output, want) {
			t.Errorf("table did not mention %q:\n%s", want, output)
		}
	}
}

func TestCommandsRefuseWithoutASession(t *testing.T) {
	t.Setenv("SWARMOPS_CONFIG", filepath.Join(t.TempDir(), "config.json"))
	if _, err := captureStdout(t, func() error { return runApp([]string{"list"}) }); err == nil ||
		!strings.Contains(err.Error(), "swarmops login") {
		t.Fatalf("a command without a session did not point at login: %v", err)
	}
}

func TestFlagsMayFollowPositionalArguments(t *testing.T) {
	stub := newControllerStub(t, []ops.ApplicationStatus{deployedApplication()})
	useStub(t, stub)
	output, err := captureStdout(t, func() error { return runApp([]string{"show", "api", "--json"}) })
	if err != nil {
		t.Fatal(err)
	}
	var status ops.ApplicationStatus
	if err := json.Unmarshal([]byte(output), &status); err != nil {
		t.Fatalf("`app show <name> --json` did not honour the trailing flag: %v\n%s", err, output)
	}
}

func TestSanitizeNameProducesAnAcceptableApplicationName(t *testing.T) {
	t.Parallel()
	for input, want := range map[string]string{
		"/home/nima/go/pkg/My_Service": "my-service",
		"/tmp/9lives":                  "app-9lives",
		"/tmp/api":                     "api",
		"/tmp/ünicode":                 "nicode",
	} {
		if got := sanitizeName(input); got != want {
			t.Errorf("sanitizeName(%q) = %q, want %q", input, got, want)
		}
	}
}

func TestRepositoryPathNormalisesEveryRemoteForm(t *testing.T) {
	t.Parallel()
	for remote, want := range map[string]string{
		"":                                     "",
		"git@github.com:nimasrn/SwarmOps.git":  "nimasrn/SwarmOps",
		"https://github.com/nimasrn/SwarmOps":  "nimasrn/SwarmOps",
		"https://token@gitlab.com/group/proj":  "group/proj",
		"ssh://git@gitea.example.com/ops/site": "ops/site",
	} {
		if got := repositoryPath(remote); got != want {
			t.Errorf("repositoryPath(%q) = %q, want %q", remote, got, want)
		}
	}
}

func TestApplicationNameFallsBackToTheManifest(t *testing.T) {
	directory := t.TempDir()
	previous, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	if err := os.Chdir(directory); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.Chdir(previous) })
	if _, err := applicationName(""); err == nil || !strings.Contains(err.Error(), "swarmops init") {
		t.Fatalf("a missing manifest did not point at init: %v", err)
	}
	if err := (cli.Manifest{Name: "api", Port: 8080}).Save(directory, false); err != nil {
		t.Fatal(err)
	}
	name, err := applicationName("")
	if err != nil || name != "api" {
		t.Fatalf("applicationName = %q, %v", name, err)
	}
	if name, err := applicationName("other"); err != nil || name != "other" {
		t.Fatalf("an explicit name was overridden: %q, %v", name, err)
	}
}
