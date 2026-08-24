// Command api starts the remote machine-API SwarmOps control plane.
package main

import (
	"bytes"
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	apihttp "github.com/nimasrn/SwarmOps/api/http"
	"github.com/nimasrn/SwarmOps/internal/audit"
	"github.com/nimasrn/SwarmOps/internal/build"
	"github.com/nimasrn/SwarmOps/internal/config"
	"github.com/nimasrn/SwarmOps/internal/ops"
	"github.com/nimasrn/SwarmOps/internal/queue"
	"github.com/nimasrn/SwarmOps/internal/remote"
	"golang.org/x/crypto/bcrypt"
)

// version is set by the release build with -ldflags. Keeping a development
// fallback makes local go run and test workflows deterministic.
var version = "dev"

func main() {
	if len(os.Args) == 2 && os.Args[1] == "password-hash" {
		if err := passwordHash(os.Stdin, os.Stdout); err != nil {
			fmt.Fprintln(os.Stderr, "swarmops-core password-hash:", err)
			os.Exit(1)
		}
		return
	}
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	cfg, err := config.Load()
	if err != nil {
		logger.Error("load configuration", "error", err)
		os.Exit(1)
	}
	auditStore, err := audit.Open(cfg.DataDir, cfg.DataEncryptionKey)
	if err != nil {
		logger.Error("open audit store", "error", err)
		os.Exit(1)
	}
	servers, err := remote.NewManager(cfg.DataDir, cfg.DataEncryptionKey)
	if err != nil {
		logger.Error("load remote server profiles", "error", err)
		os.Exit(1)
	}
	admission, err := ops.LoadPlatformAdmission(cfg.PlatformManifestFile)
	if err != nil {
		logger.Error("load platform admission", "error", err)
		os.Exit(1)
	}
	var agentReader ops.AgentReader
	if len(cfg.AgentToken) > 0 {
		agentReader = ops.HTTPAgentReader{Token: cfg.AgentToken}
	}
	traefikSettings := ops.TraefikStackSettings{
		ACMEEmail:           cfg.TraefikACMEEmail,
		ArvanAPIKeySecret:   cfg.TraefikArvanAPIKeySecret,
		CFDNSTokenSecret:    cfg.TraefikCFDNSTokenSecret,
		DashboardAuthSecret: cfg.TraefikDashboardAuthSecret,
		DashboardHost:       cfg.TraefikDashboardHost,
		DynamicConfigName:   cfg.TraefikDynamicConfigName,
		Image:               cfg.TraefikImage,
	}
	trustedStackSettings := ops.TrustedStackSettings{
		AgentTokenSecret:                   cfg.TrustedAgentTokenSecret,
		AlertmanagerConfigName:             cfg.TrustedAlertmanagerConfig,
		AlertmanagerImage:                  cfg.TrustedAlertmanagerImage,
		AlloyConfigName:                    cfg.TrustedAlloyConfig,
		AlloyImage:                         cfg.TrustedAlloyImage,
		GrafanaAdminPasswordSecret:         cfg.TrustedGrafanaPasswordSecret,
		GrafanaDashboardConfigName:         cfg.TrustedGrafanaDashboard,
		GrafanaDashboardProviderConfigName: cfg.TrustedGrafanaDashboardProvider,
		GrafanaDatasourcesConfigName:       cfg.TrustedGrafanaDatasources,
		GrafanaHost:                        cfg.TrustedGrafanaHost,
		GrafanaImage:                       cfg.TrustedGrafanaImage,
		JaegerConfigName:                   cfg.TrustedJaegerConfig,
		JaegerImage:                        cfg.TrustedJaegerImage,
		LokiConfigName:                     cfg.TrustedLokiConfig,
		LokiImage:                          cfg.TrustedLokiImage,
		NodeExporterImage:                  cfg.TrustedNodeExporterImage,
		PrometheusConfigName:               cfg.TrustedPrometheusConfig,
		PrometheusImage:                    cfg.TrustedPrometheusImage,
		PrometheusRetention:                cfg.TrustedPrometheusRetention,
		PrometheusRulesConfigName:          cfg.TrustedPrometheusRules,
		Registry:                           cfg.TrustedRegistry,
		RegistryNamespace:                  cfg.TrustedRegistryNamespace,
		Tag:                                cfg.TrustedTag,
	}
	targets := apihttp.TargetResolverFunc(func(id string) (apihttp.Target, error) {
		connection, err := servers.Resolve(id)
		if err != nil {
			return apihttp.Target{}, err
		}
		if !connection.Profile.DockerAvailable || connection.Docker == nil {
			return apihttp.Target{}, fmt.Errorf("%w: selected machine API is connected, but Docker is not ready; finish the machine setup before running cluster operations", remote.ErrDockerUnavailable)
		}
		if !connection.Profile.SwarmControlAvailable {
			return apihttp.Target{}, fmt.Errorf("selected server is not a remote Swarm manager")
		}
		// Remote Docker operations run through the selected machine agent's
		// fixed-operation API. The controller never has the machine's socket or
		// filesystem path; remote nodes retain their own reviewed pull credentials.
		cli := ops.DockerCLI{Runner: connection.Runner}
		control := ops.NewControlPlane(connection.Docker, cli, auditStore, ops.ControlPlaneOptions{
			Admission:              admission,
			Agent:                  agentReader,
			AgentService:           cfg.AgentService,
			AgentStackFile:         cfg.AgentStackFile,
			DataDir:                cfg.DataDir,
			LogsStackFile:          cfg.LogsStackFile,
			Mutations:              cfg.MutationEnabled,
			ObservabilityStackFile: cfg.ObservabilityStackFile,
			TraefikSettings:        traefikSettings,
			TraefikStackFile:       cfg.TraefikStackFile,
			TrustedStackSettings:   trustedStackSettings,
		})
		return apihttp.Target{Build: build.Service{
			Docker:        connection.Docker,
			Enabled:       cfg.BuildEnabled,
			ImagePrefixes: cfg.ImagePrefixes,
			MaxCPUs:       cfg.BuildMaxCPUs,
			MaxMemoryMiB:  cfg.BuildMaxMemoryMiB,
			RegistryAuth:  cfg.RegistryAuth,
		}, Control: control}, nil
	})
	api, err := apihttp.New(cfg, targets, servers, auditStore, logger)
	if err != nil {
		logger.Error("create HTTP server", "error", err)
		os.Exit(1)
	}
	worker := queue.Worker{
		Execute:          api.ExecuteCommand,
		ExecutionTimeout: api.CommandExecutionTimeout,
		OnTransition:     api.RecordCommandTransition,
		Store:            api.CommandStore(),
	}
	go func() {
		if err := worker.Run(ctx); err != nil && ctx.Err() == nil {
			// Continuing to accept mutations after the durable executor has
			// stopped would violate the command queue contract. Cancelling the
			// process context lets the normal graceful shutdown close the API.
			logger.Error("command worker stopped", "error", err)
			stop()
		}
	}()

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
	if cfg.TLSCertFile != "" {
		server.TLSConfig = &tls.Config{
			MinVersion:       tls.VersionTLS13,
			CurvePreferences: []tls.CurveID{tls.X25519, tls.CurveP256},
		}
	}
	go func() {
		scheme := "http"
		if cfg.TLSCertFile != "" {
			scheme = "https"
		}
		logger.Info("SwarmOps API listening", "address", cfg.ListenAddr, "scheme", scheme, "version", version, "mutations_enabled", cfg.MutationEnabled, "builds_enabled", cfg.BuildEnabled)
		if err := serve(server, cfg); err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Error("serve HTTP", "error", err)
			os.Exit(1)
		}
	}()

	<-ctx.Done()
	shutdown, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	if err := server.Shutdown(shutdown); err != nil {
		logger.Error("shutdown HTTP server", "error", err)
	}
}

// passwordHash is intentionally a mode of the released core binary so a
// fresh controller installation never has to fetch source or a compiler just
// to create its first bcrypt administrator password hash.
func passwordHash(input io.Reader, output io.Writer) error {
	password, err := io.ReadAll(io.LimitReader(input, 4097))
	if err != nil {
		return fmt.Errorf("read password: %w", err)
	}
	defer func() {
		for index := range password {
			password[index] = 0
		}
	}()
	password = bytes.TrimSuffix(password, []byte("\n"))
	password = bytes.TrimSuffix(password, []byte("\r"))
	if len(password) < 16 {
		return errors.New("password must contain at least 16 bytes")
	}
	hash, err := bcrypt.GenerateFromPassword(password, bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("hash password: %w", err)
	}
	if _, err := fmt.Fprintln(output, string(hash)); err != nil {
		return fmt.Errorf("write password hash: %w", err)
	}
	return nil
}

func serve(server *http.Server, cfg config.Config) error {
	if cfg.TLSCertFile != "" {
		return server.ListenAndServeTLS(cfg.TLSCertFile, cfg.TLSKeyFile)
	}
	return server.ListenAndServe()
}
