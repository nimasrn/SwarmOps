package agentcontrol

import (
	"math"
	"strings"
	"testing"
	"time"
)

// Sanitize is the trust boundary. Everything below is a thing a compromised or
// simply broken agent could send, and the requirement is that none of it can
// reach the exposition Core renders.

func TestSanitizeRejectsLabelValuesThatCouldBreakTheExposition(t *testing.T) {
	now := time.Now().UTC()
	sample := MachineMetrics{
		CollectedAt: now,
		Containers: []ContainerMetrics{
			{ID: "a1b2c3d4e5f6", Name: `evil" } 1
swarmops_machine_up{machine="node-1`},
			{ID: "b2c3d4e5f6a1", Name: "honest", Service: "svc\\one"},
			{ID: "c3d4e5f6a1b2", Name: "fine", Stack: "production"},
		},
		Host: HostMetrics{
			Filesystems: []FilesystemMetrics{{Mount: "/\" evil", TotalBytes: 10}, {Mount: "/var", TotalBytes: 10}},
			Interfaces:  []InterfaceMetrics{{Name: "ens3\nswarmops_machine_up 1"}, {Name: " ens4 "}},
		},
	}
	sample.Sanitize(now)

	for _, container := range sample.Containers {
		if strings.ContainsAny(container.Name+container.Service+container.Stack, "\"\\\n{}") {
			t.Fatalf("a name that can break the format survived: %q", container.Name)
		}
	}
	if len(sample.Host.Filesystems) != 1 || sample.Host.Filesystems[0].Mount != "/var" {
		t.Fatalf("a quoted mount must be dropped, got %+v", sample.Host.Filesystems)
	}
	// An embedded newline is the injection; surrounding whitespace is a typo,
	// and is trimmed rather than costing the host its network readings.
	if len(sample.Host.Interfaces) != 1 || sample.Host.Interfaces[0].Name != "ens4" {
		t.Fatalf("an interface carrying a newline must be dropped and a padded one kept, got %+v", sample.Host.Interfaces)
	}
}

// A container is identified by its Docker id. Anything that is not one is not
// a container, and is more likely an attempt to inject a label.
func TestSanitizeDropsContainersWithoutARealIdentifier(t *testing.T) {
	now := time.Now().UTC()
	sample := MachineMetrics{Containers: []ContainerMetrics{
		{ID: "not-a-docker-id", Name: "one"},
		{ID: "A1B2C3D4E5F6", Name: "two"},
		{ID: "", Name: "three"},
		{ID: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef", Name: "four"},
	}}
	sample.Sanitize(now)
	if len(sample.Containers) != 2 {
		t.Fatalf("expected the two real ids to survive, got %+v", sample.Containers)
	}
	ids := map[string]bool{}
	for _, container := range sample.Containers {
		if len(container.ID) != 12 {
			t.Fatalf("every id must be shortened to twelve characters, got %q", container.ID)
		}
		ids[container.ID] = true
	}
	if !ids["a1b2c3d4e5f6"] {
		t.Fatalf("an uppercase id must be lowercased, got %v", ids)
	}
	if !ids["0123456789ab"] {
		t.Fatalf("a full-length id must be shortened, got %v", ids)
	}
}

func TestSanitizeClampsRatiosAndTurnsNonsenseIntoUnknown(t *testing.T) {
	now := time.Now().UTC()
	sample := MachineMetrics{Host: HostMetrics{
		CPUUsedRatio:   math.NaN(),
		CPUIOWaitRatio: 14,
		CPUStealRatio:  math.Inf(1),
		Load1:          math.Inf(-1),
	}}
	sample.Sanitize(now)
	if sample.Host.CPUUsedRatio != -1 || sample.Host.CPUStealRatio != -1 {
		t.Fatalf("NaN and Inf must become unknown, got %+v", sample.Host)
	}
	if sample.Host.CPUIOWaitRatio != 1 {
		t.Fatalf("a ratio above one must clamp, got %v", sample.Host.CPUIOWaitRatio)
	}
	if sample.Host.Load1 != 0 {
		t.Fatalf("a negative load must clamp to zero, got %v", sample.Host.Load1)
	}
}

func TestSanitizeBoundsTheNumberOfContainers(t *testing.T) {
	now := time.Now().UTC()
	sample := MachineMetrics{}
	for index := range MaxMetricContainers + 50 {
		sample.Containers = append(sample.Containers, ContainerMetrics{
			ID:   strings.Repeat("a", 11) + string(rune("0123456789abcdef"[index%16])),
			Name: "c",
		})
	}
	sample.Sanitize(now)
	if len(sample.Containers) != MaxMetricContainers {
		t.Fatalf("expected the cap to apply, got %d", len(sample.Containers))
	}
	if !sample.ContainersTruncated {
		t.Fatal("a truncated sample must say so rather than silently reporting fewer containers")
	}
}

// A timestamp from an agent whose clock is wrong would make a fresh sample
// look stale or a stale one look fresh.
func TestSanitizeReplacesAnImpossibleTimestamp(t *testing.T) {
	now := time.Date(2026, 8, 30, 12, 0, 0, 0, time.UTC)
	sample := MachineMetrics{CollectedAt: now.Add(time.Hour)}
	sample.Sanitize(now)
	if !sample.CollectedAt.Equal(now) {
		t.Fatalf("a future timestamp must be replaced, got %v", sample.CollectedAt)
	}
}

func TestStaleUsesTheCollectionTime(t *testing.T) {
	now := time.Now().UTC()
	if (MachineMetrics{CollectedAt: now.Add(-10 * time.Second)}).Stale(now, time.Minute) {
		t.Fatal("a ten-second-old sample is not stale within a minute")
	}
	if !(MachineMetrics{}).Stale(now, time.Minute) {
		t.Fatal("a sample that was never collected is stale")
	}
}
