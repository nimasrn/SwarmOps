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
