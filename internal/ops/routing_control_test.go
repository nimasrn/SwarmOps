package ops

import (
	"testing"

	"github.com/nimasrn/SwarmOps/internal/dockerapi"
)

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
