package coretopology

import (
	"bytes"
	"errors"
	"testing"

	"github.com/nimasrn/SwarmOps/internal/domain"
)

func TestStandbyMustBeExplicitlyPromotedAndNeverCreatesServerProfile(t *testing.T) {
	dataDir := t.TempDir()
	key := bytes.Repeat([]byte{7}, 32)
	primary, err := Open(dataDir, key, Config{Endpoint: "https://core-1.example.test", ID: "core-primary", Name: "Primary", Mode: domain.CoreRoleActive})
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

	standby, err := Open(dataDir, key, Config{Endpoint: "https://core-2.example.test", ID: "core-standby", Name: "Standby", Mode: domain.CoreRoleStandby})
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
	if !status.ControlEnabled || status.ActiveID != "core-standby" || status.LocalRole != domain.CoreRoleActive {
		t.Fatalf("promoted topology = %#v", status)
	}
}

func TestStandbyCannotChangeTopologyBeforePromotion(t *testing.T) {
	store, err := Open(t.TempDir(), bytes.Repeat([]byte{8}, 32), Config{ID: "core-standby", Mode: domain.CoreRoleStandby})
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
