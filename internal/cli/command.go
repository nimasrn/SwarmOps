package cli

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/nimasrn/SwarmOps/internal/domain"
)

// pollInterval is how often a following command asks for the record again. It
// is slow enough not to matter to the controller and fast enough that a deploy
// feels answered rather than hung.
const pollInterval = 2 * time.Second

// Submit queues one command and returns the durable record the controller
// acknowledged. Every mutation goes through here so the idempotency key, the
// cluster header, and the server header are never forgotten at a call site.
func (c *Client) Submit(ctx context.Context, path, prefix string, body any) (domain.Command, error) {
	return c.SubmitWith(ctx, http.MethodPost, path, prefix, body)
}

// SubmitWith queues a command whose endpoint is not a POST. A few removals are
// addressed with DELETE and still carry a confirmation body, so the method is
// a parameter rather than a second copy of this function.
func (c *Client) SubmitWith(ctx context.Context, method, path, prefix string, body any) (domain.Command, error) {
	if c.serverID == "" {
		return domain.Command{}, errors.New("no server selected; run `swarmops server use <id>` or set --server-id")
	}
	key, err := IdempotencyKey(prefix)
	if err != nil {
		return domain.Command{}, err
	}
	request, err := c.newJSONRequest(ctx, method, path, body)
	if err != nil {
		return domain.Command{}, err
	}
	c.signCommand(request, key)
	var command domain.Command
	if err := c.do(request, &command); err != nil {
		return domain.Command{}, err
	}
	return command, nil
}

// SubmitStream queues a command whose body is streamed rather than encoded —
// today that is only the build context, which must not be buffered in memory.
// The extra headers are the ones that endpoint reads its parameters from.
func (c *Client) SubmitStream(ctx context.Context, path, prefix, contentType string, body io.Reader, headers map[string]string) (domain.Command, error) {
	if c.serverID == "" {
		return domain.Command{}, errors.New("no server selected; run `swarmops server use <id>` or set --server-id")
	}
	key, err := IdempotencyKey(prefix)
	if err != nil {
		return domain.Command{}, err
	}
	request, err := c.newRequest(ctx, http.MethodPost, path, body)
	if err != nil {
		return domain.Command{}, err
	}
	request.Header.Set("Content-Type", contentType)
	for name, value := range headers {
		request.Header.Set(name, value)
	}
	c.signCommand(request, key)
	var command domain.Command
	if err := c.do(request, &command); err != nil {
		return domain.Command{}, err
	}
	return command, nil
}

// TerminalCommand reports whether a command has stopped moving on its own.
func TerminalCommand(state domain.CommandState) bool {
	switch state {
	case domain.CommandSucceeded, domain.CommandFailed, domain.CommandNeedsAttention,
		domain.CommandSuperseded, domain.CommandCancelled:
		return true
	}
	return false
}

// Follow polls a queued command to a terminal state, reporting each state
// change. A command that ends anywhere but succeeded returns an error carrying
// the controller's own failure summary and recovery hint — the causes used to
// be dropped here, leaving an operator with a command ID and nothing else.
func (c *Client) Follow(ctx context.Context, id string, onChange func(domain.Command)) (domain.Command, error) {
	previous := domain.CommandState("")
	for {
		var command domain.Command
		if err := c.Get(ctx, "/api/v1/commands/"+id, &command); err != nil {
			return domain.Command{}, err
		}
		if command.State != previous {
			previous = command.State
			if onChange != nil {
				onChange(command)
			}
		}
		if TerminalCommand(command.State) {
			if command.State == domain.CommandSucceeded {
				return command, nil
			}
			return command, CommandFailure(command)
		}
		select {
		case <-ctx.Done():
			return command, fmt.Errorf("stopped watching command %s: %w", id, ctx.Err())
		case <-time.After(pollInterval):
		}
	}
}

// CommandFailure renders everything the controller recorded about why a
// command did not succeed.
func CommandFailure(command domain.Command) error {
	parts := []string{fmt.Sprintf("command %s ended %s", command.ID, command.State)}
	if command.FailureCode != "" {
		parts = append(parts, "code "+command.FailureCode)
	}
	if command.FailureSummary != "" {
		parts = append(parts, command.FailureSummary)
	}
	// The last error usually restates the summary and appends the attempt
	// count. Printing both puts the same sentence in the line twice, which
	// reads as two separate problems.
	if command.LastError != "" {
		extra := command.LastError
		if command.FailureSummary != "" && strings.Contains(extra, command.FailureSummary) {
			extra = strings.TrimSpace(strings.Replace(extra, command.FailureSummary, "", 1))
		}
		if extra != "" && extra != command.FailureSummary {
			parts = append(parts, extra)
		}
	}
	if command.RecoveryHint != "" {
		parts = append(parts, "try: "+command.RecoveryHint)
	}
	return errors.New(strings.Join(parts, "; "))
}
