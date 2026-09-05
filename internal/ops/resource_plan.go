package ops

import (
	"fmt"
	"sort"
	"strings"
)

// ResourcePlan is a named size an application can be deployed at.
//
// Sizing used to be reviewed once, in the platform definition, and every
// application inherited whatever its slot was declared with. That put the
// decision in the wrong place: the size an application needs is a property of
// the application, it changes after a release rather than at review time, and
// it made the definition carry a number for every slot before anything had
// been deployed into it.
//
// A plan is chosen per deployment and can be changed on the next one. An
// operator who wants a size that is not listed passes the numbers instead.
type ResourcePlan struct {
	CPUCores  float64 `json:"cpuCores"`
	MemoryMiB int64   `json:"memoryMiB"`
	Name      string  `json:"name"`
	Summary   string  `json:"summary"`
}

// DefaultResourcePlan names the plan a deployment gets when it chooses none.
const DefaultResourcePlan = "small"

var resourcePlans = map[string]ResourcePlan{
	"nano":   {CPUCores: 0.25, MemoryMiB: 256, Name: "nano", Summary: "A sidecar, a redirect, or a health endpoint."},
	"small":  {CPUCores: 0.5, MemoryMiB: 512, Name: "small", Summary: "The default. A typical web service or API."},
	"medium": {CPUCores: 1, MemoryMiB: 1024, Name: "medium", Summary: "A service doing real work per request."},
	"large":  {CPUCores: 2, MemoryMiB: 2048, Name: "large", Summary: "A heavier runtime, or one holding a working set in memory."},
	"xlarge": {CPUCores: 4, MemoryMiB: 4096, Name: "xlarge", Summary: "The largest size offered without stating numbers."},
}

// ResourcePlans lists the plans an operator may choose from, smallest first,
// so the console can offer them without hard-coding the set.
func ResourcePlans() []ResourcePlan {
	plans := make([]ResourcePlan, 0, len(resourcePlans))
	for _, plan := range resourcePlans {
		plans = append(plans, plan)
	}
	sort.Slice(plans, func(left, right int) bool {
		if plans[left].CPUCores == plans[right].CPUCores {
			return plans[left].MemoryMiB < plans[right].MemoryMiB
		}
		return plans[left].CPUCores < plans[right].CPUCores
	})
	return plans
}

// LookupResourcePlan resolves a plan name. An empty name is the default plan,
// so a deployment that says nothing about size still gets a reviewed one.
func LookupResourcePlan(name string) (ResourcePlan, error) {
	name = strings.ToLower(strings.TrimSpace(name))
	if name == "" {
		name = DefaultResourcePlan
	}
	plan, found := resourcePlans[name]
	if !found {
		return ResourcePlan{}, fmt.Errorf("resource plan %q is not offered; choose one of %s, or state cpus and memoryMiB directly", name, strings.Join(resourcePlanNames(), ", "))
	}
	return plan, nil
}

func resourcePlanNames() []string {
	names := make([]string, 0, len(resourcePlans))
	for _, plan := range ResourcePlans() {
		names = append(names, plan.Name)
	}
	return names
}
