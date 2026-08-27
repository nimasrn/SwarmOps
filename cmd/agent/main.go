// Command agent starts the SwarmOps node agent. Remote control remains off
// unless it is explicitly enabled with a protected API key and TLS listener.
package main

import (
	"context"
	"crypto/rand"
	"crypto/tls"
	"encoding/base64"
	"errors"
	"flag"
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
	apiKeyLength     = 32
	buildTimeout     = 30 * time.Minute
	provisionTimeout = 50 * time.Minute
)

var version = "0.6.1"

func main() {
	if len(os.Args) > 1 && os.Args[1] == "--version" {
		fmt.Println(version)
		return
	}
	if len(os.Args) > 1 && os.Args[1] == "upgrade" {
		runAgentUpgrade(os.Args[2:])
		return
	}
	if len(os.Args) > 1 && os.Args[1] == "provisioner" {
		runProvisioner(os.Args[2:])
		return
	}
	if len(os.Args) > 1 && os.Args[1] == "gen" {
		if len(os.Args) > 2 && os.Args[2] == "key" {
			runGenerateKey(os.Args[2:])
			return
		}
		runGenerator(os.Args[2:])
		return
	}
	if len(os.Args) > 1 && os.Args[1] == "enroll" {
		runEnrollment(os.Args[2:])
		return
	}
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
		AllowedImagePrefixes: runtime.allowedImagePrefixes,
		AutomaticUpdates:     runtime.automaticUpdates,
		BuildEnabled:         runtime.buildEnabled,
		BuildMaxBytes:        runtime.buildMaxBytes,
		BuildMaxCPUs:         runtime.buildMaxCPUs,
		BuildMaxMemoryMiB:    runtime.buildMaxMemoryMiB,
		Docker:               docker,
		LokiBaseURL:          env("SWARMOPS_LOKI_INTERNAL_URL", "http://swarmops-loki.swarmops.internal:8081"),
		PrometheusBaseURL:    env("SWARMOPS_PROMETHEUS_INTERNAL_URL", "http://swarmops-prometheus.swarmops.internal:8081"),
		TraefikAPIBaseURL:    env("SWARMOPS_TRAEFIK_INTERNAL_API_URL", "http://traefik_traefik:8080/api"),
		EnrollmentSecret:     runtime.enrollmentSecret,
		EnrollmentSecretFile: runtime.enrollmentSecretFile,
		HostOS:               env("SWARMOPS_HOST_OS", "/host/etc/os-release"),
		HostProc:             env("SWARMOPS_HOST_PROC", "/host/proc"),
		HostRoot:             env("SWARMOPS_HOST_ROOT", "/host"),
		NodeName:             os.Getenv("NODE_NAME"),
		ProvisionSocket:      runtime.provisionSocket,
		RemoteControlEnabled: runtime.remoteControlEnabled,
		UpdateBusyFile:       runtime.updateBusyFile,
		UpdateRequestFile:    runtime.updateRequestFile,
		UpdateStatusFile:     runtime.updateStatusFile,
		Version:              version,
	}, runtime.token)
	if err != nil {
		logger.Error("create agent", "error", err)
		os.Exit(1)
	}
	if runtime.coreURL != "" {
		client, err := newOutboundClient(runtime, agentServer)
		if err != nil {
			logger.Error("configure outbound Core connection", "error", err)
			os.Exit(1)
		}
		ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
		defer stop()
		logger.Info("SwarmOps agent connecting outbound", "core", runtime.coreURL, "version", version)
		if err := client.Run(ctx); err != nil && ctx.Err() == nil {
			logger.Error("outbound Core connection stopped", "error", err)
			os.Exit(1)
		}
		return
	}
	readTimeout := 10 * time.Second
	writeTimeout := 10 * time.Second
	if runtime.remoteControlEnabled {
		// Fixed commands and bounded image builds can take materially longer
		// than inventory collection. Endpoint-level limits and contexts keep
		// them bounded while ReadHeaderTimeout protects the handshake.
		readTimeout = provisionTimeout
		writeTimeout = provisionTimeout
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
	allowedImagePrefixes []string
	automaticUpdates     bool
	buildEnabled         bool
	buildMaxBytes        int64
	buildMaxCPUs         float64
	buildMaxMemoryMiB    int64
	dockerSocket         string
	enrollmentSecret     []byte
	enrollmentSecretFile string
	listenAddr           string
	remoteControlEnabled bool
	updateBusyFile       string
	updateRequestFile    string
	updateStatusFile     string
	provisionSocket      string
	tlsCertFile          string
	tlsKeyFile           string
	token                []byte
	coreURL              string
	outboundStateDir     string
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
		allowedImagePrefixes: splitCSV(env("SWARMOPS_AGENT_IMAGE_PREFIXES", "ghcr.io/nimasrn/")),
		automaticUpdates:     boolEnv("SWARMOPS_AGENT_AUTO_UPDATE_ENABLED", false),
		buildEnabled:         boolEnv("SWARMOPS_AGENT_BUILD_ENABLED", false),
		buildMaxBytes:        int64Env("SWARMOPS_AGENT_BUILD_MAX_BYTES", 512<<20),
		buildMaxCPUs:         floatEnv("SWARMOPS_AGENT_BUILD_MAX_CPUS", 2),
		buildMaxMemoryMiB:    int64Env("SWARMOPS_AGENT_BUILD_MAX_MEMORY_MIB", 2048),
		dockerSocket:         env("SWARMOPS_DOCKER_SOCKET", "/var/run/docker.sock"),
		enrollmentSecret:     enrollmentSecret,
		enrollmentSecretFile: enrollmentSecretFile,
		listenAddr:           env("SWARMOPS_AGENT_LISTEN_ADDR", ":9180"),
		remoteControlEnabled: boolEnv("SWARMOPS_AGENT_REMOTE_CONTROL_ENABLED", false),
		updateBusyFile:       strings.TrimSpace(os.Getenv("SWARMOPS_AGENT_UPDATE_BUSY_FILE")),
		updateRequestFile:    strings.TrimSpace(os.Getenv("SWARMOPS_AGENT_UPDATE_REQUEST_FILE")),
		updateStatusFile:     strings.TrimSpace(os.Getenv("SWARMOPS_AGENT_UPDATE_STATUS_FILE")),
		provisionSocket:      strings.TrimSpace(os.Getenv("SWARMOPS_AGENT_PROVISION_SOCKET")),
		tlsCertFile:          strings.TrimSpace(os.Getenv("SWARMOPS_AGENT_TLS_CERT_FILE")),
		tlsKeyFile:           strings.TrimSpace(os.Getenv("SWARMOPS_AGENT_TLS_KEY_FILE")),
		token:                token,
		coreURL:              strings.TrimSuffix(strings.TrimSpace(os.Getenv("SWARMOPS_CORE_URL")), "/"),
		outboundStateDir:     env("SWARMOPS_AGENT_STATE_DIR", "/var/lib/swarmops-agent"),
	}
	if config.buildMaxBytes <= 0 || config.buildMaxCPUs <= 0 || config.buildMaxMemoryMiB <= 0 || len(config.allowedImagePrefixes) == 0 {
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
	if config.remoteControlEnabled && config.coreURL == "" {
		loopback, err := listenAddressIsLoopback(config.listenAddr)
		if err != nil {
			return runtimeConfig{}, err
		}
		if !loopback && config.tlsCertFile == "" {
			return runtimeConfig{}, fmt.Errorf("remote control on a non-loopback listener requires agent TLS")
		}
	}
	return config, nil
}

func runProvisioner(args []string) {
	flags := flag.NewFlagSet("provisioner", flag.ExitOnError)
	socket := flags.String("socket", "", "private Unix socket path")
	agentPort := flags.Uint("agent-port", 0, "machine API TCP port")
	if err := flags.Parse(args); err != nil {
		return
	}
	if flags.NArg() != 0 || *agentPort == 0 || *agentPort > 65535 {
		slog.Error("invalid provisioning helper configuration")
		return
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	if err := agent.ServeProvisioner(ctx, *socket, uint16(*agentPort)); err != nil && ctx.Err() == nil {
		slog.Error("serve provisioning helper", "error", err)
	}
}

func runGenerator(args []string) {
	if len(args) < 1 {
		printUsage()
		os.Exit(1)
		return
	}
	switch args[0] {
	case "apikey":
		runGenerateAPIKey(args[1:])
	default:
		printUsage()
		os.Exit(1)
	}
}

func runGenerateAPIKey(args []string) {
	flags := flag.NewFlagSet("gen apikey", flag.ExitOnError)
	keyFile := flags.String("key-file", os.Getenv("SWARMOPS_AGENT_TOKEN_FILE"), "path to the api key file to write")
	if err := flags.Parse(args); err != nil {
		os.Exit(1)
	}
	if flags.NArg() != 0 {
		slog.Error("unexpected positional arguments", "args", strings.Join(flags.Args(), " "))
		printUsage()
		os.Exit(1)
	}
	path := strings.TrimSpace(*keyFile)
	if path == "" {
		slog.Error("missing api key path", "hint", "set SWARMOPS_AGENT_TOKEN_FILE or pass --key-file")
		os.Exit(1)
	}
	path = filepath.Clean(path)
	if err := validateAPIKeyFilePath(path); err != nil {
		slog.Error("invalid api key path", "error", err)
		os.Exit(1)
	}
	rawKey := make([]byte, apiKeyLength)
	if _, err := rand.Read(rawKey); err != nil {
		slog.Error("generate api key", "error", err)
		os.Exit(1)
	}
	key := base64.StdEncoding.EncodeToString(rawKey)
	if err := writeAPIKeyToFile(path, key); err != nil {
		slog.Error("write api key", "error", err)
		os.Exit(1)
	}
	fmt.Println(key)
	fmt.Printf("machine API key written to %s\n", path)
}

func printUsage() {
	fmt.Println("usage:")
	fmt.Println("  swarmops-agent --version")
	fmt.Println("  swarmops-agent upgrade")
	fmt.Println("  swarmops-agent provisioner --socket <path> --agent-port <port>")
	fmt.Println("  swarmops-agent gen key [--key-file <path>]")
	fmt.Println("  swarmops-agent gen apikey [--key-file <path>]")
}

func validateAPIKeyFilePath(name string) error {
	info, err := os.Lstat(name)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil
		}
		return fmt.Errorf("read %s: %w", name, err)
	}
	if info.Mode()&os.ModeSymlink != 0 {
		return fmt.Errorf("%s must not be a symlink", name)
	}
	if !info.Mode().IsRegular() {
		return fmt.Errorf("%s must be a regular file", name)
	}
	if info.Mode().Perm()&0o077 != 0 {
		return fmt.Errorf("%s must be readable only by its owner", name)
	}
	return nil
}

func writeAPIKeyToFile(name, key string) error {
	directory := filepath.Dir(name)
	file, err := os.CreateTemp(directory, ".swarmops-apikey-*.tmp")
	if err != nil {
		return fmt.Errorf("create temp api key file in %s: %w", directory, err)
	}
	tmpName := file.Name()
	defer os.Remove(tmpName)
	if err := file.Chmod(0o600); err != nil {
		_ = file.Close()
		return fmt.Errorf("set temp file permissions: %w", err)
	}
	if _, err := file.WriteString(key); err != nil {
		_ = file.Close()
		return fmt.Errorf("write temp api key file: %w", err)
	}
	if err := file.Close(); err != nil {
		return fmt.Errorf("close temp api key file: %w", err)
	}
	if err := os.Rename(tmpName, name); err != nil {
		return fmt.Errorf("install api key file: %w", err)
	}
	return nil
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
