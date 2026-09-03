package ops

import (
	"fmt"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"

	"github.com/nimasrn/SwarmOps/internal/domain"
	"github.com/nimasrn/SwarmOps/internal/preflight"
	"gopkg.in/yaml.v3"
)

// PlatformAdmission ties browser-initiated stack deployment to one reviewed
// namespace manifest. The manifest is non-secret and is intentionally loaded
// from an immutable Swarm config, not from the browser request.
type PlatformAdmission struct {
	manifest  preflight.Manifest
	workloads map[string]preflight.Workload
	// unmanaged marks an install the operator has declared has no platform
	// manifest and must not have one. Slot enforcement — approved names,
	// domains, resolvers, and capacity ceilings — is off; the structural
	// checks that keep one browser stack out of another's secrets, networks,
	// and Traefik routers stay on, because those never needed a manifest.
	unmanaged bool
}

var (
	memoryQuantityPattern = regexp.MustCompile(`^([0-9]+(?:\.[0-9]+)?)([kKmMgGtT]i?[bB]?|[bB])?$`)
	platformNamePattern   = regexp.MustCompile(`^[a-z][a-z0-9-]{0,62}$`)
	routerRulePattern     = regexp.MustCompile(`^Host\(\s*[` + "`'\"" + `]?([^` + "`'\"" + `)\s]+)[` + "`'\"" + `]?\s*\)$`)
)

// LoadPlatformAdmission loads a reviewed manifest when a control-plane
// deployment config supplies one. An absent path means browser deployment is
// disabled; trusted Git-managed stacks remain independently operable.
func LoadPlatformAdmission(path string) (*PlatformAdmission, error) {
	if strings.TrimSpace(path) == "" {
		return nil, nil
	}
	manifest, err := preflight.LoadFile(filepath.Clean(path))
	if err != nil {
		return nil, err
	}
	return NewPlatformAdmission(manifest)
}

func NewPlatformAdmission(manifest preflight.Manifest) (*PlatformAdmission, error) {
	if report := preflight.Check(manifest); !report.Valid() {
		return nil, fmt.Errorf("platform manifest is not admissible: %s", summarizeFindings(report))
	}
	result := &PlatformAdmission{manifest: manifest, workloads: make(map[string]preflight.Workload, len(manifest.Workloads))}
	for _, workload := range manifest.Workloads {
		result.workloads[workload.Name] = workload
	}
	return result, nil
}

// NewUnmanagedAdmission builds the admission an operator gets after declaring
// this install manifest-free. The namespace is still required: it is the stack
// prefix every browser deployment is confined to, and without it a deployment
// could name a stack a Git-managed workload already owns.
func NewUnmanagedAdmission(namespace string) (*PlatformAdmission, error) {
	namespace = strings.ToLower(strings.TrimSpace(namespace))
	if !platformNamePattern.MatchString(namespace) {
		return nil, fmt.Errorf("unmanaged platform namespace must be a lowercase DNS-safe name")
	}
	return &PlatformAdmission{
		manifest:  preflight.Manifest{Namespace: namespace},
		workloads: map[string]preflight.Workload{},
		unmanaged: true,
	}, nil
}

// Unmanaged reports whether slot enforcement is deliberately off, so the
// console can offer free-form application names instead of an empty list.
func (a *PlatformAdmission) Unmanaged() bool { return a != nil && a.unmanaged }

func (a *PlatformAdmission) Namespace() string {
	if a == nil {
		return ""
	}
	return a.manifest.Namespace
}

func (a *PlatformAdmission) ValidateApplicationImage(image string) error {
	if a == nil {
		return fmt.Errorf("application image requires a reviewed platform manifest")
	}
	// An image SwarmOps built and never pushed is admissible without appearing
	// in the manifest's registry namespace. The manifest reviews where images
	// are PULLED FROM; this one is pulled from nowhere. It cannot be replaced
	// by anyone who does not already control the host's image store, which is
	// a strictly smaller trust surface than a registry account.
	if LocalImage(image) {
		return nil
	}
	// An unmanaged install declares no reviewed registry namespace, so there
	// is none to hold the image to. The controller's own source image-prefix
	// allow-list still applies to anything it builds.
	if a.unmanaged {
		return nil
	}
	prefix := strings.TrimSuffix(strings.ToLower(strings.TrimSpace(a.manifest.Registry.Host)), "/") + "/" + strings.Trim(strings.ToLower(strings.TrimSpace(a.manifest.Registry.Namespace)), "/") + "/"
	if !strings.HasPrefix(strings.ToLower(strings.TrimSpace(image)), prefix) {
		return fmt.Errorf("application image must use reviewed registry namespace %q, or be an image SwarmOps built on the host itself", strings.TrimSuffix(prefix, "/"))
	}
	return nil
}

// LocalImage reports whether an image is one SwarmOps built on the deployment
// host and never pushed.
func LocalImage(image string) bool {
	return strings.HasPrefix(strings.ToLower(strings.TrimSpace(image)), domain.LocalImagePrefix+"/")
}

// ValidateStack checks that a custom browser stack names an approved workload
// in the configured namespace and that its public routing cannot claim a
// domain or certificate resolver owned by another workload.
func (a *PlatformAdmission) ValidateStack(name string, raw []byte) error {
	if a == nil {
		return fmt.Errorf("this controller has no platform definition; choose a platform in Platform → Platform definition, or mount a reviewed manifest as SWARMOPS_PLATFORM_MANIFEST_FILE")
	}
	prefix := a.manifest.Namespace + "-"
	if !strings.HasPrefix(name, prefix) {
		return fmt.Errorf("stack %q must use the %q namespace prefix", name, prefix)
	}
	workloadName := strings.TrimPrefix(name, prefix)
	workload, found := a.workloads[workloadName]
	switch {
	case a.unmanaged:
		// No slot list exists to look the stack up in. The workload below is
		// a placeholder that carries no ceiling and owns no domain; the
		// unmanaged flag tells the route and capacity checks to skip exactly
		// the questions only a manifest can answer.
		workload = preflight.Workload{Name: workloadName, Profile: "application", DomainOptional: true}
	case !found:
		return fmt.Errorf("stack %q is not declared in the reviewed platform manifest", name)
	case workload.Profile != "application":
		return fmt.Errorf("stack %q uses the %q profile, which must be deployed from its reviewed Git manifest rather than browser Compose", name, workload.Profile)
	}
	root, err := parseCompose(raw)
	if err != nil {
		return err
	}
	if err := validateWorkloadExternalResources(root, name); err != nil {
		return fmt.Errorf("stack %q: %w", name, err)
	}
	if err := validateWorkloadCapacity(root, workload, a.unmanaged); err != nil {
		return fmt.Errorf("stack %q: %w", name, err)
	}
	if err := validateWorkloadRoutes(root, name, workload, a.unmanaged); err != nil {
		return fmt.Errorf("stack %q: %w", name, err)
	}
	return nil
}

// CheckLive repeats the capacity and placement portion of admission against a
// fresh, authenticated Docker/agent inventory immediately before deployment.
func (a *PlatformAdmission) CheckLive(nodes []domain.Node) preflight.Report {
	if a == nil || a.unmanaged {
		// An unmanaged install declares no node inventory, so there is no
		// plan to hold the live cluster to.
		return preflight.Report{}
	}
	observed := make([]preflight.ObservedNode, 0, len(nodes))
	for _, node := range nodes {
		observed = append(observed, preflight.ObservedNode{
			AgentHealthy:       node.Agent.Healthy,
			AvailableDiskGiB:   node.Disk.Available / (1 << 30),
			AvailableMemoryMiB: node.Memory.Available / (1 << 20),
			CPUCores:           float64(node.CPU.Capacity),
			Labels:             node.Labels,
			MemoryMiB:          node.Memory.Capacity / (1 << 20),
			Name:               strings.ToLower(node.Hostname),
			State:              strings.ToLower(node.State),
		})
	}
	return preflight.CheckObserved(a.manifest, observed)
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
func validateWorkloadRoutes(root map[string]any, stack string, workload preflight.Workload, unmanaged bool) error {
	services, ok := asMap(root["services"])
	if !ok || len(services) == 0 {
		return fmt.Errorf("compose must declare at least one service")
	}
	defaultDomain := strings.ToLower(strings.TrimSuffix(strings.TrimSpace(workload.Domain), "."))
	anyRoutedService := false
	claimedDomain := ""
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
				expected := defaultRouteKey(stack+"_"+serviceName) + ".swarmops.internal"
				if domain != expected || entry.entrypoints != "internal-http" || entry.resolver != "" {
					return fmt.Errorf("service %q internal router must use its derived SwarmOps hostname and internal-http entrypoint", serviceName)
				}
				continue
			}
			// Domain ownership is the one question only a reviewed manifest
			// can answer. Unmanaged installs accept any hostname the operator
			// types; the entrypoint and certificate-resolver shape below is
			// still enforced, so a route cannot quietly skip TLS.
			if !unmanaged {
				if defaultDomain == "" && len(workload.DomainSuffixes) == 0 {
					return fmt.Errorf("service %q defines a public Traefik router but workload %q has no approved domain", serviceName, workload.Name)
				}
				if !workloadAllowsDomain(workload, domain) {
					return fmt.Errorf("service %q claims domain %q outside its reviewed policy", serviceName, domain)
				}
				if claimedDomain != "" && claimedDomain != domain {
					return fmt.Errorf("workload %q may claim only one domain", workload.Name)
				}
			}
			claimedDomain = domain
			if entry.entrypoints != "websecure" {
				return fmt.Errorf("service %q must route %q through the websecure entrypoint", serviceName, domain)
			}
			if unmanaged {
				if strings.TrimSpace(entry.resolver) == "" {
					return fmt.Errorf("service %q must name a certificate resolver for %q", serviceName, domain)
				}
			} else if entry.resolver != workload.Resolver {
				return fmt.Errorf("service %q must route only %q through websecure with resolver %q", serviceName, domain, workload.Resolver)
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
		anyRoutedService = true
	}
	if defaultDomain != "" && !workload.DomainOptional && !anyRoutedService {
		return fmt.Errorf("workload %q requires at least one approved Traefik router for %q", workload.Name, defaultDomain)
	}
	return nil
}

func workloadAllowsDomain(workload preflight.Workload, domain string) bool {
	domain = strings.ToLower(strings.TrimSuffix(strings.TrimSpace(domain), "."))
	if domain == "" {
		return false
	}
	approved := strings.ToLower(strings.TrimSuffix(strings.TrimSpace(workload.Domain), "."))
	if approved != "" && domain == approved {
		return true
	}
	for _, rawSuffix := range workload.DomainSuffixes {
		suffix := strings.ToLower(strings.TrimSuffix(strings.TrimSpace(rawSuffix), "."))
		if domain == suffix || strings.HasSuffix(domain, "."+suffix) {
			return true
		}
	}
	return false
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

// validateWorkloadCapacity binds the browser document to the capacity that was
// admitted from the reviewed manifest. A browser stack may use several
// services, but it cannot turn an application workload into a global service
// or claim more replicas, CPU reservation, or memory reservation than the
// manifest reserved for it.
func validateWorkloadCapacity(root map[string]any, workload preflight.Workload, unmanaged bool) error {
	services, ok := asMap(root["services"])
	if !ok || len(services) == 0 {
		return fmt.Errorf("compose must declare at least one service")
	}
	budget := applicationResourceBudget(workload)
	totalReplicas := 0
	totalCPU := 0.0
	totalMemoryMiB := 0.0
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
		replicas, err := composeReplicaCount(deploy["replicas"])
		if err != nil {
			return fmt.Errorf("service %q replicas: %w", serviceName, err)
		}
		reservationCPU, reservationMemoryMiB, err := composeReservations(deploy)
		if err != nil {
			return fmt.Errorf("service %q reservations: %w", serviceName, err)
		}
		if !unmanaged && (reservationCPU > budget.CPUCores || reservationMemoryMiB > float64(budget.MemoryMiB)) {
			return fmt.Errorf("service %q reservation exceeds its reviewed workload budget", serviceName)
		}
		totalReplicas += replicas
		totalCPU += reservationCPU * float64(replicas)
		totalMemoryMiB += reservationMemoryMiB * float64(replicas)
	}
	// Without a manifest there is no reserved budget to exceed. Live cluster
	// capacity still decides whether Swarm can schedule the service.
	if unmanaged {
		return nil
	}
	if totalReplicas > workload.Replicas {
		return fmt.Errorf("compose requests %d replicas, exceeding the reviewed workload budget of %d", totalReplicas, workload.Replicas)
	}
	if totalCPU > budget.CPUCores*float64(workload.Replicas) || totalMemoryMiB > float64(budget.MemoryMiB)*float64(workload.Replicas) {
		return fmt.Errorf("compose reservations exceed the reviewed workload capacity")
	}
	return nil
}

func applicationResourceBudget(workload preflight.Workload) preflight.Resources {
	budget := workload.Resources
	if budget.CPUCores == 0 {
		budget.CPUCores = 0.25
	}
	if budget.MemoryMiB == 0 {
		budget.MemoryMiB = 256
	}
	if budget.DiskGiB == 0 {
		budget.DiskGiB = 1
	}
	return budget
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

func summarizeFindings(report preflight.Report) string {
	values := make([]string, 0, len(report.Findings))
	for _, finding := range report.Findings {
		if finding.Level == "error" {
			values = append(values, finding.Code)
		}
	}
	sort.Strings(values)
	if len(values) == 0 {
		return "unknown error"
	}
	if len(values) > 5 {
		values = append(values[:5], "…")
	}
	return strings.Join(values, ", ")
}

// ApprovedWorkload is the browser-safe description of one application slot the
// reviewed manifest allows. The console offers these rather than free-form
// input, so an operator picks an approved name, domain, and resolver and
// cannot invent one that another workload owns.
type ApprovedWorkload struct {
	CPUCores       float64  `json:"cpuCores"`
	Domain         string   `json:"domain,omitempty"`
	DomainOptional bool     `json:"domainOptional"`
	DomainSuffixes []string `json:"domainSuffixes,omitempty"`
	MemoryMiB      uint64   `json:"memoryMiB"`
	Name           string   `json:"name"`
	Replicas       int      `json:"replicas"`
	Resolver       string   `json:"resolver,omitempty"`
}

// ApprovedApplications lists the manifest's application-profile workloads with
// the resource ceiling admission will enforce for each.
func (a *PlatformAdmission) ApprovedApplications() []ApprovedWorkload {
	if a == nil {
		return []ApprovedWorkload{}
	}
	approved := make([]ApprovedWorkload, 0, len(a.workloads))
	for _, workload := range a.manifest.Workloads {
		if workload.Profile != "application" {
			continue
		}
		budget := applicationResourceBudget(workload)
		approved = append(approved, ApprovedWorkload{
			CPUCores:       budget.CPUCores,
			Domain:         strings.ToLower(strings.TrimSuffix(strings.TrimSpace(workload.Domain), ".")),
			DomainOptional: workload.DomainOptional,
			DomainSuffixes: normalizeDomainSuffixes(workload.DomainSuffixes),
			MemoryMiB:      budget.MemoryMiB,
			Name:           workload.Name,
			Replicas:       workload.Replicas,
			Resolver:       workload.Resolver,
		})
	}
	sort.Slice(approved, func(left, right int) bool { return approved[left].Name < approved[right].Name })
	return approved
}

func normalizeDomainSuffixes(values []string) []string {
	result := make([]string, 0, len(values))
	seen := map[string]bool{}
	for _, value := range values {
		value = strings.ToLower(strings.TrimSuffix(strings.TrimSpace(value), "."))
		if value != "" && !seen[value] {
			seen[value] = true
			result = append(result, value)
		}
	}
	sort.Strings(result)
	return result
}
