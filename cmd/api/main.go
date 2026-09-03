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
	"strings"
	"syscall"
	"time"

	apihttp "github.com/nimasrn/SwarmOps/api/http"
	"github.com/nimasrn/SwarmOps/internal/audit"
	"github.com/nimasrn/SwarmOps/internal/build"
	"github.com/nimasrn/SwarmOps/internal/config"
	"github.com/nimasrn/SwarmOps/internal/domain"
	"github.com/nimasrn/SwarmOps/internal/ops"
	"github.com/nimasrn/SwarmOps/internal/queue"
	"github.com/nimasrn/SwarmOps/internal/remote"
	"github.com/nimasrn/SwarmOps/internal/source"
	"golang.org/x/crypto/bcrypt"
)

const version = "0.19.0"

func main() {
	if len(os.Args) == 2 && os.Args[1] == "--version" {
		fmt.Println(version)
		return
	}
	if len(os.Args) > 1 && os.Args[1] == "password-hash" {
		if len(os.Args) != 2 {
			fmt.Fprintln(os.Stderr, "Usage: swarmops-core password-hash")
			os.Exit(2)
		}
		if err := passwordHash(os.Stdin, os.Stdout); err != nil {
			fmt.Fprintln(os.Stderr, "swarmops-core password-hash:", err)
			os.Exit(1)
		}
		return
	}
	if len(os.Args) > 1 && os.Args[1] == "upgrade" {
		runCoreUpgrade(os.Args[2:])
		return
	}
	if len(os.Args) > 1 && os.Args[1] == "access" {
		runCoreAccess(os.Args[2:])
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
	// The panel-owned platform definition is always constructed. A mounted
	// manifest still wins and makes the console view read-only; without one,
	// this is where an operator authors the platform or declares the install
	// manifest-free, neither of which they could do by editing controller
	// environment they cannot reach from a browser.
	platform, err := ops.NewPlatformStore(cfg.DataDir, cfg.DataEncryptionKey, admission)
	if err != nil {
		logger.Error("load sealed platform definition", "error", err)
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
	// The source boundary is always constructed, even when it starts disabled:
	// an operator turns it on from the panel, and a service that only existed
	// when an environment variable was already set could never be turned on
	// without restarting the controller.
	sourceStore, err := source.NewStore(cfg.DataDir, cfg.DataEncryptionKey)
	if err != nil {
		logger.Error("load sealed source connections", "error", err)
		os.Exit(1)
	}
	sourceSettings, err := source.NewSettingsStore(cfg.DataDir, cfg.DataEncryptionKey, source.Settings{
		BuildEnabled: cfg.BuildEnabled,
		Enabled:      cfg.SourceEnabled,
		ImagePrefix:  cfg.SourceImagePrefix,
		PrivateHosts: cfg.SourceAllowedHosts,
	})
	if err != nil {
		logger.Error("load sealed source settings", "error", err)
		os.Exit(1)
	}
	sourceService, err := source.NewService(sourceStore, source.Options{
		AllowedHosts:    append(append([]string{}, cfg.SourceAllowedHosts...), sourceSettings.Settings().PrivateHosts...),
		ImagePrefix:     firstNonEmpty(sourceSettings.Settings().ImagePrefix, cfg.SourceImagePrefix),
		MaxArchiveBytes: cfg.BuildMaxBytes,
	})
	if err != nil {
		logger.Error("configure source deployment", "error", err)
		os.Exit(1)
	}
	// Push settings are read per resolve, so a panel change reaches the next
	// build without a restart.
	buildEnabled := func() bool { return cfg.BuildEnabled || sourceSettings.Settings().BuildEnabled }
	registryAuth := func() []byte {
		if auth := sourceSettings.RegistryAuth(); len(auth) > 0 {
			return auth
		}
		return cfg.RegistryAuth
	}
	imagePrefixes := func() []string {
		// Images that are never pushed are always allowed: they carry a fixed
		// prefix this controller generates itself, so allow-listing them
		// grants no reach a registry prefix would not.
		prefixes := append([]string{domain.LocalImagePrefix + "/"}, cfg.ImagePrefixes...)
		prefix := strings.TrimSpace(firstNonEmpty(sourceSettings.Settings().ImagePrefix, cfg.SourceImagePrefix))
		if prefix == "" {
			return prefixes
		}
		prefix += "/"
		for _, existing := range prefixes {
			if existing == prefix {
				return prefixes
			}
		}
		return append(prefixes, prefix)
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
		if meter, ok := connection.Runner.(apihttp.MachineMeter); ok {
			target.Meter = meter
		}
		if joiner, ok := connection.Runner.(apihttp.SwarmJoiner); ok {
			target.Joiner = joiner
		}
		if reader, ok := connection.Runner.(apihttp.MetricReader); ok {
			target.Metrics = reader
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
			Platform:    platform,
			Credentials: credentials,
			DatabaseSettings: ops.DatabaseSettings{
				MongoImage:               cfg.MongoImage,
				MongoPasswordSecret:      cfg.MongoPasswordSecret,
				MongoAppBootstrapFile:    cfg.MongoAppBootstrapFile,
				MongoStackFile:           cfg.MongoStackFile,
				PostgresImage:            cfg.PostgresImage,
				PostgresPasswordSecret:   cfg.PostgresPasswordSecret,
				PostgresAppBootstrapFile: cfg.PostgresAppBootstrapFile,
				PostgresStackFile:        cfg.PostgresStackFile,
				RedisImage:               cfg.RedisImage,
				RedisPasswordSecret:      cfg.RedisPasswordSecret,
				RedisAppBootstrapFile:    cfg.RedisAppBootstrapFile,
				RedisStackFile:           cfg.RedisStackFile,
			},
			Agent:                    agentReader,
			AgentService:             cfg.AgentService,
			AgentStackFile:           cfg.AgentStackFile,
			CoreService:              cfg.CoreService,
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
			Enabled:       buildEnabled(),
			ImagePrefixes: imagePrefixes(),
			MaxCPUs:       cfg.BuildMaxCPUs,
			MaxMemoryMiB:  cfg.BuildMaxMemoryMiB,
			RegistryAuth:  registryAuth(),
		}
		target.Control = control
		return target, nil
	})
	api, err := apihttp.New(cfg, targets, servers, auditStore, logger)
	if err == nil {
		api.SetVersion(version)
		api.SetApplicationDiscovery(applications, admission.Namespace())
		api.SetPlatformStore(platform)
		api.SetSourceService(sourceService)
		api.SetSourceSettings(sourceSettings)
	}
	if err != nil {
		logger.Error("create HTTP server", "error", err)
		os.Exit(1)
	}
	// The monitor is the source of truth for the Servers surface. It probes the
	// authenticated agent and its fixed Docker facade on a bounded cadence, and
	// asks configured native agents to run their own checksum-verified release check.
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

// passwordHash is intentionally a mode of the released Core binary so a
// fresh controller installation never needs source code or a Go compiler to
// create its first bcrypt administrator password hash.
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

// firstNonEmpty returns the first value that carries content, so a sealed
// console setting takes precedence over the startup default it replaces.
func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}
