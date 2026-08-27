package ops

import (
	"context"
	"fmt"
	"strings"

	"github.com/nimasrn/SwarmOps/internal/agentcontrol"
)

// ApplicationRemovalConfirmation is the exact phrase required to remove one
// application. It names the application so a mistyped removal cannot take down
// the wrong one.
func ApplicationRemovalConfirmation(name string) string {
	return "REMOVE_APPLICATION_" + strings.ToUpper(strings.ReplaceAll(name, "-", "_"))
}

func ApplicationDomainRemovalConfirmation(name string) string {
	return "REMOVE_DOMAIN_" + strings.ToUpper(strings.ReplaceAll(name, "-", "_"))
}

// DeployApplication renders, re-validates, and deploys one application.
//
// The rendered Compose goes through exactly the same ValidateCompose and
// platform-admission checks as hand-written Compose. That is the point: the
// renderer is a convenience for the operator, not a bypass, and a bug in it
// surfaces as a refused deployment rather than an unreviewed stack.
func (c *ControlPlane) DeployApplication(ctx context.Context, actor, requestID string, spec ApplicationSpec) error {
	if !c.Mutations {
		return fmt.Errorf("cluster mutations are disabled")
	}
	if err := c.requireAudit(); err != nil {
		return err
	}
	if c.Admission == nil {
		return fmt.Errorf("application deployment requires SWARMOPS_PLATFORM_MANIFEST_FILE")
	}
	spec = spec.Normalize()
	rendered, stack, err := c.renderApplication(ctx, spec, true)
	if err == nil {
		err = c.prepareApplicationRouteNetwork(ctx, spec)
	}
	if err == nil && spec.DatabaseDelivery == DeliverySecret {
		err = c.ensureApplicationSecrets(ctx, stack, spec)
	}
	if err == nil {
		err = c.deployRenderedApplication(ctx, rendered, stack)
	}
	if err == nil {
		err = c.Apps.Put(spec)
	}
	if err == nil && c.Routing != nil && validClusterID(c.ServerID) {
		route := c.applicationDesiredRoute(spec)
		err = c.Routing.PutRoute(c.ServerID, route)
		if err == nil {
			err = c.Routing.PutDeclaration(c.ServerID, ServiceRouteDeclaration{Role: ServiceRoleRouted, ServiceKey: route.ServiceKey, Version: RoutingSchemaVersion})
		}
		if err == nil {
			err = c.applyApplicationDependencyBindings(ctx, actor, requestID, spec, route)
		}
		if err == nil {
			err = c.RefreshTraefikRuntime(ctx)
		}
	}
	c.record(actor, requestID, "application.deploy", "stack/"+spec.StackName(c.Admission.Namespace()), err, map[string]string{
		"databases": strings.Join(spec.Databases, ","),
		"domain":    spec.Domain,
		"image":     spec.Image,
	})
	return err
}

func (c *ControlPlane) applyApplicationDependencyBindings(ctx context.Context, actor, requestID string, spec ApplicationSpec, route RouteSpec) error {
	bindings := make([]DependencyBinding, 0, len(spec.Databases)+3)
	for _, engine := range spec.Databases {
		definition, err := DatabaseDefinitionFor(engine)
		if err != nil {
			return err
		}
		bindings = append(bindings, DependencyBinding{CallerService: route.ServiceKey, Delivery: DependencyExisting, TargetRoute: managedDatabaseRoute(definition).Key, Version: RoutingSchemaVersion})
	}
	if spec.Backend != "" {
		backendService := c.Admission.Namespace() + "-" + spec.Backend + "_" + ApplicationServiceName
		bindings = append(bindings, DependencyBinding{CallerService: route.ServiceKey, Delivery: DependencyExisting, TargetRoute: defaultRouteKey(backendService), Version: RoutingSchemaVersion})
	}
	if spec.Tracing {
		bindings = append(bindings, DependencyBinding{CallerService: route.ServiceKey, Delivery: DependencyExisting, TargetRoute: "swarmops-jaeger-otlp", Version: RoutingSchemaVersion})
	}
	for _, binding := range bindings {
		if err := c.ApplyDependencyBinding(ctx, actor, requestID, binding); err != nil {
			return err
		}
	}
	if spec.Metrics && serviceExists(ctx, c.Docker, "swarmops-observability_prometheus") {
		return c.ApplyDependencyBinding(ctx, actor, requestID, DependencyBinding{CallerService: "swarmops-observability_prometheus", Delivery: DependencyExisting, TargetRoute: route.Key, Version: RoutingSchemaVersion})
	}
	return nil
}

// RemoveApplication removes the stack and then forgets the spec.
func (c *ControlPlane) RemoveApplication(ctx context.Context, actor, requestID, name, confirmation string) error {
	if !c.Mutations {
		return fmt.Errorf("cluster mutations are disabled")
	}
	if err := c.requireAudit(); err != nil {
		return err
	}
	if c.Admission == nil {
		return fmt.Errorf("application deployment requires SWARMOPS_PLATFORM_MANIFEST_FILE")
	}
	spec, found := c.Apps.Get(name)
	if !found {
		return fmt.Errorf("application %q is not deployed by SwarmOps", name)
	}
	if confirmation != ApplicationRemovalConfirmation(spec.Name) {
		return fmt.Errorf("removal requires confirmation %s", ApplicationRemovalConfirmation(spec.Name))
	}
	stack := spec.StackName(c.Admission.Namespace())
	_, err := c.CLI.Run(ctx, "stack", "rm", stack)
	if err == nil {
		err = c.Apps.Remove(spec.Name)
	}
	c.record(actor, requestID, "application.remove", "stack/"+stack, err, nil)
	return err
}

// SetApplicationDomain re-renders an existing application with one reviewed
// hostname, or with no route when its manifest slot explicitly permits that.
// It never edits Traefik directly; the normal renderer and admission path own
// both assignment and removal.
func (c *ControlPlane) SetApplicationDomain(ctx context.Context, actor, requestID, name, domain, resolver, confirmation string) error {
	if c.Apps == nil {
		return fmt.Errorf("sealed applications are not configured")
	}
	spec, found := c.Apps.Get(name)
	if !found {
		return fmt.Errorf("application %q is not deployed by SwarmOps", name)
	}
	domain = strings.ToLower(strings.TrimSuffix(strings.TrimSpace(domain), "."))
	resolver = strings.TrimSpace(resolver)
	if domain == "" {
		if confirmation != ApplicationDomainRemovalConfirmation(spec.Name) {
			return fmt.Errorf("domain removal requires confirmation %s", ApplicationDomainRemovalConfirmation(spec.Name))
		}
		resolver = ""
	}
	spec.Domain = domain
	spec.Resolver = resolver
	err := c.DeployApplication(ctx, actor, requestID, spec)
	c.record(actor, requestID, "application.domain", "application/"+spec.Name, err, map[string]string{"assigned": fmt.Sprint(domain != "")})
	return err
}

// PlanApplication renders and validates without deploying, so the console can
// show the operator the exact Compose that would be applied.
func (c *ControlPlane) PlanApplication(ctx context.Context, spec ApplicationSpec) ([]byte, error) {
	if c.Admission == nil {
		return nil, fmt.Errorf("application deployment requires SWARMOPS_PLATFORM_MANIFEST_FILE")
	}
	rendered, _, err := c.renderApplication(ctx, spec.Normalize(), false)
	return rendered, err
}

// renderApplication resolves the spec's references, renders the Compose, and
// puts it through the full policy path. It also creates the stack-scoped copy
// of each attached database URI, because a stack may only mount a secret whose
// name is inside its own namespace.
func (c *ControlPlane) renderApplication(ctx context.Context, spec ApplicationSpec, requireDatabases bool) ([]byte, string, error) {
	if err := spec.Validate(); err != nil {
		return nil, "", err
	}
	if err := c.Admission.ValidateApplicationImage(spec.Image); err != nil {
		return nil, "", err
	}
	if err := c.Apps.DomainAvailable(spec.Name, spec.Domain); err != nil {
		return nil, "", err
	}
	namespace := c.Admission.Namespace()
	stack := spec.StackName(namespace)

	input := ApplicationRenderInput{DatabaseURIs: map[string]string{}, Namespace: namespace, Spec: spec}
	if c.Routing != nil && validClusterID(c.ServerID) {
		state, stateErr := c.Routing.Snapshot(c.ServerID)
		if stateErr != nil {
			return nil, "", stateErr
		}
		serviceKey := spec.ServiceDNSName(namespace)
		for _, route := range state.Routes {
			if route.ServiceKey == serviceKey && route.Protocol == RouteHTTP {
				copy := route
				input.Route = &copy
				break
			}
		}
	}
	for _, engine := range spec.Databases {
		uri, found := c.Credentials.Get(engine)
		if !found {
			definition, err := DatabaseDefinitionFor(engine)
			if err != nil {
				return nil, "", err
			}
			if requireDatabases || spec.DatabaseDelivery == DeliveryEnv {
				return nil, "", fmt.Errorf("managed %s is not deployed; deploy it before attaching it to %q", definition.DisplayName, spec.Name)
			}
			uri = "managed://pending/" + definition.Engine
		}
		input.DatabaseURIs[engine] = uri
	}
	if spec.Backend != "" {
		backend, found := c.Apps.Get(spec.Backend)
		if !found {
			return nil, "", fmt.Errorf("backend application %q is not deployed by SwarmOps", spec.Backend)
		}
		input.BackendDomain = backend.Domain
		input.BackendPort = backend.Port
	}

	rendered, err := RenderApplication(input)
	if err != nil {
		return nil, "", err
	}
	if _, err := ValidateCompose(rendered); err != nil {
		return nil, "", fmt.Errorf("rendered application failed compose policy: %w", err)
	}
	if err := c.Admission.ValidateStack(stack, rendered); err != nil {
		return nil, "", err
	}
	return rendered, stack, nil
}

func (c *ControlPlane) applicationDesiredRoute(spec ApplicationSpec) RouteSpec {
	stack := spec.StackName(c.Admission.Namespace())
	fallback := applicationRouteSpec(spec, stack)
	if c.Routing == nil || !validClusterID(c.ServerID) {
		return fallback
	}
	state, err := c.Routing.Snapshot(c.ServerID)
	if err != nil {
		return fallback
	}
	for _, route := range state.Routes {
		if route.ServiceKey == fallback.ServiceKey && route.Protocol == RouteHTTP {
			return route
		}
	}
	return fallback
}

func (c *ControlPlane) prepareApplicationRouteNetwork(ctx context.Context, spec ApplicationSpec) error {
	if c.Routing == nil || !validClusterID(c.ServerID) {
		return nil
	}
	adapter, err := c.traefikMachineAdapter()
	if err != nil {
		return err
	}
	services, err := c.Docker.ListServices(ctx)
	if err != nil {
		return err
	}
	traefikID := ""
	for _, service := range services {
		if service.Spec.Name == traefikServiceName {
			traefikID = service.ID
			break
		}
	}
	if traefikID == "" {
		return fmt.Errorf("Traefik singleton service was not found")
	}
	return adapter.PrepareRoutingNetwork(ctx, agentcontrol.RoutingNetworkRequest{
		Network:          RouteNetworkName(spec.ServiceDNSName(c.Admission.Namespace())),
		TraefikServiceID: traefikID,
		Version:          agentcontrol.RoutingVersion,
	})
}

// ensureApplicationSecrets copies each attached database URI into a secret
// scoped to this application's stack. The value is identical to the shared
// one; the separate object is what keeps the namespace boundary intact.
func (c *ControlPlane) ensureApplicationSecrets(ctx context.Context, stack string, spec ApplicationSpec) error {
	if len(spec.Databases) == 0 {
		return nil
	}
	existing, err := c.swarmSecretNames(ctx)
	if err != nil {
		return err
	}
	for _, engine := range spec.Databases {
		uri, found := c.Credentials.Get(engine)
		if !found {
			return fmt.Errorf("managed database %q has no sealed connection URI", engine)
		}
		name := stack + "_" + engine + "_uri_v1"
		if existing[name] {
			continue
		}
		if _, err := c.CLI.RunInput(ctx, strings.NewReader(uri), "secret", "create", name, "-"); err != nil {
			return fmt.Errorf("create application connection secret: %w", err)
		}
	}
	return nil
}

func (c *ControlPlane) deployRenderedApplication(ctx context.Context, rendered []byte, stack string) error {
	nodes, err := c.Nodes(ctx)
	if err != nil {
		return err
	}
	if report := c.Admission.CheckLive(nodes); !report.Valid() {
		return fmt.Errorf("live platform admission refused this deployment: %s", summarizeFindings(report))
	}
	return c.deployTrustedContent(ctx, rendered, stack)
}

// Applications reports the stored specs together with their live service
// state, so the console can show what is running without a second request.
func (c *ControlPlane) Applications(ctx context.Context) ([]ApplicationStatus, error) {
	specs := c.Apps.List()
	if len(specs) == 0 {
		return []ApplicationStatus{}, nil
	}
	services, err := c.Services(ctx)
	if err != nil {
		return nil, err
	}
	running := make(map[string]uint64, len(services))
	for _, service := range services {
		running[service.Name] = service.RunningTasks
	}
	namespace := ""
	if c.Admission != nil {
		namespace = c.Admission.Namespace()
	}
	statuses := make([]ApplicationStatus, 0, len(specs))
	for _, spec := range specs {
		service := spec.ServiceDNSName(namespace)
		tasks, deployed := running[service]
		status := ApplicationStatus{
			Deployed:     deployed,
			RunningTasks: tasks,
			Service:      service,
			Spec:         spec,
			Stack:        spec.StackName(namespace),
		}
		if spec.Domain != "" {
			status.URL = "https://" + spec.Domain
		}
		statuses = append(statuses, status)
	}
	return statuses, nil
}

// ApprovedApplications exposes the reviewed manifest's application slots.
func (c *ControlPlane) ApprovedApplications() []ApprovedWorkload {
	return c.Admission.ApprovedApplications()
}

// ApplicationStatus is the browser-safe view of one rendered application.
type ApplicationStatus struct {
	Deployed     bool            `json:"deployed"`
	RunningTasks uint64          `json:"runningTasks"`
	Service      string          `json:"service"`
	Spec         ApplicationSpec `json:"spec"`
	Stack        string          `json:"stack"`
	URL          string          `json:"url,omitempty"`
}
