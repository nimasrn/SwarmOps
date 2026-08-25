package ops

import (
	"context"
	"fmt"
	"strings"
)

// ApplicationRemovalConfirmation is the exact phrase required to remove one
// application. It names the application so a mistyped removal cannot take down
// the wrong one.
func ApplicationRemovalConfirmation(name string) string {
	return "REMOVE_APPLICATION_" + strings.ToUpper(strings.ReplaceAll(name, "-", "_"))
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
	rendered, stack, err := c.renderApplication(ctx, spec)
	if err == nil {
		err = c.deployRenderedApplication(ctx, rendered, stack)
	}
	if err == nil {
		err = c.Apps.Put(spec)
	}
	c.record(actor, requestID, "application.deploy", "stack/"+spec.StackName(c.Admission.Namespace()), err, map[string]string{
		"databases": strings.Join(spec.Databases, ","),
		"domain":    spec.Domain,
		"image":     spec.Image,
	})
	return err
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

// PlanApplication renders and validates without deploying, so the console can
// show the operator the exact Compose that would be applied.
func (c *ControlPlane) PlanApplication(ctx context.Context, spec ApplicationSpec) ([]byte, error) {
	if c.Admission == nil {
		return nil, fmt.Errorf("application deployment requires SWARMOPS_PLATFORM_MANIFEST_FILE")
	}
	rendered, _, err := c.renderApplication(ctx, spec.Normalize())
	return rendered, err
}

// renderApplication resolves the spec's references, renders the Compose, and
// puts it through the full policy path. It also creates the stack-scoped copy
// of each attached database URI, because a stack may only mount a secret whose
// name is inside its own namespace.
func (c *ControlPlane) renderApplication(ctx context.Context, spec ApplicationSpec) ([]byte, string, error) {
	if err := spec.Validate(); err != nil {
		return nil, "", err
	}
	namespace := c.Admission.Namespace()
	stack := spec.StackName(namespace)

	input := ApplicationRenderInput{DatabaseURIs: map[string]string{}, Namespace: namespace, Spec: spec}
	for _, engine := range spec.Databases {
		uri, found := c.Credentials.Get(engine)
		if !found {
			definition, err := DatabaseDefinitionFor(engine)
			if err != nil {
				return nil, "", err
			}
			return nil, "", fmt.Errorf("managed %s is not deployed; deploy it before attaching it to %q", definition.DisplayName, spec.Name)
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
	if spec.DatabaseDelivery == DeliverySecret {
		if err := c.ensureApplicationSecrets(ctx, stack, spec, input.DatabaseURIs); err != nil {
			return nil, "", err
		}
	}
	return rendered, stack, nil
}

// ensureApplicationSecrets copies each attached database URI into a secret
// scoped to this application's stack. The value is identical to the shared
// one; the separate object is what keeps the namespace boundary intact.
func (c *ControlPlane) ensureApplicationSecrets(ctx context.Context, stack string, spec ApplicationSpec, uris map[string]string) error {
	if len(spec.Databases) == 0 {
		return nil
	}
	existing, err := c.swarmSecretNames(ctx)
	if err != nil {
		return err
	}
	for _, engine := range spec.Databases {
		name := stack + "_" + engine + "_uri_v1"
		if existing[name] {
			continue
		}
		if _, err := c.CLI.RunInput(ctx, strings.NewReader(uris[engine]), "secret", "create", name, "-"); err != nil {
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
