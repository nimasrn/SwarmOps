// Package mobility defines the closed set of durable SwarmOps resources that
// may be handed over between enrolled hosts. It deliberately contains no
// browser-supplied Compose, volume, service, or filesystem names.
package mobility

import (
	"fmt"
	"sort"
	"strings"
)

const (
	ResourceControlPlane = "control_plane"
	ResourceMongo        = "mongo"
	ResourcePostgres     = "postgres"
	ResourceRedis        = "redis"
	ResourceMonitoring   = "monitoring"
)

// Component is one local-volume-backed service in a handover. A resource can
// contain several components, but every component is still stopped, copied,
// moved, and health-checked independently so a source volume is never deleted
// while its service might still be writing to it.
type Component struct {
	DisplayName string `json:"displayName"`
	Service     string `json:"service"`
	Volume      string `json:"volume"`
}

// ResourceDefinition is a reviewed migration target. RequiredNodeLabel is
// checked against the live Swarm node before any service is stopped. The
// control plane additionally requires a manager because its service does.
type ResourceDefinition struct {
	Components        []Component `json:"components"`
	DisplayName       string      `json:"displayName"`
	RequireManager    bool        `json:"requireManager"`
	RequiredNodeLabel string      `json:"requiredNodeLabel"`
	Resource          string      `json:"resource"`
}

var catalog = []ResourceDefinition{
	{
		Resource:          ResourceControlPlane,
		DisplayName:       "SwarmOps control plane",
		RequireManager:    true,
		RequiredNodeLabel: "nim.control",
		Components: []Component{{
			DisplayName: "SwarmOps API and sealed controller state",
			Service:     "swarmops_api",
			Volume:      "swarmops_swarmops_data",
		}},
	},
	{
		Resource:          ResourceMongo,
		DisplayName:       "Managed MongoDB",
		RequiredNodeLabel: "nim.stateful",
		Components: []Component{{
			DisplayName: "MongoDB data",
			Service:     "swarmops-mongo_mongo",
			Volume:      "swarmops-mongo_swarmops_mongo_data",
		}},
	},
	{
		Resource:          ResourcePostgres,
		DisplayName:       "Managed PostgreSQL",
		RequiredNodeLabel: "nim.stateful",
		Components: []Component{{
			DisplayName: "PostgreSQL data",
			Service:     "swarmops-postgres_postgres",
			Volume:      "swarmops-postgres_swarmops_postgres_data",
		}},
	},
	{
		Resource:          ResourceRedis,
		DisplayName:       "Managed Redis",
		RequiredNodeLabel: "nim.stateful",
		Components: []Component{{
			DisplayName: "Redis append-only data",
			Service:     "swarmops-redis_redis",
			Volume:      "swarmops-redis_swarmops_redis_data",
		}},
	},
	{
		Resource:          ResourceMonitoring,
		DisplayName:       "Monitoring and retained telemetry",
		RequiredNodeLabel: "nim.stateful",
		Components: []Component{
			{DisplayName: "Prometheus data", Service: "swarmops-observability_prometheus", Volume: "swarmops-observability_swarmops_prometheus"},
			{DisplayName: "Alertmanager state", Service: "swarmops-observability_alertmanager", Volume: "swarmops-observability_swarmops_alertmanager"},
			{DisplayName: "Grafana state", Service: "swarmops-observability_grafana", Volume: "swarmops-observability_swarmops_grafana"},
			{DisplayName: "Jaeger state", Service: "swarmops-observability_jaeger", Volume: "swarmops-observability_swarmops_jaeger"},
			{DisplayName: "Loki data", Service: "swarmops-logs_loki", Volume: "swarmops-logs_swarmops_loki"},
		},
	},
}

// Resources returns a copy so callers cannot alter the fixed migration
// vocabulary at runtime.
func Resources() []ResourceDefinition {
	resources := make([]ResourceDefinition, len(catalog))
	for index, resource := range catalog {
		resources[index] = cloneResource(resource)
	}
	sort.Slice(resources, func(left, right int) bool { return resources[left].Resource < resources[right].Resource })
	return resources
}

// ResourceFor returns one fixed migration resource.
func ResourceFor(value string) (ResourceDefinition, error) {
	value = strings.TrimSpace(value)
	for _, resource := range catalog {
		if resource.Resource == value {
			return cloneResource(resource), nil
		}
	}
	return ResourceDefinition{}, fmt.Errorf("unsupported movable resource %q", value)
}

// ComponentForService prevents the machine agent from becoming a general
// service-placement API. It accepts only services belonging to reviewed
// SwarmOps durability resources.
func ComponentForService(service string) (Component, bool) {
	for _, resource := range catalog {
		for _, component := range resource.Components {
			if component.Service == strings.TrimSpace(service) {
				return component, true
			}
		}
	}
	return Component{}, false
}

// IsManagedVolume reports whether a volume may ever cross the machine-agent
// transfer endpoint. This is intentionally tighter than a prefix check.
func IsManagedVolume(volume string) bool {
	for _, resource := range catalog {
		for _, component := range resource.Components {
			if component.Volume == strings.TrimSpace(volume) {
				return true
			}
		}
	}
	return false
}

func cloneResource(resource ResourceDefinition) ResourceDefinition {
	resource.Components = append([]Component(nil), resource.Components...)
	return resource
}
