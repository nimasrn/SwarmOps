package agent

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/nimasrn/SwarmOps/internal/agentcontrol"
)

// The machine executes the query; it does not receive one.
//
// A named reading arrives, is validated here a second time, and only then is
// turned into a query by the fixed table in agentcontrol. The controller could
// have built the expression itself and sent it, and that would have been one
// less round of validation and one more place a text field reaches Prometheus.
// This side does not trust that the other side checked.

const (
	prometheusQueryTimeout = 20 * time.Second
	// A response larger than this is not a console chart. The cap is on the
	// BODY rather than on the point count so a malformed or hostile response
	// cannot be read into memory before it is counted.
	prometheusMaxResponse = 8 << 20
)

func (s *Server) metricsQuery(response http.ResponseWriter, request *http.Request) {
	if !s.authorized(request) {
		http.Error(response, "unauthorized", http.StatusUnauthorized)
		return
	}
	var query agentcontrol.MetricQuery
	decoder := json.NewDecoder(http.MaxBytesReader(response, request.Body, 16<<10))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&query); err != nil {
		http.Error(response, "invalid metric query", http.StatusBadRequest)
		return
	}
	if err := query.Normalize(time.Now().UTC()); err != nil {
		http.Error(response, err.Error(), http.StatusUnprocessableEntity)
		return
	}
	result, err := s.readMetricRange(request.Context(), query)
	if err != nil {
		// A cluster with no Prometheus is a normal state, not a failure. It is
		// reported as a range with no points and a source of `unavailable`, so
		// the console can say "not collected" instead of drawing an idle
		// machine.
		writeJSON(response, agentcontrol.MetricRange{
			From:        query.From,
			Note:        "This cluster has no reachable Prometheus, so there is no history to read.",
			Points:      []agentcontrol.MetricPoint{},
			Scope:       query.Scope,
			Series:      query.Series,
			Source:      agentcontrol.MetricSourceUnavailable,
			StepSeconds: query.StepSeconds,
			To:          query.To,
			Unit:        query.Unit(),
		})
		return
	}
	writeJSON(response, result)
}

func (s *Server) readMetricRange(ctx context.Context, query agentcontrol.MetricQuery) (agentcontrol.MetricRange, error) {
	base := strings.TrimSpace(s.config.PrometheusBaseURL)
	if base == "" {
		return agentcontrol.MetricRange{}, fmt.Errorf("no Prometheus is configured on this machine")
	}
	expression, err := query.Expression()
	if err != nil {
		return agentcontrol.MetricRange{}, err
	}

	form := url.Values{}
	form.Set("query", expression)
	form.Set("start", strconv.FormatInt(query.From.Unix(), 10))
	form.Set("end", strconv.FormatInt(query.To.Unix(), 10))
	form.Set("step", strconv.Itoa(query.StepSeconds))
	endpoint := strings.TrimSuffix(base, "/") + "/api/v1/query_range?" + form.Encode()

	ctx, cancel := context.WithTimeout(ctx, prometheusQueryTimeout)
	defer cancel()

	var payload struct {
		Data struct {
			Result []struct {
				Values [][2]json.RawMessage `json:"values"`
			} `json:"result"`
			ResultType string `json:"resultType"`
		} `json:"data"`
		Status string `json:"status"`
	}
	if err := fixedInternalJSON(ctx, s.internalHTTPClient(), endpoint, &payload); err != nil {
		return agentcontrol.MetricRange{}, err
	}
	if payload.Status != "success" {
		return agentcontrol.MetricRange{}, fmt.Errorf("Prometheus refused the query")
	}

	result := agentcontrol.MetricRange{
		From:        query.From,
		Points:      []agentcontrol.MetricPoint{},
		Scope:       query.Scope,
		Series:      query.Series,
		Source:      agentcontrol.MetricSourcePrometheus,
		StepSeconds: query.StepSeconds,
		To:          query.To,
		Unit:        query.Unit(),
	}
	if len(payload.Data.Result) == 0 {
		result.Note = "Prometheus answered, and holds no samples for this reading in the window."
		return result, nil
	}
	// Every query in the table reduces to one series. Taking the first rather
	// than merging means a table entry that accidentally fans out shows one
	// line instead of a silently averaged one.
	for _, pair := range payload.Data.Result[0].Values {
		point, ok := decodePrometheusSample(pair)
		if ok {
			result.Points = append(result.Points, point)
		}
		if len(result.Points) >= agentcontrol.MaxMetricPoints {
			break
		}
	}
	return result, nil
}

// decodePrometheusSample reads Prometheus' `[unixSeconds, "value"]` pair.
//
// A NaN sample is DROPPED rather than sent as zero. Prometheus emits NaN for a
// gap and for a quantile with no observations, and either drawn as zero is a
// claim that the workload was idle.
func decodePrometheusSample(pair [2]json.RawMessage) (agentcontrol.MetricPoint, bool) {
	var seconds float64
	if err := json.Unmarshal(pair[0], &seconds); err != nil {
		return agentcontrol.MetricPoint{}, false
	}
	var raw string
	if err := json.Unmarshal(pair[1], &raw); err != nil {
		return agentcontrol.MetricPoint{}, false
	}
	value, err := strconv.ParseFloat(raw, 64)
	if err != nil || math.IsNaN(value) || math.IsInf(value, 0) {
		return agentcontrol.MetricPoint{}, false
	}
	return agentcontrol.MetricPoint{At: time.Unix(int64(seconds), 0).UTC(), Value: value}, true
}
