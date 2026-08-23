// Command api starts the manager-only SwarmOps control plane.
package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	apihttp "github.com/nimasrn/SwarmOps/api/http"
	"github.com/nimasrn/SwarmOps/internal/audit"
	"github.com/nimasrn/SwarmOps/internal/build"
	"github.com/nimasrn/SwarmOps/internal/config"
	"github.com/nimasrn/SwarmOps/internal/dockerapi"
	"github.com/nimasrn/SwarmOps/internal/ops"
)

const version = "0.1.0"

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	cfg, err := config.Load()
	if err != nil {
		logger.Error("load configuration", "error", err)
		os.Exit(1)
	}
	docker, err := dockerapi.New(cfg.DockerSocket)
	if err != nil {
		logger.Error("create Docker client", "error", err)
		os.Exit(1)
	}
	auditStore, err := audit.Open(cfg.DataDir)
	if err != nil {
		logger.Error("open audit store", "error", err)
		os.Exit(1)
	}
	dockerConfigDir, err := prepareDockerConfig(cfg.RegistryAuth)
	if err != nil {
		logger.Error("prepare Docker registry config", "error", err)
		os.Exit(1)
	}
	if dockerConfigDir != "" {
		defer os.RemoveAll(dockerConfigDir)
	}
	cli := ops.DockerCLI{ConfigDir: dockerConfigDir, Runner: ops.OSRunner{}, Socket: cfg.DockerSocket}
	control := ops.NewControlPlane(
		docker,
		cli,
		auditStore,
		ops.HTTPAgentReader{Token: cfg.AgentToken},
		cfg.AgentService,
		cfg.MutationEnabled,
		cfg.DataDir,
		"/opt/swarmops/logs.yml",
		"/opt/swarmops/observability.yml",
		"/opt/swarmops/traefik.yml",
	)
	buildService := build.Service{
		Docker:        docker,
		Enabled:       cfg.BuildEnabled,
		ImagePrefixes: cfg.ImagePrefixes,
		MaxCPUs:       cfg.BuildMaxCPUs,
		MaxMemoryMiB:  cfg.BuildMaxMemoryMiB,
		RegistryAuth:  cfg.RegistryAuth,
	}
	api, err := apihttp.New(cfg, control, buildService, auditStore, logger)
	if err != nil {
		logger.Error("create HTTP server", "error", err)
		os.Exit(1)
	}

	server := &http.Server{
		Addr:              cfg.ListenAddr,
		Handler:           api.Handler(),
		ReadHeaderTimeout: 5 * time.Second,
		// Build contexts are explicitly size-capped by the handler and can take
		// longer than a normal API response on a slow operator connection.
		ReadTimeout:  0,
		WriteTimeout: 0,
		IdleTimeout:  60 * time.Second,
	}
	go func() {
		logger.Info("SwarmOps API listening", "address", cfg.ListenAddr, "version", version, "mutations_enabled", cfg.MutationEnabled, "builds_enabled", cfg.BuildEnabled)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Error("serve HTTP", "error", err)
			os.Exit(1)
		}
	}()

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	<-ctx.Done()
	shutdown, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	if err := server.Shutdown(shutdown); err != nil {
		logger.Error("shutdown HTTP server", "error", err)
	}
}

// prepareDockerConfig gives the Docker CLI the standard config.json shape it
// needs for --with-registry-auth. In the production stack /tmp is a tmpfs and
// the source is a read-only Swarm secret; neither path is exposed by HTTP.
func prepareDockerConfig(registryAuth []byte) (string, error) {
	if len(registryAuth) == 0 {
		return "", nil
	}
	directory, err := os.MkdirTemp("", "swarmops-docker-config-")
	if err != nil {
		return "", fmt.Errorf("create Docker config directory: %w", err)
	}
	if err := os.WriteFile(filepath.Join(directory, "config.json"), registryAuth, 0o600); err != nil {
		_ = os.RemoveAll(directory)
		return "", fmt.Errorf("write Docker config: %w", err)
	}
	return directory, nil
}
