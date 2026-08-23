package ops

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/nimasrn/SwarmOps/internal/domain"
)

type StackDeployer struct {
	CLI     DockerCLI
	DataDir string
	Enabled bool
}

func (d StackDeployer) Validate(raw []byte) (domain.ComposePlan, error) {
	return ValidateCompose(raw)
}

func (d StackDeployer) Deploy(ctx context.Context, name string, raw []byte) (domain.ComposePlan, error) {
	if !d.Enabled {
		return domain.ComposePlan{}, fmt.Errorf("cluster mutations are disabled")
	}
	if !ValidStackName(name) {
		return domain.ComposePlan{}, fmt.Errorf("invalid stack name")
	}
	plan, err := ValidateCompose(raw)
	if err != nil {
		return domain.ComposePlan{}, err
	}
	staging, err := os.MkdirTemp(d.DataDir, "stack-")
	if err != nil {
		return domain.ComposePlan{}, fmt.Errorf("create stack staging directory: %w", err)
	}
	defer os.RemoveAll(staging)
	file := filepath.Join(staging, "stack.yml")
	if err := os.WriteFile(file, raw, 0o600); err != nil {
		return domain.ComposePlan{}, fmt.Errorf("write staged stack: %w", err)
	}
	if _, err := d.CLI.Run(ctx, "stack", "config", "--compose-file", file); err != nil {
		return domain.ComposePlan{}, fmt.Errorf("render stack: %w", err)
	}
	deployArgs := []string{"stack", "deploy", "--detach=false", "--resolve-image=changed"}
	// A registry config is a mounted Swarm secret copied into a tmpfs-backed
	// Docker CLI directory at API startup. Propagate it only when one exists,
	// so private images can be pulled by workers without browser credentials.
	if d.CLI.ConfigDir != "" {
		deployArgs = append(deployArgs, "--with-registry-auth")
	}
	deployArgs = append(deployArgs, "--compose-file", file, name)
	if _, err := d.CLI.Run(ctx, deployArgs...); err != nil {
		return domain.ComposePlan{}, fmt.Errorf("deploy stack: %w", err)
	}
	return plan, nil
}

func serviceReference(id string) (string, error) {
	if strings.TrimSpace(id) == "" || strings.ContainsAny(id, "\r\n\x00") {
		return "", fmt.Errorf("invalid service identifier")
	}
	return id, nil
}
