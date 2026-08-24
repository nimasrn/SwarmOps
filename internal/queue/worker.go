package queue

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/nimasrn/SwarmOps/internal/domain"
)

type ExecuteFunc func(context.Context, Record) error
type TransitionFunc func(domain.Command, string)

type Worker struct {
	Execute          ExecuteFunc
	ExecutionTimeout func(domain.Command) time.Duration
	OnTransition     TransitionFunc
	PollInterval     time.Duration
	Store            *Store
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
		record, found, err := w.Store.ClaimDue()
		if err != nil {
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
		err = w.Execute(executionContext, record)
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
			command, completeErr := w.Store.Complete(record.Command.ID)
			if completeErr != nil {
				return completeErr
			}
			if w.OnTransition != nil {
				w.OnTransition(command, "succeeded")
			}
			continue
		}
		command, event, failErr := w.Store.Fail(record.Command.ID, err)
		if failErr != nil {
			return failErr
		}
		if w.OnTransition != nil {
			w.OnTransition(command, event)
		}
	}
}
