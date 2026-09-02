package ops

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"gopkg.in/yaml.v3"
)

const (
	RoutingSchemaVersion = 1
	RoutePortMin         = uint16(10000)
	RoutePortMax         = uint16(19999)
	MaxTraefikLogRecords = 1000
	MaxTraefikLogRange   = 7 * 24 * time.Hour
)

type RouteProtocol string

const (
	RouteHTTP RouteProtocol = "http"
	RouteTCP  RouteProtocol = "tcp"
	RouteUDP  RouteProtocol = "udp"
)

type RouteScope string

const (
	RoutePublic   RouteScope = "public"
	RouteInternal RouteScope = "internal"
	RouteBoth     RouteScope = "both"
)

type RouteTLSMode string

const (
	RouteTLSOff         RouteTLSMode = "off"
	RouteTLSTerminate   RouteTLSMode = "terminate"
	RouteTLSPassthrough RouteTLSMode = "passthrough"
)

type DependencyDelivery string

const (
	DependencyExisting    DependencyDelivery = "existing"
	DependencyEnvironment DependencyDelivery = "environment"
	DependencySecretFile  DependencyDelivery = "secret_file"
)

type DNSProvider string

const (
	DNSProviderCloudflare DNSProvider = "cloudflare"
	DNSProviderArvan      DNSProvider = "arvan"
)

type DNSRecordType string

const (
	DNSRecordA     DNSRecordType = "A"
	DNSRecordAAAA  DNSRecordType = "AAAA"
	DNSRecordCNAME DNSRecordType = "CNAME"
)

type ACMEChallenge string

const (
	ChallengeDNS01     ACMEChallenge = "dns-01"
	ChallengeHTTP01    ACMEChallenge = "http-01"
	ChallengeTLSALPN01 ACMEChallenge = "tls-alpn-01"
)

type RouteMatch struct {
	Hosts      []string `json:"hosts,omitempty"`
	PathPrefix string   `json:"pathPrefix,omitempty"`
	SNI        []string `json:"sni,omitempty"`
}

type RouteHealthProof struct {
	Kind           string `json:"kind"`
	Path           string `json:"path,omitempty"`
	TimeoutSeconds uint16 `json:"timeoutSeconds"`
}

// RouteSpec is the only browser-facing route description. It deliberately has
// no raw Traefik rule, label, middleware, URL, or provider option.
type RouteSpec struct {
	AccessLogs   bool             `json:"accessLogs"`
	DNSReference string           `json:"dnsReference,omitempty"`
	Enabled      bool             `json:"enabled"`
	Health       RouteHealthProof `json:"health"`
	Key          string           `json:"key"`
	ListenPort   uint16           `json:"listenPort,omitempty"`
	Managed      bool             `json:"managed"`
	Match        RouteMatch       `json:"match"`
	Metrics      bool             `json:"metrics"`
	Protocol     RouteProtocol    `json:"protocol"`
	PublicAllow  bool             `json:"publicAllow"`
	Resolver     string           `json:"resolver,omitempty"`
	Scope        RouteScope       `json:"scope"`
	Sensitive    bool             `json:"sensitive"`
	ServiceKey   string           `json:"serviceKey"`
	TLS          RouteTLSMode     `json:"tls"`
	TargetPort   uint16           `json:"targetPort"`
	Version      int              `json:"version"`
}

// DependencyBinding declares how a caller receives a routed dependency. A
// target hostname or URL is derived by SwarmOps; it is never caller supplied.
type DependencyBinding struct {
	CallerService string             `json:"callerService"`
	Delivery      DependencyDelivery `json:"delivery"`
	Name          string             `json:"name"`
	TargetRoute   string             `json:"targetRoute"`
	Version       int                `json:"version"`
}

type ACMEPolicy struct {
	Challenge       ACMEChallenge `json:"challenge"`
	DNSCredentialID string        `json:"dnsCredentialId,omitempty"`
	Name            string        `json:"name"`
	Provider        DNSProvider   `json:"provider,omitempty"`
}

type StaticEntryPoint struct {
	Name     string        `json:"name"`
	Port     uint16        `json:"port"`
	Protocol RouteProtocol `json:"protocol"`
	Public   bool          `json:"public"`
}

type PortRange struct {
	End   uint16 `json:"end"`
	Start uint16 `json:"start"`
}

// TraefikSettings owns static configuration. MetricsEnabled must remain true;
// disabling collection is not a supported state.
type TraefikSettings struct {
	ACMEEmail      string             `json:"acmeEmail"`
	AccessLogs     bool               `json:"accessLogs"`
	DashboardHost  string             `json:"dashboardHost"`
	EntryPoints    []StaticEntryPoint `json:"entryPoints"`
	MetricsEnabled bool               `json:"metricsEnabled"`
	OperationalLog string             `json:"operationalLog"`
	PortRange      PortRange          `json:"portRange"`
	Resolvers      []ACMEPolicy       `json:"resolvers"`
	Version        int                `json:"version"`
}

type TraefikInstallCheck struct {
	Detail   string `json:"detail"`
	Fixable  bool   `json:"fixable"`
	ID       string `json:"id"`
	Label    string `json:"label"`
	Recovery string `json:"recovery,omitempty"`
	Required bool   `json:"required"`
	State    string `json:"state"`
}

type TraefikInstallPreflight struct {
	Challenge  string                `json:"challenge"`
	Checks     []TraefikInstallCheck `json:"checks"`
	Ready      bool                  `json:"ready"`
	Repairable bool                  `json:"repairable"`
}

type DNSCredentialMetadata struct {
	AccountID   string      `json:"accountId,omitempty"`
	CreatedAt   time.Time   `json:"createdAt"`
	Email       string      `json:"email,omitempty"`
	ID          string      `json:"id"`
	Name        string      `json:"name"`
	Provider    DNSProvider `json:"provider"`
	SecretName  string      `json:"secretName"`
	State       string      `json:"state"`
	ValidatedAt *time.Time  `json:"validatedAt,omitempty"`
	Version     int         `json:"version"`
}

// DNSCredentialIdentity carries the non-secret account fields that accompany a
// provider credential value. Cloudflare uses the account identifier to scope
// zone lookups, and the account email selects global-API-key authentication
// instead of a scoped bearer token. Arvan accepts neither.
type DNSCredentialIdentity struct {
	AccountID string `json:"accountId,omitempty"`
	Email     string `json:"email,omitempty"`
}

var cloudflareAccountIDPattern = regexp.MustCompile(`^[0-9a-f]{32}$`)

// Normalize lowercases the identity fields the provider treats as opaque and
// trims the surrounding whitespace a paste usually carries.
func (i DNSCredentialIdentity) Normalize() DNSCredentialIdentity {
	i.AccountID = strings.ToLower(strings.TrimSpace(i.AccountID))
	i.Email = strings.ToLower(strings.TrimSpace(i.Email))
	return i
}

func (i DNSCredentialIdentity) Validate(provider DNSProvider) error {
	i = i.Normalize()
	if provider != DNSProviderCloudflare {
		if i.AccountID != "" || i.Email != "" {
			return fmt.Errorf("only Cloudflare credentials accept an account identifier or email")
		}
		return nil
	}
	if i.AccountID != "" && !cloudflareAccountIDPattern.MatchString(i.AccountID) {
		return fmt.Errorf("Cloudflare account identifier must be 32 hexadecimal characters")
	}
	if i.Email != "" && (len(i.Email) > 254 || !strings.Contains(i.Email, "@") || strings.ContainsAny(i.Email, "\r\n\x00 \t")) {
		return fmt.Errorf("Cloudflare account email is invalid")
	}
	return nil
}

type DNSRecordSpec struct {
	Adopted          bool          `json:"adopted"`
	Content          string        `json:"content"`
	CredentialID     string        `json:"credentialId"`
	ID               string        `json:"id"`
	Managed          bool          `json:"managed"`
	Name             string        `json:"name"`
	ProviderRecordID string        `json:"providerRecordId,omitempty"`
	Proxied          bool          `json:"proxied"`
	TTL              uint32        `json:"ttl"`
	Type             DNSRecordType `json:"type"`
	Version          int           `json:"version"`
	Zone             string        `json:"zone"`
}

type DNSProviderRecord struct {
	Content          string        `json:"content"`
	Name             string        `json:"name"`
	Protected        bool          `json:"protected"`
	ProviderRecordID string        `json:"providerRecordId"`
	Proxied          bool          `json:"proxied"`
	TTL              uint32        `json:"ttl"`
	Type             DNSRecordType `json:"type"`
}

type DNSRecordPreview struct {
	Action   string             `json:"action"`
	Existing *DNSProviderRecord `json:"existing,omitempty"`
	Record   DNSRecordSpec      `json:"record"`
	Warnings []string           `json:"warnings"`
}

type DNSPropagationCheck struct {
	Answers  []string `json:"answers"`
	Error    string   `json:"error,omitempty"`
	Resolver string   `json:"resolver"`
	Valid    bool     `json:"valid"`
}

type DNSPropagationStatus struct {
	Checks     []DNSPropagationCheck `json:"checks"`
	ObservedAt time.Time             `json:"observedAt"`
	Ready      bool                  `json:"ready"`
}

type CertificateStatus struct {
	Domains        []string   `json:"domains"`
	FailureSummary string     `json:"failureSummary,omitempty"`
	Fingerprint    string     `json:"fingerprint,omitempty"`
	HandshakeValid bool       `json:"handshakeValid"`
	Issuer         string     `json:"issuer,omitempty"`
	LastAttempt    *time.Time `json:"lastAttempt,omitempty"`
	NotAfter       *time.Time `json:"notAfter,omitempty"`
	NotBefore      *time.Time `json:"notBefore,omitempty"`
	Resolver       string     `json:"resolver"`
	RouteKey       string     `json:"routeKey"`
	State          string     `json:"state"`
	Version        int        `json:"version"`
}

type RouteRuntime struct {
	Errors      []string      `json:"errors,omitempty"`
	EntryPoints []string      `json:"entryPoints"`
	ObservedAt  time.Time     `json:"observedAt"`
	Protocol    RouteProtocol `json:"protocol"`
	RouteKey    string        `json:"routeKey"`
	Router      string        `json:"router"`
	Service     string        `json:"service"`
	State       string        `json:"state"`
	Version     int           `json:"version"`
}

type RouteInventoryRow struct {
	Declaration     ServiceRouteDeclaration `json:"declaration"`
	Exception       string                  `json:"exception,omitempty"`
	ManifestSnippet string                  `json:"manifestSnippet,omitempty"`
	Route           RouteSpec               `json:"route"`
	Runtime         *RouteRuntime           `json:"runtime,omitempty"`
	ServiceImage    string                  `json:"serviceImage,omitempty"`
	Status          string                  `json:"status"`
}

type ServiceRouteRole string

const (
	ServiceRoleRouted             ServiceRouteRole = "routed"
	ServiceRoleClientOnly         ServiceRouteRole = "client-only"
	ServiceRolePlatformException  ServiceRouteRole = "platform-exception"
	ServiceRoleNeedsConfiguration ServiceRouteRole = "needs-configuration"
)

type ServiceRouteDeclaration struct {
	Reason     string           `json:"reason,omitempty"`
	Role       ServiceRouteRole `json:"role"`
	ServiceKey string           `json:"serviceKey"`
	Version    int              `json:"version"`
}

type RoutePlan struct {
	EntryPoint      StaticEntryPoint  `json:"entryPoint"`
	Labels          map[string]string `json:"labels"`
	ManifestSnippet string            `json:"manifestSnippet"`
	Network         string            `json:"network"`
	RestartRequired bool              `json:"restartRequired"`
	Route           RouteSpec         `json:"route"`
	Validation      []RouteValidation `json:"validation"`
	Version         int               `json:"version"`
}

type RouteValidation struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Valid   bool   `json:"valid"`
}

type CutoverService struct {
	Bindings       []string `json:"bindings"`
	Blockers       []string `json:"blockers"`
	DirectPorts    []uint16 `json:"directPorts"`
	Healthy        bool     `json:"healthy"`
	LegacyNetworks []string `json:"legacyNetworks"`
	Role           string   `json:"role"`
	Routes         []string `json:"routes"`
	ServiceKey     string   `json:"serviceKey"`
}

type CutoverPlan struct {
	Blockers    []string         `json:"blockers"`
	GeneratedAt time.Time        `json:"generatedAt"`
	Phases      []string         `json:"phases"`
	Ready       bool             `json:"ready"`
	Services    []CutoverService `json:"services"`
	Version     int              `json:"version"`
}

type CutoverPublishedPort struct {
	Protocol      string `json:"protocol"`
	PublishedPort uint16 `json:"publishedPort"`
	TargetPort    uint16 `json:"targetPort"`
}

type CutoverServiceRollback struct {
	PublishedPorts []CutoverPublishedPort `json:"publishedPorts"`
	ServiceKey     string                 `json:"serviceKey"`
	Networks       []string               `json:"networks"`
}

type CutoverRollbackPlan struct {
	GeneratedAt time.Time                `json:"generatedAt"`
	Services    []CutoverServiceRollback `json:"services"`
	Version     int                      `json:"version"`
}

type TraefikLogFilter struct {
	From      time.Time `json:"from"`
	Level     string    `json:"level,omitempty"`
	Limit     int       `json:"limit"`
	Live      bool      `json:"live"`
	RequestID string    `json:"requestId,omitempty"`
	Router    string    `json:"router,omitempty"`
	Service   string    `json:"service,omitempty"`
	To        time.Time `json:"to"`
}

type TraefikLogRecord struct {
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

type PrometheusTargetStatus struct {
	Error      string    `json:"error,omitempty"`
	Health     string    `json:"health"`
	Labels     []string  `json:"labels"`
	LastScrape time.Time `json:"lastScrape,omitempty"`
	Target     string    `json:"target"`
}

type PrometheusStatus struct {
	Collected bool                     `json:"collected"`
	Observed  time.Time                `json:"observedAt"`
	Targets   []PrometheusTargetStatus `json:"targets"`
}

var (
	routeKeyPattern       = regexp.MustCompile(`^[a-z][a-z0-9-]{0,62}$`)
	bindingNamePattern    = regexp.MustCompile(`^[A-Z][A-Z0-9_]{0,63}$`)
	resolverNamePattern   = regexp.MustCompile(`^[a-z][a-z0-9-]{0,31}$`)
	providerIDPattern     = regexp.MustCompile(`^[a-z][a-z0-9-]{0,62}$`)
	certificateHash       = regexp.MustCompile(`^SHA256:[A-Fa-f0-9]{64}$`)
	routerSafeTextPattern = regexp.MustCompile(`^[A-Za-z0-9._:@/?=& -]{0,512}$`)
)

func DefaultTraefikSettings(email string) TraefikSettings {
	return TraefikSettings{
		ACMEEmail:  strings.TrimSpace(email),
		AccessLogs: true,
		EntryPoints: []StaticEntryPoint{
			{Name: "web", Port: 80, Protocol: RouteHTTP, Public: true},
			{Name: "websecure", Port: 443, Protocol: RouteHTTP, Public: true},
			{Name: "internal-http", Port: 8081, Protocol: RouteHTTP, Public: false},
			{Name: "metrics", Port: 8082, Protocol: RouteHTTP, Public: false},
		},
		MetricsEnabled: true,
		OperationalLog: "INFO",
		PortRange:      PortRange{Start: RoutePortMin, End: RoutePortMax},
		Resolvers: []ACMEPolicy{
			{Name: "le", Challenge: ChallengeDNS01, Provider: DNSProviderCloudflare},
			{Name: "arvan", Challenge: ChallengeDNS01, Provider: DNSProviderArvan},
			{Name: "http", Challenge: ChallengeHTTP01},
			{Name: "tls", Challenge: ChallengeTLSALPN01},
		},
		Version: RoutingSchemaVersion,
	}
}

func (s RouteSpec) Normalize() RouteSpec {
	s.Key = strings.ToLower(strings.TrimSpace(s.Key))
	s.ServiceKey = strings.TrimSpace(s.ServiceKey)
	s.Resolver = strings.ToLower(strings.TrimSpace(s.Resolver))
	s.DNSReference = strings.ToLower(strings.TrimSpace(s.DNSReference))
	s.Match.PathPrefix = strings.TrimSpace(s.Match.PathPrefix)
	s.Match.Hosts = normalizeHosts(s.Match.Hosts)
	s.Match.SNI = normalizeHosts(s.Match.SNI)
	if s.Version == 0 {
		s.Version = RoutingSchemaVersion
	}
	if s.Health.TimeoutSeconds == 0 {
		s.Health.TimeoutSeconds = 5
	}
	if s.Health.Kind == "" {
		switch s.Protocol {
		case RouteHTTP:
			s.Health.Kind = "response"
		case RouteTCP:
			s.Health.Kind = "handshake"
		case RouteUDP:
			s.Health.Kind = "structural"
		}
	}
	if s.Protocol == RouteHTTP && s.Health.Path == "" {
		s.Health.Path = "/"
	}
	return s
}

func (s RouteSpec) Validate() error {
	s = s.Normalize()
	if s.Version != RoutingSchemaVersion {
		return fmt.Errorf("unsupported route schema version")
	}
	if !routeKeyPattern.MatchString(s.Key) {
		return fmt.Errorf("route key must be lowercase letters, digits, and hyphens")
	}
	if !validServiceKey(s.ServiceKey) {
		return fmt.Errorf("route service key is invalid")
	}
	if !oneOfString(string(s.Protocol), string(RouteHTTP), string(RouteTCP), string(RouteUDP)) {
		return fmt.Errorf("route protocol must be http, tcp, or udp")
	}
	if !oneOfString(string(s.Scope), string(RoutePublic), string(RouteInternal), string(RouteBoth)) {
		return fmt.Errorf("route scope must be public, internal, or both")
	}
	if !oneOfString(string(s.TLS), string(RouteTLSOff), string(RouteTLSTerminate), string(RouteTLSPassthrough)) {
		return fmt.Errorf("route TLS mode is invalid")
	}
	if s.TargetPort == 0 {
		return fmt.Errorf("route target port is required")
	}
	if s.ListenPort != 0 && (s.ListenPort < RoutePortMin || s.ListenPort > RoutePortMax) && s.Protocol != RouteHTTP {
		return fmt.Errorf("route listen port must be between %d and %d", RoutePortMin, RoutePortMax)
	}
	if s.Protocol == RouteHTTP {
		if s.ListenPort != 0 {
			return fmt.Errorf("HTTP routes use the shared entrypoints and cannot choose a listen port")
		}
		if len(s.Match.SNI) != 0 {
			return fmt.Errorf("HTTP routes cannot declare an SNI match")
		}
		if len(s.Match.Hosts) == 0 {
			return fmt.Errorf("HTTP routes require at least one host")
		}
		if s.Match.PathPrefix == "" {
			s.Match.PathPrefix = "/"
		}
		if !httpPathPattern.MatchString(s.Match.PathPrefix) {
			return fmt.Errorf("HTTP path prefix is invalid")
		}
		if s.TLS == RouteTLSPassthrough {
			return fmt.Errorf("HTTP routes cannot use TLS passthrough")
		}
	} else {
		if len(s.Match.Hosts) != 0 || s.Match.PathPrefix != "" {
			return fmt.Errorf("TCP and UDP routes cannot declare HTTP hosts or paths")
		}
	}
	if s.Protocol == RouteTCP && s.TLS != RouteTLSOff && len(s.Match.SNI) == 0 {
		return fmt.Errorf("TLS TCP routes require at least one SNI host")
	}
	if s.Protocol == RouteUDP && (s.TLS != RouteTLSOff || len(s.Match.SNI) != 0) {
		return fmt.Errorf("UDP routes support TLS off and no host match")
	}
	if s.TLS == RouteTLSTerminate && s.Resolver == "" {
		return fmt.Errorf("TLS termination requires a certificate resolver")
	}
	if s.Resolver != "" && !resolverNamePattern.MatchString(s.Resolver) {
		return fmt.Errorf("certificate resolver name is invalid")
	}
	if routeIsPublic(s.Scope) && s.Enabled {
		if !s.PublicAllow {
			return fmt.Errorf("public routes require reviewed publicAllow")
		}
		if s.DNSReference == "" && (s.Protocol == RouteHTTP || s.TLS != RouteTLSOff) {
			return fmt.Errorf("enabled public hostname routes require a DNS reference")
		}
	}
	if s.Health.TimeoutSeconds == 0 || s.Health.TimeoutSeconds > 60 {
		return fmt.Errorf("route health timeout must be between 1 and 60 seconds")
	}
	switch s.Protocol {
	case RouteHTTP:
		if s.Health.Kind != "response" || !httpPathPattern.MatchString(s.Health.Path) {
			return fmt.Errorf("HTTP routes require response health proof and an absolute path")
		}
	case RouteTCP:
		if s.Health.Kind != "handshake" {
			return fmt.Errorf("TCP routes require handshake health proof")
		}
	case RouteUDP:
		if s.Health.Kind != "structural" {
			return fmt.Errorf("UDP routes require structural health proof")
		}
	}
	return nil
}

func (b DependencyBinding) Normalize() DependencyBinding {
	b.CallerService = strings.TrimSpace(b.CallerService)
	b.TargetRoute = strings.ToLower(strings.TrimSpace(b.TargetRoute))
	b.Name = strings.ToUpper(strings.TrimSpace(b.Name))
	if b.Version == 0 {
		b.Version = RoutingSchemaVersion
	}
	return b
}

func (d ServiceRouteDeclaration) Normalize() ServiceRouteDeclaration {
	d.ServiceKey = strings.TrimSpace(d.ServiceKey)
	d.Reason = strings.TrimSpace(d.Reason)
	if d.Version == 0 {
		d.Version = RoutingSchemaVersion
	}
	return d
}

func (d ServiceRouteDeclaration) Validate() error {
	d = d.Normalize()
	if d.Version != RoutingSchemaVersion || !validServiceKey(d.ServiceKey) {
		return fmt.Errorf("service route declaration identity is invalid")
	}
	if !oneOfString(string(d.Role), string(ServiceRoleRouted), string(ServiceRoleClientOnly), string(ServiceRolePlatformException), string(ServiceRoleNeedsConfiguration)) {
		return fmt.Errorf("service route declaration role is invalid")
	}
	if (d.Role == ServiceRolePlatformException || d.Role == ServiceRoleClientOnly) && (d.Reason == "" || len(d.Reason) > 256 || strings.ContainsAny(d.Reason, "\r\n\x00")) {
		return fmt.Errorf("service route declaration requires a bounded reason")
	}
	return nil
}

func (b DependencyBinding) Validate() error {
	b = b.Normalize()
	if b.Version != RoutingSchemaVersion || !validServiceKey(b.CallerService) || !routeKeyPattern.MatchString(b.TargetRoute) {
		return fmt.Errorf("dependency binding identity is invalid")
	}
	if !oneOfString(string(b.Delivery), string(DependencyExisting), string(DependencyEnvironment), string(DependencySecretFile)) {
		return fmt.Errorf("dependency delivery is unsupported")
	}
	if b.Delivery == DependencyExisting {
		if b.Name != "" {
			return fmt.Errorf("existing dependency delivery cannot define a name")
		}
	} else if !bindingNamePattern.MatchString(b.Name) {
		return fmt.Errorf("dependency environment or secret-file delivery requires an uppercase name")
	}
	return nil
}

func (s TraefikSettings) Normalize() TraefikSettings {
	s.ACMEEmail = strings.TrimSpace(s.ACMEEmail)
	s.DashboardHost = strings.ToLower(strings.TrimSuffix(strings.TrimSpace(s.DashboardHost), "."))
	s.OperationalLog = strings.ToUpper(strings.TrimSpace(s.OperationalLog))
	if s.Version == 0 {
		s.Version = RoutingSchemaVersion
	}
	if s.PortRange.Start == 0 {
		s.PortRange.Start = RoutePortMin
	}
	if s.PortRange.End == 0 {
		s.PortRange.End = RoutePortMax
	}
	// A value receiver only copies slice headers. Copy these nested slices before
	// normalizing their elements so validation does not mutate a caller-owned
	// configuration (or race with another validation of that same value).
	s.Resolvers = append([]ACMEPolicy(nil), s.Resolvers...)
	s.EntryPoints = append([]StaticEntryPoint(nil), s.EntryPoints...)
	for index := range s.Resolvers {
		s.Resolvers[index].Name = strings.ToLower(strings.TrimSpace(s.Resolvers[index].Name))
		s.Resolvers[index].DNSCredentialID = strings.ToLower(strings.TrimSpace(s.Resolvers[index].DNSCredentialID))
	}
	for index := range s.EntryPoints {
		s.EntryPoints[index].Name = strings.ToLower(strings.TrimSpace(s.EntryPoints[index].Name))
	}
	return s
}

func (s TraefikSettings) Validate() error {
	s = s.Normalize()
	if s.Version != RoutingSchemaVersion {
		return fmt.Errorf("unsupported Traefik settings version")
	}
	if s.ACMEEmail == "" {
		return fmt.Errorf("Traefik ACME email is not configured")
	}
	if !strings.Contains(s.ACMEEmail, "@") || strings.ContainsAny(s.ACMEEmail, "\r\n\x00") {
		return fmt.Errorf("Traefik ACME email is invalid")
	}
	if s.DashboardHost != "" && !safeHostname(s.DashboardHost) {
		return fmt.Errorf("Traefik dashboard hostname is invalid")
	}
	if !s.MetricsEnabled {
		return fmt.Errorf("Traefik metrics are mandatory")
	}
	if !oneOfString(s.OperationalLog, "DEBUG", "INFO", "WARN", "ERROR") {
		return fmt.Errorf("Traefik operational log level must be DEBUG, INFO, WARN, or ERROR")
	}
	if s.PortRange.Start < RoutePortMin || s.PortRange.End > RoutePortMax || s.PortRange.Start > s.PortRange.End {
		return fmt.Errorf("Traefik route port range must stay within %d-%d", RoutePortMin, RoutePortMax)
	}
	entryKeys := map[string]bool{}
	portKeys := map[string]bool{}
	for _, entry := range s.EntryPoints {
		if !routeKeyPattern.MatchString(entry.Name) || entry.Port == 0 || !oneOfString(string(entry.Protocol), string(RouteHTTP), string(RouteTCP), string(RouteUDP)) {
			return fmt.Errorf("Traefik entrypoint is invalid")
		}
		key := string(entry.Protocol) + "/" + strconv.Itoa(int(entry.Port))
		if entryKeys[entry.Name] || portKeys[key] {
			return fmt.Errorf("Traefik entrypoint name or protocol port conflicts")
		}
		entryKeys[entry.Name], portKeys[key] = true, true
	}
	for _, required := range []string{"web", "websecure", "internal-http", "metrics"} {
		if !entryKeys[required] {
			return fmt.Errorf("Traefik settings require the %s entrypoint", required)
		}
	}
	resolvers := map[string]bool{}
	for _, resolver := range s.Resolvers {
		if !resolverNamePattern.MatchString(resolver.Name) || !oneOfString(string(resolver.Challenge), string(ChallengeDNS01), string(ChallengeHTTP01), string(ChallengeTLSALPN01)) {
			return fmt.Errorf("Traefik certificate resolver is invalid")
		}
		if resolvers[resolver.Name] {
			return fmt.Errorf("Traefik certificate resolver names must be unique")
		}
		if resolver.Challenge == ChallengeDNS01 && resolver.DNSCredentialID == "" && resolver.Name != "cloudflare" && resolver.Name != "arvan" {
			if resolver.Provider != DNSProviderCloudflare && resolver.Provider != DNSProviderArvan {
				return fmt.Errorf("DNS-01 resolver requires a supported provider or DNS credential")
			}
		}
		if resolver.Challenge != ChallengeDNS01 && (resolver.Provider != "" || resolver.DNSCredentialID != "") {
			return fmt.Errorf("HTTP-01 and TLS-ALPN-01 resolvers cannot use DNS credentials")
		}
		resolvers[resolver.Name] = true
	}
	return nil
}

// ValidateForApply keeps legacy sealed records loadable while requiring every
// newly reviewed panel update to include the dashboard hostname used by the
// protected router.
func (s TraefikSettings) ValidateForApply() error {
	s = s.Normalize()
	if err := s.Validate(); err != nil {
		return err
	}
	if s.DashboardHost == "" {
		return fmt.Errorf("Traefik dashboard hostname is not configured")
	}
	return nil
}

func (r DNSRecordSpec) Normalize() DNSRecordSpec {
	r.ID = strings.ToLower(strings.TrimSpace(r.ID))
	r.CredentialID = strings.ToLower(strings.TrimSpace(r.CredentialID))
	r.Name = strings.ToLower(strings.TrimSuffix(strings.TrimSpace(r.Name), "."))
	r.Zone = strings.ToLower(strings.TrimSuffix(strings.TrimSpace(r.Zone), "."))
	r.Content = strings.TrimSuffix(strings.TrimSpace(r.Content), ".")
	if r.Version == 0 {
		r.Version = RoutingSchemaVersion
	}
	if r.TTL == 0 {
		r.TTL = 300
	}
	return r
}

func (r DNSRecordSpec) Validate(protocol RouteProtocol) error {
	r = r.Normalize()
	if r.Version != RoutingSchemaVersion || !providerIDPattern.MatchString(r.ID) || !providerIDPattern.MatchString(r.CredentialID) {
		return fmt.Errorf("DNS record identity is invalid")
	}
	if !safeHostname(r.Name) || !safeHostname(r.Zone) || (r.Name != r.Zone && !strings.HasSuffix(r.Name, "."+r.Zone)) {
		return fmt.Errorf("DNS record must belong to its zone")
	}
	if !oneOfString(string(r.Type), string(DNSRecordA), string(DNSRecordAAAA), string(DNSRecordCNAME)) {
		return fmt.Errorf("DNS record type must be A, AAAA, or CNAME")
	}
	switch r.Type {
	case DNSRecordA:
		if ip := net.ParseIP(r.Content); ip == nil || ip.To4() == nil {
			return fmt.Errorf("A record content must be an IPv4 address")
		}
	case DNSRecordAAAA:
		if ip := net.ParseIP(r.Content); ip == nil || ip.To4() != nil {
			return fmt.Errorf("AAAA record content must be an IPv6 address")
		}
	case DNSRecordCNAME:
		if !safeHostname(r.Content) {
			return fmt.Errorf("CNAME record content must be a hostname")
		}
	}
	if r.TTL < 60 || r.TTL > 86400 {
		return fmt.Errorf("DNS TTL must be between 60 and 86400 seconds")
	}
	if protocol != RouteHTTP && r.Proxied {
		return fmt.Errorf("raw TCP and UDP DNS records must remain DNS-only")
	}
	if !r.Managed && !r.Adopted {
		return fmt.Errorf("DNS record must be SwarmOps-managed or explicitly adopted")
	}
	return nil
}

func (f TraefikLogFilter) Normalize(now time.Time) TraefikLogFilter {
	if f.Limit == 0 {
		f.Limit = 200
	}
	if f.To.IsZero() {
		f.To = now.UTC()
	}
	if f.From.IsZero() {
		if f.Live {
			f.From = f.To.Add(-5 * time.Minute)
		} else {
			f.From = f.To.Add(-time.Hour)
		}
	}
	f.Level = strings.ToUpper(strings.TrimSpace(f.Level))
	f.Router = strings.TrimSpace(f.Router)
	f.Service = strings.TrimSpace(f.Service)
	f.RequestID = strings.TrimSpace(f.RequestID)
	return f
}

func (f TraefikLogFilter) Validate(now time.Time) error {
	f = f.Normalize(now)
	if f.To.Before(f.From) || f.To.Sub(f.From) > MaxTraefikLogRange {
		return fmt.Errorf("Traefik log range must be at most seven days")
	}
	if f.Limit < 1 || f.Limit > MaxTraefikLogRecords {
		return fmt.Errorf("Traefik log result limit must be between 1 and %d", MaxTraefikLogRecords)
	}
	if f.Level != "" && !oneOfString(f.Level, "DEBUG", "INFO", "WARN", "ERROR") {
		return fmt.Errorf("Traefik log level filter is invalid")
	}
	for _, value := range []string{f.Router, f.Service, f.RequestID} {
		if len(value) > 128 || strings.ContainsAny(value, "\r\n\x00") || !routerSafeTextPattern.MatchString(value) {
			return fmt.Errorf("Traefik log filter is invalid")
		}
	}
	return nil
}

func AllocateRoutePort(settings TraefikSettings, protocol RouteProtocol, routes []RouteSpec, requested uint16) (uint16, error) {
	settings = settings.Normalize()
	if protocol == RouteHTTP {
		return 0, nil
	}
	used := map[uint16]bool{}
	for _, route := range routes {
		if route.Protocol == protocol && route.ListenPort != 0 {
			used[route.ListenPort] = true
		}
	}
	for _, entry := range settings.EntryPoints {
		if entry.Protocol == protocol {
			used[entry.Port] = true
		}
	}
	if requested != 0 {
		if requested < settings.PortRange.Start || requested > settings.PortRange.End {
			return 0, fmt.Errorf("requested %s port is outside %d-%d", protocol, settings.PortRange.Start, settings.PortRange.End)
		}
		if used[requested] {
			return 0, fmt.Errorf("requested %s port %d is already allocated", protocol, requested)
		}
		return requested, nil
	}
	for port := settings.PortRange.Start; port <= settings.PortRange.End; port++ {
		if !used[port] {
			return port, nil
		}
	}
	return 0, fmt.Errorf("no free %s route port remains in %d-%d", protocol, settings.PortRange.Start, settings.PortRange.End)
}

func ValidateRouteCompatibility(route RouteSpec, settings TraefikSettings, records []DNSRecordSpec) error {
	route = route.Normalize()
	settings = settings.Normalize()
	if err := route.Validate(); err != nil {
		return err
	}
	if err := settings.Validate(); err != nil {
		return err
	}
	resolver, found := resolverFor(settings.Resolvers, route.Resolver)
	if route.TLS == RouteTLSTerminate && !found {
		return fmt.Errorf("route certificate resolver is not configured")
	}
	if route.TLS == RouteTLSTerminate && containsWildcard(append(append([]string{}, route.Match.Hosts...), route.Match.SNI...)) && resolver.Challenge != ChallengeDNS01 {
		return fmt.Errorf("wildcard certificates require DNS-01")
	}
	if route.Enabled && route.DNSReference != "" {
		var record *DNSRecordSpec
		for index := range records {
			if records[index].ID == route.DNSReference {
				record = &records[index]
				break
			}
		}
		if record == nil {
			return fmt.Errorf("route DNS reference was not found")
		}
		if err := record.Validate(route.Protocol); err != nil {
			return err
		}
	}
	return nil
}

func RenderRouteLabels(route RouteSpec, network string) (map[string]string, error) {
	route = route.Normalize()
	if err := route.Validate(); err != nil {
		return nil, err
	}
	if !dockerReferenceName.MatchString(network) {
		return nil, fmt.Errorf("route network name is invalid")
	}
	name := routeRouterName(route)
	labels := map[string]string{
		"swarmops.routing.version": strconv.Itoa(RoutingSchemaVersion),
		"swarmops.routing.route":   route.Key,
		"traefik.enable":           strconv.FormatBool(route.Enabled),
		"traefik.swarm.network":    network,
	}
	prefix := "traefik." + string(route.Protocol)
	labels[prefix+".services."+name+".loadbalancer.server.port"] = strconv.Itoa(int(route.TargetPort))
	switch route.Protocol {
	case RouteHTTP:
		if route.Scope == RoutePublic || route.Scope == RouteBoth {
			router := name + "-public"
			entrypoint := "web"
			if route.TLS != RouteTLSOff {
				entrypoint = "websecure"
			}
			labels[prefix+".routers."+router+".entrypoints"] = entrypoint
			labels[prefix+".routers."+router+".service"] = name
			labels[prefix+".routers."+router+".rule"] = renderHTTPRule(route.Match)
			labels[prefix+".routers."+router+".observability.metrics"] = strconv.FormatBool(route.Metrics)
			labels[prefix+".routers."+router+".observability.accesslogs"] = strconv.FormatBool(route.AccessLogs)
			if route.TLS == RouteTLSTerminate {
				labels[prefix+".routers."+router+".tls"] = "true"
				labels[prefix+".routers."+router+".tls.certresolver"] = route.Resolver
			}
		}
		if route.Scope == RouteInternal || route.Scope == RouteBoth {
			router := name + "-internal"
			internalMatch := RouteMatch{Hosts: []string{route.Key + ".swarmops.internal"}, PathPrefix: route.Match.PathPrefix}
			labels[prefix+".routers."+router+".entrypoints"] = "internal-http"
			labels[prefix+".routers."+router+".service"] = name
			labels[prefix+".routers."+router+".rule"] = renderHTTPRule(internalMatch)
			labels[prefix+".routers."+router+".observability.metrics"] = strconv.FormatBool(route.Metrics)
			labels[prefix+".routers."+router+".observability.accesslogs"] = strconv.FormatBool(route.AccessLogs)
		}
	case RouteTCP:
		labels[prefix+".routers."+name+".entrypoints"] = routeEntryPoint(route)
		labels[prefix+".routers."+name+".service"] = name
		labels[prefix+".routers."+name+".rule"] = renderSNIRule(route)
	case RouteUDP:
		labels[prefix+".routers."+name+".entrypoints"] = routeEntryPoint(route)
		labels[prefix+".routers."+name+".service"] = name
	}
	if route.Protocol == RouteTCP && route.TLS == RouteTLSTerminate {
		labels[prefix+".routers."+name+".tls"] = "true"
		labels[prefix+".routers."+name+".tls.certresolver"] = route.Resolver
	}
	if route.Protocol == RouteTCP && route.TLS == RouteTLSPassthrough {
		labels[prefix+".routers."+name+".tls.passthrough"] = "true"
	}
	owned := make([]string, 0, len(labels))
	for key := range labels {
		owned = append(owned, key)
	}
	sort.Strings(owned)
	labels["swarmops.routing.labels"] = strings.Join(owned, ",")
	return labels, nil
}

func RenderRouteManifestSnippet(route RouteSpec) (string, error) {
	network := RouteNetworkName(route.ServiceKey)
	labels, err := RenderRouteLabels(route, network)
	if err != nil {
		return "", err
	}
	doc := map[string]any{
		"services": map[string]any{
			"service": map[string]any{
				"networks": []string{"traefik-route"},
				"deploy":   map[string]any{"labels": labels},
			},
		},
		"networks": map[string]any{
			"traefik-route": map[string]any{"external": true, "name": network},
		},
	}
	data, err := yaml.Marshal(doc)
	if err != nil {
		return "", fmt.Errorf("render route manifest snippet: %w", err)
	}
	return string(data), nil
}

func RouteNetworkName(serviceKey string) string {
	clean := strings.ToLower(strings.TrimSpace(serviceKey))
	clean = regexp.MustCompile(`[^a-z0-9]+`).ReplaceAllString(clean, "-")
	clean = strings.Trim(clean, "-")
	if clean == "" {
		clean = "service"
	}
	sum := sha256.Sum256([]byte(serviceKey))
	suffix := hex.EncodeToString(sum[:4])
	if len(clean) > 42 {
		clean = clean[:42]
	}
	return "swarmops-route-" + clean + "-" + suffix
}

func routeRouterName(route RouteSpec) string {
	return route.Key + "-" + string(route.Protocol)
}

func routeEntryPoint(route RouteSpec) string {
	if route.Protocol == RouteHTTP {
		switch route.Scope {
		case RouteInternal:
			return "internal-http"
		case RouteBoth:
			if route.TLS == RouteTLSOff {
				return "web,internal-http"
			}
			return "websecure,internal-http"
		default:
			if route.TLS == RouteTLSOff {
				return "web"
			}
			return "websecure"
		}
	}
	return string(route.Protocol) + "-" + strconv.Itoa(int(route.ListenPort))
}

func renderHTTPRule(match RouteMatch) string {
	hosts := make([]string, 0, len(match.Hosts))
	for _, host := range match.Hosts {
		hosts = append(hosts, "`"+host+"`")
	}
	rule := "Host(" + strings.Join(hosts, ",") + ")"
	if match.PathPrefix != "" && match.PathPrefix != "/" {
		rule += " && PathPrefix(`" + match.PathPrefix + "`)"
	}
	return rule
}

func renderSNIRule(route RouteSpec) string {
	if len(route.Match.SNI) == 0 {
		return "HostSNI(`*`)"
	}
	items := make([]string, 0, len(route.Match.SNI))
	for _, host := range route.Match.SNI {
		items = append(items, "`"+host+"`")
	}
	return "HostSNI(" + strings.Join(items, ",") + ")"
}

func normalizeHosts(values []string) []string {
	seen := map[string]bool{}
	result := make([]string, 0, len(values))
	for _, value := range values {
		value = strings.ToLower(strings.TrimSuffix(strings.TrimSpace(value), "."))
		if value != "" && !seen[value] {
			seen[value] = true
			result = append(result, value)
		}
	}
	sort.Strings(result)
	return result
}

func validServiceKey(value string) bool {
	return value != "" && len(value) <= 128 && !strings.ContainsAny(value, "\r\n\x00") && regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9_.-]*$`).MatchString(value)
}

func routeIsPublic(scope RouteScope) bool { return scope == RoutePublic || scope == RouteBoth }

func resolverFor(values []ACMEPolicy, name string) (ACMEPolicy, bool) {
	for _, value := range values {
		if value.Name == name {
			return value, true
		}
	}
	return ACMEPolicy{}, false
}

func containsWildcard(values []string) bool {
	for _, value := range values {
		if strings.HasPrefix(value, "*.") {
			return true
		}
	}
	return false
}

func oneOfString(value string, values ...string) bool {
	for _, candidate := range values {
		if value == candidate {
			return true
		}
	}
	return false
}

func validCertificateFingerprint(value string) bool {
	return value == "" || certificateHash.MatchString(value)
}
