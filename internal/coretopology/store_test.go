package coretopology

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"github.com/nimasrn/SwarmOps/internal/domain"
	"github.com/nimasrn/SwarmOps/internal/securestore"
	"github.com/nimasrn/SwarmOps/internal/sqlstore/sqltest"
)

// Both cores open the same database, as a primary and a restored standby do.
// The fence the primary commits is what the standby reads when it promotes.
func TestStandbyMustBeExplicitlyPromotedAndNeverCreatesServerProfile(t *testing.T) {
	db := sqltest.Open(t)
	primary, err := Open(db, Config{Endpoint: "https://core-1.example.test", ID: "core-primary", Name: "Primary", Mode: domain.CoreRoleActive})
	if err != nil {
		t.Fatal(err)
	}
	if !primary.CanManage() {
		t.Fatal("active core cannot manage")
	}
	status, err := primary.AddReplica(ReplicaInput{Endpoint: "https://core-2.example.test", ID: "core-standby", Name: "Standby"})
	if err != nil {
		t.Fatal(err)
	}
	if len(status.Members) != 2 || status.Members[1].AgentServerID != "" {
		t.Fatalf("core members = %#v; core membership must not imply agent enrollment", status.Members)
	}
	if _, err := primary.VerifyReplica("core-standby"); err != nil {
		t.Fatal(err)
	}
	if _, err := primary.PrepareHandoff("core-standby"); err != nil {
		t.Fatal(err)
	}
	if _, err := primary.FenceForHandoff("core-standby"); err != nil {
		t.Fatal(err)
	}
	if primary.CanManage() {
		t.Fatal("fenced primary remained writable")
	}

	standby, err := Open(db, Config{Endpoint: "https://core-2.example.test", ID: "core-standby", Name: "Standby", Mode: domain.CoreRoleStandby})
	if err != nil {
		t.Fatal(err)
	}
	if standby.CanManage() {
		t.Fatal("standby became active from its environment mode")
	}
	if _, err := standby.PromoteLocal(false); err != nil {
		t.Fatal(err)
	}
	status = standby.Status()
	if !status.ControlEnabled || status.ActiveID != "core-standby" || status.LocalRole != domain.CoreRoleActive || status.AuthorityEpoch != 2 {
		t.Fatalf("promoted topology = %#v", status)
	}
	// The old primary's process is still running and still holds a Store. It
	// must see the promotion, not its own last copy.
	if primary.CanManage() {
		t.Fatal("the former primary still believes it is active after the standby promoted")
	}
	if primary.AuthorityEpoch() != 2 {
		t.Fatalf("former primary epoch = %d, want 2", primary.AuthorityEpoch())
	}
}

func TestStandbyCannotChangeTopologyBeforePromotion(t *testing.T) {
	store, err := Open(sqltest.Open(t), Config{ID: "core-standby", Mode: domain.CoreRoleStandby})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := store.AddReplica(ReplicaInput{Endpoint: "https://core-2.example.test", ID: "core-other", Name: "Other"}); !errors.Is(err, ErrStandby) {
		t.Fatalf("AddReplica error = %v, want standby error", err)
	}
	if _, err := store.PromoteLocal(false); err == nil {
		t.Fatal("standby promoted without a fenced handoff")
	}
	if _, err := store.PromoteLocal(true); err != nil {
		t.Fatalf("emergency promotion = %v", err)
	}
}

// Two standbys racing an emergency promotion against one database: the lock on
// core_authority means exactly one wins each round and the epoch counts every
// promotion that committed, never skipping or repeating one.
func TestConcurrentEmergencyPromotionsSerialiseOnTheAuthorityRow(t *testing.T) {
	db := sqltest.Open(t)
	first, err := Open(db, Config{ID: "core-a", Mode: domain.CoreRoleStandby})
	if err != nil {
		t.Fatal(err)
	}
	second, err := Open(db, Config{ID: "core-b", Mode: domain.CoreRoleStandby})
	if err != nil {
		t.Fatal(err)
	}
	var wg sync.WaitGroup
	results := make([]error, 2)
	for index, store := range []*Store{first, second} {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, results[index] = store.PromoteLocal(true)
		}()
	}
	wg.Wait()
	succeeded := 0
	for _, err := range results {
		if err == nil {
			succeeded++
		}
	}
	status := first.Status()
	if succeeded == 0 || status.AuthorityEpoch != uint64(1+succeeded) {
		t.Fatalf("promotions succeeded=%d, epoch=%d", succeeded, status.AuthorityEpoch)
	}
	active := 0
	for _, member := range status.Members {
		if member.Role == domain.CoreRoleActive {
			active++
		}
	}
	if active != 1 {
		t.Fatalf("active members = %d, want exactly 1: %#v", active, status.Members)
	}
}

func TestImportFilesRestoresASealedTopology(t *testing.T) {
	dataDir := t.TempDir()
	key := bytes.Repeat([]byte{7}, 32)
	sealer, err := securestore.New(key)
	if err != nil {
		t.Fatal(err)
	}
	checkpoint := time.Date(2026, 9, 1, 12, 0, 0, 0, time.UTC)
	encoded, err := json.Marshal(stateFile{Version: 1, ActiveID: "core-primary", AuthorityEpoch: 4, Members: []domain.CoreMember{
		{ID: "core-primary", Name: "Primary", Role: domain.CoreRoleActive, ReplicaState: domain.CoreReplicaVerified},
		{ID: "core-standby", Name: "Standby", Endpoint: "https://core-2.example.test", Role: domain.CoreRoleStandby, ReplicaState: domain.CoreReplicaVerified, LastCheckpointAt: &checkpoint},
	}})
	if err != nil {
		t.Fatal(err)
	}
	if err := sealer.WriteFile(filepath.Join(dataDir, "core-topology.sealed"), stateKey, encoded); err != nil {
		t.Fatal(err)
	}
	db := sqltest.Open(t)
	if count, err := ImportFiles(context.Background(), db, dataDir, key); err != nil || count != 2 {
		t.Fatalf("import = %d, %v", count, err)
	}
	store, err := Open(db, Config{ID: "core-primary", Mode: domain.CoreRoleActive})
	if err != nil {
		t.Fatal(err)
	}
	status := store.Status()
	if !status.ControlEnabled || status.AuthorityEpoch != 4 || len(status.Members) != 2 {
		t.Fatalf("imported topology = %#v", status)
	}
	for _, member := range status.Members {
		if member.ID == "core-standby" && (member.LastCheckpointAt == nil || !member.LastCheckpointAt.Equal(checkpoint)) {
			t.Fatalf("standby checkpoint = %v", member.LastCheckpointAt)
		}
	}
}
