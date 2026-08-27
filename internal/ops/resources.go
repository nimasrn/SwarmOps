package ops

import (
	"context"
	"fmt"
	"strconv"
	"strings"
)

// The mutations here complete the Docker and Swarm surface the console
// manages. Each one keeps the house rules: mutations must be enabled, the
// audit store must be writable, every argument is validated before it becomes
// a fixed Docker argv, and the result is recorded.

func (c *ControlPlane) SetNodeRole(ctx context.Context, actor, requestID, nodeID, role string) error {
	if err := c.mutable(); err != nil {
		return err
	}
	if !allowed(role, "promote", "demote") {
		return fmt.Errorf("node role must be promote or demote")
	}
	if _, err := serviceReference(nodeID); err != nil {
		return err
	}
	_, err := c.CLI.Run(ctx, "node", role, nodeID)
	c.record(actor, requestID, "node."+role, "node/"+nodeID, err, map[string]string{"role": role})
	return err
}

func (c *ControlPlane) SetNodeLabel(ctx context.Context, actor, requestID, nodeID, key, value string) error {
	if err := c.mutable(); err != nil {
		return err
	}
	if _, err := serviceReference(nodeID); err != nil {
		return err
	}
	if !validLabelKey(key) {
		return fmt.Errorf("invalid node label key")
	}
	if value == "" {
		_, err := c.CLI.Run(ctx, "node", "update", "--label-rm", key, nodeID)
		c.record(actor, requestID, "node.label.remove", "node/"+nodeID, err, map[string]string{"key": key})
		return err
	}
	if !validLabelValue(value) {
		return fmt.Errorf("invalid node label value")
	}
	_, err := c.CLI.Run(ctx, "node", "update", "--label-add", key+"="+value, nodeID)
	c.record(actor, requestID, "node.label.add", "node/"+nodeID, err, map[string]string{"key": key, "value": value})
	return err
}

// RemoveNode takes a node out of the cluster. It is force-removed because a
// node an operator is deleting from the console is usually already gone; the
// confirmation is the operator's own removal request in the command ledger.
func (c *ControlPlane) RemoveNode(ctx context.Context, actor, requestID, nodeID, confirmation string) error {
	if err := c.mutable(); err != nil {
		return err
	}
	if confirmation != NodeRemovalConfirmation(nodeID) {
		return fmt.Errorf("removal requires confirmation %s", NodeRemovalConfirmation(nodeID))
	}
	if _, err := serviceReference(nodeID); err != nil {
		return err
	}
	_, err := c.CLI.Run(ctx, "node", "rm", "--force", nodeID)
	c.record(actor, requestID, "node.remove", "node/"+nodeID, err, nil)
	return err
}

func (c *ControlPlane) UpdateServiceImage(ctx context.Context, actor, requestID, serviceID, image string) error {
	if err := c.mutable(); err != nil {
		return err
	}
	if _, err := serviceReference(serviceID); err != nil {
		return err
	}
	if !validImageReference(image) {
		return fmt.Errorf("invalid image reference")
	}
	_, err := c.CLI.Run(ctx, "service", "update", "--image", image, serviceID)
	c.record(actor, requestID, "service.image", "service/"+serviceID, err, map[string]string{"image": image})
	return err
}

func (c *ControlPlane) UpdateServiceLimits(ctx context.Context, actor, requestID, serviceID, cpus, memory string) error {
	if err := c.mutable(); err != nil {
		return err
	}
	if _, err := serviceReference(serviceID); err != nil {
		return err
	}
	if !validCPULimit(cpus) || !validMemoryLimit(memory) {
		return fmt.Errorf("limits require CPU cores such as 1.5 and memory such as 512M")
	}
	_, err := c.CLI.Run(ctx, "service", "update", "--limit-cpu", cpus, "--limit-memory", memory, serviceID)
	c.record(actor, requestID, "service.limits", "service/"+serviceID, err, map[string]string{"cpus": cpus, "memory": memory})
	return err
}

func (c *ControlPlane) RemoveService(ctx context.Context, actor, requestID, serviceID, confirmation string) error {
	if err := c.mutable(); err != nil {
		return err
	}
	if confirmation != ServiceRemovalConfirmation(serviceID) {
		return fmt.Errorf("removal requires confirmation %s", ServiceRemovalConfirmation(serviceID))
	}
	if _, err := serviceReference(serviceID); err != nil {
		return err
	}
	_, err := c.CLI.Run(ctx, "service", "rm", serviceID)
	c.record(actor, requestID, "service.remove", "service/"+serviceID, err, nil)
	return err
}

func (c *ControlPlane) CreateNetwork(ctx context.Context, actor, requestID, name, driver string, attachable, internal bool) error {
	if err := c.mutable(); err != nil {
		return err
	}
	if !validResourceName(name) {
		return fmt.Errorf("invalid network name")
	}
	if !allowed(driver, "overlay", "bridge") {
		return fmt.Errorf("network driver must be overlay or bridge")
	}
	args := []string{"network", "create", "--driver", driver}
	if attachable {
		args = append(args, "--attachable")
	}
	if internal {
		args = append(args, "--internal")
	}
	_, err := c.CLI.Run(ctx, append(args, name)...)
	c.record(actor, requestID, "network.create", "network/"+name, err, map[string]string{
		"attachable": strconv.FormatBool(attachable),
		"driver":     driver,
		"internal":   strconv.FormatBool(internal),
	})
	return err
}

func (c *ControlPlane) RemoveNetwork(ctx context.Context, actor, requestID, name, confirmation string) error {
	if err := c.mutable(); err != nil {
		return err
	}
	if confirmation != ResourceRemovalConfirmation("NETWORK", name) {
		return fmt.Errorf("removal requires confirmation %s", ResourceRemovalConfirmation("NETWORK", name))
	}
	if !validResourceName(name) {
		return fmt.Errorf("invalid network name")
	}
	_, err := c.CLI.Run(ctx, "network", "rm", name)
	c.record(actor, requestID, "network.remove", "network/"+name, err, nil)
	return err
}

func (c *ControlPlane) CreateVolume(ctx context.Context, actor, requestID, name string) error {
	if err := c.mutable(); err != nil {
		return err
	}
	if !validResourceName(name) {
		return fmt.Errorf("invalid volume name")
	}
	_, err := c.CLI.Run(ctx, "volume", "create", "--driver", "local", name)
	c.record(actor, requestID, "volume.create", "volume/"+name, err, nil)
	return err
}

// RemoveVolume destroys data that nothing else in SwarmOps can restore, so it
// asks for the volume's own confirmation phrase rather than a generic one.
func (c *ControlPlane) RemoveVolume(ctx context.Context, actor, requestID, name, confirmation string) error {
	if err := c.mutable(); err != nil {
		return err
	}
	if confirmation != ResourceRemovalConfirmation("VOLUME", name) {
		return fmt.Errorf("removal requires confirmation %s", ResourceRemovalConfirmation("VOLUME", name))
	}
	if !validResourceName(name) {
		return fmt.Errorf("invalid volume name")
	}
	_, err := c.CLI.Run(ctx, "volume", "rm", name)
	c.record(actor, requestID, "volume.remove", "volume/"+name, err, nil)
	return err
}

func (c *ControlPlane) RemoveConfig(ctx context.Context, actor, requestID, name, confirmation string) error {
	if err := c.mutable(); err != nil {
		return err
	}
	if confirmation != ResourceRemovalConfirmation("CONFIG", name) {
		return fmt.Errorf("removal requires confirmation %s", ResourceRemovalConfirmation("CONFIG", name))
	}
	if !validResourceName(name) {
		return fmt.Errorf("invalid config name")
	}
	_, err := c.CLI.Run(ctx, "config", "rm", name)
	c.record(actor, requestID, "config.remove", "config/"+name, err, nil)
	return err
}

func (c *ControlPlane) PullImage(ctx context.Context, actor, requestID, image string) error {
	if err := c.mutable(); err != nil {
		return err
	}
	if !validImageReference(image) {
		return fmt.Errorf("invalid image reference")
	}
	_, err := c.CLI.Run(ctx, "image", "pull", image)
	c.record(actor, requestID, "image.pull", "image/"+image, err, nil)
	return err
}

func (c *ControlPlane) RemoveImage(ctx context.Context, actor, requestID, image string) error {
	if err := c.mutable(); err != nil {
		return err
	}
	if !validImageReference(image) {
		return fmt.Errorf("invalid image reference")
	}
	_, err := c.CLI.Run(ctx, "image", "rm", image)
	c.record(actor, requestID, "image.remove", "image/"+image, err, nil)
	return err
}

func (c *ControlPlane) ContainerAction(ctx context.Context, actor, requestID, containerID, action, confirmation string) error {
	if err := c.mutable(); err != nil {
		return err
	}
	if !allowed(action, "start", "stop", "restart", "remove") {
		return fmt.Errorf("unsupported container action")
	}
	if _, err := serviceReference(containerID); err != nil {
		return err
	}
	args := []string{"container", action, containerID}
	if action == "remove" {
		if confirmation != ResourceRemovalConfirmation("CONTAINER", containerID) {
			return fmt.Errorf("removal requires confirmation %s", ResourceRemovalConfirmation("CONTAINER", containerID))
		}
		args = []string{"container", "rm", "--force", containerID}
	}
	_, err := c.CLI.Run(ctx, args...)
	c.record(actor, requestID, "container."+action, "container/"+containerID, err, map[string]string{"action": action})
	return err
}

// Prune reclaims space for one resource kind. Every kind is destructive in its
// own way, so each carries its own confirmation phrase.
func (c *ControlPlane) Prune(ctx context.Context, actor, requestID, resource, confirmation string, all bool) error {
	if err := c.mutable(); err != nil {
		return err
	}
	if !allowed(resource, "containers", "images", "networks", "volumes", "build-cache") {
		return fmt.Errorf("unsupported prune resource")
	}
	if confirmation != PruneConfirmation(resource) {
		return fmt.Errorf("prune requires confirmation %s", PruneConfirmation(resource))
	}
	var args []string
	switch resource {
	case "containers":
		args = []string{"container", "prune", "--force"}
	case "images":
		args = []string{"image", "prune", "--force"}
		if all {
			args = append(args, "--all")
		}
	case "networks":
		args = []string{"network", "prune", "--force"}
	case "volumes":
		args = []string{"volume", "prune", "--force"}
	case "build-cache":
		args = []string{"builder", "prune", "--force"}
	}
	_, err := c.CLI.Run(ctx, args...)
	c.record(actor, requestID, "prune."+resource, "cluster/"+resource, err, map[string]string{"all": strconv.FormatBool(all)})
	return err
}

// RotateJoinToken invalidates a leaked worker or manager join token. The new
// token is never returned: enrolment stays an installer workflow, and the
// command's own output is discarded by the agent.
func (c *ControlPlane) RotateJoinToken(ctx context.Context, actor, requestID, role, confirmation string) error {
	if err := c.mutable(); err != nil {
		return err
	}
	if !allowed(role, "worker", "manager") {
		return fmt.Errorf("join token role must be worker or manager")
	}
	if confirmation != JoinTokenRotationConfirmation(role) {
		return fmt.Errorf("rotation requires confirmation %s", JoinTokenRotationConfirmation(role))
	}
	_, err := c.CLI.Run(ctx, "swarm", "join-token", "--rotate", "--quiet", role)
	c.record(actor, requestID, "swarm.join-token.rotate", "swarm/"+role, err, nil)
	return err
}

func (c *ControlPlane) UpdateSwarm(ctx context.Context, actor, requestID string, taskHistoryLimit uint64) error {
	if err := c.mutable(); err != nil {
		return err
	}
	if taskHistoryLimit == 0 || taskHistoryLimit > 1000 {
		return fmt.Errorf("task history limit must be between 1 and 1000")
	}
	_, err := c.CLI.Run(ctx, "swarm", "update", "--task-history-limit", strconv.FormatUint(taskHistoryLimit, 10))
	c.record(actor, requestID, "swarm.update", "swarm/cluster", err, map[string]string{"taskHistoryLimit": strconv.FormatUint(taskHistoryLimit, 10)})
	return err
}

// RemoveStack deletes any stack an operator names. Application stacks are
// removed through the application path, which also forgets their record; this
// exists for the stacks SwarmOps did not create.
func (c *ControlPlane) RemoveStack(ctx context.Context, actor, requestID, name, confirmation string) error {
	if err := c.mutable(); err != nil {
		return err
	}
	if !ValidStackName(name) {
		return fmt.Errorf("invalid stack name")
	}
	if confirmation != ResourceRemovalConfirmation("STACK", name) {
		return fmt.Errorf("removal requires confirmation %s", ResourceRemovalConfirmation("STACK", name))
	}
	_, err := c.CLI.Run(ctx, "stack", "rm", name)
	c.record(actor, requestID, "stack.remove", "stack/"+name, err, nil)
	return err
}

func (c *ControlPlane) mutable() error {
	if !c.Mutations {
		return fmt.Errorf("cluster mutations are disabled")
	}
	return c.requireAudit()
}

// The confirmation phrases are derived, never free text, so the console can
// show the operator exactly what to type and the API can check it.
func NodeRemovalConfirmation(nodeID string) string {
	return "REMOVE_NODE_" + strings.ToUpper(nodeID)
}

func ServiceRemovalConfirmation(serviceID string) string {
	return "REMOVE_SERVICE_" + strings.ToUpper(serviceID)
}

func ResourceRemovalConfirmation(kind, name string) string {
	return "REMOVE_" + kind + "_" + strings.ToUpper(name)
}

func PruneConfirmation(resource string) string {
	return "PRUNE_" + strings.ToUpper(strings.ReplaceAll(resource, "-", "_"))
}

func JoinTokenRotationConfirmation(role string) string {
	return "ROTATE_" + strings.ToUpper(role) + "_JOIN_TOKEN"
}

func validResourceName(value string) bool {
	if value == "" || len(value) > 63 {
		return false
	}
	for index, character := range value {
		switch {
		case character >= 'a' && character <= 'z',
			character >= 'A' && character <= 'Z',
			character >= '0' && character <= '9':
		case index > 0 && (character == '_' || character == '.' || character == '-'):
		default:
			return false
		}
	}
	return true
}

func validImageReference(value string) bool {
	if value == "" || len(value) > 255 {
		return false
	}
	for _, character := range value {
		switch {
		case character >= 'a' && character <= 'z',
			character >= 'A' && character <= 'Z',
			character >= '0' && character <= '9',
			character == '.', character == '_', character == '-',
			character == '/', character == ':', character == '@':
		default:
			return false
		}
	}
	return true
}

func validLabelKey(value string) bool {
	if value == "" || len(value) > 63 {
		return false
	}
	for _, character := range value {
		switch {
		case character >= 'a' && character <= 'z',
			character >= 'A' && character <= 'Z',
			character >= '0' && character <= '9',
			character == '.', character == '_', character == '-', character == '/':
		default:
			return false
		}
	}
	return true
}

func validLabelValue(value string) bool {
	if value == "" || len(value) > 128 {
		return false
	}
	for _, character := range value {
		switch {
		case character >= 'a' && character <= 'z',
			character >= 'A' && character <= 'Z',
			character >= '0' && character <= '9',
			character == '.', character == '_', character == '-', character == '/',
			character == ':', character == '@', character == ' ':
		default:
			return false
		}
	}
	return true
}

func validCPULimit(value string) bool {
	parsed, err := strconv.ParseFloat(value, 64)
	if err != nil || parsed < 0 || parsed > 99 {
		return false
	}
	// The agent renders this string verbatim, so keep it to the shape its own
	// pattern accepts rather than re-formatting the operator's input.
	return cpuLimitShape(value)
}

func cpuLimitShape(value string) bool {
	whole, fraction, found := strings.Cut(value, ".")
	if whole == "" || len(whole) > 2 {
		return false
	}
	if found && (fraction == "" || len(fraction) > 3) {
		return false
	}
	for _, part := range []string{whole, fraction} {
		for _, character := range part {
			if character < '0' || character > '9' {
				return false
			}
		}
	}
	return true
}

func validMemoryLimit(value string) bool {
	if len(value) < 2 || len(value) > 7 {
		return false
	}
	unit := value[len(value)-1]
	if unit != 'M' && unit != 'G' {
		return false
	}
	digits := value[:len(value)-1]
	if digits[0] == '0' {
		return false
	}
	for _, character := range digits {
		if character < '0' || character > '9' {
			return false
		}
	}
	return true
}
