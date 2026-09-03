package ops

import (
	"fmt"
	"sort"
)

// MetricsTarget is one entry of Prometheus' HTTP service-discovery format.
//
// Auto-discovery is the reason this exists. Prometheus cannot enumerate Swarm
// services without the Docker socket, and regenerating its scrape config for
// every deployment would mean a new config object and a stack redeploy each
// time. Instead Prometheus polls this endpoint on the internal overlay and
// picks up an application the moment SwarmOps records it. Nothing here is
// secret: it is service DNS names, ports, and paths.
type MetricsTarget struct {
	Labels  map[string]string `json:"labels"`
	Targets []string          `json:"targets"`
}

// MetricsTargets renders the discovery document for every stored application
// that publishes metrics. The target is the service's typed Traefik alias;
// Prometheus never joins an application overlay or reaches a backend directly.
func (c *ControlPlane) MetricsTargets() []MetricsTarget {
	namespace := ""
	if c.admission() != nil {
		namespace = c.admission().Namespace()
	}
	return MetricsTargetsFor(c.Apps, namespace)
}

// MetricsTargetsFor is the same rendering without a connected server. The
// discovery endpoint must answer even when no machine API is currently
// connected, because Prometheus polls it continuously.
func MetricsTargetsFor(apps *ApplicationStore, namespace string) []MetricsTarget {
	specs := apps.List()
	targets := make([]MetricsTarget, 0, len(specs))
	for _, spec := range specs {
		if !spec.Metrics {
			continue
		}
		service := spec.ServiceDNSName(namespace)
		route := applicationRouteSpec(spec, spec.StackName(namespace))
		targets = append(targets, MetricsTarget{
			Labels: map[string]string{
				"__metrics_path__": spec.MetricsPath,
				"__scheme__":       "http",
				"application":      spec.Name,
				"job":              "swarmops-application",
				"namespace":        namespace,
				"swarm_service":    service,
			},
			Targets: []string{fmt.Sprintf("%s.swarmops.internal:8081", route.Key)},
		})
	}
	sort.Slice(targets, func(left, right int) bool { return targets[left].Targets[0] < targets[right].Targets[0] })
	return targets
}
