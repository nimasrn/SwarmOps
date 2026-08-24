package queue

import (
	"context"
	"testing"
	"time"

	"github.com/nimasrn/SwarmOps/internal/domain"
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
