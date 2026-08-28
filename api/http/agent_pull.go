package apihttp

import (
	"context"
	"crypto/sha256"
	"crypto/x509"
	"encoding/hex"
	"encoding/pem"
	"errors"
	"fmt"
	"net"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/nimasrn/SwarmOps/internal/agentpull"
	"github.com/nimasrn/SwarmOps/internal/auth"
)

func (s *Server) AgentClientCAs() *x509.CertPool {
	if s == nil || s.agentRegistry == nil {
		return x509.NewCertPool()
	}
	return s.agentRegistry.ClientCAs()
}

func (s *Server) agentEnrollmentToken(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
	var input struct {
		Name string `json:"name"`
	}
	if !decodeJSON(response, request, &input) {
		return
	}
	fingerprint, err := coreTLSFingerprint(s.config.TLSCertFile)
	if err != nil {
		writeError(response, http.StatusInternalServerError, "Core TLS identity is unavailable")
		return
	}
	token, err := s.agentRegistry.CreateEnrollment(input.Name)
	if err != nil {
		writeError(response, http.StatusUnprocessableEntity, err.Error())
		return
	}
	token.CoreFingerprint = fingerprint
	// The one-time code is returned only in this response and is never written
	// to the audit ledger. It expires quickly and is consumed atomically.
	s.record(claims.Username, requestID(request), "agent.enrollment.create", "agent/new", nil, map[string]string{"expires_at": token.ExpiresAt.Format(time.RFC3339)})
	writeJSON(response, http.StatusCreated, token)
}

func (s *Server) agentIdentity(response http.ResponseWriter, request *http.Request) {
	if !s.secureAgentRequest(request, false) {
		writeError(response, http.StatusUpgradeRequired, "Agent identity requires direct HTTPS to Core")
		return
	}
	fingerprint, err := coreTLSFingerprint(s.config.TLSCertFile)
	if err != nil {
		writeError(response, http.StatusInternalServerError, "Core TLS identity is unavailable")
		return
	}
	writeJSON(response, http.StatusOK, map[string]any{"coreFingerprint": fingerprint, "protocolVersion": agentpull.ProtocolVersion})
}

func coreTLSFingerprint(certificateFile string) (string, error) {
	certificateFile = strings.TrimSpace(certificateFile)
	if certificateFile == "" {
		return "", nil
	}
	data, err := os.ReadFile(certificateFile)
	if err != nil {
		return "", fmt.Errorf("read Core TLS certificate: %w", err)
	}
	block, _ := pem.Decode(data)
	if block == nil || block.Type != "CERTIFICATE" {
		return "", fmt.Errorf("Core TLS certificate is not PEM")
	}
	certificate, err := x509.ParseCertificate(block.Bytes)
	if err != nil {
		return "", fmt.Errorf("parse Core TLS certificate: %w", err)
	}
	digest := sha256.Sum256(certificate.Raw)
	return "SHA256:" + strings.ToUpper(hex.EncodeToString(digest[:])), nil
}

func (s *Server) agentEnrollPull(response http.ResponseWriter, request *http.Request) {
	if !s.secureAgentRequest(request, false) {
		writeError(response, http.StatusUpgradeRequired, "Agent enrollment requires direct HTTPS to Core")
		return
	}
	request.Body = http.MaxBytesReader(response, request.Body, 64<<10)
	var input agentpull.EnrollInput
	if !decodeJSON(response, request, &input) {
		return
	}
	enrollment, err := s.agentRegistry.Enroll(input)
	if err != nil {
		writeError(response, http.StatusUnauthorized, "Enrollment code, protocol, or certificate request was rejected")
		return
	}
	s.record("system:agent-enrollment", requestID(request), "agent.enrolled", "agent/"+enrollment.AgentID, nil, map[string]string{"node": boundedLabel(input.NodeName), "transport": "outbound_https"})
	writeJSON(response, http.StatusCreated, enrollment)
}

func (s *Server) agentClaimStart(response http.ResponseWriter, request *http.Request) {
	if !s.secureAgentRequest(request, false) {
		writeError(response, http.StatusUpgradeRequired, "Standalone enrollment requires direct HTTPS to Core")
		return
	}
	request.Body = http.MaxBytesReader(response, request.Body, 64<<10)
	var input agentpull.EnrollInput
	if !decodeJSON(response, request, &input) {
		return
	}
	ticket, err := s.agentRegistry.StartClaim(input)
	if err != nil {
		writeError(response, http.StatusUnprocessableEntity, "Standalone enrollment request was rejected")
		return
	}
	s.record("system:agent-claim", requestID(request), "agent.claim.created", "agent-claim/"+ticket.ClaimID, nil, map[string]string{"node": boundedLabel(input.NodeName), "expires_at": ticket.ExpiresAt.Format(time.RFC3339)})
	writeJSON(response, http.StatusCreated, ticket)
}

func (s *Server) agentClaimApprove(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
	var input struct {
		Code string `json:"code"`
	}
	if !decodeJSON(response, request, &input) {
		return
	}
	approval, err := s.agentRegistry.ApproveClaim(input.Code)
	if err != nil {
		writeError(response, http.StatusUnprocessableEntity, "Standalone enrollment code is invalid or expired")
		return
	}
	s.record(claims.Username, requestID(request), "agent.claim.approved", "agent/"+approval.AgentID, nil, map[string]string{"node": boundedLabel(approval.Name), "expires_at": approval.ExpiresAt.Format(time.RFC3339)})
	writeJSON(response, http.StatusOK, approval)
}

func (s *Server) agentClaimRedeem(response http.ResponseWriter, request *http.Request) {
	if !s.secureAgentRequest(request, false) {
		writeError(response, http.StatusUpgradeRequired, "Standalone enrollment requires direct HTTPS to Core")
		return
	}
	var input struct {
		ClaimID     string `json:"claimId"`
		ClaimSecret string `json:"claimSecret"`
	}
	if !decodeJSON(response, request, &input) {
		return
	}
	enrollment, ready, err := s.agentRegistry.RedeemClaim(input.ClaimID, input.ClaimSecret)
	if err != nil {
		writeError(response, http.StatusUnauthorized, "Standalone enrollment claim is invalid or expired")
		return
	}
	if !ready {
		response.WriteHeader(http.StatusAccepted)
		return
	}
	writeJSON(response, http.StatusOK, enrollment)
}

func (s *Server) agentPoll(response http.ResponseWriter, request *http.Request) {
	agentID, ok := s.authenticatedAgent(response, request)
	if !ok {
		return
	}
	request.Body = http.MaxBytesReader(response, request.Body, 128<<10)
	var input agentpull.PollRequest
	if !decodeJSON(response, request, &input) {
		return
	}
	if input.AgentID != agentID {
		writeError(response, http.StatusForbidden, "Agent certificate does not match the poll identity")
		return
	}
	if _, err := s.servers.AttachPull(agentID, input.Status.NodeName, input.Status, s.agentBroker.Transport(agentID)); err != nil {
		writeError(response, http.StatusUnprocessableEntity, "Agent status is incompatible with Core")
		return
	}
	pollContext, cancel := context.WithTimeout(request.Context(), 28*time.Second)
	defer cancel()
	item, err := s.agentBroker.Poll(pollContext, input)
	if errors.Is(err, context.DeadlineExceeded) || errors.Is(err, context.Canceled) {
		response.Header().Set("X-SwarmOps-Authority-Epoch", strconv.FormatUint(s.agentBroker.AuthorityEpoch(), 10))
		response.WriteHeader(http.StatusNoContent)
		return
	}
	if errors.Is(err, agentpull.ErrStaleAuthority) {
		writeJSON(response, http.StatusConflict, map[string]any{"authorityEpoch": s.agentBroker.AuthorityEpoch(), "error": "Agent authority epoch is stale"})
		return
	}
	if err != nil {
		writeError(response, http.StatusUnprocessableEntity, err.Error())
		return
	}
	writeJSON(response, http.StatusOK, item)
}

func (s *Server) agentResponse(response http.ResponseWriter, request *http.Request) {
	agentID, ok := s.authenticatedAgent(response, request)
	if !ok {
		return
	}
	request.Body = http.MaxBytesReader(response, request.Body, agentpull.MaxResponseBytes+(64<<10))
	var input agentpull.Response
	if !decodeJSON(response, request, &input) {
		return
	}
	if err := s.agentBroker.Respond(agentID, input); err != nil {
		writeError(response, http.StatusConflict, err.Error())
		return
	}
	response.WriteHeader(http.StatusNoContent)
}

func (s *Server) agentCertificateRenew(response http.ResponseWriter, request *http.Request) {
	agentID, ok := s.authenticatedAgent(response, request)
	if !ok {
		return
	}
	var input struct {
		CSR string `json:"csr"`
	}
	if !decodeJSON(response, request, &input) {
		return
	}
	enrollment, err := s.agentRegistry.Renew(agentID, input.CSR)
	if err != nil {
		writeError(response, http.StatusUnprocessableEntity, "Agent certificate renewal was rejected")
		return
	}
	s.record("system:agent/"+agentID, requestID(request), "agent.certificate.renew", "agent/"+agentID, nil, map[string]string{"expires_at": enrollment.ExpiresAt.Format(time.RFC3339)})
	writeJSON(response, http.StatusOK, enrollment)
}

func (s *Server) authenticatedAgent(response http.ResponseWriter, request *http.Request) (string, bool) {
	if !s.secureAgentRequest(request, true) {
		writeError(response, http.StatusUnauthorized, "A verified agent client certificate is required")
		return "", false
	}
	agentID, err := s.agentRegistry.AgentID(request)
	if err != nil {
		writeError(response, http.StatusUnauthorized, "A verified agent client certificate is required")
		return "", false
	}
	return agentID, true
}

func (s *Server) secureAgentRequest(request *http.Request, requireCertificate bool) bool {
	if request.TLS != nil {
		return !requireCertificate || len(request.TLS.VerifiedChains) > 0
	}
	if !s.config.InsecureDevAuth {
		return false
	}
	host, _, err := net.SplitHostPort(request.RemoteAddr)
	return err == nil && (host == "127.0.0.1" || host == "::1") && !requireCertificate
}

func boundedLabel(value string) string {
	value = strings.TrimSpace(value)
	if len(value) > 96 {
		return value[:96]
	}
	if strings.ContainsAny(value, "\r\n\x00") {
		return "invalid"
	}
	return value
}
