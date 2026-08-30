//go:build darwin

package agent

import (
	"syscall"

	"github.com/nimasrn/SwarmOps/internal/agentcontrol"
)

// macOS is a development platform for this agent, not a production one: every
// released node runs Linux. What it can answer honestly, it answers; what it
// cannot, it leaves as "unknown" rather than as zero.
//
// The distinction matters. A host reporting 0% CPU and a host that cannot
// measure CPU look identical on a chart, and only one of them is idle — so
// utilisation stays at the -1 the collector already set, and the console
// renders that as an absence.

func (c *MetricsCollector) mountPoints() []mountPoint {
	count, err := syscall.Getfsstat(nil, MNT_NOWAIT)
	if err != nil || count <= 0 {
		return nil
	}
	buffer := make([]syscall.Statfs_t, count)
	count, err = syscall.Getfsstat(buffer, MNT_NOWAIT)
	if err != nil {
		return nil
	}
	out := make([]mountPoint, 0, count)
	for _, entry := range buffer[:count] {
		fstype := charsToString(entry.Fstypename[:])
		if !realFilesystem(fstype) {
			continue
		}
		out = append(out, mountPoint{
			device: charsToString(entry.Mntfromname[:]),
			path:   charsToString(entry.Mntonname[:]),
			fstype: fstype,
		})
		if len(out) >= agentcontrol.MaxMetricMounts {
			break
		}
	}
	return out
}

// MNT_NOWAIT asks for cached statistics rather than forcing every mounted
// filesystem to be queried, which on a laptop with network mounts can block.
const MNT_NOWAIT = 2

// Memory, load and CPU utilisation come from mach calls that Go's syscall
// package does not export, and this agent takes no dependency for a platform
// it does not ship on. They stay unknown here, and the filesystem capacity
// above is what a macOS host actually reports.
func supplementHost(*agentcontrol.HostMetrics, Config) {}

func charsToString(value []int8) string {
	bytes := make([]byte, 0, len(value))
	for _, char := range value {
		if char == 0 {
			break
		}
		bytes = append(bytes, byte(char))
	}
	return string(bytes)
}
