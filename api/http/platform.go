package apihttp

import (
	"net/http"
	"strings"
	"time"

	"github.com/nimasrn/SwarmOps/internal/auth"
	"github.com/nimasrn/SwarmOps/internal/domain"
	"github.com/nimasrn/SwarmOps/internal/ops"
	"github.com/nimasrn/SwarmOps/internal/preflight"
)

// SetPlatformStore hands the server the sealed, console-owned platform
// definition. Keeping it out of New preserves the behaviour of a controller
// that only ever loads a mounted manifest.
func (s *Server) SetPlatformStore(store *ops.PlatformStore) { s.platform = store }

// platformRead describes what admits deployments on this controller: where the
// definition comes from, whether the console may change it, the application
// slots it approves, and what preflight makes of it. The console needs all
// four to explain a refused deployment without the operator reading logs.
func (s *Server) platformRead(response http.ResponseWriter, _ *http.Request, _ auth.Claims) {
	state := s.platform.State()
	mode := state.Mode
	if strings.TrimSpace(mode) == "" {
		mode = ops.PlatformModeUnset
	}
	editable := s.platform != nil && !s.platform.FileManaged()
	admission := s.platform.Admission()
	if s.platform.FileManaged() {
		mode = ops.PlatformModeFile
	}
	body := map[string]any{
		"confirmationPhrase": ops.UnmanagedConfirmation,
		"editable":           editable,
		"fileManaged":        s.platform.FileManaged(),
		"manifest":           state.Manifest,
		"manifestPath":       s.config.PlatformManifestFile,
		"mode":               mode,
		"namespace":          admission.Namespace(),
		"slots":              admission.ApprovedApplications(),
		"unmanaged":          admission.Unmanaged(),
		"updatedAt":          state.UpdatedAt,
		"updatedBy":          state.UpdatedBy,
	}
	if mode == ops.PlatformModeManifest {
		body["report"] = preflight.Check(state.Manifest)
	}
	writeJSON(response, http.StatusOK, body)
}

// platformCheck runs the same deterministic preflight the save path runs, but
// stores nothing, so the console can show findings while an operator edits.
func (s *Server) platformCheck(response http.ResponseWriter, request *http.Request, _ auth.Claims) {
	var input ops.PlatformInput
	if !decodeJSON(response, request, &input) {
		return
	}
	writeJSON(response, http.StatusOK, ops.CheckPlatformInput(input))
}

// platformApply seals a new platform definition. Turning slot enforcement off
// is a mode like any other here, but the store demands its confirmation phrase
// before accepting it.
func (s *Server) platformApply(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
	if s.platform == nil {
		writeError(response, http.StatusServiceUnavailable, "The platform definition cannot be changed on this controller")
		return
	}
	var input ops.PlatformInput
	if !decodeJSON(response, request, &input) {
		return
	}
	saved, err := s.platform.Save(claims.Username, input, time.Now())
	if err != nil {
		s.record(claims.Username, requestID(request), "platform.applied", "platform/controller", err, map[string]string{"mode": strings.TrimSpace(input.Mode)})
		writeError(response, http.StatusUnprocessableEntity, err.Error())
		return
	}
	s.record(claims.Username, requestID(request), "platform.applied", "platform/controller", nil, map[string]string{
		"mode":      saved.Mode,
		"namespace": saved.Namespace,
	})
	s.platformRead(response, request, claims)
}

// platformNodes projects the live cluster inventory into the measured node
// declarations a manifest needs. Typing a node's capacity by hand is how a
// manifest drifts from the cluster it describes; the operator still reviews
// and may edit every value before saving.
func (s *Server) platformNodes(response http.ResponseWriter, request *http.Request, _ auth.Claims) {
	target, ok := s.targetFor(response, request)
	if !ok {
		return
	}
	nodes, err := target.Control.Nodes(request.Context())
	if err != nil {
		s.operationError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, measuredNodes(nodes))
}

func measuredNodes(nodes []domain.Node) []preflight.Node {
	measured := make([]preflight.Node, 0, len(nodes))
	for _, node := range nodes {
		measured = append(measured, preflight.Node{
			AvailableCPUCores:  float64(node.CPU.Capacity),
			AvailableDiskGiB:   node.Disk.Available / (1 << 30),
			AvailableMemoryMiB: node.Memory.Available / (1 << 20),
			CPUCores:           float64(node.CPU.Capacity),
			Labels:             node.Labels,
			MemoryMiB:          node.Memory.Capacity / (1 << 20),
			Name:               strings.ToLower(strings.TrimSpace(node.Hostname)),
		})
	}
	return measured
}
