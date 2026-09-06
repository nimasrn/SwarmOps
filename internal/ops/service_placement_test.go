package ops

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/nimasrn/SwarmOps/internal/dockerapi"
)

func placementControl(t *testing.T, services, tasks, nodes string) *ControlPlane {
	t.Helper()
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		response.Header().Set("Content-Type", "application/json")
		switch {
		case strings.HasSuffix(request.URL.Path, "/services"):
			_, _ = response.Write([]byte(services))
		case strings.HasSuffix(request.URL.Path, "/tasks"):
			_, _ = response.Write([]byte(tasks))
		case strings.HasSuffix(request.URL.Path, "/nodes"):
			_, _ = response.Write([]byte(nodes))
		default:
			t.Errorf("unexpected machine request %s", request.URL.Path)
		}
	}))
	t.Cleanup(server.Close)
	docker, err := dockerapi.NewForURL(server.URL, server.Client())
	if err != nil {
		t.Fatal(err)
	}
	return NewControlPlane(docker, DockerCLI{}, nil, ControlPlaneOptions{ServerID: "manager-1"})
}

func TestServiceHostnameNamesTheNodeHoldingTheRunningReplica(t *testing.T) {
	t.Parallel()
	control := placementControl(t,
		`[{"ID":"svc-a","Spec":{"Name":"swarmops-logs_aggregator"}},{"ID":"svc-b","Spec":{"Name":"swarmops-logs_query"}}]`,
		// A shut-down task on another node is listed first: Swarm keeps task
		// history, and reading the wrong one would send every log query to a
		// machine that no longer holds the records.
		`[{"ID":"t1","NodeID":"node-old","ServiceID":"svc-b","DesiredState":"shutdown","Status":{"State":"shutdown"}},
		  {"ID":"t2","NodeID":"node-stateful","ServiceID":"svc-b","DesiredState":"running","Status":{"State":"running"}}]`,
		`[{"ID":"node-old","Description":{"Hostname":"edge-1"}},{"ID":"node-stateful","Description":{"Hostname":"db-1"}}]`,
	)

	hostname, err := control.ServiceHostname(context.Background(), LogQueryServiceName)
	if err != nil {
		t.Fatal(err)
	}
	if hostname != "db-1" {
		t.Fatalf("hostname = %q, want db-1", hostname)
	}
}

func TestServiceHostnameFailsWhenTheServiceIsNotDeployed(t *testing.T) {
	t.Parallel()
	control := placementControl(t, `[]`, `[]`, `[]`)

	if _, err := control.ServiceHostname(context.Background(), PrometheusServiceName); err == nil {
		t.Fatal("expected an error for a service that is not deployed")
	}
}

func TestServiceHostnameFailsWhenNoReplicaIsRunning(t *testing.T) {
	t.Parallel()
	control := placementControl(t,
		`[{"ID":"svc-b","Spec":{"Name":"swarmops-observability_prometheus"}}]`,
		`[{"ID":"t1","NodeID":"node-1","ServiceID":"svc-b","DesiredState":"running","Status":{"State":"pending"}}]`,
		`[{"ID":"node-1","Description":{"Hostname":"db-1"}}]`,
	)

	if _, err := control.ServiceHostname(context.Background(), PrometheusServiceName); err == nil {
		t.Fatal("expected an error while no replica is running")
	}
}
