// Command api starts the remote machine-API SwarmOps control plane.
package main

import (
	"context"
	"crypto/tls"
	"errors"
	"fmt"
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
	"github.com/nimasrn/SwarmOps/internal/source"
)

const version = "0.10.0"

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	cfg, err := config.Load()
	if err != nil {
		logger.Error("load configuration", "error", err)
		os.Exit(1)
	}
	auditStore, err := audit.Open(cfg.DataDir, cfg.DataEncryptionKey, cfg.AuditMaxEvents)
	if err != nil {
		logger.Error("open audit store", "error", err)
		os.Exit(1)
	}
	servers, err := remote.NewManagerWithOptions(cfg.DataDir, cfg.DataEncryptionKey, remote.ManagerOptions{RetainKeys: cfg.RetainMachineKeys})
	if err != nil {
		logger.Error("load remote server profiles", "error", err)
		os.Exit(1)
	}
	// A standby retains state but never contacts machine agents. An active core
	// resumes enrolled hosts from sealed controller state; failures become safe
	// persisted diagnostics instead of blocking API startup.
	if cfg.CoreMode == "active" {
		for _, failure := range servers.Resume(ctx) {
			logger.Warn("resume machine API connection", "error", failure)
		}
		startDevMachineAPIConnector(ctx, cfg.DevMachineAPI, servers, logger)
	}
	admission, err := ops.LoadPlatformAdmission(cfg.PlatformManifestFile)
	if err != nil {
		logger.Error("load platform admission", "error", err)
		os.Exit(1)
	}
	credentials, err := ops.NewCredentialStore(cfg.DataDir, cfg.DataEncryptionKey)
	if err != nil {
		logger.Error("load sealed database credentials", "error", err)
		os.Exit(1)
	}
	applications, err := ops.NewApplicationStore(cfg.DataDir, cfg.DataEncryptionKey)
	if err != nil {
		logger.Error("load sealed applications", "error", err)
		os.Exit(1)
	}
	routing, err := ops.NewRoutingStore(cfg.DataDir, cfg.DataEncryptionKey, cfg.TraefikACMEEmail)
	if err != nil {
		logger.Error("load sealed Traefik routing state", "error", err)
		os.Exit(1)
	}
	var sourceService *source.Service
	if cfg.SourceEnabled {
		sourceStore, sourceErr := source.NewStore(cfg.DataDir, cfg.DataEncryptionKey)
		if sourceErr != nil {
			logger.Error("load sealed source connections", "error", sourceErr)
			os.Exit(1)
		}
		sourceService, sourceErr = source.NewService(sourceStore, source.Options{
			AllowedHosts:    cfg.SourceAllowedHosts,
			ImagePrefix:     cfg.SourceImagePrefix,
			MaxArchiveBytes: cfg.BuildMaxBytes,
		})
		if sourceErr != nil {
			logger.Error("configure source deployment", "error", sourceErr)
			os.Exit(1)
		}
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
		AgentTokenSecret:           cfg.TrustedAgentTokenSecret,
		AlertmanagerConfigName:     cfg.TrustedAlertmanagerConfig,
		AlertmanagerImage:          cfg.TrustedAlertmanagerImage,
		FluentAggregatorConfigName: cfg.TrustedFluentAggregatorConfig,
		FluentForwarderConfigName:  cfg.TrustedFluentForwarderConfig,
		JaegerConfigName:           cfg.TrustedJaegerConfig,
		JaegerImage:                cfg.TrustedJaegerImage,
		NodeExporterImage:          cfg.TrustedNodeExporterImage,
		PrometheusConfigName:       cfg.TrustedPrometheusConfig,
		PrometheusImage:            cfg.TrustedPrometheusImage,
		PrometheusRetention:        cfg.TrustedPrometheusRetention,
		PrometheusRulesConfigName:  cfg.TrustedPrometheusRules,
		Registry:                   cfg.TrustedRegistry,
		RegistryNamespace:          cfg.TrustedRegistryNamespace,
		Tag:                        cfg.TrustedTag,
	}
	targets := apihttp.TargetResolverFunc(func(id string) (apihttp.Target, error) {
		connection, err := servers.Resolve(id)
		if err != nil {
			return apihttp.Target{}, err
		}
		target := apihttp.Target{}
		if inspector, ok := connection.Runner.(apihttp.HostInspector); ok {
			target.Host = inspector
		}
		if provisioner, ok := connection.Runner.(apihttp.Provisioner); ok {
			target.Provisioner = provisioner
		}
		if !connection.Profile.DockerAvailable || connection.Docker == nil {
			// A connected native agent remains a valid server-readiness target even
			// before Docker exists. Cluster reads and operations still fail closed
			// in targetFor because Control stays nil.
			return target, nil
		}
		if !connection.Profile.SwarmControlAvailable {
			return target, nil
		}
		// Remote Docker operations run through the selected machine agent's
		// fixed-operation API. The controller never has the machine's socket or
		// filesystem path; remote nodes retain their own reviewed pull credentials.
		cli := ops.DockerCLI{Runner: connection.Runner}
		control := ops.NewControlPlane(connection.Docker, cli, auditStore, ops.ControlPlaneOptions{
			Admission:   admission,
			Apps:        applications,
			Credentials: credentials,
			DatabaseSettings: ops.DatabaseSettings{
				MongoImage:             cfg.MongoImage,
				MongoPasswordSecret:    cfg.MongoPasswordSecret,
				MongoStackFile:         cfg.MongoStackFile,
				PostgresImage:          cfg.PostgresImage,
				PostgresPasswordSecret: cfg.PostgresPasswordSecret,
				PostgresStackFile:      cfg.PostgresStackFile,
				RedisImage:             cfg.RedisImage,
				RedisPasswordSecret:    cfg.RedisPasswordSecret,
				RedisStackFile:         cfg.RedisStackFile,
			},
			Agent:                    agentReader,
			AgentService:             cfg.AgentService,
			AgentStackFile:           cfg.AgentStackFile,
			DataDir:                  cfg.DataDir,
			LogsStackFile:            cfg.LogsStackFile,
			Mutations:                cfg.MutationEnabled,
			ObservabilityStackFile:   cfg.ObservabilityStackFile,
			Routing:                  routing,
			ServerID:                 id,
			TraefikSettings:          traefikSettings,
			TraefikDynamicConfigFile: cfg.TraefikDynamicConfigFile,
			TraefikStackFile:         cfg.TraefikStackFile,
			TrustedStackSettings:     trustedStackSettings,
		})
		target.Build = build.Service{
			Docker:        connection.Docker,
			Enabled:       cfg.BuildEnabled,
			ImagePrefixes: cfg.ImagePrefixes,
			MaxCPUs:       cfg.BuildMaxCPUs,
			MaxMemoryMiB:  cfg.BuildMaxMemoryMiB,
			RegistryAuth:  cfg.RegistryAuth,
		}
		target.Control = control
		return target, nil
	})
	api, err := apihttp.New(cfg, targets, servers, auditStore, logger)
	if err == nil {
		api.SetApplicationDiscovery(applications, admission.Namespace())
		api.SetSourceService(sourceService)
	}
	if err != nil {
		logger.Error("create HTTP server", "error", err)
		os.Exit(1)
	}
	// The monitor is the source of truth for the Servers surface. It probes the
	// authenticated agent and its fixed Docker facade on a bounded cadence, and
	// asks configured native agents to run their own trusted Git update check.
	// A standby stays read-only until promotion because the callback is evaluated
	// on every pass rather than only at process startup.
	go servers.StartAgentMonitor(ctx, 30*time.Second, api.CanExecuteCommands)
	worker := queue.Worker{
		CanExecute:       api.CanExecuteCommands,
		Execute:          api.ExecuteCommand,
		ExecutionTimeout: api.CommandExecutionTimeout,
		OnTransition:     api.RecordCommandTransition,
		Store:            api.CommandStore(),
	}
	// The dashboard's trend lines come from a short in-memory series. Sampling
	// here rather than on request keeps one reading per interval however many
	// browsers are open.
	go api.StartInsightsSampler(ctx)
	go func() {
		if err := worker.Run(ctx); err != nil && ctx.Err() == nil {
			// Continuing to accept mutations after the durable executor has
			// stopped would violate the command queue contract. Cancelling the
			// process context lets the normal graceful shutdown close the API.
			logger.Error("command worker stopped", "error", err)
			stop()
		}
	}()

	primary := apiListener{scheme: "http", server: newAPIServer(cfg.ListenAddr, api.Handler())}
	if cfg.TLSCertFile != "" {
		primary.scheme = "https"
		primary.tlsCertFile = cfg.TLSCertFile
		primary.tlsKeyFile = cfg.TLSKeyFile
		primary.server.TLSConfig = &tls.Config{
			MinVersion:       tls.VersionTLS13,
			CurvePreferences: []tls.CurveID{tls.X25519, tls.CurveP256},
			ClientAuth:       tls.VerifyClientCertIfGiven,
			ClientCAs:        api.AgentClientCAs(),
		}
	}
	listeners := []apiListener{primary}
	if cfg.HTTPEnabled {
		listeners = append(listeners, apiListener{
			scheme: "http-break-glass",
			server: newAPIServer(cfg.HTTPListenAddr, apihttp.PlaintextHTTPHandler(api.Handler())),
		})
	}
	serveErrors := make(chan error, len(listeners))
	for _, listener := range listeners {
		listener := listener
		logger.Info("SwarmOps API listening", "address", listener.server.Addr, "scheme", listener.scheme, "version", version, "mutations_enabled", cfg.MutationEnabled, "builds_enabled", cfg.BuildEnabled)
		go func() {
			if err := listener.serve(); err != nil && !errors.Is(err, http.ErrServerClosed) {
				serveErrors <- fmt.Errorf("serve %s on %s: %w", listener.scheme, listener.server.Addr, err)
			}
		}()
	}

	var serveErr error
	select {
	case err := <-serveErrors:
		serveErr = err
		logger.Error("serve SwarmOps API", "error", err)
		stop()
	case <-ctx.Done():
	}
	shutdown, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	var shutdownErr error
	for _, listener := range listeners {
		if err := listener.server.Shutdown(shutdown); err != nil {
			shutdownErr = errors.Join(shutdownErr, fmt.Errorf("shutdown %s listener: %w", listener.scheme, err))
		}
	}
	if shutdownErr != nil {
		logger.Error("shutdown HTTP servers", "error", shutdownErr)
	}
	if serveErr != nil {
		os.Exit(1)
	}
}

type apiListener struct {
	scheme      string
	server      *http.Server
	tlsCertFile string
	tlsKeyFile  string
}

func newAPIServer(address string, handler http.Handler) *http.Server {
	return &http.Server{
		Addr:              address,
		Handler:           handler,
		ReadHeaderTimeout: 5 * time.Second,
		// Build contexts are explicitly size-capped by the handler and can take
		// longer than a normal API response on a slow operator connection.
		ReadTimeout:  0,
		WriteTimeout: 0,
		IdleTimeout:  60 * time.Second,
	}
}

func (listener apiListener) serve() error {
	if listener.tlsCertFile != "" {
		return listener.server.ListenAndServeTLS(listener.tlsCertFile, listener.tlsKeyFile)
	}
	return listener.server.ListenAndServe()
}
