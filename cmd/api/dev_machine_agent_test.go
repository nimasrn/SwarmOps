package main

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"net"
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

func TestConnectDevMachineAPIConnectsHostAgentWithoutDocker(t *testing.T) {
	const apiKey = "local-development-machine-key"
	docker, err := dockerapi.NewWithDial(func(context.Context, string, string) (net.Conn, error) {
		return nil, errors.New("Docker is not running")
	})
	if err != nil {
		t.Fatal(err)
	}
	agentServer, err := agent.NewServer(agent.Config{
		Docker:               docker,
		NodeName:             "Local machine",
		RemoteControlEnabled: true,
		Version:              "test",
	}, []byte(apiKey))
	if err != nil {
		t.Fatal(err)
	}
	httpsServer := httptest.NewTLSServer(agentServer.Handler())
	t.Cleanup(httpsServer.Close)
	endpoint, err := url.Parse(httpsServer.URL)
	if err != nil {
		t.Fatal(err)
	}
	port, err := strconv.ParseUint(endpoint.Port(), 10, 16)
	if err != nil {
		t.Fatal(err)
	}
	fingerprint := sha256.Sum256(httpsServer.Certificate().Raw)
	machine := &config.DevMachineAPI{
		APIKey:                    []byte(apiKey),
		APIURL:                    endpoint.Scheme + "://" + endpoint.Hostname(),
		Name:                      "Local machine",
		Port:                      uint16(port),
		TLSCertificateFingerprint: "SHA256:" + strings.ToUpper(hex.EncodeToString(fingerprint[:])),
	}
	servers, err := remote.NewManager(t.TempDir(), bytes.Repeat([]byte{7}, 32))
	if err != nil {
		t.Fatal(err)
	}
	if err := connectDevMachineAPI(context.Background(), machine, servers); err != nil {
		t.Fatalf("connect local machine API: %v", err)
	}
	profiles := servers.List()
	if len(profiles) != 1 {
		t.Fatalf("profiles = %#v, want one", profiles)
	}
	if profiles[0].ConnectionState != "connected" || profiles[0].DockerAvailable {
		t.Fatalf("profile = %#v, want connected host agent with Docker unavailable", profiles[0])
	}
	if err := servers.Disconnect(profiles[0].ID); err != nil {
		t.Fatal(err)
	}
	if err := connectDevMachineAPI(context.Background(), machine, servers); err != nil {
		t.Fatalf("reconnect local machine API: %v", err)
	}
	if got := len(servers.List()); got != 1 {
		t.Fatalf("profiles after reconnect = %d, want one", got)
	}
}
