package agent

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

const (
	agentDiagnosticEventLimit = 16
	agentDiagnosticDedupeFor  = time.Minute
	updateStatusLimit         = 8 << 10
)

// DiagnosticEvent is deliberately a small, reviewed event vocabulary. The
// agent never returns a service log, command output, error text from Docker,
// an operator-supplied path, or any credential through this contract.
type DiagnosticEvent struct {
	Code       string    `json:"code"`
	Level      string    `json:"level"`
	Message    string    `json:"message"`
	OccurredAt time.Time `json:"occurredAt"`
}

// UpdateStatus is written by the fixed local updater installed with the
// native agent. It reports only the updater lifecycle; it does not configure
// a remote Git source or accept a command from the control plane.
type UpdateStatus struct {
	Automatic     bool      `json:"automatic"`
	CheckedAt     time.Time `json:"checkedAt,omitempty"`
	LastUpdatedAt time.Time `json:"lastUpdatedAt,omitempty"`
	Revision      string    `json:"revision,omitempty"`
	State         string    `json:"state,omitempty"`
}

// Diagnostics joins a current authenticated status with bounded safe events
// and the native updater state. It is intentionally distinct from host or
// Docker service logs.
type Diagnostics struct {
	Events []DiagnosticEvent `json:"events"`
	Status Status            `json:"status"`
	Update UpdateStatus      `json:"update"`
}

type diagnosticRecorder struct {
	events []DiagnosticEvent
	last   map[string]time.Time
	mu     sync.Mutex
}

func newDiagnosticRecorder() *diagnosticRecorder {
	return &diagnosticRecorder{last: map[string]time.Time{}}
}

func (r *diagnosticRecorder) record(now time.Time, code, level, message string) {
	if r == nil || code == "" || level == "" || message == "" {
		return
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	if previous := r.last[code]; !previous.IsZero() && now.Sub(previous) < agentDiagnosticDedupeFor {
		return
	}
	r.last[code] = now
	r.events = append(r.events, DiagnosticEvent{Code: code, Level: level, Message: message, OccurredAt: now})
	if len(r.events) > agentDiagnosticEventLimit {
		r.events = append([]DiagnosticEvent(nil), r.events[len(r.events)-agentDiagnosticEventLimit:]...)
	}
}

func (r *diagnosticRecorder) list() []DiagnosticEvent {
	if r == nil {
		return nil
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	return append([]DiagnosticEvent(nil), r.events...)
}

func (s *Server) diagnostics(response http.ResponseWriter, request *http.Request) {
	if !s.authorized(request) {
		http.Error(response, "unauthorized", http.StatusUnauthorized)
		return
	}
	status := s.currentStatus(request.Context())
	update := readUpdateStatus(s.config.UpdateStatusFile, s.config.AutomaticUpdates)
	writeJSON(response, Diagnostics{Events: s.diagnosticsLog.list(), Status: status, Update: update})
}

// requestAgentUpdate only creates a fixed local request marker. It cannot
// carry a source URL, branch, binary, shell command, or other browser-supplied
// input. The local update service owns the trusted Git check and restart.
func (s *Server) requestAgentUpdate(response http.ResponseWriter, request *http.Request) {
	if !s.authorized(request) {
		http.Error(response, "unauthorized", http.StatusUnauthorized)
		return
	}
	if !s.config.AutomaticUpdates || strings.TrimSpace(s.config.UpdateRequestFile) == "" {
		http.Error(response, "automatic updates are not configured", http.StatusConflict)
		return
	}
	if err := writeUpdateRequest(s.config.UpdateRequestFile); err != nil {
		s.diagnosticsLog.record(time.Now().UTC(), "update_request_failed", "warning", "The local agent update check could not be scheduled")
		http.Error(response, "automatic update check could not be scheduled", http.StatusServiceUnavailable)
		return
	}
	s.diagnosticsLog.record(time.Now().UTC(), "update_check_requested", "info", "The control plane requested a local agent update check")
	writeJSON(response, map[string]string{"status": "scheduled"})
}

func (s *Server) currentStatus(ctx context.Context) Status {
	value := Status{
		NodeName:             s.config.NodeName,
		ProtocolVersion:      agentProtocolVersion,
		RemoteControlEnabled: s.config.RemoteControlEnabled,
		StartedAt:            s.startedAt,
		Version:              s.config.Version,
	}
	if value.NodeName == "" {
		value.NodeName = "agent"
	}
	if s.config.Docker != nil && s.config.Docker.Ping(ctx) == nil {
		value.DockerAvailable = true
		if version, err := s.config.Docker.Version(ctx); err == nil {
			value.DockerVersion = version.Version
		}
		if info, err := s.config.Docker.Info(ctx); err == nil {
			value.SwarmControlAvailable = info.Swarm.ControlAvailable
			value.SwarmState = info.Swarm.LocalNodeState
		}
	} else {
		s.diagnosticsLog.record(time.Now().UTC(), "docker_unavailable", "warning", "Docker Engine is unavailable to the machine agent")
	}
	value.UptimeSeconds = uint64(time.Since(s.startedAt).Seconds())
	return value
}

func readUpdateStatus(filename string, automatic bool) UpdateStatus {
	status := UpdateStatus{Automatic: automatic}
	filename = strings.TrimSpace(filename)
	if filename == "" {
		return status
	}
	info, err := os.Lstat(filepath.Clean(filename))
	if err != nil || info.Mode()&os.ModeSymlink != 0 || !info.Mode().IsRegular() || info.Size() > updateStatusLimit {
		return status
	}
	file, err := os.Open(filepath.Clean(filename))
	if err != nil {
		return status
	}
	defer file.Close()
	decoder := json.NewDecoder(io.LimitReader(file, updateStatusLimit))
	if err := decoder.Decode(&status); err != nil {
		return UpdateStatus{Automatic: automatic}
	}
	status.Automatic = automatic
	if !validUpdateState(status.State) || !validRevision(status.Revision) {
		return UpdateStatus{Automatic: automatic}
	}
	return status
}

func writeUpdateRequest(filename string) error {
	path := filepath.Clean(strings.TrimSpace(filename))
	if !filepath.IsAbs(path) || path == "/" {
		return fmt.Errorf("update request path must be an absolute non-root path")
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return fmt.Errorf("prepare update request directory: %w", err)
	}
	if info, err := os.Lstat(path); err == nil && info.Mode()&os.ModeSymlink != 0 {
		return fmt.Errorf("update request path must not be a symlink")
	} else if err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("check update request path: %w", err)
	}
	file, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0o600)
	if err != nil {
		return fmt.Errorf("create update request: %w", err)
	}
	_, writeErr := file.WriteString("check\n")
	closeErr := file.Close()
	if writeErr != nil {
		return fmt.Errorf("write update request: %w", writeErr)
	}
	if closeErr != nil {
		return fmt.Errorf("close update request: %w", closeErr)
	}
	return nil
}

func (s *Server) markUpdateBusy(request *http.Request) func() {
	if s == nil || !s.config.AutomaticUpdates || request == nil || request.Method != http.MethodPost || request.URL.Path == "/v1/agent/update" {
		return func() {}
	}
	path := filepath.Clean(strings.TrimSpace(s.config.UpdateBusyFile))
	if !filepath.IsAbs(path) || path == "/" {
		return func() {}
	}
	s.busyMu.Lock()
	s.busyOperations++
	if s.busyOperations == 1 {
		_ = writeUpdateMarker(path, "busy\n")
	}
	s.busyMu.Unlock()
	return func() {
		s.busyMu.Lock()
		defer s.busyMu.Unlock()
		if s.busyOperations == 0 {
			return
		}
		s.busyOperations--
		if s.busyOperations == 0 {
			_ = os.Remove(path)
		}
	}
}

func writeUpdateMarker(filename, value string) error {
	path := filepath.Clean(strings.TrimSpace(filename))
	if !filepath.IsAbs(path) || path == "/" {
		return fmt.Errorf("update marker path must be an absolute non-root path")
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return fmt.Errorf("prepare update marker directory: %w", err)
	}
	if info, err := os.Lstat(path); err == nil && info.Mode()&os.ModeSymlink != 0 {
		return fmt.Errorf("update marker path must not be a symlink")
	} else if err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("check update marker path: %w", err)
	}
	if err := os.WriteFile(path, []byte(value), 0o600); err != nil {
		return fmt.Errorf("write update marker: %w", err)
	}
	return nil
}

func validateUpdateConfiguration(config Config) error {
	if !config.AutomaticUpdates {
		return nil
	}
	for label, filename := range map[string]string{
		"agent update busy file":    config.UpdateBusyFile,
		"agent update request file": config.UpdateRequestFile,
		"agent update status file":  config.UpdateStatusFile,
	} {
		path := filepath.Clean(strings.TrimSpace(filename))
		if !filepath.IsAbs(path) || path == "/" {
			return fmt.Errorf("%s must be an absolute non-root path", label)
		}
	}
	return nil
}

func validUpdateState(value string) bool {
	switch value {
	case "", "deferred", "failed", "scheduled", "updated", "up_to_date":
		return true
	default:
		return false
	}
}

func validRevision(value string) bool {
	if value == "" || len(value) > 64 {
		return value == ""
	}
	for _, character := range value {
		if !((character >= '0' && character <= '9') || (character >= 'a' && character <= 'f')) {
			return false
		}
	}
	return true
}
