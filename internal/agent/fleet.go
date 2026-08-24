package agent

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"
)

var (
	ErrRunNotFound = errors.New("fleet run status not found")
	runIDPattern   = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{0,62}$`)
)

// RunStatus is the small read-only handoff between a host's durable systemd
// job and SwarmOps. It deliberately excludes command output and arguments.
type RunStatus struct {
	Attempt       uint       `json:"attempt,omitempty"`
	ExitCode      *int       `json:"exitCode,omitempty"`
	FinishedAt    *time.Time `json:"finishedAt,omitempty"`
	ID            string     `json:"id"`
	MaxAttempts   uint       `json:"maxAttempts,omitempty"`
	NextAttemptAt *time.Time `json:"nextAttemptAt,omitempty"`
	Node          string     `json:"node"`
	Operation     string     `json:"operation"`
	StartedAt     time.Time  `json:"startedAt"`
	State         string     `json:"state"`
}

func ValidRunID(value string) bool { return runIDPattern.MatchString(strings.TrimSpace(value)) }

// ReadRunStatus reads only /var/lib/swarmops/fleet/<validated-id>/status.json
// through the read-only host mount. It never accepts a host path or returns a
// fleet job's output log.
func ReadRunStatus(config Config, id string) (RunStatus, error) {
	if !ValidRunID(id) {
		return RunStatus{}, fmt.Errorf("invalid fleet run id")
	}
	root := config.HostRoot
	if root == "" {
		root = "/"
	}
	path := filepath.Join(root, "var/lib/swarmops/fleet", id, "status.json")
	info, err := os.Lstat(path)
	if os.IsNotExist(err) {
		return RunStatus{}, ErrRunNotFound
	}
	if err != nil {
		return RunStatus{}, fmt.Errorf("read fleet status metadata: %w", err)
	}
	if !info.Mode().IsRegular() || info.Mode()&os.ModeSymlink != 0 {
		return RunStatus{}, fmt.Errorf("fleet status is not a regular file")
	}
	file, err := os.Open(path)
	if err != nil {
		return RunStatus{}, fmt.Errorf("open fleet status: %w", err)
	}
	defer file.Close()
	decoder := json.NewDecoder(io.LimitReader(file, 32<<10))
	decoder.DisallowUnknownFields()
	var status RunStatus
	if err := decoder.Decode(&status); err != nil {
		return RunStatus{}, fmt.Errorf("decode fleet status: %w", err)
	}
	if err := decoder.Decode(&struct{}{}); err != io.EOF {
		if err == nil {
			return RunStatus{}, fmt.Errorf("fleet status must contain one JSON value")
		}
		return RunStatus{}, fmt.Errorf("decode fleet status: %w", err)
	}
	if status.ID != id || status.Node == "" || status.Operation == "" || status.StartedAt.IsZero() || !validRunState(status.State) {
		return RunStatus{}, fmt.Errorf("fleet status has invalid fields")
	}
	// Status records written before retry support did not have attempt fields.
	// Preserve their valid terminal/running shape while new host runners expose
	// explicit retry timing to the read-only agent.
	if status.Attempt == 0 && status.MaxAttempts == 0 {
		status.Attempt = 1
		status.MaxAttempts = 1
	}
	if status.Attempt == 0 || status.MaxAttempts == 0 || status.Attempt > status.MaxAttempts || status.MaxAttempts > 8 {
		return RunStatus{}, fmt.Errorf("fleet status has invalid retry fields")
	}
	if status.State == "running" && (status.ExitCode != nil || status.FinishedAt != nil || status.NextAttemptAt != nil) {
		return RunStatus{}, fmt.Errorf("running fleet status cannot be finished or delayed")
	}
	if status.State == "retrying" && (status.ExitCode != nil || status.FinishedAt != nil || status.NextAttemptAt == nil || status.Attempt >= status.MaxAttempts) {
		return RunStatus{}, fmt.Errorf("retrying fleet status requires a future attempt")
	}
	if (status.State == "succeeded" || status.State == "failed") && (status.ExitCode == nil || status.FinishedAt == nil || status.NextAttemptAt != nil) {
		return RunStatus{}, fmt.Errorf("finished fleet status requires completion details")
	}
	return status, nil
}

func validRunState(value string) bool {
	return value == "running" || value == "retrying" || value == "succeeded" || value == "failed"
}
