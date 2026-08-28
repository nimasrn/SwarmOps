package main

import (
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/nimasrn/SwarmOps/internal/agentpull"
)

func TestEnrollmentHTTPClientPinsSelfSignedCore(t *testing.T) {
	t.Parallel()
	core := httptest.NewTLSServer(http.HandlerFunc(func(response http.ResponseWriter, _ *http.Request) {
		response.WriteHeader(http.StatusNoContent)
	}))
	defer core.Close()

	withoutPin, err := enrollmentHTTPClient(core.URL, "")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := withoutPin.Get(core.URL); err == nil {
		t.Fatal("self-signed Core unexpectedly passed the system CA pool")
	}

	digest := sha256.Sum256(core.Certificate().Raw)
	withPin, err := enrollmentHTTPClient(core.URL, fmt.Sprintf("SHA256:%X", digest))
	if err != nil {
		t.Fatal(err)
	}
	response, err := withPin.Get(core.URL)
	if err != nil {
		t.Fatalf("pinned self-signed Core failed: %v", err)
	}
	response.Body.Close()
	if response.StatusCode != http.StatusNoContent {
		t.Fatalf("status = %d", response.StatusCode)
	}

	wrongPin, err := enrollmentHTTPClient(core.URL, "SHA256:"+strings.Repeat("0", 64))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := wrongPin.Get(core.URL); err == nil {
		t.Fatal("wrong Core pin was accepted")
	}
}

func TestPersistOutboundIdentityKeepsEnrollmentName(t *testing.T) {
	t.Parallel()
	key, _, err := newAgentIdentity()
	if err != nil {
		t.Fatal(err)
	}
	directory := t.TempDir()
	enrollment := agentpull.Enrollment{AgentID: "agent-1", AuthorityEpoch: 1, CACertificate: "ca", Certificate: "certificate"}
	if err := persistOutboundIdentity("https://core.example", directory, key, enrollment, strings.Repeat("A", 64), " manager-1 "); err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(filepath.Join(directory, "identity.json"))
	if err != nil {
		t.Fatal(err)
	}
	var identity outboundIdentity
	if err := json.Unmarshal(data, &identity); err != nil {
		t.Fatal(err)
	}
	if identity.NodeName != "manager-1" {
		t.Fatalf("node name = %q", identity.NodeName)
	}
}

func TestEnrollmentHTTPClientRejectsMalformedFingerprint(t *testing.T) {
	t.Parallel()
	for _, value := range []string{"sha1:abcd", "SHA256:abcd", "SHA256:" + strings.Repeat("z", 64)} {
		if _, err := enrollmentHTTPClient("https://core.example", value); err == nil {
			t.Fatalf("fingerprint %q was accepted", value)
		}
	}
}

func TestOutboundHealthAddressAlwaysUsesLoopback(t *testing.T) {
	for _, input := range []string{":9180", "0.0.0.0:9180", "[::]:9180", "192.0.2.10:9180"} {
		address, err := outboundHealthAddress(input)
		if err != nil {
			t.Fatalf("outboundHealthAddress(%q): %v", input, err)
		}
		if address != "127.0.0.1:9180" {
			t.Fatalf("outboundHealthAddress(%q) = %q", input, address)
		}
	}
	for _, input := range []string{"9180", ":0", ":not-a-port"} {
		if _, err := outboundHealthAddress(input); err == nil {
			t.Fatalf("outboundHealthAddress(%q) accepted an invalid listener", input)
		}
	}
}
