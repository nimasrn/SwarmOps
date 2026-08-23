// Package apihttp exposes the authenticated SwarmOps HTTP API and SPA.
package apihttp

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"sync/atomic"
	"time"

	"github.com/nimasrn/SwarmOps/internal/audit"
	"github.com/nimasrn/SwarmOps/internal/auth"
	"github.com/nimasrn/SwarmOps/internal/build"
	"github.com/nimasrn/SwarmOps/internal/config"
	"github.com/nimasrn/SwarmOps/internal/domain"
	"github.com/nimasrn/SwarmOps/internal/ops"
	"github.com/nimasrn/SwarmOps/internal/web"
)

const sessionCookie = "swarmops_session"

type Server struct {
	audit        *audit.Store
	auth         *auth.Service
	build        build.Service
	config       config.Config
	control      *ops.ControlPlane
	loginLimiter *auth.LoginLimiter
	logger       *slog.Logger
	requestTotal atomic.Uint64
}

func New(cfg config.Config, control *ops.ControlPlane, buildService build.Service, auditStore *audit.Store, logger *slog.Logger) (*Server, error) {
	if control == nil || auditStore == nil {
		return nil, fmt.Errorf("control plane and audit store are required")
	}
	if logger == nil {
		logger = slog.Default()
	}
	authService, err := auth.New(cfg.AdminUsername, cfg.AdminPasswordHash, cfg.SessionKey, cfg.SessionTTL)
	if err != nil {
		return nil, err
	}
	return &Server{audit: auditStore, auth: authService, build: buildService, config: cfg, control: control, loginLimiter: auth.NewLoginLimiter(8, 15*time.Minute), logger: logger}, nil
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", s.health)
	mux.HandleFunc("GET /readyz", s.ready)
	mux.HandleFunc("GET /metrics", s.metrics)
	mux.HandleFunc("POST /api/v1/auth/login", s.login)
	mux.HandleFunc("GET /api/v1/auth/me", s.withAuth(false, s.me))
	mux.HandleFunc("POST /api/v1/auth/logout", s.withAuth(true, s.logout))
	mux.HandleFunc("GET /api/v1/overview", s.withAuth(false, s.overview))
	mux.HandleFunc("GET /api/v1/nodes", s.withAuth(false, s.nodes))
	mux.HandleFunc("GET /api/v1/nodes/{id}", s.withAuth(false, s.node))
	mux.HandleFunc("GET /api/v1/nodes/{id}/tasks", s.withAuth(false, s.nodeTasks))
	mux.HandleFunc("POST /api/v1/nodes/{id}/availability", s.withAuth(true, s.nodeAvailability))
	mux.HandleFunc("GET /api/v1/stacks", s.withAuth(false, s.stacks))
	mux.HandleFunc("POST /api/v1/stacks/validate", s.withAuth(true, s.stackValidate))
	mux.HandleFunc("POST /api/v1/stacks/deploy", s.withAuth(true, s.stackDeploy))
	mux.HandleFunc("GET /api/v1/services", s.withAuth(false, s.services))
	mux.HandleFunc("GET /api/v1/services/{id}/logs", s.withAuth(false, s.serviceLogs))
	mux.HandleFunc("POST /api/v1/services/{id}/actions", s.withAuth(true, s.serviceAction))
	mux.HandleFunc("POST /api/v1/builds", s.withAuth(true, s.buildImage))
	mux.HandleFunc("GET /api/v1/traefik/status", s.withAuth(false, s.traefikStatus))
	mux.HandleFunc("POST /api/v1/traefik/reconcile", s.withAuth(true, s.traefikReconcile))
	mux.HandleFunc("GET /api/v1/observability/status", s.withAuth(false, s.observabilityStatus))
	mux.HandleFunc("POST /api/v1/observability/core", s.withAuth(true, s.coreObservability))
	mux.HandleFunc("POST /api/v1/observability/logs", s.withAuth(true, s.logsCollection))
	mux.HandleFunc("GET /api/v1/audit-events", s.withAuth(false, s.auditEvents))
	mux.Handle("/", web.Handler())
	return s.middleware(mux)
}

func (s *Server) health(response http.ResponseWriter, _ *http.Request) {
	writeJSON(response, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Server) ready(response http.ResponseWriter, request *http.Request) {
	ctx, cancel := context.WithTimeout(request.Context(), 3*time.Second)
	defer cancel()
	if err := s.control.Ready(ctx); err != nil {
		writeError(response, http.StatusServiceUnavailable, "Docker control plane is unavailable")
		return
	}
	writeJSON(response, http.StatusOK, map[string]string{"status": "ready"})
}

func (s *Server) metrics(response http.ResponseWriter, _ *http.Request) {
	response.Header().Set("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
	_, _ = fmt.Fprintf(response, "# TYPE swarmops_http_requests_total counter\nswarmops_http_requests_total %d\n", s.requestTotal.Load())
}

func (s *Server) login(response http.ResponseWriter, request *http.Request) {
	var input struct {
		Password string `json:"password"`
		Username string `json:"username"`
	}
	if !decodeJSON(response, request, &input) {
		return
	}
	if len(input.Username) > 128 || len(input.Password) > 1024 {
		writeError(response, http.StatusUnauthorized, "Invalid username or password")
		return
	}
	key := loginAttemptKey(request, input.Username)
	if !s.loginLimiter.Allow(key) {
		writeError(response, http.StatusTooManyRequests, "Too many login attempts; try again later")
		return
	}
	token, claims, err := s.auth.Login(input.Username, input.Password)
	if err != nil {
		s.loginLimiter.Failure(key)
		s.record(input.Username, requestID(request), "auth.login", "session", err, nil)
		writeError(response, http.StatusUnauthorized, "Invalid username or password")
		return
	}
	s.loginLimiter.Success(key)
	http.SetCookie(response, &http.Cookie{Name: sessionCookie, Value: token, Path: "/", MaxAge: int(s.config.SessionTTL.Seconds()), HttpOnly: true, SameSite: http.SameSiteStrictMode, Secure: s.config.SecureCookies})
	s.record(claims.Username, requestID(request), "auth.login", "session", nil, nil)
	writeJSON(response, http.StatusOK, map[string]any{"csrfToken": claims.CSRF, "user": map[string]string{"username": claims.Username}})
}

func (s *Server) me(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
	writeJSON(response, http.StatusOK, map[string]any{"csrfToken": claims.CSRF, "user": map[string]string{"username": claims.Username}})
}

func (s *Server) logout(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
	http.SetCookie(response, &http.Cookie{Name: sessionCookie, Value: "", Path: "/", MaxAge: -1, HttpOnly: true, SameSite: http.SameSiteStrictMode, Secure: s.config.SecureCookies})
	s.record(claims.Username, requestID(request), "auth.logout", "session", nil, nil)
	response.WriteHeader(http.StatusNoContent)
}

func (s *Server) overview(response http.ResponseWriter, request *http.Request, _ auth.Claims) {
	value, err := s.control.Overview(request.Context())
	if err != nil {
		s.operationError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, value)
}

func (s *Server) nodes(response http.ResponseWriter, request *http.Request, _ auth.Claims) {
	value, err := s.control.Nodes(request.Context())
	if err != nil {
		s.operationError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, value)
}

func (s *Server) node(response http.ResponseWriter, request *http.Request, _ auth.Claims) {
	value, err := s.control.Node(request.Context(), request.PathValue("id"))
	if err != nil {
		s.operationError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, value)
}

func (s *Server) nodeTasks(response http.ResponseWriter, request *http.Request, _ auth.Claims) {
	value, err := s.control.TasksForNode(request.Context(), request.PathValue("id"))
	if err != nil {
		s.operationError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, value)
}

func (s *Server) nodeAvailability(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
	var input struct {
		Availability string `json:"availability"`
	}
	if !decodeJSON(response, request, &input) {
		return
	}
	if err := s.control.SetNodeAvailability(request.Context(), claims.Username, requestID(request), request.PathValue("id"), input.Availability); err != nil {
		s.operationError(response, request, err)
		return
	}
	response.WriteHeader(http.StatusNoContent)
}

func (s *Server) stacks(response http.ResponseWriter, request *http.Request, _ auth.Claims) {
	value, err := s.control.Stacks(request.Context())
	if err != nil {
		s.operationError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, value)
}

func (s *Server) stackValidate(response http.ResponseWriter, request *http.Request, _ auth.Claims) {
	var input struct {
		Compose      string `json:"compose"`
		TargetNodeID string `json:"targetNodeId"`
	}
	if !decodeJSON(response, request, &input) {
		return
	}
	value, err := s.control.ValidateStack([]byte(input.Compose), input.TargetNodeID)
	if err != nil {
		writeError(response, http.StatusUnprocessableEntity, err.Error())
		return
	}
	writeJSON(response, http.StatusOK, value)
}

func (s *Server) stackDeploy(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
	var input struct {
		Compose      string `json:"compose"`
		Name         string `json:"name"`
		TargetNodeID string `json:"targetNodeId"`
	}
	if !decodeJSON(response, request, &input) {
		return
	}
	value, err := s.control.DeployStack(request.Context(), claims.Username, requestID(request), input.Name, []byte(input.Compose), input.TargetNodeID)
	if err != nil {
		s.operationError(response, request, err)
		return
	}
	writeJSON(response, http.StatusAccepted, value)
}

func (s *Server) services(response http.ResponseWriter, request *http.Request, _ auth.Claims) {
	value, err := s.control.Services(request.Context())
	if err != nil {
		s.operationError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, value)
}

func (s *Server) serviceLogs(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
	tail, _ := strconv.ParseUint(request.URL.Query().Get("tail"), 10, 64)
	value, err := s.control.ServiceLogs(request.Context(), claims.Username, requestID(request), request.PathValue("id"), tail)
	if err != nil {
		s.operationError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, map[string]string{"logs": value})
}

func (s *Server) serviceAction(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
	var input struct {
		Action   string  `json:"action"`
		Replicas *uint64 `json:"replicas"`
	}
	if !decodeJSON(response, request, &input) {
		return
	}
	if err := s.control.ServiceAction(request.Context(), claims.Username, requestID(request), request.PathValue("id"), input.Action, input.Replicas); err != nil {
		s.operationError(response, request, err)
		return
	}
	response.WriteHeader(http.StatusNoContent)
}

func (s *Server) buildImage(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
	request.Body = http.MaxBytesReader(response, request.Body, s.config.BuildMaxBytes)
	defer request.Body.Close()
	if s.build.Enabled {
		if err := s.audit.Writable(); err != nil {
			s.operationError(response, request, fmt.Errorf("audit log is unavailable: %w", err))
			return
		}
	}
	cpus, _ := strconv.ParseFloat(request.Header.Get("X-SwarmOps-CPUs"), 64)
	memory, _ := strconv.ParseInt(request.Header.Get("X-SwarmOps-Memory-MiB"), 10, 64)
	push, _ := strconv.ParseBool(request.Header.Get("X-SwarmOps-Push"))
	input := build.Request{CPUs: cpus, Dockerfile: request.Header.Get("X-SwarmOps-Dockerfile"), Image: request.Header.Get("X-SwarmOps-Image"), MemoryMiB: memory, Push: push}
	value, err := s.build.Run(request.Context(), input, request.Body, requestID(request))
	s.record(claims.Username, requestID(request), "image.build", "image/"+input.Image, err, map[string]string{"push": strconv.FormatBool(push)})
	if err != nil {
		s.operationError(response, request, err)
		return
	}
	writeJSON(response, http.StatusAccepted, value)
}

func (s *Server) traefikStatus(response http.ResponseWriter, request *http.Request, _ auth.Claims) {
	services, err := s.control.Services(request.Context())
	if err != nil {
		s.operationError(response, request, err)
		return
	}
	for _, service := range services {
		if service.Name == "traefik_traefik" {
			writeJSON(response, http.StatusOK, map[string]any{"dashboardURL": s.config.TraefikDashboardURL, "service": service})
			return
		}
	}
	writeJSON(response, http.StatusOK, map[string]any{"dashboardURL": s.config.TraefikDashboardURL, "service": nil})
}

func (s *Server) traefikReconcile(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
	var input struct {
		Confirmation string `json:"confirmation"`
	}
	if !decodeJSON(response, request, &input) {
		return
	}
	if err := s.control.ReconcileTraefik(request.Context(), claims.Username, requestID(request), input.Confirmation); err != nil {
		s.operationError(response, request, err)
		return
	}
	response.WriteHeader(http.StatusNoContent)
}

func (s *Server) observabilityStatus(response http.ResponseWriter, request *http.Request, _ auth.Claims) {
	stacks, err := s.control.Stacks(request.Context())
	if err != nil {
		s.operationError(response, request, err)
		return
	}
	result := map[string]bool{"coreInstalled": false, "logsEnabled": false}
	for _, stack := range stacks {
		if stack.Name == "swarmops-observability" {
			result["coreInstalled"] = true
		}
		if stack.Name == "swarmops-logs" {
			result["logsEnabled"] = true
		}
	}
	writeJSON(response, http.StatusOK, result)
}

func (s *Server) logsCollection(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
	var input struct {
		Confirmation string `json:"confirmation"`
		Enabled      bool   `json:"enabled"`
	}
	if !decodeJSON(response, request, &input) {
		return
	}
	if err := s.control.LogsCollection(request.Context(), claims.Username, requestID(request), input.Enabled, input.Confirmation); err != nil {
		s.operationError(response, request, err)
		return
	}
	response.WriteHeader(http.StatusNoContent)
}

func (s *Server) coreObservability(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
	var input struct {
		Confirmation string `json:"confirmation"`
		Enabled      bool   `json:"enabled"`
	}
	if !decodeJSON(response, request, &input) {
		return
	}
	if err := s.control.CoreObservability(request.Context(), claims.Username, requestID(request), input.Enabled, input.Confirmation); err != nil {
		s.operationError(response, request, err)
		return
	}
	response.WriteHeader(http.StatusNoContent)
}

func (s *Server) auditEvents(response http.ResponseWriter, request *http.Request, _ auth.Claims) {
	limit, _ := strconv.Atoi(request.URL.Query().Get("limit"))
	if limit == 0 {
		limit = 100
	}
	value, err := s.control.AuditEvents(limit)
	if err != nil {
		s.operationError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, value)
}

type protectedHandler func(http.ResponseWriter, *http.Request, auth.Claims)

func (s *Server) withAuth(csrf bool, handler protectedHandler) http.HandlerFunc {
	return func(response http.ResponseWriter, request *http.Request) {
		cookie, err := request.Cookie(sessionCookie)
		if err != nil {
			writeError(response, http.StatusUnauthorized, "Authentication is required")
			return
		}
		claims, err := s.auth.Verify(cookie.Value)
		if err != nil {
			writeError(response, http.StatusUnauthorized, "Your session has expired")
			return
		}
		if csrf && !s.auth.VerifyCSRF(claims, request.Header.Get("X-CSRF-Token")) {
			writeError(response, http.StatusForbidden, "Invalid request token")
			return
		}
		handler(response, request, claims)
	}
}

func (s *Server) middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		id := newRequestID()
		response.Header().Set("X-Request-Id", id)
		response.Header().Set("X-Content-Type-Options", "nosniff")
		response.Header().Set("Referrer-Policy", "same-origin")
		response.Header().Set("X-Frame-Options", "DENY")
		response.Header().Set("Content-Security-Policy", "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'")
		if request.URL.Path != "/metrics" {
			response.Header().Set("Cache-Control", "no-store")
		}
		s.requestTotal.Add(1)
		next.ServeHTTP(response, request.WithContext(context.WithValue(request.Context(), requestIDKey{}, id)))
	})
}

func (s *Server) operationError(response http.ResponseWriter, request *http.Request, err error) {
	s.logger.Error("SwarmOps operation failed", "request_id", requestID(request), "method", request.Method, "path", request.URL.Path, "error", err)
	if strings.Contains(err.Error(), "audit log is unavailable") {
		writeError(response, http.StatusServiceUnavailable, "The audit log is unavailable; the operation was not attempted")
		return
	}
	if errors.Is(err, ops.ErrOutputLimit) {
		writeError(response, http.StatusBadGateway, "The cluster command produced too much output")
		return
	}
	if strings.Contains(err.Error(), "invalid") || strings.Contains(err.Error(), "must") || strings.Contains(err.Error(), "disabled") || strings.Contains(err.Error(), "requires") || strings.Contains(err.Error(), "exceed") {
		writeError(response, http.StatusUnprocessableEntity, err.Error())
		return
	}
	writeError(response, http.StatusBadGateway, "The cluster operation could not be completed")
}

func (s *Server) record(actor, id, action, target string, err error, detail map[string]string) {
	outcome := "success"
	if err != nil {
		outcome = "failure"
	}
	_, _ = s.audit.Record(domain.AuditEvent{Action: action, Actor: actor, Detail: detail, Outcome: outcome, RequestID: id, Target: target})
}

func decodeJSON(response http.ResponseWriter, request *http.Request, target any) bool {
	request.Body = http.MaxBytesReader(response, request.Body, 1<<20)
	decoder := json.NewDecoder(request.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		writeError(response, http.StatusBadRequest, "Invalid request body")
		return false
	}
	if err := decoder.Decode(&struct{}{}); err != io.EOF {
		writeError(response, http.StatusBadRequest, "Request body must contain one JSON value")
		return false
	}
	return true
}

func writeJSON(response http.ResponseWriter, status int, value any) {
	response.Header().Set("Content-Type", "application/json")
	response.WriteHeader(status)
	_ = json.NewEncoder(response).Encode(value)
}

func writeError(response http.ResponseWriter, status int, message string) {
	writeJSON(response, status, map[string]string{"error": message})
}

type requestIDKey struct{}

func requestID(request *http.Request) string {
	value, _ := request.Context().Value(requestIDKey{}).(string)
	return value
}

func newRequestID() string {
	bytes := make([]byte, 12)
	if _, err := rand.Read(bytes); err != nil {
		return strconv.FormatInt(time.Now().UnixNano(), 36)
	}
	return hex.EncodeToString(bytes)
}

func loginAttemptKey(request *http.Request, username string) string {
	// This endpoint is only reachable through Traefik in the production stack.
	// Its forwarded address gives each external client an independent bucket;
	// RemoteAddr remains the safe fallback for direct local development.
	client := strings.TrimSpace(strings.Split(request.Header.Get("X-Forwarded-For"), ",")[0])
	if client == "" {
		client = request.RemoteAddr
	}
	return strings.ToLower(strings.TrimSpace(username)) + "|" + client
}
