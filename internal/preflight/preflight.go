// Package preflight validates the reviewed, non-secret platform manifest before
// an operator builds or deploys a Swarm workload. It deliberately plans from
// declared inventory rather than trying to mutate hosts or cloud providers.
package preflight

import (
	"bytes"
	"fmt"
	"io"
	"net"
	"net/url"
	"os"
	"regexp"
	"sort"
	"strings"

	"gopkg.in/yaml.v3"
)

const (
	APIVersion = "swarmops.nim.zone/v1alpha1"
	Kind       = "Platform"
)

var (
	namePattern       = regexp.MustCompile(`^[a-z][a-z0-9-]{0,62}$`)
	secretNamePattern = regexp.MustCompile(`^[a-z][a-z0-9_.-]{0,127}$`)
	labelNamePattern  = regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$`)
)

// Manifest is intentionally free of credential values. It is a reviewed plan
// that names secret references and capacity facts supplied through the
// operator's inventory workflow.
type Manifest struct {
	APIVersion string                  `yaml:"apiVersion" json:"apiVersion"`
	Backup     Backup                  `yaml:"backup" json:"backup"`
	Build      Build                   `yaml:"build" json:"build"`
	DNS        DNS                     `yaml:"dns" json:"dns"`
	Ingress    Ingress                 `yaml:"ingress" json:"ingress"`
	Kind       string                  `yaml:"kind" json:"kind"`
	Namespace  string                  `yaml:"namespace" json:"namespace"`
	Nodes      []Node                  `yaml:"nodes" json:"nodes"`
	Registry   Registry                `yaml:"registry" json:"registry"`
	Storage    []ObjectStorageProvider `yaml:"storage" json:"storage"`
	Workloads  []Workload              `yaml:"workloads" json:"workloads"`
}

type Registry struct {
	AuthSecret string `yaml:"authSecret" json:"authSecret"`
	Host       string `yaml:"host" json:"host"`
	Mode       string `yaml:"mode" json:"mode"`
	Namespace  string `yaml:"namespace" json:"namespace"`
}

type Build struct {
	CacheNodeLabel string `yaml:"cacheNodeLabel" json:"cacheNodeLabel"`
	NodeLabel      string `yaml:"nodeLabel" json:"nodeLabel"`
}

type Ingress struct {
	PublicIPs []string `yaml:"publicIPs" json:"publicIPs"`
}

type DNS struct {
	Providers []DNSProvider         `yaml:"providers" json:"providers"`
	Resolvers []CertificateResolver `yaml:"resolvers" json:"resolvers"`
}

type DNSProvider struct {
	CredentialSecret string `yaml:"credentialSecret" json:"credentialSecret"`
	Name             string `yaml:"name" json:"name"`
	Type             string `yaml:"type" json:"type"`
}

type CertificateResolver struct {
	Challenge string `yaml:"challenge" json:"challenge"`
	Name      string `yaml:"name" json:"name"`
	Provider  string `yaml:"provider" json:"provider"`
}

type ObjectStorageProvider struct {
	Bucket           string `yaml:"bucket" json:"bucket"`
	CredentialSecret string `yaml:"credentialSecret" json:"credentialSecret"`
	Endpoint         string `yaml:"endpoint" json:"endpoint"`
	Name             string `yaml:"name" json:"name"`
}

type Backup struct {
	Prefix   string `yaml:"prefix" json:"prefix"`
	Provider string `yaml:"provider" json:"provider"`
	Schedule string `yaml:"schedule" json:"schedule"`
}

// Node is a point-in-time capacity declaration produced by the inventory
// workflow. Available values, not just physical totals, are used for a plan.
type Node struct {
	AvailableCPUCores  float64           `yaml:"availableCPUCores" json:"availableCPUCores"`
	AvailableDiskGiB   uint64            `yaml:"availableDiskGiB" json:"availableDiskGiB"`
	AvailableMemoryMiB uint64            `yaml:"availableMemoryMiB" json:"availableMemoryMiB"`
	CPUCores           float64           `yaml:"cpuCores" json:"cpuCores"`
	Labels             map[string]string `yaml:"labels" json:"labels"`
	MemoryMiB          uint64            `yaml:"memoryMiB" json:"memoryMiB"`
	Name               string            `yaml:"name" json:"name"`
}

// ObservedNode is the non-sensitive scheduling snapshot returned by the
// authenticated SwarmOps node inventory. It is deliberately smaller than a
// Docker node response: live preflight needs state, labels, and measurable
// capacity, not service details or any credential material.
type ObservedNode struct {
	AgentHealthy       bool              `json:"agentHealthy"`
	AvailableDiskGiB   uint64            `json:"availableDiskGiB"`
	AvailableMemoryMiB uint64            `json:"availableMemoryMiB"`
	CPUCores           float64           `json:"cpuCores"`
	Labels             map[string]string `json:"labels"`
	MemoryMiB          uint64            `json:"memoryMiB"`
	Name               string            `json:"name"`
	State              string            `json:"state"`
}

type Workload struct {
	AdvertiseIP           string    `yaml:"advertiseIP" json:"advertiseIP"`
	Domain                string    `yaml:"domain" json:"domain"`
	Name                  string    `yaml:"name" json:"name"`
	ObjectStorageProvider string    `yaml:"objectStorageProvider" json:"objectStorageProvider"`
	Profile               string    `yaml:"profile" json:"profile"`
	Replicas              int       `yaml:"replicas" json:"replicas"`
	Resolver              string    `yaml:"resolver" json:"resolver"`
	Resources             Resources `yaml:"resources" json:"resources"`
}

type Resources struct {
	CPUCores  float64 `yaml:"cpuCores" json:"cpuCores"`
	DiskGiB   uint64  `yaml:"diskGiB" json:"diskGiB"`
	MemoryMiB uint64  `yaml:"memoryMiB" json:"memoryMiB"`
}

type Finding struct {
	Code    string `json:"code"`
	Level   string `json:"level"`
	Message string `json:"message"`
	Subject string `json:"subject,omitempty"`
}

type Totals struct {
	Available Resources `json:"available"`
	Requested Resources `json:"requested"`
}

type Report struct {
	Findings  []Finding `json:"findings"`
	Namespace string    `json:"namespace"`
	Totals    Totals    `json:"totals"`
}

func (r Report) Valid() bool {
	for _, finding := range r.Findings {
		if finding.Level == "error" {
			return false
		}
	}
	return true
}

func (r Report) Error() error {
	if r.Valid() {
		return nil
	}
	return fmt.Errorf("platform preflight found one or more errors")
}

// LoadFile reads exactly one strict YAML document. The file must only contain
// public topology and secret *names*, never secret values.
func LoadFile(path string) (Manifest, error) {
	contents, err := os.ReadFile(path)
	if err != nil {
		return Manifest{}, fmt.Errorf("read platform manifest: %w", err)
	}
	return Load(contents)
}

func Load(contents []byte) (Manifest, error) {
	decoder := yaml.NewDecoder(bytes.NewReader(contents))
	decoder.KnownFields(true)
	var manifest Manifest
	if err := decoder.Decode(&manifest); err != nil {
		return Manifest{}, fmt.Errorf("decode platform manifest: %w", err)
	}
	var extra any
	if err := decoder.Decode(&extra); err != io.EOF {
		if err == nil {
			return Manifest{}, fmt.Errorf("platform manifest must contain one document")
		}
		return Manifest{}, fmt.Errorf("decode platform manifest: %w", err)
	}
	return manifest, nil
}

type profileRule struct {
	defaultResources Resources
	maxReplicas      int
	minReplicas      int
	requiresIngress  bool
	requiredSlots    []string
	slotLabel        string
	spreadLabel      string
}

var profiles = map[string]profileRule{
	"application": {
		defaultResources: Resources{CPUCores: 0.25, MemoryMiB: 256, DiskGiB: 1},
		minReplicas:      1,
	},
	"jitsi": {
		defaultResources: Resources{CPUCores: 2, MemoryMiB: 4096, DiskGiB: 20},
		maxReplicas:      1,
		minReplicas:      1,
		requiresIngress:  true,
		spreadLabel:      "nim.jitsi",
	},
	"mongo-replicaset": {
		defaultResources: Resources{CPUCores: 1, MemoryMiB: 2048, DiskGiB: 50},
		maxReplicas:      3,
		minReplicas:      3,
		requiredSlots:    []string{"1", "2", "3"},
		slotLabel:        "nim.mongo.slot",
		spreadLabel:      "nim.mongo",
	},
	"observability": {
		defaultResources: Resources{CPUCores: 1, MemoryMiB: 2048, DiskGiB: 30},
		maxReplicas:      1,
		minReplicas:      1,
		spreadLabel:      "nim.observability",
	},
	"postgres-primary-replica": {
		defaultResources: Resources{CPUCores: 1, MemoryMiB: 2048, DiskGiB: 50},
		maxReplicas:      2,
		minReplicas:      2,
		requiredSlots:    []string{"primary", "replica"},
		slotLabel:        "nim.postgres.slot",
		spreadLabel:      "nim.postgres",
	},
	"redis-sentinel": {
		defaultResources: Resources{CPUCores: 0.5, MemoryMiB: 512, DiskGiB: 10},
		minReplicas:      3,
		spreadLabel:      "nim.redis",
	},
}

// Check performs deterministic, local-only checks. It does not contact an S3
// provider, DNS API, registry, or node; those live checks are later deployment
// gates after the operator supplies protected credentials.
func Check(manifest Manifest) Report {
	report := Report{Namespace: manifest.Namespace}
	errorf := func(code, subject, format string, args ...any) {
		report.Findings = append(report.Findings, Finding{Code: code, Level: "error", Subject: subject, Message: fmt.Sprintf(format, args...)})
	}
	warnf := func(code, subject, format string, args ...any) {
		report.Findings = append(report.Findings, Finding{Code: code, Level: "warning", Subject: subject, Message: fmt.Sprintf(format, args...)})
	}

	if manifest.APIVersion != APIVersion {
		errorf("api-version", "apiVersion", "must equal %q", APIVersion)
	}
	if manifest.Kind != Kind {
		errorf("kind", "kind", "must equal %q", Kind)
	}
	if !validName(manifest.Namespace) {
		errorf("namespace", "namespace", "must be a lowercase DNS-safe name")
	}

	checkRegistry(manifest.Registry, errorf)
	providers := checkStorage(manifest.Storage, errorf)
	checkBackup(manifest.Backup, providers, errorf)
	dnsProviders, resolvers := checkDNS(manifest.DNS, manifest.Ingress, errorf)
	_ = dnsProviders
	nodes := checkNodes(manifest.Nodes, errorf, warnf)
	checkBuild(manifest.Build, nodes, errorf)
	checkWorkloads(manifest, nodes, providers, resolvers, &report, errorf, warnf)

	sortFindings(&report)
	return report
}

// CheckObserved extends the deterministic manifest checks with a fresh,
// authenticated SwarmOps node snapshot. The declared availability budget is
// still part of the reviewed manifest, while this function refuses a plan
// whose physical capacity, live memory/disk availability, labels, state, or
// node-agent health no longer match that plan.
func CheckObserved(manifest Manifest, observed []ObservedNode) Report {
	report := Check(manifest)
	checkObserved(manifest, observed, &report)
	sortFindings(&report)
	return report
}

func sortFindings(report *Report) {
	sort.Slice(report.Findings, func(left, right int) bool {
		if report.Findings[left].Level != report.Findings[right].Level {
			return report.Findings[left].Level < report.Findings[right].Level
		}
		if report.Findings[left].Code != report.Findings[right].Code {
			return report.Findings[left].Code < report.Findings[right].Code
		}
		return report.Findings[left].Subject < report.Findings[right].Subject
	})
}

func checkRegistry(registry Registry, errorf func(string, string, string, ...any)) {
	subject := "registry"
	if !validHost(registry.Host) {
		errorf("registry-host", subject, "host must be a hostname without a URL scheme")
	}
	if !validName(registry.Namespace) {
		errorf("registry-namespace", subject, "namespace must be a lowercase DNS-safe name")
	}
	switch registry.Mode {
	case "ghcr":
		if registry.Host != "ghcr.io" {
			errorf("registry-ghcr-host", subject, "GHCR mode requires host ghcr.io")
		}
	case "private":
		if registry.Host == "ghcr.io" {
			errorf("registry-private-host", subject, "private mode must not use ghcr.io")
		}
		if !validSecretName(registry.AuthSecret) {
			errorf("registry-auth-secret", subject, "private mode requires a versioned registry auth secret name")
		}
	default:
		errorf("registry-mode", subject, "mode must be ghcr or private")
	}
}

func checkStorage(storage []ObjectStorageProvider, errorf func(string, string, string, ...any)) map[string]ObjectStorageProvider {
	result := make(map[string]ObjectStorageProvider, len(storage))
	for _, provider := range storage {
		subject := "storage/" + provider.Name
		if !validName(provider.Name) {
			errorf("storage-name", subject, "provider name must be a lowercase DNS-safe name")
			continue
		}
		if _, exists := result[provider.Name]; exists {
			errorf("storage-duplicate", subject, "provider name is duplicated")
			continue
		}
		parsed, err := url.Parse(provider.Endpoint)
		if err != nil || parsed.Scheme != "https" || parsed.Host == "" || parsed.User != nil || parsed.RawQuery != "" || parsed.Fragment != "" {
			errorf("storage-endpoint", subject, "endpoint must be an HTTPS S3-compatible base URL without embedded credentials")
		}
		if strings.TrimSpace(provider.Bucket) == "" {
			errorf("storage-bucket", subject, "bucket is required")
		}
		if !validSecretName(provider.CredentialSecret) {
			errorf("storage-credential-secret", subject, "credentialSecret must be a versioned Swarm secret name")
		}
		result[provider.Name] = provider
	}
	return result
}

func checkBackup(backup Backup, providers map[string]ObjectStorageProvider, errorf func(string, string, string, ...any)) {
	if strings.TrimSpace(backup.Provider) == "" && strings.TrimSpace(backup.Prefix) == "" && strings.TrimSpace(backup.Schedule) == "" {
		return
	}
	if _, exists := providers[backup.Provider]; !exists {
		errorf("backup-provider", "backup", "provider %q is not declared in storage", backup.Provider)
	}
	if !validPathPrefix(backup.Prefix) {
		errorf("backup-prefix", "backup", "prefix must be a relative, traversal-free path")
	}
	if len(strings.Fields(backup.Schedule)) != 5 {
		errorf("backup-schedule", "backup", "schedule must be a five-field cron expression")
	}
}

func checkDNS(dns DNS, ingress Ingress, errorf func(string, string, string, ...any)) (map[string]DNSProvider, map[string]CertificateResolver) {
	providers := make(map[string]DNSProvider, len(dns.Providers))
	for _, provider := range dns.Providers {
		subject := "dns-provider/" + provider.Name
		if !validName(provider.Name) {
			errorf("dns-provider-name", subject, "provider name must be a lowercase DNS-safe name")
			continue
		}
		if _, exists := providers[provider.Name]; exists {
			errorf("dns-provider-duplicate", subject, "provider name is duplicated")
			continue
		}
		if provider.Type != "cloudflare" && provider.Type != "arvancloud" {
			errorf("dns-provider-type", subject, "type must be cloudflare or arvancloud")
		}
		if !validSecretName(provider.CredentialSecret) {
			errorf("dns-provider-secret", subject, "credentialSecret must be a versioned Swarm secret name")
		}
		providers[provider.Name] = provider
	}
	resolvers := make(map[string]CertificateResolver, len(dns.Resolvers))
	for _, resolver := range dns.Resolvers {
		subject := "resolver/" + resolver.Name
		if !validName(resolver.Name) {
			errorf("resolver-name", subject, "resolver name must be a lowercase DNS-safe name")
			continue
		}
		if _, exists := resolvers[resolver.Name]; exists {
			errorf("resolver-duplicate", subject, "resolver name is duplicated")
			continue
		}
		switch resolver.Challenge {
		case "dns":
			if _, exists := providers[resolver.Provider]; !exists {
				errorf("resolver-provider", subject, "DNS resolver references undeclared provider %q", resolver.Provider)
			}
		case "http":
			if resolver.Provider != "" {
				errorf("resolver-http-provider", subject, "HTTP resolver must not set a DNS provider")
			}
			if !hasPublicIP(ingress.PublicIPs) {
				errorf("resolver-http-ingress", subject, "HTTP challenge needs at least one valid public ingress IP")
			}
		default:
			errorf("resolver-challenge", subject, "challenge must be dns or http")
		}
		resolvers[resolver.Name] = resolver
	}
	return providers, resolvers
}

func checkNodes(nodes []Node, errorf, warnf func(string, string, string, ...any)) []Node {
	seen := map[string]struct{}{}
	for _, node := range nodes {
		subject := "node/" + node.Name
		if !validName(node.Name) {
			errorf("node-name", subject, "node name must be a lowercase DNS-safe name")
			continue
		}
		if _, exists := seen[node.Name]; exists {
			errorf("node-duplicate", subject, "node name is duplicated")
		}
		seen[node.Name] = struct{}{}
		if node.CPUCores <= 0 || node.MemoryMiB == 0 {
			errorf("node-capacity", subject, "cpuCores and memoryMiB must both be positive")
		}
		if node.AvailableCPUCores <= 0 || node.AvailableMemoryMiB == 0 || node.AvailableDiskGiB == 0 {
			errorf("node-available-capacity", subject, "available CPU, memory, and disk must be measured before deployment")
		}
		if node.AvailableCPUCores > node.CPUCores || node.AvailableMemoryMiB > node.MemoryMiB {
			errorf("node-available-over-capacity", subject, "available resources cannot exceed physical capacity")
		}
		for label, value := range node.Labels {
			if !labelNamePattern.MatchString(label) || strings.TrimSpace(value) == "" {
				errorf("node-label", subject, "labels must have safe names and non-empty values")
			}
		}
		if node.AvailableMemoryMiB*100 < node.MemoryMiB*20 {
			warnf("node-low-memory", subject, "less than 20%% of physical memory is currently available")
		}
	}
	if len(nodes) == 0 {
		errorf("nodes", "nodes", "at least one measured node is required")
	}
	return nodes
}

func checkObserved(manifest Manifest, observed []ObservedNode, report *Report) {
	errorf := func(code, subject, format string, args ...any) {
		report.Findings = append(report.Findings, Finding{Code: code, Level: "error", Subject: subject, Message: fmt.Sprintf(format, args...)})
	}
	warnf := func(code, subject, format string, args ...any) {
		report.Findings = append(report.Findings, Finding{Code: code, Level: "warning", Subject: subject, Message: fmt.Sprintf(format, args...)})
	}
	if len(observed) == 0 {
		errorf("live-nodes", "cluster", "no live SwarmOps node inventory was returned")
		return
	}
	liveByName := make(map[string]ObservedNode, len(observed))
	for _, node := range observed {
		name := strings.ToLower(strings.TrimSpace(node.Name))
		if !validName(name) {
			errorf("live-node-name", "cluster", "live node %q is not a lowercase DNS-safe hostname", node.Name)
			continue
		}
		if _, exists := liveByName[name]; exists {
			errorf("live-node-duplicate", "node/"+name, "live inventory contains this node more than once")
			continue
		}
		liveByName[name] = node
	}
	declared := make(map[string]struct{}, len(manifest.Nodes))
	for _, expected := range manifest.Nodes {
		name := strings.ToLower(strings.TrimSpace(expected.Name))
		declared[name] = struct{}{}
		subject := "node/" + expected.Name
		actual, exists := liveByName[name]
		if !exists {
			errorf("live-node-missing", subject, "declared node is absent from the live SwarmOps inventory")
			continue
		}
		if actual.State != "ready" {
			errorf("live-node-state", subject, "live node state is %q, expected ready", actual.State)
		}
		if !actual.AgentHealthy {
			errorf("live-agent", subject, "read-only node agent is unavailable, so memory and disk capacity are unverified")
		}
		if actual.CPUCores == 0 {
			errorf("live-cpu", subject, "live CPU capacity is unavailable")
		} else if actual.CPUCores < expected.CPUCores {
			errorf("live-cpu-capacity", subject, "live CPU capacity %.2f is below declared %.2f", actual.CPUCores, expected.CPUCores)
		}
		if actual.MemoryMiB == 0 {
			errorf("live-memory", subject, "live memory capacity is unavailable")
		} else if actual.MemoryMiB < expected.MemoryMiB {
			errorf("live-memory-capacity", subject, "live memory capacity %d MiB is below declared %d MiB", actual.MemoryMiB, expected.MemoryMiB)
		}
		if actual.AvailableMemoryMiB == 0 {
			errorf("live-memory-available", subject, "live available memory is unavailable")
		} else if actual.AvailableMemoryMiB < expected.AvailableMemoryMiB {
			errorf("live-memory-available", subject, "live available memory %d MiB is below declared %d MiB", actual.AvailableMemoryMiB, expected.AvailableMemoryMiB)
		}
		if actual.AvailableDiskGiB == 0 {
			errorf("live-disk-available", subject, "live available disk is unavailable")
		} else if actual.AvailableDiskGiB < expected.AvailableDiskGiB {
			errorf("live-disk-available", subject, "live available disk %d GiB is below declared %d GiB", actual.AvailableDiskGiB, expected.AvailableDiskGiB)
		}
		for label, expectedValue := range expected.Labels {
			if actual.Labels[label] != expectedValue {
				errorf("live-label", subject, "live label %q is %q, expected %q", label, actual.Labels[label], expectedValue)
			}
		}
	}
	for name := range liveByName {
		if _, exists := declared[name]; !exists {
			warnf("live-node-undeclared", "node/"+name, "live node is not part of this reviewed platform manifest")
		}
	}
	warnf("live-cpu-reservations", "cluster", "live checks verify CPU core capacity; retain the reviewed manifest reservation budget because SwarmOps does not infer CPU availability from load")
}

func checkBuild(build Build, nodes []Node, errorf func(string, string, string, ...any)) {
	if build.NodeLabel == "" && build.CacheNodeLabel == "" {
		return
	}
	if build.NodeLabel != "" && !labelNamePattern.MatchString(build.NodeLabel) {
		errorf("build-label", "build", "nodeLabel must be a safe label name")
	}
	if build.CacheNodeLabel != "" && !labelNamePattern.MatchString(build.CacheNodeLabel) {
		errorf("build-cache-label", "build", "cacheNodeLabel must be a safe label name")
	}
	if build.NodeLabel != "" && len(nodesWithLabel(nodes, build.NodeLabel)) == 0 {
		errorf("build-node", "build", "no measured node has build label %q", build.NodeLabel)
	}
	if build.CacheNodeLabel != "" && len(nodesWithLabel(nodes, build.CacheNodeLabel)) == 0 {
		errorf("build-cache-node", "build", "no measured node has cache label %q", build.CacheNodeLabel)
	}
}

func checkWorkloads(manifest Manifest, nodes []Node, storage map[string]ObjectStorageProvider, resolvers map[string]CertificateResolver, report *Report, errorf, warnf func(string, string, string, ...any)) {
	seenNames := map[string]struct{}{}
	seenDomains := map[string]string{}
	profileCounts := map[string]int{}
	for _, workload := range manifest.Workloads {
		subject := "workload/" + workload.Name
		if !validName(workload.Name) {
			errorf("workload-name", subject, "name must be a lowercase DNS-safe name")
			continue
		}
		fullName := manifest.Namespace + "-" + workload.Name
		if _, exists := seenNames[fullName]; exists {
			errorf("workload-duplicate", subject, "name collides in namespace %q", manifest.Namespace)
		}
		seenNames[fullName] = struct{}{}
		rule, found := profiles[workload.Profile]
		if !found {
			errorf("workload-profile", subject, "profile %q is unsupported", workload.Profile)
			continue
		}
		profileCounts[workload.Profile]++
		if workload.Replicas < rule.minReplicas {
			errorf("workload-replicas", subject, "profile %q requires at least %d replicas", workload.Profile, rule.minReplicas)
		}
		if rule.maxReplicas > 0 && workload.Replicas > rule.maxReplicas {
			errorf("workload-replicas", subject, "profile %q permits at most %d replica", workload.Profile, rule.maxReplicas)
		}
		resources := mergeResources(rule.defaultResources, workload.Resources)
		if resources.CPUCores <= 0 || resources.MemoryMiB == 0 || resources.DiskGiB == 0 {
			errorf("workload-resources", subject, "CPU, memory, and disk reservations must be positive")
		}
		report.Totals.Requested.CPUCores += resources.CPUCores * float64(max(workload.Replicas, 0))
		report.Totals.Requested.MemoryMiB += resources.MemoryMiB * uint64(max(workload.Replicas, 0))
		report.Totals.Requested.DiskGiB += resources.DiskGiB * uint64(max(workload.Replicas, 0))
		checkPlacement(workload, rule, resources, nodes, errorf)
		checkDomain(workload, rule, resolvers, manifest.Ingress, seenDomains, errorf)
		if workload.ObjectStorageProvider != "" {
			if _, exists := storage[workload.ObjectStorageProvider]; !exists {
				errorf("workload-storage", subject, "objectStorageProvider %q is not declared", workload.ObjectStorageProvider)
			}
		}
	}
	for _, node := range nodes {
		report.Totals.Available.CPUCores += node.AvailableCPUCores
		report.Totals.Available.MemoryMiB += node.AvailableMemoryMiB
		report.Totals.Available.DiskGiB += node.AvailableDiskGiB
	}
	if report.Totals.Requested.CPUCores > report.Totals.Available.CPUCores || report.Totals.Requested.MemoryMiB > report.Totals.Available.MemoryMiB || report.Totals.Requested.DiskGiB > report.Totals.Available.DiskGiB {
		errorf("cluster-capacity", "cluster", "requested reservations exceed measured available cluster resources")
	}
	if profileCounts["observability"] > 1 {
		errorf("observability-duplicate", "workloads", "declare one shared observability workload for the cluster")
	}
	if len(manifest.Workloads) == 0 {
		warnf("workloads-empty", "workloads", "no workloads are declared; only topology checks were performed")
	}
}

func checkPlacement(workload Workload, rule profileRule, resources Resources, nodes []Node, errorf func(string, string, string, ...any)) {
	subject := "workload/" + workload.Name
	eligible := nodes
	if rule.spreadLabel != "" {
		eligible = nodesWithLabel(nodes, rule.spreadLabel)
		if len(eligible) == 0 {
			errorf("placement-label", subject, "profile %q needs node label %q on eligible nodes", workload.Profile, rule.spreadLabel)
			return
		}
	}
	if rule.spreadLabel != "" && workload.Replicas > len(eligible) {
		errorf("placement-anti-affinity", subject, "profile %q requires %d distinct eligible nodes, but only %d are labelled", workload.Profile, workload.Replicas, len(eligible))
	}
	if len(rule.requiredSlots) > 0 {
		for _, slot := range rule.requiredSlots {
			matches := 0
			for _, node := range eligible {
				if node.Labels[rule.slotLabel] == slot {
					matches++
				}
			}
			if matches != 1 {
				errorf("placement-slot", subject, "profile %q requires exactly one eligible node labelled %s=%q, found %d", workload.Profile, rule.slotLabel, slot, matches)
			}
		}
	}
	fitsOne := false
	for _, node := range eligible {
		if node.AvailableCPUCores >= resources.CPUCores && node.AvailableMemoryMiB >= resources.MemoryMiB && node.AvailableDiskGiB >= resources.DiskGiB {
			fitsOne = true
			break
		}
	}
	if !fitsOne {
		errorf("placement-capacity", subject, "no eligible node can satisfy one replica reservation")
	}
}

func checkDomain(workload Workload, rule profileRule, resolvers map[string]CertificateResolver, ingress Ingress, seen map[string]string, errorf func(string, string, string, ...any)) {
	subject := "workload/" + workload.Name
	if rule.requiresIngress {
		if net.ParseIP(workload.AdvertiseIP) == nil {
			errorf("jitsi-advertise-ip", subject, "Jitsi requires a valid advertiseIP")
		} else if !containsIP(ingress.PublicIPs, workload.AdvertiseIP) {
			errorf("jitsi-ingress-ip", subject, "Jitsi advertiseIP must match a configured ingress public IP")
		}
	}
	if workload.Domain == "" {
		if rule.requiresIngress {
			errorf("jitsi-domain", subject, "Jitsi requires a domain routed through the ingress")
		}
		return
	}
	domain := strings.ToLower(strings.TrimSuffix(strings.TrimSpace(workload.Domain), "."))
	if !validDomain(domain) {
		errorf("domain", subject, "domain must be a valid lowercase hostname")
		return
	}
	if previous, exists := seen[domain]; exists {
		errorf("domain-duplicate", subject, "domain %q already belongs to %s", domain, previous)
	} else {
		seen[domain] = subject
	}
	resolver, exists := resolvers[workload.Resolver]
	if !exists {
		errorf("domain-resolver", subject, "domain requires a declared certificate resolver")
	} else if resolver.Challenge == "http" && !hasPublicIP(ingress.PublicIPs) {
		errorf("domain-http-ingress", subject, "HTTP resolver needs a valid ingress public IP")
	}
}

func mergeResources(defaults, requested Resources) Resources {
	if requested.CPUCores != 0 {
		defaults.CPUCores = requested.CPUCores
	}
	if requested.MemoryMiB != 0 {
		defaults.MemoryMiB = requested.MemoryMiB
	}
	if requested.DiskGiB != 0 {
		defaults.DiskGiB = requested.DiskGiB
	}
	return defaults
}

func nodesWithLabel(nodes []Node, label string) []Node {
	result := make([]Node, 0, len(nodes))
	for _, node := range nodes {
		if node.Labels[label] == "true" {
			result = append(result, node)
		}
	}
	return result
}

func validName(value string) bool { return namePattern.MatchString(strings.TrimSpace(value)) }

func validSecretName(value string) bool {
	return secretNamePattern.MatchString(strings.TrimSpace(value))
}

func validHost(value string) bool {
	value = strings.TrimSpace(strings.ToLower(value))
	if value == "" || strings.Contains(value, "://") || strings.ContainsAny(value, "/?#@") || net.ParseIP(value) != nil {
		return false
	}
	return validDomain(value)
}

func validDomain(value string) bool {
	if value == "" || len(value) > 253 || strings.HasPrefix(value, "*") || strings.HasSuffix(value, "-") {
		return false
	}
	for _, label := range strings.Split(value, ".") {
		if len(label) == 0 || len(label) > 63 || strings.HasPrefix(label, "-") || !regexp.MustCompile(`^[a-z0-9-]+$`).MatchString(label) {
			return false
		}
	}
	return strings.Contains(value, ".")
}

func validPathPrefix(value string) bool {
	value = strings.TrimSpace(value)
	return value != "" && !strings.HasPrefix(value, "/") && !strings.Contains(value, "..") && !strings.ContainsAny(value, "\\\r\n\x00")
}

func hasPublicIP(values []string) bool {
	for _, value := range values {
		if net.ParseIP(value) != nil {
			return true
		}
	}
	return false
}

func containsIP(values []string, wanted string) bool {
	wantedIP := net.ParseIP(wanted)
	if wantedIP == nil {
		return false
	}
	for _, value := range values {
		if candidate := net.ParseIP(value); candidate != nil && candidate.Equal(wantedIP) {
			return true
		}
	}
	return false
}

func max(left, right int) int {
	if left > right {
		return left
	}
	return right
}
