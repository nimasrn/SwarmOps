//go:build linux

package agent

import (
	"os"

	"github.com/nimasrn/SwarmOps/internal/agentcontrol"
)

// mountPoints reads the kernel's own mount table. HostProc is honoured so the
// same code measures the real host when the agent is running inside a
// container with /proc bind-mounted read-only, which is how the overlay
// deployment already runs it.
func (c *MetricsCollector) mountPoints() []mountPoint {
	file, err := os.Open(firstReadable(c.config.HostProc, "1/mounts", "mounts"))
	if err != nil {
		return nil
	}
	defer file.Close()
	return parseMounts(file)
}

// Linux answers everything from /proc, so there is nothing to supplement.
func supplementHost(*agentcontrol.HostMetrics, Config) {}
