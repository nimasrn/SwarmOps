// Package ops owns the explicit, audited write operations. It never forwards
// arbitrary client commands to Docker; each action has a fixed command shape.
package ops

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"os/exec"
)

const commandOutputLimit = 256 << 10

var ErrOutputLimit = errors.New("command output exceeded limit")

type Runner interface {
	Run(ctx context.Context, name string, args ...string) (string, error)
}

type OSRunner struct{}

func (OSRunner) Run(ctx context.Context, name string, args ...string) (string, error) {
	buffer := &limitedBuffer{limit: commandOutputLimit}
	command := exec.CommandContext(ctx, name, args...)
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
