package mobility

import (
	"bytes"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestStorePersistsOnlyReviewedMigrationVocabulary(t *testing.T) {
	t.Parallel()
	directory := t.TempDir()
	key := bytes.Repeat([]byte{7}, 32)
	store, err := Open(directory, key)
	if err != nil {
		t.Fatal(err)
	}
	now := time.Date(2026, 8, 25, 18, 0, 0, 0, time.UTC)
	store.now = func() time.Time { return now }
	definition, err := ResourceFor(ResourceMongo)
	if err != nil {
		t.Fatal(err)
	}
	migration, err := store.New(definition, "server-target", "node-target")
	if err != nil {
		t.Fatal(err)
	}
	if migration.State != StatePlanned || len(migration.Components) != 1 || migration.Components[0].Volume != "swarmops-mongo_swarmops_mongo_data" {
		t.Fatalf("migration = %#v", migration)
	}
	if _, err := store.Update(migration.ID, func(value *Migration) error {
		value.State = StateBurnIn
		value.Components[0].State = StateBurnIn
		value.Components[0].SourceNodeID = "node-source"
		value.Components[0].Bytes = 123
		return nil
	}); err != nil {
		t.Fatal(err)
	}
	reloaded, err := Open(directory, key)
	if err != nil {
		t.Fatal(err)
	}
	value, found := reloaded.Get(migration.ID)
	if !found || value.State != StateBurnIn || value.Components[0].SourceNodeID != "node-source" || value.Components[0].Bytes != 123 {
		t.Fatalf("reloaded migration = %#v, found=%t", value, found)
	}
	sealed, err := os.ReadFile(filepath.Join(directory, "mobility.sealed"))
	if err != nil {
		t.Fatal(err)
	}
	if bytes.Contains(sealed, []byte("node-source")) || bytes.Contains(sealed, []byte("server-target")) {
		t.Fatal("mobility state was not encrypted")
	}
}

func TestStoreDiscardsOnlyUnqueuedPlan(t *testing.T) {
	t.Parallel()
	store, err := Open(t.TempDir(), bytes.Repeat([]byte{9}, 32))
	if err != nil {
		t.Fatal(err)
	}
	definition, _ := ResourceFor(ResourceRedis)
	migration, err := store.New(definition, "server-target", "node-target")
	if err != nil {
		t.Fatal(err)
	}
	if err := store.DiscardPlanned(migration.ID); err != nil {
		t.Fatal(err)
	}
	if _, found := store.Get(migration.ID); found {
		t.Fatal("discarded plan remained in store")
	}
	migration, err = store.New(definition, "server-target", "node-target")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := store.Update(migration.ID, func(value *Migration) error { value.State = StateCopying; return nil }); err != nil {
		t.Fatal(err)
	}
	if err := store.DiscardPlanned(migration.ID); err == nil {
		t.Fatal("in-flight migration was discarded")
	}
}

func TestStoreAbandonRetainsSourceAndRefusesAmbiguousCleanup(t *testing.T) {
	t.Parallel()
	store, err := Open(t.TempDir(), bytes.Repeat([]byte{5}, 32))
	if err != nil {
		t.Fatal(err)
	}
	definition, err := ResourceFor(ResourcePostgres)
	if err != nil {
		t.Fatal(err)
	}
	migration, err := store.New(definition, "server-target", "node-target")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := store.Update(migration.ID, func(value *Migration) error {
		value.State = StateNeedsAttention
		value.Components[0].State = StateNeedsAttention
		return nil
	}); err != nil {
		t.Fatal(err)
	}
	closed, err := store.Abandon(migration.ID)
	if err != nil {
		t.Fatal(err)
	}
	if closed.State != StateAbandoned || closed.SourceCleanupStarted || closed.Components[0].State != StateAbandoned || !IsTerminal(closed.State) {
		t.Fatalf("closed migration = %#v", closed)
	}

	ambiguous, err := store.New(definition, "server-target-2", "node-target-2")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := store.Update(ambiguous.ID, func(value *Migration) error {
		value.State = StateNeedsAttention
		value.SourceCleanupStarted = true
		return nil
	}); err != nil {
		t.Fatal(err)
	}
	if _, err := store.Abandon(ambiguous.ID); err == nil {
		t.Fatal("ambiguous source cleanup was allowed to be closed")
	}
}

func TestCatalogRejectsUnknownServiceAndVolume(t *testing.T) {
	t.Parallel()
	if _, found := ComponentForService("unrelated_api"); found {
		t.Fatal("unreviewed service was accepted")
	}
	if IsManagedVolume("../../etc") || IsManagedVolume("swarmops_custom_data") {
		t.Fatal("unreviewed volume was accepted")
	}
}
