//go:build integration

package apihttp

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"

	"golang.org/x/crypto/bcrypt"

	"github.com/nimasrn/SwarmOps/internal/agent"
	"github.com/nimasrn/SwarmOps/internal/audit"
	"github.com/nimasrn/SwarmOps/internal/config"
	"github.com/nimasrn/SwarmOps/internal/dockerapi"
	"github.com/nimasrn/SwarmOps/internal/domain"
	"github.com/nimasrn/SwarmOps/internal/ops"
	"github.com/nimasrn/SwarmOps/internal/queue"
	"github.com/nimasrn/SwarmOps/internal/remote"
)

// TestDockerSwarmCommandLifecycle exercises the production trust path against
// a real local Docker Engine: Core HTTP -> encrypted command queue -> pinned
// TLS machine agent -> fixed agent command -> Docker Swarm. It is intentionally
// opt-in because it creates a one-node Swarm only when the selected engine is
// inactive, and it leaves that Swarm plus its unique test resources afterwards.
func TestDockerSwarmCommandLifecycle(t *testing.T) {
	if os.Getenv("SWARMOPS_INTEGRATION_DOCKER") != "1" {
		t.Skip("set SWARMOPS_INTEGRATION_DOCKER=1 to run the disposable Docker Swarm integration test")
	}

	socket := integrationDockerSocket(t)
	if state := dockerOutput(t, socket, "info", "--format", "{{.Swarm.LocalNodeState}}"); state != "inactive" {
		t.Skipf("requires an inactive disposable Docker Engine; swarm state is %q", state)
	}
	dockerRun(t, socket, "swarm", "init", "--advertise-addr", "127.0.0.1")
	t.Cleanup(func() { dockerRunBestEffort(socket, "swarm", "leave", "--force") })

	docker, err := dockerapi.New(socket)
	if err != nil {
		t.Fatalf("create local Docker client: %v", err)
	}
	if err := docker.Ping(context.Background()); err != nil {
		t.Fatalf("ping local Docker Engine: %v", err)
	}

	const agentKey = "integration-machine-api-key"
	agentServer, err := agent.NewServer(agent.Config{
		Docker:               docker,
		NodeName:             "swarmops-integration-manager",
		RemoteControlEnabled: true,
		Version:              "integration",
	}, []byte(agentKey))
	if err != nil {
		t.Fatalf("create machine agent: %v", err)
	}
	machine := httptest.NewTLSServer(agentServer.Handler())
	t.Cleanup(machine.Close)

	machineURL, err := url.Parse(machine.URL)
	if err != nil {
		t.Fatalf("parse machine agent URL: %v", err)
	}
	machinePort, err := strconv.ParseUint(machineURL.Port(), 10, 16)
	if err != nil {
		t.Fatalf("parse machine agent port: %v", err)
	}
	fingerprint := sha256.Sum256(machine.Certificate().Raw)

	dataDir := t.TempDir()
	dataKey := bytes.Repeat([]byte{7}, 32)
	auditStore, err := audit.Open(dataDir, dataKey, 100)
	if err != nil {
		t.Fatalf("open audit store: %v", err)
	}
	servers, err := remote.NewManager(dataDir, dataKey)
	if err != nil {
		t.Fatalf("open server manager: %v", err)
	}
	profile, err := servers.Add(context.Background(), remote.AddInput{
		APIKey:                    agentKey,
		APIURL:                    machineURL.Scheme + "://" + machineURL.Hostname(),
		Name:                      "Disposable local Swarm",
		Port:                      uint16(machinePort),
		TLSCertificateFingerprint: "SHA256:" + strings.ToUpper(hex.EncodeToString(fingerprint[:])),
	})
	if err != nil {
		t.Fatalf("connect pinned machine agent: %v", err)
	}
	if !profile.DockerAvailable || !profile.SwarmControlAvailable {
		t.Fatalf("machine agent readiness = docker:%t swarm-control:%t", profile.DockerAvailable, profile.SwarmControlAvailable)
	}

	passwordHash, err := bcrypt.GenerateFromPassword([]byte("integration-password"), bcrypt.MinCost)
	if err != nil {
		t.Fatalf("hash integration password: %v", err)
	}
	targets := TargetResolverFunc(func(id string) (Target, error) {
		connection, err := servers.Resolve(id)
		if err != nil {
			return Target{}, err
		}
		if connection.Docker == nil || !connection.Profile.SwarmControlAvailable {
			return Target{}, fmt.Errorf("selected server is not a Swarm manager")
		}
		return Target{Control: ops.NewControlPlane(connection.Docker, ops.DockerCLI{Runner: connection.Runner}, auditStore, ops.ControlPlaneOptions{
			DataDir:   dataDir,
			Mutations: true,
			ServerID:  id,
		})}, nil
	})
	api, err := New(config.Config{
		AdminPasswordHash:   passwordHash,
		AdminUsername:       "operator",
		DataDir:             dataDir,
		DataEncryptionKey:   dataKey,
		MutationEnabled:     true,
		SecureCookies:       false,
		SessionKey:          []byte("01234567890123456789012345678901"),
		SessionTTL:          time.Hour,
		CommandHistoryLimit: 100,
	}, targets, servers, auditStore, slog.New(slog.NewTextHandler(io.Discard, nil)))
	if err != nil {
		t.Fatalf("create Core API: %v", err)
	}

	workerContext, stopWorker := context.WithCancel(context.Background())
	workerDone := make(chan error, 1)
	go func() {
		workerDone <- (queue.Worker{
			CanExecute:       api.CanExecuteCommands,
			Execute:          api.ExecuteCommand,
			ExecutionTimeout: api.CommandExecutionTimeout,
			OnTransition:     api.RecordCommandTransition,
			PollInterval:     20 * time.Millisecond,
			Store:            api.CommandStore(),
		}).Run(workerContext)
	}()
	t.Cleanup(func() {
		stopWorker()
		select {
		case err := <-workerDone:
			if err != nil {
				t.Errorf("stop command worker: %v", err)
			}
		case <-time.After(5 * time.Second):
			t.Error("command worker did not stop")
		}
	})

	core := httptest.NewServer(api.Handler())
	t.Cleanup(core.Close)
	client := integrationHTTPClient(t)
	csrf := integrationLogin(t, client, core.URL)
	suffix := strconv.FormatInt(time.Now().UnixNano(), 36)

	missingTarget := integrationRequest(t, client, http.MethodGet, core.URL+"/api/v1/overview", nil, nil, http.StatusConflict)
	missingTarget.Body.Close()
	var overview domain.Overview
	integrationJSON(t, integrationRequest(t, client, http.MethodGet, core.URL+"/api/v1/overview", nil, integrationHeaders(profile.ID, ""), http.StatusOK), &overview)
	if overview.Summary.Managers != 1 || overview.Summary.Nodes != 1 {
		t.Fatalf("overview summary = %#v", overview.Summary)
	}
	// These are all read-only Core projections. Running them through the same
	// selected-server header proves the fixed machine-agent facade supports the
	// console's inventory, diagnostics, and command-catalogue surface without
	// ever making the controller depend on a local Docker socket.
	for _, check := range []struct {
		endpoint string
		want     int
	}{
		{"/api/v1/nodes", http.StatusOK},
		{"/api/v1/stacks", http.StatusOK},
		{"/api/v1/services", http.StatusOK},
		{"/api/v1/containers", http.StatusOK},
		{"/api/v1/images", http.StatusOK},
		{"/api/v1/volumes", http.StatusOK},
		{"/api/v1/networks", http.StatusOK},
		{"/api/v1/secrets", http.StatusOK},
		{"/api/v1/configs", http.StatusOK},
		{"/api/v1/insights", http.StatusOK},
		{"/api/v1/events", http.StatusOK},
		{"/api/v1/system/df", http.StatusOK},
		{"/api/v1/swarm", http.StatusOK},
		{"/api/v1/commands/catalogue", http.StatusOK},
		{"/api/v1/commands", http.StatusOK},
		{"/api/v1/servers/" + profile.ID + "/diagnostics", http.StatusOK},
		// The test agent deliberately has no root-only provisioning helper. The
		// public Core route must report that absence rather than permitting a
		// browser request to run host commands directly.
		{"/api/v1/servers/" + profile.ID + "/readiness", http.StatusUnprocessableEntity},
	} {
		response := integrationRequest(t, client, http.MethodGet, core.URL+check.endpoint, nil, integrationHeaders(profile.ID, ""), check.want)
		response.Body.Close()
	}
	swarmUpdate := integrationSubmit(t, client, core.URL+"/api/v1/swarm", integrationHeaders(profile.ID, csrf, "swarmops-e2e-swarm-update-"+suffix), map[string]uint64{"taskHistoryLimit": 3})
	integrationWaitSucceeded(t, client, core.URL, swarmUpdate.ID)
	var swarm dockerapi.SwarmObject
	integrationJSON(t, integrationRequest(t, client, http.MethodGet, core.URL+"/api/v1/swarm", nil, integrationHeaders(profile.ID, ""), http.StatusOK), &swarm)
	if swarm.Spec.Orchestration.TaskHistoryRetentionLimit != 3 {
		t.Fatalf("task history limit = %d, want 3", swarm.Spec.Orchestration.TaskHistoryRetentionLimit)
	}
	if len(overview.Nodes) != 1 || overview.Nodes[0].ID == "" {
		t.Fatalf("manager node inventory = %#v", overview.Nodes)
	}
	nodeID := overview.Nodes[0].ID
	labelKey := "swarmops.e2e"
	labelAdd := integrationSubmit(t, client, core.URL+"/api/v1/nodes/"+nodeID+"/labels", integrationHeaders(profile.ID, csrf, "swarmops-e2e-label-add-"+suffix), map[string]string{"key": labelKey, "value": "integration"})
	integrationWaitSucceeded(t, client, core.URL, labelAdd.ID)
	if !integrationNodeHasLabel(t, client, core.URL, profile.ID, nodeID, labelKey, "integration") {
		t.Fatal("node label was not applied through the fixed machine-agent command")
	}
	labelRemove := integrationSubmit(t, client, core.URL+"/api/v1/nodes/"+nodeID+"/labels", integrationHeaders(profile.ID, csrf, "swarmops-e2e-label-remove-"+suffix), map[string]string{"key": labelKey})
	integrationWaitSucceeded(t, client, core.URL, labelRemove.ID)
	if integrationNodeHasLabel(t, client, core.URL, profile.ID, nodeID, labelKey, "") {
		t.Fatal("node label remained after fixed API removal")
	}

	networkName := "swarmops-e2e-network-" + suffix
	volumeName := "swarmops-e2e-volume-" + suffix
	t.Cleanup(func() {
		dockerRunBestEffort(socket, "network", "rm", networkName)
		dockerRunBestEffort(socket, "volume", "rm", volumeName)
	})

	networkCommand := integrationSubmit(t, client, core.URL+"/api/v1/networks", integrationHeaders(profile.ID, csrf, "swarmops-e2e-network-create-"+suffix), map[string]any{
		"name": networkName, "driver": "overlay", "attachable": true, "internal": true,
	})
	replayedNetwork := integrationSubmit(t, client, core.URL+"/api/v1/networks", integrationHeaders(profile.ID, csrf, "swarmops-e2e-network-create-"+suffix), map[string]any{
		"name": networkName, "driver": "overlay", "attachable": true, "internal": true,
	})
	if replayedNetwork.ID != networkCommand.ID {
		t.Fatalf("idempotent network request returned %q, want %q", replayedNetwork.ID, networkCommand.ID)
	}
	integrationWaitSucceeded(t, client, core.URL, networkCommand.ID)
	if !integrationNetworkExists(t, servers, profile.ID, networkName) {
		t.Fatal("network was not created through the fixed machine-agent command")
	}
	networkRemoval := integrationSubmit(t, client, core.URL+"/api/v1/networks/"+networkName+"/remove", integrationHeaders(profile.ID, csrf, "swarmops-e2e-network-remove-"+suffix), map[string]string{
		"confirmation": ops.ResourceRemovalConfirmation("NETWORK", networkName),
	})
	integrationWaitSucceeded(t, client, core.URL, networkRemoval.ID)
	if integrationNetworkExists(t, servers, profile.ID, networkName) {
		t.Fatal("network remained after confirmed API removal")
	}

	volumeCommand := integrationSubmit(t, client, core.URL+"/api/v1/volumes", integrationHeaders(profile.ID, csrf, "swarmops-e2e-volume-create-"+suffix), map[string]string{"name": volumeName})
	integrationWaitSucceeded(t, client, core.URL, volumeCommand.ID)
	if !integrationVolumeExists(t, servers, profile.ID, volumeName) {
		t.Fatal("volume was not created through the fixed machine-agent command")
	}
	volumeRemoval := integrationSubmit(t, client, core.URL+"/api/v1/volumes/"+volumeName+"/remove", integrationHeaders(profile.ID, csrf, "swarmops-e2e-volume-remove-"+suffix), map[string]string{
		"confirmation": ops.ResourceRemovalConfirmation("VOLUME", volumeName),
	})
	integrationWaitSucceeded(t, client, core.URL, volumeRemoval.ID)
	if integrationVolumeExists(t, servers, profile.ID, volumeName) {
		t.Fatal("volume remained after confirmed API removal")
	}

	imageName := "swarmops-e2e-image-" + suffix
	containerName := "swarmops-e2e-container-" + suffix
	integrationBuildScratchImage(t, socket, imageName)
	t.Cleanup(func() {
		dockerRunBestEffort(socket, "container", "rm", "--force", containerName)
		dockerRunBestEffort(socket, "image", "rm", "--force", imageName)
	})
	containerID := dockerOutput(t, socket, "container", "create", "--name", containerName, imageName)
	if !integrationContainerExists(t, servers, profile.ID, containerID) {
		t.Fatal("disposable container was not visible through the pinned machine agent")
	}
	containerRemoval := integrationSubmit(t, client, core.URL+"/api/v1/containers/"+containerID+"/actions", integrationHeaders(profile.ID, csrf, "swarmops-e2e-container-remove-"+suffix), map[string]string{
		"action":       "remove",
		"confirmation": ops.ResourceRemovalConfirmation("CONTAINER", containerID),
	})
	integrationWaitSucceeded(t, client, core.URL, containerRemoval.ID)
	if integrationContainerExists(t, servers, profile.ID, containerID) {
		t.Fatal("container remained after confirmed API removal")
	}
	if !integrationImageExists(t, servers, profile.ID, imageName) {
		t.Fatal("scratch image was not visible through the pinned machine agent")
	}
	imageRemoval := integrationSubmit(t, client, core.URL+"/api/v1/images/remove", integrationHeaders(profile.ID, csrf, "swarmops-e2e-image-remove-"+suffix), map[string]string{"image": imageName})
	integrationWaitSucceeded(t, client, core.URL, imageRemoval.ID)
	if integrationImageExists(t, servers, profile.ID, imageName) {
		t.Fatal("image remained after fixed API removal")
	}
}

func integrationDockerSocket(t *testing.T) string {
	t.Helper()
	if configured := strings.TrimPrefix(strings.TrimSpace(os.Getenv("SWARMOPS_INTEGRATION_DOCKER_SOCKET")), "unix://"); configured != "" {
		if info, err := os.Stat(configured); err == nil && info.Mode()&os.ModeSocket != 0 {
			return configured
		}
		t.Fatalf("configured integration Docker socket is unavailable")
	}
	if configured := strings.TrimPrefix(strings.TrimSpace(os.Getenv("DOCKER_HOST")), "unix://"); strings.HasPrefix(configured, "/") {
		if info, err := os.Stat(configured); err == nil && info.Mode()&os.ModeSocket != 0 {
			return configured
		}
	}
	for _, candidate := range []string{"/var/run/docker.sock", filepath.Join(integrationHome(t), ".orbstack/run/docker.sock"), filepath.Join(integrationHome(t), ".docker/run/docker.sock")} {
		if info, err := os.Stat(candidate); err == nil && info.Mode()&os.ModeSocket != 0 {
			return candidate
		}
	}
	t.Skip("no local Docker Unix socket is available")
	return ""
}

func integrationHome(t *testing.T) string {
	t.Helper()
	home, err := os.UserHomeDir()
	if err != nil {
		t.Fatalf("locate home directory for Docker socket: %v", err)
	}
	return home
}

func dockerOutput(t *testing.T, socket string, args ...string) string {
	t.Helper()
	command := exec.Command("docker", args...)
	command.Env = append(os.Environ(), "DOCKER_HOST=unix://"+socket)
	output, err := command.Output()
	if err != nil {
		t.Fatalf("run Docker %q: %v", strings.Join(args[:1], " "), err)
	}
	return strings.TrimSpace(string(output))
}

func dockerRun(t *testing.T, socket string, args ...string) {
	t.Helper()
	command := exec.Command("docker", args...)
	command.Env = append(os.Environ(), "DOCKER_HOST=unix://"+socket)
	command.Stdout = io.Discard
	command.Stderr = io.Discard
	if err := command.Run(); err != nil {
		t.Fatalf("run Docker %q: %v", strings.Join(args[:1], " "), err)
	}
}

func dockerRunBestEffort(socket string, args ...string) {
	command := exec.Command("docker", args...)
	command.Env = append(os.Environ(), "DOCKER_HOST=unix://"+socket)
	command.Stdout = io.Discard
	command.Stderr = io.Discard
	_ = command.Run()
}

func integrationHTTPClient(t *testing.T) *http.Client {
	t.Helper()
	jar, err := cookiejar.New(nil)
	if err != nil {
		t.Fatalf("create cookie jar: %v", err)
	}
	return &http.Client{Jar: jar, Timeout: 10 * time.Second}
}

func integrationLogin(t *testing.T, client *http.Client, baseURL string) string {
	t.Helper()
	response := integrationRequest(t, client, http.MethodPost, baseURL+"/api/v1/auth/login", map[string]string{"username": "operator", "password": "integration-password"}, nil, http.StatusOK)
	defer response.Body.Close()
	var output struct {
		CSRFToken string `json:"csrfToken"`
	}
	integrationJSON(t, response, &output)
	if output.CSRFToken == "" {
		t.Fatal("login did not return a CSRF token")
	}
	return output.CSRFToken
}

func integrationHeaders(serverID, csrf string, idempotency ...string) map[string]string {
	headers := map[string]string{"X-SwarmOps-Cluster-ID": "default", "X-SwarmOps-Server-ID": serverID}
	if csrf != "" {
		headers["X-CSRF-Token"] = csrf
	}
	if len(idempotency) == 1 {
		headers["Idempotency-Key"] = idempotency[0]
	}
	return headers
}

func integrationSubmit(t *testing.T, client *http.Client, endpoint string, headers map[string]string, input any) domain.Command {
	t.Helper()
	response := integrationRequest(t, client, http.MethodPost, endpoint, input, headers, http.StatusAccepted)
	defer response.Body.Close()
	var command domain.Command
	integrationJSON(t, response, &command)
	if command.ID == "" {
		t.Fatal("command submission did not return an ID")
	}
	return command
}

func integrationWaitSucceeded(t *testing.T, client *http.Client, baseURL, id string) {
	t.Helper()
	deadline := time.Now().Add(30 * time.Second)
	for time.Now().Before(deadline) {
		response := integrationRequest(t, client, http.MethodGet, baseURL+"/api/v1/commands/"+id, nil, nil, http.StatusOK)
		var command domain.Command
		integrationJSON(t, response, &command)
		response.Body.Close()
		switch command.State {
		case domain.CommandSucceeded:
			return
		case domain.CommandNeedsAttention:
			t.Fatalf("command %s needs operator attention", command.Action)
		}
		time.Sleep(25 * time.Millisecond)
	}
	t.Fatalf("command %q did not complete", id)
}

func integrationNetworkExists(t *testing.T, servers *remote.Manager, id, name string) bool {
	t.Helper()
	connection, err := servers.Resolve(id)
	if err != nil {
		t.Fatalf("resolve server for network verification: %v", err)
	}
	networks, err := connection.Docker.ListNetworks(context.Background())
	if err != nil {
		t.Fatalf("list networks through machine agent: %v", err)
	}
	for _, network := range networks {
		if network.Name == name {
			return true
		}
	}
	return false
}

func integrationContainerExists(t *testing.T, servers *remote.Manager, id, containerID string) bool {
	t.Helper()
	connection, err := servers.Resolve(id)
	if err != nil {
		t.Fatalf("resolve server for container verification: %v", err)
	}
	containers, err := connection.Docker.ListContainers(context.Background(), true)
	if err != nil {
		t.Fatalf("list containers through machine agent: %v", err)
	}
	for _, container := range containers {
		if container.ID == containerID {
			return true
		}
	}
	return false
}

func integrationImageExists(t *testing.T, servers *remote.Manager, id, imageName string) bool {
	t.Helper()
	connection, err := servers.Resolve(id)
	if err != nil {
		t.Fatalf("resolve server for image verification: %v", err)
	}
	images, err := connection.Docker.ListImages(context.Background())
	if err != nil {
		t.Fatalf("list images through machine agent: %v", err)
	}
	for _, image := range images {
		for _, tag := range image.RepoTags {
			if tag == imageName || tag == imageName+":latest" {
				return true
			}
		}
	}
	return false
}

func integrationVolumeExists(t *testing.T, servers *remote.Manager, id, name string) bool {
	t.Helper()
	connection, err := servers.Resolve(id)
	if err != nil {
		t.Fatalf("resolve server for volume verification: %v", err)
	}
	volumes, err := connection.Docker.ListVolumes(context.Background())
	if err != nil {
		t.Fatalf("list volumes through machine agent: %v", err)
	}
	for _, volume := range volumes {
		if volume.Name == name {
			return true
		}
	}
	return false
}

func integrationNodeHasLabel(t *testing.T, client *http.Client, baseURL, serverID, nodeID, key, want string) bool {
	t.Helper()
	response := integrationRequest(t, client, http.MethodGet, baseURL+"/api/v1/nodes", nil, integrationHeaders(serverID, ""), http.StatusOK)
	defer response.Body.Close()
	var nodes []domain.Node
	integrationJSON(t, response, &nodes)
	for _, node := range nodes {
		if node.ID == nodeID {
			value, found := node.Labels[key]
			return found && value == want
		}
	}
	t.Fatalf("node %q disappeared from inventory", nodeID)
	return false
}

func integrationRequest(t *testing.T, client *http.Client, method, endpoint string, input any, headers map[string]string, want int) *http.Response {
	t.Helper()
	var body io.Reader
	if input != nil {
		encoded, err := json.Marshal(input)
		if err != nil {
			t.Fatalf("encode request: %v", err)
		}
		body = bytes.NewReader(encoded)
	}
	request, err := http.NewRequest(method, endpoint, body)
	if err != nil {
		t.Fatalf("create HTTP request: %v", err)
	}
	if input != nil {
		request.Header.Set("Content-Type", "application/json")
	}
	for key, value := range headers {
		request.Header.Set(key, value)
	}
	response, err := client.Do(request)
	if err != nil {
		t.Fatalf("call Core API: %v", err)
	}
	if response.StatusCode != want {
		response.Body.Close()
		t.Fatalf("%s %s status = %d, want %d", method, request.URL.Path, response.StatusCode, want)
	}
	return response
}

func integrationJSON(t *testing.T, response *http.Response, output any) {
	t.Helper()
	if err := json.NewDecoder(response.Body).Decode(output); err != nil {
		t.Fatalf("decode API response: %v", err)
	}
}

func integrationBuildScratchImage(t *testing.T, socket, imageName string) {
	t.Helper()
	contextDir := t.TempDir()
	if err := os.WriteFile(filepath.Join(contextDir, "Dockerfile"), []byte("FROM scratch\nENTRYPOINT [\"/not-present\"]\n"), 0o600); err != nil {
		t.Fatalf("write scratch image Dockerfile: %v", err)
	}
	dockerRun(t, socket, "build", "--tag", imageName, contextDir)
}
