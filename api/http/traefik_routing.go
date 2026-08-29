package apihttp

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/nimasrn/SwarmOps/internal/auth"
	"github.com/nimasrn/SwarmOps/internal/domain"
	"github.com/nimasrn/SwarmOps/internal/ops"
	"github.com/nimasrn/SwarmOps/internal/queue"
)

const (
	commandTraefikRouteApply          = "traefik.route.apply"
	commandTraefikServiceRole         = "traefik.service-role"
	commandTraefikBindingApply        = "traefik.binding.apply"
	commandTraefikSettingsApply       = "traefik.settings.apply"
	commandTraefikDNSCredential       = "traefik.dns-credential.rotate"
	commandTraefikDNSCredentialRemove = "traefik.dns-credential.remove"
	commandTraefikDNSRecordApply      = "traefik.dns-record.apply"
	commandTraefikDNSRecordDelete     = "traefik.dns-record.delete"
	commandTraefikCertificateRetry    = "traefik.certificate.retry"
	commandTraefikCutover             = "traefik.cutover"

	maxDNSCredentialBytes = 512
)

type traefikRouteCommand struct {
	Confirmation string        `json:"confirmation"`
	Route        ops.RouteSpec `json:"route"`
}

type traefikServiceRoleCommand struct {
	Declaration ops.ServiceRouteDeclaration `json:"declaration"`
}

type traefikBindingCommand struct {
	Binding ops.DependencyBinding `json:"binding"`
}

type traefikSettingsCommand struct {
	Confirmation string              `json:"confirmation"`
	Settings     ops.TraefikSettings `json:"settings"`
}

type traefikDNSCredentialCommand struct {
	ID       string          `json:"id"`
	Name     string          `json:"name"`
	Provider ops.DNSProvider `json:"provider"`
}

type traefikDNSCredentialRemoveCommand struct {
	Confirmation string `json:"confirmation"`
	ID           string `json:"id"`
	Version      int    `json:"version"`
}

type traefikDNSRecordCommand struct {
	Protocol ops.RouteProtocol `json:"protocol"`
	Record   ops.DNSRecordSpec `json:"record"`
}

type traefikDNSRecordDeleteCommand struct {
	Confirmation string `json:"confirmation"`
	ID           string `json:"id"`
}

type traefikCertificateRetryCommand struct {
	RouteKey string `json:"routeKey"`
}

type traefikCutoverCommand struct {
	Confirmation string `json:"confirmation"`
}

func (s *Server) traefikRoutingState(response http.ResponseWriter, request *http.Request, _ auth.Claims) {
	target, ok := s.targetFor(response, request)
	if !ok {
		return
	}
	refresh, _ := strconv.ParseBool(request.URL.Query().Get("refresh"))
	state, err := target.Control.RoutingState(request.Context(), refresh)
	if err != nil {
		s.operationError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, state)
}

func (s *Server) traefikRoutes(response http.ResponseWriter, request *http.Request, _ auth.Claims) {
	target, ok := s.targetFor(response, request)
	if !ok {
		return
	}
	rows, err := target.Control.RouteInventory(request.Context())
	if err != nil {
		s.operationError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, rows)
}

func (s *Server) traefikRoutePlan(response http.ResponseWriter, request *http.Request, _ auth.Claims) {
	var route ops.RouteSpec
	if !decodeJSON(response, request, &route) {
		return
	}
	target, ok := s.targetFor(response, request)
	if !ok {
		return
	}
	plan, err := target.Control.PlanRoute(request.Context(), route)
	if err != nil {
		writeError(response, http.StatusUnprocessableEntity, err.Error())
		return
	}
	writeJSON(response, http.StatusOK, plan)
}

func (s *Server) traefikRouteApply(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
	var input traefikRouteCommand
	if !decodeJSON(response, request, &input) {
		return
	}
	target, ok := s.targetFor(response, request)
	if !ok {
		return
	}
	plan, err := target.Control.PlanRoute(request.Context(), input.Route)
	if err != nil {
		writeError(response, http.StatusUnprocessableEntity, err.Error())
		return
	}
	input.Route = plan.Route
	s.submitCommand(response, request, claims, commandTraefikRouteApply, "route/"+input.Route.Key, input, true)
}

func (s *Server) traefikServiceRole(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
	var input struct {
		Reason string               `json:"reason"`
		Role   ops.ServiceRouteRole `json:"role"`
	}
	if !decodeJSON(response, request, &input) {
		return
	}
	declaration := ops.ServiceRouteDeclaration{Reason: input.Reason, Role: input.Role, ServiceKey: request.PathValue("service"), Version: ops.RoutingSchemaVersion}.Normalize()
	if err := declaration.Validate(); err != nil {
		writeError(response, http.StatusUnprocessableEntity, err.Error())
		return
	}
	s.submitCommand(response, request, claims, commandTraefikServiceRole, "service/"+declaration.ServiceKey, traefikServiceRoleCommand{Declaration: declaration}, true)
}

func (s *Server) traefikBindingApply(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
	var binding ops.DependencyBinding
	if !decodeJSON(response, request, &binding) {
		return
	}
	binding = binding.Normalize()
	if err := binding.Validate(); err != nil {
		writeError(response, http.StatusUnprocessableEntity, err.Error())
		return
	}
	s.submitCommand(response, request, claims, commandTraefikBindingApply, "binding/"+binding.CallerService+"/"+binding.TargetRoute, traefikBindingCommand{Binding: binding}, true)
}

func (s *Server) traefikSettingsApply(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
	var input traefikSettingsCommand
	if !decodeJSON(response, request, &input) {
		return
	}
	input.Settings = input.Settings.Normalize()
	if err := input.Settings.ValidateForApply(); err != nil {
		writeError(response, http.StatusUnprocessableEntity, err.Error())
		return
	}
	if input.Confirmation != "RESTART_SINGLETON_TRAEFIK" {
		writeError(response, http.StatusUnprocessableEntity, "static Traefik settings require confirmation RESTART_SINGLETON_TRAEFIK")
		return
	}
	s.submitCommand(response, request, claims, commandTraefikSettingsApply, "stack/traefik", input, true)
}

func (s *Server) traefikDNSCredential(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
	input := traefikDNSCredentialCommand{
		ID:       strings.ToLower(strings.TrimSpace(request.URL.Query().Get("id"))),
		Name:     strings.TrimSpace(request.URL.Query().Get("name")),
		Provider: ops.DNSProvider(strings.ToLower(strings.TrimSpace(request.URL.Query().Get("provider")))),
	}
	if input.ID == "" || input.Name == "" || (input.Provider != ops.DNSProviderCloudflare && input.Provider != ops.DNSProviderArvan) {
		writeError(response, http.StatusUnprocessableEntity, "DNS credential metadata is invalid")
		return
	}
	serverID, idempotencyKey, ok := s.commandSubmissionContext(response, request)
	if !ok {
		return
	}
	payload, err := json.Marshal(input)
	if err != nil {
		writeError(response, http.StatusInternalServerError, "Command could not be queued")
		return
	}
	request.Body = http.MaxBytesReader(response, request.Body, maxDNSCredentialBytes)
	defer request.Body.Close()
	submission, err := s.commands.SubmitArtifactWithResult(queue.SubmitInput{
		Action:           commandTraefikDNSCredential,
		Actor:            claims.Username,
		AuthorityEpoch:   s.core.AuthorityEpoch(),
		AutoRetry:        false,
		ClusterID:        "default",
		IdempotencyKey:   idempotencyKey,
		MaxArtifactBytes: maxDNSCredentialBytes,
		MaxAttempts:      1,
		Payload:          payload,
		RequestID:        requestID(request),
		ServerID:         serverID,
		Target:           "dns-credential/" + input.ID,
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
	writeJSON(response, http.StatusAccepted, submission.Command)
}

func (s *Server) traefikDNSCredentialRemove(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
	version, err := strconv.Atoi(request.PathValue("version"))
	if err != nil || version < 1 {
		writeError(response, http.StatusUnprocessableEntity, "DNS credential version is invalid")
		return
	}
	var input traefikDNSCredentialRemoveCommand
	if !decodeJSON(response, request, &input) {
		return
	}
	input.ID = strings.ToLower(strings.TrimSpace(request.PathValue("id")))
	input.Version = version
	if input.Confirmation != ops.DNSCredentialRemovalConfirmation(input.ID, input.Version) {
		writeError(response, http.StatusUnprocessableEntity, "DNS credential removal requires confirmation "+ops.DNSCredentialRemovalConfirmation(input.ID, input.Version))
		return
	}
	s.submitCommand(response, request, claims, commandTraefikDNSCredentialRemove, "dns-credential/"+input.ID, input, false)
}

func (s *Server) traefikDNSRecordPreview(response http.ResponseWriter, request *http.Request, _ auth.Claims) {
	var input traefikDNSRecordCommand
	if !decodeJSON(response, request, &input) {
		return
	}
	target, ok := s.targetFor(response, request)
	if !ok {
		return
	}
	preview, err := target.Control.PreviewDNSRecord(request.Context(), input.Record, input.Protocol)
	if err != nil {
		writeError(response, http.StatusUnprocessableEntity, err.Error())
		return
	}
	writeJSON(response, http.StatusOK, preview)
}

func (s *Server) traefikDNSRecordApply(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
	var input traefikDNSRecordCommand
	if !decodeJSON(response, request, &input) {
		return
	}
	target, ok := s.targetFor(response, request)
	if !ok {
		return
	}
	preview, err := target.Control.PreviewDNSRecord(request.Context(), input.Record, input.Protocol)
	if err != nil {
		writeError(response, http.StatusUnprocessableEntity, err.Error())
		return
	}
	input.Record = preview.Record
	s.submitCommand(response, request, claims, commandTraefikDNSRecordApply, "dns-record/"+input.Record.ID, input, false)
}

func (s *Server) traefikDNSRecordDelete(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
	var input traefikDNSRecordDeleteCommand
	if !decodeJSON(response, request, &input) {
		return
	}
	input.ID = strings.ToLower(strings.TrimSpace(request.PathValue("id")))
	if input.Confirmation != ops.DNSRecordDeletionConfirmation(input.ID) {
		writeError(response, http.StatusUnprocessableEntity, "DNS record deletion requires confirmation "+ops.DNSRecordDeletionConfirmation(input.ID))
		return
	}
	s.submitCommand(response, request, claims, commandTraefikDNSRecordDelete, "dns-record/"+input.ID, input, false)
}

func (s *Server) traefikDNSVerify(response http.ResponseWriter, request *http.Request, _ auth.Claims) {
	target, ok := s.targetFor(response, request)
	if !ok {
		return
	}
	status, err := target.Control.VerifyDNSRecord(request.Context(), request.PathValue("id"))
	if err != nil {
		s.operationError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, status)
}

func (s *Server) traefikRuntime(response http.ResponseWriter, request *http.Request, _ auth.Claims) {
	target, ok := s.targetFor(response, request)
	if !ok {
		return
	}
	if err := target.Control.RefreshTraefikRuntime(request.Context()); err != nil {
		s.operationError(response, request, err)
		return
	}
	state, err := target.Control.RoutingState(request.Context(), false)
	if err != nil {
		s.operationError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, state.Runtime)
}

func (s *Server) traefikCertificates(response http.ResponseWriter, request *http.Request, _ auth.Claims) {
	target, ok := s.targetFor(response, request)
	if !ok {
		return
	}
	state, err := target.Control.RoutingState(request.Context(), false)
	if err != nil {
		s.operationError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, state.Certificates)
}

func (s *Server) traefikCertificateRetry(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
	routeKey := strings.ToLower(strings.TrimSpace(request.PathValue("route")))
	if routeKey == "" {
		writeError(response, http.StatusUnprocessableEntity, "certificate route is invalid")
		return
	}
	s.submitCommand(response, request, claims, commandTraefikCertificateRetry, "certificate/"+routeKey, traefikCertificateRetryCommand{RouteKey: routeKey}, false)
}

func (s *Server) traefikLogs(response http.ResponseWriter, request *http.Request, _ auth.Claims) {
	now := time.Now().UTC()
	filter := ops.TraefikLogFilter{Level: request.URL.Query().Get("level"), RequestID: request.URL.Query().Get("requestId"), Router: request.URL.Query().Get("router"), Service: request.URL.Query().Get("service")}
	filter.Limit, _ = strconv.Atoi(request.URL.Query().Get("limit"))
	filter.Live, _ = strconv.ParseBool(request.URL.Query().Get("live"))
	if value := request.URL.Query().Get("from"); value != "" {
		filter.From, _ = time.Parse(time.RFC3339, value)
	}
	if value := request.URL.Query().Get("to"); value != "" {
		filter.To, _ = time.Parse(time.RFC3339, value)
	}
	filter = filter.Normalize(now)
	if err := filter.Validate(now); err != nil {
		writeError(response, http.StatusUnprocessableEntity, err.Error())
		return
	}
	target, ok := s.targetFor(response, request)
	if !ok {
		return
	}
	logs, err := target.Control.TraefikLogs(request.Context(), filter)
	if err != nil {
		s.operationError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, logs)
}

func (s *Server) traefikPrometheus(response http.ResponseWriter, request *http.Request, _ auth.Claims) {
	target, ok := s.targetFor(response, request)
	if !ok {
		return
	}
	status, err := target.Control.TraefikPrometheusStatus(request.Context())
	if err != nil {
		s.operationError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, status)
}

func (s *Server) traefikCutoverPlan(response http.ResponseWriter, request *http.Request, _ auth.Claims) {
	target, ok := s.targetFor(response, request)
	if !ok {
		return
	}
	plan, err := target.Control.PlanClusterCutover(request.Context())
	if err != nil {
		s.operationError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, plan)
}

func (s *Server) traefikCutover(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
	var input traefikCutoverCommand
	if !decodeJSON(response, request, &input) {
		return
	}
	if input.Confirmation != "CUTOVER_CLUSTER_THROUGH_TRAEFIK" {
		writeError(response, http.StatusUnprocessableEntity, "cluster cutover requires confirmation CUTOVER_CLUSTER_THROUGH_TRAEFIK")
		return
	}
	target, ok := s.targetFor(response, request)
	if !ok {
		return
	}
	plan, err := target.Control.PlanClusterCutover(request.Context())
	if err != nil {
		s.operationError(response, request, err)
		return
	}
	if !plan.Ready {
		writeError(response, http.StatusConflict, fmt.Sprintf("cluster cutover is blocked by %d validation issue(s)", len(plan.Blockers)))
		return
	}
	s.submitCommand(response, request, claims, commandTraefikCutover, "cluster/"+request.Header.Get("X-SwarmOps-Server-ID"), input, false)
}

func routingCommandDomain(command domain.Command) bool {
	return strings.HasPrefix(command.Action, "traefik.")
}
