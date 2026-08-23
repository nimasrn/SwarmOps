package ops

import (
	"context"
	"strings"
	"testing"
)

func TestStackDeployPropagatesConfiguredRegistryAuth(t *testing.T) {
	t.Parallel()
	runner := &captureRunner{}
	deployer := StackDeployer{
		CLI:     DockerCLI{ConfigDir: "/tmp/registry", Runner: runner},
		DataDir: t.TempDir(),
		Enabled: true,
	}
	if _, err := deployer.Deploy(context.Background(), "example", []byte(validCompose)); err != nil {
		t.Fatal(err)
	}
	if len(runner.calls) != 2 {
		t.Fatalf("calls = %#v", runner.calls)
	}
	if got := strings.Join(runner.calls[1], " "); !strings.Contains(got, "--with-registry-auth") {
		t.Fatalf("deploy did not propagate registry auth: %s", got)
	}
}
