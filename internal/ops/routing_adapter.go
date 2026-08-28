package ops

import (
	"context"

	"github.com/nimasrn/SwarmOps/internal/agentcontrol"
)

// TraefikMachineAdapter is implemented by the pinned machine-agent transport.
// Every method maps to one fixed endpoint; it is not a generic Docker, HTTP,
// Fluentd-query or Prometheus proxy.
type TraefikMachineAdapter interface {
	BindRouting(context.Context, agentcontrol.RoutingBindingRequest) error
	PrometheusTraefik(context.Context) (agentcontrol.PrometheusSnapshot, error)
	PrepareRoutingNetwork(context.Context, agentcontrol.RoutingNetworkRequest) error
	ReconcileRouting(context.Context, agentcontrol.RoutingReconcileRequest) error
	TraefikLogs(context.Context, agentcontrol.TraefikLogQuery) ([]agentcontrol.TraefikLogEntry, error)
	Logs(context.Context, agentcontrol.LogQuery) (agentcontrol.LogPage, error)
	LogsStatus(context.Context) (agentcontrol.LogStatus, error)
	TraefikRuntime(context.Context) (agentcontrol.TraefikRuntimeSnapshot, error)
}

func routeAgentContract(route RouteSpec) agentcontrol.RoutingRoute {
	route = route.Normalize()
	return agentcontrol.RoutingRoute{
		AccessLogs: route.AccessLogs,
		Enabled:    route.Enabled,
		Hosts:      append([]string(nil), route.Match.Hosts...),
		Key:        route.Key,
		ListenPort: route.ListenPort,
		Metrics:    route.Metrics,
		PathPrefix: route.Match.PathPrefix,
		Protocol:   string(route.Protocol),
		Resolver:   route.Resolver,
		Scope:      string(route.Scope),
		SNI:        append([]string(nil), route.Match.SNI...),
		TargetPort: route.TargetPort,
		TLS:        string(route.TLS),
	}
}
