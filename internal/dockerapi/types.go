// Package dockerapi is a small, version-tolerant client for the Docker Engine
// API. Types only cover data SwarmOps reads or explicitly controls.
package dockerapi

import "time"

type Node struct {
	CreatedAt   time.Time `json:"CreatedAt"`
	Description struct {
		Engine struct {
			EngineVersion string `json:"EngineVersion"`
		} `json:"Engine"`
		Hostname  string   `json:"Hostname"`
		Platform  Platform `json:"Platform"`
		Resources struct {
			MemoryBytes uint64 `json:"MemoryBytes"`
			NanoCPUs    uint64 `json:"NanoCPUs"`
		} `json:"Resources"`
	} `json:"Description"`
	ID            string `json:"ID"`
	ManagerStatus *struct {
		Addr         string `json:"Addr"`
		Leader       bool   `json:"Leader"`
		Reachability string `json:"Reachability"`
	} `json:"ManagerStatus"`
	Spec struct {
		Availability string            `json:"Availability"`
		Labels       map[string]string `json:"Labels"`
		Role         string            `json:"Role"`
	} `json:"Spec"`
	Status struct {
		Addr  string `json:"Addr"`
		State string `json:"State"`
	} `json:"Status"`
	UpdatedAt time.Time `json:"UpdatedAt"`
	Version   struct {
		Index uint64 `json:"Index"`
	} `json:"Version"`
}

type Platform struct {
	Architecture string `json:"Architecture"`
	OS           string `json:"OS"`
}

type Service struct {
	CreatedAt time.Time `json:"CreatedAt"`
	ID        string    `json:"ID"`
	Spec      struct {
		Labels map[string]string `json:"Labels"`
		Mode   struct {
			Global     *struct{} `json:"Global"`
			Replicated *struct {
				Replicas uint64 `json:"Replicas"`
			} `json:"Replicated"`
		} `json:"Mode"`
		Name         string `json:"Name"`
		TaskTemplate struct {
			ContainerSpec struct {
				Image string `json:"Image"`
			} `json:"ContainerSpec"`
			Placement struct {
				Constraints []string `json:"Constraints"`
			} `json:"Placement"`
		} `json:"TaskTemplate"`
	} `json:"Spec"`
	UpdateStatus *struct {
		Message string `json:"Message"`
		State   string `json:"State"`
	} `json:"UpdateStatus"`
	UpdatedAt time.Time `json:"UpdatedAt"`
	Version   struct {
		Index uint64 `json:"Index"`
	} `json:"Version"`
}

type Task struct {
	CreatedAt           string `json:"CreatedAt"`
	DesiredState        string `json:"DesiredState"`
	ID                  string `json:"ID"`
	NetworksAttachments []struct {
		Addresses []string `json:"Addresses"`
	} `json:"NetworksAttachments"`
	NodeID    string `json:"NodeID"`
	ServiceID string `json:"ServiceID"`
	Slot      uint64 `json:"Slot"`
	Status    struct {
		ContainerStatus struct {
			ContainerID string `json:"ContainerID"`
		} `json:"ContainerStatus"`
		Err       string `json:"Err"`
		Message   string `json:"Message"`
		State     string `json:"State"`
		Timestamp string `json:"Timestamp"`
	} `json:"Status"`
}

type Info struct {
	CgroupDriver    string `json:"CgroupDriver"`
	DockerRootDir   string `json:"DockerRootDir"`
	Driver          string `json:"Driver"`
	KernelVersion   string `json:"KernelVersion"`
	MemTotal        uint64 `json:"MemTotal"`
	NCPU            int    `json:"NCPU"`
	OperatingSystem string `json:"OperatingSystem"`
	ServerVersion   string `json:"ServerVersion"`
	Swarm           struct {
		ControlAvailable bool `json:"ControlAvailable"`
		Cluster          struct {
			ID string `json:"ID"`
		} `json:"Cluster"`
		LocalNodeState string `json:"LocalNodeState"`
		Managers       int    `json:"Managers"`
		NodeID         string `json:"NodeID"`
	} `json:"Swarm"`
}

type Version struct {
	APIVersion    string `json:"ApiVersion"`
	MinAPIVersion string `json:"MinAPIVersion"`
	Version       string `json:"Version"`
}

// Volume contains only the Docker volume facts required for the machine
// agent's reviewed migration path. It is never returned to a browser.
type Volume struct {
	Driver     string `json:"Driver"`
	Mountpoint string `json:"Mountpoint"`
	Name       string `json:"Name"`
}

// ContainerHealth is the reduced, non-sensitive subset of an inspect result
// needed to keep a migrated local-volume service under observation. It omits
// environment, mounts, labels, network addresses, and all log content.
type ContainerHealth struct {
	Health  string `json:"health,omitempty"`
	Running bool   `json:"running"`
	Status  string `json:"status,omitempty"`
}
