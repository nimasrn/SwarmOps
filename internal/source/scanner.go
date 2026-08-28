package source

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"path"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"gopkg.in/yaml.v3"
)

var (
	appNameSanitizer  = regexp.MustCompile(`[^a-z0-9-]+`)
	httpTargetPattern = regexp.MustCompile(`https?://[^/\s'\"]+(/[A-Za-z0-9._~/-]*)`)
)

type scannedFile struct {
	evidence EvidenceFile
	content  []byte
}

type composeServiceEvidence struct {
	build          *BuildPlan
	classification Classification
	databases      []string
	dependsOn      []string
	environment    []string
	findings       []Finding
	healthPath     string
	image          string
	labels         []string
	metrics        bool
	name           string
	port           uint16
	sharedStacks   []string
	tracing        bool
}

func scanRepository(ctx context.Context, provider provider, repository Repository, revision Revision, options Options) (Plan, error) {
	entries, err := provider.ListTree(ctx, repository.ID, revision)
	if err != nil {
		return Plan{}, err
	}
	var composeEntries, dockerEntries []TreeEntry
	for _, entry := range entries {
		if entry.Type != "blob" && entry.Type != "file" {
			continue
		}
		base := strings.ToLower(path.Base(entry.Path))
		switch {
		case isComposeFilename(base):
			composeEntries = append(composeEntries, entry)
		case base == "dockerfile" || strings.HasPrefix(base, "dockerfile."):
			dockerEntries = append(dockerEntries, entry)
		}
	}
	if len(composeEntries)+len(dockerEntries) > options.MaxDiscoveryFiles {
		return Plan{}, fmt.Errorf("repository contains more than %d deployment manifests", options.MaxDiscoveryFiles)
	}
	composeFiles, dockerfiles, err := readEvidenceFiles(ctx, provider, repository.ID, revision, composeEntries, dockerEntries, options)
	if err != nil {
		return Plan{}, err
	}
	plan := Plan{
		ComposeFiles: evidenceOnly(composeFiles),
		Dockerfiles:  evidenceOnly(dockerfiles),
		GeneratedAt:  time.Now().UTC(),
		Repository:   repository,
		Revision:     revision,
		Scanner:      ScannerVersion,
	}
	dockerSet := make(map[string]bool, len(dockerfiles))
	for _, file := range dockerfiles {
		dockerSet[file.evidence.Path] = true
	}
	referencedDockerfiles := map[string]bool{}
	for _, file := range composeFiles {
		services, findings := scanCompose(file, repository, revision, dockerSet, options)
		plan.Findings = append(plan.Findings, findings...)
		for _, service := range services {
			if service.Build != nil {
				referencedDockerfiles[path.Join(service.Build.ContextPath, service.Build.DockerfilePath)] = true
			}
			plan.Services = append(plan.Services, service)
		}
	}
	for _, file := range dockerfiles {
		if referencedDockerfiles[file.evidence.Path] {
			continue
		}
		contextPath := path.Dir(file.evidence.Path)
		if contextPath == "." {
			contextPath = ""
		}
		serviceName := dockerfileServiceName(file.evidence.Path)
		build := &BuildPlan{ContextPath: contextPath, DockerfilePath: path.Base(file.evidence.Path), Image: generatedImage(options.ImagePrefix, repository.Path, serviceName, revision.SHA), Required: true}
		findings := []Finding{{Code: "dockerfile_without_compose", Level: FindingWarning, Message: "Dockerfile was found without a Compose service; confirm its container port and health endpoint.", Subject: file.evidence.Path}}
		if build.Image == "" {
			findings = append(findings, Finding{Code: "build_registry_unavailable", Level: FindingBlocker, Message: "Source builds require a configured allow-listed image prefix.", Subject: file.evidence.Path})
		}
		plan.Services = append(plan.Services, ServicePlan{
			Build: build, Classification: ClassificationApplication, ComposePath: "", Findings: findings,
			HealthPath: "/healthz", Image: build.Image, Name: serviceName, Service: serviceName,
		})
	}
	if len(plan.ComposeFiles) == 0 {
		plan.Findings = append(plan.Findings, Finding{Code: "compose_not_found", Level: FindingWarning, Message: "No Compose file was found; standalone Dockerfiles were inspected instead."})
	}
	if len(plan.ComposeFiles) == 0 && len(plan.Dockerfiles) == 0 {
		plan.Findings = append(plan.Findings, Finding{Code: "deployment_files_not_found", Level: FindingBlocker, Message: "No Compose file or Dockerfile was found anywhere in the repository."})
	}
	finalizePlan(&plan)
	return plan, nil
}

func readEvidenceFiles(ctx context.Context, provider provider, repositoryID string, revision Revision, composeEntries, dockerEntries []TreeEntry, options Options) ([]scannedFile, []scannedFile, error) {
	read := func(entries []TreeEntry, consumed *int64) ([]scannedFile, error) {
		result := make([]scannedFile, 0, len(entries))
		for _, entry := range entries {
			if entry.Size > options.MaxFileBytes {
				return nil, fmt.Errorf("deployment manifest %q exceeds the %d byte limit", entry.Path, options.MaxFileBytes)
			}
			content, err := provider.ReadFile(ctx, repositoryID, revision, entry.Path)
			if err != nil {
				return nil, fmt.Errorf("read deployment manifest %q: %w", entry.Path, err)
			}
			*consumed += int64(len(content))
			if *consumed > options.MaxDiscoveryBytes {
				return nil, fmt.Errorf("deployment manifests exceed the %d byte discovery limit", options.MaxDiscoveryBytes)
			}
			digest := sha256.Sum256(content)
			result = append(result, scannedFile{content: content, evidence: EvidenceFile{Digest: "sha256:" + hex.EncodeToString(digest[:]), Path: entry.Path, Size: int64(len(content))}})
		}
		return result, nil
	}
	var consumed int64
	composeFiles, err := read(composeEntries, &consumed)
	if err != nil {
		return nil, nil, err
	}
	dockerfiles, err := read(dockerEntries, &consumed)
	if err != nil {
		return nil, nil, err
	}
	return composeFiles, dockerfiles, nil
}

func scanCompose(file scannedFile, repository Repository, revision Revision, dockerfiles map[string]bool, options Options) ([]ServicePlan, []Finding) {
	var root map[string]any
	if err := yaml.Unmarshal(file.content, &root); err != nil {
		return nil, []Finding{{Code: "compose_parse", Level: FindingBlocker, Message: "Compose evidence could not be parsed.", Subject: file.evidence.Path}}
	}
	services, ok := stringMap(root["services"])
	if !ok || len(services) == 0 {
		return nil, []Finding{{Code: "compose_services", Level: FindingBlocker, Message: "Compose evidence has no service map.", Subject: file.evidence.Path}}
	}
	names := make([]string, 0, len(services))
	for name := range services {
		names = append(names, name)
	}
	sort.Strings(names)
	evidence := make(map[string]composeServiceEvidence, len(names))
	for _, name := range names {
		raw, ok := stringMap(services[name])
		if !ok {
			evidence[name] = composeServiceEvidence{name: name, classification: ClassificationUnsupported, findings: []Finding{{Code: "service_shape", Level: FindingBlocker, Message: "Compose service must be an object.", Subject: file.evidence.Path + "#" + name}}}
			continue
		}
		evidence[name] = inspectComposeService(file.evidence.Path, name, raw, repository, revision, dockerfiles, options)
	}
	globalStacks := map[string]bool{}
	dataServices := map[string]string{}
	platformServices := map[string][]string{}
	for name, item := range evidence {
		if item.classification == ClassificationManagedData && len(item.databases) > 0 {
			dataServices[name] = item.databases[0]
		}
		if item.classification == ClassificationSharedPlatform {
			platformServices[name] = item.sharedStacks
			for _, stack := range item.sharedStacks {
				globalStacks[stack] = true
			}
		}
	}
	result := make([]ServicePlan, 0, len(evidence))
	for _, name := range names {
		item := evidence[name]
		if item.classification == ClassificationApplication {
			for _, dependency := range item.dependsOn {
				if engine := dataServices[dependency]; engine != "" {
					item.databases = append(item.databases, engine)
				}
				for _, stack := range platformServices[dependency] {
					item.sharedStacks = append(item.sharedStacks, stack)
				}
			}
			for stack := range globalStacks {
				item.sharedStacks = append(item.sharedStacks, stack)
			}
			item.databases = sortedUnique(item.databases)
			item.sharedStacks = sortedUnique(item.sharedStacks)
			if contains(item.sharedStacks, "swarmops-observability") {
				item.metrics = item.metrics || containsFold(item.environment, "PROMETHEUS_URL")
				item.tracing = item.tracing || hasAnyFold(item.environment, "OTEL_EXPORTER_OTLP_ENDPOINT", "JAEGER_ENDPOINT", "JAEGER_AGENT_HOST")
			}
		}
		result = append(result, ServicePlan{
			Build: item.build, Classification: item.classification, ComposePath: file.evidence.Path,
			Databases: item.databases, Findings: item.findings, HealthPath: item.healthPath,
			Image: item.image, Metrics: item.metrics, Name: normalizeApplicationName(name), Port: item.port,
			Service: name, SharedStacks: item.sharedStacks, Tracing: item.tracing,
		})
	}
	return result, nil
}

func inspectComposeService(composePath, name string, service map[string]any, repository Repository, revision Revision, dockerfiles map[string]bool, options Options) composeServiceEvidence {
	subject := composePath + "#" + name
	image, _ := service["image"].(string)
	image = strings.TrimSpace(image)
	classification, databases, stacks := classifyService(name, image)
	result := composeServiceEvidence{
		classification: classification, databases: databases, image: image, name: name,
		sharedStacks: stacks, dependsOn: dependencyNames(service["depends_on"]),
		environment: environmentKeys(service["environment"]), labels: labelKeys(service["labels"]),
	}
	result.metrics = hasAnyFold(result.environment, "METRICS_PORT", "PROMETHEUS_URL", "PROMETHEUS_ENDPOINT") || hasAnyPrefixFold(result.labels, "prometheus.io/")
	result.tracing = hasAnyPrefixFold(result.environment, "OTEL_", "JAEGER_")
	if classification == ClassificationManagedData {
		result.findings = append(result.findings, Finding{Code: "managed_database", Level: FindingInfo, Message: "This source service will be replaced by the matching SwarmOps managed database.", Subject: subject})
		return result
	}
	if classification == ClassificationSharedPlatform {
		result.findings = append(result.findings, Finding{Code: "shared_platform", Level: FindingInfo, Message: "This source service will be replaced by the reviewed global SwarmOps stack.", Subject: subject})
		return result
	}
	if classification == ClassificationUnsupported {
		result.findings = append(result.findings, Finding{Code: "unsupported_database", Level: FindingBlocker, Message: "This stateful service has no managed SwarmOps equivalent.", Subject: subject})
		return result
	}
	composeDir := path.Dir(composePath)
	if composeDir == "." {
		composeDir = ""
	}
	buildIdentity := strings.TrimSuffix(composePath, path.Ext(composePath)) + "-" + name
	build, buildFindings := composeBuildPlan(service["build"], composeDir, buildIdentity, repository, revision, dockerfiles, options)
	result.build = build
	result.findings = append(result.findings, buildFindings...)
	if build != nil {
		result.image = build.Image
	} else if image == "" {
		defaultDockerfile := path.Join(composeDir, "Dockerfile")
		if dockerfiles[defaultDockerfile] {
			result.build = &BuildPlan{ContextPath: composeDir, DockerfilePath: "Dockerfile", Image: generatedImage(options.ImagePrefix, repository.Path, buildIdentity, revision.SHA), Required: true}
			result.image = result.build.Image
			if result.image == "" {
				result.findings = append(result.findings, Finding{Code: "build_registry_unavailable", Level: FindingBlocker, Message: "Source builds require a configured allow-listed image prefix.", Subject: subject})
			}
		} else {
			result.findings = append(result.findings, Finding{Code: "service_image", Level: FindingBlocker, Message: "Application service has neither an image nor a discoverable Dockerfile.", Subject: subject})
		}
	} else if !immutableImage(image) {
		result.findings = append(result.findings, Finding{Code: "mutable_image", Level: FindingBlocker, Message: "Application image is mutable and no Dockerfile build pins it to this commit.", Subject: subject})
	}
	ports := containerPorts(service)
	result.port, result.findings = choosePort(ports, subject, result.findings)
	result.healthPath = healthPath(service["healthcheck"])
	if result.healthPath == "" {
		result.healthPath = "/healthz"
		result.findings = append(result.findings, Finding{Code: "health_path_assumed", Level: FindingWarning, Message: "No HTTP health path was detected; /healthz is proposed for review.", Subject: subject})
	}
	if len(result.environment) > 0 {
		result.findings = append(result.findings, Finding{Code: "environment_review", Level: FindingWarning, Message: "Source environment values are not imported; add required non-secret settings and Swarm secrets through reviewed SwarmOps inputs.", Subject: subject})
	}
	if privileged, _ := service["privileged"].(bool); privileged {
		result.findings = append(result.findings, Finding{Code: "privileged_ignored", Level: FindingWarning, Message: "Privileged mode is not imported into the generated application.", Subject: subject})
	}
	if networkMode, _ := service["network_mode"].(string); strings.TrimSpace(networkMode) != "" {
		result.findings = append(result.findings, Finding{Code: "network_mode_ignored", Level: FindingWarning, Message: "Source network_mode is not imported; SwarmOps uses reviewed shared overlays.", Subject: subject})
	}
	return result
}

func classifyService(name, image string) (Classification, []string, []string) {
	value := strings.ToLower(name + " " + image)
	switch {
	case containsWord(value, "postgres"), containsWord(value, "timescaledb"):
		return ClassificationManagedData, []string{"postgres"}, nil
	case containsWord(value, "mongo"):
		return ClassificationManagedData, []string{"mongo"}, nil
	case containsWord(value, "redis"), containsWord(value, "valkey"):
		return ClassificationManagedData, []string{"redis"}, nil
	case containsWord(value, "mysql"), containsWord(value, "mariadb"), containsWord(value, "cassandra"), containsWord(value, "cockroach"):
		return ClassificationUnsupported, nil, nil
	case containsWord(value, "loki"), containsWord(value, "alloy"), containsWord(value, "promtail"), containsWord(value, "fluentd"), strings.Contains(value, "fluent-bit"), containsWord(value, "fluentbit"):
		return ClassificationSharedPlatform, nil, []string{"swarmops-logs"}
	case containsWord(value, "grafana"):
		return ClassificationUnsupported, nil, nil
	case containsWord(value, "prometheus"), containsWord(value, "jaeger"), containsWord(value, "alertmanager"):
		return ClassificationSharedPlatform, nil, []string{"swarmops-observability"}
	case containsWord(value, "node-exporter"), containsWord(value, "cadvisor"):
		return ClassificationSharedPlatform, nil, []string{"swarmops-agent"}
	default:
		return ClassificationApplication, nil, nil
	}
}

func composeBuildPlan(raw any, composeDir, serviceName string, repository Repository, revision Revision, dockerfiles map[string]bool, options Options) (*BuildPlan, []Finding) {
	if raw == nil {
		return nil, nil
	}
	contextValue := "."
	dockerfileValue := "Dockerfile"
	switch typed := raw.(type) {
	case string:
		contextValue = typed
	case map[string]any:
		if value, ok := typed["context"].(string); ok {
			contextValue = value
		}
		if value, ok := typed["dockerfile"].(string); ok {
			dockerfileValue = value
		}
	default:
		return nil, []Finding{{Code: "build_shape", Level: FindingBlocker, Message: "Compose build must use a local string or object context."}}
	}
	contextPath, err := resolveRepositoryPath(composeDir, contextValue)
	if err != nil {
		return nil, []Finding{{Code: "build_context", Level: FindingBlocker, Message: "Build context must stay inside the selected repository."}}
	}
	dockerfilePath, err := cleanRelativePath(dockerfileValue)
	if err != nil {
		return nil, []Finding{{Code: "dockerfile_path", Level: FindingBlocker, Message: "Dockerfile path must stay inside the selected build context."}}
	}
	physical := path.Join(contextPath, dockerfilePath)
	findings := []Finding{}
	if !dockerfiles[physical] {
		findings = append(findings, Finding{Code: "dockerfile_missing", Level: FindingBlocker, Message: "The Dockerfile named by Compose was not found in the immutable repository tree.", Subject: physical})
	}
	image := generatedImage(options.ImagePrefix, repository.Path, serviceName, revision.SHA)
	if image == "" {
		findings = append(findings, Finding{Code: "build_registry_unavailable", Level: FindingBlocker, Message: "Source builds require a configured allow-listed image prefix.", Subject: physical})
	}
	return &BuildPlan{ContextPath: contextPath, DockerfilePath: dockerfilePath, Image: image, Required: true}, findings
}

func finalizePlan(plan *Plan) {
	nameCounts := map[string]int{}
	for _, service := range plan.Services {
		if service.Classification == ClassificationApplication {
			nameCounts[service.Name]++
		}
	}
	for index := range plan.Services {
		service := &plan.Services[index]
		if service.Classification == ClassificationApplication && nameCounts[service.Name] > 1 {
			identity := strings.TrimSuffix(service.ComposePath, path.Ext(service.ComposePath))
			if identity == "" {
				identity = plan.Repository.Name
			}
			service.Name = normalizeApplicationName(identity + "-" + service.Name)
		}
		service.Databases = sortedUnique(service.Databases)
		service.SharedStacks = sortedUnique(service.SharedStacks)
		sortFindings(service.Findings)
	}
	sort.Slice(plan.Services, func(left, right int) bool {
		if plan.Services[left].ComposePath != plan.Services[right].ComposePath {
			return plan.Services[left].ComposePath < plan.Services[right].ComposePath
		}
		return plan.Services[left].Service < plan.Services[right].Service
	})
	stacks := []string{}
	for _, service := range plan.Services {
		stacks = append(stacks, service.SharedStacks...)
	}
	plan.SharedStacks = sortedUnique(stacks)
	sortFindings(plan.Findings)
	for _, service := range plan.Services {
		if service.Classification == ClassificationApplication && !hasBlocker(service.Findings) {
			plan.Ready = true
			break
		}
	}
	canonical := *plan
	canonical.ID = ""
	canonical.GeneratedAt = time.Time{}
	encoded, _ := json.Marshal(canonical)
	digest := sha256.Sum256(encoded)
	plan.ID = "sha256:" + hex.EncodeToString(digest[:])
}

func evidenceOnly(files []scannedFile) []EvidenceFile {
	result := make([]EvidenceFile, len(files))
	for index := range files {
		result[index] = files[index].evidence
	}
	sort.Slice(result, func(left, right int) bool { return result[left].Path < result[right].Path })
	return result
}

func stringMap(value any) (map[string]any, bool) {
	result, ok := value.(map[string]any)
	return result, ok
}

func dependencyNames(value any) []string {
	var result []string
	switch typed := value.(type) {
	case []any:
		for _, item := range typed {
			if name, ok := item.(string); ok {
				result = append(result, name)
			}
		}
	case map[string]any:
		for name := range typed {
			result = append(result, name)
		}
	}
	return sortedUnique(result)
}

func environmentKeys(value any) []string {
	var result []string
	switch typed := value.(type) {
	case []any:
		for _, item := range typed {
			if text, ok := item.(string); ok {
				key, _, _ := strings.Cut(text, "=")
				result = append(result, strings.TrimSpace(key))
			}
		}
	case map[string]any:
		for key := range typed {
			result = append(result, key)
		}
	}
	return sortedUnique(result)
}

func labelKeys(value any) []string {
	return environmentKeys(value)
}

func containerPorts(service map[string]any) []uint16 {
	var result []uint16
	read := func(value any, targetKey string) {
		items, ok := value.([]any)
		if !ok {
			return
		}
		for _, item := range items {
			switch typed := item.(type) {
			case int:
				if typed > 0 && typed <= 65535 {
					result = append(result, uint16(typed))
				}
			case string:
				value := strings.SplitN(typed, "/", 2)[0]
				parts := strings.Split(value, ":")
				candidate := parts[len(parts)-1]
				if parsed, err := strconv.ParseUint(candidate, 10, 16); err == nil && parsed > 0 {
					result = append(result, uint16(parsed))
				}
			case map[string]any:
				candidate := typed[targetKey]
				switch number := candidate.(type) {
				case int:
					if number > 0 && number <= 65535 {
						result = append(result, uint16(number))
					}
				case string:
					if parsed, err := strconv.ParseUint(number, 10, 16); err == nil && parsed > 0 {
						result = append(result, uint16(parsed))
					}
				}
			}
		}
	}
	read(service["ports"], "target")
	read(service["expose"], "target")
	values := sortedUniqueUint16(result)
	return values
}

func choosePort(ports []uint16, subject string, findings []Finding) (uint16, []Finding) {
	if len(ports) == 0 {
		return 0, append(findings, Finding{Code: "port_needs_review", Level: FindingWarning, Message: "No container port was detected; choose the application port before deployment.", Subject: subject})
	}
	if len(ports) == 1 {
		return ports[0], findings
	}
	for _, preferred := range []uint16{8080, 8000, 3000, 80} {
		if containsUint16(ports, preferred) {
			return preferred, append(findings, Finding{Code: "multiple_ports", Level: FindingWarning, Message: fmt.Sprintf("Multiple container ports were found; %d is proposed for review.", preferred), Subject: subject})
		}
	}
	return ports[0], append(findings, Finding{Code: "multiple_ports", Level: FindingWarning, Message: fmt.Sprintf("Multiple container ports were found; %d is proposed for review.", ports[0]), Subject: subject})
}

func healthPath(value any) string {
	health, ok := stringMap(value)
	if !ok {
		return ""
	}
	test := fmt.Sprint(health["test"])
	match := httpTargetPattern.FindStringSubmatch(test)
	if len(match) == 2 && strings.HasPrefix(match[1], "/") {
		return match[1]
	}
	return ""
}

func resolveRepositoryPath(base, value string) (string, error) {
	value = strings.TrimSpace(value)
	if value == "" || strings.Contains(value, "://") || strings.HasPrefix(value, "/") || strings.ContainsAny(value, "\\\r\n\x00") {
		return "", fmt.Errorf("invalid repository-relative path")
	}
	joined := path.Clean(path.Join(base, value))
	if joined == "." {
		return "", nil
	}
	if joined == ".." || strings.HasPrefix(joined, "../") {
		return "", fmt.Errorf("path leaves repository")
	}
	return joined, nil
}

func cleanRelativePath(value string) (string, error) {
	value = strings.TrimSpace(value)
	if value == "" || strings.HasPrefix(value, "/") || strings.ContainsAny(value, "\\\r\n\x00") {
		return "", fmt.Errorf("invalid relative path")
	}
	clean := path.Clean(value)
	if clean == "." || clean == ".." || strings.HasPrefix(clean, "../") {
		return "", fmt.Errorf("invalid relative path")
	}
	return clean, nil
}

func generatedImage(prefix, repositoryPath, service, revision string) string {
	if prefix == "" || !validSHA(revision) {
		return ""
	}
	repositoryName := path.Base(repositoryPath)
	name := normalizeApplicationName(repositoryName + "-" + service)
	return prefix + "/" + name + ":" + strings.ToLower(revision[:12])
}

// isComposeFilename recognizes the canonical Compose names plus named
// variants such as compose.production.yaml and docker-compose.dev.yml. The
// scanner remains deliberately bounded to Compose-shaped filenames instead of
// attempting to parse every YAML file in a private repository.
func isComposeFilename(filename string) bool {
	filename = strings.ToLower(strings.TrimSpace(filename))
	if !(strings.HasPrefix(filename, "compose.") || strings.HasPrefix(filename, "docker-compose.")) {
		return false
	}
	return strings.HasSuffix(filename, ".yml") || strings.HasSuffix(filename, ".yaml")
}

func immutableImage(image string) bool {
	image = strings.TrimSpace(image)
	if image == "" || strings.Contains(image, "${") {
		return false
	}
	if strings.Contains(image, "@sha256:") {
		return true
	}
	lastSlash := strings.LastIndex(image, "/")
	colon := strings.LastIndex(image, ":")
	if colon <= lastSlash || colon == len(image)-1 {
		return false
	}
	tag := strings.ToLower(image[colon+1:])
	return tag != "latest" && tag != "main" && tag != "master" && tag != "dev" && tag != "edge"
}

func dockerfileServiceName(filename string) string {
	directory := path.Base(path.Dir(filename))
	base := path.Base(filename)
	suffix := strings.TrimPrefix(strings.ToLower(base), "dockerfile")
	suffix = strings.TrimPrefix(suffix, ".")
	if directory == "." || directory == "/" || directory == "" {
		directory = suffix
	} else if suffix != "" {
		directory += "-" + suffix
	}
	if directory == "" {
		directory = "application"
	}
	return normalizeApplicationName(directory)
}

func normalizeApplicationName(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	value = appNameSanitizer.ReplaceAllString(value, "-")
	value = strings.Trim(value, "-")
	if value == "" || value[0] < 'a' || value[0] > 'z' {
		value = "app-" + value
	}
	if len(value) > 41 {
		digest := sha256.Sum256([]byte(value))
		value = strings.Trim(value[:32], "-") + "-" + hex.EncodeToString(digest[:4])
	}
	return value
}

func containsWord(value, word string) bool {
	value = strings.NewReplacer("/", " ", ":", " ", "_", " ", "-", " ", ".", " ").Replace(value)
	for _, token := range strings.Fields(value) {
		if token == word || strings.HasPrefix(token, word) {
			return true
		}
	}
	return false
}

func sortedUnique(values []string) []string {
	seen := map[string]bool{}
	result := make([]string, 0, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value != "" && !seen[value] {
			seen[value] = true
			result = append(result, value)
		}
	}
	sort.Strings(result)
	return result
}

func sortedUniqueUint16(values []uint16) []uint16 {
	seen := map[uint16]bool{}
	result := make([]uint16, 0, len(values))
	for _, value := range values {
		if value != 0 && !seen[value] {
			seen[value] = true
			result = append(result, value)
		}
	}
	sort.Slice(result, func(left, right int) bool { return result[left] < result[right] })
	return result
}

func sortFindings(findings []Finding) {
	sort.Slice(findings, func(left, right int) bool {
		if findings[left].Level != findings[right].Level {
			return findings[left].Level < findings[right].Level
		}
		if findings[left].Code != findings[right].Code {
			return findings[left].Code < findings[right].Code
		}
		return findings[left].Subject < findings[right].Subject
	})
}

func hasBlocker(findings []Finding) bool {
	for _, finding := range findings {
		if finding.Level == FindingBlocker {
			return true
		}
	}
	return false
}

func contains(values []string, wanted string) bool {
	for _, value := range values {
		if value == wanted {
			return true
		}
	}
	return false
}

func hasAnyFold(values []string, wanted ...string) bool {
	for _, candidate := range values {
		for _, value := range wanted {
			if strings.EqualFold(candidate, value) {
				return true
			}
		}
	}
	return false
}

func hasAnyPrefixFold(values []string, prefixes ...string) bool {
	for _, candidate := range values {
		candidate = strings.ToLower(candidate)
		for _, prefix := range prefixes {
			if strings.HasPrefix(candidate, strings.ToLower(prefix)) {
				return true
			}
		}
	}
	return false
}

func containsUint16(values []uint16, wanted uint16) bool {
	for _, value := range values {
		if value == wanted {
			return true
		}
	}
	return false
}
