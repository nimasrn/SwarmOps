package agentcontrol

import (
	"fmt"
	"net/netip"
	"sort"
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
	AdvertiseAddress string   `json:"advertiseAddress,omitempty"`
	ApplyUFW         bool     `json:"applyUfw,omitempty"`
	Confirmation     string   `json:"confirmation"`
	ControllerCIDRs  []string `json:"controllerCidrs,omitempty"`
	InitializeSwarm  bool     `json:"initializeSwarm,omitempty"`
	InstallDocker    bool     `json:"installDocker,omitempty"`
	SwarmPeerCIDRs   []string `json:"swarmPeerCidrs,omitempty"`
	UpdateDocker     bool     `json:"updateDocker,omitempty"`
	UpdateOS         bool     `json:"updateOs,omitempty"`
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
	ApplyUFW        bool `json:"applyUfw"`
	InitializeSwarm bool `json:"initializeSwarm"`
	InstallDocker   bool `json:"installDocker"`
	UpdateDocker    bool `json:"updateDocker"`
	UpdateOS        bool `json:"updateOs"`
}

type ProvisioningDocker struct {
	Installed bool   `json:"installed"`
	Running   bool   `json:"running"`
	Version   string `json:"version,omitempty"`
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

func (r ProvisioningRequest) Validate() error {
	if strings.TrimSpace(r.Confirmation) != ProvisionConfirmation {
		return fmt.Errorf("server readiness requires confirmation %s", ProvisionConfirmation)
	}
	if !r.UpdateOS && !r.InstallDocker && !r.UpdateDocker && !r.InitializeSwarm && !r.ApplyUFW {
		return fmt.Errorf("select at least one server readiness operation")
	}
	if r.InstallDocker && r.UpdateDocker {
		return fmt.Errorf("choose Docker installation or update, not both")
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
	return nil
}

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
