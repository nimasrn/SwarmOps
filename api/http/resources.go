package apihttp

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/nimasrn/SwarmOps/internal/auth"
	"github.com/nimasrn/SwarmOps/internal/ops"
)

// This file carries the rest of the Docker and Swarm surface: the read routes
// the console's inventory screens use, and the queued, audited mutations that
// create, change, and delete each resource. Mutations here go through the same
// command ledger as every other write; none of them talks to Docker directly.

const (
	commandNodeRole         = "node.role"
	commandNodeLabel        = "node.label"
	commandNodeRemove       = "node.remove"
	commandServiceImage     = "service.image"
	commandServiceLimits    = "service.limits"
	commandServiceRemove    = "service.remove"
	commandStackRemove      = "stack.remove"
	commandContainerAction  = "container.action"
	commandImagePull        = "image.pull"
	commandImageRemove      = "image.remove"
	commandNetworkCreate    = "network.create"
	commandNetworkRemove    = "network.remove"
	commandVolumeCreate     = "volume.create"
	commandVolumeRemove     = "volume.remove"
	commandConfigRemove     = "config.remove"
	commandPrune            = "prune"
	commandSwarmTokenRotate = "swarm.join-token.rotate"
	commandSwarmUpdate      = "swarm.update"
)

type nodeRoleCommand struct {
	NodeID string `json:"nodeId"`
	Role   string `json:"role"`
}

type nodeLabelCommand struct {
	Key    string `json:"key"`
	NodeID string `json:"nodeId"`
	Value  string `json:"value,omitempty"`
}

type nodeRemoveCommand struct {
	Confirmation string `json:"confirmation"`
	NodeID       string `json:"nodeId"`
}

type serviceImageCommand struct {
	Image     string `json:"image"`
	ServiceID string `json:"serviceId"`
}

type serviceLimitsCommand struct {
	CPUs      string `json:"cpus"`
	Memory    string `json:"memory"`
	ServiceID string `json:"serviceId"`
}

type serviceRemoveCommand struct {
	Confirmation string `json:"confirmation"`
	ServiceID    string `json:"serviceId"`
}

type stackRemoveCommand struct {
	Confirmation string `json:"confirmation"`
	Name         string `json:"name"`
}

type containerActionCommand struct {
	Action       string `json:"action"`
	Confirmation string `json:"confirmation,omitempty"`
	ContainerID  string `json:"containerId"`
}

type imageCommand struct {
	Image string `json:"image"`
}

type networkCreateCommand struct {
	Attachable bool   `json:"attachable,omitempty"`
	Driver     string `json:"driver"`
	Internal   bool   `json:"internal,omitempty"`
	Name       string `json:"name"`
}

type namedRemoveCommand struct {
	Confirmation string `json:"confirmation"`
	Name         string `json:"name"`
}

type pruneCommand struct {
	All          bool   `json:"all,omitempty"`
	Confirmation string `json:"confirmation"`
	Resource     string `json:"resource"`
}

type swarmTokenCommand struct {
	Confirmation string `json:"confirmation"`
	Role         string `json:"role"`
}

type swarmUpdateCommand struct {
	TaskHistoryLimit uint64 `json:"taskHistoryLimit"`
}

func (s *Server) commandCatalogue(response http.ResponseWriter, _ *http.Request, _ auth.Claims) {
	writeJSON(response, http.StatusOK, ops.CommandCatalogue())
}

func (s *Server) insights(response http.ResponseWriter, request *http.Request, _ auth.Claims) {
	target, ok := s.targetFor(response, request)
	if !ok {
		return
	}
	value, err := target.Control.Insights(request.Context())
	if err != nil {
		s.operationError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, value)
}

func (s *Server) events(response http.ResponseWriter, request *http.Request, _ auth.Claims) {
	target, ok := s.targetFor(response, request)
	if !ok {
		return
	}
	minutes, _ := strconv.Atoi(request.URL.Query().Get("minutes"))
	if minutes <= 0 {
		minutes = 60
	}
	value, err := target.Control.Events(request.Context(), time.Duration(minutes)*time.Minute)
	if err != nil {
		s.operationError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, value)
}

func (s *Server) diskUsage(response http.ResponseWriter, request *http.Request, _ auth.Claims) {
	target, ok := s.targetFor(response, request)
	if !ok {
		return
	}
	value, err := target.Control.DiskUsage(request.Context())
	if err != nil {
		s.operationError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, value)
}

func (s *Server) swarm(response http.ResponseWriter, request *http.Request, _ auth.Claims) {
	target, ok := s.targetFor(response, request)
	if !ok {
		return
	}
	value, err := target.Control.Swarm(request.Context())
	if err != nil {
		s.operationError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, value)
}

func (s *Server) containers(response http.ResponseWriter, request *http.Request, _ auth.Claims) {
	target, ok := s.targetFor(response, request)
	if !ok {
		return
	}
	value, err := target.Control.Containers(request.Context(), request.URL.Query().Get("all") != "false")
	if err != nil {
		s.operationError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, value)
}

func (s *Server) container(response http.ResponseWriter, request *http.Request, _ auth.Claims) {
	target, ok := s.targetFor(response, request)
	if !ok {
		return
	}
	value, err := target.Control.Container(request.Context(), request.PathValue("id"))
	if err != nil {
		s.operationError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, value)
}

func (s *Server) containerStats(response http.ResponseWriter, request *http.Request, _ auth.Claims) {
	target, ok := s.targetFor(response, request)
	if !ok {
		return
	}
	value, err := target.Control.ContainerStats(request.Context(), request.PathValue("id"))
	if err != nil {
		s.operationError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, value)
}

func (s *Server) images(response http.ResponseWriter, request *http.Request, _ auth.Claims) {
	target, ok := s.targetFor(response, request)
	if !ok {
		return
	}
	value, err := target.Control.Images(request.Context())
	if err != nil {
		s.operationError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, value)
}

func (s *Server) image(response http.ResponseWriter, request *http.Request, _ auth.Claims) {
	target, ok := s.targetFor(response, request)
	if !ok {
		return
	}
	value, err := target.Control.Image(request.Context(), request.PathValue("id"))
	if err != nil {
		s.operationError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, value)
}

func (s *Server) volumes(response http.ResponseWriter, request *http.Request, _ auth.Claims) {
	target, ok := s.targetFor(response, request)
	if !ok {
		return
	}
	value, err := target.Control.Volumes(request.Context())
	if err != nil {
		s.operationError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, value)
}

func (s *Server) volume(response http.ResponseWriter, request *http.Request, _ auth.Claims) {
	target, ok := s.targetFor(response, request)
	if !ok {
		return
	}
	value, err := target.Control.Volume(request.Context(), request.PathValue("name"))
	if err != nil {
		s.operationError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, value)
}

func (s *Server) networks(response http.ResponseWriter, request *http.Request, _ auth.Claims) {
	target, ok := s.targetFor(response, request)
	if !ok {
		return
	}
	value, err := target.Control.Networks(request.Context())
	if err != nil {
		s.operationError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, value)
}

func (s *Server) network(response http.ResponseWriter, request *http.Request, _ auth.Claims) {
	target, ok := s.targetFor(response, request)
	if !ok {
		return
	}
	value, err := target.Control.Network(request.Context(), request.PathValue("id"))
	if err != nil {
		s.operationError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, value)
}

func (s *Server) secrets(response http.ResponseWriter, request *http.Request, _ auth.Claims) {
	target, ok := s.targetFor(response, request)
	if !ok {
		return
	}
	value, err := target.Control.Secrets(request.Context())
	if err != nil {
		s.operationError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, value)
}

func (s *Server) configs(response http.ResponseWriter, request *http.Request, _ auth.Claims) {
	target, ok := s.targetFor(response, request)
	if !ok {
		return
	}
	value, err := target.Control.Configs(request.Context())
	if err != nil {
		s.operationError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, value)
}

func (s *Server) serviceDetail(response http.ResponseWriter, request *http.Request, _ auth.Claims) {
	target, ok := s.targetFor(response, request)
	if !ok {
		return
	}
	value, err := target.Control.ServiceDetail(request.Context(), request.PathValue("id"))
	if err != nil {
		s.operationError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, value)
}

func (s *Server) task(response http.ResponseWriter, request *http.Request, _ auth.Claims) {
	target, ok := s.targetFor(response, request)
	if !ok {
		return
	}
	value, err := target.Control.Task(request.Context(), request.PathValue("id"))
	if err != nil {
		s.operationError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, value)
}

func (s *Server) nodeRole(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
	var input struct {
		Role string `json:"role"`
	}
	if !decodeJSON(response, request, &input) {
		return
	}
	if !oneOf(input.Role, "promote", "demote") {
		writeError(response, http.StatusUnprocessableEntity, "Node role must be promote or demote")
		return
	}
	nodeID := request.PathValue("id")
	s.submitCommand(response, request, claims, commandNodeRole, "node/"+nodeID, nodeRoleCommand{NodeID: nodeID, Role: input.Role}, true)
}

func (s *Server) nodeLabel(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
	var input struct {
		Key   string `json:"key"`
		Value string `json:"value"`
	}
	if !decodeJSON(response, request, &input) {
		return
	}
	if strings.TrimSpace(input.Key) == "" {
		writeError(response, http.StatusUnprocessableEntity, "A label key is required")
		return
	}
	nodeID := request.PathValue("id")
	s.submitCommand(response, request, claims, commandNodeLabel, "node/"+nodeID, nodeLabelCommand{Key: input.Key, NodeID: nodeID, Value: input.Value}, true)
}

func (s *Server) nodeRemove(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
	var input struct {
		Confirmation string `json:"confirmation"`
	}
	if !decodeJSON(response, request, &input) {
		return
	}
	nodeID := request.PathValue("id")
	if input.Confirmation != ops.NodeRemovalConfirmation(nodeID) {
		writeError(response, http.StatusUnprocessableEntity, "removal requires confirmation "+ops.NodeRemovalConfirmation(nodeID))
		return
	}
	s.submitCommand(response, request, claims, commandNodeRemove, "node/"+nodeID, nodeRemoveCommand{Confirmation: input.Confirmation, NodeID: nodeID}, false)
}

func (s *Server) serviceImage(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
	var input struct {
		Image string `json:"image"`
	}
	if !decodeJSON(response, request, &input) {
		return
	}
	serviceID := request.PathValue("id")
	s.submitCommand(response, request, claims, commandServiceImage, "service/"+serviceID, serviceImageCommand{Image: strings.TrimSpace(input.Image), ServiceID: serviceID}, true)
}

func (s *Server) serviceLimits(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
	var input struct {
		CPUs   string `json:"cpus"`
		Memory string `json:"memory"`
	}
	if !decodeJSON(response, request, &input) {
		return
	}
	serviceID := request.PathValue("id")
	s.submitCommand(response, request, claims, commandServiceLimits, "service/"+serviceID, serviceLimitsCommand{CPUs: strings.TrimSpace(input.CPUs), Memory: strings.TrimSpace(input.Memory), ServiceID: serviceID}, true)
}

func (s *Server) serviceRemove(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
	var input struct {
		Confirmation string `json:"confirmation"`
	}
	if !decodeJSON(response, request, &input) {
		return
	}
	serviceID := request.PathValue("id")
	if input.Confirmation != ops.ServiceRemovalConfirmation(serviceID) {
		writeError(response, http.StatusUnprocessableEntity, "removal requires confirmation "+ops.ServiceRemovalConfirmation(serviceID))
		return
	}
	s.submitCommand(response, request, claims, commandServiceRemove, "service/"+serviceID, serviceRemoveCommand{Confirmation: input.Confirmation, ServiceID: serviceID}, false)
}

func (s *Server) stackRemove(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
	var input struct {
		Confirmation string `json:"confirmation"`
	}
	if !decodeJSON(response, request, &input) {
		return
	}
	name := request.PathValue("name")
	if input.Confirmation != ops.ResourceRemovalConfirmation("STACK", name) {
		writeError(response, http.StatusUnprocessableEntity, "removal requires confirmation "+ops.ResourceRemovalConfirmation("STACK", name))
		return
	}
	s.submitCommand(response, request, claims, commandStackRemove, "stack/"+name, stackRemoveCommand{Confirmation: input.Confirmation, Name: name}, false)
}

func (s *Server) containerAction(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
	var input struct {
		Action       string `json:"action"`
		Confirmation string `json:"confirmation"`
	}
	if !decodeJSON(response, request, &input) {
		return
	}
	if !oneOf(input.Action, "start", "stop", "restart", "remove") {
		writeError(response, http.StatusUnprocessableEntity, "Unsupported container action")
		return
	}
	containerID := request.PathValue("id")
	if input.Action == "remove" && input.Confirmation != ops.ResourceRemovalConfirmation("CONTAINER", containerID) {
		writeError(response, http.StatusUnprocessableEntity, "removal requires confirmation "+ops.ResourceRemovalConfirmation("CONTAINER", containerID))
		return
	}
	command := containerActionCommand{Action: input.Action, Confirmation: input.Confirmation, ContainerID: containerID}
	s.submitCommand(response, request, claims, commandContainerAction, "container/"+containerID, command, input.Action == "start")
}

func (s *Server) imagePull(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
	var input imageCommand
	if !decodeJSON(response, request, &input) {
		return
	}
	input.Image = strings.TrimSpace(input.Image)
	s.submitCommand(response, request, claims, commandImagePull, "image/"+input.Image, input, true)
}

func (s *Server) imageRemove(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
	var input imageCommand
	if !decodeJSON(response, request, &input) {
		return
	}
	input.Image = strings.TrimSpace(input.Image)
	s.submitCommand(response, request, claims, commandImageRemove, "image/"+input.Image, input, false)
}

func (s *Server) networkCreate(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
	var input networkCreateCommand
	if !decodeJSON(response, request, &input) {
		return
	}
	input.Name = strings.TrimSpace(input.Name)
	if input.Driver == "" {
		input.Driver = "overlay"
	}
	if !oneOf(input.Driver, "overlay", "bridge") {
		writeError(response, http.StatusUnprocessableEntity, "Network driver must be overlay or bridge")
		return
	}
	s.submitCommand(response, request, claims, commandNetworkCreate, "network/"+input.Name, input, true)
}

func (s *Server) networkRemove(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
	s.submitNamedRemoval(response, request, claims, commandNetworkRemove, "NETWORK", "network")
}

func (s *Server) volumeCreate(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
	var input struct {
		Name string `json:"name"`
	}
	if !decodeJSON(response, request, &input) {
		return
	}
	name := strings.TrimSpace(input.Name)
	s.submitCommand(response, request, claims, commandVolumeCreate, "volume/"+name, namedRemoveCommand{Name: name}, true)
}

func (s *Server) volumeRemove(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
	s.submitNamedRemoval(response, request, claims, commandVolumeRemove, "VOLUME", "volume")
}

func (s *Server) configRemove(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
	s.submitNamedRemoval(response, request, claims, commandConfigRemove, "CONFIG", "config")
}

func (s *Server) submitNamedRemoval(response http.ResponseWriter, request *http.Request, claims auth.Claims, action, kind, target string) {
	var input struct {
		Confirmation string `json:"confirmation"`
	}
	if !decodeJSON(response, request, &input) {
		return
	}
	name := request.PathValue("name")
	if input.Confirmation != ops.ResourceRemovalConfirmation(kind, name) {
		writeError(response, http.StatusUnprocessableEntity, "removal requires confirmation "+ops.ResourceRemovalConfirmation(kind, name))
		return
	}
	s.submitCommand(response, request, claims, action, target+"/"+name, namedRemoveCommand{Confirmation: input.Confirmation, Name: name}, false)
}

func (s *Server) prune(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
	var input struct {
		All          bool   `json:"all"`
		Confirmation string `json:"confirmation"`
	}
	if !decodeJSON(response, request, &input) {
		return
	}
	resource := request.PathValue("resource")
	if !oneOf(resource, "containers", "images", "networks", "volumes", "build-cache") {
		writeError(response, http.StatusNotFound, "Unknown prune resource")
		return
	}
	if input.Confirmation != ops.PruneConfirmation(resource) {
		writeError(response, http.StatusUnprocessableEntity, "prune requires confirmation "+ops.PruneConfirmation(resource))
		return
	}
	command := pruneCommand{All: input.All, Confirmation: input.Confirmation, Resource: resource}
	s.submitCommand(response, request, claims, commandPrune, "cluster/"+resource, command, false)
}

func (s *Server) swarmTokenRotate(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
	var input swarmTokenCommand
	if !decodeJSON(response, request, &input) {
		return
	}
	if !oneOf(input.Role, "worker", "manager") {
		writeError(response, http.StatusUnprocessableEntity, "Join token role must be worker or manager")
		return
	}
	if input.Confirmation != ops.JoinTokenRotationConfirmation(input.Role) {
		writeError(response, http.StatusUnprocessableEntity, "rotation requires confirmation "+ops.JoinTokenRotationConfirmation(input.Role))
		return
	}
	s.submitCommand(response, request, claims, commandSwarmTokenRotate, "swarm/"+input.Role, input, false)
}

func (s *Server) swarmUpdate(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
	var input swarmUpdateCommand
	if !decodeJSON(response, request, &input) {
		return
	}
	if input.TaskHistoryLimit == 0 || input.TaskHistoryLimit > 1000 {
		writeError(response, http.StatusUnprocessableEntity, "Task history limit must be between 1 and 1000")
		return
	}
	s.submitCommand(response, request, claims, commandSwarmUpdate, "swarm/cluster", input, true)
}
