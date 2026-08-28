package apihttp

import (
	"crypto/sha256"
	"encoding/pem"
	"fmt"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

func TestCoreTLSFingerprint(t *testing.T) {
	t.Parallel()
	core := httptest.NewTLSServer(nil)
	defer core.Close()

	path := filepath.Join(t.TempDir(), "core.crt")
	data := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: core.Certificate().Raw})
	if err := os.WriteFile(path, data, 0o600); err != nil {
		t.Fatal(err)
	}
	digest := sha256.Sum256(core.Certificate().Raw)
	want := fmt.Sprintf("SHA256:%X", digest)
	got, err := coreTLSFingerprint(path)
	if err != nil {
		t.Fatal(err)
	}
	if got != want {
		t.Fatalf("fingerprint = %q, want %q", got, want)
	}
}

func TestCoreTLSFingerprintAllowsLoopbackHTTP(t *testing.T) {
	t.Parallel()
	got, err := coreTLSFingerprint("")
	if err != nil || got != "" {
		t.Fatalf("fingerprint = %q, err = %v", got, err)
	}
}
