package agentcontrol

import (
	"strings"
	"testing"
	"time"
)

// Reading a metric is a closed vocabulary. These are the ways a caller could
// try to turn it into an open one.

func TestOnlyCataloguedScopeAndSeriesPairsAreAccepted(t *testing.T) {
	now := time.Now().UTC()
	for _, query := range []MetricQuery{
		{Scope: "machine", Series: "requests", Machine: "srv-1"},
		{Scope: "gateway", Series: "cpu"},
		{Scope: "node", Series: "cpu", Machine: "srv-1"},
		{Scope: "machine", Series: "", Machine: "srv-1"},
		{Scope: "", Series: "cpu"},
	} {
		candidate := query
		if err := candidate.Normalize(now); err == nil {
			t.Fatalf("%s/%s is not a catalogued reading and must be refused", query.Scope, query.Series)
		}
	}
	valid := MetricQuery{Scope: MetricScopeMachine, Series: "cpu", Machine: "srv-1"}
	if err := valid.Normalize(now); err != nil {
		t.Fatalf("a catalogued reading must be accepted: %v", err)
	}
}

// A selector becomes a label matcher. If one could carry a quote or a brace it
// could close its own matcher and append a different query.
func TestSelectorsCannotEscapeTheirLabelMatcher(t *testing.T) {
	now := time.Now().UTC()
	for _, machine := range []string{
		`srv-1"} or up{`,
		`srv-1"}[1h]) or vector(1) #`,
		"srv 1",
		"srv-1\nup",
		`srv-1\`,
		"{}",
		"",
	} {
		query := MetricQuery{Scope: MetricScopeMachine, Series: "cpu", Machine: machine}
		if err := query.Normalize(now); err == nil {
			t.Fatalf("%q must be refused as a machine selector", machine)
		}
	}
}

// Expression is the last line: even if Normalize were skipped, it refuses to
// interpolate a value it has not checked itself.
func TestExpressionRefusesAnUnvalidatedSelector(t *testing.T) {
	query := MetricQuery{Scope: MetricScopeMachine, Series: "cpu", Machine: `srv-1"} or up{`}
	if _, err := query.Expression(); err == nil {
		t.Fatal("an unvalidated selector must never reach a query")
	}
}

func TestExpressionBuildsTheCataloguedQuery(t *testing.T) {
	now := time.Now().UTC()
	query := MetricQuery{Scope: MetricScopeContainer, Series: "memory", Machine: "srv-1", Container: "c1f2a3b4c5d6"}
	if err := query.Normalize(now); err != nil {
		t.Fatalf("normalize: %v", err)
	}
	expression, err := query.Expression()
	if err != nil {
		t.Fatalf("expression: %v", err)
	}
	if expression != `swarmops_container_memory_used_bytes{machine="srv-1",container="c1f2a3b4c5d6"}` {
		t.Fatalf("unexpected query: %s", expression)
	}
	if query.Unit() != "bytes" {
		t.Fatalf("a series carries its unit so a caller never guesses: %s", query.Unit())
	}
}

// Traefik names a service `<name>@<provider>`; matching the suffix keeps the
// reading working across the swarm, docker and file providers.
func TestApplicationTrafficMatchesAnyTraefikProvider(t *testing.T) {
	query := MetricQuery{Scope: MetricScopeApplication, Series: "requests", Application: "checkout-api"}
	if err := query.Normalize(time.Now().UTC()); err != nil {
		t.Fatalf("normalize: %v", err)
	}
	expression, err := query.Expression()
	if err != nil {
		t.Fatalf("expression: %v", err)
	}
	if !strings.Contains(expression, `service=~"checkout-api@.*"`) {
		t.Fatalf("unexpected query: %s", expression)
	}
}

// A console chart asking for a week at one-second resolution is 604,800 points
// and a Prometheus that stops answering anything else.
func TestStepIsBoundedSoOneChartCannotOverwhelmPrometheus(t *testing.T) {
	now := time.Now().UTC()
	query := MetricQuery{
		Scope: MetricScopeCluster, Series: "cpu",
		From: now.Add(-7 * 24 * time.Hour), To: now, StepSeconds: 1,
	}
	if err := query.Normalize(now); err != nil {
		t.Fatalf("normalize: %v", err)
	}
	points := int(query.To.Sub(query.From).Seconds()) / query.StepSeconds
	if points > MaxMetricPoints {
		t.Fatalf("expected at most %d points, got %d at a %ds step", MaxMetricPoints, points, query.StepSeconds)
	}
}

func TestRangeIsBounded(t *testing.T) {
	now := time.Now().UTC()
	query := MetricQuery{Scope: MetricScopeCluster, Series: "cpu", From: now.Add(-30 * 24 * time.Hour), To: now}
	if err := query.Normalize(now); err == nil {
		t.Fatal("a thirty-day range is a report, not a console chart, and must be refused")
	}
	backwards := MetricQuery{Scope: MetricScopeCluster, Series: "cpu", From: now, To: now.Add(-time.Hour)}
	if err := backwards.Normalize(now); err == nil {
		t.Fatal("a range that ends before it starts must be refused")
	}
}

// A default has to produce a readable chart without the caller thinking about
// it: an hour and a day should both draw about the same number of marks.
func TestDefaultsProduceAReadableNumberOfPoints(t *testing.T) {
	now := time.Now().UTC()
	for _, window := range []time.Duration{time.Hour, 6 * time.Hour, 24 * time.Hour} {
		query := MetricQuery{Scope: MetricScopeCluster, Series: "cpu", From: now.Add(-window), To: now}
		if err := query.Normalize(now); err != nil {
			t.Fatalf("normalize %v: %v", window, err)
		}
		points := int(window.Seconds()) / query.StepSeconds
		if points < 60 || points > MaxMetricPoints {
			t.Fatalf("a %v window drew %d points at a %ds step", window, points, query.StepSeconds)
		}
	}
}

func TestEveryCataloguedReadingBuildsAQuery(t *testing.T) {
	now := time.Now().UTC()
	for scope, definitions := range metricQueries {
		for series := range definitions {
			query := MetricQuery{
				Application: "checkout-api",
				Container:   "c1f2a3b4c5d6",
				Machine:     "srv-1",
				Scope:       scope,
				Series:      series,
			}
			if err := query.Normalize(now); err != nil {
				t.Fatalf("%s/%s did not normalize: %v", scope, series, err)
			}
			expression, err := query.Expression()
			if err != nil {
				t.Fatalf("%s/%s did not build: %v", scope, series, err)
			}
			if strings.Contains(expression, "%!") {
				t.Fatalf("%s/%s has a placeholder its selectors do not fill: %s", scope, series, expression)
			}
			if query.Unit() == "" {
				t.Fatalf("%s/%s has no unit", scope, series)
			}
		}
	}
}
