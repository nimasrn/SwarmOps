package queue

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/nimasrn/SwarmOps/internal/domain"
	"github.com/nimasrn/SwarmOps/internal/securestore"
)

func TestWorkerMarksTimedOutExecutionForAttentionRatherThanReplay(t *testing.T) {
	store := newTestStore(t)
	command, _, err := store.Submit(testInput())
	if err != nil {
		t.Fatal(err)
	}
	transitions := make(chan domain.Command, 2)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	finished := make(chan error, 1)
	go func() {
		finished <- (Worker{
			Store:            store,
			PollInterval:     time.Millisecond,
			ExecutionTimeout: func(domain.Command) time.Duration { return 5 * time.Millisecond },
			Execute: func(ctx context.Context, _ Record) error {
				<-ctx.Done()
				// A misbehaving transport can return success even after its context
				// ended. The worker must treat that outcome as unknowable.
				return nil
			},
			OnTransition: func(command domain.Command, _ string) {
				transitions <- command
			},
		}).Run(ctx)
	}()

	deadline := time.After(time.Second)
	for {
		select {
		case transition := <-transitions:
			if transition.State == domain.CommandNeedsAttention {
				cancel()
				if err := <-finished; err != nil {
					t.Fatal(err)
				}
				stored, err := store.Get(command.ID)
				if err != nil {
					t.Fatal(err)
				}
				if stored.State != domain.CommandNeedsAttention || stored.NextAttemptAt != nil {
					t.Fatalf("timed-out command = %#v", stored)
				}
				return
			}
		case <-deadline:
			t.Fatal("worker did not report a terminal timeout transition")
		}
	}
}

func TestWorkerFailsStoppedAfterExhaustingStoreRetries(t *testing.T) {
	store := newTestStore(t)
	command, _, err := store.Submit(testInput())
	if err != nil {
		t.Fatal(err)
	}
	// A durable-store outage must not be silently ignored, and it must not
	// leave a phantom claimed command behind when every retry is exhausted.
	store.sealer = &securestore.Sealer{}
	runErr := make(chan error, 1)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go func() {
		runErr <- (Worker{
			PollInterval:       time.Millisecond,
			Store:              store,
			StoreRetryAttempts: 3,
			StoreRetryDelay:    time.Millisecond,
			Execute: func(context.Context, Record) error {
				t.Error("executor ran although the claim never succeeded")
				return nil
			},
		}).Run(ctx)
	}()
	select {
	case err := <-runErr:
		if err == nil || !strings.Contains(err.Error(), "claim due command") {
			t.Fatalf("worker exit error = %v", err)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("worker did not stop after exhausting store retries")
	}
	stored, err := store.Get(command.ID)
	if err != nil {
		t.Fatal(err)
	}
	if stored.State != domain.CommandQueued || stored.Attempt != 0 {
		t.Fatalf("command after failed claims = %#v", stored)
	}
}
