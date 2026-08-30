package apihttp

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/nimasrn/SwarmOps/internal/agent"
	"github.com/nimasrn/SwarmOps/internal/agentcontrol"
	"github.com/nimasrn/SwarmOps/internal/auth"
	"github.com/nimasrn/SwarmOps/internal/domain"
	"github.com/nimasrn/SwarmOps/internal/queue"
)

// serverReadiness is available before Docker or Swarm are ready. It resolves a
// specific pinned machine agent rather than relying on the selected manager in
// the top bar, so a freshly enrolled host has a safe path to readiness.
func (s *Server) serverReadiness(response http.ResponseWriter, request *http.Request, _ auth.Claims) {
	if !s.requireActiveControl(response) {
		return
	}
	target, err := s.targets.Resolve(request.PathValue("id"))
	if err != nil {
		s.operationError(response, request, err)
		return
	}
	if target.Provisioner == nil {
		writeError(response, http.StatusUnprocessableEntity, "This server does not expose the SwarmOps machine provisioning agent")
		return
	}
	status, err := target.Provisioner.ProvisioningStatus(request.Context())
	if err != nil {
		s.operationError(response, request, err)
		return
	}
	result := serverReadinessResponse{ProvisioningStatus: status}
	if target.Host != nil {
		if snapshot, snapshotErr := target.Host.Snapshot(request.Context()); snapshotErr == nil {
			result.Host = &snapshot
		}
	}
	writeJSON(response, http.StatusOK, result)
}

type serverReadinessResponse struct {
	agentcontrol.ProvisioningStatus
	Host *agent.Snapshot `json:"host,omitempty"`
}

func (s *Server) serverReadinessQueue(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
	serverID := strings.TrimSpace(request.PathValue("id"))
	if !s.savedServer(serverID) {
		writeError(response, http.StatusNotFound, "Server was not found")
		return
	}
	target, err := s.targets.Resolve(serverID)
	if err != nil {
		s.operationError(response, request, err)
		return
	}
	if target.Provisioner == nil {
		writeError(response, http.StatusUnprocessableEntity, "This server does not expose the SwarmOps machine provisioning agent")
		return
	}
	var input serverReadinessCommand
	if !decodeJSON(response, request, &input) {
		return
	}
	if err := input.validateSubmission(s.servers.List(), serverID); err != nil {
		writeError(response, http.StatusUnprocessableEntity, err.Error())
		return
	}
	// The server identity comes from the URL, not a stale manager selection in
	// the browser. The shared submission guard still verifies durable storage,
	// audit availability, and the required idempotency key.
	request.Header.Set("X-SwarmOps-Server-ID", serverID)
	_, idempotencyKey, ok := s.commandSubmissionContext(response, request)
	if !ok {
		return
	}
	payload, err := json.Marshal(input)
	if err != nil {
		writeError(response, http.StatusInternalServerError, "Server readiness could not be queued")
		return
	}
	submission, err := s.commands.SubmitWithResult(queue.SubmitInput{
		Action:         commandServerReadiness,
		Actor:          claims.Username,
		AuthorityEpoch: s.core.AuthorityEpoch(),
		AutoRetry:      false,
		ClusterID:      "default",
		IdempotencyKey: idempotencyKey,
		MaxAttempts:    1,
		Payload:        payload,
		RequestID:      requestID(request),
		ServerID:       serverID,
		Target:         "server/" + serverID + "/readiness",
	})
	if err != nil {
		if errors.Is(err, queue.ErrIdempotencyConflict) {
			writeError(response, http.StatusConflict, "Idempotency key was already used for a different command")
			return
		}
		s.commandStoreError(response, request, fmt.Errorf("queue server readiness: %w", err))
		return
	}
	s.recordCommandSubmission(claims, request, submission)
	writeJSON(response, http.StatusAccepted, submission.Command)
}

func (s *Server) savedServer(id string) bool {
	for _, server := range s.servers.List() {
		if server.ID == id {
			return true
		}
	}
	return false
}

// serverReadinessCommand is the queued shape of a readiness plan.
//
// It embeds the machine's own vocabulary so a payload written by an earlier
// release still decodes, and adds the two fields that exist only on the
// controller: which manager a join should get its token from, and whether the
// node joins as a manager or a worker. The TOKEN is deliberately not here —
// the worker reads it from that manager when the command runs, so no join
// credential is ever written to the sealed ledger or the audit trail.
type serverReadinessCommand struct {
	agentcontrol.ProvisioningRequest
	JoinFromServerID string `json:"joinFromServerId,omitempty"`
	JoinRole         string `json:"joinRole,omitempty"`
}

func (c serverReadinessCommand) validateSubmission(servers []domain.Server, target string) error {
	if err := c.ValidateWithoutJoinToken(); err != nil {
		return err
	}
	if !c.JoinSwarm {
		if strings.TrimSpace(c.JoinFromServerID) != "" || strings.TrimSpace(c.JoinRole) != "" {
			return fmt.Errorf("a join source requires the Swarm join operation")
		}
		return nil
	}
	if !agentcontrol.ValidJoinRole(c.JoinRole) {
		return fmt.Errorf("choose whether this machine joins as a manager or a worker")
	}
	source := strings.TrimSpace(c.JoinFromServerID)
	if source == "" {
		return fmt.Errorf("choose the Swarm manager this machine should join")
	}
	if source == target {
		return fmt.Errorf("a machine cannot join itself")
	}
	if _, found := savedServerProfile(servers, source); !found {
		return fmt.Errorf("the selected Swarm manager is not a managed machine")
	}
	return nil
}
