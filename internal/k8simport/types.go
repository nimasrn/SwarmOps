// Package k8simport reads Kubernetes manifests and reports what SwarmOps can
// run, what it will change, and what it cannot take at all.
//
// The last of those is the reason this package exists. A migration tool that
// oversells is worse than none: the failure it produces is discovered in
// production, by someone who trusted it. So an object with no honest Swarm
// equivalent is reported as unmappable with the reason and the alternatives,
// and the caller is told plainly to stay where they are if they need it.
//
// Nothing here writes. It reads manifests and returns a report.
package k8simport

// Mapping is one Kubernetes object that has a Swarm equivalent.
type Mapping struct {
	// From is the object as Kubernetes names it: "Deployment/api-gateway".
	From string `json:"from"`
	// To is what it becomes: "service api-gateway (replicas: 3)".
	To string `json:"to"`
	// Note carries anything the translation loses or assumes. A mapping that
	// changes behaviour without saying so is the same lie as an unmappable
	// object reported as mapped.
	Note string `json:"note,omitempty"`
}

// Gap is an object with no honest equivalent.
type Gap struct {
	// Object is what could not be translated.
	Object string `json:"object"`
	// Why explains the absence in terms of what Swarm is, not what it lacks.
	Why string `json:"why"`
	// Options are the real choices, including staying on Kubernetes.
	Options string `json:"options"`
}

// Report is the outcome of reading a set of manifests.
type Report struct {
	Mappings []Mapping `json:"mappings"`
	Gaps     []Gap     `json:"gaps"`
	// Skipped names documents that were read but carry no workload meaning —
	// Namespaces, ServiceAccounts and the like. Listed rather than silently
	// dropped so the counts add up for anyone auditing the translation.
	Skipped []string `json:"skipped,omitempty"`
	// Errors are documents that could not be parsed at all.
	Errors []string `json:"errors,omitempty"`
	// Compose is the generated stack file. Empty when nothing mapped.
	Compose string `json:"compose,omitempty"`
}

// Safe reports whether every object either mapped or was skipped.
func (r Report) Safe() bool { return len(r.Gaps) == 0 && len(r.Errors) == 0 }
