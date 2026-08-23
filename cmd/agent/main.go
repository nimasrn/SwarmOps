// Command agent starts the read-only SwarmOps node inventory agent.
package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/nimasrn/SwarmOps/internal/agent"
	"github.com/nimasrn/SwarmOps/internal/dockerapi"
)

const version = "0.1.0"

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	token, err := secretFile(os.Getenv("SWARMOPS_AGENT_TOKEN_FILE"))
	if err != nil {
		logger.Error("load agent token", "error", err)
		os.Exit(1)
	}
	docker, err := dockerapi.New(env("SWARMOPS_DOCKER_SOCKET", "/var/run/docker.sock"))
	if err != nil {
		logger.Error("create Docker client", "error", err)
		os.Exit(1)
	}
	agentServer, err := agent.NewServer(agent.Config{
		Docker:   docker,
		HostOS:   env("SWARMOPS_HOST_OS", "/host/etc/os-release"),
		HostProc: env("SWARMOPS_HOST_PROC", "/host/proc"),
		HostRoot: env("SWARMOPS_HOST_ROOT", "/host"),
		NodeName: os.Getenv("NODE_NAME"),
		Version:  version,
	}, token)
	if err != nil {
		logger.Error("create agent", "error", err)
		os.Exit(1)
	}
	address := env("SWARMOPS_AGENT_LISTEN_ADDR", ":9180")
	server := &http.Server{
		Addr:              address,
		Handler:           agentServer.Handler(),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      10 * time.Second,
		IdleTimeout:       30 * time.Second,
	}
	go func() {
		logger.Info("SwarmOps node agent listening", "address", address, "version", version)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Error("serve HTTP", "error", err)
			os.Exit(1)
		}
	}()
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	<-ctx.Done()
	shutdown, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := server.Shutdown(shutdown); err != nil {
		logger.Error("shutdown HTTP server", "error", err)
	}
}

func env(key, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}
	return fallback
}

func secretFile(name string) ([]byte, error) {
	if strings.TrimSpace(name) == "" {
		return nil, fmt.Errorf("SWARMOPS_AGENT_TOKEN_FILE is required")
	}
	value, err := os.ReadFile(name)
	if err != nil {
		return nil, err
	}
	value = []byte(strings.TrimSpace(string(value)))
	if len(value) == 0 {
		return nil, fmt.Errorf("agent token file is empty")
	}
	return value, nil
}
