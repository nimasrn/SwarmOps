package ops

import (
	"context"
	"sort"
	"strings"
	"time"

	"github.com/nimasrn/SwarmOps/internal/dockerapi"
	"github.com/nimasrn/SwarmOps/internal/domain"
)

// Inventory is the read side of the full Docker and Swarm surface. Every call
// here is a projection of what the Engine already reports; nothing in this file
// mutates the cluster, and the projections carry no secret material.

const maxEventWindow = 24 * time.Hour

func (c *ControlPlane) Containers(ctx context.Context, all bool) ([]dockerapi.Container, error) {
	containers, err := c.Docker.ListContainers(ctx, all)
	if err != nil {
		return nil, err
	}
	sort.Slice(containers, func(left, right int) bool {
		return containerName(containers[left]) < containerName(containers[right])
	})
	return containers, nil
}

func (c *ControlPlane) Container(ctx context.Context, id string) (dockerapi.ContainerDetail, error) {
	return c.Docker.InspectContainer(ctx, id)
}

// ContainerStats reduces one Engine sample to the figures the console shows.
// The CPU percentage needs the delta the Engine already carries in the sample,
// so a single non-streaming read is enough.
func (c *ControlPlane) ContainerStats(ctx context.Context, id string) (domain.ContainerStats, error) {
	sample, err := c.Docker.ContainerStats(ctx, id)
	if err != nil {
		return domain.ContainerStats{}, err
	}
	stats := domain.ContainerStats{
		ID:          id,
		MemoryLimit: sample.MemoryStats.Limit,
		PidsCurrent: sample.PidsStats.Current,
		SampledAt:   c.now().UTC(),
	}
	// The Engine reports cache as part of usage; docker stats subtracts it so
	// the figure matches what an operator sees on the host.
	stats.MemoryUsed = sample.MemoryStats.Usage
	if cache := sample.MemoryStats.Stats.InactiveFile; cache > 0 && cache < stats.MemoryUsed {
		stats.MemoryUsed -= cache
	} else if cache := sample.MemoryStats.Stats.Cache; cache > 0 && cache < stats.MemoryUsed {
		stats.MemoryUsed -= cache
	}
	if stats.MemoryLimit > 0 {
		stats.MemoryPercent = percentage(stats.MemoryUsed, stats.MemoryLimit)
	}
	cpuDelta := float64(sample.CPUStats.CPUUsage.TotalUsage) - float64(sample.PreCPUStats.CPUUsage.TotalUsage)
	systemDelta := float64(sample.CPUStats.SystemCPUUsage) - float64(sample.PreCPUStats.SystemCPUUsage)
	cores := float64(sample.CPUStats.OnlineCPUs)
	if cores == 0 {
		cores = 1
	}
	if cpuDelta > 0 && systemDelta > 0 {
		stats.CPUPercent = round2(cpuDelta / systemDelta * cores * 100)
	}
	for _, network := range sample.Networks {
		stats.NetworkRxBytes += network.RxBytes
		stats.NetworkTxBytes += network.TxBytes
	}
	for _, entry := range sample.BlkioStats.IOServiceBytesRecursive {
		switch strings.ToLower(entry.Op) {
		case "read":
			stats.BlockReadBytes += entry.Value
		case "write":
			stats.BlockWriteBytes += entry.Value
		}
	}
	return stats, nil
}

func (c *ControlPlane) Images(ctx context.Context) ([]dockerapi.Image, error) {
	images, err := c.Docker.ListImages(ctx)
	if err != nil {
		return nil, err
	}
	sort.Slice(images, func(left, right int) bool { return images[left].Size > images[right].Size })
	return images, nil
}

func (c *ControlPlane) Image(ctx context.Context, id string) (dockerapi.ImageDetail, error) {
	return c.Docker.InspectImage(ctx, id)
}

func (c *ControlPlane) Volumes(ctx context.Context) ([]dockerapi.Volume, error) {
	volumes, err := c.Docker.ListVolumes(ctx)
	if err != nil {
		return nil, err
	}
	sort.Slice(volumes, func(left, right int) bool { return volumes[left].Name < volumes[right].Name })
	return volumes, nil
}

func (c *ControlPlane) Volume(ctx context.Context, name string) (dockerapi.Volume, error) {
	return c.Docker.InspectVolume(ctx, name)
}

func (c *ControlPlane) Networks(ctx context.Context) ([]dockerapi.Network, error) {
	networks, err := c.Docker.ListNetworks(ctx)
	if err != nil {
		return nil, err
	}
	sort.Slice(networks, func(left, right int) bool { return networks[left].Name < networks[right].Name })
	return networks, nil
}

func (c *ControlPlane) Network(ctx context.Context, id string) (dockerapi.NetworkDetail, error) {
	return c.Docker.InspectNetwork(ctx, id)
}

// Secrets and Configs return metadata only. A secret value is unreadable from
// the Engine by design, and a config payload is operator material that the
// console has no reason to display.
func (c *ControlPlane) Secrets(ctx context.Context) ([]dockerapi.SwarmObjectMeta, error) {
	return sortedMeta(c.Docker.ListSecrets(ctx))
}

func (c *ControlPlane) Configs(ctx context.Context) ([]dockerapi.SwarmObjectMeta, error) {
	return sortedMeta(c.Docker.ListConfigs(ctx))
}

func (c *ControlPlane) ServiceDetail(ctx context.Context, id string) (dockerapi.Service, error) {
	return c.Docker.InspectService(ctx, id)
}

func (c *ControlPlane) Task(ctx context.Context, id string) (domain.Task, error) {
	raw, err := c.Docker.InspectTask(ctx, id)
	if err != nil {
		return domain.Task{}, err
	}
	return fromDockerTask(raw), nil
}

// Swarm reports the cluster object without its join tokens; the Docker client
// does not model them, so no read path can return one.
func (c *ControlPlane) Swarm(ctx context.Context) (dockerapi.SwarmObject, error) {
	return c.Docker.InspectSwarm(ctx)
}

func (c *ControlPlane) DiskUsage(ctx context.Context) (dockerapi.DiskUsage, error) {
	return c.Docker.DiskUsage(ctx)
}

// Events reads a bounded window of the Engine event log, newest first.
func (c *ControlPlane) Events(ctx context.Context, window time.Duration) ([]dockerapi.Event, error) {
	if window <= 0 || window > maxEventWindow {
		window = time.Hour
	}
	until := c.now().UTC()
	events, err := c.Docker.Events(ctx, until.Add(-window).Unix(), until.Unix())
	if err != nil {
		return nil, err
	}
	sort.Slice(events, func(left, right int) bool { return events[left].TimeNano > events[right].TimeNano })
	return events, nil
}

// Insights is the one call the console's overview screen needs: the counts,
// reclaimable space, and pressure signals that Docker reports across every
// resource, computed once instead of assembled in the browser.
func (c *ControlPlane) Insights(ctx context.Context) (domain.Insights, error) {
	insights := domain.Insights{GeneratedAt: c.now().UTC()}
	nodes, err := c.Nodes(ctx)
	if err != nil {
		return domain.Insights{}, err
	}
	services, err := c.Services(ctx)
	if err != nil {
		return domain.Insights{}, err
	}
	insights.Nodes.Total = len(nodes)
	for _, node := range nodes {
		if node.Role == "manager" {
			insights.Nodes.Managers++
		}
		if node.State == "ready" {
			insights.Nodes.Ready++
		}
		if node.Availability != "active" {
			insights.Nodes.Unavailable++
		}
		insights.Capacity.CPUCores += node.CPU.Capacity
		insights.Capacity.MemoryBytes += node.Memory.Capacity
		insights.Capacity.DiskBytes += node.Disk.Capacity
		insights.Capacity.DiskUsedBytes += node.Disk.Used
	}
	insights.Services.Total = len(services)
	for _, service := range services {
		insights.Services.RunningTasks += service.RunningTasks
		insights.Services.DesiredTasks += service.DesiredTasks
		switch service.Health {
		case domain.HealthDegraded:
			insights.Services.Degraded++
		case domain.HealthUnhealthy:
			insights.Services.Unhealthy++
		}
	}
	containers, err := c.Docker.ListContainers(ctx, true)
	if err == nil {
		for _, container := range containers {
			insights.Containers.Total++
			switch container.State {
			case "running":
				insights.Containers.Running++
			case "exited", "dead":
				insights.Containers.Stopped++
			case "paused":
				insights.Containers.Paused++
			}
			if strings.Contains(strings.ToLower(container.Status), "unhealthy") {
				insights.Containers.Unhealthy++
			}
		}
	}
	usage, err := c.Docker.DiskUsage(ctx)
	if err == nil {
		insights.Storage.LayersBytes = usage.LayersSize
		insights.Storage.Images = len(usage.Images)
		for _, image := range usage.Images {
			insights.Storage.ImageBytes += image.Size
			if image.Containers == 0 {
				insights.Storage.ReclaimableImageBytes += image.Size
				insights.Storage.UnusedImages++
			}
		}
		insights.Storage.Volumes = len(usage.Volumes)
		for _, volume := range usage.Volumes {
			if volume.UsageData == nil {
				continue
			}
			if volume.UsageData.Size > 0 {
				insights.Storage.VolumeBytes += volume.UsageData.Size
			}
			if volume.UsageData.RefCount == 0 {
				insights.Storage.UnusedVolumes++
				if volume.UsageData.Size > 0 {
					insights.Storage.ReclaimableVolumeBytes += volume.UsageData.Size
				}
			}
		}
		for _, entry := range usage.BuildCache {
			insights.Storage.BuildCacheBytes += entry.Size
			if !entry.InUse {
				insights.Storage.ReclaimableBuildCacheBytes += entry.Size
			}
		}
		for _, container := range usage.Containers {
			insights.Storage.ContainerWritableBytes += container.SizeRw
		}
	}
	networks, err := c.Docker.ListNetworks(ctx)
	if err == nil {
		insights.Networks.Total = len(networks)
		for _, network := range networks {
			if network.Driver == "overlay" {
				insights.Networks.Overlay++
			}
			if network.Ingress {
				insights.Networks.Ingress++
			}
		}
	}
	if secrets, err := c.Docker.ListSecrets(ctx); err == nil {
		insights.Secrets = len(secrets)
	}
	if configs, err := c.Docker.ListConfigs(ctx); err == nil {
		insights.Configs = len(configs)
	}
	if swarm, err := c.Docker.InspectSwarm(ctx); err == nil {
		insights.Swarm.ID = swarm.ID
		insights.Swarm.AutoLockManagers = swarm.Spec.EncryptionConfig.AutoLockManagers
		insights.Swarm.CreatedAt = swarm.CreatedAt
		insights.Swarm.TaskHistoryLimit = swarm.Spec.Orchestration.TaskHistoryRetentionLimit
	}
	if tasks, err := c.Docker.ListTasks(ctx, nil); err == nil {
		for _, task := range tasks {
			if task.Status.State == "failed" || task.Status.State == "rejected" {
				insights.Tasks.Failed++
			}
			if task.DesiredState == "running" {
				insights.Tasks.Desired++
			}
			insights.Tasks.Total++
		}
	}
	return insights, nil
}

func sortedMeta(items []dockerapi.SwarmObjectMeta, err error) ([]dockerapi.SwarmObjectMeta, error) {
	if err != nil {
		return nil, err
	}
	sort.Slice(items, func(left, right int) bool { return items[left].Spec.Name < items[right].Spec.Name })
	return items, nil
}

func containerName(container dockerapi.Container) string {
	if len(container.Names) == 0 {
		return container.ID
	}
	return strings.TrimPrefix(container.Names[0], "/")
}

func percentage(used, total uint64) float64 {
	if total == 0 {
		return 0
	}
	return round2(float64(used) / float64(total) * 100)
}

func round2(value float64) float64 {
	return float64(int64(value*100+0.5)) / 100
}
