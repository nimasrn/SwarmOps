package agentpull

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/hex"
	"encoding/json"
	"encoding/pem"
	"errors"
	"fmt"
	"math/big"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/nimasrn/SwarmOps/internal/securestore"
)

const (
	registryPurpose = "agent-pull-registry"
	registryVersion = 1
	enrollmentTTL   = 15 * time.Minute
	clientCertTTL   = 30 * 24 * time.Hour
)

type EnrollmentToken struct {
	Code            string    `json:"code"`
	CoreFingerprint string    `json:"coreFingerprint,omitempty"`
	ExpiresAt       time.Time `json:"expiresAt"`
	Name            string    `json:"name,omitempty"`
}

type EnrollInput struct {
	CSR      string `json:"csr"`
	Code     string `json:"code"`
	NodeName string `json:"nodeName"`
	Protocol uint   `json:"protocol"`
}

type Enrollment struct {
	AgentID        string    `json:"agentId"`
	AuthorityEpoch uint64    `json:"authorityEpoch"`
	CACertificate  string    `json:"caCertificate"`
	Certificate    string    `json:"certificate"`
	ExpiresAt      time.Time `json:"expiresAt"`
}

type ClaimTicket struct {
	ClaimID     string    `json:"claimId"`
	ClaimSecret string    `json:"claimSecret"`
	Code        string    `json:"code"`
	ExpiresAt   time.Time `json:"expiresAt"`
}

type ClaimApproval struct {
	AgentID   string    `json:"agentId"`
	Name      string    `json:"name"`
	ExpiresAt time.Time `json:"expiresAt"`
}

type tokenRecord struct {
	Digest    string    `json:"digest"`
	ExpiresAt time.Time `json:"expiresAt"`
	Name      string    `json:"name,omitempty"`
}

type agentRecord struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	ExpiresAt time.Time `json:"expiresAt"`
}

type claimRecord struct {
	CSR          string      `json:"csr"`
	CodeDigest   string      `json:"codeDigest"`
	Enrollment   *Enrollment `json:"enrollment,omitempty"`
	ExpiresAt    time.Time   `json:"expiresAt"`
	ID           string      `json:"id"`
	Name         string      `json:"name"`
	SecretDigest string      `json:"secretDigest"`
}

type registryState struct {
	Agents    []agentRecord `json:"agents"`
	CACertPEM string        `json:"caCertPem"`
	CAKeyPEM  string        `json:"caKeyPem"`
	Claims    []claimRecord `json:"claims,omitempty"`
	Tokens    []tokenRecord `json:"tokens"`
	Version   int           `json:"version"`
}

// StartClaim supports the install-first enrollment flow. The agent keeps the
// private key and the high-entropy redemption secret; the administrator sees
// only the short-lived human-enterable code.
func (r *Registry) StartClaim(input EnrollInput) (ClaimTicket, error) {
	if input.Protocol != ProtocolVersion {
		return ClaimTicket{}, fmt.Errorf("agent pull protocol is incompatible")
	}
	if _, err := parseCSR(input.CSR); err != nil {
		return ClaimTicket{}, err
	}
	name := strings.TrimSpace(input.NodeName)
	if name == "" || len(name) > 96 || strings.ContainsAny(name, "\r\n\x00") {
		return ClaimTicket{}, fmt.Errorf("agent name is invalid")
	}
	claimID, err := randomID()
	if err != nil {
		return ClaimTicket{}, err
	}
	secret, err := randomID()
	if err != nil {
		return ClaimTicket{}, err
	}
	code, err := humanClaimCode()
	if err != nil {
		return ClaimTicket{}, err
	}
	expires := time.Now().UTC().Add(enrollmentTTL)
	r.mu.Lock()
	defer r.mu.Unlock()
	r.pruneLocked(time.Now().UTC())
	r.state.Claims = append(r.state.Claims, claimRecord{CSR: input.CSR, CodeDigest: digest(normalizeClaimCode(code)), ExpiresAt: expires, ID: claimID, Name: name, SecretDigest: digest(secret)})
	if err := r.saveLocked(); err != nil {
		return ClaimTicket{}, err
	}
	return ClaimTicket{ClaimID: claimID, ClaimSecret: secret, Code: code, ExpiresAt: expires}, nil
}

func (r *Registry) ApproveClaim(code string) (ClaimApproval, error) {
	now := time.Now().UTC()
	wanted := digest(normalizeClaimCode(code))
	r.mu.Lock()
	defer r.mu.Unlock()
	r.pruneLocked(now)
	for index := range r.state.Claims {
		claim := &r.state.Claims[index]
		if subtle.ConstantTimeCompare([]byte(claim.CodeDigest), []byte(wanted)) != 1 || !now.Before(claim.ExpiresAt) {
			continue
		}
		if claim.Enrollment != nil {
			return ClaimApproval{AgentID: claim.Enrollment.AgentID, Name: claim.Name, ExpiresAt: claim.Enrollment.ExpiresAt}, nil
		}
		csr, err := parseCSR(claim.CSR)
		if err != nil {
			return ClaimApproval{}, err
		}
		agentID, err := randomID()
		if err != nil {
			return ClaimApproval{}, err
		}
		certificate, expiresAt, err := r.issueLocked(agentID, claim.Name, csr)
		if err != nil {
			return ClaimApproval{}, err
		}
		claim.Enrollment = &Enrollment{AgentID: agentID, AuthorityEpoch: r.authorityEpoch, CACertificate: r.state.CACertPEM, Certificate: certificate, ExpiresAt: expiresAt}
		r.state.Agents = append(r.state.Agents, agentRecord{ID: agentID, Name: claim.Name, ExpiresAt: expiresAt})
		if err := r.saveLocked(); err != nil {
			return ClaimApproval{}, err
		}
		return ClaimApproval{AgentID: agentID, Name: claim.Name, ExpiresAt: expiresAt}, nil
	}
	return ClaimApproval{}, fmt.Errorf("standalone enrollment code is invalid or expired")
}

func (r *Registry) RedeemClaim(claimID, secret string) (Enrollment, bool, error) {
	now := time.Now().UTC()
	r.mu.Lock()
	defer r.mu.Unlock()
	r.pruneLocked(now)
	for index := range r.state.Claims {
		claim := r.state.Claims[index]
		if claim.ID != strings.TrimSpace(claimID) || subtle.ConstantTimeCompare([]byte(claim.SecretDigest), []byte(digest(strings.TrimSpace(secret)))) != 1 {
			continue
		}
		if claim.Enrollment == nil {
			return Enrollment{}, false, nil
		}
		enrollment := *claim.Enrollment
		r.state.Claims = append(r.state.Claims[:index], r.state.Claims[index+1:]...)
		if err := r.saveLocked(); err != nil {
			return Enrollment{}, false, err
		}
		return enrollment, true, nil
	}
	return Enrollment{}, false, fmt.Errorf("standalone enrollment claim is invalid or expired")
}

// Registry owns the private agent CA and one-time enrollment grants. Its state
// is envelope-encrypted and atomically replaced by securestore.
type Registry struct {
	authorityEpoch uint64
	ca             *x509.Certificate
	caKey          *ecdsa.PrivateKey
	mu             sync.Mutex
	path           string
	sealer         *securestore.Sealer
	state          registryState
}

func OpenRegistry(dataDir string, key []byte, authorityEpoch uint64) (*Registry, error) {
	sealer, err := securestore.New(key)
	if err != nil {
		return nil, err
	}
	if authorityEpoch == 0 {
		authorityEpoch = 1
	}
	registry := &Registry{authorityEpoch: authorityEpoch, path: filepath.Join(dataDir, "agent-pull-registry.sealed"), sealer: sealer}
	data, err := sealer.ReadFile(registry.path, registryPurpose)
	if errors.Is(err, os.ErrNotExist) {
		if err := registry.initialize(); err != nil {
			return nil, err
		}
		return registry, nil
	}
	if err != nil {
		return nil, fmt.Errorf("read agent certificate registry: %w", err)
	}
	if err := json.Unmarshal(data, &registry.state); err != nil || registry.state.Version != registryVersion {
		return nil, fmt.Errorf("read agent certificate registry: unsupported state")
	}
	if err := registry.parseCA(); err != nil {
		return nil, err
	}
	return registry, nil
}

func (r *Registry) initialize() error {
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return fmt.Errorf("generate agent CA key: %w", err)
	}
	serial, err := randomSerial()
	if err != nil {
		return err
	}
	now := time.Now().UTC()
	template := &x509.Certificate{SerialNumber: serial, Subject: pkix.Name{CommonName: "SwarmOps Agent CA"}, NotBefore: now.Add(-time.Minute), NotAfter: now.Add(10 * 365 * 24 * time.Hour), IsCA: true, BasicConstraintsValid: true, KeyUsage: x509.KeyUsageCertSign | x509.KeyUsageCRLSign | x509.KeyUsageDigitalSignature}
	der, err := x509.CreateCertificate(rand.Reader, template, template, &key.PublicKey, key)
	if err != nil {
		return fmt.Errorf("create agent CA certificate: %w", err)
	}
	keyDER, err := x509.MarshalPKCS8PrivateKey(key)
	if err != nil {
		return fmt.Errorf("encode agent CA key: %w", err)
	}
	r.ca, err = x509.ParseCertificate(der)
	if err != nil {
		return fmt.Errorf("parse generated agent CA: %w", err)
	}
	r.caKey = key
	r.state = registryState{CACertPEM: string(pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der})), CAKeyPEM: string(pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: keyDER})), Version: registryVersion}
	return r.saveLocked()
}

func (r *Registry) parseCA() error {
	certBlock, _ := pem.Decode([]byte(r.state.CACertPEM))
	keyBlock, _ := pem.Decode([]byte(r.state.CAKeyPEM))
	if certBlock == nil || keyBlock == nil {
		return fmt.Errorf("agent certificate registry contains invalid CA material")
	}
	cert, err := x509.ParseCertificate(certBlock.Bytes)
	if err != nil {
		return fmt.Errorf("parse agent CA certificate: %w", err)
	}
	parsed, err := x509.ParsePKCS8PrivateKey(keyBlock.Bytes)
	if err != nil {
		return fmt.Errorf("parse agent CA key: %w", err)
	}
	key, ok := parsed.(*ecdsa.PrivateKey)
	if !ok {
		return fmt.Errorf("agent CA key has an unsupported type")
	}
	r.ca, r.caKey = cert, key
	return nil
}

func (r *Registry) CreateEnrollment(name string) (EnrollmentToken, error) {
	name = strings.TrimSpace(name)
	if len(name) > 96 || strings.ContainsAny(name, "\r\n\x00") {
		return EnrollmentToken{}, fmt.Errorf("agent name is invalid")
	}
	codeBytes := make([]byte, 24)
	if _, err := rand.Read(codeBytes); err != nil {
		return EnrollmentToken{}, fmt.Errorf("create enrollment code: %w", err)
	}
	code := hex.EncodeToString(codeBytes)
	expires := time.Now().UTC().Add(enrollmentTTL)
	r.mu.Lock()
	defer r.mu.Unlock()
	r.pruneLocked(time.Now().UTC())
	r.state.Tokens = append(r.state.Tokens, tokenRecord{Digest: digest(code), ExpiresAt: expires, Name: name})
	if err := r.saveLocked(); err != nil {
		return EnrollmentToken{}, err
	}
	return EnrollmentToken{Code: code, ExpiresAt: expires, Name: name}, nil
}

func (r *Registry) Enroll(input EnrollInput) (Enrollment, error) {
	if input.Protocol != ProtocolVersion {
		return Enrollment{}, fmt.Errorf("agent pull protocol is incompatible")
	}
	csr, err := parseCSR(input.CSR)
	if err != nil {
		return Enrollment{}, err
	}
	now := time.Now().UTC()
	r.mu.Lock()
	defer r.mu.Unlock()
	r.pruneLocked(now)
	index := -1
	wanted := digest(strings.TrimSpace(input.Code))
	for position, token := range r.state.Tokens {
		if subtle.ConstantTimeCompare([]byte(token.Digest), []byte(wanted)) == 1 && now.Before(token.ExpiresAt) {
			index = position
			break
		}
	}
	if index < 0 {
		return Enrollment{}, fmt.Errorf("enrollment code is invalid or expired")
	}
	token := r.state.Tokens[index]
	name := strings.TrimSpace(input.NodeName)
	if token.Name != "" {
		name = token.Name
	}
	if name == "" || len(name) > 96 || strings.ContainsAny(name, "\r\n\x00") {
		return Enrollment{}, fmt.Errorf("agent name is invalid")
	}
	agentID, err := randomID()
	if err != nil {
		return Enrollment{}, err
	}
	certificate, expiresAt, err := r.issueLocked(agentID, name, csr)
	if err != nil {
		return Enrollment{}, err
	}
	r.state.Tokens = append(r.state.Tokens[:index], r.state.Tokens[index+1:]...)
	r.state.Agents = append(r.state.Agents, agentRecord{ID: agentID, Name: name, ExpiresAt: expiresAt})
	if err := r.saveLocked(); err != nil {
		return Enrollment{}, err
	}
	return Enrollment{AgentID: agentID, AuthorityEpoch: r.authorityEpoch, CACertificate: r.state.CACertPEM, Certificate: certificate, ExpiresAt: expiresAt}, nil
}

func (r *Registry) Renew(agentID, csrPEM string) (Enrollment, error) {
	csr, err := parseCSR(csrPEM)
	if err != nil {
		return Enrollment{}, err
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	for index := range r.state.Agents {
		if r.state.Agents[index].ID != agentID {
			continue
		}
		certificate, expiresAt, err := r.issueLocked(agentID, r.state.Agents[index].Name, csr)
		if err != nil {
			return Enrollment{}, err
		}
		r.state.Agents[index].ExpiresAt = expiresAt
		if err := r.saveLocked(); err != nil {
			return Enrollment{}, err
		}
		return Enrollment{AgentID: agentID, AuthorityEpoch: r.authorityEpoch, CACertificate: r.state.CACertPEM, Certificate: certificate, ExpiresAt: expiresAt}, nil
	}
	return Enrollment{}, fmt.Errorf("agent identity is not enrolled")
}

func (r *Registry) ClientCAs() *x509.CertPool {
	pool := x509.NewCertPool()
	pool.AppendCertsFromPEM([]byte(r.state.CACertPEM))
	return pool
}

func (r *Registry) SetAuthorityEpoch(epoch uint64) {
	if epoch == 0 {
		return
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	if epoch > r.authorityEpoch {
		r.authorityEpoch = epoch
	}
}

func (r *Registry) AgentID(request *http.Request) (string, error) {
	if request == nil || request.TLS == nil || len(request.TLS.VerifiedChains) == 0 || len(request.TLS.VerifiedChains[0]) == 0 {
		return "", fmt.Errorf("a verified agent client certificate is required")
	}
	certificate := request.TLS.VerifiedChains[0][0]
	agentID := strings.TrimSpace(certificate.Subject.CommonName)
	if agentID == "" || !r.hasAgent(agentID) {
		return "", fmt.Errorf("agent certificate identity is not enrolled")
	}
	return agentID, nil
}

func (r *Registry) hasAgent(agentID string) bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	for _, agent := range r.state.Agents {
		if agent.ID == agentID {
			return true
		}
	}
	return false
}

func (r *Registry) issueLocked(agentID, name string, csr *x509.CertificateRequest) (string, time.Time, error) {
	serial, err := randomSerial()
	if err != nil {
		return "", time.Time{}, err
	}
	now := time.Now().UTC()
	expires := now.Add(clientCertTTL)
	identity, _ := url.Parse("spiffe://swarmops/agent/" + agentID)
	template := &x509.Certificate{SerialNumber: serial, Subject: pkix.Name{CommonName: agentID, Organization: []string{"SwarmOps agents"}, OrganizationalUnit: []string{name}}, URIs: []*url.URL{identity}, NotBefore: now.Add(-time.Minute), NotAfter: expires, KeyUsage: x509.KeyUsageDigitalSignature, ExtKeyUsage: []x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth}}
	der, err := x509.CreateCertificate(rand.Reader, template, r.ca, csr.PublicKey, r.caKey)
	if err != nil {
		return "", time.Time{}, fmt.Errorf("issue agent client certificate: %w", err)
	}
	return string(pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der})), expires, nil
}

func parseCSR(value string) (*x509.CertificateRequest, error) {
	block, _ := pem.Decode([]byte(value))
	if block == nil || block.Type != "CERTIFICATE REQUEST" {
		return nil, fmt.Errorf("agent certificate request is invalid")
	}
	csr, err := x509.ParseCertificateRequest(block.Bytes)
	if err != nil || csr.CheckSignature() != nil {
		return nil, fmt.Errorf("agent certificate request is invalid")
	}
	switch key := csr.PublicKey.(type) {
	case *ecdsa.PublicKey:
		if key.Curve != elliptic.P256() {
			return nil, fmt.Errorf("agent certificate key must use P-256")
		}
	default:
		return nil, fmt.Errorf("agent certificate key must use P-256")
	}
	return csr, nil
}

func (r *Registry) pruneLocked(now time.Time) {
	tokens := r.state.Tokens[:0]
	for _, token := range r.state.Tokens {
		if now.Before(token.ExpiresAt) {
			tokens = append(tokens, token)
		}
	}
	r.state.Tokens = tokens
	claims := r.state.Claims[:0]
	for _, claim := range r.state.Claims {
		if now.Before(claim.ExpiresAt) {
			claims = append(claims, claim)
		}
	}
	r.state.Claims = claims
}

func (r *Registry) saveLocked() error {
	data, err := json.Marshal(r.state)
	if err != nil {
		return fmt.Errorf("encode agent certificate registry: %w", err)
	}
	if err := r.sealer.WriteFile(r.path, registryPurpose, data); err != nil {
		return fmt.Errorf("save agent certificate registry: %w", err)
	}
	return nil
}

func digest(value string) string {
	sum := sha256.Sum256([]byte(value))
	return hex.EncodeToString(sum[:])
}

func normalizeClaimCode(value string) string {
	return strings.ToUpper(strings.NewReplacer("-", "", " ", "").Replace(strings.TrimSpace(value)))
}

func humanClaimCode() (string, error) {
	const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	data := make([]byte, 16)
	if _, err := rand.Read(data); err != nil {
		return "", fmt.Errorf("create standalone enrollment code: %w", err)
	}
	characters := make([]byte, len(data))
	for index, value := range data {
		characters[index] = alphabet[int(value)&31]
	}
	return string(characters[0:4]) + "-" + string(characters[4:8]) + "-" + string(characters[8:12]) + "-" + string(characters[12:16]), nil
}

func randomSerial() (*big.Int, error) {
	limit := new(big.Int).Lsh(big.NewInt(1), 128)
	serial, err := rand.Int(rand.Reader, limit)
	if err != nil {
		return nil, fmt.Errorf("create certificate serial: %w", err)
	}
	return serial, nil
}
