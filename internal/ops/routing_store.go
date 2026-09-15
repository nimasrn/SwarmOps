package ops

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/nimasrn/SwarmOps/internal/securestore"
	"github.com/nimasrn/SwarmOps/internal/sqlstore"
)

const (
	routingStateKey     = "traefik-routing-control-plane"
	routingStoreTimeout = 15 * time.Second
)

type RoutingState struct {
	Bindings        []DependencyBinding       `json:"bindings"`
	Certificates    []CertificateStatus       `json:"certificates"`
	Credentials     []DNSCredentialMetadata   `json:"credentials"`
	Cutover         *CutoverPlan              `json:"cutover,omitempty"`
	CutoverRollback *CutoverRollbackPlan      `json:"cutoverRollback,omitempty"`
	Declarations    []ServiceRouteDeclaration `json:"declarations"`
	DNSRecords      []DNSRecordSpec           `json:"dnsRecords"`
	Domains         []DomainSpec              `json:"domains"`
	Routes          []RouteSpec               `json:"routes"`
	Runtime         []RouteRuntime            `json:"runtime"`
	Settings        TraefikSettings           `json:"settings"`
	Version         int                       `json:"version"`
}

// routingCluster is the in-memory working copy of one cluster's routing rows.
// A mutation is applied to it and the whole cluster is validated before any row
// is written, exactly as when the cluster was one sealed document.
type routingCluster struct {
	Bindings        map[string]DependencyBinding       `json:"bindings"`
	Certificates    map[string]CertificateStatus       `json:"certificates"`
	Credentials     map[string][]DNSCredentialMetadata `json:"credentials"`
	Cutover         *CutoverPlan                       `json:"cutover,omitempty"`
	CutoverRollback *CutoverRollbackPlan               `json:"cutoverRollback,omitempty"`
	Declarations    map[string]ServiceRouteDeclaration `json:"declarations"`
	DNSRecords      map[string]DNSRecordSpec           `json:"dnsRecords"`
	Domains         map[string]DomainSpec              `json:"domains"`
	Routes          map[string]RouteSpec               `json:"routes"`
	Runtime         map[string]RouteRuntime            `json:"runtime"`
	Secrets         map[string]string                  `json:"secrets"`
	Settings        TraefikSettings                    `json:"settings"`
}

type routingFile struct {
	Clusters map[string]*routingCluster `json:"clusters"`
	Version  int                        `json:"version"`
}

// RoutingStore keeps desired routing state and sealed DNS credential material
// in the controller database. Public snapshots construct metadata-only copies
// and never expose a secret. Each change to a cluster runs in one transaction
// that locks the cluster's routing_clusters row.
type RoutingStore struct {
	db           *sqlstore.DB
	defaultEmail string
	mu           sync.Mutex
	now          func() time.Time
}

func NewRoutingStore(db *sqlstore.DB, defaultACMEEmail string) (*RoutingStore, error) {
	if db == nil {
		return nil, fmt.Errorf("routing store requires a database")
	}
	return &RoutingStore{db: db, defaultEmail: strings.TrimSpace(defaultACMEEmail), now: time.Now}, nil
}

func dnsCredentialPurpose(clusterID, credentialID string, version int) string {
	return sqlstore.Purpose("dns_credential_versions", "secret_sealed", clusterID, credentialID, fmt.Sprint(version))
}

func (s *RoutingStore) Snapshot(clusterID string) (RoutingState, error) {
	if s == nil {
		return RoutingState{}, fmt.Errorf("routing state is not configured")
	}
	if !validClusterID(clusterID) {
		return RoutingState{}, fmt.Errorf("selected server identifier is invalid")
	}
	ctx, cancel := context.WithTimeout(context.Background(), routingStoreTimeout)
	defer cancel()
	cluster, err := s.loadCluster(ctx, s.db.Pool(), clusterID, false, false)
	if err != nil {
		return RoutingState{}, fmt.Errorf("read routing state: %w", err)
	}
	if cluster == nil {
		settings := DefaultTraefikSettings(s.defaultEmail)
		return RoutingState{Bindings: []DependencyBinding{}, Certificates: []CertificateStatus{}, Credentials: []DNSCredentialMetadata{}, Declarations: []ServiceRouteDeclaration{}, DNSRecords: []DNSRecordSpec{}, Domains: []DomainSpec{}, Routes: []RouteSpec{}, Runtime: []RouteRuntime{}, Settings: settings, Version: RoutingSchemaVersion}, nil
	}
	return publicRoutingState(cluster), nil
}

func (s *RoutingStore) PutDeclaration(clusterID string, declaration ServiceRouteDeclaration) error {
	declaration = declaration.Normalize()
	if err := declaration.Validate(); err != nil {
		return err
	}
	return s.update(clusterID, func(cluster *routingCluster) error {
		cluster.Declarations[declaration.ServiceKey] = declaration
		return nil
	})
}

func (s *RoutingStore) PutSettings(clusterID string, settings TraefikSettings) error {
	settings = settings.Normalize()
	if err := settings.Validate(); err != nil {
		return err
	}
	return s.update(clusterID, func(cluster *routingCluster) error {
		cluster.Settings = cloneSettings(settings)
		return nil
	})
}

func (s *RoutingStore) PutRoute(clusterID string, route RouteSpec) error {
	route = route.Normalize()
	if err := route.Validate(); err != nil {
		return err
	}
	return s.update(clusterID, func(cluster *routingCluster) error {
		if err := ValidateRouteCompatibility(route, cluster.Settings, mapDNSRecords(cluster.DNSRecords)); err != nil {
			return err
		}
		if err := ValidateRouteAdmission(route, mapDNSRecords(cluster.DNSRecords), mapDomains(cluster.Domains)); err != nil {
			return err
		}
		for key, existing := range cluster.Routes {
			if key == route.Key {
				continue
			}
			if existing.ServiceKey == route.ServiceKey && existing.Protocol == route.Protocol {
				return fmt.Errorf("service %q already has a %s route", route.ServiceKey, route.Protocol)
			}
			if route.Protocol != RouteHTTP && existing.Protocol == route.Protocol && existing.ListenPort == route.ListenPort {
				return fmt.Errorf("%s listen port %d is already allocated to route %q", route.Protocol, route.ListenPort, existing.Key)
			}
			if route.Protocol == RouteHTTP && hostOverlap(existing.Match.Hosts, route.Match.Hosts) && pathOverlap(existing.Match.PathPrefix, route.Match.PathPrefix) {
				return fmt.Errorf("HTTP host and path conflict with route %q", existing.Key)
			}
		}
		cluster.Routes[route.Key] = route
		return nil
	})
}

func (s *RoutingStore) RemoveRoute(clusterID, key string) error {
	key = strings.ToLower(strings.TrimSpace(key))
	if !routeKeyPattern.MatchString(key) {
		return fmt.Errorf("route key is invalid")
	}
	return s.update(clusterID, func(cluster *routingCluster) error {
		for _, binding := range cluster.Bindings {
			if binding.TargetRoute == key {
				return fmt.Errorf("route is still used by dependency binding %q", binding.Name)
			}
		}
		delete(cluster.Routes, key)
		delete(cluster.Runtime, key)
		delete(cluster.Certificates, key)
		return nil
	})
}

// platformMetricsRoute reports whether a dependency target is one of the two
// synthetic platform metrics endpoints rather than a stored route.
func platformMetricsRoute(target string) bool {
	return target == platformSwarmOpsMetricsRoute || target == platformTraefikMetricsRoute
}

func (s *RoutingStore) PutBinding(clusterID string, binding DependencyBinding) error {
	binding = binding.Normalize()
	if err := binding.Validate(); err != nil {
		return err
	}
	return s.update(clusterID, func(cluster *routingCluster) error {
		// The platform metrics targets are synthetic: ApplyDependencyBinding
		// resolves them to fixed internal aliases precisely because no stored
		// route exists for the controller's own or Traefik's metrics endpoint.
		// Requiring a stored route here contradicted that and made enabling
		// observability fail with "dependency target route was not found",
		// permanently so for a host-native controller that is not a Swarm
		// service at all.
		if _, found := cluster.Routes[binding.TargetRoute]; !found && !platformMetricsRoute(binding.TargetRoute) {
			return fmt.Errorf("dependency target route was not found")
		}
		key := dependencyBindingKey(binding)
		for existingKey, existing := range cluster.Bindings {
			// Only a NAMED delivery can collide: the name becomes an injected
			// variable on the caller. An unnamed binding delivers nothing, and
			// treating those as conflicting stopped one caller from depending
			// on more than one target — which is exactly what the observability
			// stack does, binding Prometheus to Alertmanager and to each
			// metrics endpoint it scrapes.
			if binding.Name == "" {
				continue
			}
			if existingKey != key && existing.CallerService == binding.CallerService && existing.Name == binding.Name {
				return fmt.Errorf("dependency binding delivery name conflicts")
			}
		}
		cluster.Bindings[key] = binding
		return nil
	})
}

func (s *RoutingStore) RemoveBinding(clusterID, caller, target, name string) error {
	binding := DependencyBinding{CallerService: caller, Name: name, TargetRoute: target, Version: RoutingSchemaVersion}.Normalize()
	if !validServiceKey(binding.CallerService) || !routeKeyPattern.MatchString(binding.TargetRoute) {
		return fmt.Errorf("dependency binding identity is invalid")
	}
	return s.update(clusterID, func(cluster *routingCluster) error {
		delete(cluster.Bindings, dependencyBindingKey(binding))
		return nil
	})
}

// RotateCredential validates and seals a new provider secret while retaining
// every prior immutable version. The caller separately creates the matching
// Swarm secret before switching any resolver to it.
func (s *RoutingStore) RotateCredential(clusterID, id, name string, provider DNSProvider, identity DNSCredentialIdentity, secret []byte) (DNSCredentialMetadata, error) {
	id = strings.ToLower(strings.TrimSpace(id))
	name = strings.TrimSpace(name)
	if !providerIDPattern.MatchString(id) || name == "" || len(name) > 96 || strings.ContainsAny(name, "\r\n\x00") {
		return DNSCredentialMetadata{}, fmt.Errorf("DNS credential metadata is invalid")
	}
	if provider != DNSProviderCloudflare && provider != DNSProviderArvan {
		return DNSCredentialMetadata{}, fmt.Errorf("DNS provider is unsupported")
	}
	identity = identity.Normalize()
	if err := identity.Validate(provider); err != nil {
		return DNSCredentialMetadata{}, err
	}
	value := strings.TrimSpace(string(secret))
	if provider == DNSProviderArvan {
		value = strings.TrimSpace(strings.TrimPrefix(value, "Apikey "))
	}
	for index := range secret {
		secret[index] = 0
	}
	if len(value) < 16 || len(value) > 4096 || strings.ContainsAny(value, "\r\n\x00 \t") {
		return DNSCredentialMetadata{}, fmt.Errorf("DNS credential must be one protected token between 16 and 4096 characters")
	}
	var created DNSCredentialMetadata
	err := s.update(clusterID, func(cluster *routingCluster) error {
		versions := cluster.Credentials[id]
		if len(versions) > 0 && versions[len(versions)-1].Provider != provider {
			return fmt.Errorf("DNS credential provider cannot change during rotation")
		}
		version := len(versions) + 1
		secretName := fmt.Sprintf("traefik_dns_%s_%s_v%d", provider, id, version)
		if !dockerReferenceName.MatchString(secretName) {
			return fmt.Errorf("generated Swarm secret name is invalid")
		}
		created = DNSCredentialMetadata{
			AccountID:  identity.AccountID,
			CreatedAt:  s.now().UTC().Truncate(time.Microsecond),
			Email:      identity.Email,
			ID:         id,
			Name:       name,
			Provider:   provider,
			SecretName: secretName,
			State:      "sealed",
			Version:    version,
		}
		cluster.Credentials[id] = append(versions, created)
		cluster.Secrets[secretName] = value
		return nil
	})
	value = ""
	return created, err
}

func (s *RoutingStore) CredentialSecret(clusterID, id string, version int) (DNSCredentialMetadata, string, error) {
	if s == nil || !validClusterID(clusterID) {
		return DNSCredentialMetadata{}, "", fmt.Errorf("routing state is not configured")
	}
	id = strings.ToLower(strings.TrimSpace(id))
	ctx, cancel := context.WithTimeout(context.Background(), routingStoreTimeout)
	defer cancel()
	cluster, err := s.loadCluster(ctx, s.db.Pool(), clusterID, false, true)
	if err != nil {
		return DNSCredentialMetadata{}, "", fmt.Errorf("read routing state: %w", err)
	}
	if cluster == nil {
		return DNSCredentialMetadata{}, "", fmt.Errorf("DNS credential was not found")
	}
	versions := cluster.Credentials[id]
	if version <= 0 {
		version = len(versions)
	}
	if version < 1 || version > len(versions) {
		return DNSCredentialMetadata{}, "", fmt.Errorf("DNS credential version was not found")
	}
	metadata := versions[version-1]
	secret, found := cluster.Secrets[metadata.SecretName]
	if !found || secret == "" {
		return DNSCredentialMetadata{}, "", fmt.Errorf("sealed DNS credential value is unavailable")
	}
	return metadata, secret, nil
}

func (s *RoutingStore) MarkCredentialValidated(clusterID, id string, version int) error {
	return s.update(clusterID, func(cluster *routingCluster) error {
		versions := cluster.Credentials[id]
		if version < 1 || version > len(versions) {
			return fmt.Errorf("DNS credential version was not found")
		}
		now := s.now().UTC().Truncate(time.Microsecond)
		versions[version-1].State = "validated"
		versions[version-1].ValidatedAt = &now
		cluster.Credentials[id] = versions
		return nil
	})
}

func (s *RoutingStore) RemoveCredentialVersion(clusterID, id string, version int) error {
	return s.update(clusterID, func(cluster *routingCluster) error {
		versions := cluster.Credentials[id]
		if version < 1 || version > len(versions) {
			return fmt.Errorf("DNS credential version was not found")
		}
		if version == len(versions) {
			return fmt.Errorf("latest DNS credential version cannot be removed")
		}
		metadata := versions[version-1]
		delete(cluster.Secrets, metadata.SecretName)
		versions[version-1].State = "removed"
		cluster.Credentials[id] = versions
		return nil
	})
}

func (s *RoutingStore) PutDNSRecord(clusterID string, record DNSRecordSpec, protocol RouteProtocol) error {
	record = record.Normalize()
	if err := record.Validate(protocol); err != nil {
		return err
	}
	return s.update(clusterID, func(cluster *routingCluster) error {
		if err := ValidateDomainAdmission(record, mapDomains(cluster.Domains)); err != nil {
			return err
		}
		if versions := cluster.Credentials[record.CredentialID]; len(versions) == 0 || versions[len(versions)-1].State == "removed" {
			return fmt.Errorf("DNS record credential was not found")
		}
		for key, existing := range cluster.DNSRecords {
			if key != record.ID && existing.Name == record.Name && existing.Type == record.Type {
				return fmt.Errorf("DNS record name and type already exist")
			}
		}
		cluster.DNSRecords[record.ID] = record
		return nil
	})
}

func (s *RoutingStore) RemoveDNSRecord(clusterID, id string) error {
	id = strings.ToLower(strings.TrimSpace(id))
	return s.update(clusterID, func(cluster *routingCluster) error {
		record, found := cluster.DNSRecords[id]
		if !found {
			return nil
		}
		if !record.Managed && !record.Adopted {
			return fmt.Errorf("DNS record is not owned or adopted by SwarmOps")
		}
		for _, route := range cluster.Routes {
			if route.DNSReference == id {
				return fmt.Errorf("DNS record remains referenced by route %q", route.Key)
			}
		}
		delete(cluster.DNSRecords, id)
		return nil
	})
}

// PutDomain accepts an apex zone for this gateway. Nothing about a zone is
// published by accepting it; acceptance only unlocks creating records under it.
func (s *RoutingStore) PutDomain(clusterID string, domain DomainSpec) error {
	domain = domain.Normalize()
	if err := domain.Validate(); err != nil {
		return err
	}
	return s.update(clusterID, func(cluster *routingCluster) error {
		if existing, found := cluster.Domains[domain.Zone]; found && !existing.CreatedAt.IsZero() {
			domain.CreatedAt = existing.CreatedAt
		} else if domain.CreatedAt.IsZero() {
			domain.CreatedAt = s.now().UTC().Truncate(time.Microsecond)
		}
		cluster.Domains[domain.Zone] = domain
		return nil
	})
}

// RemoveDomain withdraws acceptance. It refuses while anything still depends on
// the zone, so withdrawal can never leave a record or route published under a
// domain the gateway no longer accepts.
func (s *RoutingStore) RemoveDomain(clusterID, zone string) error {
	zone = strings.ToLower(strings.TrimSuffix(strings.TrimSpace(zone), "."))
	return s.update(clusterID, func(cluster *routingCluster) error {
		if _, found := cluster.Domains[zone]; !found {
			return nil
		}
		remaining := make([]DomainSpec, 0, len(cluster.Domains))
		for key, domain := range cluster.Domains {
			if key != zone {
				remaining = append(remaining, domain)
			}
		}
		for _, record := range cluster.DNSRecords {
			if _, found := acceptedZone(remaining, record.Normalize().Name); !found {
				return fmt.Errorf("domain %q still owns DNS record %q", zone, record.ID)
			}
		}
		for _, route := range cluster.Routes {
			if err := ValidateRouteAdmission(route, mapDNSRecords(cluster.DNSRecords), remaining); err != nil {
				return fmt.Errorf("domain %q still owns route %q", zone, route.Key)
			}
		}
		delete(cluster.Domains, zone)
		return nil
	})
}

func (s *RoutingStore) PutCertificate(clusterID string, certificate CertificateStatus) error {
	certificate.RouteKey = strings.ToLower(strings.TrimSpace(certificate.RouteKey))
	certificate.Domains = normalizeHosts(certificate.Domains)
	if certificate.Version == 0 {
		certificate.Version = RoutingSchemaVersion
	}
	if certificate.Version != RoutingSchemaVersion || !routeKeyPattern.MatchString(certificate.RouteKey) || !validCertificateFingerprint(certificate.Fingerprint) {
		return fmt.Errorf("certificate status is invalid")
	}
	return s.update(clusterID, func(cluster *routingCluster) error {
		if _, found := cluster.Routes[certificate.RouteKey]; !found {
			return fmt.Errorf("certificate route was not found")
		}
		cluster.Certificates[certificate.RouteKey] = certificate
		return nil
	})
}

func (s *RoutingStore) PutRuntime(clusterID string, runtime RouteRuntime) error {
	runtime.RouteKey = strings.ToLower(strings.TrimSpace(runtime.RouteKey))
	if runtime.Version == 0 {
		runtime.Version = RoutingSchemaVersion
	}
	if runtime.Version != RoutingSchemaVersion || !routeKeyPattern.MatchString(runtime.RouteKey) || !oneOfString(string(runtime.Protocol), string(RouteHTTP), string(RouteTCP), string(RouteUDP)) {
		return fmt.Errorf("route runtime state is invalid")
	}
	if runtime.ObservedAt.IsZero() {
		runtime.ObservedAt = s.now().UTC()
	}
	if len(runtime.Errors) > 20 {
		runtime.Errors = runtime.Errors[:20]
	}
	for index := range runtime.Errors {
		runtime.Errors[index] = sanitizeRuntimeError(runtime.Errors[index])
	}
	return s.update(clusterID, func(cluster *routingCluster) error {
		cluster.Runtime[runtime.RouteKey] = runtime
		return nil
	})
}

func (s *RoutingStore) PutCutover(clusterID string, plan CutoverPlan) error {
	if plan.Version == 0 {
		plan.Version = RoutingSchemaVersion
	}
	if plan.Version != RoutingSchemaVersion {
		return fmt.Errorf("cutover plan version is invalid")
	}
	return s.update(clusterID, func(cluster *routingCluster) error {
		copy := plan
		cluster.Cutover = &copy
		return nil
	})
}

func (s *RoutingStore) PutCutoverRollback(clusterID string, plan CutoverRollbackPlan) error {
	if plan.Version == 0 {
		plan.Version = RoutingSchemaVersion
	}
	if plan.Version != RoutingSchemaVersion {
		return fmt.Errorf("cutover rollback plan version is invalid")
	}
	return s.update(clusterID, func(cluster *routingCluster) error {
		copy := plan
		cluster.CutoverRollback = &copy
		return nil
	})
}

func (s *RoutingStore) ClearCutoverRollback(clusterID string) error {
	return s.update(clusterID, func(cluster *routingCluster) error {
		cluster.CutoverRollback = nil
		return nil
	})
}

// update applies one mutation to a cluster inside a transaction: lock the
// cluster row, load every routing row with the sealed secrets opened, run the
// mutation on a working copy, validate the whole cluster, and write it back.
// A mutation or validation error writes nothing.
func (s *RoutingStore) update(clusterID string, mutation func(*routingCluster) error) error {
	if s == nil || s.db == nil {
		return fmt.Errorf("routing state is not configured")
	}
	if !validClusterID(clusterID) {
		return fmt.Errorf("selected server identifier is invalid")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	ctx, cancel := context.WithTimeout(context.Background(), routingStoreTimeout)
	defer cancel()
	var mutationErr error
	err := s.db.WithTx(ctx, func(tx *sql.Tx) error {
		if _, err := tx.ExecContext(ctx, `INSERT INTO routing_clusters (cluster_id, settings_json, updated_at) VALUES (?, ?, UTC_TIMESTAMP(6))
			ON DUPLICATE KEY UPDATE cluster_id = cluster_id`, clusterID, mustJSON(DefaultTraefikSettings(s.defaultEmail))); err != nil {
			return err
		}
		existing, err := s.loadCluster(ctx, tx, clusterID, true, true)
		if err != nil {
			return err
		}
		working := cloneRoutingCluster(existing, s.defaultEmail)
		if err := mutation(working); err != nil {
			mutationErr = err
			return err
		}
		if err := validateRoutingCluster(working); err != nil {
			mutationErr = err
			return err
		}
		return s.writeCluster(ctx, tx, clusterID, working)
	})
	if mutationErr != nil {
		return mutationErr
	}
	if err != nil {
		return fmt.Errorf("save routing state: %w", err)
	}
	return nil
}

type routingQueryer interface {
	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
	QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error)
}

// loadCluster reads one cluster's rows, or nil when the cluster has none. lock
// takes the cluster row FOR UPDATE; secrets opens the sealed credential values,
// which only a mutation or CredentialSecret needs.
func (s *RoutingStore) loadCluster(ctx context.Context, q routingQueryer, clusterID string, lock, secrets bool) (*routingCluster, error) {
	suffix := ""
	if lock {
		suffix = " FOR UPDATE"
	}
	var settingsJSON []byte
	var cutoverJSON, rollbackJSON []byte
	err := q.QueryRowContext(ctx, "SELECT settings_json, cutover_json, cutover_rollback_json FROM routing_clusters WHERE cluster_id = ?"+suffix, clusterID).
		Scan(&settingsJSON, &cutoverJSON, &rollbackJSON)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	cluster := &routingCluster{}
	if err := json.Unmarshal(settingsJSON, &cluster.Settings); err != nil {
		return nil, fmt.Errorf("decode Traefik settings: %w", err)
	}
	if len(cutoverJSON) > 0 {
		cluster.Cutover = &CutoverPlan{}
		if err := json.Unmarshal(cutoverJSON, cluster.Cutover); err != nil {
			return nil, fmt.Errorf("decode cutover plan: %w", err)
		}
	}
	if len(rollbackJSON) > 0 {
		cluster.CutoverRollback = &CutoverRollbackPlan{}
		if err := json.Unmarshal(rollbackJSON, cluster.CutoverRollback); err != nil {
			return nil, fmt.Errorf("decode cutover rollback plan: %w", err)
		}
	}
	cluster.Routes = map[string]RouteSpec{}
	cluster.Bindings = map[string]DependencyBinding{}
	cluster.Credentials = map[string][]DNSCredentialMetadata{}
	cluster.DNSRecords = map[string]DNSRecordSpec{}
	cluster.Domains = map[string]DomainSpec{}
	cluster.Declarations = map[string]ServiceRouteDeclaration{}
	cluster.Certificates = map[string]CertificateStatus{}
	cluster.Runtime = map[string]RouteRuntime{}
	cluster.Secrets = map[string]string{}

	scan := func(query string, fn func(*sql.Rows) error) error {
		rows, err := q.QueryContext(ctx, query, clusterID)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			if err := fn(rows); err != nil {
				return err
			}
		}
		return rows.Err()
	}
	if err := scan(`SELECT route_key, service_key, protocol, scope, tls_mode, listen_port, target_port, path_prefix, health_kind,
		health_path, health_timeout_seconds, dns_reference, resolver, enabled, managed, metrics, access_logs, public_allow, is_sensitive, version
		FROM routes WHERE cluster_id = ?`, func(rows *sql.Rows) error {
		var route RouteSpec
		var protocol, scope, tls string
		var listenPort sql.NullInt32
		var pathPrefix, healthPath, dnsReference, resolver sql.NullString
		if err := rows.Scan(&route.Key, &route.ServiceKey, &protocol, &scope, &tls, &listenPort, &route.TargetPort, &pathPrefix, &route.Health.Kind,
			&healthPath, &route.Health.TimeoutSeconds, &dnsReference, &resolver, &route.Enabled, &route.Managed, &route.Metrics, &route.AccessLogs,
			&route.PublicAllow, &route.Sensitive, &route.Version); err != nil {
			return err
		}
		route.Protocol, route.Scope, route.TLS = RouteProtocol(protocol), RouteScope(scope), RouteTLSMode(tls)
		route.ListenPort = uint16(listenPort.Int32)
		route.Match.PathPrefix, route.Health.Path, route.DNSReference, route.Resolver = pathPrefix.String, healthPath.String, dnsReference.String, resolver.String
		cluster.Routes[route.Key] = route
		return nil
	}); err != nil {
		return nil, err
	}
	if err := scan("SELECT route_key, kind, hostname FROM route_hosts WHERE cluster_id = ? ORDER BY route_key, kind, position", func(rows *sql.Rows) error {
		var key, kind, hostname string
		if err := rows.Scan(&key, &kind, &hostname); err != nil {
			return err
		}
		route := cluster.Routes[key]
		if kind == "sni" {
			route.Match.SNI = append(route.Match.SNI, hostname)
		} else {
			route.Match.Hosts = append(route.Match.Hosts, hostname)
		}
		cluster.Routes[key] = route
		return nil
	}); err != nil {
		return nil, err
	}
	if err := scan("SELECT caller_service, target_route, name, delivery, version FROM dependency_bindings WHERE cluster_id = ?", func(rows *sql.Rows) error {
		var binding DependencyBinding
		var delivery string
		if err := rows.Scan(&binding.CallerService, &binding.TargetRoute, &binding.Name, &delivery, &binding.Version); err != nil {
			return err
		}
		binding.Delivery = DependencyDelivery(delivery)
		cluster.Bindings[dependencyBindingKey(binding)] = binding
		return nil
	}); err != nil {
		return nil, err
	}
	if err := scan("SELECT service_key, role, reason, version FROM service_route_declarations WHERE cluster_id = ?", func(rows *sql.Rows) error {
		var declaration ServiceRouteDeclaration
		var role string
		var reason sql.NullString
		if err := rows.Scan(&declaration.ServiceKey, &role, &reason, &declaration.Version); err != nil {
			return err
		}
		declaration.Role, declaration.Reason = ServiceRouteRole(role), reason.String
		cluster.Declarations[declaration.ServiceKey] = declaration
		return nil
	}); err != nil {
		return nil, err
	}
	if err := scan("SELECT zone, note, created_at, version FROM routing_domains WHERE cluster_id = ?", func(rows *sql.Rows) error {
		var domain DomainSpec
		var note sql.NullString
		var created sql.NullTime
		if err := rows.Scan(&domain.Zone, &note, &created, &domain.Version); err != nil {
			return err
		}
		domain.Note, domain.CreatedAt = note.String, created.Time
		cluster.Domains[domain.Zone] = domain
		return nil
	}); err != nil {
		return nil, err
	}
	if err := scan(`SELECT credential_id, version, name, provider, account_id, email, secret_name, state, created_at, validated_at, secret_sealed
		FROM dns_credential_versions WHERE cluster_id = ? ORDER BY credential_id, version`, func(rows *sql.Rows) error {
		var metadata DNSCredentialMetadata
		var provider string
		var accountID, email sql.NullString
		var validated sql.NullTime
		var sealed []byte
		if err := rows.Scan(&metadata.ID, &metadata.Version, &metadata.Name, &provider, &accountID, &email, &metadata.SecretName, &metadata.State,
			&metadata.CreatedAt, &validated, &sealed); err != nil {
			return err
		}
		metadata.Provider, metadata.AccountID, metadata.Email = DNSProvider(provider), accountID.String, email.String
		if validated.Valid {
			value := validated.Time
			metadata.ValidatedAt = &value
		}
		cluster.Credentials[metadata.ID] = append(cluster.Credentials[metadata.ID], metadata)
		if secrets && len(sealed) > 0 {
			secret, err := s.db.OpenString(dnsCredentialPurpose(clusterID, metadata.ID, metadata.Version), sealed)
			if err != nil {
				return err
			}
			cluster.Secrets[metadata.SecretName] = secret
		}
		return nil
	}); err != nil {
		return nil, err
	}
	if err := scan(`SELECT id, zone, name, type, content, ttl, proxied, managed, adopted, credential_id, provider_record_id, version
		FROM dns_records WHERE cluster_id = ?`, func(rows *sql.Rows) error {
		var record DNSRecordSpec
		var recordType string
		var providerRecordID sql.NullString
		if err := rows.Scan(&record.ID, &record.Zone, &record.Name, &recordType, &record.Content, &record.TTL, &record.Proxied, &record.Managed,
			&record.Adopted, &record.CredentialID, &providerRecordID, &record.Version); err != nil {
			return err
		}
		record.Type, record.ProviderRecordID = DNSRecordType(recordType), providerRecordID.String
		cluster.DNSRecords[record.ID] = record
		return nil
	}); err != nil {
		return nil, err
	}
	if err := scan(`SELECT route_key, state, issuer, fingerprint, resolver, handshake_valid, failure_summary, last_attempt, not_before, not_after, version
		FROM route_certificates WHERE cluster_id = ?`, func(rows *sql.Rows) error {
		var certificate CertificateStatus
		var issuer, fingerprint, failure sql.NullString
		var lastAttempt, notBefore, notAfter sql.NullTime
		if err := rows.Scan(&certificate.RouteKey, &certificate.State, &issuer, &fingerprint, &certificate.Resolver, &certificate.HandshakeValid,
			&failure, &lastAttempt, &notBefore, &notAfter, &certificate.Version); err != nil {
			return err
		}
		certificate.Issuer, certificate.Fingerprint, certificate.FailureSummary = issuer.String, fingerprint.String, failure.String
		certificate.LastAttempt, certificate.NotBefore, certificate.NotAfter = nullTimePointer(lastAttempt), nullTimePointer(notBefore), nullTimePointer(notAfter)
		cluster.Certificates[certificate.RouteKey] = certificate
		return nil
	}); err != nil {
		return nil, err
	}
	if err := scan("SELECT route_key, domain FROM route_certificate_domains WHERE cluster_id = ? ORDER BY route_key, position", func(rows *sql.Rows) error {
		var key, domain string
		if err := rows.Scan(&key, &domain); err != nil {
			return err
		}
		certificate := cluster.Certificates[key]
		certificate.Domains = append(certificate.Domains, domain)
		cluster.Certificates[key] = certificate
		return nil
	}); err != nil {
		return nil, err
	}
	if err := scan("SELECT route_key, protocol, router, service, state, observed_at, version FROM route_runtime WHERE cluster_id = ?", func(rows *sql.Rows) error {
		var runtime RouteRuntime
		var protocol string
		if err := rows.Scan(&runtime.RouteKey, &protocol, &runtime.Router, &runtime.Service, &runtime.State, &runtime.ObservedAt, &runtime.Version); err != nil {
			return err
		}
		runtime.Protocol = RouteProtocol(protocol)
		runtime.EntryPoints = []string{}
		cluster.Runtime[runtime.RouteKey] = runtime
		return nil
	}); err != nil {
		return nil, err
	}
	if err := scan("SELECT route_key, entry_point FROM route_runtime_entry_points WHERE cluster_id = ? ORDER BY route_key, position", func(rows *sql.Rows) error {
		var key, entryPoint string
		if err := rows.Scan(&key, &entryPoint); err != nil {
			return err
		}
		runtime := cluster.Runtime[key]
		runtime.EntryPoints = append(runtime.EntryPoints, entryPoint)
		cluster.Runtime[key] = runtime
		return nil
	}); err != nil {
		return nil, err
	}
	if err := scan("SELECT route_key, message FROM route_runtime_errors WHERE cluster_id = ? ORDER BY route_key, position", func(rows *sql.Rows) error {
		var key, message string
		if err := rows.Scan(&key, &message); err != nil {
			return err
		}
		runtime := cluster.Runtime[key]
		runtime.Errors = append(runtime.Errors, message)
		cluster.Runtime[key] = runtime
		return nil
	}); err != nil {
		return nil, err
	}
	return cluster, nil
}

// writeCluster replaces one cluster's rows with the validated working copy.
// Child rows are deleted before their parents are, and inserted after them.
func (s *RoutingStore) writeCluster(ctx context.Context, tx *sql.Tx, clusterID string, cluster *routingCluster) error {
	exec := func(query string, args ...any) error {
		_, err := tx.ExecContext(ctx, query, args...)
		return err
	}
	var cutover, rollback any
	if cluster.Cutover != nil {
		cutover = mustJSON(cluster.Cutover)
	}
	if cluster.CutoverRollback != nil {
		rollback = mustJSON(cluster.CutoverRollback)
	}
	if err := exec("UPDATE routing_clusters SET settings_json = ?, cutover_json = ?, cutover_rollback_json = ?, updated_at = UTC_TIMESTAMP(6) WHERE cluster_id = ?",
		mustJSON(cluster.Settings), cutover, rollback, clusterID); err != nil {
		return err
	}
	for _, table := range []string{"route_runtime_errors", "route_runtime_entry_points", "route_runtime", "route_certificate_domains", "route_certificates",
		"route_hosts", "routes", "dependency_bindings", "service_route_declarations", "routing_domains", "dns_credential_versions", "dns_records"} {
		if err := exec("DELETE FROM "+table+" WHERE cluster_id = ?", clusterID); err != nil {
			return err
		}
	}
	for _, route := range cluster.Routes {
		if err := exec(`INSERT INTO routes (cluster_id, route_key, service_key, protocol, scope, tls_mode, listen_port, target_port, path_prefix,
			health_kind, health_path, health_timeout_seconds, dns_reference, resolver, enabled, managed, metrics, access_logs, public_allow, is_sensitive, version)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			clusterID, route.Key, route.ServiceKey, string(route.Protocol), string(route.Scope), string(route.TLS), nullablePort(route.ListenPort),
			route.TargetPort, nullableText(route.Match.PathPrefix), route.Health.Kind, nullableText(route.Health.Path), route.Health.TimeoutSeconds,
			nullableText(route.DNSReference), nullableText(route.Resolver), route.Enabled, route.Managed, route.Metrics, route.AccessLogs,
			route.PublicAllow, route.Sensitive, route.Version); err != nil {
			return err
		}
		for kind, hosts := range map[string][]string{"host": route.Match.Hosts, "sni": route.Match.SNI} {
			for position, hostname := range hosts {
				if err := exec("INSERT INTO route_hosts (cluster_id, route_key, kind, position, hostname) VALUES (?, ?, ?, ?, ?)",
					clusterID, route.Key, kind, position, hostname); err != nil {
					return err
				}
			}
		}
	}
	for _, binding := range cluster.Bindings {
		if err := exec("INSERT INTO dependency_bindings (cluster_id, caller_service, target_route, name, delivery, version) VALUES (?, ?, ?, ?, ?, ?)",
			clusterID, binding.CallerService, binding.TargetRoute, binding.Name, string(binding.Delivery), binding.Version); err != nil {
			return err
		}
	}
	for _, declaration := range cluster.Declarations {
		if err := exec("INSERT INTO service_route_declarations (cluster_id, service_key, role, reason, version) VALUES (?, ?, ?, ?, ?)",
			clusterID, declaration.ServiceKey, string(declaration.Role), nullableText(declaration.Reason), declaration.Version); err != nil {
			return err
		}
	}
	for _, domain := range cluster.Domains {
		if err := exec("INSERT INTO routing_domains (cluster_id, zone, note, created_at, version) VALUES (?, ?, ?, ?, ?)",
			clusterID, domain.Zone, nullableText(domain.Note), nullableTime(domain.CreatedAt), domain.Version); err != nil {
			return err
		}
	}
	for id, versions := range cluster.Credentials {
		for _, metadata := range versions {
			var sealed []byte
			if value := cluster.Secrets[metadata.SecretName]; metadata.State != "removed" && value != "" {
				var err error
				sealed, err = s.db.Seal(dnsCredentialPurpose(clusterID, id, metadata.Version), []byte(value))
				if err != nil {
					return err
				}
			}
			var validated sql.NullTime
			if metadata.ValidatedAt != nil {
				validated = sql.NullTime{Time: metadata.ValidatedAt.UTC(), Valid: true}
			}
			if err := exec(`INSERT INTO dns_credential_versions (cluster_id, credential_id, version, name, provider, account_id, email, secret_name,
				state, created_at, validated_at, secret_sealed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				clusterID, id, metadata.Version, metadata.Name, string(metadata.Provider), nullableText(metadata.AccountID), nullableText(metadata.Email),
				metadata.SecretName, metadata.State, metadata.CreatedAt.UTC(), validated, sealed); err != nil {
				return err
			}
		}
	}
	for _, record := range cluster.DNSRecords {
		if err := exec(`INSERT INTO dns_records (cluster_id, id, zone, name, type, content, ttl, proxied, managed, adopted, credential_id, provider_record_id, version)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			clusterID, record.ID, record.Zone, record.Name, string(record.Type), record.Content, record.TTL, record.Proxied, record.Managed, record.Adopted,
			record.CredentialID, nullableText(record.ProviderRecordID), record.Version); err != nil {
			return err
		}
	}
	for _, certificate := range cluster.Certificates {
		if err := exec(`INSERT INTO route_certificates (cluster_id, route_key, state, issuer, fingerprint, resolver, handshake_valid, failure_summary,
			last_attempt, not_before, not_after, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			clusterID, certificate.RouteKey, certificate.State, nullableText(certificate.Issuer), nullableText(certificate.Fingerprint), certificate.Resolver,
			certificate.HandshakeValid, nullableText(certificate.FailureSummary), pointerTime(certificate.LastAttempt), pointerTime(certificate.NotBefore),
			pointerTime(certificate.NotAfter), certificate.Version); err != nil {
			return err
		}
		for position, domain := range certificate.Domains {
			if err := exec("INSERT INTO route_certificate_domains (cluster_id, route_key, position, domain) VALUES (?, ?, ?, ?)",
				clusterID, certificate.RouteKey, position, domain); err != nil {
				return err
			}
		}
	}
	for _, runtime := range cluster.Runtime {
		if err := exec("INSERT INTO route_runtime (cluster_id, route_key, protocol, router, service, state, observed_at, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
			clusterID, runtime.RouteKey, string(runtime.Protocol), runtime.Router, runtime.Service, runtime.State, runtime.ObservedAt.UTC(), runtime.Version); err != nil {
			return err
		}
		for position, entryPoint := range runtime.EntryPoints {
			if err := exec("INSERT INTO route_runtime_entry_points (cluster_id, route_key, position, entry_point) VALUES (?, ?, ?, ?)",
				clusterID, runtime.RouteKey, position, entryPoint); err != nil {
				return err
			}
		}
		for position, message := range runtime.Errors {
			if err := exec("INSERT INTO route_runtime_errors (cluster_id, route_key, position, message) VALUES (?, ?, ?, ?)",
				clusterID, runtime.RouteKey, position, message); err != nil {
				return err
			}
		}
	}
	return nil
}

func mustJSON(value any) []byte {
	encoded, err := json.Marshal(value)
	if err != nil {
		panic(fmt.Sprintf("encode routing document: %v", err))
	}
	return encoded
}

func nullTimePointer(value sql.NullTime) *time.Time {
	if !value.Valid {
		return nil
	}
	result := value.Time
	return &result
}

func pointerTime(value *time.Time) sql.NullTime {
	if value == nil || value.IsZero() {
		return sql.NullTime{}
	}
	return sql.NullTime{Time: value.UTC(), Valid: true}
}

// ImportRoutingFiles copies a pre-database traefik-routing.sealed file into the
// database, one cluster at a time, re-sealing each DNS credential under its
// row-bound purpose. It reports how many clusters it held. The file is kept.
func ImportRoutingFiles(ctx context.Context, db *sqlstore.DB, dataDir string, dataEncryptionKey []byte, defaultACMEEmail string) (int, error) {
	sealer, err := securestore.New(dataEncryptionKey)
	if err != nil {
		return 0, err
	}
	data, err := sealer.ReadFile(filepath.Join(dataDir, "traefik-routing.sealed"), routingStateKey)
	if errors.Is(err, os.ErrNotExist) {
		return 0, nil
	}
	if err != nil {
		return 0, fmt.Errorf("read sealed routing state: %w", err)
	}
	var saved routingFile
	if err := json.Unmarshal(data, &saved); err != nil || saved.Version != RoutingSchemaVersion || saved.Clusters == nil {
		return 0, fmt.Errorf("read sealed routing state: unsupported or invalid version")
	}
	store, err := NewRoutingStore(db, defaultACMEEmail)
	if err != nil {
		return 0, err
	}
	clusterIDs := make([]string, 0, len(saved.Clusters))
	for clusterID, cluster := range saved.Clusters {
		if !validClusterID(clusterID) || cluster == nil {
			return 0, fmt.Errorf("read sealed routing state: invalid cluster")
		}
		normalizeRoutingCluster(cluster, store.defaultEmail)
		if err := validateRoutingCluster(cluster); err != nil {
			return 0, fmt.Errorf("read sealed routing state: %w", err)
		}
		clusterIDs = append(clusterIDs, clusterID)
	}
	sort.Strings(clusterIDs)
	for _, clusterID := range clusterIDs {
		imported := saved.Clusters[clusterID]
		if err := store.update(clusterID, func(working *routingCluster) error {
			*working = *imported
			return nil
		}); err != nil {
			return 0, fmt.Errorf("import routing cluster %q: %w", clusterID, err)
		}
	}
	return len(clusterIDs), nil
}

func normalizeRoutingCluster(cluster *routingCluster, defaultEmail string) {
	if cluster.Routes == nil {
		cluster.Routes = map[string]RouteSpec{}
	}
	if cluster.Bindings == nil {
		cluster.Bindings = map[string]DependencyBinding{}
	}
	if cluster.Credentials == nil {
		cluster.Credentials = map[string][]DNSCredentialMetadata{}
	}
	if cluster.DNSRecords == nil {
		cluster.DNSRecords = map[string]DNSRecordSpec{}
	}
	if cluster.Domains == nil {
		// State sealed before the domain registry existed keeps working: the
		// zones its records already live in are adopted as accepted domains
		// once, so the gate applies to new work rather than stranding routes
		// that are already published.
		cluster.Domains = map[string]DomainSpec{}
		for _, record := range cluster.DNSRecords {
			zone := record.Normalize().Zone
			if zone == "" {
				continue
			}
			cluster.Domains[zone] = DomainSpec{CreatedAt: time.Time{}, Note: "adopted from existing DNS records", Version: RoutingSchemaVersion, Zone: zone}
		}
	}
	if cluster.Declarations == nil {
		cluster.Declarations = map[string]ServiceRouteDeclaration{}
	}
	if cluster.Certificates == nil {
		cluster.Certificates = map[string]CertificateStatus{}
	}
	if cluster.Runtime == nil {
		cluster.Runtime = map[string]RouteRuntime{}
	}
	if cluster.Secrets == nil {
		cluster.Secrets = map[string]string{}
	}
	if cluster.Settings.Version == 0 {
		cluster.Settings = DefaultTraefikSettings(defaultEmail)
	} else {
		cluster.Settings = cluster.Settings.Normalize()
	}
}

func validateRoutingCluster(cluster *routingCluster) error {
	normalizeRoutingCluster(cluster, cluster.Settings.ACMEEmail)
	if err := cluster.Settings.Validate(); err != nil {
		return err
	}
	if cluster.CutoverRollback != nil {
		if err := validateCutoverRollback(*cluster.CutoverRollback); err != nil {
			return err
		}
	}
	records := mapDNSRecords(cluster.DNSRecords)
	for key, route := range cluster.Routes {
		if key != route.Key {
			return fmt.Errorf("route state key mismatch")
		}
		if err := ValidateRouteCompatibility(route, cluster.Settings, records); err != nil {
			return fmt.Errorf("route %q: %w", key, err)
		}
	}
	for _, binding := range cluster.Bindings {
		if err := binding.Validate(); err != nil {
			return err
		}
		// Same exemption as PutBinding: the platform metrics targets are
		// synthetic and never appear as stored routes.
		if _, found := cluster.Routes[binding.TargetRoute]; !found && !platformMetricsRoute(binding.TargetRoute) {
			return fmt.Errorf("dependency binding target route is missing")
		}
	}
	for key, declaration := range cluster.Declarations {
		if key != declaration.ServiceKey {
			return fmt.Errorf("service route declaration state key mismatch")
		}
		if err := declaration.Validate(); err != nil {
			return err
		}
	}
	for id, versions := range cluster.Credentials {
		if !providerIDPattern.MatchString(id) || len(versions) == 0 {
			return fmt.Errorf("DNS credential state is invalid")
		}
		for index, metadata := range versions {
			if metadata.ID != id || metadata.Version != index+1 || (metadata.Provider != DNSProviderCloudflare && metadata.Provider != DNSProviderArvan) || !dockerReferenceName.MatchString(metadata.SecretName) {
				return fmt.Errorf("DNS credential version state is invalid")
			}
			if metadata.State != "removed" && cluster.Secrets[metadata.SecretName] == "" {
				return fmt.Errorf("DNS credential value is missing")
			}
		}
	}
	return nil
}

func cloneRoutingCluster(source *routingCluster, defaultEmail string) *routingCluster {
	if source == nil {
		cluster := &routingCluster{}
		normalizeRoutingCluster(cluster, defaultEmail)
		return cluster
	}
	data, _ := json.Marshal(source)
	var result routingCluster
	_ = json.Unmarshal(data, &result)
	normalizeRoutingCluster(&result, defaultEmail)
	return &result
}

func publicRoutingState(cluster *routingCluster) RoutingState {
	state := RoutingState{Settings: cloneSettings(cluster.Settings), Version: RoutingSchemaVersion}
	for _, route := range cluster.Routes {
		state.Routes = append(state.Routes, route)
	}
	for _, binding := range cluster.Bindings {
		state.Bindings = append(state.Bindings, binding)
	}
	for _, versions := range cluster.Credentials {
		state.Credentials = append(state.Credentials, versions...)
	}
	for _, record := range cluster.DNSRecords {
		state.DNSRecords = append(state.DNSRecords, record)
	}
	for _, domain := range cluster.Domains {
		state.Domains = append(state.Domains, domain)
	}
	for _, declaration := range cluster.Declarations {
		state.Declarations = append(state.Declarations, declaration)
	}
	for _, certificate := range cluster.Certificates {
		state.Certificates = append(state.Certificates, certificate)
	}
	for _, runtime := range cluster.Runtime {
		state.Runtime = append(state.Runtime, runtime)
	}
	if cluster.Cutover != nil {
		copy := *cluster.Cutover
		state.Cutover = &copy
	}
	if cluster.CutoverRollback != nil {
		copy := *cluster.CutoverRollback
		state.CutoverRollback = &copy
	}
	sort.Slice(state.Routes, func(i, j int) bool { return state.Routes[i].Key < state.Routes[j].Key })
	if state.CutoverRollback != nil {
		sort.Slice(state.CutoverRollback.Services, func(i, j int) bool {
			return state.CutoverRollback.Services[i].ServiceKey < state.CutoverRollback.Services[j].ServiceKey
		})
	}
	sort.Slice(state.Bindings, func(i, j int) bool {
		return dependencyBindingKey(state.Bindings[i]) < dependencyBindingKey(state.Bindings[j])
	})
	sort.Slice(state.Credentials, func(i, j int) bool {
		if state.Credentials[i].ID == state.Credentials[j].ID {
			return state.Credentials[i].Version > state.Credentials[j].Version
		}
		return state.Credentials[i].ID < state.Credentials[j].ID
	})
	sort.Slice(state.DNSRecords, func(i, j int) bool { return state.DNSRecords[i].ID < state.DNSRecords[j].ID })
	sort.Slice(state.Domains, func(i, j int) bool { return state.Domains[i].Zone < state.Domains[j].Zone })
	sort.Slice(state.Declarations, func(i, j int) bool { return state.Declarations[i].ServiceKey < state.Declarations[j].ServiceKey })
	sort.Slice(state.Certificates, func(i, j int) bool { return state.Certificates[i].RouteKey < state.Certificates[j].RouteKey })
	sort.Slice(state.Runtime, func(i, j int) bool { return state.Runtime[i].RouteKey < state.Runtime[j].RouteKey })
	if state.Routes == nil {
		state.Routes = []RouteSpec{}
	}
	if state.Bindings == nil {
		state.Bindings = []DependencyBinding{}
	}
	if state.Credentials == nil {
		state.Credentials = []DNSCredentialMetadata{}
	}
	if state.DNSRecords == nil {
		state.DNSRecords = []DNSRecordSpec{}
	}
	if state.Domains == nil {
		state.Domains = []DomainSpec{}
	}
	if state.Declarations == nil {
		state.Declarations = []ServiceRouteDeclaration{}
	}
	if state.Certificates == nil {
		state.Certificates = []CertificateStatus{}
	}
	if state.Runtime == nil {
		state.Runtime = []RouteRuntime{}
	}
	return state
}

func cloneSettings(settings TraefikSettings) TraefikSettings {
	settings.EntryPoints = append([]StaticEntryPoint(nil), settings.EntryPoints...)
	settings.Resolvers = append([]ACMEPolicy(nil), settings.Resolvers...)
	return settings
}

func mapDomains(domains map[string]DomainSpec) []DomainSpec {
	result := make([]DomainSpec, 0, len(domains))
	for _, domain := range domains {
		result = append(result, domain)
	}
	return result
}

func mapDNSRecords(records map[string]DNSRecordSpec) []DNSRecordSpec {
	result := make([]DNSRecordSpec, 0, len(records))
	for _, record := range records {
		result = append(result, record)
	}
	return result
}

func dependencyBindingKey(binding DependencyBinding) string {
	return binding.CallerService + "|" + binding.TargetRoute + "|" + binding.Name
}

func validateCutoverRollback(plan CutoverRollbackPlan) error {
	if plan.Version == 0 {
		plan.Version = RoutingSchemaVersion
	}
	if plan.Version != RoutingSchemaVersion {
		return fmt.Errorf("cutover rollback plan version is invalid")
	}
	seen := map[string]bool{}
	for _, service := range plan.Services {
		if !validServiceKey(service.ServiceKey) || seen[service.ServiceKey] {
			return fmt.Errorf("cutover rollback service entry is invalid")
		}
		seen[service.ServiceKey] = true
		for _, port := range service.PublishedPorts {
			if !oneOfString(strings.ToLower(port.Protocol), "tcp", "udp", "http") || port.PublishedPort == 0 || port.TargetPort == 0 {
				return fmt.Errorf("cutover rollback port is invalid")
			}
		}
		for _, network := range service.Networks {
			if strings.TrimSpace(network) == "" || strings.TrimSpace(network) == "ingress" {
				return fmt.Errorf("cutover rollback network is invalid")
			}
		}
	}
	return nil
}

func hostOverlap(left, right []string) bool {
	seen := map[string]bool{}
	for _, host := range left {
		seen[host] = true
	}
	for _, host := range right {
		if seen[host] {
			return true
		}
	}
	return false
}

func pathOverlap(left, right string) bool {
	if left == "" {
		left = "/"
	}
	if right == "" {
		right = "/"
	}
	return strings.HasPrefix(left, right) || strings.HasPrefix(right, left)
}

func validClusterID(value string) bool {
	value = strings.TrimSpace(value)
	return value != "" && len(value) <= 64 && !strings.ContainsAny(value, "\r\n\x00")
}

func sanitizeRuntimeError(value string) string {
	value = strings.Map(func(r rune) rune {
		if r == '\r' || r == '\n' || r == 0 {
			return ' '
		}
		return r
	}, value)
	value = strings.TrimSpace(value)
	if len(value) > 256 {
		value = value[:256]
	}
	return value
}
