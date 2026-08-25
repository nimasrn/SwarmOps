package remote

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/nimasrn/SwarmOps/internal/domain"
	"github.com/nimasrn/SwarmOps/internal/enroll"
)

// enrollmentTimeout bounds the one-time handshake. It is short because the
// exchange is a single request against an agent the operator just installed.
const enrollmentTimeout = 15 * time.Second

// Enroll turns one pasted enrollment token into a connected server profile.
// The token's one-time secret is exchanged over the pinned TLS connection for
// the long-lived machine API key, which then follows the ordinary Add path and
// is sealed by enrollment-based controllers for restart recovery. The operator
// never handles the API key and the secret cannot be replayed: the agent burns
// it on first use.
func (m *Manager) Enroll(ctx context.Context, token, name string) (domain.Server, error) {
	parsed, err := enroll.Decode(token)
	if err != nil {
		return domain.Server{}, err
	}
	apiURL := parsed.Scheme() + "://" + hostForURL(parsed.Host)
	probe := domain.Server{
		APIURL:                    apiURL,
		Authentication:            AuthenticationAPIKey,
		ConnectionState:           disconnectedState,
		ConnectionType:            ConnectionAgentAPI,
		Host:                      parsed.Host,
		ID:                        newID(),
		Name:                      enrollmentName(name, parsed.Host),
		Port:                      parsed.Port,
		TLSCertificateFingerprint: parsed.Fingerprint,
	}
	client, err := newAgentClient(probe, parsed.Secret)
	if err != nil {
		return domain.Server{}, err
	}
	exchangeContext, cancel := context.WithTimeout(ctx, enrollmentTimeout)
	defer cancel()
	apiKey, err := client.exchangeEnrollment(exchangeContext)
	client.Close()
	if err != nil {
		return domain.Server{}, err
	}
	server, err := m.Add(ctx, AddInput{
		APIKey:                    apiKey,
		APIURL:                    apiURL,
		Authentication:            AuthenticationAPIKey,
		Name:                      probe.Name,
		Port:                      parsed.Port,
		TLSCertificateFingerprint: parsed.Fingerprint,
	})
	return server, err
}

// exchangeEnrollment presents the one-time secret as the bearer credential and
// reads back the machine API key. A spent token answers 410 so the console can
// tell "already enrolled" apart from "wrong token".
func (c *agentClient) exchangeEnrollment(ctx context.Context) (string, error) {
	response, err := c.request(ctx, http.MethodPost, "/v1/enroll", nil)
	if err != nil {
		return "", err
	}
	defer response.Body.Close()
	switch response.StatusCode {
	case http.StatusOK:
	case http.StatusGone:
		return "", fmt.Errorf("this agent has already been enrolled; reinstall the agent to issue a new token")
	case http.StatusNotFound:
		return "", fmt.Errorf("this agent does not offer enrollment; reinstall it with the current installer")
	case http.StatusUnauthorized:
		return "", fmt.Errorf("the enrollment token was rejected by the agent")
	default:
		return "", fmt.Errorf("enrollment request failed")
	}
	var payload struct {
		APIKey string `json:"apiKey"`
	}
	if err := json.NewDecoder(io.LimitReader(response.Body, 8<<10)).Decode(&payload); err != nil {
		return "", fmt.Errorf("decode enrollment response")
	}
	if len(strings.TrimSpace(payload.APIKey)) < 16 {
		return "", fmt.Errorf("agent returned an unusable machine API key")
	}
	return strings.TrimSpace(payload.APIKey), nil
}

func enrollmentName(name, host string) string {
	if trimmed := strings.TrimSpace(name); trimmed != "" {
		return trimmed
	}
	return host
}

// hostForURL brackets an IPv6 literal so it can be joined into an origin.
func hostForURL(host string) string {
	if strings.Contains(host, ":") && !strings.HasPrefix(host, "[") {
		return "[" + host + "]"
	}
	return host
}
