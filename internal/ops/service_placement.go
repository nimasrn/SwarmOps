package ops

import (
	"context"
	"fmt"
	"strings"
)

// Trusted services the console reads THROUGH an agent rather than over the
// cluster network. Both listen only on the node they are placed on, so the
// query has to run from that node's agent.
const (
	LogQueryServiceName   = "swarmops-logs_query"
	PrometheusServiceName = "swarmops-observability_prometheus"
)

// ServiceHostname reports the host running a live replica of the named Swarm
// service.
//
// The console needs this because the log query service and Prometheus are
// deliberately not reachable across the cluster: neither publishes an ingress
// port, and Traefik's internal-http entrypoint is never published to a host.
// An agent can therefore reach them only over loopback, on the one node the
// replica is placed on — so the controller has to know which node that is
// before it chooses whose agent to ask.
func (c *ControlPlane) ServiceHostname(ctx context.Context, name string) (string, error) {
	if c.Docker == nil {
		return "", fmt.Errorf("selected server has no Docker access")
	}
	services, err := c.Docker.ListServices(ctx)
	if err != nil {
		return "", err
	}
	serviceID := ""
	for _, service := range services {
		if service.Spec.Name == name {
			serviceID = service.ID
			break
		}
	}
	if serviceID == "" {
		return "", fmt.Errorf("service %q is not deployed", name)
	}
	tasks, err := c.Docker.ListTasks(ctx, map[string][]string{"service": {serviceID}})
	if err != nil {
		return "", err
	}
	nodeID := ""
	for _, task := range tasks {
		if !strings.EqualFold(task.Status.State, "running") || !strings.EqualFold(task.DesiredState, "running") {
			continue
		}
		nodeID = task.NodeID
		break
	}
	if nodeID == "" {
		return "", fmt.Errorf("service %q has no running task", name)
	}
	nodes, err := c.Docker.ListNodes(ctx)
	if err != nil {
		return "", err
	}
	for _, node := range nodes {
		if node.ID == nodeID {
			hostname := strings.TrimSpace(node.Description.Hostname)
			if hostname == "" {
				return "", fmt.Errorf("node %q reports no hostname", nodeID)
			}
			return hostname, nil
		}
	}
	return "", fmt.Errorf("node %q is not in this cluster", nodeID)
}
