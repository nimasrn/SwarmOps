package agentcontrol

import (
	"fmt"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
)

const (
	RoutingVersion      = 1
	MaxRoutingLogLimit  = 1000
	MaxRoutingLogWindow = 7 * 24 * time.Hour
)

type RoutingRoute struct {
	ACMETrigger bool     `json:"acmeTrigger,omitempty"`
	AccessLogs  bool     `json:"accessLogs"`
	Enabled     bool     `json:"enabled"`
	Hosts       []string `json:"hosts,omitempty"`
	Key         string   `json:"key"`
	ListenPort  uint16   `json:"listenPort,omitempty"`
	Metrics     bool     `json:"metrics"`
	PathPrefix  string   `json:"pathPrefix,omitempty"`
	Protocol    string   `json:"protocol"`
	Resolver    string   `json:"resolver,omitempty"`
	Scope       string   `json:"scope"`
	SNI         []string `json:"sni,omitempty"`
	TargetPort  uint16   `json:"targetPort"`
	TLS         string   `json:"tls"`
}

type RoutingPublishedPort struct {
	Protocol      string `json:"protocol"`
	PublishedPort uint16 `json:"publishedPort"`
	TargetPort    uint16 `json:"targetPort"`
}

// RoutingReconcileRequest is a fixed machine operation. The machine renders
// its own labels from this closed shape; callers cannot supply label keys,
// Traefik rules, commands, files, URLs, or Docker arguments.
type RoutingReconcileRequest struct {
	Network               string                 `json:"network"`
	AddNetworks           []string               `json:"addNetworks,omitempty"`
	RestorePublishedPorts []RoutingPublishedPort `json:"restorePublishedPorts,omitempty"`
	RemoveDirectPorts     bool                   `json:"removeDirectPorts,omitempty"`
	RemoveNetworks        []string               `json:"removeNetworks,omitempty"`
	Route                 RoutingRoute           `json:"route"`
	ServiceID             string                 `json:"serviceId"`
	TraefikServiceID      string                 `json:"traefikServiceId"`
	Version               int                    `json:"version"`
}

type RoutingNetworkRequest struct {
	Network          string `json:"network"`
	TraefikServiceID string `json:"traefikServiceId"`
	Version          int    `json:"version"`
}

type RoutingBindingRequest struct {
	Alias            string `json:"alias"`
	CallerServiceID  string `json:"callerServiceId"`
	Delivery         string `json:"delivery"`
	Endpoint         string `json:"endpoint"`
	Name             string `json:"name,omitempty"`
	Network          string `json:"network"`
	SecretName       string `json:"secretName,omitempty"`
	TraefikServiceID string `json:"traefikServiceId"`
	Version          int    `json:"version"`
}

type TraefikRuntimeSnapshot struct {
	ObservedAt time.Time      `json:"observedAt"`
	Routes     []RuntimeRoute `json:"routes"`
	Version    int            `json:"version"`
}

type RuntimeRoute struct {
	Errors      []string `json:"errors,omitempty"`
	EntryPoints []string `json:"entryPoints"`
	Name        string   `json:"name"`
	Protocol    string   `json:"protocol"`
	Provider    string   `json:"provider,omitempty"`
	Service     string   `json:"service,omitempty"`
	Status      string   `json:"status"`
}

type TraefikLogQuery struct {
	From      time.Time `json:"from"`
	Level     string    `json:"level,omitempty"`
	Limit     int       `json:"limit"`
	Live      bool      `json:"live"`
	RequestID string    `json:"requestId,omitempty"`
	Router    string    `json:"router,omitempty"`
	Service   string    `json:"service,omitempty"`
	To        time.Time `json:"to"`
}

type TraefikLogEntry struct {
	Client     string    `json:"client,omitempty"`
	Level      string    `json:"level"`
	Message    string    `json:"message"`
	Method     string    `json:"method,omitempty"`
	RequestID  string    `json:"requestId,omitempty"`
	Router     string    `json:"router,omitempty"`
	Service    string    `json:"service,omitempty"`
	StatusCode int       `json:"statusCode,omitempty"`
	Timestamp  time.Time `json:"timestamp"`
}

type PrometheusSnapshot struct {
	ObservedAt time.Time          `json:"observedAt"`
	Targets    []PrometheusTarget `json:"targets"`
}

type PrometheusTarget struct {
	Error      string    `json:"error,omitempty"`
	Health     string    `json:"health"`
	Labels     []string  `json:"labels"`
	LastScrape time.Time `json:"lastScrape,omitempty"`
	Target     string    `json:"target"`
}

var (
	routingKeyPattern     = regexp.MustCompile(`^[a-z][a-z0-9-]{0,62}$`)
	routingReference      = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$`)
	routingNetwork        = regexp.MustCompile(`^swarmops-route-[a-z0-9][a-z0-9-]{1,62}$`)
	routingHostname       = regexp.MustCompile(`^(\*\.)?[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$`)
	routingPath           = regexp.MustCompile(`^/[A-Za-z0-9._~/-]{0,200}$`)
	routingBindingName    = regexp.MustCompile(`^[A-Z][A-Z0-9_]{0,63}$`)
	routingAlias          = regexp.MustCompile(`^[a-z][a-z0-9-]{0,62}\.swarmops\.internal$`)
	routingSecretName     = regexp.MustCompile(`^swarmops_binding_[a-z0-9_]{1,52}_v[1-9][0-9]*$`)
	routingSafeFilterText = regexp.MustCompile(`^[A-Za-z0-9._:@/?=& -]{0,128}$`)
)

func (r RoutingReconcileRequest) Validate() error {
	if r.Version != RoutingVersion || !routingReference.MatchString(r.ServiceID) || !routingReference.MatchString(r.TraefikServiceID) || !routingNetwork.MatchString(r.Network) {
		return fmt.Errorf("invalid routing reconciliation identity")
	}
	if len(r.AddNetworks) > 20 {
		return fmt.Errorf("routing reconciliation adds too many networks")
	}
	if err := r.Route.Validate(); err != nil {
		return err
	}
	addSet := map[string]bool{}
	for _, network := range r.AddNetworks {
		if !routingReference.MatchString(network) || network == r.Network || addSet[network] {
			return fmt.Errorf("invalid routing network addition")
		}
		addSet[network] = true
	}
	removeSet := map[string]bool{}
	seenPortSpec := map[string]bool{}
	for _, port := range r.RestorePublishedPorts {
		if port.Protocol != "tcp" && port.Protocol != "udp" && port.Protocol != "http" {
			return fmt.Errorf("invalid restored port protocol")
		}
		if port.PublishedPort == 0 || port.TargetPort == 0 {
			return fmt.Errorf("invalid restored port spec")
		}
		if port.PublishedPort > 65535 || port.TargetPort > 65535 {
			return fmt.Errorf("invalid restored port spec")
		}
		key := strings.ToLower(port.Protocol) + "/" + strconv.Itoa(int(port.PublishedPort)) + "/" + strconv.Itoa(int(port.TargetPort))
		if seenPortSpec[key] {
			return fmt.Errorf("duplicated restored port spec")
		}
		seenPortSpec[key] = true
	}
	if len(r.RemoveNetworks) > 20 {
		return fmt.Errorf("routing reconciliation removes too many networks")
	}

	for _, network := range r.RemoveNetworks {
		if !routingReference.MatchString(network) || network == r.Network || removeSet[network] {
			return fmt.Errorf("invalid routing network removal")
		}
		removeSet[network] = true
	}
	for network := range addSet {
		if removeSet[network] {
			return fmt.Errorf("routing reconciliation request has conflicting network intent")
		}
	}
	return nil
}

func (r RoutingNetworkRequest) Validate() error {
	if r.Version != RoutingVersion || !routingReference.MatchString(r.TraefikServiceID) || !routingNetwork.MatchString(r.Network) {
		return fmt.Errorf("invalid routing network request")
	}
	return nil
}

func (r RoutingRoute) Validate() error {
	if !routingKeyPattern.MatchString(r.Key) || r.TargetPort == 0 || !oneOf(r.Protocol, "http", "tcp", "udp") || !oneOf(r.Scope, "public", "internal", "both") || !oneOf(r.TLS, "off", "terminate", "passthrough") {
		return fmt.Errorf("invalid typed route")
	}
	if r.Protocol == "http" {
		if r.ListenPort != 0 || len(r.Hosts) == 0 || len(r.SNI) != 0 || !routingPath.MatchString(r.PathPrefix) || r.TLS == "passthrough" {
			return fmt.Errorf("invalid typed HTTP route")
		}
	} else if r.ListenPort < 10000 || r.ListenPort > 19999 || len(r.Hosts) != 0 || r.PathPrefix != "" {
		return fmt.Errorf("invalid typed stream route")
	}
	if r.Protocol == "tcp" && r.TLS != "off" && len(r.SNI) == 0 {
		return fmt.Errorf("typed TLS TCP route requires SNI")
	}
	if r.Protocol == "udp" && (r.TLS != "off" || len(r.SNI) != 0) {
		return fmt.Errorf("typed UDP route cannot configure TLS or SNI")
	}
	if r.TLS == "terminate" && !routingKeyPattern.MatchString(r.Resolver) {
		return fmt.Errorf("typed TLS route requires a resolver")
	}
	if r.ACMETrigger && (!r.Enabled || r.TLS != "terminate" || r.Protocol == "udp") {
		return fmt.Errorf("ACME trigger requires an enabled terminating TLS route")
	}
	for _, host := range append(append([]string{}, r.Hosts...), r.SNI...) {
		if !routingHostname.MatchString(host) {
			return fmt.Errorf("typed route hostname is invalid")
		}
	}
	return nil
}

func (r RoutingBindingRequest) Validate() error {
	validNetwork := routingNetwork.MatchString(r.Network) || r.Network == "swarmops"
	if r.Version != RoutingVersion || !routingReference.MatchString(r.CallerServiceID) || !routingReference.MatchString(r.TraefikServiceID) || !validNetwork || !routingAlias.MatchString(r.Alias) {
		return fmt.Errorf("invalid dependency binding identity")
	}
	if !oneOf(r.Delivery, "existing", "environment", "secret_file") {
		return fmt.Errorf("invalid dependency delivery")
	}
	if len(r.Endpoint) == 0 || len(r.Endpoint) > 512 || strings.ContainsAny(r.Endpoint, "\r\n\x00") || !strings.Contains(r.Endpoint, r.Alias) {
		return fmt.Errorf("invalid derived dependency endpoint")
	}
	switch r.Delivery {
	case "existing":
		if r.Name != "" || r.SecretName != "" {
			return fmt.Errorf("existing dependency delivery has no mutation fields")
		}
	case "environment":
		if !routingBindingName.MatchString(r.Name) || r.SecretName != "" {
			return fmt.Errorf("invalid dependency environment delivery")
		}
	case "secret_file":
		if !routingBindingName.MatchString(r.Name) || !routingSecretName.MatchString(r.SecretName) {
			return fmt.Errorf("invalid dependency secret-file delivery")
		}
	}
	return nil
}

func (q TraefikLogQuery) Validate(now time.Time) error {
	if q.From.IsZero() || q.To.IsZero() || q.To.Before(q.From) || q.To.Sub(q.From) > MaxRoutingLogWindow || q.To.After(now.Add(time.Minute)) {
		return fmt.Errorf("invalid Traefik log time range")
	}
	if q.Limit < 1 || q.Limit > MaxRoutingLogLimit || (q.Level != "" && !oneOf(q.Level, "DEBUG", "INFO", "WARN", "ERROR")) {
		return fmt.Errorf("invalid Traefik log bounds")
	}
	for _, value := range []string{q.Router, q.Service, q.RequestID} {
		if !routingSafeFilterText.MatchString(value) || strings.ContainsAny(value, "\r\n\x00") {
			return fmt.Errorf("invalid Traefik log filter")
		}
	}
	return nil
}

func (r RoutingRoute) Labels(network string) (map[string]string, error) {
	if err := r.Validate(); err != nil || !routingNetwork.MatchString(network) {
		if err != nil {
			return nil, err
		}
		return nil, fmt.Errorf("invalid route network")
	}
	name := r.Key + "-" + r.Protocol
	prefix := "traefik." + r.Protocol
	labels := map[string]string{
		"swarmops.routing.route":   r.Key,
		"swarmops.routing.version": strconv.Itoa(RoutingVersion),
		"traefik.enable":           strconv.FormatBool(r.Enabled),
		"traefik.swarm.network":    network,
		prefix + ".services." + name + ".loadbalancer.server.port": strconv.Itoa(int(r.TargetPort)),
	}
	switch r.Protocol {
	case "http":
		hosts := make([]string, len(r.Hosts))
		for index, host := range r.Hosts {
			hosts[index] = "`" + host + "`"
		}
		rule := "Host(" + strings.Join(hosts, ",") + ")"
		if r.PathPrefix != "/" {
			rule += " && PathPrefix(`" + r.PathPrefix + "`)"
		}
		if r.Scope == "public" || r.Scope == "both" {
			router := name + "-public"
			entrypoint := "web"
			if r.TLS != "off" {
				entrypoint = "websecure"
			}
			labels[prefix+".routers."+router+".entrypoints"] = entrypoint
			labels[prefix+".routers."+router+".service"] = name
			labels[prefix+".routers."+router+".rule"] = rule
			labels[prefix+".routers."+router+".observability.metrics"] = strconv.FormatBool(r.Metrics)
			labels[prefix+".routers."+router+".observability.accesslogs"] = strconv.FormatBool(r.AccessLogs)
			if r.TLS == "terminate" {
				labels[prefix+".routers."+router+".tls"] = "true"
				labels[prefix+".routers."+router+".tls.certresolver"] = r.Resolver
			}
			if r.ACMETrigger {
				trigger := router + "-acme-retry"
				for _, field := range []string{"entrypoints", "service", "rule", "observability.metrics", "observability.accesslogs", "tls", "tls.certresolver"} {
					if value, found := labels[prefix+".routers."+router+"."+field]; found {
						labels[prefix+".routers."+trigger+"."+field] = value
					}
				}
				labels[prefix+".routers."+trigger+".priority"] = "1"
			}
		}
		if r.Scope == "internal" || r.Scope == "both" {
			router := name + "-internal"
			internalRule := "Host(`" + r.Key + ".swarmops.internal`)"
			if r.PathPrefix != "/" {
				internalRule += " && PathPrefix(`" + r.PathPrefix + "`)"
			}
			labels[prefix+".routers."+router+".entrypoints"] = "internal-http"
			labels[prefix+".routers."+router+".service"] = name
			labels[prefix+".routers."+router+".rule"] = internalRule
			labels[prefix+".routers."+router+".observability.metrics"] = strconv.FormatBool(r.Metrics)
			labels[prefix+".routers."+router+".observability.accesslogs"] = strconv.FormatBool(r.AccessLogs)
		}
	case "tcp":
		labels[prefix+".routers."+name+".entrypoints"] = r.entryPoint()
		labels[prefix+".routers."+name+".service"] = name
		items := []string{"`*`"}
		if len(r.SNI) > 0 {
			items = make([]string, len(r.SNI))
			for index, host := range r.SNI {
				items[index] = "`" + host + "`"
			}
		}
		labels[prefix+".routers."+name+".rule"] = "HostSNI(" + strings.Join(items, ",") + ")"
	case "udp":
		labels[prefix+".routers."+name+".entrypoints"] = r.entryPoint()
		labels[prefix+".routers."+name+".service"] = name
	}
	if r.Protocol == "tcp" && r.TLS == "terminate" {
		labels[prefix+".routers."+name+".tls"] = "true"
		labels[prefix+".routers."+name+".tls.certresolver"] = r.Resolver
	}
	if r.Protocol == "tcp" && r.ACMETrigger {
		trigger := name + "-acme-retry"
		for _, field := range []string{"entrypoints", "service", "rule", "tls", "tls.certresolver"} {
			if value, found := labels[prefix+".routers."+name+"."+field]; found {
				labels[prefix+".routers."+trigger+"."+field] = value
			}
		}
		labels[prefix+".routers."+trigger+".priority"] = "1"
	}
	if r.Protocol == "tcp" && r.TLS == "passthrough" {
		labels[prefix+".routers."+name+".tls.passthrough"] = "true"
	}
	owned := make([]string, 0, len(labels))
	for key := range labels {
		if key != "swarmops.routing.labels" {
			owned = append(owned, key)
		}
	}
	sort.Strings(owned)
	labels["swarmops.routing.labels"] = strings.Join(owned, ",")
	return labels, nil
}

func (r RoutingRoute) entryPoint() string {
	if r.Protocol != "http" {
		return r.Protocol + "-" + strconv.Itoa(int(r.ListenPort))
	}
	switch r.Scope {
	case "internal":
		return "internal-http"
	case "both":
		if r.TLS == "off" {
			return "web,internal-http"
		}
		return "websecure,internal-http"
	default:
		if r.TLS == "off" {
			return "web"
		}
		return "websecure"
	}
}
