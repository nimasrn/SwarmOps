package agentcontrol

import "testing"

func TestRoutingReconcileRequestAcceptsFixedAddAndRestore(t *testing.T) {
	request := RoutingReconcileRequest{
		Network:     "swarmops-route-demo-abcdef123456",
		AddNetworks: []string{"swarmops-route-extra-abcdef123456"},
		RestorePublishedPorts: []RoutingPublishedPort{
			{Protocol: "tcp", PublishedPort: 8080, TargetPort: 8080},
		},
		RemoveDirectPorts: true,
		RemoveNetworks:    []string{"swarmops-route-old-abcdef123456"},
		Route:             sampleRoutingRoute(),
		ServiceID:         "svc-id-123",
		TraefikServiceID:  "traefik-id-123",
		Version:           RoutingVersion,
	}
	if err := request.Validate(); err != nil {
		t.Fatal(err)
	}
}

func TestRoutingReconcileRequestRejectsConflictingNetworksAndBadPorts(t *testing.T) {
	for name, request := range map[string]RoutingReconcileRequest{
		"add duplicate network": {
			Network:          "swarmops-route-demo-abcdef123456",
			AddNetworks:      []string{"swarmops-route-extra-abcdef123456", "swarmops-route-extra-abcdef123456"},
			Route:            sampleRoutingRoute(),
			ServiceID:        "svc-id-123",
			TraefikServiceID: "traefik-id-123",
			Version:          RoutingVersion,
		},
		"add and remove same network": {
			Network:          "swarmops-route-demo-abcdef123456",
			AddNetworks:      []string{"swarmops-route-extra-abcdef123456"},
			RemoveNetworks:   []string{"swarmops-route-extra-abcdef123456"},
			Route:            sampleRoutingRoute(),
			ServiceID:        "svc-id-123",
			TraefikServiceID: "traefik-id-123",
			Version:          RoutingVersion,
		},
		"invalid restore protocol": {
			Network: "swarmops-route-demo-abcdef123456",
			RestorePublishedPorts: []RoutingPublishedPort{
				{Protocol: "icmp", PublishedPort: 8080, TargetPort: 8080},
			},
			Route:            sampleRoutingRoute(),
			ServiceID:        "svc-id-123",
			TraefikServiceID: "traefik-id-123",
			Version:          RoutingVersion,
		},
	} {
		t.Run(name, func(t *testing.T) {
			request := request
			if err := request.Validate(); err == nil {
				t.Fatal("invalid routing reconciliation request was accepted")
			}
		})
	}
}

func sampleRoutingRoute() RoutingRoute {
	return RoutingRoute{
		AccessLogs: true,
		Enabled:    true,
		Hosts:      []string{"example.com"},
		Key:        "demo-route",
		TargetPort: 80,
		Metrics:    true,
		PathPrefix: "/",
		Protocol:   "http",
		Scope:      "both",
		TLS:        "off",
	}
}
