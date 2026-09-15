package source

import (
	"bytes"
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/nimasrn/SwarmOps/internal/securestore"
	"github.com/nimasrn/SwarmOps/internal/sqlstore/sqltest"
)

func TestConnectionStoreSealsTokensAndReturnsMaskedMetadata(t *testing.T) {
	db := sqltest.Open(t)
	store, err := NewStore(db)
	if err != nil {
		t.Fatal(err)
	}
	store.now = func() time.Time { return time.Date(2026, 8, 25, 8, 0, 0, 0, time.UTC) }
	created, err := store.Create(ConnectionInput{
		BaseURL: "https://api.github.com",
		Kind:    ProviderGitHub,
		Name:    "Work GitHub",
		Token:   "github_pat_private_value",
	}, "nima")
	if err != nil {
		t.Fatal(err)
	}
	encoded, err := json.Marshal(created)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(encoded), "private_value") || created.CredentialState != "stored" {
		t.Fatalf("unsafe public connection: %s", encoded)
	}
	var ciphertext []byte
	if err := db.Pool().QueryRow("SELECT token_sealed FROM source_connections WHERE id = ?", created.ID).Scan(&ciphertext); err != nil {
		t.Fatal(err)
	}
	if bytes.Contains(ciphertext, []byte("github_pat_private_value")) {
		t.Fatal("provider token was stored in plaintext")
	}
	reopened, err := NewStore(db)
	if err != nil {
		t.Fatal(err)
	}
	record, found := reopened.get(created.ID)
	if !found || record.Token != "github_pat_private_value" || record.Account != "nima" || !record.CreatedAt.Equal(created.CreatedAt) {
		t.Fatalf("sealed connection did not round trip: %#v", record.Connection)
	}
	if len(reopened.List()) != 1 || reopened.List()[0].Name != "Work GitHub" {
		t.Fatalf("unexpected reopened list: %#v", reopened.List())
	}
}

func TestConnectionStoreUpdateAndRemoveAreDurable(t *testing.T) {
	db := sqltest.Open(t)
	store, err := NewStore(db)
	if err != nil {
		t.Fatal(err)
	}
	created, err := store.Create(ConnectionInput{BaseURL: "https://gitlab.example/api/v4", Kind: ProviderGitLab, Name: "Old", Token: "old-private-token"}, "old-account")
	if err != nil {
		t.Fatal(err)
	}
	updated, err := store.Update(created.ID, ConnectionInput{BaseURL: "https://gitlab.example/api/v4", Kind: ProviderGitLab, Name: "New", Token: "new-private-token"}, "new-account")
	if err != nil {
		t.Fatal(err)
	}
	if updated.Name != "New" || !updated.CreatedAt.Equal(created.CreatedAt) {
		t.Fatalf("updated = %#v", updated)
	}
	if record, _ := store.get(created.ID); record.Token != "new-private-token" {
		t.Fatal("the updated token was not stored")
	}
	if _, err := store.Update("missing", ConnectionInput{Kind: ProviderGitLab, Name: "x", Token: "y"}, ""); !os.IsNotExist(err) {
		t.Fatalf("update of a missing connection = %v, want not-exist", err)
	}
	if err := store.Remove(created.ID); err != nil {
		t.Fatal(err)
	}
	if err := store.Remove(created.ID); !os.IsNotExist(err) {
		t.Fatalf("second remove = %v, want not-exist", err)
	}
	reopened, err := NewStore(db)
	if err != nil {
		t.Fatal(err)
	}
	if len(reopened.List()) != 0 {
		t.Fatalf("removed connection returned: %#v", reopened.List())
	}
}

func TestImportConnectionFilesReSealsTokensPerRow(t *testing.T) {
	dataDir := t.TempDir()
	key := sqltest.Key()
	sealer, err := securestore.New(key)
	if err != nil {
		t.Fatal(err)
	}
	now := time.Date(2026, 8, 1, 9, 0, 0, 0, time.UTC)
	encoded, err := json.Marshal(connectionFile{Version: 1, Connections: []storedConnection{{
		Connection: Connection{ID: "00000000000000000000000000000abc", Kind: ProviderGitea, Name: "Forge", BaseURL: "https://git.example.com/api/v1", CreatedAt: now, UpdatedAt: now},
		Token:      "forge-token",
	}}})
	if err != nil {
		t.Fatal(err)
	}
	if err := sealer.WriteFile(filepath.Join(dataDir, "source-connections.sealed"), connectionStateKey, encoded); err != nil {
		t.Fatal(err)
	}
	db := sqltest.Open(t)
	count, err := ImportConnectionFiles(context.Background(), db, dataDir, key)
	if err != nil || count != 1 {
		t.Fatalf("import = %d, %v", count, err)
	}
	store, err := NewStore(db)
	if err != nil {
		t.Fatal(err)
	}
	record, found := store.get("00000000000000000000000000000abc")
	if !found || record.Token != "forge-token" || !record.CreatedAt.Equal(now) {
		t.Fatalf("imported connection = %#v", record)
	}
}
