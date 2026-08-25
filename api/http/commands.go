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

	"github.com/nimasrn/SwarmOps/internal/agentcontrol"
	"github.com/nimasrn/SwarmOps/internal/auth"
	"github.com/nimasrn/SwarmOps/internal/build"
	"github.com/nimasrn/SwarmOps/internal/dockerapi"
	"github.com/nimasrn/SwarmOps/internal/domain"
	"github.com/nimasrn/SwarmOps/internal/ops"
	"github.com/nimasrn/SwarmOps/internal/queue"
	"github.com/nimasrn/SwarmOps/internal/remote"
)

const (
	commandNodeAvailability  = "node.availability"
	commandStackDeploy       = "stack.deploy"
	commandServiceRestart    = "service.restart"
	commandServiceRollback   = "service.rollback"
	commandServiceScale      = "service.scale"
	commandImageBuild        = "image.build"
	commandTraefikReconcile  = "traefik.reconcile"
	commandNodeAgent         = "observability.node-agent"
	commandLogs              = "observability.logs"
	commandObservability     = "observability.core"
	commandDatabase          = "database.set"
	commandApplicationDeploy = "application.deploy"
	commandApplicationRemove = "application.remove"
	commandHostBootstrap     = "server.bootstrap"
	commandHostSwarmJoin     = "server.swarm-join"

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

type databaseCommand struct {
	Confirmation string `json:"confirmation"`
	Enabled      bool   `json:"enabled"`
	Engine       string `json:"engine"`
}

type applicationDeployCommand struct {
	Spec ops.ApplicationSpec `json:"spec"`
}

type applicationRemoveCommand struct {
	Confirmation string `json:"confirmation"`
	Name         string `json:"name"`
}

type traefikCommand struct {
	Confirmation string `json:"confirmation"`
}

type hostBootstrapCommand struct {
	Action        string `json:"action"`
	AdvertiseAddr string `json:"advertiseAddr,omitempty"`
}

func (c hostBootstrapCommand) request() agentcontrol.BootstrapRequest {
	return agentcontrol.BootstrapRequest{Action: c.Action, AdvertiseAddr: c.AdvertiseAddr}
}

// hostSwarmJoinCommand contains only stable server identifiers. The manager
// join token is fetched at execution time and stays out of the sealed command
// payload, browser request, audit event, and command-log evidence.
type hostSwarmJoinCommand struct {
	DestinationServerID string `json:"destinationServerId"`
	ManagerServerID     string `json:"managerServerId"`
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

func (s *Server) commandLogs(response http.ResponseWriter, request *http.Request, _ auth.Claims) {
	limit, _ := strconv.Atoi(request.URL.Query().Get("limit"))
	if limit == 0 {
		limit = 200
	}
	logs, err := s.commands.Logs(request.PathValue("id"), limit)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			writeError(response, http.StatusNotFound, "Command was not found")
			return
		}
		s.commandStoreError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, logs)
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

func (s *Server) submitDatabase(response http.ResponseWriter, request *http.Request, claims auth.Claims, input databaseCommand) {
	definition, err := ops.DatabaseDefinitionFor(input.Engine)
	if err != nil {
		writeError(response, http.StatusNotFound, "Unknown managed database")
		return
	}
	if !input.Enabled && input.Confirmation != ops.DatabaseRemovalConfirmation(definition.Engine) {
		writeError(response, http.StatusUnprocessableEntity, "removal requires confirmation "+ops.DatabaseRemovalConfirmation(definition.Engine))
		return
	}
	input.Engine = definition.Engine
	s.submitCommand(response, request, claims, commandDatabase, "stack/"+definition.Stack, input, true)
}

func (s *Server) submitHostBootstrap(response http.ResponseWriter, request *http.Request, claims auth.Claims, serverID string, input agentcontrol.BootstrapRequest) {
	if input.Action == agentcontrol.BootstrapSwarmJoin {
		writeError(response, http.StatusUnprocessableEntity, "Join the selected Swarm through the dedicated managed action")
		return
	}
	if err := agentcontrol.ValidateBootstrapRequest(input); err != nil {
		writeError(response, http.StatusUnprocessableEntity, "Invalid managed bootstrap action")
		return
	}
	if _, err := s.servers.Resolve(serverID); err != nil {
		s.operationError(response, request, err)
		return
	}
	if err := s.commands.Writable(); err != nil {
		s.commandStoreError(response, request, err)
		return
	}
	if err := s.audit.Writable(); err != nil {
		s.commandStoreError(response, request, err)
		return
	}
	payload, err := json.Marshal(hostBootstrapCommand{Action: input.Action, AdvertiseAddr: input.AdvertiseAddr})
	if err != nil {
		writeError(response, http.StatusInternalServerError, "Command could not be queued")
		return
	}
	command, created, err := s.commands.Submit(queue.SubmitInput{
		Action:         commandHostBootstrap,
		Actor:          claims.Username,
		AutoRetry:      false,
		IdempotencyKey: request.Header.Get("Idempotency-Key"),
		MaxAttempts:    1,
		Payload:        payload,
		RequestID:      requestID(request),
		ServerID:       serverID,
		Target:         "server/" + serverID,
	})
	if errors.Is(err, queue.ErrIdempotencyConflict) {
		writeError(response, http.StatusConflict, "Idempotency key was already used for a different command")
		return
	}
	if err != nil {
		s.commandStoreError(response, request, err)
		return
	}
	if created {
		s.record(claims.Username, requestID(request), "command.queued", "command/"+command.ID, nil, commandAuditDetail(command))
	}
	writeJSON(response, http.StatusAccepted, command)
}

// submitManagedSwarmJoin queues a fixed join after ensuring both endpoints
// are already enrolled and connected. The selected active manager supplies a
// transient token only when the worker executes; the browser never receives
// it and no durable command payload contains it.
func (s *Server) submitManagedSwarmJoin(response http.ResponseWriter, request *http.Request, claims auth.Claims, destinationServerID string) {
	managerServerID, idempotencyKey, ok := s.commandSubmissionContext(response, request)
	if !ok {
		return
	}
	destinationServerID = strings.TrimSpace(destinationServerID)
	if destinationServerID == "" || destinationServerID == managerServerID {
		writeError(response, http.StatusUnprocessableEntity, "Select a different enrolled server to join this Swarm")
		return
	}
	target, err := s.targets.Resolve(managerServerID)
	if err != nil {
		s.operationError(response, request, err)
		return
	}
	if target.Control == nil || target.Control.Docker == nil {
		writeError(response, http.StatusConflict, "Select a connected Swarm manager before joining another server")
		return
	}
	manager, err := s.servers.Resolve(managerServerID)
	if err != nil {
		s.operationError(response, request, err)
		return
	}
	if !manager.Profile.Managed || !manager.Profile.SwarmControlAvailable || manager.Docker == nil {
		writeError(response, http.StatusConflict, "The selected server is not a managed active Swarm manager")
		return
	}
	if _, ok := manager.Runner.(remote.SwarmJoinTokenProvider); !ok {
		writeError(response, http.StatusConflict, "The selected manager cannot provide a managed join credential")
		return
	}
	destination, err := s.servers.Resolve(destinationServerID)
	if err != nil {
		s.operationError(response, request, err)
		return
	}
	if !destination.Profile.Managed || !destination.Profile.BootstrapAvailable || !destination.Profile.DockerAvailable {
		writeError(response, http.StatusConflict, "The destination must be an enrolled managed server with Docker ready")
		return
	}
	if _, ok := destination.Runner.(remote.HostBootstrapper); !ok {
		writeError(response, http.StatusConflict, "The destination does not support managed Swarm setup")
		return
	}
	payload, err := json.Marshal(hostSwarmJoinCommand{DestinationServerID: destinationServerID, ManagerServerID: managerServerID})
	if err != nil {
		writeError(response, http.StatusInternalServerError, "Managed Swarm join could not be queued")
		return
	}
	command, created, err := s.commands.Submit(queue.SubmitInput{
		Action:         commandHostSwarmJoin,
		Actor:          claims.Username,
		AutoRetry:      false,
		IdempotencyKey: idempotencyKey,
		MaxAttempts:    1,
		Payload:        payload,
		RequestID:      requestID(request),
		ServerID:       managerServerID,
		Target:         "server/" + destinationServerID + "/join-swarm",
	})
	if errors.Is(err, queue.ErrIdempotencyConflict) {
		writeError(response, http.StatusConflict, "Idempotency key was already used for a different command")
		return
	}
	if err != nil {
		s.commandStoreError(response, request, err)
		return
	}
	if created {
		s.record(claims.Username, requestID(request), "command.queued", "command/"+command.ID, nil, commandAuditDetail(command))
	}
	writeJSON(response, http.StatusAccepted, command)
}

// submitApplicationDeploy validates and renders once before queueing, so a
// spec that cannot become an admissible stack is refused with a useful message
// instead of becoming a command that will need operator attention later.
func (s *Server) submitApplicationDeploy(response http.ResponseWriter, request *http.Request, claims auth.Claims, spec ops.ApplicationSpec) {
	target, ok := s.targetFor(response, request)
	if !ok {
		return
	}
	spec = spec.Normalize()
	if _, err := target.Control.PlanApplication(request.Context(), spec); err != nil {
		writeError(response, http.StatusUnprocessableEntity, err.Error())
		return
	}
	s.submitCommand(response, request, claims, commandApplicationDeploy, "application/"+spec.Name, applicationDeployCommand{Spec: spec}, true)
}

func (s *Server) submitApplicationRemove(response http.ResponseWriter, request *http.Request, claims auth.Claims, name, confirmation string) {
	if confirmation != ops.ApplicationRemovalConfirmation(name) {
		writeError(response, http.StatusUnprocessableEntity, "removal requires confirmation "+ops.ApplicationRemovalConfirmation(name))
		return
	}
	s.submitCommand(response, request, claims, commandApplicationRemove, "application/"+name, applicationRemoveCommand{Confirmation: confirmation, Name: name}, false)
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
// lose a command that was acknowledged to the browser. Command events are
// persisted in the encrypted command store, never in the audit trail.
func (s *Server) ExecuteCommand(ctx context.Context, record queue.Record) error {
	if err := s.appendCommandLog(record.Command, "controller", "info", "Command claimed by the singleton controller."); err != nil {
		return queue.PermanentError(fmt.Errorf("persist command log: %w", err))
	}
	if record.Command.Action == commandHostBootstrap {
		return s.finishCommandExecution(record.Command, s.executeHostBootstrap(ctx, record))
	}
	if record.Command.Action == commandHostSwarmJoin {
		return s.finishCommandExecution(record.Command, s.executeManagedSwarmJoin(ctx, record))
	}
	if record.Command.Action == commandMobilityMove {
		err := s.executeMobilityMove(ctx, record)
		if errors.Is(err, queue.ErrExecutorHandoff) {
			return err
		}
		return s.finishCommandExecution(record.Command, err)
	}
	if record.Command.Action == commandMobilityRetire {
		return s.finishCommandExecution(record.Command, s.executeMobilityRetire(ctx, record))
	}
	target, err := s.targets.Resolve(record.Command.ServerID)
	if err != nil {
		_ = s.appendCommandLog(record.Command, "controller", "error", "The selected server could not be resolved. No mutation was started.")
		return err
	}
	if target.Control == nil {
		_ = s.appendCommandLog(record.Command, "controller", "error", "The selected server has no compatible control-plane capability.")
		return queue.PermanentError(fmt.Errorf("selected server has no control plane"))
	}
	var logErr error
	target.Control.SetCommandOutput(func(output string) {
		if logErr != nil {
			return
		}
		logErr = s.appendCommandLog(record.Command, "machine", "info", output)
	})
	if err := s.appendCommandLog(record.Command, "controller", "info", "Connected target resolved; starting the fixed reviewed operation."); err != nil {
		return queue.PermanentError(fmt.Errorf("persist command log: %w", err))
	}
	err = s.executeCommand(ctx, record, target)
	if logErr != nil {
		// The remote effect may have completed, but the evidence could not be
		// retained. Treat it as uncertain rather than reporting success.
		return queue.PermanentError(fmt.Errorf("persist machine command output: %w", logErr))
	}
	return s.finishCommandExecution(record.Command, err)
}

func (s *Server) executeHostBootstrap(ctx context.Context, record queue.Record) error {
	var input hostBootstrapCommand
	if err := decodeCommandPayload(record.Payload, &input); err != nil {
		return queue.PermanentError(err)
	}
	connection, err := s.servers.Resolve(record.Command.ServerID)
	if err != nil {
		return err
	}
	bootstrapper, ok := connection.Runner.(remote.HostBootstrapper)
	if !ok {
		return queue.PermanentError(fmt.Errorf("selected server does not support managed bootstrap"))
	}
	if err := s.appendCommandLog(record.Command, "controller", "info", "Managed host bootstrap was authorised after enrollment; starting the fixed action."); err != nil {
		return queue.PermanentError(fmt.Errorf("persist command log: %w", err))
	}
	output, err := bootstrapper.Bootstrap(ctx, input.request())
	if output != "" {
		if logErr := s.appendCommandLog(record.Command, "machine", "info", output); logErr != nil {
			return queue.PermanentError(fmt.Errorf("persist machine bootstrap output: %w", logErr))
		}
	}
	if err == nil {
		if refreshErr := s.refreshManagedServerStatus(ctx, record.Command, record.Command.ServerID); refreshErr != nil {
			return refreshErr
		}
	}
	return classifyCommandError(err)
}

func (s *Server) executeManagedSwarmJoin(ctx context.Context, record queue.Record) error {
	var input hostSwarmJoinCommand
	if err := decodeCommandPayload(record.Payload, &input); err != nil {
		return queue.PermanentError(err)
	}
	if strings.TrimSpace(input.ManagerServerID) == "" || input.ManagerServerID != record.Command.ServerID || strings.TrimSpace(input.DestinationServerID) == "" || input.DestinationServerID == input.ManagerServerID {
		return queue.PermanentError(fmt.Errorf("managed Swarm join payload is invalid"))
	}
	manager, err := s.servers.Resolve(input.ManagerServerID)
	if err != nil {
		return err
	}
	if !manager.Profile.Managed || manager.Docker == nil {
		return queue.PermanentError(fmt.Errorf("selected manager is not an enrolled active Swarm manager"))
	}
	provider, ok := manager.Runner.(remote.SwarmJoinTokenProvider)
	if !ok {
		return queue.PermanentError(fmt.Errorf("selected manager does not support managed Swarm join"))
	}
	managerAddress, err := managedSwarmManagerAddress(ctx, manager.Docker)
	if err != nil {
		return classifyCommandError(err)
	}
	destination, err := s.servers.Resolve(input.DestinationServerID)
	if err != nil {
		return err
	}
	if !destination.Profile.Managed || !destination.Profile.BootstrapAvailable || !destination.Profile.DockerAvailable {
		return queue.PermanentError(fmt.Errorf("destination is not ready for managed Swarm join"))
	}
	bootstrapper, ok := destination.Runner.(remote.HostBootstrapper)
	if !ok {
		return queue.PermanentError(fmt.Errorf("destination does not support managed Swarm setup"))
	}
	if err := s.appendCommandLog(record.Command, "controller", "info", "The selected manager is issuing a short-lived join credential directly to the enrolled destination agent."); err != nil {
		return queue.PermanentError(fmt.Errorf("persist command log: %w", err))
	}
	token, err := provider.ManagerJoinToken(ctx)
	if err != nil {
		return classifyCommandError(err)
	}
	defer func() { token = "" }()
	output, err := bootstrapper.Bootstrap(ctx, agentcontrol.BootstrapRequest{Action: agentcontrol.BootstrapSwarmJoin, JoinToken: token, ManagerAddr: managerAddress})
	if output != "" {
		if logErr := s.appendCommandLog(record.Command, "machine", "info", output); logErr != nil {
			return queue.PermanentError(fmt.Errorf("persist managed Swarm join output: %w", logErr))
		}
	}
	if err == nil {
		if refreshErr := s.refreshManagedServerStatus(ctx, record.Command, input.DestinationServerID); refreshErr != nil {
			return refreshErr
		}
	}
	return classifyCommandError(err)
}

// refreshManagedServerStatus updates the persisted card after a fixed host
// action. A status refresh failure does not change the completed host action;
// the encrypted command evidence instead tells the operator to use the normal
// Servers refresh if the agent has not yet observed Docker or Swarm readiness.
func (s *Server) refreshManagedServerStatus(ctx context.Context, command domain.Command, serverID string) error {
	if _, err := s.servers.Refresh(ctx, serverID); err != nil {
		if logErr := s.appendCommandLog(command, "controller", "warning", "The host action completed, but its current Docker or Swarm status could not be refreshed. Use Servers refresh after the host is ready."); logErr != nil {
			return queue.PermanentError(fmt.Errorf("persist host refresh warning: %w", logErr))
		}
		return nil
	}
	if err := s.appendCommandLog(command, "controller", "info", "The managed server status was refreshed after the fixed host action."); err != nil {
		return queue.PermanentError(fmt.Errorf("persist host refresh evidence: %w", err))
	}
	return nil
}

func managedSwarmManagerAddress(ctx context.Context, docker *dockerapi.Client) (string, error) {
	if docker == nil {
		return "", fmt.Errorf("selected manager Docker Engine is unavailable")
	}
	info, err := docker.Info(ctx)
	if err != nil {
		return "", fmt.Errorf("read selected manager Swarm identity: %w", err)
	}
	if !info.Swarm.ControlAvailable || !strings.EqualFold(info.Swarm.LocalNodeState, "active") || strings.TrimSpace(info.Swarm.NodeID) == "" {
		return "", fmt.Errorf("selected server is not an active Swarm manager")
	}
	nodes, err := docker.ListNodes(ctx)
	if err != nil {
		return "", fmt.Errorf("read selected manager node: %w", err)
	}
	for _, node := range nodes {
		if node.ID != info.Swarm.NodeID || node.ManagerStatus == nil || strings.TrimSpace(node.ManagerStatus.Addr) == "" {
			continue
		}
		candidate := strings.TrimSpace(node.ManagerStatus.Addr)
		if err := agentcontrol.ValidateBootstrapRequest(agentcontrol.BootstrapRequest{Action: agentcontrol.BootstrapSwarmJoin, JoinToken: "SWMTKN-1-abcdefgh-abcdefghijklmnop", ManagerAddr: candidate}); err != nil {
			return "", fmt.Errorf("selected manager has an invalid Swarm advertise address")
		}
		return candidate, nil
	}
	return "", fmt.Errorf("selected manager has no reachable Swarm manager address")
}

func (s *Server) finishCommandExecution(command domain.Command, err error) error {
	if err != nil {
		if logErr := s.appendCommandLog(command, "controller", "error", "The operation did not complete. SwarmOps preserved this command for operator review."); logErr != nil {
			return queue.PermanentError(fmt.Errorf("persist command log: %w", logErr))
		}
		return err
	}
	if logErr := s.appendCommandLog(command, "controller", "info", "The reviewed operation returned successfully."); logErr != nil {
		return queue.PermanentError(fmt.Errorf("persist command log: %w", logErr))
	}
	return nil
}

func (s *Server) executeCommand(ctx context.Context, record queue.Record, target Target) error {
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
		if err := s.appendCommandLog(record.Command, "controller", "info", "Build input is streaming to the selected Docker API; raw build output is intentionally not retained."); err != nil {
			return queue.PermanentError(fmt.Errorf("persist command log: %w", err))
		}
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
	case commandDatabase:
		var input databaseCommand
		if err := decodeCommandPayload(record.Payload, &input); err != nil {
			return queue.PermanentError(err)
		}
		return classifyCommandError(target.Control.SetDatabase(ctx, record.Command.Actor, record.Command.RequestID, input.Engine, input.Enabled, input.Confirmation))
	case commandApplicationDeploy:
		var input applicationDeployCommand
		if err := decodeCommandPayload(record.Payload, &input); err != nil {
			return queue.PermanentError(err)
		}
		return classifyCommandError(target.Control.DeployApplication(ctx, record.Command.Actor, record.Command.RequestID, input.Spec))
	case commandApplicationRemove:
		var input applicationRemoveCommand
		if err := decodeCommandPayload(record.Payload, &input); err != nil {
			return queue.PermanentError(err)
		}
		return classifyCommandError(target.Control.RemoveApplication(ctx, record.Command.Actor, record.Command.RequestID, input.Name, input.Confirmation))
	default:
		return queue.PermanentError(fmt.Errorf("unsupported queued command"))
	}
}

func (s *Server) appendCommandLog(command domain.Command, source, level, message string) error {
	_, err := s.commands.AppendLog(command.ID, queue.LogInput{
		Attempt: command.Attempt,
		Level:   level,
		Message: message,
		Source:  source,
	})
	return err
}

// CommandExecutionTimeout keeps source builds bounded while giving the
// Docker API its documented 30-minute build window. All other fixed-shape
// cluster mutations retain the worker's short default timeout.
func (s *Server) CommandExecutionTimeout(command domain.Command) time.Duration {
	if command.Action == commandImageBuild {
		return 35 * time.Minute
	}
	if command.Action == commandMobilityMove || command.Action == commandMobilityRetire {
		return 4 * time.Hour
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

// classifyCommandError decides whether a failed execution may be retried.
// An explicitly permanent outcome always wins; the marker scan only classifies
// errors that the ops layer did not already type, and its markers are all
// locally generated policy phrases rather than remote error text.
func classifyCommandError(err error) error {
	if err == nil {
		return nil
	}
	if queue.IsPermanent(err) {
		return err
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
