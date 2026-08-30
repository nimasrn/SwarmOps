package agent

import (
	"bufio"
	"context"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"sort"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/nimasrn/SwarmOps/internal/agentcontrol"
	"github.com/nimasrn/SwarmOps/internal/dockerapi"
)

// The agent is the only collector.
//
// SwarmOps deliberately does not deploy cAdvisor or scrape a node-exporter:
// both are containers, both need privileged host mounts, and neither can
// answer while Docker is stopped — which is exactly when an operator is
// looking. This process already runs on the host, is already authenticated to
// Core, and already reads /proc for its snapshot, so measurement belongs here.
//
// Everything below reads counters. Nothing computes a rate except host CPU,
// which has no cumulative form the console can use, and container CPU, where
// Docker hands us both samples in one response.

const (
	// A stats call is one Engine round trip per container, so they are made in
	// parallel with a small pool: a 200-container host must not turn one
	// scrape into 200 sequential requests.
	containerStatsWorkers = 8
	containerStatsBudget  = 8 * time.Second
	// A CPU delta measured against a sample from twenty minutes ago is an
	// average over twenty minutes, which is not what the chart claims to show.
	maxCPUSampleAge = 2 * time.Minute
)

// MetricsCollector holds the one piece of state measurement needs: the
// previous CPU counter reading. Everything else is instantaneous or
// cumulative.
type MetricsCollector struct {
	config Config

	mu       sync.Mutex
	previous cpuTimes
	sampled  time.Time
}

func NewMetricsCollector(config Config) *MetricsCollector {
	if config.HostProc == "" {
		config.HostProc = "/proc"
	}
	if config.HostRoot == "" {
		config.HostRoot = "/"
	}
	return &MetricsCollector{config: config}
}

// Collect takes one sample. It never fails as a whole: a host with an
// unreadable /proc/diskstats still reports its memory, because a partial
// reading is worth more to an operator than a 503.
func (c *MetricsCollector) Collect(ctx context.Context) agentcontrol.MachineMetrics {
	now := time.Now().UTC()
	sample := agentcontrol.MachineMetrics{CollectedAt: now, Host: c.host(now)}
	if c.config.Docker != nil {
		// Availability is whether Docker ANSWERED, not whether a socket path
		// was configured. A host whose daemon is stopped has a client and no
		// Docker, and reporting those the same way is how a console ends up
		// showing "no containers" for a machine that is actually broken.
		sample.Containers, sample.DockerAvailable = c.containers(ctx)
	}
	return sample
}

func (c *MetricsCollector) host(now time.Time) agentcontrol.HostMetrics {
	proc := c.config.HostProc
	host := agentcontrol.HostMetrics{CPUCores: runtime.NumCPU(), CPUUsedRatio: -1, CPUIOWaitRatio: -1, CPUStealRatio: -1}

	if current, err := readCPUTimes(filepath.Join(proc, "stat")); err == nil {
		c.mu.Lock()
		previous, sampledAt := c.previous, c.sampled
		c.previous, c.sampled = current, now
		c.mu.Unlock()
		if !sampledAt.IsZero() && now.Sub(sampledAt) <= maxCPUSampleAge {
			host.CPUUsedRatio, host.CPUIOWaitRatio, host.CPUStealRatio = current.since(previous)
		}
	}

	if memory, err := readMemory(filepath.Join(proc, "meminfo")); err == nil {
		host.MemoryTotal, host.MemoryAvailable = memory.total, memory.available
		host.SwapTotal, host.SwapUsed = memory.swapTotal, memory.swapTotal-memory.swapFree
		if memory.total >= memory.available {
			host.MemoryUsed = memory.total - memory.available
		}
	}
	if load, err := loadAverage(filepath.Join(proc, "loadavg")); err == nil {
		host.Load1, host.Load5, host.Load15 = load[0], load[1], load[2]
	}
	if count, err := readProcessCount(filepath.Join(proc, "loadavg")); err == nil {
		host.ProcessCount = count
	}
	if uptime, err := uptimeSeconds(filepath.Join(proc, "uptime")); err == nil {
		host.UptimeSeconds = uptime
	}
	if interfaces, err := readInterfaces(firstReadable(proc, "1/net/dev", "net/dev")); err == nil {
		host.Interfaces = interfaces
	}
	if disks, err := readDisks(filepath.Join(proc, "diskstats")); err == nil {
		host.Disks = disks
	}
	host.Filesystems = c.filesystems()

	// A platform without /proc answers what it can rather than reporting a
	// host with no memory and no uptime. Linux leaves this untouched.
	supplementHost(&host, c.config)
	return host
}

// filesystems measures every real mounted filesystem, not only the root one.
// A full /var/lib/docker with a comfortable / is the ordinary way a node runs
// out of space, and one root-disk number cannot show it.
//
// It de-duplicates by DEVICE, not by path. One filesystem is routinely mounted
// at a dozen places — bind mounts, /etc/hosts, subvolumes — and reporting each
// as its own series multiplies the cardinality of every disk panel by twelve
// while telling an operator nothing they did not already know. The shortest
// mount path wins, which is the one a person would name.
func (c *MetricsCollector) filesystems() []agentcontrol.FilesystemMetrics {
	byDevice := map[string]agentcontrol.FilesystemMetrics{}
	for _, mount := range c.mountPoints() {
		path := mount.path
		// When /proc belongs to a host this process is not running on, the
		// mount paths in it are the host's. HostRoot is where that host's tree
		// is readable from here.
		if root := c.config.HostRoot; root != "" && root != "/" {
			if joined := filepath.Join(root, mount.path); pathExists(joined) {
				path = joined
			}
		}
		var stat syscall.Statfs_t
		if err := syscall.Statfs(path, &stat); err != nil {
			continue
		}
		blockSize := uint64(stat.Bsize)
		total := stat.Blocks * blockSize
		if total == 0 {
			continue
		}
		key := mount.device
		if key == "" {
			key = mount.path
		}
		if existing, found := byDevice[key]; found && len(existing.Mount) <= len(mount.path) {
			continue
		}
		byDevice[key] = agentcontrol.FilesystemMetrics{
			Mount:          mount.path,
			Device:         mount.device,
			FSType:         mount.fstype,
			TotalBytes:     total,
			AvailableBytes: stat.Bavail * blockSize,
			UsedBytes:      total - (stat.Bfree * blockSize),
		}
	}
	out := make([]agentcontrol.FilesystemMetrics, 0, len(byDevice))
	for _, filesystem := range byDevice {
		if len(out) >= agentcontrol.MaxMetricMounts {
			break
		}
		out = append(out, filesystem)
	}
	sort.Slice(out, func(left, right int) bool { return out[left].Mount < out[right].Mount })
	return out
}

func pathExists(name string) bool {
	_, err := os.Stat(name)
	return err == nil
}

// containers returns the measured containers and whether Docker answered at
// all. The two are different facts: an empty list from a healthy daemon and an
// empty list from a stopped one mean opposite things.
func (c *MetricsCollector) containers(ctx context.Context) ([]agentcontrol.ContainerMetrics, bool) {
	ctx, cancel := context.WithTimeout(ctx, containerStatsBudget)
	defer cancel()

	listed, err := c.config.Docker.ListContainers(ctx, false)
	if err != nil {
		return nil, false
	}
	if len(listed) > agentcontrol.MaxMetricContainers {
		listed = listed[:agentcontrol.MaxMetricContainers]
	}

	out := make([]agentcontrol.ContainerMetrics, len(listed))
	work := make(chan int)
	var wait sync.WaitGroup
	workers := min(containerStatsWorkers, len(listed))
	for range workers {
		wait.Add(1)
		go func() {
			defer wait.Done()
			for index := range work {
				out[index] = c.container(ctx, listed[index])
			}
		}()
	}
	for index := range listed {
		select {
		case work <- index:
		case <-ctx.Done():
		}
	}
	close(work)
	wait.Wait()

	measured := out[:0]
	for _, item := range out {
		if item.ID != "" {
			measured = append(measured, item)
		}
	}
	return measured, true
}

func (c *MetricsCollector) container(ctx context.Context, listed dockerapi.Container) agentcontrol.ContainerMetrics {
	name := ""
	if len(listed.Names) > 0 {
		name = strings.TrimPrefix(listed.Names[0], "/")
	}
	measured := agentcontrol.ContainerMetrics{
		ID:    listed.ID,
		Name:  name,
		Image: listed.Image,
		State: listed.State,
		// The stack and service labels are Docker's own. The agent does not
		// know which stack belongs to which application — Core owns that
		// mapping, so it fills Application, not this process.
		Service:  listed.Labels["com.docker.swarm.service.name"],
		Stack:    listed.Labels["com.docker.stack.namespace"],
		TaskSlot: taskSlot(listed.Labels["com.docker.swarm.task.name"]),
	}
	stats, err := c.config.Docker.ContainerStats(ctx, listed.ID)
	if err != nil {
		// The container is real and running; only its counters are missing.
		// Reporting it with an unknown CPU ratio is honest, and it keeps the
		// container visible in the inventory the metrics drive.
		measured.CPUUsedRatio = -1
		return measured
	}

	measured.CPUUsedRatio = containerCPURatio(stats)
	measured.CPUUsageSeconds = float64(stats.CPUStats.CPUUsage.TotalUsage) / 1e9
	measured.MemoryLimit = stats.MemoryStats.Limit
	measured.MemoryCache = stats.MemoryStats.Stats.InactiveFile
	// Docker's `usage` includes page cache, which makes every container look
	// close to its limit. `docker stats` subtracts inactive_file for exactly
	// this reason, and so does this.
	if stats.MemoryStats.Usage >= stats.MemoryStats.Stats.InactiveFile {
		measured.MemoryUsed = stats.MemoryStats.Usage - stats.MemoryStats.Stats.InactiveFile
	} else {
		measured.MemoryUsed = stats.MemoryStats.Usage
	}
	for _, network := range stats.Networks {
		measured.ReceivedBytes += network.RxBytes
		measured.SentBytes += network.TxBytes
	}
	for _, entry := range stats.BlkioStats.IOServiceBytesRecursive {
		switch strings.ToLower(entry.Op) {
		case "read":
			measured.BlockReadBytes += entry.Value
		case "write":
			measured.BlockWriteBytes += entry.Value
		}
	}
	measured.Processes = stats.PidsStats.Current
	return measured
}

// taskSlot is the replica number of a Swarm task — the "2" an operator means
// by "the second replica".
//
// Docker publishes no slot label; the slot is the middle component of the task
// NAME, `<service>.<slot>.<task-id>`. A global service has a node id there
// instead of a number and therefore has no slot, which is why this insists on
// digits rather than taking whatever it finds.
func taskSlot(taskName string) string {
	parts := strings.Split(taskName, ".")
	if len(parts) < 3 {
		return ""
	}
	slot := parts[len(parts)-2]
	if slot == "" || strings.TrimLeft(slot, "0123456789") != "" {
		return ""
	}
	return slot
}

// containerCPURatio is the share of the WHOLE machine's CPU capacity a
// container used between Docker's two samples, in 0..1.
//
// Docker's system_cpu_usage is host CPU time summed across every core, so
// usedDelta/systemDelta is already that share — a container pinning one core
// of four reads 0.25. `docker stats` multiplies it by the core count to print
// "100%", meaning one full core; this console reports machine share instead,
// because "25% of node-2" is the number an operator compares against the
// node's own chart.
func containerCPURatio(stats dockerapi.ContainerStats) float64 {
	usedDelta := float64(stats.CPUStats.CPUUsage.TotalUsage) - float64(stats.PreCPUStats.CPUUsage.TotalUsage)
	systemDelta := float64(stats.CPUStats.SystemCPUUsage) - float64(stats.PreCPUStats.SystemCPUUsage)
	if usedDelta < 0 || systemDelta <= 0 {
		return -1
	}
	return clamp01(usedDelta / systemDelta)
}

/* ── /proc readers ──────────────────────────────────────────────────────
   Each parser is split from its file so it can be tested against captured
   text, which is how the existing snapshot parsers in this package are
   already written and the only way this code gets exercised on a machine
   that is not Linux. */

type cpuTimes struct {
	user, nice, system, idle, iowait, irq, softirq, steal uint64
}

func (t cpuTimes) total() uint64 {
	return t.user + t.nice + t.system + t.idle + t.iowait + t.irq + t.softirq + t.steal
}

// since returns busy, iowait and steal as fractions of the elapsed jiffies.
// Busy deliberately excludes iowait: a host waiting on a disk is not a host
// that needs more CPU, and conflating them sends operators to the wrong fix.
func (t cpuTimes) since(previous cpuTimes) (busy, iowait, steal float64) {
	elapsed := float64(t.total()) - float64(previous.total())
	if elapsed <= 0 {
		return -1, -1, -1
	}
	idleDelta := float64(t.idle) - float64(previous.idle)
	iowaitDelta := float64(t.iowait) - float64(previous.iowait)
	stealDelta := float64(t.steal) - float64(previous.steal)
	busy = (elapsed - idleDelta - iowaitDelta) / elapsed
	return clamp01(busy), clamp01(iowaitDelta / elapsed), clamp01(stealDelta / elapsed)
}

func clamp01(value float64) float64 {
	if value < 0 {
		return 0
	}
	if value > 1 {
		return 1
	}
	return value
}

func readCPUTimes(name string) (cpuTimes, error) {
	file, err := os.Open(name)
	if err != nil {
		return cpuTimes{}, err
	}
	defer file.Close()
	return parseCPUTimes(file)
}

func parseCPUTimes(reader io.Reader) (cpuTimes, error) {
	scanner := bufio.NewScanner(reader)
	for scanner.Scan() {
		fields := strings.Fields(scanner.Text())
		if len(fields) < 5 || fields[0] != "cpu" {
			continue
		}
		values := make([]uint64, 0, 8)
		for _, field := range fields[1:] {
			parsed, err := strconv.ParseUint(field, 10, 64)
			if err != nil {
				break
			}
			values = append(values, parsed)
			if len(values) == 8 {
				break
			}
		}
		for len(values) < 8 {
			values = append(values, 0)
		}
		return cpuTimes{
			user: values[0], nice: values[1], system: values[2], idle: values[3],
			iowait: values[4], irq: values[5], softirq: values[6], steal: values[7],
		}, nil
	}
	if err := scanner.Err(); err != nil {
		return cpuTimes{}, err
	}
	return cpuTimes{}, os.ErrNotExist
}

type memoryReading struct{ total, available, swapTotal, swapFree uint64 }

func readMemory(name string) (memoryReading, error) {
	file, err := os.Open(name)
	if err != nil {
		return memoryReading{}, err
	}
	defer file.Close()
	return parseMemory(file)
}

func parseMemory(reader io.Reader) (memoryReading, error) {
	values, err := keyValues(reader)
	if err != nil {
		return memoryReading{}, err
	}
	read := func(key string) uint64 {
		fields := strings.Fields(values[key])
		if len(fields) == 0 {
			return 0
		}
		parsed, _ := strconv.ParseUint(fields[0], 10, 64)
		return parsed * 1024
	}
	reading := memoryReading{total: read("MemTotal"), available: read("MemAvailable"), swapTotal: read("SwapTotal"), swapFree: read("SwapFree")}
	if reading.total == 0 {
		return reading, os.ErrNotExist
	}
	if reading.swapFree > reading.swapTotal {
		reading.swapFree = reading.swapTotal
	}
	return reading, nil
}

func readProcessCount(name string) (uint64, error) {
	text, err := readTrimmed(name)
	if err != nil {
		return 0, err
	}
	return parseProcessCount(text)
}

// The fourth field of /proc/loadavg is "running/total".
func parseProcessCount(text string) (uint64, error) {
	fields := strings.Fields(text)
	if len(fields) < 4 {
		return 0, os.ErrNotExist
	}
	_, total, found := strings.Cut(fields[3], "/")
	if !found {
		return 0, os.ErrNotExist
	}
	return strconv.ParseUint(total, 10, 64)
}

// firstReadable prefers PID 1's view of a per-namespace /proc file.
//
// /proc/mounts and /proc/net/dev are the READING process's namespaces, not the
// machine's. On a host-installed agent the two are the same and this changes
// nothing; when /proc has been mounted from another machine, PID 1's copy is
// that machine's and the process's own copy is a sandbox's — which is how a
// node reports one virtual interface and nine views of one disk.
func firstReadable(root string, candidates ...string) string {
	for _, candidate := range candidates {
		path := filepath.Join(root, candidate)
		if file, err := os.Open(path); err == nil {
			file.Close()
			return path
		}
	}
	return filepath.Join(root, candidates[len(candidates)-1])
}

func readInterfaces(name string) ([]agentcontrol.InterfaceMetrics, error) {
	file, err := os.Open(name)
	if err != nil {
		return nil, err
	}
	defer file.Close()
	return parseInterfaces(file)
}

// Loopback and the per-container veth pairs are skipped: an operator asking
// what this machine is sending means its real links, and a busy node has
// dozens of veths that would bury them.
func parseInterfaces(reader io.Reader) ([]agentcontrol.InterfaceMetrics, error) {
	var out []agentcontrol.InterfaceMetrics
	scanner := bufio.NewScanner(reader)
	for scanner.Scan() {
		name, rest, found := strings.Cut(scanner.Text(), ":")
		if !found {
			continue
		}
		name = strings.TrimSpace(name)
		if name == "" || name == "lo" || skippedInterface(name) {
			continue
		}
		fields := strings.Fields(rest)
		if len(fields) < 12 {
			continue
		}
		number := func(index int) uint64 {
			value, _ := strconv.ParseUint(fields[index], 10, 64)
			return value
		}
		out = append(out, agentcontrol.InterfaceMetrics{
			Name:            name,
			ReceivedBytes:   number(0),
			ReceivedPackets: number(1),
			ReceiveErrors:   number(2),
			ReceiveDropped:  number(3),
			SentBytes:       number(8),
			SentPackets:     number(9),
			SendErrors:      number(10),
			SendDropped:     number(11),
		})
		if len(out) >= agentcontrol.MaxMetricInterfaces {
			break
		}
	}
	return out, scanner.Err()
}

func skippedInterface(name string) bool {
	for _, prefix := range []string{"veth", "docker", "br-", "lxc"} {
		if strings.HasPrefix(name, prefix) {
			return true
		}
	}
	return false
}

func readDisks(name string) ([]agentcontrol.DiskMetrics, error) {
	file, err := os.Open(name)
	if err != nil {
		return nil, err
	}
	defer file.Close()
	return parseDisks(file)
}

// Partitions and virtual devices are skipped in favour of whole disks, for the
// same reason veths are skipped above.
func parseDisks(reader io.Reader) ([]agentcontrol.DiskMetrics, error) {
	const sectorBytes = 512
	var out []agentcontrol.DiskMetrics
	scanner := bufio.NewScanner(reader)
	for scanner.Scan() {
		fields := strings.Fields(scanner.Text())
		if len(fields) < 10 {
			continue
		}
		name := fields[2]
		if skippedDisk(name) {
			continue
		}
		number := func(index int) uint64 {
			value, _ := strconv.ParseUint(fields[index], 10, 64)
			return value
		}
		out = append(out, agentcontrol.DiskMetrics{
			Device:     name,
			ReadOps:    number(3),
			ReadBytes:  number(5) * sectorBytes,
			WriteOps:   number(7),
			WriteBytes: number(9) * sectorBytes,
		})
		if len(out) >= agentcontrol.MaxMetricDisks {
			break
		}
	}
	return out, scanner.Err()
}

// partitionPattern matches a partition of a whole disk: sda1, xvdb2,
// nvme0n1p1, mmcblk0p2. The whole disk is what an operator means by "the
// disk", and counting both double-counts every byte.
var partitionPattern = regexp.MustCompile(`^(?:(?:s|h|v|xv)d[a-z]+[0-9]+|(?:nvme[0-9]+n[0-9]+|mmcblk[0-9]+)p[0-9]+)$`)

func skippedDisk(name string) bool {
	for _, prefix := range []string{"loop", "ram", "dm-", "zram", "md", "sr", "fd"} {
		if strings.HasPrefix(name, prefix) {
			return true
		}
	}
	return partitionPattern.MatchString(name)
}

type mountPoint struct{ device, path, fstype string }

func parseMounts(reader io.Reader) []mountPoint {
	var out []mountPoint
	scanner := bufio.NewScanner(reader)
	for scanner.Scan() {
		fields := strings.Fields(scanner.Text())
		if len(fields) < 3 {
			continue
		}
		if !realFilesystem(fields[2]) {
			continue
		}
		out = append(out, mountPoint{device: fields[0], path: unescapeMount(fields[1]), fstype: fields[2]})
		if len(out) >= agentcontrol.MaxMetricMounts {
			break
		}
	}
	return out
}

// Only filesystems that can actually fill up. tmpfs, cgroup, proc, overlay and
// the rest are either memory-backed or views onto something already counted.
func realFilesystem(fstype string) bool {
	switch fstype {
	case "ext2", "ext3", "ext4", "xfs", "btrfs", "zfs", "f2fs", "jfs", "reiserfs", "vfat", "apfs", "hfs":
		return true
	default:
		return false
	}
}

// /proc/mounts octal-escapes space, tab, newline and backslash.
func unescapeMount(value string) string {
	if !strings.Contains(value, `\`) {
		return value
	}
	replacer := strings.NewReplacer(`\040`, " ", `\011`, "\t", `\012`, "\n", `\134`, `\`)
	return replacer.Replace(value)
}
