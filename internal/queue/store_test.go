package queue

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/nimasrn/SwarmOps/internal/domain"
	"github.com/nimasrn/SwarmOps/internal/securestore"
)

func TestSubmitIsEncryptedDurableAndIdempotent(t *testing.T) {
	t.Parallel()
	store := newTestStore(t)
	input := testInput()
	input.IdempotencyKey = "deploy-2026-08-24"
	input.Payload = []byte(`{"compose":"private-service-configuration"}`)

	command, created, err := store.Submit(input)
	if err != nil {
		t.Fatal(err)
	}
	if !created {
		t.Fatal("first submission was not created")
	}
	replayed, created, err := store.Submit(input)
	if err != nil {
		t.Fatal(err)
	}
	if created || replayed.ID != command.ID {
		t.Fatalf("idempotent submit = %#v, created=%t", replayed, created)
	}
	ciphertext, err := os.ReadFile(store.path)
	if err != nil {
		t.Fatal(err)
	}
	if bytes.Contains(ciphertext, []byte("private-service-configuration")) {
		t.Fatal("encrypted command ledger contains plaintext payload")
	}
	if got, want := mustFileMode(t, store.path), os.FileMode(0o600); got != want {
		t.Fatalf("command ledger mode = %o, want %o", got, want)
	}
	reloaded, err := Open(testDataDir(t, store), testDataKey(), testHistoryLimit)
	if err != nil {
		t.Fatal(err)
	}
	loaded, err := reloaded.Get(command.ID)
	if err != nil {
		t.Fatal(err)
	}
	if loaded.ID != command.ID || loaded.State != domain.CommandQueued {
		t.Fatalf("reloaded command = %#v", loaded)
	}
}

func TestCommandLogsAreEncryptedDurableAndRedacted(t *testing.T) {
	t.Parallel()
	store := newTestStore(t)
	command, _, err := store.Submit(testInput())
	if err != nil {
		t.Fatal(err)
	}
	if _, found, err := store.ClaimDue(); err != nil || !found {
		t.Fatalf("claim command: found=%t err=%v", found, err)
	}
	entry, err := store.AppendLog(command.ID, LogInput{
		Level:   "info",
		Message: "Docker completed with API_KEY=private-command-value",
		Source:  "machine",
	})
	if err != nil {
		t.Fatal(err)
	}
	if entry.Message != "Docker completed with API_KEY=[REDACTED]" || entry.Attempt != 1 {
		t.Fatalf("log entry = %#v", entry)
	}
	visible, err := store.Get(command.ID)
	if err != nil {
		t.Fatal(err)
	}
	if visible.LogCount != 1 || visible.LastLogAt == nil {
		t.Fatalf("command log summary = %#v", visible)
	}
	ciphertext, err := os.ReadFile(store.path)
	if err != nil {
		t.Fatal(err)
	}
	if bytes.Contains(ciphertext, []byte("private-command-value")) || bytes.Contains(ciphertext, []byte("Docker completed")) {
		t.Fatal("command logs were not encrypted")
	}
	if _, err := store.Complete(command.ID); err != nil {
		t.Fatal(err)
	}
	reloaded, err := Open(testDataDir(t, store), testDataKey(), testHistoryLimit)
	if err != nil {
		t.Fatal(err)
	}
	logs, err := reloaded.Logs(command.ID, 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(logs) != 1 || logs[0].Message != entry.Message {
		t.Fatalf("reloaded logs = %#v", logs)
	}
}

func TestCommandLogsRequireARunningCommand(t *testing.T) {
	t.Parallel()
	store := newTestStore(t)
	command, _, err := store.Submit(testInput())
	if err != nil {
		t.Fatal(err)
	}
	if _, err := store.AppendLog(command.ID, LogInput{Level: "info", Message: "not yet", Source: "controller"}); err == nil {
		t.Fatal("queued command accepted a log entry")
	}
}

func TestFailUsesExponentialBackoffAndBoundedAttention(t *testing.T) {
	t.Parallel()
	store := newTestStore(t)
	current := time.Date(2026, 8, 24, 12, 0, 0, 0, time.UTC)
	store.now = func() time.Time { return current }
	input := testInput()
	input.AutoRetry = true
	input.MaxAttempts = 2
	command, _, err := store.Submit(input)
	if err != nil {
		t.Fatal(err)
	}
	record, found, err := store.ClaimDue()
	if err != nil || !found || record.Command.ID != command.ID {
		t.Fatalf("claim = %#v, %t, %v", record, found, err)
	}
	failed, event, err := store.Fail(command.ID, errors.New("network unavailable"))
	if err != nil {
		t.Fatal(err)
	}
	if event != "retry_scheduled" || failed.State != domain.CommandRetryScheduled || failed.NextAttemptAt == nil {
		t.Fatalf("first failure = %#v, event=%q", failed, event)
	}
	if want := current.Add(2 * time.Second); !failed.NextAttemptAt.Equal(want) {
		t.Fatalf("next attempt = %s, want %s", failed.NextAttemptAt, want)
	}
	current = current.Add(2 * time.Second)
	if _, found, err := store.ClaimDue(); err != nil || !found {
		t.Fatalf("second claim found=%t err=%v", found, err)
	}
	failed, event, err = store.Fail(command.ID, errors.New("network unavailable"))
	if err != nil {
		t.Fatal(err)
	}
	if event != "needs_attention" || failed.State != domain.CommandNeedsAttention {
		t.Fatalf("bounded failure = %#v, event=%q", failed, event)
	}
	current = current.Add(time.Second)
	retried, err := store.RetryNow(command.ID)
	if err != nil {
		t.Fatal(err)
	}
	if retried.State != domain.CommandQueued || retried.Attempt != 0 || retried.NextAttemptAt == nil || !retried.NextAttemptAt.Equal(current) {
		t.Fatalf("manual retry = %#v", retried)
	}
}

func TestIdempotencyKeyCannotBeReusedForAnotherCommand(t *testing.T) {
	t.Parallel()
	store := newTestStore(t)
	input := testInput()
	if _, _, err := store.Submit(input); err != nil {
		t.Fatal(err)
	}
	input.Target = "stack/other"
	if _, _, err := store.Submit(input); !errors.Is(err, ErrIdempotencyConflict) {
		t.Fatalf("conflicting idempotency key error = %v", err)
	}
}

func TestManualRetryDoesNotSkipAutomaticBackoff(t *testing.T) {
	t.Parallel()
	store := newTestStore(t)
	input := testInput()
	input.AutoRetry = true
	input.MaxAttempts = 8
	command, _, err := store.Submit(input)
	if err != nil {
		t.Fatal(err)
	}
	if _, found, err := store.ClaimDue(); err != nil || !found {
		t.Fatalf("claim due: found=%v err=%v", found, err)
	}
	if _, event, err := store.Fail(command.ID, errors.New("transport unavailable")); err != nil || event != "retry_scheduled" {
		t.Fatalf("schedule retry: event=%q err=%v", event, err)
	}
	if _, err := store.RetryNow(command.ID); err == nil {
		t.Fatal("manual retry unexpectedly skipped the scheduled backoff")
	}
}

func TestRecoverTurnsInFlightCommandIntoNeedsAttention(t *testing.T) {
	t.Parallel()
	store := newTestStore(t)
	command, _, err := store.Submit(testInput())
	if err != nil {
		t.Fatal(err)
	}
	if _, found, err := store.ClaimDue(); err != nil || !found {
		t.Fatalf("claim found=%t err=%v", found, err)
	}
	reloaded, err := Open(testDataDir(t, store), testDataKey(), testHistoryLimit)
	if err != nil {
		t.Fatal(err)
	}
	value, err := reloaded.Get(command.ID)
	if err != nil {
		t.Fatal(err)
	}
	if value.State != domain.CommandNeedsAttention || value.LastError == "" {
		t.Fatalf("recovered command = %#v", value)
	}
}

func TestArtifactIsPrivateAndRemovedAfterSuccess(t *testing.T) {
	t.Parallel()
	store := newTestStore(t)
	input := testInput()
	input.MaxArtifactBytes = 1024
	command, created, err := store.SubmitArtifact(input, stringsReader("tar-context-with-private-files"))
	if err != nil {
		t.Fatal(err)
	}
	if !created || command.State != domain.CommandQueued {
		t.Fatalf("artifact command = %#v, created=%t", command, created)
	}
	if got, want := mustFileMode(t, store.artifactPath(command.ID)), os.FileMode(0o600); got != want {
		t.Fatalf("artifact mode = %o, want %o", got, want)
	}
	ciphertext, err := os.ReadFile(store.artifactPath(command.ID))
	if err != nil {
		t.Fatal(err)
	}
	if bytes.Contains(ciphertext, []byte("tar-context-with-private-files")) {
		t.Fatal("encrypted artifact contains plaintext")
	}
	artifact, err := store.Artifact(command.ID)
	if err != nil {
		t.Fatal(err)
	}
	data, err := io.ReadAll(artifact)
	_ = artifact.Close()
	if err != nil || string(data) != "tar-context-with-private-files" {
		t.Fatalf("artifact = %q, err=%v", data, err)
	}
	if _, found, err := store.ClaimDue(); err != nil || !found {
		t.Fatalf("claim found=%t err=%v", found, err)
	}
	if _, err := store.Complete(command.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := store.Artifact(command.ID); err == nil {
		t.Fatal("completed command still exposes its build input")
	}
	if _, err := os.Stat(store.artifactPath(command.ID)); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("completed artifact remains: %v", err)
	}
}

func TestLegacyPlaintextArtifactMigratesToEncryptedState(t *testing.T) {
	t.Parallel()
	store := newTestStore(t)
	input := testInput()
	input.MaxArtifactBytes = 1024
	command, _, err := store.SubmitArtifact(input, stringsReader("legacy build source"))
	if err != nil {
		t.Fatal(err)
	}
	if err := os.Remove(store.artifactPath(command.ID)); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(store.legacyArtifactPath(command.ID), []byte("legacy build source"), 0o600); err != nil {
		t.Fatal(err)
	}
	reloaded, err := Open(testDataDir(t, store), testDataKey(), testHistoryLimit)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(reloaded.legacyArtifactPath(command.ID)); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("legacy artifact remains: %v", err)
	}
	ciphertext, err := os.ReadFile(reloaded.artifactPath(command.ID))
	if err != nil {
		t.Fatal(err)
	}
	if bytes.Contains(ciphertext, []byte("legacy build source")) {
		t.Fatal("migrated artifact contains plaintext")
	}
	artifact, err := reloaded.Artifact(command.ID)
	if err != nil {
		t.Fatal(err)
	}
	data, err := io.ReadAll(artifact)
	_ = artifact.Close()
	if err != nil || string(data) != "legacy build source" {
		t.Fatalf("migrated artifact = %q, err=%v", data, err)
	}
}

func TestArtifactRejectsTamperedCiphertextBeforeUse(t *testing.T) {
	t.Parallel()
	store := newTestStore(t)
	input := testInput()
	input.MaxArtifactBytes = 1024
	command, _, err := store.SubmitArtifact(input, stringsReader("trusted build source"))
	if err != nil {
		t.Fatal(err)
	}
	ciphertext, err := os.ReadFile(store.artifactPath(command.ID))
	if err != nil {
		t.Fatal(err)
	}
	ciphertext[len(ciphertext)-1] ^= 1
	if err := os.WriteFile(store.artifactPath(command.ID), ciphertext, 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := store.Artifact(command.ID); !errors.Is(err, securestore.ErrInvalidCiphertext) {
		t.Fatalf("tampered artifact error = %v, want ErrInvalidCiphertext", err)
	}
}

func TestArtifactWriteFailureRetainsVisibleAttentionRecord(t *testing.T) {
	t.Parallel()
	store := newTestStore(t)
	input := testInput()
	input.MaxArtifactBytes = 1024
	command, created, err := store.SubmitArtifact(input, errReader{})
	if err == nil {
		t.Fatal("artifact write failure was accepted")
	}
	if !created || command.ID == "" || command.State != domain.CommandNeedsAttention {
		t.Fatalf("failed artifact command = %#v, created=%t", command, created)
	}
	visible, err := store.Get(command.ID)
	if err != nil {
		t.Fatal(err)
	}
	if visible.State != domain.CommandNeedsAttention {
		t.Fatalf("visible failed upload = %#v", visible)
	}
}

type errReader struct{}

func (errReader) Read([]byte) (int, error) { return 0, errors.New("source disappeared") }

func newTestStore(t *testing.T) *Store {
	t.Helper()
	store, err := Open(t.TempDir(), testDataKey(), testHistoryLimit)
	if err != nil {
		t.Fatal(err)
	}
	return store
}

const testHistoryLimit = 100

func testDataDir(t *testing.T, store *Store) string {
	t.Helper()
	return filepath.Dir(store.dir)
}

func testDataKey() []byte { return bytes.Repeat([]byte{47}, 32) }

func testInput() SubmitInput {
	return SubmitInput{
		Action:         "stack.deploy",
		Actor:          "operator",
		AutoRetry:      true,
		IdempotencyKey: "test-command-1",
		MaxAttempts:    3,
		Payload:        []byte(`{"name":"example"}`),
		RequestID:      "request-1",
		ServerID:       "server-1",
		Target:         "stack/example",
	}
}

func mustFileMode(t *testing.T, path string) os.FileMode {
	t.Helper()
	info, err := os.Stat(path)
	if err != nil {
		t.Fatal(err)
	}
	return info.Mode().Perm()
}

func stringsReader(value string) io.Reader { return bytes.NewBufferString(value) }

func TestStorePrunesOldestSucceededCommandsOnly(t *testing.T) {
	t.Parallel()
	store, err := Open(t.TempDir(), testDataKey(), 2)
	if err != nil {
		t.Fatal(err)
	}
	succeeded := make([]string, 0, 3)
	for index := range 3 {
		input := testInput()
		input.IdempotencyKey = fmt.Sprintf("terminal-command-%d", index)
		input.Target = fmt.Sprintf("stack/terminal-%d", index)
		command, _, err := store.Submit(input)
		if err != nil {
			t.Fatal(err)
		}
		if _, _, err := store.ClaimDue(); err != nil {
			t.Fatal(err)
		}
		if _, err := store.Complete(command.ID); err != nil {
			t.Fatal(err)
		}
		succeeded = append(succeeded, command.ID)
	}
	pending := testInput()
	pending.IdempotencyKey = "still-queued-command"
	pending.Target = "stack/pending"
	queued, _, err := store.Submit(pending)
	if err != nil {
		t.Fatal(err)
	}
	listed, err := store.List(500)
	if err != nil {
		t.Fatal(err)
	}
	states := map[string]domain.Command{}
	for _, item := range listed {
		states[item.ID] = item
	}
	if _, ok := states[succeeded[0]]; ok {
		t.Fatal("oldest succeeded command survived pruning")
	}
	for _, id := range succeeded[1:] {
		state, ok := states[id]
		if !ok || state.State != domain.CommandSucceeded {
			t.Fatalf("bounded succeeded command missing: %s", id)
		}
	}
	if state, ok := states[queued.ID]; !ok || state.State != domain.CommandQueued {
		t.Fatalf("active command was pruned: %#v", state)
	}
	reloaded, err := Open(testDataDir(t, store), testDataKey(), 2)
	if err != nil {
		t.Fatal(err)
	}
	relisted, err := reloaded.List(500)
	if err != nil {
		t.Fatal(err)
	}
	if len(relisted) != 3 {
		t.Fatalf("persisted ledger size = %d, want 3", len(relisted))
	}
}

func TestClaimDueRollsBackWhenTheDurableWriteFails(t *testing.T) {
	t.Parallel()
	store := newTestStore(t)
	command, _, err := store.Submit(testInput())
	if err != nil {
		t.Fatal(err)
	}
	broken := &securestore.Sealer{}
	working := store.sealer
	store.sealer = broken
	if _, _, err := store.ClaimDue(); err == nil {
		t.Fatal("claim unexpectedly succeeded with a broken sealer")
	}
	stored, err := store.Get(command.ID)
	if err != nil {
		t.Fatal(err)
	}
	if stored.State != domain.CommandQueued || stored.Attempt != 0 || stored.LastAttemptAt != nil {
		t.Fatalf("claim did not roll back its in-memory mutation: %#v", stored)
	}
	store.sealer = working
	record, found, err := store.ClaimDue()
	if err != nil || !found || record.Command.ID != command.ID {
		t.Fatalf("claim after recovery = %#v, %t, %v", record, found, err)
	}
}
