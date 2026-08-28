package apihttp

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/nimasrn/SwarmOps/internal/auth"
	"github.com/nimasrn/SwarmOps/internal/changepreview"
	"github.com/nimasrn/SwarmOps/internal/coretopology"
	"github.com/nimasrn/SwarmOps/internal/diagnosis"
	"github.com/nimasrn/SwarmOps/internal/dockerapi"
	"github.com/nimasrn/SwarmOps/internal/domain"
	"github.com/nimasrn/SwarmOps/internal/ops"
)

// fakeEngine is a Docker Engine that answers with real Docker-shaped JSON over
// real HTTP.
//
// It is deliberately not a mock of the control plane. The thing these tests
// exist to check is the WIRING — whether a placement constraint actually
// survives the decode, whether UpdateConfig arrives, whether a probe timestamp
// is where the handler looks for it. A mock returning domain types would skip
// exactly that and assert only that my own structs round-trip.
type fakeEngine struct {
	services []map[string]any
	nodes    []map[string]any
	tasks    []map[string]any
	images   []map[string]any
}

func (f *fakeEngine) start(t *testing.T) *ops.ControlPlane {
	t.Helper()
	mux := http.NewServeMux()
	write := func(w http.ResponseWriter, body any) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(body)
	}
	mux.HandleFunc("/services", func(w http.ResponseWriter, _ *http.Request) { write(w, f.services) })
	mux.HandleFunc("/nodes", func(w http.ResponseWriter, _ *http.Request) { write(w, f.nodes) })
	mux.HandleFunc("/tasks", func(w http.ResponseWriter, _ *http.Request) { write(w, f.tasks) })
	mux.HandleFunc("/images/json", func(w http.ResponseWriter, _ *http.Request) { write(w, f.images) })
	mux.HandleFunc("/info", func(w http.ResponseWriter, _ *http.Request) {
		write(w, map[string]any{"Swarm": map[string]any{"LocalNodeState": "active", "ControlAvailable": true}})
	})
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		// Anything unmodelled answers empty rather than 404, so a handler that
		// reads more than these tests anticipate fails on the assertion rather
		// than on transport.
		write(w, []any{})
	})
	server := httptest.NewServer(mux)
	t.Cleanup(server.Close)

	client, err := dockerapi.NewForURL(server.URL, server.Client())
	if err != nil {
		t.Fatalf("docker client: %v", err)
	}
	// The real constructor, not a struct literal: it sets unexported fields the
	// read paths depend on, and building one by hand would test a ControlPlane
	// that never exists in production.
	return ops.NewControlPlane(client, ops.DockerCLI{}, nil, ops.ControlPlaneOptions{DataDir: t.TempDir()})
}

func testServer(t *testing.T, control *ops.ControlPlane) *Server {
	t.Helper()
	store, err := coretopology.Open(t.TempDir(), make([]byte, 32), coretopology.Config{
		Endpoint: "https://core.test", ID: "core-1", Mode: domain.CoreRoleActive, Name: "core",
	})
	if err != nil {
		t.Fatalf("core topology: %v", err)
	}
	if !store.CanManage() {
		t.Fatal("an active core must be able to manage; the handlers all gate on it")
	}
	return &Server{
		core:    store,
		targets: TargetResolverFunc(func(string) (Target, error) { return Target{Control: control}, nil }),
	}
}

func swarmService(name string, replicas int, image string, constraints []string, update map[string]any) map[string]any {
	spec := map[string]any{
		"Name": name,
		"Mode": map[string]any{"Replicated": map[string]any{"Replicas": replicas}},
		"TaskTemplate": map[string]any{
			"ContainerSpec": map[string]any{"Image": image},
			"Placement":     map[string]any{"Constraints": constraints},
		},
	}
	if update != nil {
		spec["UpdateConfig"] = update
	}
	return map[string]any{"ID": "svc-" + name, "Spec": spec, "CreatedAt": time.Now().UTC()}
}

func swarmNode(id, hostname string, labels map[string]string, freeBytes, capBytes uint64) map[string]any {
	return map[string]any{
		"ID": id,
		"Description": map[string]any{
			"Hostname":  hostname,
			"Resources": map[string]any{"NanoCPUs": 4e9, "MemoryBytes": 8e9},
		},
		"Spec":   map[string]any{"Role": "worker", "Availability": "active", "Labels": labels},
		"Status": map[string]any{"State": "ready", "Addr": "10.0.0.1"},
	}
}

// --- the wiring these tests exist for ---------------------------------------

// A placement constraint has to survive Docker's JSON, the dockerapi struct,
// fromDockerService and the handler before a rule can reason about it. It was
// unmodelled until recently, which is exactly why this is asserted end to end.
func TestDiagnosisHandlerCarriesConstraintsFromDockerToTheRule(t *testing.T) {
	engine := &fakeEngine{
		services: []map[string]any{swarmService("api-gateway", 3, "api:1", []string{"node.labels.tier==gpu"}, nil)},
		nodes:    []map[string]any{swarmNode("n1", "worker-01", map[string]string{"tier": "edge"}, 8e9, 40e9)},
	}
	server := testServer(t, engine.start(t))

	request := httptest.NewRequest("GET", "/api/v1/services/api-gateway/diagnosis", nil)
	request.SetPathValue("id", "api-gateway")
	response := httptest.NewRecorder()
	server.serviceDiagnosis(response, request, auth.Claims{})

	if response.Code != http.StatusOK {
		t.Fatalf("status %d: %s", response.Code, response.Body.String())
	}
	var result diagnosis.Result
	if err := json.Unmarshal(response.Body.Bytes(), &result); err != nil {
		t.Fatal(err)
	}
	if result.Chain == nil {
		t.Fatalf("the constraint did not reach the rule; got refusal: %+v", result.Refusal)
	}
	if result.Chain.Rule != "constraint-unsatisfiable" {
		t.Fatalf("wrong rule: %s", result.Chain.Rule)
	}
	if len(result.Chain.Actions) == 0 {
		t.Fatal("a chain reaching the console with no action has diagnosed nothing")
	}
}

// A converged service must produce a refusal through the real path, not a
// chain — the handler's own short-circuit, exercised rather than assumed.
func TestDiagnosisHandlerRefusesAConvergedService(t *testing.T) {
	engine := &fakeEngine{
		services: []map[string]any{swarmService("api", 1, "api:1", nil, nil)},
		nodes:    []map[string]any{swarmNode("n1", "worker-01", nil, 8e9, 40e9)},
		tasks:    []map[string]any{{"ID": "t1", "ServiceID": "svc-api", "NodeID": "n1", "DesiredState": "running", "Status": map[string]any{"State": "running"}}},
	}
	server := testServer(t, engine.start(t))
	request := httptest.NewRequest("GET", "/x", nil)
	request.SetPathValue("id", "api")
	response := httptest.NewRecorder()
	server.serviceDiagnosis(response, request, auth.Claims{})

	var result diagnosis.Result
	_ = json.Unmarshal(response.Body.Bytes(), &result)
	if result.Chain != nil {
		t.Fatalf("diagnosed a healthy service: %s", result.Chain.Rule)
	}
	if result.Refusal == nil || !strings.Contains(result.Refusal.Reason, "nothing to explain") {
		t.Fatalf("want the converged refusal, got %+v", result.Refusal)
	}
}

func TestDiagnosisHandlerRejectsAnUnknownService(t *testing.T) {
	server := testServer(t, (&fakeEngine{}).start(t))
	request := httptest.NewRequest("GET", "/x", nil)
	request.SetPathValue("id", "nope")
	response := httptest.NewRecorder()
	server.serviceDiagnosis(response, request, auth.Claims{})
	if response.Code != http.StatusNotFound {
		t.Fatalf("status %d", response.Code)
	}
}

// UpdateConfig was on the wire and unread. The preview's central claim — what
// happens when a step fails — is read from it, so the decode is asserted here
// rather than only in the package's unit tests.
func TestPreviewHandlerReadsUpdateConfigFromDocker(t *testing.T) {
	engine := &fakeEngine{
		services: []map[string]any{swarmService("api", 3, "api:1",
			nil, map[string]any{"Parallelism": 1, "FailureAction": "rollback", "Monitor": 20e9, "Order": "start-first"})},
	}
	server := testServer(t, engine.start(t))

	request := httptest.NewRequest("POST", "/x", strings.NewReader(`{"image":"api:2"}`))
	request.SetPathValue("id", "api")
	response := httptest.NewRecorder()
	server.changePreview(response, request, auth.Claims{})

	if response.Code != http.StatusOK {
		t.Fatalf("status %d: %s", response.Code, response.Body.String())
	}
	var preview changepreview.Preview
	if err := json.Unmarshal(response.Body.Bytes(), &preview); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(preview.Rollback, "automatically") {
		t.Fatalf("FailureAction=rollback did not survive the decode: %q", preview.Rollback)
	}
	startFirst := false
	for _, step := range preview.Steps {
		if strings.Contains(step.Title, "Start replacements before") {
			startFirst = true
		}
	}
	if !startFirst {
		t.Fatal("Order=start-first did not survive the decode")
	}
	if len(preview.Unknowns) == 0 {
		t.Fatal("a preview reaching the console promising everything is lying")
	}
}

// A service with no UpdateConfig must be told Docker's real default, through
// the real decode path rather than a hand-built struct.
func TestPreviewHandlerDoesNotInventAPolicyForAnUnconfiguredService(t *testing.T) {
	engine := &fakeEngine{services: []map[string]any{swarmService("api", 2, "api:1", nil, nil)}}
	server := testServer(t, engine.start(t))
	request := httptest.NewRequest("POST", "/x", strings.NewReader(`{"image":"api:2"}`))
	request.SetPathValue("id", "api")
	response := httptest.NewRecorder()
	server.changePreview(response, request, auth.Claims{})

	var preview changepreview.Preview
	_ = json.Unmarshal(response.Body.Bytes(), &preview)
	if !strings.Contains(preview.Rollback, "PAUSES") {
		t.Fatalf("promised behaviour the cluster never agreed to: %q", preview.Rollback)
	}
	if !strings.Contains(strings.Join(preview.Unknowns, " "), "no update policy") {
		t.Fatalf("the absence must be disclosed: %+v", preview.Unknowns)
	}
}

func TestPreviewHandlerRequiresAnImage(t *testing.T) {
	server := testServer(t, (&fakeEngine{}).start(t))
	for _, body := range []string{`{}`, `{"image":""}`, `not json`} {
		request := httptest.NewRequest("POST", "/x", strings.NewReader(body))
		request.SetPathValue("id", "api")
		response := httptest.NewRecorder()
		server.changePreview(response, request, auth.Claims{})
		if response.Code != http.StatusBadRequest {
			t.Fatalf("accepted %q with status %d", body, response.Code)
		}
	}
}

// Every one of these handlers gates on an active control plane. A standby
// replica must not answer with cluster facts.
func TestHandlersRefuseOnAStandbyReplica(t *testing.T) {
	control := (&fakeEngine{}).start(t)
	server := &Server{targets: TargetResolverFunc(func(string) (Target, error) { return Target{Control: control}, nil })}
	for name, call := range map[string]func(http.ResponseWriter, *http.Request){
		"diagnosis": func(w http.ResponseWriter, r *http.Request) { server.serviceDiagnosis(w, r, auth.Claims{}) },
		"preview":   func(w http.ResponseWriter, r *http.Request) { server.changePreview(w, r, auth.Claims{}) },
	} {
		request := httptest.NewRequest("POST", "/x", strings.NewReader(`{"image":"a:1"}`))
		request.SetPathValue("id", "api")
		response := httptest.NewRecorder()
		call(response, request)
		if response.Code != http.StatusConflict {
			t.Fatalf("%s answered on a standby replica with %d", name, response.Code)
		}
	}
}
