package diagnosis

import (
	"strings"
	"testing"
	"time"

	"github.com/nimasrn/SwarmOps/internal/domain"
)

func now() time.Time { return time.Date(2026, 8, 27, 14, 22, 0, 0, time.UTC) }

func node(host, id string, labels map[string]string, freeBytes, capBytes uint64, healthy bool) domain.Node {
	return domain.Node{
		Hostname: host, ID: id, Role: "worker", Labels: labels,
		Agent: domain.NodeAgent{Healthy: healthy},
		Disk:  domain.Capacity{Capacity: capBytes, Used: capBytes - freeBytes},
	}
}

func baseFacts() Facts {
	return Facts{
		Service:   domain.Service{Name: "api-gateway", DesiredTasks: 3, RunningTasks: 2},
		Nodes:     []domain.Node{node("worker-01", "n1", map[string]string{"tier": "edge"}, 8e9, 40e9, true)},
		ProbedAt:  now().Add(-22 * time.Second),
		ClusterAt: now().Add(-4 * time.Second),
		Now:       now(),
	}
}

func TestConvergedServiceIsRefusedNotDiagnosed(t *testing.T) {
	f := baseFacts()
	f.Service.RunningTasks = 3
	got := NewEngine().Diagnose(f)
	if got.Chain != nil {
		t.Fatalf("diagnosed a healthy service: %s", got.Chain.Rule)
	}
	if got.Refusal == nil || !strings.Contains(got.Refusal.Reason, "nothing to explain") {
		t.Fatalf("want a refusal explaining there is nothing wrong, got %+v", got.Refusal)
	}
}

func TestUnsatisfiableConstraintIsNamed(t *testing.T) {
	f := baseFacts()
	f.Constraints = []string{"node.labels.tier==gpu"}
	got := NewEngine().Diagnose(f)
	if got.Chain == nil {
		t.Fatal("expected a chain")
	}
	if got.Chain.Rule != "constraint-unsatisfiable" {
		t.Fatalf("wrong rule fired: %s", got.Chain.Rule)
	}
	if len(got.Chain.Actions) == 0 {
		t.Fatal("a chain with no action has diagnosed nothing")
	}
	for _, l := range got.Chain.Links {
		if l.Claim == "" {
			t.Fatal("a link with no claim")
		}
	}
}

// The engine must not report "no node matches" when the truth is that it does
// not understand the constraint. This is the difference between a diagnosis
// engine and a confident liar.
func TestUnknownConstraintSyntaxDeclinesRatherThanGuessing(t *testing.T) {
	f := baseFacts()
	f.Constraints = []string{"node.platform.os in (linux,windows)"}
	got := NewEngine().Diagnose(f)
	if got.Chain != nil {
		t.Fatalf("guessed at a constraint form it does not implement: %s", got.Chain.Rule)
	}
	if got.Refusal == nil {
		t.Fatal("want a refusal")
	}
}

func TestImageTooLargeForEveryEligibleNode(t *testing.T) {
	f := baseFacts()
	f.Nodes = []domain.Node{node("worker-03", "n3", nil, 1.4e9, 40e9, true)}
	f.ImageBytes, f.ImageKnown = 2.1e9, true
	got := NewEngine().Diagnose(f)
	if got.Chain == nil || got.Chain.Rule != "node-cannot-hold-image" {
		t.Fatalf("want node-cannot-hold-image, got %+v", got)
	}
	if !strings.Contains(got.Chain.Links[1].Claim, "worker-03") {
		t.Fatalf("the claim should name the node it measured: %q", got.Chain.Links[1].Claim)
	}
	if len(got.Chain.Caveats) == 0 {
		t.Fatal("a disk-only conclusion must state that it is disk-only")
	}
}

func TestImageFitsSomewhereIsNotThisExplanation(t *testing.T) {
	f := baseFacts()
	f.Nodes = []domain.Node{
		node("worker-03", "n3", nil, 1.4e9, 40e9, true),
		node("worker-04", "n4", nil, 9e9, 40e9, true),
	}
	f.ImageBytes, f.ImageKnown = 2.1e9, true
	if got := NewEngine().Diagnose(f); got.Chain != nil {
		t.Fatalf("blamed disk when the image fits on worker-04: %s", got.Chain.Rule)
	}
}

// Stale capacity is not evidence. A rule reasoning from a five-minute-old disk
// reading is guessing about a cluster that has since changed.
func TestStaleProbeStopsTheDiskRule(t *testing.T) {
	f := baseFacts()
	f.Nodes = []domain.Node{node("worker-03", "n3", nil, 1.4e9, 40e9, true)}
	f.ImageBytes, f.ImageKnown = 2.1e9, true
	f.ProbedAt = now().Add(-10 * time.Minute)
	if got := NewEngine().Diagnose(f); got.Chain != nil {
		t.Fatalf("reasoned from a stale probe: %s", got.Chain.Rule)
	}
}

// A silent host has unknown capacity, not zero. Treating it as full would
// invent a constraint that does not exist.
func TestSilentHostIsExcludedAndDisclosed(t *testing.T) {
	f := baseFacts()
	f.Nodes = []domain.Node{
		node("worker-03", "n3", nil, 1.4e9, 40e9, true),
		node("worker-05", "n5", nil, 0, 0, false),
	}
	f.ImageBytes, f.ImageKnown = 2.1e9, true
	got := NewEngine().Diagnose(f)
	if got.Chain == nil {
		t.Fatal("expected a chain")
	}
	joined := strings.Join(got.Chain.Caveats, " ")
	if !strings.Contains(joined, "worker-05") {
		t.Fatalf("a silent host must be disclosed, got caveats: %v", got.Chain.Caveats)
	}
}

func TestUnknownImageSizeDeclines(t *testing.T) {
	f := baseFacts()
	f.Nodes = []domain.Node{node("worker-03", "n3", nil, 1.4e9, 40e9, true)}
	f.ImageKnown = false
	if got := NewEngine().Diagnose(f); got.Chain != nil {
		t.Fatalf("compared against an unknown image size: %s", got.Chain.Rule)
	}
}

func TestFailingTaskIsDistinguishedFromPlacement(t *testing.T) {
	f := baseFacts()
	f.Tasks = []domain.Task{{ID: "t3", NodeID: "n1", DesiredState: "running", Error: "task: non-zero exit (1)"}}
	got := NewEngine().Diagnose(f)
	if got.Chain == nil || got.Chain.Rule != "task-failing" {
		t.Fatalf("want task-failing, got %+v", got)
	}
	if !strings.Contains(got.Chain.Links[1].Claim, "worker-01") {
		t.Fatalf("should name the host by hostname, not id: %q", got.Chain.Links[1].Claim)
	}
}

// A specific, actionable explanation must win over the catch-all.
func TestSpecificRuleBeatsTheCatchAll(t *testing.T) {
	f := baseFacts()
	f.Constraints = []string{"node.labels.tier==gpu"}
	f.Tasks = []domain.Task{{ID: "t3", DesiredState: "running", Error: "boom"}}
	got := NewEngine().Diagnose(f)
	if got.Chain == nil || got.Chain.Rule != "constraint-unsatisfiable" {
		t.Fatalf("the catch-all pre-empted a specific rule: %+v", got.Chain)
	}
}

func TestNoRuleFiresReturnsRefusalWithEvidence(t *testing.T) {
	f := baseFacts() // 2/3 tasks, no constraints, no error, no image size
	got := NewEngine().Diagnose(f)
	if got.Chain != nil {
		t.Fatalf("invented an explanation: %s", got.Chain.Rule)
	}
	if got.Refusal == nil || len(got.Refusal.Evidence) == 0 {
		t.Fatal("a refusal must still hand over what was measured")
	}
	if !strings.Contains(got.Refusal.Reason, "rules") {
		t.Fatalf("the refusal should say what was checked: %q", got.Refusal.Reason)
	}
}

func TestEveryRuleIsNamedAndEveryChainCarriesItsRule(t *testing.T) {
	e := NewEngine()
	if len(e.Rules()) == 0 {
		t.Fatal("the engine must be able to say what it can explain")
	}
	for _, name := range e.Rules() {
		if name == "" {
			t.Fatal("an unnamed rule cannot be traced from a wrong answer")
		}
	}
}

// The trail must be derived from the links, never assembled separately: a
// trail listing a measurement the chain did not use would be documenting
// reasoning that did not happen.
func TestEvidenceTrailIsExactlyWhatTheLinksUsed(t *testing.T) {
	f := baseFacts()
	f.Constraints = []string{"node.labels.tier==gpu"}
	got := NewEngine().Diagnose(f)
	if got.Chain == nil {
		t.Fatal("expected a chain")
	}
	linkEvidence := 0
	for _, link := range got.Chain.Links {
		if link.Evidence != nil {
			linkEvidence++
		}
	}
	if len(got.Chain.Evidence) != linkEvidence {
		t.Fatalf("trail has %d entries for %d evidenced links", len(got.Chain.Evidence), linkEvidence)
	}
	for i, e := range got.Chain.Evidence {
		if e.Label == "" || e.Source == "" {
			t.Fatalf("trail entry %d is unattributed: %+v", i, e)
		}
	}
}

// The comparison belongs to the rule. A fixed list on the page would be
// marketing; a different failure genuinely costs a different number of steps.
func TestEachRuleStatesWhatTheSameAnswerCostsElsewhere(t *testing.T) {
	cases := []struct {
		name  string
		facts func() Facts
	}{
		{"constraint", func() Facts { f := baseFacts(); f.Constraints = []string{"node.labels.tier==gpu"}; return f }},
		{"disk", func() Facts {
			f := baseFacts()
			f.Nodes = []domain.Node{node("worker-03", "n3", nil, 1.4e9, 40e9, true)}
			f.ImageBytes, f.ImageKnown = 2.1e9, true
			return f
		}},
		{"failing", func() Facts {
			f := baseFacts()
			f.Tasks = []domain.Task{{ID: "t3", NodeID: "n1", DesiredState: "running", Error: "non-zero exit"}}
			return f
		}},
	}
	seen := map[string]bool{}
	for _, tc := range cases {
		got := NewEngine().Diagnose(tc.facts())
		if got.Chain == nil {
			t.Fatalf("%s: expected a chain", tc.name)
		}
		if got.Chain.Elsewhere == nil || len(got.Chain.Elsewhere.Commands) == 0 {
			t.Fatalf("%s: no comparison stated", tc.name)
		}
		if got.Chain.Elsewhere.Note == "" {
			t.Fatalf("%s: the comparison must say what the final step demands", tc.name)
		}
		key := strings.Join(got.Chain.Elsewhere.Commands, "|")
		if seen[key] {
			t.Fatalf("%s: reused another rule's command list — then it is not a claim about this failure", tc.name)
		}
		seen[key] = true
	}
}
