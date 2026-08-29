package main

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
)

type commandRunner func(context.Context, string, ...string) error

func localServiceManager(component string) (serviceManager, error) {
	switch runtime.GOOS {
	case "linux":
		expected := map[string]string{
			"agent": "swarmops-agent.service",
			"core":  "swarmops-control-plane.service",
		}[component]
		if expected == "" {
			return serviceManager{}, fmt.Errorf("unsupported Warden component %q", component)
		}
		if configured := environment("SWARMOPS_WARDEN_SERVICE", expected); configured != expected {
			return serviceManager{}, fmt.Errorf("SWARMOPS_WARDEN_SERVICE must be %s for %s", expected, component)
		}
		manager := serviceManager{kind: "systemd", name: expected, run: runCommand}
		if component == "agent" {
			manager.companions = []string{"swarmops-agent-provisioner.service"}
		}
		return manager, nil
	case "darwin":
		if component != "agent" {
			return serviceManager{}, fmt.Errorf("the native core component is supported on Linux only")
		}
		const label = "com.nimasrn.swarmops-agent"
		if configured := environment("SWARMOPS_WARDEN_SERVICE", label); configured != label {
			return serviceManager{}, fmt.Errorf("SWARMOPS_WARDEN_SERVICE must be %s for agent", label)
		}
		plist := environment("SWARMOPS_WARDEN_SERVICE_PLIST", "")
		if !filepath.IsAbs(plist) || filepath.Clean(plist) == "/" {
			return serviceManager{}, fmt.Errorf("SWARMOPS_WARDEN_SERVICE_PLIST must be an absolute plist path")
		}
		return serviceManager{kind: "launchd", name: label, plist: plist, run: runCommand}, nil
	default:
		return serviceManager{}, fmt.Errorf("unsupported operating system %q", runtime.GOOS)
	}
}

type serviceManager struct {
	kind       string
	name       string
	plist      string
	companions []string
	run        commandRunner
}

func (manager serviceManager) Stop(ctx context.Context) error {
	switch manager.kind {
	case "systemd":
		if err := manager.run(ctx, systemctlPath(), "stop", manager.name); err != nil {
			return err
		}
		for _, companion := range manager.companions {
			if err := manager.run(ctx, systemctlPath(), "stop", companion); err != nil {
				return err
			}
		}
		return nil
	case "launchd":
		return manager.run(ctx, launchctlPath(), "bootout", launchdDomain()+"/"+manager.name)
	default:
		return fmt.Errorf("unknown service manager")
	}
}

func (manager serviceManager) Start(ctx context.Context) error {
	switch manager.kind {
	case "systemd":
		for _, companion := range manager.companions {
			if err := manager.run(ctx, systemctlPath(), "start", companion); err != nil {
				return err
			}
		}
		return manager.run(ctx, systemctlPath(), "start", manager.name)
	case "launchd":
		if err := manager.run(ctx, launchctlPath(), "bootstrap", launchdDomain(), manager.plist); err != nil {
			return err
		}
		return manager.run(ctx, launchctlPath(), "kickstart", "-k", launchdDomain()+"/"+manager.name)
	default:
		return fmt.Errorf("unknown service manager")
	}
}

func runCommand(ctx context.Context, executable string, arguments ...string) error {
	command := exec.CommandContext(ctx, executable, arguments...)
	if err := command.Run(); err != nil {
		return fmt.Errorf("run local service command: %w", err)
	}
	return nil
}

func systemctlPath() string {
	for _, candidate := range []string{"/bin/systemctl", "/usr/bin/systemctl"} {
		if _, err := os.Stat(candidate); err == nil {
			return candidate
		}
	}
	return "systemctl"
}

func launchctlPath() string {
	for _, candidate := range []string{"/bin/launchctl", "/usr/bin/launchctl"} {
		if _, err := os.Stat(candidate); err == nil {
			return candidate
		}
	}
	return "launchctl"
}

func launchdDomain() string { return fmt.Sprintf("gui/%d", os.Getuid()) }
