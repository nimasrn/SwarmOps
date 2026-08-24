package main

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strconv"
	"strings"
	"testing"

	"github.com/nimasrn/SwarmOps/internal/agent"
	"github.com/nimasrn/SwarmOps/internal/config"
	"github.com/nimasrn/SwarmOps/internal/dockerapi"
	"github.com/nimasrn/SwarmOps/internal/remote"
)

func TestConnectDevMachineAPIAddsAndReconnectsLoopbackAgent(t *testing.T) {
	const apiKey = "local-development-machine-key"
	dockerBackend := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		switch request.URL.Path {
		case "/_ping":
			_, _ = response.Write([]byte("OK"))
		case "/version":
			_, _ = response.Write([]byte(`{"Version":"27.0.0"}`))
		case "/info":
			_, _ = response.Write([]byte(`{"Swarm":{"ControlAvailable":true,"LocalNodeState":"active"}}`))
		case "/nodes", "/services", "/tasks":
			_, _ = response.Write([]byte(`[]`))
		default:
			http.NotFound(response, request)
		}
	}))
	defer dockerBackend.Close()
	docker, err := dockerapi.NewForURL(dockerBackend.URL, dockerBackend.Client())
	if err != nil {
		t.Fatal(err)
	}
	agentServer, err := agent.NewServer(agent.Config{Docker: docker, RemoteControlEnabled: true}, []byte(apiKey))
	if err != nil {
		t.Fatal(err)
	}
	machineServer := httptest.NewTLSServer(agentServer.Handler())
	defer machineServer.Close()
	endpoint, err := url.Parse(machineServer.URL)
	if err != nil {
		t.Fatal(err)
	}
	port, err := strconv.ParseUint(endpoint.Port(), 10, 16)
	if err != nil {
		t.Fatal(err)
	}
	fingerprint := sha256.Sum256(machineServer.Certificate().Raw)
	machine := &config.DevMachineAPI{
		APIKey:                    []byte(apiKey),
		APIURL:                    endpoint.Scheme + "://" + endpoint.Hostname(),
		Name:                      "Local machine",
		Port:                      uint16(port),
		TLSCertificateFingerprint: "SHA256:" + strings.ToUpper(hex.EncodeToString(fingerprint[:])),
	}
	manager, err := remote.NewManager(t.TempDir(), bytes.Repeat([]byte{7}, 32))
	if err != nil {
		t.Fatal(err)
	}
	if err := connectDevMachineAPI(context.Background(), machine, manager); err != nil {
		t.Fatalf("connect development machine API: %v", err)
	}
	profiles := manager.List()
	if len(profiles) != 1 || profiles[0].ConnectionState != "connected" || !profiles[0].DockerAvailable || !profiles[0].SwarmControlAvailable {
		t.Fatalf("profiles = %#v", profiles)
	}
	if err := manager.Disconnect(profiles[0].ID); err != nil {
		t.Fatal(err)
	}
	if err := connectDevMachineAPI(context.Background(), machine, manager); err != nil {
		t.Fatalf("reconnect development machine API: %v", err)
	}
	if got := manager.List(); len(got) != 1 || got[0].ConnectionState != "connected" {
		t.Fatalf("reconnected profiles = %#v", got)
	}
}
