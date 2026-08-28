package insights

import (
	"testing"
	"time"

	"github.com/nimasrn/SwarmOps/internal/domain"
)

// The series is bounded and per target. A shared or unbounded ring would
// either mix two clusters into one line or grow for as long as the API runs.
func TestHistoryKeepsABoundedSeriesPerServer(t *testing.T) {
	t.Parallel()
	history := NewHistory(3)
	for index := 0; index < 5; index++ {
		history.Record("server-a", Sample{At: time.Unix(int64(index), 0).UTC(), ContainersRunning: index})
	}
	history.Record("server-b", Sample{At: time.Unix(99, 0).UTC(), ContainersRunning: 42})

	seriesA := history.Series("server-a")
	if len(seriesA) != 3 {
		t.Fatalf("series length = %d, want 3", len(seriesA))
	}
	if seriesA[0].ContainersRunning != 2 || seriesA[2].ContainersRunning != 4 {
		t.Fatalf("series kept the wrong window: %#v", seriesA)
	}
	if seriesB := history.Series("server-b"); len(seriesB) != 1 || seriesB[0].ContainersRunning != 42 {
		t.Fatalf("second target's series = %#v", seriesB)
	}
	latest, found := history.Latest("server-a")
	if !found || latest.ContainersRunning != 4 {
		t.Fatalf("latest = %#v, found = %v", latest, found)
	}
	history.Forget("server-a")
	if series := history.Series("server-a"); len(series) != 0 {
		t.Fatalf("a forgotten target kept %d samples", len(series))
	}
}

// A reading that cannot be attributed to a target is dropped rather than
// stored under an empty key, where it would be drawn as another cluster's line.
func TestHistoryIgnoresAnUnattributedSample(t *testing.T) {
	t.Parallel()
	history := NewHistory(4)
	history.Record("", Sample{ContainersRunning: 7})
	if series := history.Series(""); len(series) != 0 {
		t.Fatalf("unattributed sample was stored: %#v", series)
	}
}

func TestSampleFromCarriesTheDashboardFigures(t *testing.T) {
	t.Parallel()
	var value domain.Insights
	value.GeneratedAt = time.Unix(1700000000, 0).UTC()
	value.Containers.Running = 4
	value.Containers.Total = 6
	value.Nodes.Ready = 3
	value.Services.RunningTasks = 9
	value.Services.DesiredTasks = 10
	value.Tasks.Failed = 2
	value.Storage.ReclaimableImageBytes = 100
	value.Storage.ReclaimableVolumeBytes = 20
	value.Storage.ReclaimableBuildCacheBytes = 3

	sample := SampleFrom(value)
	if sample.At != value.GeneratedAt || sample.ContainersRunning != 4 || sample.NodesReady != 3 {
		t.Fatalf("sample = %#v", sample)
	}
	if sample.TasksRunning != 9 || sample.TasksDesired != 10 || sample.TasksFailed != 2 {
		t.Fatalf("task figures = %#v", sample)
	}
	if sample.ReclaimableBytes != 123 {
		t.Fatalf("reclaimable = %d, want 123", sample.ReclaimableBytes)
	}
}
