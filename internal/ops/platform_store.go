package ops

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/nimasrn/SwarmOps/internal/preflight"
	"github.com/nimasrn/SwarmOps/internal/securestore"
)

const (
	platformStateKey = "platform"
	platformVersion  = 1

	// PlatformModeUnset is a controller that has been given no platform
	// definition at all. Browser deployment stays refused, exactly as it is
	// today when SWARMOPS_PLATFORM_MANIFEST_FILE is absent.
	PlatformModeUnset = "unset"
	// PlatformModeManifest is an operator-authored manifest held in sealed
	// controller state instead of a mounted file.
	PlatformModeManifest = "manifest"
	// PlatformModeUnmanaged is the deliberate declaration that this install
	// has no platform manifest and must not have one.
	PlatformModeUnmanaged = "unmanaged"
	// PlatformModeFile is reported, never stored: a manifest file is mounted,
	// so the panel is a read-only view of it.
	PlatformModeFile = "file"
)

// UnmanagedConfirmation is the exact phrase required to turn slot enforcement
// off. Declaring an install manifest-free removes the check that stops one
// browser deployment from claiming a domain or capacity another owns, so it is
// a deliberate sentence rather than a toggle.
const UnmanagedConfirmation = "NO_PLATFORM_MANIFEST"

// PlatformStore holds the platform definition an operator writes from the
// console. It exists for the same reason the source settings store does: an
// operator running SwarmOps from a browser cannot mount a file on the
// controller and restart it, and a screen that can only print the YAML it
// wants is a dead end rather than a control.
//
// The manifest carries no credential — it names secrets, it never holds their
// values — but it is sealed with the same key as the rest of the controller
// state so a stolen volume yields nothing without it.
type PlatformStore struct {
	mu sync.RWMutex
	// file is the mounted, immutable manifest when one is configured. It wins
	// over anything the panel holds and makes the panel read-only.
	file      *PlatformAdmission
	path      string
	sealer    *securestore.Sealer
	state     PlatformState
	admission *PlatformAdmission
}

// PlatformState is the console-visible platform definition.
type PlatformState struct {
	Manifest preflight.Manifest `json:"manifest"`
	// Mode is one of the PlatformMode constants.
	Mode string `json:"mode"`
	// Namespace is the stack prefix an unmanaged install is confined to. A
	// manifest-mode install takes its namespace from the manifest itself.
	Namespace string    `json:"namespace"`
	UpdatedAt time.Time `json:"updatedAt"`
	UpdatedBy string    `json:"updatedBy"`
}

type platformFile struct {
	State   PlatformState `json:"state"`
	Version int           `json:"version"`
}

// NewPlatformStore opens the sealed panel-owned platform definition. A
// non-nil file admission is the mounted manifest, which stays authoritative.
func NewPlatformStore(dataDir string, dataEncryptionKey []byte, file *PlatformAdmission) (*PlatformStore, error) {
	if strings.TrimSpace(dataDir) == "" {
		return nil, fmt.Errorf("platform store data directory is required")
	}
	sealer, err := securestore.New(dataEncryptionKey)
	if err != nil {
		return nil, fmt.Errorf("configure sealed platform definition: %w", err)
	}
	store := &PlatformStore{
		file:   file,
		path:   filepath.Join(dataDir, "platform.sealed"),
		sealer: sealer,
		state:  PlatformState{Mode: PlatformModeUnset},
	}
	data, err := sealer.ReadFile(store.path, platformStateKey)
	if errors.Is(err, os.ErrNotExist) {
		return store, nil
	}
	if err != nil {
		return nil, fmt.Errorf("read sealed platform definition: %w", err)
	}
	var saved platformFile
	if err := json.Unmarshal(data, &saved); err != nil {
		return nil, fmt.Errorf("read sealed platform definition: %w", err)
	}
	if saved.Version != platformVersion {
		return nil, fmt.Errorf("unsupported sealed platform definition version")
	}
	admission, err := admissionFor(saved.State)
	if err != nil {
		// A stored definition that no longer admits — because the checks it
		// was written against have since tightened — must not take the
		// controller down. Deployment refuses until the operator revisits the
		// screen, which is the same outcome as an unset definition.
		return store, nil
	}
	store.state = saved.State
	store.admission = admission
	return store, nil
}

// FileManaged reports whether a mounted manifest owns this controller, in
// which case the console may read the definition but never write it.
func (s *PlatformStore) FileManaged() bool { return s != nil && s.file != nil }

// Admission returns the admission in force: the mounted manifest when one is
// configured, otherwise whatever the panel holds, and nil when neither exists.
func (s *PlatformStore) Admission() *PlatformAdmission {
	if s == nil {
		return nil
	}
	if s.file != nil {
		return s.file
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.admission
}

// State is the console view of the stored definition.
func (s *PlatformStore) State() PlatformState {
	if s == nil {
		return PlatformState{Mode: PlatformModeUnset}
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.state
}

// PlatformInput is what the console may send.
type PlatformInput struct {
	// Confirmation must equal UnmanagedConfirmation to select unmanaged mode.
	Confirmation string             `json:"confirmation"`
	Manifest     preflight.Manifest `json:"manifest"`
	Mode         string             `json:"mode"`
	Namespace    string             `json:"namespace"`
}

// Save validates and seals a new platform definition. It refuses outright when
// a manifest file is mounted: that file is the reviewed artifact, and letting
// the browser override it would undo the review it exists to record.
func (s *PlatformStore) Save(actor string, input PlatformInput, now time.Time) (PlatformState, error) {
	if s == nil {
		return PlatformState{}, fmt.Errorf("the sealed platform definition is not configured on this controller")
	}
	if s.file != nil {
		return PlatformState{}, fmt.Errorf("this controller loads a reviewed manifest from SWARMOPS_PLATFORM_MANIFEST_FILE; edit that file rather than the console")
	}
	candidate := PlatformState{
		Manifest:  input.Manifest,
		Mode:      strings.TrimSpace(input.Mode),
		Namespace: strings.ToLower(strings.TrimSpace(input.Namespace)),
		UpdatedAt: now.UTC(),
		UpdatedBy: actor,
	}
	switch candidate.Mode {
	case PlatformModeUnset:
		candidate.Manifest = preflight.Manifest{}
		candidate.Namespace = ""
	case PlatformModeUnmanaged:
		if input.Confirmation != UnmanagedConfirmation {
			return PlatformState{}, fmt.Errorf("declaring this install manifest-free requires confirmation %s", UnmanagedConfirmation)
		}
		candidate.Manifest = preflight.Manifest{}
	case PlatformModeManifest:
		candidate.Manifest = normalizePlatformManifest(candidate.Manifest)
		candidate.Namespace = candidate.Manifest.Namespace
	default:
		return PlatformState{}, fmt.Errorf("platform mode must be %q, %q, or %q", PlatformModeUnset, PlatformModeManifest, PlatformModeUnmanaged)
	}
	admission, err := admissionFor(candidate)
	if err != nil {
		return PlatformState{}, err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	previousState, previousAdmission := s.state, s.admission
	s.state, s.admission = candidate, admission
	if err := s.saveLocked(); err != nil {
		s.state, s.admission = previousState, previousAdmission
		return PlatformState{}, err
	}
	return s.state, nil
}

func (s *PlatformStore) saveLocked() error {
	data, err := json.Marshal(platformFile{State: s.state, Version: platformVersion})
	if err != nil {
		return fmt.Errorf("seal platform definition: %w", err)
	}
	if err := s.sealer.WriteFile(s.path, platformStateKey, data); err != nil {
		return fmt.Errorf("seal platform definition: %w", err)
	}
	return nil
}

func admissionFor(state PlatformState) (*PlatformAdmission, error) {
	switch state.Mode {
	case PlatformModeUnmanaged:
		return NewUnmanagedAdmission(state.Namespace)
	case PlatformModeManifest:
		return NewPlatformAdmission(state.Manifest)
	default:
		return nil, nil
	}
}

// normalizePlatformManifest fills in the two constants a console form should
// not have to ask an operator to retype, and trims the free text around the
// names the checks match exactly.
func normalizePlatformManifest(manifest preflight.Manifest) preflight.Manifest {
	manifest.APIVersion = preflight.APIVersion
	manifest.Kind = preflight.Kind
	manifest.Namespace = strings.ToLower(strings.TrimSpace(manifest.Namespace))
	manifest.Registry.Host = strings.ToLower(strings.TrimSpace(manifest.Registry.Host))
	manifest.Registry.Namespace = strings.ToLower(strings.TrimSpace(manifest.Registry.Namespace))
	manifest.Registry.Mode = strings.TrimSpace(manifest.Registry.Mode)
	manifest.Registry.AuthSecret = strings.TrimSpace(manifest.Registry.AuthSecret)
	for index, node := range manifest.Nodes {
		node.Name = strings.ToLower(strings.TrimSpace(node.Name))
		manifest.Nodes[index] = node
	}
	for index, workload := range manifest.Workloads {
		workload.Name = strings.ToLower(strings.TrimSpace(workload.Name))
		workload.Profile = strings.TrimSpace(workload.Profile)
		workload.Domain = strings.ToLower(strings.TrimSuffix(strings.TrimSpace(workload.Domain), "."))
		workload.Resolver = strings.TrimSpace(workload.Resolver)
		workload.DomainSuffixes = normalizeDomainSuffixes(workload.DomainSuffixes)
		manifest.Workloads[index] = workload
	}
	return manifest
}

// CheckPlatformInput reports what preflight makes of a candidate definition
// without storing it, so the console can show findings while an operator is
// still editing.
func CheckPlatformInput(input PlatformInput) preflight.Report {
	if strings.TrimSpace(input.Mode) == PlatformModeManifest {
		return preflight.Check(normalizePlatformManifest(input.Manifest))
	}
	return preflight.Report{Namespace: strings.ToLower(strings.TrimSpace(input.Namespace))}
}
