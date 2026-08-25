// Package agent gathers bounded node inventory and, when explicitly enabled,
// exposes a small fixed Docker-operation vocabulary for a pinned controller.
// It never exposes arbitrary commands, files, or the Docker socket.
package agent

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/nimasrn/SwarmOps/internal/dockerapi"
)

type Config struct {
	AllowedImagePrefixes []string
	BuildEnabled         bool
	BuildMaxBytes        int64
	BuildMaxCPUs         float64
	BuildMaxMemoryMiB    int64
	Docker               *dockerapi.Client
	// EnrollmentSecret is the installer's one-time secret. When present the
	// agent serves a single enrollment exchange that hands the controller the
	// machine API key; EnrollmentSecretFile is removed once it is spent.
	EnrollmentSecret     []byte
	EnrollmentSecretFile string
	// HostRoot is an optional read-only mount of the node root. The agent uses
	// it solely for filesystem capacity; it never exposes arbitrary files.
	HostRoot             string
	HostOS               string
	HostProc             string
	NodeName             string
	RemoteControlEnabled bool
	Version              string
}

type Snapshot struct {
	CollectedAt time.Time `json:"collectedAt"`
	Disk        Disk      `json:"disk"`
	Engine      Engine    `json:"engine"`
	Hardware    Hardware  `json:"hardware"`
	NodeName    string    `json:"nodeName"`
	OS          OS        `json:"os"`
	Version     string    `json:"version"`
}

type Disk struct {
	AvailableBytes uint64 `json:"availableBytes"`
	TotalBytes     uint64 `json:"totalBytes"`
	UsedBytes      uint64 `json:"usedBytes"`
}

type Engine struct {
	APIVersion    string `json:"apiVersion,omitempty"`
	CgroupDriver  string `json:"cgroupDriver,omitempty"`
	DockerRootDir string `json:"dockerRootDir,omitempty"`
	Driver        string `json:"driver,omitempty"`
	Version       string `json:"version,omitempty"`
}

type Hardware struct {
	CPUCores        int     `json:"cpuCores"`
	Load1           float64 `json:"load1"`
	Load5           float64 `json:"load5"`
	Load15          float64 `json:"load15"`
	MemoryAvailable uint64  `json:"memoryAvailableBytes"`
	MemoryTotal     uint64  `json:"memoryTotalBytes"`
	UptimeSeconds   uint64  `json:"uptimeSeconds"`
}

type OS struct {
	Architecture string `json:"architecture"`
	Kernel       string `json:"kernel,omitempty"`
	Name         string `json:"name,omitempty"`
}

func Collect(ctx context.Context, config Config) (Snapshot, error) {
	if config.HostProc == "" {
		config.HostProc = "/proc"
	}
	if config.HostOS == "" {
		config.HostOS = "/etc/os-release"
	}
	if config.HostRoot == "" {
		config.HostRoot = "/"
	}
	snapshot := Snapshot{
		CollectedAt: time.Now().UTC(),
		NodeName:    config.NodeName,
		Version:     config.Version,
		OS:          OS{Architecture: runtime.GOARCH},
	}
	if snapshot.NodeName == "" {
		snapshot.NodeName, _ = os.Hostname()
	}
	if kernel, err := readTrimmed(filepath.Join(config.HostProc, "sys/kernel/osrelease")); err == nil {
		snapshot.OS.Kernel = kernel
	}
	if name, err := osReleaseName(config.HostOS); err == nil {
		snapshot.OS.Name = name
	}
	if memory, err := memoryInfo(filepath.Join(config.HostProc, "meminfo")); err == nil {
		snapshot.Hardware.MemoryTotal = memory.total
		snapshot.Hardware.MemoryAvailable = memory.available
	}
	if load, err := loadAverage(filepath.Join(config.HostProc, "loadavg")); err == nil {
		snapshot.Hardware.Load1, snapshot.Hardware.Load5, snapshot.Hardware.Load15 = load[0], load[1], load[2]
	}
	if uptime, err := uptimeSeconds(filepath.Join(config.HostProc, "uptime")); err == nil {
		snapshot.Hardware.UptimeSeconds = uptime
	}
	snapshot.Hardware.CPUCores = runtime.NumCPU()
	if disk, err := rootDisk(config.HostRoot); err == nil {
		snapshot.Disk = disk
	}
	if config.Docker != nil {
		if info, err := config.Docker.Info(ctx); err == nil {
			snapshot.Engine = Engine{APIVersion: "", CgroupDriver: info.CgroupDriver, DockerRootDir: info.DockerRootDir, Driver: info.Driver, Version: info.ServerVersion}
			if info.NCPU > 0 {
				snapshot.Hardware.CPUCores = info.NCPU
			}
			if info.MemTotal > 0 {
				snapshot.Hardware.MemoryTotal = info.MemTotal
			}
		}
		if version, err := config.Docker.Version(ctx); err == nil {
			snapshot.Engine.APIVersion = version.APIVersion
			if snapshot.Engine.Version == "" {
				snapshot.Engine.Version = version.Version
			}
		}
	}
	return snapshot, nil
}

func rootDisk(root string) (Disk, error) {
	var stat syscall.Statfs_t
	if err := syscall.Statfs(root, &stat); err != nil {
		return Disk{}, err
	}
	total := stat.Blocks * uint64(stat.Bsize)
	available := stat.Bavail * uint64(stat.Bsize)
	return Disk{AvailableBytes: available, TotalBytes: total, UsedBytes: total - available}, nil
}

func readTrimmed(name string) (string, error) {
	bytes, err := os.ReadFile(name)
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(bytes)), nil
}

func osReleaseName(name string) (string, error) {
	file, err := os.Open(name)
	if err != nil {
		return "", err
	}
	defer file.Close()
	values, err := keyValues(file)
	if err != nil {
		return "", err
	}
	return strings.Trim(values["PRETTY_NAME"], `"`), nil
}

type memory struct{ total, available uint64 }

func memoryInfo(name string) (memory, error) {
	file, err := os.Open(name)
	if err != nil {
		return memory{}, err
	}
	defer file.Close()
	return memoryInfoReader(file)
}

func memoryInfoReader(reader io.Reader) (memory, error) {
	values, err := keyValues(reader)
	if err != nil {
		return memory{}, err
	}
	parse := func(key string) uint64 {
		fields := strings.Fields(values[key])
		if len(fields) == 0 {
			return 0
		}
		value, _ := strconv.ParseUint(fields[0], 10, 64)
		return value * 1024
	}
	return memory{total: parse("MemTotal"), available: parse("MemAvailable")}, nil
}

func memoryInfoFromText(value string) (memory, error) {
	return memoryInfoReader(strings.NewReader(value))
}

func keyValues(reader io.Reader) (map[string]string, error) {
	values := map[string]string{}
	scanner := bufio.NewScanner(reader)
	for scanner.Scan() {
		line := scanner.Text()
		key, value, found := strings.Cut(line, ":")
		if !found {
			key, value, found = strings.Cut(line, "=")
		}
		if found {
			values[strings.TrimSpace(key)] = strings.TrimSpace(value)
		}
	}
	return values, scanner.Err()
}

func loadAverage(name string) ([3]float64, error) {
	var result [3]float64
	text, err := readTrimmed(name)
	if err != nil {
		return result, err
	}
	return loadAverageFromText(text)
}

func loadAverageFromText(text string) ([3]float64, error) {
	var result [3]float64
	fields := strings.Fields(text)
	if len(fields) < 3 {
		return result, fmt.Errorf("invalid loadavg")
	}
	for index := range result {
		parsed, err := strconv.ParseFloat(fields[index], 64)
		if err != nil {
			return [3]float64{}, err
		}
		result[index] = parsed
	}
	return result, nil
}

func uptimeSeconds(name string) (uint64, error) {
	text, err := readTrimmed(name)
	if err != nil {
		return 0, err
	}
	field := strings.Fields(text)
	if len(field) == 0 {
		return 0, fmt.Errorf("invalid uptime")
	}
	value, err := strconv.ParseFloat(field[0], 64)
	return uint64(value), err
}
