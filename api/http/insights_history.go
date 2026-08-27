package apihttp

import (
	"context"
	"net/http"
	"time"

	"github.com/nimasrn/SwarmOps/internal/auth"
	"github.com/nimasrn/SwarmOps/internal/insights"
)

// insightsSampleInterval is how often the API takes a reading of every
// connected manager. It is a fixed minute rather than a setting: the series
// exists to give the dashboard a shape, and a faster cadence would put load on
// a cluster for a picture no operator can read anyway. Long-range history is
// Prometheus' job, and SwarmOps deploys it.
const insightsSampleInterval = time.Minute

// StartInsightsSampler records one reading per connected manager on a fixed
// interval so the dashboard has a trend the moment an operator opens it. It
// returns when the context is cancelled; a failing target is skipped rather
// than retried, because the next tick is a better retry than a tight loop.
func (s *Server) StartInsightsSampler(ctx context.Context) {
	ticker := time.NewTicker(insightsSampleInterval)
	defer ticker.Stop()
	s.sampleInsights(ctx)
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			s.sampleInsights(ctx)
		}
	}
}

func (s *Server) sampleInsights(ctx context.Context) {
	if s.history == nil || s.servers == nil || !s.CanExecuteCommands() {
		return
	}
	for _, server := range s.servers.List() {
		if server.ConnectionState != "connected" || !server.SwarmControlAvailable {
			continue
		}
		sampleContext, cancel := context.WithTimeout(ctx, 20*time.Second)
		s.recordInsights(sampleContext, server.ID)
		cancel()
	}
}

// recordInsights takes one reading for a target. It is used by both the
// background sampler and the history endpoint, so a dashboard opened before
// the first tick still has a point to draw.
func (s *Server) recordInsights(ctx context.Context, serverID string) {
	if s.history == nil || serverID == "" || !s.CanExecuteCommands() {
		return
	}
	target, err := s.targets.Resolve(serverID)
	if err != nil || target.Control == nil {
		return
	}
	value, err := target.Control.Insights(ctx)
	if err != nil {
		return
	}
	s.history.Record(serverID, insights.SampleFrom(value))
}

func (s *Server) insightsHistory(response http.ResponseWriter, request *http.Request, _ auth.Claims) {
	serverID, ok := s.selectedServer(response, request)
	if !ok {
		return
	}
	// A dashboard opened between ticks should not show an empty chart, so take
	// a reading now when the newest one is already a full interval old.
	latest, found := s.history.Latest(serverID)
	if !found || time.Since(latest.At) >= insightsSampleInterval {
		s.recordInsights(request.Context(), serverID)
	}
	writeJSON(response, http.StatusOK, s.history.Series(serverID))
}

// selectedServer resolves the target the browser selected and reports its ID,
// which is the key the series is stored under.
func (s *Server) selectedServer(response http.ResponseWriter, request *http.Request) (string, bool) {
	target, ok := s.targetFor(response, request)
	if !ok {
		return "", false
	}
	if target.Control == nil || target.Control.ServerID == "" {
		writeError(response, http.StatusConflict, "Select a saved server before reading its history")
		return "", false
	}
	return target.Control.ServerID, true
}
