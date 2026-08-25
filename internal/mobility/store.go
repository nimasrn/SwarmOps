package mobility

import (
	"crypto/rand"
	"encoding/hex"
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

const (
	stateKey = "mobility-state"
	version  = 1

	StatePlanned            = "planned"
	StateQuiescing          = "quiescing"
	StateCopying            = "copying"
	StateStarting           = "starting"
	StateBurnIn             = "burn_in"
	StateReadyForRetirement = "ready_for_retirement"
	StateRetiring           = "retiring"
	StateRetired            = "retired"
	StateNeedsAttention     = "needs_attention"
	// StateAbandoned is an explicit, operator-confirmed closure of a failed
	// handover before source cleanup began. It never deletes source data or
	// resumes a workload; it only releases the lifecycle fence after a human
	// has reviewed the command evidence and completed any needed recovery.
	StateAbandoned = "abandoned"
)

// ComponentState records safe lifecycle evidence for one transferred local
// volume. It has no raw command output, archive content, or credential data.
type ComponentState struct {
	Bytes        int64      `json:"bytes,omitempty"`
	DisplayName  string     `json:"displayName"`
	HealthySince *time.Time `json:"healthySince,omitempty"`
	Service      string     `json:"service"`
	SourceNodeID string     `json:"sourceNodeId,omitempty"`
	State        string     `json:"state"`
	Volume       string     `json:"volume"`
}

// Migration is a durable, browser-safe handover record. Source cleanup is a
// separate, explicit state transition after the healthy burn-in has elapsed.
type Migration struct {
	CleanupEligibleAt *time.Time       `json:"cleanupEligibleAt,omitempty"`
	CreatedAt         time.Time        `json:"createdAt"`
	Components        []ComponentState `json:"components"`
	DisplayName       string           `json:"displayName"`
	Failure           string           `json:"failure,omitempty"`
	ID                string           `json:"id"`
	Resource          string           `json:"resource"`
	// SourceCleanupStarted is written immediately before any source-volume
	// removal can begin. It makes an ambiguous or partial cleanup
	// intentionally non-dismissible: the operator must finish recovery rather
	// than mistakenly treating an already changed source as untouched.
	SourceCleanupStarted bool      `json:"sourceCleanupStarted,omitempty"`
	SourceServerIDs      []string  `json:"sourceServerIds,omitempty"`
	State                string    `json:"state"`
	TargetNodeID         string    `json:"targetNodeId"`
	TargetServerID       string    `json:"targetServerId"`
	UpdatedAt            time.Time `json:"updatedAt"`
}

type stateFile struct {
	Migrations []Migration `json:"migrations"`
	Version    int         `json:"version"`
}

// Store persists only the migration lifecycle. The transferred data remains
// in the reviewed local volumes; this ledger is sealed with the controller's
// existing data key so it moves together with the control-plane state.
type Store struct {
	migrations map[string]Migration
	mu         sync.Mutex
	now        func() time.Time
	path       string
	sealer     *securestore.Sealer
}

func Open(dataDir string, dataEncryptionKey []byte) (*Store, error) {
	if strings.TrimSpace(dataDir) == "" {
		return nil, fmt.Errorf("mobility data directory is required")
	}
	sealer, err := securestore.New(dataEncryptionKey)
	if err != nil {
		return nil, fmt.Errorf("configure sealed mobility state: %w", err)
	}
	store := &Store{migrations: map[string]Migration{}, now: time.Now, path: filepath.Join(dataDir, "mobility.sealed"), sealer: sealer}
	data, err := sealer.ReadFile(store.path, stateKey)
	if errors.Is(err, os.ErrNotExist) {
		return store, nil
	}
	if err != nil {
		return nil, fmt.Errorf("read sealed mobility state: %w", err)
	}
	var saved stateFile
	if err := json.Unmarshal(data, &saved); err != nil {
		return nil, fmt.Errorf("decode sealed mobility state: %w", err)
	}
	if saved.Version != version {
		return nil, fmt.Errorf("unsupported sealed mobility state version")
	}
	for _, migration := range saved.Migrations {
		if err := validateMigration(migration); err != nil {
			return nil, fmt.Errorf("decode sealed mobility state: %w", err)
		}
		store.migrations[migration.ID] = cloneMigration(migration)
	}
	return store, nil
}

// New creates and durably records a planned handover before any workload is
// quiesced. Callers supply resolved node/server IDs rather than raw hostnames.
func (s *Store) New(resource ResourceDefinition, targetServerID, targetNodeID string) (Migration, error) {
	if s == nil {
		return Migration{}, fmt.Errorf("mobility store is not configured")
	}
	if strings.TrimSpace(targetServerID) == "" || strings.TrimSpace(targetNodeID) == "" {
		return Migration{}, fmt.Errorf("migration target is required")
	}
	id, err := newID()
	if err != nil {
		return Migration{}, err
	}
	now := s.now().UTC()
	migration := Migration{
		CreatedAt:      now,
		DisplayName:    resource.DisplayName,
		ID:             id,
		Resource:       resource.Resource,
		State:          StatePlanned,
		TargetNodeID:   targetNodeID,
		TargetServerID: targetServerID,
		UpdatedAt:      now,
		Components:     make([]ComponentState, len(resource.Components)),
	}
	for index, component := range resource.Components {
		migration.Components[index] = ComponentState{DisplayName: component.DisplayName, Service: component.Service, State: StatePlanned, Volume: component.Volume}
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.migrations[migration.ID] = migration
	if err := s.saveLocked(); err != nil {
		delete(s.migrations, migration.ID)
		return Migration{}, err
	}
	return cloneMigration(migration), nil
}

func (s *Store) Get(id string) (Migration, bool) {
	if s == nil {
		return Migration{}, false
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	migration, found := s.migrations[strings.TrimSpace(id)]
	return cloneMigration(migration), found
}

func (s *Store) List() []Migration {
	if s == nil {
		return []Migration{}
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	result := make([]Migration, 0, len(s.migrations))
	for _, migration := range s.migrations {
		result = append(result, cloneMigration(migration))
	}
	sort.Slice(result, func(left, right int) bool { return result[left].UpdatedAt.After(result[right].UpdatedAt) })
	return result
}

// Update atomically applies a narrow lifecycle mutation. The supplied
// callback must not change resource identity, target identity, or component
// vocabulary; those invariants are checked before the state is persisted.
func (s *Store) Update(id string, change func(*Migration) error) (Migration, error) {
	if s == nil {
		return Migration{}, fmt.Errorf("mobility store is not configured")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	migration, found := s.migrations[strings.TrimSpace(id)]
	if !found {
		return Migration{}, fmt.Errorf("migration not found")
	}
	previous := cloneMigration(migration)
	if err := change(&migration); err != nil {
		return Migration{}, err
	}
	migration.UpdatedAt = s.now().UTC()
	if err := validateMigration(migration); err != nil {
		return Migration{}, err
	}
	s.migrations[migration.ID] = migration
	if err := s.saveLocked(); err != nil {
		s.migrations[previous.ID] = previous
		return Migration{}, err
	}
	return cloneMigration(migration), nil
}

// DiscardPlanned removes a record only before a queue command exists for it.
// It lets the HTTP admission path roll back an unsuccessful enqueue without
// ever deleting a migration that may already have touched a workload.
func (s *Store) DiscardPlanned(id string) error {
	if s == nil {
		return fmt.Errorf("mobility store is not configured")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	migration, found := s.migrations[strings.TrimSpace(id)]
	if !found {
		return nil
	}
	if migration.State != StatePlanned {
		return fmt.Errorf("only an unqueued migration can be discarded")
	}
	delete(s.migrations, migration.ID)
	if err := s.saveLocked(); err != nil {
		s.migrations[migration.ID] = migration
		return err
	}
	return nil
}

// Abandon closes a failed handover only while every reviewed source volume is
// known to be retained. It is deliberately not a recovery mechanism and never
// changes Docker placement or volume content. The caller must obtain explicit
// operator confirmation before calling it.
func (s *Store) Abandon(id string) (Migration, error) {
	return s.Update(id, func(migration *Migration) error {
		if migration.State != StateNeedsAttention {
			return fmt.Errorf("only a handover needing attention can be closed")
		}
		if migration.SourceCleanupStarted {
			return fmt.Errorf("source cleanup may have started; the handover cannot be closed")
		}
		migration.State = StateAbandoned
		migration.Failure = "The administrator closed this handover after review. Source data was retained."
		migration.CleanupEligibleAt = nil
		for index := range migration.Components {
			migration.Components[index].State = StateAbandoned
			migration.Components[index].HealthySince = nil
		}
		return nil
	})
}

func (s *Store) saveLocked() error {
	migrations := make([]Migration, 0, len(s.migrations))
	for _, migration := range s.migrations {
		migrations = append(migrations, migration)
	}
	sort.Slice(migrations, func(left, right int) bool { return migrations[left].CreatedAt.Before(migrations[right].CreatedAt) })
	data, err := json.Marshal(stateFile{Migrations: migrations, Version: version})
	if err != nil {
		return fmt.Errorf("encode sealed mobility state: %w", err)
	}
	if err := s.sealer.WriteFile(s.path, stateKey, append(data, '\n')); err != nil {
		return fmt.Errorf("save sealed mobility state: %w", err)
	}
	return nil
}

func validateMigration(migration Migration) error {
	definition, err := ResourceFor(migration.Resource)
	if err != nil {
		return err
	}
	if !migrationID(migration.ID) || strings.TrimSpace(migration.DisplayName) == "" || strings.TrimSpace(migration.TargetServerID) == "" || strings.TrimSpace(migration.TargetNodeID) == "" {
		return fmt.Errorf("invalid migration record")
	}
	if !validState(migration.State) || len(migration.Components) != len(definition.Components) {
		return fmt.Errorf("invalid migration state")
	}
	for index, component := range migration.Components {
		expected := definition.Components[index]
		if component.DisplayName != expected.DisplayName || component.Service != expected.Service || component.Volume != expected.Volume || !validState(component.State) || component.Bytes < 0 {
			return fmt.Errorf("invalid migration component")
		}
	}
	return nil
}

func validState(state string) bool {
	switch state {
	case StatePlanned, StateQuiescing, StateCopying, StateStarting, StateBurnIn, StateReadyForRetirement, StateRetiring, StateRetired, StateNeedsAttention, StateAbandoned:
		return true
	default:
		return false
	}
}

// IsTerminal reports whether a historical migration no longer holds the
// single-handover admission fence. An abandoned record is terminal only
// because the operator explicitly accepted manual recovery; it never means
// source data was removed.
func IsTerminal(state string) bool {
	return state == StateRetired || state == StateAbandoned
}

func migrationID(value string) bool {
	if len(value) != len("mig-")+32 || !strings.HasPrefix(value, "mig-") {
		return false
	}
	_, err := hex.DecodeString(strings.TrimPrefix(value, "mig-"))
	return err == nil
}

// ValidMigrationID is shared with the agent so its archive staging paths can
// only be derived from IDs minted by the sealed controller lifecycle.
func ValidMigrationID(value string) bool { return migrationID(value) }

func newID() (string, error) {
	bytes := make([]byte, 16)
	if _, err := rand.Read(bytes); err != nil {
		return "", fmt.Errorf("generate migration ID: %w", err)
	}
	return "mig-" + hex.EncodeToString(bytes), nil
}

func cloneMigration(migration Migration) Migration {
	migration.Components = append([]ComponentState(nil), migration.Components...)
	migration.SourceServerIDs = append([]string(nil), migration.SourceServerIDs...)
	if migration.CleanupEligibleAt != nil {
		value := *migration.CleanupEligibleAt
		migration.CleanupEligibleAt = &value
	}
	for index := range migration.Components {
		if migration.Components[index].HealthySince != nil {
			value := *migration.Components[index].HealthySince
			migration.Components[index].HealthySince = &value
		}
	}
	return migration
}
