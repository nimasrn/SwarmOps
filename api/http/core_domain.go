package apihttp

import (
	"net/http"

	"github.com/nimasrn/SwarmOps/internal/auth"
	"github.com/nimasrn/SwarmOps/internal/ops"
)

const commandCoreConsolePublish = "core.console.publish"

type coreConsoleCommand struct {
	Request ops.CoreConsoleRequest `json:"request"`
}

// coreConsoleStatus answers what the Core screen opens with: where this
// console is published, and which accepted zones it could be published under.
// It is a cluster read because the gateway that would serve it belongs to the
// selected cluster, not to the controller.
func (s *Server) coreConsoleStatus(response http.ResponseWriter, request *http.Request, _ auth.Claims) {
	target, ok := s.targetFor(response, request)
	if !ok {
		return
	}
	status, err := target.Control.CoreConsoleStatus(request.Context())
	if err != nil {
		s.operationError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, status)
}

// coreConsolePlan reads the provider and reports the exact record and route a
// publication would create. Nothing is written by it.
func (s *Server) coreConsolePlan(response http.ResponseWriter, request *http.Request, _ auth.Claims) {
	var input ops.CoreConsoleRequest
	if !decodeJSON(response, request, &input) {
		return
	}
	target, ok := s.targetFor(response, request)
	if !ok {
		return
	}
	plan, err := target.Control.PlanCoreConsole(request.Context(), input)
	if err != nil {
		writeError(response, http.StatusUnprocessableEntity, err.Error())
		return
	}
	writeJSON(response, http.StatusOK, plan)
}

// coreConsolePublish queues the publication. It is planned once here so an
// invalid zone, a missing credential, or an unroutable gateway is refused
// while the operator is still looking at the screen.
func (s *Server) coreConsolePublish(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
	var input ops.CoreConsoleRequest
	if !decodeJSON(response, request, &input) {
		return
	}
	input = input.Normalize()
	if err := input.Validate(); err != nil {
		writeError(response, http.StatusUnprocessableEntity, err.Error())
		return
	}
	target, ok := s.targetFor(response, request)
	if !ok {
		return
	}
	plan, err := target.Control.PlanCoreConsole(request.Context(), input)
	if err != nil {
		writeError(response, http.StatusUnprocessableEntity, err.Error())
		return
	}
	if input.Confirmation != plan.Confirmation {
		writeError(response, http.StatusUnprocessableEntity, "publishing the console requires confirmation "+plan.Confirmation)
		return
	}
	// One attempt only. The retry an operator wants here is a new decision
	// after reading what happened, not an automatic second attempt at a change
	// that replaces the task serving this request.
	s.submitCommand(response, request, claims, commandCoreConsolePublish, "route/"+ops.CoreConsoleRouteKey, coreConsoleCommand{Request: input}, false)
}
