// Package nativectl owns the small, fixed local operations exposed by the
// installed SwarmOps binaries. It never accepts a remote target, repository,
// command, or file path.
package nativectl

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
)

const apiKeyBytes = 32

type Component string

const (
	Agent Component = "agent"
	Core  Component = "core"
)

// Platform is deliberately explicit so the fixed unit/LaunchAgent mapping is
// testable without depending on the host that runs the tests.
type Platform struct {
	OS            string
	UID           int
	SystemctlPath string
	LaunchctlPath string
}

type Runner func(context.Context, string, ...string) error

func CurrentPlatform() Platform {
	return Platform{
		OS:            runtime.GOOS,
		UID:           os.Getuid(),
		SystemctlPath: commandPath("systemctl", "/bin/systemctl", "/usr/bin/systemctl"),
		LaunchctlPath: commandPath("launchctl", "/bin/launchctl", "/usr/bin/launchctl"),
	}
}

func Run(ctx context.Context, executable string, arguments ...string) error {
	if err := exec.CommandContext(ctx, executable, arguments...).Run(); err != nil {
		return fmt.Errorf("run local service command: %w", err)
	}
	return nil
}

// StartWarden starts the only approved local updater for a component. The
// system service owns Warden's release URL, checksum verification, health
// check, and rollback configuration.
func StartWarden(ctx context.Context, component Component, platform Platform, run Runner) error {
	if run == nil {
		return errors.New("local command runner is required")
	}
	switch platform.OS {
	case "linux":
		unit, err := wardenUnit(component)
		if err != nil {
			return err
		}
		if err := run(ctx, platform.SystemctlPath, "start", unit); err != nil {
			if component != Agent {
				return fmt.Errorf("start %s: %w", unit, err)
			}
			legacyUnit := "swarmops-agent-update.service"
			if legacyErr := run(ctx, platform.SystemctlPath, "start", legacyUnit); legacyErr != nil {
				return fmt.Errorf("start %s: %w; legacy updater %s also failed: %v", unit, err, legacyUnit, legacyErr)
			}
		}
		return nil
	case "darwin":
		if component != Agent {
			return fmt.Errorf("the native core component is supported on Linux only")
		}
		label := "gui/" + fmt.Sprint(platform.UID) + "/com.nimasrn.swarmops-warden"
		if err := run(ctx, platform.LaunchctlPath, "kickstart", "-k", label); err != nil {
			return fmt.Errorf("start SwarmOps Warden: %w", err)
		}
		return nil
	default:
		return fmt.Errorf("unsupported operating system %q", platform.OS)
	}
}

// Restart restarts a fixed installed component and confirms the Linux unit is
// active. It deliberately does not accept a caller-supplied unit name.
func Restart(ctx context.Context, component Component, platform Platform, run Runner) error {
	if run == nil {
		return errors.New("local command runner is required")
	}
	switch platform.OS {
	case "linux":
		unit, err := componentUnit(component)
		if err != nil {
			return err
		}
		if err := run(ctx, platform.SystemctlPath, "restart", unit); err != nil {
			return fmt.Errorf("restart %s: %w", unit, err)
		}
		if err := run(ctx, platform.SystemctlPath, "is-active", "--quiet", unit); err != nil {
			return fmt.Errorf("verify %s is active: %w", unit, err)
		}
		return nil
	case "darwin":
		if component != Agent {
			return fmt.Errorf("the native core component is supported on Linux only")
		}
		label := "gui/" + fmt.Sprint(platform.UID) + "/com.nimasrn.swarmops-agent"
		if err := run(ctx, platform.LaunchctlPath, "kickstart", "-k", label); err != nil {
			return fmt.Errorf("restart SwarmOps Agent: %w", err)
		}
		return nil
	default:
		return fmt.Errorf("unsupported operating system %q", platform.OS)
	}
}

// RotateAgentKey atomically replaces an existing protected agent key and
// restarts the fixed Agent service. If the restart fails, it restores the prior
// bytes and attempts to restart the old service state before returning an error.
func RotateAgentKey(ctx context.Context, keyFile string, entropy io.Reader, restart func(context.Context) error) (string, error) {
	if restart == nil {
		return "", errors.New("agent restart function is required")
	}
	if entropy == nil {
		entropy = rand.Reader
	}
	previous, err := readProtectedFile(keyFile)
	if err != nil {
		return "", err
	}
	raw := make([]byte, apiKeyBytes)
	if _, err := io.ReadFull(entropy, raw); err != nil {
		return "", fmt.Errorf("generate machine API key: %w", err)
	}
	key := base64.StdEncoding.EncodeToString(raw)
	if err := writeProtectedFile(keyFile, []byte(key+"\n")); err != nil {
		return "", err
	}
	if err := restart(ctx); err != nil {
		restartErr := err
		if restoreErr := writeProtectedFile(keyFile, previous); restoreErr != nil {
			return "", fmt.Errorf("restart Agent after rotating API key: %w; restore prior key: %v", restartErr, restoreErr)
		}
		if recoverErr := restart(ctx); recoverErr != nil {
			return "", fmt.Errorf("restart Agent after rotating API key: %w; restored prior key but could not restart it: %v", restartErr, recoverErr)
		}
		return "", fmt.Errorf("restart Agent after rotating API key: %w; restored prior key", restartErr)
	}
	return key, nil
}

func readProtectedFile(name string) ([]byte, error) {
	path := filepath.Clean(name)
	info, err := os.Lstat(path)
	if err != nil {
		return nil, fmt.Errorf("read machine API key: %w", err)
	}
	if info.Mode()&os.ModeSymlink != 0 || !info.Mode().IsRegular() {
		return nil, fmt.Errorf("machine API key must be a regular file")
	}
	if info.Mode().Perm()&0o077 != 0 {
		return nil, fmt.Errorf("machine API key must be readable only by its owner")
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read machine API key: %w", err)
	}
	if len(data) == 0 {
		return nil, fmt.Errorf("machine API key is empty")
	}
	return data, nil
}

func writeProtectedFile(name string, data []byte) error {
	path := filepath.Clean(name)
	temporary, err := os.CreateTemp(filepath.Dir(path), ".swarmops-agent-key-*.tmp")
	if err != nil {
		return fmt.Errorf("create replacement machine API key: %w", err)
	}
	temporaryName := temporary.Name()
	defer os.Remove(temporaryName)
	if err := temporary.Chmod(0o600); err != nil {
		_ = temporary.Close()
		return fmt.Errorf("protect replacement machine API key: %w", err)
	}
	if _, err := temporary.Write(data); err != nil {
		_ = temporary.Close()
		return fmt.Errorf("write replacement machine API key: %w", err)
	}
	if err := temporary.Sync(); err != nil {
		_ = temporary.Close()
		return fmt.Errorf("sync replacement machine API key: %w", err)
	}
	if err := temporary.Close(); err != nil {
		return fmt.Errorf("close replacement machine API key: %w", err)
	}
	if err := os.Rename(temporaryName, path); err != nil {
		return fmt.Errorf("install replacement machine API key: %w", err)
	}
	return nil
}

func componentUnit(component Component) (string, error) {
	switch component {
	case Agent:
		return "swarmops-agent.service", nil
	case Core:
		return "swarmops-control-plane.service", nil
	default:
		return "", fmt.Errorf("unsupported SwarmOps component %q", component)
	}
}

func wardenUnit(component Component) (string, error) {
	switch component {
	case Agent:
		return "swarmops-agent-warden.service", nil
	case Core:
		return "swarmops-core-warden.service", nil
	default:
		return "", fmt.Errorf("unsupported SwarmOps component %q", component)
	}
}

func commandPath(fallback string, candidates ...string) string {
	for _, candidate := range candidates {
		if _, err := os.Stat(candidate); err == nil {
			return candidate
		}
	}
	return fallback
}
