package agentcontrol

import (
	"fmt"
	"net"
	"net/netip"
	"regexp"
	"strconv"
	"strings"
)

const (
	BootstrapDockerInstall = "docker_install"
	BootstrapSwarmInit     = "swarm_init"
	BootstrapSwarmJoin     = "swarm_join"
)

var (
	bootstrapHostPattern  = regexp.MustCompile(`^[A-Za-z0-9](?:[A-Za-z0-9.-]{0,251}[A-Za-z0-9])?$`)
	swarmJoinTokenPattern = regexp.MustCompile(`^SWMTKN-1-[a-z0-9]{8,128}-[a-z0-9]{8,256}$`)
)

// BootstrapRequest is the intentionally tiny host-preparation vocabulary. It
// accepts no executable, package name, repository, shell fragment, or file
// path. The one-time enrollment exchange must have completed before the agent
// will accept it.
type BootstrapRequest struct {
	Action        string `json:"action"`
	AdvertiseAddr string `json:"advertiseAddr,omitempty"`
	JoinToken     string `json:"joinToken,omitempty"`
	ManagerAddr   string `json:"managerAddr,omitempty"`
}

func ValidateBootstrapRequest(request BootstrapRequest) error {
	request.Action = strings.TrimSpace(request.Action)
	switch request.Action {
	case BootstrapDockerInstall:
		if request.AdvertiseAddr != "" || request.JoinToken != "" || request.ManagerAddr != "" {
			return fmt.Errorf("Docker installation does not accept Swarm settings")
		}
		return nil
	case BootstrapSwarmInit:
		if request.JoinToken != "" || request.ManagerAddr != "" || !validBootstrapHost(request.AdvertiseAddr) {
			return fmt.Errorf("Swarm initialization requires one valid advertise address")
		}
		return nil
	case BootstrapSwarmJoin:
		if request.AdvertiseAddr != "" || !ValidSwarmJoinToken(request.JoinToken) || !validManagerAddress(request.ManagerAddr) {
			return fmt.Errorf("Swarm join requires a valid manager address and join token")
		}
		return nil
	default:
		return fmt.Errorf("unsupported managed bootstrap action")
	}
}

// ValidSwarmJoinToken validates the opaque token returned by Docker's fixed
// `swarm join-token -q manager` operation. It is exported so the agent can
// reject malformed Docker output before it is handed to another enrolled
// agent; it does not make the token available to browser callers.
func ValidSwarmJoinToken(value string) bool {
	return swarmJoinTokenPattern.MatchString(strings.TrimSpace(value))
}

func validBootstrapHost(value string) bool {
	value = strings.TrimSpace(value)
	if value == "" || len(value) > 253 || strings.ContainsAny(value, "/\\\r\n\x00") {
		return false
	}
	if _, err := netip.ParseAddr(strings.Trim(value, "[]")); err == nil {
		return true
	}
	return bootstrapHostPattern.MatchString(value)
}

func validManagerAddress(value string) bool {
	value = strings.TrimSpace(value)
	if value == "" || len(value) > 320 || strings.ContainsAny(value, "/\\\r\n\x00") {
		return false
	}
	host, port, err := net.SplitHostPort(value)
	if err != nil || !validBootstrapHost(host) {
		return false
	}
	parsed, err := strconv.ParseUint(port, 10, 16)
	return err == nil && parsed > 0
}
