package ops

import (
	"strings"
	"testing"

	"gopkg.in/yaml.v3"
)

func TestRenderManagedRouteTemplatesReplacesSharedOverlaysWithPerServiceRoutes(t *testing.T) {
	rendered, err := renderManagedRouteTemplates([]byte(`version: "3.9"
services:
  prometheus:
    image: prom/prometheus:v3.14.0
    networks: [swarmops]
  alertmanager:
    image: prom/alertmanager:v0.33.1
    networks: [swarmops]
networks:
  swarmops: {external: true, name: swarmops}
`), map[string]RouteSpec{
		"prometheus":   internalHTTPRoute("swarmops-prometheus", "swarmops-observability_prometheus", 9090),
		"alertmanager": internalHTTPRoute("swarmops-alertmanager", "swarmops-observability_alertmanager", 9093),
	})
	if err != nil {
		t.Fatal(err)
	}
	var document struct {
		Networks map[string]any `yaml:"networks"`
		Services map[string]struct {
			Networks []string `yaml:"networks"`
			Deploy   struct {
				Labels map[string]string `yaml:"labels"`
			} `yaml:"deploy"`
		} `yaml:"services"`
	}
	if err := yaml.Unmarshal(rendered, &document); err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{"route-prometheus", "route-alertmanager"} {
		if document.Networks[name] == nil {
			t.Fatalf("network %q is missing: %#v", name, document.Networks)
		}
	}
	if len(document.Networks) != 2 || len(document.Services["prometheus"].Networks) != 1 || document.Services["prometheus"].Networks[0] != "route-prometheus" || len(document.Services["alertmanager"].Networks) != 1 || document.Services["alertmanager"].Networks[0] != "route-alertmanager" {
		t.Fatalf("services still share an overlay: %#v", document)
	}
	for _, service := range []string{"prometheus", "alertmanager"} {
		labels := document.Services[service].Deploy.Labels
		if labels["traefik.enable"] != "false" || labels["swarmops.routing.labels"] == "" {
			t.Fatalf("%s has no permanent disabled route template: %#v", service, labels)
		}
	}
	if !strings.Contains(string(rendered), RouteNetworkName("swarmops-observability_prometheus")) {
		t.Fatalf("dedicated route network missing from rendered template:\n%s", rendered)
	}
}
