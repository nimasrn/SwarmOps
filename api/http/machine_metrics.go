package apihttp

import (
	"context"
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/nimasrn/SwarmOps/internal/agentcontrol"
	"github.com/nimasrn/SwarmOps/internal/domain"
	"github.com/nimasrn/SwarmOps/internal/ops"
	"github.com/nimasrn/SwarmOps/internal/remote"
)

// Machine metrics: measured by the agent, rendered here.
//
// Prometheus cannot scrape the agents. They hold no inbound port by design —
// that property is the reason enrolment needs no firewall change and survives
// a host behind NAT — so the only path to their measurements is the outbound
// channel they already hold open to this process. Core therefore terminates
// the scrape: one endpoint per machine, and Prometheus discovers them from the
// same service-discovery document that already carries the applications.
//
// Core also renders the exposition. The agent sends typed numbers
// (agentcontrol.MachineMetrics), which are sanitized before a byte of this
// output is produced, so no metric name and no label in the cluster's
// Prometheus was ever chosen by a machine agent.

const (
	// A scrape at 15s that always waited for a round trip would put the
	// interval at the mercy of the slowest agent. A sample younger than this
	// is served from cache; an older one is refreshed.
	machineMetricsFresh = 10 * time.Second
	// Beyond this a cached sample is not served at all: a stale reading with
	// no age beside it is the thing this product must never draw.
	machineMetricsMaxAge = 2 * time.Minute
	machineMetricsBudget = 12 * time.Second
)

// MachineMeter is the agent's measurement surface. It is deliberately separate
// from HostInspector and Provisioner: an agent too old to measure containers
// still reports its host snapshot and still accepts readiness operations, and
// the console can say which of the three it has rather than showing an empty
// machine.
type MachineMeter interface {
	Metrics(context.Context) (agentcontrol.MachineMetrics, error)
}

type machineSample struct {
	metrics   agentcontrol.MachineMetrics
	fetchedAt time.Time
	err       error
}

// machineMetricsCache collapses concurrent scrapes of the same machine into
// one agent round trip and keeps the last good sample. Prometheus retries on
// its own schedule; a slow agent must not queue requests behind itself.
type machineMetricsCache struct {
	mu       sync.Mutex
	samples  map[string]*machineSample
	inFlight map[string]chan struct{}
}

func newMachineMetricsCache() *machineMetricsCache {
	return &machineMetricsCache{samples: map[string]*machineSample{}, inFlight: map[string]chan struct{}{}}
}

func (c *machineMetricsCache) get(ctx context.Context, id string, now time.Time, fetch func(context.Context) (agentcontrol.MachineMetrics, error)) (agentcontrol.MachineMetrics, time.Time, error) {
	for {
		c.mu.Lock()
		if sample, found := c.samples[id]; found && now.Sub(sample.fetchedAt) < machineMetricsFresh {
			c.mu.Unlock()
			return sample.metrics, sample.fetchedAt, sample.err
		}
		if wait, running := c.inFlight[id]; running {
			c.mu.Unlock()
			select {
			case <-wait:
				now = time.Now().UTC()
				continue
			case <-ctx.Done():
				return agentcontrol.MachineMetrics{}, time.Time{}, ctx.Err()
			}
		}
		done := make(chan struct{})
		c.inFlight[id] = done
		c.mu.Unlock()

		metrics, err := fetch(ctx)
		fetchedAt := time.Now().UTC()
		if err == nil {
			metrics.Sanitize(fetchedAt)
		}
		c.mu.Lock()
		// A failed refresh does not discard the previous good sample; it is
		// returned with its real age so the scrape shows a gap rather than a
		// lie, and the machine's own page can say when it was last measured.
		if err != nil {
			if previous, found := c.samples[id]; found && previous.err == nil {
				c.samples[id] = &machineSample{metrics: previous.metrics, fetchedAt: previous.fetchedAt, err: err}
			} else {
				c.samples[id] = &machineSample{fetchedAt: fetchedAt, err: err}
			}
		} else {
			c.samples[id] = &machineSample{metrics: metrics, fetchedAt: fetchedAt}
		}
		sample := c.samples[id]
		delete(c.inFlight, id)
		c.mu.Unlock()
		close(done)
		return sample.metrics, sample.fetchedAt, sample.err
	}
}

func (c *machineMetricsCache) forget(id string) {
	c.mu.Lock()
	delete(c.samples, id)
	c.mu.Unlock()
}

// machineMetrics serves one machine's exposition. It sits under /metrics with
// the discovery document, so the same edge rule that keeps those off the
// public hostname keeps this off it too.
func (s *Server) machineMetrics(response http.ResponseWriter, request *http.Request) {
	id := request.PathValue("id")
	server, found := savedServerProfile(s.servers.List(), id)
	if !found {
		http.Error(response, "machine was not found", http.StatusNotFound)
		return
	}
	target, err := s.targets.Resolve(id)
	if err != nil || target.Meter == nil {
		http.Error(response, "machine is not reporting metrics", http.StatusServiceUnavailable)
		return
	}

	ctx, cancel := context.WithTimeout(request.Context(), machineMetricsBudget)
	defer cancel()
	metrics, fetchedAt, fetchErr := s.machineSamples.get(ctx, id, time.Now().UTC(), target.Meter.Metrics)
	now := time.Now().UTC()
	if fetchErr != nil && metrics.CollectedAt.IsZero() {
		s.logger.Warn("machine metrics sample failed", "server_id", id, "error", fetchErr)
		http.Error(response, "machine metrics are unavailable", http.StatusServiceUnavailable)
		return
	}
	if now.Sub(fetchedAt) > machineMetricsMaxAge {
		http.Error(response, "machine metrics are stale", http.StatusServiceUnavailable)
		return
	}

	response.Header().Set("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
	_, _ = response.Write([]byte(renderMachineMetrics(server, metrics, fetchedAt, now, s.namespace)))
}

/* ── Exposition ─────────────────────────────────────────────────────────
   Every name below is chosen here and is stable. Label values come from the
   sanitized document, whose patterns already exclude the quote, backslash and
   newline that could break the format; escapeLabel is belt to that braces. */

type expositionBuilder struct {
	out     strings.Builder
	emitted map[string]bool
}

func (b *expositionBuilder) metric(name, kind, help string) {
	if b.emitted == nil {
		b.emitted = map[string]bool{}
	}
	if b.emitted[name] {
		return
	}
	b.emitted[name] = true
	fmt.Fprintf(&b.out, "# HELP %s %s\n# TYPE %s %s\n", name, help, name, kind)
}

func (b *expositionBuilder) sample(name, labels string, value float64) {
	if labels != "" {
		fmt.Fprintf(&b.out, "%s{%s} %s\n", name, labels, formatValue(value))
		return
	}
	fmt.Fprintf(&b.out, "%s %s\n", name, formatValue(value))
}

func formatValue(value float64) string {
	return strconv.FormatFloat(value, 'g', -1, 64)
}

func escapeLabel(value string) string {
	replacer := strings.NewReplacer(`\`, `\\`, `"`, `\"`, "\n", `\n`)
	return replacer.Replace(value)
}

func labelPairs(pairs ...string) string {
	var out []string
	for index := 0; index+1 < len(pairs); index += 2 {
		if pairs[index+1] == "" {
			continue
		}
		out = append(out, fmt.Sprintf("%s=%q", pairs[index], escapeLabel(pairs[index+1])))
	}
	return strings.Join(out, ",")
}

// renderMachineMetrics turns one sanitized sample into the exposition.
//
// A ratio the agent could not measure arrives as -1 and is OMITTED rather than
// exported: a gap in the series reads as "not measured", while a -1 would draw
// as negative CPU and a 0 would draw as an idle host. Those are three
// different claims and only one of them is true.
func renderMachineMetrics(server domain.Server, metrics agentcontrol.MachineMetrics, fetchedAt, now time.Time, namespace string) string {
	machine := labelPairs("machine", server.ID, "node", server.Name)
	builder := &expositionBuilder{}

	builder.metric("swarmops_machine_up", "gauge", "1 when the machine answered its last measurement.")
	builder.sample("swarmops_machine_up", machine, 1)

	builder.metric("swarmops_machine_sample_age_seconds", "gauge", "Age of this sample when it was served.")
	builder.sample("swarmops_machine_sample_age_seconds", machine, now.Sub(fetchedAt).Seconds())

	builder.metric("swarmops_machine_docker_available", "gauge", "1 when Docker is running on the machine.")
	builder.sample("swarmops_machine_docker_available", machine, boolValue(metrics.DockerAvailable))

	host := metrics.Host
	builder.metric("swarmops_machine_cpu_cores", "gauge", "Logical CPUs on the machine.")
	builder.sample("swarmops_machine_cpu_cores", machine, float64(host.CPUCores))

	for _, ratio := range []struct {
		name, help string
		value      float64
	}{
		{"swarmops_machine_cpu_used_ratio", "Busy fraction of CPU capacity, excluding iowait.", host.CPUUsedRatio},
		{"swarmops_machine_cpu_iowait_ratio", "Fraction of CPU time spent waiting on storage.", host.CPUIOWaitRatio},
		{"swarmops_machine_cpu_steal_ratio", "Fraction of CPU time taken by the hypervisor.", host.CPUStealRatio},
	} {
		if ratio.value < 0 {
			continue
		}
		builder.metric(ratio.name, "gauge", ratio.help)
		builder.sample(ratio.name, machine, ratio.value)
	}

	for _, gauge := range []struct {
		name, help string
		value      float64
	}{
		{"swarmops_machine_load1", "One-minute load average.", host.Load1},
		{"swarmops_machine_load5", "Five-minute load average.", host.Load5},
		{"swarmops_machine_load15", "Fifteen-minute load average.", host.Load15},
		{"swarmops_machine_memory_total_bytes", "Installed memory.", float64(host.MemoryTotal)},
		{"swarmops_machine_memory_available_bytes", "Memory available without swapping.", float64(host.MemoryAvailable)},
		{"swarmops_machine_memory_used_bytes", "Memory in use.", float64(host.MemoryUsed)},
		{"swarmops_machine_swap_total_bytes", "Configured swap.", float64(host.SwapTotal)},
		{"swarmops_machine_swap_used_bytes", "Swap in use.", float64(host.SwapUsed)},
		{"swarmops_machine_uptime_seconds", "Seconds since the machine booted.", float64(host.UptimeSeconds)},
		{"swarmops_machine_processes", "Processes on the machine.", float64(host.ProcessCount)},
	} {
		builder.metric(gauge.name, "gauge", gauge.help)
		builder.sample(gauge.name, machine, gauge.value)
	}

	for _, filesystem := range host.Filesystems {
		labels := machine + "," + labelPairs("mount", filesystem.Mount, "device", filesystem.Device, "fstype", filesystem.FSType)
		builder.metric("swarmops_machine_filesystem_total_bytes", "gauge", "Size of a mounted filesystem.")
		builder.sample("swarmops_machine_filesystem_total_bytes", labels, float64(filesystem.TotalBytes))
		builder.metric("swarmops_machine_filesystem_available_bytes", "gauge", "Space available to an unprivileged writer.")
		builder.sample("swarmops_machine_filesystem_available_bytes", labels, float64(filesystem.AvailableBytes))
		builder.metric("swarmops_machine_filesystem_used_bytes", "gauge", "Space in use on a mounted filesystem.")
		builder.sample("swarmops_machine_filesystem_used_bytes", labels, float64(filesystem.UsedBytes))
	}

	for _, device := range host.Interfaces {
		labels := machine + "," + labelPairs("device", device.Name)
		for _, counter := range []struct {
			name, help string
			value      uint64
		}{
			{"swarmops_machine_network_receive_bytes_total", "Bytes received since boot.", device.ReceivedBytes},
			{"swarmops_machine_network_transmit_bytes_total", "Bytes sent since boot.", device.SentBytes},
			{"swarmops_machine_network_receive_errors_total", "Receive errors since boot.", device.ReceiveErrors},
			{"swarmops_machine_network_transmit_errors_total", "Send errors since boot.", device.SendErrors},
			{"swarmops_machine_network_receive_dropped_total", "Received packets dropped since boot.", device.ReceiveDropped},
			{"swarmops_machine_network_transmit_dropped_total", "Sent packets dropped since boot.", device.SendDropped},
		} {
			builder.metric(counter.name, "counter", counter.help)
			builder.sample(counter.name, labels, float64(counter.value))
		}
	}

	for _, disk := range host.Disks {
		labels := machine + "," + labelPairs("device", disk.Device)
		for _, counter := range []struct {
			name, help string
			value      uint64
		}{
			{"swarmops_machine_disk_read_bytes_total", "Bytes read from a disk since boot.", disk.ReadBytes},
			{"swarmops_machine_disk_write_bytes_total", "Bytes written to a disk since boot.", disk.WriteBytes},
			{"swarmops_machine_disk_read_ops_total", "Completed reads since boot.", disk.ReadOps},
			{"swarmops_machine_disk_write_ops_total", "Completed writes since boot.", disk.WriteOps},
		} {
			builder.metric(counter.name, "counter", counter.help)
			builder.sample(counter.name, labels, float64(counter.value))
		}
	}

	builder.metric("swarmops_machine_containers", "gauge", "Containers measured on the machine.")
	builder.sample("swarmops_machine_containers", machine, float64(len(metrics.Containers)))
	if metrics.ContainersTruncated {
		builder.metric("swarmops_machine_containers_truncated", "gauge", "1 when the machine has more containers than one sample carries.")
		builder.sample("swarmops_machine_containers_truncated", machine, 1)
	}

	for _, container := range metrics.Containers {
		labels := machine + "," + labelPairs(
			"container", container.ID,
			"name", container.Name,
			"image", container.Image,
			"state", container.State,
			"service", container.Service,
			"stack", container.Stack,
			"application", applicationOfStack(container.Stack, namespace),
			"task_slot", container.TaskSlot,
		)
		builder.metric("swarmops_container_up", "gauge", "1 for a container present at measurement time.")
		builder.sample("swarmops_container_up", labels, 1)

		if container.CPUUsedRatio >= 0 {
			builder.metric("swarmops_container_cpu_used_ratio", "gauge", "Share of the whole machine's CPU capacity used by a container.")
			builder.sample("swarmops_container_cpu_used_ratio", labels, container.CPUUsedRatio)
		}
		builder.metric("swarmops_container_cpu_usage_seconds_total", "counter", "CPU seconds consumed by a container since it started.")
		builder.sample("swarmops_container_cpu_usage_seconds_total", labels, container.CPUUsageSeconds)

		for _, gauge := range []struct {
			name, help string
			value      float64
		}{
			{"swarmops_container_memory_used_bytes", "Container memory in use, excluding reclaimable page cache.", float64(container.MemoryUsed)},
			{"swarmops_container_memory_limit_bytes", "Container memory limit, or the machine's memory when unlimited.", float64(container.MemoryLimit)},
			{"swarmops_container_memory_cache_bytes", "Reclaimable page cache attributed to a container.", float64(container.MemoryCache)},
			{"swarmops_container_processes", "Processes inside a container.", float64(container.Processes)},
		} {
			builder.metric(gauge.name, "gauge", gauge.help)
			builder.sample(gauge.name, labels, gauge.value)
		}

		for _, counter := range []struct {
			name, help string
			value      uint64
		}{
			{"swarmops_container_network_receive_bytes_total", "Bytes received by a container since it started.", container.ReceivedBytes},
			{"swarmops_container_network_transmit_bytes_total", "Bytes sent by a container since it started.", container.SentBytes},
			{"swarmops_container_block_read_bytes_total", "Bytes read from storage by a container since it started.", container.BlockReadBytes},
			{"swarmops_container_block_write_bytes_total", "Bytes written to storage by a container since it started.", container.BlockWriteBytes},
		} {
			builder.metric(counter.name, "counter", counter.help)
			builder.sample(counter.name, labels, float64(counter.value))
		}

		builder.metric("swarmops_container_restarts_total", "counter", "Times a container has been restarted.")
		builder.sample("swarmops_container_restarts_total", labels, float64(container.RestartCount))
		if !container.StartedAt.IsZero() {
			builder.metric("swarmops_container_start_time_seconds", "gauge", "Unix time a container started.")
			builder.sample("swarmops_container_start_time_seconds", labels, float64(container.StartedAt.Unix()))
		}
	}
	return builder.out.String()
}

func boolValue(value bool) float64 {
	if value {
		return 1
	}
	return 0
}

// applicationOfStack recovers the application name from Docker's stack label.
// Core owns this mapping — an application's stack is namespace-prefixed, and
// the agent has no reason to be told the namespace.
func applicationOfStack(stack, namespace string) string {
	if stack == "" || namespace == "" {
		return ""
	}
	name, found := strings.CutPrefix(stack, namespace+"-")
	if !found {
		return ""
	}
	return name
}

// machineMetricsTargets is the discovery entry for every machine that can be
// measured. The target is Core's own internal alias, because Core terminates
// these scrapes; __metrics_path__ carries the machine.
func machineMetricsTargets(servers []domain.Server) []ops.MetricsTarget {
	targets := make([]ops.MetricsTarget, 0, len(servers))
	for _, server := range servers {
		if server.ConnectionType != remote.ConnectionAgentAPI && server.ConnectionType != remote.ConnectionAgentPull {
			continue
		}
		if server.ConnectionState != remote.ConnectionConnected {
			continue
		}
		targets = append(targets, ops.MetricsTarget{
			Labels: map[string]string{
				"__metrics_path__": "/metrics/machines/" + server.ID,
				"__scheme__":       "http",
				"job":              "swarmops-machine",
				"machine":          server.ID,
				"node":             server.Name,
			},
			Targets: []string{controlPlaneInternalTarget},
		})
	}
	sort.Slice(targets, func(left, right int) bool {
		return targets[left].Labels["__metrics_path__"] < targets[right].Labels["__metrics_path__"]
	})
	return targets
}

// The reviewed internal Traefik alias for this controller. It is the same one
// the routing control plane publishes and the same one prometheus.yml already
// scrapes for the API's own metrics.
const controlPlaneInternalTarget = "swarmops-control.swarmops.internal:8081"
