package apihttp

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/nimasrn/SwarmOps/internal/agentcontrol"
	"github.com/nimasrn/SwarmOps/internal/domain"
	"github.com/nimasrn/SwarmOps/internal/remote"
)

func sampleMetrics() agentcontrol.MachineMetrics {
	return agentcontrol.MachineMetrics{
		CollectedAt:     time.Date(2026, 8, 30, 12, 0, 0, 0, time.UTC),
		DockerAvailable: true,
		Host: agentcontrol.HostMetrics{
			CPUCores: 8, CPUUsedRatio: 0.61, CPUIOWaitRatio: 0.02, CPUStealRatio: -1,
			Load1: 4.9, MemoryTotal: 34359738368, MemoryUsed: 24051816857, UptimeSeconds: 2937600,
			Filesystems: []agentcontrol.FilesystemMetrics{{Mount: "/var/lib/docker", Device: "/dev/nvme0n1p3", FSType: "xfs", TotalBytes: 512, UsedBytes: 256}},
			Interfaces:  []agentcontrol.InterfaceMetrics{{Name: "ens3", ReceivedBytes: 91203344, SentBytes: 41203344}},
			Disks:       []agentcontrol.DiskMetrics{{Device: "nvme0n1", ReadBytes: 1024, WriteBytes: 2048}},
		},
		Containers: []agentcontrol.ContainerMetrics{
			{ID: "c1f2a3b4c5d6", Name: "production_checkout.1", Image: "checkout:41ab77c", State: "running",
				Service: "production_checkout", Stack: "production-checkout-api", TaskSlot: "1",
				CPUUsedRatio: 0.184, CPUUsageSeconds: 1204.5, MemoryUsed: 2040109465, MemoryLimit: 2147483648},
			{ID: "d2e3f4a5b6c7", Name: "traefik.1", CPUUsedRatio: -1, CPUUsageSeconds: 4.2},
		},
	}
}

func renderSample(t *testing.T, namespace string) string {
	t.Helper()
	metrics := sampleMetrics()
	now := metrics.CollectedAt.Add(3 * time.Second)
	metrics.Sanitize(metrics.CollectedAt)
	server := domain.Server{ID: "srv-1", Name: "node-2"}
	return renderMachineMetrics(server, metrics, metrics.CollectedAt, now, namespace)
}

func TestRenderMachineMetricsLabelsEverySeriesWithItsMachine(t *testing.T) {
	output := renderSample(t, "production")
	for _, want := range []string{
		`swarmops_machine_up{machine="srv-1",node="node-2"} 1`,
		`swarmops_machine_cpu_used_ratio{machine="srv-1",node="node-2"} 0.61`,
		`swarmops_machine_load1{machine="srv-1",node="node-2"} 4.9`,
		`swarmops_machine_filesystem_total_bytes{machine="srv-1",node="node-2",mount="/var/lib/docker",device="/dev/nvme0n1p3",fstype="xfs"} 512`,
		`swarmops_machine_network_receive_bytes_total{machine="srv-1",node="node-2",device="ens3"} 9.1203344e+07`,
		`swarmops_machine_disk_write_bytes_total{machine="srv-1",node="node-2",device="nvme0n1"} 2048`,
	} {
		if !strings.Contains(output, want) {
			t.Fatalf("missing series:\n%s\nin:\n%s", want, output)
		}
	}
}

// A machine that could not measure steal time has not had zero steal. The
// series is omitted so the chart shows a gap, which is what "unknown" looks
// like; -1 would draw as a negative and 0 as a claim.
func TestRenderMachineMetricsOmitsRatiosItCouldNotMeasure(t *testing.T) {
	output := renderSample(t, "production")
	if strings.Contains(output, "swarmops_machine_cpu_steal_ratio") {
		t.Fatalf("an unmeasured host ratio must be absent, got:\n%s", output)
	}
	if strings.Contains(output, `swarmops_container_cpu_used_ratio{machine="srv-1",node="node-2",container="d2e3f4a5b6c7"`) {
		t.Fatalf("an unmeasured container ratio must be absent, got:\n%s", output)
	}
	if !strings.Contains(output, `swarmops_container_cpu_usage_seconds_total{machine="srv-1",node="node-2",container="d2e3f4a5b6c7",name="traefik.1"} 4.2`) {
		t.Fatalf("the counter for that container must still be present, got:\n%s", output)
	}
}

// The stack label Docker writes is namespace-prefixed. An operator asks about
// the application, and Core is the only side that knows the namespace.
func TestRenderMachineMetricsDerivesTheApplicationFromTheStack(t *testing.T) {
	output := renderSample(t, "production")
	if !strings.Contains(output, `application="checkout-api"`) {
		t.Fatalf("expected the application label, got:\n%s", output)
	}
	// With no reviewed namespace there is nothing to strip and nothing to
	// claim, so the label is left off rather than guessed.
	if strings.Contains(renderSample(t, ""), "application=") {
		t.Fatal("without a namespace no application may be asserted")
	}
}

func TestRenderMachineMetricsDeclaresEachFamilyOnce(t *testing.T) {
	output := renderSample(t, "production")
	if count := strings.Count(output, "# TYPE swarmops_container_up "); count != 1 {
		t.Fatalf("a family must be declared exactly once, got %d", count)
	}
	if count := strings.Count(output, "swarmops_container_up{"); count != 2 {
		t.Fatalf("expected one sample per container, got %d", count)
	}
}

func TestMachineMetricsTargetsListOnlyConnectedAgents(t *testing.T) {
	targets := machineMetricsTargets([]domain.Server{
		{ID: "srv-1", Name: "node-1", ConnectionType: remote.ConnectionAgentPull, ConnectionState: remote.ConnectionConnected},
		{ID: "srv-2", Name: "node-2", ConnectionType: remote.ConnectionAgentPull, ConnectionState: "disconnected"},
		{ID: "srv-3", Name: "legacy", ConnectionType: remote.ConnectionSSH, ConnectionState: remote.ConnectionConnected},
		{ID: "srv-4", Name: "node-4", ConnectionType: remote.ConnectionAgentAPI, ConnectionState: remote.ConnectionConnected},
	})
	if len(targets) != 2 {
		t.Fatalf("expected the two connected agents, got %+v", targets)
	}
	for _, target := range targets {
		if len(target.Targets) != 1 || target.Targets[0] != controlPlaneInternalTarget {
			t.Fatalf("a machine scrape terminates on the controller, got %+v", target.Targets)
		}
		if !strings.HasPrefix(target.Labels["__metrics_path__"], "/metrics/machines/") {
			t.Fatalf("the machine must be carried in the path, got %+v", target.Labels)
		}
	}
}

// Prometheus scrapes on its own schedule and the console reads the same
// machines. Neither should turn into a queue of agent round trips.
func TestMachineMetricsCacheCollapsesConcurrentScrapes(t *testing.T) {
	cache := newMachineMetricsCache()
	var calls atomic.Int64
	release := make(chan struct{})
	fetch := func(context.Context) (agentcontrol.MachineMetrics, error) {
		calls.Add(1)
		<-release
		return sampleMetrics(), nil
	}

	var wait sync.WaitGroup
	for range 8 {
		wait.Add(1)
		go func() {
			defer wait.Done()
			_, _, _ = cache.get(context.Background(), "srv-1", time.Now().UTC(), fetch)
		}()
	}
	time.Sleep(50 * time.Millisecond)
	close(release)
	wait.Wait()

	if got := calls.Load(); got != 1 {
		t.Fatalf("eight concurrent scrapes must become one agent round trip, got %d", got)
	}
}

// A refresh that fails does not erase what was last measured: the machine's
// own page must be able to say when it was last seen.
func TestMachineMetricsCacheKeepsTheLastGoodSampleThroughAFailure(t *testing.T) {
	cache := newMachineMetricsCache()
	good := func(context.Context) (agentcontrol.MachineMetrics, error) { return sampleMetrics(), nil }
	bad := func(context.Context) (agentcontrol.MachineMetrics, error) {
		return agentcontrol.MachineMetrics{}, errors.New("agent stopped polling")
	}

	first := time.Now().UTC()
	if _, _, err := cache.get(context.Background(), "srv-1", first, good); err != nil {
		t.Fatalf("first sample: %v", err)
	}
	metrics, fetchedAt, err := cache.get(context.Background(), "srv-1", first.Add(time.Minute), bad)
	if err == nil {
		t.Fatal("the failure must be reported")
	}
	if metrics.Host.CPUCores != 8 {
		t.Fatalf("the previous reading must survive, got %+v", metrics.Host)
	}
	if fetchedAt.After(first.Add(30 * time.Second)) {
		t.Fatalf("the retained sample must keep its real age, got %v", fetchedAt)
	}
}

func TestMachineMetricsCacheServesAFreshSampleWithoutRefetching(t *testing.T) {
	cache := newMachineMetricsCache()
	var calls atomic.Int64
	fetch := func(context.Context) (agentcontrol.MachineMetrics, error) {
		calls.Add(1)
		return sampleMetrics(), nil
	}
	now := time.Now().UTC()
	for range 3 {
		if _, _, err := cache.get(context.Background(), "srv-1", now, fetch); err != nil {
			t.Fatalf("get: %v", err)
		}
	}
	if got := calls.Load(); got != 1 {
		t.Fatalf("a sample inside the freshness window must be reused, got %d calls", got)
	}
}

// A join is queued with the MANAGER it should join, never with the credential.
// Everything below is what keeps a token out of the sealed ledger.

func TestReadinessSubmissionRequiresAJoinSourceAndRole(t *testing.T) {
	servers := []domain.Server{{ID: "srv-1", Name: "node-1"}, {ID: "srv-2", Name: "node-2"}}
	base := serverReadinessCommand{ProvisioningRequest: agentcontrol.ProvisioningRequest{
		Confirmation: agentcontrol.ProvisionConfirmation, JoinSwarm: true,
	}}

	if err := base.validateSubmission(servers, "srv-2"); err == nil {
		t.Fatal("a join with no role must be refused")
	}
	withRole := base
	withRole.JoinRole = "manager"
	if err := withRole.validateSubmission(servers, "srv-2"); err == nil {
		t.Fatal("a join with no source manager must be refused")
	}
	itself := withRole
	itself.JoinFromServerID = "srv-2"
	if err := itself.validateSubmission(servers, "srv-2"); err == nil {
		t.Fatal("a machine cannot join itself")
	}
	unknown := withRole
	unknown.JoinFromServerID = "srv-9"
	if err := unknown.validateSubmission(servers, "srv-2"); err == nil {
		t.Fatal("an unmanaged machine cannot be a join source")
	}
	complete := withRole
	complete.JoinFromServerID = "srv-1"
	if err := complete.validateSubmission(servers, "srv-2"); err != nil {
		t.Fatalf("a complete join submission must be accepted: %v", err)
	}
}

func TestReadinessSubmissionRefusesAJoinTokenFromTheBrowser(t *testing.T) {
	servers := []domain.Server{{ID: "srv-1"}, {ID: "srv-2"}}
	carrying := serverReadinessCommand{
		ProvisioningRequest: agentcontrol.ProvisioningRequest{
			Confirmation: agentcontrol.ProvisionConfirmation, JoinSwarm: true,
			JoinToken: "SWMTKN-1-abcdefghijklmnopqrstuvwxyz-0123456789abcdef",
		},
		JoinFromServerID: "srv-1", JoinRole: "manager",
	}
	if err := carrying.validateSubmission(servers, "srv-2"); err == nil {
		t.Fatal("a submitted readiness plan must never carry a join token")
	}
}

func TestReadinessSubmissionRefusesAJoinSourceWithoutTheJoinOperation(t *testing.T) {
	servers := []domain.Server{{ID: "srv-1"}, {ID: "srv-2"}}
	stray := serverReadinessCommand{
		ProvisioningRequest: agentcontrol.ProvisioningRequest{
			Confirmation: agentcontrol.ProvisionConfirmation, UpdateOS: true,
		},
		JoinFromServerID: "srv-1",
	}
	if err := stray.validateSubmission(servers, "srv-2"); err == nil {
		t.Fatal("a join source without the join operation must be refused")
	}
}

// The queued payload is the thing that gets sealed and kept. It must decode
// what earlier releases wrote, and it must never contain a credential.
func TestReadinessPayloadStaysCompatibleAndCarriesNoToken(t *testing.T) {
	legacy := []byte(`{"confirmation":"PREPARE_SERVER","installDocker":true,"initializeSwarm":true}`)
	var decoded serverReadinessCommand
	if err := json.Unmarshal(legacy, &decoded); err != nil {
		t.Fatalf("a payload from an earlier release must still decode: %v", err)
	}
	if !decoded.InstallDocker || !decoded.InitializeSwarm {
		t.Fatalf("the earlier fields must survive: %+v", decoded)
	}

	queued := serverReadinessCommand{
		ProvisioningRequest: agentcontrol.ProvisioningRequest{
			Confirmation: agentcontrol.ProvisionConfirmation, JoinSwarm: true,
		},
		JoinFromServerID: "srv-1", JoinRole: "worker",
	}
	encoded, err := json.Marshal(queued)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	if strings.Contains(string(encoded), "joinToken") || strings.Contains(string(encoded), "SWMTKN") {
		t.Fatalf("no join credential may reach the ledger: %s", encoded)
	}
}
