package main

import (
	"bytes"
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"crypto/tls"
	"crypto/x509"
	"encoding/hex"
	"encoding/json"
	"encoding/pem"
	"flag"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/nimasrn/SwarmOps/internal/agent"
	"github.com/nimasrn/SwarmOps/internal/agentpull"
)

type outboundIdentity struct {
	AgentID         string `json:"agentId"`
	CoreFingerprint string `json:"coreFingerprint"`
	CoreURL         string `json:"coreUrl"`
	NodeName        string `json:"nodeName,omitempty"`
}

func runEnrollment(args []string) {
	flags := flag.NewFlagSet("enroll", flag.ExitOnError)
	coreURL := flags.String("core", "", "HTTPS Core URL")
	coreFingerprint := flags.String("core-fingerprint", "", "pinned SHA-256 Core certificate fingerprint")
	code := flags.String("code", "", "one-time enrollment code")
	name := flags.String("name", "", "agent display name")
	stateDir := flags.String("state-dir", "/var/lib/swarmops-agent", "root-owned agent state directory")
	if err := flags.Parse(args); err != nil {
		return
	}
	if flags.NArg() != 0 || strings.TrimSpace(*coreURL) == "" {
		fmt.Fprintln(os.Stderr, "usage: swarmops-agent enroll --core https://core.example [--core-fingerprint SHA256:<64-hex>] [--code <dashboard-code>] [--name node-1]")
		os.Exit(2)
	}
	var err error
	if strings.TrimSpace(*code) == "" {
		err = enrollStandalone(context.Background(), *coreURL, *coreFingerprint, *name, *stateDir)
	} else {
		err = enrollOutbound(context.Background(), *coreURL, *coreFingerprint, *code, *name, *stateDir)
	}
	if err != nil {
		fmt.Fprintln(os.Stderr, "enrollment failed:", err)
		os.Exit(1)
	}
}

func enrollOutbound(ctx context.Context, coreURL, coreFingerprint, code, name, stateDir string) error {
	coreURL = strings.TrimSuffix(strings.TrimSpace(coreURL), "/")
	parsed, err := url.Parse(coreURL)
	if err != nil || parsed.Scheme != "https" || parsed.Hostname() == "" {
		return fmt.Errorf("Core URL must be an absolute HTTPS origin")
	}
	key, csr, err := newAgentIdentity()
	if err != nil {
		return err
	}
	input, _ := json.Marshal(agentpull.EnrollInput{CSR: csr, Code: strings.TrimSpace(code), NodeName: strings.TrimSpace(name), Protocol: agentpull.ProtocolVersion})
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, coreURL+"/agent/v1/enroll", bytes.NewReader(input))
	if err != nil {
		return err
	}
	request.Header.Set("Content-Type", "application/json")
	client, err := enrollmentHTTPClient(coreURL, coreFingerprint)
	if err != nil {
		return err
	}
	response, err := client.Do(request)
	if err != nil {
		return fmt.Errorf("connect to Core: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusCreated || response.TLS == nil || len(response.TLS.PeerCertificates) == 0 {
		return fmt.Errorf("Core rejected enrollment with HTTP %d", response.StatusCode)
	}
	var enrollment agentpull.Enrollment
	if err := json.NewDecoder(response.Body).Decode(&enrollment); err != nil {
		return fmt.Errorf("decode enrollment: %w", err)
	}
	fingerprint := sha256.Sum256(response.TLS.PeerCertificates[0].Raw)
	if err := persistOutboundIdentity(coreURL, stateDir, key, enrollment, strings.ToUpper(hex.EncodeToString(fingerprint[:])), name); err != nil {
		return err
	}
	fmt.Printf("SwarmOps agent enrolled as %s; no long-lived key was printed.\n", enrollment.AgentID)
	return nil
}

func enrollStandalone(ctx context.Context, coreURL, coreFingerprint, name, stateDir string) error {
	coreURL = strings.TrimSuffix(strings.TrimSpace(coreURL), "/")
	parsed, err := url.Parse(coreURL)
	if err != nil || parsed.Scheme != "https" || parsed.Hostname() == "" {
		return fmt.Errorf("Core URL must be an absolute HTTPS origin")
	}
	name = strings.TrimSpace(name)
	if name == "" {
		name, err = os.Hostname()
		if err != nil || strings.TrimSpace(name) == "" {
			return fmt.Errorf("determine agent host name")
		}
	}
	key, csr, err := newAgentIdentity()
	if err != nil {
		return err
	}
	input, _ := json.Marshal(agentpull.EnrollInput{CSR: csr, NodeName: name, Protocol: agentpull.ProtocolVersion})
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, coreURL+"/agent/v1/claims", bytes.NewReader(input))
	if err != nil {
		return err
	}
	request.Header.Set("Content-Type", "application/json")
	client, err := enrollmentHTTPClient(coreURL, coreFingerprint)
	if err != nil {
		return err
	}
	response, err := client.Do(request)
	if err != nil {
		return fmt.Errorf("connect to Core: %w", err)
	}
	if response.StatusCode != http.StatusCreated || response.TLS == nil || len(response.TLS.PeerCertificates) == 0 {
		response.Body.Close()
		return fmt.Errorf("Core rejected standalone enrollment with HTTP %d", response.StatusCode)
	}
	var ticket agentpull.ClaimTicket
	if err := json.NewDecoder(response.Body).Decode(&ticket); err != nil {
		response.Body.Close()
		return fmt.Errorf("decode standalone enrollment ticket: %w", err)
	}
	fingerprintBytes := sha256.Sum256(response.TLS.PeerCertificates[0].Raw)
	fingerprint := strings.ToUpper(hex.EncodeToString(fingerprintBytes[:]))
	response.Body.Close()
	fmt.Printf("Enter this one-time code in SwarmOps Infrastructure > Agents:\n\n%s\n\nWaiting for administrator approval until %s...\n", ticket.Code, ticket.ExpiresAt.Local().Format(time.RFC3339))

	for time.Now().Before(ticket.ExpiresAt) {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(2 * time.Second):
		}
		body, _ := json.Marshal(map[string]string{"claimId": ticket.ClaimID, "claimSecret": ticket.ClaimSecret})
		redeemRequest, err := http.NewRequestWithContext(ctx, http.MethodPost, coreURL+"/agent/v1/claims/redeem", bytes.NewReader(body))
		if err != nil {
			return err
		}
		redeemRequest.Header.Set("Content-Type", "application/json")
		redeemResponse, err := client.Do(redeemRequest)
		if err != nil {
			continue
		}
		if redeemResponse.StatusCode == http.StatusAccepted {
			redeemResponse.Body.Close()
			continue
		}
		if redeemResponse.StatusCode != http.StatusOK {
			status := redeemResponse.StatusCode
			redeemResponse.Body.Close()
			return fmt.Errorf("Core rejected standalone enrollment redemption with HTTP %d", status)
		}
		if redeemResponse.TLS == nil || len(redeemResponse.TLS.PeerCertificates) == 0 {
			redeemResponse.Body.Close()
			return fmt.Errorf("Core did not present its pinned HTTPS identity")
		}
		actualFingerprint := sha256.Sum256(redeemResponse.TLS.PeerCertificates[0].Raw)
		if !strings.EqualFold(hex.EncodeToString(actualFingerprint[:]), fingerprint) {
			redeemResponse.Body.Close()
			return fmt.Errorf("Core identity changed while standalone enrollment was pending")
		}
		var enrollment agentpull.Enrollment
		if err := json.NewDecoder(redeemResponse.Body).Decode(&enrollment); err != nil {
			redeemResponse.Body.Close()
			return fmt.Errorf("decode standalone enrollment: %w", err)
		}
		redeemResponse.Body.Close()
		if err := persistOutboundIdentity(coreURL, stateDir, key, enrollment, fingerprint, name); err != nil {
			return err
		}
		fmt.Printf("SwarmOps agent enrolled as %s; no long-lived key was printed.\n", enrollment.AgentID)
		return nil
	}
	return fmt.Errorf("standalone enrollment code expired before approval")
}

func enrollmentHTTPClient(coreURL, fingerprint string) (*http.Client, error) {
	parsed, err := url.Parse(strings.TrimSuffix(strings.TrimSpace(coreURL), "/"))
	if err != nil || parsed.Scheme != "https" || parsed.Hostname() == "" {
		return nil, fmt.Errorf("Core URL must be an absolute HTTPS origin")
	}
	tlsConfig := &tls.Config{MinVersion: tls.VersionTLS13, ServerName: parsed.Hostname()}
	if strings.TrimSpace(fingerprint) != "" {
		expected, err := parseCoreFingerprint(fingerprint)
		if err != nil {
			return nil, err
		}
		// The exact leaf pin is the trust root for a self-signed Docker-free
		// Core. Normal chain verification is replaced only when the operator
		// supplied that authenticated pin.
		tlsConfig = pinnedCoreTLSConfig(coreURL, nil, expected)
	}
	return &http.Client{Transport: &http.Transport{TLSClientConfig: tlsConfig}, Timeout: 30 * time.Second}, nil
}

func parseCoreFingerprint(value string) ([]byte, error) {
	value = strings.TrimSpace(value)
	const prefix = "SHA256:"
	if len(value) != len(prefix)+sha256.Size*2 || !strings.EqualFold(value[:len(prefix)], prefix) {
		return nil, fmt.Errorf("Core fingerprint must use SHA256:<64-hex>")
	}
	digest, err := hex.DecodeString(value[len(prefix):])
	if err != nil || len(digest) != sha256.Size {
		return nil, fmt.Errorf("Core fingerprint must use SHA256:<64-hex>")
	}
	return digest, nil
}

func pinnedCoreTLSConfig(coreURL string, certificates []tls.Certificate, expected []byte) *tls.Config {
	return &tls.Config{
		MinVersion:         tls.VersionTLS13,
		Certificates:       certificates,
		ServerName:         mustHostname(coreURL),
		InsecureSkipVerify: true, // the exact leaf pin below is the trust root
		VerifyConnection: func(state tls.ConnectionState) error {
			if len(state.PeerCertificates) == 0 {
				return fmt.Errorf("Core did not present a certificate")
			}
			actual := sha256.Sum256(state.PeerCertificates[0].Raw)
			if subtle.ConstantTimeCompare(actual[:], expected) != 1 {
				return fmt.Errorf("Core certificate fingerprint does not match the pinned identity")
			}
			return nil
		},
	}
}

func newAgentIdentity() (*ecdsa.PrivateKey, string, error) {
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return nil, "", fmt.Errorf("generate agent identity: %w", err)
	}
	csrDER, err := x509.CreateCertificateRequest(rand.Reader, &x509.CertificateRequest{}, key)
	if err != nil {
		return nil, "", fmt.Errorf("create agent certificate request: %w", err)
	}
	return key, string(pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE REQUEST", Bytes: csrDER})), nil
}

func persistOutboundIdentity(coreURL, stateDir string, key *ecdsa.PrivateKey, enrollment agentpull.Enrollment, fingerprint, nodeName string) error {
	keyDER, err := x509.MarshalPKCS8PrivateKey(key)
	if err != nil {
		return err
	}
	identity := outboundIdentity{AgentID: enrollment.AgentID, CoreFingerprint: fingerprint, CoreURL: coreURL, NodeName: strings.TrimSpace(nodeName)}
	if err := os.MkdirAll(stateDir, 0o700); err != nil {
		return fmt.Errorf("create agent state directory: %w", err)
	}
	files := map[string][]byte{
		"client-key.pem":  pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: keyDER}),
		"client-cert.pem": []byte(enrollment.Certificate),
		"agent-ca.pem":    []byte(enrollment.CACertificate),
	}
	identityData, _ := json.Marshal(identity)
	files["identity.json"] = identityData
	for filename, data := range files {
		if err := writeProtected(filepath.Join(stateDir, filename), data); err != nil {
			return err
		}
	}
	if err := writeProtected(filepath.Join(stateDir, "cursor.json"), []byte(fmt.Sprintf(`{"authorityEpoch":%d,"cursor":0}`, enrollment.AuthorityEpoch))); err != nil {
		return err
	}
	return nil
}

func newOutboundClient(runtime runtimeConfig, server *agent.Server) (*agentpull.Client, error) {
	data, err := os.ReadFile(filepath.Join(runtime.outboundStateDir, "identity.json"))
	if err != nil {
		return nil, fmt.Errorf("read outbound identity: %w", err)
	}
	var identity outboundIdentity
	if err := json.Unmarshal(data, &identity); err != nil {
		return nil, fmt.Errorf("read outbound identity: %w", err)
	}
	if runtime.coreURL != "" && strings.TrimSuffix(runtime.coreURL, "/") != identity.CoreURL {
		return nil, fmt.Errorf("configured Core URL does not match the enrolled identity")
	}
	certificate, err := tls.LoadX509KeyPair(filepath.Join(runtime.outboundStateDir, "client-cert.pem"), filepath.Join(runtime.outboundStateDir, "client-key.pem"))
	if err != nil {
		return nil, fmt.Errorf("load agent client certificate: %w", err)
	}
	expected, err := hex.DecodeString(identity.CoreFingerprint)
	if err != nil || len(expected) != sha256.Size {
		return nil, fmt.Errorf("stored Core identity fingerprint is invalid")
	}
	tlsConfig := pinnedCoreTLSConfig(identity.CoreURL, []tls.Certificate{certificate}, expected)
	httpClient := &http.Client{Transport: &http.Transport{Proxy: http.ProxyFromEnvironment, TLSClientConfig: tlsConfig}, Timeout: 40 * time.Second}
	return agentpull.NewClient(agentpull.ClientConfig{AgentID: identity.AgentID, BaseURL: identity.CoreURL, Handler: server.Handler(), HTTP: httpClient, LocalKey: runtime.token, StateFile: filepath.Join(runtime.outboundStateDir, "cursor.json"), Status: func(ctx context.Context) (agentpull.Status, error) {
		status := server.CurrentStatus(ctx)
		nodeName := strings.TrimSpace(identity.NodeName)
		if nodeName == "" {
			nodeName = status.NodeName
		}
		return agentpull.Status{DockerAvailable: status.DockerAvailable, DockerVersion: status.DockerVersion, NodeName: nodeName, RemoteControlEnabled: status.RemoteControlEnabled, SwarmControlAvailable: status.SwarmControlAvailable, SwarmState: status.SwarmState, Version: status.Version}, nil
	}})
}

func mustHostname(value string) string { parsed, _ := url.Parse(value); return parsed.Hostname() }

func writeProtected(path string, data []byte) error {
	if err := os.WriteFile(path, data, 0o600); err != nil {
		return fmt.Errorf("write protected agent state: %w", err)
	}
	return os.Chmod(path, 0o600)
}
