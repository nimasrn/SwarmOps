package agentcontrol

import (
	"fmt"
	"strings"
	"time"
)

const (
	DefaultLogLimit = 200
	MaxLogLimit     = 1000
	MaxLogRange     = 7 * 24 * time.Hour
	MaxLogSearch    = 256
)

type LogRecord struct {
	ID          string    `json:"id"`
	Timestamp   time.Time `json:"timestamp"`
	Level       string    `json:"level"`
	SourceKind  string    `json:"sourceKind"`
	Node        string    `json:"node,omitempty"`
	Stack       string    `json:"stack,omitempty"`
	Service     string    `json:"service,omitempty"`
	ContainerID string    `json:"containerId,omitempty"`
	Stream      string    `json:"stream,omitempty"`
	Unit        string    `json:"unit,omitempty"`
	Identifier  string    `json:"identifier,omitempty"`
	Message     string    `json:"message"`
}

type LogQuery struct {
	From       time.Time `json:"from"`
	To         time.Time `json:"to"`
	Level      string    `json:"level,omitempty"`
	SourceKind string    `json:"sourceKind,omitempty"`
	Node       string    `json:"node,omitempty"`
	Stack      string    `json:"stack,omitempty"`
	Service    string    `json:"service,omitempty"`
	Container  string    `json:"container,omitempty"`
	Unit       string    `json:"unit,omitempty"`
	Search     string    `json:"search,omitempty"`
	Limit      int       `json:"limit"`
	Cursor     string    `json:"cursor,omitempty"`
}

type LogFacets struct {
	Levels      []string `json:"levels"`
	SourceKinds []string `json:"sourceKinds"`
	Nodes       []string `json:"nodes"`
	Stacks      []string `json:"stacks"`
	Services    []string `json:"services"`
	Units       []string `json:"units"`
}

type LogPage struct {
	Records    []LogRecord `json:"records"`
	NextCursor string      `json:"nextCursor,omitempty"`
	Truncated  bool        `json:"truncated"`
	Facets     LogFacets   `json:"facets"`
}

type LogStatus struct {
	Healthy           bool      `json:"healthy"`
	Forwarders        int       `json:"forwarders"`
	ExpectedNodes     int       `json:"expectedNodes"`
	BufferBytes       int64     `json:"bufferBytes"`
	RetainedBytes     int64     `json:"retainedBytes"`
	Oldest            time.Time `json:"oldest,omitempty"`
	Newest            time.Time `json:"newest,omitempty"`
	RetentionSeconds  int64     `json:"retentionSeconds"`
	CapacityBytes     int64     `json:"capacityBytes"`
	CapacityEvictions uint64    `json:"capacityEvictions"`
	DroppedRecords    uint64    `json:"droppedRecords"`
	MalformedRecords  uint64    `json:"malformedRecords"`
	LastCleanupAt     time.Time `json:"lastCleanupAt,omitempty"`
	Warnings          []string  `json:"warnings"`
}

func (q *LogQuery) Normalize(now time.Time) error {
	if q.To.IsZero() {
		q.To = now.UTC()
	}
	if q.From.IsZero() {
		q.From = q.To.Add(-time.Hour)
	}
	q.From, q.To = q.From.UTC(), q.To.UTC()
	if !q.From.Before(q.To) {
		return fmt.Errorf("from must be before to")
	}
	if q.To.Sub(q.From) > MaxLogRange {
		return fmt.Errorf("log range cannot exceed seven days")
	}
	if q.Limit == 0 {
		q.Limit = DefaultLogLimit
	}
	if q.Limit < 1 || q.Limit > MaxLogLimit {
		return fmt.Errorf("limit must be between 1 and %d", MaxLogLimit)
	}
	q.Search = strings.TrimSpace(q.Search)
	if len(q.Search) > MaxLogSearch {
		return fmt.Errorf("search cannot exceed %d characters", MaxLogSearch)
	}
	if strings.ContainsAny(q.Search, "\x00\r\n") {
		return fmt.Errorf("search must be one literal line")
	}
	for name, value := range map[string]string{"level": q.Level, "sourceKind": q.SourceKind, "node": q.Node, "stack": q.Stack, "service": q.Service, "container": q.Container, "unit": q.Unit} {
		if len(value) > 128 || strings.ContainsAny(value, "\x00\r\n/\\") {
			return fmt.Errorf("%s filter is invalid", name)
		}
	}
	if q.Level != "" && !logOneOf(q.Level, "trace", "debug", "info", "warn", "error", "fatal") {
		return fmt.Errorf("level filter is invalid")
	}
	if q.SourceKind != "" && !logOneOf(q.SourceKind, "container", "host", "docker", "traefik", "core", "agent", "fluentd") {
		return fmt.Errorf("sourceKind filter is invalid")
	}
	return nil
}

func logOneOf(value string, allowed ...string) bool {
	for _, candidate := range allowed {
		if value == candidate {
			return true
		}
	}
	return false
}
