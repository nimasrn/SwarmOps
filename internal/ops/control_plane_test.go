package ops

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
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

func (r *recordingRunner) RunInput(_ context.Context, _ string, input io.Reader, args ...string) (string, error) {
	_, _ = io.ReadAll(input)
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
	store, err := audit.Open(t.TempDir(), bytes.Repeat([]byte{11}, 32))
	if err != nil {
		t.Fatal(err)
	}
	asset := filepath.Join(t.TempDir(), "traefik.yml")
	if err := os.WriteFile(asset, []byte(`version: "3.9"
services:
  traefik:
    image: ${TRAEFIK_IMAGE:-traefik:v3.6.13}
    command:
      - --certificatesresolvers.le.acme.email=${TRAEFIK_ACME_EMAIL:?set TRAEFIK_ACME_EMAIL}
configs:
  traefik_dynamic:
    file: ../traefik/dynamic.yml
    name: ${TRAEFIK_DYNAMIC_CONFIG_NAME:-nim_traefik_dynamic_v1}
`), 0o600); err != nil {
		t.Fatal(err)
	}
	control := NewControlPlane(nil, DockerCLI{Runner: runner}, store, ControlPlaneOptions{
		DataDir:          t.TempDir(),
		Mutations:        true,
		TraefikSettings:  testTraefikSettings(),
		TraefikStackFile: asset,
	})
	if err := control.ReconcileTraefik(context.Background(), "operator", "request", "wrong"); err == nil {
		t.Fatal("reconcile without exact confirmation succeeded")
	}
	if err := control.ReconcileTraefik(context.Background(), "operator", "request", "DEPLOY_TRAEFIK"); err != nil {
		t.Fatalf("reconcile: %v", err)
	}
	if got := fmt.Sprint(runner.calls); got != "[[stack deploy --detach=false --compose-file - traefik]]" {
		t.Fatalf("command = %s", got)
	}
}

func TestLogsCollectionRequiresConfiguredAsset(t *testing.T) {
	t.Parallel()
	store, err := audit.Open(t.TempDir(), bytes.Repeat([]byte{11}, 32))
	if err != nil {
		t.Fatal(err)
	}
	control := NewControlPlane(nil, DockerCLI{Runner: &recordingRunner{}}, store, ControlPlaneOptions{DataDir: t.TempDir(), Mutations: true})
	if err := control.LogsCollection(context.Background(), "operator", "request", true, ""); err == nil {
		t.Fatal("log collection without configured asset succeeded")
	}
}

func TestTrustedStackDeployPropagatesConfiguredRegistryAuth(t *testing.T) {
	t.Parallel()
	runner := &recordingRunner{}
	control := NewControlPlane(nil, DockerCLI{ConfigDir: "/tmp/registry", Runner: runner}, nil, ControlPlaneOptions{})
	if err := control.deployTrustedContent(context.Background(), []byte("version: '3.9'\nservices: {}\n"), "swarmops-agent"); err != nil {
		t.Fatal(err)
	}
	if len(runner.calls) != 1 || !strings.Contains(strings.Join(runner.calls[0], " "), "--with-registry-auth") {
		t.Fatalf("trusted deployment did not propagate registry auth: %#v", runner.calls)
	}
}

func testTraefikSettings() TraefikStackSettings {
	return TraefikStackSettings{
		ACMEEmail:           "ops@example.com",
		ArvanAPIKeySecret:   "traefik_arvan_api_key_v1",
		CFDNSTokenSecret:    "traefik_cf_dns_token_v1",
		DashboardAuthSecret: "traefik_dashboard_auth_v1",
		DashboardHost:       "traefik.example.com",
		DynamicConfigName:   "nim_traefik_dynamic_v1",
		Image:               "traefik:v3.6.13",
	}
}
