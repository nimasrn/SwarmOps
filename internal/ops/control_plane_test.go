package ops

import (
	"context"
	"fmt"
	"testing"

	"github.com/nimasrn/SwarmOps/internal/agent"
	"github.com/nimasrn/SwarmOps/internal/audit"
	"github.com/nimasrn/SwarmOps/internal/domain"
)

type recordingRunner struct{ calls [][]string }

func (r *recordingRunner) Run(_ context.Context, _ string, args ...string) (string, error) {
	r.calls = append(r.calls, args)
	return "", nil
}

func TestApplySnapshotKeepsLoadSeparateFromCPUCapacity(t *testing.T) {
	t.Parallel()
	node := domain.Node{}
	applySnapshot(&node, agent.Snapshot{Hardware: agent.Hardware{CPUCores: 4, Load1: 2.75}})
	if node.CPU.Capacity != 4 || node.CPU.Available != 4 || node.CPU.Used != 0 {
		t.Fatalf("CPU capacity = %#v, want capacity-only four cores", node.CPU)
	}
	if node.Load1 != 2.75 {
		t.Fatalf("Load1 = %v, want 2.75", node.Load1)
	}
}

func TestReconcileTraefikUsesOnlyConfiguredAsset(t *testing.T) {
	t.Parallel()
	runner := &recordingRunner{}
	store, err := audit.Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	control := NewControlPlane(nil, DockerCLI{Runner: runner}, store, nil, "", true, t.TempDir(), "", "", "/opt/swarmops/traefik.yml")
	if err := control.ReconcileTraefik(context.Background(), "operator", "request", "wrong"); err == nil {
		t.Fatal("reconcile without exact confirmation succeeded")
	}
	if err := control.ReconcileTraefik(context.Background(), "operator", "request", "DEPLOY_TRAEFIK"); err != nil {
		t.Fatalf("reconcile: %v", err)
	}
	if got := fmt.Sprint(runner.calls); got != "[[stack deploy --detach=false --compose-file /opt/swarmops/traefik.yml traefik]]" {
		t.Fatalf("command = %s", got)
	}
}

func TestLogsCollectionRequiresConfiguredAsset(t *testing.T) {
	t.Parallel()
	store, err := audit.Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	control := NewControlPlane(nil, DockerCLI{Runner: &recordingRunner{}}, store, nil, "", true, t.TempDir(), "", "", "")
	if err := control.LogsCollection(context.Background(), "operator", "request", true, ""); err == nil {
		t.Fatal("log collection without configured asset succeeded")
	}
}
