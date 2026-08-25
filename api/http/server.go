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
	"net"
	"net/http"
	"net/netip"
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
	"github.com/nimasrn/SwarmOps/internal/queue"
	"github.com/nimasrn/SwarmOps/internal/remote"
	"github.com/nimasrn/SwarmOps/internal/web"
)

const sessionCookie = "swarmops_session"

// Target contains the fixed-shape control services for one authenticated,
// selected server. The resolver owns the machine API key; HTTP handlers never
// see it and cannot pick a raw Docker endpoint.
type Target struct {
	Build   build.Service
	Control *ops.ControlPlane
}

type TargetResolver interface {
	Resolve(id string) (Target, error)
}

type TargetResolverFunc func(id string) (Target, error)

func (f TargetResolverFunc) Resolve(id string) (Target, error) { return f(id) }

type Server struct {
	audit        *audit.Store
	auth         *auth.Service
	config       config.Config
	commands     *queue.Store
	loginLimiter *auth.LoginLimiter
	logger       *slog.Logger
	requestTotal atomic.Uint64
	servers      *remote.Manager
	apps         *ops.ApplicationStore
	namespace    string
	targets      TargetResolver
}

func New(cfg config.Config, targets TargetResolver, servers *remote.Manager, auditStore *audit.Store, logger *slog.Logger) (*Server, error) {
	if targets == nil || servers == nil || auditStore == nil {
		return nil, fmt.Errorf("target resolver, server manager, and audit store are required")
	}
	if logger == nil {
		logger = slog.Default()
	}
	// Retention bounds default for callers that build a Config directly
	// instead of going through config.Load validation.
	if cfg.AuditMaxEvents < 1 {
		cfg.AuditMaxEvents = config.DefaultAuditMaxEvents
	}
	if cfg.CommandHistoryLimit < 1 {
		cfg.CommandHistoryLimit = config.DefaultCommandHistoryLimit
	}
	authService, err := auth.New(cfg.AdminUsername, cfg.AdminPasswordHash, cfg.SessionKey, cfg.SessionTTL)
	if err != nil {
		return nil, err
	}
	commandStore, err := queue.Open(cfg.DataDir, cfg.DataEncryptionKey, cfg.CommandHistoryLimit)
	if err != nil {
		return nil, err
	}
	return &Server{audit: auditStore, auth: authService, commands: commandStore, config: cfg, loginLimiter: auth.NewLoginLimiter(8, 15*time.Minute), logger: logger, servers: servers, targets: targets}, nil
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", s.health)
	mux.HandleFunc("GET /readyz", s.ready)
	mux.HandleFunc("GET /metrics", s.metrics)
	// Prometheus HTTP service discovery for rendered applications. It sits
	// under /metrics so the same edge rule that hides the metrics endpoint
	// from the public hostname hides this too; it carries no credential and no
	// cluster state beyond service DNS names, ports, and paths.
	mux.HandleFunc("GET /metrics/targets", s.metricsTargets)
	mux.HandleFunc("POST /api/v1/auth/login", s.login)
	mux.HandleFunc("GET /api/v1/auth/me", s.withAuth(false, s.me))
	mux.HandleFunc("POST /api/v1/auth/logout", s.withAuth(true, s.logout))
	mux.HandleFunc("GET /api/v1/servers", s.withAuth(false, s.serversList))
	mux.HandleFunc("POST /api/v1/servers", s.withAuth(true, s.serverAdd))
	mux.HandleFunc("POST /api/v1/servers/enroll", s.withAuth(true, s.serverEnroll))
	mux.HandleFunc("POST /api/v1/servers/{id}/connect", s.withAuth(true, s.serverConnect))
	mux.HandleFunc("POST /api/v1/servers/{id}/disconnect", s.withAuth(true, s.serverDisconnect))
	mux.HandleFunc("DELETE /api/v1/servers/{id}", s.withAuth(true, s.serverRemove))
	mux.HandleFunc("GET /api/v1/overview", s.withAuth(false, s.overview))
	mux.HandleFunc("GET /api/v1/nodes", s.withAuth(false, s.nodes))
	mux.HandleFunc("GET /api/v1/nodes/{id}", s.withAuth(false, s.node))
	mux.HandleFunc("GET /api/v1/nodes/{id}/tasks", s.withAuth(false, s.nodeTasks))
	mux.HandleFunc("POST /api/v1/nodes/{id}/availability", s.withAuth(true, s.nodeAvailability))
	mux.HandleFunc("GET /api/v1/fleet/runs/{id}", s.withAuth(false, s.fleetRun))
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
	mux.HandleFunc("POST /api/v1/observability/node-agent", s.withAuth(true, s.nodeAgentCollection))
	mux.HandleFunc("POST /api/v1/observability/core", s.withAuth(true, s.coreObservability))
	mux.HandleFunc("POST /api/v1/observability/logs", s.withAuth(true, s.logsCollection))
	mux.HandleFunc("GET /api/v1/applications", s.withAuth(false, s.applications))
	mux.HandleFunc("GET /api/v1/applications/approved", s.withAuth(false, s.approvedApplications))
	mux.HandleFunc("POST /api/v1/applications/plan", s.withAuth(true, s.applicationPlan))
	mux.HandleFunc("POST /api/v1/applications", s.withAuth(true, s.applicationDeploy))
	mux.HandleFunc("POST /api/v1/applications/{name}/remove", s.withAuth(true, s.applicationRemove))
	mux.HandleFunc("GET /api/v1/databases", s.withAuth(false, s.databases))
	mux.HandleFunc("POST /api/v1/databases/{engine}", s.withAuth(true, s.databaseSet))
	mux.HandleFunc("GET /api/v1/audit-events", s.withAuth(false, s.auditEvents))
	mux.HandleFunc("GET /api/v1/commands", s.withAuth(false, s.commandsList))
	mux.HandleFunc("GET /api/v1/commands/{id}", s.withAuth(false, s.commandGet))
	mux.HandleFunc("POST /api/v1/commands/{id}/retry", s.withAuth(true, s.commandRetry))
	mux.Handle("/", web.Handler())
	return s.middleware(mux)
}

func (s *Server) health(response http.ResponseWriter, _ *http.Request) {
	writeJSON(response, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Server) ready(response http.ResponseWriter, request *http.Request) {
	// SwarmOps is deliberately able to start without a local Docker socket. A
	// remote target is chosen after login, so readiness covers its own durable
	// state rather than one operator's current machine API connection.
	if err := s.audit.Writable(); err != nil {
		writeError(response, http.StatusServiceUnavailable, "SwarmOps audit storage is unavailable")
		return
	}
	if s.commands == nil {
		writeError(response, http.StatusServiceUnavailable, "SwarmOps command storage is unavailable")
		return
	}
	if err := s.commands.Writable(); err != nil {
		writeError(response, http.StatusServiceUnavailable, "SwarmOps command storage is unavailable")
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
	key := loginAttemptKey(request, input.Username, s.config.TrustedProxyCIDRs)
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

func (s *Server) serversList(response http.ResponseWriter, _ *http.Request, _ auth.Claims) {
	writeJSON(response, http.StatusOK, s.servers.List())
}

// serverEnroll is the one-paste path: the operator supplies only the token the
// installer printed. The controller performs the one-time secret exchange and
// never shows the machine API key it receives; the manager may retain only an
// encrypted copy so the host can reconnect after a controller restart.
func (s *Server) serverEnroll(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
	var input struct {
		Name  string `json:"name"`
		Token string `json:"token"`
	}
	if !decodeJSON(response, request, &input) {
		return
	}
	defer func() { input.Token = "" }()
	server, err := s.servers.Enroll(request.Context(), input.Token, input.Name)
	if err != nil {
		s.record(claims.Username, requestID(request), "server.enroll", "server/connection", err, map[string]string{"connection_type": remote.ConnectionAgentAPI})
		s.connectionError(response, request, err)
		return
	}
	s.record(claims.Username, requestID(request), "server.enroll", "server/"+server.ID, nil, map[string]string{"connection_type": server.ConnectionType, "authentication": server.Authentication})
	writeJSON(response, http.StatusCreated, server)
}

func (s *Server) serverAdd(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
	var input struct {
		APIKey                    string `json:"apiKey"`
		APIURL                    string `json:"apiUrl"`
		Authentication            string `json:"authentication"`
		Host                      string `json:"host"`
		HostKeyFingerprint        string `json:"hostKeyFingerprint"`
		Name                      string `json:"name"`
		Password                  string `json:"password"`
		Port                      uint16 `json:"port"`
		PrivateKey                string `json:"privateKey"`
		PrivateKeyPassword        string `json:"privateKeyPassphrase"`
		TLSCertificateFingerprint string `json:"tlsCertificateFingerprint"`
		Username                  string `json:"username"`
	}
	if !decodeJSON(response, request, &input) {
		return
	}
	defer func() {
		input.APIKey = ""
		input.Password = ""
		input.PrivateKey = ""
		input.PrivateKeyPassword = ""
	}()
	server, err := s.servers.Add(request.Context(), remote.AddInput{
		APIKey:                    input.APIKey,
		APIURL:                    input.APIURL,
		Authentication:            input.Authentication,
		Host:                      input.Host,
		HostKeyFingerprint:        input.HostKeyFingerprint,
		Name:                      input.Name,
		Password:                  input.Password,
		Port:                      input.Port,
		PrivateKey:                input.PrivateKey,
		PrivateKeyPassword:        input.PrivateKeyPassword,
		TLSCertificateFingerprint: input.TLSCertificateFingerprint,
		Username:                  input.Username,
	})
	if err != nil {
		s.record(claims.Username, requestID(request), "server.connect", "server/connection", err, map[string]string{"connection_type": connectionType(input.APIURL), "authentication": connectionAuthentication(input.APIURL, input.Authentication)})
		s.connectionError(response, request, err)
		return
	}
	s.record(claims.Username, requestID(request), "server.connect", "server/"+server.ID, nil, map[string]string{"connection_type": server.ConnectionType, "authentication": server.Authentication})
	writeJSON(response, http.StatusCreated, server)
}

func (s *Server) serverConnect(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
	var input struct {
		APIKey             string `json:"apiKey"`
		Authentication     string `json:"authentication"`
		Password           string `json:"password"`
		PrivateKey         string `json:"privateKey"`
		PrivateKeyPassword string `json:"privateKeyPassphrase"`
	}
	if !decodeJSON(response, request, &input) {
		return
	}
	defer func() {
		input.APIKey = ""
		input.Password = ""
		input.PrivateKey = ""
		input.PrivateKeyPassword = ""
	}()
	id := request.PathValue("id")
	server, err := s.servers.Connect(request.Context(), id, remote.Credentials{
		APIKey:             input.APIKey,
		Authentication:     input.Authentication,
		Password:           input.Password,
		PrivateKey:         input.PrivateKey,
		PrivateKeyPassword: input.PrivateKeyPassword,
	})
	if err != nil {
		s.record(claims.Username, requestID(request), "server.reconnect", "server/"+id, err, nil)
		s.connectionError(response, request, err)
		return
	}
	s.record(claims.Username, requestID(request), "server.reconnect", "server/"+server.ID, nil, nil)
	writeJSON(response, http.StatusOK, server)
}

func connectionType(apiURL string) string {
	if strings.TrimSpace(apiURL) != "" {
		return remote.ConnectionAgentAPI
	}
	return remote.ConnectionSSH
}

func connectionAuthentication(apiURL, authentication string) string {
	if strings.TrimSpace(apiURL) != "" {
		return remote.AuthenticationAPIKey
	}
	return authentication
}

func (s *Server) serverDisconnect(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
	id := request.PathValue("id")
	if err := s.servers.Disconnect(id); err != nil {
		s.operationError(response, request, err)
		return
	}
	s.record(claims.Username, requestID(request), "server.disconnect", "server/"+id, nil, nil)
	response.WriteHeader(http.StatusNoContent)
}

func (s *Server) serverRemove(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
	id := request.PathValue("id")
	if err := s.servers.Remove(id); err != nil {
		s.operationError(response, request, err)
		return
	}
	s.record(claims.Username, requestID(request), "server.remove", "server/"+id, nil, nil)
	response.WriteHeader(http.StatusNoContent)
}

func (s *Server) targetFor(response http.ResponseWriter, request *http.Request) (Target, bool) {
	target, err := s.targets.Resolve(strings.TrimSpace(request.Header.Get("X-SwarmOps-Server-ID")))
	if err != nil {
		s.operationError(response, request, err)
		return Target{}, false
	}
	if target.Control == nil {
		s.operationError(response, request, fmt.Errorf("selected server has no control plane"))
		return Target{}, false
	}
	return target, true
}

func (s *Server) overview(response http.ResponseWriter, request *http.Request, _ auth.Claims) {
	target, ok := s.targetFor(response, request)
	if !ok {
		return
	}
	value, err := target.Control.Overview(request.Context())
	if err != nil {
		s.operationError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, value)
}

func (s *Server) nodes(response http.ResponseWriter, request *http.Request, _ auth.Claims) {
	target, ok := s.targetFor(response, request)
	if !ok {
		return
	}
	value, err := target.Control.Nodes(request.Context())
	if err != nil {
		s.operationError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, value)
}

func (s *Server) node(response http.ResponseWriter, request *http.Request, _ auth.Claims) {
	target, ok := s.targetFor(response, request)
	if !ok {
		return
	}
	value, err := target.Control.Node(request.Context(), request.PathValue("id"))
	if err != nil {
		s.operationError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, value)
}

func (s *Server) nodeTasks(response http.ResponseWriter, request *http.Request, _ auth.Claims) {
	target, ok := s.targetFor(response, request)
	if !ok {
		return
	}
	value, err := target.Control.TasksForNode(request.Context(), request.PathValue("id"))
	if err != nil {
		s.operationError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, value)
}

func (s *Server) fleetRun(response http.ResponseWriter, request *http.Request, _ auth.Claims) {
	target, ok := s.targetFor(response, request)
	if !ok {
		return
	}
	value, err := target.Control.FleetRun(request.Context(), request.PathValue("id"))
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
	s.submitNodeAvailability(response, request, claims, request.PathValue("id"), input.Availability)
}

func (s *Server) stacks(response http.ResponseWriter, request *http.Request, _ auth.Claims) {
	target, ok := s.targetFor(response, request)
	if !ok {
		return
	}
	value, err := target.Control.Stacks(request.Context())
	if err != nil {
		s.operationError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, value)
}

func (s *Server) stackValidate(response http.ResponseWriter, request *http.Request, _ auth.Claims) {
	var input struct {
		Compose      string `json:"compose"`
		Name         string `json:"name"`
		TargetNodeID string `json:"targetNodeId"`
	}
	if !decodeJSON(response, request, &input) {
		return
	}
	target, ok := s.targetFor(response, request)
	if !ok {
		return
	}
	value, err := target.Control.ValidateStack(input.Name, []byte(input.Compose), input.TargetNodeID)
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
	s.submitStackDeploy(response, request, claims, stackDeployCommand{Compose: input.Compose, Name: input.Name, TargetNodeID: input.TargetNodeID})
}

func (s *Server) services(response http.ResponseWriter, request *http.Request, _ auth.Claims) {
	target, ok := s.targetFor(response, request)
	if !ok {
		return
	}
	value, err := target.Control.Services(request.Context())
	if err != nil {
		s.operationError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, value)
}

func (s *Server) serviceLogs(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
	tail, _ := strconv.ParseUint(request.URL.Query().Get("tail"), 10, 64)
	target, ok := s.targetFor(response, request)
	if !ok {
		return
	}
	value, err := target.Control.ServiceLogs(request.Context(), claims.Username, requestID(request), request.PathValue("id"), tail)
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
	s.submitServiceAction(response, request, claims, serviceActionCommand{Action: input.Action, Replicas: input.Replicas, ServiceID: request.PathValue("id")})
}

func (s *Server) buildImage(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
	cpus, _ := strconv.ParseFloat(request.Header.Get("X-SwarmOps-CPUs"), 64)
	memory, _ := strconv.ParseInt(request.Header.Get("X-SwarmOps-Memory-MiB"), 10, 64)
	push, _ := strconv.ParseBool(request.Header.Get("X-SwarmOps-Push"))
	s.submitBuild(response, request, claims, build.Request{CPUs: cpus, Dockerfile: request.Header.Get("X-SwarmOps-Dockerfile"), Image: request.Header.Get("X-SwarmOps-Image"), MemoryMiB: memory, Push: push})
}

func (s *Server) traefikStatus(response http.ResponseWriter, request *http.Request, _ auth.Claims) {
	target, ok := s.targetFor(response, request)
	if !ok {
		return
	}
	services, err := target.Control.Services(request.Context())
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
	s.submitTraefik(response, request, claims, input.Confirmation)
}

// metricsTargets serves the Prometheus HTTP service-discovery document for
// every rendered application that publishes metrics.
func (s *Server) metricsTargets(response http.ResponseWriter, _ *http.Request) {
	writeJSON(response, http.StatusOK, ops.MetricsTargetsFor(s.apps, s.namespace))
}

// SetApplicationDiscovery supplies the stored applications and reviewed
// namespace used by the Prometheus discovery endpoint. It is separate from the
// per-server control planes because discovery must answer even when no machine
// API is connected.
func (s *Server) SetApplicationDiscovery(apps *ops.ApplicationStore, namespace string) {
	s.apps = apps
	s.namespace = namespace
}

func (s *Server) applications(response http.ResponseWriter, request *http.Request, _ auth.Claims) {
	target, ok := s.targetFor(response, request)
	if !ok {
		return
	}
	statuses, err := target.Control.Applications(request.Context())
	if err != nil {
		s.operationError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, statuses)
}

// approvedApplications tells the console which application names, domains,
// resolvers, and resource ceilings the reviewed manifest allows. The console
// offers these rather than free-form input.
func (s *Server) approvedApplications(response http.ResponseWriter, request *http.Request, _ auth.Claims) {
	target, ok := s.targetFor(response, request)
	if !ok {
		return
	}
	writeJSON(response, http.StatusOK, target.Control.ApprovedApplications())
}

// applicationPlan renders and fully validates without deploying, so an
// operator can read the exact Compose before queueing it.
func (s *Server) applicationPlan(response http.ResponseWriter, request *http.Request, _ auth.Claims) {
	target, ok := s.targetFor(response, request)
	if !ok {
		return
	}
	var spec ops.ApplicationSpec
	if !decodeJSON(response, request, &spec) {
		return
	}
	rendered, err := target.Control.PlanApplication(request.Context(), spec)
	if err != nil {
		writeError(response, http.StatusUnprocessableEntity, err.Error())
		return
	}
	writeJSON(response, http.StatusOK, map[string]string{"compose": string(rendered)})
}

func (s *Server) applicationDeploy(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
	var spec ops.ApplicationSpec
	if !decodeJSON(response, request, &spec) {
		return
	}
	s.submitApplicationDeploy(response, request, claims, spec)
}

func (s *Server) applicationRemove(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
	var input struct {
		Confirmation string `json:"confirmation"`
	}
	if !decodeJSON(response, request, &input) {
		return
	}
	s.submitApplicationRemove(response, request, claims, request.PathValue("name"), input.Confirmation)
}

// databases lists the reviewed managed engines and whether each is running.
// It returns no password, connection secret, or volume content.
func (s *Server) databases(response http.ResponseWriter, request *http.Request, _ auth.Claims) {
	target, ok := s.targetFor(response, request)
	if !ok {
		return
	}
	statuses, err := target.Control.Databases(request.Context())
	if err != nil {
		s.operationError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, statuses)
}

func (s *Server) databaseSet(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
	var input struct {
		Confirmation string `json:"confirmation"`
		Enabled      bool   `json:"enabled"`
	}
	if !decodeJSON(response, request, &input) {
		return
	}
	s.submitDatabase(response, request, claims, databaseCommand{Confirmation: input.Confirmation, Enabled: input.Enabled, Engine: request.PathValue("engine")})
}

func (s *Server) observabilityStatus(response http.ResponseWriter, request *http.Request, _ auth.Claims) {
	target, ok := s.targetFor(response, request)
	if !ok {
		return
	}
	stacks, err := target.Control.Stacks(request.Context())
	if err != nil {
		s.operationError(response, request, err)
		return
	}
	result := map[string]bool{
		"agentHealthy":   false,
		"agentInstalled": false,
		"coreHealthy":    false,
		"coreInstalled":  false,
		"logsEnabled":    false,
		"logsHealthy":    false,
	}
	for _, stack := range stacks {
		if stack.Name == "swarmops-agent" {
			result["agentInstalled"] = true
			result["agentHealthy"] = stack.Health == domain.HealthHealthy
		}
		if stack.Name == "swarmops-observability" {
			result["coreInstalled"] = true
			result["coreHealthy"] = stack.Health == domain.HealthHealthy
		}
		if stack.Name == "swarmops-logs" {
			result["logsEnabled"] = true
			result["logsHealthy"] = stack.Health == domain.HealthHealthy
		}
	}
	writeJSON(response, http.StatusOK, result)
}

func (s *Server) nodeAgentCollection(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
	var input struct {
		Confirmation string `json:"confirmation"`
		Enabled      bool   `json:"enabled"`
	}
	if !decodeJSON(response, request, &input) {
		return
	}
	s.submitNodeAgent(response, request, claims, confirmationCommand{Confirmation: input.Confirmation, Enabled: input.Enabled})
}

func (s *Server) logsCollection(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
	var input struct {
		Confirmation string `json:"confirmation"`
		Enabled      bool   `json:"enabled"`
	}
	if !decodeJSON(response, request, &input) {
		return
	}
	s.submitLogs(response, request, claims, confirmationCommand{Confirmation: input.Confirmation, Enabled: input.Enabled})
}

func (s *Server) coreObservability(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
	var input struct {
		Confirmation string `json:"confirmation"`
		Enabled      bool   `json:"enabled"`
	}
	if !decodeJSON(response, request, &input) {
		return
	}
	s.submitCoreObservability(response, request, claims, confirmationCommand{Confirmation: input.Confirmation, Enabled: input.Enabled})
}

func (s *Server) auditEvents(response http.ResponseWriter, request *http.Request, _ auth.Claims) {
	limit, _ := strconv.Atoi(request.URL.Query().Get("limit"))
	if limit == 0 {
		limit = 100
	}
	value, err := s.audit.Recent(limit)
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
		response.Header().Set("X-Content-Type-Options", "nosniff")
		response.Header().Set("Referrer-Policy", "same-origin")
		response.Header().Set("X-Frame-Options", "DENY")
		response.Header().Set("Content-Security-Policy", "default-src 'self'; base-uri 'self'; form-action 'self'; object-src 'none'; frame-ancestors 'none'")
		response.Header().Set("Permissions-Policy", "camera=(), geolocation=(), microphone=(), payment=(), usb=()")
		if !s.config.InsecureDevAuth && s.config.SecureCookies {
			response.Header().Set("Strict-Transport-Security", "max-age=63072000")
		}
		if request.URL.Path != "/metrics" {
			response.Header().Set("Cache-Control", "no-store")
		}
		if !s.clientAllowed(request) {
			writeError(response, http.StatusForbidden, "Client network is not allowed")
			return
		}
		id := newRequestID()
		response.Header().Set("X-Request-Id", id)
		s.requestTotal.Add(1)
		next.ServeHTTP(response, request.WithContext(context.WithValue(request.Context(), requestIDKey{}, id)))
	})
}

func (s *Server) clientAllowed(request *http.Request) bool {
	if len(s.config.AllowedClientCIDRs) == 0 {
		return true
	}
	host, _, err := net.SplitHostPort(request.RemoteAddr)
	if err != nil {
		return false
	}
	address, err := netip.ParseAddr(host)
	if err != nil {
		return false
	}
	for _, prefix := range s.config.AllowedClientCIDRs {
		if prefix.Contains(address) {
			return true
		}
	}
	return false
}

func (s *Server) operationError(response http.ResponseWriter, request *http.Request, err error) {
	s.logger.Error("SwarmOps operation failed", "request_id", requestID(request), "method", request.Method, "path", request.URL.Path, "error", err)
	if strings.Contains(err.Error(), "server not found") {
		writeError(response, http.StatusNotFound, "Server was not found")
		return
	}
	if strings.Contains(err.Error(), "select a connected server") || strings.Contains(err.Error(), "server is not connected") {
		writeError(response, http.StatusConflict, "Connect and select a server first")
		return
	}
	if strings.Contains(err.Error(), "audit log is unavailable") {
		writeError(response, http.StatusServiceUnavailable, "The audit log is unavailable; the operation was not attempted")
		return
	}
	if errors.Is(err, ops.ErrOutputLimit) {
		writeError(response, http.StatusBadGateway, "The cluster command produced too much output")
		return
	}
	if errors.Is(err, remote.ErrDockerUnavailable) {
		writeError(response, http.StatusUnprocessableEntity, "Docker is not ready on the selected server. Open Provisioning to prepare it before running cluster operations.")
		return
	}
	if strings.Contains(err.Error(), "invalid") || strings.Contains(err.Error(), "must") || strings.Contains(err.Error(), "disabled") || strings.Contains(err.Error(), "requires") || strings.Contains(err.Error(), "not a remote Swarm manager") || strings.Contains(err.Error(), "exceed") {
		writeError(response, http.StatusUnprocessableEntity, err.Error())
		return
	}
	writeError(response, http.StatusBadGateway, "The cluster operation could not be completed")
}

func (s *Server) connectionError(response http.ResponseWriter, request *http.Request, err error) {
	message, detail, ok := remote.ConnectionErrorDetails(err)
	if !ok {
		s.operationError(response, request, err)
		return
	}
	s.logger.Error("SwarmOps server connection failed", "request_id", requestID(request), "method", request.Method, "path", request.URL.Path, "error", err)
	writeErrorDetail(response, http.StatusBadGateway, message, detail, requestID(request))
}

func (s *Server) record(actor, id, action, target string, err error, detail map[string]string) {
	outcome := "success"
	if err != nil {
		outcome = "failure"
	}
	event := domain.AuditEvent{Action: action, Actor: actor, Detail: detail, Outcome: outcome, RequestID: id, Target: target}
	if _, recordErr := s.audit.Record(event); recordErr != nil {
		// The operation itself has already happened by the time this runs, so
		// a failed audit write must at minimum surface loudly in the logs
		// instead of disappearing into an ignored return value.
		s.logger.Error("SwarmOps audit record was not persisted", "request_id", id, "action", action, "target", target, "outcome", outcome, "error", recordErr)
	}
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

func writeErrorDetail(response http.ResponseWriter, status int, message, detail, id string) {
	payload := map[string]string{"error": message}
	if detail != "" {
		payload["detail"] = detail
	}
	if id != "" {
		payload["requestId"] = id
	}
	writeJSON(response, status, payload)
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

func loginAttemptKey(request *http.Request, username string, trustedProxies []netip.Prefix) string {
	// Forwarded client-address headers are client controlled unless a dedicated
	// trusted-proxy boundary validates them. Without configured trusted proxy
	// networks the socket peer is used directly, which cannot be forged by the
	// browser behind direct TLS.
	return strings.ToLower(strings.TrimSpace(username)) + "|" + clientAddress(request, trustedProxies)
}

// clientAddress returns the limiter identity for one request: the first
// untrusted address in X-Forwarded-For when the socket peer is itself a
// configured trusted proxy, otherwise the socket peer. A malformed or fully
// trusted forwarding chain falls back to the socket peer rather than trusting
// an attacker-supplied value.
func clientAddress(request *http.Request, trustedProxies []netip.Prefix) string {
	peer, _, err := net.SplitHostPort(request.RemoteAddr)
	if err != nil {
		return request.RemoteAddr
	}
	address, err := netip.ParseAddr(peer)
	if err != nil {
		return peer
	}
	if len(trustedProxies) == 0 || !containsPrefix(trustedProxies, address) {
		return peer
	}
	forwarded := strings.Split(request.Header.Get("X-Forwarded-For"), ",")
	for index := len(forwarded) - 1; index >= 0; index-- {
		value := strings.TrimSpace(forwarded[index])
		candidate, err := netip.ParseAddr(value)
		if err != nil || !candidate.IsValid() {
			return peer
		}
		if containsPrefix(trustedProxies, candidate) {
			continue
		}
		return candidate.String()
	}
	return peer
}

func containsPrefix(prefixes []netip.Prefix, address netip.Addr) bool {
	for _, prefix := range prefixes {
		if prefix.Contains(address) {
			return true
		}
	}
	return false
}
