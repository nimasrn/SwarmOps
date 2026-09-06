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
	"time"

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
	mu       sync.RWMutex
	outcomes map[string]ApplicationOutcome
	path     string
	sealer   *securestore.Sealer
	specs    map[string]ApplicationSpec
}

// ApplicationOutcome is what happened the last time an application was
// deployed.
//
// Without it a deployment that failed left nothing behind: the spec was stored
// only on success, so an application that could not start simply did not exist
// — not listed, not inspectable, not removable, and indistinguishable from one
// that had never been asked for. Keeping the spec alone would be almost as
// misleading, because an application that never started looks exactly like one
// whose stack was removed. This is the difference between them.
type ApplicationOutcome struct {
	// FailureSummary is the controller's own account of the last failure. It
	// is empty once a deployment succeeds.
	FailureSummary string    `json:"failureSummary,omitempty"`
	LastAttemptAt  time.Time `json:"lastAttemptAt,omitempty"`
	// LastCommandID names the run that explains the outcome in full — its
	// steps, its classified failure, and its execution log.
	LastCommandID string `json:"lastCommandId,omitempty"`
	// Started records whether this application has ever deployed successfully.
	// Prometheus discovery reads it: advertising a scrape target for an
	// application that never started would leave a permanently down target
	// standing in for a deployment that never happened.
	Started   bool      `json:"started"`
	StartedAt time.Time `json:"startedAt,omitempty"`
}

const applicationFileVersion = 2

type applicationFile struct {
	Applications []ApplicationSpec             `json:"applications"`
	Outcomes     map[string]ApplicationOutcome `json:"outcomes,omitempty"`
	Version      int                           `json:"version"`
}

func NewApplicationStore(dataDir string, dataEncryptionKey []byte) (*ApplicationStore, error) {
	if strings.TrimSpace(dataDir) == "" {
		return nil, fmt.Errorf("application store data directory is required")
	}
	sealer, err := securestore.New(dataEncryptionKey)
	if err != nil {
		return nil, fmt.Errorf("configure sealed applications: %w", err)
	}
	store := &ApplicationStore{outcomes: map[string]ApplicationOutcome{}, path: filepath.Join(dataDir, "applications.sealed"), sealer: sealer, specs: map[string]ApplicationSpec{}}
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
	// Version 1 held specs alone, and every spec in it was stored only after a
	// deployment succeeded. Reading one forward means each application it
	// carries has started, which is exactly what the outcome records.
	if saved.Version != 1 && saved.Version != applicationFileVersion {
		return nil, fmt.Errorf("unsupported sealed application version")
	}
	for _, spec := range saved.Applications {
		normalized := spec.Normalize()
		if err := normalized.Validate(); err != nil {
			return nil, fmt.Errorf("read sealed applications: %w", err)
		}
		store.specs[normalized.Name] = normalized
		if saved.Version == 1 {
			store.outcomes[normalized.Name] = ApplicationOutcome{Started: true}
		}
	}
	for name, outcome := range saved.Outcomes {
		if _, found := store.specs[name]; found {
			store.outcomes[name] = outcome
		}
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

// PutOutcome records what happened the last time this application was
// deployed. A successful deployment clears the failure it replaces.
func (s *ApplicationStore) PutOutcome(name string, outcome ApplicationOutcome) error {
	if s == nil {
		return fmt.Errorf("sealed applications are not configured")
	}
	name = strings.ToLower(strings.TrimSpace(name))
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, found := s.specs[name]; !found {
		return fmt.Errorf("application %q is not stored", name)
	}
	previous, existed := s.outcomes[name]
	// A deployment that has ever started keeps having started. The flag
	// answers "has this ever run", not "did the last attempt run".
	if previous.Started {
		outcome.Started = true
		if outcome.StartedAt.IsZero() {
			outcome.StartedAt = previous.StartedAt
		}
	}
	s.outcomes[name] = outcome
	if err := s.saveLocked(); err != nil {
		if existed {
			s.outcomes[name] = previous
		} else {
			delete(s.outcomes, name)
		}
		return err
	}
	return nil
}

// Outcome reports the last deployment result for one application.
func (s *ApplicationStore) Outcome(name string) (ApplicationOutcome, bool) {
	if s == nil {
		return ApplicationOutcome{}, false
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	outcome, found := s.outcomes[strings.ToLower(strings.TrimSpace(name))]
	return outcome, found
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
	previousOutcome, hadOutcome := s.outcomes[name]
	delete(s.specs, name)
	delete(s.outcomes, name)
	if err := s.saveLocked(); err != nil {
		s.specs[name] = previous
		if hadOutcome {
			s.outcomes[name] = previousOutcome
		}
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
	outcomes := make(map[string]ApplicationOutcome, len(s.outcomes))
	for name, outcome := range s.outcomes {
		if _, found := s.specs[name]; found {
			outcomes[name] = outcome
		}
	}
	data, err := json.Marshal(applicationFile{Applications: specs, Outcomes: outcomes, Version: applicationFileVersion})
	if err != nil {
		return fmt.Errorf("encode sealed applications: %w", err)
	}
	if err := s.sealer.WriteFile(s.path, applicationStateKey, append(data, '\n')); err != nil {
		return fmt.Errorf("save sealed applications: %w", err)
	}
	return nil
}
