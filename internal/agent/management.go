package agent

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
)

// managementState is a non-secret, durable proof that the one-time enrollment
// exchange succeeded. No privileged bootstrap action can run before the
// controller owns the corresponding pinned machine API identity and this
// marker is atomically written.
type managementState struct {
	file    string
	managed bool
	mu      sync.RWMutex
}

func newManagementState(file string) (*managementState, error) {
	state := &managementState{file: strings.TrimSpace(file)}
	if state.file != "" {
		info, err := os.Lstat(filepath.Clean(state.file))
		switch {
		case err == nil:
			if info.Mode()&os.ModeSymlink != 0 || !info.Mode().IsRegular() {
				return nil, fmt.Errorf("managed-state file must be a regular file")
			}
			value, readErr := os.ReadFile(filepath.Clean(state.file))
			if readErr != nil || strings.TrimSpace(string(value)) != "managed" {
				return nil, fmt.Errorf("managed-state file is invalid")
			}
			state.managed = true
		case !errors.Is(err, os.ErrNotExist):
			return nil, fmt.Errorf("read managed-state file: %w", err)
		}
	}
	return state, nil
}

func (s *managementState) Managed() bool {
	if s == nil {
		return false
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.managed
}

func (s *managementState) MarkManaged() error {
	if s == nil {
		return fmt.Errorf("managed state is not configured")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.managed {
		return nil
	}
	if s.file == "" {
		s.managed = true
		return nil
	}
	directory := filepath.Dir(filepath.Clean(s.file))
	temporary, err := os.CreateTemp(directory, ".managed-state-*")
	if err != nil {
		return fmt.Errorf("create managed-state file: %w", err)
	}
	temporaryPath := temporary.Name()
	defer os.Remove(temporaryPath)
	if err := temporary.Chmod(0o600); err != nil {
		_ = temporary.Close()
		return fmt.Errorf("protect managed-state file: %w", err)
	}
	if _, err := temporary.WriteString("managed\n"); err != nil {
		_ = temporary.Close()
		return fmt.Errorf("write managed-state file: %w", err)
	}
	if err := temporary.Sync(); err != nil {
		_ = temporary.Close()
		return fmt.Errorf("sync managed-state file: %w", err)
	}
	if err := temporary.Close(); err != nil {
		return fmt.Errorf("close managed-state file: %w", err)
	}
	if err := os.Rename(temporaryPath, filepath.Clean(s.file)); err != nil {
		return fmt.Errorf("install managed-state file: %w", err)
	}
	directoryFile, err := os.Open(directory)
	if err != nil {
		return fmt.Errorf("open managed-state directory: %w", err)
	}
	defer directoryFile.Close()
	if err := directoryFile.Sync(); err != nil {
		return fmt.Errorf("sync managed-state directory: %w", err)
	}
	s.managed = true
	return nil
}
