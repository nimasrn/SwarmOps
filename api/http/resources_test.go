package apihttp

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/nimasrn/SwarmOps/internal/auth"
	"github.com/nimasrn/SwarmOps/internal/domain"
	"github.com/nimasrn/SwarmOps/internal/ops"
)

// The catalogue is what the console's Commands screen renders, so it has to
// describe every route the server actually serves. A mutation listed without a
// confirmation the API enforces would tell an operator the wrong thing.
func TestCommandCatalogueDescribesTheServedSurface(t *testing.T) {
	t.Parallel()
	catalogue := ops.CommandCatalogue()
	if len(catalogue) < 40 {
		t.Fatalf("catalogue has %d entries, want the full Docker and Swarm surface", len(catalogue))
	}
	seen := map[string]bool{}
	reads, mutations := 0, 0
	for _, definition := range catalogue {
		if seen[definition.Action] {
			t.Fatalf("duplicate catalogue action %q", definition.Action)
		}
		seen[definition.Action] = true
		if definition.Title == "" || definition.Description == "" || definition.Docker == "" || definition.Resource == "" {
			t.Fatalf("incomplete catalogue entry: %#v", definition)
		}
		method, path, found := strings.Cut(definition.Endpoint, " ")
		if !found || !strings.HasPrefix(path, "/api/v1/") {
			t.Fatalf("catalogue entry %q has no API endpoint", definition.Action)
		}
		if definition.Mutation {
			mutations++
			if method != "POST" {
				t.Fatalf("mutation %q is not a POST", definition.Action)
			}
		} else {
			reads++
			if method != "GET" {
				t.Fatalf("read %q is not a GET", definition.Action)
			}
			if definition.Destructive || definition.Confirmation != "" {
				t.Fatalf("read %q claims a write property", definition.Action)
			}
		}
		if definition.Destructive && definition.Confirmation == "" && definition.Action != "image.remove" {
			t.Fatalf("destructive operation %q has no confirmation", definition.Action)
		}
	}
	if reads == 0 || mutations == 0 {
		t.Fatalf("catalogue reads = %d, mutations = %d", reads, mutations)
	}
}

// Confirmation phrases are derived from the target so the console can print
// exactly what an operator must type. They must be stable and target-specific.
func TestRemovalConfirmationsAreTargetSpecific(t *testing.T) {
	t.Parallel()
	if ops.NodeRemovalConfirmation("abc") == ops.NodeRemovalConfirmation("def") {
		t.Fatal("node removal confirmations are not target specific")
	}
	if ops.ResourceRemovalConfirmation("VOLUME", "data") != "REMOVE_VOLUME_DATA" {
		t.Fatalf("volume confirmation = %q", ops.ResourceRemovalConfirmation("VOLUME", "data"))
	}
	if ops.PruneConfirmation("build-cache") != "PRUNE_BUILD_CACHE" {
		t.Fatalf("prune confirmation = %q", ops.PruneConfirmation("build-cache"))
	}
	if ops.JoinTokenRotationConfirmation("worker") != "ROTATE_WORKER_JOIN_TOKEN" {
		t.Fatalf("rotation confirmation = %q", ops.JoinTokenRotationConfirmation("worker"))
	}
}

// A destructive resource route must refuse a request whose confirmation does
// not match before it ever reaches the command ledger.
func TestResourceMutationsRequireTheirConfirmation(t *testing.T) {
	t.Parallel()
	server := &Server{}
	cases := []struct {
		body    string
		handler protectedHandler
		path    string
		value   [2]string
	}{
		{`{"confirmation":"WRONG"}`, server.nodeRemove, "/api/v1/nodes/node-1/remove", [2]string{"id", "node-1"}},
		{`{"confirmation":"WRONG"}`, server.serviceRemove, "/api/v1/services/api/remove", [2]string{"id", "api"}},
		{`{"confirmation":"WRONG"}`, server.volumeRemove, "/api/v1/volumes/data/remove", [2]string{"name", "data"}},
		{`{"confirmation":"WRONG"}`, server.networkRemove, "/api/v1/networks/edge/remove", [2]string{"name", "edge"}},
		{`{"confirmation":"WRONG"}`, server.configRemove, "/api/v1/configs/app/remove", [2]string{"name", "app"}},
		{`{"confirmation":"WRONG"}`, server.stackRemove, "/api/v1/stacks/api/remove", [2]string{"name", "api"}},
		{`{"confirmation":"WRONG"}`, server.prune, "/api/v1/prune/volumes", [2]string{"resource", "volumes"}},
	}
	for _, testCase := range cases {
		request := httptest.NewRequest(http.MethodPost, testCase.path, strings.NewReader(testCase.body))
		request.SetPathValue(testCase.value[0], testCase.value[1])
		response := httptest.NewRecorder()
		testCase.handler(response, request, auth.Claims{Username: "operator"})
		if response.Code != http.StatusUnprocessableEntity {
			t.Fatalf("%s status = %d, want %d", testCase.path, response.Code, http.StatusUnprocessableEntity)
		}
		var payload struct {
			Error string `json:"error"`
		}
		if err := json.NewDecoder(response.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		if !strings.Contains(payload.Error, "confirmation") {
			t.Fatalf("%s error = %q", testCase.path, payload.Error)
		}
	}
}

// The catalogue is served as data, so a console that cannot reach the source
// still shows the operator the same vocabulary the server enforces.
func TestCommandCatalogueIsServedAsData(t *testing.T) {
	t.Parallel()
	server := &Server{}
	response := httptest.NewRecorder()
	server.commandCatalogue(response, httptest.NewRequest(http.MethodGet, "/api/v1/commands/catalogue", nil), auth.Claims{Username: "operator"})
	if response.Code != http.StatusOK {
		t.Fatalf("status = %d", response.Code)
	}
	var payload []domain.CommandDefinition
	if err := json.NewDecoder(response.Body).Decode(&payload); err != nil {
		t.Fatal(err)
	}
	if len(payload) != len(ops.CommandCatalogue()) {
		t.Fatalf("served %d entries, want %d", len(payload), len(ops.CommandCatalogue()))
	}
}

// The console builds its run form and its request from the catalogue alone, so
// every placeholder in an endpoint must have a parameter that fills it, and no
// parameter may point at a placeholder the endpoint does not have.
func TestCatalogueParametersFillEveryEndpointPlaceholder(t *testing.T) {
	t.Parallel()
	for _, definition := range ops.CommandCatalogue() {
		_, path, _ := strings.Cut(definition.Endpoint, " ")
		placeholders := map[string]bool{}
		for _, segment := range strings.Split(path, "/") {
			if strings.HasPrefix(segment, "{") && strings.HasSuffix(segment, "}") {
				placeholders[strings.Trim(segment, "{}")] = true
			}
		}
		supplied := map[string]bool{}
		for _, parameter := range definition.Parameters {
			if parameter.Name == "" || parameter.Label == "" || parameter.Kind == "" {
				t.Fatalf("%s has an incomplete parameter: %#v", definition.Action, parameter)
			}
			switch parameter.In {
			case "path":
				if !placeholders[parameter.Name] {
					t.Fatalf("%s supplies path parameter %q that %q does not take", definition.Action, parameter.Name, path)
				}
				supplied[parameter.Name] = true
			case "body", "query":
			default:
				t.Fatalf("%s parameter %q has an unknown location %q", definition.Action, parameter.Name, parameter.In)
			}
			if parameter.Kind == "select" && len(parameter.Options) == 0 {
				t.Fatalf("%s parameter %q is a select with no options", definition.Action, parameter.Name)
			}
		}
		for name := range placeholders {
			if !supplied[name] {
				t.Fatalf("%s endpoint %q has an unfilled placeholder %q", definition.Action, path, name)
			}
		}
		// A destructive operation must both declare its phrase and ask for it,
		// or the console would offer a form the API always refuses.
		if definition.Confirmation != "" {
			found := false
			for _, parameter := range definition.Parameters {
				found = found || parameter.Kind == "confirmation"
			}
			if !found {
				t.Fatalf("%s declares a confirmation but its form does not ask for one", definition.Action)
			}
		}
	}
}
