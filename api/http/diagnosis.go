package apihttp

import (
	"net/http"
	"time"

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
// Two inputs the control plane does not yet expose — the service's placement
// constraints and its image size — are therefore absent, and the rules that
// need them decline. That is the intended behaviour while those are added,
// not a stub: the operator sees a refusal listing what was measured instead of
// a confident answer built on a guess.
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

	// The probe timestamp is the OLDEST healthy reading, not the newest. A
	// chain is only as fresh as the stalest measurement it reasoned from, and
	// taking the newest here would let one recent probe vouch for four old ones.
	probedAt := oldestProbe(overview.Nodes, clusterAt)

	result := diagnosis.NewEngine().Diagnose(diagnosis.Facts{
		Service:   service,
		Tasks:     tasks,
		Nodes:     overview.Nodes,
		ProbedAt:  probedAt,
		ClusterAt: clusterAt,
		Now:       time.Now(),
	})
	writeJSON(response, http.StatusOK, result)
}

// diagnosisRules reports what the engine is able to explain. An engine whose
// vocabulary is secret cannot be trusted at the edges of it, so the console can
// show an operator the list beside any refusal.
func (s *Server) diagnosisRules(response http.ResponseWriter, _ *http.Request, _ auth.Claims) {
	writeJSON(response, http.StatusOK, map[string]any{"rules": diagnosis.NewEngine().Rules()})
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
