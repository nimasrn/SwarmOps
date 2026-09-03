package ops

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/nimasrn/SwarmOps/internal/dockerapi"
)

func TestCoreConsoleHostnameIsBuiltFromTheChosenZone(t *testing.T) {
	t.Parallel()
	cases := map[string]struct {
		request CoreConsoleRequest
		host    string
		valid   bool
	}{
		"named subdomain": {request: CoreConsoleRequest{CredentialID: "production-dns", Label: " Panel ", Zone: "Example.com."}, host: "panel.example.com", valid: true},
		"apex zone":       {request: CoreConsoleRequest{CredentialID: "production-dns", Zone: "example.com"}, host: "example.com", valid: true},
		"no credential":   {request: CoreConsoleRequest{Label: "panel", Zone: "example.com"}, host: "panel.example.com"},
		"unusable zone":   {request: CoreConsoleRequest{CredentialID: "production-dns", Zone: "not a zone"}, host: "not a zone"},
		"bad address":     {request: CoreConsoleRequest{Address: "203.0.113", CredentialID: "production-dns", Zone: "example.com"}, host: "example.com"},
	}
	for name, testCase := range cases {
		t.Run(name, func(t *testing.T) {
			t.Parallel()
			if got := testCase.request.Host(); got != testCase.host {
				t.Fatalf("host = %q, want %q", got, testCase.host)
			}
			err := testCase.request.Validate()
			if testCase.valid && err != nil {
				t.Fatalf("validate = %v, want accepted", err)
			}
			if !testCase.valid && err == nil {
				t.Fatal("validate accepted an unusable console request")
			}
		})
	}
}

// The console's route is a route like every other one. If it ever stopped
// validating, publishing would fail at apply time with a message about a
// generic route rather than about the console.
func TestCoreConsoleRouteIsAValidSensitivePublicRoute(t *testing.T) {
	t.Parallel()
	route := coreConsoleRouteSpec("panel.example.com", "swarmops_api", "le")
	if err := route.Validate(); err != nil {
		t.Fatal(err)
	}
	if !route.Sensitive || !route.PublicAllow || route.TLS != RouteTLSTerminate || route.DNSReference != CoreConsoleRecordID {
		t.Fatalf("route = %#v, want a sensitive public TLS route bound to its own record", route)
	}
	confirmations := routeApplyConfirmations(route, false)
	if len(confirmations) != 1 || confirmations[0] != "PUBLISH_SWARMOPS_API" {
		t.Fatalf("confirmations = %v, want the sensitive publication phrase", confirmations)
	}
}

func TestCoreConsoleResolverFollowsTheChosenCredential(t *testing.T) {
	t.Parallel()
	settings := DefaultTraefikSettings("ops@example.com")
	settings.Resolvers = append([]ACMEPolicy{{Name: "pinned", Challenge: ChallengeDNS01, DNSCredentialID: "second-dns", Provider: DNSProviderCloudflare}}, settings.Resolvers...)
	state := RoutingState{
		Credentials: []DNSCredentialMetadata{
			{ID: "production-dns", Provider: DNSProviderCloudflare, State: "validated", Version: 1},
			{ID: "second-dns", Provider: DNSProviderCloudflare, State: "validated", Version: 1},
			{ID: "arvan-dns", Provider: DNSProviderArvan, State: "removed", Version: 1},
		},
		Settings: settings,
	}
	if resolver, err := coreConsoleResolver(state, "second-dns"); err != nil || resolver != "pinned" {
		t.Fatalf("resolver = %q, %v; want the resolver pinned to that credential", resolver, err)
	}
	if resolver, err := coreConsoleResolver(state, "production-dns"); err != nil || resolver != "le" {
		t.Fatalf("resolver = %q, %v; want the provider's DNS-01 resolver", resolver, err)
	}
	if _, err := coreConsoleResolver(state, "arvan-dns"); err == nil {
		t.Fatal("a credential with no validated version produced a resolver")
	}
}

// A host-native controller has no service to label, and guessing one would
// produce a route to nothing. The screen has to say so instead.
func TestCoreConsoleStatusBlocksWhenTheControllerIsNotAService(t *testing.T) {
	t.Parallel()
	control := coreConsoleTestControl(t, `[{"ID":"traefik-1","Spec":{"Name":"traefik_traefik"}}]`, `[]`)
	status, err := control.CoreConsoleStatus(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(status.Blocked, "swarmops_api") || status.Confirmation != "" {
		t.Fatalf("status = %#v, want a blocked publication naming the missing service", status)
	}
}

func TestCoreConsoleStatusOffersAcceptedZonesAndTheEdgeAddress(t *testing.T) {
	t.Parallel()
	control := coreConsoleTestControl(t,
		`[{"ID":"core-1","Spec":{"Name":"swarmops_api"}},{"ID":"traefik-1","Spec":{"Name":"traefik_traefik"}}]`,
		`[{"ID":"node-1","Spec":{"Role":"manager","Availability":"active","Labels":{"nim.edge":"true"}},"Status":{"Addr":"203.0.113.10","State":"ready"}}]`)
	if err := control.Routing.PutDomain(control.ServerID, DomainSpec{Version: RoutingSchemaVersion, Zone: "example.com"}); err != nil {
		t.Fatal(err)
	}
	status, err := control.CoreConsoleStatus(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if status.Blocked != "" {
		t.Fatalf("blocked = %q, want a publishable console", status.Blocked)
	}
	if len(status.Zones) != 1 || status.Zones[0] != "example.com" {
		t.Fatalf("zones = %v, want the accepted zone", status.Zones)
	}
	if status.Address != "203.0.113.10" || status.Confirmation != "PUBLISH_SWARMOPS_API" || status.Published {
		t.Fatalf("status = %#v, want the edge address and the publication phrase", status)
	}
}

// A swarm that advertises a private address cannot have a public record
// guessed for it: the A record would resolve to an unreachable host.
func TestCoreConsoleRefusesToGuessAPrivateGatewayAddress(t *testing.T) {
	t.Parallel()
	control := coreConsoleTestControl(t,
		`[{"ID":"core-1","Spec":{"Name":"swarmops_api"}},{"ID":"traefik-1","Spec":{"Name":"traefik_traefik"}}]`,
		`[{"ID":"node-1","Spec":{"Role":"manager","Availability":"active","Labels":{"nim.edge":"true"}},"Status":{"Addr":"10.0.0.4:2377","State":"ready"}}]`)
	_, err := control.coreConsoleEdgeAddress(context.Background())
	if err == nil || !strings.Contains(err.Error(), "10.0.0.4") {
		t.Fatalf("error = %v, want a refusal naming the private address it found", err)
	}
}

func TestCoreConsolePlanRefusesAZoneTheGatewayNeverAccepted(t *testing.T) {
	t.Parallel()
	control := coreConsoleTestControl(t,
		`[{"ID":"core-1","Spec":{"Name":"swarmops_api"}},{"ID":"traefik-1","Spec":{"Name":"traefik_traefik"}}]`,
		`[{"ID":"node-1","Spec":{"Role":"manager","Availability":"active","Labels":{"nim.edge":"true"}},"Status":{"Addr":"203.0.113.10","State":"ready"}}]`)
	_, err := control.PlanCoreConsole(context.Background(), CoreConsoleRequest{CredentialID: "production-dns", Label: "panel", Zone: "example.com"})
	if err == nil || !strings.Contains(err.Error(), "accepted gateway domain") {
		t.Fatalf("error = %v, want the publication order to refuse an unaccepted zone", err)
	}
}

func coreConsoleTestControl(t *testing.T, services, nodes string) *ControlPlane {
	t.Helper()
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		response.Header().Set("Content-Type", "application/json")
		switch request.URL.Path {
		case "/services":
			_, _ = response.Write([]byte(services))
		case "/nodes":
			_, _ = response.Write([]byte(nodes))
		default:
			t.Errorf("unexpected machine request %s", request.URL.Path)
			_, _ = response.Write([]byte("[]"))
		}
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
	return NewControlPlane(docker, DockerCLI{}, nil, ControlPlaneOptions{Routing: routing, ServerID: "manager-1"})
}
