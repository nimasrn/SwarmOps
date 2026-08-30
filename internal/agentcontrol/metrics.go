package agentcontrol

import (
	"math"
	"regexp"
	"sort"
	"strings"
	"time"
)

// Machine metrics are a TYPED document, not a Prometheus exposition.
//
// The agent measures; Core renders. That split exists because the exposition
// format is a text protocol whose metric names and label values are structural:
// a compromised or simply buggy agent that returned text directly would be
// able to introduce metric families, overwrite another node's series, or break
// the whole scrape with one unescaped byte. Everything below crosses the
// trust boundary as numbers with a known meaning, is bounded by Sanitize
// before it is believed, and is rendered by Core into names Core chose.
//
// The same rule that keeps raw Docker output out of the command ledger keeps
// raw agent text out of the metrics pipeline.

const (
	// A host with more than this many containers reports the busiest ones and
	// says it truncated. The cap bounds one scrape response, not the host.
	MaxMetricContainers = 400
	MaxMetricMounts     = 64
	MaxMetricInterfaces = 32
	MaxMetricDisks      = 32
)

var (
	metricNamePattern = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9 ._:/@+-]{0,127}$`)
	// A mount point and a block-device path both begin with a slash, which the
	// name pattern above deliberately does not allow — an absolute path is its
	// own shape, and giving it its own pattern is what keeps every filesystem
	// from being dropped as unnameable.
	metricPathPattern   = regexp.MustCompile(`^/(?:[A-Za-z0-9 ._@+:-]+(?:/[A-Za-z0-9 ._@+:-]+)*)?$`)
	metricDevicePattern = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._:/-]{0,63}$`)
	metricIDPattern     = regexp.MustCompile(`^[a-f0-9]{12,64}$`)
)

// MachineMetrics is one sample of a host and every container on it. Counter
// fields are monotonic since boot or since container start; Prometheus derives
// rates from them, so the agent never computes a rate the controller cannot
// check.
type MachineMetrics struct {
	CollectedAt         time.Time          `json:"collectedAt"`
	Host                HostMetrics        `json:"host"`
	Containers          []ContainerMetrics `json:"containers"`
	ContainersTruncated bool               `json:"containersTruncated,omitempty"`
	// DockerAvailable distinguishes "no containers are running" from "this
	// host has no Docker yet", which the console must never average together.
	DockerAvailable bool `json:"dockerAvailable"`
}

type HostMetrics struct {
	CPUCores int `json:"cpuCores"`
	// CPUUsedRatio is the busy fraction over the interval between this sample
	// and the previous one, in 0..1. It is absent (-1) on the first sample of
	// a process, because one reading of a counter is not a rate.
	CPUUsedRatio    float64             `json:"cpuUsedRatio"`
	CPUIOWaitRatio  float64             `json:"cpuIoWaitRatio"`
	CPUStealRatio   float64             `json:"cpuStealRatio"`
	Load1           float64             `json:"load1"`
	Load5           float64             `json:"load5"`
	Load15          float64             `json:"load15"`
	MemoryTotal     uint64              `json:"memoryTotalBytes"`
	MemoryAvailable uint64              `json:"memoryAvailableBytes"`
	MemoryUsed      uint64              `json:"memoryUsedBytes"`
	SwapTotal       uint64              `json:"swapTotalBytes"`
	SwapUsed        uint64              `json:"swapUsedBytes"`
	UptimeSeconds   uint64              `json:"uptimeSeconds"`
	ProcessCount    uint64              `json:"processCount,omitempty"`
	Filesystems     []FilesystemMetrics `json:"filesystems,omitempty"`
	Interfaces      []InterfaceMetrics  `json:"interfaces,omitempty"`
	Disks           []DiskMetrics       `json:"disks,omitempty"`
}

type FilesystemMetrics struct {
	Mount          string `json:"mount"`
	Device         string `json:"device,omitempty"`
	FSType         string `json:"fstype,omitempty"`
	TotalBytes     uint64 `json:"totalBytes"`
	AvailableBytes uint64 `json:"availableBytes"`
	UsedBytes      uint64 `json:"usedBytes"`
}

type InterfaceMetrics struct {
	Name            string `json:"name"`
	ReceivedBytes   uint64 `json:"receivedBytes"`
	SentBytes       uint64 `json:"sentBytes"`
	ReceivedPackets uint64 `json:"receivedPackets,omitempty"`
	SentPackets     uint64 `json:"sentPackets,omitempty"`
	ReceiveErrors   uint64 `json:"receiveErrors,omitempty"`
	SendErrors      uint64 `json:"sendErrors,omitempty"`
	ReceiveDropped  uint64 `json:"receiveDropped,omitempty"`
	SendDropped     uint64 `json:"sendDropped,omitempty"`
}

type DiskMetrics struct {
	Device     string `json:"device"`
	ReadBytes  uint64 `json:"readBytes"`
	WriteBytes uint64 `json:"writeBytes"`
	ReadOps    uint64 `json:"readOps,omitempty"`
	WriteOps   uint64 `json:"writeOps,omitempty"`
}

// ContainerMetrics carries no environment value, no command, and no mount
// path. It identifies a container by the names an operator already sees in the
// console and measures it; nothing here is a new disclosure.
type ContainerMetrics struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Image string `json:"image,omitempty"`
	State string `json:"state,omitempty"`
	// Service, Stack, Application and TaskSlot come from Docker's own labels.
	// They exist so a query can group containers the way an operator thinks
	// about them rather than by container id.
	Service     string `json:"service,omitempty"`
	Stack       string `json:"stack,omitempty"`
	Application string `json:"application,omitempty"`
	TaskSlot    string `json:"taskSlot,omitempty"`

	CPUUsedRatio    float64   `json:"cpuUsedRatio"`
	CPUUsageSeconds float64   `json:"cpuUsageSeconds"`
	MemoryUsed      uint64    `json:"memoryUsedBytes"`
	MemoryLimit     uint64    `json:"memoryLimitBytes"`
	MemoryCache     uint64    `json:"memoryCacheBytes,omitempty"`
	ReceivedBytes   uint64    `json:"receivedBytes"`
	SentBytes       uint64    `json:"sentBytes"`
	BlockReadBytes  uint64    `json:"blockReadBytes"`
	BlockWriteBytes uint64    `json:"blockWriteBytes"`
	Processes       uint64    `json:"processes,omitempty"`
	RestartCount    int       `json:"restartCount"`
	StartedAt       time.Time `json:"startedAt,omitempty"`
}

// Sanitize makes a received document safe to render and to believe. It is
// called by Core on every sample, never by the agent on its own output: the
// point is that Core does not trust what arrived, whatever produced it.
//
// It clamps rather than rejects wherever a single bad field would otherwise
// cost the whole host its metrics — a machine with one unreadable filesystem
// should still report its CPU.
func (m *MachineMetrics) Sanitize(now time.Time) {
	if m.CollectedAt.IsZero() || m.CollectedAt.After(now.Add(time.Minute)) {
		m.CollectedAt = now.UTC()
	}
	m.CollectedAt = m.CollectedAt.UTC()

	m.Host.CPUCores = clampInt(m.Host.CPUCores, 0, 4096)
	m.Host.CPUUsedRatio = clampRatio(m.Host.CPUUsedRatio)
	m.Host.CPUIOWaitRatio = clampRatio(m.Host.CPUIOWaitRatio)
	m.Host.CPUStealRatio = clampRatio(m.Host.CPUStealRatio)
	m.Host.Load1 = clampFloat(m.Host.Load1, 0, 100000)
	m.Host.Load5 = clampFloat(m.Host.Load5, 0, 100000)
	m.Host.Load15 = clampFloat(m.Host.Load15, 0, 100000)

	m.Host.Filesystems = sanitizeSlice(m.Host.Filesystems, MaxMetricMounts, func(f *FilesystemMetrics) bool {
		f.Mount = trimPath(f.Mount)
		f.Device = trimPath(f.Device)
		f.FSType = trimDevice(f.FSType)
		return f.Mount != ""
	})
	m.Host.Interfaces = sanitizeSlice(m.Host.Interfaces, MaxMetricInterfaces, func(i *InterfaceMetrics) bool {
		i.Name = trimDevice(i.Name)
		return i.Name != ""
	})
	m.Host.Disks = sanitizeSlice(m.Host.Disks, MaxMetricDisks, func(d *DiskMetrics) bool {
		d.Device = trimDevice(d.Device)
		return d.Device != ""
	})

	m.Containers = sanitizeSlice(m.Containers, MaxMetricContainers, func(c *ContainerMetrics) bool {
		c.ID = strings.ToLower(strings.TrimSpace(c.ID))
		if !metricIDPattern.MatchString(c.ID) {
			return false
		}
		if len(c.ID) > 12 {
			c.ID = c.ID[:12]
		}
		c.Name = trimName(strings.TrimPrefix(c.Name, "/"))
		if c.Name == "" {
			return false
		}
		c.Image = trimName(c.Image)
		c.State = trimDevice(c.State)
		c.Service = trimName(c.Service)
		c.Stack = trimName(c.Stack)
		c.Application = trimName(c.Application)
		c.TaskSlot = trimDevice(c.TaskSlot)
		c.CPUUsedRatio = clampRatio(c.CPUUsedRatio)
		c.CPUUsageSeconds = clampFloat(c.CPUUsageSeconds, 0, math.MaxUint32)
		c.RestartCount = clampInt(c.RestartCount, 0, 1<<20)
		if !c.StartedAt.IsZero() {
			c.StartedAt = c.StartedAt.UTC()
		}
		return true
	})
	if len(m.Containers) == MaxMetricContainers {
		m.ContainersTruncated = true
	}
	sort.Slice(m.Containers, func(left, right int) bool { return m.Containers[left].Name < m.Containers[right].Name })
}

// Stale reports whether a sample is too old to present as current. A reading
// with no age beside it is the thing this product must never draw.
func (m MachineMetrics) Stale(now time.Time, window time.Duration) bool {
	return m.CollectedAt.IsZero() || now.Sub(m.CollectedAt) > window
}

func sanitizeSlice[T any](values []T, limit int, keep func(*T) bool) []T {
	if len(values) == 0 {
		return nil
	}
	out := values[:0]
	for index := range values {
		if len(out) >= limit {
			break
		}
		if keep(&values[index]) {
			out = append(out, values[index])
		}
	}
	if len(out) == 0 {
		return nil
	}
	return out
}

func trimName(value string) string {
	value = strings.TrimSpace(value)
	if value == "" || !metricNamePattern.MatchString(value) {
		return ""
	}
	return value
}

// trimPath accepts an absolute path and nothing else. Length is bounded here
// rather than in the pattern so a long path is refused, not truncated into a
// different path.
func trimPath(value string) string {
	value = strings.TrimSpace(value)
	if value == "" || len(value) > 256 || !metricPathPattern.MatchString(value) {
		return ""
	}
	return value
}

func trimDevice(value string) string {
	value = strings.TrimSpace(value)
	if value == "" || !metricDevicePattern.MatchString(value) {
		return ""
	}
	return value
}

// clampRatio keeps a fraction inside 0..1 and turns "unknown" into -1 rather
// than 0: a host whose first sample cannot produce a rate has not been idle.
func clampRatio(value float64) float64 {
	if math.IsNaN(value) || math.IsInf(value, 0) || value < 0 {
		return -1
	}
	if value > 1 {
		return 1
	}
	return value
}

func clampFloat(value, low, high float64) float64 {
	if math.IsNaN(value) || math.IsInf(value, 0) || value < low {
		return low
	}
	if value > high {
		return high
	}
	return value
}

func clampInt(value, low, high int) int {
	if value < low {
		return low
	}
	if value > high {
		return high
	}
	return value
}
