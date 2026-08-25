package apihttp

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
	"time"

	"github.com/nimasrn/SwarmOps/internal/agent"
	"github.com/nimasrn/SwarmOps/internal/audit"
	"github.com/nimasrn/SwarmOps/internal/auth"
	"github.com/nimasrn/SwarmOps/internal/config"
	"github.com/nimasrn/SwarmOps/internal/dockerapi"
	"github.com/nimasrn/SwarmOps/internal/mobility"
	"github.com/nimasrn/SwarmOps/internal/remote"
)

func TestRestoredControlPlaneStartsItsOwnBurnIn(t *testing.T) {
	t.Parallel()
	store, err := mobility.Open(t.TempDir(), bytes.Repeat([]byte{4}, 32))
	if err != nil {
		t.Fatal(err)
	}
	definition, err := mobility.ResourceFor(mobility.ResourceControlPlane)
	if err != nil {
		t.Fatal(err)
	}
	migration, err := store.New(definition, "target-server", "node-target")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := store.Update(migration.ID, func(value *mobility.Migration) error {
		value.State = mobility.StateStarting
		value.Components[0].State = mobility.StateStarting
		value.Components[0].SourceNodeID = "node-source"
		return nil
	}); err != nil {
		t.Fatal(err)
	}
	server := &Server{config: config.Config{InstanceNodeID: "node-target", MobilityHealthyFor: time.Hour}, mobility: store}
	if err := server.observeControlPlaneHandover(); err != nil {
		t.Fatal(err)
	}
	updated, found := store.Get(migration.ID)
	if !found || updated.State != mobility.StateBurnIn || updated.Components[0].HealthySince == nil {
		t.Fatalf("restored handover state = %#v, found=%t", updated, found)
	}
}

func TestRetirementClusterRejectsWrongSelectedManager(t *testing.T) {
	t.Parallel()
	const apiKey = "mobility-test-machine-api-key"
	targetEndpoint, targetFingerprint := newMobilityTestMachineAPI(t, apiKey, "node-target", "cluster-a")
	servers, err := remote.NewManager(t.TempDir(), bytes.Repeat([]byte{6}, 32))
	if err != nil {
		t.Fatal(err)
	}
	profile, err := servers.Add(context.Background(), remote.AddInput{
		APIKey:                    apiKey,
		APIURL:                    targetEndpoint.origin,
		Name:                      "target",
		Port:                      targetEndpoint.port,
		TLSCertificateFingerprint: targetFingerprint,
	})
	if err != nil {
		t.Fatal(err)
	}
	migration := mobility.Migration{TargetNodeID: "node-target", TargetServerID: profile.ID}
	server := &Server{servers: servers}
	if _, err := server.retirementClusterID(context.Background(), newMobilityTestDocker(t, "manager-a", "cluster-a"), migration); err != nil {
		t.Fatalf("same-cluster retirement preflight: %v", err)
	}
	if _, err := server.retirementClusterID(context.Background(), newMobilityTestDocker(t, "manager-b", "cluster-b"), migration); err == nil {
		t.Fatal("wrong selected Swarm manager was accepted for source retirement")
	}
}

func TestMobilityAbandonRequiresTypedConfirmationAndRetainsSource(t *testing.T) {
	t.Parallel()
	directory := t.TempDir()
	key := bytes.Repeat([]byte{8}, 32)
	store, err := mobility.Open(directory, key)
	if err != nil {
		t.Fatal(err)
	}
	auditStore, err := audit.Open(directory, key, 100)
	if err != nil {
		t.Fatal(err)
	}
	definition, err := mobility.ResourceFor(mobility.ResourceRedis)
	if err != nil {
		t.Fatal(err)
	}
	migration, err := store.New(definition, "target-server", "target-node")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := store.Update(migration.ID, func(value *mobility.Migration) error {
		value.State = mobility.StateNeedsAttention
		value.Components[0].State = mobility.StateNeedsAttention
		return nil
	}); err != nil {
		t.Fatal(err)
	}
	server := &Server{audit: auditStore, mobility: store}
	badRequest := httptest.NewRequest(http.MethodPost, "/api/v1/mobility/"+migration.ID+"/abandon", strings.NewReader(`{"confirmation":"ABANDON_HANDOVER_wrong"}`))
	badRequest.SetPathValue("id", migration.ID)
	badResponse := httptest.NewRecorder()
	server.mobilityAbandon(badResponse, badRequest, auth.Claims{Username: "operator"})
	if badResponse.Code != http.StatusUnprocessableEntity {
		t.Fatalf("bad confirmation status = %d: %s", badResponse.Code, badResponse.Body.String())
	}

	request := httptest.NewRequest(http.MethodPost, "/api/v1/mobility/"+migration.ID+"/abandon", strings.NewReader(`{"confirmation":"ABANDON_HANDOVER_`+migration.ID+`"}`))
	request.SetPathValue("id", migration.ID)
	response := httptest.NewRecorder()
	server.mobilityAbandon(response, request, auth.Claims{Username: "operator"})
	if response.Code != http.StatusOK {
		t.Fatalf("close handover status = %d: %s", response.Code, response.Body.String())
	}
	closed, found := store.Get(migration.ID)
	if !found || closed.State != mobility.StateAbandoned || closed.SourceCleanupStarted {
		t.Fatalf("closed migration = %#v, found=%t", closed, found)
	}
}

func TestMobilityFailureAfterCleanupStartedNeverClaimsSourceWasRetained(t *testing.T) {
	t.Parallel()
	store, err := mobility.Open(t.TempDir(), bytes.Repeat([]byte{10}, 32))
	if err != nil {
		t.Fatal(err)
	}
	definition, err := mobility.ResourceFor(mobility.ResourceRedis)
	if err != nil {
		t.Fatal(err)
	}
	migration, err := store.New(definition, "target-server", "target-node")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := store.Update(migration.ID, func(value *mobility.Migration) error {
		value.State = mobility.StateRetiring
		value.SourceCleanupStarted = true
		return nil
	}); err != nil {
		t.Fatal(err)
	}
	server := &Server{mobility: store}
	server.markMigrationNeedsAttention(migration.ID)
	updated, found := store.Get(migration.ID)
	if !found || updated.State != mobility.StateNeedsAttention {
		t.Fatalf("updated migration = %#v, found=%t", updated, found)
	}
	if strings.Contains(strings.ToLower(updated.Failure), "retained") || !strings.Contains(strings.ToLower(updated.Failure), "may have begun") {
		t.Fatalf("ambiguous source cleanup failure = %q", updated.Failure)
	}
}

type mobilityMachineEndpoint struct {
	origin string
	port   uint16
}

func newMobilityTestMachineAPI(t *testing.T, apiKey, nodeID, clusterID string) (mobilityMachineEndpoint, string) {
	t.Helper()
	docker := newMobilityTestDocker(t, nodeID, clusterID)
	agentServer, err := agent.NewServer(agent.Config{Docker: docker, NodeName: nodeID, RemoteControlEnabled: true, Version: "test"}, []byte(apiKey))
	if err != nil {
		t.Fatal(err)
	}
	server := httptest.NewTLSServer(agentServer.Handler())
	t.Cleanup(server.Close)
	parsed, err := url.Parse(server.URL)
	if err != nil {
		t.Fatal(err)
	}
	port, err := strconv.ParseUint(parsed.Port(), 10, 16)
	if err != nil {
		t.Fatal(err)
	}
	fingerprint := sha256.Sum256(server.Certificate().Raw)
	return mobilityMachineEndpoint{origin: parsed.Scheme + "://" + parsed.Hostname(), port: uint16(port)}, "SHA256:" + strings.ToUpper(hex.EncodeToString(fingerprint[:]))
}

func newMobilityTestDocker(t *testing.T, nodeID, clusterID string) *dockerapi.Client {
	t.Helper()
	backend := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		response.Header().Set("Content-Type", "application/json")
		switch request.URL.Path {
		case "/_ping":
			_, _ = response.Write([]byte("OK"))
		case "/version":
			_, _ = response.Write([]byte(`{"Version":"27.0.0"}`))
		case "/info":
			_, _ = response.Write([]byte(`{"Swarm":{"ControlAvailable":true,"LocalNodeState":"active","NodeID":"` + nodeID + `","Cluster":{"ID":"` + clusterID + `"}}}`))
		case "/nodes", "/services", "/tasks":
			_, _ = response.Write([]byte(`[]`))
		default:
			http.NotFound(response, request)
		}
	}))
	t.Cleanup(backend.Close)
	client, err := dockerapi.NewForURL(backend.URL, backend.Client())
	if err != nil {
		t.Fatal(err)
	}
	return client
}
