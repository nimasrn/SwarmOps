package agent

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"
)

// The handlers here mirror the Docker Engine's own read paths under the
// agent's /v1/engine prefix, so the controller's Docker client reaches them
// without a socket proxy. Each one is an explicit, authenticated, read-only
// call into the local Docker client — never a forwarded request path.

func (s *Server) engineContainers(response http.ResponseWriter, request *http.Request) {
	if !s.authorized(request) {
		http.Error(response, "unauthorized", http.StatusUnauthorized)
		return
	}
	all := request.URL.Query().Get("all") == "1"
	value, err := s.config.Docker.ListContainers(request.Context(), all)
	if err != nil {
		http.Error(response, "engine unavailable", http.StatusServiceUnavailable)
		return
	}
	writeJSON(response, value)
}

func (s *Server) engineContainer(response http.ResponseWriter, request *http.Request) {
	if !s.authorized(request) {
		http.Error(response, "unauthorized", http.StatusUnauthorized)
		return
	}
	value, err := s.config.Docker.InspectContainer(request.Context(), request.PathValue("id"))
	if err != nil {
		http.Error(response, "engine unavailable", http.StatusServiceUnavailable)
		return
	}
	writeJSON(response, value)
}

func (s *Server) engineContainerStats(response http.ResponseWriter, request *http.Request) {
	if !s.authorized(request) {
		http.Error(response, "unauthorized", http.StatusUnauthorized)
		return
	}
	value, err := s.config.Docker.ContainerStats(request.Context(), request.PathValue("id"))
	if err != nil {
		http.Error(response, "engine unavailable", http.StatusServiceUnavailable)
		return
	}
	writeJSON(response, value)
}

func (s *Server) engineImages(response http.ResponseWriter, request *http.Request) {
	if !s.authorized(request) {
		http.Error(response, "unauthorized", http.StatusUnauthorized)
		return
	}
	value, err := s.config.Docker.ListImages(request.Context())
	if err != nil {
		http.Error(response, "engine unavailable", http.StatusServiceUnavailable)
		return
	}
	writeJSON(response, value)
}

func (s *Server) engineImage(response http.ResponseWriter, request *http.Request) {
	if !s.authorized(request) {
		http.Error(response, "unauthorized", http.StatusUnauthorized)
		return
	}
	value, err := s.config.Docker.InspectImage(request.Context(), request.PathValue("id"))
	if err != nil {
		http.Error(response, "engine unavailable", http.StatusServiceUnavailable)
		return
	}
	writeJSON(response, value)
}

func (s *Server) engineVolumes(response http.ResponseWriter, request *http.Request) {
	if !s.authorized(request) {
		http.Error(response, "unauthorized", http.StatusUnauthorized)
		return
	}
	value, err := s.config.Docker.ListVolumes(request.Context())
	if err != nil {
		http.Error(response, "engine unavailable", http.StatusServiceUnavailable)
		return
	}
	// The controller's Docker client decodes the Engine's own envelope shape.
	writeJSON(response, map[string]any{"Volumes": value, "Warnings": []string{}})
}

func (s *Server) engineVolume(response http.ResponseWriter, request *http.Request) {
	if !s.authorized(request) {
		http.Error(response, "unauthorized", http.StatusUnauthorized)
		return
	}
	value, err := s.config.Docker.InspectVolume(request.Context(), request.PathValue("name"))
	if err != nil {
		http.Error(response, "engine unavailable", http.StatusServiceUnavailable)
		return
	}
	writeJSON(response, value)
}

func (s *Server) engineNetworks(response http.ResponseWriter, request *http.Request) {
	if !s.authorized(request) {
		http.Error(response, "unauthorized", http.StatusUnauthorized)
		return
	}
	value, err := s.config.Docker.ListNetworks(request.Context())
	if err != nil {
		http.Error(response, "engine unavailable", http.StatusServiceUnavailable)
		return
	}
	writeJSON(response, value)
}

func (s *Server) engineNetwork(response http.ResponseWriter, request *http.Request) {
	if !s.authorized(request) {
		http.Error(response, "unauthorized", http.StatusUnauthorized)
		return
	}
	value, err := s.config.Docker.InspectNetwork(request.Context(), request.PathValue("id"))
	if err != nil {
		http.Error(response, "engine unavailable", http.StatusServiceUnavailable)
		return
	}
	writeJSON(response, value)
}

func (s *Server) engineSecrets(response http.ResponseWriter, request *http.Request) {
	if !s.authorized(request) {
		http.Error(response, "unauthorized", http.StatusUnauthorized)
		return
	}
	value, err := s.config.Docker.ListSecrets(request.Context())
	if err != nil {
		http.Error(response, "engine unavailable", http.StatusServiceUnavailable)
		return
	}
	writeJSON(response, value)
}

func (s *Server) engineConfigs(response http.ResponseWriter, request *http.Request) {
	if !s.authorized(request) {
		http.Error(response, "unauthorized", http.StatusUnauthorized)
		return
	}
	value, err := s.config.Docker.ListConfigs(request.Context())
	if err != nil {
		http.Error(response, "engine unavailable", http.StatusServiceUnavailable)
		return
	}
	writeJSON(response, value)
}

func (s *Server) engineService(response http.ResponseWriter, request *http.Request) {
	if !s.authorized(request) {
		http.Error(response, "unauthorized", http.StatusUnauthorized)
		return
	}
	value, err := s.config.Docker.InspectService(request.Context(), request.PathValue("id"))
	if err != nil {
		http.Error(response, "engine unavailable", http.StatusServiceUnavailable)
		return
	}
	writeJSON(response, value)
}

func (s *Server) engineTask(response http.ResponseWriter, request *http.Request) {
	if !s.authorized(request) {
		http.Error(response, "unauthorized", http.StatusUnauthorized)
		return
	}
	value, err := s.config.Docker.InspectTask(request.Context(), request.PathValue("id"))
	if err != nil {
		http.Error(response, "engine unavailable", http.StatusServiceUnavailable)
		return
	}
	writeJSON(response, value)
}

func (s *Server) engineSwarm(response http.ResponseWriter, request *http.Request) {
	if !s.authorized(request) {
		http.Error(response, "unauthorized", http.StatusUnauthorized)
		return
	}
	value, err := s.config.Docker.InspectSwarm(request.Context())
	if err != nil {
		http.Error(response, "engine unavailable", http.StatusServiceUnavailable)
		return
	}
	writeJSON(response, value)
}

func (s *Server) engineDiskUsage(response http.ResponseWriter, request *http.Request) {
	if !s.authorized(request) {
		http.Error(response, "unauthorized", http.StatusUnauthorized)
		return
	}
	value, err := s.config.Docker.DiskUsage(request.Context())
	if err != nil {
		http.Error(response, "engine unavailable", http.StatusServiceUnavailable)
		return
	}
	writeJSON(response, value)
}

// engineEvents reads a bounded, already-closed window of the Engine event log.
// The window is capped so one request cannot hold the Engine open or return an
// unbounded document.
func (s *Server) engineEvents(response http.ResponseWriter, request *http.Request) {
	if !s.authorized(request) {
		http.Error(response, "unauthorized", http.StatusUnauthorized)
		return
	}
	since, _ := strconv.ParseInt(request.URL.Query().Get("since"), 10, 64)
	until, _ := strconv.ParseInt(request.URL.Query().Get("until"), 10, 64)
	now := time.Now().Unix()
	if until <= 0 || until > now {
		until = now
	}
	if since <= 0 || until-since > int64(maxEventWindow/time.Second) {
		since = until - int64(maxEventWindow/time.Second)
	}
	value, err := s.config.Docker.Events(request.Context(), since, until)
	if err != nil {
		http.Error(response, "engine unavailable", http.StatusServiceUnavailable)
		return
	}
	// The Engine returns newline-delimited events and the controller's Docker
	// client decodes that same shape, so re-emit it rather than an array.
	response.Header().Set("Content-Type", "application/json")
	encoder := json.NewEncoder(response)
	for _, event := range value {
		if err := encoder.Encode(event); err != nil {
			return
		}
	}
}

const maxEventWindow = 24 * time.Hour
