package ops

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/nimasrn/SwarmOps/internal/dockerapi"
)

func TestTraefikObservabilityIsEmptyWhenServicesAreNotInstalled(t *testing.T) {
	t.Parallel()
	requests := 0
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		requests++
		if request.URL.Path != "/services" {
			t.Fatalf("unexpected machine request %s", request.URL.Path)
		}
		response.Header().Set("Content-Type", "application/json")
		_, _ = response.Write([]byte("[]"))
	}))
	t.Cleanup(server.Close)
	docker, err := dockerapi.NewForURL(server.URL, server.Client())
	if err != nil {
		t.Fatal(err)
	}
	routing, err := NewRoutingStore(t.TempDir(), make([]byte, 32), "ops@example.com")
	if err != nil {
		t.Fatal(err)
	}
	control := NewControlPlane(docker, DockerCLI{}, nil, ControlPlaneOptions{Routing: routing, ServerID: "manager-1"})
	observed := time.Date(2026, time.August, 28, 12, 0, 0, 0, time.UTC)
	control.now = func() time.Time { return observed }

	if err := control.RefreshTraefikRuntime(context.Background()); err != nil {
		t.Fatal(err)
	}
	logs, err := control.TraefikLogs(context.Background(), TraefikLogFilter{})
	if err != nil {
		t.Fatal(err)
	}
	if logs == nil || len(logs) != 0 {
		t.Fatalf("logs = %#v, want a non-nil empty list", logs)
	}
	status, err := control.TraefikPrometheusStatus(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if status.Collected || !status.Observed.Equal(observed) || status.Targets == nil || len(status.Targets) != 0 {
		t.Fatalf("status = %#v, want an observed not-collected empty status", status)
	}
	if requests != 3 {
		t.Fatalf("service inventory requests = %d, want 3", requests)
	}
}

func TestRouteApplyConfirmations(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name     string
		route    RouteSpec
		restart  bool
		expected []string
	}{
		{
			name:     "public insensitive route no restart",
			route:    RouteSpec{ServiceKey: "front-end", Enabled: true, Sensitive: false, Scope: RoutePublic},
			restart:  false,
			expected: nil,
		},
		{
			name:     "public sensitive route",
			route:    RouteSpec{ServiceKey: "front-end", Enabled: true, Sensitive: true, Scope: RoutePublic},
			restart:  false,
			expected: []string{"PUBLISH_FRONT_END"},
		},
		{
			name:     "internal sensitive route",
			route:    RouteSpec{ServiceKey: "front-end", Enabled: true, Sensitive: true, Scope: RouteInternal},
			restart:  false,
			expected: nil,
		},
		{
			name:     "public disabled sensitive route",
			route:    RouteSpec{ServiceKey: "front-end", Enabled: false, Sensitive: true, Scope: RoutePublic},
			restart:  false,
			expected: nil,
		},
		{
			name:     "restart only route",
			route:    RouteSpec{ServiceKey: "front-end", Enabled: true, Sensitive: false, Scope: RoutePublic},
			restart:  true,
			expected: []string{"RESTART_SINGLETON_TRAEFIK"},
		},
		{
			name:     "publish plus restart",
			route:    RouteSpec{ServiceKey: "front-end", Enabled: true, Sensitive: true, Scope: RouteBoth},
			restart:  true,
			expected: []string{"PUBLISH_FRONT_END", "RESTART_SINGLETON_TRAEFIK"},
		},
	}
	for _, tt := range cases {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			if got := routeApplyConfirmations(tt.route, tt.restart); !equalStrings(got, tt.expected) {
				t.Fatalf("routeApplyConfirmations() = %#v, want %#v", got, tt.expected)
			}
		})
	}
}

func TestRoutePublishedPorts(t *testing.T) {
	t.Parallel()
	service := dockerapi.Service{}
	service.Endpoint.Ports = []struct {
		Protocol      string `json:"Protocol"`
		PublishedPort uint16 `json:"PublishedPort"`
		TargetPort    uint16 `json:"TargetPort"`
	}{
		{Protocol: "tcp", PublishedPort: 8080},
		{Protocol: "tcp", PublishedPort: 8080},
		{Protocol: "tcp", PublishedPort: 443},
	}
	service.Spec.EndpointSpec.Ports = []struct {
		Protocol      string `json:"Protocol"`
		PublishedPort uint16 `json:"PublishedPort"`
		TargetPort    uint16 `json:"TargetPort"`
	}{
		{Protocol: "udp", PublishedPort: 53},
		{Protocol: "udp", PublishedPort: 0},
	}
	got := routePublishedPorts(service)
	want := []uint16{53, 443, 8080}
	if !equalUint16(got, want) {
		t.Fatalf("routePublishedPorts() = %#v, want %#v", got, want)
	}
}

func TestRoutePublishedPortsWithProtocol(t *testing.T) {
	t.Parallel()
	service := dockerapi.Service{}
	service.Endpoint.Ports = []struct {
		Protocol      string `json:"Protocol"`
		PublishedPort uint16 `json:"PublishedPort"`
		TargetPort    uint16 `json:"TargetPort"`
	}{
		{Protocol: "tcp", PublishedPort: 8080, TargetPort: 8080},
		{Protocol: "tcp", PublishedPort: 8080, TargetPort: 8080},
		{Protocol: "udp", PublishedPort: 5353, TargetPort: 5353},
	}
	service.Spec.EndpointSpec.Ports = []struct {
		Protocol      string `json:"Protocol"`
		PublishedPort uint16 `json:"PublishedPort"`
		TargetPort    uint16 `json:"TargetPort"`
	}{
		{Protocol: "tcp", PublishedPort: 80, TargetPort: 80},
		{Protocol: "tcp", PublishedPort: 0, TargetPort: 80},
		{Protocol: "udp", PublishedPort: 5353, TargetPort: 5353},
	}
	got := routePublishedPortsWithProtocol(service)
	want := []CutoverPublishedPort{
		{Protocol: "tcp", PublishedPort: 80, TargetPort: 80},
		{Protocol: "tcp", PublishedPort: 8080, TargetPort: 8080},
		{Protocol: "udp", PublishedPort: 5353, TargetPort: 5353},
	}
	if len(got) != len(want) {
		t.Fatalf("routePublishedPortsWithProtocol() len = %d, want %d", len(got), len(want))
	}
	for index := range want {
		if got[index] != want[index] {
			t.Fatalf("routePublishedPortsWithProtocol() = %#v, want %#v", got[index], want[index])
		}
	}
}

func TestRouteLegacyNetworks(t *testing.T) {
	t.Parallel()
	service := dockerapi.Service{}
	service.Spec.TaskTemplate.Networks = []struct {
		Aliases []string `json:"Aliases"`
		Target  string   `json:"Target"`
	}{
		{Target: "swarmops"},
		{Target: RouteNetworkName("demo_api")},
		{Target: "app-db"},
		{Target: " ingress "},
		{Target: RouteNetworkName("demo_api")},
	}
	got := routeLegacyNetworks(service, "demo_api")
	want := []string{"app-db", "swarmops"}
	if !equalStrings(got, want) {
		t.Fatalf("routeLegacyNetworks() = %#v, want %#v", got, want)
	}
}

func equalStrings(left, right []string) bool {
	if len(left) != len(right) {
		return false
	}
	for index := range left {
		if left[index] != right[index] {
			return false
		}
	}
	return true
}

func equalUint16(left, right []uint16) bool {
	if len(left) != len(right) {
		return false
	}
	for index := range left {
		if left[index] != right[index] {
			return false
		}
	}
	return true
}
