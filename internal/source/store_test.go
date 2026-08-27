package source

import (
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestConnectionStoreSealsTokensAndReturnsMaskedMetadata(t *testing.T) {
	directory := t.TempDir()
	key := bytes.Repeat([]byte{17}, 32)
	store, err := NewStore(directory, key)
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
	ciphertext, err := os.ReadFile(filepath.Join(directory, "source-connections.sealed"))
	if err != nil {
		t.Fatal(err)
	}
	if bytes.Contains(ciphertext, []byte("github_pat_private_value")) {
		t.Fatal("provider token was stored in plaintext")
	}
	reopened, err := NewStore(directory, key)
	if err != nil {
		t.Fatal(err)
	}
	record, found := reopened.get(created.ID)
	if !found || record.Token != "github_pat_private_value" {
		t.Fatalf("sealed connection did not round trip")
	}
	if len(reopened.List()) != 1 || reopened.List()[0].Name != "Work GitHub" {
		t.Fatalf("unexpected reopened list: %#v", reopened.List())
	}
}

func TestConnectionStoreUpdateAndRemoveAreDurable(t *testing.T) {
	directory := t.TempDir()
	key := bytes.Repeat([]byte{23}, 32)
	store, err := NewStore(directory, key)
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
	if updated.Name != "New" {
		t.Fatalf("updated name = %q", updated.Name)
	}
	if err := store.Remove(created.ID); err != nil {
		t.Fatal(err)
	}
	reopened, err := NewStore(directory, key)
	if err != nil {
		t.Fatal(err)
	}
	if len(reopened.List()) != 0 {
		t.Fatalf("removed connection returned: %#v", reopened.List())
	}
}
