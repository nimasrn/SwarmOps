package agentpull

import (
	"context"
	"crypto/rand"
	"net/http"
	"path/filepath"
	"testing"
	"time"
)

func TestClientDispatchesOnlyThroughLocalHandler(t *testing.T) {
	key := make([]byte, 32)
	if _, err := rand.Read(key); err != nil {
		t.Fatal(err)
	}
	client, err := NewClient(ClientConfig{AgentID: "node-1", BaseURL: "http://127.0.0.1", Handler: http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		if request.Header.Get("Authorization") == "" {
			t.Error("local authorization missing")
		}
		response.Header().Set("Content-Type", "application/json")
		response.WriteHeader(http.StatusOK)
		_, _ = response.Write([]byte(`{"status":"ok"}`))
	}), HTTP: http.DefaultClient, LocalKey: key, StateFile: filepath.Join(t.TempDir(), "state.json"), Status: func(context.Context) (Status, error) { return Status{}, nil }})
	if err != nil {
		t.Fatal(err)
	}
	client.state.AuthorityEpoch = 3
	result := client.dispatch(context.Background(), Request{AuthorityEpoch: 3, ExpiresAt: time.Now().Add(time.Minute), ID: "r1", Method: http.MethodGet, Path: "/v1/status", Sequence: 1})
	if result.StatusCode != http.StatusOK {
		t.Fatalf("status = %d", result.StatusCode)
	}
	bad := client.dispatch(context.Background(), Request{AuthorityEpoch: 3, ExpiresAt: time.Now().Add(time.Minute), ID: "r2", Method: http.MethodPost, Path: "/shell", Sequence: 2})
	if bad.StatusCode != http.StatusUnprocessableEntity {
		t.Fatalf("bad status = %d", bad.StatusCode)
	}
}
