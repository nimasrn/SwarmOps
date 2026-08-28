package diagnosis

import (
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/nimasrn/SwarmOps/internal/domain"
)

// MaxEvidenceAge is how old a measurement may be and still support a claim.
// Placement facts change on the timescale of a deploy, so a minute is
// generous; beyond it the engine would be reasoning about a cluster that no
// longer exists.
const MaxEvidenceAge = 90 * time.Second

// Facts is everything a rule may reason from. It is passed by value and never
// mutated: a rule that could change the facts could make its own claim true.
type Facts struct {
	Service domain.Service
	Tasks   []domain.Task
	Nodes   []domain.Node
	// ImageBytes is the size of the service's image where the registry manifest
	// was readable. Zero means unknown, which is different from zero bytes and
	// is why rules must check Known rather than compare against 0.
	ImageBytes uint64
	ImageKnown bool
	// Constraints are the service's placement constraints, as authored:
	// "node.labels.tier==edge".
	Constraints []string
	// ProbedAt is when the host readings in Nodes were taken.
	ProbedAt time.Time
	// ClusterAt is when the swarm state was read.
	ClusterAt time.Time
	Now       time.Time
}

// Rule is one explanation the engine knows how to make.
//
// Evaluate returns nil when the rule does not apply OR when it applies but
// cannot obtain the measurements it needs. Those are deliberately the same
// outcome: in both cases the rule has nothing honest to say, and a rule that
// distinguished them would be tempted to speak anyway.
type Rule interface {
	Name() string
	Evaluate(Facts) *Chain
}

// Engine evaluates rules in order and returns the first chain produced.
//
// Order is significance, not convenience: the first rule that fires wins, so
// the most specific and most actionable explanations are registered first. A
// rule that would fire for many unrelated failures belongs last or nowhere.
type Engine struct {
	rules []Rule
}

// NewEngine returns the engine with the default rule set.
func NewEngine() *Engine {
	return &Engine{rules: []Rule{
		constraintUnsatisfiable{},
		nodeCannotHoldImage{},
		taskFailing{},
	}}
}

// Rules names the registered rules, in evaluation order. Exposed so the console
// can show an operator what the engine is able to explain — an engine whose
// vocabulary is secret cannot be trusted at the edges of it.
func (e *Engine) Rules() []string {
	out := make([]string, 0, len(e.rules))
	for _, r := range e.rules {
		out = append(out, r.Name())
	}
	return out
}

// Diagnose returns a chain, or a refusal naming what was checked.
func (e *Engine) Diagnose(f Facts) Result {
	if f.Now.IsZero() {
		f.Now = time.Now()
	}
	if f.Service.RunningTasks >= f.Service.DesiredTasks && f.Service.DesiredTasks > 0 {
		return Result{Refusal: &Refusal{
			Subject:  f.Service.Name,
			Reason:   "This service is running every task it was asked to run. There is nothing to explain.",
			Evidence: []Evidence{taskEvidence(f)},
		}}
	}
	for _, r := range e.rules {
		if chain := r.Evaluate(f); chain != nil {
			return Result{Chain: chain}
		}
	}
	return Result{Refusal: &Refusal{
		Subject: f.Service.Name,
		Reason: fmt.Sprintf(
			"None of the %d rules SwarmOps knows can explain this from the measurements available. The evidence gathered is below; the service's task history and logs are the next place to look.",
			len(e.rules)),
		Evidence: gatherEvidence(f),
	}}
}

// --- shared helpers ---------------------------------------------------------

func taskEvidence(f Facts) Evidence {
	return Evidence{
		Label:      fmt.Sprintf("%d/%d tasks", f.Service.RunningTasks, f.Service.DesiredTasks),
		Source:     "swarm manager",
		ObservedAt: f.ClusterAt,
	}
}

func gatherEvidence(f Facts) []Evidence {
	out := []Evidence{taskEvidence(f)}
	if f.ImageKnown {
		out = append(out, Evidence{
			Label:      fmt.Sprintf("image %s", humanBytes(f.ImageBytes)),
			Source:     "registry manifest",
			ObservedAt: f.ClusterAt,
		})
	}
	probes := 0
	for _, n := range f.Nodes {
		if n.Agent.Healthy {
			probes++
		}
	}
	out = append(out, Evidence{
		Label:      fmt.Sprintf("%d/%d hosts reporting", probes, len(f.Nodes)),
		Source:     "read-only host probes",
		ObservedAt: f.ProbedAt,
	})
	return out
}

// probeCaveat is appended wherever a chain reasoned about host capacity while
// some hosts were silent — the conclusion may be right and the engine still
// cannot see every node.
func probeCaveat(f Facts) []string {
	silent := make([]string, 0)
	for _, n := range f.Nodes {
		if !n.Agent.Healthy {
			silent = append(silent, n.Hostname)
		}
	}
	if len(silent) == 0 {
		return nil
	}
	sort.Strings(silent)
	return []string{fmt.Sprintf(
		"%d host(s) are not reporting a read-only probe (%s), so their capacity is unknown rather than full. If the task still will not place after this is resolved, that is the next thing to check.",
		len(silent), strings.Join(silent, ", "))}
}

func humanBytes(b uint64) string {
	const unit = 1000
	if b < unit {
		return fmt.Sprintf("%d B", b)
	}
	div, exp := uint64(unit), 0
	for n := b / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %cB", float64(b)/float64(div), "kMGTPE"[exp])
}

// matchesConstraints reports whether a node satisfies every constraint, and is
// deliberately limited to the equality and inequality forms Swarm itself
// documents. An unrecognised constraint returns false for `ok`, which makes the
// rule decline — guessing at a syntax the engine does not implement is how a
// diagnosis becomes confidently wrong.
func matchesConstraints(n domain.Node, constraints []string) (matches bool, ok bool) {
	for _, raw := range constraints {
		c := strings.TrimSpace(raw)
		var key, want string
		var negate bool
		switch {
		case strings.Contains(c, "!="):
			parts := strings.SplitN(c, "!=", 2)
			key, want, negate = strings.TrimSpace(parts[0]), strings.TrimSpace(parts[1]), true
		case strings.Contains(c, "=="):
			parts := strings.SplitN(c, "==", 2)
			key, want = strings.TrimSpace(parts[0]), strings.TrimSpace(parts[1])
		default:
			return false, false
		}

		var have string
		switch {
		case strings.HasPrefix(key, "node.labels."):
			have = n.Labels[strings.TrimPrefix(key, "node.labels.")]
		case key == "node.role":
			have = n.Role
		case key == "node.hostname":
			have = n.Hostname
		case key == "node.id":
			have = n.ID
		default:
			return false, false
		}

		if (have == want) == negate {
			return false, true
		}
	}
	return true, true
}
