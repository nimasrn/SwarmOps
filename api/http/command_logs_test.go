package apihttp

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/nimasrn/SwarmOps/internal/auth"
	"github.com/nimasrn/SwarmOps/internal/queue"
)

func TestCommandLogsEndpointReturnsEncryptedQueueEvidence(t *testing.T) {
	store, err := queue.Open(t.TempDir(), bytes.Repeat([]byte{9}, 32), 100)
	if err != nil {
		t.Fatal(err)
	}
	command, _, err := store.Submit(queue.SubmitInput{
		Action:         "service.scale",
		Actor:          "operator",
		AutoRetry:      true,
		IdempotencyKey: "command-log-endpoint",
		MaxAttempts:    1,
		Payload:        []byte(`{}`),
		ServerID:       "server-1",
		Target:         "service/api",
	})
	if err != nil {
		t.Fatal(err)
	}
	if _, found, err := store.ClaimDue(); err != nil || !found {
		t.Fatalf("claim command: found=%t err=%v", found, err)
	}
	if _, err := store.AppendLog(command.ID, queue.LogInput{Level: "info", Message: "Scale requested.", Source: "controller"}); err != nil {
		t.Fatal(err)
	}
	server := &Server{commands: store}
	request := httptest.NewRequest(http.MethodGet, "/api/v1/commands/"+command.ID+"/logs", nil)
	request.SetPathValue("id", command.ID)
	response := httptest.NewRecorder()
	server.commandLogs(response, request, auth.Claims{})
	if response.Code != http.StatusOK {
		t.Fatalf("status = %d: %s", response.Code, response.Body.String())
	}
	if got := response.Body.String(); !strings.Contains(got, "Scale requested.") || !strings.Contains(got, "controller") {
		t.Fatalf("response = %s", got)
	}
}
