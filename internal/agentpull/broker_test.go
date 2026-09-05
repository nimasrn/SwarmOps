package agentpull

import (
	"context"
	"errors"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"
)

func TestBrokerResumesAboveDurableAgentCursorAfterCoreRestart(t *testing.T) {
	t.Parallel()
	broker := NewBroker(1)
	seedContext, cancelSeed := context.WithTimeout(context.Background(), time.Millisecond)
	defer cancelSeed()
	if _, err := broker.Poll(seedContext, PollRequest{AgentID: "node-1", AuthorityEpoch: 1, Cursor: 41, Protocol: ProtocolVersion}); !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("seed poll error = %v", err)
	}

	done := make(chan error, 1)
	go func() {
		request, _ := http.NewRequest(http.MethodGet, "http://agent.invalid/v1/status", nil)
		response, err := broker.Transport("node-1").RoundTrip(request)
		if response != nil {
			response.Body.Close()
		}
		done <- err
	}()
	pollContext, cancelPoll := context.WithTimeout(context.Background(), time.Second)
	defer cancelPoll()
	request, err := broker.Poll(pollContext, PollRequest{AgentID: "node-1", AuthorityEpoch: 1, Cursor: 41, Protocol: ProtocolVersion})
	if err != nil {
		t.Fatal(err)
	}
	if request.Sequence != 42 {
		t.Fatalf("sequence = %d, want 42", request.Sequence)
	}
	if err := broker.Respond("node-1", Response{RequestID: request.ID, Sequence: request.Sequence, StatusCode: http.StatusNoContent}); err != nil {
		t.Fatal(err)
	}
	if err := <-done; err != nil {
		t.Fatal(err)
	}
}

func TestBrokerRoundTripIsOrderedAndBounded(t *testing.T) {
	broker := NewBroker(7)
	done := make(chan *http.Response, 1)
	go func() {
		request, _ := http.NewRequestWithContext(context.Background(), http.MethodGet, "http://agent.invalid/v1/status", nil)
		response, err := broker.Transport("node-1").RoundTrip(request)
		if err != nil {
			t.Errorf("round trip: %v", err)
			return
		}
		done <- response
	}()
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	request, err := broker.Poll(ctx, PollRequest{AgentID: "node-1", AuthorityEpoch: 7, Protocol: ProtocolVersion})
	if err != nil {
		t.Fatal(err)
	}
	if request.Sequence != 1 || request.AuthorityEpoch != 7 || request.Path != "/v1/status" {
		t.Fatalf("unexpected request: %#v", request)
	}
	if err := broker.Respond("node-1", Response{Body: []byte(`{"version":"test"}`), Header: map[string]string{"Content-Type": "application/json"}, RequestID: request.ID, Sequence: request.Sequence, StatusCode: http.StatusOK}); err != nil {
		t.Fatal(err)
	}
	select {
	case response := <-done:
		data, _ := io.ReadAll(response.Body)
		if !strings.Contains(string(data), "test") {
			t.Fatalf("unexpected response %q", data)
		}
	case <-time.After(time.Second):
		t.Fatal("round trip did not complete")
	}
}

func TestBrokerRejectsNonCataloguedPathAndStaleAuthority(t *testing.T) {
	broker := NewBroker(4)
	broker.SetAuthorityEpoch(6)
	broker.SetAuthorityEpoch(5)
	if broker.AuthorityEpoch() != 6 {
		t.Fatalf("authority epoch moved incorrectly: %d", broker.AuthorityEpoch())
	}
	request, _ := http.NewRequest(http.MethodPost, "http://agent.invalid/arbitrary", nil)
	if _, err := broker.Transport("node-1").RoundTrip(request); err == nil {
		t.Fatal("expected arbitrary path rejection")
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	if _, err := broker.Poll(ctx, PollRequest{AgentID: "node-1", AuthorityEpoch: 4, Protocol: ProtocolVersion}); err != ErrStaleAuthority {
		t.Fatalf("expected stale authority, got %v", err)
	}
}

func TestBrokerCataloguesReviewedLogRoutes(t *testing.T) {
	t.Parallel()
	for _, test := range []struct {
		method string
		path   string
	}{
		{method: http.MethodGet, path: "/v1/logs/status"},
		{method: http.MethodPost, path: "/v1/logs/query"},
	} {
		t.Run(test.method+" "+test.path, func(t *testing.T) {
			t.Parallel()
			if err := validateRequest(test.method, test.path); err != nil {
				t.Fatalf("reviewed log route was rejected: %v", err)
			}
		})
	}
}

// Host setup is the first operation an operator runs against a freshly
// enrolled outbound agent. The apply route was absent from the catalogue while
// its status route was present, so every Docker install, Swarm initialisation,
// UFW baseline, and registry-mirror change was refused by Core before it
// reached the machine.
func TestBrokerCataloguesHostSetupApplyBesideItsStatusRoute(t *testing.T) {
	t.Parallel()
	for _, test := range []struct {
		method string
		path   string
	}{
		{method: http.MethodGet, path: "/v1/provisioning/status"},
		{method: http.MethodPost, path: "/v1/provisioning"},
	} {
		t.Run(test.method+" "+test.path, func(t *testing.T) {
			t.Parallel()
			if err := validateRequest(test.method, test.path); err != nil {
				t.Fatalf("reviewed host setup route was rejected: %v", err)
			}
		})
	}
}

// A poll means the agent is idle, so an unanswered in-flight request never
// arrived. Without one redelivery a request lost in transit — a large build
// context truncated mid-transfer — vanished, and the command stayed "running"
// until its execution timeout with nothing on either side explaining why.
func TestBrokerRedeliversAnUnansweredRequestExactlyOnce(t *testing.T) {
	broker := NewBroker(4)
	go func() {
		request, _ := http.NewRequest(http.MethodGet, "http://agent.invalid/v1/status", nil)
		_, _ = broker.Transport("node-1").RoundTrip(request)
	}()

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	first, err := broker.Poll(ctx, PollRequest{AgentID: "node-1", Protocol: ProtocolVersion})
	if err != nil || first == nil {
		t.Fatalf("first delivery failed: %v", err)
	}

	// The agent never answered, so polling again must hand the same request back.
	second, err := broker.Poll(ctx, PollRequest{AgentID: "node-1", Protocol: ProtocolVersion})
	if err != nil || second == nil {
		t.Fatalf("request was not redelivered: %v", err)
	}
	if second.ID != first.ID || second.Sequence != first.Sequence {
		t.Fatalf("redelivery changed the request: %#v vs %#v", second, first)
	}

	// One retry only: a third poll must block rather than replay again.
	blocked, cancelBlocked := context.WithTimeout(context.Background(), 300*time.Millisecond)
	defer cancelBlocked()
	if third, err := broker.Poll(blocked, PollRequest{AgentID: "node-1", Protocol: ProtocolVersion}); err == nil && third != nil {
		t.Fatalf("request was replayed more than once: %#v", third)
	}
}

// A request the agent acknowledged was executed on the machine; only its
// response was lost. Redelivering it would repeat that mutation, and the agent
// rejects it as a replay, so an acknowledged sequence is never handed back.
func TestBrokerNeverRedeliversAnAcknowledgedRequest(t *testing.T) {
	broker := NewBroker(4)
	go func() {
		request, _ := http.NewRequest(http.MethodGet, "http://agent.invalid/v1/status", nil)
		_, _ = broker.Transport("node-2").RoundTrip(request)
	}()

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	delivered, err := broker.Poll(ctx, PollRequest{AgentID: "node-2", Protocol: ProtocolVersion})
	if err != nil || delivered == nil {
		t.Fatalf("first delivery failed: %v", err)
	}

	blocked, cancelBlocked := context.WithTimeout(context.Background(), 300*time.Millisecond)
	defer cancelBlocked()
	if again, err := broker.Poll(blocked, PollRequest{AgentID: "node-2", Cursor: delivered.Sequence, Protocol: ProtocolVersion}); err == nil && again != nil {
		t.Fatalf("an acknowledged request was redelivered: %#v", again)
	}
}
