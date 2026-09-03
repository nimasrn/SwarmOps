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

	"github.com/nimasrn/SwarmOps/internal/domain"
	"gopkg.in/yaml.v3"
)

var (
	appNameSanitizer  = regexp.MustCompile(`[^a-z0-9-]+`)
	httpTargetPattern = regexp.MustCompile(`https?://[^/\s'\"]+(/[A-Za-z0-9._~/-]*)`)
	// These two mirror the application policy in internal/ops. Checking a
	// discovered hostname and path here means the plan proposes only values
	// the deployment boundary will actually accept, instead of carrying a
	// route the operator can select and then be refused for.
	applicationHostPattern = regexp.MustCompile(`^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$`)
	httpPathPattern        = regexp.MustCompile(`^/[A-Za-z0-9._~/-]{0,200}$`)
)

type scannedFile struct {
	evidence EvidenceFile
	content  []byte
}

type composeServiceEvidence struct {
	build          *BuildPlan
	classification Classification
	cpus           float64
	databases      []string
	dbRequirements map[string]DatabaseRequirement
	dependsOn      []string
	dockerfile     *DockerfilePlan
	environment    []string
	findings       []Finding
	healthPath     string
	image          string
	labels         []string
	memoryMiB      int64
	metrics        bool
	metricsPath    string
	metricsPort    uint16
	name           string
	port           uint16
	replicas       uint64
	route          *RoutePlan
	sharedStacks   []string
	tracing        bool
	tracingEnv     []string
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
	// Every Dockerfile is parsed once, up front. Its findings travel with
	// whichever service ends up building it, so an operator sees "this image
	// runs as root" beside the service it belongs to rather than as an
	// unattached repository note.
	evidence := repositoryEvidence{
		dockerfiles: make(map[string]DockerfilePlan, len(dockerfiles)),
		findings:    make(map[string][]Finding, len(dockerfiles)),
		tree:        make(map[string]bool, len(entries)),
	}
	for _, entry := range entries {
		evidence.tree[entry.Path] = true
	}
	for _, file := range dockerfiles {
		analyzed, findings := analyzeDockerfile(file.evidence.Path, file.content)
		evidence.dockerfiles[file.evidence.Path] = analyzed
		evidence.findings[file.evidence.Path] = findings
	}
	referencedDockerfiles := map[string]bool{}
	for _, file := range composeFiles {
		services, findings := scanCompose(file, repository, revision, evidence, options)
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
		build := &BuildPlan{ContextPath: contextPath, DockerfilePath: path.Base(file.evidence.Path), Image: generatedImage(options.ImagePrefix, repository.Path, serviceName, revision.SHA), Push: options.ImagePrefix != "", Required: true}
		findings := []Finding{{Code: "dockerfile_without_compose", Level: FindingWarning, Message: "Dockerfile was found without a Compose service; confirm its container port and health endpoint.", Subject: file.evidence.Path}}
		findings = append(findings, buildDestinationFinding(build, file.evidence.Path)...)
		findings = append(findings, evidence.findings[file.evidence.Path]...)
		findings = append(findings, evidence.dockerignoreFinding(contextPath)...)
		analyzed := evidence.dockerfiles[file.evidence.Path]
		service := ServicePlan{
			Build: build, Classification: ClassificationApplication, ComposePath: "", Dockerfile: &analyzed,
			Findings: findings, HealthPath: "/healthz", Image: build.Image, Name: serviceName, Service: serviceName,
		}
		// With no Compose beside it, the Dockerfile is the only evidence of
		// how this image is meant to be reached.
		if len(analyzed.ExposedPorts) > 0 {
			service.Port = preferredPort(analyzed.ExposedPorts)
		}
		if analyzed.HealthPath != "" {
			service.HealthPath = analyzed.HealthPath
		}
		service.Route = &RoutePlan{Source: "proposed", TargetPort: service.Port}
		plan.Services = append(plan.Services, service)
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

// repositoryEvidence is everything the scanner learned from the repository
// tree before it started reading Compose: which Dockerfiles exist and what
// each one says, and which paths exist at all.
type repositoryEvidence struct {
	dockerfiles map[string]DockerfilePlan
	findings    map[string][]Finding
	tree        map[string]bool
}

func (e repositoryEvidence) has(filename string) bool { return e.tree[filename] }

// dockerignoreFinding reports a build context with no .dockerignore. The
// provider archive carries the repository's history, so a context without one
// uploads it to the daemon on every build.
func (e repositoryEvidence) dockerignoreFinding(contextPath string) []Finding {
	if e.tree[dockerignorePath(contextPath)] {
		return nil
	}
	subject := contextPath
	if subject == "" {
		subject = "."
	}
	return []Finding{{Code: "dockerignore_missing", Level: FindingInfo, Message: "The build context has no .dockerignore, so every file under it is sent to the builder.", Subject: subject}}
}

func scanCompose(file scannedFile, repository Repository, revision Revision, evidence repositoryEvidence, options Options) ([]ServicePlan, []Finding) {
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
	inspected := make(map[string]composeServiceEvidence, len(names))
	for _, name := range names {
		raw, ok := stringMap(services[name])
		if !ok {
			inspected[name] = composeServiceEvidence{name: name, classification: ClassificationUnsupported, findings: []Finding{{Code: "service_shape", Level: FindingBlocker, Message: "Compose service must be an object.", Subject: file.evidence.Path + "#" + name}}}
			continue
		}
		inspected[name] = inspectComposeService(file.evidence.Path, name, raw, repository, revision, evidence, options)
	}
	globalStacks := map[string]bool{}
	dataServices := map[string]string{}
	platformServices := map[string][]string{}
	for name, item := range inspected {
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
	result := make([]ServicePlan, 0, len(inspected))
	for _, name := range names {
		item := inspected[name]
		if item.classification == ClassificationApplication {
			for _, dependency := range item.dependsOn {
				if engine := dataServices[dependency]; engine != "" {
					item.databases = append(item.databases, engine)
					// A depends_on edge proves the requirement even when the
					// application reads its URI from a variable the scanner
					// could not classify. Recording it with no variable names
					// keeps the delivery on the SwarmOps default.
					if _, known := item.dbRequirements[engine]; !known {
						item.dbRequirements[engine] = DatabaseRequirement{Engine: engine, Source: "depends_on"}
					}
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
			item.findings = append(item.findings, capabilityFindings(item, file.evidence.Path+"#"+name)...)
		}
		result = append(result, ServicePlan{
			Build: item.build, Classification: item.classification, ComposePath: file.evidence.Path,
			CPUs: item.cpus, Databases: item.databases, DatabaseRequirements: databaseRequirements(item),
			Dockerfile: item.dockerfile, Findings: item.findings, HealthPath: item.healthPath,
			Image: item.image, MemoryMiB: item.memoryMiB, Metrics: item.metrics,
			Name: normalizeApplicationName(name), Port: item.port, Replicas: item.replicas,
			Route: item.route, Service: name, SharedStacks: item.sharedStacks,
			Telemetry: TelemetryPlan{MetricsPath: item.metricsPath, MetricsPort: item.metricsPort, TracingEnvVars: item.tracingEnv},
			Tracing:   item.tracing,
		})
	}
	return result, nil
}

// databaseRequirements renders the per-engine mapping in a stable order, and
// only for engines that survived classification into the managed catalogue.
func databaseRequirements(item composeServiceEvidence) []DatabaseRequirement {
	if len(item.dbRequirements) == 0 {
		return nil
	}
	result := make([]DatabaseRequirement, 0, len(item.dbRequirements))
	for _, engine := range item.databases {
		if requirement, found := item.dbRequirements[engine]; found {
			result = append(result, requirement)
		}
	}
	sort.Slice(result, func(left, right int) bool { return result[left].Engine < result[right].Engine })
	return result
}

// capabilityFindings reports what SwarmOps concluded about the signals an
// application declared, so the decision is reviewable rather than silent.
func capabilityFindings(item composeServiceEvidence, subject string) []Finding {
	var findings []Finding
	if item.metrics && !contains(item.sharedStacks, "swarmops-observability") {
		findings = append(findings, Finding{Code: "metrics_stack_required", Level: FindingInfo, Message: "This application exposes metrics, so the reviewed SwarmOps observability stack will be installed to scrape it.", Subject: subject})
	}
	if item.tracing && !contains(item.sharedStacks, "swarmops-observability") {
		findings = append(findings, Finding{Code: "tracing_stack_required", Level: FindingInfo, Message: "This application exports traces, so the reviewed SwarmOps observability stack — Jaeger and its OTLP endpoint — will be installed to receive them.", Subject: subject})
	}
	if item.tracing && len(item.tracingEnv) > 0 {
		findings = append(findings, Finding{Code: "tracing_endpoint_replaced", Level: FindingInfo, Message: "The OpenTelemetry endpoint in this Compose file is replaced by the managed Jaeger OTLP collector.", Subject: subject})
	}
	for _, requirement := range item.dbRequirements {
		if len(requirement.EnvVars) == 0 {
			continue
		}
		findings = append(findings, Finding{Code: "database_env_mapped", Level: FindingInfo, Message: "The managed " + requirement.Engine + " connection is delivered as " + strings.Join(requirement.EnvVars, ", ") + ", matching what this application reads.", Subject: subject})
	}
	return findings
}

func inspectComposeService(composePath, name string, service map[string]any, repository Repository, revision Revision, evidence repositoryEvidence, options Options) composeServiceEvidence {
	subject := composePath + "#" + name
	image, _ := service["image"].(string)
	image = strings.TrimSpace(image)
	classification, databases, stacks := classifyService(name, image)
	environment := environmentPairs(service["environment"])
	labels := environmentPairs(service["labels"])
	result := composeServiceEvidence{
		classification: classification, databases: databases, dbRequirements: map[string]DatabaseRequirement{},
		image: image, name: name, sharedStacks: stacks, dependsOn: dependencyNames(service["depends_on"]),
		environment: mapKeys(environment), labels: mapKeys(labels),
	}
	scrape, promPort, promPath := prometheusFromLabels(labels)
	result.metrics = scrape || hasAnyFold(result.environment, "METRICS_PORT", "PROMETHEUS_URL", "PROMETHEUS_ENDPOINT")
	result.metricsPath = promPath
	result.metricsPort = promPort
	result.tracing = hasAnyPrefixFold(result.environment, "OTEL_", "JAEGER_")
	for _, key := range result.environment {
		if hasAnyPrefixFold([]string{key}, "OTEL_EXPORTER_OTLP_", "JAEGER_") {
			result.tracingEnv = append(result.tracingEnv, key)
		}
	}
	result.tracingEnv = sortedUnique(result.tracingEnv)
	if classification == ClassificationManagedData {
		result.findings = append(result.findings, Finding{Code: "managed_database", Level: FindingInfo, Message: "This source service will be replaced by the matching SwarmOps managed database.", Subject: subject})
		return result
	}
	if classification == ClassificationSharedPlatform {
		result.findings = append(result.findings, Finding{Code: "shared_platform", Level: FindingInfo, Message: "This source service will be replaced by the reviewed global SwarmOps stack.", Subject: subject})
		return result
	}
	if classification == ClassificationUnsupported {
		result.findings = append(result.findings, unsupportedFinding(name, image, subject))
		return result
	}

	// Every managed engine this application names in its own environment is a
	// requirement, whether or not the Compose file also runs that engine. An
	// application that points DATABASE_URL at an external Postgres still needs
	// a Postgres, and SwarmOps can supply the managed one.
	for engine, keys := range databaseEnvironment(environment) {
		result.databases = append(result.databases, engine)
		result.dbRequirements[engine] = DatabaseRequirement{Engine: engine, EnvVars: keys, Source: "environment"}
	}
	result.databases = sortedUnique(result.databases)

	composeDir := path.Dir(composePath)
	if composeDir == "." {
		composeDir = ""
	}
	buildIdentity := strings.TrimSuffix(composePath, path.Ext(composePath)) + "-" + name
	build, buildFindings := composeBuildPlan(service["build"], composeDir, buildIdentity, repository, revision, evidence, options)
	result.build = build
	result.findings = append(result.findings, buildFindings...)
	if build != nil {
		result.image = build.Image
	} else if image == "" {
		defaultDockerfile := path.Join(composeDir, "Dockerfile")
		if evidence.has(defaultDockerfile) {
			result.build = &BuildPlan{ContextPath: composeDir, DockerfilePath: "Dockerfile", Image: generatedImage(options.ImagePrefix, repository.Path, buildIdentity, revision.SHA), Push: options.ImagePrefix != "", Required: true}
			result.image = result.build.Image
			result.findings = append(result.findings, buildDestinationFinding(result.build, subject)...)
		} else {
			result.findings = append(result.findings, Finding{Code: "service_image", Level: FindingBlocker, Message: "Application service has neither an image nor a discoverable Dockerfile.", Subject: subject})
		}
	} else if !immutableImage(image) {
		result.findings = append(result.findings, Finding{Code: "mutable_image", Level: FindingBlocker, Message: "Application image is mutable and no Dockerfile build pins it to this commit.", Subject: subject})
	}
	// The Dockerfile's own findings belong to whichever service builds it, and
	// its EXPOSE and HEALTHCHECK are evidence the Compose file may not carry.
	if result.build != nil {
		physical := path.Join(result.build.ContextPath, result.build.DockerfilePath)
		if analyzed, found := evidence.dockerfiles[physical]; found {
			result.dockerfile = &analyzed
			result.findings = append(result.findings, evidence.findings[physical]...)
			result.findings = append(result.findings, evidence.dockerignoreFinding(result.build.ContextPath)...)
		}
	}

	ports := containerPorts(service)
	route, routeFindings := traefikRouteFromLabels(labels)
	result.findings = append(result.findings, routeFindings...)
	if route.port != 0 {
		ports = append([]uint16{route.port}, ports...)
	}
	if len(ports) == 0 && result.dockerfile != nil {
		ports = result.dockerfile.ExposedPorts
		if len(ports) > 0 {
			result.findings = append(result.findings, Finding{Code: "port_from_dockerfile", Level: FindingInfo, Message: "No Compose port was published; the Dockerfile's EXPOSE instruction supplied the container port.", Subject: subject})
		}
	}
	result.port, result.findings = choosePort(ports, route.port, subject, result.findings)
	result.route, result.findings = buildRoutePlan(route, result.port, subject, result.findings)
	if result.metrics && result.metricsPort == 0 {
		result.metricsPort = result.port
	}

	result.healthPath = healthPath(service["healthcheck"])
	if result.healthPath == "" && result.dockerfile != nil {
		result.healthPath = result.dockerfile.HealthPath
		if result.healthPath != "" {
			result.findings = append(result.findings, Finding{Code: "health_path_from_dockerfile", Level: FindingInfo, Message: "The HTTP health path was read from the Dockerfile's HEALTHCHECK instruction.", Subject: subject})
		}
	}
	if result.healthPath == "" {
		result.healthPath = "/healthz"
		result.findings = append(result.findings, Finding{Code: "health_path_assumed", Level: FindingWarning, Message: "No HTTP health path was detected; /healthz is proposed for review.", Subject: subject})
	}

	deploy, _ := service["deploy"].(map[string]any)
	result.replicas, result.cpus, result.memoryMiB = composeResources(deploy)
	if result.replicas > 0 || result.cpus > 0 || result.memoryMiB > 0 {
		result.findings = append(result.findings, Finding{Code: "resources_imported", Level: FindingInfo, Message: "Replica count and resource ceilings were read from the Compose deploy block; review them before releasing.", Subject: subject})
	}

	result.findings = append(result.findings, unimportedFindings(service, result.environment, subject)...)
	return result
}

// unimportedFindings names each part of a Compose service that SwarmOps
// deliberately does not carry across. Every one of these is something an
// operator would otherwise discover as a failed or wrong deployment.
func unimportedFindings(service map[string]any, environment []string, subject string) []Finding {
	var findings []Finding
	if len(environment) > 0 {
		// Naming the keys is the difference between a warning an operator can
		// act on and one they have to go and read the Compose file to act on:
		// these are exactly the settings that must be re-supplied, and a
		// deployment missing one fails at runtime rather than at review.
		findings = append(findings, Finding{
			Code:    "environment_review",
			Level:   FindingWarning,
			Message: "Source environment values are not imported. " + namedKeys(environment) + " must be re-supplied as reviewed SwarmOps settings, a Swarm secret, or a managed database attachment.",
			Subject: subject,
		})
	}
	if hasListEntries(service["env_file"]) {
		findings = append(findings, Finding{Code: "env_file_ignored", Level: FindingWarning, Message: "An env_file is not read; the values it holds must be supplied as reviewed SwarmOps settings or a managed database.", Subject: subject})
	}
	if hasListEntries(service["volumes"]) {
		findings = append(findings, Finding{Code: "volumes_ignored", Level: FindingBlocker, Message: "This service mounts volumes. A generated application is stateless; move its data to a managed database, or deploy it as a reviewed Git stack instead.", Subject: subject})
	}
	if hasListEntries(service["secrets"]) || hasListEntries(service["configs"]) {
		findings = append(findings, Finding{Code: "secrets_ignored", Level: FindingWarning, Message: "Compose secrets and configs are not imported; attach a managed database or use a reviewed Git stack.", Subject: subject})
	}
	if hasListEntries(service["command"]) || hasListEntries(service["entrypoint"]) {
		findings = append(findings, Finding{Code: "command_ignored", Level: FindingWarning, Message: "A Compose command or entrypoint override is not imported; the image must start correctly on its own.", Subject: subject})
	}
	if deploy, ok := service["deploy"].(map[string]any); ok {
		if placement, ok := deploy["placement"].(map[string]any); ok && hasListEntries(placement["constraints"]) {
			findings = append(findings, Finding{Code: "placement_ignored", Level: FindingWarning, Message: "Placement constraints are not imported; SwarmOps schedules generated applications through the reviewed platform manifest.", Subject: subject})
		}
	}
	if privileged, _ := service["privileged"].(bool); privileged {
		findings = append(findings, Finding{Code: "privileged_ignored", Level: FindingWarning, Message: "Privileged mode is not imported into the generated application.", Subject: subject})
	}
	if networkMode, _ := service["network_mode"].(string); strings.TrimSpace(networkMode) != "" {
		findings = append(findings, Finding{Code: "network_mode_ignored", Level: FindingWarning, Message: "Source network_mode is not imported; SwarmOps uses reviewed shared overlays.", Subject: subject})
	}
	return findings
}

// buildRoutePlan turns discovered Traefik labels into the route SwarmOps will
// create. A repository that already declares a hostname gets that hostname
// proposed; one that declares none gets an internal-only route, which is a
// decision worth stating rather than a silent default.
func buildRoutePlan(discovered composeRoute, port uint16, subject string, findings []Finding) (*RoutePlan, []Finding) {
	plan := &RoutePlan{Source: "proposed", TargetPort: port}
	if discovered.port != 0 {
		plan.TargetPort = discovered.port
	}
	switch {
	case discovered.disabled:
		findings = append(findings, Finding{Code: "route_disabled_in_source", Level: FindingInfo, Message: "This service sets traefik.enable=false, so SwarmOps proposes an internal-only route with no public hostname.", Subject: subject})
	case discovered.found:
		plan.Hosts = discovered.hosts
		plan.PathPrefix = discovered.pathPrefix
		plan.Resolver = discovered.resolver
		plan.Source = "traefik_labels"
		plan.TLS = discovered.tls
		findings = append(findings, Finding{Code: "route_discovered", Level: FindingInfo, Message: "A Traefik router was found in this Compose file; SwarmOps proposes the same hostname and will create the route if the cluster does not already have it.", Subject: subject})
		if plan.Resolver == "" && plan.TLS {
			findings = append(findings, Finding{Code: "route_resolver_required", Level: FindingWarning, Message: "The discovered router asks for TLS but names no certificate resolver; choose one from the reviewed slot before releasing.", Subject: subject})
		}
	default:
		findings = append(findings, Finding{Code: "route_not_declared", Level: FindingInfo, Message: "No Traefik router was found; SwarmOps proposes an internal-only route. Assign a domain on the review step to publish it.", Subject: subject})
	}
	return plan, findings
}

// unsupportedFinding distinguishes a stateful engine SwarmOps has no managed
// equivalent for from a platform component it simply does not replace. They
// were one message, which told an operator that Grafana was an unsupported
// database.
func unsupportedFinding(name, image, subject string) Finding {
	if containsWord(strings.ToLower(name+" "+image), "grafana") {
		return Finding{Code: "unsupported_platform", Level: FindingBlocker, Message: "SwarmOps runs its own reviewed Grafana-free observability stack; remove this service from the selection and read metrics through the Observability page.", Subject: subject}
	}
	return Finding{Code: "unsupported_database", Level: FindingBlocker, Message: "This stateful service has no managed SwarmOps equivalent.", Subject: subject}
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
	case containsWord(value, "prometheus"), containsWord(value, "jaeger"), containsWord(value, "alertmanager"),
		containsWord(value, "otel"), containsWord(value, "opentelemetry"), containsWord(value, "otelcol"),
		containsWord(value, "tempo"), containsWord(value, "zipkin"):
		return ClassificationSharedPlatform, nil, []string{"swarmops-observability"}
	case containsWord(value, "node-exporter"), containsWord(value, "cadvisor"):
		return ClassificationSharedPlatform, nil, []string{"swarmops-agent"}
	default:
		return ClassificationApplication, nil, nil
	}
}

func composeBuildPlan(raw any, composeDir, serviceName string, repository Repository, revision Revision, evidence repositoryEvidence, options Options) (*BuildPlan, []Finding) {
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
	if !evidence.has(physical) {
		findings = append(findings, Finding{Code: "dockerfile_missing", Level: FindingBlocker, Message: "The Dockerfile named by Compose was not found in the immutable repository tree.", Subject: physical})
	}
	build := &BuildPlan{ContextPath: contextPath, DockerfilePath: dockerfilePath, Image: generatedImage(options.ImagePrefix, repository.Path, serviceName, revision.SHA), Push: options.ImagePrefix != "", Required: true}
	findings = append(findings, buildDestinationFinding(build, physical)...)
	return build, findings
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

// choosePort prefers the port the repository's own Traefik label names, since
// that is the port its author already decided traffic goes to. Otherwise it
// falls back to the conventional application ports before guessing.
func choosePort(ports []uint16, labelled uint16, subject string, findings []Finding) (uint16, []Finding) {
	unique := sortedUniqueUint16(ports)
	if len(unique) == 0 {
		return 0, append(findings, Finding{Code: "port_needs_review", Level: FindingWarning, Message: "No container port was detected; choose the application port before deployment.", Subject: subject})
	}
	if labelled != 0 && containsUint16(unique, labelled) {
		if len(unique) > 1 {
			findings = append(findings, Finding{Code: "port_from_route_label", Level: FindingInfo, Message: fmt.Sprintf("Several container ports were found; %d was taken from this service's own Traefik load-balancer label.", labelled), Subject: subject})
		}
		return labelled, findings
	}
	if len(unique) == 1 {
		return unique[0], findings
	}
	preferred := preferredPort(unique)
	return preferred, append(findings, Finding{Code: "multiple_ports", Level: FindingWarning, Message: fmt.Sprintf("Multiple container ports were found; %d is proposed for review.", preferred), Subject: subject})
}

// preferredPort picks the conventional HTTP application port when a service
// offers several, and otherwise the lowest.
func preferredPort(ports []uint16) uint16 {
	unique := sortedUniqueUint16(ports)
	if len(unique) == 0 {
		return 0
	}
	for _, candidate := range []uint16{8080, 8000, 3000, 80, 5000} {
		if containsUint16(unique, candidate) {
			return candidate
		}
	}
	return unique[0]
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

// buildDestinationFinding says where the image this build produces will end
// up. A build without a registry is not an error — it is the ordinary case for
// an operator running one machine — but it is a fact about reach that the plan
// must state before it is applied, because the resulting image exists only on
// the host that built it.
func buildDestinationFinding(build *BuildPlan, subject string) []Finding {
	if build == nil {
		return nil
	}
	if build.Image == "" {
		return []Finding{{Code: "build_revision_unavailable", Level: FindingBlocker, Message: "This build has no immutable revision to tag its image with.", Subject: subject}}
	}
	if build.Push {
		return nil
	}
	return []Finding{{Code: "build_local_image", Level: FindingWarning, Message: "No push registry is configured, so this image is built on the deployment host and stays there; the application is pinned to that host. Configure a registry to run it on any node.", Subject: subject}}
}

func generatedImage(prefix, repositoryPath, service, revision string) string {
	if !validSHA(revision) {
		return ""
	}
	if prefix == "" {
		prefix = domain.LocalImagePrefix
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

// namedKeys lists what a finding is about without letting one service's
// environment become a paragraph.
func namedKeys(keys []string) string {
	keys = sortedUnique(keys)
	const shown = 6
	if len(keys) <= shown {
		return strings.Join(keys, ", ")
	}
	return strings.Join(keys[:shown], ", ") + " and " + strconv.Itoa(len(keys)-shown) + " more"
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
