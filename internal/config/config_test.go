package config

import (
	"bytes"
	"encoding/base64"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"golang.org/x/crypto/bcrypt"
)

func TestLoadInsecureDevAuthRequiresExplicitSessionMaterial(t *testing.T) {
	t.Setenv("SWARMOPS_INSECURE_DEV_AUTH", "true")
	t.Setenv("SWARMOPS_DATA_DIR", t.TempDir())

	for _, tc := range []struct {
		name    string
		session string
		want    string
	}{
		{name: "session key", want: "SWARMOPS_DEV_SESSION_KEY"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Setenv("SWARMOPS_DEV_SESSION_KEY", tc.session)

			if _, err := Load(); err == nil || !strings.Contains(err.Error(), tc.want) {
				t.Fatalf("Load() error = %v, want error containing %q", err, tc.want)
			}
		})
	}
}

func TestLoadInsecureDevAuthUsesLocalAdminDefaults(t *testing.T) {
	t.Setenv("SWARMOPS_INSECURE_DEV_AUTH", "true")
	t.Setenv("SWARMOPS_DATA_DIR", t.TempDir())
	t.Setenv("SWARMOPS_ADMIN_USERNAME", "")
	t.Setenv("SWARMOPS_DEV_PASSWORD_HASH", "")
	t.Setenv("SWARMOPS_DEV_SESSION_KEY", strings.Repeat("s", 32))

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	if cfg.AdminUsername != localDevAdminUsername {
		t.Fatalf("AdminUsername = %q, want %q", cfg.AdminUsername, localDevAdminUsername)
	}
	if err := bcrypt.CompareHashAndPassword(cfg.AdminPasswordHash, []byte("admin")); err != nil {
		t.Fatalf("local development password does not authenticate: %v", err)
	}
}

func TestLoadInsecureDevAuthAcceptsExplicitMaterial(t *testing.T) {
	t.Setenv("SWARMOPS_INSECURE_DEV_AUTH", "true")
	t.Setenv("SWARMOPS_DATA_DIR", t.TempDir())
	t.Setenv("SWARMOPS_ADMIN_USERNAME", "local-operator")
	t.Setenv("SWARMOPS_DEV_PASSWORD_HASH", "development-only-hash")
	t.Setenv("SWARMOPS_DEV_SESSION_KEY", strings.Repeat("s", 32))

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	if got := cfg.AdminUsername; got != "local-operator" {
		t.Fatalf("AdminUsername = %q, want explicit local username", got)
	}
}

func TestLoadResolvesTrustedAssetsFromConfiguredDirectory(t *testing.T) {
	t.Setenv("SWARMOPS_INSECURE_DEV_AUTH", "true")
	t.Setenv("SWARMOPS_DATA_DIR", t.TempDir())
	t.Setenv("SWARMOPS_DEV_SESSION_KEY", strings.Repeat("s", 32))
	t.Setenv("SWARMOPS_ASSET_DIR", "/srv/swarmops/assets")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	for _, test := range []struct {
		name string
		got  string
		want string
	}{
		{name: "agent", got: cfg.AgentStackFile, want: "/srv/swarmops/assets/agent.yml"},
		{name: "logs", got: cfg.LogsStackFile, want: "/srv/swarmops/assets/logs.yml"},
		{name: "observability", got: cfg.ObservabilityStackFile, want: "/srv/swarmops/assets/observability.yml"},
		{name: "traefik", got: cfg.TraefikStackFile, want: "/srv/swarmops/assets/traefik.yml"},
	} {
		if test.got != test.want {
			t.Errorf("%s stack file = %q, want %q", test.name, test.got, test.want)
		}
	}
}

func TestLoadProductionRequiresDedicatedDataEncryptionKey(t *testing.T) {
	t.Setenv("SWARMOPS_INSECURE_DEV_AUTH", "false")
	t.Setenv("SWARMOPS_DATA_DIR", t.TempDir())
	t.Setenv("SWARMOPS_ADMIN_PASSWORD_HASH_FILE", writeSecretFile(t, "admin-password-hash", []byte("bcrypt-hash")))
	t.Setenv("SWARMOPS_SESSION_KEY_FILE", writeSecretFile(t, "session-key", []byte(strings.Repeat("s", 32))))
	t.Setenv("SWARMOPS_DATA_ENCRYPTION_KEY_FILE", "")

	if _, err := Load(); err == nil || !strings.Contains(err.Error(), "data encryption key") {
		t.Fatalf("Load() error = %v, want data-encryption-key failure", err)
	}
}

func TestLoadProductionRejectsGroupReadableDataEncryptionKey(t *testing.T) {
	t.Setenv("SWARMOPS_INSECURE_DEV_AUTH", "false")
	t.Setenv("SWARMOPS_DATA_DIR", t.TempDir())
	t.Setenv("SWARMOPS_ADMIN_PASSWORD_HASH_FILE", writeSecretFile(t, "admin-password-hash", []byte("bcrypt-hash")))
	t.Setenv("SWARMOPS_SESSION_KEY_FILE", writeSecretFile(t, "session-key", []byte(strings.Repeat("s", 32))))
	dataKey := writeSecretFile(t, "data-key", []byte(base64.StdEncoding.EncodeToString(bytes.Repeat([]byte{3}, 32))))
	if err := os.Chmod(dataKey, 0o640); err != nil {
		t.Fatal(err)
	}
	t.Setenv("SWARMOPS_DATA_ENCRYPTION_KEY_FILE", dataKey)

	if _, err := Load(); err == nil || !strings.Contains(err.Error(), "readable only by its owner") {
		t.Fatalf("Load() error = %v, want protected data-key failure", err)
	}
}

func TestLoadDirectTLSRequiresAllowedClientNetwork(t *testing.T) {
	t.Setenv("SWARMOPS_INSECURE_DEV_AUTH", "false")
	t.Setenv("SWARMOPS_DATA_DIR", t.TempDir())
	t.Setenv("SWARMOPS_ADMIN_PASSWORD_HASH_FILE", writeSecretFile(t, "admin-password-hash", []byte("bcrypt-hash")))
	t.Setenv("SWARMOPS_SESSION_KEY_FILE", writeSecretFile(t, "session-key", []byte(strings.Repeat("s", 32))))
	t.Setenv("SWARMOPS_DATA_ENCRYPTION_KEY_FILE", writeSecretFile(t, "data-key", []byte(base64.StdEncoding.EncodeToString(bytes.Repeat([]byte{1}, 32)))))
	t.Setenv("SWARMOPS_TLS_CERT_FILE", writeSecretFile(t, "certificate", []byte("certificate")))
	t.Setenv("SWARMOPS_TLS_KEY_FILE", writeSecretFile(t, "private-key", []byte("private-key")))
	t.Setenv("SWARMOPS_LISTEN_ADDR", "192.0.2.20:42420")
	t.Setenv("SWARMOPS_ALLOWED_CLIENT_CIDRS", "")

	if _, err := Load(); err == nil || !strings.Contains(err.Error(), "SWARMOPS_ALLOWED_CLIENT_CIDRS") {
		t.Fatalf("Load() error = %v, want direct-TLS allowlist failure", err)
	}
}

func TestLoadDirectTLSParsesClientNetwork(t *testing.T) {
	t.Setenv("SWARMOPS_INSECURE_DEV_AUTH", "false")
	t.Setenv("SWARMOPS_DATA_DIR", t.TempDir())
	t.Setenv("SWARMOPS_ADMIN_PASSWORD_HASH_FILE", writeSecretFile(t, "admin-password-hash", []byte("bcrypt-hash")))
	t.Setenv("SWARMOPS_SESSION_KEY_FILE", writeSecretFile(t, "session-key", []byte(strings.Repeat("s", 32))))
	t.Setenv("SWARMOPS_DATA_ENCRYPTION_KEY_FILE", writeSecretFile(t, "data-key", []byte(base64.StdEncoding.EncodeToString(bytes.Repeat([]byte{2}, 32)))))
	t.Setenv("SWARMOPS_TLS_CERT_FILE", writeSecretFile(t, "certificate", []byte("certificate")))
	t.Setenv("SWARMOPS_TLS_KEY_FILE", writeSecretFile(t, "private-key", []byte("private-key")))
	t.Setenv("SWARMOPS_LISTEN_ADDR", "192.0.2.20:42420")
	t.Setenv("SWARMOPS_ALLOWED_CLIENT_CIDRS", "198.51.100.3/32,2001:db8::/64")

	cfg, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if got, want := len(cfg.AllowedClientCIDRs), 2; got != want {
		t.Fatalf("allowed client CIDRs = %#v, want %d prefixes", cfg.AllowedClientCIDRs, want)
	}
	if got, want := cfg.AllowedClientCIDRs[0].String(), "198.51.100.3/32"; got != want {
		t.Fatalf("first client CIDR = %q, want %q", got, want)
	}
}

func writeSecretFile(t *testing.T, name string, content []byte) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), name)
	if err := os.WriteFile(path, content, 0o600); err != nil {
		t.Fatal(err)
	}
	return path
}
