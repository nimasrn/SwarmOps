// Package config owns process configuration and keeps secret material out of
// callers. Values are read once at process startup and never logged.
package config

import (
	"bytes"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"net"
	"net/netip"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

const (
	productionDefaultAdminUsername = "operator"
	localDevAdminUsername          = "admin"
	// This deliberately public bcrypt value is selected only after the caller
	// explicitly opts into insecure local development authentication.
	localDevAdminPasswordHash = "$2y$04$bZU0e5IpRYxctcXBNjDMm.KCRQJbRGzSOYZr619Wh0OeK8kdmiucm"
)

type Config struct {
	AdminPasswordHash               []byte
	AdminUsername                   string
	AgentService                    string
	AgentToken                      []byte
	AgentStackFile                  string
	AllowedClientCIDRs              []netip.Prefix
	BuildEnabled                    bool
	BuildMaxBytes                   int64
	BuildMaxCPUs                    float64
	BuildMaxMemoryMiB               int64
	DataDir                         string
	DataEncryptionKey               []byte
	DevMachineAPI                   *DevMachineAPI
	ImagePrefixes                   []string
	InsecureDevAuth                 bool
	ListenAddr                      string
	LogsStackFile                   string
	MutationEnabled                 bool
	ObservabilityStackFile          string
	PlatformManifestFile            string
	RegistryAuth                    []byte
	SecureCookies                   bool
	SessionKey                      []byte
	SessionTTL                      time.Duration
	TLSCertFile                     string
	TLSKeyFile                      string
	TraefikDashboardURL             string
	TraefikACMEEmail                string
	TraefikArvanAPIKeySecret        string
	TraefikCFDNSTokenSecret         string
	TraefikDashboardAuthSecret      string
	TraefikDashboardHost            string
	TraefikDynamicConfigName        string
	TraefikImage                    string
	TraefikStackFile                string
	TrustedAgentTokenSecret         string
	TrustedAlertmanagerConfig       string
	TrustedAlertmanagerImage        string
	TrustedAlloyConfig              string
	TrustedAlloyImage               string
	TrustedGrafanaDashboard         string
	TrustedGrafanaDashboardProvider string
	TrustedGrafanaDatasources       string
	TrustedGrafanaHost              string
	TrustedGrafanaImage             string
	TrustedGrafanaPasswordSecret    string
	TrustedJaegerConfig             string
	TrustedJaegerImage              string
	TrustedLokiConfig               string
	TrustedLokiImage                string
	TrustedNodeExporterImage        string
	TrustedPrometheusConfig         string
	TrustedPrometheusImage          string
	TrustedPrometheusRetention      string
	TrustedPrometheusRules          string
	TrustedRegistry                 string
	TrustedRegistryNamespace        string
	TrustedTag                      string
}

// DevMachineAPI is the loopback-only machine-agent connection used by the
// local development commands. It is intentionally available only when the
// caller opted into insecure development authentication. Its API key remains
// process-local and is never stored in the server profile.
type DevMachineAPI struct {
	APIKey                    []byte
	APIURL                    string
	Name                      string
	Port                      uint16
	TLSCertificateFingerprint string
}

func Load() (Config, error) {
	assetDir := env("SWARMOPS_ASSET_DIR", "/opt/swarmops")
	c := Config{
		AdminUsername:                   env("SWARMOPS_ADMIN_USERNAME", productionDefaultAdminUsername),
		AgentService:                    env("SWARMOPS_AGENT_SERVICE", "swarmops-agent_agent"),
		AgentStackFile:                  env("SWARMOPS_AGENT_STACK_FILE", filepath.Join(assetDir, "agent.yml")),
		BuildEnabled:                    envBool("SWARMOPS_BUILD_ENABLED", false),
		BuildMaxBytes:                   envInt64("SWARMOPS_BUILD_MAX_BYTES", 512<<20),
		BuildMaxCPUs:                    envFloat("SWARMOPS_BUILD_MAX_CPUS", 2),
		BuildMaxMemoryMiB:               envInt64("SWARMOPS_BUILD_MAX_MEMORY_MIB", 2048),
		DataDir:                         env("SWARMOPS_DATA_DIR", "/var/lib/swarmops"),
		ImagePrefixes:                   csv(env("SWARMOPS_IMAGE_PREFIXES", "")),
		InsecureDevAuth:                 envBool("SWARMOPS_INSECURE_DEV_AUTH", false),
		ListenAddr:                      env("SWARMOPS_LISTEN_ADDR", ":8084"),
		LogsStackFile:                   env("SWARMOPS_LOGS_STACK_FILE", filepath.Join(assetDir, "logs.yml")),
		MutationEnabled:                 envBool("SWARMOPS_MUTATIONS_ENABLED", false),
		ObservabilityStackFile:          env("SWARMOPS_OBSERVABILITY_STACK_FILE", filepath.Join(assetDir, "observability.yml")),
		PlatformManifestFile:            env("SWARMOPS_PLATFORM_MANIFEST_FILE", ""),
		SecureCookies:                   envBool("SWARMOPS_SECURE_COOKIES", true),
		SessionTTL:                      envDuration("SWARMOPS_SESSION_TTL", 12*time.Hour),
		TLSCertFile:                     env("SWARMOPS_TLS_CERT_FILE", ""),
		TLSKeyFile:                      env("SWARMOPS_TLS_KEY_FILE", ""),
		TraefikDashboardURL:             env("SWARMOPS_TRAEFIK_DASHBOARD_URL", ""),
		TraefikACMEEmail:                env("TRAEFIK_ACME_EMAIL", ""),
		TraefikArvanAPIKeySecret:        env("TRAEFIK_ARVAN_API_KEY_SECRET", "traefik_arvan_api_key_v1"),
		TraefikCFDNSTokenSecret:         env("TRAEFIK_CF_DNS_TOKEN_SECRET", "traefik_cf_dns_token_v1"),
		TraefikDashboardAuthSecret:      env("TRAEFIK_DASHBOARD_AUTH_SECRET", "traefik_dashboard_auth_v1"),
		TraefikDashboardHost:            env("TRAEFIK_DASHBOARD_HOST", ""),
		TraefikDynamicConfigName:        env("TRAEFIK_DYNAMIC_CONFIG_NAME", "nim_traefik_dynamic_v1"),
		TraefikImage:                    env("TRAEFIK_IMAGE", "traefik:v3.6.13"),
		TraefikStackFile:                env("SWARMOPS_TRAEFIK_STACK_FILE", filepath.Join(assetDir, "traefik.yml")),
		TrustedAgentTokenSecret:         env("SWARMOPS_AGENT_TOKEN_SECRET", "swarmops_agent_token_v1"),
		TrustedAlertmanagerConfig:       env("SWARMOPS_ALERTMANAGER_CONFIG_NAME", "swarmops_alertmanager_config_v1"),
		TrustedAlertmanagerImage:        env("ALERTMANAGER_IMAGE", "prom/alertmanager:v0.33.1"),
		TrustedAlloyConfig:              env("SWARMOPS_ALLOY_CONFIG_NAME", "swarmops_alloy_config_v1"),
		TrustedAlloyImage:               env("ALLOY_IMAGE", "grafana/alloy:v1.18.1"),
		TrustedGrafanaDashboard:         env("SWARMOPS_GRAFANA_DASHBOARD_CONFIG_NAME", "swarmops_grafana_dashboard_v1"),
		TrustedGrafanaDashboardProvider: env("SWARMOPS_GRAFANA_DASHBOARD_PROVIDER_CONFIG_NAME", "swarmops_grafana_dashboard_provider_v1"),
		TrustedGrafanaDatasources:       env("SWARMOPS_GRAFANA_DATASOURCES_CONFIG_NAME", "swarmops_grafana_datasources_v1"),
		TrustedGrafanaHost:              env("GRAFANA_HOST", "grafana.nim.zone"),
		TrustedGrafanaImage:             env("GRAFANA_IMAGE", "grafana/grafana:13.1.4"),
		TrustedGrafanaPasswordSecret:    env("GRAFANA_ADMIN_PASSWORD_SECRET", "swarmops_grafana_admin_password_v1"),
		TrustedJaegerConfig:             env("SWARMOPS_JAEGER_CONFIG_NAME", "swarmops_jaeger_config_v1"),
		TrustedJaegerImage:              env("JAEGER_IMAGE", "jaegertracing/jaeger:2.20.0"),
		TrustedLokiConfig:               env("SWARMOPS_LOKI_CONFIG_NAME", "swarmops_loki_config_v1"),
		TrustedLokiImage:                env("LOKI_IMAGE", "grafana/loki:3.7.4"),
		TrustedNodeExporterImage:        env("NODE_EXPORTER_IMAGE", "prom/node-exporter:v1.12.1"),
		TrustedPrometheusConfig:         env("SWARMOPS_PROMETHEUS_CONFIG_NAME", "swarmops_prometheus_config_v1"),
		TrustedPrometheusImage:          env("PROMETHEUS_IMAGE", "prom/prometheus:v3.14.0"),
		TrustedPrometheusRetention:      env("PROMETHEUS_RETENTION", "15d"),
		TrustedPrometheusRules:          env("SWARMOPS_PROMETHEUS_RULES_CONFIG_NAME", "swarmops_prometheus_rules_v1"),
		TrustedRegistry:                 env("REGISTRY", "ghcr.io"),
		TrustedRegistryNamespace:        env("REGISTRY_NS", "nimasrn"),
		TrustedTag:                      env("TAG", ""),
	}
	if !c.InsecureDevAuth && devMachineAPIConfigured() {
		return Config{}, fmt.Errorf("SWARMOPS_DEV_MACHINE_API_* is available only with SWARMOPS_INSECURE_DEV_AUTH")
	}

	if c.BuildMaxBytes <= 0 || c.BuildMaxMemoryMiB <= 0 || c.BuildMaxCPUs <= 0 {
		return Config{}, fmt.Errorf("build limits must be positive")
	}
	if c.SessionTTL < time.Minute || c.SessionTTL > 7*24*time.Hour {
		return Config{}, fmt.Errorf("SWARMOPS_SESSION_TTL must be between one minute and seven days")
	}
	if dashboardURL := strings.TrimSpace(c.TraefikDashboardURL); dashboardURL != "" && !strings.HasPrefix(dashboardURL, "https://") {
		return Config{}, fmt.Errorf("SWARMOPS_TRAEFIK_DASHBOARD_URL must use https")
	}
	if err := os.MkdirAll(c.DataDir, 0o700); err != nil {
		return Config{}, fmt.Errorf("create data directory: %w", err)
	}

	if c.InsecureDevAuth {
		c.AdminUsername = env("SWARMOPS_ADMIN_USERNAME", localDevAdminUsername)
		c.AdminPasswordHash = []byte(env("SWARMOPS_DEV_PASSWORD_HASH", localDevAdminPasswordHash))
		c.SessionKey = []byte(env("SWARMOPS_DEV_SESSION_KEY", ""))
		if len(c.SessionKey) < 32 {
			return Config{}, fmt.Errorf("SWARMOPS_DEV_SESSION_KEY must contain at least 32 bytes when SWARMOPS_INSECURE_DEV_AUTH is enabled")
		}
		devMachineAPI, err := loadDevMachineAPI()
		if err != nil {
			return Config{}, err
		}
		c.DevMachineAPI = devMachineAPI
		derivedKey := sha256.Sum256(c.SessionKey)
		c.DataEncryptionKey = derivedKey[:]
		return c, nil
	}

	var err error
	if c.AdminPasswordHash, err = readProtectedSecret(env("SWARMOPS_ADMIN_PASSWORD_HASH_FILE", ""), "admin password hash"); err != nil {
		return Config{}, fmt.Errorf("admin password hash: %w", err)
	}
	if c.SessionKey, err = readProtectedSecret(env("SWARMOPS_SESSION_KEY_FILE", ""), "session key"); err != nil {
		return Config{}, fmt.Errorf("session key: %w", err)
	}
	if registryFile := strings.TrimSpace(env("SWARMOPS_REGISTRY_CONFIG_FILE", "")); registryFile != "" {
		if c.RegistryAuth, err = readProtectedSecret(registryFile, "registry config"); err != nil {
			return Config{}, fmt.Errorf("registry config: %w", err)
		}
		var registryConfig map[string]any
		if err := json.Unmarshal(c.RegistryAuth, &registryConfig); err != nil || registryConfig == nil {
			return Config{}, fmt.Errorf("registry config must be a JSON object")
		}
	}
	if agentTokenFile := strings.TrimSpace(env("SWARMOPS_AGENT_TOKEN_FILE", "")); agentTokenFile != "" {
		if c.AgentToken, err = readProtectedSecret(agentTokenFile, "agent token"); err != nil {
			return Config{}, fmt.Errorf("agent token: %w", err)
		}
		if len(c.AgentToken) < 16 {
			return Config{}, fmt.Errorf("agent token must contain at least 16 bytes")
		}
	}
	if len(c.SessionKey) < 32 {
		return Config{}, fmt.Errorf("session key must contain at least 32 bytes")
	}
	if c.DataEncryptionKey, err = readDataEncryptionKey(env("SWARMOPS_DATA_ENCRYPTION_KEY_FILE", "")); err != nil {
		return Config{}, fmt.Errorf("data encryption key: %w", err)
	}
	if !c.SecureCookies {
		return Config{}, fmt.Errorf("SWARMOPS_SECURE_COOKIES must remain true outside insecure development")
	}
	if (c.TLSCertFile == "") != (c.TLSKeyFile == "") {
		return Config{}, fmt.Errorf("SWARMOPS_TLS_CERT_FILE and SWARMOPS_TLS_KEY_FILE must be configured together")
	}
	if c.TLSCertFile != "" {
		if err := requireRegularFile(c.TLSCertFile, "TLS certificate"); err != nil {
			return Config{}, err
		}
		if err := requireProtectedFile(c.TLSKeyFile, "TLS private key"); err != nil {
			return Config{}, err
		}
		loopback, err := listenAddressIsLoopback(c.ListenAddr)
		if err != nil {
			return Config{}, err
		}
		if !loopback {
			if c.AllowedClientCIDRs, err = parseClientCIDRs(env("SWARMOPS_ALLOWED_CLIENT_CIDRS", "")); err != nil {
				return Config{}, err
			}
			if len(c.AllowedClientCIDRs) == 0 {
				return Config{}, fmt.Errorf("SWARMOPS_ALLOWED_CLIENT_CIDRS is required for direct TLS on a non-loopback listener")
			}
		}
	}
	return c, nil
}

func devMachineAPIConfigured() bool {
	for _, name := range []string{
		"SWARMOPS_DEV_MACHINE_API_CERT_FILE",
		"SWARMOPS_DEV_MACHINE_API_KEY_FILE",
		"SWARMOPS_DEV_MACHINE_API_NAME",
		"SWARMOPS_DEV_MACHINE_API_PORT",
		"SWARMOPS_DEV_MACHINE_API_URL",
	} {
		if strings.TrimSpace(os.Getenv(name)) != "" {
			return true
		}
	}
	return false
}

func loadDevMachineAPI() (*DevMachineAPI, error) {
	if !devMachineAPIConfigured() {
		return nil, nil
	}
	keyFile := strings.TrimSpace(os.Getenv("SWARMOPS_DEV_MACHINE_API_KEY_FILE"))
	certificateFile := strings.TrimSpace(os.Getenv("SWARMOPS_DEV_MACHINE_API_CERT_FILE"))
	if keyFile == "" || certificateFile == "" {
		return nil, fmt.Errorf("SWARMOPS_DEV_MACHINE_API_KEY_FILE and SWARMOPS_DEV_MACHINE_API_CERT_FILE must be configured together")
	}
	apiKey, err := readProtectedSecret(keyFile, "local development machine API key")
	if err != nil {
		return nil, fmt.Errorf("local development machine API key: %w", err)
	}
	apiKey = bytes.TrimSpace(apiKey)
	if len(apiKey) < 16 || len(apiKey) > 4096 || bytes.ContainsAny(apiKey, " \t\r\n\x00") {
		return nil, fmt.Errorf("local development machine API key must contain between 16 and 4096 non-whitespace bytes")
	}
	fingerprint, err := localCertificateFingerprint(certificateFile)
	if err != nil {
		return nil, err
	}
	apiURL, err := localMachineAPIURL(env("SWARMOPS_DEV_MACHINE_API_URL", "https://127.0.0.1"))
	if err != nil {
		return nil, err
	}
	port, err := localMachineAPIPort(env("SWARMOPS_DEV_MACHINE_API_PORT", "9180"))
	if err != nil {
		return nil, err
	}
	name := env("SWARMOPS_DEV_MACHINE_API_NAME", "Local machine")
	if len(name) == 0 || len(name) > 96 || strings.ContainsAny(name, "\r\n\x00") {
		return nil, fmt.Errorf("SWARMOPS_DEV_MACHINE_API_NAME must be between 1 and 96 characters")
	}
	return &DevMachineAPI{
		APIKey:                    apiKey,
		APIURL:                    apiURL,
		Name:                      name,
		Port:                      port,
		TLSCertificateFingerprint: fingerprint,
	}, nil
}

func localCertificateFingerprint(path string) (string, error) {
	if err := requireRegularFile(path, "local development machine API certificate"); err != nil {
		return "", err
	}
	data, err := os.ReadFile(filepath.Clean(path))
	if err != nil {
		return "", fmt.Errorf("read local development machine API certificate: %w", err)
	}
	block, rest := pem.Decode(data)
	if block == nil || block.Type != "CERTIFICATE" || len(bytes.TrimSpace(rest)) != 0 {
		return "", fmt.Errorf("local development machine API certificate must contain one PEM certificate")
	}
	certificate, err := x509.ParseCertificate(block.Bytes)
	if err != nil {
		return "", fmt.Errorf("parse local development machine API certificate: %w", err)
	}
	digest := sha256.Sum256(certificate.Raw)
	return "SHA256:" + strings.ToUpper(hex.EncodeToString(digest[:])), nil
}

func localMachineAPIURL(value string) (string, error) {
	parsed, err := url.Parse(strings.TrimSpace(value))
	if err != nil || parsed.Scheme != "https" || parsed.Hostname() == "" {
		return "", fmt.Errorf("SWARMOPS_DEV_MACHINE_API_URL must be an absolute HTTPS loopback origin")
	}
	if parsed.User != nil || parsed.Port() != "" || (parsed.Path != "" && parsed.Path != "/") || parsed.RawQuery != "" || parsed.Fragment != "" {
		return "", fmt.Errorf("SWARMOPS_DEV_MACHINE_API_URL must not include credentials, a port, path, query, or fragment")
	}
	host := strings.Trim(parsed.Hostname(), "[]")
	if host != "localhost" {
		address, err := netip.ParseAddr(host)
		if err != nil || !address.IsLoopback() {
			return "", fmt.Errorf("SWARMOPS_DEV_MACHINE_API_URL must use localhost or a loopback IP address")
		}
	}
	return parsed.Scheme + "://" + parsed.Host, nil
}

func localMachineAPIPort(value string) (uint16, error) {
	parsed, err := strconv.ParseUint(strings.TrimSpace(value), 10, 16)
	if err != nil || parsed == 0 {
		return 0, fmt.Errorf("SWARMOPS_DEV_MACHINE_API_PORT must be between 1 and 65535")
	}
	return uint16(parsed), nil
}

func readSecret(name string) ([]byte, error) {
	if strings.TrimSpace(name) == "" {
		return nil, fmt.Errorf("secret file is required")
	}
	clean := filepath.Clean(name)
	b, err := os.ReadFile(clean)
	if err != nil {
		return nil, err
	}
	b = bytes.TrimSpace(b)
	if len(b) == 0 {
		return nil, fmt.Errorf("secret file is empty")
	}
	return b, nil
}

func readProtectedSecret(name, label string) ([]byte, error) {
	if err := requireProtectedFile(name, label); err != nil {
		return nil, err
	}
	return readSecret(name)
}

func readDataEncryptionKey(name string) ([]byte, error) {
	if err := requireProtectedFile(name, "data encryption key"); err != nil {
		return nil, err
	}
	encoded, err := readSecret(name)
	if err != nil {
		return nil, err
	}
	key, err := base64.StdEncoding.DecodeString(string(encoded))
	if err != nil {
		key, err = base64.RawStdEncoding.DecodeString(string(encoded))
	}
	if err != nil {
		return nil, fmt.Errorf("must be standard base64")
	}
	if len(key) != 32 {
		return nil, fmt.Errorf("must decode to exactly 32 bytes")
	}
	return key, nil
}

func requireRegularFile(path, label string) error {
	info, err := os.Lstat(filepath.Clean(path))
	if err != nil {
		return fmt.Errorf("read %s: %w", label, err)
	}
	if info.Mode()&os.ModeSymlink != 0 {
		return fmt.Errorf("%s must not be a symbolic link", label)
	}
	if !info.Mode().IsRegular() {
		return fmt.Errorf("%s must be a regular file", label)
	}
	return nil
}

func requireProtectedFile(path, label string) error {
	if err := requireRegularFile(path, label); err != nil {
		return err
	}
	info, err := os.Lstat(filepath.Clean(path))
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
		return false, fmt.Errorf("SWARMOPS_LISTEN_ADDR must be a host:port address for direct TLS")
	}
	if _, err := strconv.ParseUint(port, 10, 16); err != nil {
		return false, fmt.Errorf("SWARMOPS_LISTEN_ADDR has an invalid port")
	}
	if host == "localhost" {
		return true, nil
	}
	if host == "" {
		return false, nil
	}
	ip, err := netip.ParseAddr(host)
	if err != nil {
		return false, fmt.Errorf("SWARMOPS_LISTEN_ADDR must use a local IP address or localhost for direct TLS")
	}
	return ip.IsLoopback(), nil
}

func parseClientCIDRs(value string) ([]netip.Prefix, error) {
	var result []netip.Prefix
	for _, item := range strings.Split(value, ",") {
		item = strings.TrimSpace(item)
		if item == "" {
			continue
		}
		prefix, err := netip.ParsePrefix(item)
		if err != nil || !prefix.IsValid() || prefix.Bits() == 0 {
			return nil, fmt.Errorf("SWARMOPS_ALLOWED_CLIENT_CIDRS contains an invalid or unrestricted network")
		}
		result = append(result, prefix.Masked())
	}
	return result, nil
}

func env(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok && strings.TrimSpace(value) != "" {
		return strings.TrimSpace(value)
	}
	return fallback
}

func envBool(key string, fallback bool) bool {
	value, ok := os.LookupEnv(key)
	if !ok || strings.TrimSpace(value) == "" {
		return fallback
	}
	parsed, err := strconv.ParseBool(value)
	if err != nil {
		return fallback
	}
	return parsed
}

func envInt64(key string, fallback int64) int64 {
	value, err := strconv.ParseInt(env(key, strconv.FormatInt(fallback, 10)), 10, 64)
	if err != nil {
		return fallback
	}
	return value
}

func envFloat(key string, fallback float64) float64 {
	value, err := strconv.ParseFloat(env(key, strconv.FormatFloat(fallback, 'f', -1, 64)), 64)
	if err != nil {
		return fallback
	}
	return value
}

func envDuration(key string, fallback time.Duration) time.Duration {
	value, err := time.ParseDuration(env(key, fallback.String()))
	if err != nil {
		return fallback
	}
	return value
}

func csv(value string) []string {
	var result []string
	for _, item := range strings.Split(value, ",") {
		if item = strings.TrimSpace(item); item != "" {
			result = append(result, item)
		}
	}
	return result
}
