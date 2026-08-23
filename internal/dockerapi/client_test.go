package dockerapi

import "testing"

func TestNewKeepsLongRunningBuildsUnderRequestContext(t *testing.T) {
	t.Parallel()
	client, err := New("/tmp/swarmops-test.sock")
	if err != nil {
		t.Fatal(err)
	}
	if client.http.Timeout == 0 {
		t.Fatal("inventory client must retain a bounded timeout")
	}
	if client.buildHTTP.Timeout != 0 {
		t.Fatalf("build client timeout = %s, want request-context-only deadline", client.buildHTTP.Timeout)
	}
}
