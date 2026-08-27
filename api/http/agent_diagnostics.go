package apihttp

import (
	"net/http"

	"github.com/nimasrn/SwarmOps/internal/auth"
	"github.com/nimasrn/SwarmOps/internal/domain"
	"github.com/nimasrn/SwarmOps/internal/remote"
)

// serverDiagnostics returns retained safe evidence even if the fresh agent
// probe fails. An outage therefore remains visible in the control plane
// instead of being overwritten by a generic transport error.
func (s *Server) serverDiagnostics(response http.ResponseWriter, request *http.Request, _ auth.Claims) {
	id := request.PathValue("id")
	server, found := savedServerProfile(s.servers.List(), id)
	if !found {
		writeError(response, http.StatusNotFound, "Server was not found")
		return
	}
	if server.ConnectionType != remote.ConnectionAgentAPI {
		writeError(response, http.StatusUnprocessableEntity, "This server does not expose a native SwarmOps machine agent")
		return
	}
	health := server.AgentHealth
	if s.CanExecuteCommands() {
		var err error
		health, err = s.servers.AgentDiagnostics(request.Context(), id)
		if err != nil {
			s.logger.Warn("SwarmOps agent diagnostic probe failed", "request_id", requestID(request), "server_id", id, "error", err)
		}
	}
	writeJSON(response, http.StatusOK, health)
}

// serverUpdate requests a fixed local Git update check. The machine agent
// decides nothing from this request except to wake its preconfigured updater.
func (s *Server) serverUpdate(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
	id := request.PathValue("id")
	health, err := s.servers.RequestAgentUpdate(request.Context(), id)
	if err != nil {
		s.record(claims.Username, requestID(request), "agent.update.request", "server/"+id, err, nil)
		s.operationError(response, request, err)
		return
	}
	s.record(claims.Username, requestID(request), "agent.update.request", "server/"+id, nil, nil)
	writeJSON(response, http.StatusAccepted, health)
}

func savedServerProfile(servers []domain.Server, id string) (domain.Server, bool) {
	for _, server := range servers {
		if server.ID == id {
			return server, true
		}
	}
	return domain.Server{}, false
}
