package main

import (
	"context"
	"crypto/rand"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"time"

	"github.com/nimasrn/SwarmOps/internal/nativectl"
)

func runAgentUpgrade(args []string) {
	if len(args) != 0 {
		fmt.Fprintln(os.Stderr, "Usage: swarmops-agent upgrade")
		os.Exit(2)
	}
	if runtime.GOOS == "linux" && os.Geteuid() != 0 {
		fmt.Fprintln(os.Stderr, "swarmops-agent upgrade: run this command with sudo on Linux")
		os.Exit(1)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()
	if err := nativectl.StartWarden(ctx, nativectl.Agent, nativectl.CurrentPlatform(), nativectl.Run); err != nil {
		fmt.Fprintln(os.Stderr, "swarmops-agent upgrade:", err)
		os.Exit(1)
	}
	fmt.Println("SwarmOps Agent upgrade completed through its local updater.")
}

func runGenerateKey(args []string) {
	if len(args) == 0 || (args[0] != "key" && args[0] != "apikey") {
		fmt.Fprintln(os.Stderr, "Usage: swarmops-agent gen key [--key-file <path>]")
		os.Exit(2)
	}
	flags := flag.NewFlagSet("gen key", flag.ContinueOnError)
	flags.SetOutput(os.Stderr)
	keyFile := flags.String("key-file", defaultAgentKeyFile(), "protected machine API key path")
	if err := flags.Parse(args[1:]); err != nil || flags.NArg() != 0 {
		if err == nil {
			fmt.Fprintln(os.Stderr, "Usage: swarmops-agent gen key [--key-file <path>]")
		}
		os.Exit(2)
	}
	if runtime.GOOS == "linux" && os.Geteuid() != 0 {
		fmt.Fprintln(os.Stderr, "swarmops-agent gen key: run this command with sudo on Linux")
		os.Exit(1)
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()
	key, err := nativectl.RotateAgentKey(ctx, *keyFile, rand.Reader, func(restartCtx context.Context) error {
		return nativectl.Restart(restartCtx, nativectl.Agent, nativectl.CurrentPlatform(), nativectl.Run)
	})
	if err != nil {
		fmt.Fprintln(os.Stderr, "swarmops-agent gen key:", err)
		os.Exit(1)
	}
	fmt.Fprintln(os.Stderr, "Machine API key rotated. Paste this one value into SwarmOps Servers > Reconnect:")
	fmt.Println(key)
}

func defaultAgentKeyFile() string {
	if runtime.GOOS == "darwin" {
		home, err := os.UserHomeDir()
		if err == nil {
			return filepath.Join(home, ".config", "swarmops-agent", "api-key")
		}
	}
	return "/etc/swarmops-agent/api-key"
}
