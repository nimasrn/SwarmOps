package apihttp

import (
	"testing"
	"time"

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
