// Command agent starts the SwarmOps node agent. Remote control remains off
// unless it is explicitly enabled with a protected API key and TLS listener.
package main

import (
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"net/netip"
	"os"
	"os/signal"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/nimasrn/SwarmOps/internal/agent"
	"github.com/nimasrn/SwarmOps/internal/dockerapi"
)

const (
	buildTimeout    = 30 * time.Minute
	mobilityTimeout = 6 * time.Hour
)

// version is set by the release build with -ldflags. Keeping a development
// fallback makes local go run and test workflows deterministic.
var version = "dev"

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	runtime, err := loadRuntime()
	if err != nil {
		logger.Error("load agent configuration", "error", err)
		os.Exit(1)
	}
	docker, err := dockerapi.New(runtime.dockerSocket)
	if err != nil {
		logger.Error("create Docker client", "error", err)
		os.Exit(1)
	}
	agentServer, err := agent.NewServer(agent.Config{
		AllowedImagePrefixes:     runtime.allowedImagePrefixes,
		BootstrapEnabled:         runtime.bootstrapEnabled,
		BuildEnabled:             runtime.buildEnabled,
		BuildMaxBytes:            runtime.buildMaxBytes,
		BuildMaxCPUs:             runtime.buildMaxCPUs,
		BuildMaxMemoryMiB:        runtime.buildMaxMemoryMiB,
		Docker:                   docker,
		EnrollmentSecret:         runtime.enrollmentSecret,
		EnrollmentSecretFile:     runtime.enrollmentSecretFile,
		HostOS:                   env("SWARMOPS_HOST_OS", "/host/etc/os-release"),
		HostProc:                 env("SWARMOPS_HOST_PROC", "/host/proc"),
		HostRoot:                 env("SWARMOPS_HOST_ROOT", "/host"),
		ManagedStateFile:         runtime.managedStateFile,
		MobilityEnabled:          runtime.mobilityEnabled,
		MobilityTransferDir:      runtime.mobilityTransferDir,
		MobilityTransferMaxBytes: runtime.mobilityTransferMaxBytes,
		NodeName:                 os.Getenv("NODE_NAME"),
		RemoteControlEnabled:     runtime.remoteControlEnabled,
		Version:                  version,
	}, runtime.token)
	if err != nil {
		logger.Error("create agent", "error", err)
		os.Exit(1)
	}
	readTimeout := 10 * time.Second
	writeTimeout := 10 * time.Second
	if runtime.remoteControlEnabled {
		// Fixed commands and bounded image builds can take materially longer
		// than inventory collection. Endpoint-level limits and contexts keep
		// them bounded while ReadHeaderTimeout protects the handshake.
		readTimeout = buildTimeout
		writeTimeout = buildTimeout
	}
	if runtime.mobilityEnabled {
		readTimeout = mobilityTimeout
		writeTimeout = mobilityTimeout
	}
	server := &http.Server{
		Addr:              runtime.listenAddr,
		Handler:           agentServer.Handler(),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       readTimeout,
		WriteTimeout:      writeTimeout,
		IdleTimeout:       30 * time.Second,
	}
	if runtime.tlsCertFile != "" {
		server.TLSConfig = &tls.Config{MinVersion: tls.VersionTLS13, CurvePreferences: []tls.CurveID{tls.X25519, tls.CurveP256}}
	}
	go func() {
		scheme := "http"
		if runtime.tlsCertFile != "" {
			scheme = "https"
		}
		logger.Info("SwarmOps node agent listening", "address", runtime.listenAddr, "scheme", scheme, "remote_control_enabled", runtime.remoteControlEnabled, "version", version)
		if err := serve(server, runtime); err != nil && !errors.Is(err, http.ErrServerClosed) {
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

type runtimeConfig struct {
	allowedImagePrefixes     []string
	bootstrapEnabled         bool
	buildEnabled             bool
	buildMaxBytes            int64
	buildMaxCPUs             float64
	buildMaxMemoryMiB        int64
	dockerSocket             string
	enrollmentSecret         []byte
	enrollmentSecretFile     string
	listenAddr               string
	managedStateFile         string
	mobilityEnabled          bool
	mobilityTransferDir      string
	mobilityTransferMaxBytes int64
	remoteControlEnabled     bool
	tlsCertFile              string
	tlsKeyFile               string
	token                    []byte
}

func loadRuntime() (runtimeConfig, error) {
	token, err := secretFile(os.Getenv("SWARMOPS_AGENT_TOKEN_FILE"))
	if err != nil {
		return runtimeConfig{}, err
	}
	enrollmentSecretFile := strings.TrimSpace(os.Getenv("SWARMOPS_AGENT_ENROLLMENT_FILE"))
	var enrollmentSecret []byte
	if enrollmentSecretFile != "" {
		// A spent enrollment file is deleted by the agent, so a missing file
		// simply means this host has already been enrolled.
		if _, statErr := os.Lstat(filepath.Clean(enrollmentSecretFile)); statErr == nil {
			enrollmentSecret, err = secretFile(enrollmentSecretFile)
			if err != nil {
				return runtimeConfig{}, err
			}
		}
	}
	config := runtimeConfig{
		allowedImagePrefixes:     splitCSV(env("SWARMOPS_AGENT_IMAGE_PREFIXES", "ghcr.io/nimasrn/")),
		bootstrapEnabled:         boolEnv("SWARMOPS_AGENT_BOOTSTRAP_ENABLED", false),
		buildEnabled:             boolEnv("SWARMOPS_AGENT_BUILD_ENABLED", false),
		buildMaxBytes:            int64Env("SWARMOPS_AGENT_BUILD_MAX_BYTES", 512<<20),
		buildMaxCPUs:             floatEnv("SWARMOPS_AGENT_BUILD_MAX_CPUS", 2),
		buildMaxMemoryMiB:        int64Env("SWARMOPS_AGENT_BUILD_MAX_MEMORY_MIB", 2048),
		dockerSocket:             env("SWARMOPS_DOCKER_SOCKET", "/var/run/docker.sock"),
		enrollmentSecret:         enrollmentSecret,
		enrollmentSecretFile:     enrollmentSecretFile,
		listenAddr:               env("SWARMOPS_AGENT_LISTEN_ADDR", ":9180"),
		managedStateFile:         strings.TrimSpace(os.Getenv("SWARMOPS_AGENT_MANAGED_STATE_FILE")),
		mobilityEnabled:          boolEnv("SWARMOPS_AGENT_MOBILITY_ENABLED", false),
		mobilityTransferDir:      env("SWARMOPS_AGENT_MOBILITY_TRANSFER_DIR", "/var/lib/swarmops-agent/transfers"),
		mobilityTransferMaxBytes: int64Env("SWARMOPS_AGENT_MOBILITY_TRANSFER_MAX_BYTES", 64<<30),
		remoteControlEnabled:     boolEnv("SWARMOPS_AGENT_REMOTE_CONTROL_ENABLED", false),
		tlsCertFile:              strings.TrimSpace(os.Getenv("SWARMOPS_AGENT_TLS_CERT_FILE")),
		tlsKeyFile:               strings.TrimSpace(os.Getenv("SWARMOPS_AGENT_TLS_KEY_FILE")),
		token:                    token,
	}
	if config.buildMaxBytes <= 0 || config.buildMaxCPUs <= 0 || config.buildMaxMemoryMiB <= 0 || config.mobilityTransferMaxBytes <= 0 || len(config.allowedImagePrefixes) == 0 {
		return runtimeConfig{}, fmt.Errorf("agent build limits and image prefixes must be configured")
	}
	if (config.tlsCertFile == "") != (config.tlsKeyFile == "") {
		return runtimeConfig{}, fmt.Errorf("SWARMOPS_AGENT_TLS_CERT_FILE and SWARMOPS_AGENT_TLS_KEY_FILE must be configured together")
	}
	if config.tlsCertFile != "" {
		if err := regularFile(config.tlsCertFile, "agent TLS certificate"); err != nil {
			return runtimeConfig{}, err
		}
		if err := protectedFile(config.tlsKeyFile, "agent TLS private key"); err != nil {
			return runtimeConfig{}, err
		}
	}
	if config.remoteControlEnabled {
		loopback, err := listenAddressIsLoopback(config.listenAddr)
		if err != nil {
			return runtimeConfig{}, err
		}
		if !loopback && config.tlsCertFile == "" {
			return runtimeConfig{}, fmt.Errorf("remote control on a non-loopback listener requires agent TLS")
		}
	}
	if config.bootstrapEnabled && !config.remoteControlEnabled {
		return runtimeConfig{}, fmt.Errorf("managed host bootstrap requires remote control")
	}
	if config.mobilityEnabled && !config.remoteControlEnabled {
		return runtimeConfig{}, fmt.Errorf("managed volume mobility requires remote control")
	}
	if config.mobilityEnabled && (!filepath.IsAbs(config.mobilityTransferDir) || filepath.Clean(config.mobilityTransferDir) == "/") {
		return runtimeConfig{}, fmt.Errorf("SWARMOPS_AGENT_MOBILITY_TRANSFER_DIR must be an absolute non-root path")
	}
	return config, nil
}

func serve(server *http.Server, config runtimeConfig) error {
	if config.tlsCertFile != "" {
		return server.ListenAndServeTLS(config.tlsCertFile, config.tlsKeyFile)
	}
	return server.ListenAndServe()
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
	if err := protectedFile(name, "agent token"); err != nil {
		return nil, err
	}
	value, err := os.ReadFile(filepath.Clean(name))
	if err != nil {
		return nil, err
	}
	value = []byte(strings.TrimSpace(string(value)))
	if len(value) == 0 {
		return nil, fmt.Errorf("agent token file is empty")
	}
	if strings.ContainsAny(string(value), " \t\r\n\x00") {
		return nil, fmt.Errorf("agent token file must contain one non-whitespace token")
	}
	return value, nil
}

func regularFile(name, label string) error {
	info, err := os.Lstat(filepath.Clean(name))
	if err != nil {
		return fmt.Errorf("read %s: %w", label, err)
	}
	if info.Mode()&os.ModeSymlink != 0 || !info.Mode().IsRegular() {
		return fmt.Errorf("%s must be a regular file", label)
	}
	return nil
}

func protectedFile(name, label string) error {
	if err := regularFile(name, label); err != nil {
		return err
	}
	info, err := os.Lstat(filepath.Clean(name))
	if err != nil {
		return fmt.Errorf("read %s: %w", label, err)
	}
	if info.Mode().Perm()&0o077 != 0 {
		return fmt.Errorf("%s must be readable only by its owner", label)
	}
	return nil
}

func listenAddressIsLoopback(address string) (bool, error) {
	host, port, err := net.SplitHostPort(strings.TrimSpace(address))
	if err != nil {
		return false, fmt.Errorf("SWARMOPS_AGENT_LISTEN_ADDR must be a host:port address")
	}
	if _, err := strconv.ParseUint(port, 10, 16); err != nil {
		return false, fmt.Errorf("SWARMOPS_AGENT_LISTEN_ADDR has an invalid port")
	}
	if host == "localhost" {
		return true, nil
	}
	if host == "" {
		return false, nil
	}
	ip, err := netip.ParseAddr(host)
	if err != nil {
		return false, fmt.Errorf("SWARMOPS_AGENT_LISTEN_ADDR must use an IP address or localhost")
	}
	return ip.IsLoopback(), nil
}

func boolEnv(key string, fallback bool) bool {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	parsed, err := strconv.ParseBool(value)
	if err != nil {
		return fallback
	}
	return parsed
}

func int64Env(key string, fallback int64) int64 {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	parsed, err := strconv.ParseInt(value, 10, 64)
	if err != nil {
		return fallback
	}
	return parsed
}

func floatEnv(key string, fallback float64) float64 {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	parsed, err := strconv.ParseFloat(value, 64)
	if err != nil {
		return fallback
	}
	return parsed
}

func splitCSV(value string) []string {
	result := make([]string, 0)
	for _, item := range strings.Split(value, ",") {
		item = strings.TrimSpace(item)
		if item != "" {
			result = append(result, item)
		}
	}
	return result
}
