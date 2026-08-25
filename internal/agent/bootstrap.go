package agent

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/nimasrn/SwarmOps/internal/agentcontrol"
)

const bootstrapTimeout = 30 * time.Minute

// Bootstrapper owns the three reviewed host actions accepted after enrollment.
// It has no API for arbitrary packages, repositories, files, or shell text.
type Bootstrapper interface {
	Bootstrap(context.Context, agentcontrol.BootstrapRequest) (string, error)
}

// ManagerJoinTokenProvider is intentionally separate from Bootstrapper so a
// test or constrained deployment can allow fixed bootstrap actions without
// exposing the manager-only token operation. The token is returned only to an
// authenticated controller process and is never written to durable state.
type ManagerJoinTokenProvider interface {
	ManagerJoinToken(context.Context) (string, error)
}

type systemBootstrapper struct {
	hostOS string
}

func (b systemBootstrapper) Bootstrap(ctx context.Context, request agentcontrol.BootstrapRequest) (string, error) {
	if err := agentcontrol.ValidateBootstrapRequest(request); err != nil {
		return "", err
	}
	ctx, cancel := context.WithTimeout(ctx, bootstrapTimeout)
	defer cancel()
	switch request.Action {
	case agentcontrol.BootstrapDockerInstall:
		return b.installDocker(ctx)
	case agentcontrol.BootstrapSwarmInit:
		return b.initSwarm(ctx, request.AdvertiseAddr)
	case agentcontrol.BootstrapSwarmJoin:
		return b.joinSwarm(ctx, request.ManagerAddr, request.JoinToken)
	default:
		return "", fmt.Errorf("unsupported managed bootstrap action")
	}
}

func (b systemBootstrapper) installDocker(ctx context.Context) (string, error) {
	if _, err := exec.LookPath("docker"); err == nil {
		return "Docker Engine is already installed.", nil
	}
	if runtime.GOOS != "linux" {
		return "", fmt.Errorf("managed Docker installation supports Debian and Ubuntu Linux only")
	}
	osRelease, err := bootstrapOSRelease(b.hostOS)
	if err != nil {
		return "", err
	}
	id := strings.ToLower(osRelease["ID"])
	codename := strings.Trim(osRelease["VERSION_CODENAME"], `"`)
	if (id != "debian" && id != "ubuntu") || codename == "" {
		return "", fmt.Errorf("managed Docker installation supports Debian and Ubuntu Linux only")
	}
	var log strings.Builder
	if _, err := runBootstrapStep(ctx, &log, "apt-get", "update"); err != nil {
		return log.String(), err
	}
	if _, err := runBootstrapStep(ctx, &log, "apt-get", "install", "--yes", "--no-install-recommends", "ca-certificates", "curl", "gnupg"); err != nil {
		return log.String(), err
	}
	if err := os.MkdirAll("/etc/apt/keyrings", 0o755); err != nil {
		return log.String(), fmt.Errorf("create Docker keyring directory: %w", err)
	}
	keyPath := "/etc/apt/keyrings/docker.asc"
	if _, err := runBootstrapStep(ctx, &log, "curl", "--fail", "--silent", "--show-error", "--location", "https://download.docker.com/linux/"+id+"/gpg", "--output", keyPath); err != nil {
		return log.String(), err
	}
	if err := os.Chmod(keyPath, 0o644); err != nil {
		return log.String(), fmt.Errorf("protect Docker repository key: %w", err)
	}
	architecture, err := runBootstrapStep(ctx, &log, "dpkg", "--print-architecture")
	if err != nil {
		return log.String(), err
	}
	entry := fmt.Sprintf("deb [arch=%s signed-by=%s] https://download.docker.com/linux/%s %s stable\n", strings.TrimSpace(architecture), keyPath, id, codename)
	if err := os.WriteFile(filepath.Clean("/etc/apt/sources.list.d/docker.list"), []byte(entry), 0o644); err != nil {
		return log.String(), fmt.Errorf("write Docker repository configuration: %w", err)
	}
	if _, err := runBootstrapStep(ctx, &log, "apt-get", "update"); err != nil {
		return log.String(), err
	}
	if _, err := runBootstrapStep(ctx, &log, "apt-get", "install", "--yes", "--no-install-recommends", "docker-ce", "docker-ce-cli", "containerd.io", "docker-buildx-plugin", "docker-compose-plugin"); err != nil {
		return log.String(), err
	}
	if _, err := runBootstrapStep(ctx, &log, "systemctl", "enable", "--now", "docker"); err != nil {
		return log.String(), err
	}
	if _, err := exec.LookPath("docker"); err != nil {
		return log.String(), fmt.Errorf("Docker Engine installation did not produce a docker command")
	}
	return strings.TrimSpace(log.String()), nil
}

func (b systemBootstrapper) initSwarm(ctx context.Context, advertiseAddr string) (string, error) {
	state, err := runBootstrapStep(ctx, nil, "docker", "info", "--format", "{{.Swarm.LocalNodeState}}")
	if err != nil {
		return "", err
	}
	switch strings.TrimSpace(state) {
	case "active":
		return "Docker Swarm is already active on this host.", nil
	case "inactive":
		output, err := runBootstrapStep(ctx, nil, "docker", "swarm", "init", "--advertise-addr", advertiseAddr)
		return strings.TrimSpace(output), err
	default:
		return "", fmt.Errorf("this host has an unresolved Swarm state")
	}
}

func (b systemBootstrapper) joinSwarm(ctx context.Context, managerAddr, joinToken string) (string, error) {
	state, err := runBootstrapStep(ctx, nil, "docker", "info", "--format", "{{.Swarm.LocalNodeState}}")
	if err != nil {
		return "", err
	}
	if strings.TrimSpace(state) == "active" {
		return "Docker Swarm is already active on this host.", nil
	}
	if strings.TrimSpace(state) != "inactive" {
		return "", fmt.Errorf("this host has an unresolved Swarm state")
	}
	output, err := runBootstrapStep(ctx, nil, "docker", "swarm", "join", "--token", joinToken, managerAddr)
	return strings.TrimSpace(output), err
}

func (b systemBootstrapper) ManagerJoinToken(ctx context.Context) (string, error) {
	ctx, cancel := context.WithTimeout(ctx, bootstrapTimeout)
	defer cancel()
	controlAvailable, err := runBootstrapStep(ctx, nil, "docker", "info", "--format", "{{.Swarm.ControlAvailable}}")
	if err != nil || !strings.EqualFold(strings.TrimSpace(controlAvailable), "true") {
		return "", fmt.Errorf("this host is not an active Swarm manager")
	}
	token, err := runBootstrapStep(ctx, nil, "docker", "swarm", "join-token", "--quiet", "manager")
	if err != nil {
		return "", err
	}
	token = strings.TrimSpace(token)
	if !agentcontrol.ValidSwarmJoinToken(token) {
		return "", fmt.Errorf("Docker returned an invalid Swarm join token")
	}
	return token, nil
}

func bootstrapOSRelease(path string) (map[string]string, error) {
	if strings.TrimSpace(path) == "" {
		path = "/etc/os-release"
	}
	data, err := os.ReadFile(filepath.Clean(path))
	if err != nil {
		return nil, fmt.Errorf("read host operating system: %w", err)
	}
	result := map[string]string{}
	for _, line := range strings.Split(string(data), "\n") {
		key, value, found := strings.Cut(line, "=")
		if found {
			result[strings.TrimSpace(key)] = strings.TrimSpace(value)
		}
	}
	return result, nil
}

func runBootstrapStep(ctx context.Context, log *strings.Builder, name string, args ...string) (string, error) {
	output, err := runBootstrapCommand(ctx, name, args...)
	if log != nil {
		if log.Len() > 0 && output != "" {
			log.WriteString("\n")
		}
		log.WriteString(output)
	}
	if err != nil {
		return output, fmt.Errorf("run managed bootstrap action: %w", err)
	}
	return output, nil
}

func runBootstrapCommand(ctx context.Context, name string, args ...string) (string, error) {
	buffer := &limitedBuffer{limit: commandOutputLimit}
	command := exec.CommandContext(ctx, name, args...)
	command.Stdout = buffer
	command.Stderr = buffer
	err := command.Run()
	if err != nil || buffer.err != nil {
		return buffer.String(), fmt.Errorf("managed bootstrap command failed")
	}
	return buffer.String(), nil
}
