package ops

import (
	"context"
	"fmt"
	"io"
	"testing"
)

type captureRunner struct{ calls [][]string }

func (r *captureRunner) Run(_ context.Context, _ string, args ...string) (string, error) {
	r.calls = append(r.calls, args)
	return "", nil
}

func (r *captureRunner) RunInput(_ context.Context, _ string, input io.Reader, args ...string) (string, error) {
	_, _ = io.ReadAll(input)
	r.calls = append(r.calls, args)
	return "", nil
}

func TestDockerCLIPassesOnlyConfiguredRegistryDirectory(t *testing.T) {
	t.Parallel()
	runner := &captureRunner{}
	cli := DockerCLI{ConfigDir: "/tmp/registry", Runner: runner, Socket: "/var/run/docker.sock"}
	if _, err := cli.Run(context.Background(), "stack", "ls"); err != nil {
		t.Fatal(err)
	}
	if got, want := fmt.Sprint(runner.calls), "[[--config /tmp/registry --host unix:///var/run/docker.sock stack ls]]"; got != want {
		t.Fatalf("args = %s, want %s", got, want)
	}
}
