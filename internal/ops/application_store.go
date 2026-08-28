package ops

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"

	"github.com/nimasrn/SwarmOps/internal/securestore"
)

const applicationStateKey = "applications"

// ApplicationStore is the controller's record of the applications it renders.
// It exists for three reasons: the console lists them, a redeploy reuses the
// previous spec, and Prometheus discovers their metrics endpoints. The specs
// hold no credential — a database URI is referenced by engine name, never
// copied here — but they are sealed with the same key as the rest of the
// controller state so a stolen volume yields nothing without it.
type ApplicationStore struct {
	mu     sync.RWMutex
	path   string
	sealer *securestore.Sealer
	specs  map[string]ApplicationSpec
}

type applicationFile struct {
	Applications []ApplicationSpec `json:"applications"`
	Version      int               `json:"version"`
}

func NewApplicationStore(dataDir string, dataEncryptionKey []byte) (*ApplicationStore, error) {
	if strings.TrimSpace(dataDir) == "" {
		return nil, fmt.Errorf("application store data directory is required")
	}
	sealer, err := securestore.New(dataEncryptionKey)
	if err != nil {
		return nil, fmt.Errorf("configure sealed applications: %w", err)
	}
	store := &ApplicationStore{path: filepath.Join(dataDir, "applications.sealed"), sealer: sealer, specs: map[string]ApplicationSpec{}}
	data, err := sealer.ReadFile(store.path, applicationStateKey)
	if errors.Is(err, os.ErrNotExist) {
		return store, nil
	}
	if err != nil {
		return nil, fmt.Errorf("read sealed applications: %w", err)
	}
	var saved applicationFile
	if err := json.Unmarshal(data, &saved); err != nil {
		return nil, fmt.Errorf("read sealed applications: %w", err)
	}
	if saved.Version != 1 {
		return nil, fmt.Errorf("unsupported sealed application version")
	}
	for _, spec := range saved.Applications {
		normalized := spec.Normalize()
		if err := normalized.Validate(); err != nil {
			return nil, fmt.Errorf("read sealed applications: %w", err)
		}
		store.specs[normalized.Name] = normalized
	}
	return store, nil
}

// List returns every stored application, ordered by name.
func (s *ApplicationStore) List() []ApplicationSpec {
	if s == nil {
		return nil
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	specs := make([]ApplicationSpec, 0, len(s.specs))
	for _, spec := range s.specs {
		specs = append(specs, spec)
	}
	sort.Slice(specs, func(left, right int) bool { return specs[left].Name < specs[right].Name })
	return specs
}

// Get returns one stored application.
func (s *ApplicationStore) Get(name string) (ApplicationSpec, bool) {
	if s == nil {
		return ApplicationSpec{}, false
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	spec, found := s.specs[strings.ToLower(strings.TrimSpace(name))]
	return spec, found
}

// Put stores a normalized, validated spec.
func (s *ApplicationStore) Put(spec ApplicationSpec) error {
	if s == nil {
		return fmt.Errorf("sealed applications are not configured")
	}
	normalized := spec.Normalize()
	if err := normalized.Validate(); err != nil {
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if normalized.Domain != "" {
		for name, existing := range s.specs {
			if name != normalized.Name && existing.Domain == normalized.Domain {
				return fmt.Errorf("domain %q is already assigned to application %q", normalized.Domain, name)
			}
		}
	}
	previous, existed := s.specs[normalized.Name]
	s.specs[normalized.Name] = normalized
	if err := s.saveLocked(); err != nil {
		if existed {
			s.specs[normalized.Name] = previous
		} else {
			delete(s.specs, normalized.Name)
		}
		return err
	}
	return nil
}

// DomainAvailable enforces controller-wide uniqueness before a deploy mutates
// Traefik. The store repeats the check in Put so a concurrent plan cannot win
// after another application has already claimed the hostname.
func (s *ApplicationStore) DomainAvailable(application, domain string) error {
	if s == nil {
		return fmt.Errorf("sealed applications are not configured")
	}
	application = strings.ToLower(strings.TrimSpace(application))
	domain = strings.ToLower(strings.TrimSuffix(strings.TrimSpace(domain), "."))
	if domain == "" {
		return nil
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	for name, spec := range s.specs {
		if name != application && spec.Domain == domain {
			return fmt.Errorf("domain %q is already assigned to application %q", domain, name)
		}
	}
	return nil
}

// Remove forgets one application. Callers remove the stack first, so a failure
// here leaves a listed application that is no longer running rather than a
// running application nothing lists.
func (s *ApplicationStore) Remove(name string) error {
	if s == nil {
		return fmt.Errorf("sealed applications are not configured")
	}
	name = strings.ToLower(strings.TrimSpace(name))
	s.mu.Lock()
	defer s.mu.Unlock()
	previous, found := s.specs[name]
	if !found {
		return nil
	}
	delete(s.specs, name)
	if err := s.saveLocked(); err != nil {
		s.specs[name] = previous
		return err
	}
	return nil
}

func (s *ApplicationStore) saveLocked() error {
	specs := make([]ApplicationSpec, 0, len(s.specs))
	for _, spec := range s.specs {
		specs = append(specs, spec)
	}
	sort.Slice(specs, func(left, right int) bool { return specs[left].Name < specs[right].Name })
	data, err := json.Marshal(applicationFile{Applications: specs, Version: 1})
	if err != nil {
		return fmt.Errorf("encode sealed applications: %w", err)
	}
	if err := s.sealer.WriteFile(s.path, applicationStateKey, append(data, '\n')); err != nil {
		return fmt.Errorf("save sealed applications: %w", err)
	}
	return nil
}
