package agent

import (
	"crypto/subtle"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
)

type Server struct {
	config Config
	token  []byte
}

func NewServer(config Config, token []byte) (*Server, error) {
	if len(token) < 16 {
		return nil, fmt.Errorf("agent token must contain at least 16 bytes")
	}
	return &Server{config: config, token: append([]byte(nil), token...)}, nil
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", s.health)
	mux.HandleFunc("GET /metrics", s.metrics)
	mux.HandleFunc("GET /v1/snapshot", s.snapshot)
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

func (s *Server) metrics(response http.ResponseWriter, request *http.Request) {
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

func (s *Server) authorized(request *http.Request) bool {
	value := strings.TrimPrefix(request.Header.Get("Authorization"), "Bearer ")
	return value != "" && subtle.ConstantTimeCompare([]byte(value), s.token) == 1
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

var jsonEncoder = func(response http.ResponseWriter, value any) error {
	return json.NewEncoder(response).Encode(value)
}
