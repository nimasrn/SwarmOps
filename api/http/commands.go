package apihttp

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/nimasrn/SwarmOps/internal/auth"
	"github.com/nimasrn/SwarmOps/internal/build"
	"github.com/nimasrn/SwarmOps/internal/domain"
	"github.com/nimasrn/SwarmOps/internal/ops"
	"github.com/nimasrn/SwarmOps/internal/queue"
)

const (
	commandNodeAvailability = "node.availability"
	commandStackDeploy      = "stack.deploy"
	commandServiceRestart   = "service.restart"
	commandServiceRollback  = "service.rollback"
	commandServiceScale     = "service.scale"
	commandImageBuild       = "image.build"
	commandTraefikReconcile = "traefik.reconcile"
	commandNodeAgent        = "observability.node-agent"
	commandLogs             = "observability.logs"
	commandObservability    = "observability.core"

	maxAutomaticAttempts = 8
)

type nodeAvailabilityCommand struct {
	Availability string `json:"availability"`
	NodeID       string `json:"nodeId"`
}

type stackDeployCommand struct {
	Compose      string `json:"compose"`
	Name         string `json:"name"`
	TargetNodeID string `json:"targetNodeId"`
}

type serviceActionCommand struct {
	Action    string  `json:"action"`
	Replicas  *uint64 `json:"replicas,omitempty"`
	ServiceID string  `json:"serviceId"`
}

type buildCommand struct {
	Request build.Request `json:"request"`
}

type confirmationCommand struct {
	Confirmation string `json:"confirmation"`
	Enabled      bool   `json:"enabled"`
}

type traefikCommand struct {
	Confirmation string `json:"confirmation"`
}

func (s *Server) commandsList(response http.ResponseWriter, request *http.Request, _ auth.Claims) {
	limit, _ := strconv.Atoi(request.URL.Query().Get("limit"))
	if limit == 0 {
		limit = 100
	}
	commands, err := s.commands.List(limit)
	if err != nil {
		s.commandStoreError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, commands)
}

func (s *Server) commandGet(response http.ResponseWriter, request *http.Request, _ auth.Claims) {
	command, err := s.commands.Get(request.PathValue("id"))
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			writeError(response, http.StatusNotFound, "Command was not found")
			return
		}
		s.commandStoreError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, command)
}

func (s *Server) commandRetry(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
	command, err := s.commands.RetryNow(request.PathValue("id"))
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			writeError(response, http.StatusNotFound, "Command was not found")
			return
		}
		writeError(response, http.StatusConflict, "Only a command needing operator attention can be retried")
		return
	}
	// Preserve the original actor in the immutable command record while the
	// audit event names the operator who explicitly released a fresh attempt.
	s.record(claims.Username, requestID(request), "command.retry-requested", "command/"+command.ID, nil, commandAuditDetail(command))
	writeJSON(response, http.StatusAccepted, command)
}

func (s *Server) submitNodeAvailability(response http.ResponseWriter, request *http.Request, claims auth.Claims, nodeID, availability string) {
	if !oneOf(availability, "active", "pause", "drain") {
		writeError(response, http.StatusUnprocessableEntity, "Invalid node availability")
		return
	}
	s.submitCommand(response, request, claims, commandNodeAvailability, "node/"+nodeID, nodeAvailabilityCommand{Availability: availability, NodeID: nodeID}, true)
}

func (s *Server) submitStackDeploy(response http.ResponseWriter, request *http.Request, claims auth.Claims, input stackDeployCommand) {
	if !ops.ValidStackName(input.Name) {
		writeError(response, http.StatusUnprocessableEntity, "invalid stack name")
		return
	}
	if _, err := ops.PinComposeToNode([]byte(input.Compose), input.TargetNodeID); err != nil {
		writeError(response, http.StatusUnprocessableEntity, err.Error())
		return
	}
	if _, err := ops.ValidateCompose([]byte(input.Compose)); err != nil {
		writeError(response, http.StatusUnprocessableEntity, err.Error())
		return
	}
	s.submitCommand(response, request, claims, commandStackDeploy, "stack/"+input.Name, input, true)
}

func (s *Server) submitServiceAction(response http.ResponseWriter, request *http.Request, claims auth.Claims, input serviceActionCommand) {
	action := strings.TrimSpace(input.Action)
	if !oneOf(action, "restart", "rollback", "scale") {
		writeError(response, http.StatusUnprocessableEntity, "unsupported service action")
		return
	}
	if action == "scale" && (input.Replicas == nil || *input.Replicas > 1000) {
		writeError(response, http.StatusUnprocessableEntity, "scale requires a replica count between 0 and 1000")
		return
	}
	if action != "scale" {
		input.Replicas = nil
	}
	autoRetry := action == "scale"
	commandAction := "service." + action
	s.submitCommand(response, request, claims, commandAction, "service/"+input.ServiceID, input, autoRetry)
}

func (s *Server) submitBuild(response http.ResponseWriter, request *http.Request, claims auth.Claims, input build.Request) {
	validation := build.Service{
		Enabled:       s.config.BuildEnabled,
		ImagePrefixes: s.config.ImagePrefixes,
		MaxCPUs:       s.config.BuildMaxCPUs,
		MaxMemoryMiB:  s.config.BuildMaxMemoryMiB,
		RegistryAuth:  s.config.RegistryAuth,
	}
	normalized, err := validation.Validate(input)
	if err != nil {
		writeError(response, http.StatusUnprocessableEntity, err.Error())
		return
	}
	serverID, idempotencyKey, ok := s.commandSubmissionContext(response, request)
	if !ok {
		return
	}
	payload, err := json.Marshal(buildCommand{Request: normalized})
	if err != nil {
		writeError(response, http.StatusInternalServerError, "Command could not be queued")
		return
	}
	request.Body = http.MaxBytesReader(response, request.Body, s.config.BuildMaxBytes)
	defer request.Body.Close()
	command, created, err := s.commands.SubmitArtifact(queue.SubmitInput{
		Action:           commandImageBuild,
		Actor:            claims.Username,
		AutoRetry:        false,
		IdempotencyKey:   idempotencyKey,
		MaxArtifactBytes: s.config.BuildMaxBytes,
		MaxAttempts:      1,
		Payload:          payload,
		RequestID:        requestID(request),
		ServerID:         serverID,
		Target:           "image/" + normalized.Image,
	}, request.Body)
	if errors.Is(err, queue.ErrIdempotencyConflict) {
		writeError(response, http.StatusConflict, "Idempotency key was already used for a different command")
		return
	}
	if err != nil && command.ID == "" {
		s.commandStoreError(response, request, err)
		return
	}
	if created {
		s.record(claims.Username, requestID(request), "command.queued", "command/"+command.ID, nil, commandAuditDetail(command))
	}
	// A streaming source failure still leaves a durable, visible attention
	// record. Do not replace it with an opaque error response: the operator
	// must be able to see that no build ran and submit a new archive safely.
	writeJSON(response, http.StatusAccepted, command)
}

func (s *Server) submitTraefik(response http.ResponseWriter, request *http.Request, claims auth.Claims, confirmation string) {
	if confirmation != "DEPLOY_TRAEFIK" {
		writeError(response, http.StatusUnprocessableEntity, "deployment requires confirmation DEPLOY_TRAEFIK")
		return
	}
	s.submitCommand(response, request, claims, commandTraefikReconcile, "stack/traefik", traefikCommand{Confirmation: confirmation}, true)
}

func (s *Server) submitNodeAgent(response http.ResponseWriter, request *http.Request, claims auth.Claims, input confirmationCommand) {
	if input.Enabled && input.Confirmation != "INSTALL_NODE_AGENT" {
		writeError(response, http.StatusUnprocessableEntity, "installation requires confirmation INSTALL_NODE_AGENT")
		return
	}
	if !input.Enabled && input.Confirmation != "REMOVE_NODE_AGENT" {
		writeError(response, http.StatusUnprocessableEntity, "removal requires confirmation REMOVE_NODE_AGENT")
		return
	}
	s.submitCommand(response, request, claims, commandNodeAgent, "stack/swarmops-agent", input, true)
}

func (s *Server) submitLogs(response http.ResponseWriter, request *http.Request, claims auth.Claims, input confirmationCommand) {
	if !input.Enabled && input.Confirmation != "DISABLE_LOG_COLLECTION" {
		writeError(response, http.StatusUnprocessableEntity, "disable requires confirmation DISABLE_LOG_COLLECTION")
		return
	}
	s.submitCommand(response, request, claims, commandLogs, "stack/swarmops-logs", input, true)
}

func (s *Server) submitCoreObservability(response http.ResponseWriter, request *http.Request, claims auth.Claims, input confirmationCommand) {
	if !input.Enabled && input.Confirmation != "REMOVE_OBSERVABILITY_CORE" {
		writeError(response, http.StatusUnprocessableEntity, "removal requires confirmation REMOVE_OBSERVABILITY_CORE")
		return
	}
	s.submitCommand(response, request, claims, commandObservability, "stack/swarmops-observability", input, true)
}

func (s *Server) submitCommand(response http.ResponseWriter, request *http.Request, claims auth.Claims, action, target string, payload any, autoRetry bool) {
	serverID, idempotencyKey, ok := s.commandSubmissionContext(response, request)
	if !ok {
		return
	}
	encoded, err := json.Marshal(payload)
	if err != nil {
		writeError(response, http.StatusInternalServerError, "Command could not be queued")
		return
	}
	maxAttempts := uint(1)
	if autoRetry {
		maxAttempts = maxAutomaticAttempts
	}
	command, created, err := s.commands.Submit(queue.SubmitInput{
		Action:         action,
		Actor:          claims.Username,
		AutoRetry:      autoRetry,
		IdempotencyKey: idempotencyKey,
		MaxAttempts:    maxAttempts,
		Payload:        encoded,
		RequestID:      requestID(request),
		ServerID:       serverID,
		Target:         target,
	})
	if err != nil {
		if errors.Is(err, queue.ErrIdempotencyConflict) {
			writeError(response, http.StatusConflict, "Idempotency key was already used for a different command")
			return
		}
		s.commandStoreError(response, request, err)
		return
	}
	if created {
		s.record(claims.Username, requestID(request), "command.queued", "command/"+command.ID, nil, commandAuditDetail(command))
	}
	writeJSON(response, http.StatusAccepted, command)
}

func (s *Server) commandSubmissionContext(response http.ResponseWriter, request *http.Request) (string, string, bool) {
	if s.commands == nil {
		writeError(response, http.StatusServiceUnavailable, "SwarmOps command storage is unavailable")
		return "", "", false
	}
	if err := s.commands.Writable(); err != nil {
		writeError(response, http.StatusServiceUnavailable, "SwarmOps command storage is unavailable")
		return "", "", false
	}
	if err := s.audit.Writable(); err != nil {
		writeError(response, http.StatusServiceUnavailable, "The audit ledger is unavailable; the command was not queued")
		return "", "", false
	}
	idempotencyKey := strings.TrimSpace(request.Header.Get("Idempotency-Key"))
	if idempotencyKey == "" {
		writeError(response, http.StatusBadRequest, "Idempotency-Key is required for every command")
		return "", "", false
	}
	serverID := strings.TrimSpace(request.Header.Get("X-SwarmOps-Server-ID"))
	if serverID == "" {
		writeError(response, http.StatusConflict, "Select a saved server before queuing a command")
		return "", "", false
	}
	for _, server := range s.servers.List() {
		if server.ID == serverID {
			return serverID, idempotencyKey, true
		}
	}
	writeError(response, http.StatusNotFound, "Server was not found")
	return "", "", false
}

// ExecuteCommand is called only by the singleton worker. Payload decoding and
// target resolution occur after durable claiming, so an API restart cannot
// lose a command that was acknowledged to the browser.
func (s *Server) ExecuteCommand(ctx context.Context, record queue.Record) error {
	target, err := s.targets.Resolve(record.Command.ServerID)
	if err != nil {
		return err
	}
	if target.Control == nil {
		return queue.PermanentError(fmt.Errorf("selected server has no control plane"))
	}
	switch record.Command.Action {
	case commandNodeAvailability:
		var input nodeAvailabilityCommand
		if err := decodeCommandPayload(record.Payload, &input); err != nil {
			return queue.PermanentError(err)
		}
		return classifyCommandError(target.Control.SetNodeAvailability(ctx, record.Command.Actor, record.Command.RequestID, input.NodeID, input.Availability))
	case commandStackDeploy:
		var input stackDeployCommand
		if err := decodeCommandPayload(record.Payload, &input); err != nil {
			return queue.PermanentError(err)
		}
		_, err := target.Control.DeployStack(ctx, record.Command.Actor, record.Command.RequestID, input.Name, []byte(input.Compose), input.TargetNodeID)
		return classifyCommandError(err)
	case commandServiceRestart, commandServiceRollback, commandServiceScale:
		var input serviceActionCommand
		if err := decodeCommandPayload(record.Payload, &input); err != nil {
			return queue.PermanentError(err)
		}
		return classifyCommandError(target.Control.ServiceAction(ctx, record.Command.Actor, record.Command.RequestID, input.ServiceID, input.Action, input.Replicas))
	case commandImageBuild:
		var input buildCommand
		if err := decodeCommandPayload(record.Payload, &input); err != nil {
			return queue.PermanentError(err)
		}
		artifact, err := s.commands.Artifact(record.Command.ID)
		if err != nil {
			return queue.PermanentError(fmt.Errorf("build source input is unavailable"))
		}
		defer artifact.Close()
		_, err = target.Build.Run(ctx, input.Request, artifact, record.Command.RequestID)
		return classifyCommandError(err)
	case commandTraefikReconcile:
		var input traefikCommand
		if err := decodeCommandPayload(record.Payload, &input); err != nil {
			return queue.PermanentError(err)
		}
		return classifyCommandError(target.Control.ReconcileTraefik(ctx, record.Command.Actor, record.Command.RequestID, input.Confirmation))
	case commandNodeAgent:
		var input confirmationCommand
		if err := decodeCommandPayload(record.Payload, &input); err != nil {
			return queue.PermanentError(err)
		}
		return classifyCommandError(target.Control.NodeAgentCollection(ctx, record.Command.Actor, record.Command.RequestID, input.Enabled, input.Confirmation))
	case commandLogs:
		var input confirmationCommand
		if err := decodeCommandPayload(record.Payload, &input); err != nil {
			return queue.PermanentError(err)
		}
		return classifyCommandError(target.Control.LogsCollection(ctx, record.Command.Actor, record.Command.RequestID, input.Enabled, input.Confirmation))
	case commandObservability:
		var input confirmationCommand
		if err := decodeCommandPayload(record.Payload, &input); err != nil {
			return queue.PermanentError(err)
		}
		return classifyCommandError(target.Control.CoreObservability(ctx, record.Command.Actor, record.Command.RequestID, input.Enabled, input.Confirmation))
	default:
		return queue.PermanentError(fmt.Errorf("unsupported queued command"))
	}
}

// CommandExecutionTimeout keeps source builds bounded while giving the
// Docker API its documented 30-minute build window. All other fixed-shape
// cluster mutations retain the worker's short default timeout.
func (s *Server) CommandExecutionTimeout(command domain.Command) time.Duration {
	if command.Action == commandImageBuild {
		return 35 * time.Minute
	}
	return 10 * time.Minute
}

// RecordCommandTransition writes safe lifecycle evidence without ever placing
// raw Compose, build input, remote output, or error text in the audit stream.
func (s *Server) RecordCommandTransition(command domain.Command, event string) {
	s.record(command.Actor, command.RequestID, "command."+event, "command/"+command.ID, nil, commandAuditDetail(command))
}

func (s *Server) CommandStore() *queue.Store { return s.commands }

func (s *Server) commandStoreError(response http.ResponseWriter, request *http.Request, err error) {
	s.logger.Error("SwarmOps command storage failed", "request_id", requestID(request), "error", err)
	writeError(response, http.StatusServiceUnavailable, "SwarmOps command storage is unavailable")
}

func commandAuditDetail(command domain.Command) map[string]string {
	detail := map[string]string{
		"action":    command.Action,
		"attempt":   strconv.FormatUint(uint64(command.Attempt), 10),
		"server_id": command.ServerID,
		"state":     string(command.State),
		"target":    command.Target,
	}
	if command.NextAttemptAt != nil {
		detail["next_attempt_at"] = command.NextAttemptAt.UTC().Format(time.RFC3339)
	}
	return detail
}

func decodeCommandPayload(raw json.RawMessage, target any) error {
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		return fmt.Errorf("stored command payload is invalid")
	}
	if err := decoder.Decode(&struct{}{}); err != io.EOF {
		return fmt.Errorf("stored command payload is invalid")
	}
	return nil
}

func classifyCommandError(err error) error {
	if err == nil {
		return nil
	}
	text := strings.ToLower(err.Error())
	for _, marker := range []string{
		"invalid", "unsupported", "must", "requires", "disabled", "not configured", "not allow-listed", "exceed", "confirmation", "platform admission", "not a remote swarm manager",
	} {
		if strings.Contains(text, marker) {
			return queue.PermanentError(err)
		}
	}
	return err
}

func oneOf(value string, options ...string) bool {
	for _, option := range options {
		if value == option {
			return true
		}
	}
	return false
}
