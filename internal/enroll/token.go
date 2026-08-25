// Package enroll defines the single copy-paste enrollment token that a freshly
// installed machine agent prints and an operator pastes into the SwarmOps
// console. The token carries the agent's reachable origin, its pinned leaf
// certificate fingerprint, and a one-time enrollment secret. It deliberately
// never carries the long-lived machine API key: the controller exchanges the
// one-time secret for that key over the pinned TLS connection, and the agent
// burns the secret on first use.
package enroll

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/netip"
	"regexp"
	"strings"
)

// Prefix identifies the token version. A future format change gets a new
// prefix so an old console fails closed instead of guessing.
const Prefix = "swarmops1."

// MaxTokenBytes bounds what a decoder will look at. The encoded token is far
// smaller; the limit exists so a pasted blob cannot force a large allocation.
const MaxTokenBytes = 4096

// SecretBytes is the raw entropy of the one-time enrollment secret and of the
// machine API key the installer generates.
const SecretBytes = 32

var (
	fingerprintPattern = regexp.MustCompile(`^SHA256:[A-F0-9]{64}$`)
	hostnamePattern    = regexp.MustCompile(`^[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*$`)
	secretPattern      = regexp.MustCompile(`^[A-Za-z0-9_-]{22,128}$`)
)

// Token is the decoded enrollment payload. Field names stay short because the
// operator copies the encoded form by hand from a terminal.
type Token struct {
	Fingerprint string `json:"f,omitempty"`
	Host        string `json:"h"`
	Port        uint16 `json:"p"`
	Secret      string `json:"s"`
}

// Encode renders the token as one opaque, whitespace-free string.
func Encode(token Token) (string, error) {
	if err := token.Validate(); err != nil {
		return "", err
	}
	payload, err := json.Marshal(token)
	if err != nil {
		return "", fmt.Errorf("encode enrollment token: %w", err)
	}
	return Prefix + base64.RawURLEncoding.EncodeToString(payload), nil
}

// Decode parses and fully validates a pasted token. Every field is checked
// here so callers never build a connection from an unvalidated token.
func Decode(value string) (Token, error) {
	value = strings.TrimSpace(value)
	if len(value) > MaxTokenBytes {
		return Token{}, fmt.Errorf("enrollment token is too long")
	}
	if !strings.HasPrefix(value, Prefix) {
		return Token{}, fmt.Errorf("enrollment token must start with %q", Prefix)
	}
	payload, err := base64.RawURLEncoding.DecodeString(value[len(Prefix):])
	if err != nil {
		return Token{}, fmt.Errorf("enrollment token is not valid base64url")
	}
	decoder := json.NewDecoder(strings.NewReader(string(payload)))
	decoder.DisallowUnknownFields()
	var token Token
	if err := decoder.Decode(&token); err != nil {
		return Token{}, fmt.Errorf("enrollment token payload is malformed")
	}
	token.Fingerprint = strings.ToUpper(strings.TrimSpace(token.Fingerprint))
	token.Host = strings.TrimSpace(token.Host)
	token.Secret = strings.TrimSpace(token.Secret)
	if err := token.Validate(); err != nil {
		return Token{}, err
	}
	return token, nil
}

// Validate enforces the transport rules the console depends on: a routable
// host, a usable port, a well-formed one-time secret, and a pinned certificate
// for anything that is not loopback.
func (t Token) Validate() error {
	if t.Host == "" || len(t.Host) > 253 {
		return fmt.Errorf("enrollment token host is required")
	}
	if _, err := netip.ParseAddr(t.Host); err != nil && !hostnamePattern.MatchString(t.Host) {
		return fmt.Errorf("enrollment token host must be an IP address or hostname")
	}
	if t.Port == 0 {
		return fmt.Errorf("enrollment token port is required")
	}
	if !secretPattern.MatchString(t.Secret) {
		return fmt.Errorf("enrollment token secret is malformed")
	}
	if t.Fingerprint == "" && !Loopback(t.Host) {
		return fmt.Errorf("enrollment token needs a TLS fingerprint outside loopback")
	}
	if t.Fingerprint != "" && !fingerprintPattern.MatchString(t.Fingerprint) {
		return fmt.Errorf("enrollment token fingerprint must use SHA256:<64-hex>")
	}
	return nil
}

// Scheme reports the transport the token implies. A pinned fingerprint means
// HTTPS; only a loopback agent may be plain HTTP.
func (t Token) Scheme() string {
	if t.Fingerprint != "" {
		return "https"
	}
	return "http"
}

// Loopback reports whether a host is the local machine, the only case where an
// unpinned agent connection is permitted.
func Loopback(host string) bool {
	if host == "localhost" {
		return true
	}
	address, err := netip.ParseAddr(host)
	return err == nil && address.IsLoopback()
}
