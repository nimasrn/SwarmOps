// Package diagnosis explains why a service is not doing what it was asked to
// do, as a chain of claims that each carry the measurement behind them.
//
// The design rule this package exists to enforce: it must prefer silence to
// invention. A diagnosis engine is trusted until its first confident wrong
// answer and never afterwards, so every rule states the measurements it
// requires, and a rule that cannot obtain them declines rather than degrading
// to a guess. When no rule fires the engine returns a Refusal carrying the raw
// evidence, which is a supported outcome rather than an error.
//
// Nothing here talks to Docker or the agents. It is a pure function of facts
// already collected elsewhere, which is what makes every rule testable without
// a cluster.
package diagnosis

import "time"

// Tone marks how a link should read. It carries no styling — the console maps
// it — but it is part of the model because whether a step is the failure or
// merely a step toward it is a claim about the world, not a presentation
// choice.
type Tone string

const (
	ToneNeutral Tone = "neutral"
	ToneWarning Tone = "warning"
	ToneDanger  Tone = "danger"
)

// Evidence is one measurement, with where it came from and when it was taken.
//
// ObservedAt is not decoration. A disk reading five minutes old is a guess
// wearing a fact's clothes, and the console shows the age precisely so an
// operator can discount a chain built on stale ground.
type Evidence struct {
	// Label is the measurement rendered for a human: "1.4 GB free · 2.1 GB required".
	Label string `json:"label"`
	// Source names what produced it: "read-only host probe · worker-03".
	Source string `json:"source"`
	// ObservedAt is when the measurement was taken, not when it was read.
	ObservedAt time.Time `json:"observedAt"`
}

// Stale reports whether this measurement is too old to support a claim.
func (e Evidence) Stale(now time.Time, max time.Duration) bool {
	if e.ObservedAt.IsZero() {
		return true
	}
	return now.Sub(e.ObservedAt) > max
}

// Link is one step of the argument.
type Link struct {
	// Step is the connective: "observed", "because".
	Step string `json:"step"`
	// Claim is what this link asserts, in one sentence.
	Claim string `json:"claim"`
	// Evidence backs the claim. A link may legitimately have none — the console
	// draws those thinner, because an unevidenced step is the one a reader
	// should distrust and neither layer is allowed to disguise it.
	Evidence *Evidence `json:"evidence,omitempty"`
	Tone     Tone      `json:"tone,omitempty"`
}

// Action is something the operator can do about the conclusion. A chain that
// ends in an explanation with no action has diagnosed nothing.
type Action struct {
	// Label is the control's text: "Reclaim 3.2 GB by pruning 11 unused images".
	Label string `json:"label"`
	// Detail says what it will do and what it will not touch.
	Detail string `json:"detail,omitempty"`
	// Kind routes it in the console: "prune", "reschedule", "edit-constraint".
	Kind string `json:"kind"`
	// Primary marks the one recommended action. At most one is primary.
	Primary bool `json:"primary,omitempty"`
}

// Elsewhere is what reaching the same answer costs on Kubernetes.
//
// It belongs to the rule rather than the console because it is a claim about
// the failure, not a decoration: a different failure takes a different number
// of commands, and a fixed list on the page would be marketing.
type Elsewhere struct {
	// Commands are the steps, in order, the last of which is usually the one
	// that requires judgement rather than a query.
	Commands []string `json:"commands"`
	// Note names what the final step actually demands of the operator.
	Note string `json:"note,omitempty"`
}

// Chain is a complete diagnosis.
type Chain struct {
	// Rule names which rule produced this, so a wrong answer is traceable to
	// the rule that made it rather than to "the engine".
	Rule    string   `json:"rule"`
	Subject string   `json:"subject"`
	Links   []Link   `json:"links"`
	Actions []Action `json:"actions,omitempty"`
	// Elsewhere is the same answer's cost on Kubernetes, where it is known.
	Elsewhere *Elsewhere `json:"elsewhere,omitempty"`
	// Evidence is every measurement this chain used, gathered for the trail
	// beside it — the same readings the links carry, listed so their ages can
	// be read together rather than one link at a time.
	Evidence []Evidence `json:"evidence,omitempty"`
	// Caveats are what this diagnosis cannot see. Always populated where a
	// genuine blind spot exists; the console renders them on hatched ground.
	Caveats []string `json:"caveats,omitempty"`
}

// Refusal is returned when no rule can explain the subject. It is a first-class
// result, not a failure: saying "I cannot explain this, here is what I measured"
// is the behaviour that makes the chains believable when they do fire.
type Refusal struct {
	Subject string `json:"subject"`
	// Reason is written for an operator, not a log: it says what was checked.
	Reason   string     `json:"reason"`
	Evidence []Evidence `json:"evidence,omitempty"`
}

// Result carries exactly one of Chain or Refusal.
type Result struct {
	Chain   *Chain   `json:"chain,omitempty"`
	Refusal *Refusal `json:"refusal,omitempty"`
}
