package k8simport

import (
	"fmt"
	"sort"
	"strings"
)

// composeService is the Swarm shape a workload translates into. It is written
// out as Compose v3.9 because that is what SwarmOps already validates and
// deploys — the importer produces something the rest of the product can check,
// not a bespoke format only it understands.
type composeService struct {
	Name        string
	Image       string
	Replicas    int
	Constraints []string
	Ports       []string
	Environment []string
	Volumes     []string
	Healthcheck string
	MemoryLimit string
	Global      bool
}

// plural picks the wording for a count so a gap reads as a sentence.
func plural(count int, one, many string) string {
	if count == 1 {
		return one
	}
	return many
}

func mapDeployment(report *Report, services *[]composeService, doc document, ref string) {
	containers := doc.Spec.Template.Spec.Containers
	if len(containers) == 0 {
		report.Gaps = append(report.Gaps, Gap{Object: ref,
			Why:     "This workload declares no containers, so there is nothing to run.",
			Options: "Check the manifest is complete before importing it."})
		return
	}
	if len(containers) > 1 {
		// Swarm has no pod, so co-scheduled containers sharing a network
		// namespace have no equivalent. Saying "we mapped it" here would be the
		// exact oversell this package exists to avoid.
		report.Gaps = append(report.Gaps, Gap{Object: ref,
			Why:     fmt.Sprintf("This declares %d containers in one pod. Swarm has no pod: each container becomes its own service with its own network identity, so a sidecar sharing localhost with its app stops working.", len(containers)),
			Options: "Split them into services that talk over the overlay network, merge them into one image, or keep this workload on Kubernetes."})
		return
	}

	c := containers[0]
	svc := composeService{Name: doc.Metadata.Name, Image: c.Image, Replicas: 1}
	if doc.Spec.Replicas != nil {
		svc.Replicas = *doc.Spec.Replicas
	}
	note := ""

	switch doc.Kind {
	case "DaemonSet":
		svc.Global = true
		note = "A DaemonSet becomes a global service, which is the same intent: one task per node."
	case "StatefulSet":
		note = "Swarm has no stable pod identity or ordered rollout. Replicas are interchangeable, so anything relying on a fixed ordinal hostname will not behave the same."
	}

	for key, value := range doc.Spec.Template.Spec.NodeSelector {
		svc.Constraints = append(svc.Constraints, fmt.Sprintf("node.labels.%s == %s", key, value))
	}
	sort.Strings(svc.Constraints)

	for _, p := range c.Ports {
		if p.ContainerPort > 0 {
			svc.Ports = append(svc.Ports, fmt.Sprintf("%d:%d", p.ContainerPort, p.ContainerPort))
		}
	}

	// A plain env value carries across unchanged; Compose has the same field.
	// Anything drawn from a Secret, ConfigMap or the downward API does not, so
	// it is reported rather than dropped.
	indirect := 0
	for _, variable := range c.Env {
		if variable.ValueFrom != nil {
			indirect++
			continue
		}
		if variable.Name != "" {
			svc.Environment = append(svc.Environment, variable.Name+"="+variable.Value)
		}
	}
	indirect += len(c.EnvFrom)
	if indirect > 0 {
		report.Gaps = append(report.Gaps, Gap{Object: ref,
			Why:     fmt.Sprintf("%d environment %s read from a Secret, ConfigMap or the downward API. Swarm mounts secrets and configs as files and has no downward API, so the value cannot be injected into the environment.", indirect, plural(indirect, "entry", "entries")),
			Options: "Attach a managed database or a Swarm secret and read it from its file, set the value directly as a reviewed setting, or keep this workload on Kubernetes."})
	}

	// Storage is named honestly or reported. Guessing at a volume's semantics
	// is how a workload silently loses its data.
	volumeKinds := map[string]string{}
	for _, volume := range doc.Spec.Template.Spec.Volumes {
		switch {
		case volume.PersistentVolumeClaim != nil:
			volumeKinds[volume.Name] = "pvc"
		case volume.EmptyDir != nil:
			volumeKinds[volume.Name] = "emptyDir"
		case volume.ConfigMap != nil:
			volumeKinds[volume.Name] = "configMap"
		case volume.Secret != nil:
			volumeKinds[volume.Name] = "secret"
		case volume.HostPath != nil:
			volumeKinds[volume.Name] = "hostPath"
		default:
			volumeKinds[volume.Name] = "unsupported"
		}
	}
	uncarried := []string{}
	for _, mount := range c.VolumeMounts {
		if mount.MountPath == "" {
			continue
		}
		switch volumeKinds[mount.Name] {
		case "pvc", "emptyDir":
			svc.Volumes = append(svc.Volumes, mount.Name+":"+mount.MountPath)
		default:
			uncarried = append(uncarried, mount.Name+" at "+mount.MountPath)
		}
	}
	sort.Strings(uncarried)
	if len(uncarried) > 0 {
		report.Gaps = append(report.Gaps, Gap{Object: ref,
			Why:     fmt.Sprintf("%s mounted from a ConfigMap, Secret, hostPath or an unrecognised source: %s. Swarm mounts configs and secrets as files at a fixed path and has no equivalent for the rest, so the mount is not carried across.", plural(len(uncarried), "One volume is", "Volumes are"), strings.Join(uncarried, ", ")),
			Options: "Mount the file as a reviewed Swarm config or secret, bake it into the image, or keep this workload on Kubernetes."})
	}

	if c.LivenessProbe != nil && c.LivenessProbe.HTTPGet != nil {
		path := c.LivenessProbe.HTTPGet.Path
		if path == "" {
			path = "/"
		}
		svc.Healthcheck = fmt.Sprintf("curl -fsS http://localhost:%s%s", portString(c.LivenessProbe.HTTPGet.Port), path)
	}
	if mem, ok := c.Resources.Limits["memory"]; ok {
		svc.MemoryLimit = normaliseMemory(mem)
	}

	if len(svc.Volumes) > 0 {
		volumeNote := "Each mount becomes a Swarm named volume, which is local to the node the task runs on; a replica that moves does not take its data with it."
		if note == "" {
			note = volumeNote
		} else {
			note += " " + volumeNote
		}
	}

	*services = append(*services, svc)
	report.Mappings = append(report.Mappings, Mapping{
		From: ref,
		To:   fmt.Sprintf("service %s (replicas: %d)", svc.Name, svc.Replicas),
		Note: note,
	})
}

func mapService(report *Report, doc document, ref string) {
	switch doc.Spec.Type {
	case "", "ClusterIP":
		report.Mappings = append(report.Mappings, Mapping{From: ref, To: "overlay network alias " + doc.Metadata.Name,
			Note: "Swarm resolves a service by name on its overlay network, so no separate object is needed."})
	case "NodePort":
		report.Mappings = append(report.Mappings, Mapping{From: ref, To: "published port on " + doc.Metadata.Name,
			Note: "Swarm publishes on every node through the routing mesh rather than on a fixed node port range."})
	case "LoadBalancer":
		report.Gaps = append(report.Gaps, Gap{Object: ref,
			Why:     "A LoadBalancer Service asks the cloud provider for an external address. Swarm has no provider integration to ask.",
			Options: "Publish the port and put it behind the Traefik gateway SwarmOps manages, or keep this on Kubernetes."})
	default:
		report.Gaps = append(report.Gaps, Gap{Object: ref,
			Why:     fmt.Sprintf("Service type %q has no Swarm equivalent this importer will guess at.", doc.Spec.Type),
			Options: "Translate it by hand."})
	}
}

func mapIngress(report *Report, doc document, ref string) {
	hosts := make([]string, 0, len(doc.Spec.Rules))
	for _, rule := range doc.Spec.Rules {
		if rule.Host != "" {
			hosts = append(hosts, rule.Host)
		}
	}
	to := "Traefik route"
	if len(hosts) > 0 {
		to = "Traefik route " + strings.Join(hosts, ", ")
	}
	report.Mappings = append(report.Mappings, Mapping{From: ref, To: to,
		Note: "SwarmOps manages the route and its certificate. Ingress annotations from other controllers are not carried across."})
}

func renderCompose(services []composeService) string {
	sort.SliceStable(services, func(i, j int) bool { return services[i].Name < services[j].Name })
	var b strings.Builder
	b.WriteString("version: \"3.9\"\n\nservices:\n")
	for _, s := range services {
		fmt.Fprintf(&b, "  %s:\n", s.Name)
		fmt.Fprintf(&b, "    image: %s\n", s.Image)
		if len(s.Ports) > 0 {
			b.WriteString("    ports:\n")
			for _, p := range s.Ports {
				fmt.Fprintf(&b, "      - \"%s\"\n", p)
			}
		}
		if len(s.Environment) > 0 {
			b.WriteString("    environment:\n")
			for _, value := range s.Environment {
				fmt.Fprintf(&b, "      - %s\n", value)
			}
		}
		if len(s.Volumes) > 0 {
			b.WriteString("    volumes:\n")
			for _, value := range s.Volumes {
				fmt.Fprintf(&b, "      - %s\n", value)
			}
		}
		if s.Healthcheck != "" {
			b.WriteString("    healthcheck:\n")
			fmt.Fprintf(&b, "      test: [\"CMD-SHELL\", \"%s\"]\n", s.Healthcheck)
			b.WriteString("      interval: 20s\n")
		}
		b.WriteString("    deploy:\n")
		if s.Global {
			b.WriteString("      mode: global\n")
		} else {
			fmt.Fprintf(&b, "      replicas: %d\n", s.Replicas)
		}
		if len(s.Constraints) > 0 {
			b.WriteString("      placement:\n        constraints:\n")
			for _, c := range s.Constraints {
				fmt.Fprintf(&b, "          - %s\n", c)
			}
		}
		if s.MemoryLimit != "" {
			fmt.Fprintf(&b, "      resources:\n        limits:\n          memory: %s\n", s.MemoryLimit)
		}
	}
	// A named volume must also be declared at the top level or Compose rejects
	// the stack, so the generated draft would not have deployed.
	declared := map[string]bool{}
	for _, s := range services {
		for _, value := range s.Volumes {
			name, _, found := strings.Cut(value, ":")
			if found && name != "" {
				declared[name] = true
			}
		}
	}
	if len(declared) > 0 {
		names := make([]string, 0, len(declared))
		for name := range declared {
			names = append(names, name)
		}
		sort.Strings(names)
		b.WriteString("\nvolumes:\n")
		for _, name := range names {
			fmt.Fprintf(&b, "  %s:\n", name)
		}
	}
	return b.String()
}

func portString(port any) string {
	switch v := port.(type) {
	case int:
		return fmt.Sprintf("%d", v)
	case string:
		return v
	default:
		return "8080"
	}
}

// normaliseMemory converts Kubernetes' binary suffixes to the ones Compose
// accepts. Left untouched when unrecognised: a wrong limit is worse than none.
func normaliseMemory(value string) string {
	switch {
	case strings.HasSuffix(value, "Mi"):
		return strings.TrimSuffix(value, "Mi") + "M"
	case strings.HasSuffix(value, "Gi"):
		return strings.TrimSuffix(value, "Gi") + "G"
	default:
		return value
	}
}
