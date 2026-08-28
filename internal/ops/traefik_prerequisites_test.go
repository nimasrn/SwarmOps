package ops

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"reflect"
	"testing"

	"github.com/nimasrn/SwarmOps/internal/audit"
	"github.com/nimasrn/SwarmOps/internal/dockerapi"
	"golang.org/x/crypto/bcrypt"
)

type prerequisiteRunner struct {
	calls  [][]string
	inputs []string
}

func (r *prerequisiteRunner) Run(_ context.Context, _ string, args ...string) (string, error) {
	r.calls = append(r.calls, append([]string(nil), args...))
	r.inputs = append(r.inputs, "")
	return "", nil
}

func (r *prerequisiteRunner) RunInput(_ context.Context, _ string, input io.Reader, args ...string) (string, error) {
	data, _ := io.ReadAll(input)
	r.calls = append(r.calls, append([]string(nil), args...))
	r.inputs = append(r.inputs, string(data))
	return "", nil
}

func TestTraefikPrerequisitesPlanAndRepairAreClosedAndComplete(t *testing.T) {
	t.Parallel()
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		response.Header().Set("Content-Type", "application/json")
		switch request.URL.Path {
		case "/networks", "/configs", "/secrets":
			_, _ = response.Write([]byte("[]"))
		case "/nodes":
			_, _ = response.Write([]byte(`[{"ID":"manager-b","Description":{"Hostname":"b"},"ManagerStatus":{"Leader":false},"Spec":{"Availability":"active","Labels":{},"Role":"manager"},"Status":{"State":"ready"}},{"ID":"manager-a","Description":{"Hostname":"a"},"ManagerStatus":{"Leader":true},"Spec":{"Availability":"active","Labels":{},"Role":"manager"},"Status":{"State":"ready"}}]`))
		default:
			http.NotFound(response, request)
		}
	}))
	t.Cleanup(server.Close)
	docker, err := dockerapi.NewForURL(server.URL, server.Client())
	if err != nil {
		t.Fatal(err)
	}
	directory := t.TempDir()
	dynamicPath := filepath.Join(directory, "traefik-dynamic.yml")
	dynamic := "http:\n  middlewares: {}\n"
	if err := os.WriteFile(dynamicPath, []byte(dynamic), 0o600); err != nil {
		t.Fatal(err)
	}
	auditStore, err := audit.Open(directory, bytes.Repeat([]byte{19}, 32), 100)
	if err != nil {
		t.Fatal(err)
	}
	runner := &prerequisiteRunner{}
	control := NewControlPlane(docker, DockerCLI{Runner: runner}, auditStore, ControlPlaneOptions{Mutations: true, TraefikDynamicConfigFile: dynamicPath, TraefikSettings: testTraefikSettings()})

	plan, err := control.PlanTraefikPrerequisiteRepair(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if !plan.CreateNetwork || !plan.CreateDynamicConfig || !plan.CreateDashboardAuth || plan.EdgeManagerID != "manager-a" || plan.DynamicConfig != dynamic {
		t.Fatalf("repair plan = %#v", plan)
	}
	password := "generated-dashboard-password"
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.MinCost)
	if err != nil {
		t.Fatal(err)
	}
	plan.DashboardAuth = "operator:" + string(hash)
	if err := control.RepairTraefikPrerequisites(context.Background(), "operator", "request", plan); err != nil {
		t.Fatal(err)
	}
	wantCalls := [][]string{
		{"network", "create", "--driver", "overlay", "--attachable", "--opt", "encrypted=true", "traefik"},
		{"node", "update", "--label-add", "nim.edge=true", "manager-a"},
		{"config", "create", "nim_traefik_dynamic_v1", "-"},
		{"secret", "create", "traefik_dashboard_auth_v1", "-"},
	}
	if !reflect.DeepEqual(runner.calls, wantCalls) {
		t.Fatalf("Docker calls = %#v", runner.calls)
	}
	if runner.inputs[2] != dynamic || runner.inputs[3] != plan.DashboardAuth {
		t.Fatalf("reviewed inputs were not preserved: %#v", runner.inputs)
	}
}
