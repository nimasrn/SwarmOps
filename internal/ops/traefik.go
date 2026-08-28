package ops

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net"
	"os"
	"regexp"
	"sort"
	"strings"

	"gopkg.in/yaml.v3"
)

// TraefikStackSettings contains only public settings and immutable Swarm
// secret/config names. Secret values never pass through this type.
type TraefikStackSettings struct {
	ACMEEmail              string
	ArvanDNSAvailable      bool
	ArvanAPIKeySecret      string
	CloudflareDNSAvailable bool
	CFDNSTokenSecret       string
	DashboardAuthSecret    string
	DashboardHost          string
	DynamicConfigName      string
	Image                  string
	Control                TraefikSettings
	Credentials            []DNSCredentialMetadata
	RouteNetworks          []string
	StaticConfigName       string
}

var dockerReferenceName = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$`)

// RenderTraefikStack resolves the small allow-list of trusted host settings
// before the stack crosses the machine API. It also replaces the source-tree-relative
// dynamic config reference with the immutable external Swarm config that was
// created during platform bootstrap.
func RenderTraefikStack(source []byte, settings TraefikStackSettings) ([]byte, error) {
	if err := settings.Validate(); err != nil {
		return nil, err
	}
	text := string(source)
	text = strings.NewReplacer(
		"${TRAEFIK_IMAGE:-traefik:v3.6.13}", settings.Image,
		"${TRAEFIK_ACME_EMAIL:?set TRAEFIK_ACME_EMAIL}", settings.ACMEEmail,
		"${TRAEFIK_DASHBOARD_HOST:-traefik.nim.zone}", settings.DashboardHost,
		"${TRAEFIK_DYNAMIC_CONFIG_NAME:-nim_traefik_dynamic_v1}", settings.DynamicConfigName,
		"${TRAEFIK_CF_DNS_TOKEN_SECRET:-traefik_cf_dns_token_v1}", settings.CFDNSTokenSecret,
		"${TRAEFIK_ARVAN_API_KEY_SECRET:-traefik_arvan_api_key_v1}", settings.ArvanAPIKeySecret,
		"${TRAEFIK_DASHBOARD_AUTH_SECRET:-traefik_dashboard_auth_v1}", settings.DashboardAuthSecret,
		"${TRAEFIK_STATIC_CONFIG_NAME:-swarmops_traefik_static_v1_0000000000000000}", settings.StaticConfigName,
	).Replace(text)
	if strings.Contains(text, "${") {
		return nil, fmt.Errorf("Traefik stack has an unresolved template expression")
	}
	var root map[string]any
	if err := yaml.Unmarshal([]byte(text), &root); err != nil {
		return nil, fmt.Errorf("parse trusted Traefik stack: %w", err)
	}
	configs, ok := asMap(root["configs"])
	if !ok {
		return nil, fmt.Errorf("trusted Traefik stack has no configs section")
	}
	dynamic, ok := asMap(configs["traefik_dynamic"])
	if !ok {
		return nil, fmt.Errorf("trusted Traefik stack has no traefik_dynamic config")
	}
	delete(dynamic, "file")
	dynamic["external"] = true
	dynamic["name"] = settings.DynamicConfigName
	if settings.Control.Version != 0 {
		if err := applyTypedTraefikStack(root, settings); err != nil {
			return nil, err
		}
	}
	rendered, err := yaml.Marshal(root)
	if err != nil {
		return nil, fmt.Errorf("serialize trusted Traefik stack: %w", err)
	}
	return rendered, nil
}

func (s TraefikStackSettings) Validate() error {
	if strings.TrimSpace(s.ACMEEmail) == "" || !strings.Contains(s.ACMEEmail, "@") || strings.ContainsAny(s.ACMEEmail, "\r\n\x00") {
		return fmt.Errorf("Traefik ACME email is not configured")
	}
	if !safeHostname(s.DashboardHost) {
		return fmt.Errorf("Traefik dashboard hostname is not configured")
	}
	if err := validateImage(s.Image); err != nil {
		return fmt.Errorf("Traefik image: %w", err)
	}
	for name, value := range map[string]string{
		"Traefik Arvan API-key secret":    s.ArvanAPIKeySecret,
		"Traefik Cloudflare token secret": s.CFDNSTokenSecret,
		"Traefik dashboard-auth secret":   s.DashboardAuthSecret,
		"Traefik dynamic config":          s.DynamicConfigName,
	} {
		if !dockerReferenceName.MatchString(strings.TrimSpace(value)) {
			return fmt.Errorf("%s name is invalid", name)
		}
	}
	if s.Control.Version != 0 {
		if err := s.Control.Validate(); err != nil {
			return err
		}
		if !regexp.MustCompile(`^swarmops_traefik_static_v1_[a-f0-9]{16}$`).MatchString(s.StaticConfigName) {
			return fmt.Errorf("Traefik static config name is invalid")
		}
		for _, network := range s.RouteNetworks {
			if !dockerReferenceName.MatchString(network) || !strings.HasPrefix(network, "swarmops-route-") {
				return fmt.Errorf("Traefik route network name is invalid")
			}
		}
	}
	return nil
}

func RenderTraefikStaticConfig(settings TraefikSettings) ([]byte, error) {
	settings = settings.Normalize()
	if err := settings.Validate(); err != nil {
		return nil, err
	}
	entryPoints := map[string]any{}
	for _, entry := range settings.EntryPoints {
		address := ":" + fmt.Sprint(entry.Port)
		if entry.Protocol == RouteUDP {
			address += "/udp"
		}
		entryPoints[entry.Name] = map[string]any{"address": address}
	}
	if web, ok := entryPoints["web"].(map[string]any); ok {
		web["http"] = map[string]any{"redirections": map[string]any{"entryPoint": map[string]any{"to": "websecure", "scheme": "https"}}}
	}
	resolvers := map[string]any{}
	for _, resolver := range settings.Resolvers {
		acme := map[string]any{
			"email":   settings.ACMEEmail,
			"storage": "/data/acme-" + resolver.Name + ".json",
		}
		switch resolver.Challenge {
		case ChallengeDNS01:
			provider := "cloudflare"
			if resolver.Provider == DNSProviderArvan {
				provider = "arvancloud"
			}
			acme["dnsChallenge"] = map[string]any{"provider": provider, "resolvers": []string{"1.1.1.1:53", "8.8.8.8:53"}}
		case ChallengeHTTP01:
			acme["httpChallenge"] = map[string]any{"entryPoint": "web"}
		case ChallengeTLSALPN01:
			acme["tlsChallenge"] = map[string]any{}
		}
		resolvers[resolver.Name] = map[string]any{"acme": acme}
	}
	root := map[string]any{
		"api":         map[string]any{"dashboard": true, "insecure": false},
		"entryPoints": entryPoints,
		"log":         map[string]any{"format": "json", "level": settings.OperationalLog},
		"metrics": map[string]any{"prometheus": map[string]any{
			"addEntryPointsLabels": true,
			"addRoutersLabels":     true,
			"addServicesLabels":    true,
			"entryPoint":           "metrics",
		}},
		"ping": map[string]any{"entryPoint": "metrics"},
		"providers": map[string]any{
			"file":  map[string]any{"filename": "/etc/traefik/dynamic.yml", "watch": true},
			"swarm": map[string]any{"endpoint": "unix:///var/run/docker.sock", "exposedByDefault": false, "watch": true},
		},
		"certificatesResolvers": resolvers,
	}
	if settings.AccessLogs {
		root["accessLog"] = map[string]any{"format": "json"}
	}
	data, err := yaml.Marshal(root)
	if err != nil {
		return nil, fmt.Errorf("render typed Traefik static config: %w", err)
	}
	return data, nil
}

func TraefikStaticConfigName(data []byte) string {
	sum := sha256.Sum256(data)
	return "swarmops_traefik_static_v1_" + hex.EncodeToString(sum[:8])
}

func applyTraefikChallengeFallback(settings *TraefikStackSettings, routes []RouteSpec, secretNames map[string]bool) error {
	latest := map[DNSProvider]DNSCredentialMetadata{}
	byID := map[string]DNSCredentialMetadata{}
	for _, credential := range settings.Credentials {
		if credential.State == "removed" || !secretNames[credential.SecretName] {
			continue
		}
		byID[credential.ID] = credential
		if credential.Version > latest[credential.Provider].Version {
			latest[credential.Provider] = credential
		}
	}
	settings.CloudflareDNSAvailable = secretNames[settings.CFDNSTokenSecret]
	settings.ArvanDNSAvailable = secretNames[settings.ArvanAPIKeySecret]
	if value := latest[DNSProviderCloudflare].SecretName; value != "" {
		settings.CFDNSTokenSecret = value
		settings.CloudflareDNSAvailable = true
	}
	if value := latest[DNSProviderArvan].SecretName; value != "" {
		settings.ArvanAPIKeySecret = value
		settings.ArvanDNSAvailable = true
	}

	for index := range settings.Control.Resolvers {
		resolver := &settings.Control.Resolvers[index]
		if resolver.Challenge != ChallengeDNS01 {
			continue
		}
		available := false
		if resolver.DNSCredentialID != "" {
			credential, found := byID[resolver.DNSCredentialID]
			available = found
			if found {
				resolver.Provider = credential.Provider
			}
		} else if resolver.Provider == DNSProviderArvan || resolver.Name == "arvan" {
			available = settings.ArvanDNSAvailable
			resolver.Provider = DNSProviderArvan
		} else {
			available = settings.CloudflareDNSAvailable
			resolver.Provider = DNSProviderCloudflare
		}
		if available {
			continue
		}
		for _, route := range routes {
			if route.Resolver == resolver.Name && containsWildcard(append(append([]string{}, route.Match.Hosts...), route.Match.SNI...)) {
				return fmt.Errorf("wildcard route %s requires a configured DNS-01 credential", route.Key)
			}
		}
		resolver.Challenge = ChallengeHTTP01
		resolver.DNSCredentialID = ""
		resolver.Provider = ""
	}
	return nil
}

func (c *ControlPlane) TraefikInstallPreflight(ctx context.Context) (TraefikInstallPreflight, error) {
	preflight := TraefikInstallPreflight{Checks: []TraefikInstallCheck{}, Ready: true}
	settings := c.TraefikSettings
	routes := []RouteSpec{}
	if c.Routing != nil && validClusterID(c.ServerID) {
		state, err := c.Routing.Snapshot(c.ServerID)
		if err != nil {
			return TraefikInstallPreflight{}, err
		}
		settings.ACMEEmail = state.Settings.ACMEEmail
		settings.Control = state.Settings
		settings.Credentials = append([]DNSCredentialMetadata(nil), state.Credentials...)
		routes = append(routes, state.Routes...)
	}

	networks, err := c.Docker.ListNetworks(ctx)
	if err != nil {
		return TraefikInstallPreflight{}, fmt.Errorf("inspect Traefik network prerequisite: %w", err)
	}
	nodes, err := c.Docker.ListNodes(ctx)
	if err != nil {
		return TraefikInstallPreflight{}, fmt.Errorf("inspect Traefik placement prerequisite: %w", err)
	}
	configs, err := c.Docker.ListConfigs(ctx)
	if err != nil {
		return TraefikInstallPreflight{}, fmt.Errorf("inspect Traefik config prerequisites: %w", err)
	}
	secrets, err := c.Docker.ListSecrets(ctx)
	if err != nil {
		return TraefikInstallPreflight{}, fmt.Errorf("inspect Traefik secret prerequisites: %w", err)
	}

	networkReady := false
	networkNameTaken := false
	for _, network := range networks {
		if network.Name == "traefik" {
			networkNameTaken = true
		}
		_, encrypted := network.Options["encrypted"]
		if network.Name == "traefik" && network.Driver == "overlay" && network.Scope == "swarm" && network.Attachable && encrypted {
			networkReady = true
			break
		}
	}
	appendTraefikCheck(&preflight, TraefikInstallCheck{
		Detail:   choose(networkReady, "External attachable Swarm overlay traefik is ready.", "No compatible external traefik overlay network exists."),
		Fixable:  !networkReady && !networkNameTaken,
		ID:       "edge-network",
		Label:    "External traefik network",
		Recovery: choose(networkReady, "", "Create an attachable encrypted overlay named traefik in Docker resources."),
		Required: true,
		State:    choose(networkReady, "ready", "blocked"),
	})

	edgeReady := false
	edgeCandidate := false
	for _, node := range nodes {
		if node.Spec.Role == "manager" && node.Spec.Availability == "active" && node.Status.State == "ready" {
			edgeCandidate = true
		}
		if node.Spec.Role == "manager" && node.Spec.Availability == "active" && node.Status.State == "ready" && node.Spec.Labels["nim.edge"] == "true" {
			edgeReady = true
			break
		}
	}
	appendTraefikCheck(&preflight, TraefikInstallCheck{
		Detail:   choose(edgeReady, "A ready active manager has nim.edge=true.", "No ready active manager has nim.edge=true, so the singleton has nowhere to run."),
		Fixable:  !edgeReady && edgeCandidate,
		ID:       "edge-placement",
		Label:    "Edge manager placement",
		Recovery: choose(edgeReady, "", "Open Swarm & placement and set nim.edge=true on the reviewed manager."),
		Required: true,
		State:    choose(edgeReady, "ready", "blocked"),
	})

	configNames := map[string]bool{}
	for _, config := range configs {
		configNames[config.Spec.Name] = true
	}
	dynamicReady := configNames[settings.DynamicConfigName]
	dynamicAssetReady := false
	if !dynamicReady && regexp.MustCompile(`^nim_traefik_dynamic_v[1-9][0-9]*$`).MatchString(settings.DynamicConfigName) {
		if data, readErr := os.ReadFile(c.TraefikDynamicConfigFile); readErr == nil && len(data) > 0 && len(data) <= 64<<10 && !strings.ContainsRune(string(data), 0) {
			dynamicAssetReady = true
		}
	}
	appendTraefikCheck(&preflight, TraefikInstallCheck{
		Detail:   choose(dynamicReady, "The reviewed dynamic file-provider config is present.", "The reviewed Traefik dynamic config is missing."),
		Fixable:  !dynamicReady && dynamicAssetReady,
		ID:       "dynamic-config",
		Label:    "Dynamic Traefik config",
		Recovery: choose(dynamicReady, "", "Create the reviewed dynamic config before installing Traefik."),
		Required: true,
		State:    choose(dynamicReady, "ready", "blocked"),
	})
	appendTraefikCheck(&preflight, TraefikInstallCheck{
		Detail: "SwarmOps renders and creates the immutable static config during this installation.", ID: "static-config", Label: "Static Traefik config", State: "automatic",
	})

	secretNames := map[string]bool{}
	for _, secret := range secrets {
		secretNames[secret.Spec.Name] = true
	}
	dashboardReady := secretNames[settings.DashboardAuthSecret]
	appendTraefikCheck(&preflight, TraefikInstallCheck{
		Detail:   choose(dashboardReady, "The dashboard-auth secret is present.", "The dashboard is protected by a required htpasswd secret, which is missing."),
		Fixable:  !dashboardReady && regexp.MustCompile(`^traefik_dashboard_auth_v[1-9][0-9]*$`).MatchString(settings.DashboardAuthSecret),
		ID:       "dashboard-auth",
		Label:    "Dashboard authentication",
		Recovery: choose(dashboardReady, "", "Create the configured Traefik dashboard-auth Swarm secret."),
		Required: true,
		State:    choose(dashboardReady, "ready", "blocked"),
	})

	if settings.Control.Version == 0 {
		settings.Control = DefaultTraefikSettings(settings.ACMEEmail)
	}
	fallbackErr := applyTraefikChallengeFallback(&settings, routes, secretNames)
	for _, item := range []struct {
		available bool
		id        string
		label     string
		provider  string
	}{
		{available: settings.CloudflareDNSAvailable, id: "cloudflare-dns", label: "Cloudflare DNS credential", provider: "Cloudflare"},
		{available: settings.ArvanDNSAvailable, id: "arvan-dns", label: "ArvanCloud DNS credential", provider: "ArvanCloud"},
	} {
		appendTraefikCheck(&preflight, TraefikInstallCheck{
			Detail: choose(item.available, item.provider+" DNS-01 is available.", item.provider+" DNS-01 is not configured; SwarmOps will use HTTP-01 instead."),
			ID:     item.id, Label: item.label, State: choose(item.available, "ready", "optional"),
		})
	}
	preflight.Challenge = "http-01"
	for _, resolver := range settings.Control.Resolvers {
		if resolver.Challenge == ChallengeDNS01 {
			preflight.Challenge = "dns-01"
			break
		}
	}
	if fallbackErr != nil {
		appendTraefikCheck(&preflight, TraefikInstallCheck{Detail: fallbackErr.Error(), ID: "certificate-challenge", Label: "Certificate challenge", Recovery: "Configure a DNS credential for every wildcard route before installation.", Required: true, State: "blocked"})
	} else {
		appendTraefikCheck(&preflight, TraefikInstallCheck{Detail: "Effective certificate challenge: " + strings.ToUpper(preflight.Challenge) + ".", ID: "certificate-challenge", Label: "Certificate challenge", State: "ready"})
	}

	emailReady := strings.TrimSpace(settings.ACMEEmail) != "" && strings.Contains(settings.ACMEEmail, "@") && !strings.ContainsAny(settings.ACMEEmail, "\r\n\x00")
	appendTraefikCheck(&preflight, TraefikInstallCheck{
		Detail: choose(emailReady, "A valid ACME contact email is configured.", "A valid ACME contact email is required for certificate issuance."),
		ID:     "acme-email", Label: "ACME contact email", Recovery: choose(emailReady, "", "Enter the email under static settings and apply it."), Required: true, State: choose(emailReady, "ready", "blocked"),
	})
	FinalizeTraefikInstallPreflight(&preflight)
	return preflight, nil
}

// FinalizeTraefikInstallPreflight recomputes the aggregate flags after Core
// or an API boundary appends capability checks to the controller-owned list.
func FinalizeTraefikInstallPreflight(preflight *TraefikInstallPreflight) {
	preflight.Ready = true
	blocked := false
	preflight.Repairable = true
	for _, check := range preflight.Checks {
		if !check.Required || check.State != "blocked" {
			continue
		}
		blocked = true
		preflight.Ready = false
		if !check.Fixable {
			preflight.Repairable = false
		}
	}
	if !blocked {
		preflight.Repairable = false
	}
}

func appendTraefikCheck(preflight *TraefikInstallPreflight, check TraefikInstallCheck) {
	preflight.Checks = append(preflight.Checks, check)
	if check.Required && check.State == "blocked" {
		preflight.Ready = false
	}
}

func choose[T any](condition bool, whenTrue, whenFalse T) T {
	if condition {
		return whenTrue
	}
	return whenFalse
}

func (c *ControlPlane) prepareTypedTraefikSettings(ctx context.Context) (TraefikStackSettings, error) {
	settings := c.TraefikSettings
	if c.Routing == nil || !validClusterID(c.ServerID) {
		return settings, nil
	}
	state, err := c.Routing.Snapshot(c.ServerID)
	if err != nil {
		return TraefikStackSettings{}, err
	}
	settings.Control = state.Settings
	settings.ACMEEmail = state.Settings.ACMEEmail
	settings.Credentials = append([]DNSCredentialMetadata(nil), state.Credentials...)
	secretOutput, err := c.CLI.Run(ctx, "secret", "ls", "--format", "{{.Name}}")
	if err != nil {
		return TraefikStackSettings{}, fmt.Errorf("list Traefik secrets: %w", err)
	}
	secretNames := map[string]bool{}
	for _, name := range strings.Fields(secretOutput) {
		secretNames[name] = true
	}
	if err := applyTraefikChallengeFallback(&settings, state.Routes, secretNames); err != nil {
		return TraefikStackSettings{}, err
	}
	static, err := RenderTraefikStaticConfig(settings.Control)
	if err != nil {
		return TraefikStackSettings{}, err
	}
	name := TraefikStaticConfigName(static)
	existing, err := c.CLI.Run(ctx, "config", "ls", "--format", "{{.Name}}")
	if err != nil {
		return TraefikStackSettings{}, fmt.Errorf("list immutable Traefik configs: %w", err)
	}
	found := false
	for _, current := range strings.Fields(existing) {
		if current == name {
			found = true
			break
		}
	}
	if !found {
		if _, err := c.CLI.RunInput(ctx, strings.NewReader(string(static)), "config", "create", name, "-"); err != nil {
			return TraefikStackSettings{}, fmt.Errorf("create immutable Traefik static config: %w", err)
		}
	}
	settings.StaticConfigName = name
	for _, route := range state.Routes {
		settings.RouteNetworks = append(settings.RouteNetworks, RouteNetworkName(route.ServiceKey))
	}
	settings.RouteNetworks = sortedStrings(settings.RouteNetworks)
	return settings, nil
}

func applyTypedTraefikStack(root map[string]any, settings TraefikStackSettings) error {
	services, ok := asMap(root["services"])
	if !ok {
		return fmt.Errorf("trusted Traefik stack has no services section")
	}
	service, ok := asMap(services["traefik"])
	if !ok {
		return fmt.Errorf("trusted Traefik stack has no traefik service")
	}
	service["command"] = []any{"--configFile=/etc/traefik/traefik.yml"}
	service["configs"] = []any{
		map[string]any{"source": "traefik_static", "target": "/etc/traefik/traefik.yml", "mode": 0o444},
		map[string]any{"source": "traefik_dynamic", "target": "/etc/traefik/dynamic.yml", "mode": 0o444},
	}
	ports := []any{}
	for _, entry := range settings.Control.EntryPoints {
		if !entry.Public {
			continue
		}
		protocol := "tcp"
		if entry.Protocol == RouteUDP {
			protocol = "udp"
		}
		ports = append(ports, map[string]any{"target": entry.Port, "published": entry.Port, "protocol": protocol, "mode": "ingress"})
	}
	service["ports"] = ports
	networks := []any{"traefik"}
	topNetworks, _ := asMap(root["networks"])
	if topNetworks == nil {
		topNetworks = map[string]any{}
		root["networks"] = topNetworks
	}
	for _, network := range settings.RouteNetworks {
		networks = append(networks, network)
		topNetworks[network] = map[string]any{"external": true, "name": network}
	}
	service["networks"] = networks
	configs, _ := asMap(root["configs"])
	configs["traefik_static"] = map[string]any{"external": true, "name": settings.StaticConfigName}

	environment := map[string]any{}
	serviceSecrets := []any{map[string]any{"source": "traefik_dashboard_auth", "target": "traefik_dashboard_auth", "mode": 0o400}}
	secrets, _ := asMap(root["secrets"])
	if secrets == nil {
		secrets = map[string]any{}
		root["secrets"] = secrets
	}
	delete(secrets, "traefik_cf_dns_token")
	delete(secrets, "traefik_arvan_api_key")
	if settings.CloudflareDNSAvailable {
		environment["CF_DNS_API_TOKEN_FILE"] = "/run/secrets/traefik_cf_dns_token"
		serviceSecrets = append(serviceSecrets, map[string]any{"source": "traefik_cf_dns_token", "target": "traefik_cf_dns_token", "mode": 0o400})
		secrets["traefik_cf_dns_token"] = map[string]any{"external": true, "name": settings.CFDNSTokenSecret}
	}
	if settings.ArvanDNSAvailable {
		environment["ARVANCLOUD_API_KEY_FILE"] = "/run/secrets/traefik_arvan_api_key"
		serviceSecrets = append(serviceSecrets, map[string]any{"source": "traefik_arvan_api_key", "target": "traefik_arvan_api_key", "mode": 0o400})
		secrets["traefik_arvan_api_key"] = map[string]any{"external": true, "name": settings.ArvanAPIKeySecret}
	}
	if len(environment) == 0 {
		delete(service, "environment")
	} else {
		service["environment"] = environment
	}
	service["secrets"] = serviceSecrets
	return nil
}

func sortedStrings(values []string) []string {
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

func safeHostname(value string) bool {
	value = strings.ToLower(strings.TrimSpace(value))
	if value == "" || len(value) > 253 || net.ParseIP(value) != nil || strings.ContainsAny(value, "/:@?#\r\n\x00") {
		return false
	}
	parts := strings.Split(value, ".")
	if len(parts) < 2 {
		return false
	}
	for _, part := range parts {
		if len(part) == 0 || len(part) > 63 || strings.HasPrefix(part, "-") || strings.HasSuffix(part, "-") || !regexp.MustCompile(`^[a-z0-9-]+$`).MatchString(part) {
			return false
		}
	}
	return true
}
