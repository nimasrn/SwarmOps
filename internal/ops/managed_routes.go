package ops

import (
	"context"
	"fmt"
	"sort"

	"github.com/nimasrn/SwarmOps/internal/agentcontrol"

	"gopkg.in/yaml.v3"
)

const (
	platformSwarmOpsMetricsRoute = "platform-swarmops-metrics"
	platformTraefikMetricsRoute  = "platform-traefik-metrics"
)

func managedDatabaseRoute(definition DatabaseDefinition) RouteSpec {
	return RouteSpec{
		AccessLogs: false,
		Enabled:    false,
		Health:     RouteHealthProof{Kind: "handshake", TimeoutSeconds: 5},
		Key:        defaultRouteKey(definition.Service),
		ListenPort: definition.Port,
		Managed:    true,
		Metrics:    true,
		Protocol:   RouteTCP,
		Scope:      RouteInternal,
		ServiceKey: definition.Service,
		TLS:        RouteTLSOff,
		TargetPort: definition.TargetPort,
		Version:    RoutingSchemaVersion,
	}.Normalize()
}

func trustedStackRouteTemplates(stack string) (map[string]RouteSpec, error) {
	switch stack {
	case "swarmops-observability":
		return map[string]RouteSpec{
			"prometheus":   internalHTTPRoute("swarmops-prometheus", "swarmops-observability_prometheus", 9090),
			"alertmanager": internalHTTPRoute("swarmops-alertmanager", "swarmops-observability_alertmanager", 9093),
			"jaeger":       internalHTTPRoute("swarmops-jaeger-otlp", "swarmops-observability_jaeger", 4318),
		}, nil
	case "swarmops-logs":
		query := internalHTTPRoute("swarmops-fluentd-query", "swarmops-logs_query", 8085)
		query.Health.Path = "/healthz"
		return map[string]RouteSpec{
			"aggregator": internalTCPRoute("swarmops-fluentd-forward", "swarmops-logs_aggregator", 10024, 24224),
			"query":      query,
		}, nil
	default:
		return nil, fmt.Errorf("trusted stack has no managed route templates")
	}
}

func internalTCPRoute(key, serviceKey string, listen, target uint16) RouteSpec {
	return RouteSpec{Enabled: false, Health: RouteHealthProof{Kind: "handshake", TimeoutSeconds: 5}, Key: key, ListenPort: listen, Managed: true, Metrics: true, Protocol: RouteTCP, Scope: RouteInternal, ServiceKey: serviceKey, TLS: RouteTLSOff, TargetPort: target, Version: RoutingSchemaVersion}.Normalize()
}

func internalHTTPRoute(key, serviceKey string, target uint16) RouteSpec {
	return RouteSpec{
		AccessLogs: true,
		Enabled:    false,
		Health:     RouteHealthProof{Kind: "response", Path: "/", TimeoutSeconds: 5},
		Key:        key,
		Managed:    true,
		Match:      RouteMatch{Hosts: []string{key + ".swarmops.internal"}, PathPrefix: "/"},
		Metrics:    true,
		Protocol:   RouteHTTP,
		Scope:      RouteInternal,
		ServiceKey: serviceKey,
		TLS:        RouteTLSOff,
		TargetPort: target,
		Version:    RoutingSchemaVersion,
	}.Normalize()
}

// renderManagedRouteTemplates makes each routed service use its own external,
// encrypted overlay and permanently carries the disabled approved labels.
// Dependencies are installed as typed Traefik aliases on the caller overlay,
// so preserving any shared application/data overlay would create a bypass.
// Runtime reconciliation changes only the values in the owned label set.
func renderManagedRouteTemplates(source []byte, routes map[string]RouteSpec) ([]byte, error) {
	var document map[string]any
	if err := yaml.Unmarshal(source, &document); err != nil {
		return nil, fmt.Errorf("read managed route template: %w", err)
	}
	services, ok := document["services"].(map[string]any)
	if !ok || len(services) == 0 {
		return nil, fmt.Errorf("managed route template has no services")
	}
	networks := map[string]any{}
	for serviceName, route := range routes {
		rawService, found := services[serviceName]
		if !found {
			return nil, fmt.Errorf("managed route template service %q was not found", serviceName)
		}
		service, ok := rawService.(map[string]any)
		if !ok {
			return nil, fmt.Errorf("managed route template service %q is invalid", serviceName)
		}
		route.Enabled = false
		network := RouteNetworkName(route.ServiceKey)
		labels, err := RenderRouteLabels(route, network)
		if err != nil {
			return nil, err
		}
		logicalNetwork := "route-" + serviceName
		service["networks"] = []string{logicalNetwork}
		deploy, _ := service["deploy"].(map[string]any)
		if deploy == nil {
			deploy = map[string]any{}
		}
		deploy["labels"] = labels
		service["deploy"] = deploy
		services[serviceName] = service
		networks[logicalNetwork] = map[string]any{"external": true, "name": network}
	}
	document["services"] = services
	document["networks"] = networks
	rendered, err := yaml.Marshal(document)
	if err != nil {
		return nil, fmt.Errorf("render managed route template: %w", err)
	}
	return rendered, nil
}

func (c *ControlPlane) prepareManagedRouteNetworks(ctx context.Context, routes map[string]RouteSpec) error {
	if err := c.requireRouting(); err != nil {
		return err
	}
	adapter, err := c.traefikMachineAdapter()
	if err != nil {
		return err
	}
	services, err := c.Docker.ListServices(ctx)
	if err != nil {
		return err
	}
	traefikID := ""
	for _, service := range services {
		if service.Spec.Name == traefikServiceName {
			traefikID = service.ID
			break
		}
	}
	if traefikID == "" {
		return fmt.Errorf("Traefik singleton service was not found")
	}
	keys := make([]string, 0, len(routes))
	for key := range routes {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	for _, key := range keys {
		route := routes[key]
		if err := adapter.PrepareRoutingNetwork(ctx, agentcontrol.RoutingNetworkRequest{Network: RouteNetworkName(route.ServiceKey), TraefikServiceID: traefikID, Version: agentcontrol.RoutingVersion}); err != nil {
			return err
		}
	}
	return nil
}

func (c *ControlPlane) activateManagedRoutes(ctx context.Context, routes map[string]RouteSpec, clientOnly map[string]bool) error {
	keys := make([]string, 0, len(routes))
	for key := range routes {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	for _, key := range keys {
		route := routes[key].Normalize()
		if clientOnly[key] {
			route.Enabled = false
			if err := c.Routing.PutRoute(c.ServerID, route); err != nil {
				return err
			}
			if err := c.Routing.PutDeclaration(c.ServerID, ServiceRouteDeclaration{Reason: "The service only originates routed traffic and has no enabled inbound listener.", Role: ServiceRoleClientOnly, ServiceKey: route.ServiceKey, Version: RoutingSchemaVersion}); err != nil {
				return err
			}
			continue
		}
		route.Enabled = true
		plan, err := c.PlanRoute(ctx, route)
		if err == nil {
			err = c.applyRoutePlan(ctx, plan)
		}
		if err != nil {
			return err
		}
		if err := c.Routing.PutDeclaration(c.ServerID, ServiceRouteDeclaration{Role: ServiceRoleRouted, ServiceKey: route.ServiceKey, Version: RoutingSchemaVersion}); err != nil {
			return err
		}
	}
	return nil
}

func managedRoutesByService(routes map[string]RouteSpec) map[string]RouteSpec {
	result := make(map[string]RouteSpec, len(routes))
	for _, route := range routes {
		result[route.ServiceKey] = route
	}
	return result
}
