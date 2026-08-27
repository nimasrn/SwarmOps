package logstore

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/nimasrn/SwarmOps/internal/agentcontrol"
)

func TestQueryFiltersAndStableCursor(t *testing.T) {
	root := t.TempDir()
	store, err := New(root, DefaultRetention, DefaultCapacity)
	if err != nil {
		t.Fatal(err)
	}
	now := time.Now().UTC().Truncate(time.Second)
	writeRecords(t, root, []agentcontrol.LogRecord{{ID: "a", Timestamp: now.Add(-2 * time.Minute), Level: "info", SourceKind: "host", Node: "n1", Message: "started"}, {ID: "b", Timestamp: now.Add(-time.Minute), Level: "error", SourceKind: "container", Node: "n2", Message: "database failed"}, {ID: "c", Timestamp: now, Level: "error", SourceKind: "container", Node: "n2", Message: "authorization=[REDACTED]"}})
	query := agentcontrol.LogQuery{From: now.Add(-time.Hour), To: now.Add(time.Second), Level: "error", Search: "a", Limit: 1}
	page, err := store.Query(context.Background(), query)
	if err != nil {
		t.Fatal(err)
	}
	if len(page.Records) != 1 || page.Records[0].ID != "c" || page.NextCursor == "" || !page.Truncated {
		t.Fatalf("unexpected first page: %+v", page)
	}
	query.Cursor = page.NextCursor
	next, err := store.Query(context.Background(), query)
	if err != nil {
		t.Fatal(err)
	}
	if len(next.Records) != 1 || next.Records[0].ID != "b" {
		t.Fatalf("unexpected second page: %+v", next)
	}
}

func TestQueryRejectsPathsAndMalformedFiles(t *testing.T) {
	root := t.TempDir()
	store, _ := New(root, DefaultRetention, DefaultCapacity)
	if _, err := store.Query(context.Background(), agentcontrol.LogQuery{Node: "../../etc/passwd"}); err == nil {
		t.Fatal("path-like filter accepted")
	}
	if err := os.WriteFile(filepath.Join(root, "records", "log.bad.jsonl"), []byte("not-json\n"), 0600); err != nil {
		t.Fatal(err)
	}
	page, err := store.Query(context.Background(), agentcontrol.LogQuery{})
	if err != nil || len(page.Records) != 0 {
		t.Fatalf("malformed recovery: page=%+v err=%v", page, err)
	}
	if store.Status().MalformedRecords == 0 {
		t.Fatal("malformed record counter was not exposed")
	}
}

func TestCleanupExpiresAndEvictsOldestFirst(t *testing.T) {
	root := t.TempDir()
	store, _ := New(root, time.Hour, 170)
	now := time.Now().UTC()
	records := filepath.Join(root, "records")
	paths := []string{filepath.Join(records, "log.old.jsonl"), filepath.Join(records, "log.first.jsonl"), filepath.Join(records, "log.second.jsonl")}
	for _, path := range paths {
		if err := os.WriteFile(path, []byte(strings.Repeat("x", 100)), 0600); err != nil {
			t.Fatal(err)
		}
	}
	_ = os.Chtimes(paths[0], now.Add(-2*time.Hour), now.Add(-2*time.Hour))
	_ = os.Chtimes(paths[1], now.Add(-30*time.Minute), now.Add(-30*time.Minute))
	_ = os.Chtimes(paths[2], now.Add(-10*time.Minute), now.Add(-10*time.Minute))
	if err := store.Cleanup(now); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(paths[0]); !os.IsNotExist(err) {
		t.Fatal("expired file retained")
	}
	if _, err := os.Stat(paths[1]); !os.IsNotExist(err) {
		t.Fatal("oldest capacity file retained")
	}
	if _, err := os.Stat(paths[2]); err != nil {
		t.Fatal("newest file was evicted")
	}
	if store.Status().CapacityEvictions != 1 {
		t.Fatalf("evictions=%d", store.Status().CapacityEvictions)
	}
}

func writeRecords(t *testing.T, root string, records []agentcontrol.LogRecord) {
	t.Helper()
	var data strings.Builder
	for _, record := range records {
		encoded, err := json.Marshal(record)
		if err != nil {
			t.Fatal(err)
		}
		data.Write(encoded)
		data.WriteByte('\n')
	}
	if err := os.WriteFile(filepath.Join(root, "records", "log.test.jsonl"), []byte(data.String()), 0600); err != nil {
		t.Fatal(err)
	}
}
