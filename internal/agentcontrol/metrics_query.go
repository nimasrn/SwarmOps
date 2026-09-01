package agentcontrol

import (
	"fmt"
	"regexp"
	"strings"
	"time"
)

// Reading a metric is a CLOSED vocabulary, exactly like changing something is.
//
// The browser never sends an expression. It names a series and an object — "the
// CPU of machine srv-1", "the error rate of application checkout-api" — and the
// query language is built on the machine from a fixed table. That is the same
// rule that governs every mutation in this product, and it exists for the same
// reason: an expression is a program, and a program from a browser is a
// capability nobody reviewed.
//
// It also keeps the console honest about WHERE a reading came from. A named
// series has one definition, so two screens showing "CPU" cannot quietly be
// showing two different numbers.

const (
	// A range longer than this is a report, not a console chart, and asking
	// Prometheus for it while an operator waits is how a dashboard becomes the
	// thing that takes the cluster down.
	MaxMetricRange = 7 * 24 * time.Hour
	MinMetricStep  = 5 * time.Second
	MaxMetricStep  = time.Hour
	// Prometheus refuses a query resolving to more than 11,000 points. Staying
	// well under it means a bad step is rejected here, with an explanation,
	// rather than there, with a 422 nobody can read.
	MaxMetricPoints = 1500
)

// Scopes and series. Every valid pair is in metricQueries below; anything else
// is refused before a query is built.
const (
	MetricScopeMachine     = "machine"
	MetricScopeContainer   = "container"
	MetricScopeCluster     = "cluster"
	MetricScopeApplication = "application"
	MetricScopeGateway     = "gateway"
)

var (
	metricSelectorPattern = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$`)
	metricSeriesPattern   = regexp.MustCompile(`^[a-z][a-z0-9-]{0,31}$`)
)

// MetricQuery is one reading about one object over one window.
type MetricQuery struct {
	Application string    `json:"application,omitempty"`
	Container   string    `json:"container,omitempty"`
	From        time.Time `json:"from"`
	Machine     string    `json:"machine,omitempty"`
	Scope       string    `json:"scope"`
	Series      string    `json:"series"`
	StepSeconds int       `json:"stepSeconds"`
	To          time.Time `json:"to"`
}

// MetricPoint is one sample. A gap in the underlying data is a GAP — the point
// is absent rather than zero, because "not measured" and "measured as zero"
// are different claims and only one of them is about the workload.
type MetricPoint struct {
	At    time.Time `json:"at"`
	Value float64   `json:"value"`
}

// MetricRange always states where it came from. A chart with no provenance is
// the thing this console spent a release removing.
type MetricRange struct {
	From        time.Time     `json:"from"`
	Note        string        `json:"note,omitempty"`
	Points      []MetricPoint `json:"points"`
	Scope       string        `json:"scope"`
	Series      string        `json:"series"`
	Source      string        `json:"source"`
	StepSeconds int           `json:"stepSeconds"`
	To          time.Time     `json:"to"`
	Unit        string        `json:"unit"`
}

// MetricSource values. `unavailable` is not an error: a cluster with no
// Prometheus has no long-range metrics, and saying so is more useful than an
// empty chart that looks like an idle machine.
const (
	MetricSourcePrometheus  = "prometheus"
	MetricSourceUnavailable = "unavailable"
)

type metricDefinition struct {
	// query is a template with %s placeholders filled from VALIDATED selector
	// values. Nothing else is ever interpolated.
	query string
	unit  string
	// selectors names the query parameters this definition needs, in order.
	selectors []string
}

// The complete set of readings this product serves. A pair absent from here
// has no query and no route.
var metricQueries = map[string]map[string]metricDefinition{
	MetricScopeMachine: {
		"cpu":          {query: `swarmops_machine_cpu_used_ratio{machine=%q}`, unit: "ratio", selectors: []string{"machine"}},
		"cpu-iowait":   {query: `swarmops_machine_cpu_iowait_ratio{machine=%q}`, unit: "ratio", selectors: []string{"machine"}},
		"memory":       {query: `swarmops_machine_memory_used_bytes{machine=%q}`, unit: "bytes", selectors: []string{"machine"}},
		"memory-total": {query: `swarmops_machine_memory_total_bytes{machine=%q}`, unit: "bytes", selectors: []string{"machine"}},
		"load":         {query: `swarmops_machine_load1{machine=%q}`, unit: "load", selectors: []string{"machine"}},
		"network-rx":   {query: `sum(rate(swarmops_machine_network_receive_bytes_total{machine=%q}[5m]))`, unit: "bytes/s", selectors: []string{"machine"}},
		"network-tx":   {query: `sum(rate(swarmops_machine_network_transmit_bytes_total{machine=%q}[5m]))`, unit: "bytes/s", selectors: []string{"machine"}},
		"disk-read":    {query: `sum(rate(swarmops_machine_disk_read_bytes_total{machine=%q}[5m]))`, unit: "bytes/s", selectors: []string{"machine"}},
		"disk-write":   {query: `sum(rate(swarmops_machine_disk_write_bytes_total{machine=%q}[5m]))`, unit: "bytes/s", selectors: []string{"machine"}},
		"containers":   {query: `swarmops_machine_containers{machine=%q}`, unit: "count", selectors: []string{"machine"}},
	},
	MetricScopeContainer: {
		"cpu":          {query: `swarmops_container_cpu_used_ratio{machine=%q,container=%q}`, unit: "ratio", selectors: []string{"machine", "container"}},
		"memory":       {query: `swarmops_container_memory_used_bytes{machine=%q,container=%q}`, unit: "bytes", selectors: []string{"machine", "container"}},
		"memory-limit": {query: `swarmops_container_memory_limit_bytes{machine=%q,container=%q}`, unit: "bytes", selectors: []string{"machine", "container"}},
		"network-rx":   {query: `rate(swarmops_container_network_receive_bytes_total{machine=%q,container=%q}[5m])`, unit: "bytes/s", selectors: []string{"machine", "container"}},
		"network-tx":   {query: `rate(swarmops_container_network_transmit_bytes_total{machine=%q,container=%q}[5m])`, unit: "bytes/s", selectors: []string{"machine", "container"}},
		"block-read":   {query: `rate(swarmops_container_block_read_bytes_total{machine=%q,container=%q}[5m])`, unit: "bytes/s", selectors: []string{"machine", "container"}},
		"block-write":  {query: `rate(swarmops_container_block_write_bytes_total{machine=%q,container=%q}[5m])`, unit: "bytes/s", selectors: []string{"machine", "container"}},
	},
	MetricScopeCluster: {
		"cpu":          {query: `avg(swarmops_machine_cpu_used_ratio)`, unit: "ratio"},
		"memory":       {query: `sum(swarmops_machine_memory_used_bytes)`, unit: "bytes"},
		"memory-total": {query: `sum(swarmops_machine_memory_total_bytes)`, unit: "bytes"},
		"network-rx":   {query: `sum(rate(swarmops_machine_network_receive_bytes_total[5m]))`, unit: "bytes/s"},
		"network-tx":   {query: `sum(rate(swarmops_machine_network_transmit_bytes_total[5m]))`, unit: "bytes/s"},
		"machines":     {query: `sum(swarmops_machine_up)`, unit: "count"},
		"containers":   {query: `sum(swarmops_machine_containers)`, unit: "count"},
	},
	// Traffic comes from the gateway's own metrics rather than from the
	// application. An application that has stopped answering cannot report
	// that it has stopped answering.
	MetricScopeApplication: {
		"requests":    {query: `sum(rate(traefik_service_requests_total{service=~%q}[5m]))`, unit: "req/s", selectors: []string{"applicationService"}},
		"errors":      {query: `sum(rate(traefik_service_requests_total{service=~%q,code=~"5.."}[5m]))`, unit: "req/s", selectors: []string{"applicationService"}},
		"latency-p95": {query: `histogram_quantile(0.95, sum by (le) (rate(traefik_service_request_duration_seconds_bucket{service=~%q}[5m])))`, unit: "seconds", selectors: []string{"applicationService"}},
	},
	MetricScopeGateway: {
		"requests":    {query: `sum(rate(traefik_entrypoint_requests_total[5m]))`, unit: "req/s"},
		"errors":      {query: `sum(rate(traefik_entrypoint_requests_total{code=~"5.."}[5m]))`, unit: "req/s"},
		"latency-p95": {query: `histogram_quantile(0.95, sum by (le) (rate(traefik_entrypoint_request_duration_seconds_bucket[5m])))`, unit: "seconds"},
		"bytes-out":   {query: `sum(rate(traefik_entrypoint_responses_bytes_total[5m]))`, unit: "bytes/s"},
	},
}

// Normalize fills defaults and refuses anything the table does not describe.
// It runs on BOTH sides: the controller checks a browser request, and the
// machine checks again before it builds a query, because the machine does not
// trust that the controller did.
func (q *MetricQuery) Normalize(now time.Time) error {
	q.Scope = strings.TrimSpace(q.Scope)
	q.Series = strings.TrimSpace(q.Series)
	if !metricSeriesPattern.MatchString(q.Series) {
		return fmt.Errorf("unknown metric series")
	}
	definitions, found := metricQueries[q.Scope]
	if !found {
		return fmt.Errorf("unknown metric scope")
	}
	definition, found := definitions[q.Series]
	if !found {
		return fmt.Errorf("%s has no %s series", q.Scope, q.Series)
	}

	if q.To.IsZero() {
		q.To = now.UTC()
	}
	if q.From.IsZero() {
		q.From = q.To.Add(-6 * time.Hour)
	}
	q.From, q.To = q.From.UTC(), q.To.UTC()
	if !q.From.Before(q.To) {
		return fmt.Errorf("from must be before to")
	}
	if q.To.Sub(q.From) > MaxMetricRange {
		return fmt.Errorf("a metric range cannot exceed seven days")
	}

	if q.StepSeconds <= 0 {
		// Aim for a readable number of points rather than a fixed step: an
		// hour and a week should both draw about the same number of marks.
		q.StepSeconds = int(q.To.Sub(q.From).Seconds() / 240)
	}
	step := time.Duration(q.StepSeconds) * time.Second
	if step < MinMetricStep {
		step = MinMetricStep
	}
	if step > MaxMetricStep {
		step = MaxMetricStep
	}
	if points := q.To.Sub(q.From) / step; points > MaxMetricPoints {
		step = q.To.Sub(q.From) / MaxMetricPoints
	}
	q.StepSeconds = int(step.Round(time.Second).Seconds())
	if q.StepSeconds < 1 {
		q.StepSeconds = 1
	}

	q.Application = strings.TrimSpace(q.Application)
	q.Container = strings.TrimSpace(q.Container)
	q.Machine = strings.TrimSpace(q.Machine)
	for _, selector := range definition.selectors {
		value, err := q.selector(selector)
		if err != nil {
			return err
		}
		if !metricSelectorPattern.MatchString(value) {
			return fmt.Errorf("%s reading needs a valid %s", q.Scope, selector)
		}
	}
	return nil
}

func (q MetricQuery) selector(name string) (string, error) {
	switch name {
	case "machine":
		return q.Machine, nil
	case "container":
		return q.Container, nil
	case "applicationService", "application":
		return q.Application, nil
	default:
		return "", fmt.Errorf("unknown metric selector")
	}
}

// Expression builds the query language for a NORMALIZED query.
//
// Every value it interpolates has already matched metricSelectorPattern, which
// admits no quote, brace, backslash, newline or space — so a selector cannot
// close its own label matcher and start a different query. Normalize must have
// returned nil before this is called; it returns an error rather than a query
// if it was not.
func (q MetricQuery) Expression() (string, error) {
	definition, found := metricQueries[q.Scope][q.Series]
	if !found {
		return "", fmt.Errorf("unknown metric reading")
	}
	values := make([]any, 0, len(definition.selectors))
	for _, selector := range definition.selectors {
		value, err := q.selector(selector)
		if err != nil {
			return "", err
		}
		if !metricSelectorPattern.MatchString(value) {
			return "", fmt.Errorf("metric selector was not validated")
		}
		if selector == "applicationService" {
			// Traefik names a service `<name>@<provider>`. Matching the
			// provider suffix rather than naming it keeps this working across
			// swarm, file and docker providers.
			value += "@.*"
		}
		values = append(values, value)
	}
	if len(values) == 0 {
		return definition.query, nil
	}
	return fmt.Sprintf(definition.query, values...), nil
}

// Unit is the unit of the named series, so a caller never has to guess whether
// a number is bytes or a ratio.
func (q MetricQuery) Unit() string { return metricQueries[q.Scope][q.Series].unit }

// MetricSeriesFor lists the readings a scope offers. The console builds its
// charts from this rather than from a list it keeps separately.
func MetricSeriesFor(scope string) []string {
	definitions := metricQueries[scope]
	series := make([]string, 0, len(definitions))
	for name := range definitions {
		series = append(series, name)
	}
	return series
}
