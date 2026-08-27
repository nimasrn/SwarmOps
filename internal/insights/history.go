// Package insights keeps a short, in-memory series of cluster readings so the
// console can draw a trend rather than a single instant. It holds no operator
// data: every field is a count or a byte total already visible on the
// dashboard, and nothing here is persisted across an API restart.
package insights

import (
	"sync"
	"time"

	"github.com/nimasrn/SwarmOps/internal/domain"
)

// DefaultLimit is four hours at the one-minute sampling interval. A longer
// window belongs in Prometheus, which SwarmOps already deploys; this series
// exists so the console has a shape beside every number without requiring a
// query language.
const DefaultLimit = 240

// Sample is one reading. It is deliberately flat and numeric so the console
// can chart any field without knowing its meaning.
type Sample struct {
	At                  time.Time `json:"at"`
	BuildCacheBytes     int64     `json:"buildCacheBytes"`
	ContainersRunning   int       `json:"containersRunning"`
	ContainersStopped   int       `json:"containersStopped"`
	ContainersTotal     int       `json:"containersTotal"`
	ContainersUnhealthy int       `json:"containersUnhealthy"`
	DiskCapacityBytes   uint64    `json:"diskCapacityBytes"`
	DiskUsedBytes       uint64    `json:"diskUsedBytes"`
	ImageBytes          int64     `json:"imageBytes"`
	NodesReady          int       `json:"nodesReady"`
	NodesTotal          int       `json:"nodesTotal"`
	NodesUnavailable    int       `json:"nodesUnavailable"`
	ReclaimableBytes    int64     `json:"reclaimableBytes"`
	ServicesDegraded    int       `json:"servicesDegraded"`
	ServicesTotal       int       `json:"servicesTotal"`
	ServicesUnhealthy   int       `json:"servicesUnhealthy"`
	TasksDesired        int       `json:"tasksDesired"`
	TasksFailed         int       `json:"tasksFailed"`
	TasksRunning        int       `json:"tasksRunning"`
	TasksTotal          int       `json:"tasksTotal"`
	VolumeBytes         int64     `json:"volumeBytes"`
}

// SampleFrom reduces a full insights reading to the series shape.
func SampleFrom(value domain.Insights) Sample {
	return Sample{
		At:                  value.GeneratedAt,
		BuildCacheBytes:     value.Storage.BuildCacheBytes,
		ContainersRunning:   value.Containers.Running,
		ContainersStopped:   value.Containers.Stopped,
		ContainersTotal:     value.Containers.Total,
		ContainersUnhealthy: value.Containers.Unhealthy,
		DiskCapacityBytes:   value.Capacity.DiskBytes,
		DiskUsedBytes:       value.Capacity.DiskUsedBytes,
		ImageBytes:          value.Storage.ImageBytes,
		NodesReady:          value.Nodes.Ready,
		NodesTotal:          value.Nodes.Total,
		NodesUnavailable:    value.Nodes.Unavailable,
		ReclaimableBytes:    value.Storage.ReclaimableImageBytes + value.Storage.ReclaimableVolumeBytes + value.Storage.ReclaimableBuildCacheBytes,
		ServicesDegraded:    value.Services.Degraded,
		ServicesTotal:       value.Services.Total,
		ServicesUnhealthy:   value.Services.Unhealthy,
		TasksDesired:        int(value.Services.DesiredTasks),
		TasksFailed:         value.Tasks.Failed,
		TasksRunning:        int(value.Services.RunningTasks),
		TasksTotal:          value.Tasks.Total,
		VolumeBytes:         value.Storage.VolumeBytes,
	}
}

// History is a bounded per-server ring of samples, safe for the sampler
// goroutine and request handlers to share.
type History struct {
	limit  int
	mutex  sync.RWMutex
	series map[string][]Sample
}

func NewHistory(limit int) *History {
	if limit < 2 {
		limit = DefaultLimit
	}
	return &History{limit: limit, series: map[string][]Sample{}}
}

// Record appends one sample, dropping the oldest once the window is full. An
// empty server key is ignored: a reading that cannot be attributed to a target
// would silently mix two clusters into one line.
func (h *History) Record(serverID string, sample Sample) {
	if h == nil || serverID == "" {
		return
	}
	if sample.At.IsZero() {
		sample.At = time.Now().UTC()
	}
	h.mutex.Lock()
	defer h.mutex.Unlock()
	series := append(h.series[serverID], sample)
	if len(series) > h.limit {
		series = append([]Sample(nil), series[len(series)-h.limit:]...)
	}
	h.series[serverID] = series
}

// Series returns a copy of one target's readings, oldest first.
func (h *History) Series(serverID string) []Sample {
	if h == nil {
		return nil
	}
	h.mutex.RLock()
	defer h.mutex.RUnlock()
	return append([]Sample(nil), h.series[serverID]...)
}

// Latest reports the most recent sample and whether one exists. The sampler
// uses it to avoid recording two readings inside one interval.
func (h *History) Latest(serverID string) (Sample, bool) {
	if h == nil {
		return Sample{}, false
	}
	h.mutex.RLock()
	defer h.mutex.RUnlock()
	series := h.series[serverID]
	if len(series) == 0 {
		return Sample{}, false
	}
	return series[len(series)-1], true
}

// Forget drops a target's series when its server profile is removed, so a
// deleted target does not keep a cluster's counts alive in memory.
func (h *History) Forget(serverID string) {
	if h == nil {
		return
	}
	h.mutex.Lock()
	defer h.mutex.Unlock()
	delete(h.series, serverID)
}
