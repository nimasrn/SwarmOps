package ops

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/nimasrn/SwarmOps/internal/agentcontrol"
	"github.com/nimasrn/SwarmOps/internal/dockerapi"
	"github.com/nimasrn/SwarmOps/internal/domain"
)

const traefikServiceName = "traefik_traefik"

func SensitivePublishConfirmation(serviceKey string) string {
	value := strings.ToUpper(strings.Map(func(r rune) rune {
		if r >= 'A' && r <= 'Z' || r >= '0' && r <= '9' {
			return r
		}
		if r >= 'a' && r <= 'z' {
			return r - ('a' - 'A')
		}
		return '_'
	}, serviceKey))
	return "PUBLISH_" + value
}

func (c *ControlPlane) RoutingState(ctx context.Context, refresh bool) (RoutingState, error) {
	if err := c.requireRouting(); err != nil {
		return RoutingState{}, err
	}
	if refresh {
		if err := c.RefreshTraefikRuntime(ctx); err != nil {
			return RoutingState{}, err
		}
	}
	return c.Routing.Snapshot(c.ServerID)
}

type routingApplyOptions struct {
	AddNetworks           []string
	RemoveDirectPorts     bool
	RemoveNetworks        []string
	RestorePublishedPorts []agentcontrol.RoutingPublishedPort
}

func (c *ControlPlane) RouteInventory(ctx context.Context) ([]RouteInventoryRow, error) {
	if err := c.requireRouting(); err != nil {
		return nil, err
	}
	state, err := c.Routing.Snapshot(c.ServerID)
	if err != nil {
		return nil, err
	}
	services, err := c.Docker.ListServices(ctx)
	if err != nil {
		return nil, err
	}
	routesByService := map[string]RouteSpec{}
	for _, route := range state.Routes {
		routesByService[route.ServiceKey] = route
	}
	declarations := map[string]ServiceRouteDeclaration{}
	for _, declaration := range state.Declarations {
		declarations[declaration.ServiceKey] = declaration
	}
	runtime := map[string]RouteRuntime{}
	for _, value := range state.Runtime {
		copy := value
		runtime[value.RouteKey] = copy
	}
	rows := make([]RouteInventoryRow, 0, len(services)+len(state.Routes))
	seen := map[string]bool{}
	for _, service := range services {
		key := service.Spec.Name
		seen[key] = true
		declaration, found := declarations[key]
		if !found {
			role, reason := platformServiceRole(key)
			declaration = ServiceRouteDeclaration{Reason: reason, Role: role, ServiceKey: key, Version: RoutingSchemaVersion}
		}
		route, hasRoute := routesByService[key]
		row := RouteInventoryRow{Declaration: declaration, ServiceImage: service.Spec.TaskTemplate.ContainerSpec.Image}
		if hasRoute {
			row.Route = route
			row.Status = "disabled"
			if route.Enabled {
				row.Status = "desired"
			}
			if value, found := runtime[route.Key]; found {
				copy := value
				row.Runtime = &copy
				if route.Enabled && strings.EqualFold(value.State, "enabled") {
					row.Status = "active"
				}
				if len(value.Errors) > 0 || strings.EqualFold(value.State, "disabled") && route.Enabled {
					row.Status = "drift"
				}
			}
			snippet, snippetErr := RenderRouteManifestSnippet(route)
			if snippetErr == nil {
				row.ManifestSnippet = snippet
			}
		} else {
			row.Route = disabledRouteTemplate(service)
			row.Status = string(declaration.Role)
		}
		if declaration.Role == ServiceRolePlatformException {
			row.Exception = declaration.Reason
			row.Status = string(ServiceRolePlatformException)
		}
		rows = append(rows, row)
	}
	for _, route := range state.Routes {
		if seen[route.ServiceKey] {
			continue
		}
		declaration := declarations[route.ServiceKey]
		if declaration.ServiceKey == "" {
			declaration = ServiceRouteDeclaration{Role: ServiceRoleNeedsConfiguration, ServiceKey: route.ServiceKey, Version: RoutingSchemaVersion}
		}
		rows = append(rows, RouteInventoryRow{Declaration: declaration, Route: route, Status: "service-missing"})
	}
	sort.Slice(rows, func(i, j int) bool { return rows[i].Route.ServiceKey < rows[j].Route.ServiceKey })
	return rows, nil
}

func (c *ControlPlane) PlanRoute(ctx context.Context, requested RouteSpec) (RoutePlan, error) {
	if err := c.requireRouting(); err != nil {
		return RoutePlan{}, err
	}
	state, err := c.Routing.Snapshot(c.ServerID)
	if err != nil {
		return RoutePlan{}, err
	}
	route := requested.Normalize()
	if !serviceExists(ctx, c.Docker, route.ServiceKey) {
		return RoutePlan{}, fmt.Errorf("route service was not found on the selected manager")
	}
	otherRoutes := make([]RouteSpec, 0, len(state.Routes))
	for _, existing := range state.Routes {
		if existing.Key != route.Key {
			otherRoutes = append(otherRoutes, existing)
		}
	}
	if route.Protocol != RouteHTTP {
		port, err := AllocateRoutePort(state.Settings, route.Protocol, otherRoutes, route.ListenPort)
		if err != nil {
			return RoutePlan{}, err
		}
		route.ListenPort = port
	}
	if err := ValidateRouteCompatibility(route, state.Settings, state.DNSRecords); err != nil {
		return RoutePlan{}, err
	}
	network := RouteNetworkName(route.ServiceKey)
	labels, err := RenderRouteLabels(route, network)
	if err != nil {
		return RoutePlan{}, err
	}
	snippet, err := RenderRouteManifestSnippet(route)
	if err != nil {
		return RoutePlan{}, err
	}
	entry := staticEntryPointFor(route)
	restart := false
	if route.Protocol != RouteHTTP {
		found := false
		for _, existing := range state.Settings.EntryPoints {
			if existing.Name == entry.Name {
				if existing.Port != entry.Port || existing.Protocol != entry.Protocol {
					return RoutePlan{}, fmt.Errorf("route entrypoint name conflicts with existing static settings")
				}
				if entry.Public && !existing.Public {
					restart = true
				}
				found = true
			}
		}
		if !found {
			restart = true
		}
	}
	return RoutePlan{
		EntryPoint:      entry,
		Labels:          labels,
		ManifestSnippet: snippet,
		Network:         network,
		RestartRequired: restart,
		Route:           route,
		Validation: []RouteValidation{
			{Code: "closed-contract", Message: "No raw Traefik rule or label is accepted.", Valid: true},
			{Code: "dedicated-overlay", Message: "The backend and Traefik use one encrypted service overlay.", Valid: true},
			{Code: "singleton-risk", Message: "A new static entrypoint restarts the singleton Traefik service.", Valid: !restart},
		},
		Version: RoutingSchemaVersion,
	}, nil
}

func (c *ControlPlane) ApplyRoute(ctx context.Context, actor, requestID string, requested RouteSpec, confirmation string) error {
	if !c.Mutations {
		return fmt.Errorf("cluster mutations are disabled")
	}
	if err := c.requireAudit(); err != nil {
		return err
	}
	plan, err := c.PlanRoute(ctx, requested)
	if err != nil {
		return err
	}
	required := routeApplyConfirmations(plan.Route, plan.RestartRequired)
	if confirmation = strings.TrimSpace(confirmation); confirmation != routeApplyConfirmation(plan.Route, plan.RestartRequired) {
		if len(required) == 0 {
			confirmation = ""
		}
		return fmt.Errorf("route reconciliation requires confirmation %s", routeApplyConfirmation(plan.Route, plan.RestartRequired))
	}
	if len(required) > 0 && confirmation == "" {
		return fmt.Errorf("route reconciliation requires confirmation %s", routeApplyConfirmation(plan.Route, plan.RestartRequired))
	}
	if err := validateRouteResolverCredential(plan.Route, mustRoutingSnapshot(c.Routing, c.ServerID)); err != nil {
		return err
	}
	if plan.Route.Enabled && routeIsPublic(plan.Route.Scope) && plan.Route.DNSReference != "" {
		propagation, verifyErr := c.VerifyDNSRecord(ctx, plan.Route.DNSReference)
		if verifyErr != nil {
			return verifyErr
		}
		if !propagation.Ready {
			return fmt.Errorf("public route DNS is not authoritative and visible through 1.1.1.1 and 8.8.8.8")
		}
	}
	err = c.applyRoutePlan(ctx, plan)
	c.record(actor, requestID, "traefik.route.apply", "route/"+plan.Route.Key, err, map[string]string{
		"enabled":  strconv.FormatBool(plan.Route.Enabled),
		"protocol": string(plan.Route.Protocol),
		"scope":    string(plan.Route.Scope),
		"service":  plan.Route.ServiceKey,
	})
	return err
}

func mustRoutingSnapshot(store *RoutingStore, serverID string) RoutingState {
	if store == nil {
		return RoutingState{}
	}
	state, _ := store.Snapshot(serverID)
	return state
}

func validateRouteResolverCredential(route RouteSpec, state RoutingState) error {
	if !route.Enabled || route.TLS != RouteTLSTerminate {
		return nil
	}
	resolver, found := resolverFor(state.Settings.Resolvers, route.Resolver)
	if !found {
		return fmt.Errorf("route certificate resolver is not configured")
	}
	if resolver.Challenge != ChallengeDNS01 {
		return nil
	}
	for index := len(state.Credentials) - 1; index >= 0; index-- {
		credential := state.Credentials[index]
		if credential.State != "validated" {
			continue
		}
		if resolver.DNSCredentialID != "" && credential.ID == resolver.DNSCredentialID || resolver.DNSCredentialID == "" && credential.Provider == resolver.Provider {
			return nil
		}
	}
	return fmt.Errorf("DNS-01 route requires a validated provider credential")
}

func (c *ControlPlane) applyRoutePlan(ctx context.Context, plan RoutePlan, options ...routingApplyOptions) error {
	var option routingApplyOptions
	if len(options) > 0 {
		option = options[0]
	}
	adapter, err := c.traefikMachineAdapter()
	if err != nil {
		return err
	}
	settingsState, err := c.Routing.Snapshot(c.ServerID)
	if err != nil {
		return err
	}
	if plan.RestartRequired {
		settings := settingsState.Settings
		updated := false
		for index := range settings.EntryPoints {
			if settings.EntryPoints[index].Name == plan.EntryPoint.Name {
				if plan.EntryPoint.Public && !settings.EntryPoints[index].Public {
					settings.EntryPoints[index].Public = true
					updated = true
				}
			}
		}
		if !updated {
			settings.EntryPoints = append(settings.EntryPoints, plan.EntryPoint)
		}
		if err := c.Routing.PutSettings(c.ServerID, settings); err != nil {
			return err
		}
		if err := c.ReconcileTraefik(ctx, "system", "route-entrypoint-"+plan.Route.Key, "DEPLOY_TRAEFIK"); err != nil {
			return err
		}
	}
	// Desired state is sealed before the remote reconciliation. If the machine
	// call fails, a later drift reconciliation has an exact target to converge.
	if err := c.Routing.PutRoute(c.ServerID, plan.Route); err != nil {
		return err
	}
	serviceID, traefikID, err := c.routeServiceIDs(ctx, plan.Route.ServiceKey)
	if err != nil {
		return err
	}
	request := agentcontrol.RoutingReconcileRequest{
		Network:           plan.Network,
		Route:             routeAgentContract(plan.Route),
		ServiceID:         serviceID,
		TraefikServiceID:  traefikID,
		Version:           agentcontrol.RoutingVersion,
		AddNetworks:       option.AddNetworks,
		RemoveDirectPorts: option.RemoveDirectPorts,
		RemoveNetworks:    option.RemoveNetworks,
	}
	if len(option.RestorePublishedPorts) > 0 {
		request.RestorePublishedPorts = option.RestorePublishedPorts
	}
	if err := adapter.ReconcileRouting(ctx, request); err != nil {
		_ = c.Routing.PutRuntime(c.ServerID, RouteRuntime{Errors: []string{"machine reconciliation did not complete"}, ObservedAt: time.Now().UTC(), Protocol: plan.Route.Protocol, RouteKey: plan.Route.Key, State: "drift", Version: RoutingSchemaVersion})
		return err
	}
	return c.RefreshTraefikRuntime(ctx)
}

func (c *ControlPlane) DeclareServiceRouteRole(actor, requestID string, declaration ServiceRouteDeclaration) error {
	if !c.Mutations {
		return fmt.Errorf("cluster mutations are disabled")
	}
	if err := c.requireAudit(); err != nil {
		return err
	}
	declaration = declaration.Normalize()
	err := c.Routing.PutDeclaration(c.ServerID, declaration)
	c.record(actor, requestID, "traefik.service-role", "service/"+declaration.ServiceKey, err, map[string]string{"role": string(declaration.Role)})
	return err
}

func (c *ControlPlane) ApplyDependencyBinding(ctx context.Context, actor, requestID string, binding DependencyBinding) error {
	if !c.Mutations {
		return fmt.Errorf("cluster mutations are disabled")
	}
	if err := c.requireAudit(); err != nil {
		return err
	}
	binding = binding.Normalize()
	if err := binding.Validate(); err != nil {
		return err
	}
	state, err := c.Routing.Snapshot(c.ServerID)
	if err != nil {
		return err
	}
	var route RouteSpec
	found := false
	for _, candidate := range state.Routes {
		if candidate.Key == binding.TargetRoute {
			route, found = candidate, true
			break
		}
	}
	alias, endpoint := "", ""
	if found {
		if !route.Enabled || (route.Scope != RouteInternal && route.Scope != RouteBoth) {
			return fmt.Errorf("dependency target must be an enabled internal or both-scope route")
		}
		alias = route.Key + ".swarmops.internal"
		endpoint = dependencyEndpoint(route, alias)
	} else {
		switch binding.TargetRoute {
		case platformSwarmOpsMetricsRoute:
			alias = "swarmops-control.swarmops.internal"
			endpoint = "http://" + alias + ":8081/metrics"
		case platformTraefikMetricsRoute:
			alias = "traefik-metrics.swarmops.internal"
			endpoint = "http://" + alias + ":8082/metrics"
		default:
			return fmt.Errorf("dependency target must be an enabled internal or both-scope route")
		}
	}
	callerID, traefikID, err := c.routeServiceIDs(ctx, binding.CallerService)
	if err != nil {
		return err
	}
	adapter, err := c.traefikMachineAdapter()
	if err != nil {
		return err
	}
	secretName := ""
	if binding.Delivery == DependencySecretFile {
		sum := sha256.Sum256([]byte(binding.CallerService + "|" + binding.TargetRoute + "|" + binding.Name))
		secretName = "swarmops_binding_" + hex.EncodeToString(sum[:8]) + "_v1"
	}
	if err := c.Routing.PutBinding(c.ServerID, binding); err != nil {
		return err
	}
	network := RouteNetworkName(binding.CallerService)
	if role, _ := platformServiceRole(binding.CallerService); role == ServiceRolePlatformException {
		network = "swarmops"
	}
	err = adapter.BindRouting(ctx, agentcontrol.RoutingBindingRequest{
		Alias:            alias,
		CallerServiceID:  callerID,
		Delivery:         string(binding.Delivery),
		Endpoint:         endpoint,
		Name:             binding.Name,
		Network:          network,
		SecretName:       secretName,
		TraefikServiceID: traefikID,
		Version:          agentcontrol.RoutingVersion,
	})
	c.record(actor, requestID, "traefik.binding.apply", "binding/"+binding.CallerService+"/"+binding.TargetRoute, err, map[string]string{"delivery": string(binding.Delivery), "name": binding.Name})
	return err
}

func (c *ControlPlane) ApplyTraefikSettings(ctx context.Context, actor, requestID string, settings TraefikSettings, confirmation string) error {
	if !c.Mutations {
		return fmt.Errorf("cluster mutations are disabled")
	}
	if err := c.requireAudit(); err != nil {
		return err
	}
	if confirmation != "RESTART_SINGLETON_TRAEFIK" {
		return fmt.Errorf("static Traefik settings require confirmation RESTART_SINGLETON_TRAEFIK")
	}
	settings = settings.Normalize()
	err := c.Routing.PutSettings(c.ServerID, settings)
	if err == nil {
		err = c.ReconcileTraefik(ctx, actor, requestID, "DEPLOY_TRAEFIK")
	}
	c.record(actor, requestID, "traefik.settings.apply", "stack/traefik", err, map[string]string{"access_logs": strconv.FormatBool(settings.AccessLogs), "log_level": settings.OperationalLog})
	return err
}

func (c *ControlPlane) InstallDNSCredential(ctx context.Context, actor, requestID, id, name string, provider DNSProvider, input io.Reader) (DNSCredentialMetadata, error) {
	if !c.Mutations {
		return DNSCredentialMetadata{}, fmt.Errorf("cluster mutations are disabled")
	}
	if err := c.requireAudit(); err != nil {
		return DNSCredentialMetadata{}, err
	}
	if err := c.requireRouting(); err != nil {
		return DNSCredentialMetadata{}, err
	}
	id = strings.ToLower(strings.TrimSpace(id))
	name = strings.TrimSpace(name)
	if !providerIDPattern.MatchString(id) || name == "" || len(name) > 96 || (provider != DNSProviderCloudflare && provider != DNSProviderArvan) {
		return DNSCredentialMetadata{}, fmt.Errorf("DNS credential metadata is invalid")
	}
	value, err := io.ReadAll(io.LimitReader(input, 513))
	if err != nil || len(value) > 512 {
		return DNSCredentialMetadata{}, fmt.Errorf("DNS credential input is invalid")
	}
	defer func() {
		for index := range value {
			value[index] = 0
		}
	}()
	secret := strings.TrimSpace(string(value))
	if provider == DNSProviderArvan {
		secret = strings.TrimSpace(strings.TrimPrefix(secret, "Apikey "))
	}
	if len(secret) < 16 || len(secret) > 512 || strings.ContainsAny(secret, "\r\n\x00 \t") {
		for index := range value {
			value[index] = 0
		}
		return DNSCredentialMetadata{}, fmt.Errorf("DNS credential input is invalid")
	}
	if c.DNSProviders == nil {
		return DNSCredentialMetadata{}, fmt.Errorf("DNS provider adapter is not configured")
	}
	probe := DNSCredentialMetadata{ID: id, Name: name, Provider: provider, Version: 1}
	err = c.DNSProviders.ValidateCredential(ctx, probe, secret)
	if err != nil {
		for index := range value {
			value[index] = 0
		}
		secret = ""
		c.record(actor, requestID, "traefik.dns-credential.rotate", "dns-credential/"+id, err, map[string]string{"provider": string(provider)})
		return DNSCredentialMetadata{}, err
	}
	metadata, err := c.Routing.RotateCredential(c.ServerID, id, name, provider, []byte(secret))
	for index := range value {
		value[index] = 0
	}
	secret = ""
	if err == nil {
		_, sealedSecret, secretErr := c.Routing.CredentialSecret(c.ServerID, metadata.ID, metadata.Version)
		if secretErr != nil {
			err = secretErr
		} else {
			_, err = c.CLI.RunInput(ctx, strings.NewReader(sealedSecret), "secret", "create", metadata.SecretName, "-")
			sealedSecret = ""
		}
	}
	if err == nil {
		err = c.Routing.MarkCredentialValidated(c.ServerID, metadata.ID, metadata.Version)
	}
	if err == nil {
		// Rendering the singleton with the latest immutable secret is the switch
		// step. Prior versions remain in both controller custody and Swarm.
		err = c.ReconcileTraefik(ctx, actor, requestID, "DEPLOY_TRAEFIK")
	}
	if err == nil {
		state, snapshotErr := c.Routing.Snapshot(c.ServerID)
		if snapshotErr == nil {
			for _, candidate := range state.Credentials {
				if candidate.ID == metadata.ID && candidate.Version == metadata.Version {
					metadata = candidate
				}
			}
		}
	}
	c.record(actor, requestID, "traefik.dns-credential.rotate", "dns-credential/"+id, err, map[string]string{"provider": string(provider), "version": strconv.Itoa(metadata.Version)})
	return metadata, err
}

func DNSCredentialRemovalConfirmation(id string, version int) string {
	value := strings.ToUpper(strings.Map(func(r rune) rune {
		if r >= 'A' && r <= 'Z' || r >= '0' && r <= '9' || r == '_' {
			return r
		}
		if r >= 'a' && r <= 'z' {
			return r - ('a' - 'A')
		}
		return '_'
	}, strings.TrimSpace(id)))
	return fmt.Sprintf("REMOVE_DNS_CREDENTIAL_%s_V%d", value, version)
}

// RemoveDNSCredentialVersion removes only an older immutable provider secret.
// Rotation must already have validated and switched Traefik to a newer version.
func (c *ControlPlane) RemoveDNSCredentialVersion(ctx context.Context, actor, requestID, id string, version int, confirmation string) error {
	if !c.Mutations {
		return fmt.Errorf("cluster mutations are disabled")
	}
	if err := c.requireAudit(); err != nil {
		return err
	}
	id = strings.ToLower(strings.TrimSpace(id))
	if confirmation != DNSCredentialRemovalConfirmation(id, version) {
		return fmt.Errorf("DNS credential removal requires confirmation %s", DNSCredentialRemovalConfirmation(id, version))
	}
	metadata, _, err := c.Routing.CredentialSecret(c.ServerID, id, version)
	if err != nil {
		return err
	}
	state, err := c.Routing.Snapshot(c.ServerID)
	if err != nil {
		return err
	}
	latest := 0
	for _, candidate := range state.Credentials {
		if candidate.ID == id && candidate.State != "removed" && candidate.Version > latest {
			latest = candidate.Version
		}
	}
	if version >= latest {
		return fmt.Errorf("latest DNS credential version cannot be removed")
	}
	_, err = c.CLI.Run(ctx, "secret", "rm", metadata.SecretName)
	if err == nil {
		err = c.Routing.RemoveCredentialVersion(c.ServerID, id, version)
	}
	c.record(actor, requestID, "traefik.dns-credential.remove", "dns-credential/"+id, err, credentialVersionDetail(metadata))
	return err
}

func (c *ControlPlane) RefreshTraefikRuntime(ctx context.Context) error {
	if err := c.requireRouting(); err != nil {
		return err
	}
	adapter, err := c.traefikMachineAdapter()
	if err != nil {
		return err
	}
	snapshot, err := adapter.TraefikRuntime(ctx)
	if err != nil {
		return err
	}
	state, err := c.Routing.Snapshot(c.ServerID)
	if err != nil {
		return err
	}
	for _, route := range state.Routes {
		observed := RouteRuntime{ObservedAt: snapshot.ObservedAt, Protocol: route.Protocol, RouteKey: route.Key, State: "missing", Version: RoutingSchemaVersion}
		prefix := routeRouterName(route)
		for _, runtime := range snapshot.Routes {
			name := strings.TrimSuffix(runtime.Name, "@swarm")
			if !strings.HasPrefix(name, prefix) {
				continue
			}
			observed.EntryPoints = append([]string(nil), runtime.EntryPoints...)
			observed.Errors = append([]string(nil), runtime.Errors...)
			observed.Router = runtime.Name
			observed.Service = runtime.Service
			observed.State = strings.ToLower(runtime.Status)
			if observed.State == "" || observed.State == "success" {
				observed.State = "enabled"
			}
			break
		}
		if err := c.Routing.PutRuntime(c.ServerID, observed); err != nil {
			return err
		}
	}
	return nil
}

func (c *ControlPlane) TraefikLogs(ctx context.Context, filter TraefikLogFilter) ([]TraefikLogRecord, error) {
	filter = filter.Normalize(time.Now().UTC())
	if err := filter.Validate(time.Now().UTC()); err != nil {
		return nil, err
	}
	adapter, err := c.traefikMachineAdapter()
	if err != nil {
		return nil, err
	}
	entries, err := adapter.TraefikLogs(ctx, agentcontrol.TraefikLogQuery{From: filter.From, Level: filter.Level, Limit: filter.Limit, Live: filter.Live, RequestID: filter.RequestID, Router: filter.Router, Service: filter.Service, To: filter.To})
	if err != nil {
		return nil, err
	}
	result := make([]TraefikLogRecord, 0, len(entries))
	for _, entry := range entries {
		result = append(result, TraefikLogRecord{Client: entry.Client, Level: entry.Level, Message: entry.Message, Method: entry.Method, RequestID: entry.RequestID, Router: entry.Router, Service: entry.Service, StatusCode: entry.StatusCode, Timestamp: entry.Timestamp})
	}
	return result, nil
}

func (c *ControlPlane) TraefikPrometheusStatus(ctx context.Context) (PrometheusStatus, error) {
	adapter, err := c.traefikMachineAdapter()
	if err != nil {
		return PrometheusStatus{}, err
	}
	snapshot, err := adapter.PrometheusTraefik(ctx)
	if err != nil {
		return PrometheusStatus{}, err
	}
	status := PrometheusStatus{Collected: len(snapshot.Targets) > 0, Observed: snapshot.ObservedAt, Targets: []PrometheusTargetStatus{}}
	for _, target := range snapshot.Targets {
		status.Targets = append(status.Targets, PrometheusTargetStatus{Error: target.Error, Health: target.Health, Labels: append([]string(nil), target.Labels...), LastScrape: target.LastScrape, Target: target.Target})
	}
	return status, nil
}

func (c *ControlPlane) PlanClusterCutover(ctx context.Context) (CutoverPlan, error) {
	rows, err := c.RouteInventory(ctx)
	if err != nil {
		return CutoverPlan{}, err
	}
	services, err := c.Services(ctx)
	if err != nil {
		return CutoverPlan{}, err
	}
	rawServices, err := c.Docker.ListServices(ctx)
	if err != nil {
		return CutoverPlan{}, err
	}
	serviceByName := map[string]dockerapi.Service{}
	for _, service := range rawServices {
		if service.Spec.Name != "" {
			serviceByName[service.Spec.Name] = service
		}
	}
	health := map[string]domain.Health{}
	for _, service := range services {
		health[service.Name] = service.Health
	}
	state, err := c.Routing.Snapshot(c.ServerID)
	if err != nil {
		return CutoverPlan{}, err
	}
	bindings := map[string][]string{}
	for _, binding := range state.Bindings {
		bindings[binding.CallerService] = append(bindings[binding.CallerService], binding.TargetRoute)
	}
	plan := CutoverPlan{
		GeneratedAt: time.Now().UTC(),
		Phases:      []string{"seal rollback and static settings", "provision isolated networks and routes", "validate DNS and certificates", "remove direct bypasses", "verify runtime, isolation, metrics, and logs"},
		Version:     RoutingSchemaVersion,
	}
	for _, row := range rows {
		entry := CutoverService{Bindings: sortedUnique(bindings[row.Route.ServiceKey]), Healthy: health[row.Route.ServiceKey] == domain.HealthHealthy, Role: string(row.Declaration.Role), ServiceKey: row.Route.ServiceKey}
		service, hasService := serviceByName[row.Route.ServiceKey]
		if hasService {
			entry.DirectPorts = routePublishedPorts(service)
			entry.LegacyNetworks = routeLegacyNetworks(service, row.Route.ServiceKey)
		}
		if row.Route.Key != "" {
			entry.Routes = []string{row.Route.Key}
		}
		if row.Declaration.Role == ServiceRoleNeedsConfiguration || row.Declaration.Role == "" {
			entry.Blockers = append(entry.Blockers, "service role is not declared")
		}
		if row.Declaration.Role == ServiceRoleRouted && (!row.Route.Enabled || row.Route.Key == "") {
			entry.Blockers = append(entry.Blockers, "routed service has no enabled route")
		}
		if row.Declaration.Role != ServiceRolePlatformException && len(entry.DirectPorts) > 0 {
			entry.Blockers = append(entry.Blockers, "service exposes direct published ports")
		}
		if row.Declaration.Role != ServiceRolePlatformException && len(entry.LegacyNetworks) > 0 {
			entry.Blockers = append(entry.Blockers, "service keeps legacy network attachments")
		}
		if row.Declaration.Role != ServiceRolePlatformException && !entry.Healthy {
			entry.Blockers = append(entry.Blockers, "service tasks are not healthy")
		}
		if row.Status == "drift" || row.Status == "service-missing" {
			entry.Blockers = append(entry.Blockers, "route runtime does not match desired state")
		}
		for _, blocker := range entry.Blockers {
			plan.Blockers = append(plan.Blockers, entry.ServiceKey+": "+blocker)
		}
		plan.Services = append(plan.Services, entry)
	}
	plan.Blockers = sortedUnique(plan.Blockers)
	plan.Ready = len(plan.Blockers) == 0 && len(plan.Services) > 0
	_ = c.Routing.PutCutover(c.ServerID, plan)
	return plan, nil
}

func (c *ControlPlane) captureCutoverRollback(ctx context.Context, routes []RouteSpec) (CutoverRollbackPlan, error) {
	services, err := c.Docker.ListServices(ctx)
	if err != nil {
		return CutoverRollbackPlan{}, err
	}
	index := make(map[string]dockerapi.Service, len(services))
	for _, service := range services {
		if service.Spec.Name == "" {
			continue
		}
		index[service.Spec.Name] = service
	}
	rollback := CutoverRollbackPlan{GeneratedAt: time.Now().UTC(), Version: RoutingSchemaVersion}
	seen := map[string]bool{}
	for _, route := range routes {
		if !route.Enabled {
			continue
		}
		service, found := index[route.ServiceKey]
		if !found {
			continue
		}
		if seen[route.ServiceKey] {
			continue
		}
		seen[route.ServiceKey] = true
		networks := routeLegacyNetworks(service, route.ServiceKey)
		rollback.Services = append(rollback.Services, CutoverServiceRollback{
			Networks:       networks,
			PublishedPorts: routePublishedPortsWithProtocol(service),
			ServiceKey:     route.ServiceKey,
		})
	}
	return rollback, nil
}

func routeApplyConfirmation(route RouteSpec, restartRequired bool) string {
	return strings.Join(routeApplyConfirmations(route, restartRequired), " + ")
}

func routeApplyConfirmations(route RouteSpec, restartRequired bool) []string {
	required := make([]string, 0, 2)
	if route.Sensitive && route.Enabled && routeIsPublic(route.Scope) {
		required = append(required, SensitivePublishConfirmation(route.ServiceKey))
	}
	if restartRequired {
		required = append(required, "RESTART_SINGLETON_TRAEFIK")
	}
	return required
}

func routePublishedPorts(service dockerapi.Service) []uint16 {
	ports := map[uint16]bool{}
	add := func(value uint16) {
		if value > 0 {
			ports[value] = true
		}
	}
	for _, port := range service.Endpoint.Ports {
		add(port.PublishedPort)
	}
	for _, port := range service.Spec.EndpointSpec.Ports {
		add(port.PublishedPort)
	}
	result := make([]uint16, 0, len(ports))
	for port := range ports {
		result = append(result, port)
	}
	sort.Slice(result, func(left, right int) bool { return result[left] < result[right] })
	return result
}

func routePublishedPortsWithProtocol(service dockerapi.Service) []CutoverPublishedPort {
	ports := map[string]CutoverPublishedPort{}
	add := func(protocol string, published, target uint16) {
		if published == 0 || target == 0 {
			return
		}
		key := strings.ToLower(protocol) + "/" + strconv.Itoa(int(published)) + "/" + strconv.Itoa(int(target))
		ports[key] = CutoverPublishedPort{
			Protocol:      strings.ToLower(protocol),
			PublishedPort: published,
			TargetPort:    target,
		}
	}
	for _, port := range service.Endpoint.Ports {
		add(strings.ToLower(port.Protocol), port.PublishedPort, port.TargetPort)
	}
	for _, port := range service.Spec.EndpointSpec.Ports {
		add(strings.ToLower(port.Protocol), port.PublishedPort, port.TargetPort)
	}
	result := make([]CutoverPublishedPort, 0, len(ports))
	for _, value := range ports {
		result = append(result, value)
	}
	sort.Slice(result, func(left, right int) bool {
		leftValue := result[left]
		rightValue := result[right]
		if leftValue.Protocol != rightValue.Protocol {
			return leftValue.Protocol < rightValue.Protocol
		}
		if leftValue.PublishedPort != rightValue.PublishedPort {
			return leftValue.PublishedPort < rightValue.PublishedPort
		}
		return leftValue.TargetPort < rightValue.TargetPort
	})
	return result
}

func routeLegacyNetworks(service dockerapi.Service, serviceKey string) []string {
	blockerNetworks := map[string]bool{}
	routeNetwork := RouteNetworkName(serviceKey)
	for _, network := range service.Spec.TaskTemplate.Networks {
		candidate := strings.TrimSpace(network.Target)
		if candidate == "" || candidate == routeNetwork || candidate == "ingress" {
			continue
		}
		blockerNetworks[candidate] = true
	}
	result := make([]string, 0, len(blockerNetworks))
	for name := range blockerNetworks {
		result = append(result, name)
	}
	sort.Strings(result)
	return result
}

func (c *ControlPlane) ApplyClusterCutover(ctx context.Context, actor, requestID, confirmation string) error {
	if !c.Mutations {
		return fmt.Errorf("cluster mutations are disabled")
	}
	if err := c.requireAudit(); err != nil {
		return err
	}
	if confirmation != "CUTOVER_CLUSTER_THROUGH_TRAEFIK" {
		return fmt.Errorf("cluster cutover requires confirmation CUTOVER_CLUSTER_THROUGH_TRAEFIK")
	}
	plan, err := c.PlanClusterCutover(ctx)
	if err != nil {
		return err
	}
	if !plan.Ready {
		return fmt.Errorf("cluster cutover plan is blocked: %s", strings.Join(plan.Blockers, "; "))
	}
	state, err := c.Routing.Snapshot(c.ServerID)
	if err != nil {
		return err
	}
	rollback, err := c.captureCutoverRollback(ctx, state.Routes)
	if err != nil {
		return err
	}
	if err := c.Routing.PutCutoverRollback(c.ServerID, rollback); err != nil {
		return err
	}
	routes := append([]RouteSpec(nil), state.Routes...)
	sort.Slice(routes, func(left, right int) bool { return routes[left].Key < routes[right].Key })
	applied := []RouteSpec{}
	for _, route := range routes {
		if !route.Enabled {
			continue
		}
		routePlan, routeErr := c.PlanRoute(ctx, route)
		snapshot, hasSnapshot := rollbackService(rollback, route.ServiceKey)
		if routeErr == nil {
			options := routingApplyOptions{}
			if hasSnapshot {
				options.RemoveDirectPorts = true
				options.RemoveNetworks = snapshot.Networks
			}
			routeErr = c.applyRoutePlan(ctx, routePlan, options)
		}
		if routeErr != nil {
			_ = c.rollbackAppliedRoutes(ctx, applied, rollback)
			_ = c.Routing.ClearCutoverRollback(c.ServerID)
			c.record(actor, requestID, "traefik.cutover", "cluster/"+c.ServerID, routeErr, map[string]string{"phase": "routes"})
			return routeErr
		}
		applied = append(applied, route)
	}
	for _, binding := range state.Bindings {
		if err := c.ApplyDependencyBinding(ctx, actor, requestID, binding); err != nil {
			_ = c.rollbackAppliedRoutes(ctx, applied, rollback)
			c.record(actor, requestID, "traefik.cutover", "cluster/"+c.ServerID, err, map[string]string{"phase": "bindings"})
			return err
		}
	}
	if err := c.RefreshTraefikRuntime(ctx); err == nil {
		_, err = c.TraefikPrometheusStatus(ctx)
	}
	if err != nil {
		_ = c.rollbackAppliedRoutes(ctx, applied, rollback)
		_ = c.Routing.ClearCutoverRollback(c.ServerID)
	}
	if err == nil {
		_ = c.Routing.ClearCutoverRollback(c.ServerID)
	}
	c.record(actor, requestID, "traefik.cutover", "cluster/"+c.ServerID, err, map[string]string{"phase": "verification"})
	return err
}

func (c *ControlPlane) rollbackAppliedRoutes(ctx context.Context, routes []RouteSpec, rollback CutoverRollbackPlan) error {
	rollbackByService := map[string]CutoverServiceRollback{}
	for _, service := range rollback.Services {
		rollbackByService[service.ServiceKey] = service
	}
	for index := len(routes) - 1; index >= 0; index-- {
		route := routes[index]
		route.Enabled = false
		plan, err := c.PlanRoute(ctx, route)
		if err == nil {
			options := routingApplyOptions{}
			if snapshot, found := rollbackByService[route.ServiceKey]; found {
				options.AddNetworks = snapshot.Networks
				options.RestorePublishedPorts = toRoutingPublishedPorts(snapshot.PublishedPorts)
			}
			if err := c.applyRoutePlan(ctx, plan, options); err != nil {
				return err
			}
		}
	}
	return nil
}

func toRoutingPublishedPorts(values []CutoverPublishedPort) []agentcontrol.RoutingPublishedPort {
	ports := make([]agentcontrol.RoutingPublishedPort, 0, len(values))
	for _, value := range values {
		ports = append(ports, agentcontrol.RoutingPublishedPort{
			Protocol:      value.Protocol,
			PublishedPort: value.PublishedPort,
			TargetPort:    value.TargetPort,
		})
	}
	return ports
}

func rollbackService(plan CutoverRollbackPlan, serviceKey string) (CutoverServiceRollback, bool) {
	for _, value := range plan.Services {
		if value.ServiceKey == serviceKey {
			return value, true
		}
	}
	return CutoverServiceRollback{}, false
}

func (c *ControlPlane) requireRouting() error {
	if c == nil || c.Routing == nil || !validClusterID(c.ServerID) {
		return fmt.Errorf("Traefik routing control plane is not configured")
	}
	return nil
}

func (c *ControlPlane) traefikMachineAdapter() (TraefikMachineAdapter, error) {
	if c.CLI.Runner == nil {
		return nil, fmt.Errorf("Traefik machine adapter is not configured")
	}
	adapter, ok := c.CLI.Runner.(TraefikMachineAdapter)
	if !ok {
		return nil, fmt.Errorf("selected manager requires the fixed Traefik machine adapter")
	}
	return adapter, nil
}

func (c *ControlPlane) routeServiceIDs(ctx context.Context, serviceKey string) (string, string, error) {
	services, err := c.Docker.ListServices(ctx)
	if err != nil {
		return "", "", err
	}
	serviceID, traefikID := "", ""
	for _, service := range services {
		if service.Spec.Name == serviceKey || service.ID == serviceKey {
			serviceID = service.ID
		}
		if service.Spec.Name == traefikServiceName {
			traefikID = service.ID
		}
	}
	if serviceID == "" {
		return "", "", fmt.Errorf("route service was not found")
	}
	if traefikID == "" {
		return "", "", fmt.Errorf("Traefik singleton service was not found")
	}
	return serviceID, traefikID, nil
}

func serviceExists(ctx context.Context, client *dockerapi.Client, serviceKey string) bool {
	if client == nil || !validServiceKey(serviceKey) {
		return false
	}
	services, err := client.ListServices(ctx)
	if err != nil {
		return false
	}
	for _, service := range services {
		if service.ID == serviceKey || service.Spec.Name == serviceKey {
			return true
		}
	}
	return false
}

func disabledRouteTemplate(service dockerapi.Service) RouteSpec {
	port := uint16(0)
	for key, value := range service.Spec.Labels {
		if strings.Contains(key, ".loadbalancer.server.port") {
			parsed, _ := strconv.ParseUint(value, 10, 16)
			port = uint16(parsed)
			break
		}
	}
	return RouteSpec{AccessLogs: true, Enabled: false, Health: RouteHealthProof{Kind: "response", Path: "/", TimeoutSeconds: 5}, Key: defaultRouteKey(service.Spec.Name), Match: RouteMatch{PathPrefix: "/"}, Metrics: true, Protocol: RouteHTTP, Scope: RouteInternal, ServiceKey: service.Spec.Name, TLS: RouteTLSOff, TargetPort: port, Version: RoutingSchemaVersion}
}

func defaultRouteKey(service string) string {
	value := strings.ToLower(service)
	value = strings.Map(func(r rune) rune {
		if r >= 'a' && r <= 'z' || r >= '0' && r <= '9' || r == '-' {
			return r
		}
		return '-'
	}, value)
	value = strings.Trim(value, "-")
	if value == "" || value[0] < 'a' || value[0] > 'z' {
		value = "service-" + value
	}
	if len(value) > 63 {
		value = value[:63]
	}
	return value
}

func platformServiceRole(service string) (ServiceRouteRole, string) {
	switch service {
	case traefikServiceName:
		return ServiceRolePlatformException, "Traefik self-management and its internal API cannot depend on a Traefik route."
	case "swarmops_swarmops", "swarmops-agent_agent":
		return ServiceRolePlatformException, "Controller and machine-agent management traffic remains an explicit platform exception."
	default:
		return ServiceRoleNeedsConfiguration, ""
	}
}

func staticEntryPointFor(route RouteSpec) StaticEntryPoint {
	if route.Protocol == RouteHTTP {
		name := "internal-http"
		port := uint16(8081)
		public := false
		if route.Scope != RouteInternal {
			public = true
			if route.TLS == RouteTLSOff {
				name, port = "web", 80
			} else {
				name, port = "websecure", 443
			}
		}
		return StaticEntryPoint{Name: name, Port: port, Protocol: RouteHTTP, Public: public}
	}
	return StaticEntryPoint{Name: string(route.Protocol) + "-" + strconv.Itoa(int(route.ListenPort)), Port: route.ListenPort, Protocol: route.Protocol, Public: routeIsPublic(route.Scope)}
}

func dependencyEndpoint(route RouteSpec, alias string) string {
	switch route.Protocol {
	case RouteHTTP:
		path := route.Match.PathPrefix
		if path == "" {
			path = "/"
		}
		return "http://" + alias + ":8081" + path
	default:
		return alias + ":" + strconv.Itoa(int(route.ListenPort))
	}
}

func sortedUnique(values []string) []string {
	seen := map[string]bool{}
	result := make([]string, 0, len(values))
	for _, value := range values {
		if value != "" && !seen[value] {
			seen[value] = true
			result = append(result, value)
		}
	}
	sort.Strings(result)
	return result
}
