package audit

import (
	"bytes"
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
	"testing"

	"github.com/nimasrn/SwarmOps/internal/domain"
	"github.com/nimasrn/SwarmOps/internal/securestore"
	"github.com/nimasrn/SwarmOps/internal/sqlstore/sqltest"
)

const testMaxEvents = 100

func TestStorePersistsAndReloadsAuditEventsWithDetails(t *testing.T) {
	t.Parallel()
	db := sqltest.Open(t)
	store, err := Open(db, testMaxEvents)
	if err != nil {
		t.Fatal(err)
	}
	recorded, err := store.Record(domain.AuditEvent{
		Action:    "server.connect",
		Actor:     "operator",
		Detail:    map[string]string{"name": "private target", "zone": "a"},
		Outcome:   "success",
		RequestID: "req-1",
		Target:    "server/server-1",
	})
	if err != nil {
		t.Fatal(err)
	}
	reloaded, err := Open(db, testMaxEvents)
	if err != nil {
		t.Fatal(err)
	}
	recent, err := reloaded.Recent(10)
	if err != nil {
		t.Fatal(err)
	}
	if len(recent) != 1 || recent[0].ID != recorded.ID || recent[0].Detail["name"] != "private target" || recent[0].Detail["zone"] != "a" || recent[0].RequestID != "req-1" {
		t.Fatalf("reloaded audit events = %#v", recent)
	}
	if !recent[0].OccurredAt.Equal(recorded.OccurredAt) {
		t.Fatalf("occurred at = %v, want %v", recent[0].OccurredAt, recorded.OccurredAt)
	}
}

func TestStoreRetainsOnlyTheNewestEventsWithinLimit(t *testing.T) {
	t.Parallel()
	db := sqltest.Open(t)
	store, err := Open(db, 3)
	if err != nil {
		t.Fatal(err)
	}
	ids := make([]string, 0, 5)
	for index := range 5 {
		event, err := store.Record(domain.AuditEvent{
			Action:  "command.queued",
			Actor:   "operator",
			Detail:  map[string]string{"n": string(rune('a' + index))},
			Outcome: "success",
			Target:  "command/test-" + string(rune('a'+index)),
		})
		if err != nil {
			t.Fatal(err)
		}
		ids = append(ids, event.ID)
	}
	recent, err := store.Recent(10)
	if err != nil {
		t.Fatal(err)
	}
	if len(recent) != 3 {
		t.Fatalf("retained events = %d, want 3", len(recent))
	}
	// Recent returns newest first; the two oldest records must be gone.
	if recent[0].ID != ids[4] || recent[1].ID != ids[3] || recent[2].ID != ids[2] {
		t.Fatalf("retained order = %#v", recent)
	}
	var orphanDetails int
	if err := db.Pool().QueryRow("SELECT COUNT(*) FROM audit_event_details d LEFT JOIN audit_events e ON e.seq = d.event_seq WHERE e.seq IS NULL").Scan(&orphanDetails); err != nil {
		t.Fatal(err)
	}
	if orphanDetails != 0 {
		t.Fatalf("trimmed events left %d detail rows behind", orphanDetails)
	}
}

func TestStoreRecordsConcurrentEventsWithoutLoss(t *testing.T) {
	t.Parallel()
	db := sqltest.Open(t)
	store, err := Open(db, 1000)
	if err != nil {
		t.Fatal(err)
	}
	var wg sync.WaitGroup
	for index := range 40 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if _, err := store.Record(domain.AuditEvent{Action: "login.failed", Actor: "anonymous", Outcome: "denied", Target: "session", Detail: map[string]string{"i": string(rune('0' + index%10))}}); err != nil {
				t.Error(err)
			}
		}()
	}
	wg.Wait()
	recent, err := store.Recent(500)
	if err != nil {
		t.Fatal(err)
	}
	if len(recent) != 40 {
		t.Fatalf("recorded %d events, want 40", len(recent))
	}
}

func TestImportFilesCopiesSealedHistoryInOrderAndIsRepeatable(t *testing.T) {
	t.Parallel()
	dataDir := t.TempDir()
	key := bytes.Repeat([]byte{29}, 32)
	sealer, err := securestore.New(key)
	if err != nil {
		t.Fatal(err)
	}
	history := auditFile{Version: 1, Events: []domain.AuditEvent{
		{ID: "00000000000000000000000000000001", Action: "server.add", Actor: "operator", Outcome: "success", Target: "server/a", Detail: map[string]string{"name": "a"}},
		{ID: "00000000000000000000000000000002", Action: "server.remove", Actor: "operator", Outcome: "success", Target: "server/a"},
	}}
	encoded, err := json.Marshal(history)
	if err != nil {
		t.Fatal(err)
	}
	if err := sealer.WriteFile(filepath.Join(dataDir, "audit.sealed"), auditStateKey, encoded); err != nil {
		t.Fatal(err)
	}
	db := sqltest.Open(t)
	for attempt := range 2 {
		count, err := ImportFiles(context.Background(), db, dataDir, key)
		if err != nil {
			t.Fatal(err)
		}
		if want := []int{2, 0}[attempt]; count != want {
			t.Fatalf("import attempt %d imported %d, want %d", attempt+1, count, want)
		}
	}
	store, err := Open(db, testMaxEvents)
	if err != nil {
		t.Fatal(err)
	}
	recent, err := store.Recent(10)
	if err != nil {
		t.Fatal(err)
	}
	if len(recent) != 2 || recent[0].Action != "server.remove" || recent[1].Detail["name"] != "a" {
		t.Fatalf("imported history = %#v", recent)
	}
	if _, err := os.Stat(filepath.Join(dataDir, "audit.sealed")); err != nil {
		t.Fatalf("import removed the source file it must keep as a backup: %v", err)
	}
}

func TestImportFilesReadsTheLegacyPlaintextLog(t *testing.T) {
	t.Parallel()
	dataDir := t.TempDir()
	event, err := json.Marshal(domain.AuditEvent{Action: "server.remove", Actor: "operator", Outcome: "success", Target: "server/server-1"})
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dataDir, "audit.ndjson"), append(event, '\n'), 0o600); err != nil {
		t.Fatal(err)
	}
	db := sqltest.Open(t)
	count, err := ImportFiles(context.Background(), db, dataDir, bytes.Repeat([]byte{29}, 32))
	if err != nil {
		t.Fatal(err)
	}
	if count != 1 {
		t.Fatalf("imported %d legacy events, want 1", count)
	}
}
