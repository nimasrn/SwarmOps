package queue

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
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
	if failed.FailureCode != "execution_not_confirmed" || failed.FailureSummary == "" || failed.RecoveryHint == "" {
		t.Fatalf("failure guidance = %#v", failed)
	}
	current = current.Add(time.Second)
	retried, err := store.RetryNow(command.ID, command.AuthorityEpoch)
	if err != nil {
		t.Fatal(err)
	}
	if retried.State != domain.CommandQueued || retried.Attempt != 0 || retried.NextAttemptAt == nil || !retried.NextAttemptAt.Equal(current) {
		t.Fatalf("manual retry = %#v", retried)
	}
}

func TestObservabilityFailureKeepsSafeRecoveryGuidance(t *testing.T) {
	t.Parallel()
	store := newTestStore(t)
	input := testInput()
	input.Action = "observability.core"
	command, _, err := store.Submit(input)
	if err != nil {
		t.Fatal(err)
	}
	if _, found, err := store.ClaimDue(); err != nil || !found {
		t.Fatalf("claim found=%t err=%v", found, err)
	}
	failed, event, err := store.Fail(command.ID, PermanentError(errors.New("Traefik singleton service was not found")))
	if err != nil {
		t.Fatal(err)
	}
	if event != "needs_attention" || failed.FailureCode != "gateway_required" {
		t.Fatalf("failure = %#v event=%q", failed, event)
	}
	if !strings.Contains(failed.RecoveryHint, "Gateway, routes & DNS") {
		t.Fatalf("recovery hint = %q", failed.RecoveryHint)
	}
}

func TestTraefikACMEFailureKeepsSafeRecoveryGuidance(t *testing.T) {
	t.Parallel()
	store := newTestStore(t)
	input := testInput()
	input.Action = "traefik.reconcile"
	command, _, err := store.Submit(input)
	if err != nil {
		t.Fatal(err)
	}
	if _, found, err := store.ClaimDue(); err != nil || !found {
		t.Fatalf("claim found=%t err=%v", found, err)
	}
	failed, event, err := store.Fail(command.ID, PermanentError(errors.New("Traefik ACME email is not configured")))
	if err != nil {
		t.Fatal(err)
	}
	if event != "needs_attention" || failed.FailureCode != "traefik_acme_email_required" {
		t.Fatalf("failure = %#v event=%q", failed, event)
	}
	if !strings.Contains(failed.FailureSummary, "ACME contact email") || !strings.Contains(failed.RecoveryHint, "Gateway & ports") {
		t.Fatalf("failure guidance = %#v", failed)
	}
}

type testSafeFailure struct{ code string }

func (err testSafeFailure) Error() string           { return "machine API returned HTTP 502" }
func (err testSafeFailure) SafeFailureCode() string { return err.code }

func TestTraefikMachineFailureKeepsSpecificSafeRecoveryGuidance(t *testing.T) {
	t.Parallel()
	store := newTestStore(t)
	input := testInput()
	input.Action = "traefik.reconcile"
	command, _, err := store.Submit(input)
	if err != nil {
		t.Fatal(err)
	}
	if _, found, err := store.ClaimDue(); err != nil || !found {
		t.Fatalf("claim found=%t err=%v", found, err)
	}
	failed, event, err := store.Fail(command.ID, PermanentError(testSafeFailure{code: "docker_port_unavailable"}))
	if err != nil {
		t.Fatal(err)
	}
	if event != "needs_attention" || failed.FailureCode != "traefik_port_unavailable" {
		t.Fatalf("failure = %#v event=%q", failed, event)
	}
	if !strings.Contains(failed.FailureSummary, "gateway port") || !strings.Contains(failed.RecoveryHint, "ports 80 or 443") {
		t.Fatalf("failure guidance = %#v", failed)
	}
}

func TestPullLeaseLifecycleRequiresCapabilityAndPersistsAgentStates(t *testing.T) {
	t.Parallel()
	store := newTestStore(t)
	current := time.Date(2026, 8, 27, 8, 0, 0, 0, time.UTC)
	store.now = func() time.Time { return current }
	command, _, err := store.Submit(testInput())
	if err != nil {
		t.Fatal(err)
	}
	lease, found, err := store.LeaseDue(command.ServerID, 7, 30*time.Second)
	if err != nil || !found {
		t.Fatalf("lease due: found=%t err=%v", found, err)
	}
	if lease.LeaseID == "" || lease.Record.Command.State != domain.CommandLeased || lease.Record.Command.AuthorityEpoch != 7 || lease.Record.Command.LeaseExpiresAt == nil {
		t.Fatalf("lease = %#v", lease)
	}
	if _, err := store.AdvanceLease(command.ID, "wrong-lease", domain.CommandPreparing); err == nil {
		t.Fatal("wrong lease capability advanced the command")
	}
	if prepared, err := store.AdvanceLease(command.ID, lease.LeaseID, domain.CommandPreparing); err != nil || prepared.State != domain.CommandPreparing {
		t.Fatalf("prepare = %#v err=%v", prepared, err)
	}
	if running, err := store.AdvanceLease(command.ID, lease.LeaseID, domain.CommandRunning); err != nil || running.State != domain.CommandRunning {
		t.Fatalf("running = %#v err=%v", running, err)
	}
	current = current.Add(5 * time.Second)
	if renewed, err := store.RenewLease(command.ID, lease.LeaseID, time.Minute); err != nil || renewed.LeaseExpiresAt == nil || !renewed.LeaseExpiresAt.Equal(current.Add(time.Minute)) {
		t.Fatalf("renewed = %#v err=%v", renewed, err)
	}
	completed, err := store.CompleteLease(command.ID, lease.LeaseID)
	if err != nil || completed.State != domain.CommandSucceeded || completed.LeaseExpiresAt != nil {
		t.Fatalf("completed = %#v err=%v", completed, err)
	}
}

func TestFenceAuthorityRetainsUnfinishedCommandsForReview(t *testing.T) {
	t.Parallel()
	store := newTestStore(t)
	input := testInput()
	input.AuthorityEpoch = 7
	command, _, err := store.Submit(input)
	if err != nil {
		t.Fatal(err)
	}
	if err := store.FenceAuthority(8); err != nil {
		t.Fatal(err)
	}
	fenced, err := store.Get(command.ID)
	if err != nil {
		t.Fatal(err)
	}
	if fenced.State != domain.CommandNeedsAttention || !strings.Contains(fenced.LastError, "authority changed") {
		t.Fatalf("fenced command = %#v", fenced)
	}
	if _, found, err := store.ClaimDue(); err != nil || found {
		t.Fatalf("fenced command remained claimable: found=%v err=%v", found, err)
	}
	retried, err := store.RetryNow(command.ID, 8)
	if err != nil {
		t.Fatal(err)
	}
	if retried.State != domain.CommandQueued || retried.AuthorityEpoch != 8 {
		t.Fatalf("retried command did not adopt the new authority: %#v", retried)
	}
}

func TestExpiredPullLeaseBecomesRetryOrAttention(t *testing.T) {
	t.Parallel()
	store := newTestStore(t)
	current := time.Date(2026, 8, 27, 9, 0, 0, 0, time.UTC)
	store.now = func() time.Time { return current }
	input := testInput()
	input.AutoRetry = true
	input.MaxAttempts = 2
	command, _, err := store.Submit(input)
	if err != nil {
		t.Fatal(err)
	}
	if _, found, err := store.LeaseDue(command.ServerID, 3, 5*time.Second); err != nil || !found {
		t.Fatalf("first lease found=%t err=%v", found, err)
	}
	current = current.Add(6 * time.Second)
	if _, _, err := store.LeaseDue(command.ServerID, 3, 5*time.Second); err != nil {
		t.Fatal(err)
	}
	retrying, err := store.Get(command.ID)
	if err != nil || retrying.State != domain.CommandRetryScheduled || retrying.NextAttemptAt == nil {
		t.Fatalf("retrying = %#v err=%v", retrying, err)
	}
	current = retrying.NextAttemptAt.Add(time.Second)
	second, found, err := store.LeaseDue(command.ServerID, 3, 5*time.Second)
	if err != nil || !found {
		t.Fatalf("second lease found=%t err=%v", found, err)
	}
	current = current.Add(6 * time.Second)
	if _, _, err := store.LeaseDue(command.ServerID, 3, 5*time.Second); err != nil {
		t.Fatal(err)
	}
	attention, err := store.Get(command.ID)
	if err != nil || attention.State != domain.CommandNeedsAttention || attention.LeaseExpiresAt != nil || second.LeaseID == "" {
		t.Fatalf("attention = %#v err=%v", attention, err)
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

func TestSubmitSupersedesOlderPendingCommandForSameServerActionAndTarget(t *testing.T) {
	t.Parallel()
	store := newTestStore(t)
	first := testInput()
	first.IdempotencyKey = "first-intent"
	first.Payload = []byte(`{"name":"example","replicas":1}`)
	older, _, err := store.Submit(first)
	if err != nil {
		t.Fatal(err)
	}
	second := first
	second.IdempotencyKey = "latest-intent"
	second.Payload = []byte(`{"name":"example","replicas":3}`)
	submission, err := store.SubmitWithResult(second)
	if err != nil {
		t.Fatal(err)
	}
	if !submission.Created || submission.Command.ID == older.ID || len(submission.Superseded) != 1 || submission.Superseded[0].ID != older.ID {
		t.Fatalf("submission = %#v", submission)
	}
	commands, err := store.List(10)
	if err != nil {
		t.Fatal(err)
	}
	if len(commands) != 1 || commands[0].ID != submission.Command.ID || commands[0].State != domain.CommandQueued {
		t.Fatalf("commands = %#v", commands)
	}
}

func TestSubmitKeepsRunningAndNeedsAttentionCommandsVisible(t *testing.T) {
	t.Parallel()
	store := newTestStore(t)
	first := testInput()
	first.IdempotencyKey = "running-intent"
	running, _, err := store.Submit(first)
	if err != nil {
		t.Fatal(err)
	}
	if _, found, err := store.ClaimDue(); err != nil || !found {
		t.Fatalf("claim running command: found=%t err=%v", found, err)
	}
	second := first
	second.IdempotencyKey = "newer-running-intent"
	submission, err := store.SubmitWithResult(second)
	if err != nil {
		t.Fatal(err)
	}
	if len(submission.Superseded) != 0 {
		t.Fatalf("running command was superseded: %#v", submission.Superseded)
	}
	queuedID := submission.Command.ID
	if _, _, err := store.Fail(running.ID, PermanentError(errors.New("unknown remote outcome"))); err != nil {
		t.Fatal(err)
	}
	third := first
	third.IdempotencyKey = "newer-attention-intent"
	submission, err = store.SubmitWithResult(third)
	if err != nil {
		t.Fatal(err)
	}
	// The queued second command may be superseded, but the explicit
	// needs-attention record must remain in the ledger for review.
	if len(submission.Superseded) != 1 || submission.Superseded[0].ID != queuedID {
		t.Fatalf("unexpected supersession result: %#v", submission.Superseded)
	}
	listed, err := store.List(10)
	if err != nil {
		t.Fatal(err)
	}
	if len(listed) != 2 {
		t.Fatalf("ledger lost running attention record: %#v", listed)
	}
	foundAttention := false
	for _, command := range listed {
		if command.ID == running.ID && command.State == domain.CommandNeedsAttention {
			foundAttention = true
		}
	}
	if !foundAttention {
		t.Fatalf("needs-attention command was removed: %#v", listed)
	}
}

func TestSubmitDoesNotSupersedeDifferentActionOrTarget(t *testing.T) {
	t.Parallel()
	store := newTestStore(t)
	first := testInput()
	first.IdempotencyKey = "original"
	if _, _, err := store.Submit(first); err != nil {
		t.Fatal(err)
	}
	differentTarget := first
	differentTarget.IdempotencyKey = "different-target"
	differentTarget.Target = "stack/other"
	if result, err := store.SubmitWithResult(differentTarget); err != nil || len(result.Superseded) != 0 {
		t.Fatalf("different target result=%#v err=%v", result, err)
	}
	differentAction := first
	differentAction.IdempotencyKey = "different-action"
	differentAction.Action = "stack.remove"
	if result, err := store.SubmitWithResult(differentAction); err != nil || len(result.Superseded) != 0 {
		t.Fatalf("different action result=%#v err=%v", result, err)
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
	if _, err := store.RetryNow(command.ID, command.AuthorityEpoch); err == nil {
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

func TestSubmitArtifactSupersedesOlderQueuedArtifact(t *testing.T) {
	t.Parallel()
	store := newTestStore(t)
	first := testInput()
	first.IdempotencyKey = "first-build-intent"
	first.MaxArtifactBytes = 1024
	older, _, err := store.SubmitArtifact(first, stringsReader("old-private-context"))
	if err != nil {
		t.Fatal(err)
	}
	second := first
	second.IdempotencyKey = "latest-build-intent"
	submission, err := store.SubmitArtifactWithResult(second, stringsReader("latest-private-context"))
	if err != nil {
		t.Fatal(err)
	}
	if len(submission.Superseded) != 1 || submission.Superseded[0].ID != older.ID {
		t.Fatalf("artifact supersession = %#v", submission)
	}
	if _, err := store.Get(older.ID); err == nil {
		t.Fatal("older artifact command remained in the ledger")
	}
	if _, err := os.Stat(store.artifactPath(older.ID)); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("older artifact was retained: %v", err)
	}
	artifact, err := store.Artifact(submission.Command.ID)
	if err != nil {
		t.Fatal(err)
	}
	data, readErr := io.ReadAll(artifact)
	_ = artifact.Close()
	if readErr != nil || string(data) != "latest-private-context" {
		t.Fatalf("latest artifact = %q, err=%v", data, readErr)
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

// A refusal is not an unconfirmed change.
//
// "SwarmOps could not confirm that the requested change completed" sent
// operators to inspect Docker, where nothing was wrong: the controller had
// declined before it ever spoke to a machine, and retrying could not help.
// This was the single most misleading message in the product.
func TestPolicyRefusalIsNotReportedAsAnUnconfirmedChange(t *testing.T) {
	for _, sample := range []struct {
		message string
		code    string
	}{
		{"browser stack deployment requires a reviewed platform manifest", "platform_manifest_required"},
		{`stack "shop" is not declared in the reviewed platform manifest`, "stack_not_declared"},
	} {
		code, summary, hint := commandFailureDiagnostic("stack.deploy", errors.New(sample.message))
		if code != sample.code {
			t.Fatalf("%q classified as %q, expected %q", sample.message, code, sample.code)
		}
		if strings.Contains(summary, "could not confirm") {
			t.Fatalf("a refusal must not be described as an unconfirmed change: %q", summary)
		}
		if hint == "" {
			t.Fatalf("%q gives the operator no next step", sample.message)
		}
	}
}
