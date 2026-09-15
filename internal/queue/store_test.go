package queue

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"syscall"
	"testing"
	"testing/iotest"
	"time"

	"github.com/nimasrn/SwarmOps/internal/domain"
	"github.com/nimasrn/SwarmOps/internal/securestore"
	"github.com/nimasrn/SwarmOps/internal/sqlstore/sqltest"
)

func TestSubmitIsSealedDurableAndIdempotent(t *testing.T) {
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
	var sealed []byte
	if err := store.db.Pool().QueryRow("SELECT payload_sealed FROM command_payloads WHERE command_id = ?", command.ID).Scan(&sealed); err != nil {
		t.Fatal(err)
	}
	if bytes.Contains(sealed, []byte("private-service-configuration")) {
		t.Fatal("the command payload was stored in the clear")
	}
	loaded, err := reopen(t, store).Get(command.ID)
	if err != nil {
		t.Fatal(err)
	}
	if loaded.ID != command.ID || loaded.State != domain.CommandQueued || !loaded.CreatedAt.Equal(command.CreatedAt) {
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
	if string(record.Payload) != `{"name":"example"}` {
		t.Fatalf("claimed payload = %s", record.Payload)
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
	var payloads int
	if err := store.db.Pool().QueryRow("SELECT COUNT(*) FROM command_payloads WHERE command_id = ?", command.ID).Scan(&payloads); err != nil {
		t.Fatal(err)
	}
	if payloads != 0 {
		t.Fatal("a succeeded command kept its raw payload")
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
	var orphaned int
	if err := store.db.Pool().QueryRow("SELECT COUNT(*) FROM command_payloads WHERE command_id = ?", older.ID).Scan(&orphaned); err != nil {
		t.Fatal(err)
	}
	if orphaned != 0 {
		t.Fatal("a superseded command left its payload row behind")
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
	reloaded := reopen(t, store)
	if err := reloaded.Recover(); err != nil {
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

// Opening the store is what a standby controller does too. If opening reclaimed
// in-flight work, a standby starting against the database would mark the
// active controller's running command as abandoned while it was still running.
func TestOpeningTheStoreDoesNotReclaimAnotherControllersWork(t *testing.T) {
	t.Parallel()
	store := newTestStore(t)
	command, _, err := store.Submit(testInput())
	if err != nil {
		t.Fatal(err)
	}
	if _, found, err := store.ClaimDue(); err != nil || !found {
		t.Fatalf("claim found=%t err=%v", found, err)
	}
	value, err := reopen(t, store).Get(command.ID)
	if err != nil {
		t.Fatal(err)
	}
	if value.State != domain.CommandRunning {
		t.Fatalf("opening a second store changed a running command to %q", value.State)
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
	reloaded := reopen(t, store)
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
	return newTestStoreWithLimit(t, testHistoryLimit)
}

func newTestStoreWithLimit(t *testing.T, limit int) *Store {
	t.Helper()
	store, err := Open(sqltest.Open(t), t.TempDir(), testDataKey(), limit)
	if err != nil {
		t.Fatal(err)
	}
	return store
}

// reopen returns a second store on the same database and input directory, as
// a restarted controller would open.
func reopen(t *testing.T, store *Store) *Store {
	t.Helper()
	reopened, err := Open(store.db, filepath.Dir(store.dir), testDataKey(), store.historyLimit)
	if err != nil {
		t.Fatal(err)
	}
	return reopened
}

// corruptPayload replaces a command's sealed payload with bytes that do not
// open, so the next claim fails inside its transaction after it has already
// updated the row. It returns a function that restores the original.
func corruptPayload(t *testing.T, store *Store, id string) func() {
	t.Helper()
	var original []byte
	if err := store.db.Pool().QueryRow("SELECT payload_sealed FROM command_payloads WHERE command_id = ?", id).Scan(&original); err != nil {
		t.Fatal(err)
	}
	if _, err := store.db.Pool().Exec("UPDATE command_payloads SET payload_sealed = ? WHERE command_id = ?", []byte("not a sealed payload"), id); err != nil {
		t.Fatal(err)
	}
	return func() {
		if _, err := store.db.Pool().Exec("UPDATE command_payloads SET payload_sealed = ? WHERE command_id = ?", original, id); err != nil {
			t.Fatal(err)
		}
	}
}

const testHistoryLimit = 100

func testDataKey() []byte { return sqltest.Key() }

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
	store := newTestStoreWithLimit(t, 2)
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
	relisted, err := reopen(t, store).List(500)
	if err != nil {
		t.Fatal(err)
	}
	if len(relisted) != 3 {
		t.Fatalf("persisted ledger size = %d, want 3", len(relisted))
	}
}

// A claim that fails part-way must leave the row exactly as it was: the
// attempt counter and state are changed and then rolled back with the
// transaction, rather than left as a phantom running command that would block
// every later claim.
func TestClaimDueRollsBackWhenTheTransactionFails(t *testing.T) {
	t.Parallel()
	store := newTestStore(t)
	command, _, err := store.Submit(testInput())
	if err != nil {
		t.Fatal(err)
	}
	restore := corruptPayload(t, store, command.ID)
	if _, _, err := store.ClaimDue(); err == nil {
		t.Fatal("claim unexpectedly succeeded with an unreadable payload")
	}
	stored, err := store.Get(command.ID)
	if err != nil {
		t.Fatal(err)
	}
	if stored.State != domain.CommandQueued || stored.Attempt != 0 || stored.LastAttemptAt != nil {
		t.Fatalf("claim did not roll back: %#v", stored)
	}
	restore()
	record, found, err := store.ClaimDue()
	if err != nil || !found || record.Command.ID != command.ID {
		t.Fatalf("claim after recovery = %#v, %t, %v", record, found, err)
	}
}

// The single-claim rule has to hold between controller processes, not only
// between goroutines in one: every store here is a separate Store value, and
// they share nothing but the database.
func TestOnlyOneCommandRunsAtATimeAcrossStores(t *testing.T) {
	t.Parallel()
	first := newTestStore(t)
	for index := range 5 {
		input := testInput()
		input.IdempotencyKey = fmt.Sprintf("parallel-%d", index)
		input.Target = fmt.Sprintf("stack/parallel-%d", index)
		if _, _, err := first.Submit(input); err != nil {
			t.Fatal(err)
		}
	}
	stores := []*Store{first, reopen(t, first), reopen(t, first)}
	var wg sync.WaitGroup
	var mu sync.Mutex
	claimed := 0
	for index := range 12 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, found, err := stores[index%len(stores)].ClaimDue()
			if err != nil {
				t.Error(err)
				return
			}
			if found {
				mu.Lock()
				claimed++
				mu.Unlock()
			}
		}()
	}
	wg.Wait()
	var running int
	if err := first.db.Pool().QueryRow("SELECT COUNT(*) FROM commands WHERE state = 'running'").Scan(&running); err != nil {
		t.Fatal(err)
	}
	if claimed != 1 || running != 1 {
		t.Fatalf("claims=%d running=%d, want exactly one of each", claimed, running)
	}
}

func TestAServerIsLeasedOneCommandAtATimeAcrossStores(t *testing.T) {
	t.Parallel()
	first := newTestStore(t)
	for index := range 3 {
		input := testInput()
		input.IdempotencyKey = fmt.Sprintf("lease-%d", index)
		input.Target = fmt.Sprintf("stack/lease-%d", index)
		if _, _, err := first.Submit(input); err != nil {
			t.Fatal(err)
		}
	}
	second := reopen(t, first)
	var wg sync.WaitGroup
	var mu sync.Mutex
	leases := map[string]bool{}
	for index := range 10 {
		wg.Add(1)
		store := first
		if index%2 == 1 {
			store = second
		}
		go func() {
			defer wg.Done()
			lease, found, err := store.LeaseDue("server-1", 1, 30*time.Second)
			if err != nil {
				t.Error(err)
				return
			}
			if found {
				mu.Lock()
				leases[lease.Record.Command.ID] = true
				mu.Unlock()
			}
		}()
	}
	wg.Wait()
	if len(leases) != 1 {
		t.Fatalf("server-1 was leased %d commands at once, want 1", len(leases))
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
		{`stack "shop" must use the "production-" namespace prefix`, "stack_outside_namespace"},
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

// One sentence covered a limit that was exceeded, a controller disk with no
// space left, and a provider stream that ended early. They have three
// different fixes, and only one of them is worth retrying unchanged.
func TestUploadFailureDiagnosticSeparatesItsCauses(t *testing.T) {
	t.Parallel()
	for _, testCase := range []struct {
		err  error
		name string
		want string
	}{
		{err: fmt.Errorf("encrypted state source exceeds the 536870912 byte limit"), name: "limit", want: "source_input_too_large"},
		{err: fmt.Errorf("write encrypted state: %w", syscall.ENOSPC), name: "disk", want: "controller_storage_full"},
		{err: fmt.Errorf("read encrypted state source: unexpected EOF"), name: "stream", want: "source_input_stream_failed"},
		// Deterministic causes reach the store as read errors on the same
		// pipe, so a classifier that stopped at the stream case told an
		// operator to retry a submission that cannot succeed.
		{err: fmt.Errorf("read encrypted state source: build context exceeds the 20000 file limit"), name: "files", want: "build_context_too_many_files"},
		{err: fmt.Errorf("read encrypted state source: build context exceeds the 1073741824 byte limit"), name: "context size", want: "build_context_too_large"},
		{err: fmt.Errorf("read encrypted state source: build context contains a symbolic link or special file at \"link\""), name: "symlink", want: "build_context_unsupported_entry"},
		{err: fmt.Errorf("read encrypted state source: selected build context contains no regular files"), name: "empty", want: "build_context_empty"},
		{err: fmt.Errorf("read encrypted state source: provider archive contains more than one repository root"), name: "malformed", want: "provider_archive_malformed"},
		{err: fmt.Errorf("read encrypted state source: open provider archive: gzip: invalid header"), name: "not gzip", want: "provider_archive_unreadable"},
		{err: fmt.Errorf("provider archive request failed with status 404"), name: "status", want: "provider_archive_rejected"},
		{err: context.Canceled, name: "canceled", want: "source_input_canceled"},
		{err: fmt.Errorf("something else"), name: "unknown", want: "source_input_not_stored"},
	} {
		code, summary, recovery := uploadFailureDiagnostic(testCase.err, 512<<20)
		if code != testCase.want {
			t.Fatalf("%s: code = %q, want %q", testCase.name, code, testCase.want)
		}
		if summary == "" || recovery == "" {
			t.Fatalf("%s: every upload failure states what happened and what to do", testCase.name)
		}
	}
	_, summary, _ := uploadFailureDiagnostic(fmt.Errorf("encrypted state source exceeds the 536870912 byte limit"), 512<<20)
	if !strings.Contains(summary, "512 MiB") {
		t.Fatalf("the limit an operator has to change is not named: %s", summary)
	}
}

// A cancelled request reaches the store wrapped in the same read error as an
// interrupted stream, so matching the stream first reported "the provider
// stream ended early" for a closed browser tab — a network fault the operator
// would go looking for and never find.
func TestCancelledRequestIsNotReportedAsAnInterruptedStream(t *testing.T) {
	t.Parallel()
	code, _, _ := uploadFailureDiagnostic(fmt.Errorf("read encrypted state source: read provider archive: %w", context.Canceled), 512<<20)
	if code != "source_input_canceled" {
		t.Fatalf("code = %q, want source_input_canceled", code)
	}
}

// Requeueing an artifact-backed command whose input was never stored buys a
// second identical failure, and the console offered exactly that button.
func TestRetryRefusesACommandWhoseInputWasNeverStored(t *testing.T) {
	t.Parallel()
	store := newTestStore(t)
	failing := io.MultiReader(bytes.NewReader([]byte("partial")), iotest.ErrReader(errors.New("unexpected EOF")))
	submission, err := store.SubmitArtifactWithResult(SubmitInput{
		Action:           "source.deploy",
		Actor:            "operator",
		AuthorityEpoch:   1,
		ClusterID:        "default",
		IdempotencyKey:   "source-deploy-1",
		MaxArtifactBytes: 1 << 20,
		MaxAttempts:      1,
		Payload:          []byte(`{"kind":"source"}`),
		ServerID:         "server-1",
		Target:           "application/nim",
	}, failing)
	if err == nil {
		t.Fatal("a failed artifact write must be reported to the caller")
	}
	if submission.Command.State != domain.CommandNeedsAttention {
		t.Fatalf("state = %q, want needs_attention", submission.Command.State)
	}
	if _, retryErr := store.RetryNow(submission.Command.ID, 1); retryErr == nil {
		t.Fatal("a command with no stored input must not be retryable")
	} else if !strings.Contains(retryErr.Error(), "never stored") {
		t.Fatalf("the refusal must say why: %v", retryErr)
	}
}

// The cause of a failure SwarmOps cannot name has to survive somewhere.
//
// It reached the classifier, matched nothing, and was dropped: LastError is
// rebuilt from the generic summary, so the ledger, the console and the CLI all
// said "SwarmOps could not confirm that the requested change completed" and an
// operator had nowhere left to look. Retrying is the only thing that message
// suggests, and for a deterministic cause it can never work.
func TestAnUnclassifiedFailureWritesItsCauseToTheLog(t *testing.T) {
	t.Parallel()
	store := newTestStore(t)
	var captured bytes.Buffer
	store.SetLogger(slog.New(slog.NewJSONHandler(&captured, &slog.HandlerOptions{Level: slog.LevelWarn})))

	command, _, err := store.Submit(testInput())
	if err != nil {
		t.Fatal(err)
	}
	if _, found, err := store.ClaimDue(); err != nil || !found {
		t.Fatalf("claim found=%t err=%v", found, err)
	}
	cause := "docker: Error response from daemon: rpc error: code = Unknown desc = something the classifier has never seen"
	failed, _, err := store.Fail(command.ID, errors.New(cause))
	if err != nil {
		t.Fatal(err)
	}
	if failed.FailureCode != FailureCodeUnclassified {
		t.Fatalf("this test needs an unclassified failure, got %q", failed.FailureCode)
	}
	// What the operator is shown still says only that SwarmOps does not know.
	if !strings.Contains(failed.LastError, "could not confirm") {
		t.Fatalf("ledger narrative = %q", failed.LastError)
	}
	logged := captured.String()
	for _, want := range []string{cause, command.ID, command.Action, command.Target, "no classified cause"} {
		if !strings.Contains(logged, want) {
			t.Fatalf("the log does not carry %q:\n%s", want, logged)
		}
	}
}

// A failure the classifier does name already carries its reason to the
// operator, so logging its cause would be noise for every retry of every
// known condition.
func TestAClassifiedFailureIsNotLogged(t *testing.T) {
	t.Parallel()
	store := newTestStore(t)
	var captured bytes.Buffer
	store.SetLogger(slog.New(slog.NewJSONHandler(&captured, &slog.HandlerOptions{Level: slog.LevelWarn})))

	command, _, err := store.Submit(testInput())
	if err != nil {
		t.Fatal(err)
	}
	if _, found, err := store.ClaimDue(); err != nil || !found {
		t.Fatalf("claim found=%t err=%v", found, err)
	}
	failed, _, err := store.Fail(command.ID, errors.New("the traefik singleton service was not found"))
	if err != nil {
		t.Fatal(err)
	}
	if failed.FailureCode != "gateway_required" {
		t.Fatalf("failure code = %q", failed.FailureCode)
	}
	if captured.Len() != 0 {
		t.Fatalf("a classified failure was logged:\n%s", captured.String())
	}
}

// One repeating failure must not be able to fill the controller's disk through
// its own log line.
func TestALoggedCauseIsBounded(t *testing.T) {
	t.Parallel()
	bounded := boundedCause(strings.Repeat("x", maxLoggedCause*3))
	if len(bounded) > maxLoggedCause+len("… (truncated)") {
		t.Fatalf("bounded cause is %d bytes", len(bounded))
	}
	if !strings.HasSuffix(bounded, "(truncated)") {
		t.Fatal("a truncated cause does not say that it was truncated")
	}
	if short := boundedCause("  short cause  "); short != "short cause" {
		t.Fatalf("short cause = %q", short)
	}
}

// A gateway prerequisite is a gateway prerequisite whichever command met it.
//
// The routing store checks these for every command that touches it, but they
// were classified only for traefik.reconcile. Accepting a domain before the
// ACME email was configured therefore reported "SwarmOps could not confirm
// that the requested change completed" — which names neither the missing
// prerequisite nor the page that supplies it — and the operator's only
// suggested move, retrying, could never work.
func TestGatewayPrerequisitesAreNamedForEveryRoutingCommand(t *testing.T) {
	t.Parallel()
	for _, action := range []string{"traefik.domain.register", "traefik.dns.record.apply", "traefik.route.apply", "traefik.reconcile"} {
		for _, sample := range []struct {
			code    string
			message string
		}{
			{"traefik_acme_email_required", "Traefik ACME email is not configured"},
			{"traefik_network_required", "the external traefik overlay network is missing"},
			{"traefik_edge_label_required", "no ready active manager has nim.edge=true"},
			{"traefik_dynamic_config_required", "the reviewed traefik dynamic config is missing"},
		} {
			code, summary, hint := commandFailureDiagnostic(action, errors.New(sample.message))
			if code != sample.code {
				t.Errorf("%s / %q classified as %q, want %q", action, sample.message, code, sample.code)
			}
			if strings.Contains(summary, "could not confirm") {
				t.Errorf("%s / %q is a named prerequisite, not an unconfirmed change: %q", action, sample.message, summary)
			}
			if hint == "" {
				t.Errorf("%s / %q gives the operator no next step", action, sample.message)
			}
		}
	}
}

// What the machine said while it built has to outlive the build.
//
// Core ran docker build through the agent, read the output into memory, and
// dropped it: a Dockerfile that failed on step 7 reported "Docker reported a
// build error" and the step, the command and the compiler's own message were
// gone with it.
func TestARetainedExecutionLogSurvivesTheCommandThatProducedIt(t *testing.T) {
	t.Parallel()
	store := newTestStore(t)
	command, _, err := store.Submit(testInput())
	if err != nil {
		t.Fatal(err)
	}
	log := "Step 7/9 : RUN go build ./...\n#12 4.301 main.go:14:2: undefined: doesNotExist\n"
	if err := store.RetainOutput(command.ID, log); err != nil {
		t.Fatal(err)
	}
	// It is not in the command record, and therefore not in any list.
	listed, err := store.List(10)
	if err != nil {
		t.Fatal(err)
	}
	for _, record := range listed {
		if strings.Contains(fmt.Sprintf("%#v", record), "undefined: doesNotExist") {
			t.Fatal("the execution log leaked into the command ledger")
		}
	}
	var sealed []byte
	if err := store.db.Pool().QueryRow("SELECT output_sealed FROM command_outputs WHERE command_id = ?", command.ID).Scan(&sealed); err != nil {
		t.Fatal(err)
	}
	if bytes.Contains(sealed, []byte("doesNotExist")) {
		t.Fatal("the execution log was stored in the clear")
	}
	read, err := store.Output(command.ID)
	if err != nil || read != log {
		t.Fatalf("Output = %q, %v", read, err)
	}
	if read, err := reopen(t, store).Output(command.ID); err != nil || read != log {
		t.Fatalf("after reload Output = %q, %v", read, err)
	}
}

func TestOutputIsRefusedForACommandThatRetainedNone(t *testing.T) {
	t.Parallel()
	store := newTestStore(t)
	command, _, err := store.Submit(testInput())
	if err != nil {
		t.Fatal(err)
	}
	if _, err := store.Output(command.ID); err == nil {
		t.Fatal("a command with no retained log returned one")
	}
	if _, err := store.Output("cmd-00000000000000000000000000000000"); err == nil {
		t.Fatal("an unknown command returned a log")
	}
	// An empty log is not an error and retains nothing.
	if err := store.RetainOutput(command.ID, "   \n "); err != nil {
		t.Fatal(err)
	}
	if _, err := store.Output(command.ID); err == nil {
		t.Fatal("whitespace was retained as a log")
	}
}

// A build that loops on a failing step can print megabytes. The end explains
// the failure and the head names the step, so both are kept and the middle is
// not.
func TestARetainedLogIsBounded(t *testing.T) {
	t.Parallel()
	store := newTestStore(t)
	command, _, err := store.Submit(testInput())
	if err != nil {
		t.Fatal(err)
	}
	log := "HEAD-MARKER" + strings.Repeat("x", MaxOutputBytes*2) + "TAIL-MARKER"
	if err := store.RetainOutput(command.ID, log); err != nil {
		t.Fatal(err)
	}
	read, err := store.Output(command.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(read) > MaxOutputBytes+64 {
		t.Fatalf("retained %d bytes, cap is %d", len(read), MaxOutputBytes)
	}
	for _, want := range []string{"HEAD-MARKER", "TAIL-MARKER", "(truncated)"} {
		if !strings.Contains(read, want) {
			t.Errorf("a bounded log lost %q", want)
		}
	}
}

// A log left behind after the record that explains it is gone is an orphan
// nothing will ever read or delete.
func TestPruningACommandForgetsItsRetainedLog(t *testing.T) {
	t.Parallel()
	store := newTestStoreWithLimit(t, 1)
	var first string
	for index := 0; index < 2; index++ {
		input := testInput()
		input.IdempotencyKey = fmt.Sprintf("key-%d", index)
		input.Target = fmt.Sprintf("stack/app-%d", index)
		command, _, err := store.Submit(input)
		if err != nil {
			t.Fatal(err)
		}
		if index == 0 {
			first = command.ID
		}
		if err := store.RetainOutput(command.ID, fmt.Sprintf("log for %d", index)); err != nil {
			t.Fatal(err)
		}
		record, found, err := store.ClaimDue()
		if err != nil || !found {
			t.Fatalf("claim %d found=%t err=%v", index, found, err)
		}
		if _, err := store.Complete(record.Command.ID); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := store.Output(first); err == nil {
		t.Fatal("the pruned command's log outlived its record")
	}
	var orphaned int
	if err := store.db.Pool().QueryRow("SELECT COUNT(*) FROM command_outputs WHERE command_id = ?", first).Scan(&orphaned); err != nil {
		t.Fatal(err)
	}
	if orphaned != 0 {
		t.Fatal("the pruned command's log row was left behind")
	}
}

// A build that ran and failed is not an unconfirmed change.
//
// SwarmOps knows exactly what happened and now keeps the machine's output to
// prove it, so reporting "could not confirm" sent the operator to inspect
// Docker when the answer was already retained against the command.
func TestABuildFailureIsNamedAndPointsAtItsLog(t *testing.T) {
	t.Parallel()
	for _, sample := range []struct {
		code    string
		message string
	}{
		{"build_failed", "Docker reported a build error"},
		{"image_push_failed", "Docker reported an image push error"},
		{"image_push_failed", "push built image: unauthorized"},
	} {
		code, summary, hint := commandFailureDiagnostic("build.image", errors.New(sample.message))
		if code != sample.code {
			t.Errorf("%q classified as %q, want %q", sample.message, code, sample.code)
		}
		if strings.Contains(summary, "could not confirm") {
			t.Errorf("%q is a known outcome, not an unconfirmed one: %q", sample.message, summary)
		}
		if !strings.Contains(hint, "execution log") {
			t.Errorf("%q does not send the operator to the log that explains it: %q", sample.message, hint)
		}
	}
}

// A command that does five things reported one word for all of them.
func TestACommandRecordsTheStepsItPassesThrough(t *testing.T) {
	t.Parallel()
	store := newTestStore(t)
	command, _, err := store.Submit(testInput())
	if err != nil {
		t.Fatal(err)
	}
	if events, err := store.Events(command.ID); err != nil || len(events) != 0 {
		t.Fatalf("a fresh command has %d events, %v", len(events), err)
	}
	for _, step := range []string{"Checking the managed Traefik gateway", "Building swarmops-local/api:abc", "Deploying api"} {
		if err := store.AppendEvent(command.ID, domain.CommandRunning, step); err != nil {
			t.Fatal(err)
		}
	}
	events, err := store.Events(command.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(events) != 3 {
		t.Fatalf("recorded %d steps", len(events))
	}
	for index, event := range events {
		if event.Sequence != uint64(index+1) {
			t.Errorf("step %d has sequence %d", index, event.Sequence)
		}
		if event.CommandID != command.ID || event.State != domain.CommandRunning || event.OccurredAt.IsZero() {
			t.Errorf("step %d = %#v", index, event)
		}
	}
	if events[1].Evidence != "Building swarmops-local/api:abc" {
		t.Errorf("second step = %q", events[1].Evidence)
	}
	listed, err := store.List(10)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(fmt.Sprintf("%#v", listed), "Checking the managed Traefik") {
		t.Fatal("the progress trail leaked into the command ledger")
	}
	if events, err := reopen(t, store).Events(command.ID); err != nil || len(events) != 3 {
		t.Fatalf("after reload: %d events, %v", len(events), err)
	}
}

func TestStepsAreBoundedInCountAndLength(t *testing.T) {
	t.Parallel()
	store := newTestStore(t)
	command, _, err := store.Submit(testInput())
	if err != nil {
		t.Fatal(err)
	}
	for index := 0; index < MaxCommandEvents+10; index++ {
		if err := store.AppendEvent(command.ID, domain.CommandRunning, fmt.Sprintf("step %d", index)); err != nil {
			t.Fatal(err)
		}
	}
	events, err := store.Events(command.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(events) != MaxCommandEvents {
		t.Fatalf("recorded %d steps, cap is %d", len(events), MaxCommandEvents)
	}
	long := strings.Repeat("x", maxEvidenceRunes*2)
	fresh, _, err := store.Submit(func() SubmitInput { i := testInput(); i.IdempotencyKey = "another"; i.Target = "stack/other"; return i }())
	if err != nil {
		t.Fatal(err)
	}
	if err := store.AppendEvent(fresh.ID, domain.CommandRunning, long); err != nil {
		t.Fatal(err)
	}
	events, err = store.Events(fresh.ID)
	if err != nil || len(events) != 1 {
		t.Fatalf("events = %d, %v", len(events), err)
	}
	if runes := []rune(events[0].Evidence); len(runes) > maxEvidenceRunes+1 {
		t.Fatalf("evidence kept %d runes", len(runes))
	}
}

func TestAnUnknownCommandRecordsNoSteps(t *testing.T) {
	t.Parallel()
	store := newTestStore(t)
	if err := store.AppendEvent("cmd-00000000000000000000000000000000", domain.CommandRunning, "step"); err == nil {
		t.Fatal("a step was recorded against a command that does not exist")
	}
	if _, err := store.Events("cmd-00000000000000000000000000000000"); err == nil {
		t.Fatal("an unknown command returned steps")
	}
}

// A retry starts the trail again.
//
// Keeping every attempt's steps turned a command that retried eight times into
// the same two lines eight times over, and spent the per-command cap on
// repetition. The ledger still records that the earlier attempts happened.
func TestARetryClearsTheStepsOfTheAttemptBeforeIt(t *testing.T) {
	t.Parallel()
	store := newTestStore(t)
	input := testInput()
	input.AutoRetry = true
	input.MaxAttempts = 3
	command, _, err := store.Submit(input)
	if err != nil {
		t.Fatal(err)
	}
	record, found, err := store.ClaimDue()
	if err != nil || !found {
		t.Fatalf("claim found=%t err=%v", found, err)
	}
	for _, step := range []string{"Rendering the Compose", "Preparing the route network"} {
		if err := store.AppendEvent(record.Command.ID, domain.CommandRunning, step); err != nil {
			t.Fatal(err)
		}
	}
	if events, err := store.Events(command.ID); err != nil || len(events) != 2 {
		t.Fatalf("first attempt recorded %d steps, %v", len(events), err)
	}
	if _, _, err := store.Fail(command.ID, errors.New("network unavailable")); err != nil {
		t.Fatal(err)
	}
	// The trail survives the failure: it is what explains where the attempt
	// stopped, and it is read after the fact as often as during.
	if events, err := store.Events(command.ID); err != nil || len(events) != 2 {
		t.Fatalf("after failing, %d steps remain, %v", len(events), err)
	}
	store.now = func() time.Time { return time.Now().Add(time.Hour) }
	if _, found, err := store.ClaimDue(); err != nil || !found {
		t.Fatalf("second claim found=%t err=%v", found, err)
	}
	events, err := store.Events(command.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(events) != 0 {
		t.Fatalf("the second attempt inherited %d steps from the first", len(events))
	}
	if err := store.AppendEvent(command.ID, domain.CommandRunning, "Rendering the Compose"); err != nil {
		t.Fatal(err)
	}
	events, err = store.Events(command.ID)
	if err != nil || len(events) != 1 || events[0].Sequence != 1 {
		t.Fatalf("the new attempt's trail = %#v, %v", events, err)
	}
}

// An existing controller's sealed ledger, with a progress trail and a retained
// log beside one of its commands, has to arrive in the database whole.
func TestImportFilesCopiesTheSealedLedgerWithItsTrailAndLog(t *testing.T) {
	t.Parallel()
	dataDir := t.TempDir()
	inputs := filepath.Join(dataDir, "commands", "inputs")
	if err := os.MkdirAll(inputs, 0o700); err != nil {
		t.Fatal(err)
	}
	key := testDataKey()
	sealer, err := securestore.New(key)
	if err != nil {
		t.Fatal(err)
	}
	const id = "cmd-0123456789abcdef0123456789abcdef"
	created := time.Date(2026, 8, 20, 10, 0, 0, 123456789, time.UTC)
	ledger, err := json.Marshal(storeFile{Version: storeVersion, Commands: []storedRecord{{
		Command: domain.Command{
			Action: "stack.deploy", Actor: "operator", AuthorityEpoch: 1, ClusterID: "default", CreatedAt: created, ID: id,
			MaxAttempts: 3, NodeID: "server-1", ServerID: "server-1", State: domain.CommandQueued, Target: "stack/legacy", UpdatedAt: created,
		},
		Events:         true,
		IdempotencyKey: "legacy-key",
		Output:         true,
		Payload:        json.RawMessage(`{"name":"legacy"}`),
	}}})
	if err != nil {
		t.Fatal(err)
	}
	if err := sealer.WriteFile(filepath.Join(dataDir, "commands", "commands.sealed"), stateKey, ledger); err != nil {
		t.Fatal(err)
	}
	trail, err := json.Marshal([]domain.CommandEvent{
		{CommandID: id, Evidence: "Rendering", OccurredAt: created, Sequence: 1, State: domain.CommandRunning},
		{CommandID: id, Evidence: "Deploying", OccurredAt: created, Sequence: 2, State: domain.CommandRunning},
	})
	if err != nil {
		t.Fatal(err)
	}
	if err := sealer.WriteFile(filepath.Join(inputs, id+".events.sealed"), "command-events:"+id, trail); err != nil {
		t.Fatal(err)
	}
	if err := sealer.WriteFile(filepath.Join(inputs, id+".output.sealed"), "command-output:"+id, []byte("legacy execution log")); err != nil {
		t.Fatal(err)
	}

	db := sqltest.Open(t)
	for attempt, want := range []int{1, 0} {
		count, err := ImportFiles(context.Background(), db, dataDir, key)
		if err != nil || count != want {
			t.Fatalf("import attempt %d = %d, %v; want %d", attempt+1, count, err, want)
		}
	}
	store, err := Open(db, dataDir, key, testHistoryLimit)
	if err != nil {
		t.Fatal(err)
	}
	command, err := store.Get(id)
	if err != nil || command.Target != "stack/legacy" || !command.CreatedAt.Equal(created.Truncate(time.Microsecond)) {
		t.Fatalf("imported command = %#v, %v", command, err)
	}
	if events, err := store.Events(id); err != nil || len(events) != 2 || events[1].Evidence != "Deploying" {
		t.Fatalf("imported events = %#v, %v", events, err)
	}
	if output, err := store.Output(id); err != nil || output != "legacy execution log" {
		t.Fatalf("imported output = %q, %v", output, err)
	}
	record, found, err := store.ClaimDue()
	if err != nil || !found || string(record.Payload) != `{"name":"legacy"}` {
		t.Fatalf("imported command claim = %#v, %t, %v", record, found, err)
	}
}
