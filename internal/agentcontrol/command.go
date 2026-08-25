// Package agentcontrol defines the small, fixed command vocabulary accepted by
// a machine-side SwarmOps agent. It intentionally has no generic command or
// Docker-socket forwarding operation.
package agentcontrol

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
)

const MaxComposeBytes = 1 << 20

const (
	OperationNodeAvailability = "node_availability"
	OperationServiceRestart   = "service_restart"
	OperationServiceRollback  = "service_rollback"
	OperationServiceScale     = "service_scale"
	OperationServiceLogs      = "service_logs"
	OperationStackConfig      = "stack_config"
	OperationStackDeploy      = "stack_deploy"
	OperationStackRemove      = "stack_remove"
	OperationSecretCreate     = "secret_create"
	OperationSecretList       = "secret_list"
)

// MaxSecretBytes bounds the generated credential a managed stateful stack
// needs. It is deliberately small: this operation exists to create SwarmOps'
// own generated passwords, not to ship arbitrary operator material.
const MaxSecretBytes = 512

var (
	referencePattern = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$`)
	stackNamePattern = regexp.MustCompile(`^[a-z0-9][a-z0-9_-]{0,62}$`)
	// Only SwarmOps' own generated credentials may be created through this
	// vocabulary, so the name is confined to the swarmops_ prefix.
	managedSecretPattern = regexp.MustCompile(`^swarmops_[a-z0-9][a-z0-9_]{0,54}$`)
	secretValuePattern   = regexp.MustCompile(`^[A-Za-z0-9+/=_.:@?&-]{16,512}$`)
)

// Request is intentionally structured rather than an argv pass-through. The
// agent validates it again before it invokes the local Docker CLI.
type Request struct {
	Availability        string `json:"availability,omitempty"`
	Compose             string `json:"compose,omitempty"`
	Name                string `json:"name,omitempty"`
	Operation           string `json:"operation"`
	Replicas            uint64 `json:"replicas,omitempty"`
	ResolveImageChanged bool   `json:"resolveImageChanged,omitempty"`
	Secret              string `json:"secret,omitempty"`
	ServiceID           string `json:"serviceId,omitempty"`
	Tail                uint64 `json:"tail,omitempty"`
	WithRegistryAuth    bool   `json:"withRegistryAuth,omitempty"`
}

// FromDockerCLI translates only the command shapes that SwarmOps itself
// produces. It refuses all other commands before they reach the machine API.
func FromDockerCLI(name string, args []string, input []byte) (Request, error) {
	if name != "docker" {
		return Request{}, fmt.Errorf("agent accepts Docker operations only")
	}
	if len(input) > MaxComposeBytes {
		return Request{}, fmt.Errorf("compose input exceeds %d bytes", MaxComposeBytes)
	}
	if len(args) == 0 {
		return Request{}, fmt.Errorf("agent command is required")
	}

	switch args[0] {
	case "node":
		if len(input) == 0 && len(args) == 5 && args[1] == "update" && args[2] == "--availability" {
			return Request{Availability: args[3], Operation: OperationNodeAvailability, ServiceID: args[4]}, nil
		}
	case "service":
		return serviceRequest(args, input)
	case "stack":
		return stackRequest(args, input)
	case "secret":
		return secretRequest(args, input)
	}
	return Request{}, fmt.Errorf("unsupported agent Docker operation")
}

func serviceRequest(args []string, input []byte) (Request, error) {
	if len(input) != 0 {
		return Request{}, fmt.Errorf("service operations do not accept input")
	}
	switch {
	case len(args) == 4 && args[1] == "update" && args[2] == "--force":
		return Request{Operation: OperationServiceRestart, ServiceID: args[3]}, nil
	case len(args) == 3 && args[1] == "rollback":
		return Request{Operation: OperationServiceRollback, ServiceID: args[2]}, nil
	case len(args) == 3 && args[1] == "scale":
		service, replicas, found := strings.Cut(args[2], "=")
		if !found {
			return Request{}, fmt.Errorf("invalid service scale operation")
		}
		count, err := strconv.ParseUint(replicas, 10, 64)
		if err != nil {
			return Request{}, fmt.Errorf("invalid service replica count")
		}
		return Request{Operation: OperationServiceScale, Replicas: count, ServiceID: service}, nil
	case len(args) == 7 && args[1] == "logs" && args[2] == "--raw" && args[3] == "--timestamps" && args[4] == "--tail":
		tail, err := strconv.ParseUint(args[5], 10, 64)
		if err != nil {
			return Request{}, fmt.Errorf("invalid service log tail")
		}
		return Request{Operation: OperationServiceLogs, ServiceID: args[6], Tail: tail}, nil
	default:
		return Request{}, fmt.Errorf("unsupported agent service operation")
	}
}

// secretRequest covers only the two shapes SwarmOps produces when it ensures a
// managed stateful stack has its generated password: list the existing secret
// names, and create one missing secret from stdin.
func secretRequest(args []string, input []byte) (Request, error) {
	if len(args) == 4 && args[1] == "create" && args[3] == "-" {
		return Request{Name: args[2], Operation: OperationSecretCreate, Secret: string(input)}, nil
	}
	if len(args) == 4 && args[1] == "ls" && args[2] == "--format" && args[3] == "{{.Name}}" && len(input) == 0 {
		return Request{Operation: OperationSecretList}, nil
	}
	return Request{}, fmt.Errorf("unsupported agent secret operation")
}

func stackRequest(args []string, input []byte) (Request, error) {
	if len(args) == 4 && args[1] == "config" && args[2] == "--compose-file" && args[3] == "-" {
		return Request{Compose: string(input), Operation: OperationStackConfig}, nil
	}
	if len(args) == 3 && args[1] == "rm" && len(input) == 0 {
		return Request{Name: args[2], Operation: OperationStackRemove}, nil
	}
	if len(args) < 6 || args[1] != "deploy" || args[2] != "--detach=false" {
		return Request{}, fmt.Errorf("unsupported agent stack operation")
	}
	request := Request{Compose: string(input), Operation: OperationStackDeploy}
	for index := 3; index < len(args); index++ {
		switch args[index] {
		case "--resolve-image=changed":
			if request.ResolveImageChanged {
				return Request{}, fmt.Errorf("duplicate stack resolve-image option")
			}
			request.ResolveImageChanged = true
		case "--with-registry-auth":
			if request.WithRegistryAuth {
				return Request{}, fmt.Errorf("duplicate stack registry-auth option")
			}
			request.WithRegistryAuth = true
		case "--compose-file":
			if index+2 != len(args)-1 || args[index+1] != "-" {
				return Request{}, fmt.Errorf("stack deploy requires compose stdin and one stack name")
			}
			request.Name = args[index+2]
			index = len(args)
		default:
			return Request{}, fmt.Errorf("unsupported agent stack option")
		}
	}
	if request.Name == "" {
		return Request{}, fmt.Errorf("stack deploy requires a stack name")
	}
	return request, nil
}

// DockerArgs checks a structured request and returns the exact local Docker
// argv plus its optional Compose stdin. The agent calls this independently of
// the controller-side conversion above.
func DockerArgs(request Request) ([]string, []byte, error) {
	switch request.Operation {
	case OperationNodeAvailability:
		if !oneOf(request.Availability, "active", "pause", "drain") || !validReference(request.ServiceID) {
			return nil, nil, fmt.Errorf("invalid node availability operation")
		}
		return []string{"node", "update", "--availability", request.Availability, request.ServiceID}, nil, nil
	case OperationServiceRestart:
		if !validReference(request.ServiceID) {
			return nil, nil, fmt.Errorf("invalid service restart operation")
		}
		return []string{"service", "update", "--force", request.ServiceID}, nil, nil
	case OperationServiceRollback:
		if !validReference(request.ServiceID) {
			return nil, nil, fmt.Errorf("invalid service rollback operation")
		}
		return []string{"service", "rollback", request.ServiceID}, nil, nil
	case OperationServiceScale:
		if !validReference(request.ServiceID) || request.Replicas > 1000 {
			return nil, nil, fmt.Errorf("invalid service scale operation")
		}
		return []string{"service", "scale", fmt.Sprintf("%s=%d", request.ServiceID, request.Replicas)}, nil, nil
	case OperationServiceLogs:
		if !validReference(request.ServiceID) || request.Tail == 0 || request.Tail > 1000 {
			return nil, nil, fmt.Errorf("invalid service logs operation")
		}
		return []string{"service", "logs", "--raw", "--timestamps", "--tail", strconv.FormatUint(request.Tail, 10), request.ServiceID}, nil, nil
	case OperationStackConfig:
		compose, err := validCompose(request.Compose)
		if err != nil {
			return nil, nil, err
		}
		return []string{"stack", "config", "--compose-file", "-"}, compose, nil
	case OperationStackDeploy:
		compose, err := validCompose(request.Compose)
		if err != nil || !stackNamePattern.MatchString(request.Name) {
			if err != nil {
				return nil, nil, err
			}
			return nil, nil, fmt.Errorf("invalid stack name")
		}
		args := []string{"stack", "deploy", "--detach=false"}
		if request.ResolveImageChanged {
			args = append(args, "--resolve-image=changed")
		}
		if request.WithRegistryAuth {
			args = append(args, "--with-registry-auth")
		}
		args = append(args, "--compose-file", "-", request.Name)
		return args, compose, nil
	case OperationSecretCreate:
		if !managedSecretPattern.MatchString(request.Name) || !secretValuePattern.MatchString(request.Secret) {
			return nil, nil, fmt.Errorf("invalid managed secret operation")
		}
		return []string{"secret", "create", request.Name, "-"}, []byte(request.Secret), nil
	case OperationSecretList:
		return []string{"secret", "ls", "--format", "{{.Name}}"}, nil, nil
	case OperationStackRemove:
		if !oneOf(request.Name, "swarmops-agent", "swarmops-logs", "swarmops-observability", "swarmops-postgres", "swarmops-mongo", "swarmops-redis") {
			return nil, nil, fmt.Errorf("unsupported stack removal")
		}
		return []string{"stack", "rm", request.Name}, nil, nil
	default:
		return nil, nil, fmt.Errorf("unsupported agent operation")
	}
}

func validCompose(value string) ([]byte, error) {
	if value == "" || len(value) > MaxComposeBytes {
		return nil, fmt.Errorf("invalid compose input")
	}
	return []byte(value), nil
}

func validReference(value string) bool {
	return referencePattern.MatchString(value)
}

func oneOf(value string, choices ...string) bool {
	for _, choice := range choices {
		if value == choice {
			return true
		}
	}
	return false
}
