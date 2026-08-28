package apihttp

import (
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestParseLogQueryBounds(t *testing.T) {
	now := time.Now().UTC()
	request := httptest.NewRequest("GET", "/api/v1/logs?from="+now.Add(-time.Hour).Format(time.RFC3339Nano)+"&to="+now.Format(time.RFC3339Nano)+"&sourceKind=container&search=literal&limit=1000", nil)
	query, err := parseLogQuery(request)
	if err != nil {
		t.Fatal(err)
	}
	if query.SourceKind != "container" || query.Limit != 1000 {
		t.Fatalf("query=%+v", query)
	}
	for _, raw := range []string{"/api/v1/logs?node=../../etc/passwd", "/api/v1/logs?limit=1001", "/api/v1/logs?search=" + strings.Repeat("x", 257), "/api/v1/logs?sourceKind=unknown"} {
		if _, err := parseLogQuery(httptest.NewRequest("GET", raw, nil)); err == nil {
			t.Fatalf("accepted %s", raw)
		}
	}
}
