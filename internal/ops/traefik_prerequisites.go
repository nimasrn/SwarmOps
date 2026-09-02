package ops

import (
	"context"
	"fmt"
	"net/netip"
	"os"
	"sort"
	"strings"

	"golang.org/x/crypto/bcrypt"
)

// TraefikPrerequisiteRepair is generated only by Core after a live preflight.
// The browser cannot supply Docker arguments, config content, a node ID, or a
// secret name. DashboardAuth is stored only inside the encrypted command
// payload and is never copied into public command or audit metadata.
type TraefikPrerequisiteRepair struct {
	CreateDashboardAuth  bool   `json:"createDashboardAuth"`
	CreateDynamicConfig  bool   `json:"createDynamicConfig"`
	CreateIngressNetwork bool   `json:"createIngressNetwork"`
	CreateNetwork        bool   `json:"createNetwork"`
	DashboardAuth        string `json:"dashboardAuth,omitempty"`
	DynamicConfig        string `json:"dynamicConfig,omitempty"`
	EdgeManagerID        string `json:"edgeManagerId,omitempty"`
	IngressGateway       string `json:"ingressGateway,omitempty"`
	IngressSubnet        string `json:"ingressSubnet,omitempty"`
}

func (r TraefikPrerequisiteRepair) HasChanges() bool {
	return r.CreateDashboardAuth || r.CreateDynamicConfig || r.CreateIngressNetwork || r.CreateNetwork || r.EdgeManagerID != ""
}

// PlanTraefikPrerequisiteRepair converts only the four known, reversible
// installation blockers into a fixed repair plan. A conflicting network,
// absent reviewed asset, missing manager, ACME error, wildcard DNS need, or
// incompatible agent remains an explicit blocker instead of being guessed at.
func (c *ControlPlane) PlanTraefikPrerequisiteRepair(ctx context.Context) (TraefikPrerequisiteRepair, error) {
	if err := c.mutable(); err != nil {
		return TraefikPrerequisiteRepair{}, err
	}
	preflight, err := c.TraefikInstallPreflight(ctx)
	if err != nil {
		return TraefikPrerequisiteRepair{}, err
	}
	if preflight.Ready {
		return TraefikPrerequisiteRepair{}, fmt.Errorf("Traefik installation prerequisites are already complete")
	}
	if !preflight.Repairable {
		for _, check := range preflight.Checks {
			if check.Required && check.State == "blocked" && !check.Fixable {
				return TraefikPrerequisiteRepair{}, fmt.Errorf("Traefik prerequisite %s cannot be repaired automatically: %s", check.Label, check.Recovery)
			}
		}
	}

	plan := TraefikPrerequisiteRepair{}
	for _, check := range preflight.Checks {
		if check.State != "blocked" {
			continue
		}
		switch check.ID {
		case "ingress-network":
			networks, listErr := c.Docker.ListNetworks(ctx)
			if listErr != nil {
				return TraefikPrerequisiteRepair{}, fmt.Errorf("inspect ingress network before repair: %w", listErr)
			}
			subnet, gateway := c.ingressAddressCandidate(networks)
			if subnet == "" {
				return TraefikPrerequisiteRepair{}, fmt.Errorf("no reviewed ingress subnet is free on this cluster; free a range, then recreate the ingress network manually")
			}
			plan.CreateIngressNetwork = true
			plan.IngressGateway = gateway
			plan.IngressSubnet = subnet
		case "edge-network":
			plan.CreateNetwork = true
		case "edge-placement":
			plan.EdgeManagerID, err = c.traefikEdgeManagerCandidate(ctx)
			if err != nil {
				return TraefikPrerequisiteRepair{}, err
			}
		case "dynamic-config":
			data, readErr := os.ReadFile(c.TraefikDynamicConfigFile)
			if readErr != nil {
				return TraefikPrerequisiteRepair{}, fmt.Errorf("read reviewed Traefik dynamic config: %w", readErr)
			}
			plan.CreateDynamicConfig = true
			plan.DynamicConfig = string(data)
		case "dashboard-auth":
			plan.CreateDashboardAuth = true
		}
	}
	if !plan.HasChanges() {
		return TraefikPrerequisiteRepair{}, fmt.Errorf("no automatically repairable Traefik prerequisite is incomplete")
	}
	return plan, nil
}

func (c *ControlPlane) traefikEdgeManagerCandidate(ctx context.Context) (string, error) {
	nodes, err := c.Docker.ListNodes(ctx)
	if err != nil {
		return "", fmt.Errorf("select Traefik edge manager: %w", err)
	}
	type candidate struct {
		hostname string
		id       string
		leader   bool
	}
	candidates := []candidate{}
	for _, node := range nodes {
		if node.Spec.Role != "manager" || node.Spec.Availability != "active" || node.Status.State != "ready" {
			continue
		}
		candidates = append(candidates, candidate{hostname: node.Description.Hostname, id: node.ID, leader: node.ManagerStatus != nil && node.ManagerStatus.Leader})
	}
	sort.Slice(candidates, func(left, right int) bool {
		if candidates[left].leader != candidates[right].leader {
			return candidates[left].leader
		}
		if candidates[left].hostname != candidates[right].hostname {
			return candidates[left].hostname < candidates[right].hostname
		}
		return candidates[left].id < candidates[right].id
	})
	if len(candidates) == 0 {
		return "", fmt.Errorf("no ready active manager is available for Traefik placement")
	}
	return candidates[0].id, nil
}

// RepairTraefikPrerequisites applies an idempotent, fixed sequence. Each retry
// re-reads the cluster and skips a resource that already reached the reviewed
// state, so an interrupted run does not create duplicate immutable resources.
func (c *ControlPlane) RepairTraefikPrerequisites(ctx context.Context, actor, requestID string, repair TraefikPrerequisiteRepair) error {
	if err := c.mutable(); err != nil {
		return err
	}
	if !repair.HasChanges() {
		return fmt.Errorf("Traefik prerequisite repair has no changes")
	}
	var err error
	// Ingress comes first: without it the swarm cannot publish a port, so
	// every later step would be repaired only to fail at deploy time.
	if repair.CreateIngressNetwork {
		err = c.ensureIngressNetwork(ctx, repair.IngressSubnet, repair.IngressGateway)
	}
	if err == nil && repair.CreateNetwork {
		err = c.ensureTraefikNetwork(ctx)
	}
	if err == nil && repair.EdgeManagerID != "" {
		err = c.ensureTraefikEdgeManager(ctx, repair.EdgeManagerID)
	}
	if err == nil && repair.CreateDynamicConfig {
		err = c.ensureTraefikDynamicConfig(ctx, repair.DynamicConfig)
	}
	if err == nil && repair.CreateDashboardAuth {
		err = c.ensureTraefikDashboardAuth(ctx, repair.DashboardAuth)
	}
	c.record(actor, requestID, "traefik.prerequisites.repair", "stack/traefik", err, map[string]string{
		"dashboardAuth": fmt.Sprint(repair.CreateDashboardAuth),
		"dynamicConfig": fmt.Sprint(repair.CreateDynamicConfig),
		"edgePlacement": fmt.Sprint(repair.EdgeManagerID != ""),
		"ingress":       fmt.Sprint(repair.CreateIngressNetwork),
		"network":       fmt.Sprint(repair.CreateNetwork),
	})
	return err
}

// ensureIngressNetwork recreates the swarm ingress network that swarm init
// normally provides. It re-reads the cluster first so an interrupted repair
// does not attempt a second create, and it refuses a range that overlaps an
// existing network rather than producing an ingress that cannot route.
func (c *ControlPlane) ensureIngressNetwork(ctx context.Context, subnet, gateway string) error {
	networks, err := c.Docker.ListNetworks(ctx)
	if err != nil {
		return fmt.Errorf("inspect ingress network before repair: %w", err)
	}
	for _, network := range networks {
		if network.Ingress || network.Name == "ingress" {
			return nil
		}
	}
	requested, err := netip.ParsePrefix(subnet)
	if err != nil {
		return fmt.Errorf("queued ingress subnet is not a CIDR block")
	}
	for _, network := range networks {
		for _, entry := range network.IPAM.Config {
			existing, parseErr := netip.ParsePrefix(entry.Subnet)
			if parseErr == nil && existing.Overlaps(requested) {
				return fmt.Errorf("queued ingress subnet %s overlaps the existing network %s; SwarmOps will not create an unroutable ingress", subnet, network.Name)
			}
		}
	}
	if _, err := c.CLI.Run(ctx, "network", "create", "--driver", "overlay", "--ingress", "--subnet", subnet, "--gateway", gateway, "ingress"); err != nil {
		return fmt.Errorf("create swarm ingress network: %w", err)
	}
	return nil
}

func (c *ControlPlane) ensureTraefikNetwork(ctx context.Context) error {
	networks, err := c.Docker.ListNetworks(ctx)
	if err != nil {
		return fmt.Errorf("inspect Traefik network before repair: %w", err)
	}
	for _, network := range networks {
		if network.Name != "traefik" {
			continue
		}
		_, encrypted := network.Options["encrypted"]
		if network.Driver == "overlay" && network.Scope == "swarm" && network.Attachable && encrypted {
			return nil
		}
		return fmt.Errorf("network traefik already exists with incompatible settings; SwarmOps will not replace it")
	}
	if _, err := c.CLI.Run(ctx, "network", "create", "--driver", "overlay", "--attachable", "--opt", "encrypted=true", "traefik"); err != nil {
		return fmt.Errorf("create encrypted Traefik overlay: %w", err)
	}
	return nil
}

func (c *ControlPlane) ensureTraefikEdgeManager(ctx context.Context, managerID string) error {
	if _, err := serviceReference(managerID); err != nil {
		return err
	}
	nodes, err := c.Docker.ListNodes(ctx)
	if err != nil {
		return fmt.Errorf("inspect Traefik manager placement before repair: %w", err)
	}
	for _, node := range nodes {
		if node.Spec.Role == "manager" && node.Spec.Availability == "active" && node.Status.State == "ready" && node.Spec.Labels["nim.edge"] == "true" {
			return nil
		}
	}
	for _, node := range nodes {
		if node.ID == managerID && node.Spec.Role == "manager" && node.Spec.Availability == "active" && node.Status.State == "ready" {
			_, err = c.CLI.Run(ctx, "node", "update", "--label-add", "nim.edge=true", managerID)
			if err != nil {
				return fmt.Errorf("label Traefik edge manager: %w", err)
			}
			return nil
		}
	}
	return fmt.Errorf("the reviewed Traefik edge manager is no longer ready and active")
}

func (c *ControlPlane) ensureTraefikDynamicConfig(ctx context.Context, content string) error {
	reviewed, err := os.ReadFile(c.TraefikDynamicConfigFile)
	if err != nil {
		return fmt.Errorf("read reviewed Traefik dynamic config: %w", err)
	}
	if content != string(reviewed) || content == "" || len(content) > 64<<10 || strings.ContainsRune(content, 0) {
		return fmt.Errorf("queued Traefik dynamic config does not match the reviewed controller asset")
	}
	configs, err := c.Docker.ListConfigs(ctx)
	if err != nil {
		return fmt.Errorf("inspect Traefik dynamic config before repair: %w", err)
	}
	for _, config := range configs {
		if config.Spec.Name == c.TraefikSettings.DynamicConfigName {
			return nil
		}
	}
	if _, err := c.CLI.RunInput(ctx, strings.NewReader(content), "config", "create", c.TraefikSettings.DynamicConfigName, "-"); err != nil {
		return fmt.Errorf("create reviewed Traefik dynamic config: %w", err)
	}
	return nil
}

func (c *ControlPlane) ensureTraefikDashboardAuth(ctx context.Context, htpasswd string) error {
	username, hash, found := strings.Cut(htpasswd, ":")
	cost, costErr := bcrypt.Cost([]byte(hash))
	if !found || username != "operator" || costErr != nil || cost < bcrypt.MinCost {
		return fmt.Errorf("queued Traefik dashboard authentication is invalid")
	}
	secrets, err := c.Docker.ListSecrets(ctx)
	if err != nil {
		return fmt.Errorf("inspect Traefik dashboard secret before repair: %w", err)
	}
	for _, secret := range secrets {
		if secret.Spec.Name == c.TraefikSettings.DashboardAuthSecret {
			return nil
		}
	}
	if _, err := c.CLI.RunInput(ctx, strings.NewReader(htpasswd), "secret", "create", c.TraefikSettings.DashboardAuthSecret, "-"); err != nil {
		return fmt.Errorf("create Traefik dashboard-auth secret: %w", err)
	}
	return nil
}
