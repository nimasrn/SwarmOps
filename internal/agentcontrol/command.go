// Package agentcontrol defines the small, fixed command vocabulary accepted by
// a machine-side SwarmOps agent. It intentionally has no generic command or
// Docker-socket forwarding operation.
package agentcontrol

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"

	"golang.org/x/crypto/bcrypt"
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
	OperationSecretRemove     = "secret_remove"
	OperationConfigCreate     = "config_create"
	OperationConfigList       = "config_list"
)

// CommandFailureCode is the allow-listed diagnostic vocabulary a machine
// agent may return for a failed bounded Docker operation. Raw Docker output is
// never returned to Core: it can contain registry, image, or host detail that
// does not belong in controller state or a browser.
const (
	CommandFailureConfigMissing    = "docker_external_config_missing"
	CommandFailureImageUnavailable = "docker_image_unavailable"
	CommandFailureNetworkMissing   = "docker_external_network_missing"
	CommandFailureOutputLimit      = "docker_command_output_limit"
	CommandFailurePlacement        = "docker_placement_unsatisfied"
	CommandFailurePortUnavailable  = "docker_port_unavailable"
	CommandFailureSecretMissing    = "docker_external_secret_missing"
	CommandFailureStackDeploy      = "docker_stack_deploy_failed"
	CommandFailureTimedOut         = "docker_command_timed_out"
	CommandFailureUnknown          = "docker_operation_failed"
)

// CommandResponse is the fixed machine-command response envelope. FailureCode
// is accepted only when ValidCommandFailureCode recognizes it.
type CommandResponse struct {
	FailureCode string `json:"failureCode,omitempty"`
	Output      string `json:"output,omitempty"`
	Status      string `json:"status,omitempty"`
}

func ValidCommandFailureCode(code string) bool {
	switch code {
	case CommandFailureConfigMissing,
		CommandFailureImageUnavailable,
		CommandFailureNetworkMissing,
		CommandFailureOutputLimit,
		CommandFailurePlacement,
		CommandFailurePortUnavailable,
		CommandFailureSecretMissing,
		CommandFailureStackDeploy,
		CommandFailureTimedOut,
		CommandFailureUnknown:
		return true
	default:
		return false
	}
}

// MaxSecretBytes bounds the generated credential a managed stateful stack
// needs. It is deliberately small: this operation exists to create SwarmOps'
// own generated passwords, not to ship arbitrary operator material.
const MaxSecretBytes = 512

var (
	referencePattern = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$`)
	stackNamePattern = regexp.MustCompile(`^[a-z0-9][a-z0-9_-]{0,62}$`)
	// Only SwarmOps' own generated credentials may be created through this
	// vocabulary, so the name is confined to the swarmops_ prefix.
	managedSecretPattern = regexp.MustCompile(`^(swarmops_[a-z0-9][a-z0-9_]{0,54}|traefik_dns_[a-z0-9][a-z0-9_]{0,72}_v[1-9][0-9]*|traefik_dashboard_auth_v[1-9][0-9]*)$`)
	removableDNSSecret   = regexp.MustCompile(`^traefik_dns_(cloudflare|arvan)_[a-z0-9][a-z0-9_]{0,62}_v[1-9][0-9]*$`)
	managedConfigPattern = regexp.MustCompile(`^(swarmops_traefik_static_v1_[a-f0-9]{16}|nim_traefik_dynamic_v[1-9][0-9]*)$`)
	secretValuePattern   = regexp.MustCompile(`^[A-Za-z0-9+/=_.:@?&-]{16,512}$`)
	dashboardAuthPattern = regexp.MustCompile(`^operator:\$2[aby]\$[0-9]{2}\$[./A-Za-z0-9]{53}$`)
)

// Request is intentionally structured rather than an argv pass-through. The
// agent validates it again before it invokes the local Docker CLI.
type Request struct {
	All                 bool   `json:"all,omitempty"`
	Attachable          bool   `json:"attachable,omitempty"`
	Availability        string `json:"availability,omitempty"`
	CPULimit            string `json:"cpuLimit,omitempty"`
	Driver              string `json:"driver,omitempty"`
	Encrypted           bool   `json:"encrypted,omitempty"`
	Image               string `json:"image,omitempty"`
	Internal            bool   `json:"internal,omitempty"`
	Key                 string `json:"key,omitempty"`
	Limit               uint64 `json:"limit,omitempty"`
	MemoryLimit         string `json:"memoryLimit,omitempty"`
	Role                string `json:"role,omitempty"`
	Value               string `json:"value,omitempty"`
	Compose             string `json:"compose,omitempty"`
	Config              string `json:"config,omitempty"`
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

	if request, owned, err := resourceRequest(args, input); owned {
		return request, err
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
	case "config":
		return configRequest(args, input)
	}
	return Request{}, fmt.Errorf("unsupported agent Docker operation")
}

func configRequest(args []string, input []byte) (Request, error) {
	if len(args) == 4 && args[1] == "create" && args[3] == "-" {
		return Request{Config: string(input), Name: args[2], Operation: OperationConfigCreate}, nil
	}
	if len(args) == 4 && args[1] == "ls" && args[2] == "--format" && args[3] == "{{.Name}}" && len(input) == 0 {
		return Request{Operation: OperationConfigList}, nil
	}
	return Request{}, fmt.Errorf("unsupported agent config operation")
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

// secretRequest covers only immutable SwarmOps secret creation/listing and the
// separately confirmed removal of an old Traefik DNS credential version.
func secretRequest(args []string, input []byte) (Request, error) {
	if len(args) == 4 && args[1] == "create" && args[3] == "-" {
		return Request{Name: args[2], Operation: OperationSecretCreate, Secret: string(input)}, nil
	}
	if len(args) == 4 && args[1] == "ls" && args[2] == "--format" && args[3] == "{{.Name}}" && len(input) == 0 {
		return Request{Operation: OperationSecretList}, nil
	}
	if len(args) == 3 && args[1] == "rm" && len(input) == 0 {
		return Request{Name: args[2], Operation: OperationSecretRemove}, nil
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
		validValue := secretValuePattern.MatchString(request.Secret)
		if strings.HasPrefix(request.Name, "traefik_dashboard_auth_v") {
			_, hash, found := strings.Cut(request.Secret, ":")
			cost, err := bcrypt.Cost([]byte(hash))
			validValue = found && dashboardAuthPattern.MatchString(request.Secret) && err == nil && cost >= bcrypt.MinCost
		}
		if !managedSecretPattern.MatchString(request.Name) || !validValue {
			return nil, nil, fmt.Errorf("invalid managed secret operation")
		}
		return []string{"secret", "create", request.Name, "-"}, []byte(request.Secret), nil
	case OperationSecretList:
		return []string{"secret", "ls", "--format", "{{.Name}}"}, nil, nil
	case OperationSecretRemove:
		if !removableDNSSecret.MatchString(request.Name) {
			return nil, nil, fmt.Errorf("invalid removable DNS secret")
		}
		return []string{"secret", "rm", request.Name}, nil, nil
	case OperationConfigCreate:
		if !managedConfigPattern.MatchString(request.Name) || request.Config == "" || len(request.Config) > 64<<10 || strings.ContainsRune(request.Config, 0) {
			return nil, nil, fmt.Errorf("invalid managed config operation")
		}
		return []string{"config", "create", request.Name, "-"}, []byte(request.Config), nil
	case OperationConfigList:
		return []string{"config", "ls", "--format", "{{.Name}}"}, nil, nil
	case OperationStackRemove:
		// Stack removal is no longer confined to the platform's own stacks:
		// the console deletes operator stacks too. The name is still a strict
		// pattern, and the audited command ledger remains the gate.
		if !stackNamePattern.MatchString(request.Name) {
			return nil, nil, fmt.Errorf("invalid stack name")
		}
		return []string{"stack", "rm", request.Name}, nil, nil
	default:
		args, input, owned, err := resourceArgs(request)
		if !owned {
			return nil, nil, fmt.Errorf("unsupported agent operation")
		}
		return args, input, err
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
