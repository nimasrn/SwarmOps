package ops

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"

	"github.com/nimasrn/SwarmOps/internal/domain"
	"gopkg.in/yaml.v3"
)

// ApplicationNamespace is the stack prefix every application SwarmOps deploys
// is confined to.
//
// SwarmOps used to require a reviewed platform definition before it would
// deploy anything: a manifest naming a registry namespace, DNS resolvers,
// ingress addresses, a capacity snapshot of every node, and one declared slot
// per application. Nothing in it could be derived from the cluster, so it was
// a second copy of facts the controller already held, kept current by hand,
// and the whole of it stood between an operator and their first deployment.
//
// It is gone. A deployment names a source and a project; the namespace below
// is the one thing the definition supplied that a stack still needs, and it
// keeps a console-deployed stack from taking a name a Git-managed workload
// owns.
const ApplicationNamespace = "production"

var (
	memoryQuantityPattern = regexp.MustCompile(`^([0-9]+(?:\.[0-9]+)?)([kKmMgGtT]i?[bB]?|[bB])?$`)
	routerRulePattern     = regexp.MustCompile(`^Host\(\s*[` + "`'\"" + `]?([^` + "`'\"" + `)\s]+)[` + "`'\"" + `]?\s*\)$`)
)

// LocalImage reports whether an image is one SwarmOps built on the deployment
// host and never pushed.
func LocalImage(image string) bool {
	return strings.HasPrefix(strings.ToLower(strings.TrimSpace(image)), domain.LocalImagePrefix+"/")
}

// ValidateApplicationStack holds a console-deployed stack to the structural
// rules that keep one application out of another's secrets, networks, volumes,
// and Traefik routers.
//
// These are the checks that never needed a reviewed manifest to answer: they
// are about the shape of the document in front of them, not about a policy
// somebody had to write down first. Which hostname an application may claim,
// how much CPU it may reserve, and which registry its image may come from are
// decided by the deployment itself.
func ValidateApplicationStack(name string, raw []byte) error {
	prefix := ApplicationNamespace + "-"
	if !strings.HasPrefix(name, prefix) {
		return fmt.Errorf("stack %q must use the %q namespace prefix", name, prefix)
	}
	root, err := parseCompose(raw)
	if err != nil {
		return err
	}
	if err := validateWorkloadExternalResources(root, name); err != nil {
		return fmt.Errorf("stack %q: %w", name, err)
	}
	if err := validateWorkloadCapacity(root); err != nil {
		return fmt.Errorf("stack %q: %w", name, err)
	}
	if err := validateWorkloadRoutes(root, name); err != nil {
		return fmt.Errorf("stack %q: %w", name, err)
	}
	return nil
}

func parseCompose(raw []byte) (map[string]any, error) {
	var root map[string]any
	if err := yaml.Unmarshal(raw, &root); err != nil {
		return nil, fmt.Errorf("parse compose YAML: %w", err)
	}
	return root, nil
}

type approvedRouter struct {
	entrypoints string
	rule        string
	resolver    string
	servicePort string
	service     string
}

// validateWorkloadRoutes accepts only the small, namespaced HTTP/TLS label
// subset needed for a simple application. Allowing arbitrary Traefik labels
// from the browser would let one workload define shared middleware, TCP, or
// UDP routing owned by another namespace.
func validateWorkloadRoutes(root map[string]any, stack string) error {
	services, ok := asMap(root["services"])
	if !ok || len(services) == 0 {
		return fmt.Errorf("compose must declare at least one service")
	}
	for serviceName, rawService := range services {
		service, ok := asMap(rawService)
		if !ok {
			return fmt.Errorf("service %q must be an object", serviceName)
		}
		labels, err := composeLabels(service["deploy"])
		if err != nil {
			return fmt.Errorf("service %q labels: %w", serviceName, err)
		}
		routers := map[string]*approvedRouter{}
		servicePorts := map[string]string{}
		hasTraefikLabel := false
		for key, value := range labels {
			if !strings.HasPrefix(key, "traefik.") {
				continue
			}
			hasTraefikLabel = true
			switch key {
			case "traefik.enable", "traefik.swarm.network":
				continue
			}
			if router, field, found := splitTraefikLabel(key, "traefik.http.routers."); found {
				if !strings.HasPrefix(router, stack+"-") {
					return fmt.Errorf("service %q Traefik router %q must start with %q", serviceName, router, stack+"-")
				}
				entry := routers[router]
				if entry == nil {
					entry = &approvedRouter{}
					routers[router] = entry
				}
				switch field {
				case "rule":
					entry.rule = value
				case "tls.certresolver":
					entry.resolver = value
				case "entrypoints":
					entry.entrypoints = value
				case "service":
					entry.service = value
				case "observability.metrics", "observability.accesslogs", "tls":
					if value != "true" && value != "false" {
						return fmt.Errorf("service %q uses an invalid boolean Traefik router setting %q", serviceName, field)
					}
				default:
					return fmt.Errorf("service %q uses unsupported Traefik router setting %q", serviceName, field)
				}
				continue
			}
			if router, field, found := splitTraefikLabel(key, "traefik.http.services."); found {
				if !strings.HasPrefix(router, stack+"-") {
					return fmt.Errorf("service %q Traefik service %q must start with %q", serviceName, router, stack+"-")
				}
				if field != "loadbalancer.server.port" {
					return fmt.Errorf("service %q uses unsupported Traefik service setting %q", serviceName, field)
				}
				servicePorts[router] = value
				continue
			}
			return fmt.Errorf("service %q uses unsupported Traefik label %q", serviceName, key)
		}
		if !hasTraefikLabel {
			continue
		}
		expectedNetwork := RouteNetworkName(stack + "_" + serviceName)
		if (labels["traefik.enable"] != "true" && labels["traefik.enable"] != "false") || labels["traefik.swarm.network"] != expectedNetwork {
			return fmt.Errorf("service %q must explicitly declare Traefik on its dedicated route network", serviceName)
		}
		if len(routers) == 0 {
			return fmt.Errorf("service %q must declare an approved Traefik router", serviceName)
		}
		for router, entry := range routers {
			internal := strings.HasSuffix(router, "-internal")
			if entry.rule == "" || entry.entrypoints == "" {
				return fmt.Errorf("service %q has an incomplete Traefik router", serviceName)
			}
			match := routerRulePattern.FindStringSubmatch(strings.TrimSpace(entry.rule))
			if len(match) != 2 {
				return fmt.Errorf("service %q has an unapproved Traefik rule", serviceName)
			}
			domain := strings.ToLower(strings.TrimSuffix(strings.TrimSpace(match[1]), "."))
			if internal {
				expected := defaultRouteKey(stack+"_"+serviceName) + "." + ReservedInternalZone
				if domain != expected || entry.entrypoints != "internal-http" || entry.resolver != "" {
					return fmt.Errorf("service %q internal router must use its derived SwarmOps hostname and internal-http entrypoint", serviceName)
				}
				continue
			}
			// The hostname is the deployment's to choose. What stays enforced
			// is the shape of the route: a public router terminates TLS on the
			// websecure entry point through a named certificate resolver, so a
			// deployment cannot quietly publish itself in the clear.
			if entry.entrypoints != "websecure" {
				return fmt.Errorf("service %q must route %q through the websecure entrypoint", serviceName, domain)
			}
			if strings.TrimSpace(entry.resolver) == "" {
				return fmt.Errorf("service %q must name a certificate resolver for %q", serviceName, domain)
			}
			servicePort := servicePorts[entry.service]
			if servicePort == "" && len(servicePorts) == 1 {
				for _, value := range servicePorts {
					servicePort = value
				}
			}
			if servicePort != "" {
				port, err := strconv.Atoi(servicePort)
				if err != nil || port < 1 || port > 65535 {
					return fmt.Errorf("service %q router %q has an invalid Traefik service port", serviceName, router)
				}
			}
		}
	}
	return nil
}

func splitTraefikLabel(key, prefix string) (string, string, bool) {
	if !strings.HasPrefix(key, prefix) {
		return "", "", false
	}
	remainder := strings.TrimPrefix(key, prefix)
	if remainder == "" {
		return "", "", false
	}
	for _, field := range []string{"observability.accesslogs", "observability.metrics", "tls.certresolver", "loadbalancer.server.port", "entrypoints", "service", "rule", "tls"} {
		suffix := "." + field
		if strings.HasSuffix(remainder, suffix) {
			router := strings.TrimSuffix(remainder, suffix)
			return router, field, router != ""
		}
	}
	return "", "", false
}

func validateWorkloadExternalResources(root map[string]any, stack string) error {
	for _, kind := range []string{"secrets", "configs", "volumes"} {
		if err := validateScopedExternalResources(root, stack, kind); err != nil {
			return err
		}
	}
	return validateExternalNetworks(root, stack)
}

// validateWorkloadCapacity keeps a console-deployed stack to the one Swarm
// shape SwarmOps can operate: replicated services that state what they
// reserve. How much they reserve is the deployment's own choice — the live
// cluster decides whether Swarm can schedule it — but a service that declares
// nothing cannot be placed against a node's free capacity at all.
func validateWorkloadCapacity(root map[string]any) error {
	services, ok := asMap(root["services"])
	if !ok || len(services) == 0 {
		return fmt.Errorf("compose must declare at least one service")
	}
	for serviceName, rawService := range services {
		service, ok := asMap(rawService)
		if !ok {
			return fmt.Errorf("service %q must be an object", serviceName)
		}
		deploy, ok := asMap(service["deploy"])
		if !ok {
			return fmt.Errorf("service %q must declare deploy settings", serviceName)
		}
		if mode, found := deploy["mode"]; found && strings.TrimSpace(fmt.Sprint(mode)) != "replicated" {
			return fmt.Errorf("service %q must use replicated mode; global and job modes require a reviewed Git manifest", serviceName)
		}
		if _, err := composeReplicaCount(deploy["replicas"]); err != nil {
			return fmt.Errorf("service %q replicas: %w", serviceName, err)
		}
		if _, _, err := composeReservations(deploy); err != nil {
			return fmt.Errorf("service %q reservations: %w", serviceName, err)
		}
	}
	return nil
}

func composeReplicaCount(value any) (int, error) {
	if value == nil {
		return 1, nil
	}
	text := strings.TrimSpace(fmt.Sprint(value))
	count, err := strconv.Atoi(text)
	if err != nil || count < 1 {
		return 0, fmt.Errorf("must be a positive integer")
	}
	return count, nil
}

func composeReservations(deploy map[string]any) (float64, float64, error) {
	resources, ok := asMap(deploy["resources"])
	if !ok {
		return 0, 0, fmt.Errorf("must declare resources")
	}
	reservations, ok := asMap(resources["reservations"])
	if !ok {
		return 0, 0, fmt.Errorf("must declare resources.reservations")
	}
	cpuText, cpuOK := reservations["cpus"].(string)
	memoryText, memoryOK := reservations["memory"].(string)
	if !cpuOK || !memoryOK {
		return 0, 0, fmt.Errorf("must declare string CPU and memory values")
	}
	cpu, err := strconv.ParseFloat(strings.TrimSpace(cpuText), 64)
	if err != nil || cpu <= 0 {
		return 0, 0, fmt.Errorf("CPU must be a positive decimal value")
	}
	memoryMiB, err := parseMemoryMiB(memoryText)
	if err != nil || memoryMiB <= 0 {
		return 0, 0, fmt.Errorf("memory must be a positive Docker memory quantity")
	}
	return cpu, memoryMiB, nil
}

func parseMemoryMiB(value string) (float64, error) {
	match := memoryQuantityPattern.FindStringSubmatch(strings.TrimSpace(value))
	if len(match) != 3 {
		return 0, fmt.Errorf("invalid memory quantity")
	}
	quantity, err := strconv.ParseFloat(match[1], 64)
	if err != nil || quantity <= 0 {
		return 0, fmt.Errorf("invalid memory quantity")
	}
	multiplier := float64(1)
	switch strings.ToLower(match[2]) {
	case "", "b":
	case "k", "kb", "kib":
		multiplier = 1 << 10
	case "m", "mb", "mib":
		multiplier = 1 << 20
	case "g", "gb", "gib":
		multiplier = 1 << 30
	case "t", "tb", "tib":
		multiplier = 1 << 40
	default:
		return 0, fmt.Errorf("invalid memory quantity")
	}
	return quantity * multiplier / (1 << 20), nil
}

func validateScopedExternalResources(root map[string]any, stack, kind string) error {
	rawResources, found := root[kind]
	if !found || rawResources == nil {
		return nil
	}
	resources, ok := asMap(rawResources)
	if !ok {
		return fmt.Errorf("top-level %s must be a map", kind)
	}
	for logicalName, rawResource := range resources {
		resource, ok := asMap(rawResource)
		if !ok {
			return fmt.Errorf("top-level %s.%s must be an object", kind, logicalName)
		}
		if !boolValue(resource["external"]) {
			if _, named := resource["name"]; named {
				return fmt.Errorf("non-external %s.%s must not override its stack-scoped name", kind, logicalName)
			}
			continue
		}
		physicalName, ok := resource["name"].(string)
		physicalName = strings.TrimSpace(physicalName)
		if !ok || !dockerReferenceName.MatchString(physicalName) {
			return fmt.Errorf("external %s.%s must declare an explicit safe name", kind, logicalName)
		}
		if !strings.HasPrefix(physicalName, stack+"-") && !strings.HasPrefix(physicalName, stack+"_") {
			return fmt.Errorf("external %s.%s name must start with %q", kind, logicalName, stack+"-")
		}
	}
	return nil
}

func validateExternalNetworks(root map[string]any, stack string) error {
	rawNetworks, found := root["networks"]
	if !found || rawNetworks == nil {
		return nil
	}
	networks, ok := asMap(rawNetworks)
	if !ok {
		return fmt.Errorf("top-level networks must be a map")
	}
	services, ok := asMap(root["services"])
	if !ok || len(services) == 0 {
		return fmt.Errorf("compose must declare at least one service")
	}
	expectedRouteNetworks := make(map[string]bool, len(services))
	for serviceName := range services {
		expectedRouteNetworks[RouteNetworkName(stack+"_"+serviceName)] = true
	}
	for logicalName, rawNetwork := range networks {
		network, ok := asMap(rawNetwork)
		if !ok {
			return fmt.Errorf("top-level network %q must be an object", logicalName)
		}
		if !boolValue(network["external"]) {
			if _, named := network["name"]; named {
				return fmt.Errorf("non-external network %q must not override its stack-scoped name", logicalName)
			}
			continue
		}
		physicalName, _ := network["name"].(string)
		// Browser-originated applications receive only their derived route
		// overlay. Platform-management exceptions are trusted stacks and never
		// pass through this admission path.
		if (logicalName == "traefik-route" || strings.HasPrefix(logicalName, "route-")) && expectedRouteNetworks[strings.TrimSpace(physicalName)] {
			continue
		}
		return fmt.Errorf("browser deployments may use only their dedicated external Traefik route network")
	}
	return nil
}

func composeLabels(rawDeploy any) (map[string]string, error) {
	deploy, ok := asMap(rawDeploy)
	if !ok {
		return map[string]string{}, nil
	}
	rawLabels, found := deploy["labels"]
	if !found || rawLabels == nil {
		return map[string]string{}, nil
	}
	result := map[string]string{}
	switch labels := rawLabels.(type) {
	case map[string]any:
		for key, value := range labels {
			text, ok := value.(string)
			if !ok {
				return nil, fmt.Errorf("label values must be strings")
			}
			result[key] = text
		}
	case []any:
		for _, rawLabel := range labels {
			label, ok := rawLabel.(string)
			if !ok {
				return nil, fmt.Errorf("labels must contain strings")
			}
			key, value, found := strings.Cut(label, "=")
			if !found || strings.TrimSpace(key) == "" {
				return nil, fmt.Errorf("labels must use key=value form")
			}
			result[key] = value
		}
	default:
		return nil, fmt.Errorf("labels must be a map or list")
	}
	return result, nil
}
