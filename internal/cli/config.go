package cli

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

// ConfigFileMode is enforced on every write and checked on every read. The
// file holds a live session cookie; a group-readable one is a credential leak
// on a shared workstation.
const ConfigFileMode os.FileMode = 0o600

// Profile is one Core an operator works against.
type Profile struct {
	ClusterID       string  `json:"clusterId,omitempty"`
	CoreFingerprint string  `json:"coreFingerprint,omitempty"`
	ServerID        string  `json:"serverId,omitempty"`
	Session         Session `json:"session,omitempty"`
	URL             string  `json:"url"`
	Username        string  `json:"username,omitempty"`
}

// Config is the whole profile file.
type Config struct {
	Current  string             `json:"current,omitempty"`
	Profiles map[string]Profile `json:"profiles,omitempty"`

	path string
}

// ConfigPath is where the profile file lives. SWARMOPS_CONFIG relocates it,
// which is what lets a test run without touching the operator's real file.
func ConfigPath() (string, error) {
	if override := strings.TrimSpace(os.Getenv("SWARMOPS_CONFIG")); override != "" {
		return override, nil
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("locate home directory: %w", err)
	}
	return filepath.Join(home, ".swarmops", "config.json"), nil
}

// LoadConfig reads the profile file. A missing file is an empty config, not an
// error: the first command an operator runs is `login`, and it should not have
// to be preceded by an `init`.
func LoadConfig() (*Config, error) {
	path, err := ConfigPath()
	if err != nil {
		return nil, err
	}
	config := &Config{Profiles: map[string]Profile{}, path: path}
	content, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return config, nil
	}
	if err != nil {
		return nil, fmt.Errorf("read %s: %w", path, err)
	}
	if info, statErr := os.Stat(path); statErr == nil && info.Mode().Perm()&0o077 != 0 {
		return nil, fmt.Errorf("%s is readable by other users; run chmod 600 %s", path, path)
	}
	if err := json.Unmarshal(content, config); err != nil {
		return nil, fmt.Errorf("parse %s: %w", path, err)
	}
	if config.Profiles == nil {
		config.Profiles = map[string]Profile{}
	}
	config.path = path
	return config, nil
}

// Save writes the profile file, creating its directory at 0700.
func (c *Config) Save() error {
	if c.path == "" {
		path, err := ConfigPath()
		if err != nil {
			return err
		}
		c.path = path
	}
	if err := os.MkdirAll(filepath.Dir(c.path), 0o700); err != nil {
		return fmt.Errorf("create %s: %w", filepath.Dir(c.path), err)
	}
	content, err := json.MarshalIndent(c, "", "  ")
	if err != nil {
		return err
	}
	content = append(content, '\n')
	// Write through a temporary file so an interrupted save cannot leave a
	// truncated config that loses every profile.
	temporary := c.path + ".tmp"
	if err := os.WriteFile(temporary, content, ConfigFileMode); err != nil {
		return fmt.Errorf("write %s: %w", temporary, err)
	}
	if err := os.Rename(temporary, c.path); err != nil {
		return fmt.Errorf("replace %s: %w", c.path, err)
	}
	return os.Chmod(c.path, ConfigFileMode)
}

// Path reports the file this config was read from.
func (c *Config) Path() string { return c.path }

// Names lists the configured profiles in a stable order.
func (c *Config) Names() []string {
	names := make([]string, 0, len(c.Profiles))
	for name := range c.Profiles {
		names = append(names, name)
	}
	sort.Strings(names)
	return names
}

// ProfileName resolves which profile a command should use: an explicit name
// wins, then SWARMOPS_PROFILE, then the one `profile use` selected, then the
// only one configured.
func (c *Config) ProfileName(explicit string) string {
	if name := strings.TrimSpace(explicit); name != "" {
		return name
	}
	if name := strings.TrimSpace(os.Getenv("SWARMOPS_PROFILE")); name != "" {
		return name
	}
	if c.Current != "" {
		return c.Current
	}
	if len(c.Profiles) == 1 {
		return c.Names()[0]
	}
	return ""
}

// Resolve returns the profile a command should run against, with environment
// overrides applied. It never invents a URL: a command that cannot name a Core
// must say so rather than quietly reaching for localhost.
func (c *Config) Resolve(explicit string) (string, Profile, error) {
	name := c.ProfileName(explicit)
	profile := c.Profiles[name]
	if override := strings.TrimSpace(os.Getenv("SWARMOPS_URL")); override != "" {
		profile.URL = override
	}
	if override := strings.TrimSpace(os.Getenv("SWARMOPS_SERVER_ID")); override != "" {
		profile.ServerID = override
	}
	if override := strings.TrimSpace(os.Getenv("SWARMOPS_CORE_FINGERPRINT")); override != "" {
		profile.CoreFingerprint = override
	}
	if profile.URL == "" {
		if len(c.Profiles) == 0 {
			return "", Profile{}, errors.New("no SwarmOps profile is configured; run `swarmops login --url <core-url> --username <name>`")
		}
		if name == "" {
			return "", Profile{}, fmt.Errorf("several profiles are configured (%s); choose one with --profile or `swarmops profile use <name>`", strings.Join(c.Names(), ", "))
		}
		return "", Profile{}, fmt.Errorf("profile %q is not configured; run `swarmops profile list`", name)
	}
	if name == "" {
		name = "default"
	}
	return name, profile, nil
}

// Put stores a profile and makes it current when nothing else is.
func (c *Config) Put(name string, profile Profile) {
	if c.Profiles == nil {
		c.Profiles = map[string]Profile{}
	}
	c.Profiles[name] = profile
	if c.Current == "" {
		c.Current = name
	}
}
