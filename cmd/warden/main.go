// Command warden safely updates one locally installed SwarmOps component.
// It deliberately has no network control API: it only executes on the host
// through a fixed system service or LaunchAgent schedule.
package main

import (
	"context"
	"flag"
	"fmt"
	"log/slog"
	"os"
	"strings"
	"time"

	"github.com/nimasrn/SwarmOps/internal/warden"
)

// version is set by the release build with -ldflags.
var version = "dev"

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	if len(os.Args) < 2 || os.Args[1] != "update" {
		fmt.Fprintln(os.Stderr, "Usage: swarmops-warden update [--version <release-tag>]")
		os.Exit(2)
	}
	flags := flag.NewFlagSet("update", flag.ContinueOnError)
	flags.SetOutput(os.Stderr)
	releaseVersion := flags.String("version", "", "exact GitHub release tag; defaults to latest")
	if err := flags.Parse(os.Args[2:]); err != nil {
		os.Exit(2)
	}
	config, err := configFromEnvironment()
	if err != nil {
		logger.Error("load Warden configuration", "error", err)
		os.Exit(1)
	}
	result, err := warden.Update(context.Background(), config, strings.TrimSpace(*releaseVersion))
	if err != nil {
		logger.Error("update SwarmOps component", "component", config.Component, "release", result.Version, "rolled_back", result.RolledBack, "error", err)
		os.Exit(1)
	}
	logger.Info("SwarmOps component is current", "component", config.Component, "release", result.Version, "updated", result.Updated, "warden_version", version)
}

func configFromEnvironment() (warden.Config, error) {
	component := environment("SWARMOPS_WARDEN_COMPONENT", "agent")
	healthTimeout, err := durationEnvironment("SWARMOPS_WARDEN_HEALTH_TIMEOUT", 45*time.Second)
	if err != nil {
		return warden.Config{}, err
	}
	healthInterval, err := durationEnvironment("SWARMOPS_WARDEN_HEALTH_INTERVAL", time.Second)
	if err != nil {
		return warden.Config{}, err
	}
	manager, err := localServiceManager(component)
	if err != nil {
		return warden.Config{}, err
	}
	return warden.Config{
		Repository:     environment("SWARMOPS_WARDEN_REPOSITORY", "nimasrn/SwarmOps"),
		Component:      component,
		ReleaseDir:     environment("SWARMOPS_WARDEN_RELEASE_DIR", ""),
		HealthURL:      environment("SWARMOPS_WARDEN_HEALTH_URL", ""),
		APIBaseURL:     environment("SWARMOPS_WARDEN_API_URL", "https://api.github.com"),
		HealthTimeout:  healthTimeout,
		HealthInterval: healthInterval,
		Service:        manager,
	}, nil
}

func environment(key, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}
	return fallback
}

func durationEnvironment(key string, fallback time.Duration) (time.Duration, error) {
	value := environment(key, "")
	if value == "" {
		return fallback, nil
	}
	duration, err := time.ParseDuration(value)
	if err != nil || duration <= 0 {
		return 0, fmt.Errorf("%s must be a positive Go duration", key)
	}
	return duration, nil
}
