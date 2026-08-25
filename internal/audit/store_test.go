package audit

import (
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/nimasrn/SwarmOps/internal/domain"
)

func TestStoreEncryptsAndReloadsAuditEvents(t *testing.T) {
	t.Parallel()
	dataDir := t.TempDir()
	store, err := Open(dataDir, testDataEncryptionKey(), testMaxEvents)
	if err != nil {
		t.Fatal(err)
	}
	recorded, err := store.Record(domain.AuditEvent{
		Action:  "server.connect",
		Actor:   "operator",
		Detail:  map[string]string{"name": "private target"},
		Outcome: "success",
		Target:  "server/server-1",
	})
	if err != nil {
		t.Fatal(err)
	}
	ciphertext, err := os.ReadFile(store.path)
	if err != nil {
		t.Fatal(err)
	}
	if bytes.Contains(ciphertext, []byte("private target")) {
		t.Fatal("encrypted audit log contains plaintext")
	}
	info, err := os.Stat(store.path)
	if err != nil {
		t.Fatal(err)
	}
	if got, want := info.Mode().Perm(), os.FileMode(0o600); got != want {
		t.Fatalf("audit file mode = %o, want %o", got, want)
	}
	reloaded, err := Open(dataDir, testDataEncryptionKey(), testMaxEvents)
	if err != nil {
		t.Fatal(err)
	}
	recent, err := reloaded.Recent(10)
	if err != nil {
		t.Fatal(err)
	}
	if len(recent) != 1 || recent[0].ID != recorded.ID || recent[0].Detail["name"] != "private target" {
		t.Fatalf("reloaded audit events = %#v", recent)
	}
}

func TestStoreMigratesLegacyPlaintextAuditLog(t *testing.T) {
	t.Parallel()
	dataDir := t.TempDir()
	legacyPath := filepath.Join(dataDir, "audit.ndjson")
	event, err := json.Marshal(domain.AuditEvent{Action: "server.remove", Actor: "operator", Outcome: "success", Target: "server/server-1"})
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(legacyPath, append(event, '\n'), 0o600); err != nil {
		t.Fatal(err)
	}
	store, err := Open(dataDir, testDataEncryptionKey(), testMaxEvents)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(legacyPath); !os.IsNotExist(err) {
		t.Fatalf("legacy plaintext audit log remains after migration: %v", err)
	}
	sealed, err := os.ReadFile(store.path)
	if err != nil {
		t.Fatal(err)
	}
	if bytes.Contains(sealed, []byte("server.remove")) {
		t.Fatal("sealed audit log contains plaintext event")
	}
	recent, err := store.Recent(1)
	if err != nil {
		t.Fatal(err)
	}
	if len(recent) != 1 || recent[0].Action != "server.remove" {
		t.Fatalf("migrated audit events = %#v", recent)
	}
}

func testDataEncryptionKey() []byte {
	return bytes.Repeat([]byte{29}, 32)
}

const testMaxEvents = 100

func TestStoreRetainsOnlyTheNewestEventsWithinLimit(t *testing.T) {
	t.Parallel()
	dataDir := t.TempDir()
	store, err := Open(dataDir, testDataEncryptionKey(), 3)
	if err != nil {
		t.Fatal(err)
	}
	ids := make([]string, 0, 5)
	for index := range 5 {
		event, err := store.Record(domain.AuditEvent{
			Action:  "command.queued",
			Actor:   "operator",
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
	reloaded, err := Open(dataDir, testDataEncryptionKey(), 3)
	if err != nil {
		t.Fatal(err)
	}
	persisted, err := reloaded.Recent(10)
	if err != nil {
		t.Fatal(err)
	}
	if len(persisted) != 3 || persisted[0].ID != ids[4] {
		t.Fatalf("persisted retention = %#v", persisted)
	}
}
