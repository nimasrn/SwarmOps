package dockerapi

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// This file covers the read-only Docker and Swarm inventory SwarmOps shows in
// the console. Every type is a projection: fields that carry operator or
// application secrets (config payloads, swarm join tokens, container
// environment values) are deliberately absent so no read path can disclose
// them. Mutations live in the fixed agentcontrol vocabulary, never here.

type Container struct {
	Command string            `json:"Command"`
	Created int64             `json:"Created"`
	ID      string            `json:"Id"`
	Image   string            `json:"Image"`
	ImageID string            `json:"ImageID"`
	Labels  map[string]string `json:"Labels"`
	Mounts  []struct {
		Destination string `json:"Destination"`
		Name        string `json:"Name"`
		RW          bool   `json:"RW"`
		Source      string `json:"Source"`
		Type        string `json:"Type"`
	} `json:"Mounts"`
	Names           []string `json:"Names"`
	NetworkSettings struct {
		Networks map[string]struct {
			IPAddress string `json:"IPAddress"`
			NetworkID string `json:"NetworkID"`
		} `json:"Networks"`
	} `json:"NetworkSettings"`
	Ports []struct {
		IP          string `json:"IP"`
		PrivatePort uint16 `json:"PrivatePort"`
		PublicPort  uint16 `json:"PublicPort"`
		Type        string `json:"Type"`
	} `json:"Ports"`
	SizeRootFs int64  `json:"SizeRootFs"`
	SizeRw     int64  `json:"SizeRw"`
	State      string `json:"State"`
	Status     string `json:"Status"`
}

// ContainerDetail is the projection of a container inspect. Env is reduced to
// variable NAMES on the way out of this package: a container's environment is
// a routine carrier of database passwords and API keys, and the console has no
// operational need for the values.
type ContainerDetail struct {
	Created string   `json:"Created"`
	ID      string   `json:"Id"`
	Image   string   `json:"Image"`
	Name    string   `json:"Name"`
	Path    string   `json:"Path"`
	Args    []string `json:"Args"`
	Config  struct {
		Env          []string          `json:"Env,omitempty"`
		Healthcheck  *json.RawMessage  `json:"Healthcheck"`
		Hostname     string            `json:"Hostname"`
		Image        string            `json:"Image"`
		Labels       map[string]string `json:"Labels"`
		User         string            `json:"User"`
		WorkingDir   string            `json:"WorkingDir"`
		EnvVariables []string          `json:"EnvNames"`
	} `json:"Config"`
	HostConfig struct {
		CPUShares     int64  `json:"CpuShares"`
		Memory        int64  `json:"Memory"`
		NanoCPUs      int64  `json:"NanoCpus"`
		NetworkMode   string `json:"NetworkMode"`
		Privileged    bool   `json:"Privileged"`
		RestartPolicy struct {
			MaximumRetryCount int    `json:"MaximumRetryCount"`
			Name              string `json:"Name"`
		} `json:"RestartPolicy"`
	} `json:"HostConfig"`
	Mounts []struct {
		Destination string `json:"Destination"`
		Name        string `json:"Name"`
		RW          bool   `json:"RW"`
		Source      string `json:"Source"`
		Type        string `json:"Type"`
	} `json:"Mounts"`
	RestartCount int `json:"RestartCount"`
	State        struct {
		ExitCode   int    `json:"ExitCode"`
		FinishedAt string `json:"FinishedAt"`
		Health     *struct {
			FailingStreak int    `json:"FailingStreak"`
			Status        string `json:"Status"`
		} `json:"Health"`
		OOMKilled  bool   `json:"OOMKilled"`
		Pid        int    `json:"Pid"`
		Running    bool   `json:"Running"`
		StartedAt  string `json:"StartedAt"`
		Status     string `json:"Status"`
		Restarting bool   `json:"Restarting"`
	} `json:"State"`
}

// ContainerStats is one non-streaming sample. The console derives CPU and
// memory percentages from it; the raw cgroup document is not forwarded.
type ContainerStats struct {
	BlkioStats struct {
		IOServiceBytesRecursive []struct {
			Op    string `json:"op"`
			Value uint64 `json:"value"`
		} `json:"io_service_bytes_recursive"`
	} `json:"blkio_stats"`
	CPUStats struct {
		CPUUsage struct {
			TotalUsage uint64 `json:"total_usage"`
		} `json:"cpu_usage"`
		OnlineCPUs     uint32 `json:"online_cpus"`
		SystemCPUUsage uint64 `json:"system_cpu_usage"`
	} `json:"cpu_stats"`
	MemoryStats struct {
		Limit uint64 `json:"limit"`
		Stats struct {
			Cache        uint64 `json:"cache"`
			InactiveFile uint64 `json:"inactive_file"`
		} `json:"stats"`
		Usage uint64 `json:"usage"`
	} `json:"memory_stats"`
	Networks map[string]struct {
		RxBytes uint64 `json:"rx_bytes"`
		TxBytes uint64 `json:"tx_bytes"`
	} `json:"networks"`
	PidsStats struct {
		Current uint64 `json:"current"`
	} `json:"pids_stats"`
	PreCPUStats struct {
		CPUUsage struct {
			TotalUsage uint64 `json:"total_usage"`
		} `json:"cpu_usage"`
		SystemCPUUsage uint64 `json:"system_cpu_usage"`
	} `json:"precpu_stats"`
	Read string `json:"read"`
}

type Image struct {
	Containers  int64             `json:"Containers"`
	Created     int64             `json:"Created"`
	ID          string            `json:"Id"`
	Labels      map[string]string `json:"Labels"`
	ParentID    string            `json:"ParentId"`
	RepoDigests []string          `json:"RepoDigests"`
	RepoTags    []string          `json:"RepoTags"`
	SharedSize  int64             `json:"SharedSize"`
	Size        int64             `json:"Size"`
}

type ImageDetail struct {
	Architecture string   `json:"Architecture"`
	Author       string   `json:"Author"`
	Created      string   `json:"Created"`
	ID           string   `json:"Id"`
	OS           string   `json:"Os"`
	Parent       string   `json:"Parent"`
	RepoDigests  []string `json:"RepoDigests"`
	RepoTags     []string `json:"RepoTags"`
	RootFS       struct {
		Layers []string `json:"Layers"`
		Type   string   `json:"Type"`
	} `json:"RootFS"`
	Size int64 `json:"Size"`
}

type Volume struct {
	CreatedAt  string            `json:"CreatedAt"`
	Driver     string            `json:"Driver"`
	Labels     map[string]string `json:"Labels"`
	Mountpoint string            `json:"Mountpoint"`
	Name       string            `json:"Name"`
	Options    map[string]string `json:"Options"`
	Scope      string            `json:"Scope"`
	UsageData  *struct {
		RefCount int64 `json:"RefCount"`
		Size     int64 `json:"Size"`
	} `json:"UsageData"`
}

type volumeList struct {
	Volumes  []Volume `json:"Volumes"`
	Warnings []string `json:"Warnings"`
}

type Network struct {
	Attachable bool   `json:"Attachable"`
	Created    string `json:"Created"`
	Driver     string `json:"Driver"`
	ID         string `json:"Id"`
	Ingress    bool   `json:"Ingress"`
	Internal   bool   `json:"Internal"`
	IPAM       struct {
		Config []struct {
			Gateway string `json:"Gateway"`
			Subnet  string `json:"Subnet"`
		} `json:"Config"`
		Driver string `json:"Driver"`
	} `json:"IPAM"`
	Labels  map[string]string `json:"Labels"`
	Name    string            `json:"Name"`
	Options map[string]string `json:"Options"`
	Scope   string            `json:"Scope"`
}

type NetworkDetail struct {
	Network
	Containers map[string]struct {
		EndpointID  string `json:"EndpointID"`
		IPv4Address string `json:"IPv4Address"`
		Name        string `json:"Name"`
	} `json:"Containers"`
}

// SwarmObject omits JoinTokens on purpose. A worker or manager join token is
// cluster-admission material: SwarmOps enrols nodes through the installer's
// one-time secret, so no browser or API read path ever needs the token.
type SwarmObject struct {
	CreatedAt time.Time `json:"CreatedAt"`
	ID        string    `json:"ID"`
	Spec      struct {
		CAConfig struct {
			NodeCertExpiry int64 `json:"NodeCertExpiry"`
		} `json:"CAConfig"`
		Dispatcher struct {
			HeartbeatPeriod int64 `json:"HeartbeatPeriod"`
		} `json:"Dispatcher"`
		EncryptionConfig struct {
			AutoLockManagers bool `json:"AutoLockManagers"`
		} `json:"EncryptionConfig"`
		Labels        map[string]string `json:"Labels"`
		Name          string            `json:"Name"`
		Orchestration struct {
			TaskHistoryRetentionLimit int64 `json:"TaskHistoryRetentionLimit"`
		} `json:"Orchestration"`
		Raft struct {
			ElectionTick               int   `json:"ElectionTick"`
			HeartbeatTick              int   `json:"HeartbeatTick"`
			KeepOldSnapshots           int64 `json:"KeepOldSnapshots"`
			LogEntriesForSlowFollowers int64 `json:"LogEntriesForSlowFollowers"`
			SnapshotInterval           int64 `json:"SnapshotInterval"`
		} `json:"Raft"`
	} `json:"Spec"`
	UpdatedAt time.Time `json:"UpdatedAt"`
	Version   struct {
		Index uint64 `json:"Index"`
	} `json:"Version"`
}

// SwarmObjectMeta is the metadata shape shared by secrets and configs. Neither
// carries Data: a config payload is operator material and a secret value is
// never readable from the Engine at all.
type SwarmObjectMeta struct {
	CreatedAt time.Time `json:"CreatedAt"`
	ID        string    `json:"ID"`
	Spec      struct {
		Labels map[string]string `json:"Labels"`
		Name   string            `json:"Name"`
	} `json:"Spec"`
	UpdatedAt time.Time `json:"UpdatedAt"`
	Version   struct {
		Index uint64 `json:"Index"`
	} `json:"Version"`
}

// DiskUsage is the /system/df report, reduced to the totals and per-object
// sizes the console renders.
type DiskUsage struct {
	BuildCache []struct {
		ID          string `json:"ID"`
		InUse       bool   `json:"InUse"`
		Shared      bool   `json:"Shared"`
		Size        int64  `json:"Size"`
		Type        string `json:"Type"`
		UsageCount  int64  `json:"UsageCount"`
		LastUsedAt  string `json:"LastUsedAt"`
		Description string `json:"Description"`
	} `json:"BuildCache"`
	Containers []Container `json:"Containers"`
	Images     []Image     `json:"Images"`
	LayersSize int64       `json:"LayersSize"`
	Volumes    []Volume    `json:"Volumes"`
}

// Event is one entry of the Engine event log, read over a bounded window
// rather than as an open stream.
type Event struct {
	Action string `json:"Action"`
	Actor  struct {
		Attributes map[string]string `json:"Attributes"`
		ID         string            `json:"ID"`
	} `json:"Actor"`
	Scope    string `json:"scope"`
	Time     int64  `json:"time"`
	TimeNano int64  `json:"timeNano"`
	Type     string `json:"Type"`
}

func (c *Client) ListContainers(ctx context.Context, all bool) ([]Container, error) {
	query := url.Values{"size": {"1"}}
	if all {
		query.Set("all", "1")
	}
	var output []Container
	if err := c.getJSON(ctx, "/containers/json?"+query.Encode(), &output); err != nil {
		return nil, err
	}
	return output, nil
}

func (c *Client) InspectContainer(ctx context.Context, id string) (ContainerDetail, error) {
	if !validID(id) {
		return ContainerDetail{}, fmt.Errorf("invalid container reference")
	}
	var output ContainerDetail
	if err := c.getJSON(ctx, "/containers/"+id+"/json", &output); err != nil {
		return ContainerDetail{}, err
	}
	output.Config.EnvVariables = environmentNames(output.Config.Env)
	output.Config.Env = nil
	return output, nil
}

// ContainerStats takes a single sample. Streaming is refused so one console
// request cannot hold an Engine connection open.
func (c *Client) ContainerStats(ctx context.Context, id string) (ContainerStats, error) {
	if !validID(id) {
		return ContainerStats{}, fmt.Errorf("invalid container reference")
	}
	var output ContainerStats
	if err := c.getJSON(ctx, "/containers/"+id+"/stats?stream=false&one-shot=false", &output); err != nil {
		return ContainerStats{}, err
	}
	return output, nil
}

func (c *Client) ListImages(ctx context.Context) ([]Image, error) {
	var output []Image
	if err := c.getJSON(ctx, "/images/json?all=0&shared-size=1", &output); err != nil {
		return nil, err
	}
	return output, nil
}

func (c *Client) InspectImage(ctx context.Context, id string) (ImageDetail, error) {
	if !validID(id) {
		return ImageDetail{}, fmt.Errorf("invalid image reference")
	}
	var output ImageDetail
	if err := c.getJSON(ctx, "/images/"+id+"/json", &output); err != nil {
		return ImageDetail{}, err
	}
	return output, nil
}

func (c *Client) ListVolumes(ctx context.Context) ([]Volume, error) {
	var output volumeList
	if err := c.getJSON(ctx, "/volumes", &output); err != nil {
		return nil, err
	}
	return output.Volumes, nil
}

func (c *Client) InspectVolume(ctx context.Context, name string) (Volume, error) {
	if !validName(name) {
		return Volume{}, fmt.Errorf("invalid volume name")
	}
	var output Volume
	if err := c.getJSON(ctx, "/volumes/"+name, &output); err != nil {
		return Volume{}, err
	}
	return output, nil
}

func (c *Client) ListNetworks(ctx context.Context) ([]Network, error) {
	var output []Network
	if err := c.getJSON(ctx, "/networks", &output); err != nil {
		return nil, err
	}
	return output, nil
}

func (c *Client) InspectNetwork(ctx context.Context, id string) (NetworkDetail, error) {
	if !validID(id) {
		return NetworkDetail{}, fmt.Errorf("invalid network reference")
	}
	var output NetworkDetail
	if err := c.getJSON(ctx, "/networks/"+id, &output); err != nil {
		return NetworkDetail{}, err
	}
	return output, nil
}

func (c *Client) ListSecrets(ctx context.Context) ([]SwarmObjectMeta, error) {
	var output []SwarmObjectMeta
	if err := c.getJSON(ctx, "/secrets", &output); err != nil {
		return nil, err
	}
	return output, nil
}

func (c *Client) ListConfigs(ctx context.Context) ([]SwarmObjectMeta, error) {
	var output []SwarmObjectMeta
	if err := c.getJSON(ctx, "/configs", &output); err != nil {
		return nil, err
	}
	return output, nil
}

func (c *Client) InspectService(ctx context.Context, id string) (Service, error) {
	if !validID(id) {
		return Service{}, fmt.Errorf("invalid service reference")
	}
	var output Service
	if err := c.getJSON(ctx, "/services/"+id, &output); err != nil {
		return Service{}, err
	}
	return output, nil
}

func (c *Client) InspectTask(ctx context.Context, id string) (Task, error) {
	if !validID(id) {
		return Task{}, fmt.Errorf("invalid task reference")
	}
	var output Task
	if err := c.getJSON(ctx, "/tasks/"+id, &output); err != nil {
		return Task{}, err
	}
	return output, nil
}

func (c *Client) InspectSwarm(ctx context.Context) (SwarmObject, error) {
	var output SwarmObject
	if err := c.getJSON(ctx, "/swarm", &output); err != nil {
		return SwarmObject{}, err
	}
	return output, nil
}

// SwarmJoinToken is the ONE function in this package that returns a join
// token, and it returns nothing else.
//
// SwarmObject above deliberately omits JoinTokens so that no console read path
// can ever disclose one. That rule is worth keeping, and a node cannot join a
// cluster without a token — so the disclosure lives here, in a function whose
// name says exactly what it hands back, reachable only from the agent's
// controller-authenticated join-token route. Nothing stores its result.
func (c *Client) SwarmJoinToken(ctx context.Context, role string) (string, error) {
	if role != "manager" && role != "worker" {
		return "", fmt.Errorf("invalid Swarm join role")
	}
	var output struct {
		JoinTokens struct {
			Manager string `json:"Manager"`
			Worker  string `json:"Worker"`
		} `json:"JoinTokens"`
	}
	if err := c.getJSON(ctx, "/swarm", &output); err != nil {
		return "", err
	}
	if role == "manager" {
		return output.JoinTokens.Manager, nil
	}
	return output.JoinTokens.Worker, nil
}

func (c *Client) DiskUsage(ctx context.Context) (DiskUsage, error) {
	var output DiskUsage
	if err := c.getJSON(ctx, "/system/df", &output); err != nil {
		return DiskUsage{}, err
	}
	return output, nil
}

// Events reads a closed window of the Engine event log. Both bounds are
// required so the Engine returns a finite document instead of a live stream.
func (c *Client) Events(ctx context.Context, since, until int64) ([]Event, error) {
	if since <= 0 || until <= since {
		return nil, fmt.Errorf("event window requires an ordered since and until")
	}
	query := url.Values{
		"since": {fmt.Sprint(since)},
		"until": {fmt.Sprint(until)},
	}
	response, err := c.request(ctx, http.MethodGet, "/events?"+query.Encode(), nil, nil)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()
	decoder := json.NewDecoder(io.LimitReader(response.Body, responseLimit))
	events := []Event{}
	for {
		var event Event
		if err := decoder.Decode(&event); err != nil {
			if errors.Is(err, io.EOF) {
				break
			}
			return nil, fmt.Errorf("decode Docker event: %w", err)
		}
		events = append(events, event)
		if len(events) >= 2000 {
			break
		}
	}
	return events, nil
}

// environmentNames keeps the variable names of a container environment and
// discards every value, which is routinely a password or token.
func environmentNames(values []string) []string {
	names := make([]string, 0, len(values))
	for _, value := range values {
		name, _, found := strings.Cut(value, "=")
		if !found || name == "" {
			continue
		}
		names = append(names, name)
	}
	return names
}

func validID(value string) bool {
	if value == "" || len(value) > 128 {
		return false
	}
	return referenceCharacters(value)
}

func validName(value string) bool {
	if value == "" || len(value) > 255 {
		return false
	}
	return referenceCharacters(value)
}

func referenceCharacters(value string) bool {
	for _, character := range value {
		switch {
		case character >= 'a' && character <= 'z',
			character >= 'A' && character <= 'Z',
			character >= '0' && character <= '9',
			character == '.', character == '_', character == '-', character == ':':
		default:
			return false
		}
	}
	return true
}
