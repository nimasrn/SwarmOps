package ops

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/nimasrn/SwarmOps/internal/dockerapi"
)

func TestTraefikInstallPreflightExplainsRequiredAndAutomaticResources(t *testing.T) {
	t.Parallel()
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		response.Header().Set("Content-Type", "application/json")
		switch request.URL.Path {
		case "/networks", "/configs", "/secrets":
			_, _ = response.Write([]byte("[]"))
		case "/nodes":
			_, _ = response.Write([]byte(`[{"ID":"manager-1","Spec":{"Availability":"active","Labels":{},"Role":"manager"},"Status":{"State":"ready"}}]`))
		default:
			http.NotFound(response, request)
		}
	}))
	t.Cleanup(server.Close)
	docker, err := dockerapi.NewForURL(server.URL, server.Client())
	if err != nil {
		t.Fatal(err)
	}
	control := NewControlPlane(docker, DockerCLI{}, nil, ControlPlaneOptions{TraefikSettings: testTraefikSettings()})

	preflight, err := control.TraefikInstallPreflight(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if preflight.Ready || preflight.Challenge != "http-01" {
		t.Fatalf("preflight = %#v", preflight)
	}
	assertTraefikCheck(t, preflight, "ingress-network", "blocked", true)
	assertTraefikCheck(t, preflight, "edge-network", "blocked", true)
	assertTraefikCheck(t, preflight, "edge-placement", "blocked", true)
	assertTraefikCheck(t, preflight, "dynamic-config", "blocked", true)
	assertTraefikCheck(t, preflight, "static-config", "automatic", false)
	assertTraefikCheck(t, preflight, "dashboard-auth", "blocked", true)
	assertTraefikCheck(t, preflight, "cloudflare-dns", "optional", false)
	assertTraefikCheck(t, preflight, "arvan-dns", "optional", false)
}

func TestTraefikFallsBackToHTTPChallengeWithoutDNSSecrets(t *testing.T) {
	t.Parallel()
	settings := testTraefikSettings()
	settings.Control = DefaultTraefikSettings(settings.ACMEEmail)
	settings.Control.DashboardHost = "traefik.example.com"
	if err := applyTraefikChallengeFallback(&settings, nil, map[string]bool{}); err != nil {
		t.Fatal(err)
	}
	static, err := RenderTraefikStaticConfig(settings.Control)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(static), "httpChallenge") || strings.Contains(string(static), "dnsChallenge") {
		t.Fatalf("static config did not use HTTP-01 fallback:\n%s", static)
	}
	settings.StaticConfigName = TraefikStaticConfigName(static)
	source := []byte(`version: "3.9"
services:
  traefik:
    image: ${TRAEFIK_IMAGE:-traefik:v3.6.13}
    environment:
      CF_DNS_API_TOKEN_FILE: /run/secrets/traefik_cf_dns_token
      ARVANCLOUD_API_KEY_FILE: /run/secrets/traefik_arvan_api_key
    secrets: [traefik_cf_dns_token, traefik_arvan_api_key, traefik_dashboard_auth]
configs:
  traefik_dynamic:
    file: dynamic.yml
    name: ${TRAEFIK_DYNAMIC_CONFIG_NAME:-nim_traefik_dynamic_v1}
secrets:
  traefik_cf_dns_token:
    external: true
  traefik_arvan_api_key:
    external: true
  traefik_dashboard_auth:
    external: true
`)
	rendered, err := RenderTraefikStack(source, settings)
	if err != nil {
		t.Fatal(err)
	}
	text := string(rendered)
	if strings.Contains(text, "CF_DNS_API_TOKEN_FILE") || strings.Contains(text, "ARVANCLOUD_API_KEY_FILE") || strings.Contains(text, "traefik_cf_dns_token") || strings.Contains(text, "traefik_arvan_api_key") {
		t.Fatalf("HTTP-01 stack still requires DNS secrets:\n%s", text)
	}
	if !strings.Contains(text, "traefik_dashboard_auth") {
		t.Fatalf("dashboard authentication was removed:\n%s", text)
	}
}

func assertTraefikCheck(t *testing.T, preflight TraefikInstallPreflight, id, state string, required bool) {
	t.Helper()
	for _, check := range preflight.Checks {
		if check.ID == id {
			if check.State != state || check.Required != required {
				t.Fatalf("check %s = %#v", id, check)
			}
			return
		}
	}
	t.Fatalf("check %s was not returned", id)
}

// A cluster whose ingress network was removed after swarm init cannot publish
// any port. The console has to name that as its own prerequisite: previously
// it surfaced only at deploy time, as an opaque stack failure that was retried
// to exhaustion.
func TestTraefikInstallPreflightReportsMissingIngressNetwork(t *testing.T) {
	t.Parallel()
	for _, testCase := range []struct {
		name     string
		networks string
		state    string
		fixable  bool
	}{
		{name: "present", networks: `[{"Name":"ingress","Driver":"overlay","Scope":"swarm","Ingress":true,"IPAM":{"Config":[{"Subnet":"10.0.0.0/24"}]}}]`, state: "ready", fixable: false},
		{name: "missing", networks: `[]`, state: "blocked", fixable: true},
		{name: "missing with default range taken", networks: `[{"Name":"other","Driver":"overlay","Scope":"swarm","IPAM":{"Config":[{"Subnet":"10.0.0.0/16"}]}}]`, state: "blocked", fixable: true},
		{name: "missing with every candidate taken", networks: `[{"Name":"a","IPAM":{"Config":[{"Subnet":"10.0.0.0/8"}]}},{"Name":"b","IPAM":{"Config":[{"Subnet":"172.31.0.0/16"}]}}]`, state: "blocked", fixable: false},
	} {
		testCase := testCase
		t.Run(testCase.name, func(t *testing.T) {
			t.Parallel()
			server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
				response.Header().Set("Content-Type", "application/json")
				switch request.URL.Path {
				case "/networks":
					_, _ = response.Write([]byte(testCase.networks))
				case "/configs", "/secrets":
					_, _ = response.Write([]byte("[]"))
				case "/nodes":
					_, _ = response.Write([]byte(`[{"ID":"manager-1","Spec":{"Availability":"active","Labels":{},"Role":"manager"},"Status":{"State":"ready"}}]`))
				default:
					http.NotFound(response, request)
				}
			}))
			t.Cleanup(server.Close)
			docker, err := dockerapi.NewForURL(server.URL, server.Client())
			if err != nil {
				t.Fatal(err)
			}
			control := NewControlPlane(docker, DockerCLI{}, nil, ControlPlaneOptions{TraefikSettings: testTraefikSettings()})
			preflight, err := control.TraefikInstallPreflight(context.Background())
			if err != nil {
				t.Fatal(err)
			}
			assertTraefikCheck(t, preflight, "ingress-network", testCase.state, true)
			for _, check := range preflight.Checks {
				if check.ID == "ingress-network" && check.Fixable != testCase.fixable {
					t.Fatalf("ingress-network fixable = %t, want %t (%s)", check.Fixable, testCase.fixable, check.Recovery)
				}
			}
		})
	}
}

func TestIngressAddressCandidateAvoidsOccupiedRanges(t *testing.T) {
	t.Parallel()
	control := NewControlPlane(nil, DockerCLI{}, nil, ControlPlaneOptions{TraefikSettings: testTraefikSettings()})
	subnet, gateway := control.ingressAddressCandidate(nil)
	if subnet != "10.0.0.0/24" || gateway != "10.0.0.1" {
		t.Fatalf("empty cluster candidate = %s / %s, want Docker default", subnet, gateway)
	}
	taken := []dockerapi.Network{{Name: "existing"}}
	taken[0].IPAM.Config = append(taken[0].IPAM.Config, struct {
		Gateway string `json:"Gateway"`
		Subnet  string `json:"Subnet"`
	}{Subnet: "10.0.0.0/16"})
	subnet, gateway = control.ingressAddressCandidate(taken)
	if subnet != "10.255.0.0/24" || gateway != "10.255.0.1" {
		t.Fatalf("candidate with default taken = %s / %s, want the first free alternate", subnet, gateway)
	}
}
