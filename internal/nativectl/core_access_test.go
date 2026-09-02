package nativectl

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"errors"
	"math/big"
	"net"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestSetCoreAllowedCIDRsPreservesCertificateAndLoopbackAccess(t *testing.T) {
	environmentFile := writeCoreAccessFixture(t)
	var readyURL string
	restarts := 0
	updated, err := SetCoreAllowedCIDRs(context.Background(), environmentFile, []string{"198.51.100.8/32", "2001:db8:1234::99/48", "198.51.100.8/32"}, CoreAccessHooks{
		Restart: func(context.Context) error { restarts++; return nil },
		Ready: func(_ context.Context, value string) error {
			readyURL = value
			return nil
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	if strings.Join(updated, ",") != "198.51.100.8/32,2001:db8:1234::/48" {
		t.Fatalf("updated operator CIDRs = %v", updated)
	}
	if restarts != 1 {
		t.Fatalf("restart count = %d, want 1", restarts)
	}
	if readyURL != "https://127.0.0.1:28318/readyz" {
		t.Fatalf("ready URL = %q", readyURL)
	}
	data, err := os.ReadFile(environmentFile)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(data), "SWARMOPS_ALLOWED_CLIENT_CIDRS=198.51.100.8/32,2001:db8:1234::/48,109.122.247.57/32,127.0.0.1/32\n") {
		t.Fatalf("updated environment:\n%s", data)
	}
	info, err := os.Stat(environmentFile)
	if err != nil {
		t.Fatal(err)
	}
	if info.Mode().Perm() != 0o640 {
		t.Fatalf("environment mode = %o, want 640", info.Mode().Perm())
	}
}

func TestSetCoreAllowedCIDRsRollsBackWhenRestartFails(t *testing.T) {
	environmentFile := writeCoreAccessFixture(t)
	previous, err := os.ReadFile(environmentFile)
	if err != nil {
		t.Fatal(err)
	}
	restarts := 0
	_, err = SetCoreAllowedCIDRs(context.Background(), environmentFile, []string{"198.51.100.8/32"}, CoreAccessHooks{
		Restart: func(context.Context) error {
			restarts++
			if restarts == 1 {
				return errors.New("restart failed")
			}
			return nil
		},
		Ready: func(context.Context, string) error { t.Fatal("unexpected readiness check"); return nil },
	})
	if err == nil || !strings.Contains(err.Error(), "restored previous Core access policy") {
		t.Fatalf("error = %v", err)
	}
	if restarts != 2 {
		t.Fatalf("restart count = %d, want 2", restarts)
	}
	after, readErr := os.ReadFile(environmentFile)
	if readErr != nil {
		t.Fatal(readErr)
	}
	if string(after) != string(previous) {
		t.Fatal("environment was not restored after restart failure")
	}
}

func TestSetCoreAllowedCIDRsRejectsUnspecifiedHostPrefix(t *testing.T) {
	environmentFile := writeCoreAccessFixture(t)
	restarts := 0
	_, err := SetCoreAllowedCIDRs(context.Background(), environmentFile, []string{"0.0.0.0/32"}, CoreAccessHooks{
		Restart: func(context.Context) error { restarts++; return nil },
		Ready:   func(context.Context, string) error { return nil },
	})
	if err == nil || !strings.Contains(err.Error(), "specific trusted IPv4 network") {
		t.Fatalf("error = %v", err)
	}
	if restarts != 0 {
		t.Fatalf("restart count = %d, want 0", restarts)
	}
}

func TestSetCoreAllowedCIDRsRejectsUnrestrictedNetwork(t *testing.T) {
	environmentFile := writeCoreAccessFixture(t)
	restarts := 0
	_, err := SetCoreAllowedCIDRs(context.Background(), environmentFile, []string{"0.0.0.0/0"}, CoreAccessHooks{
		Restart: func(context.Context) error { restarts++; return nil },
		Ready:   func(context.Context, string) error { return nil },
	})
	if err == nil || !strings.Contains(err.Error(), "must not permit every address") {
		t.Fatalf("error = %v", err)
	}
	if restarts != 0 {
		t.Fatalf("restart count = %d, want 0", restarts)
	}
}

func TestSetCoreAllowedCIDRsRollsBackWhenReadinessFails(t *testing.T) {
	environmentFile := writeCoreAccessFixture(t)
	previous, err := os.ReadFile(environmentFile)
	if err != nil {
		t.Fatal(err)
	}
	restarts := 0
	_, err = SetCoreAllowedCIDRs(context.Background(), environmentFile, []string{"198.51.100.8/32"}, CoreAccessHooks{
		Restart: func(context.Context) error { restarts++; return nil },
		Ready:   func(context.Context, string) error { return errors.New("not ready") },
	})
	if err == nil || !strings.Contains(err.Error(), "restored previous Core access policy") {
		t.Fatalf("error = %v", err)
	}
	if restarts != 2 {
		t.Fatalf("restart count = %d, want 2", restarts)
	}
	after, readErr := os.ReadFile(environmentFile)
	if readErr != nil {
		t.Fatal(readErr)
	}
	if string(after) != string(previous) {
		t.Fatalf("environment was not restored:\n%s", after)
	}
}

func TestSetCoreAllowedCIDRsRejectsInvalidCIDRWithoutMutation(t *testing.T) {
	environmentFile := writeCoreAccessFixture(t)
	previous, err := os.ReadFile(environmentFile)
	if err != nil {
		t.Fatal(err)
	}
	_, err = SetCoreAllowedCIDRs(context.Background(), environmentFile, []string{"everyone"}, CoreAccessHooks{
		Restart: func(context.Context) error { t.Fatal("unexpected restart"); return nil },
		Ready:   func(context.Context, string) error { t.Fatal("unexpected readiness check"); return nil },
	})
	if err == nil || !strings.Contains(err.Error(), "invalid operator CIDR") {
		t.Fatalf("error = %v", err)
	}
	after, readErr := os.ReadFile(environmentFile)
	if readErr != nil {
		t.Fatal(readErr)
	}
	if string(after) != string(previous) {
		t.Fatal("invalid CIDR changed the environment")
	}
}

func TestSetCoreAllowedCIDRsVerifiesReadinessWithoutRestartForUnchangedPolicy(t *testing.T) {
	environmentFile := writeCoreAccessFixture(t)
	data, err := os.ReadFile(environmentFile)
	if err != nil {
		t.Fatal(err)
	}
	data = []byte(strings.Replace(string(data), "0.0.0.0/32,", "198.51.100.8/32,", 1))
	if err := os.WriteFile(environmentFile, data, 0o640); err != nil {
		t.Fatal(err)
	}
	readyChecks := 0
	updated, err := SetCoreAllowedCIDRs(context.Background(), environmentFile, []string{"198.51.100.8/32"}, CoreAccessHooks{
		Restart: func(context.Context) error {
			t.Fatal("unchanged policy must not restart Core")
			return nil
		},
		Ready: func(_ context.Context, healthURL string) error {
			readyChecks++
			if healthURL != "https://127.0.0.1:28318/readyz" {
				t.Fatalf("health URL = %q", healthURL)
			}
			return nil
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	if strings.Join(updated, ",") != "198.51.100.8/32" {
		t.Fatalf("updated CIDRs = %v", updated)
	}
	if readyChecks != 1 {
		t.Fatalf("readiness checks = %d, want 1", readyChecks)
	}
}

func writeCoreAccessFixture(t *testing.T) string {
	t.Helper()
	directory := t.TempDir()
	certificateFile := filepath.Join(directory, "tls.crt")
	writeCoreAccessCertificate(t, certificateFile, net.ParseIP("109.122.247.57"))
	environmentFile := filepath.Join(directory, "control-plane.env")
	configuration := strings.Join([]string{
		"SWARMOPS_TLS_CERT_FILE=" + certificateFile,
		"SWARMOPS_LISTEN_ADDR=0.0.0.0:28318",
		"SWARMOPS_ALLOWED_CLIENT_CIDRS=0.0.0.0/32,109.122.247.57/32,127.0.0.1/32",
		"SWARMOPS_DATA_DIR=/var/lib/swarmops",
		"",
	}, "\n")
	if err := os.WriteFile(environmentFile, []byte(configuration), 0o640); err != nil {
		t.Fatal(err)
	}
	return environmentFile
}

func writeCoreAccessCertificate(t *testing.T, name string, address net.IP) {
	t.Helper()
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	template := &x509.Certificate{
		SerialNumber: big.NewInt(1),
		Subject:      pkix.Name{CommonName: address.String()},
		NotBefore:    time.Now().Add(-time.Minute),
		NotAfter:     time.Now().Add(time.Hour),
		IPAddresses:  []net.IP{address},
	}
	der, err := x509.CreateCertificate(rand.Reader, template, template, &key.PublicKey, key)
	if err != nil {
		t.Fatal(err)
	}
	data := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der})
	if err := os.WriteFile(name, data, 0o644); err != nil {
		t.Fatal(err)
	}
}

func TestSetCoreAllowedCIDRsDisablesTheAllowlistWithoutRequestedNetworks(t *testing.T) {
	environmentFile := writeCoreAccessFixture(t)
	restarts := 0
	updated, err := SetCoreAllowedCIDRs(context.Background(), environmentFile, nil, CoreAccessHooks{
		Restart: func(context.Context) error { restarts++; return nil },
		Ready:   func(context.Context, string) error { return nil },
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(updated) != 0 {
		t.Fatalf("updated operator CIDRs = %v, want none", updated)
	}
	if restarts != 1 {
		t.Fatalf("restart count = %d, want 1", restarts)
	}
	data, err := os.ReadFile(environmentFile)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(data), "SWARMOPS_ALLOWED_CLIENT_CIDRS=\n") {
		t.Fatalf("updated environment:\n%s", data)
	}
	if _, err := SetCoreAllowedCIDRs(context.Background(), environmentFile, nil, CoreAccessHooks{
		Restart: func(context.Context) error { restarts++; return nil },
		Ready:   func(context.Context, string) error { return nil },
	}); err != nil {
		t.Fatalf("re-running the disable path on an empty allowlist: %v", err)
	}
	if restarts != 1 {
		t.Fatalf("restart count = %d, want the unchanged policy to skip a restart", restarts)
	}
}
