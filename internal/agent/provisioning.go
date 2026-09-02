package agent

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/netip"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/nimasrn/SwarmOps/internal/agentcontrol"
)

const (
	provisioningRequestLimit = 32 << 10
	provisioningTimeout      = 45 * time.Minute
	provisioningOutputLimit  = 8 << 10
)

type provisionerResponse struct {
	Error string `json:"error,omitempty"`
	OK    bool   `json:"ok"`
}

// provisioningStatus is intentionally served by the already authenticated
// agent. It has no side effects and exposes only the compact readiness fields
// needed by the console's reviewed plan.
func (s *Server) provisioningStatus(ctx context.Context) agentcontrol.ProvisioningStatus {
	status := agentcontrol.ProvisioningStatus{}
	osInfo := readProvisioningOS(s.config.HostOS)
	status.OS = agentcontrol.ProvisioningOS{ID: osInfo.id, Name: osInfo.name, Supported: supportedProvisioningOS(osInfo.id)}

	if _, err := exec.LookPath("docker"); err == nil {
		status.Docker.Installed = true
	}
	if s.config.Docker != nil && s.config.Docker.Ping(ctx) == nil {
		status.Docker.Running = true
		if version, err := s.config.Docker.Version(ctx); err == nil {
			status.Docker.Version = version.Version
		}
		if info, err := s.config.Docker.Info(ctx); err == nil {
			status.Docker.RegistryMirrors = info.RegistryConfig.Mirrors
			status.Swarm.State = info.Swarm.LocalNodeState
			status.Swarm.Manager = info.Swarm.ControlAvailable
		}
	}
	if _, err := exec.LookPath("ufw"); err == nil {
		status.Firewall.Available = true
		status.Firewall.Enabled = ufwEnabled(ctx)
	}
	// A separate private Unix-socket helper retains the primary agent's
	// restrictive systemd sandbox. Without that helper the console can still
	// inspect readiness but cannot make host-level changes.
	available := s.config.RemoteControlEnabled && strings.TrimSpace(s.config.ProvisionSocket) != ""
	status.Capabilities = agentcontrol.ProvisioningCapabilities{
		// Changing the mirror list means rewriting daemon.json and restarting
		// Docker, so it is offered only where Docker is actually installed.
		ApplyRegistryMirrors: available && status.OS.Supported && status.Docker.Installed,
		ApplyUFW:             available && status.OS.Supported,
		InitializeSwarm:      available && status.OS.Supported && status.Swarm.State != "active",
		InstallDocker:        available && status.OS.Supported && !status.Docker.Installed,
		JoinSwarm:            available && status.OS.Supported && status.Docker.Running && status.Swarm.State == "inactive",
		UpdateDocker:         available && status.OS.Supported && status.Docker.Installed,
		UpdateOS:             available && status.OS.Supported,
	}
	return status
}

func (s *Server) provision(ctx context.Context, request agentcontrol.ProvisioningRequest) error {
	if err := request.Validate(); err != nil {
		return err
	}
	if !s.config.RemoteControlEnabled || strings.TrimSpace(s.config.ProvisionSocket) == "" {
		return fmt.Errorf("machine provisioning is not configured")
	}
	connection, err := (&net.Dialer{}).DialContext(ctx, "unix", s.config.ProvisionSocket)
	if err != nil {
		return fmt.Errorf("machine provisioning helper is unavailable")
	}
	defer connection.Close()
	if deadline, found := ctx.Deadline(); found {
		_ = connection.SetDeadline(deadline)
	}
	if err := json.NewEncoder(connection).Encode(request); err != nil {
		return fmt.Errorf("send machine provisioning request")
	}
	// The helper reads to EOF to prove it received exactly ONE request — a
	// second object on the same connection would be a second host operation
	// nobody authorised. That check only terminates if this side closes its
	// write half: without this, both processes wait for the other and the
	// operation appears to hang for the whole 45-minute timeout before
	// failing as "invalid". Reading the response is unaffected; only the
	// write direction is shut down.
	if unixConnection, ok := connection.(*net.UnixConn); ok {
		if err := unixConnection.CloseWrite(); err != nil {
			return fmt.Errorf("send machine provisioning request")
		}
	}
	var response provisionerResponse
	if err := json.NewDecoder(io.LimitReader(connection, provisioningRequestLimit)).Decode(&response); err != nil {
		return fmt.Errorf("read machine provisioning result")
	}
	if !response.OK {
		return fmt.Errorf("machine provisioning did not complete")
	}
	return nil
}

// ServeProvisioner starts the root-only local helper installed beside the
// normal agent. It has no TCP listener: only the sandboxed authenticated agent
// can reach its Unix socket, and every request is validated again before a
// fixed host operation runs.
func ServeProvisioner(ctx context.Context, socketPath string, agentPort uint16) error {
	if strings.TrimSpace(socketPath) == "" || !filepath.IsAbs(socketPath) {
		return fmt.Errorf("provisioning socket must be an absolute path")
	}
	if agentPort == 0 {
		return fmt.Errorf("provisioning agent port is required")
	}
	if err := os.MkdirAll(filepath.Dir(socketPath), 0o755); err != nil {
		return fmt.Errorf("create provisioning socket directory: %w", err)
	}
	if info, err := os.Lstat(socketPath); err == nil {
		if info.Mode()&os.ModeSocket == 0 {
			return fmt.Errorf("provisioning socket path is not a socket")
		}
		if err := os.Remove(socketPath); err != nil {
			return fmt.Errorf("remove stale provisioning socket: %w", err)
		}
	} else if !os.IsNotExist(err) {
		return fmt.Errorf("check provisioning socket: %w", err)
	}
	listener, err := net.Listen("unix", socketPath)
	if err != nil {
		return fmt.Errorf("listen for provisioning requests: %w", err)
	}
	defer func() {
		_ = listener.Close()
		_ = os.Remove(socketPath)
	}()
	if err := os.Chmod(socketPath, 0o660); err != nil {
		return fmt.Errorf("protect provisioning socket: %w", err)
	}
	go func() {
		<-ctx.Done()
		_ = listener.Close()
	}()

	provisioner := systemProvisioner{agentPort: agentPort}
	var serial sync.Mutex
	for {
		connection, err := listener.Accept()
		if err != nil {
			if ctx.Err() != nil {
				return nil
			}
			return fmt.Errorf("accept provisioning request: %w", err)
		}
		go func(connection net.Conn) {
			defer connection.Close()
			_ = connection.SetDeadline(time.Now().Add(provisioningTimeout + time.Minute))
			var request agentcontrol.ProvisioningRequest
			decoder := json.NewDecoder(io.LimitReader(connection, provisioningRequestLimit))
			if err := decoder.Decode(&request); err != nil || decoder.Decode(&struct{}{}) != io.EOF || request.Validate() != nil {
				_ = json.NewEncoder(connection).Encode(provisionerResponse{Error: "invalid request"})
				return
			}
			serial.Lock()
			defer serial.Unlock()
			operationContext, cancel := context.WithTimeout(ctx, provisioningTimeout)
			err := provisioner.apply(operationContext, request)
			cancel()
			if err != nil {
				_ = json.NewEncoder(connection).Encode(provisionerResponse{Error: "operation did not complete"})
				return
			}
			_ = json.NewEncoder(connection).Encode(provisionerResponse{OK: true})
		}(connection)
	}
}

type provisioningOS struct {
	codename string
	id       string
	name     string
}

func readProvisioningOS(preferred string) provisioningOS {
	paths := []string{strings.TrimSpace(preferred), "/etc/os-release"}
	seen := map[string]bool{}
	for _, path := range paths {
		if path == "" || seen[path] {
			continue
		}
		seen[path] = true
		data, err := os.ReadFile(filepath.Clean(path))
		if err != nil {
			continue
		}
		values := map[string]string{}
		for _, line := range strings.Split(string(data), "\n") {
			key, value, found := strings.Cut(line, "=")
			if !found {
				continue
			}
			values[key] = strings.Trim(strings.TrimSpace(value), `"`)
		}
		return provisioningOS{id: strings.ToLower(values["ID"]), name: values["PRETTY_NAME"], codename: strings.ToLower(values["VERSION_CODENAME"])}
	}
	return provisioningOS{}
}

func supportedProvisioningOS(id string) bool { return id == "debian" || id == "ubuntu" }

func ufwEnabled(ctx context.Context) bool {
	output, err := outputCommand(ctx, "ufw", "status")
	return err == nil && strings.Contains(strings.ToLower(output), "status: active")
}

type systemProvisioner struct{ agentPort uint16 }

func (p systemProvisioner) apply(ctx context.Context, request agentcontrol.ProvisioningRequest) error {
	osInfo := readProvisioningOS("/etc/os-release")
	if !supportedProvisioningOS(osInfo.id) {
		return fmt.Errorf("machine operating system is not supported")
	}
	if request.UpdateOS {
		if err := runFixed(ctx, "apt-get", "update"); err != nil {
			return err
		}
		if err := runFixed(ctx, "apt-get", "--yes", "--with-new-pkgs", "upgrade"); err != nil {
			return err
		}
	}
	if request.InstallDocker {
		if err := p.installDocker(ctx, osInfo); err != nil {
			return err
		}
	}
	if request.UpdateDocker {
		if err := p.updateDocker(ctx); err != nil {
			return err
		}
	}
	if request.InitializeSwarm {
		if err := p.initializeSwarm(ctx, request.AdvertiseAddress); err != nil {
			return err
		}
	}
	if request.JoinSwarm {
		if err := p.joinSwarm(ctx, request); err != nil {
			return err
		}
	}
	if request.ApplyUFW {
		if err := p.applyUFW(ctx, request); err != nil {
			return err
		}
	}
	// The mirror change runs last: it restarts the daemon, and anything above
	// it that still needed Docker has already finished by the time it does.
	if request.ApplyRegistryMirrors {
		if err := p.applyRegistryMirrors(ctx, request); err != nil {
			return err
		}
	}
	return nil
}

// dockerDaemonConfig is the file the mirror list lives in. It is a constant
// rather than a request field: the machine owns its own daemon configuration,
// and a path from the controller would be a path anyone could choose.
const dockerDaemonConfig = "/etc/docker/daemon.json"

// applyRegistryMirrors rewrites ONLY the registry-mirrors key of daemon.json.
//
// Every other key the host already had is preserved: an operator who set a
// log driver, a storage driver or an address pool by hand does not lose it to
// a mirror change. An empty list removes the key entirely, which is how the
// machine goes back to pulling from Docker Hub directly.
func (p systemProvisioner) applyRegistryMirrors(ctx context.Context, request agentcontrol.ProvisioningRequest) error {
	mirrors, err := request.NormalizedRegistryMirrors()
	if err != nil {
		return err
	}
	existing, readErr := os.ReadFile(dockerDaemonConfig)
	if readErr != nil && !os.IsNotExist(readErr) {
		return fmt.Errorf("read Docker daemon configuration")
	}
	encoded, err := mergeRegistryMirrors(existing, mirrors)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(dockerDaemonConfig), 0o755); err != nil {
		return fmt.Errorf("prepare Docker daemon configuration directory")
	}
	if err := writeSystemFile(dockerDaemonConfig, encoded, 0o644); err != nil {
		return err
	}
	// The daemon reads this file only at start. A reload would leave the
	// console reporting a mirror that no pull is actually using.
	return runFixed(ctx, "systemctl", "restart", "docker")
}

func (p systemProvisioner) installDocker(ctx context.Context, osInfo provisioningOS) error {
	if _, err := exec.LookPath("docker"); err == nil {
		return nil
	}
	if osInfo.codename == "" {
		return fmt.Errorf("machine operating system codename is unavailable")
	}
	if err := runFixed(ctx, "apt-get", "update"); err != nil {
		return err
	}
	if err := runFixed(ctx, "apt-get", "install", "--yes", "--no-install-recommends", "ca-certificates", "curl", "gnupg"); err != nil {
		return err
	}
	architecture, err := outputCommand(ctx, "dpkg", "--print-architecture")
	if err != nil {
		return fmt.Errorf("read package architecture")
	}
	architecture = strings.TrimSpace(architecture)
	if architecture != "amd64" && architecture != "arm64" && architecture != "armhf" {
		return fmt.Errorf("machine architecture is not supported")
	}
	if err := os.MkdirAll("/etc/apt/keyrings", 0o755); err != nil {
		return fmt.Errorf("prepare Docker repository keyring")
	}
	keyURL := "https://download.docker.com/linux/" + osInfo.id + "/gpg"
	key, err := downloadDockerKey(ctx, keyURL)
	if err != nil {
		return err
	}
	if err := writeSystemFile("/etc/apt/keyrings/docker.asc", key, 0o644); err != nil {
		return err
	}
	entry := fmt.Sprintf("deb [arch=%s signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/%s %s stable\n", architecture, osInfo.id, osInfo.codename)
	if err := writeSystemFile("/etc/apt/sources.list.d/docker.list", []byte(entry), 0o644); err != nil {
		return err
	}
	if err := runFixed(ctx, "apt-get", "update"); err != nil {
		return err
	}
	if err := runFixed(ctx, "apt-get", "install", "--yes", "--no-install-recommends", "docker-ce", "docker-ce-cli", "containerd.io", "docker-buildx-plugin", "docker-compose-plugin"); err != nil {
		return err
	}
	return runFixed(ctx, "systemctl", "enable", "--now", "docker")
}

func (p systemProvisioner) updateDocker(ctx context.Context) error {
	if _, err := exec.LookPath("docker"); err != nil {
		return fmt.Errorf("Docker is not installed")
	}
	if err := runFixed(ctx, "apt-get", "update"); err != nil {
		return err
	}
	if err := runFixed(ctx, "apt-get", "install", "--only-upgrade", "--yes", "docker-ce", "docker-ce-cli", "containerd.io", "docker-buildx-plugin", "docker-compose-plugin"); err != nil {
		return err
	}
	return runFixed(ctx, "systemctl", "enable", "--now", "docker")
}

func (p systemProvisioner) initializeSwarm(ctx context.Context, requested string) error {
	state, err := outputCommand(ctx, "docker", "info", "--format", "{{.Swarm.LocalNodeState}}")
	if err != nil {
		return fmt.Errorf("read Docker Swarm state")
	}
	state = strings.TrimSpace(state)
	if state == "active" {
		return nil
	}
	if state != "inactive" {
		return fmt.Errorf("Docker Swarm state needs operator review")
	}
	address, err := localAdvertiseAddress(requested)
	if err != nil {
		return err
	}
	return runFixed(ctx, "docker", "swarm", "init", "--advertise-addr", address)
}

// joinSwarm makes this host a member of an existing cluster.
//
// It refuses a host that is already in a Swarm rather than leaving one and
// joining another: a node that leaves takes its running tasks with it, and
// that is a decision with data behind it, not a step in a bootstrap.
func (p systemProvisioner) joinSwarm(ctx context.Context, request agentcontrol.ProvisioningRequest) error {
	state, err := outputCommand(ctx, "docker", "info", "--format", "{{.Swarm.LocalNodeState}}")
	if err != nil {
		return fmt.Errorf("read Docker Swarm state")
	}
	switch strings.TrimSpace(state) {
	case "active":
		// Already a member. Joining again would fail, and the operator's
		// intent — this host is in a cluster — already holds.
		return nil
	case "inactive":
	default:
		return fmt.Errorf("Docker Swarm state needs operator review")
	}
	// Validate() has already checked both, but this is the boundary that turns
	// them into a command line, so it checks again rather than trusting that
	// the caller did.
	if err := request.Validate(); err != nil {
		return err
	}
	advertise, err := localAdvertiseAddress(request.AdvertiseAddress)
	if err != nil {
		return err
	}
	return runFixed(ctx, "docker", "swarm", "join",
		"--advertise-addr", advertise,
		"--token", request.JoinToken,
		net.JoinHostPort(strings.TrimSpace(request.JoinAddress), strconv.Itoa(agentcontrol.JoinPort)),
	)
}

// swarmJoinToken reads the credential a new node needs from this manager.
//
// It is served only to the pinned controller over the machine API and is never
// stored here, logged here, or returned by any other route. Docker's own
// `swarm join-token --quiet` is the only source.
func (p systemProvisioner) swarmJoinToken(ctx context.Context, role string) (agentcontrol.SwarmJoinToken, error) {
	if !agentcontrol.ValidJoinRole(role) {
		return agentcontrol.SwarmJoinToken{}, fmt.Errorf("invalid Swarm join role")
	}
	state, err := outputCommand(ctx, "docker", "info", "--format", "{{.Swarm.LocalNodeState}}")
	if err != nil || strings.TrimSpace(state) != "active" {
		return agentcontrol.SwarmJoinToken{}, fmt.Errorf("this machine is not a Swarm manager")
	}
	token, err := outputCommand(ctx, "docker", "swarm", "join-token", "--quiet", role)
	if err != nil {
		return agentcontrol.SwarmJoinToken{}, fmt.Errorf("read Swarm join token")
	}
	address, err := outputCommand(ctx, "docker", "info", "--format", "{{.Swarm.NodeAddr}}")
	if err != nil {
		return agentcontrol.SwarmJoinToken{}, fmt.Errorf("read Swarm advertise address")
	}
	return agentcontrol.SwarmJoinToken{
		Address: strings.TrimSpace(address),
		Role:    role,
		Token:   strings.TrimSpace(token),
	}, nil
}

func (p systemProvisioner) applyUFW(ctx context.Context, request agentcontrol.ProvisioningRequest) error {
	controllers, err := request.NormalizedControllerCIDRs()
	if err != nil {
		return err
	}
	peers, err := request.NormalizedSwarmPeerCIDRs()
	if err != nil {
		return err
	}
	if _, err := exec.LookPath("ufw"); err != nil {
		if err := runFixed(ctx, "apt-get", "update"); err != nil {
			return err
		}
		if err := runFixed(ctx, "apt-get", "install", "--yes", "--no-install-recommends", "ufw"); err != nil {
			return err
		}
	}
	if err := runFixed(ctx, "ufw", "allow", "OpenSSH"); err != nil {
		return err
	}
	port := strconv.FormatUint(uint64(p.agentPort), 10)
	for _, cidr := range controllers {
		if err := runFixed(ctx, "ufw", "allow", "from", cidr, "to", "any", "port", port, "proto", "tcp"); err != nil {
			return err
		}
	}
	for _, cidr := range peers {
		for _, rule := range [][]string{
			{"allow", "from", cidr, "to", "any", "port", "2377", "proto", "tcp"},
			{"allow", "from", cidr, "to", "any", "port", "7946", "proto", "tcp"},
			{"allow", "from", cidr, "to", "any", "port", "7946", "proto", "udp"},
			{"allow", "from", cidr, "to", "any", "port", "4789", "proto", "udp"},
		} {
			if err := runFixed(ctx, "ufw", rule...); err != nil {
				return err
			}
		}
	}
	return runFixed(ctx, "ufw", "--force", "enable")
}

func downloadDockerKey(ctx context.Context, address string) ([]byte, error) {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, address, nil)
	if err != nil {
		return nil, fmt.Errorf("request Docker repository key")
	}
	response, err := (&http.Client{Timeout: 30 * time.Second}).Do(request)
	if err != nil {
		return nil, fmt.Errorf("download Docker repository key")
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("download Docker repository key")
	}
	key, err := io.ReadAll(io.LimitReader(response.Body, 1<<20))
	if err != nil || len(key) < 64 {
		return nil, fmt.Errorf("read Docker repository key")
	}
	return key, nil
}

func writeSystemFile(name string, value []byte, mode os.FileMode) error {
	if info, err := os.Lstat(name); err == nil && !info.Mode().IsRegular() {
		return fmt.Errorf("refuse non-regular system file")
	} else if err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("check system file")
	}
	directory := filepath.Dir(name)
	temporary, err := os.CreateTemp(directory, ".swarmops-agent-*")
	if err != nil {
		return fmt.Errorf("create system file")
	}
	temporaryName := temporary.Name()
	defer os.Remove(temporaryName)
	if err := temporary.Chmod(mode); err != nil {
		_ = temporary.Close()
		return fmt.Errorf("protect system file")
	}
	if _, err := temporary.Write(value); err != nil || temporary.Close() != nil {
		return fmt.Errorf("write system file")
	}
	if err := os.Rename(temporaryName, name); err != nil {
		return fmt.Errorf("install system file")
	}
	return nil
}

func localAdvertiseAddress(requested string) (string, error) {
	if value := strings.TrimSpace(requested); value != "" {
		address, err := netip.ParseAddr(value)
		if err != nil || !address.IsValid() || !localIP(address) {
			return "", fmt.Errorf("Swarm advertise address is not assigned to this machine")
		}
		return address.String(), nil
	}
	interfaces, err := net.Interfaces()
	if err != nil {
		return "", fmt.Errorf("inspect network interfaces")
	}
	candidates := make([]advertiseCandidate, 0, len(interfaces))
	for _, iface := range interfaces {
		if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
			continue
		}
		values, _ := iface.Addrs()
		for _, value := range values {
			prefix, err := netip.ParsePrefix(value.String())
			if err != nil || !prefix.Addr().Is4() || prefix.Addr().IsLoopback() || prefix.Addr().IsUnspecified() {
				continue
			}
			candidates = append(candidates, advertiseCandidate{Interface: iface.Name, Address: prefix.Addr()})
		}
	}
	return chooseAdvertiseAddress(candidates)
}

type advertiseCandidate struct {
	Address   netip.Addr
	Interface string
}

// containerNetworkInterface names the interfaces a container runtime creates.
//
// Their addresses exist on every Docker host and are reachable from nowhere
// else, which makes them the worst possible thing to advertise a Swarm on.
func containerNetworkInterface(name string) bool {
	for _, prefix := range []string{"docker", "br-", "veth", "virbr", "cni", "flannel", "kube-", "cali", "tunl", "nodelocaldns"} {
		if strings.HasPrefix(name, prefix) {
			return true
		}
	}
	return false
}

// chooseAdvertiseAddress picks the address a PEER would use to reach this
// machine.
//
// Two rules, both learned the hard way. First, an interface a container
// runtime made is never the answer: `docker0` is 172.17.0.1 on every Docker
// host on earth, and a cluster advertised on it forms and then cannot talk to
// itself. Second, ordering addresses as TEXT is not ordering them at all —
// "172.17.0.1" sorts before "192.168.1.5", so a host on a 192.168 network
// picked Docker's bridge over its own LAN address and the join hung until it
// timed out. Comparison is on the address bytes, and container interfaces are
// removed before any comparison happens.
func chooseAdvertiseAddress(candidates []advertiseCandidate) (string, error) {
	usable := make([]advertiseCandidate, 0, len(candidates))
	for _, candidate := range candidates {
		if !containerNetworkInterface(candidate.Interface) {
			usable = append(usable, candidate)
		}
	}
	if len(usable) == 0 {
		// Everything this machine has belongs to a container runtime. That is
		// almost certainly wrong, but refusing outright would strand a host
		// whose only interface is named unusually, so the old behaviour stands
		// as the fallback.
		usable = candidates
	}
	if len(usable) == 0 {
		return "", fmt.Errorf("could not determine a local Swarm advertise address")
	}
	sort.Slice(usable, func(left, right int) bool {
		return usable[left].Address.Compare(usable[right].Address) < 0
	})
	return usable[0].Address.String(), nil
}

func localIP(want netip.Addr) bool {
	interfaces, err := net.Interfaces()
	if err != nil {
		return false
	}
	for _, iface := range interfaces {
		addresses, _ := iface.Addrs()
		for _, address := range addresses {
			prefix, err := netip.ParsePrefix(address.String())
			if err == nil && prefix.Addr() == want {
				return true
			}
		}
	}
	return false
}

func runFixed(ctx context.Context, name string, args ...string) error {
	_, err := outputCommand(ctx, name, args...)
	if err != nil {
		return fmt.Errorf("run fixed machine operation")
	}
	return nil
}

func outputCommand(ctx context.Context, name string, args ...string) (string, error) {
	buffer := &boundedProvisionOutput{limit: provisioningOutputLimit}
	command := exec.CommandContext(ctx, name, args...)
	command.Stdout = buffer
	command.Stderr = buffer
	if err := command.Run(); err != nil || buffer.err != nil {
		return "", fmt.Errorf("fixed machine operation did not complete")
	}
	return buffer.String(), nil
}

type boundedProvisionOutput struct {
	buffer bytes.Buffer
	err    error
	limit  int
}

func (b *boundedProvisionOutput) Write(value []byte) (int, error) {
	remaining := b.limit - b.buffer.Len()
	if remaining <= 0 {
		b.err = fmt.Errorf("fixed machine operation output exceeded limit")
		return 0, b.err
	}
	if len(value) > remaining {
		_, _ = b.buffer.Write(value[:remaining])
		b.err = fmt.Errorf("fixed machine operation output exceeded limit")
		return remaining, b.err
	}
	return b.buffer.Write(value)
}

func (b *boundedProvisionOutput) String() string { return b.buffer.String() }

// mergeRegistryMirrors rewrites only the registry-mirrors key of an existing
// daemon.json. It is separate from the host operation so the merge — the part
// that can silently destroy an operator's configuration — is testable without
// a Docker host.
func mergeRegistryMirrors(existing []byte, mirrors []string) ([]byte, error) {
	settings := map[string]any{}
	if len(bytes.TrimSpace(existing)) > 0 {
		if err := json.Unmarshal(existing, &settings); err != nil {
			// Overwriting a file the daemon may be reading, and that this
			// process cannot understand, would be a silent configuration loss.
			return nil, fmt.Errorf("existing Docker daemon configuration needs operator review")
		}
	}
	if len(mirrors) == 0 {
		delete(settings, "registry-mirrors")
	} else {
		settings["registry-mirrors"] = mirrors
	}
	encoded, err := json.MarshalIndent(settings, "", "  ")
	if err != nil {
		return nil, fmt.Errorf("prepare Docker daemon configuration")
	}
	return append(encoded, '\n'), nil
}
