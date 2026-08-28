// Package ops owns the explicit, audited write operations. It never forwards
// arbitrary client commands to Docker; each action has a fixed command shape.
package ops

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"os/exec"
)

const commandOutputLimit = 256 << 10

var ErrOutputLimit = errors.New("command output exceeded limit")

type Runner interface {
	Run(ctx context.Context, name string, args ...string) (string, error)
}

// InputRunner is used only for reviewed Docker commands that read a validated
// Compose document from standard input. It deliberately does not expose a
// general remote shell or a caller-selected executable.
type InputRunner interface {
	RunInput(ctx context.Context, name string, input io.Reader, args ...string) (string, error)
}

type OSRunner struct{}

func (OSRunner) Run(ctx context.Context, name string, args ...string) (string, error) {
	return runCommand(ctx, nil, name, args...)
}

func (OSRunner) RunInput(ctx context.Context, name string, input io.Reader, args ...string) (string, error) {
	return runCommand(ctx, input, name, args...)
}

func runCommand(ctx context.Context, input io.Reader, name string, args ...string) (string, error) {
	buffer := &limitedBuffer{limit: commandOutputLimit}
	command := exec.CommandContext(ctx, name, args...)
	command.Stdin = input
	command.Stdout = buffer
	command.Stderr = buffer
	err := command.Run()
	if errors.Is(buffer.err, ErrOutputLimit) {
		return buffer.String(), ErrOutputLimit
	}
	if err != nil {
		return buffer.String(), fmt.Errorf("run %s: %w", name, err)
	}
	return buffer.String(), nil
}

type DockerCLI struct {
	Binary    string
	ConfigDir string
	Runner    Runner
	Socket    string
}

func (d DockerCLI) Run(ctx context.Context, args ...string) (string, error) {
	if d.Runner == nil {
		return "", fmt.Errorf("command runner is required")
	}
	binary := d.Binary
	if binary == "" {
		binary = "docker"
	}
	base := make([]string, 0, len(args)+2)
	if d.ConfigDir != "" {
		base = append(base, "--config", d.ConfigDir)
	}
	if d.Socket != "" {
		base = append(base, "--host", "unix://"+d.Socket)
	}
	base = append(base, args...)
	return d.Runner.Run(ctx, binary, base...)
}

// RunInput runs the same bounded Docker CLI path while feeding a reviewed
// document through stdin. This avoids writing browser-provided Compose content
// to the remote server filesystem when the Engine is reached through the
// machine API.
func (d DockerCLI) RunInput(ctx context.Context, input io.Reader, args ...string) (string, error) {
	if d.Runner == nil {
		return "", fmt.Errorf("command runner is required")
	}
	runner, ok := d.Runner.(InputRunner)
	if !ok {
		return "", fmt.Errorf("command runner does not support standard input")
	}
	binary := d.Binary
	if binary == "" {
		binary = "docker"
	}
	base := make([]string, 0, len(args)+2)
	if d.ConfigDir != "" {
		base = append(base, "--config", d.ConfigDir)
	}
	if d.Socket != "" {
		base = append(base, "--host", "unix://"+d.Socket)
	}
	base = append(base, args...)
	return runner.RunInput(ctx, binary, input, base...)
}

type limitedBuffer struct {
	buffer bytes.Buffer
	err    error
	limit  int
}

func (b *limitedBuffer) Write(value []byte) (int, error) {
	remaining := b.limit - b.buffer.Len()
	if remaining <= 0 {
		b.err = ErrOutputLimit
		return 0, ErrOutputLimit
	}
	if len(value) > remaining {
		_, _ = b.buffer.Write(value[:remaining])
		b.err = ErrOutputLimit
		return remaining, ErrOutputLimit
	}
	return b.buffer.Write(value)
}

func (b *limitedBuffer) String() string { return b.buffer.String() }
