// Package config owns process configuration and keeps secret material out of
// callers. Values are read once at process startup and never logged.
package config

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	AdminPasswordHash   []byte
	AdminUsername       string
	AgentService        string
	AgentToken          []byte
	BuildEnabled        bool
	BuildMaxBytes       int64
	BuildMaxCPUs        float64
	BuildMaxMemoryMiB   int64
	DataDir             string
	DockerSocket        string
	ImagePrefixes       []string
	InsecureDevAuth     bool
	ListenAddr          string
	MutationEnabled     bool
	RegistryAuth        []byte
	SecureCookies       bool
	SessionKey          []byte
	SessionTTL          time.Duration
	TraefikDashboardURL string
}

func Load() (Config, error) {
	c := Config{
		AdminUsername:       env("SWARMOPS_ADMIN_USERNAME", "operator"),
		AgentService:        env("SWARMOPS_AGENT_SERVICE", "swarmops_agent"),
		BuildEnabled:        envBool("SWARMOPS_BUILD_ENABLED", false),
		BuildMaxBytes:       envInt64("SWARMOPS_BUILD_MAX_BYTES", 512<<20),
		BuildMaxCPUs:        envFloat("SWARMOPS_BUILD_MAX_CPUS", 2),
		BuildMaxMemoryMiB:   envInt64("SWARMOPS_BUILD_MAX_MEMORY_MIB", 2048),
		DataDir:             env("SWARMOPS_DATA_DIR", "/var/lib/swarmops"),
		DockerSocket:        env("SWARMOPS_DOCKER_SOCKET", "/var/run/docker.sock"),
		ImagePrefixes:       csv(env("SWARMOPS_IMAGE_PREFIXES", "")),
		InsecureDevAuth:     envBool("SWARMOPS_INSECURE_DEV_AUTH", false),
		ListenAddr:          env("SWARMOPS_LISTEN_ADDR", ":8084"),
		MutationEnabled:     envBool("SWARMOPS_MUTATIONS_ENABLED", false),
		SecureCookies:       envBool("SWARMOPS_SECURE_COOKIES", true),
		SessionTTL:          envDuration("SWARMOPS_SESSION_TTL", 12*time.Hour),
		TraefikDashboardURL: env("SWARMOPS_TRAEFIK_DASHBOARD_URL", ""),
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
		c.AdminPasswordHash = []byte(env("SWARMOPS_DEV_PASSWORD_HASH", ""))
		if len(c.AdminPasswordHash) == 0 {
			return Config{}, fmt.Errorf("SWARMOPS_DEV_PASSWORD_HASH is required when SWARMOPS_INSECURE_DEV_AUTH is enabled")
		}
		c.SessionKey = []byte(env("SWARMOPS_DEV_SESSION_KEY", ""))
		if len(c.SessionKey) < 32 {
			return Config{}, fmt.Errorf("SWARMOPS_DEV_SESSION_KEY must contain at least 32 bytes when SWARMOPS_INSECURE_DEV_AUTH is enabled")
		}
		c.AgentToken = []byte(env("SWARMOPS_DEV_AGENT_TOKEN", ""))
		if len(c.AgentToken) < 32 {
			return Config{}, fmt.Errorf("SWARMOPS_DEV_AGENT_TOKEN must contain at least 32 bytes when SWARMOPS_INSECURE_DEV_AUTH is enabled")
		}
		return c, nil
	}

	var err error
	if c.AdminPasswordHash, err = readSecret(env("SWARMOPS_ADMIN_PASSWORD_HASH_FILE", "")); err != nil {
		return Config{}, fmt.Errorf("admin password hash: %w", err)
	}
	if c.SessionKey, err = readSecret(env("SWARMOPS_SESSION_KEY_FILE", "")); err != nil {
		return Config{}, fmt.Errorf("session key: %w", err)
	}
	if c.AgentToken, err = readSecret(env("SWARMOPS_AGENT_TOKEN_FILE", "")); err != nil {
		return Config{}, fmt.Errorf("agent token: %w", err)
	}
	if registryFile := strings.TrimSpace(env("SWARMOPS_REGISTRY_CONFIG_FILE", "")); registryFile != "" {
		if c.RegistryAuth, err = readSecret(registryFile); err != nil {
			return Config{}, fmt.Errorf("registry config: %w", err)
		}
		var registryConfig map[string]any
		if err := json.Unmarshal(c.RegistryAuth, &registryConfig); err != nil || registryConfig == nil {
			return Config{}, fmt.Errorf("registry config must be a JSON object")
		}
	}
	if len(c.SessionKey) < 32 {
		return Config{}, fmt.Errorf("session key must contain at least 32 bytes")
	}
	return c, nil
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
	b = []byte(strings.TrimSpace(string(b)))
	if len(b) == 0 {
		return nil, fmt.Errorf("secret file is empty")
	}
	return b, nil
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
