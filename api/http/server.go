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
	"os"
	"strconv"
	"strings"
	"sync/atomic"
	"time"

	"github.com/nimasrn/SwarmOps/internal/agent"
	"github.com/nimasrn/SwarmOps/internal/agentcontrol"
	"github.com/nimasrn/SwarmOps/internal/agentpull"
	"github.com/nimasrn/SwarmOps/internal/audit"
	"github.com/nimasrn/SwarmOps/internal/auth"
	"github.com/nimasrn/SwarmOps/internal/build"
	"github.com/nimasrn/SwarmOps/internal/config"
	"github.com/nimasrn/SwarmOps/internal/coretopology"
	"github.com/nimasrn/SwarmOps/internal/domain"
	"github.com/nimasrn/SwarmOps/internal/insights"
	"github.com/nimasrn/SwarmOps/internal/ops"
	"github.com/nimasrn/SwarmOps/internal/queue"
	"github.com/nimasrn/SwarmOps/internal/remote"
	"github.com/nimasrn/SwarmOps/internal/source"
	"github.com/nimasrn/SwarmOps/internal/web"
)

const (
	sessionCookie          = "swarmops_session"
	plaintextSessionCookie = "swarmops_http_session"
)

type plaintextHTTPContextKey struct{}

// PlaintextHTTPHandler marks requests accepted by the explicitly enabled
// break-glass HTTP listener. The normal HTTPS handler remains unchanged. Agent
// enrollment and polling are never exposed without TLS; only the operator UI
// and its authenticated API can use this transport.
func PlaintextHTTPHandler(next http.Handler) http.Handler {
	return http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		if strings.HasPrefix(request.URL.Path, "/agent/") {
			writeError(response, http.StatusUpgradeRequired, "Machine agents require HTTPS")
			return
		}
		response.Header().Set("X-SwarmOps-Transport", "plaintext-http")
		ctx := context.WithValue(request.Context(), plaintextHTTPContextKey{}, true)
		next.ServeHTTP(response, request.WithContext(ctx))
	})
}

func isPlaintextHTTPRequest(request *http.Request) bool {
	plaintext, _ := request.Context().Value(plaintextHTTPContextKey{}).(bool)
	return plaintext
}

func sessionCookieName(request *http.Request) string {
	if isPlaintextHTTPRequest(request) {
		return plaintextSessionCookie
	}
	return sessionCookie
}

// Target contains the fixed-shape control services for one authenticated,
// selected server. The resolver owns the machine API key; HTTP handlers never
// see it and cannot pick a raw Docker endpoint.
type Target struct {
	Build       build.Service
	Control     *ops.ControlPlane
	Host        HostInspector
	Joiner      SwarmJoiner
	Meter       MachineMeter
	Provisioner Provisioner
}

// HostInspector exposes only the agent's bounded host snapshot. Keeping this
// separate from Provisioner lets an older agent retain readiness controls even
// when it cannot yet report the newer inventory projection.
type HostInspector interface {
	Snapshot(context.Context) (agent.Snapshot, error)
}

// SwarmJoiner is the one surface that returns a Swarm join token, and it is
// reachable only from the command worker. It is separate from Provisioner so
// that "this agent can prepare a host" and "this agent can hand out the
// cluster's join credential" stay two different capabilities.
type SwarmJoiner interface {
	SwarmJoinToken(ctx context.Context, role string) (agentcontrol.SwarmJoinToken, error)
}

// Provisioner is intentionally narrower than ops.Runner: it exposes only the
// agent's reviewed server-readiness plan and no shell, Docker socket, or file
// access. It remains usable before a host has Docker or joined a Swarm.
type Provisioner interface {
	Provision(context.Context, agentcontrol.ProvisioningRequest) error
	ProvisioningStatus(context.Context) (agentcontrol.ProvisioningStatus, error)
}

type TargetResolver interface {
	Resolve(id string) (Target, error)
}

type TargetResolverFunc func(id string) (Target, error)

func (f TargetResolverFunc) Resolve(id string) (Target, error) { return f(id) }

type Server struct {
	audit          *audit.Store
	auth           *auth.Service
	config         config.Config
	commands       *queue.Store
	core           *coretopology.Store
	history        *insights.History
	loginLimiter   *auth.LoginLimiter
	logger         *slog.Logger
	requestTotal   atomic.Uint64
	machineSamples *machineMetricsCache
	servers        *remote.Manager
	sources        *source.Service
	apps           *ops.ApplicationStore
	agentBroker    *agentpull.Broker
	agentRegistry  *agentpull.Registry
	namespace      string
	targets        TargetResolver
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
	core, err := coretopology.Open(cfg.DataDir, cfg.DataEncryptionKey, coretopology.Config{
		Endpoint: cfg.CoreEndpoint,
		ID:       cfg.CoreID,
		Mode:     domain.CoreRole(cfg.CoreMode),
		Name:     cfg.CoreName,
	})
	if err != nil {
		return nil, err
	}
	registry, err := agentpull.OpenRegistry(cfg.DataDir, cfg.DataEncryptionKey, core.AuthorityEpoch())
	if err != nil {
		return nil, err
	}
	return &Server{audit: auditStore, agentBroker: agentpull.NewBroker(core.AuthorityEpoch()), agentRegistry: registry, machineSamples: newMachineMetricsCache(), auth: authService, commands: commandStore, config: cfg, core: core, history: insights.NewHistory(insights.DefaultLimit), loginLimiter: auth.NewLoginLimiter(8, 15*time.Minute), logger: logger, servers: servers, targets: targets}, nil
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
	// One endpoint per enrolled machine. Agents hold no inbound port, so Core
	// is the only place a scrape can terminate; see api/http/machine_metrics.go.
	mux.HandleFunc("GET /metrics/machines/{id}", s.machineMetrics)
	mux.HandleFunc("POST /api/v1/auth/login", s.login)
	mux.HandleFunc("GET /api/v1/auth/me", s.withAuth(false, s.me))
	mux.HandleFunc("POST /api/v1/auth/logout", s.withAuth(true, s.logout))
	mux.HandleFunc("POST /api/v1/agents/enrollment-tokens", s.withActiveAuth(s.agentEnrollmentToken))
	mux.HandleFunc("POST /api/v1/agents/claims/approve", s.withActiveAuth(s.agentClaimApprove))
	mux.HandleFunc("GET /agent/v1/identity", s.agentIdentity)
	mux.HandleFunc("POST /agent/v1/enroll", s.agentEnrollPull)
	mux.HandleFunc("POST /agent/v1/claims", s.agentClaimStart)
	mux.HandleFunc("POST /agent/v1/claims/redeem", s.agentClaimRedeem)
	mux.HandleFunc("POST /agent/v1/poll", s.agentPoll)
	mux.HandleFunc("POST /agent/v1/responses", s.agentResponse)
	mux.HandleFunc("POST /agent/v1/certificates/renew", s.agentCertificateRenew)
	mux.HandleFunc("GET /api/v1/core", s.withAuth(false, s.coreStatus))
	mux.HandleFunc("POST /api/v1/core/replicas", s.withActiveAuth(s.coreReplicaAdd))
	mux.HandleFunc("POST /api/v1/core/replicas/{id}/verify", s.withActiveAuth(s.coreReplicaVerify))
	mux.HandleFunc("POST /api/v1/core/handoff", s.withActiveAuth(s.coreHandoffPrepare))
	mux.HandleFunc("POST /api/v1/core/handoff/{id}/fence", s.withActiveAuth(s.coreHandoffFence))
	mux.HandleFunc("POST /api/v1/core/promote", s.withAuth(true, s.corePromote))
	mux.HandleFunc("GET /api/v1/servers", s.withAuth(false, s.serversList))
	mux.HandleFunc("POST /api/v1/servers", s.withActiveAuth(s.serverAdd))
	mux.HandleFunc("POST /api/v1/servers/enroll", s.withActiveAuth(s.serverEnroll))
	mux.HandleFunc("POST /api/v1/servers/{id}/connect", s.withActiveAuth(s.serverConnect))
	mux.HandleFunc("POST /api/v1/servers/{id}/disconnect", s.withActiveAuth(s.serverDisconnect))
	mux.HandleFunc("DELETE /api/v1/servers/{id}", s.withActiveAuth(s.serverRemove))
	mux.HandleFunc("GET /api/v1/services/{id}/diagnosis", s.withAuth(false, s.serviceDiagnosis))
	mux.HandleFunc("GET /api/v1/diagnosis/rules", s.withAuth(false, s.diagnosisRules))
	mux.HandleFunc("POST /api/v1/import/kubernetes", s.withAuth(false, s.k8sImport))
	mux.HandleFunc("POST /api/v1/services/{id}/change-preview", s.withAuth(false, s.changePreview))
	mux.HandleFunc("GET /api/v1/servers/{id}/diagnostics", s.withAuth(false, s.serverDiagnostics))
	mux.HandleFunc("POST /api/v1/servers/{id}/agent-update", s.withActiveAuth(s.serverUpdate))
	mux.HandleFunc("GET /api/v1/servers/{id}/readiness", s.withAuth(false, s.serverReadiness))
	mux.HandleFunc("POST /api/v1/servers/{id}/readiness", s.withActiveAuth(s.serverReadinessQueue))
	mux.HandleFunc("GET /api/v1/overview", s.withAuth(false, s.overview))
	mux.HandleFunc("GET /api/v1/nodes", s.withAuth(false, s.nodes))
	mux.HandleFunc("GET /api/v1/nodes/{id}", s.withAuth(false, s.node))
	mux.HandleFunc("GET /api/v1/nodes/{id}/tasks", s.withAuth(false, s.nodeTasks))
	mux.HandleFunc("POST /api/v1/nodes/{id}/availability", s.withActiveAuth(s.nodeAvailability))
	mux.HandleFunc("GET /api/v1/stacks", s.withAuth(false, s.stacks))
	mux.HandleFunc("POST /api/v1/stacks/validate", s.withActiveAuth(s.stackValidate))
	mux.HandleFunc("POST /api/v1/stacks/deploy", s.withActiveAuth(s.stackDeploy))
	mux.HandleFunc("GET /api/v1/services", s.withAuth(false, s.services))
	mux.HandleFunc("GET /api/v1/services/{id}/logs", s.withAuth(false, s.serviceLogs))
	mux.HandleFunc("GET /api/v1/logs", s.withAuth(false, s.logs))
	mux.HandleFunc("GET /api/v1/logs/status", s.withAuth(false, s.logsStatus))
	mux.HandleFunc("POST /api/v1/services/{id}/actions", s.withActiveAuth(s.serviceAction))
	mux.HandleFunc("POST /api/v1/builds", s.withActiveAuth(s.buildImage))
	mux.HandleFunc("GET /api/v1/traefik/status", s.withAuth(false, s.traefikStatus))
	mux.HandleFunc("GET /api/v1/traefik/preflight", s.withAuth(false, s.traefikPreflight))
	mux.HandleFunc("POST /api/v1/traefik/prerequisites/repair", s.withActiveAuth(s.traefikPrerequisitesRepair))
	mux.HandleFunc("POST /api/v1/traefik/reconcile", s.withActiveAuth(s.traefikReconcile))
	mux.HandleFunc("GET /api/v1/traefik/state", s.withAuth(false, s.traefikRoutingState))
	mux.HandleFunc("GET /api/v1/traefik/routes", s.withAuth(false, s.traefikRoutes))
	mux.HandleFunc("POST /api/v1/traefik/routes/plan", s.withActiveAuth(s.traefikRoutePlan))
	mux.HandleFunc("POST /api/v1/traefik/routes", s.withActiveAuth(s.traefikRouteApply))
	mux.HandleFunc("POST /api/v1/traefik/services/{service}/role", s.withActiveAuth(s.traefikServiceRole))
	mux.HandleFunc("POST /api/v1/traefik/bindings", s.withActiveAuth(s.traefikBindingApply))
	mux.HandleFunc("POST /api/v1/traefik/settings", s.withActiveAuth(s.traefikSettingsApply))
	mux.HandleFunc("POST /api/v1/traefik/dns/credentials", s.withActiveAuth(s.traefikDNSCredential))
	mux.HandleFunc("DELETE /api/v1/traefik/dns/credentials/{id}/versions/{version}", s.withActiveAuth(s.traefikDNSCredentialRemove))
	mux.HandleFunc("POST /api/v1/traefik/dns/records/preview", s.withActiveAuth(s.traefikDNSRecordPreview))
	mux.HandleFunc("POST /api/v1/traefik/dns/records", s.withActiveAuth(s.traefikDNSRecordApply))
	mux.HandleFunc("DELETE /api/v1/traefik/dns/records/{id}", s.withActiveAuth(s.traefikDNSRecordDelete))
	mux.HandleFunc("GET /api/v1/traefik/dns/records/{id}/verify", s.withAuth(false, s.traefikDNSVerify))
	mux.HandleFunc("GET /api/v1/traefik/runtime", s.withAuth(false, s.traefikRuntime))
	mux.HandleFunc("GET /api/v1/traefik/certificates", s.withAuth(false, s.traefikCertificates))
	mux.HandleFunc("POST /api/v1/traefik/certificates/{route}/retry", s.withActiveAuth(s.traefikCertificateRetry))
	mux.HandleFunc("GET /api/v1/traefik/logs", s.withAuth(false, s.traefikLogs))
	mux.HandleFunc("GET /api/v1/traefik/prometheus", s.withAuth(false, s.traefikPrometheus))
	mux.HandleFunc("GET /api/v1/traefik/cutover/plan", s.withAuth(false, s.traefikCutoverPlan))
	mux.HandleFunc("POST /api/v1/traefik/cutover", s.withActiveAuth(s.traefikCutover))
	mux.HandleFunc("GET /api/v1/observability/status", s.withAuth(false, s.observabilityStatus))
	mux.HandleFunc("POST /api/v1/observability/node-agent", s.withActiveAuth(s.nodeAgentCollection))
	mux.HandleFunc("POST /api/v1/observability/core", s.withActiveAuth(s.coreObservability))
	mux.HandleFunc("POST /api/v1/observability/logs", s.withActiveAuth(s.logsCollection))
	mux.HandleFunc("GET /api/v1/applications", s.withAuth(false, s.applications))
	mux.HandleFunc("GET /api/v1/applications/approved", s.withAuth(false, s.approvedApplications))
	mux.HandleFunc("POST /api/v1/applications/plan", s.withActiveAuth(s.applicationPlan))
	mux.HandleFunc("POST /api/v1/applications", s.withActiveAuth(s.applicationDeploy))
	mux.HandleFunc("POST /api/v1/applications/{name}/remove", s.withActiveAuth(s.applicationRemove))
	mux.HandleFunc("POST /api/v1/applications/{name}/domain", s.withActiveAuth(s.applicationDomain))
	mux.HandleFunc("GET /api/v1/sources/status", s.withAuth(false, s.sourceStatus))
	mux.HandleFunc("GET /api/v1/sources/connections", s.withAuth(false, s.sourceConnections))
	mux.HandleFunc("POST /api/v1/sources/connections", s.withActiveAuth(s.sourceConnectionCreate))
	mux.HandleFunc("PUT /api/v1/sources/connections/{id}", s.withActiveAuth(s.sourceConnectionUpdate))
	mux.HandleFunc("DELETE /api/v1/sources/connections/{id}", s.withActiveAuth(s.sourceConnectionRemove))
	mux.HandleFunc("GET /api/v1/sources/connections/{id}/repositories", s.withAuth(false, s.sourceRepositories))
	mux.HandleFunc("POST /api/v1/sources/discover", s.withActiveAuth(s.sourceDiscover))
	mux.HandleFunc("POST /api/v1/sources/deploy", s.withActiveAuth(s.sourceDeploy))
	mux.HandleFunc("GET /api/v1/databases", s.withAuth(false, s.databases))
	mux.HandleFunc("POST /api/v1/databases/{engine}", s.withActiveAuth(s.databaseSet))
	mux.HandleFunc("GET /api/v1/insights", s.withAuth(false, s.insights))
	mux.HandleFunc("GET /api/v1/insights/history", s.withAuth(false, s.insightsHistory))
	mux.HandleFunc("GET /api/v1/events", s.withAuth(false, s.events))
	mux.HandleFunc("GET /api/v1/system/df", s.withAuth(false, s.diskUsage))
	mux.HandleFunc("GET /api/v1/swarm", s.withAuth(false, s.swarm))
	mux.HandleFunc("POST /api/v1/swarm", s.withActiveAuth(s.swarmUpdate))
	mux.HandleFunc("POST /api/v1/swarm/join-token", s.withActiveAuth(s.swarmTokenRotate))
	mux.HandleFunc("GET /api/v1/services/{id}", s.withAuth(false, s.serviceDetail))
	mux.HandleFunc("POST /api/v1/services/{id}/image", s.withActiveAuth(s.serviceImage))
	mux.HandleFunc("POST /api/v1/services/{id}/limits", s.withActiveAuth(s.serviceLimits))
	mux.HandleFunc("POST /api/v1/services/{id}/remove", s.withActiveAuth(s.serviceRemove))
	mux.HandleFunc("GET /api/v1/tasks/{id}", s.withAuth(false, s.task))
	mux.HandleFunc("POST /api/v1/nodes/{id}/role", s.withActiveAuth(s.nodeRole))
	mux.HandleFunc("POST /api/v1/nodes/{id}/labels", s.withActiveAuth(s.nodeLabel))
	mux.HandleFunc("POST /api/v1/nodes/{id}/remove", s.withActiveAuth(s.nodeRemove))
	mux.HandleFunc("POST /api/v1/stacks/{name}/remove", s.withActiveAuth(s.stackRemove))
	mux.HandleFunc("GET /api/v1/containers", s.withAuth(false, s.containers))
	mux.HandleFunc("GET /api/v1/containers/{id}", s.withAuth(false, s.container))
	mux.HandleFunc("GET /api/v1/containers/{id}/stats", s.withAuth(false, s.containerStats))
	mux.HandleFunc("POST /api/v1/containers/{id}/actions", s.withActiveAuth(s.containerAction))
	mux.HandleFunc("GET /api/v1/images", s.withAuth(false, s.images))
	mux.HandleFunc("GET /api/v1/images/{id}", s.withAuth(false, s.image))
	mux.HandleFunc("POST /api/v1/images/pull", s.withActiveAuth(s.imagePull))
	mux.HandleFunc("POST /api/v1/images/remove", s.withActiveAuth(s.imageRemove))
	mux.HandleFunc("GET /api/v1/volumes", s.withAuth(false, s.volumes))
	mux.HandleFunc("POST /api/v1/volumes", s.withActiveAuth(s.volumeCreate))
	mux.HandleFunc("GET /api/v1/volumes/{name}", s.withAuth(false, s.volume))
	mux.HandleFunc("POST /api/v1/volumes/{name}/remove", s.withActiveAuth(s.volumeRemove))
	mux.HandleFunc("GET /api/v1/networks", s.withAuth(false, s.networks))
	mux.HandleFunc("POST /api/v1/networks", s.withActiveAuth(s.networkCreate))
	mux.HandleFunc("GET /api/v1/networks/{id}", s.withAuth(false, s.network))
	mux.HandleFunc("POST /api/v1/networks/{name}/remove", s.withActiveAuth(s.networkRemove))
	mux.HandleFunc("GET /api/v1/secrets", s.withAuth(false, s.secrets))
	mux.HandleFunc("GET /api/v1/configs", s.withAuth(false, s.configs))
	mux.HandleFunc("POST /api/v1/configs/{name}/remove", s.withActiveAuth(s.configRemove))
	mux.HandleFunc("POST /api/v1/prune/{resource}", s.withActiveAuth(s.prune))
	mux.HandleFunc("GET /api/v1/commands/catalogue", s.withAuth(false, s.commandCatalogue))
	mux.HandleFunc("GET /api/v1/audit-events", s.withAuth(false, s.auditEvents))
	mux.HandleFunc("GET /api/v1/commands", s.withAuth(false, s.commandsList))
	mux.HandleFunc("GET /api/v1/commands/{id}", s.withAuth(false, s.commandGet))
	mux.HandleFunc("POST /api/v1/commands/{id}/retry", s.withActiveAuth(s.commandRetry))
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
	http.SetCookie(response, &http.Cookie{Name: sessionCookieName(request), Value: token, Path: "/", MaxAge: int(s.config.SessionTTL.Seconds()), HttpOnly: true, SameSite: http.SameSiteStrictMode, Secure: s.config.SecureCookies && !isPlaintextHTTPRequest(request)})
	s.record(claims.Username, requestID(request), "auth.login", "session", nil, nil)
	writeJSON(response, http.StatusOK, map[string]any{"csrfToken": claims.CSRF, "user": map[string]string{"username": claims.Username}})
}

func (s *Server) me(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
	writeJSON(response, http.StatusOK, map[string]any{"csrfToken": claims.CSRF, "user": map[string]string{"username": claims.Username}})
}

func (s *Server) logout(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
	http.SetCookie(response, &http.Cookie{Name: sessionCookieName(request), Value: "", Path: "/", MaxAge: -1, HttpOnly: true, SameSite: http.SameSiteStrictMode, Secure: s.config.SecureCookies && !isPlaintextHTTPRequest(request)})
	s.record(claims.Username, requestID(request), "auth.logout", "session", nil, nil)
	response.WriteHeader(http.StatusNoContent)
}

func (s *Server) serversList(response http.ResponseWriter, _ *http.Request, _ auth.Claims) {
	writeJSON(response, http.StatusOK, s.servers.List())
}

// serverEnroll is the one-paste path: the operator supplies only the token the
// installer printed. The controller performs the one-time secret exchange and
// never shows or stores the machine API key it receives.
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
	s.machineSamples.forget(id)
	s.record(claims.Username, requestID(request), "server.disconnect", "server/"+id, nil, nil)
	response.WriteHeader(http.StatusNoContent)
}

func (s *Server) serverRemove(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
	id := request.PathValue("id")
	if err := s.servers.Remove(id); err != nil {
		s.operationError(response, request, err)
		return
	}
	// A removed machine must stop answering a scrape from cache.
	s.machineSamples.forget(id)
	s.record(claims.Username, requestID(request), "server.remove", "server/"+id, nil, nil)
	response.WriteHeader(http.StatusNoContent)
}

func (s *Server) targetFor(response http.ResponseWriter, request *http.Request) (Target, bool) {
	if !s.requireActiveControl(response) {
		return Target{}, false
	}
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
	dashboardURL, err := target.Control.TraefikDashboardURL()
	if err != nil {
		s.operationError(response, request, err)
		return
	}
	for _, service := range services {
		if service.Name == "traefik_traefik" {
			writeJSON(response, http.StatusOK, map[string]any{"dashboardURL": dashboardURL, "service": service})
			return
		}
	}
	writeJSON(response, http.StatusOK, map[string]any{"dashboardURL": dashboardURL, "service": nil})
}

func (s *Server) traefikReconcile(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
	var input traefikCommand
	if !decodeJSON(response, request, &input) {
		return
	}
	if input.Confirmation != "DEPLOY_TRAEFIK" {
		writeError(response, http.StatusUnprocessableEntity, "deployment requires confirmation DEPLOY_TRAEFIK")
		return
	}
	target, ok := s.targetFor(response, request)
	if !ok {
		return
	}
	// Installation prerequisites are controller-owned, non-secret settings.
	// Reject them before enqueueing so the initiating panel can explain the
	// exact corrective action; the worker validates again before mutation.
	if err := target.Control.ValidateTraefikInstall(input.Confirmation, input.DashboardHost); err != nil {
		writeError(response, http.StatusUnprocessableEntity, err.Error())
		return
	}
	preflight, err := s.traefikPreflightFor(request, target)
	if err != nil {
		s.operationError(response, request, err)
		return
	}
	if !preflight.Ready {
		for _, check := range preflight.Checks {
			if check.Required && check.State == "blocked" {
				writeError(response, http.StatusUnprocessableEntity, check.Detail)
				return
			}
		}
	}
	s.submitTraefik(response, request, claims, input.Confirmation, input.DashboardHost)
}

func (s *Server) traefikPreflight(response http.ResponseWriter, request *http.Request, _ auth.Claims) {
	target, ok := s.targetFor(response, request)
	if !ok {
		return
	}
	preflight, err := s.traefikPreflightFor(request, target)
	if err != nil {
		s.operationError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, preflight)
}

func (s *Server) traefikPrerequisitesRepair(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
	target, ok := s.targetFor(response, request)
	if !ok {
		return
	}
	preflight, err := s.traefikPreflightFor(request, target)
	if err != nil {
		s.operationError(response, request, err)
		return
	}
	if !preflight.Repairable {
		writeError(response, http.StatusUnprocessableEntity, "The incomplete Traefik prerequisites cannot all be repaired automatically")
		return
	}
	repair, err := target.Control.PlanTraefikPrerequisiteRepair(request.Context())
	if err != nil {
		writeError(response, http.StatusUnprocessableEntity, err.Error())
		return
	}
	username, password := "", ""
	if repair.CreateDashboardAuth {
		username = "operator"
		password, repair.DashboardAuth, err = generateDashboardCredential()
		if err != nil {
			writeError(response, http.StatusInternalServerError, "Dashboard credentials could not be generated")
			return
		}
	}
	s.submitTraefikPrerequisites(response, request, claims, repair, username, password)
}

func (s *Server) traefikPreflightFor(request *http.Request, target Target) (ops.TraefikInstallPreflight, error) {
	preflight, err := target.Control.TraefikInstallPreflight(request.Context())
	if err != nil {
		return ops.TraefikInstallPreflight{}, err
	}
	serverID := strings.TrimSpace(request.Header.Get("X-SwarmOps-Server-ID"))
	version := "Not reported"
	protocol := uint(0)
	for _, profile := range s.servers.List() {
		if profile.ID == serverID {
			if profile.AgentHealth.AgentVersion != "" {
				version = profile.AgentHealth.AgentVersion
			}
			protocol = profile.AgentHealth.ProtocolVersion
			break
		}
	}
	compatible := protocol == agentpull.ProtocolVersion && agentVersionAtLeast(version, 0, 9, 3)
	check := ops.TraefikInstallCheck{
		Detail:   fmt.Sprintf("Agent %s reports protocol %d; one-button Traefik repair requires Agent v0.9.3 or newer on Core protocol %d.", version, protocol, agentpull.ProtocolVersion),
		ID:       "agent-version",
		Label:    "Machine agent compatibility",
		Recovery: "Update the selected server's agent before installing Traefik.",
		Required: true,
		State:    "blocked",
	}
	if compatible {
		check.State = "ready"
		check.Recovery = ""
	}
	preflight.Checks = append(preflight.Checks, check)
	ops.FinalizeTraefikInstallPreflight(&preflight)
	return preflight, nil
}

func agentVersionAtLeast(value string, requiredMajor, requiredMinor, requiredPatch int) bool {
	var major, minor, patch int
	if _, err := fmt.Sscanf(strings.TrimPrefix(strings.TrimSpace(value), "v"), "%d.%d.%d", &major, &minor, &patch); err != nil {
		return false
	}
	if major != requiredMajor {
		return major > requiredMajor
	}
	if minor != requiredMinor {
		return minor > requiredMinor
	}
	return patch >= requiredPatch
}

// metricsTargets serves the Prometheus HTTP service-discovery document for
// every rendered application that publishes metrics.
// metricsTargets is what Prometheus polls instead of holding a Docker socket
// or having its config regenerated. It carries two kinds of target: the
// applications SwarmOps rendered, and one entry per enrolled machine whose
// scrape Core terminates on that machine's behalf.
func (s *Server) metricsTargets(response http.ResponseWriter, request *http.Request) {
	// Prometheus cannot rewrite a target's `job` from a discovery response, so
	// applications and machines are asked for separately and land in the job
	// each belongs to. No parameter means both, which is what the shipped
	// configuration asked for before machines existed.
	kind := request.URL.Query().Get("kind")
	targets := []ops.MetricsTarget{}
	if kind == "" || kind == "application" {
		targets = append(targets, ops.MetricsTargetsFor(s.apps, s.namespace)...)
	}
	if kind == "" || kind == "machine" {
		targets = append(targets, machineMetricsTargets(s.servers.List())...)
	}
	writeJSON(response, http.StatusOK, targets)
}

// SetApplicationDiscovery supplies the stored applications and reviewed
// namespace used by the Prometheus discovery endpoint. It is separate from the
// per-server control planes because discovery must answer even when no machine
// API is connected.
func (s *Server) SetApplicationDiscovery(apps *ops.ApplicationStore, namespace string) {
	s.apps = apps
	s.namespace = namespace
}

// SetSourceService enables the optional sealed Git-provider boundary. Keeping
// it out of New preserves the default-off posture for existing deployments.
func (s *Server) SetSourceService(service *source.Service) {
	s.sources = service
}

func (s *Server) sourceStatus(response http.ResponseWriter, _ *http.Request, _ auth.Claims) {
	writeJSON(response, http.StatusOK, map[string]any{
		"buildEnabled":           s.config.BuildEnabled,
		"enabled":                s.config.SourceEnabled && s.sources != nil,
		"imagePrefixConfigured":  strings.TrimSpace(s.config.SourceImagePrefix) != "",
		"privateHostsConfigured": len(s.config.SourceAllowedHosts) > 0,
	})
}

func (s *Server) sourceConnections(response http.ResponseWriter, _ *http.Request, _ auth.Claims) {
	if !s.requireSource(response) {
		return
	}
	writeJSON(response, http.StatusOK, s.sources.Connections())
}

func (s *Server) sourceConnectionCreate(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
	if !s.requireSource(response) {
		return
	}
	var input source.ConnectionInput
	if !decodeJSON(response, request, &input) {
		return
	}
	defer func() { input.Token = "" }()
	connection, err := s.sources.CreateConnection(request.Context(), input)
	if err != nil {
		s.record(claims.Username, requestID(request), "source.connection-created", "source-connection/new", err, map[string]string{"provider": string(input.Kind)})
		s.sourceRequestError(response, err)
		return
	}
	s.record(claims.Username, requestID(request), "source.connection-created", "source-connection/"+connection.ID, nil, map[string]string{"provider": string(connection.Kind)})
	writeJSON(response, http.StatusCreated, connection)
}

func (s *Server) sourceConnectionUpdate(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
	if !s.requireSource(response) {
		return
	}
	var input source.ConnectionInput
	if !decodeJSON(response, request, &input) {
		return
	}
	defer func() { input.Token = "" }()
	connection, err := s.sources.UpdateConnection(request.Context(), request.PathValue("id"), input)
	if err != nil {
		s.record(claims.Username, requestID(request), "source.connection-updated", "source-connection/"+request.PathValue("id"), err, map[string]string{"provider": string(input.Kind)})
		s.sourceRequestError(response, err)
		return
	}
	s.record(claims.Username, requestID(request), "source.connection-updated", "source-connection/"+connection.ID, nil, map[string]string{"provider": string(connection.Kind)})
	writeJSON(response, http.StatusOK, connection)
}

func (s *Server) sourceConnectionRemove(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
	if !s.requireSource(response) {
		return
	}
	id := request.PathValue("id")
	if err := s.sources.RemoveConnection(id); err != nil {
		s.sourceRequestError(response, err)
		return
	}
	s.record(claims.Username, requestID(request), "source.connection-removed", "source-connection/"+id, nil, nil)
	response.WriteHeader(http.StatusNoContent)
}

func (s *Server) sourceRepositories(response http.ResponseWriter, request *http.Request, _ auth.Claims) {
	if !s.requireSource(response) {
		return
	}
	repositories, err := s.sources.Repositories(request.Context(), request.PathValue("id"))
	if err != nil {
		s.sourceRequestError(response, err)
		return
	}
	writeJSON(response, http.StatusOK, repositories)
}

func (s *Server) sourceDiscover(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
	if !s.requireSource(response) {
		return
	}
	var input source.DiscoverRequest
	if !decodeJSON(response, request, &input) {
		return
	}
	plan, err := s.sources.Discover(request.Context(), input)
	if err != nil {
		s.record(claims.Username, requestID(request), "source.discover", "repository/unknown", err, nil)
		s.sourceRequestError(response, err)
		return
	}
	s.record(claims.Username, requestID(request), "source.discover", "repository/"+plan.Repository.ID, nil, map[string]string{"plan_id": plan.ID, "revision": plan.Revision.SHA, "scanner": plan.Scanner})
	writeJSON(response, http.StatusOK, plan)
}

func (s *Server) sourceDeploy(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
	var input struct {
		Application ops.ApplicationSpec `json:"application"`
		Selection   source.Selection    `json:"selection"`
	}
	if !decodeJSON(response, request, &input) {
		return
	}
	s.submitSourceDeploy(response, request, claims, input.Selection, input.Application)
}

func (s *Server) requireSource(response http.ResponseWriter) bool {
	if !s.config.SourceEnabled || s.sources == nil {
		writeError(response, http.StatusServiceUnavailable, "Source deployment is disabled; set SWARMOPS_SOURCE_ENABLED=true")
		return false
	}
	return true
}

func (s *Server) sourceRequestError(response http.ResponseWriter, err error) {
	if errors.Is(err, os.ErrNotExist) {
		writeError(response, http.StatusNotFound, "Source connection was not found")
		return
	}
	message := err.Error()
	if strings.Contains(message, "provider request failed") || strings.Contains(message, "provider archive") {
		writeError(response, http.StatusBadGateway, message)
		return
	}
	writeError(response, http.StatusUnprocessableEntity, message)
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

func (s *Server) applicationDomain(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
	var input struct {
		Confirmation string `json:"confirmation"`
		Domain       string `json:"domain"`
		Resolver     string `json:"resolver"`
	}
	if !decodeJSON(response, request, &input) {
		return
	}
	s.submitApplicationDomain(response, request, claims, applicationDomainCommand{
		Confirmation: input.Confirmation,
		Domain:       input.Domain,
		Name:         request.PathValue("name"),
		Resolver:     input.Resolver,
	})
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
		cookie, err := request.Cookie(sessionCookieName(request))
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
		if !s.config.InsecureDevAuth && s.config.SecureCookies && !isPlaintextHTTPRequest(request) {
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
	s.observeAgentFailure(request, err)
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
	if strings.Contains(strings.ToLower(err.Error()), "log collection") || strings.Contains(strings.ToLower(err.Error()), "fixed fluentd adapter") {
		writeError(response, http.StatusServiceUnavailable, "Log collection is unavailable on the selected server. Enable or repair the SwarmOps Logs stack.")
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
	if message, detail, ok := remote.ConnectionErrorDetails(err); ok {
		writeErrorDetail(response, http.StatusBadGateway, message, detail, requestID(request))
		return
	}
	if strings.Contains(err.Error(), "invalid") || strings.Contains(err.Error(), "must") || strings.Contains(err.Error(), "disabled") || strings.Contains(err.Error(), "requires") || strings.Contains(err.Error(), "not a remote Swarm manager") || strings.Contains(err.Error(), "exceed") {
		writeError(response, http.StatusUnprocessableEntity, err.Error())
		return
	}
	writeError(response, http.StatusBadGateway, "The cluster operation could not be completed")
}

func (s *Server) observeAgentFailure(request *http.Request, err error) {
	if s.servers == nil || err == nil {
		return
	}
	id := strings.TrimSpace(request.Header.Get("X-SwarmOps-Server-ID"))
	if id == "" {
		id = strings.TrimSpace(request.PathValue("id"))
	}
	if id == "" {
		return
	}
	if observeErr := s.servers.ObserveFailure(id, err); observeErr != nil {
		s.logger.Error("record machine-agent health failure", "request_id", requestID(request), "server_id", id, "error", observeErr)
	}
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
