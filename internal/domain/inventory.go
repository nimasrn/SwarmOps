package domain

import "time"

// ContainerStats is one reduced sample of a container's resource use. It is
// derived from an Engine sample rather than forwarded raw, so the console does
// not have to know cgroup accounting.
type ContainerStats struct {
	BlockReadBytes  uint64    `json:"blockReadBytes"`
	BlockWriteBytes uint64    `json:"blockWriteBytes"`
	CPUPercent      float64   `json:"cpuPercent"`
	ID              string    `json:"id"`
	MemoryLimit     uint64    `json:"memoryLimitBytes"`
	MemoryPercent   float64   `json:"memoryPercent"`
	MemoryUsed      uint64    `json:"memoryUsedBytes"`
	NetworkRxBytes  uint64    `json:"networkRxBytes"`
	NetworkTxBytes  uint64    `json:"networkTxBytes"`
	PidsCurrent     uint64    `json:"pidsCurrent"`
	SampledAt       time.Time `json:"sampledAt"`
}

// Insights is the cluster-wide roll-up of everything Docker and Swarm report:
// how much of the fleet is available, what is running, and what space could be
// reclaimed. It is computed on the control plane so every console screen reads
// the same numbers.
type Insights struct {
	Capacity struct {
		CPUCores      uint64 `json:"cpuCores"`
		DiskBytes     uint64 `json:"diskBytes"`
		DiskUsedBytes uint64 `json:"diskUsedBytes"`
		MemoryBytes   uint64 `json:"memoryBytes"`
	} `json:"capacity"`
	Configs    int `json:"configs"`
	Containers struct {
		Paused    int `json:"paused"`
		Running   int `json:"running"`
		Stopped   int `json:"stopped"`
		Total     int `json:"total"`
		Unhealthy int `json:"unhealthy"`
	} `json:"containers"`
	GeneratedAt time.Time `json:"generatedAt"`
	Networks    struct {
		Ingress int `json:"ingress"`
		Overlay int `json:"overlay"`
		Total   int `json:"total"`
	} `json:"networks"`
	Nodes struct {
		Managers    int `json:"managers"`
		Ready       int `json:"ready"`
		Total       int `json:"total"`
		Unavailable int `json:"unavailable"`
	} `json:"nodes"`
	Secrets  int `json:"secrets"`
	Services struct {
		Degraded     int    `json:"degraded"`
		DesiredTasks uint64 `json:"desiredTasks"`
		Unhealthy    int    `json:"unhealthy"`
		RunningTasks uint64 `json:"runningTasks"`
		Total        int    `json:"total"`
	} `json:"services"`
	Storage struct {
		BuildCacheBytes            int64 `json:"buildCacheBytes"`
		ContainerWritableBytes     int64 `json:"containerWritableBytes"`
		ImageBytes                 int64 `json:"imageBytes"`
		Images                     int   `json:"images"`
		LayersBytes                int64 `json:"layersBytes"`
		ReclaimableBuildCacheBytes int64 `json:"reclaimableBuildCacheBytes"`
		ReclaimableImageBytes      int64 `json:"reclaimableImageBytes"`
		ReclaimableVolumeBytes     int64 `json:"reclaimableVolumeBytes"`
		UnusedImages               int   `json:"unusedImages"`
		UnusedVolumes              int   `json:"unusedVolumes"`
		VolumeBytes                int64 `json:"volumeBytes"`
		Volumes                    int   `json:"volumes"`
	} `json:"storage"`
	Swarm struct {
		AutoLockManagers bool      `json:"autoLockManagers"`
		CreatedAt        time.Time `json:"createdAt"`
		ID               string    `json:"id"`
		TaskHistoryLimit int64     `json:"taskHistoryLimit"`
	} `json:"swarm"`
	Tasks struct {
		Desired int `json:"desired"`
		Failed  int `json:"failed"`
		Total   int `json:"total"`
	} `json:"tasks"`
}

// CommandDefinition describes one operation the control plane supports. The
// catalogue built from these is what the console's Commands screen renders, so
// an operator can see the whole vocabulary — including the exact Docker
// command each entry becomes — without reading the source.
// CommandParameter describes one input an operation needs. The console builds
// its run form from these, so an operation gains a usable form by being
// described here rather than by hand-written UI.
type CommandParameter struct {
	// In is "path", "query", or "body" — where the value belongs in the
	// request the console builds from Endpoint.
	In          string   `json:"in"`
	Hint        string   `json:"hint,omitempty"`
	Kind        string   `json:"kind"`
	Label       string   `json:"label"`
	Name        string   `json:"name"`
	Options     []string `json:"options,omitempty"`
	Placeholder string   `json:"placeholder,omitempty"`
	Required    bool     `json:"required"`
}

type CommandDefinition struct {
	Action       string             `json:"action"`
	AutoRetry    bool               `json:"autoRetry"`
	Confirmation string             `json:"confirmation,omitempty"`
	Description  string             `json:"description"`
	Destructive  bool               `json:"destructive"`
	Docker       string             `json:"docker"`
	Endpoint     string             `json:"endpoint"`
	Mutation     bool               `json:"mutation"`
	Parameters   []CommandParameter `json:"parameters,omitempty"`
	Resource     string             `json:"resource"`
	Title        string             `json:"title"`
}
