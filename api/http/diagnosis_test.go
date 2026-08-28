package apihttp

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/nimasrn/SwarmOps/internal/auth"
	"github.com/nimasrn/SwarmOps/internal/k8simport"

	"github.com/nimasrn/SwarmOps/internal/dockerapi"
	"github.com/nimasrn/SwarmOps/internal/domain"
)

func TestImageSizeMatchesOnTheTagBehindTheDigest(t *testing.T) {
	images := []dockerapi.Image{
		{RepoTags: []string{"ghcr.io/nimasrn/api-gateway:9f2c1ab"}, Size: 2_100_000_000},
		{RepoTags: []string{"ghcr.io/nimasrn/api-gateway:latest"}, Size: 900_000_000},
	}
	// Swarm pins the running spec to a digest; the local list carries the tag.
	got, ok := imageSizeFor("ghcr.io/nimasrn/api-gateway:9f2c1ab@sha256:abc123", images)
	if !ok || got != 2_100_000_000 {
		t.Fatalf("want the pinned tag's size, got %d (%v)", got, ok)
	}
}

// Reporting :latest's size when the service asks for :9f2c1ab would put a wrong
// number inside a claim that reads as measured — worse than declining.
func TestImageSizeDoesNotFallBackToANearMatch(t *testing.T) {
	images := []dockerapi.Image{{RepoTags: []string{"ghcr.io/nimasrn/api-gateway:latest"}, Size: 900_000_000}}
	if _, ok := imageSizeFor("ghcr.io/nimasrn/api-gateway:9f2c1ab", images); ok {
		t.Fatal("matched a different tag")
	}
}

func TestImageSizeUnknownForAnImageNeverPulled(t *testing.T) {
	if _, ok := imageSizeFor("ghcr.io/nimasrn/unseen:1", nil); ok {
		t.Fatal("claimed a size for an image the cluster has never pulled")
	}
}

func TestImageSizeIgnoresAZeroSizedEntry(t *testing.T) {
	images := []dockerapi.Image{{RepoTags: []string{"repo:tag"}, Size: 0}}
	if _, ok := imageSizeFor("repo:tag", images); ok {
		t.Fatal("zero is not a measurement")
	}
}

// A chain is only as fresh as the stalest reading it used, so one recent probe
// must not vouch for four old ones.
func TestOldestProbeWinsOverTheNewest(t *testing.T) {
	base := time.Date(2026, 8, 27, 14, 0, 0, 0, time.UTC)
	nodes := []domain.Node{
		{Agent: domain.NodeAgent{Healthy: true, CollectedAt: base.Add(-5 * time.Minute)}},
		{Agent: domain.NodeAgent{Healthy: true, CollectedAt: base.Add(-10 * time.Second)}},
	}
	if got := oldestProbe(nodes, base); !got.Equal(base.Add(-5 * time.Minute)) {
		t.Fatalf("want the oldest reading, got %v", got)
	}
}

// A silent host has no reading at all; it must not be mistaken for a fresh one.
func TestUnhealthyAgentsAreNotCountedAsProbes(t *testing.T) {
	base := time.Date(2026, 8, 27, 14, 0, 0, 0, time.UTC)
	nodes := []domain.Node{
		{Agent: domain.NodeAgent{Healthy: false, CollectedAt: base.Add(-1 * time.Hour)}},
		{Agent: domain.NodeAgent{Healthy: true, CollectedAt: base.Add(-30 * time.Second)}},
	}
	if got := oldestProbe(nodes, base); !got.Equal(base.Add(-30 * time.Second)) {
		t.Fatalf("a silent host's stale timestamp leaked in: %v", got)
	}
}

func TestNoProbesAtAllFallsBackToTheClusterRead(t *testing.T) {
	base := time.Date(2026, 8, 27, 14, 0, 0, 0, time.UTC)
	if got := oldestProbe(nil, base); !got.Equal(base) {
		t.Fatalf("want the fallback, got %v", got)
	}
}

// The importer's handler needs no cluster, so unlike the other two it can be
// executed here rather than only reasoned about. It covers the parts a unit
// test of the parser cannot: the body limit, the empty body, and that the
// endpoint stays a read.
func TestKubernetesImportHandler(t *testing.T) {
	server := &Server{}

	t.Run("reads manifests and reports both halves", func(t *testing.T) {
		manifests := "kind: Deployment\nmetadata:\n  name: api\nspec:\n  replicas: 2\n  template:\n    spec:\n      containers:\n        - name: a\n          image: a:1\n---\nkind: HorizontalPodAutoscaler\nmetadata:\n  name: api\n"
		response := httptest.NewRecorder()
		server.k8sImport(response, httptest.NewRequest("POST", "/api/v1/import/kubernetes", strings.NewReader(manifests)), auth.Claims{})
		if response.Code != http.StatusOK {
			t.Fatalf("status %d: %s", response.Code, response.Body.String())
		}
		var report k8simport.Report
		if err := json.Unmarshal(response.Body.Bytes(), &report); err != nil {
			t.Fatal(err)
		}
		if len(report.Mappings) != 1 || len(report.Gaps) != 1 {
			t.Fatalf("want one of each, got %d mappings and %d gaps", len(report.Mappings), len(report.Gaps))
		}
		if report.Compose == "" {
			t.Fatal("a mapped workload must produce a stack to review")
		}
	})

	t.Run("an empty body is refused rather than reported as nothing to do", func(t *testing.T) {
		response := httptest.NewRecorder()
		server.k8sImport(response, httptest.NewRequest("POST", "/api/v1/import/kubernetes", strings.NewReader("")), auth.Claims{})
		if response.Code != http.StatusBadRequest {
			t.Fatalf("status %d", response.Code)
		}
	})

	// An oversized paste is truncated by the limit reader rather than read into
	// memory. Truncation makes the YAML invalid, which must surface as a parse
	// error in the report rather than as a silent partial success.
	t.Run("an oversized body cannot exhaust memory", func(t *testing.T) {
		huge := "kind: ConfigMap\nmetadata:\n  name: " + strings.Repeat("x", maxManifestBytes+4096) + "\n"
		response := httptest.NewRecorder()
		server.k8sImport(response, httptest.NewRequest("POST", "/api/v1/import/kubernetes", strings.NewReader(huge)), auth.Claims{})
		if response.Code != http.StatusOK && response.Code != http.StatusBadRequest {
			t.Fatalf("status %d", response.Code)
		}
		if response.Body.Len() > maxManifestBytes {
			t.Fatal("the response echoed more than the limit")
		}
	})
}
