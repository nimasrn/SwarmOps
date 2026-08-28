package config

import (
	"bytes"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/base64"
	"encoding/hex"
	"encoding/pem"
	"math/big"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

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

func TestLoadInsecureDevAuthConfiguresLoopbackMachineAPI(t *testing.T) {
	t.Setenv("SWARMOPS_INSECURE_DEV_AUTH", "true")
	t.Setenv("SWARMOPS_DATA_DIR", t.TempDir())
	t.Setenv("SWARMOPS_DEV_SESSION_KEY", strings.Repeat("s", 32))
	t.Setenv("SWARMOPS_DEV_MACHINE_API_KEY_FILE", writeSecretFile(t, "local-machine-api-key", []byte("local-development-machine-key")))
	certificateFile, fingerprint := writeDevMachineCertificate(t)
	t.Setenv("SWARMOPS_DEV_MACHINE_API_CERT_FILE", certificateFile)
	t.Setenv("SWARMOPS_DEV_MACHINE_API_URL", "https://127.0.0.1")
	t.Setenv("SWARMOPS_DEV_MACHINE_API_PORT", "9180")
	t.Setenv("SWARMOPS_DEV_MACHINE_API_NAME", "Local Docker")

	cfg, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if cfg.DevMachineAPI == nil {
		t.Fatal("DevMachineAPI = nil")
	}
	if got, want := cfg.DevMachineAPI.APIURL, "https://127.0.0.1"; got != want {
		t.Fatalf("DevMachineAPI.APIURL = %q, want %q", got, want)
	}
	if got, want := cfg.DevMachineAPI.Port, uint16(9180); got != want {
		t.Fatalf("DevMachineAPI.Port = %d, want %d", got, want)
	}
	if got, want := cfg.DevMachineAPI.TLSCertificateFingerprint, fingerprint; got != want {
		t.Fatalf("DevMachineAPI.TLSCertificateFingerprint = %q, want %q", got, want)
	}
	if got := string(cfg.DevMachineAPI.APIKey); got != "local-development-machine-key" {
		t.Fatalf("DevMachineAPI.APIKey = %q", got)
	}
}

func TestLoadProductionRejectsDevelopmentMachineAPISettings(t *testing.T) {
	t.Setenv("SWARMOPS_INSECURE_DEV_AUTH", "false")
	t.Setenv("SWARMOPS_DEV_MACHINE_API_URL", "https://127.0.0.1")

	if _, err := Load(); err == nil || !strings.Contains(err.Error(), "SWARMOPS_DEV_MACHINE_API_*") {
		t.Fatalf("Load() error = %v, want development-machine-API rejection", err)
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

func TestLoadBreakGlassHTTPIsDisabledByDefault(t *testing.T) {
	t.Setenv("SWARMOPS_INSECURE_DEV_AUTH", "true")
	t.Setenv("SWARMOPS_DATA_DIR", t.TempDir())
	t.Setenv("SWARMOPS_DEV_SESSION_KEY", strings.Repeat("s", 32))

	cfg, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if cfg.HTTPEnabled || cfg.HTTPAllowRemote {
		t.Fatalf("plaintext HTTP defaults = enabled:%v remote:%v, want disabled", cfg.HTTPEnabled, cfg.HTTPAllowRemote)
	}
	if got, want := cfg.HTTPListenAddr, "127.0.0.1:8085"; got != want {
		t.Fatalf("HTTPListenAddr = %q, want %q", got, want)
	}
}

func TestLoadBreakGlassHTTPLoopbackAndRemoteGuards(t *testing.T) {
	setProductionCoreEnv(t)
	t.Setenv("SWARMOPS_TLS_CERT_FILE", writeSecretFile(t, "certificate", []byte("certificate")))
	t.Setenv("SWARMOPS_TLS_KEY_FILE", writeSecretFile(t, "private-key", []byte("private-key")))
	t.Setenv("SWARMOPS_LISTEN_ADDR", "127.0.0.1:28318")
	t.Setenv("SWARMOPS_HTTP_ENABLED", "true")
	t.Setenv("SWARMOPS_HTTP_LISTEN_ADDR", "127.0.0.1:28319")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("load loopback HTTP listener: %v", err)
	}
	if !cfg.HTTPEnabled || cfg.HTTPAllowRemote || cfg.HTTPListenAddr != "127.0.0.1:28319" {
		t.Fatalf("loopback HTTP config = enabled:%v remote:%v address:%q", cfg.HTTPEnabled, cfg.HTTPAllowRemote, cfg.HTTPListenAddr)
	}

	t.Setenv("SWARMOPS_HTTP_LISTEN_ADDR", "0.0.0.0:28319")
	if _, err := Load(); err == nil || !strings.Contains(err.Error(), "SWARMOPS_HTTP_ALLOW_REMOTE=true") {
		t.Fatalf("remote HTTP without acknowledgement error = %v", err)
	}

	t.Setenv("SWARMOPS_HTTP_ALLOW_REMOTE", "true")
	if _, err := Load(); err == nil || !strings.Contains(err.Error(), "SWARMOPS_ALLOWED_CLIENT_CIDRS") {
		t.Fatalf("remote HTTP without allowlist error = %v", err)
	}

	t.Setenv("SWARMOPS_ALLOWED_CLIENT_CIDRS", "198.51.100.20/32")
	cfg, err = Load()
	if err != nil {
		t.Fatalf("load guarded remote HTTP listener: %v", err)
	}
	if !cfg.HTTPAllowRemote || len(cfg.AllowedClientCIDRs) != 1 {
		t.Fatalf("remote HTTP guards = acknowledged:%v CIDRs:%#v", cfg.HTTPAllowRemote, cfg.AllowedClientCIDRs)
	}
}

func TestLoadDefaultsAndBoundsForRetentionValues(t *testing.T) {
	t.Setenv("SWARMOPS_INSECURE_DEV_AUTH", "true")
	t.Setenv("SWARMOPS_DATA_DIR", t.TempDir())
	t.Setenv("SWARMOPS_DEV_SESSION_KEY", strings.Repeat("s", 32))

	cfg, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if cfg.AuditMaxEvents != 10000 {
		t.Fatalf("AuditMaxEvents = %d, want the 10000 default", cfg.AuditMaxEvents)
	}
	if cfg.CommandHistoryLimit != 2000 {
		t.Fatalf("CommandHistoryLimit = %d, want the 2000 default", cfg.CommandHistoryLimit)
	}
	if cfg.CoreID != "core-local" || cfg.CoreMode != "active" || cfg.CoreName != "SwarmOps control plane" || cfg.CoreEndpoint != "" {
		t.Fatalf("core defaults = id:%q mode:%q name:%q endpoint:%q", cfg.CoreID, cfg.CoreMode, cfg.CoreName, cfg.CoreEndpoint)
	}
	if len(cfg.TrustedProxyCIDRs) != 0 {
		t.Fatalf("TrustedProxyCIDRs = %#v, want none by default", cfg.TrustedProxyCIDRs)
	}

	t.Setenv("SWARMOPS_AUDIT_MAX_EVENTS", "50")
	if _, err := Load(); err == nil || !strings.Contains(err.Error(), "SWARMOPS_AUDIT_MAX_EVENTS") {
		t.Fatalf("Load() error = %v, want bounded audit retention failure", err)
	}
	t.Setenv("SWARMOPS_AUDIT_MAX_EVENTS", "")

	t.Setenv("SWARMOPS_COMMAND_HISTORY_LIMIT", "10")
	if _, err := Load(); err == nil || !strings.Contains(err.Error(), "SWARMOPS_COMMAND_HISTORY_LIMIT") {
		t.Fatalf("Load() error = %v, want bounded command history failure", err)
	}
	t.Setenv("SWARMOPS_COMMAND_HISTORY_LIMIT", "")

	t.Setenv("SWARMOPS_TRUSTED_PROXY_CIDRS", "10.20.0.0/16")
	cfg, err = Load()
	if err != nil {
		t.Fatal(err)
	}
	if got, want := len(cfg.TrustedProxyCIDRs), 1; got != want || cfg.TrustedProxyCIDRs[0].String() != "10.20.0.0/16" {
		t.Fatalf("TrustedProxyCIDRs = %#v, want one 10.20.0.0/16 prefix", cfg.TrustedProxyCIDRs)
	}

	t.Setenv("SWARMOPS_TRUSTED_PROXY_CIDRS", "not-a-network")
	if _, err := Load(); err == nil || !strings.Contains(err.Error(), "SWARMOPS_TRUSTED_PROXY_CIDRS") {
		t.Fatalf("Load() error = %v, want trusted proxy parse failure", err)
	}
}

func TestLoadSourceImagePrefixMustUseBuildAllowList(t *testing.T) {
	t.Setenv("SWARMOPS_INSECURE_DEV_AUTH", "true")
	t.Setenv("SWARMOPS_DATA_DIR", t.TempDir())
	t.Setenv("SWARMOPS_DEV_SESSION_KEY", strings.Repeat("s", 32))
	t.Setenv("SWARMOPS_SOURCE_ENABLED", "true")
	t.Setenv("SWARMOPS_SOURCE_IMAGE_PREFIX", "ghcr.io/acme")
	t.Setenv("SWARMOPS_IMAGE_PREFIXES", "registry.internal/team/")

	if _, err := Load(); err == nil || !strings.Contains(err.Error(), "SWARMOPS_SOURCE_IMAGE_PREFIX") {
		t.Fatalf("Load() error = %v, want source image-prefix policy failure", err)
	}

	t.Setenv("SWARMOPS_IMAGE_PREFIXES", "ghcr.io/acme/")
	cfg, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if !cfg.SourceEnabled || cfg.SourceImagePrefix != "ghcr.io/acme" {
		t.Fatalf("source config = enabled:%v prefix:%q", cfg.SourceEnabled, cfg.SourceImagePrefix)
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

func setProductionCoreEnv(t *testing.T) {
	t.Helper()
	t.Setenv("SWARMOPS_INSECURE_DEV_AUTH", "false")
	t.Setenv("SWARMOPS_DATA_DIR", t.TempDir())
	t.Setenv("SWARMOPS_ADMIN_PASSWORD_HASH_FILE", writeSecretFile(t, "admin-password-hash", []byte("bcrypt-hash")))
	t.Setenv("SWARMOPS_SESSION_KEY_FILE", writeSecretFile(t, "session-key", []byte(strings.Repeat("s", 32))))
	t.Setenv("SWARMOPS_DATA_ENCRYPTION_KEY_FILE", writeSecretFile(t, "data-key", []byte(base64.StdEncoding.EncodeToString(bytes.Repeat([]byte{4}, 32)))))
}

func writeDevMachineCertificate(t *testing.T) (string, string) {
	t.Helper()
	privateKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	now := time.Now()
	certificateTemplate := &x509.Certificate{
		BasicConstraintsValid: true,
		DNSNames:              []string{"localhost"},
		KeyUsage:              x509.KeyUsageDigitalSignature,
		NotAfter:              now.Add(time.Hour),
		NotBefore:             now.Add(-time.Minute),
		SerialNumber:          big.NewInt(1),
		Subject:               pkix.Name{CommonName: "swarmops-local-agent"},
	}
	rawCertificate, err := x509.CreateCertificate(rand.Reader, certificateTemplate, certificateTemplate, &privateKey.PublicKey, privateKey)
	if err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(t.TempDir(), "local-machine-agent.crt")
	if err := os.WriteFile(path, pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: rawCertificate}), 0o644); err != nil {
		t.Fatal(err)
	}
	digest := sha256.Sum256(rawCertificate)
	return path, "SHA256:" + strings.ToUpper(hex.EncodeToString(digest[:]))
}
