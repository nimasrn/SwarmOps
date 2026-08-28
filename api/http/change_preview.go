package apihttp

import (
	"encoding/json"
	"net/http"

	"github.com/nimasrn/SwarmOps/internal/auth"
	"github.com/nimasrn/SwarmOps/internal/changepreview"
	"github.com/nimasrn/SwarmOps/internal/domain"
)

// changePreview says what retagging a service will do, before anything is
// queued.
//
// This is a read and must stay one. The value of a preview is that an operator
// can look at the consequences and decide not to; an endpoint that previewed
// and applied in one call would remove the only moment where that decision
// exists.
func (s *Server) changePreview(response http.ResponseWriter, request *http.Request, _ auth.Claims) {
	target, ok := s.targetFor(response, request)
	if !ok {
		return
	}
	id := request.PathValue("id")
	var body struct {
		Image string `json:"image"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(response, request.Body, 8<<10)).Decode(&body); err != nil {
		writeError(response, http.StatusBadRequest, "Name the image to preview")
		return
	}
	if body.Image == "" {
		writeError(response, http.StatusBadRequest, "Name the image to preview")
		return
	}

	services, err := target.Control.Services(request.Context())
	if err != nil {
		s.operationError(response, request, err)
		return
	}
	var service domain.Service
	found := false
	for _, candidate := range services {
		if candidate.ID == id || candidate.Name == id {
			service, found = candidate, true
			break
		}
	}
	if !found {
		writeError(response, http.StatusNotFound, "No such service on the selected server")
		return
	}

	// Peers are services sharing the stack. They are handed over as evidence of
	// a relationship; the preview is careful to word them as such rather than
	// asserting a dependency it has not observed.
	peers := make([]domain.Service, 0)
	if service.Stack != "" {
		for _, candidate := range services {
			if candidate.Stack == service.Stack {
				peers = append(peers, candidate)
			}
		}
	}
	writeJSON(response, http.StatusOK, changepreview.ForImageChange(service, body.Image, peers))
}
