package agentcontrol

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
)

// The operations here extend the fixed vocabulary to the remaining Docker and
// Swarm resources the console manages. Each one is still a closed shape with
// its own validation: there is no free-form argument, no operator-supplied
// flag, and no path through this file that reaches an unlisted Docker command.
const (
	OperationNodeRole         = "node_role"
	OperationNodeLabelAdd     = "node_label_add"
	OperationNodeLabelRemove  = "node_label_remove"
	OperationNodeRemove       = "node_remove"
	OperationServiceImage     = "service_image"
	OperationServiceLimits    = "service_limits"
	OperationServiceRemove    = "service_remove"
	OperationNetworkCreate    = "network_create"
	OperationNetworkRemove    = "network_remove"
	OperationNetworkPrune     = "network_prune"
	OperationVolumeCreate     = "volume_create"
	OperationVolumeRemove     = "volume_remove"
	OperationVolumePrune      = "volume_prune"
	OperationConfigRemove     = "config_remove"
	OperationImagePull        = "image_pull"
	OperationImageRemove      = "image_remove"
	OperationImagePrune       = "image_prune"
	OperationContainerStart   = "container_start"
	OperationContainerStop    = "container_stop"
	OperationContainerRestart = "container_restart"
	OperationContainerRemove  = "container_remove"
	OperationContainerPrune   = "container_prune"
	OperationBuilderPrune     = "builder_prune"
	OperationSwarmTokenRotate = "swarm_token_rotate"
	OperationSwarmUpdate      = "swarm_update"
)

var (
	resourceNamePattern = regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,62}$`)
	imageRefPattern     = regexp.MustCompile(`^[a-z0-9]([a-z0-9._:-]*[a-z0-9])?(/[a-z0-9]([a-z0-9._-]*[a-z0-9])?)*(:[A-Za-z0-9][A-Za-z0-9._-]{0,127})?(@sha256:[a-f0-9]{64})?$`)
	labelKeyPattern     = regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9_./-]{0,62}$`)
	labelValuePattern   = regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9_.:/@ -]{0,127}$`)
	cpuLimitPattern     = regexp.MustCompile(`^(0|[1-9][0-9]?)(\.[0-9]{1,3})?$`)
	memoryLimitPattern  = regexp.MustCompile(`^[1-9][0-9]{0,5}[MG]$`)
)

// resourceArgs renders the argv for every operation added in this file. It
// returns ok=false for an operation it does not own so the caller can keep its
// own switch authoritative.
func resourceArgs(request Request) ([]string, []byte, bool, error) {
	switch request.Operation {
	case OperationNodeRole:
		if !oneOf(request.Role, "promote", "demote") || !validReference(request.ServiceID) {
			return nil, nil, true, fmt.Errorf("invalid node role operation")
		}
		return []string{"node", request.Role, request.ServiceID}, nil, true, nil
	case OperationNodeLabelAdd:
		if !validReference(request.ServiceID) || !labelKeyPattern.MatchString(request.Key) || !labelValuePattern.MatchString(request.Value) {
			return nil, nil, true, fmt.Errorf("invalid node label operation")
		}
		return []string{"node", "update", "--label-add", request.Key + "=" + request.Value, request.ServiceID}, nil, true, nil
	case OperationNodeLabelRemove:
		if !validReference(request.ServiceID) || !labelKeyPattern.MatchString(request.Key) {
			return nil, nil, true, fmt.Errorf("invalid node label removal")
		}
		return []string{"node", "update", "--label-rm", request.Key, request.ServiceID}, nil, true, nil
	case OperationNodeRemove:
		if !validReference(request.ServiceID) {
			return nil, nil, true, fmt.Errorf("invalid node removal")
		}
		return []string{"node", "rm", "--force", request.ServiceID}, nil, true, nil
	case OperationServiceImage:
		if !validReference(request.ServiceID) || !imageRefPattern.MatchString(request.Image) {
			return nil, nil, true, fmt.Errorf("invalid service image operation")
		}
		return []string{"service", "update", "--image", request.Image, request.ServiceID}, nil, true, nil
	case OperationServiceLimits:
		if !validReference(request.ServiceID) || !cpuLimitPattern.MatchString(request.CPULimit) || !memoryLimitPattern.MatchString(request.MemoryLimit) {
			return nil, nil, true, fmt.Errorf("invalid service limit operation")
		}
		return []string{"service", "update", "--limit-cpu", request.CPULimit, "--limit-memory", request.MemoryLimit, request.ServiceID}, nil, true, nil
	case OperationServiceRemove:
		if !validReference(request.ServiceID) {
			return nil, nil, true, fmt.Errorf("invalid service removal")
		}
		return []string{"service", "rm", request.ServiceID}, nil, true, nil
	case OperationNetworkCreate:
		if !resourceNamePattern.MatchString(request.Name) || !oneOf(request.Driver, "overlay", "bridge") {
			return nil, nil, true, fmt.Errorf("invalid network creation")
		}
		args := []string{"network", "create", "--driver", request.Driver}
		if request.Attachable {
			args = append(args, "--attachable")
		}
		if request.Internal {
			args = append(args, "--internal")
		}
		return append(args, request.Name), nil, true, nil
	case OperationNetworkRemove:
		if !resourceNamePattern.MatchString(request.Name) {
			return nil, nil, true, fmt.Errorf("invalid network removal")
		}
		return []string{"network", "rm", request.Name}, nil, true, nil
	case OperationNetworkPrune:
		return []string{"network", "prune", "--force"}, nil, true, nil
	case OperationVolumeCreate:
		if !resourceNamePattern.MatchString(request.Name) {
			return nil, nil, true, fmt.Errorf("invalid volume creation")
		}
		return []string{"volume", "create", "--driver", "local", request.Name}, nil, true, nil
	case OperationVolumeRemove:
		if !resourceNamePattern.MatchString(request.Name) {
			return nil, nil, true, fmt.Errorf("invalid volume removal")
		}
		return []string{"volume", "rm", request.Name}, nil, true, nil
	case OperationVolumePrune:
		return []string{"volume", "prune", "--force"}, nil, true, nil
	case OperationConfigRemove:
		if !resourceNamePattern.MatchString(request.Name) {
			return nil, nil, true, fmt.Errorf("invalid config removal")
		}
		return []string{"config", "rm", request.Name}, nil, true, nil
	case OperationImagePull:
		if !imageRefPattern.MatchString(request.Image) {
			return nil, nil, true, fmt.Errorf("invalid image pull")
		}
		return []string{"image", "pull", request.Image}, nil, true, nil
	case OperationImageRemove:
		if !imageRefPattern.MatchString(request.Image) {
			return nil, nil, true, fmt.Errorf("invalid image removal")
		}
		return []string{"image", "rm", request.Image}, nil, true, nil
	case OperationImagePrune:
		args := []string{"image", "prune", "--force"}
		if request.All {
			args = append(args, "--all")
		}
		return args, nil, true, nil
	case OperationContainerStart, OperationContainerStop, OperationContainerRestart:
		if !validReference(request.ServiceID) {
			return nil, nil, true, fmt.Errorf("invalid container operation")
		}
		return []string{"container", strings.TrimPrefix(request.Operation, "container_"), request.ServiceID}, nil, true, nil
	case OperationContainerRemove:
		if !validReference(request.ServiceID) {
			return nil, nil, true, fmt.Errorf("invalid container removal")
		}
		return []string{"container", "rm", "--force", request.ServiceID}, nil, true, nil
	case OperationContainerPrune:
		return []string{"container", "prune", "--force"}, nil, true, nil
	case OperationBuilderPrune:
		return []string{"builder", "prune", "--force"}, nil, true, nil
	case OperationSwarmTokenRotate:
		// The rotated token is never returned to the controller: the agent
		// answers this operation with a status only, and node enrolment stays
		// an installer workflow.
		if !oneOf(request.Role, "worker", "manager") {
			return nil, nil, true, fmt.Errorf("invalid join-token rotation")
		}
		return []string{"swarm", "join-token", "--rotate", "--quiet", request.Role}, nil, true, nil
	case OperationSwarmUpdate:
		if request.Limit == 0 || request.Limit > 1000 {
			return nil, nil, true, fmt.Errorf("invalid swarm task history limit")
		}
		return []string{"swarm", "update", "--task-history-limit", strconv.FormatUint(request.Limit, 10)}, nil, true, nil
	}
	return nil, nil, false, nil
}

// resourceRequest is the controller-side inverse of resourceArgs. Only the
// exact argv shapes produced above are recognised.
func resourceRequest(args []string, input []byte) (Request, bool, error) {
	if len(input) != 0 {
		return Request{}, false, nil
	}
	switch args[0] {
	case "node":
		switch {
		case len(args) == 3 && oneOf(args[1], "promote", "demote"):
			return Request{Operation: OperationNodeRole, Role: args[1], ServiceID: args[2]}, true, nil
		case len(args) == 5 && args[1] == "update" && args[2] == "--label-add":
			key, value, found := strings.Cut(args[3], "=")
			if !found {
				return Request{}, true, fmt.Errorf("invalid node label operation")
			}
			return Request{Key: key, Operation: OperationNodeLabelAdd, ServiceID: args[4], Value: value}, true, nil
		case len(args) == 5 && args[1] == "update" && args[2] == "--label-rm":
			return Request{Key: args[3], Operation: OperationNodeLabelRemove, ServiceID: args[4]}, true, nil
		case len(args) == 4 && args[1] == "rm" && args[2] == "--force":
			return Request{Operation: OperationNodeRemove, ServiceID: args[3]}, true, nil
		}
	case "service":
		switch {
		case len(args) == 5 && args[1] == "update" && args[2] == "--image":
			return Request{Image: args[3], Operation: OperationServiceImage, ServiceID: args[4]}, true, nil
		case len(args) == 7 && args[1] == "update" && args[2] == "--limit-cpu" && args[4] == "--limit-memory":
			return Request{CPULimit: args[3], MemoryLimit: args[5], Operation: OperationServiceLimits, ServiceID: args[6]}, true, nil
		case len(args) == 3 && args[1] == "rm":
			return Request{Operation: OperationServiceRemove, ServiceID: args[2]}, true, nil
		}
	case "network":
		switch {
		case len(args) >= 5 && args[1] == "create" && args[2] == "--driver":
			request := Request{Driver: args[3], Operation: OperationNetworkCreate}
			for index := 4; index < len(args)-1; index++ {
				switch args[index] {
				case "--attachable":
					request.Attachable = true
				case "--internal":
					request.Internal = true
				default:
					return Request{}, true, fmt.Errorf("unsupported network option")
				}
			}
			request.Name = args[len(args)-1]
			return request, true, nil
		case len(args) == 3 && args[1] == "rm":
			return Request{Name: args[2], Operation: OperationNetworkRemove}, true, nil
		case len(args) == 3 && args[1] == "prune" && args[2] == "--force":
			return Request{Operation: OperationNetworkPrune}, true, nil
		}
	case "volume":
		switch {
		case len(args) == 5 && args[1] == "create" && args[2] == "--driver" && args[3] == "local":
			return Request{Name: args[4], Operation: OperationVolumeCreate}, true, nil
		case len(args) == 3 && args[1] == "rm":
			return Request{Name: args[2], Operation: OperationVolumeRemove}, true, nil
		case len(args) == 3 && args[1] == "prune" && args[2] == "--force":
			return Request{Operation: OperationVolumePrune}, true, nil
		}
	case "config":
		if len(args) == 3 && args[1] == "rm" {
			return Request{Name: args[2], Operation: OperationConfigRemove}, true, nil
		}
	case "image":
		switch {
		case len(args) == 3 && args[1] == "pull":
			return Request{Image: args[2], Operation: OperationImagePull}, true, nil
		case len(args) == 3 && args[1] == "rm":
			return Request{Image: args[2], Operation: OperationImageRemove}, true, nil
		case len(args) >= 3 && args[1] == "prune" && args[2] == "--force":
			request := Request{Operation: OperationImagePrune}
			if len(args) == 4 && args[3] == "--all" {
				request.All = true
			} else if len(args) != 3 {
				return Request{}, true, fmt.Errorf("unsupported image prune option")
			}
			return request, true, nil
		}
	case "container":
		switch {
		case len(args) == 3 && oneOf(args[1], "start", "stop", "restart"):
			return Request{Operation: "container_" + args[1], ServiceID: args[2]}, true, nil
		case len(args) == 4 && args[1] == "rm" && args[2] == "--force":
			return Request{Operation: OperationContainerRemove, ServiceID: args[3]}, true, nil
		case len(args) == 3 && args[1] == "prune" && args[2] == "--force":
			return Request{Operation: OperationContainerPrune}, true, nil
		}
	case "builder":
		if len(args) == 3 && args[1] == "prune" && args[2] == "--force" {
			return Request{Operation: OperationBuilderPrune}, true, nil
		}
	case "swarm":
		switch {
		case len(args) == 5 && args[1] == "join-token" && args[2] == "--rotate" && args[3] == "--quiet":
			return Request{Operation: OperationSwarmTokenRotate, Role: args[4]}, true, nil
		case len(args) == 4 && args[1] == "update" && args[2] == "--task-history-limit":
			limit, err := strconv.ParseUint(args[3], 10, 64)
			if err != nil {
				return Request{}, true, fmt.Errorf("invalid swarm task history limit")
			}
			return Request{Limit: limit, Operation: OperationSwarmUpdate}, true, nil
		}
	}
	return Request{}, false, nil
}
