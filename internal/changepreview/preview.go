// Package changepreview says what a change will do to a running cluster before
// it is applied.
//
// The thing it is not: `docker service update --dry-run` and kubectl's
// equivalent both show you the OBJECT that would result. Almost nobody trusts
// them, because the object was never the question. The question is what will be
// interrupted, in what order, and what happens when a step fails.
//
// So every figure here is a consequence computed against the live cluster, and
// anything that cannot be computed is stated as unknown rather than defaulted.
// A preview that quietly guesses is worse than no preview: it is the same
// number, with false confidence attached.
package changepreview

import (
	"fmt"
	"strings"

	"github.com/nimasrn/SwarmOps/internal/domain"
)

// Step is one stage of the rollout, in the order Swarm will perform it.
type Step struct {
	Title  string `json:"title"`
	Detail string `json:"detail,omitempty"`
	// Mark is the right-hand annotation: a duration, "gate", "ready".
	Mark string `json:"mark,omitempty"`
}

// Consequence is one blast-radius figure.
type Consequence struct {
	Label string `json:"label"`
	Value string `json:"value"`
	Note  string `json:"note,omitempty"`
	// Tone is "neutral", "good" or "caution". "good" is reserved for a
	// consequence that should reassure — zero interruptions, chiefly.
	Tone string `json:"tone,omitempty"`
}

// DiffLine is one line of the spec change, in the shape the console's Diff
// component renders. Computed here rather than in the browser: what changed is
// a fact about the cluster, and a client that derived it could disagree with
// the consequences listed beside it.
type DiffLine struct {
	Kind string `json:"kind"`
	Text string `json:"text"`
}

// Preview is the whole answer.
type Preview struct {
	Service      string        `json:"service"`
	From         string        `json:"from,omitempty"`
	To           string        `json:"to,omitempty"`
	Consequences []Consequence `json:"consequences"`
	Steps        []Step        `json:"steps"`
	// Rollback states what happens when a step fails, read from the service's
	// own failure action rather than assumed.
	Rollback string `json:"rollback"`
	// Diff is the spec change itself, so the reader can see what moved rather
	// than only what it will cost.
	Diff []DiffLine `json:"diff"`
	// Unknowns are what this preview cannot promise. Always populated: there is
	// always at least one, because whether a new image starts cleanly is only
	// knowable by running it.
	Unknowns []string `json:"unknowns"`
}

// ForImageChange computes the preview for retagging one service.
//
// stackPeers are the other services sharing this service's stack. They are
// reported as "may depend on this" rather than "depends on this": sharing a
// stack is evidence of a relationship, not proof of one, and the wording says
// which it is.
func ForImageChange(service domain.Service, newImage string, stackPeers []domain.Service) Preview {
	p := Preview{
		Service: service.Name,
		From:    service.Image,
		To:      newImage,
	}

	replicas := service.DesiredTasks
	parallelism := uint64(1)
	if service.Update.Known && service.Update.Parallelism > 0 {
		parallelism = service.Update.Parallelism
	}

	p.Consequences = append(p.Consequences,
		Consequence{Label: "Services changed", Value: "1", Note: service.Name + " only"},
		Consequence{Label: "Tasks replaced", Value: fmt.Sprintf("%d", replicas), Note: replacementNote(replicas, parallelism, service.Update.Known)},
	)

	// Whether a route drops depends on whether anything keeps serving while a
	// task is replaced. With one replica there is nothing to serve.
	switch {
	case replicas <= 1:
		p.Consequences = append(p.Consequences, Consequence{
			Label: "Serving during rollout", Value: "no", Tone: "caution",
			Note: "This service runs a single task, so replacing it means a gap. Scale to two before deploying if that matters.",
		})
	case parallelism >= replicas:
		p.Consequences = append(p.Consequences, Consequence{
			Label: "Serving during rollout", Value: "no", Tone: "caution",
			Note: fmt.Sprintf("Parallelism is %d of %d tasks, so every task is replaced at once.", parallelism, replicas),
		})
	default:
		p.Consequences = append(p.Consequences, Consequence{
			Label: "Serving during rollout", Value: "yes", Tone: "good",
			Note: fmt.Sprintf("%d of %d tasks keep serving at every point.", replicas-parallelism, replicas),
		})
	}

	peers := make([]string, 0, len(stackPeers))
	for _, peer := range stackPeers {
		if peer.ID != service.ID {
			peers = append(peers, peer.Name)
		}
	}
	if len(peers) > 0 {
		p.Consequences = append(p.Consequences, Consequence{
			Label: "Sharing this stack", Value: fmt.Sprintf("%d", len(peers)), Tone: "caution",
			Note: strings.Join(peers, ", ") + " — sharing a stack is evidence of a dependency, not proof of one.",
		})
	} else {
		p.Consequences = append(p.Consequences, Consequence{
			Label: "Sharing this stack", Value: "0", Note: "Nothing else is deployed alongside it.",
		})
	}

	p.Diff = specDiff(service, newImage)
	p.Steps = steps(service, newImage, replicas, parallelism)
	p.Rollback = rollback(service)
	p.Unknowns = []string{
		"Whether the new image starts cleanly. That is only knowable by running it, which is what the health gate is for.",
		"Registry authentication, which is untested until the first pull.",
	}
	if !service.Update.Known {
		p.Unknowns = append(p.Unknowns,
			"This service declares no update policy, so Docker's defaults apply. The sequence below is those defaults, not a configuration anyone chose.")
	}
	return p
}

// specDiff renders the change as context, removal and addition. Only the image
// line actually moves — everything else is context, and showing it is the
// point: an operator approving a deploy is checking that nothing ELSE changed.
func specDiff(service domain.Service, newImage string) []DiffLine {
	out := []DiffLine{
		{Kind: "context", Text: "services:"},
		{Kind: "context", Text: "  " + service.Name + ":"},
		{Kind: "removed", Text: "    image: " + service.Image},
		{Kind: "added", Text: "    image: " + newImage},
	}
	if service.DesiredTasks > 0 {
		out = append(out, DiffLine{Kind: "context", Text: fmt.Sprintf("    deploy:")})
		out = append(out, DiffLine{Kind: "context", Text: fmt.Sprintf("      replicas: %d", service.DesiredTasks)})
	}
	for _, constraint := range service.Constraints {
		out = append(out, DiffLine{Kind: "context", Text: "      placement: " + constraint})
	}
	if service.Update.Known {
		out = append(out, DiffLine{Kind: "context", Text: fmt.Sprintf("      update: parallelism %d", service.Update.Parallelism)})
	}
	return out
}

func replacementNote(replicas, parallelism uint64, known bool) string {
	if !known {
		return "one at a time, which is Docker's default — this service configures none"
	}
	if parallelism >= replicas && replicas > 0 {
		return "all at once, as this service is configured"
	}
	return fmt.Sprintf("%d at a time, as this service is configured", parallelism)
}

func steps(service domain.Service, newImage string, replicas, parallelism uint64) []Step {
	out := []Step{{
		Title:  "Pull " + shortImage(newImage),
		Detail: "On each node that will run a replacement task.",
		Mark:   "before any stop",
	}}
	if service.Update.Known && strings.EqualFold(service.Update.Order, "start-first") {
		out = append(out, Step{
			Title:  "Start replacements before stopping the old tasks",
			Detail: "This service is configured start-first, so capacity briefly doubles rather than dipping.",
			Mark:   "start-first",
		})
	}
	batch := uint64(1)
	if parallelism > 0 {
		batch = parallelism
	}
	for done, round := uint64(0), 1; done < replicas; done, round = done+batch, round+1 {
		n := batch
		if remaining := replicas - done; remaining < n {
			n = remaining
		}
		out = append(out, Step{
			Title:  fmt.Sprintf("Replace %s", pluralTasks(n)),
			Detail: fmt.Sprintf("Round %d of the rollout.", round),
			Mark:   "~30s",
		})
		if service.Update.Known && service.Update.MonitorSecond > 0 && done+n < replicas {
			out = append(out, Step{
				Title:  "Health gate",
				Detail: fmt.Sprintf("Swarm watches for %ds before continuing.", service.Update.MonitorSecond),
				Mark:   "gate",
			})
		} else if done+n < replicas && service.Update.Known && service.Update.DelaySeconds > 0 {
			out = append(out, Step{
				Title:  "Wait",
				Detail: fmt.Sprintf("%ds between rounds, as configured.", service.Update.DelaySeconds),
				Mark:   "delay",
			})
		}
	}
	return append(out, Step{
		Title:  "Converged",
		Detail: "The previous image is retained for rollback until the next prune.",
		Mark:   "done",
	})
}

func rollback(service domain.Service) string {
	if !service.Update.Known || service.Update.FailureAction == "" {
		return "This service configures no failure action, so Docker's default applies: the update PAUSES on failure and the tasks already replaced stay on the new image. Nothing rolls back on its own."
	}
	switch strings.ToLower(service.Update.FailureAction) {
	case "rollback":
		return "On failure Swarm rolls the replaced tasks back to " + shortImage(service.Image) + " automatically. Nothing proceeds past a failed step."
	case "continue":
		return "This service is configured to CONTINUE on failure, so a failing task does not stop the rollout. Every task will be replaced whether or not the new image works."
	default:
		return "On failure the update pauses and the tasks already replaced stay on the new image. Rolling back is a separate action you have to take."
	}
}

func shortImage(image string) string {
	if at := strings.Index(image, "@"); at > 0 {
		image = image[:at]
	}
	if slash := strings.LastIndex(image, "/"); slash >= 0 {
		return image[slash+1:]
	}
	return image
}

func pluralTasks(n uint64) string {
	if n == 1 {
		return "1 task"
	}
	return fmt.Sprintf("%d tasks", n)
}
