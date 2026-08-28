package k8simport

import (
	"errors"
	"fmt"
	"io"
	"sort"
	"strings"

	"gopkg.in/yaml.v3"
)

// document is the subset of a Kubernetes object this package reads. Everything
// else in a manifest is deliberately ignored rather than half-understood.
type document struct {
	Kind     string `yaml:"kind"`
	Metadata struct {
		Name string `yaml:"name"`
	} `yaml:"metadata"`
	Spec struct {
		Replicas *int `yaml:"replicas"`
		Template struct {
			Spec struct {
				NodeSelector map[string]string `yaml:"nodeSelector"`
				Containers   []struct {
					Name          string `yaml:"name"`
					Image         string `yaml:"image"`
					LivenessProbe *struct {
						HTTPGet *struct {
							Path string `yaml:"path"`
							Port any    `yaml:"port"`
						} `yaml:"httpGet"`
					} `yaml:"livenessProbe"`
					Resources struct {
						Limits map[string]string `yaml:"limits"`
					} `yaml:"resources"`
					Ports []struct {
						ContainerPort int `yaml:"containerPort"`
					} `yaml:"ports"`
				} `yaml:"containers"`
			} `yaml:"spec"`
		} `yaml:"template"`
		Type  string `yaml:"type"`
		Rules []struct {
			Host string `yaml:"host"`
		} `yaml:"rules"`
		Ports []struct {
			Port       int `yaml:"port"`
			TargetPort any `yaml:"targetPort"`
		} `yaml:"ports"`
	} `yaml:"spec"`
}

// skippable are objects that carry no workload meaning on Swarm. They are
// listed in the report rather than dropped, so the counts add up for anyone
// checking the translation.
var skippable = map[string]bool{
	"Namespace":          true,
	"ServiceAccount":     true,
	"Role":               true,
	"RoleBinding":        true,
	"ClusterRole":        true,
	"ClusterRoleBinding": true,
}

// Parse reads a multi-document manifest stream and reports what it found.
func Parse(r io.Reader) (Report, error) {
	report := Report{}
	decoder := yaml.NewDecoder(r)
	services := make([]composeService, 0)

	for index := 0; ; index++ {
		var doc document
		err := decoder.Decode(&doc)
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			report.Errors = append(report.Errors, fmt.Sprintf("document %d could not be parsed: %v", index+1, err))
			// A malformed document stops the stream — yaml.v3 cannot reliably
			// resume — so report it and return what was understood so far
			// rather than pretending the rest was empty.
			break
		}
		if doc.Kind == "" {
			continue
		}
		// A Kubernetes name is at most 253 characters by spec, so anything
		// longer is invalid input. Bound it before it reaches the report:
		// otherwise a large paste is echoed back verbatim, and the request
		// limit bounds what is read without bounding what is returned.
		name := boundedName(doc.Metadata.Name)
		ref := boundedName(doc.Kind) + "/" + name

		switch doc.Kind {
		case "Deployment", "StatefulSet", "DaemonSet":
			mapDeployment(&report, &services, doc, ref)
		case "Service":
			mapService(&report, doc, ref)
		case "Ingress":
			mapIngress(&report, doc, ref)
		case "ConfigMap":
			report.Mappings = append(report.Mappings, Mapping{From: ref, To: "docker config " + name})
		case "Secret":
			report.Mappings = append(report.Mappings, Mapping{From: ref, To: "docker secret " + name,
				Note: "Swarm secrets are mounted as files, not injected as environment variables. A container reading this from the environment needs a change."})
		case "PersistentVolumeClaim":
			report.Mappings = append(report.Mappings, Mapping{From: ref, To: "named volume " + name,
				Note: "A Swarm named volume is local to the node it is created on. If this claim relied on ReadWriteMany, that behaviour does not carry across."})
		case "HorizontalPodAutoscaler":
			report.Gaps = append(report.Gaps, Gap{Object: ref,
				Why:     "Swarm has no autoscaler. A replica count is a number you set, not a target it pursues.",
				Options: "Set replicas to your observed peak and leave headroom, or keep this workload on Kubernetes."})
		case "CustomResourceDefinition":
			report.Gaps = append(report.Gaps, Gap{Object: ref,
				Why:     "Swarm has no operator model, so a controller reconciling a custom resource has nowhere to run.",
				Options: "If this is cert-manager, SwarmOps issues and renews certificates natively under Traffic → TLS. The general pattern has no equivalent."})
		case "CronJob", "Job":
			report.Gaps = append(report.Gaps, Gap{Object: ref,
				Why:     "Swarm services are long-running. It has no run-to-completion primitive and no schedule.",
				Options: "Run it from the host's cron or a scheduled SwarmOps action, or keep it on Kubernetes."})
		case "NetworkPolicy":
			report.Gaps = append(report.Gaps, Gap{Object: ref,
				Why:     "Swarm isolates by attaching services to overlay networks rather than by policy between pods.",
				Options: "Model the boundary as separate overlay networks, and accept that it is coarser than this policy."})
		default:
			if skippable[doc.Kind] {
				report.Skipped = append(report.Skipped, ref)
				continue
			}
			report.Gaps = append(report.Gaps, Gap{Object: ref,
				Why:     fmt.Sprintf("SwarmOps does not know how to translate a %s, and will not guess at one.", doc.Kind),
				Options: "Translate it by hand, or keep this workload on Kubernetes."})
		}
	}

	sort.SliceStable(report.Mappings, func(i, j int) bool { return report.Mappings[i].From < report.Mappings[j].From })
	sort.SliceStable(report.Gaps, func(i, j int) bool { return report.Gaps[i].Object < report.Gaps[j].Object })
	if len(services) > 0 {
		report.Compose = renderCompose(services)
	}
	return report, nil
}

// maxNameLength is the Kubernetes limit for an object name.
const maxNameLength = 253

func boundedName(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return "unnamed"
	}
	if len(value) > maxNameLength {
		return value[:maxNameLength] + "…(truncated)"
	}
	return value
}

// ParseString is Parse over a string, which is how the console calls it.
func ParseString(manifests string) (Report, error) { return Parse(strings.NewReader(manifests)) }
