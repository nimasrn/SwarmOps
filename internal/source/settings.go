package source

import (
	"context"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"strings"

	"github.com/nimasrn/SwarmOps/internal/securestore"
	"github.com/nimasrn/SwarmOps/internal/sqlstore"
)

// Settings is the part of the source boundary an operator may change from the
// console. It exists because the alternative — asking an operator to edit the
// controller's environment and restart it — is not something a person running
// SwarmOps from a browser can do, and a settings screen that can only print
// the variables it wants is a dead end rather than a control.
//
// Everything here is still a boundary: the registry password is sealed with
// the controller's data key and never returned to the console, and per-host
// build permission remains the agent's own decision.
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

// SettingsStore owns the console-owned source settings: one singleton row plus
// its private-host allow-list. Until an operator saves, the controller's own
// configuration supplies the defaults.
type SettingsStore struct {
	db       *sqlstore.DB
	defaults Settings
}

func NewSettingsStore(db *sqlstore.DB, defaults Settings) (*SettingsStore, error) {
	if db == nil {
		return nil, fmt.Errorf("source settings store requires a database")
	}
	return &SettingsStore{db: db, defaults: normalizeSettings(defaults)}, nil
}

var registryPasswordPurpose = sqlstore.Purpose("source_settings", "registry_password_sealed", "1")

type storedSettings struct {
	Settings
	RegistryPassword string `json:"registryPassword"`
}

// Settings returns the console-visible view. It never carries the password.
func (s *SettingsStore) Settings() Settings {
	if s == nil {
		return Settings{}
	}
	stored, err := s.load()
	if err != nil {
		return s.defaults
	}
	return stored.Settings
}

func (s *SettingsStore) load() (storedSettings, error) {
	ctx, cancel := context.WithTimeout(context.Background(), storeTimeout)
	defer cancel()
	return loadSettings(ctx, s.db, s.db.Pool(), s.defaults, false)
}

type querier interface {
	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
	QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error)
}

func loadSettings(ctx context.Context, db *sqlstore.DB, q querier, defaults Settings, lock bool) (storedSettings, error) {
	suffix := ""
	if lock {
		suffix = " FOR UPDATE"
	}
	var stored storedSettings
	var sealed []byte
	err := q.QueryRowContext(ctx, `SELECT enabled, build_enabled, image_prefix, registry_server, registry_username, registry_password_sealed
		FROM source_settings WHERE id = 1`+suffix).
		Scan(&stored.Enabled, &stored.BuildEnabled, &stored.ImagePrefix, &stored.RegistryServer, &stored.RegistryUsername, &sealed)
	if errors.Is(err, sql.ErrNoRows) {
		return storedSettings{Settings: defaults}, nil
	}
	if err != nil {
		return storedSettings{}, err
	}
	password, err := db.OpenString(registryPasswordPurpose, sealed)
	if err != nil {
		return storedSettings{}, err
	}
	stored.RegistryPassword = password
	rows, err := q.QueryContext(ctx, "SELECT host FROM source_private_hosts ORDER BY position")
	if err != nil {
		return storedSettings{}, err
	}
	defer rows.Close()
	stored.PrivateHosts = []string{}
	for rows.Next() {
		var host string
		if err := rows.Scan(&host); err != nil {
			return storedSettings{}, err
		}
		stored.PrivateHosts = append(stored.PrivateHosts, host)
	}
	if err := rows.Err(); err != nil {
		return storedSettings{}, err
	}
	stored.Settings = normalizeSettings(stored.Settings)
	return stored, nil
}

// RegistryAuth renders the stored credential as a Docker config document, the
// same shape the build path already expects from a host file. It returns nil
// when no credential is stored, so an unset panel credential falls back to the
// controller's own registry file rather than sending empty authentication.
func (s *SettingsStore) RegistryAuth() []byte {
	if s == nil {
		return nil
	}
	stored, err := s.load()
	if err != nil {
		return nil
	}
	server := strings.TrimSpace(stored.RegistryServer)
	username := strings.TrimSpace(stored.RegistryUsername)
	password := stored.RegistryPassword
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
		return Settings{}, fmt.Errorf("source settings are not configured")
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
	ctx, cancel := context.WithTimeout(context.Background(), storeTimeout)
	defer cancel()
	var saved Settings
	err := s.db.WithTx(ctx, func(tx *sql.Tx) error {
		current, err := loadSettings(ctx, s.db, tx, s.defaults, true)
		if err != nil {
			return err
		}
		password := current.RegistryPassword
		if strings.TrimSpace(input.RegistryPassword) != "" {
			password = input.RegistryPassword
		}
		if candidate.RegistryServer == "" || candidate.RegistryUsername == "" {
			password = ""
		}
		// A build no longer needs a registry. Without one the image is built
		// under the local prefix and never pushed, so demanding a credential
		// here would be demanding an account the operator may not have. A
		// namespace WITH no credential is still refused: that build would be
		// pushed, and would fail at the push with nothing said here.
		if candidate.BuildEnabled && candidate.ImagePrefix != "" && (candidate.RegistryServer == "" || candidate.RegistryUsername == "" || password == "") {
			return errSettingsNeedPushCredential
		}
		sealed, err := s.db.SealString(registryPasswordPurpose, password)
		if err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, `INSERT INTO source_settings
			(id, enabled, build_enabled, image_prefix, registry_server, registry_username, registry_password_sealed, updated_at)
			VALUES (1, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(6))
			ON DUPLICATE KEY UPDATE enabled = VALUES(enabled), build_enabled = VALUES(build_enabled), image_prefix = VALUES(image_prefix),
			 registry_server = VALUES(registry_server), registry_username = VALUES(registry_username),
			 registry_password_sealed = VALUES(registry_password_sealed), updated_at = VALUES(updated_at)`,
			candidate.Enabled, candidate.BuildEnabled, candidate.ImagePrefix, candidate.RegistryServer, candidate.RegistryUsername, sealed); err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, "DELETE FROM source_private_hosts"); err != nil {
			return err
		}
		for position, host := range candidate.PrivateHosts {
			if _, err := tx.ExecContext(ctx, "INSERT INTO source_private_hosts (host, position) VALUES (?, ?)", host, position); err != nil {
				return err
			}
		}
		saved = candidate
		return nil
	})
	if errors.Is(err, errSettingsNeedPushCredential) {
		return Settings{}, err
	}
	if err != nil {
		return Settings{}, fmt.Errorf("save source settings: %w", err)
	}
	return saved, nil
}

var errSettingsNeedPushCredential = errors.New("a registry namespace needs a server, username, and password to push to; leave the namespace empty to build images on the deployment host instead")

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

// registryForCodeHost names the container registry a code-hosting site
// operates, for the namespace people type when they mean it.
//
// Typing the site you push code to, when you mean the registry it runs, is the
// ordinary mistake and it used to be accepted: the prefix only had to contain a
// slash. The build was then refused three layers later by the machine agent's
// own image allow-list, with a message that named neither the prefix nor the
// setting that produced it — and had it got past that, the push would have gone
// to a web server and failed on HTML.
var registryForCodeHost = map[string]string{
	"github.com": "ghcr.io",
	"gitlab.com": "registry.gitlab.com",
}

func validateSettings(settings Settings) error {
	if settings.ImagePrefix != "" {
		if strings.ContainsAny(settings.ImagePrefix, " \t\r\n") || strings.Contains(settings.ImagePrefix, "://") {
			return fmt.Errorf("registry image prefix must be a registry host and namespace, such as ghcr.io/your-org")
		}
		if !strings.Contains(settings.ImagePrefix, "/") {
			return fmt.Errorf("registry image prefix must include a namespace, such as ghcr.io/your-org")
		}
		if err := validateImagePrefixHost(settings.ImagePrefix); err != nil {
			return err
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

// validateImagePrefixHost checks the first component of an image prefix, which
// is a registry host only when it carries a dot, a port, or is localhost —
// Docker reads anything else as a Docker Hub namespace, and that is a valid
// thing to want.
func validateImagePrefixHost(prefix string) error {
	host, _, _ := strings.Cut(prefix, "/")
	lowered := strings.ToLower(strings.TrimPrefix(host, "www."))
	if registry, found := registryForCodeHost[lowered]; found {
		return fmt.Errorf("%s hosts code, not container images; its registry is %s, so the namespace is %s/your-org. Leave the prefix empty to build on the deployment host and push nothing", lowered, registry, registry)
	}
	if !strings.Contains(host, ".") && !strings.Contains(host, ":") {
		// A bare first component is a Docker Hub namespace, which is a
		// legitimate destination and needs no further checking.
		return nil
	}
	// A registry reached by name and port on an internal network carries no
	// dot — registry:5000 is an ordinary thing to run — so the port form is
	// checked on its host part alone.
	if name, port, found := strings.Cut(host, ":"); found {
		if port == "" || strings.ContainsAny(port, "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ/") {
			return fmt.Errorf("registry image prefix must start with a registry host such as ghcr.io, or a Docker Hub namespace")
		}
		if !strings.Contains(name, ".") {
			return nil
		}
		host = name
	}
	if !validHostname(host) {
		return fmt.Errorf("registry image prefix must start with a registry host such as ghcr.io, or a Docker Hub namespace")
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

const settingsStateKey = "source-settings"

type settingsFile struct {
	Settings storedSettings `json:"settings"`
	Version  int            `json:"version"`
}

// ImportSettingsFiles copies a pre-database source-settings.sealed file into
// the singleton row and reports whether one existed. The file is kept.
func ImportSettingsFiles(ctx context.Context, db *sqlstore.DB, dataDir string, dataEncryptionKey []byte) (int, error) {
	sealer, err := securestore.New(dataEncryptionKey)
	if err != nil {
		return 0, err
	}
	data, err := sealer.ReadFile(filepath.Join(dataDir, "source-settings.sealed"), settingsStateKey)
	if errors.Is(err, os.ErrNotExist) {
		return 0, nil
	}
	if err != nil {
		return 0, fmt.Errorf("read sealed source settings: %w", err)
	}
	var saved settingsFile
	if err := json.Unmarshal(data, &saved); err != nil {
		return 0, fmt.Errorf("read sealed source settings: %w", err)
	}
	if saved.Version != 1 {
		return 0, fmt.Errorf("unsupported sealed source settings version")
	}
	settings := normalizeSettings(saved.Settings.Settings)
	sealed, err := db.SealString(registryPasswordPurpose, saved.Settings.RegistryPassword)
	if err != nil {
		return 0, err
	}
	err = db.WithTx(ctx, func(tx *sql.Tx) error {
		if _, err := tx.ExecContext(ctx, `INSERT INTO source_settings
			(id, enabled, build_enabled, image_prefix, registry_server, registry_username, registry_password_sealed, updated_at)
			VALUES (1, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(6))
			ON DUPLICATE KEY UPDATE enabled = VALUES(enabled), build_enabled = VALUES(build_enabled), image_prefix = VALUES(image_prefix),
			 registry_server = VALUES(registry_server), registry_username = VALUES(registry_username),
			 registry_password_sealed = VALUES(registry_password_sealed), updated_at = VALUES(updated_at)`,
			settings.Enabled, settings.BuildEnabled, settings.ImagePrefix, settings.RegistryServer, settings.RegistryUsername, sealed); err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, "DELETE FROM source_private_hosts"); err != nil {
			return err
		}
		for position, host := range settings.PrivateHosts {
			if _, err := tx.ExecContext(ctx, "INSERT INTO source_private_hosts (host, position) VALUES (?, ?)", host, position); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return 0, fmt.Errorf("import source settings: %w", err)
	}
	return 1, nil
}
