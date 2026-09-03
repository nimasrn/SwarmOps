package source

import (
	"encoding/base64"
	"encoding/json"
	"strings"
	"testing"
)

func newTestSettings(t *testing.T, defaults Settings) *SettingsStore {
	t.Helper()
	store, err := NewSettingsStore(t.TempDir(), make([]byte, 32), defaults)
	if err != nil {
		t.Fatalf("new settings store: %v", err)
	}
	return store
}

func TestSettingsSaveSealsRegistryCredentialWithoutReturningIt(t *testing.T) {
	store := newTestSettings(t, Settings{})
	saved, err := store.Save(SettingsInput{
		BuildEnabled:     true,
		Enabled:          true,
		ImagePrefix:      "ghcr.io/acme/",
		RegistryPassword: "secret-token",
		RegistryServer:   "ghcr.io",
		RegistryUsername: "robot",
	})
	if err != nil {
		t.Fatalf("save: %v", err)
	}
	if saved.ImagePrefix != "ghcr.io/acme" {
		t.Fatalf("image prefix was not normalized: %q", saved.ImagePrefix)
	}
	encoded, err := json.Marshal(saved)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	if strings.Contains(string(encoded), "secret-token") {
		t.Fatalf("console view carried the registry password: %s", encoded)
	}
	auth := store.RegistryAuth()
	var document struct {
		Auths map[string]struct {
			Auth string `json:"auth"`
		} `json:"auths"`
	}
	if err := json.Unmarshal(auth, &document); err != nil {
		t.Fatalf("registry auth is not a Docker config: %v", err)
	}
	decoded, err := base64.StdEncoding.DecodeString(document.Auths["ghcr.io"].Auth)
	if err != nil || string(decoded) != "robot:secret-token" {
		t.Fatalf("registry auth did not carry the credential: %q %v", decoded, err)
	}
}

func TestSettingsKeepSealedPasswordWhenBlank(t *testing.T) {
	store := newTestSettings(t, Settings{})
	if _, err := store.Save(SettingsInput{Enabled: true, ImagePrefix: "ghcr.io/acme", RegistryPassword: "first", RegistryServer: "ghcr.io", RegistryUsername: "robot"}); err != nil {
		t.Fatalf("save: %v", err)
	}
	if _, err := store.Save(SettingsInput{Enabled: true, ImagePrefix: "ghcr.io/other", RegistryServer: "ghcr.io", RegistryUsername: "robot"}); err != nil {
		t.Fatalf("resave: %v", err)
	}
	if !store.RegistryConfigured() {
		t.Fatal("re-saving unrelated fields dropped the sealed credential")
	}
}

func TestSettingsRejectNamespaceWithoutPushCredential(t *testing.T) {
	store := newTestSettings(t, Settings{})
	if _, err := store.Save(SettingsInput{BuildEnabled: true, Enabled: true, ImagePrefix: "ghcr.io/acme"}); err == nil {
		t.Fatal("a push namespace was accepted with no registry credential")
	}
}

// An operator with one machine and no registry account is the ordinary case.
// Builds are allowed with no registry at all: the image is then built on the
// deployment host, never pushed, and the application is pinned to that host.
func TestSettingsAllowBuildsWithoutRegistry(t *testing.T) {
	store := newTestSettings(t, Settings{})
	settings, err := store.Save(SettingsInput{BuildEnabled: true, Enabled: true})
	if err != nil {
		t.Fatalf("builds were refused without a registry: %v", err)
	}
	if !settings.BuildEnabled || settings.ImagePrefix != "" {
		t.Fatalf("unexpected settings: %+v", settings)
	}
	if store.RegistryConfigured() {
		t.Fatal("a credential was invented for a registry-less build")
	}
}

func TestSettingsRejectMalformedHostsAndPrefixes(t *testing.T) {
	store := newTestSettings(t, Settings{})
	if _, err := store.Save(SettingsInput{Enabled: true, ImagePrefix: "https://ghcr.io/acme"}); err == nil {
		t.Fatal("a URL was accepted as an image prefix")
	}
	if _, err := store.Save(SettingsInput{Enabled: true, PrivateHosts: []string{"https://git.example.com/x"}}); err == nil {
		t.Fatal("a URL was accepted as a private provider host")
	}
}

func TestSettingsSurviveReload(t *testing.T) {
	dir := t.TempDir()
	key := make([]byte, 32)
	store, err := NewSettingsStore(dir, key, Settings{})
	if err != nil {
		t.Fatalf("new: %v", err)
	}
	if _, err := store.Save(SettingsInput{Enabled: true, ImagePrefix: "ghcr.io/acme", PrivateHosts: []string{"git.example.com"}, RegistryPassword: "p", RegistryServer: "ghcr.io", RegistryUsername: "robot"}); err != nil {
		t.Fatalf("save: %v", err)
	}
	reloaded, err := NewSettingsStore(dir, key, Settings{})
	if err != nil {
		t.Fatalf("reload: %v", err)
	}
	settings := reloaded.Settings()
	if !settings.Enabled || settings.ImagePrefix != "ghcr.io/acme" || len(settings.PrivateHosts) != 1 || !reloaded.RegistryConfigured() {
		t.Fatalf("sealed settings did not survive a restart: %+v", settings)
	}
}

func TestSettingsDisableTurnsOffBuilds(t *testing.T) {
	store := newTestSettings(t, Settings{})
	saved, err := store.Save(SettingsInput{BuildEnabled: true, Enabled: false})
	if err != nil {
		t.Fatalf("save: %v", err)
	}
	if saved.BuildEnabled {
		t.Fatal("builds stayed enabled while the boundary was off")
	}
}
