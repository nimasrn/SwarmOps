package apihttp

import (
	"context"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/nimasrn/SwarmOps/internal/agentcontrol"
	"github.com/nimasrn/SwarmOps/internal/auth"
)

// One endpoint, one named reading, one object.
//
// `GET /api/v1/metrics/range?scope=machine&series=cpu&machine=srv-1` — and
// nothing resembling an expression is accepted. The scope and series name a
// row in a fixed table on the machine that will run it; everything else is a
// selector validated against a pattern that admits no quote, brace or space.
//
// The response ALWAYS says which source answered. A chart drawn from a
// four-hour in-memory ring and a chart drawn from fifteen days of Prometheus
// are different claims, and a console that cannot tell them apart will
// eventually tell an operator the wrong one.

// MetricReader is the agent surface that answers a named reading. It is
// separate from MachineMeter because measuring and remembering are different
// capabilities: an agent reports its own host without a Prometheus existing
// anywhere, and only a cluster that deployed one has history to read.
type MetricReader interface {
	MetricRange(ctx context.Context, query agentcontrol.MetricQuery) (agentcontrol.MetricRange, error)
}

func (s *Server) metricsRange(response http.ResponseWriter, request *http.Request, _ auth.Claims) {
	query := agentcontrol.MetricQuery{
		Application: request.URL.Query().Get("application"),
		Container:   request.URL.Query().Get("container"),
		Machine:     request.URL.Query().Get("machine"),
		Scope:       request.URL.Query().Get("scope"),
		Series:      request.URL.Query().Get("series"),
	}
	if value := strings.TrimSpace(request.URL.Query().Get("stepSeconds")); value != "" {
		step, err := strconv.Atoi(value)
		if err != nil {
			writeError(response, http.StatusUnprocessableEntity, "stepSeconds must be a whole number of seconds")
			return
		}
		query.StepSeconds = step
	}
	if from, ok := parseMetricTime(response, request.URL.Query().Get("from")); ok {
		query.From = from
	} else if request.URL.Query().Has("from") {
		return
	}
	if to, ok := parseMetricTime(response, request.URL.Query().Get("to")); ok {
		query.To = to
	} else if request.URL.Query().Has("to") {
		return
	}

	if err := query.Normalize(time.Now().UTC()); err != nil {
		writeError(response, http.StatusUnprocessableEntity, err.Error())
		return
	}

	// A container or machine reading is about a machine; the cluster, gateway
	// and application readings are about the selected cluster's manager. Both
	// resolve through the same target, because the manager is the machine that
	// can reach the cluster's Prometheus.
	targetID := strings.TrimSpace(query.Machine)
	if query.Scope != agentcontrol.MetricScopeMachine && query.Scope != agentcontrol.MetricScopeContainer {
		targetID = strings.TrimSpace(request.Header.Get("X-SwarmOps-Server-ID"))
	}
	if targetID == "" {
		writeError(response, http.StatusUnprocessableEntity, "Choose a machine before reading a metric")
		return
	}
	target, err := s.targets.Resolve(targetID)
	if err != nil || target.Metrics == nil {
		writeJSON(response, http.StatusOK, unavailableRange(query, "This machine is not connected, so its history cannot be read."))
		return
	}

	result, err := target.Metrics.MetricRange(request.Context(), query)
	if err != nil {
		s.logger.Warn("metric range read failed", "scope", query.Scope, "series", query.Series, "error", err)
		writeJSON(response, http.StatusOK, unavailableRange(query, "The machine could not reach a Prometheus for this cluster."))
		return
	}
	writeJSON(response, http.StatusOK, result)
}

// unavailableRange is a real answer, not an error. "No history" is a state a
// cluster is legitimately in — before the observability stack is deployed, and
// on any cluster that chooses not to run one.
func unavailableRange(query agentcontrol.MetricQuery, note string) agentcontrol.MetricRange {
	return agentcontrol.MetricRange{
		From:        query.From,
		Note:        note,
		Points:      []agentcontrol.MetricPoint{},
		Scope:       query.Scope,
		Series:      query.Series,
		Source:      agentcontrol.MetricSourceUnavailable,
		StepSeconds: query.StepSeconds,
		To:          query.To,
		Unit:        query.Unit(),
	}
}

// metricsSeries answers what a scope can be asked for, so the console builds
// its charts from the controller's vocabulary rather than from a list it keeps
// in step by hand.
func (s *Server) metricsSeries(response http.ResponseWriter, request *http.Request, _ auth.Claims) {
	scope := request.URL.Query().Get("scope")
	series := agentcontrol.MetricSeriesFor(scope)
	if series == nil {
		writeError(response, http.StatusUnprocessableEntity, "Unknown metric scope")
		return
	}
	writeJSON(response, http.StatusOK, map[string]any{"scope": scope, "series": series})
}

func parseMetricTime(response http.ResponseWriter, value string) (time.Time, bool) {
	value = strings.TrimSpace(value)
	if value == "" {
		return time.Time{}, false
	}
	parsed, err := time.Parse(time.RFC3339, value)
	if err != nil {
		writeError(response, http.StatusUnprocessableEntity, "from and to must be RFC3339 timestamps")
		return time.Time{}, false
	}
	return parsed.UTC(), true
}
