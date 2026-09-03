package ops

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"sort"
	"strings"
	"time"

	"github.com/nimasrn/SwarmOps/internal/agent"
	"github.com/nimasrn/SwarmOps/internal/audit"
	"github.com/nimasrn/SwarmOps/internal/dockerapi"
	"github.com/nimasrn/SwarmOps/internal/domain"
)

type ControlPlane struct {
	Agent                    AgentReader
	AgentService             string
	AgentStackFile           string
	Admission                *PlatformAdmission
	Apps                     *ApplicationStore
	Audit                    *audit.Store
	// Platform is the sealed, console-owned platform definition. It is
	// consulted before the startup Admission so a panel change reaches the
	// next deployment without restarting the controller.
	Platform *PlatformStore
	CLI                      DockerCLI
	CoreService              string
	Credentials              *CredentialStore
	DatabaseSettings         DatabaseSettings
	DNSProviders             DNSProviderService
	DNSVerifier              DNSPropagationVerifier
	Docker                   *dockerapi.Client
	LogsStackFile            string
	Mutations                bool
	ObservabilityStackFile   string
	Routing                  *RoutingStore
	ServerID                 string
	StackDeployer            StackDeployer
	TraefikStackFile         string
	TraefikDynamicConfigFile string
	TraefikSettings          TraefikStackSettings
	TrustedStackSettings     TrustedStackSettings
	TLSInspector             TLSCertificateInspector
	now                      func() time.Time
}

type ControlPlaneOptions struct {
	Agent                    AgentReader
	AgentService             string
	AgentStackFile           string
	Admission                *PlatformAdmission
	Apps                     *ApplicationStore
	CoreService              string
	Platform                 *PlatformStore
	Credentials              *CredentialStore
	DatabaseSettings         DatabaseSettings
	DataDir                  string
	DNSProviders             DNSProviderService
	DNSVerifier              DNSPropagationVerifier
	LogsStackFile            string
	Mutations                bool
	ObservabilityStackFile   string
	Routing                  *RoutingStore
	ServerID                 string
	TraefikSettings          TraefikStackSettings
	TraefikStackFile         string
	TraefikDynamicConfigFile string
	TrustedStackSettings     TrustedStackSettings
	TLSInspector             TLSCertificateInspector
}

func NewControlPlane(docker *dockerapi.Client, cli DockerCLI, auditStore *audit.Store, options ControlPlaneOptions) *ControlPlane {
	dnsProviders := options.DNSProviders
	if dnsProviders == nil {
		dnsProviders = NewHTTPDNSProviderService(nil)
	}
	dnsVerifier := options.DNSVerifier
	if dnsVerifier == nil {
		dnsVerifier = NetDNSPropagationVerifier{}
	}
	tlsInspector := options.TLSInspector
	if tlsInspector == nil {
		tlsInspector = NetTLSCertificateInspector{}
	}
	return &ControlPlane{
		Agent:                    options.Agent,
		AgentService:             options.AgentService,
		AgentStackFile:           options.AgentStackFile,
		Admission:                options.Admission,
		Apps:                     options.Apps,
		Platform:                 options.Platform,
		Audit:                    auditStore,
		CLI:                      cli,
		CoreService:              options.CoreService,
		Credentials:              options.Credentials,
		DatabaseSettings:         options.DatabaseSettings,
		DNSProviders:             dnsProviders,
		DNSVerifier:              dnsVerifier,
		Docker:                   docker,
		LogsStackFile:            options.LogsStackFile,
		Mutations:                options.Mutations,
		ObservabilityStackFile:   options.ObservabilityStackFile,
		Routing:                  options.Routing,
		ServerID:                 options.ServerID,
		StackDeployer:            StackDeployer{CLI: cli, DataDir: options.DataDir, Enabled: options.Mutations},
		TraefikSettings:          options.TraefikSettings,
		TraefikStackFile:         options.TraefikStackFile,
		TraefikDynamicConfigFile: options.TraefikDynamicConfigFile,
		TrustedStackSettings:     options.TrustedStackSettings,
		TLSInspector:             tlsInspector,
		now:                      time.Now,
	}
}

// ValidateTraefikReconcile checks controller-owned, non-secret installation
// prerequisites without contacting Docker or mutating routing state.
func (c *ControlPlane) ValidateTraefikReconcile(confirmation string) error {
	if !c.Mutations {
		return fmt.Errorf("cluster mutations are disabled")
	}
	if err := c.requireAudit(); err != nil {
		return err
	}
	if confirmation != "DEPLOY_TRAEFIK" {
		return fmt.Errorf("deployment requires confirmation DEPLOY_TRAEFIK")
	}
	if strings.TrimSpace(c.TraefikStackFile) == "" {
		return fmt.Errorf("Traefik stack file is not configured")
	}
	if c.Routing != nil && validClusterID(c.ServerID) {
		state, err := c.Routing.Snapshot(c.ServerID)
		if err != nil {
			return err
		}
		if err := state.Settings.Validate(); err != nil {
			return err
		}
		settings := c.TraefikSettings
		settings.ACMEEmail = state.Settings.ACMEEmail
		settings.Control = state.Settings
		return validatePlannedTraefikStackSettings(settings)
	}
	return validatePlannedTraefikStackSettings(c.TraefikSettings)
}

// ValidateTraefikInstall validates the browser-supplied, non-secret dashboard
// hostname against a copy of the selected cluster's reviewed settings. The
// durable command persists it only when the worker begins the installation.
func (c *ControlPlane) ValidateTraefikInstall(confirmation, dashboardHost string) error {
	if !c.Mutations {
		return fmt.Errorf("cluster mutations are disabled")
	}
	if err := c.requireAudit(); err != nil {
		return err
	}
	if confirmation != "DEPLOY_TRAEFIK" {
		return fmt.Errorf("Traefik deployment requires confirmation DEPLOY_TRAEFIK")
	}
	if strings.TrimSpace(c.TraefikStackFile) == "" {
		return fmt.Errorf("Traefik stack file is not configured")
	}
	if c.Routing == nil || !validClusterID(c.ServerID) {
		return fmt.Errorf("sealed Traefik settings are not configured for the selected server")
	}
	state, err := c.Routing.Snapshot(c.ServerID)
	if err != nil {
		return err
	}
	state.Settings.DashboardHost = dashboardHost
	state.Settings = state.Settings.Normalize()
	if state.Settings.DashboardHost == "" {
		return fmt.Errorf("Traefik dashboard hostname is not configured")
	}
	if !safeHostname(state.Settings.DashboardHost) {
		return fmt.Errorf("Traefik dashboard hostname is invalid")
	}
	if err := state.Settings.ValidateForApply(); err != nil {
		return err
	}
	settings := c.TraefikSettings
	settings.ACMEEmail = state.Settings.ACMEEmail
	settings.Control = state.Settings
	return validatePlannedTraefikStackSettings(settings)
}

func validatePlannedTraefikStackSettings(settings TraefikStackSettings) error {
	if settings.Control.Version == 0 {
		return settings.Validate()
	}
	static, err := RenderTraefikStaticConfig(settings.Control)
	if err != nil {
		return err
	}
	settings.StaticConfigName = TraefikStaticConfigName(static)
	return settings.Validate()
}

// InstallTraefik makes the panel-owned dashboard hostname part of the sealed
// selected-cluster settings before reconciling the reviewed singleton stack.
// Retrying the same durable command is idempotent.
func (c *ControlPlane) InstallTraefik(ctx context.Context, actor, requestID, dashboardHost, confirmation string) error {
	if err := c.ValidateTraefikInstall(confirmation, dashboardHost); err != nil {
		return err
	}
	state, err := c.Routing.Snapshot(c.ServerID)
	if err != nil {
		return err
	}
	state.Settings.DashboardHost = dashboardHost
	if err := c.Routing.PutSettings(c.ServerID, state.Settings); err != nil {
		return fmt.Errorf("save Traefik dashboard hostname: %w", err)
	}
	return c.ReconcileTraefik(ctx, actor, requestID, confirmation)
}

func (c *ControlPlane) TraefikDashboardURL() (string, error) {
	if c.Routing == nil || !validClusterID(c.ServerID) {
		return "", nil
	}
	state, err := c.Routing.Snapshot(c.ServerID)
	if err != nil {
		return "", err
	}
	host := state.Settings.Normalize().DashboardHost
	if host == "" {
		return "", nil
	}
	if !safeHostname(host) {
		return "", fmt.Errorf("stored Traefik dashboard hostname is invalid")
	}
	return "https://" + host + "/dashboard/", nil
}

// ReconcileTraefik deploys only the checked-in Traefik stack asset. It does
// not accept routing, DNS, certificate, or secret values from the browser.
func (c *ControlPlane) ReconcileTraefik(ctx context.Context, actor, requestID, confirmation string) error {
	if err := c.ValidateTraefikReconcile(confirmation); err != nil {
		return err
	}
	if c.Docker != nil {
		preflight, err := c.TraefikInstallPreflight(ctx)
		if err != nil {
			return err
		}
		if !preflight.Ready {
			for _, check := range preflight.Checks {
				if check.Required && check.State == "blocked" {
					return fmt.Errorf("Traefik prerequisite %s is incomplete: %s", check.Label, check.Detail)
				}
			}
		}
	}
	raw, err := os.ReadFile(c.TraefikStackFile)
	if err == nil {
		settings := c.TraefikSettings
		settings, err = c.prepareTypedTraefikSettings(ctx)
		if err == nil {
			raw, err = RenderTraefikStack(raw, settings)
		}
	}
	if err == nil {
		err = c.deployTrustedContent(ctx, raw, "traefik")
	}
	c.record(actor, requestID, "traefik.reconcile", "stack/traefik", err, nil)
	return err
}

func (c *ControlPlane) Ready(ctx context.Context) error {
	return c.Docker.Ping(ctx)
}

func (c *ControlPlane) Overview(ctx context.Context) (domain.Overview, error) {
	nodes, err := c.Nodes(ctx)
	if err != nil {
		return domain.Overview{}, err
	}
	services, err := c.Services(ctx)
	if err != nil {
		return domain.Overview{}, err
	}
	summary := summarize(nodes, services)
	return domain.Overview{GeneratedAt: c.now().UTC(), Health: overallHealth(nodes, services, agentInstalled(nodes)), Nodes: nodes, Services: services, Summary: summary}, nil
}

func (c *ControlPlane) Nodes(ctx context.Context) ([]domain.Node, error) {
	rawNodes, err := c.Docker.ListNodes(ctx)
	if err != nil {
		return nil, err
	}
	agents := c.agentAddresses(ctx)
	nodes := make([]domain.Node, 0, len(rawNodes))
	for _, raw := range rawNodes {
		node := fromDockerNode(raw)
		if address, found := agents[raw.ID]; found && c.Agent != nil {
			node.Agent.Address = address
			snapshot, err := c.Agent.Snapshot(ctx, address)
			if err != nil {
				node.Agent.Error = "agent snapshot unavailable"
			} else {
				applySnapshot(&node, snapshot)
			}
		}
		nodes = append(nodes, node)
	}
	sort.Slice(nodes, func(left, right int) bool { return nodes[left].Hostname < nodes[right].Hostname })
	return nodes, nil
}

func (c *ControlPlane) Node(ctx context.Context, id string) (domain.Node, error) {
	nodes, err := c.Nodes(ctx)
	if err != nil {
		return domain.Node{}, err
	}
	for _, node := range nodes {
		if node.ID == id {
			return node, nil
		}
	}
	return domain.Node{}, fmt.Errorf("node not found")
}

func (c *ControlPlane) Services(ctx context.Context) ([]domain.Service, error) {
	rawNodes, err := c.Docker.ListNodes(ctx)
	if err != nil {
		return nil, err
	}
	rawServices, err := c.Docker.ListServices(ctx)
	if err != nil {
		return nil, err
	}
	rawTasks, err := c.Docker.ListTasks(ctx, nil)
	if err != nil {
		return nil, err
	}
	byService := map[string][]dockerapi.Task{}
	for _, task := range rawTasks {
		byService[task.ServiceID] = append(byService[task.ServiceID], task)
	}
	services := make([]domain.Service, 0, len(rawServices))
	for _, raw := range rawServices {
		service := fromDockerService(raw, byService[raw.ID], len(rawNodes))
		services = append(services, service)
	}
	sort.Slice(services, func(left, right int) bool { return services[left].Name < services[right].Name })
	return services, nil
}

func (c *ControlPlane) Stacks(ctx context.Context) ([]domain.Stack, error) {
	services, err := c.Services(ctx)
	if err != nil {
		return nil, err
	}
	stacks := map[string]domain.Stack{}
	for _, service := range services {
		if service.Stack == "" {
			continue
		}
		stack := stacks[service.Stack]
		stack.Name = service.Stack
		stack.ServiceCount++
		stack.RunningTasks += service.RunningTasks
		if service.UpdatedAt.After(stack.UpdatedAt) {
			stack.UpdatedAt = service.UpdatedAt
		}
		stack.Health = combineHealth(stack.Health, service.Health)
		stacks[stack.Name] = stack
	}
	result := make([]domain.Stack, 0, len(stacks))
	for _, stack := range stacks {
		result = append(result, stack)
	}
	sort.Slice(result, func(left, right int) bool { return result[left].Name < result[right].Name })
	return result, nil
}

func (c *ControlPlane) TasksForNode(ctx context.Context, nodeID string) ([]domain.Task, error) {
	tasks, err := c.Docker.ListTasks(ctx, map[string][]string{"node": {nodeID}})
	if err != nil {
		return nil, err
	}
	result := make([]domain.Task, 0, len(tasks))
	for _, task := range tasks {
		result = append(result, fromDockerTask(task))
	}
	return result, nil
}

// TasksForService returns the tasks Swarm has scheduled for one service.
//
// The diagnosis engine needs these to tell placement apart from a workload
// that starts and dies — the two look identical from the service's task
// counts alone, and they have opposite fixes.
func (c *ControlPlane) TasksForService(ctx context.Context, serviceID string) ([]domain.Task, error) {
	tasks, err := c.Docker.ListTasks(ctx, map[string][]string{"service": {serviceID}})
	if err != nil {
		return nil, err
	}
	result := make([]domain.Task, 0, len(tasks))
	for _, task := range tasks {
		result = append(result, fromDockerTask(task))
	}
	return result, nil
}

func (c *ControlPlane) ValidateStack(name string, raw []byte, targetNodeID string) (domain.ComposePlan, error) {
	effective, err := PinComposeToNode(raw, targetNodeID)
	if err != nil {
		return domain.ComposePlan{}, err
	}
	if c.admission() == nil {
		return domain.ComposePlan{}, fmt.Errorf("browser stack deployment requires a reviewed platform manifest")
	}
	if err := c.admission().ValidateStack(name, effective); err != nil {
		return domain.ComposePlan{}, err
	}
	plan, err := c.StackDeployer.Validate(effective)
	if err == nil {
		plan.TargetNodeID = targetNodeID
	}
	return plan, err
}

func (c *ControlPlane) DeployStack(ctx context.Context, actor, requestID, name string, raw []byte, targetNodeID string) (domain.ComposePlan, error) {
	if !c.Mutations {
		return domain.ComposePlan{}, fmt.Errorf("cluster mutations are disabled")
	}
	if err := c.requireAudit(); err != nil {
		return domain.ComposePlan{}, err
	}
	effective, err := PinComposeToNode(raw, targetNodeID)
	if err == nil {
		if c.admission() == nil {
			err = fmt.Errorf("browser stack deployment requires a reviewed platform manifest")
		} else {
			err = c.admission().ValidateStack(name, effective)
		}
	}
	if err == nil {
		var nodes []domain.Node
		nodes, err = c.Nodes(ctx)
		if err == nil {
			report := c.admission().CheckLive(nodes)
			if !report.Valid() {
				err = fmt.Errorf("fresh platform admission failed: %s", summarizeFindings(report))
			}
		}
	}
	if err == nil {
		var plan domain.ComposePlan
		plan, err = c.StackDeployer.Deploy(ctx, name, effective)
		plan.TargetNodeID = targetNodeID
		c.record(actor, requestID, "stack.deploy", "stack/"+name, err, map[string]string{"digest": plan.Digest, "target_node_id": targetNodeID})
		return plan, err
	}
	plan := domain.ComposePlan{}
	c.record(actor, requestID, "stack.deploy", "stack/"+name, err, map[string]string{"target_node_id": targetNodeID})
	return plan, err
}

func (c *ControlPlane) SetNodeAvailability(ctx context.Context, actor, requestID, nodeID, availability string) error {
	if !c.Mutations {
		return fmt.Errorf("cluster mutations are disabled")
	}
	if err := c.requireAudit(); err != nil {
		return err
	}
	if !allowed(availability, "active", "pause", "drain") {
		return fmt.Errorf("invalid node availability")
	}
	if _, err := serviceReference(nodeID); err != nil {
		return err
	}
	_, err := c.CLI.Run(ctx, "node", "update", "--availability", availability, nodeID)
	c.record(actor, requestID, "node.availability", "node/"+nodeID, err, map[string]string{"availability": availability})
	return err
}

func (c *ControlPlane) ServiceAction(ctx context.Context, actor, requestID, serviceID, action string, replicas *uint64) error {
	if !c.Mutations {
		return fmt.Errorf("cluster mutations are disabled")
	}
	if err := c.requireAudit(); err != nil {
		return err
	}
	if _, err := serviceReference(serviceID); err != nil {
		return err
	}
	var args []string
	switch action {
	case "restart":
		args = []string{"service", "update", "--force", serviceID}
	case "rollback":
		args = []string{"service", "rollback", serviceID}
	case "scale":
		if replicas == nil || *replicas > 1000 {
			return fmt.Errorf("scale requires a replica count between 0 and 1000")
		}
		args = []string{"service", "scale", fmt.Sprintf("%s=%d", serviceID, *replicas)}
	default:
		return fmt.Errorf("unsupported service action")
	}
	_, err := c.CLI.Run(ctx, args...)
	detail := map[string]string{"action": action}
	if replicas != nil {
		detail["replicas"] = fmt.Sprint(*replicas)
	}
	c.record(actor, requestID, "service."+action, "service/"+serviceID, err, detail)
	return err
}

func (c *ControlPlane) LogsCollection(ctx context.Context, actor, requestID string, enabled bool, confirmation string) error {
	if !c.Mutations {
		return fmt.Errorf("cluster mutations are disabled")
	}
	if err := c.requireAudit(); err != nil {
		return err
	}
	var err error
	if enabled {
		if strings.TrimSpace(c.LogsStackFile) == "" {
			return fmt.Errorf("logs stack file is not configured")
		}
		routes, routeErr := trustedStackRouteTemplates("swarmops-logs")
		if routeErr == nil {
			routeErr = c.prepareManagedRouteNetworks(ctx, routes)
		}
		if routeErr == nil {
			routeErr = c.deployTrustedStack(ctx, c.LogsStackFile, "swarmops-logs")
		}
		if routeErr == nil {
			routeErr = c.activateManagedRoutes(ctx, routes, nil)
		}
		if routeErr == nil {
			routeErr = c.ApplyDependencyBinding(ctx, actor, requestID, DependencyBinding{CallerService: "swarmops-logs_forwarder", Delivery: DependencyExisting, TargetRoute: "swarmops-fluentd-forward", Version: RoutingSchemaVersion})
		}
		if routeErr == nil && serviceExists(ctx, c.Docker, "swarmops-agent_agent") {
			routeErr = c.ApplyDependencyBinding(ctx, actor, requestID, DependencyBinding{CallerService: "swarmops-agent_agent", Delivery: DependencyExisting, TargetRoute: "swarmops-fluentd-query", Version: RoutingSchemaVersion})
		}
		err = routeErr
	} else {
		if confirmation != "DISABLE_LOG_COLLECTION" {
			return fmt.Errorf("disable requires confirmation DISABLE_LOG_COLLECTION")
		}
		_, err = c.CLI.Run(ctx, "stack", "rm", "swarmops-logs")
	}
	c.record(actor, requestID, "observability.logs", "stack/swarmops-logs", err, map[string]string{"enabled": fmt.Sprint(enabled)})
	return err
}

// NodeAgentCollection installs or removes the separate high-trust, read-only
// host-inventory agent. It is a global service and therefore needs a typed
// confirmation in either direction.
func (c *ControlPlane) NodeAgentCollection(ctx context.Context, actor, requestID string, enabled bool, confirmation string) error {
	if !c.Mutations {
		return fmt.Errorf("cluster mutations are disabled")
	}
	if err := c.requireAudit(); err != nil {
		return err
	}
	var err error
	if enabled {
		if confirmation != "INSTALL_NODE_AGENT" {
			return fmt.Errorf("installation requires confirmation INSTALL_NODE_AGENT")
		}
		if strings.TrimSpace(c.AgentStackFile) == "" {
			return fmt.Errorf("node agent stack file is not configured")
		}
		err = c.deployTrustedStack(ctx, c.AgentStackFile, "swarmops-agent")
		if err == nil && c.Routing != nil && serviceExists(ctx, c.Docker, "swarmops-logs_query") {
			err = c.ApplyDependencyBinding(ctx, actor, requestID, DependencyBinding{CallerService: "swarmops-agent_agent", Delivery: DependencyExisting, TargetRoute: "swarmops-fluentd-query", Version: RoutingSchemaVersion})
		}
		if err == nil && c.Routing != nil && serviceExists(ctx, c.Docker, "swarmops-observability_prometheus") {
			err = c.ApplyDependencyBinding(ctx, actor, requestID, DependencyBinding{CallerService: "swarmops-agent_agent", Delivery: DependencyExisting, TargetRoute: "swarmops-prometheus", Version: RoutingSchemaVersion})
		}
	} else {
		if confirmation != "REMOVE_NODE_AGENT" {
			return fmt.Errorf("removal requires confirmation REMOVE_NODE_AGENT")
		}
		_, err = c.CLI.Run(ctx, "stack", "rm", "swarmops-agent")
	}
	c.record(actor, requestID, "observability.node-agent", "stack/swarmops-agent", err, map[string]string{"enabled": fmt.Sprint(enabled)})
	return err
}

// CoreObservability deploys the internal Prometheus, Alertmanager, and Jaeger
// stack. Removing it is separately confirmed because it removes the cluster's
// primary monitoring surface.
func (c *ControlPlane) CoreObservability(ctx context.Context, actor, requestID string, enabled bool, confirmation string) error {
	if !c.Mutations {
		return fmt.Errorf("cluster mutations are disabled")
	}
	if err := c.requireAudit(); err != nil {
		return err
	}
	var err error
	if enabled {
		if strings.TrimSpace(c.ObservabilityStackFile) == "" {
			return fmt.Errorf("observability stack file is not configured")
		}
		routes, routeErr := trustedStackRouteTemplates("swarmops-observability")
		if routeErr == nil {
			routeErr = c.prepareManagedRouteNetworks(ctx, routes)
		}
		if routeErr == nil {
			routeErr = c.deployTrustedStack(ctx, c.ObservabilityStackFile, "swarmops-observability")
		}
		if routeErr == nil {
			routeErr = c.activateManagedRoutes(ctx, routes, nil)
		}
		if routeErr == nil {
			routeErr = c.ApplyDependencyBinding(ctx, actor, requestID, DependencyBinding{CallerService: "swarmops-observability_prometheus", Delivery: DependencyExisting, TargetRoute: "swarmops-alertmanager", Version: RoutingSchemaVersion})
		}
		if routeErr == nil {
			routeErr = c.ApplyDependencyBinding(ctx, actor, requestID, DependencyBinding{CallerService: "swarmops-observability_prometheus", Delivery: DependencyExisting, TargetRoute: platformSwarmOpsMetricsRoute, Version: RoutingSchemaVersion})
		}
		if routeErr == nil {
			routeErr = c.ApplyDependencyBinding(ctx, actor, requestID, DependencyBinding{CallerService: "swarmops-observability_prometheus", Delivery: DependencyExisting, TargetRoute: platformTraefikMetricsRoute, Version: RoutingSchemaVersion})
		}
		if routeErr == nil && serviceExists(ctx, c.Docker, "swarmops-agent_agent") {
			routeErr = c.ApplyDependencyBinding(ctx, actor, requestID, DependencyBinding{CallerService: "swarmops-agent_agent", Delivery: DependencyExisting, TargetRoute: "swarmops-prometheus", Version: RoutingSchemaVersion})
		}
		if routeErr == nil && c.Apps != nil && c.admission() != nil {
			for _, application := range c.Apps.List() {
				if !application.Metrics {
					continue
				}
				targetRoute := defaultRouteKey(application.ServiceDNSName(c.admission().Namespace()))
				if routeErr = c.ApplyDependencyBinding(ctx, actor, requestID, DependencyBinding{CallerService: "swarmops-observability_prometheus", Delivery: DependencyExisting, TargetRoute: targetRoute, Version: RoutingSchemaVersion}); routeErr != nil {
					break
				}
			}
		}
		err = routeErr
	} else {
		if confirmation != "REMOVE_OBSERVABILITY_CORE" {
			return fmt.Errorf("removal requires confirmation REMOVE_OBSERVABILITY_CORE")
		}
		_, err = c.CLI.Run(ctx, "stack", "rm", "swarmops-observability")
	}
	c.record(actor, requestID, "observability.core", "stack/swarmops-observability", err, map[string]string{"enabled": fmt.Sprint(enabled)})
	return err
}

func (c *ControlPlane) AuditEvents(limit int) ([]domain.AuditEvent, error) {
	return c.Audit.Recent(limit)
}

// deployTrustedStack reads only a configured, server-owned asset and feeds it
// to Docker through stdin. This keeps the same trusted-stack boundary while
// allowing the Docker CLI to run through the remote machine API without
// copying a Compose file onto that server's filesystem.
func (c *ControlPlane) deployTrustedStack(ctx context.Context, file, name string) error {
	raw, err := os.ReadFile(file)
	if err != nil {
		return fmt.Errorf("read trusted stack asset: %w", err)
	}
	raw, err = RenderTrustedStack(name, raw, c.TrustedStackSettings)
	if err != nil {
		return fmt.Errorf("render trusted stack asset: %w", err)
	}
	return c.deployTrustedContent(ctx, raw, name)
}

func (c *ControlPlane) deployTrustedContent(ctx context.Context, raw []byte, name string) error {
	args := []string{"stack", "deploy", "--detach=false"}
	if c.CLI.ConfigDir != "" {
		args = append(args, "--with-registry-auth")
	}
	args = append(args, "--compose-file", "-", name)
	_, err := c.CLI.RunInput(ctx, bytes.NewReader(raw), args...)
	if err != nil {
		return fmt.Errorf("deploy trusted stack: %w", err)
	}
	return nil
}

func agentInstalled(nodes []domain.Node) bool {
	for _, node := range nodes {
		if strings.TrimSpace(node.Agent.Address) != "" {
			return true
		}
	}
	return false
}

func (c *ControlPlane) requireAudit() error {
	if c.Audit == nil {
		return fmt.Errorf("audit log is not configured")
	}
	if err := c.Audit.Writable(); err != nil {
		return fmt.Errorf("audit log is unavailable: %w", err)
	}
	return nil
}

func (c *ControlPlane) agentAddresses(ctx context.Context) map[string]string {
	if strings.TrimSpace(c.AgentService) == "" {
		return nil
	}
	tasks, err := c.Docker.ListTasks(ctx, map[string][]string{"service": {c.AgentService}})
	if err != nil {
		return nil
	}
	result := map[string]string{}
	for _, task := range tasks {
		if task.Status.State != "running" || task.NodeID == "" {
			continue
		}
		for _, attachment := range task.NetworksAttachments {
			if len(attachment.Addresses) > 0 {
				result[task.NodeID] = attachment.Addresses[0]
				break
			}
		}
	}
	return result
}

func (c *ControlPlane) record(actor, requestID, action, target string, err error, detail map[string]string) {
	if c.Audit == nil {
		return
	}
	outcome := "success"
	if err != nil {
		outcome = "failure"
	}
	_, _ = c.Audit.Record(domain.AuditEvent{Action: action, Actor: actor, Detail: detail, Outcome: outcome, RequestID: requestID, Target: target})
}

func fromDockerNode(raw dockerapi.Node) domain.Node {
	node := domain.Node{
		Availability:  raw.Spec.Availability,
		DockerVersion: raw.Description.Engine.EngineVersion,
		Hostname:      raw.Description.Hostname,
		ID:            raw.ID,
		Labels:        raw.Spec.Labels,
		Platform:      domain.Platform{Architecture: raw.Description.Platform.Architecture, OS: raw.Description.Platform.OS},
		Role:          raw.Spec.Role,
		State:         raw.Status.State,
		Address:       raw.Status.Addr,
		CPU:           domain.Capacity{Capacity: raw.Description.Resources.NanoCPUs / 1_000_000_000},
		Memory:        domain.Capacity{Capacity: raw.Description.Resources.MemoryBytes},
	}
	if raw.ManagerStatus != nil {
		node.Manager = &domain.Manager{Address: raw.ManagerStatus.Addr, Leader: raw.ManagerStatus.Leader, Reachability: raw.ManagerStatus.Reachability}
	}
	return node
}

func applySnapshot(node *domain.Node, snapshot agent.Snapshot) {
	node.Agent.Healthy = true
	node.Agent.CollectedAt = snapshot.CollectedAt
	node.Agent.Version = snapshot.Version
	node.Disk = capacity(snapshot.Disk.UsedBytes, snapshot.Disk.AvailableBytes, snapshot.Disk.TotalBytes)
	node.Memory = capacity(snapshot.Hardware.MemoryTotal-snapshot.Hardware.MemoryAvailable, snapshot.Hardware.MemoryAvailable, snapshot.Hardware.MemoryTotal)
	if snapshot.Hardware.CPUCores > 0 {
		// Load average is a scheduling-pressure signal, not a CPU-utilisation
		// measurement. Keep it in Load1 and expose CPU cores as capacity only;
		// reporting load as used cores would be materially misleading.
		node.CPU = domain.Capacity{Available: uint64(snapshot.Hardware.CPUCores), Capacity: uint64(snapshot.Hardware.CPUCores)}
	}
	node.Load1 = snapshot.Hardware.Load1
	node.UptimeSeconds = snapshot.Hardware.UptimeSeconds
	node.OS = snapshot.OS.Name
	node.Kernel = snapshot.OS.Kernel
	node.Engine = domain.Engine{APIVersion: snapshot.Engine.APIVersion, CgroupDriver: snapshot.Engine.CgroupDriver, Driver: snapshot.Engine.Driver, Version: snapshot.Engine.Version}
}

func capacity(used, available, total uint64) domain.Capacity {
	value := domain.Capacity{Available: available, Capacity: total, Used: used}
	if total > 0 {
		value.Percent = float64(used) * 100 / float64(total)
	}
	return value
}

func fromDockerService(raw dockerapi.Service, tasks []dockerapi.Task, nodes int) domain.Service {
	running := uint64(0)
	for _, task := range tasks {
		if task.Status.State == "running" {
			running++
		}
	}
	desired := uint64(0)
	mode := "replicated"
	if raw.Spec.Mode.Global != nil {
		mode = "global"
		desired = uint64(nodes)
	} else if raw.Spec.Mode.Replicated != nil {
		desired = raw.Spec.Mode.Replicated.Replicas
	}
	status := domain.HealthHealthy
	if desired > 0 && running == 0 {
		status = domain.HealthUnhealthy
	} else if running < desired || raw.UpdateStatus != nil && raw.UpdateStatus.State != "completed" && raw.UpdateStatus.State != "" {
		status = domain.HealthDegraded
	}
	stack := raw.Spec.Labels["com.docker.stack.namespace"]
	update := ""
	if raw.UpdateStatus != nil {
		update = raw.UpdateStatus.State
	}
	return domain.Service{Constraints: raw.Spec.TaskTemplate.Placement.Constraints, Update: updatePolicy(raw), CreatedAt: raw.CreatedAt, DesiredTasks: desired, Health: status, ID: raw.ID, Image: raw.Spec.TaskTemplate.ContainerSpec.Image, Labels: raw.Spec.Labels, Mode: mode, Name: raw.Spec.Name, RunningTasks: running, Stack: stack, UpdatedAt: raw.UpdatedAt, UpdateState: update}
}

// updatePolicy reads what Swarm will do on a change. Absent config means the
// engine's defaults apply, and Known stays false so the preview says that
// rather than printing a number nobody configured.
func updatePolicy(raw dockerapi.Service) domain.UpdatePolicy {
	cfg := raw.Spec.UpdateConfig
	if cfg == nil {
		return domain.UpdatePolicy{}
	}
	return domain.UpdatePolicy{
		Parallelism:   cfg.Parallelism,
		DelaySeconds:  cfg.Delay / 1e9,
		FailureAction: cfg.FailureAction,
		MonitorSecond: cfg.Monitor / 1e9,
		Order:         cfg.Order,
		Known:         true,
	}
}

func fromDockerTask(raw dockerapi.Task) domain.Task {
	started, _ := time.Parse(time.RFC3339Nano, raw.Status.Timestamp)
	return domain.Task{CurrentState: raw.Status.State, DesiredState: raw.DesiredState, Error: raw.Status.Err, ID: raw.ID, NodeID: raw.NodeID, ServiceID: raw.ServiceID, Slot: raw.Slot, StartedAt: started}
}

func summarize(nodes []domain.Node, services []domain.Service) domain.Summary {
	summary := domain.Summary{Nodes: uint64(len(nodes)), Services: uint64(len(services)), ServiceHealth: domain.HealthHealthy}
	for _, node := range nodes {
		if node.Role == "manager" {
			summary.Managers++
		}
		if node.State == "ready" {
			summary.ReadyNodes++
		}
		summary.TotalCPU = addCapacity(summary.TotalCPU, node.CPU)
		summary.TotalMemory = addCapacity(summary.TotalMemory, node.Memory)
		summary.TotalDisk = addCapacity(summary.TotalDisk, node.Disk)
	}
	for _, service := range services {
		summary.RunningTasks += service.RunningTasks
		summary.ServiceHealth = combineHealth(summary.ServiceHealth, service.Health)
	}
	return summary
}

func addCapacity(left, right domain.Capacity) domain.Capacity {
	return capacity(left.Used+right.Used, left.Available+right.Available, left.Capacity+right.Capacity)
}

func overallHealth(nodes []domain.Node, services []domain.Service, requireAgent bool) domain.Health {
	state := domain.HealthHealthy
	for _, node := range nodes {
		if node.State != "ready" || requireAgent && !node.Agent.Healthy {
			state = combineHealth(state, domain.HealthDegraded)
		}
	}
	for _, service := range services {
		state = combineHealth(state, service.Health)
	}
	return state
}

func combineHealth(left, right domain.Health) domain.Health {
	if left == "" {
		return right
	}
	if left == domain.HealthUnhealthy || right == domain.HealthUnhealthy {
		return domain.HealthUnhealthy
	}
	if left == domain.HealthDegraded || right == domain.HealthDegraded {
		return domain.HealthDegraded
	}
	if left == domain.HealthUnknown || right == domain.HealthUnknown {
		return domain.HealthUnknown
	}
	return domain.HealthHealthy
}

func allowed(value string, choices ...string) bool {
	for _, choice := range choices {
		if value == choice {
			return true
		}
	}
	return false
}

func min(left, right uint64) uint64 {
	if left < right {
		return left
	}
	return right
}

// admission is the platform admission in force for this control plane. A
// mounted manifest stays authoritative; otherwise the console-owned definition
// answers, which is nil until an operator has made a choice.
func (c *ControlPlane) admission() *PlatformAdmission {
	if c == nil {
		return nil
	}
	if c.Platform != nil {
		if resolved := c.Platform.Admission(); resolved != nil {
			return resolved
		}
	}
	return c.Admission
}

// PlatformUnmanaged reports whether this controller deploys without slot
// enforcement because the operator declared the install manifest-free.
func (c *ControlPlane) PlatformUnmanaged() bool { return c.admission().Unmanaged() }
