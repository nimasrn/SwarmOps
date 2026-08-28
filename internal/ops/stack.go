package ops

import (
	"bytes"
	"context"
	"fmt"
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
	// Docker accepts "-" as the Compose source. Supplying the already
	// validated document through stdin avoids staging browser content on the
	// target (and works unchanged for the optional local compatibility path).
	if _, err := d.CLI.RunInput(ctx, bytes.NewReader(raw), "stack", "config", "--compose-file", "-"); err != nil {
		return domain.ComposePlan{}, fmt.Errorf("render stack: %w", err)
	}
	deployArgs := []string{"stack", "deploy", "--detach=false", "--resolve-image=changed"}
	// A registry config is a mounted Swarm secret copied into a tmpfs-backed
	// Docker CLI directory at API startup. Propagate it only when one exists,
	// so private images can be pulled by workers without browser credentials.
	if d.CLI.ConfigDir != "" {
		deployArgs = append(deployArgs, "--with-registry-auth")
	}
	deployArgs = append(deployArgs, "--compose-file", "-", name)
	if _, err := d.CLI.RunInput(ctx, bytes.NewReader(raw), deployArgs...); err != nil {
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
