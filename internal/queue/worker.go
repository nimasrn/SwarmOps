package queue

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/nimasrn/SwarmOps/internal/domain"
)

const (
	defaultStoreRetryAttempts = 5
	defaultStoreRetryDelay    = time.Second
)

type ExecuteFunc func(context.Context, Record) error
type TransitionFunc func(domain.Command, string)

type Worker struct {
	// CanExecute is checked before a command is claimed. SwarmOps uses it to
	// keep a restored standby replica from touching a managed machine before an
	// explicit promotion. A command already running is never interrupted here:
	// its remote effect may already exist and must remain auditable.
	CanExecute       func() bool
	Execute          ExecuteFunc
	ExecutionTimeout func(domain.Command) time.Duration
	OnTransition     TransitionFunc
	PollInterval     time.Duration
	Store            *Store
	// StoreRetryAttempts bounds the retries for a transient durable-store
	// failure (for example momentary I/O pressure) before the worker stops.
	// The store rolls back failed transitions in memory, so a retried claim,
	// completion, or failure always observes a consistent ledger.
	StoreRetryAttempts int
	StoreRetryDelay    time.Duration
}

func (w Worker) Run(ctx context.Context) error {
	if w.Store == nil || w.Execute == nil {
		return fmt.Errorf("command worker requires a store and executor")
	}
	poll := w.PollInterval
	if poll <= 0 {
		poll = 250 * time.Millisecond
	}
	for {
		if err := ctx.Err(); err != nil {
			return nil
		}
		if w.CanExecute != nil && !w.CanExecute() {
			select {
			case <-ctx.Done():
				return nil
			case <-time.After(poll):
			}
			continue
		}
		var record Record
		var found bool
		if err := w.storeRetry(ctx, "claim due command", func() error {
			var claimErr error
			record, found, claimErr = w.Store.ClaimDue()
			return claimErr
		}); err != nil {
			return err
		}
		if !found {
			select {
			case <-ctx.Done():
				return nil
			case <-time.After(poll):
			}
			continue
		}
		if w.OnTransition != nil {
			w.OnTransition(record.Command, "running")
		}
		timeout := 10 * time.Minute
		if w.ExecutionTimeout != nil {
			if value := w.ExecutionTimeout(record.Command); value > 0 {
				timeout = value
			}
		}
		executionContext, cancel := context.WithTimeout(ctx, timeout)
		err := w.Execute(executionContext, record)
		executionErr := executionContext.Err()
		cancel()
		// A controller shutdown or execution deadline leaves the remote effect
		// unknowable. Never turn that uncertainty into an automatic replay,
		// even for a normally reconcilable command. This is intentionally based
		// on the execution context rather than the executor's returned error:
		// an executor that ignores cancellation cannot be trusted to confirm a
		// remote side effect after its deadline.
		if errors.Is(executionErr, context.Canceled) || errors.Is(executionErr, context.DeadlineExceeded) {
			err = PermanentError(fmt.Errorf("command execution ended before completion"))
		}
		if err == nil {
			if err := w.storeRetry(ctx, "complete command", func() error {
				command, completeErr := w.Store.Complete(record.Command.ID)
				if completeErr != nil {
					return completeErr
				}
				if w.OnTransition != nil {
					w.OnTransition(command, "succeeded")
				}
				return nil
			}); err != nil {
				return err
			}
			continue
		}
		var event string
		var failed domain.Command
		if err := w.storeRetry(ctx, "record command failure", func() error {
			var failErr error
			failed, event, failErr = w.Store.Fail(record.Command.ID, err)
			return failErr
		}); err != nil {
			return err
		}
		if w.OnTransition != nil {
			w.OnTransition(failed, event)
		}
	}
}

// storeRetry runs one durable-store operation with bounded backoff so a
// transient write failure cannot stop the controller. Context cancellation
// returns immediately; exhaustion returns the wrapped original error and the
// caller keeps its existing fail-stop contract.
func (w Worker) storeRetry(ctx context.Context, operation string, run func() error) error {
	attempts := w.StoreRetryAttempts
	if attempts <= 0 {
		attempts = defaultStoreRetryAttempts
	}
	delay := w.StoreRetryDelay
	if delay <= 0 {
		delay = defaultStoreRetryDelay
	}
	var err error
	for attempt := 0; attempt < attempts; attempt++ {
		if err = run(); err == nil {
			return nil
		}
		if attempt == attempts-1 {
			break
		}
		timer := time.NewTimer(delay * time.Duration(1<<attempt))
		select {
		case <-ctx.Done():
			timer.Stop()
			return err
		case <-timer.C:
		}
	}
	return fmt.Errorf("%s: %w", operation, err)
}
