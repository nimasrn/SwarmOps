package apihttp

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/nimasrn/SwarmOps/internal/agentcontrol"
	"github.com/nimasrn/SwarmOps/internal/auth"
	"github.com/nimasrn/SwarmOps/internal/build"
	"github.com/nimasrn/SwarmOps/internal/domain"
	"github.com/nimasrn/SwarmOps/internal/ops"
	"github.com/nimasrn/SwarmOps/internal/queue"
	"github.com/nimasrn/SwarmOps/internal/source"
	"golang.org/x/crypto/bcrypt"
)

const (
	commandNodeAvailability     = "node.availability"
	commandStackDeploy          = "stack.deploy"
	commandServiceRestart       = "service.restart"
	commandServiceRollback      = "service.rollback"
	commandServiceScale         = "service.scale"
	commandImageBuild           = "image.build"
	commandTraefikReconcile     = "traefik.reconcile"
	commandTraefikPrerequisites = "traefik.prerequisites.repair"
	commandNodeAgent            = "observability.node-agent"
	commandLogs                 = "observability.logs"
	commandObservability        = "observability.core"
	commandDatabase             = "database.set"
	commandApplicationDeploy    = "application.deploy"
	commandApplicationDomain    = "application.domain"
	commandApplicationRemove    = "application.remove"
	commandSourceDeploy         = "source.deploy"
	commandServerReadiness      = "server.readiness"

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

type applicationDomainCommand struct {
	Confirmation string `json:"confirmation,omitempty"`
	Domain       string `json:"domain,omitempty"`
	Name         string `json:"name"`
	Resolver     string `json:"resolver,omitempty"`
}

type sourceDeployCommand struct {
	Build        *build.Request      `json:"build,omitempty"`
	PlanID       string              `json:"planId"`
	RepositoryID string              `json:"repositoryId"`
	Revision     string              `json:"revision"`
	Service      string              `json:"service"`
	SharedStacks []string            `json:"sharedStacks,omitempty"`
	Spec         ops.ApplicationSpec `json:"spec"`
}

type traefikCommand struct {
	Confirmation  string `json:"confirmation"`
	DashboardHost string `json:"dashboardHost"`
}

type traefikPrerequisiteResponse struct {
	Command           domain.Command `json:"command"`
	DashboardPassword string         `json:"dashboardPassword,omitempty"`
	DashboardUsername string         `json:"dashboardUsername,omitempty"`
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
	if !s.remoteMutationsEnabled(response) {
		return
	}
	command, err := s.commands.RetryNow(request.PathValue("id"), s.core.AuthorityEpoch())
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
		Enabled:       s.effectiveSourceSettings().BuildEnabled,
		ImagePrefixes: s.sourceImagePrefixes(),
		MaxCPUs:       s.config.BuildMaxCPUs,
		MaxMemoryMiB:  s.config.BuildMaxMemoryMiB,
		RegistryAuth:  s.sourceRegistryAuth(),
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
	submission, err := s.commands.SubmitArtifactWithResult(queue.SubmitInput{
		Action:           commandImageBuild,
		Actor:            claims.Username,
		AuthorityEpoch:   s.core.AuthorityEpoch(),
		AutoRetry:        false,
		ClusterID:        "default",
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
	if err != nil && submission.Command.ID == "" {
		s.commandStoreError(response, request, err)
		return
	}
	s.recordCommandSubmission(claims, request, submission)
	// A streaming source failure still leaves a durable, visible attention
	// record. Do not replace it with an opaque error response: the operator
	// must be able to see that no build ran and submit a new archive safely.
	writeJSON(response, http.StatusAccepted, submission.Command)
}

func (s *Server) submitTraefik(response http.ResponseWriter, request *http.Request, claims auth.Claims, confirmation, dashboardHost string) {
	if confirmation != "DEPLOY_TRAEFIK" {
		writeError(response, http.StatusUnprocessableEntity, "deployment requires confirmation DEPLOY_TRAEFIK")
		return
	}
	s.submitCommand(response, request, claims, commandTraefikReconcile, "stack/traefik", traefikCommand{Confirmation: confirmation, DashboardHost: dashboardHost}, true)
}

func (s *Server) submitTraefikPrerequisites(response http.ResponseWriter, request *http.Request, claims auth.Claims, repair ops.TraefikPrerequisiteRepair, username, password string) {
	serverID, idempotencyKey, ok := s.commandSubmissionContext(response, request)
	if !ok {
		return
	}
	payload, err := json.Marshal(repair)
	if err != nil {
		writeError(response, http.StatusInternalServerError, "Prerequisite repair could not be queued")
		return
	}
	submission, err := s.commands.SubmitWithResult(queue.SubmitInput{
		Action: commandTraefikPrerequisites, Actor: claims.Username, AuthorityEpoch: s.core.AuthorityEpoch(),
		AutoRetry: true, ClusterID: "default", IdempotencyKey: idempotencyKey, MaxAttempts: maxAutomaticAttempts,
		Payload: payload, RequestID: requestID(request), ServerID: serverID, Target: "stack/traefik",
	})
	if err != nil {
		if errors.Is(err, queue.ErrIdempotencyConflict) {
			writeError(response, http.StatusConflict, "Idempotency key was already used for a different command")
			return
		}
		s.commandStoreError(response, request, err)
		return
	}
	s.recordCommandSubmission(claims, request, submission)
	writeJSON(response, http.StatusAccepted, traefikPrerequisiteResponse{Command: submission.Command, DashboardUsername: username, DashboardPassword: password})
}

func generateDashboardCredential() (password, htpasswd string, err error) {
	raw := make([]byte, 24)
	if _, err = rand.Read(raw); err != nil {
		return "", "", fmt.Errorf("generate dashboard password")
	}
	password = base64.RawURLEncoding.EncodeToString(raw)
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", "", fmt.Errorf("hash dashboard password")
	}
	return password, "operator:" + string(hash), nil
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

func (s *Server) submitApplicationDomain(response http.ResponseWriter, request *http.Request, claims auth.Claims, input applicationDomainCommand) {
	target, ok := s.targetFor(response, request)
	if !ok {
		return
	}
	current, found := target.Control.Apps.Get(input.Name)
	if !found {
		writeError(response, http.StatusNotFound, "Application was not found")
		return
	}
	input.Domain = strings.ToLower(strings.TrimSuffix(strings.TrimSpace(input.Domain), "."))
	input.Resolver = strings.TrimSpace(input.Resolver)
	if input.Domain == "" {
		if input.Confirmation != ops.ApplicationDomainRemovalConfirmation(current.Name) {
			writeError(response, http.StatusUnprocessableEntity, "domain removal requires confirmation "+ops.ApplicationDomainRemovalConfirmation(current.Name))
			return
		}
		input.Resolver = ""
	}
	updated := current
	updated.Domain = input.Domain
	updated.Resolver = input.Resolver
	if _, err := target.Control.PlanApplication(request.Context(), updated); err != nil {
		writeError(response, http.StatusUnprocessableEntity, err.Error())
		return
	}
	s.submitCommand(response, request, claims, commandApplicationDomain, "application/"+current.Name+"/domain", input, true)
}

func (s *Server) submitSourceDeploy(response http.ResponseWriter, request *http.Request, claims auth.Claims, selection source.Selection, requested ops.ApplicationSpec) {
	if !s.requireSource(response) {
		return
	}
	target, ok := s.targetFor(response, request)
	if !ok {
		return
	}
	serverID, idempotencyKey, ok := s.commandSubmissionContext(response, request)
	if !ok {
		return
	}
	plan, candidate, contextReader, err := s.sources.PrepareDeployment(request.Context(), selection)
	if err != nil {
		s.sourceRequestError(response, err)
		return
	}
	if contextReader != nil {
		defer contextReader.Close()
	}
	spec, sharedStacks := sourceApplicationSpec(requested, candidate)
	if _, err := target.Control.PlanApplication(request.Context(), spec); err != nil {
		writeError(response, http.StatusUnprocessableEntity, err.Error())
		return
	}
	commandInput := sourceDeployCommand{
		PlanID:       plan.ID,
		RepositoryID: plan.Repository.ID,
		Revision:     plan.Revision.SHA,
		Service:      candidate.Service,
		SharedStacks: sharedStacks,
		Spec:         spec,
	}
	if candidate.Build != nil && candidate.Build.Required {
		validation := build.Service{
			Enabled:       s.effectiveSourceSettings().BuildEnabled,
			ImagePrefixes: s.sourceImagePrefixes(),
			MaxCPUs:       s.config.BuildMaxCPUs,
			MaxMemoryMiB:  s.config.BuildMaxMemoryMiB,
			RegistryAuth:  s.sourceRegistryAuth(),
		}
		buildRequest, err := validation.Validate(build.Request{
			CPUs:       spec.CPUs,
			Dockerfile: candidate.Build.DockerfilePath,
			Image:      candidate.Build.Image,
			MemoryMiB:  spec.MemoryMiB,
			Push:       true,
		})
		if err != nil {
			writeError(response, http.StatusUnprocessableEntity, err.Error())
			return
		}
		commandInput.Build = &buildRequest
	}
	payload, err := json.Marshal(commandInput)
	if err != nil {
		writeError(response, http.StatusInternalServerError, "Command could not be queued")
		return
	}
	submit := queue.SubmitInput{
		Action:         commandSourceDeploy,
		Actor:          claims.Username,
		AuthorityEpoch: s.core.AuthorityEpoch(),
		AutoRetry:      false,
		ClusterID:      "default",
		IdempotencyKey: idempotencyKey,
		MaxAttempts:    1,
		Payload:        payload,
		RequestID:      requestID(request),
		ServerID:       serverID,
		Target:         "application/" + spec.Name,
	}
	var submission queue.Submission
	if commandInput.Build != nil {
		submission, err = s.commands.SubmitArtifactWithResult(queue.SubmitInput{
			Action:           submit.Action,
			Actor:            submit.Actor,
			AuthorityEpoch:   submit.AuthorityEpoch,
			AutoRetry:        submit.AutoRetry,
			ClusterID:        submit.ClusterID,
			IdempotencyKey:   submit.IdempotencyKey,
			MaxArtifactBytes: s.config.BuildMaxBytes,
			MaxAttempts:      submit.MaxAttempts,
			Payload:          submit.Payload,
			RequestID:        submit.RequestID,
			ServerID:         submit.ServerID,
			Target:           submit.Target,
		}, contextReader)
	} else {
		submission, err = s.commands.SubmitWithResult(submit)
	}
	if errors.Is(err, queue.ErrIdempotencyConflict) {
		writeError(response, http.StatusConflict, "Idempotency key was already used for a different command")
		return
	}
	if err != nil && submission.Command.ID == "" {
		s.commandStoreError(response, request, err)
		return
	}
	s.recordCommandSubmission(claims, request, submission)
	writeJSON(response, http.StatusAccepted, submission.Command)
}

// sourceApplicationSpec merges what the operator reviewed with what the
// scanner found. The operator's own choices — the slot, the domain, the
// resolver — always win; everything the operator did not state is taken from
// the repository rather than from a default, because a default that
// contradicts the repository is how an application reaches production with the
// wrong port, no metrics, and a database it cannot read.
func sourceApplicationSpec(requested ops.ApplicationSpec, candidate source.ServicePlan) (ops.ApplicationSpec, []string) {
	spec := requested
	if spec.Name == "" {
		spec.Name = candidate.Name
	}
	spec.Image = candidate.Image
	spec.Databases = append([]string(nil), candidate.Databases...)
	spec.DatabaseDelivery = ops.DeliverySecret
	spec.Metrics = candidate.Metrics
	spec.Tracing = candidate.Tracing
	if candidate.Port != 0 {
		spec.Port = candidate.Port
	}
	if spec.HealthPath == "" {
		spec.HealthPath = candidate.HealthPath
	}
	if spec.MetricsPath == "" {
		spec.MetricsPath = candidate.Telemetry.MetricsPath
	}
	// Replicas and the resource ceiling are read from the Compose deploy block
	// when the operator did not choose them. Platform admission still checks
	// them against the reviewed slot, so importing them can widen nothing.
	if spec.Replicas == 0 && candidate.Replicas > 0 {
		spec.Replicas = candidate.Replicas
	}
	if spec.CPUs == 0 && candidate.CPUs > 0 {
		spec.CPUs = candidate.CPUs
	}
	if spec.MemoryMiB == 0 && candidate.MemoryMiB > 0 {
		spec.MemoryMiB = candidate.MemoryMiB
	}
	// The route the repository already declares becomes the route SwarmOps
	// creates, unless the operator named a domain themselves.
	if spec.Domain == "" && candidate.Route != nil && len(candidate.Route.Hosts) > 0 {
		spec.Domain = candidate.Route.Hosts[0]
		if spec.Resolver == "" {
			spec.Resolver = candidate.Route.Resolver
		}
	}
	// Delivering the connection URI under the names the application actually
	// reads is the whole point of discovering them, and a mounted file is not
	// something an application that reads DATABASE_URL will ever look at. The
	// credential is this application's own least-privilege account, so putting
	// it in the service environment exposes that account and nothing else.
	spec.DatabaseEnv = map[string][]string{}
	for _, requirement := range candidate.DatabaseRequirements {
		if len(requirement.EnvVars) > 0 {
			spec.DatabaseEnv[requirement.Engine] = append([]string(nil), requirement.EnvVars...)
			spec.DatabaseDelivery = ops.DeliveryEnv
		}
	}
	if len(spec.DatabaseEnv) == 0 {
		spec.DatabaseEnv = nil
	}
	spec = spec.Normalize()
	sharedStacks := append([]string(nil), candidate.SharedStacks...)
	if spec.Metrics || spec.Tracing {
		sharedStacks = append(sharedStacks, "swarmops-observability")
	}
	return spec, sortedCommandStrings(sharedStacks)
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
	submission, err := s.commands.SubmitWithResult(queue.SubmitInput{
		Action:         action,
		Actor:          claims.Username,
		AuthorityEpoch: s.core.AuthorityEpoch(),
		AutoRetry:      autoRetry,
		ClusterID:      "default",
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
	s.recordCommandSubmission(claims, request, submission)
	writeJSON(response, http.StatusAccepted, submission.Command)
}

func (s *Server) commandSubmissionContext(response http.ResponseWriter, request *http.Request) (string, string, bool) {
	if !s.remoteMutationsEnabled(response) {
		return "", "", false
	}
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
	if strings.TrimSpace(request.Header.Get("X-SwarmOps-Cluster-ID")) != "default" {
		writeError(response, http.StatusConflict, "X-SwarmOps-Cluster-ID must explicitly select the v1 cluster as default")
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

// remoteMutationsEnabled is the admission boundary for every command that can
// reach a machine agent. Commands must not be written to the durable ledger
// while remote mutation is disabled: a later configuration change must never
// turn previously rejected browser intent into executable work.
func (s *Server) remoteMutationsEnabled(response http.ResponseWriter) bool {
	if s.config.MutationEnabled {
		return true
	}
	writeError(response, http.StatusForbidden, "Remote mutations are disabled on this control plane")
	return false
}

func (s *Server) recordCommandSubmission(claims auth.Claims, request *http.Request, submission queue.Submission) {
	if submission.Created {
		s.record(claims.Username, requestID(request), "command.queued", "command/"+submission.Command.ID, nil, commandAuditDetail(submission.Command))
	}
	for _, superseded := range submission.Superseded {
		s.record(claims.Username, requestID(request), "command.superseded", "command/"+superseded.ID, nil, commandAuditDetail(superseded))
	}
}

// swarmJoinGrant asks a manager for the credential a joining node needs.
//
// A missing or unreachable manager is a RETRYABLE failure: the token is not
// gone, the manager is momentarily out of reach, and a bootstrap that gives up
// because one poll was late is worse than one that waits.
func (s *Server) swarmJoinGrant(ctx context.Context, managerID, role string) (agentcontrol.SwarmJoinToken, error) {
	if !agentcontrol.ValidJoinRole(role) {
		return agentcontrol.SwarmJoinToken{}, queue.PermanentError(fmt.Errorf("invalid Swarm join role"))
	}
	manager, err := s.targets.Resolve(managerID)
	if err != nil {
		return agentcontrol.SwarmJoinToken{}, fmt.Errorf("resolve the Swarm manager to join: %w", err)
	}
	if manager.Joiner == nil {
		return agentcontrol.SwarmJoinToken{}, queue.PermanentError(fmt.Errorf("the selected Swarm manager cannot issue a join token"))
	}
	grant, err := manager.Joiner.SwarmJoinToken(ctx, role)
	if err != nil {
		return agentcontrol.SwarmJoinToken{}, fmt.Errorf("read the Swarm join token: %w", err)
	}
	return grant, nil
}

// ExecuteCommand is called only by the singleton worker. Payload decoding and
// target resolution occur after durable claiming, so an API restart cannot
// lose a command that was acknowledged to the browser.
func (s *Server) ExecuteCommand(ctx context.Context, record queue.Record) error {
	if !s.CanExecuteCommands() {
		return queue.PermanentError(fmt.Errorf("control-plane replica is standby before command execution"))
	}
	target, err := s.targets.Resolve(record.Command.ServerID)
	if err != nil {
		return err
	}
	if record.Command.Action == commandServerReadiness {
		var input serverReadinessCommand
		if err := decodeCommandPayload(record.Payload, &input); err != nil {
			return queue.PermanentError(err)
		}
		if target.Provisioner == nil {
			return queue.PermanentError(fmt.Errorf("selected server has no machine provisioning agent"))
		}
		plan := input.ProvisioningRequest
		if plan.JoinSwarm {
			// The join credential is read HERE, from the manager the operator
			// named, at the moment the command runs — not when it was queued.
			// That is what keeps it out of the sealed payload, the audit
			// record, and every browser response, and it also means a token
			// rotated between queueing and execution is the one that is used.
			grant, err := s.swarmJoinGrant(ctx, input.JoinFromServerID, input.JoinRole)
			if err != nil {
				return err
			}
			plan.JoinAddress, plan.JoinToken = grant.Address, grant.Token
			defer func() { plan.JoinToken = "" }()
		}
		if err := plan.Validate(); err != nil {
			return queue.PermanentError(err)
		}
		return queue.PermanentError(target.Provisioner.Provision(ctx, plan))
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
		return classifyCommandError(target.Control.InstallTraefik(ctx, record.Command.Actor, record.Command.RequestID, input.DashboardHost, input.Confirmation))
	case commandTraefikPrerequisites:
		var input ops.TraefikPrerequisiteRepair
		if err := decodeCommandPayload(record.Payload, &input); err != nil {
			return queue.PermanentError(err)
		}
		return classifyCommandError(target.Control.RepairTraefikPrerequisites(ctx, record.Command.Actor, record.Command.RequestID, input))
	case commandTraefikRouteApply:
		var input traefikRouteCommand
		if err := decodeCommandPayload(record.Payload, &input); err != nil {
			return queue.PermanentError(err)
		}
		return classifyCommandError(target.Control.ApplyRoute(ctx, record.Command.Actor, record.Command.RequestID, input.Route, input.Confirmation))
	case commandTraefikServiceRole:
		var input traefikServiceRoleCommand
		if err := decodeCommandPayload(record.Payload, &input); err != nil {
			return queue.PermanentError(err)
		}
		return classifyCommandError(target.Control.DeclareServiceRouteRole(record.Command.Actor, record.Command.RequestID, input.Declaration))
	case commandTraefikBindingApply:
		var input traefikBindingCommand
		if err := decodeCommandPayload(record.Payload, &input); err != nil {
			return queue.PermanentError(err)
		}
		return classifyCommandError(target.Control.ApplyDependencyBinding(ctx, record.Command.Actor, record.Command.RequestID, input.Binding))
	case commandTraefikSettingsApply:
		var input traefikSettingsCommand
		if err := decodeCommandPayload(record.Payload, &input); err != nil {
			return queue.PermanentError(err)
		}
		return classifyCommandError(target.Control.ApplyTraefikSettings(ctx, record.Command.Actor, record.Command.RequestID, input.Settings, input.Confirmation))
	case commandTraefikDNSCredential:
		var input traefikDNSCredentialCommand
		if err := decodeCommandPayload(record.Payload, &input); err != nil {
			return queue.PermanentError(err)
		}
		artifact, err := s.commands.Artifact(record.Command.ID)
		if err != nil {
			return queue.PermanentError(fmt.Errorf("DNS credential input is unavailable"))
		}
		defer artifact.Close()
		identity := ops.DNSCredentialIdentity{AccountID: input.AccountID, Email: input.Email}
		_, err = target.Control.InstallDNSCredential(ctx, record.Command.Actor, record.Command.RequestID, input.ID, input.Name, input.Provider, identity, artifact)
		return classifyCommandError(err)
	case commandTraefikDNSCredentialRemove:
		var input traefikDNSCredentialRemoveCommand
		if err := decodeCommandPayload(record.Payload, &input); err != nil {
			return queue.PermanentError(err)
		}
		return classifyCommandError(target.Control.RemoveDNSCredentialVersion(ctx, record.Command.Actor, record.Command.RequestID, input.ID, input.Version, input.Confirmation))
	case commandTraefikDomainRegister:
		var input traefikDomainCommand
		if err := decodeCommandPayload(record.Payload, &input); err != nil {
			return queue.PermanentError(err)
		}
		return classifyCommandError(target.Control.RegisterDomain(record.Command.Actor, record.Command.RequestID, input.Domain))
	case commandTraefikDomainRemove:
		var input traefikDomainRemoveCommand
		if err := decodeCommandPayload(record.Payload, &input); err != nil {
			return queue.PermanentError(err)
		}
		return classifyCommandError(target.Control.RemoveDomain(record.Command.Actor, record.Command.RequestID, input.Zone, input.Confirmation))
	case commandTraefikDNSRecordApply:
		var input traefikDNSRecordCommand
		if err := decodeCommandPayload(record.Payload, &input); err != nil {
			return queue.PermanentError(err)
		}
		_, err := target.Control.ApplyDNSRecord(ctx, record.Command.Actor, record.Command.RequestID, input.Record, input.Protocol)
		return classifyCommandError(err)
	case commandTraefikDNSRecordDelete:
		var input traefikDNSRecordDeleteCommand
		if err := decodeCommandPayload(record.Payload, &input); err != nil {
			return queue.PermanentError(err)
		}
		return classifyCommandError(target.Control.DeleteDNSRecord(ctx, record.Command.Actor, record.Command.RequestID, input.ID, input.Confirmation))
	case commandTraefikCertificateRetry:
		var input traefikCertificateRetryCommand
		if err := decodeCommandPayload(record.Payload, &input); err != nil {
			return queue.PermanentError(err)
		}
		_, err := target.Control.RetryCertificate(ctx, record.Command.Actor, record.Command.RequestID, input.RouteKey)
		return classifyCommandError(err)
	case commandCoreConsolePublish:
		var input coreConsoleCommand
		if err := decodeCommandPayload(record.Payload, &input); err != nil {
			return queue.PermanentError(err)
		}
		return classifyCommandError(target.Control.PublishCoreConsole(ctx, record.Command.Actor, record.Command.RequestID, input.Request))
	case commandTraefikCutover:
		var input traefikCutoverCommand
		if err := decodeCommandPayload(record.Payload, &input); err != nil {
			return queue.PermanentError(err)
		}
		return classifyCommandError(target.Control.ApplyClusterCutover(ctx, record.Command.Actor, record.Command.RequestID, input.Confirmation))
	case commandNodeRole:
		var input nodeRoleCommand
		if err := decodeCommandPayload(record.Payload, &input); err != nil {
			return queue.PermanentError(err)
		}
		return classifyCommandError(target.Control.SetNodeRole(ctx, record.Command.Actor, record.Command.RequestID, input.NodeID, input.Role))
	case commandNodeLabel:
		var input nodeLabelCommand
		if err := decodeCommandPayload(record.Payload, &input); err != nil {
			return queue.PermanentError(err)
		}
		return classifyCommandError(target.Control.SetNodeLabel(ctx, record.Command.Actor, record.Command.RequestID, input.NodeID, input.Key, input.Value))
	case commandNodeRemove:
		var input nodeRemoveCommand
		if err := decodeCommandPayload(record.Payload, &input); err != nil {
			return queue.PermanentError(err)
		}
		return classifyCommandError(target.Control.RemoveNode(ctx, record.Command.Actor, record.Command.RequestID, input.NodeID, input.Confirmation))
	case commandServiceImage:
		var input serviceImageCommand
		if err := decodeCommandPayload(record.Payload, &input); err != nil {
			return queue.PermanentError(err)
		}
		return classifyCommandError(target.Control.UpdateServiceImage(ctx, record.Command.Actor, record.Command.RequestID, input.ServiceID, input.Image))
	case commandServiceLimits:
		var input serviceLimitsCommand
		if err := decodeCommandPayload(record.Payload, &input); err != nil {
			return queue.PermanentError(err)
		}
		return classifyCommandError(target.Control.UpdateServiceLimits(ctx, record.Command.Actor, record.Command.RequestID, input.ServiceID, input.CPUs, input.Memory))
	case commandServiceRemove:
		var input serviceRemoveCommand
		if err := decodeCommandPayload(record.Payload, &input); err != nil {
			return queue.PermanentError(err)
		}
		return classifyCommandError(target.Control.RemoveService(ctx, record.Command.Actor, record.Command.RequestID, input.ServiceID, input.Confirmation))
	case commandStackRemove:
		var input stackRemoveCommand
		if err := decodeCommandPayload(record.Payload, &input); err != nil {
			return queue.PermanentError(err)
		}
		return classifyCommandError(target.Control.RemoveStack(ctx, record.Command.Actor, record.Command.RequestID, input.Name, input.Confirmation))
	case commandContainerAction:
		var input containerActionCommand
		if err := decodeCommandPayload(record.Payload, &input); err != nil {
			return queue.PermanentError(err)
		}
		return classifyCommandError(target.Control.ContainerAction(ctx, record.Command.Actor, record.Command.RequestID, input.ContainerID, input.Action, input.Confirmation))
	case commandImagePull:
		var input imageCommand
		if err := decodeCommandPayload(record.Payload, &input); err != nil {
			return queue.PermanentError(err)
		}
		return classifyCommandError(target.Control.PullImage(ctx, record.Command.Actor, record.Command.RequestID, input.Image))
	case commandImageRemove:
		var input imageCommand
		if err := decodeCommandPayload(record.Payload, &input); err != nil {
			return queue.PermanentError(err)
		}
		return classifyCommandError(target.Control.RemoveImage(ctx, record.Command.Actor, record.Command.RequestID, input.Image))
	case commandNetworkCreate:
		var input networkCreateCommand
		if err := decodeCommandPayload(record.Payload, &input); err != nil {
			return queue.PermanentError(err)
		}
		return classifyCommandError(target.Control.CreateNetwork(ctx, record.Command.Actor, record.Command.RequestID, input.Name, input.Driver, input.Attachable, input.Internal))
	case commandNetworkRemove:
		var input namedRemoveCommand
		if err := decodeCommandPayload(record.Payload, &input); err != nil {
			return queue.PermanentError(err)
		}
		return classifyCommandError(target.Control.RemoveNetwork(ctx, record.Command.Actor, record.Command.RequestID, input.Name, input.Confirmation))
	case commandVolumeCreate:
		var input namedRemoveCommand
		if err := decodeCommandPayload(record.Payload, &input); err != nil {
			return queue.PermanentError(err)
		}
		return classifyCommandError(target.Control.CreateVolume(ctx, record.Command.Actor, record.Command.RequestID, input.Name))
	case commandVolumeRemove:
		var input namedRemoveCommand
		if err := decodeCommandPayload(record.Payload, &input); err != nil {
			return queue.PermanentError(err)
		}
		return classifyCommandError(target.Control.RemoveVolume(ctx, record.Command.Actor, record.Command.RequestID, input.Name, input.Confirmation))
	case commandConfigRemove:
		var input namedRemoveCommand
		if err := decodeCommandPayload(record.Payload, &input); err != nil {
			return queue.PermanentError(err)
		}
		return classifyCommandError(target.Control.RemoveConfig(ctx, record.Command.Actor, record.Command.RequestID, input.Name, input.Confirmation))
	case commandPrune:
		var input pruneCommand
		if err := decodeCommandPayload(record.Payload, &input); err != nil {
			return queue.PermanentError(err)
		}
		return classifyCommandError(target.Control.Prune(ctx, record.Command.Actor, record.Command.RequestID, input.Resource, input.Confirmation, input.All))
	case commandSwarmTokenRotate:
		var input swarmTokenCommand
		if err := decodeCommandPayload(record.Payload, &input); err != nil {
			return queue.PermanentError(err)
		}
		return classifyCommandError(target.Control.RotateJoinToken(ctx, record.Command.Actor, record.Command.RequestID, input.Role, input.Confirmation))
	case commandSwarmUpdate:
		var input swarmUpdateCommand
		if err := decodeCommandPayload(record.Payload, &input); err != nil {
			return queue.PermanentError(err)
		}
		return classifyCommandError(target.Control.UpdateSwarm(ctx, record.Command.Actor, record.Command.RequestID, input.TaskHistoryLimit))
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
	case commandApplicationDomain:
		var input applicationDomainCommand
		if err := decodeCommandPayload(record.Payload, &input); err != nil {
			return queue.PermanentError(err)
		}
		return classifyCommandError(target.Control.SetApplicationDomain(ctx, record.Command.Actor, record.Command.RequestID, input.Name, input.Domain, input.Resolver, input.Confirmation))
	case commandSourceDeploy:
		var input sourceDeployCommand
		if err := decodeCommandPayload(record.Payload, &input); err != nil {
			return queue.PermanentError(err)
		}
		// The routing edge comes first. Every generated application joins its
		// own encrypted route overlay, which only exists once Traefik does, so
		// a cluster without it used to fail this deployment after the image
		// had already been built and pushed.
		if err := target.Control.EnsureTraefikInstalled(ctx, record.Command.Actor, record.Command.RequestID); err != nil {
			return classifyCommandError(err)
		}
		for _, engine := range input.Spec.Databases {
			if err := target.Control.SetDatabase(ctx, record.Command.Actor, record.Command.RequestID, engine, true, ""); err != nil {
				return classifyCommandError(err)
			}
		}
		for _, stack := range input.SharedStacks {
			var err error
			switch stack {
			case "swarmops-agent":
				err = target.Control.NodeAgentCollection(ctx, record.Command.Actor, record.Command.RequestID, true, "INSTALL_NODE_AGENT")
			case "swarmops-logs":
				err = target.Control.LogsCollection(ctx, record.Command.Actor, record.Command.RequestID, true, "")
			case "swarmops-observability":
				err = target.Control.CoreObservability(ctx, record.Command.Actor, record.Command.RequestID, true, "")
			default:
				return queue.PermanentError(fmt.Errorf("unsupported shared source stack"))
			}
			if err != nil {
				return classifyCommandError(err)
			}
		}
		if input.Build != nil {
			artifact, err := s.commands.Artifact(record.Command.ID)
			if err != nil {
				return queue.PermanentError(fmt.Errorf("source build input is unavailable"))
			}
			defer artifact.Close()
			if _, err := target.Build.Run(ctx, *input.Build, artifact, record.Command.RequestID); err != nil {
				return classifyCommandError(err)
			}
		}
		return classifyCommandError(target.Control.DeployApplication(ctx, record.Command.Actor, record.Command.RequestID, input.Spec))
	default:
		return queue.PermanentError(fmt.Errorf("unsupported queued command"))
	}
}

// CommandExecutionTimeout keeps source builds bounded while giving the
// Docker API its documented 30-minute build window. All other fixed-shape
// cluster mutations retain the worker's short default timeout.
func (s *Server) CommandExecutionTimeout(command domain.Command) time.Duration {
	if command.Action == commandServerReadiness {
		return 50 * time.Minute
	}
	if command.Action == commandSourceDeploy {
		return 50 * time.Minute
	}
	if command.Action == commandImageBuild {
		return 35 * time.Minute
	}
	return 10 * time.Minute
}

func sortedCommandStrings(values []string) []string {
	seen := map[string]bool{}
	result := make([]string, 0, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value != "" && !seen[value] {
			seen[value] = true
			result = append(result, value)
		}
	}
	sort.Strings(result)
	return result
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
	var classified interface{ SafeFailureCode() string }
	if errors.As(err, &classified) {
		switch classified.SafeFailureCode() {
		case agentcontrol.CommandFailureConfigMissing,
			agentcontrol.CommandFailureIngressMissing,
			agentcontrol.CommandFailureNetworkMissing,
			agentcontrol.CommandFailureOutputLimit,
			agentcontrol.CommandFailurePlacement,
			agentcontrol.CommandFailurePortUnavailable,
			agentcontrol.CommandFailureSecretMissing:
			return queue.PermanentError(err)
		}
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
