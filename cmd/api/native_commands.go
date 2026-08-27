package main

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"time"

	"github.com/nimasrn/SwarmOps/internal/nativectl"
)

func runCoreUpgrade(args []string) {
	if len(args) != 0 {
		fmt.Fprintln(os.Stderr, "Usage: swarmops-core upgrade")
		os.Exit(2)
	}
	if runtime.GOOS == "linux" && os.Geteuid() != 0 {
		fmt.Fprintln(os.Stderr, "swarmops-core upgrade: run this command with sudo on Linux")
		os.Exit(1)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()
	if err := nativectl.StartWarden(ctx, nativectl.Core, nativectl.CurrentPlatform(), nativectl.Run); err != nil {
		fmt.Fprintln(os.Stderr, "swarmops-core upgrade:", err)
		os.Exit(1)
	}
	fmt.Println("SwarmOps Core upgrade completed through its local Warden.")
}

func runCoreAccess(args []string) {
	if len(args) < 2 || args[0] != "set-cidrs" {
		fmt.Fprintln(os.Stderr, "Usage: swarmops-core access set-cidrs <CIDR> [CIDR...]")
		os.Exit(2)
	}
	if runtime.GOOS != "linux" {
		fmt.Fprintln(os.Stderr, "swarmops-core access set-cidrs: the native Core component is supported on Linux only")
		os.Exit(1)
	}
	if os.Geteuid() != 0 {
		fmt.Fprintln(os.Stderr, "swarmops-core access set-cidrs: run this command with sudo on Linux")
		os.Exit(1)
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()
	updated, err := nativectl.SetCoreAllowedCIDRs(ctx, "/etc/swarmops/control-plane.env", args[1:], nativectl.CoreAccessHooks{
		Restart: func(restartCtx context.Context) error {
			return nativectl.Restart(restartCtx, nativectl.Core, nativectl.CurrentPlatform(), nativectl.Run)
		},
		Ready: waitForCoreReadiness,
	})
	if err != nil {
		fmt.Fprintln(os.Stderr, "swarmops-core access set-cidrs:", err)
		os.Exit(1)
	}
	fmt.Printf("Core operator CIDRs updated: %s\n", strings.Join(updated, ", "))
	fmt.Println("Certificate-IP and loopback access were preserved; Core passed /readyz.")
}

func waitForCoreReadiness(ctx context.Context, healthURL string) error {
	var lastErr error
	for attempt := 0; attempt < 15; attempt++ {
		command := exec.CommandContext(ctx, "curl", "--fail", "--silent", "--show-error", "--insecure", "--noproxy", "*", "--connect-timeout", "2", "--max-time", "4", healthURL)
		if err := command.Run(); err == nil {
			return nil
		} else {
			lastErr = err
		}
		select {
		case <-ctx.Done():
			return fmt.Errorf("wait for Core readiness: %w", ctx.Err())
		case <-time.After(time.Second):
		}
	}
	return fmt.Errorf("Core did not pass its local readiness check: %w", lastErr)
}
