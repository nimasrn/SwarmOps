package agent

import (
	"bytes"
	"context"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os/exec"
	"path"
	"strconv"
	"strings"
	"time"

	"github.com/nimasrn/SwarmOps/internal/agentcontrol"
)

const (
	commandOutputLimit  = 256 << 10
	commandTimeout      = 10 * time.Minute
	buildTimeout        = 30 * time.Minute
	registryConfigLimit = 64 << 10
)

type Server struct {
	config     Config
	enrollment *enrollment
	token      []byte
}

func NewServer(config Config, token []byte) (*Server, error) {
	if len(token) < 16 {
		return nil, fmt.Errorf("agent token must contain at least 16 bytes")
	}
	if config.RemoteControlEnabled && config.Docker == nil {
		return nil, fmt.Errorf("remote control requires a Docker client")
	}
	if config.RemoteControlEnabled && (config.BuildMaxBytes < 0 || config.BuildMaxCPUs < 0 || config.BuildMaxMemoryMiB < 0) {
		return nil, fmt.Errorf("remote-control build limits cannot be negative")
	}
	pending, err := newEnrollment(config.EnrollmentSecret, config.EnrollmentSecretFile)
	if err != nil {
		return nil, err
	}
	return &Server{config: config, enrollment: pending, token: append([]byte(nil), token...)}, nil
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", s.health)
	mux.HandleFunc("GET /metrics", s.metrics)
	mux.HandleFunc("GET /v1/status", s.status)
	mux.HandleFunc("GET /v1/snapshot", s.snapshot)
	mux.HandleFunc("GET /v1/fleet-runs/{id}", s.fleetRun)
	if s.enrollment != nil {
		// One-time, single-use exchange of the installer's enrollment secret
		// for the machine API key. It closes permanently after first use.
		mux.HandleFunc("POST /v1/enroll", s.enroll)
	}
	if s.config.RemoteControlEnabled {
		// These are fixed, authenticated operations backed by the local Docker
		// client. They are not a Docker-socket or arbitrary-command proxy.
		mux.HandleFunc("GET /v1/engine/_ping", s.enginePing)
		mux.HandleFunc("GET /v1/engine/info", s.engineInfo)
		mux.HandleFunc("GET /v1/engine/version", s.engineVersion)
		mux.HandleFunc("GET /v1/engine/nodes", s.engineNodes)
		mux.HandleFunc("GET /v1/engine/services", s.engineServices)
		mux.HandleFunc("GET /v1/engine/tasks", s.engineTasks)
		mux.HandleFunc("POST /v1/engine/build", s.engineBuild)
		mux.HandleFunc("POST /v1/commands", s.command)
	}
	return mux
}

func (s *Server) health(response http.ResponseWriter, _ *http.Request) {
	response.Header().Set("Content-Type", "application/json")
	_, _ = response.Write([]byte(`{"status":"ok"}`))
}

func (s *Server) snapshot(response http.ResponseWriter, request *http.Request) {
	if !s.authorized(request) {
		http.Error(response, "unauthorized", http.StatusUnauthorized)
		return
	}
	value, err := Collect(request.Context(), s.config)
	if err != nil {
		http.Error(response, "snapshot unavailable", http.StatusServiceUnavailable)
		return
	}
	writeJSON(response, value)
}

// Status is the connection handshake for a direct machine agent. It contains
// no credentials, command output, or filesystem data.
func (s *Server) status(response http.ResponseWriter, request *http.Request) {
	if !s.authorized(request) {
		http.Error(response, "unauthorized", http.StatusUnauthorized)
		return
	}
	value := Status{NodeName: s.config.NodeName, RemoteControlEnabled: s.config.RemoteControlEnabled, Version: s.config.Version}
	if value.NodeName == "" {
		value.NodeName = "agent"
	}
	if s.config.Docker != nil && s.config.Docker.Ping(request.Context()) == nil {
		value.DockerAvailable = true
		if version, err := s.config.Docker.Version(request.Context()); err == nil {
			value.DockerVersion = version.Version
		}
		if info, err := s.config.Docker.Info(request.Context()); err == nil {
			value.SwarmControlAvailable = info.Swarm.ControlAvailable
			value.SwarmState = info.Swarm.LocalNodeState
		}
	}
	writeJSON(response, value)
}

func (s *Server) fleetRun(response http.ResponseWriter, request *http.Request) {
	if !s.authorized(request) {
		http.Error(response, "unauthorized", http.StatusUnauthorized)
		return
	}
	value, err := ReadRunStatus(s.config, request.PathValue("id"))
	if errors.Is(err, ErrRunNotFound) {
		http.Error(response, "not found", http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(response, "fleet status unavailable", http.StatusServiceUnavailable)
		return
	}
	writeJSON(response, value)
}

func (s *Server) metrics(response http.ResponseWriter, request *http.Request) {
	// The overlay inventory agent exposes metrics only inside its private
	// network. A directly reachable control agent must not disclose host
	// inventory without the same bearer key used by its machine API.
	if s.config.RemoteControlEnabled && !s.authorized(request) {
		http.Error(response, "unauthorized", http.StatusUnauthorized)
		return
	}
	value, err := Collect(request.Context(), s.config)
	if err != nil {
		http.Error(response, "metrics unavailable", http.StatusServiceUnavailable)
		return
	}
	response.Header().Set("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
	labels := fmt.Sprintf(`node=%q,os=%q,kernel=%q,engine_version=%q`, escape(value.NodeName), escape(value.OS.Name), escape(value.OS.Kernel), escape(value.Engine.Version))
	lines := []string{
		"# HELP swarmops_node_info Node operating system and Docker metadata.",
		"# TYPE swarmops_node_info gauge",
		"swarmops_node_info{" + labels + "} 1",
		"# TYPE swarmops_node_cpu_cores gauge",
		"swarmops_node_cpu_cores " + strconv.Itoa(value.Hardware.CPUCores),
		"# TYPE swarmops_node_memory_bytes_total gauge",
		"swarmops_node_memory_bytes_total " + strconv.FormatUint(value.Hardware.MemoryTotal, 10),
		"# TYPE swarmops_node_memory_bytes_available gauge",
		"swarmops_node_memory_bytes_available " + strconv.FormatUint(value.Hardware.MemoryAvailable, 10),
		"# TYPE swarmops_node_disk_bytes_total gauge",
		"swarmops_node_disk_bytes_total " + strconv.FormatUint(value.Disk.TotalBytes, 10),
		"# TYPE swarmops_node_disk_bytes_available gauge",
		"swarmops_node_disk_bytes_available " + strconv.FormatUint(value.Disk.AvailableBytes, 10),
		"# TYPE swarmops_node_load1 gauge",
		"swarmops_node_load1 " + strconv.FormatFloat(value.Hardware.Load1, 'f', -1, 64),
		"# TYPE swarmops_agent_snapshot_timestamp_seconds gauge",
		"swarmops_agent_snapshot_timestamp_seconds " + strconv.FormatInt(value.CollectedAt.Unix(), 10),
	}
	_, _ = response.Write([]byte(strings.Join(lines, "\n") + "\n"))
}

func (s *Server) enginePing(response http.ResponseWriter, request *http.Request) {
	if !s.authorized(request) {
		http.Error(response, "unauthorized", http.StatusUnauthorized)
		return
	}
	if err := s.config.Docker.Ping(request.Context()); err != nil {
		http.Error(response, "engine unavailable", http.StatusServiceUnavailable)
		return
	}
	response.Header().Set("Content-Type", "text/plain; charset=utf-8")
	_, _ = response.Write([]byte("OK"))
}

func (s *Server) engineInfo(response http.ResponseWriter, request *http.Request) {
	if !s.authorized(request) {
		http.Error(response, "unauthorized", http.StatusUnauthorized)
		return
	}
	value, err := s.config.Docker.Info(request.Context())
	if err != nil {
		http.Error(response, "engine unavailable", http.StatusServiceUnavailable)
		return
	}
	writeJSON(response, value)
}

func (s *Server) engineVersion(response http.ResponseWriter, request *http.Request) {
	if !s.authorized(request) {
		http.Error(response, "unauthorized", http.StatusUnauthorized)
		return
	}
	value, err := s.config.Docker.Version(request.Context())
	if err != nil {
		http.Error(response, "engine unavailable", http.StatusServiceUnavailable)
		return
	}
	writeJSON(response, value)
}

func (s *Server) engineNodes(response http.ResponseWriter, request *http.Request) {
	if !s.authorized(request) {
		http.Error(response, "unauthorized", http.StatusUnauthorized)
		return
	}
	value, err := s.config.Docker.ListNodes(request.Context())
	if err != nil {
		http.Error(response, "engine unavailable", http.StatusServiceUnavailable)
		return
	}
	writeJSON(response, value)
}

func (s *Server) engineServices(response http.ResponseWriter, request *http.Request) {
	if !s.authorized(request) {
		http.Error(response, "unauthorized", http.StatusUnauthorized)
		return
	}
	value, err := s.config.Docker.ListServices(request.Context())
	if err != nil {
		http.Error(response, "engine unavailable", http.StatusServiceUnavailable)
		return
	}
	writeJSON(response, value)
}

func (s *Server) engineTasks(response http.ResponseWriter, request *http.Request) {
	if !s.authorized(request) {
		http.Error(response, "unauthorized", http.StatusUnauthorized)
		return
	}
	filters, err := engineTaskFilters(request.URL.Query())
	if err != nil {
		http.Error(response, "invalid task filter", http.StatusBadRequest)
		return
	}
	value, err := s.config.Docker.ListTasks(request.Context(), filters)
	if err != nil {
		http.Error(response, "engine unavailable", http.StatusServiceUnavailable)
		return
	}
	writeJSON(response, value)
}

func (s *Server) engineBuild(response http.ResponseWriter, request *http.Request) {
	if !s.authorized(request) {
		http.Error(response, "unauthorized", http.StatusUnauthorized)
		return
	}
	if !s.config.BuildEnabled {
		http.Error(response, "machine image builds are disabled", http.StatusForbidden)
		return
	}
	query, headers, err := s.validBuildRequest(request)
	if err != nil {
		http.Error(response, "invalid build request", http.StatusBadRequest)
		return
	}
	request.Body = http.MaxBytesReader(response, request.Body, s.config.BuildMaxBytes)
	buildContext, cancel := context.WithTimeout(request.Context(), buildTimeout)
	defer cancel()
	output, err := s.config.Docker.Build(buildContext, request.Body, query, headers)
	if err != nil {
		http.Error(response, "machine image build failed", http.StatusBadGateway)
		return
	}
	response.Header().Set("Content-Type", "text/plain; charset=utf-8")
	_, _ = response.Write([]byte(output))
}

func (s *Server) command(response http.ResponseWriter, request *http.Request) {
	if !s.authorized(request) {
		http.Error(response, "unauthorized", http.StatusUnauthorized)
		return
	}
	request.Body = http.MaxBytesReader(response, request.Body, agentcontrol.MaxComposeBytes+(64<<10))
	decoder := json.NewDecoder(request.Body)
	decoder.DisallowUnknownFields()
	var input agentcontrol.Request
	if err := decoder.Decode(&input); err != nil || decoder.Decode(&struct{}{}) != io.EOF {
		http.Error(response, "invalid command request", http.StatusBadRequest)
		return
	}
	args, compose, err := agentcontrol.DockerArgs(input)
	if err != nil {
		http.Error(response, "invalid command request", http.StatusBadRequest)
		return
	}
	output, err := runDockerCommand(request.Context(), compose, args...)
	if err != nil {
		http.Error(response, "machine command failed", http.StatusBadGateway)
		return
	}
	switch input.Operation {
	case agentcontrol.OperationServiceLogs, agentcontrol.OperationSecretList:
		writeJSON(response, map[string]string{"output": output})
		return
	}
	writeJSON(response, map[string]string{"status": "ok"})
}

func engineTaskFilters(query url.Values) (map[string][]string, error) {
	if len(query) == 0 {
		return nil, nil
	}
	if len(query) != 1 || len(query["filters"]) != 1 {
		return nil, fmt.Errorf("unexpected filters")
	}
	var filters map[string][]string
	if err := json.Unmarshal([]byte(query.Get("filters")), &filters); err != nil || len(filters) > 1 {
		return nil, fmt.Errorf("invalid filters")
	}
	for key, values := range filters {
		if (key != "node" && key != "service") || len(values) != 1 || !agentReference(values[0]) {
			return nil, fmt.Errorf("invalid filters")
		}
	}
	return filters, nil
}

func (s *Server) validBuildRequest(request *http.Request) (url.Values, http.Header, error) {
	if s.config.BuildMaxBytes <= 0 || s.config.BuildMaxCPUs <= 0 || s.config.BuildMaxMemoryMiB <= 0 || len(s.config.AllowedImagePrefixes) == 0 {
		return nil, nil, fmt.Errorf("machine build policy is not configured")
	}
	if !strings.HasPrefix(strings.ToLower(request.Header.Get("Content-Type")), "application/x-tar") {
		return nil, nil, fmt.Errorf("build must be a tar stream")
	}
	if request.ContentLength > s.config.BuildMaxBytes {
		return nil, nil, fmt.Errorf("build context is too large")
	}
	query := request.URL.Query()
	allowed := map[string]bool{"cpuperiod": true, "cpuquota": true, "dockerfile": true, "forcerm": true, "memory": true, "memswap": true, "pull": true, "push": true, "rm": true, "t": true}
	for key, values := range query {
		if !allowed[key] || len(values) != 1 {
			return nil, nil, fmt.Errorf("unsupported build option")
		}
	}
	required := []string{"cpuperiod", "cpuquota", "dockerfile", "forcerm", "memory", "memswap", "pull", "rm", "t"}
	for _, key := range required {
		if query.Get(key) == "" {
			return nil, nil, fmt.Errorf("missing build option")
		}
	}
	period, err := strconv.ParseInt(query.Get("cpuperiod"), 10, 64)
	if err != nil || period != 100_000 {
		return nil, nil, fmt.Errorf("invalid CPU period")
	}
	quota, err := strconv.ParseInt(query.Get("cpuquota"), 10, 64)
	if err != nil || quota <= 0 || float64(quota)/float64(period) > s.config.BuildMaxCPUs {
		return nil, nil, fmt.Errorf("invalid CPU quota")
	}
	memory, err := strconv.ParseInt(query.Get("memory"), 10, 64)
	if err != nil || memory <= 0 || memory > s.config.BuildMaxMemoryMiB<<20 || query.Get("memswap") != query.Get("memory") {
		return nil, nil, fmt.Errorf("invalid memory limit")
	}
	if query.Get("forcerm") != "1" || query.Get("pull") != "1" || query.Get("rm") != "1" || !safeDockerfile(query.Get("dockerfile")) || !allowedImage(query.Get("t"), s.config.AllowedImagePrefixes) {
		return nil, nil, fmt.Errorf("invalid build policy")
	}
	if push := query.Get("push"); push != "" && push != "1" {
		return nil, nil, fmt.Errorf("invalid push setting")
	}
	registryConfig := request.Header.Get("X-Registry-Config")
	if len(registryConfig) > registryConfigLimit {
		return nil, nil, fmt.Errorf("registry configuration is too large")
	}
	if registryConfig != "" && query.Get("push") != "1" {
		return nil, nil, fmt.Errorf("registry configuration requires push")
	}
	headers := make(http.Header)
	headers.Set("Content-Type", "application/x-tar")
	if registryConfig != "" {
		headers.Set("X-Registry-Config", registryConfig)
	}
	return query, headers, nil
}

func runDockerCommand(ctx context.Context, compose []byte, args ...string) (string, error) {
	ctx, cancel := context.WithTimeout(ctx, commandTimeout)
	defer cancel()
	buffer := &limitedBuffer{limit: commandOutputLimit}
	command := exec.CommandContext(ctx, "docker", args...)
	if len(compose) > 0 {
		command.Stdin = bytes.NewReader(compose)
	}
	command.Stdout = buffer
	command.Stderr = buffer
	if err := command.Run(); err != nil || buffer.err != nil {
		return "", fmt.Errorf("run bounded Docker operation")
	}
	return buffer.String(), nil
}

type limitedBuffer struct {
	buffer bytes.Buffer
	err    error
	limit  int
}

func (b *limitedBuffer) Write(value []byte) (int, error) {
	remaining := b.limit - b.buffer.Len()
	if remaining <= 0 {
		b.err = fmt.Errorf("command output exceeded limit")
		return 0, b.err
	}
	if len(value) > remaining {
		_, _ = b.buffer.Write(value[:remaining])
		b.err = fmt.Errorf("command output exceeded limit")
		return remaining, b.err
	}
	return b.buffer.Write(value)
}

func (b *limitedBuffer) String() string { return b.buffer.String() }

func agentReference(value string) bool {
	if value == "" || len(value) > 128 || strings.ContainsAny(value, "\r\n\x00") {
		return false
	}
	for _, character := range value {
		if !(character >= 'a' && character <= 'z' || character >= 'A' && character <= 'Z' || character >= '0' && character <= '9' || strings.ContainsRune("._:-", character)) {
			return false
		}
	}
	return true
}

func safeDockerfile(value string) bool {
	if value == "" || len(value) > 128 || strings.Contains(value, "..") || strings.ContainsAny(value, "\\\r\n\x00") {
		return false
	}
	return path.Clean(value) == value
}

func allowedImage(image string, prefixes []string) bool {
	if image == "" || len(image) > 350 || strings.ContainsAny(image, "\r\n\x00") {
		return false
	}
	for _, prefix := range prefixes {
		if strings.HasPrefix(image, prefix) {
			return true
		}
	}
	return false
}

func (s *Server) authorized(request *http.Request) bool {
	value := bearer(request)
	return value != "" && subtle.ConstantTimeCompare([]byte(value), s.token) == 1
}

func bearer(request *http.Request) string {
	return strings.TrimSpace(strings.TrimPrefix(request.Header.Get("Authorization"), "Bearer "))
}

func escape(value string) string {
	return strings.ReplaceAll(strings.ReplaceAll(value, "\\", "\\\\"), "\"", "\\\"")
}

func writeJSON(response http.ResponseWriter, value any) {
	response.Header().Set("Content-Type", "application/json")
	response.Header().Set("Cache-Control", "no-store")
	// json.NewEncoder is intentionally local so no snapshot outlives the request.
	_ = jsonEncoder(response, value)
}

// Status is intentionally compact: it proves the authenticated agent and
// current Docker/Swarm readiness without exposing Docker's full host metadata.
type Status struct {
	DockerAvailable       bool   `json:"dockerAvailable"`
	DockerVersion         string `json:"dockerVersion,omitempty"`
	NodeName              string `json:"nodeName"`
	RemoteControlEnabled  bool   `json:"remoteControlEnabled"`
	SwarmControlAvailable bool   `json:"swarmControlAvailable"`
	SwarmState            string `json:"swarmState,omitempty"`
	Version               string `json:"version"`
}

var jsonEncoder = func(response http.ResponseWriter, value any) error {
	return json.NewEncoder(response).Encode(value)
}
