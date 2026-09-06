package apihttp

import (
	"context"
	"strings"

	"github.com/nimasrn/SwarmOps/internal/domain"
	"github.com/nimasrn/SwarmOps/internal/ops"
)

// serviceHostTarget returns the target whose agent runs on the node hosting a
// trusted service, falling back to the selected target when that cannot be
// determined.
//
// The log query service and Prometheus bind to loopback on their own node.
// Neither publishes an ingress port, and Traefik's internal-http entrypoint is
// never published to a host, so a host-native agent on any OTHER node has no
// path to them at all. Asking the console's currently selected machine — which
// is whichever server the operator happens to be looking at — is what made
// every log and every chart read fail on a cluster whose stateful node was not
// the selected one.
//
// The fallback is deliberate rather than an error: on a single-node cluster,
// and whenever the operator is already on the hosting node, the selected
// target IS the right one, and a cluster with no such service deployed should
// still reach the handler's own "not collected" answer rather than a routing
// failure.
func (s *Server) serviceHostTarget(ctx context.Context, control *ops.ControlPlane, base Target, service string) Target {
	if control == nil {
		return base
	}
	hostname, err := control.ServiceHostname(ctx, service)
	if err != nil || strings.TrimSpace(hostname) == "" {
		return base
	}
	for _, profile := range s.servers.List() {
		if !serverIsHost(profile, hostname) {
			continue
		}
		target, err := s.targets.Resolve(profile.ID)
		if err != nil {
			// Resolve is the authority on whether a server is connected. A
			// stale profile for the hosting node must not stop a second,
			// live enrollment of the same host from being tried.
			continue
		}
		return target
	}
	return base
}

// logsHostTarget and metricsHostTarget name the two reads that must run on the
// node holding the data, so the routing rule is stated once per subsystem
// rather than repeated at each handler.
func (s *Server) logsHostTarget(ctx context.Context, base Target) Target {
	target := s.serviceHostTarget(ctx, base.Control, base, ops.LogQueryServiceName)
	if target.Control == nil {
		return base
	}
	return target
}

// metricsHostTarget takes the placement control separately because a metric
// read is addressed to a MACHINE, and a worker with no Swarm control cannot
// answer "which node runs Prometheus?" about its own cluster. The selected
// cluster manager answers that; the reading itself is then run from whichever
// node the answer names.
func (s *Server) metricsHostTarget(ctx context.Context, control *ops.ControlPlane, base Target) Target {
	target := s.serviceHostTarget(ctx, control, base, ops.PrometheusServiceName)
	if target.Metrics == nil {
		return base
	}
	return target
}

// serverIsHost matches an enrolled server against a Swarm node hostname.
//
// Swarm reports the node's own hostname; an enrollment may carry that same
// name, a fully qualified form of it, or an operator-chosen label with the
// host recorded separately. Both are compared, and only on the leading label,
// so `db-1` and `db-1.internal.example.com` are recognised as one host.
func serverIsHost(profile domain.Server, hostname string) bool {
	want := leadingLabel(hostname)
	if want == "" {
		return false
	}
	return leadingLabel(profile.Name) == want || leadingLabel(profile.Host) == want
}

func leadingLabel(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	if index := strings.Index(value, "."); index >= 0 {
		value = value[:index]
	}
	return value
}
