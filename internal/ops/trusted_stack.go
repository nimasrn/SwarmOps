package ops

import (
	"fmt"
	"regexp"
	"sort"
	"strings"
)

// TrustedStackSettings contains the public image, hostname, and immutable
// Swarm resource names required to render a server-owned optional stack before
// it crosses the machine API. It deliberately has no browser-controlled values or secret
// material. Keeping these values in the API environment prevents Docker on a
// selected remote manager from interpreting templates using its own shell
// environment.
type TrustedStackSettings struct {
	AgentTokenSecret           string
	AlertmanagerConfigName     string
	AlertmanagerImage          string
	FluentAggregatorConfigName string
	FluentForwarderConfigName  string
	JaegerConfigName           string
	JaegerImage                string
	NodeExporterImage          string
	PrometheusConfigName       string
	PrometheusImage            string
	PrometheusRetention        string
	PrometheusRulesConfigName  string
	Registry                   string
	RegistryNamespace          string
	Tag                        string
}

var (
	trustedNamespacePattern = regexp.MustCompile(`^[a-z0-9][a-z0-9_.-]{0,127}$`)
	trustedRegistryPattern  = regexp.MustCompile(`^[a-z0-9][a-z0-9.-]*(?::[0-9]{1,5})?$`)
	trustedRetentionPattern = regexp.MustCompile(`^[1-9][0-9]*(ms|s|m|h|d|w|y)$`)
	trustedTagPattern       = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$`)
)

// RenderTrustedStack replaces only the documented templates in one
// server-owned optional stack. It is intentionally not a general Compose
// templating engine: an unknown expression fails closed rather than being
// evaluated by a remote manager.
func RenderTrustedStack(stack string, source []byte, settings TrustedStackSettings) ([]byte, error) {
	values, err := settings.templateValues(stack)
	if err != nil {
		return nil, err
	}
	keys := make([]string, 0, len(values))
	for key := range values {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	replacements := make([]string, 0, len(keys)*2)
	for _, key := range keys {
		replacements = append(replacements, key, values[key])
	}
	rendered := strings.NewReplacer(replacements...).Replace(string(source))
	if strings.Contains(rendered, "${") {
		return nil, fmt.Errorf("trusted %s stack has an unresolved template expression", stack)
	}
	if stack == "swarmops-observability" || stack == "swarmops-logs" {
		routes, err := trustedStackRouteTemplates(stack)
		if err != nil {
			return nil, err
		}
		return renderManagedRouteTemplates([]byte(rendered), routes)
	}
	return []byte(rendered), nil
}

func (s TrustedStackSettings) templateValues(stack string) (map[string]string, error) {
	switch stack {
	case "swarmops-agent":
		if err := s.validateAgent(); err != nil {
			return nil, err
		}
		return map[string]string{
			"${REGISTRY:-ghcr.io}":                                    s.Registry,
			"${REGISTRY_NS:-nimasrn}":                                 s.RegistryNamespace,
			"${TAG:?set TAG}":                                         s.Tag,
			"${NODE_EXPORTER_IMAGE:-prom/node-exporter:v1.12.1}":      s.NodeExporterImage,
			"${SWARMOPS_AGENT_TOKEN_SECRET:-swarmops_agent_token_v1}": s.AgentTokenSecret,
		}, nil
	case "swarmops-logs":
		if err := s.validateLogs(); err != nil {
			return nil, err
		}
		return map[string]string{
			"${REGISTRY:-ghcr.io}":    s.Registry,
			"${REGISTRY_NS:-nimasrn}": s.RegistryNamespace,
			"${TAG:?set TAG}":         s.Tag,
			"${SWARMOPS_FLUENTD_AGGREGATOR_CONFIG_NAME:-swarmops_fluentd_aggregator_v1}": s.FluentAggregatorConfigName,
			"${SWARMOPS_FLUENTD_FORWARDER_CONFIG_NAME:-swarmops_fluentd_forwarder_v1}":   s.FluentForwarderConfigName,
		}, nil
	case "swarmops-observability":
		if err := s.validateObservability(); err != nil {
			return nil, err
		}
		return map[string]string{
			"${PROMETHEUS_IMAGE:-prom/prometheus:v3.14.0}":                           s.PrometheusImage,
			"${PROMETHEUS_RETENTION:-15d}":                                           s.PrometheusRetention,
			"${ALERTMANAGER_IMAGE:-prom/alertmanager:v0.33.1}":                       s.AlertmanagerImage,
			"${JAEGER_IMAGE:-jaegertracing/jaeger:2.20.0}":                           s.JaegerImage,
			"${SWARMOPS_PROMETHEUS_CONFIG_NAME:-swarmops_prometheus_config_v1}":      s.PrometheusConfigName,
			"${SWARMOPS_PROMETHEUS_RULES_CONFIG_NAME:-swarmops_prometheus_rules_v1}": s.PrometheusRulesConfigName,
			"${SWARMOPS_ALERTMANAGER_CONFIG_NAME:-swarmops_alertmanager_config_v1}":  s.AlertmanagerConfigName,
			"${SWARMOPS_JAEGER_CONFIG_NAME:-swarmops_jaeger_config_v1}":              s.JaegerConfigName,
		}, nil
	default:
		return nil, fmt.Errorf("unsupported trusted stack %q", stack)
	}
}

func (s TrustedStackSettings) validateAgent() error {
	if !trustedRegistryPattern.MatchString(s.Registry) || !trustedNamespacePattern.MatchString(s.RegistryNamespace) || !trustedTagPattern.MatchString(s.Tag) {
		return fmt.Errorf("trusted agent image registry, namespace, or tag is invalid")
	}
	if err := validateImage(s.Registry + "/" + s.RegistryNamespace + "/swarmops-agent:" + s.Tag); err != nil {
		return fmt.Errorf("trusted agent image: %w", err)
	}
	if err := validateImage(s.NodeExporterImage); err != nil {
		return fmt.Errorf("node-exporter image: %w", err)
	}
	return validateTrustedNames(map[string]string{"agent token secret": s.AgentTokenSecret})
}

func (s TrustedStackSettings) validateLogs() error {
	if !trustedRegistryPattern.MatchString(s.Registry) || !trustedNamespacePattern.MatchString(s.RegistryNamespace) || !trustedTagPattern.MatchString(s.Tag) {
		return fmt.Errorf("trusted Fluentd image registry, namespace, or tag is invalid")
	}
	for _, image := range []string{s.Registry + "/" + s.RegistryNamespace + "/swarmops-fluentd:" + s.Tag, s.Registry + "/" + s.RegistryNamespace + "/swarmops-logs:" + s.Tag} {
		if err := validateImage(image); err != nil {
			return fmt.Errorf("trusted logs image: %w", err)
		}
	}
	return validateTrustedNames(map[string]string{"Fluentd aggregator config": s.FluentAggregatorConfigName, "Fluentd forwarder config": s.FluentForwarderConfigName})
}

func (s TrustedStackSettings) validateObservability() error {
	for label, image := range map[string]string{
		"Alertmanager image": s.AlertmanagerImage,
		"Jaeger image":       s.JaegerImage,
		"Prometheus image":   s.PrometheusImage,
	} {
		if err := validateImage(image); err != nil {
			return fmt.Errorf("%s: %w", label, err)
		}
	}
	if !trustedRetentionPattern.MatchString(s.PrometheusRetention) {
		return fmt.Errorf("Prometheus retention is invalid")
	}
	return validateTrustedNames(map[string]string{
		"Alertmanager config":     s.AlertmanagerConfigName,
		"Jaeger config":           s.JaegerConfigName,
		"Prometheus config":       s.PrometheusConfigName,
		"Prometheus rules config": s.PrometheusRulesConfigName,
	})
}

func validateTrustedNames(values map[string]string) error {
	for label, value := range values {
		if !dockerReferenceName.MatchString(strings.TrimSpace(value)) {
			return fmt.Errorf("%s name is invalid", label)
		}
	}
	return nil
}
