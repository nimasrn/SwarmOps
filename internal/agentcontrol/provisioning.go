package agentcontrol

import (
	"fmt"
	"net/netip"
	"net/url"
	"sort"
	"strconv"
	"strings"
)

// ProvisionConfirmation is intentionally constant and checked at both the
// controller and machine boundaries. These operations can change packages,
// firewall policy, and Swarm membership, so they are never a background
// consequence of connecting a server.
const ProvisionConfirmation = "PREPARE_SERVER"

// ProvisioningRequest is the closed machine-bootstrap vocabulary. It carries
// no executable, package name, script, URL, file path, or arbitrary firewall
// rule. The machine derives every command from these flags.
type ProvisioningRequest struct {
	AdvertiseAddress string `json:"advertiseAddress,omitempty"`
	// ApplyRegistryMirrors rewrites the daemon's registry-mirror list and
	// restarts Docker. It carries no file path and no daemon.json fragment:
	// the machine owns the file, and this only names the mirrors.
	ApplyRegistryMirrors bool     `json:"applyRegistryMirrors,omitempty"`
	ApplyUFW             bool     `json:"applyUfw,omitempty"`
	Confirmation         string   `json:"confirmation"`
	ControllerCIDRs      []string `json:"controllerCidrs,omitempty"`
	InitializeSwarm      bool     `json:"initializeSwarm,omitempty"`
	InstallDocker        bool     `json:"installDocker,omitempty"`
	// JoinSwarm makes this host a member of an EXISTING Swarm. The token is
	// resolved by the controller at execution time from the manager the
	// operator named, is held only in memory for the length of one call, and
	// is never written to the command ledger, the audit trail, or a browser —
	// see SwarmJoinToken and api/http/commands.go.
	JoinSwarm   bool   `json:"joinSwarm,omitempty"`
	JoinAddress string `json:"joinAddress,omitempty"`
	JoinToken   string `json:"joinToken,omitempty"`
	// RegistryMirrors is the ordered list of pull-through mirrors. An empty
	// list with ApplyRegistryMirrors set is the explicit "go back to Docker
	// Hub" request, so removing a mirror is as reviewable as adding one.
	RegistryMirrors []string `json:"registryMirrors,omitempty"`
	SwarmPeerCIDRs  []string `json:"swarmPeerCidrs,omitempty"`
	UpdateDocker    bool     `json:"updateDocker,omitempty"`
	UpdateOS        bool     `json:"updateOs,omitempty"`
}

// ProvisioningStatus is a deliberately small readiness projection. It lets
// the console render a reviewed plan without exposing host files, command
// output, package lists, or raw firewall rules.
type ProvisioningStatus struct {
	Capabilities ProvisioningCapabilities `json:"capabilities"`
	Docker       ProvisioningDocker       `json:"docker"`
	Firewall     ProvisioningFirewall     `json:"firewall"`
	OS           ProvisioningOS           `json:"os"`
	Swarm        ProvisioningSwarm        `json:"swarm"`
}

type ProvisioningCapabilities struct {
	ApplyRegistryMirrors bool `json:"applyRegistryMirrors"`
	ApplyUFW             bool `json:"applyUfw"`
	InitializeSwarm      bool `json:"initializeSwarm"`
	InstallDocker        bool `json:"installDocker"`
	// JoinSwarm is false for a machine already in a cluster. Leaving one takes
	// its running tasks with it, which is a decision with data behind it and
	// not a step the console should offer as part of a bootstrap.
	JoinSwarm    bool `json:"joinSwarm"`
	UpdateDocker bool `json:"updateDocker"`
	UpdateOS     bool `json:"updateOs"`
}

type ProvisioningDocker struct {
	Installed bool `json:"installed"`
	// RegistryMirrors is what the daemon on this machine reports, not what an
	// operator once asked for. A machine that drifted shows its drift.
	RegistryMirrors []string `json:"registryMirrors,omitempty"`
	Running         bool     `json:"running"`
	Version         string   `json:"version,omitempty"`
}

type ProvisioningFirewall struct {
	Available bool `json:"available"`
	Enabled   bool `json:"enabled"`
}

type ProvisioningOS struct {
	ID        string `json:"id,omitempty"`
	Name      string `json:"name,omitempty"`
	Supported bool   `json:"supported"`
}

type ProvisioningSwarm struct {
	Manager bool   `json:"manager"`
	State   string `json:"state,omitempty"`
}

// Validate is the agent boundary: by the time a request reaches a machine it
// must be complete, join token included.
func (r ProvisioningRequest) Validate() error { return r.validate(true) }

// ValidateWithoutJoinToken is the CONTROLLER boundary, where a join request is
// deliberately incomplete. The token is resolved from the manager at execution
// time so it never enters the sealed command ledger, which means the request
// an operator submits cannot carry one and cannot be checked for one.
func (r ProvisioningRequest) ValidateWithoutJoinToken() error { return r.validate(false) }

func (r ProvisioningRequest) validate(requireJoinToken bool) error {
	if strings.TrimSpace(r.Confirmation) != ProvisionConfirmation {
		return fmt.Errorf("server readiness requires confirmation %s", ProvisionConfirmation)
	}
	if !r.UpdateOS && !r.InstallDocker && !r.UpdateDocker && !r.InitializeSwarm && !r.JoinSwarm && !r.ApplyUFW && !r.ApplyRegistryMirrors {
		return fmt.Errorf("select at least one server readiness operation")
	}
	if r.InstallDocker && r.UpdateDocker {
		return fmt.Errorf("choose Docker installation or update, not both")
	}
	// Forming a new cluster and joining an existing one are opposite acts, and
	// a host that did both would silently abandon whichever ran first.
	if r.InitializeSwarm && r.JoinSwarm {
		return fmt.Errorf("choose Swarm initialization or joining an existing Swarm, not both")
	}
	if r.JoinSwarm {
		if requireJoinToken {
			if err := validateJoinAddress(r.JoinAddress); err != nil {
				return err
			}
			if !validJoinToken(r.JoinToken) {
				return fmt.Errorf("a Swarm join token is required")
			}
		} else if strings.TrimSpace(r.JoinToken) != "" {
			return fmt.Errorf("a Swarm join token is never accepted from a request")
		}
	} else if strings.TrimSpace(r.JoinAddress) != "" || strings.TrimSpace(r.JoinToken) != "" {
		return fmt.Errorf("join details require the Swarm join operation")
	}
	if address := strings.TrimSpace(r.AdvertiseAddress); address != "" {
		parsed, err := netip.ParseAddr(address)
		if err != nil || !parsed.IsValid() || parsed.IsLoopback() || parsed.IsUnspecified() || parsed.IsMulticast() {
			return fmt.Errorf("invalid Swarm advertise address")
		}
	}
	if r.ApplyUFW {
		if _, err := normalizedCIDRs(r.ControllerCIDRs, "controller"); err != nil {
			return err
		}
		if _, err := normalizedCIDRs(r.SwarmPeerCIDRs, "Swarm peer"); err != nil {
			return err
		}
	} else if len(r.ControllerCIDRs) != 0 || len(r.SwarmPeerCIDRs) != 0 {
		return fmt.Errorf("firewall networks require the UFW operation")
	}
	if r.ApplyRegistryMirrors {
		if _, err := r.NormalizedRegistryMirrors(); err != nil {
			return err
		}
	} else if len(r.RegistryMirrors) != 0 {
		return fmt.Errorf("image mirrors require the registry mirror operation")
	}
	return nil
}

// NormalizedRegistryMirrors returns the validated mirror list an executor may
// write. Each entry is reduced to scheme://host[:port] so nothing that reaches
// daemon.json can carry a path, a query, or credentials, and the order the
// operator chose is preserved because Docker tries mirrors in order.
func (r ProvisioningRequest) NormalizedRegistryMirrors() ([]string, error) {
	if len(r.RegistryMirrors) > 4 {
		return nil, fmt.Errorf("provide at most 4 image mirrors")
	}
	seen := map[string]bool{}
	result := make([]string, 0, len(r.RegistryMirrors))
	for _, value := range r.RegistryMirrors {
		mirror, err := normalizedRegistryMirror(value)
		if err != nil {
			return nil, err
		}
		if seen[mirror] {
			return nil, fmt.Errorf("duplicate image mirror %s", mirror)
		}
		seen[mirror] = true
		result = append(result, mirror)
	}
	return result, nil
}

func normalizedRegistryMirror(value string) (string, error) {
	raw := strings.TrimSpace(value)
	if raw == "" {
		return "", fmt.Errorf("an image mirror URL is required")
	}
	if len(raw) > 253 {
		return "", fmt.Errorf("image mirror URL is too long")
	}
	// A bare host is the shape operators type. Defaulting it to HTTPS keeps
	// the daemon from being pointed at a plaintext registry by a typo.
	if !strings.Contains(raw, "://") {
		raw = "https://" + raw
	}
	parsed, err := url.Parse(raw)
	if err != nil || (parsed.Scheme != "https" && parsed.Scheme != "http") {
		return "", fmt.Errorf("an image mirror must be an http or https URL")
	}
	if parsed.User != nil {
		return "", fmt.Errorf("an image mirror URL must not carry credentials")
	}
	if strings.Trim(parsed.Path, "/") != "" || parsed.RawQuery != "" || parsed.Fragment != "" {
		return "", fmt.Errorf("an image mirror must be a registry host, without a path")
	}
	host := parsed.Hostname()
	if host == "" || strings.ContainsAny(host, " \t/\\") {
		return "", fmt.Errorf("invalid image mirror host")
	}
	if port := parsed.Port(); port != "" {
		number, convErr := strconv.Atoi(port)
		if convErr != nil || number < 1 || number > 65535 {
			return "", fmt.Errorf("invalid image mirror port")
		}
	}
	return parsed.Scheme + "://" + parsed.Host, nil
}

// JoinPort is Swarm's fixed cluster-management port. It is a constant rather
// than a parameter so a join can never be pointed at an arbitrary service.
const JoinPort = 2377

// validateJoinAddress accepts a literal IP only. A hostname would make the
// join target depend on whatever DNS the machine happens to be using, which
// is not a decision an operator can review.
func validateJoinAddress(value string) error {
	address := strings.TrimSpace(value)
	if address == "" {
		return fmt.Errorf("a Swarm manager address is required to join")
	}
	parsed, err := netip.ParseAddr(address)
	if err != nil || !parsed.IsValid() || parsed.IsLoopback() || parsed.IsUnspecified() || parsed.IsMulticast() {
		return fmt.Errorf("invalid Swarm manager address")
	}
	return nil
}

// A Swarm join token is `SWMTKN-1-<secret>-<secret>`. Checking its shape keeps
// anything that is not a token — an argument, a path, a flag — out of the
// command line the agent builds.
func validJoinToken(value string) bool {
	token := strings.TrimSpace(value)
	if len(token) < 24 || len(token) > 256 || !strings.HasPrefix(token, "SWMTKN-") {
		return false
	}
	return strings.IndexFunc(token, func(r rune) bool {
		return !(r >= 'a' && r <= 'z' || r >= 'A' && r <= 'Z' || r >= '0' && r <= '9' || r == '-')
	}) < 0
}

// SwarmJoinToken is what a manager returns when the controller asks it for the
// credential a new node needs. It is a response type, never a stored one.
type SwarmJoinToken struct {
	Address string `json:"address"`
	Role    string `json:"role"`
	Token   string `json:"token"`
}

// ValidJoinRole is the closed set of things a node can be asked to join as.
func ValidJoinRole(role string) bool { return role == "manager" || role == "worker" }

// NormalizedControllerCIDRs returns stable, validated CIDRs for an executor.
// The caller cannot turn these into arbitrary UFW arguments because each is
// parsed as an IP prefix before it leaves the typed request boundary.
func (r ProvisioningRequest) NormalizedControllerCIDRs() ([]string, error) {
	return normalizedCIDRs(r.ControllerCIDRs, "controller")
}

func (r ProvisioningRequest) NormalizedSwarmPeerCIDRs() ([]string, error) {
	return normalizedCIDRs(r.SwarmPeerCIDRs, "Swarm peer")
}

func normalizedCIDRs(values []string, label string) ([]string, error) {
	if len(values) == 0 || len(values) > 8 {
		return nil, fmt.Errorf("provide between 1 and 8 %s CIDRs", label)
	}
	seen := map[string]bool{}
	result := make([]string, 0, len(values))
	for _, value := range values {
		prefix, err := netip.ParsePrefix(strings.TrimSpace(value))
		if err != nil || !prefix.IsValid() || prefix.Addr().IsLoopback() || prefix.Addr().IsUnspecified() || prefix.Addr().IsMulticast() {
			return nil, fmt.Errorf("invalid %s CIDR", label)
		}
		normalized := prefix.Masked().String()
		if seen[normalized] {
			return nil, fmt.Errorf("duplicate %s CIDR", label)
		}
		seen[normalized] = true
		result = append(result, normalized)
	}
	sort.Strings(result)
	return result, nil
}
