package apihttp

import (
	"net/http"
	"strings"
	"time"

	"github.com/nimasrn/SwarmOps/internal/dockerapi"

	"github.com/nimasrn/SwarmOps/internal/auth"
	"github.com/nimasrn/SwarmOps/internal/diagnosis"
	"github.com/nimasrn/SwarmOps/internal/domain"
)

// serviceDiagnosis explains why one service is not running what it was asked to
// run, or says plainly that it cannot.
//
// The engine is a pure function of facts, so this handler's only job is to
// gather them honestly. Where a fact is unavailable it is left unset rather
// than defaulted: the rules treat "unknown" and "zero" as different, and
// filling a gap with a plausible number here would defeat the entire design.
//
// Image size is read from the manager's own image list rather than from a
// registry manifest. That is deliberate and it is also a limitation worth
// stating: it is the size of the image AS PULLED HERE, so a tag the cluster has
// never pulled has no size and the rule that needs one declines. Asking the
// registry instead would be a network round-trip on every page open, and would
// still not answer the question the rule actually asks, which is how much room
// this cluster needs to hold the thing.
func (s *Server) serviceDiagnosis(response http.ResponseWriter, request *http.Request, _ auth.Claims) {
	target, ok := s.targetFor(response, request)
	if !ok {
		return
	}
	id := request.PathValue("id")
	if id == "" {
		writeError(response, http.StatusBadRequest, "Name the service to diagnose")
		return
	}

	ctx := request.Context()
	clusterAt := time.Now()
	overview, err := target.Control.Overview(ctx)
	if err != nil {
		s.operationError(response, request, err)
		return
	}

	var service domain.Service
	found := false
	for _, candidate := range overview.Services {
		if candidate.ID == id || candidate.Name == id {
			service, found = candidate, true
			break
		}
	}
	if !found {
		writeError(response, http.StatusNotFound, "No such service on the selected server")
		return
	}

	// Tasks are best-effort: without them the engine loses one rule and keeps
	// the rest, which is better than failing the whole request.
	tasks, taskErr := target.Control.TasksForService(ctx, service.ID)
	if taskErr != nil {
		tasks = nil
	}

	// Same posture for the image list. A failure here means the size is unknown,
	// which the engine already treats as "decline" rather than "zero".
	imageBytes, imageKnown := uint64(0), false
	if images, imageErr := target.Control.Images(ctx); imageErr == nil {
		imageBytes, imageKnown = imageSizeFor(service.Image, images)
	}

	// The probe timestamp is the OLDEST healthy reading, not the newest. A
	// chain is only as fresh as the stalest measurement it reasoned from, and
	// taking the newest here would let one recent probe vouch for four old ones.
	probedAt := oldestProbe(overview.Nodes, clusterAt)

	result := diagnosis.NewEngine().Diagnose(diagnosis.Facts{
		Service:     service,
		Constraints: service.Constraints,
		ImageBytes:  imageBytes,
		ImageKnown:  imageKnown,
		Tasks:       tasks,
		Nodes:       overview.Nodes,
		ProbedAt:    probedAt,
		ClusterAt:   clusterAt,
		Now:         time.Now(),
	})
	writeJSON(response, http.StatusOK, result)
}

// diagnosisRules reports what the engine is able to explain. An engine whose
// vocabulary is secret cannot be trusted at the edges of it, so the console can
// show an operator the list beside any refusal.
func (s *Server) diagnosisRules(response http.ResponseWriter, _ *http.Request, _ auth.Claims) {
	writeJSON(response, http.StatusOK, map[string]any{"rules": diagnosis.NewEngine().Rules()})
}

// imageSizeFor finds the pulled size of a service's image.
//
// Matching is exact on the tag as the service names it. A near-match would be
// worse than no match: reporting the size of :latest when the service asks for
// :9f2c1ab would put a wrong number inside a claim that reads as measured.
func imageSizeFor(image string, images []dockerapi.Image) (uint64, bool) {
	if image == "" {
		return 0, false
	}
	// Swarm pins the image to a digest in the running spec — "repo:tag@sha256:…"
	// — while the local list carries the tag. Compare on the tag half.
	name := image
	if at := strings.Index(name, "@"); at > 0 {
		name = name[:at]
	}
	for _, candidate := range images {
		for _, tag := range candidate.RepoTags {
			if tag == name && candidate.Size > 0 {
				return uint64(candidate.Size), true
			}
		}
	}
	return 0, false
}

func oldestProbe(nodes []domain.Node, fallback time.Time) time.Time {
	oldest := time.Time{}
	for _, node := range nodes {
		if !node.Agent.Healthy || node.Agent.CollectedAt.IsZero() {
			continue
		}
		if oldest.IsZero() || node.Agent.CollectedAt.Before(oldest) {
			oldest = node.Agent.CollectedAt
		}
	}
	if oldest.IsZero() {
		return fallback
	}
	return oldest
}
