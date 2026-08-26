package main

import (
	"context"
	"fmt"
	"os"
	"runtime"
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
