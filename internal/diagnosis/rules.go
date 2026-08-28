package diagnosis

import (
	"fmt"
	"strings"
	"time"

	"github.com/nimasrn/SwarmOps/internal/domain"
)

// constraintUnsatisfiable: the service asks for a node that does not exist.
//
// Registered first because it is both the most specific failure and the one an
// operator is least likely to spot: the service looks fine, the nodes look
// fine, and the task simply never places.
type constraintUnsatisfiable struct{}

func (constraintUnsatisfiable) Name() string { return "constraint-unsatisfiable" }

func (r constraintUnsatisfiable) Evaluate(f Facts) *Chain {
	if len(f.Constraints) == 0 || len(f.Nodes) == 0 {
		return nil
	}
	matching := 0
	for _, n := range f.Nodes {
		ok, understood := matchesConstraints(n, f.Constraints)
		if !understood {
			// A constraint form this engine does not implement. Decline rather
			// than report "no node matches", which would be a confident wrong
			// answer produced by the engine's own ignorance.
			return nil
		}
		if ok {
			matching++
		}
	}
	if matching > 0 {
		return nil
	}
	return &Chain{
		Rule:    r.Name(),
		Subject: f.Service.Name,
		Links: []Link{
			{
				Step:     "observed",
				Claim:    fmt.Sprintf("%s is running %d of %d desired tasks.", f.Service.Name, f.Service.RunningTasks, f.Service.DesiredTasks),
				Evidence: ptr(taskEvidence(f)),
				Tone:     ToneWarning,
			},
			{
				Step:  "because",
				Claim: "No node in the cluster satisfies the service's placement constraints.",
				Evidence: ptr(Evidence{
					Label:      strings.Join(f.Constraints, ", "),
					Source:     "service spec",
					ObservedAt: f.ClusterAt,
				}),
				Tone: ToneDanger,
			},
			{
				Step:  "because",
				Claim: fmt.Sprintf("0 of %d nodes carry the labels the constraint requires.", len(f.Nodes)),
				Evidence: ptr(Evidence{
					Label:      fmt.Sprintf("0/%d nodes match", len(f.Nodes)),
					Source:     "node labels · swarm manager",
					ObservedAt: f.ClusterAt,
				}),
				Tone: ToneDanger,
			},
		},
		Actions: []Action{
			{Kind: "edit-constraint", Label: "Relax the constraint", Detail: "Edit the service's placement rule so an existing node can satisfy it.", Primary: true},
			{Kind: "label-node", Label: "Label a node to match", Detail: "Add the required label to a node that should carry this workload."},
		},
		Caveats: []string{
			"This checks labels, role, hostname and id. A constraint using any other expression is not evaluated here, and the engine declines rather than guessing at it.",
		},
	}
}

// nodeCannotHoldImage: a node matches, but the image will not fit on it.
type nodeCannotHoldImage struct{}

func (nodeCannotHoldImage) Name() string { return "node-cannot-hold-image" }

func (r nodeCannotHoldImage) Evaluate(f Facts) *Chain {
	if !f.ImageKnown || f.ImageBytes == 0 {
		return nil // Size unknown: this rule has nothing to measure against.
	}
	probe := Evidence{Source: "read-only host probe", ObservedAt: f.ProbedAt}
	if probe.Stale(f.Now, MaxEvidenceAge) {
		return nil // Capacity readings too old to support a claim about disk.
	}

	candidates := make([]domain.Node, 0, len(f.Nodes))
	for _, n := range f.Nodes {
		if !n.Agent.Healthy {
			continue // No probe, so no disk figure. Silence, not zero.
		}
		if len(f.Constraints) > 0 {
			ok, understood := matchesConstraints(n, f.Constraints)
			if !understood {
				return nil
			}
			if !ok {
				continue
			}
		}
		candidates = append(candidates, n)
	}
	if len(candidates) == 0 {
		return nil
	}

	var roomiest domain.Node
	var best uint64
	for _, n := range candidates {
		free := n.Disk.Capacity - n.Disk.Used
		if free >= f.ImageBytes {
			return nil // Somewhere it fits; this is not the explanation.
		}
		if free > best || roomiest.ID == "" {
			best, roomiest = free, n
		}
	}

	return &Chain{
		Rule:    r.Name(),
		Subject: f.Service.Name,
		Links: []Link{
			{
				Step:     "observed",
				Claim:    fmt.Sprintf("%s is running %d of %d desired tasks.", f.Service.Name, f.Service.RunningTasks, f.Service.DesiredTasks),
				Evidence: ptr(taskEvidence(f)),
				Tone:     ToneWarning,
			},
			{
				Step:  "because",
				Claim: fmt.Sprintf("No eligible node has room for the image. The roomiest, %s, is short by %s.", roomiest.Hostname, humanBytes(f.ImageBytes-best)),
				Evidence: ptr(Evidence{
					Label:      fmt.Sprintf("%s free · %s required", humanBytes(best), humanBytes(f.ImageBytes)),
					Source:     "read-only host probe · " + roomiest.Hostname,
					ObservedAt: f.ProbedAt,
				}),
				Tone: ToneDanger,
			},
		},
		Actions: []Action{
			{Kind: "prune", Label: "Reclaim space on " + roomiest.Hostname, Detail: "Prune images no running or desired task references. The run is recorded in the audit trail.", Primary: true},
			{Kind: "reschedule", Label: "Place on another node", Detail: "Move this workload to a node with more room."},
		},
		Caveats: append([]string{
			"Disk is the only capacity checked here. A pull can also fail on registry authentication, which cannot be tested without attempting it.",
		}, probeCaveat(f)...),
	}
}

// taskFailing: the tasks are placing and then dying.
//
// Registered last: it fires for many unrelated causes, so it must not pre-empt
// a rule that can name one.
type taskFailing struct{}

func (taskFailing) Name() string { return "task-failing" }

func (r taskFailing) Evaluate(f Facts) *Chain {
	var failing *domain.Task
	for i := range f.Tasks {
		t := f.Tasks[i]
		if t.Error != "" && t.DesiredState == "running" {
			failing = &f.Tasks[i]
			break
		}
	}
	if failing == nil {
		return nil
	}
	host := failing.NodeID
	for _, n := range f.Nodes {
		if n.ID == failing.NodeID && n.Hostname != "" {
			host = n.Hostname
			break
		}
	}
	links := []Link{
		{
			Step:     "observed",
			Claim:    fmt.Sprintf("%s is running %d of %d desired tasks.", f.Service.Name, f.Service.RunningTasks, f.Service.DesiredTasks),
			Evidence: ptr(taskEvidence(f)),
			Tone:     ToneWarning,
		},
		{
			Step:  "because",
			Claim: fmt.Sprintf("A task was placed on %s and stopped with an error, so this is the workload failing rather than placement.", host),
			Evidence: ptr(Evidence{
				Label:      truncate(failing.Error, 120),
				Source:     "task state · swarm manager",
				ObservedAt: f.ClusterAt,
			}),
			Tone: ToneDanger,
		},
	}
	return &Chain{
		Rule:    r.Name(),
		Subject: f.Service.Name,
		Links:   links,
		Actions: []Action{
			{Kind: "logs", Label: "Read this task's logs", Detail: "The container's own output is the only thing that says why it exited.", Primary: true},
		},
		Caveats: []string{
			"SwarmOps reports the error the scheduler recorded. Why the process exited is in the container's logs, which this chain does not read or interpret.",
		},
	}
}

// --- helpers ---------------------------------------------------------------

func ptr(e Evidence) *Evidence { return &e }

func truncate(s string, n int) string {
	s = strings.TrimSpace(s)
	if len(s) <= n {
		return s
	}
	return s[:n-1] + "…"
}

var _ = time.Second
