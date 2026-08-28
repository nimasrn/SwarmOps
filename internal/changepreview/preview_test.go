package changepreview

import (
	"strings"
	"testing"

	"github.com/nimasrn/SwarmOps/internal/domain"
)

func svc(replicas uint64, update domain.UpdatePolicy) domain.Service {
	return domain.Service{
		ID: "s1", Name: "api-gateway", Stack: "production",
		Image: "ghcr.io/nimasrn/api-gateway:7c41b8e", DesiredTasks: replicas, Update: update,
	}
}

func find(p Preview, label string) (Consequence, bool) {
	for _, c := range p.Consequences {
		if c.Label == label {
			return c, true
		}
	}
	return Consequence{}, false
}

// The reassuring figure has to be earned. Three replicas rolled one at a time
// keeps serving; the preview may say so.
func TestServingIsGoodWhenCapacityRemains(t *testing.T) {
	p := ForImageChange(svc(3, domain.UpdatePolicy{Known: true, Parallelism: 1, MonitorSecond: 20, FailureAction: "rollback"}), "api-gateway:9f2c1ab", nil)
	c, ok := find(p, "Serving during rollout")
	if !ok || c.Value != "yes" || c.Tone != "good" {
		t.Fatalf("want a reassuring serving figure, got %+v", c)
	}
	if !strings.Contains(c.Note, "2 of 3") {
		t.Fatalf("it should say how much capacity remains: %q", c.Note)
	}
}

// A single replica cannot be replaced without a gap, and the preview must not
// imply otherwise. This is the case a dry-run never tells you about.
func TestSingleReplicaIsAGapAndSaysSo(t *testing.T) {
	p := ForImageChange(svc(1, domain.UpdatePolicy{Known: true, Parallelism: 1}), "api-gateway:9f2c1ab", nil)
	c, _ := find(p, "Serving during rollout")
	if c.Value != "no" || c.Tone != "caution" {
		t.Fatalf("a one-replica service cannot keep serving: %+v", c)
	}
	if !strings.Contains(c.Note, "Scale to two") {
		t.Fatalf("say what to do about it: %q", c.Note)
	}
}

// Parallelism equal to the replica count replaces everything at once, which
// looks like a rolling update and is not one.
func TestParallelismCoveringEveryTaskIsNotRolling(t *testing.T) {
	p := ForImageChange(svc(3, domain.UpdatePolicy{Known: true, Parallelism: 3}), "x:2", nil)
	c, _ := find(p, "Serving during rollout")
	if c.Value != "no" {
		t.Fatalf("parallelism 3 of 3 is not a rolling update: %+v", c)
	}
}

// Docker's default failure action is pause, not rollback. Claiming automatic
// rollback the cluster never agreed to is the exact false confidence this
// package exists to avoid.
func TestUnconfiguredServiceDoesNotPromiseRollback(t *testing.T) {
	p := ForImageChange(svc(3, domain.UpdatePolicy{}), "x:2", nil)
	if strings.Contains(strings.ToLower(p.Rollback), "automatically") {
		t.Fatalf("promised a rollback nobody configured: %q", p.Rollback)
	}
	if !strings.Contains(p.Rollback, "PAUSES") {
		t.Fatalf("state Docker's actual default: %q", p.Rollback)
	}
	joined := strings.Join(p.Unknowns, " ")
	if !strings.Contains(joined, "no update policy") {
		t.Fatal("an unconfigured service must have that disclosed as an unknown")
	}
}

func TestConfiguredRollbackIsReportedAsSuch(t *testing.T) {
	p := ForImageChange(svc(3, domain.UpdatePolicy{Known: true, Parallelism: 1, FailureAction: "rollback"}), "x:2", nil)
	if !strings.Contains(p.Rollback, "automatically") {
		t.Fatalf("this service does roll back: %q", p.Rollback)
	}
}

// continue-on-failure is the dangerous one and must be stated plainly.
func TestContinueOnFailureIsCalledOut(t *testing.T) {
	p := ForImageChange(svc(3, domain.UpdatePolicy{Known: true, Parallelism: 1, FailureAction: "continue"}), "x:2", nil)
	if !strings.Contains(p.Rollback, "whether or not the new image works") {
		t.Fatalf("continue-on-failure must be stated bluntly: %q", p.Rollback)
	}
}

// Sharing a stack is evidence of a dependency, not proof, and the wording has
// to carry that distinction.
func TestStackPeersAreEvidenceNotProof(t *testing.T) {
	peers := []domain.Service{{ID: "s1", Name: "api-gateway"}, {ID: "s2", Name: "checkout"}, {ID: "s3", Name: "billing"}}
	p := ForImageChange(svc(3, domain.UpdatePolicy{Known: true, Parallelism: 1}), "x:2", peers)
	c, _ := find(p, "Sharing this stack")
	if c.Value != "2" {
		t.Fatalf("the service itself must not count as its own peer: %+v", c)
	}
	if !strings.Contains(c.Note, "not proof") {
		t.Fatalf("do not overstate the relationship: %q", c.Note)
	}
}

func TestStepsCoverEveryReplicaAndEndConverged(t *testing.T) {
	p := ForImageChange(svc(3, domain.UpdatePolicy{Known: true, Parallelism: 1, MonitorSecond: 20}), "x:2", nil)
	replaced := 0
	for _, s := range p.Steps {
		if strings.HasPrefix(s.Title, "Replace ") {
			replaced++
		}
	}
	if replaced != 3 {
		t.Fatalf("want a step per task, got %d", replaced)
	}
	if p.Steps[len(p.Steps)-1].Title != "Converged" {
		t.Fatalf("the sequence must end converged: %+v", p.Steps[len(p.Steps)-1])
	}
	if p.Steps[0].Mark != "before any stop" {
		t.Fatal("the pull happens before anything is stopped, and that ordering is the reassurance")
	}
}

func TestStartFirstIsSurfacedWhenConfigured(t *testing.T) {
	p := ForImageChange(svc(2, domain.UpdatePolicy{Known: true, Parallelism: 1, Order: "start-first"}), "x:2", nil)
	found := false
	for _, s := range p.Steps {
		if strings.Contains(s.Title, "Start replacements before") {
			found = true
		}
	}
	if !found {
		t.Fatal("start-first changes what happens and must appear in the sequence")
	}
}

// There is always at least one unknown, because whether an image starts is
// only knowable by running it.
func TestUnknownsAreNeverEmpty(t *testing.T) {
	p := ForImageChange(svc(3, domain.UpdatePolicy{Known: true, Parallelism: 1, FailureAction: "rollback"}), "x:2", nil)
	if len(p.Unknowns) < 2 {
		t.Fatalf("a preview that promises everything is lying: %+v", p.Unknowns)
	}
}

// The diff shows the image moving and everything else holding still. An
// operator approving a deploy is checking that nothing ELSE changed, so the
// context lines are the substance rather than decoration.
func TestDiffShowsTheImageMovingAndTheRestHolding(t *testing.T) {
	service := svc(3, domain.UpdatePolicy{Known: true, Parallelism: 1})
	service.Constraints = []string{"node.labels.tier==edge"}
	p := ForImageChange(service, "ghcr.io/nimasrn/api-gateway:9f2c1ab", nil)

	var removed, added int
	for _, line := range p.Diff {
		if line.Kind == "removed" {
			removed++
			if !strings.Contains(line.Text, "7c41b8e") {
				t.Fatalf("the removed line must be the old image: %q", line.Text)
			}
		}
		if line.Kind == "added" {
			added++
			if !strings.Contains(line.Text, "9f2c1ab") {
				t.Fatalf("the added line must be the new image: %q", line.Text)
			}
		}
	}
	if removed != 1 || added != 1 {
		t.Fatalf("exactly one line moves; got %d removed and %d added", removed, added)
	}
	joined := ""
	for _, line := range p.Diff {
		joined += line.Text + "\n"
	}
	for _, want := range []string{"replicas: 3", "node.labels.tier==edge", "parallelism 1"} {
		if !strings.Contains(joined, want) {
			t.Fatalf("context is missing %q — the reader cannot confirm it held still:\n%s", want, joined)
		}
	}
}
