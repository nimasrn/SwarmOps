package logstore

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/nimasrn/SwarmOps/internal/agentcontrol"
)

// The collector and the reader are two processes that agree only on a file
// format. This pins that agreement: the line below is the shape
// fluentd/filter_swarmops_normalize.rb emits, down to the iso8601(6) timestamp.
const collectorLine = `{"id":"9f2b1c4d5e6f708192a3b4c5d6e7f809","timestamp":"2026-01-15T11:59:30.123456Z",` +
	`"level":"error","sourceKind":"container","node":"db-1","stack":"shop","service":"shop_api",` +
	`"containerId":"3f9a1b2c4d5e","stream":"stderr","message":"upstream timed out"}`

func TestOpenReaderReadsWhatTheCollectorWrote(t *testing.T) {
	t.Parallel()
	root := t.TempDir()
	records := filepath.Join(root, "records")
	if err := os.MkdirAll(records, 0o750); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(records, "log.20260904.jsonl"), []byte(collectorLine+"\n"), 0o640); err != nil {
		t.Fatal(err)
	}

	store, err := OpenReader(root)
	if err != nil {
		t.Fatal(err)
	}
	page, err := store.Query(context.Background(), agentcontrol.LogQuery{
		From:  time.Date(2026, time.January, 15, 11, 0, 0, 0, time.UTC),
		To:    time.Date(2026, time.January, 15, 13, 0, 0, 0, time.UTC),
		Limit: 50,
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(page.Records) != 1 {
		t.Fatalf("records = %d, want 1 — the collector's line did not parse", len(page.Records))
	}
	got := page.Records[0]
	if got.Service != "shop_api" || got.Level != "error" || got.Node != "db-1" || got.Message != "upstream timed out" {
		t.Fatalf("record = %+v, want the collector's fields", got)
	}
	// Forwarders counts nodes seen in the last two minutes. This record is
	// deliberately older than that, so an honest status reports none rather
	// than inventing a live forwarder from historical records.
	if status := store.Status(); status.RetainedBytes == 0 || status.Forwarders != 0 {
		t.Fatalf("status = %+v, want retained bytes and no recent forwarder", status)
	}
}

func TestOpenReaderRefusesToTrimTheCollectorsRecords(t *testing.T) {
	t.Parallel()
	root := t.TempDir()
	if err := os.MkdirAll(filepath.Join(root, "records"), 0o750); err != nil {
		t.Fatal(err)
	}
	store, err := OpenReader(root)
	if err != nil {
		t.Fatal(err)
	}

	if err := store.Cleanup(time.Now()); err == nil {
		t.Fatal("a read-only store must not trim records the collector owns")
	}
}

func TestCleanupEvidenceSurvivesTheProcessThatProducedIt(t *testing.T) {
	t.Parallel()
	root := t.TempDir()
	writer, err := New(root, time.Hour, 1)
	if err != nil {
		t.Fatal(err)
	}
	// One oversized file, so the capacity pass has something to evict.
	stale := filepath.Join(root, "records", "log.20260901.jsonl")
	if err := os.WriteFile(stale, []byte(collectorLine+"\n"), 0o640); err != nil {
		t.Fatal(err)
	}
	if err := os.Chtimes(stale, time.Now(), time.Now()); err != nil {
		t.Fatal(err)
	}
	if err := writer.Cleanup(time.Now()); err != nil {
		t.Fatal(err)
	}
	if writer.Status().CapacityEvictions == 0 {
		t.Fatal("expected the capacity pass to evict the oversized file")
	}

	reader, err := OpenReader(root)
	if err != nil {
		t.Fatal(err)
	}
	if got := reader.Status().CapacityEvictions; got != writer.Status().CapacityEvictions {
		t.Fatalf("reader evictions = %d, want the writer's %d — the console would show no eviction warning", got, writer.Status().CapacityEvictions)
	}
}
