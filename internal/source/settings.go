package source

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"github.com/nimasrn/SwarmOps/internal/securestore"
)

const (
	settingsStateKey = "source-settings"
	settingsVersion  = 1
)

// Settings is the part of the source boundary an operator may change from the
// console. It exists because the alternative — asking an operator to edit the
// controller's environment and restart it — is not something a person running
// SwarmOps from a browser can do, and a settings screen that can only print
// the variables it wants is a dead end rather than a control.
//
// Everything here is still a boundary: it is sealed at rest with the same key
// as provider tokens, the registry password is never returned to the console,
// and per-host build permission remains the agent's own decision.
type Settings struct {
	// BuildEnabled allows the controller to submit bounded source builds.
	BuildEnabled bool `json:"buildEnabled"`
	// Enabled turns the whole provider boundary on.
	Enabled bool `json:"enabled"`
	// ImagePrefix is the one registry namespace generated images may use.
	ImagePrefix string `json:"imagePrefix"`
	// PrivateHosts allow-lists self-managed provider hostnames.
	PrivateHosts []string `json:"privateHosts"`
	// RegistryServer/RegistryUsername identify the push credential. The
	// password is held separately and never leaves the controller.
	RegistryServer   string `json:"registryServer"`
	RegistryUsername string `json:"registryUsername"`
}

type storedSettings struct {
	Settings
	RegistryPassword string `json:"registryPassword"`
}

type settingsFile struct {
	Settings storedSettings `json:"settings"`
	Version  int            `json:"version"`
}

// SettingsInput is what the console may send. An empty RegistryPassword means
// "keep the sealed one", so re-saving unrelated fields never silently drops a
// working credential.
type SettingsInput struct {
	BuildEnabled     bool     `json:"buildEnabled"`
	Enabled          bool     `json:"enabled"`
	ImagePrefix      string   `json:"imagePrefix"`
	PrivateHosts     []string `json:"privateHosts"`
	RegistryPassword string   `json:"registryPassword"`
	RegistryServer   string   `json:"registryServer"`
	RegistryUsername string   `json:"registryUsername"`
}

// SettingsStore owns the sealed console-owned source settings.
type SettingsStore struct {
	mu       sync.RWMutex
	path     string
	sealer   *securestore.Sealer
	settings storedSettings
}

func NewSettingsStore(dataDir string, dataEncryptionKey []byte, defaults Settings) (*SettingsStore, error) {
	if strings.TrimSpace(dataDir) == "" {
		return nil, fmt.Errorf("source settings data directory is required")
	}
	sealer, err := securestore.New(dataEncryptionKey)
	if err != nil {
		return nil, fmt.Errorf("configure sealed source settings: %w", err)
	}
	store := &SettingsStore{
		path:     filepath.Join(dataDir, "source-settings.sealed"),
		sealer:   sealer,
		settings: storedSettings{Settings: normalizeSettings(defaults)},
	}
	data, err := sealer.ReadFile(store.path, settingsStateKey)
	if errors.Is(err, os.ErrNotExist) {
		return store, nil
	}
	if err != nil {
		return nil, fmt.Errorf("read sealed source settings: %w", err)
	}
	var saved settingsFile
	if err := json.Unmarshal(data, &saved); err != nil {
		return nil, fmt.Errorf("read sealed source settings: %w", err)
	}
	if saved.Version != settingsVersion {
		return nil, fmt.Errorf("unsupported sealed source settings version")
	}
	saved.Settings.Settings = normalizeSettings(saved.Settings.Settings)
	store.settings = saved.Settings
	return store, nil
}

// Settings returns the console-visible view. It never carries the password.
func (s *SettingsStore) Settings() Settings {
	if s == nil {
		return Settings{}
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.settings.Settings
}

// RegistryAuth renders the stored credential as a Docker config document, the
// same shape the build path already expects from a host file. It returns nil
// when no credential is stored, so an unset panel credential falls back to the
// controller's own registry file rather than sending empty authentication.
func (s *SettingsStore) RegistryAuth() []byte {
	if s == nil {
		return nil
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	server := strings.TrimSpace(s.settings.RegistryServer)
	username := strings.TrimSpace(s.settings.RegistryUsername)
	password := s.settings.RegistryPassword
	if server == "" || username == "" || password == "" {
		return nil
	}
	document := map[string]any{"auths": map[string]any{server: map[string]any{
		"auth": base64.StdEncoding.EncodeToString([]byte(username + ":" + password)),
	}}}
	encoded, err := json.Marshal(document)
	if err != nil {
		return nil
	}
	return encoded
}

// RegistryConfigured reports whether a complete push credential is sealed.
func (s *SettingsStore) RegistryConfigured() bool { return len(s.RegistryAuth()) > 0 }

func (s *SettingsStore) Save(input SettingsInput) (Settings, error) {
	if s == nil {
		return Settings{}, fmt.Errorf("sealed source settings are not configured")
	}
	candidate := normalizeSettings(Settings{
		BuildEnabled:     input.BuildEnabled,
		Enabled:          input.Enabled,
		ImagePrefix:      input.ImagePrefix,
		PrivateHosts:     input.PrivateHosts,
		RegistryServer:   input.RegistryServer,
		RegistryUsername: input.RegistryUsername,
	})
	if err := validateSettings(candidate); err != nil {
		return Settings{}, err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	password := s.settings.RegistryPassword
	if strings.TrimSpace(input.RegistryPassword) != "" {
		password = input.RegistryPassword
	}
	if candidate.RegistryServer == "" || candidate.RegistryUsername == "" {
		password = ""
	}
	// A build no longer needs a registry. Without one the image is built under
	// the local prefix and never pushed, so demanding a credential here would
	// be demanding an account the operator may not have. A namespace WITH no
	// credential is still refused: that build would be pushed, and would fail
	// at the push with nothing said here.
	if candidate.BuildEnabled && candidate.ImagePrefix != "" && (candidate.RegistryServer == "" || candidate.RegistryUsername == "" || password == "") {
		return Settings{}, fmt.Errorf("a registry namespace needs a server, username, and password to push to; leave the namespace empty to build images on the deployment host instead")
	}
	previous := s.settings
	s.settings = storedSettings{Settings: candidate, RegistryPassword: password}
	if err := s.saveLocked(); err != nil {
		s.settings = previous
		return Settings{}, err
	}
	return s.settings.Settings, nil
}

func (s *SettingsStore) saveLocked() error {
	data, err := json.Marshal(settingsFile{Settings: s.settings, Version: settingsVersion})
	if err != nil {
		return fmt.Errorf("seal source settings: %w", err)
	}
	if err := s.sealer.WriteFile(s.path, settingsStateKey, data); err != nil {
		return fmt.Errorf("seal source settings: %w", err)
	}
	return nil
}

func normalizeSettings(settings Settings) Settings {
	settings.ImagePrefix = strings.TrimSuffix(strings.TrimSpace(settings.ImagePrefix), "/")
	settings.RegistryServer = strings.TrimSpace(settings.RegistryServer)
	settings.RegistryUsername = strings.TrimSpace(settings.RegistryUsername)
	hosts := make([]string, 0, len(settings.PrivateHosts))
	seen := map[string]bool{}
	for _, host := range settings.PrivateHosts {
		host = strings.ToLower(strings.TrimSpace(host))
		if host == "" || seen[host] {
			continue
		}
		seen[host] = true
		hosts = append(hosts, host)
	}
	settings.PrivateHosts = hosts
	if !settings.Enabled {
		settings.BuildEnabled = false
	}
	return settings
}

func validateSettings(settings Settings) error {
	if settings.ImagePrefix != "" {
		if strings.ContainsAny(settings.ImagePrefix, " \t\r\n") || strings.Contains(settings.ImagePrefix, "://") {
			return fmt.Errorf("registry image prefix must be a registry host and namespace, such as ghcr.io/your-org")
		}
		if !strings.Contains(settings.ImagePrefix, "/") {
			return fmt.Errorf("registry image prefix must include a namespace, such as ghcr.io/your-org")
		}
	}
	for _, host := range settings.PrivateHosts {
		if !validHostname(host) {
			return fmt.Errorf("private provider host %q is not a bare hostname", host)
		}
	}
	if settings.RegistryServer != "" && !validHostname(strings.TrimSuffix(settings.RegistryServer, "/")) {
		return fmt.Errorf("registry server must be a bare host such as ghcr.io")
	}
	if (settings.RegistryServer == "") != (settings.RegistryUsername == "") {
		return fmt.Errorf("a registry credential needs both a server and a username")
	}
	return nil
}

func validHostname(host string) bool {
	host = strings.TrimSpace(host)
	if host == "" || strings.Contains(host, "/") || strings.Contains(host, " ") {
		return false
	}
	if strings.Contains(host, "://") {
		return false
	}
	parsed, err := url.Parse("https://" + host)
	return err == nil && parsed.Host == host && strings.Contains(host, ".")
}
