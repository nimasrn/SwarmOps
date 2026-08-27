package agentpull

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

const defaultLease = 35 * time.Second

type pending struct {
	request Request
	result  chan result
}

type result struct {
	response Response
	err      error
}

type agentState struct {
	cursor  uint64
	next    uint64
	pending []*pending
	wake    chan struct{}
	waiting map[string]*pending
}

// Broker is an in-memory rendezvous. Durable user commands remain in the
// encrypted command store; requests here are short leases reconstructed by
// the command executor after restart or reconnect.
type Broker struct {
	epoch  atomic.Uint64
	mu     sync.Mutex
	agents map[string]*agentState
}

func NewBroker(authorityEpoch uint64) *Broker {
	if authorityEpoch == 0 {
		authorityEpoch = 1
	}
	broker := &Broker{agents: map[string]*agentState{}}
	broker.epoch.Store(authorityEpoch)
	return broker
}

func (b *Broker) AuthorityEpoch() uint64 { return b.epoch.Load() }

// SetAuthorityEpoch advances the broker after a fenced Core promotion. Epochs
// never move backwards; agents use the same monotonic rule.
func (b *Broker) SetAuthorityEpoch(epoch uint64) {
	for epoch > 0 {
		current := b.epoch.Load()
		if epoch <= current || b.epoch.CompareAndSwap(current, epoch) {
			return
		}
	}
}

func (b *Broker) Transport(agentID string) http.RoundTripper {
	return &Transport{AgentID: strings.TrimSpace(agentID), Broker: b}
}

// Poll returns one ordered request or nil on a normal long-poll timeout.
func (b *Broker) Poll(ctx context.Context, input PollRequest) (*Request, error) {
	if b == nil || strings.TrimSpace(input.AgentID) == "" {
		return nil, fmt.Errorf("agent identity is required")
	}
	if input.Protocol != ProtocolVersion {
		return nil, fmt.Errorf("agent pull protocol is incompatible")
	}
	epoch := b.AuthorityEpoch()
	if input.AuthorityEpoch > epoch {
		return nil, fmt.Errorf("agent has accepted a newer Core authority")
	}
	if input.AuthorityEpoch != 0 && input.AuthorityEpoch < epoch {
		// Returning no work lets the endpoint deliver the current epoch without
		// ever leasing a mutation from an authority the agent must reject.
		return nil, ErrStaleAuthority
	}
	for {
		b.mu.Lock()
		state := b.stateLocked(input.AgentID)
		if input.Cursor > state.cursor {
			state.cursor = input.Cursor
		}
		for len(state.pending) > 0 {
			item := state.pending[0]
			state.pending = state.pending[1:]
			if time.Now().UTC().After(item.request.ExpiresAt) {
				delete(state.waiting, item.request.ID)
				item.result <- result{err: context.DeadlineExceeded}
				continue
			}
			request := item.request
			b.mu.Unlock()
			return &request, nil
		}
		wake := state.wake
		b.mu.Unlock()
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-wake:
		}
	}
}

func (b *Broker) Respond(agentID string, response Response) error {
	if b == nil || strings.TrimSpace(agentID) == "" || strings.TrimSpace(response.RequestID) == "" {
		return fmt.Errorf("agent response identity is required")
	}
	if response.StatusCode < 100 || response.StatusCode > 599 || len(response.Body) > MaxResponseBytes {
		return fmt.Errorf("agent response is invalid")
	}
	b.mu.Lock()
	state := b.stateLocked(agentID)
	item := state.waiting[response.RequestID]
	if item == nil || item.request.Sequence != response.Sequence {
		b.mu.Unlock()
		return fmt.Errorf("agent response does not match an active lease")
	}
	delete(state.waiting, response.RequestID)
	if response.Sequence > state.cursor {
		state.cursor = response.Sequence
	}
	b.mu.Unlock()
	item.result <- result{response: response}
	return nil
}

func (b *Broker) stateLocked(agentID string) *agentState {
	state := b.agents[agentID]
	if state == nil {
		state = &agentState{wake: make(chan struct{}), waiting: map[string]*pending{}}
		b.agents[agentID] = state
	}
	return state
}

func (b *Broker) enqueue(ctx context.Context, agentID string, request *http.Request) (*http.Response, error) {
	if err := validateRequest(request.Method, request.URL.RequestURI()); err != nil {
		return nil, err
	}
	var body []byte
	var err error
	if request.Body != nil {
		body, err = io.ReadAll(io.LimitReader(request.Body, MaxBodyBytes+1))
		if err != nil {
			return nil, fmt.Errorf("read catalog request: %w", err)
		}
	}
	if len(body) > MaxBodyBytes {
		return nil, fmt.Errorf("catalog request exceeds %d bytes", MaxBodyBytes)
	}
	id, err := randomID()
	if err != nil {
		return nil, err
	}
	now := time.Now().UTC()
	deadline := now.Add(defaultLease)
	if value, ok := ctx.Deadline(); ok && value.Before(deadline) {
		deadline = value
	}
	b.mu.Lock()
	state := b.stateLocked(agentID)
	state.next++
	item := &pending{request: Request{
		AuthorityEpoch: b.AuthorityEpoch(),
		Body:           body,
		CreatedAt:      now,
		ExpiresAt:      deadline,
		Header:         safeRequestHeaders(request.Header),
		ID:             id,
		Method:         request.Method,
		Path:           request.URL.RequestURI(),
		Sequence:       state.next,
	}, result: make(chan result, 1)}
	state.pending = append(state.pending, item)
	state.waiting[id] = item
	close(state.wake)
	state.wake = make(chan struct{})
	b.mu.Unlock()
	select {
	case <-ctx.Done():
		b.remove(agentID, id)
		return nil, ctx.Err()
	case outcome := <-item.result:
		if outcome.err != nil {
			return nil, outcome.err
		}
		return responseFor(request, outcome.response), nil
	}
}

func (b *Broker) remove(agentID, id string) {
	b.mu.Lock()
	defer b.mu.Unlock()
	state := b.agents[agentID]
	if state == nil {
		return
	}
	delete(state.waiting, id)
	for index, item := range state.pending {
		if item.request.ID == id {
			state.pending = append(state.pending[:index], state.pending[index+1:]...)
			break
		}
	}
}

func safeRequestHeaders(header http.Header) map[string]string {
	result := map[string]string{}
	for _, name := range []string{"Content-Type", "Accept"} {
		if value := strings.TrimSpace(header.Get(name)); value != "" {
			result[name] = value
		}
	}
	return result
}

func responseFor(request *http.Request, value Response) *http.Response {
	header := make(http.Header)
	for _, name := range []string{"Content-Type", "Docker-Content-Digest"} {
		if item := strings.TrimSpace(value.Header[name]); item != "" {
			header.Set(name, item)
		}
	}
	return &http.Response{Body: io.NopCloser(bytes.NewReader(value.Body)), Header: header, Request: request, StatusCode: value.StatusCode}
}

func randomID() (string, error) {
	data := make([]byte, 16)
	if _, err := rand.Read(data); err != nil {
		return "", fmt.Errorf("create agent request identifier: %w", err)
	}
	return hex.EncodeToString(data), nil
}

type Transport struct {
	AgentID string
	Broker  *Broker
}

func (t *Transport) RoundTrip(request *http.Request) (*http.Response, error) {
	if t == nil || t.Broker == nil || strings.TrimSpace(t.AgentID) == "" {
		return nil, fmt.Errorf("agent pull transport is not configured")
	}
	return t.Broker.enqueue(request.Context(), t.AgentID, request)
}

func (t *Transport) CloseIdleConnections() {}

var ErrStaleAuthority = fmt.Errorf("agent authority epoch is stale")
