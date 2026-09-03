package ops

import (
	"context"
	"fmt"
	"net"
	"net/netip"
	"strings"

	"github.com/nimasrn/SwarmOps/internal/dockerapi"
)

// Publishing the console is the one route SwarmOps points at ITSELF, and it
// was the one route an operator could not create from the console. Every
// application reached its hostname through Traffic — accept the zone, create
// the record, assign the route — while the controller serving those screens
// kept whatever name was typed into SWARMOPS_HOST at stack-deploy time and
// could not be moved without redeploying it by hand.
//
// The operator chooses a name under a zone this gateway already accepted.
// Everything the publication order requires after that — the A record, the
// certificate resolver, the public route, the DNS proof before the route goes
// live — is derived here from state that already exists. Nothing about this
// path is a second routing mechanism: it plans and applies exactly the same
// RouteSpec every other service gets, so a published console appears in
// Traffic → Routes, carries a certificate, and is withdrawn the same way.
const (
	CoreConsoleRouteKey = "swarmops-console"
	CoreConsoleRecordID = "swarmops-console"
	// The port the reviewed controller stack serves on, and the port its own
	// healthcheck and Traefik labels already name. This path publishes that
	// stack's service or nothing at all, so it is a constant rather than a
	// value read from a browser.
	coreConsoleTargetPort   = 8084
	coreConsoleHealthPath   = "/healthz"
	coreConsoleDefaultLabel = "swarmops"
)

// CoreConsoleCredential is the non-secret provider credential identity the
// console offers for the record. It carries no value and no version history.
type CoreConsoleCredential struct {
	ID       string      `json:"id"`
	Name     string      `json:"name"`
	Provider DNSProvider `json:"provider"`
}

// CoreConsoleRequest is the whole browser-facing shape of publishing the
// console: a zone that was already accepted, the name under it, and the
// credential that owns the zone. Address is optional and exists only for the
// gateway whose advertised manager address is not the address the world
// reaches it on; when it is empty SwarmOps derives one.
type CoreConsoleRequest struct {
	Address      string `json:"address,omitempty"`
	Adopt        bool   `json:"adopt"`
	Confirmation string `json:"confirmation"`
	CredentialID string `json:"credentialId"`
	Label        string `json:"label"`
	Zone         string `json:"zone"`
}

func (r CoreConsoleRequest) Normalize() CoreConsoleRequest {
	r.Address = strings.TrimSpace(r.Address)
	r.Confirmation = strings.TrimSpace(r.Confirmation)
	r.CredentialID = strings.ToLower(strings.TrimSpace(r.CredentialID))
	r.Label = strings.ToLower(strings.Trim(strings.TrimSpace(r.Label), "."))
	r.Zone = strings.ToLower(strings.TrimSuffix(strings.TrimSpace(r.Zone), "."))
	return r
}

// Host is the name the console will answer on. An empty label publishes the
// apex, which is a deliberate choice rather than an accident of trimming.
func (r CoreConsoleRequest) Host() string {
	r = r.Normalize()
	if r.Label == "" {
		return r.Zone
	}
	return r.Label + "." + r.Zone
}

func (r CoreConsoleRequest) Validate() error {
	r = r.Normalize()
	if !safeHostname(r.Zone) {
		return fmt.Errorf("console domain zone is invalid")
	}
	if r.Label != "" && !safeHostname(r.Host()) {
		return fmt.Errorf("console hostname is invalid")
	}
	if !providerIDPattern.MatchString(r.CredentialID) {
		return fmt.Errorf("console domain requires a provider credential")
	}
	if r.Address != "" {
		if ip := net.ParseIP(r.Address); ip == nil || ip.To4() == nil {
			return fmt.Errorf("console gateway address must be an IPv4 address")
		}
	}
	return nil
}

// CoreConsoleStatus is what the Core screen reads before anything is chosen:
// where the console is published today, and what it could be published under.
// Blocked is the one field that explains a gateway this controller cannot be
// published through at all, so the screen states the reason rather than
// offering a control that would fail.
type CoreConsoleStatus struct {
	Address      string                  `json:"address,omitempty"`
	Blocked      string                  `json:"blocked,omitempty"`
	Confirmation string                  `json:"confirmation,omitempty"`
	Credentials  []CoreConsoleCredential `json:"credentials"`
	Host         string                  `json:"host,omitempty"`
	Label        string                  `json:"label"`
	Published    bool                    `json:"published"`
	Resolver     string                  `json:"resolver,omitempty"`
	ServiceKey   string                  `json:"serviceKey,omitempty"`
	URL          string                  `json:"url,omitempty"`
	Version      int                     `json:"version"`
	Zones        []string                `json:"zones"`
}

// CoreConsolePlan is the read before the write. It states the exact record and
// the exact route that publishing would create, including whether the
// controller's own task restarts to receive the route labels — which it does,
// and which an operator has to be told before they press the button.
type CoreConsolePlan struct {
	Address            string        `json:"address"`
	Confirmation       string        `json:"confirmation"`
	Host               string        `json:"host"`
	Record             DNSRecordSpec `json:"record"`
	RecordAction       string        `json:"recordAction"`
	Resolver           string        `json:"resolver"`
	RestartsController bool          `json:"restartsController"`
	Route              RouteSpec     `json:"route"`
	URL                string        `json:"url"`
	Version            int           `json:"version"`
	Warnings           []string      `json:"warnings"`
}

// CoreConsoleStatus never contacts a DNS provider. It reads sealed routing
// state and the cluster, so opening the screen costs nothing at a provider.
func (c *ControlPlane) CoreConsoleStatus(ctx context.Context) (CoreConsoleStatus, error) {
	if err := c.requireRouting(); err != nil {
		return CoreConsoleStatus{}, err
	}
	state, err := c.Routing.Snapshot(c.ServerID)
	if err != nil {
		return CoreConsoleStatus{}, err
	}
	status := CoreConsoleStatus{
		Credentials: coreConsoleCredentials(state),
		Label:       coreConsoleDefaultLabel,
		ServiceKey:  c.coreServiceKey(),
		Version:     RoutingSchemaVersion,
		Zones:       []string{},
	}
	for _, domain := range state.Domains {
		status.Zones = append(status.Zones, domain.Normalize().Zone)
	}
	for _, route := range state.Routes {
		if route.Key != CoreConsoleRouteKey || len(route.Match.Hosts) == 0 {
			continue
		}
		status.Host = route.Match.Hosts[0]
		status.Published = route.Enabled
		status.Resolver = route.Resolver
		status.URL = "https://" + status.Host + "/"
		if label := strings.TrimSuffix(status.Host, "."+zoneOf(status.Host, state.Domains)); label != status.Host {
			status.Label = label
		}
	}
	if record, found := coreConsoleRecord(state); found {
		status.Address = record.Content
	}
	if !serviceExists(ctx, c.Docker, status.ServiceKey) {
		status.Blocked = fmt.Sprintf("This controller does not run as the service %s on the selected cluster, so the gateway has nothing to route to. A host-native controller is published by the HTTPS reverse proxy in front of it, not by SwarmOps.", status.ServiceKey)
		return status, nil
	}
	if !serviceExists(ctx, c.Docker, traefikServiceName) {
		status.Blocked = "The Traefik singleton is not installed on the selected cluster. Install the gateway on Traffic → Gateway first."
		return status, nil
	}
	status.Confirmation = SensitivePublishConfirmation(status.ServiceKey)
	if status.Address == "" {
		if address, addressErr := c.coreConsoleEdgeAddress(ctx); addressErr == nil {
			status.Address = address
		}
	}
	return status, nil
}

// PlanCoreConsole reads the provider once and reports what publishing would
// do. It refuses everything the apply would refuse, so the screen never offers
// a confirmation for a change that cannot be made.
func (c *ControlPlane) PlanCoreConsole(ctx context.Context, requested CoreConsoleRequest) (CoreConsolePlan, error) {
	if err := c.requireRouting(); err != nil {
		return CoreConsolePlan{}, err
	}
	request := requested.Normalize()
	if err := request.Validate(); err != nil {
		return CoreConsolePlan{}, err
	}
	state, err := c.Routing.Snapshot(c.ServerID)
	if err != nil {
		return CoreConsolePlan{}, err
	}
	serviceKey := c.coreServiceKey()
	if !serviceExists(ctx, c.Docker, serviceKey) {
		return CoreConsolePlan{}, fmt.Errorf("this controller does not run as the service %s on the selected cluster; a host-native controller is published by the reverse proxy in front of it", serviceKey)
	}
	host := request.Host()
	if _, accepted := acceptedZone(state.Domains, host); !accepted {
		return CoreConsolePlan{}, fmt.Errorf("console hostname %q does not belong to an accepted gateway domain", host)
	}
	if existing, found := coreConsoleRecord(state); found && existing.Name != host {
		return CoreConsolePlan{}, fmt.Errorf("the console record already publishes %s; delete it on Traffic → DNS before moving the console to %s", existing.Name, host)
	}
	address := request.Address
	if address == "" {
		address, err = c.coreConsoleEdgeAddress(ctx)
		if err != nil {
			return CoreConsolePlan{}, err
		}
	}
	resolver, err := coreConsoleResolver(state, request.CredentialID)
	if err != nil {
		return CoreConsolePlan{}, err
	}
	record := coreConsoleRecordSpec(request, host, address)
	preview, err := c.PreviewDNSRecord(ctx, record, RouteHTTP)
	if err != nil {
		return CoreConsolePlan{}, err
	}
	route := coreConsoleRouteSpec(host, serviceKey, resolver)
	if err := route.Validate(); err != nil {
		return CoreConsolePlan{}, err
	}
	if err := validateRouteResolverCredential(route, state); err != nil {
		return CoreConsolePlan{}, err
	}
	plan := CoreConsolePlan{
		Address:            address,
		Confirmation:       SensitivePublishConfirmation(serviceKey),
		Host:               host,
		Record:             preview.Record,
		RecordAction:       preview.Action,
		Resolver:           resolver,
		RestartsController: true,
		Route:              route,
		URL:                "https://" + host + "/",
		Version:            RoutingSchemaVersion,
		Warnings:           append([]string{}, preview.Warnings...),
	}
	// The controller receives the route as Swarm labels on its own service, so
	// the task carrying this console is replaced to pick them up. Saying it
	// here is the difference between a planned reconnect and an operator
	// watching their console die mid-request.
	plan.Warnings = append(plan.Warnings, "Applying this replaces the controller task so it receives the route labels; the console is briefly unavailable and reconnects on the new name.")
	if preview.Existing != nil && preview.Action != "noop" && !request.Adopt {
		plan.Warnings = append(plan.Warnings, "A provider record already exists for this name and must be explicitly adopted.")
	}
	return plan, nil
}

// PublishCoreConsole runs the publication order in the only order that is
// safe: the record first, its propagation proved second, the route last. A
// route applied before the name resolves is a console that answers nowhere and
// an ACME order that fails.
func (c *ControlPlane) PublishCoreConsole(ctx context.Context, actor, requestID string, requested CoreConsoleRequest) error {
	if !c.Mutations {
		return fmt.Errorf("cluster mutations are disabled")
	}
	if err := c.requireAudit(); err != nil {
		return err
	}
	request := requested.Normalize()
	plan, err := c.PlanCoreConsole(ctx, request)
	if err != nil {
		c.record(actor, requestID, "core.console.publish", "route/"+CoreConsoleRouteKey, err, nil)
		return err
	}
	if request.Confirmation != plan.Confirmation {
		err = fmt.Errorf("publishing the console requires confirmation %s", plan.Confirmation)
		c.record(actor, requestID, "core.console.publish", "route/"+CoreConsoleRouteKey, err, nil)
		return err
	}
	if _, err = c.ApplyDNSRecord(ctx, actor, requestID, plan.Record, RouteHTTP); err != nil {
		return err
	}
	propagation, err := c.VerifyDNSRecord(ctx, plan.Record.ID)
	if err != nil {
		return err
	}
	if !propagation.Ready {
		// The record exists and is correct; only its visibility is pending.
		// Publishing again finishes the job, which is why this says so.
		err = fmt.Errorf("%s was created at the provider but is not yet visible on the public resolvers; publish again once it has propagated", plan.Host)
		c.record(actor, requestID, "core.console.publish", "route/"+CoreConsoleRouteKey, err, map[string]string{"host": plan.Host})
		return err
	}
	if err = c.ApplyRoute(ctx, actor, requestID, plan.Route, plan.Confirmation); err != nil {
		return err
	}
	c.record(actor, requestID, "core.console.publish", "route/"+CoreConsoleRouteKey, nil, map[string]string{
		"host":     plan.Host,
		"resolver": plan.Resolver,
		"service":  plan.Route.ServiceKey,
	})
	return nil
}

func (c *ControlPlane) coreServiceKey() string {
	if key := strings.TrimSpace(c.CoreService); key != "" {
		return key
	}
	return "swarmops_api"
}

// coreConsoleEdgeAddress is the address a public A record for this gateway has
// to point at: the machine the Traefik singleton is pinned to. Only a routable
// public address is returned — a swarm that advertises a private or NAT
// address cannot have one guessed for it, and says so instead.
func (c *ControlPlane) coreConsoleEdgeAddress(ctx context.Context) (string, error) {
	if c.Docker == nil {
		return "", fmt.Errorf("Docker API client is unavailable")
	}
	nodes, err := c.Docker.ListNodes(ctx)
	if err != nil {
		return "", fmt.Errorf("read gateway address: %w", err)
	}
	found := ""
	for _, node := range nodes {
		if node.Spec.Role != "manager" || node.Spec.Labels["nim.edge"] != "true" {
			continue
		}
		for _, candidate := range nodeAddresses(node) {
			found = candidate
			if address, err := netip.ParseAddr(candidate); err == nil && address.Is4() && address.IsGlobalUnicast() && !address.IsPrivate() {
				return candidate, nil
			}
		}
	}
	if found != "" {
		return "", fmt.Errorf("the Traefik edge manager advertises %s, which is not a public address; enter the address this gateway is reached on", found)
	}
	return "", fmt.Errorf("no Traefik edge manager with a known address was found on this cluster")
}

func nodeAddresses(node dockerapi.Node) []string {
	candidates := []string{node.Status.Addr}
	if node.ManagerStatus != nil {
		candidates = append(candidates, node.ManagerStatus.Addr)
	}
	addresses := make([]string, 0, len(candidates))
	for _, candidate := range candidates {
		value := strings.TrimSpace(candidate)
		if value == "" {
			continue
		}
		if host, _, err := net.SplitHostPort(value); err == nil {
			value = host
		}
		addresses = append(addresses, value)
	}
	return addresses
}

func coreConsoleRecordSpec(request CoreConsoleRequest, host, address string) DNSRecordSpec {
	return DNSRecordSpec{
		Adopted:      request.Adopt,
		Content:      address,
		CredentialID: request.CredentialID,
		ID:           CoreConsoleRecordID,
		Managed:      !request.Adopt,
		Name:         host,
		TTL:          300,
		Type:         DNSRecordA,
		Version:      RoutingSchemaVersion,
		Zone:         request.Zone,
	}.Normalize()
}

// coreConsoleRouteSpec is the console's route, and it is a route like any
// other. Sensitive is true because this hostname reaches the control plane
// itself, which is what makes the typed publication confirmation required.
func coreConsoleRouteSpec(host, serviceKey, resolver string) RouteSpec {
	return RouteSpec{
		AccessLogs:   true,
		DNSReference: CoreConsoleRecordID,
		Enabled:      true,
		Health:       RouteHealthProof{Kind: "response", Path: coreConsoleHealthPath, TimeoutSeconds: 5},
		Key:          CoreConsoleRouteKey,
		Managed:      true,
		Match:        RouteMatch{Hosts: []string{host}, PathPrefix: "/"},
		Metrics:      true,
		Protocol:     RouteHTTP,
		PublicAllow:  true,
		Resolver:     resolver,
		Scope:        RoutePublic,
		Sensitive:    true,
		ServiceKey:   serviceKey,
		TLS:          RouteTLSTerminate,
		TargetPort:   coreConsoleTargetPort,
		Version:      RoutingSchemaVersion,
	}.Normalize()
}

// coreConsoleResolver picks the certificate resolver that already matches the
// chosen credential. A resolver is never invented here: the console offers
// only what the sealed static settings already define.
func coreConsoleResolver(state RoutingState, credentialID string) (string, error) {
	provider := DNSProvider("")
	for _, credential := range state.Credentials {
		if credential.ID == credentialID && credential.State == "validated" {
			provider = credential.Provider
		}
	}
	if provider == "" {
		return "", fmt.Errorf("the selected provider credential has no validated version")
	}
	fallback := ""
	for _, resolver := range state.Settings.Resolvers {
		if resolver.Challenge != ChallengeDNS01 {
			continue
		}
		if resolver.DNSCredentialID == credentialID {
			return resolver.Name, nil
		}
		// A resolver pinned to a DIFFERENT credential is not a fallback for
		// this one: it would order the certificate with the wrong account.
		if fallback == "" && resolver.DNSCredentialID == "" && resolver.Provider == provider {
			fallback = resolver.Name
		}
	}
	if fallback == "" {
		return "", fmt.Errorf("no DNS-01 certificate resolver is configured for this credential's provider")
	}
	return fallback, nil
}

func coreConsoleCredentials(state RoutingState) []CoreConsoleCredential {
	seen := map[string]bool{}
	credentials := []CoreConsoleCredential{}
	for index := len(state.Credentials) - 1; index >= 0; index-- {
		credential := state.Credentials[index]
		if credential.State != "validated" || seen[credential.ID] {
			continue
		}
		seen[credential.ID] = true
		credentials = append(credentials, CoreConsoleCredential{ID: credential.ID, Name: credential.Name, Provider: credential.Provider})
	}
	return credentials
}

func coreConsoleRecord(state RoutingState) (DNSRecordSpec, bool) {
	for _, record := range state.DNSRecords {
		if record.ID == CoreConsoleRecordID {
			return record.Normalize(), true
		}
	}
	return DNSRecordSpec{}, false
}

func zoneOf(host string, domains []DomainSpec) string {
	domain, found := acceptedZone(domains, host)
	if !found {
		return ""
	}
	return domain.Zone
}
