package agent

import (
	"strings"
	"testing"

	"github.com/nimasrn/SwarmOps/internal/dockerapi"
)

// The parsers are tested against captured /proc text rather than against a
// live host, for the same reason the snapshot parsers in this package already
// are: the production platform is Linux and the development platform is not,
// and a reading nobody can reproduce is not a reading anyone can trust.

const procStatSample = `cpu  1204512 3021 402118 88123456 12045 0 8123 4011 0 0
cpu0 301128 755 100529 22030864 3011 0 2030 1002 0 0
intr 123456789
ctxt 987654321
`

func TestParseCPUTimesReadsTheAggregateLine(t *testing.T) {
	times, err := parseCPUTimes(strings.NewReader(procStatSample))
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	if times.user != 1204512 || times.system != 402118 || times.idle != 88123456 {
		t.Fatalf("unexpected times: %+v", times)
	}
	if times.iowait != 12045 || times.steal != 4011 {
		t.Fatalf("iowait and steal must be read: %+v", times)
	}
}

func TestCPUTimesSinceExcludesIOWaitFromBusy(t *testing.T) {
	previous := cpuTimes{user: 100, system: 100, idle: 700, iowait: 100}
	// 200 more busy jiffies, 700 idle, 100 iowait: 1000 elapsed.
	current := cpuTimes{user: 250, system: 150, idle: 1400, iowait: 200}
	busy, iowait, steal := current.since(previous)
	if busy < 0.19 || busy > 0.21 {
		t.Fatalf("busy should be 0.2, got %v", busy)
	}
	if iowait < 0.09 || iowait > 0.11 {
		t.Fatalf("iowait should be 0.1, got %v", iowait)
	}
	if steal != 0 {
		t.Fatalf("steal should be zero, got %v", steal)
	}
}

// A counter that has not moved cannot produce a rate, and reporting 0% for it
// would claim the host was idle.
func TestCPUTimesSinceReportsUnknownWithoutElapsedTime(t *testing.T) {
	same := cpuTimes{user: 10, idle: 90}
	busy, iowait, steal := same.since(same)
	if busy != -1 || iowait != -1 || steal != -1 {
		t.Fatalf("an unchanged counter must be unknown, got %v %v %v", busy, iowait, steal)
	}
}

const meminfoSample = `MemTotal:       32780476 kB
MemFree:         1204512 kB
MemAvailable:   18023456 kB
SwapTotal:       2097148 kB
SwapFree:        2000000 kB
`

func TestParseMemoryReadsSwapAndAvailable(t *testing.T) {
	memory, err := parseMemory(strings.NewReader(meminfoSample))
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	if memory.total != 32780476*1024 || memory.available != 18023456*1024 {
		t.Fatalf("unexpected memory: %+v", memory)
	}
	if memory.swapTotal != 2097148*1024 || memory.swapFree != 2000000*1024 {
		t.Fatalf("unexpected swap: %+v", memory)
	}
}

func TestParseMemoryRejectsAFileWithoutATotal(t *testing.T) {
	if _, err := parseMemory(strings.NewReader("Committed_AS: 12 kB\n")); err == nil {
		t.Fatal("a meminfo with no MemTotal is not a reading")
	}
}

func TestParseProcessCountReadsTheFourthField(t *testing.T) {
	count, err := parseProcessCount("0.52 0.58 0.59 3/1284 90211")
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	if count != 1284 {
		t.Fatalf("expected 1284 processes, got %d", count)
	}
}

const netDevSample = `Inter-|   Receive                                                |  Transmit
 face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop
    lo: 8123456   40211    0    0    0     0          0         0  8123456   40211    0    0
  ens3: 91203344  204118    3    9    0     0          0         0 41203344  118002    1    2
veth9a1: 1024      12       0    0    0     0          0         0     2048      14    0    0
docker0: 4096      40       0    0    0     0          0         0     8192      44    0    0
`

// Loopback and the per-container veths are noise on a node with fifty
// containers, and they bury the link an operator actually asked about.
func TestParseInterfacesKeepsOnlyRealLinks(t *testing.T) {
	interfaces, err := parseInterfaces(strings.NewReader(netDevSample))
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	if len(interfaces) != 1 {
		t.Fatalf("expected one interface, got %d: %+v", len(interfaces), interfaces)
	}
	link := interfaces[0]
	if link.Name != "ens3" {
		t.Fatalf("expected ens3, got %q", link.Name)
	}
	if link.ReceivedBytes != 91203344 || link.SentBytes != 41203344 {
		t.Fatalf("byte counters are misaligned: %+v", link)
	}
	if link.ReceiveErrors != 3 || link.ReceiveDropped != 9 || link.SendErrors != 1 || link.SendDropped != 2 {
		t.Fatalf("error counters are misaligned: %+v", link)
	}
}

const diskstatsSample = `   7       0 loop0 0 0 0 0 0 0 0 0 0 0 0
 259       0 nvme0n1 204118 3011 8123456 40211 118002 2044 4123456 20114 0 1 1
 259       1 nvme0n1p1 1024 0 8192 12 512 0 4096 8 0 1 1
   8       0 sda 1000 0 2000 10 500 0 1000 5 0 1 1
   8       1 sda1 10 0 20 1 5 0 10 1 0 1 1
`

func TestParseDisksKeepsWholeDisksOnly(t *testing.T) {
	disks, err := parseDisks(strings.NewReader(diskstatsSample))
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	names := make([]string, 0, len(disks))
	for _, disk := range disks {
		names = append(names, disk.Device)
	}
	if strings.Join(names, ",") != "nvme0n1,sda" {
		t.Fatalf("expected whole disks only, got %v", names)
	}
	if disks[0].ReadBytes != 8123456*512 || disks[0].WriteBytes != 4123456*512 {
		t.Fatalf("sectors must be converted to bytes: %+v", disks[0])
	}
}

func TestSkippedDiskDistinguishesPartitionsFromDisks(t *testing.T) {
	for _, name := range []string{"sda1", "hdb2", "vda1", "xvdf3", "nvme0n1p1", "mmcblk0p2", "loop3", "dm-0", "ram0"} {
		if !skippedDisk(name) {
			t.Fatalf("%q should be skipped", name)
		}
	}
	for _, name := range []string{"sda", "nvme0n1", "vdb", "mmcblk0", "xvdf"} {
		if skippedDisk(name) {
			t.Fatalf("%q is a whole disk and must be measured", name)
		}
	}
}

const mountsSample = `sysfs /sys sysfs rw,nosuid 0 0
/dev/nvme0n1p2 / ext4 rw,relatime 0 0
tmpfs /run tmpfs rw,nosuid 0 0
/dev/nvme0n1p3 /var/lib/docker xfs rw,relatime 0 0
overlay /var/lib/docker/overlay2/abc/merged overlay rw 0 0
/dev/sdb1 /mnt/backup\040volume ext4 rw 0 0
`

// A full /var/lib/docker beside a comfortable / is the ordinary way a node
// runs out of room, and one root-disk number cannot show it.
func TestParseMountsKeepsFilesystemsThatCanFillUp(t *testing.T) {
	mounts := parseMounts(strings.NewReader(mountsSample))
	if len(mounts) != 3 {
		t.Fatalf("expected three real filesystems, got %d: %+v", len(mounts), mounts)
	}
	if mounts[1].path != "/var/lib/docker" || mounts[1].fstype != "xfs" {
		t.Fatalf("the Docker filesystem must be measured: %+v", mounts[1])
	}
	if mounts[2].path != "/mnt/backup volume" {
		t.Fatalf("octal escapes must be decoded, got %q", mounts[2].path)
	}
}

func TestContainerCPURatioIsAShareOfTheWholeMachine(t *testing.T) {
	var stats dockerapi.ContainerStats
	stats.CPUStats.OnlineCPUs = 4
	stats.CPUStats.CPUUsage.TotalUsage = 2_000_000_000
	stats.PreCPUStats.CPUUsage.TotalUsage = 1_000_000_000
	// Four cores busy for one second is 4e9ns of system time.
	stats.CPUStats.SystemCPUUsage = 8_000_000_000
	stats.PreCPUStats.SystemCPUUsage = 4_000_000_000
	// One core-second out of four core-seconds is a quarter of the machine.
	if ratio := containerCPURatio(stats); ratio < 0.24 || ratio > 0.26 {
		t.Fatalf("expected about 0.25 of the machine, got %v", ratio)
	}
}

// Docker's first sample for a just-started container has no previous reading.
// Zero would draw as an idle container, which is a different claim.
func TestContainerCPURatioIsUnknownWithoutAPreviousSample(t *testing.T) {
	var stats dockerapi.ContainerStats
	stats.CPUStats.OnlineCPUs = 2
	stats.CPUStats.CPUUsage.TotalUsage = 500
	if ratio := containerCPURatio(stats); ratio != -1 {
		t.Fatalf("expected unknown, got %v", ratio)
	}
}

// Docker publishes no slot label. The replica number lives in the middle of
// the task name, and a global service has a node id there instead.
func TestTaskSlotIsReadFromTheTaskName(t *testing.T) {
	if got := taskSlot("verifystack_api.2.n6ub6xzd92emj2j8ng050c61r"); got != "2" {
		t.Fatalf("expected slot 2, got %q", got)
	}
	if got := taskSlot("monitor_agent.xma9yfjyundm1f1zoevwy945r.abc123"); got != "" {
		t.Fatalf("a global task has no slot, got %q", got)
	}
	if got := taskSlot("standalone-container"); got != "" {
		t.Fatalf("a plain container has no slot, got %q", got)
	}
}
