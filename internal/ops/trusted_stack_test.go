package ops

import (
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

func TestRenderTrustedStackResolvesOnlyConfiguredValues(t *testing.T) {
	t.Parallel()
	source := []byte(`version: "3.9"
services:
  agent:
    image: ${REGISTRY:-ghcr.io}/${REGISTRY_NS:-nimasrn}/swarmops-agent:${TAG:?set TAG}
  exporter:
    image: ${NODE_EXPORTER_IMAGE:-prom/node-exporter:v1.12.1}
secrets:
  token:
    external: true
    name: ${SWARMOPS_AGENT_TOKEN_SECRET:-swarmops_agent_token_v1}
`)
	rendered, err := RenderTrustedStack("swarmops-agent", source, testTrustedStackSettings())
	if err != nil {
		t.Fatal(err)
	}
	text := string(rendered)
	if strings.Contains(text, "${") || !strings.Contains(text, "registry.example.com:5000/platform/swarmops-agent:2026.08.23") || !strings.Contains(text, "prom/node-exporter:v1.12.1") {
		t.Fatalf("trusted stack was not rendered safely: %s", text)
	}
}

func TestRenderTrustedStackRejectsUnknownTemplate(t *testing.T) {
	t.Parallel()
	_, err := RenderTrustedStack("swarmops-logs", []byte("services:\n  loki:\n    image: ${UNTRUSTED}\n"), testTrustedStackSettings())
	if err == nil || !strings.Contains(err.Error(), "unresolved") {
		t.Fatalf("unknown template error = %v", err)
	}
}

func TestCheckedInTrustedStackAssetsRenderWithoutRemoteEnvironment(t *testing.T) {
	t.Parallel()
	_, sourceFile, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("locate trusted stack test source")
	}
	repoRoot := filepath.Clean(filepath.Join(filepath.Dir(sourceFile), "../.."))
	for stack, file := range map[string]string{
		"swarmops-agent":         "swarmops-agent.yml",
		"swarmops-logs":          "swarmops-logs.yml",
		"swarmops-observability": "swarmops-observability.yml",
	} {
		source, err := os.ReadFile(filepath.Join(repoRoot, "deploy", "stacks", file))
		if err != nil {
			t.Fatalf("read %s: %v", file, err)
		}
		rendered, err := RenderTrustedStack(stack, source, testTrustedStackSettings())
		if err != nil {
			t.Fatalf("render %s: %v", stack, err)
		}
		if strings.Contains(string(rendered), "${") {
			t.Fatalf("rendered %s retains a template expression", stack)
		}
	}
}

func TestObservabilityStackHasNoGrafanaServiceOrPublicRoute(t *testing.T) {
	t.Parallel()
	_, sourceFile, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("locate trusted stack test source")
	}
	repoRoot := filepath.Clean(filepath.Join(filepath.Dir(sourceFile), "../.."))
	source, err := os.ReadFile(filepath.Join(repoRoot, "deploy", "stacks", "swarmops-observability.yml"))
	if err != nil {
		t.Fatal(err)
	}
	text := string(source)
	for _, forbidden := range []string{"\n  grafana:", "GRAFANA_", "swarmops_grafana", "traefik.http.routers.grafana"} {
		if strings.Contains(text, forbidden) {
			t.Fatalf("observability stack retains Grafana integration %q", forbidden)
		}
	}
	for _, required := range []string{"\n  prometheus:", "\n  alertmanager:", "\n  jaeger:"} {
		if !strings.Contains(text, required) {
			t.Fatalf("observability stack is missing internal service %q", required)
		}
	}
}

func testTrustedStackSettings() TrustedStackSettings {
	return TrustedStackSettings{
		AgentTokenSecret:           "swarmops_agent_token_v1",
		AlertmanagerConfigName:     "swarmops_alertmanager_config_v1",
		AlertmanagerImage:          "prom/alertmanager:v0.33.1",
		FluentAggregatorConfigName: "swarmops_fluentd_aggregator_v1",
		FluentForwarderConfigName:  "swarmops_fluentd_forwarder_v1",
		JaegerConfigName:           "swarmops_jaeger_config_v1",
		JaegerImage:                "jaegertracing/jaeger:2.20.0",
		NodeExporterImage:          "prom/node-exporter:v1.12.1",
		PrometheusConfigName:       "swarmops_prometheus_config_v1",
		PrometheusImage:            "prom/prometheus:v3.14.0",
		PrometheusRetention:        "15d",
		PrometheusRulesConfigName:  "swarmops_prometheus_rules_v1",
		Registry:                   "registry.example.com:5000",
		RegistryNamespace:          "platform",
		Tag:                        "2026.08.23",
	}
}
