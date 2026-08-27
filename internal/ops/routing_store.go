package ops

import (
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
)

const routingStateKey = "traefik-routing-control-plane"

type RoutingState struct {
	Bindings        []DependencyBinding       `json:"bindings"`
	Certificates    []CertificateStatus       `json:"certificates"`
	Credentials     []DNSCredentialMetadata   `json:"credentials"`
	Cutover         *CutoverPlan              `json:"cutover,omitempty"`
	CutoverRollback *CutoverRollbackPlan      `json:"cutoverRollback,omitempty"`
	Declarations    []ServiceRouteDeclaration `json:"declarations"`
	DNSRecords      []DNSRecordSpec           `json:"dnsRecords"`
	Routes          []RouteSpec               `json:"routes"`
	Runtime         []RouteRuntime            `json:"runtime"`
	Settings        TraefikSettings           `json:"settings"`
	Version         int                       `json:"version"`
}

type routingCluster struct {
	Bindings        map[string]DependencyBinding       `json:"bindings"`
	Certificates    map[string]CertificateStatus       `json:"certificates"`
	Credentials     map[string][]DNSCredentialMetadata `json:"credentials"`
	Cutover         *CutoverPlan                       `json:"cutover,omitempty"`
	CutoverRollback *CutoverRollbackPlan               `json:"cutoverRollback,omitempty"`
	Declarations    map[string]ServiceRouteDeclaration `json:"declarations"`
	DNSRecords      map[string]DNSRecordSpec           `json:"dnsRecords"`
	Routes          map[string]RouteSpec               `json:"routes"`
	Runtime         map[string]RouteRuntime            `json:"runtime"`
	Secrets         map[string]string                  `json:"secrets"`
	Settings        TraefikSettings                    `json:"settings"`
}

type routingFile struct {
	Clusters map[string]*routingCluster `json:"clusters"`
	Version  int                        `json:"version"`
}

// RoutingStore seals both desired state and DNS credential material. Public
// snapshots construct metadata-only copies and never expose Secrets.
type RoutingStore struct {
	clusters     map[string]*routingCluster
	defaultEmail string
	mu           sync.RWMutex
	now          func() time.Time
	path         string
	sealer       *securestore.Sealer
}

func NewRoutingStore(dataDir string, dataEncryptionKey []byte, defaultACMEEmail string) (*RoutingStore, error) {
	if strings.TrimSpace(dataDir) == "" {
		return nil, fmt.Errorf("routing store data directory is required")
	}
	sealer, err := securestore.New(dataEncryptionKey)
	if err != nil {
		return nil, fmt.Errorf("configure sealed routing state: %w", err)
	}
	store := &RoutingStore{
		clusters:     map[string]*routingCluster{},
		defaultEmail: strings.TrimSpace(defaultACMEEmail),
		now:          time.Now,
		path:         filepath.Join(dataDir, "traefik-routing.sealed"),
		sealer:       sealer,
	}
	data, err := sealer.ReadFile(store.path, routingStateKey)
	if errors.Is(err, os.ErrNotExist) {
		return store, nil
	}
	if err != nil {
		return nil, fmt.Errorf("read sealed routing state: %w", err)
	}
	var saved routingFile
	if err := json.Unmarshal(data, &saved); err != nil || saved.Version != RoutingSchemaVersion || saved.Clusters == nil {
		return nil, fmt.Errorf("read sealed routing state: unsupported or invalid version")
	}
	for clusterID, cluster := range saved.Clusters {
		if !validClusterID(clusterID) || cluster == nil {
			return nil, fmt.Errorf("read sealed routing state: invalid cluster")
		}
		normalizeRoutingCluster(cluster, store.defaultEmail)
		if err := validateRoutingCluster(cluster); err != nil {
			return nil, fmt.Errorf("read sealed routing state: %w", err)
		}
	}
	store.clusters = saved.Clusters
	return store, nil
}

func (s *RoutingStore) Snapshot(clusterID string) (RoutingState, error) {
	if s == nil {
		return RoutingState{}, fmt.Errorf("sealed routing state is not configured")
	}
	if !validClusterID(clusterID) {
		return RoutingState{}, fmt.Errorf("selected server identifier is invalid")
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	cluster := s.clusters[clusterID]
	if cluster == nil {
		settings := DefaultTraefikSettings(s.defaultEmail)
		return RoutingState{Bindings: []DependencyBinding{}, Certificates: []CertificateStatus{}, Credentials: []DNSCredentialMetadata{}, Declarations: []ServiceRouteDeclaration{}, DNSRecords: []DNSRecordSpec{}, Routes: []RouteSpec{}, Runtime: []RouteRuntime{}, Settings: settings, Version: RoutingSchemaVersion}, nil
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

func (s *RoutingStore) PutBinding(clusterID string, binding DependencyBinding) error {
	binding = binding.Normalize()
	if err := binding.Validate(); err != nil {
		return err
	}
	return s.update(clusterID, func(cluster *routingCluster) error {
		if _, found := cluster.Routes[binding.TargetRoute]; !found {
			return fmt.Errorf("dependency target route was not found")
		}
		key := dependencyBindingKey(binding)
		for existingKey, existing := range cluster.Bindings {
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
func (s *RoutingStore) RotateCredential(clusterID, id, name string, provider DNSProvider, secret []byte) (DNSCredentialMetadata, error) {
	id = strings.ToLower(strings.TrimSpace(id))
	name = strings.TrimSpace(name)
	if !providerIDPattern.MatchString(id) || name == "" || len(name) > 96 || strings.ContainsAny(name, "\r\n\x00") {
		return DNSCredentialMetadata{}, fmt.Errorf("DNS credential metadata is invalid")
	}
	if provider != DNSProviderCloudflare && provider != DNSProviderArvan {
		return DNSCredentialMetadata{}, fmt.Errorf("DNS provider is unsupported")
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
			CreatedAt:  s.now().UTC(),
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
		return DNSCredentialMetadata{}, "", fmt.Errorf("sealed routing state is not configured")
	}
	id = strings.ToLower(strings.TrimSpace(id))
	s.mu.RLock()
	defer s.mu.RUnlock()
	cluster := s.clusters[clusterID]
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
		now := s.now().UTC()
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

func (s *RoutingStore) update(clusterID string, mutation func(*routingCluster) error) error {
	if s == nil || s.sealer == nil {
		return fmt.Errorf("sealed routing state is not configured")
	}
	if !validClusterID(clusterID) {
		return fmt.Errorf("selected server identifier is invalid")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	previous, existed := s.clusters[clusterID]
	working := cloneRoutingCluster(previous, s.defaultEmail)
	if err := mutation(working); err != nil {
		return err
	}
	if err := validateRoutingCluster(working); err != nil {
		return err
	}
	s.clusters[clusterID] = working
	if err := s.saveLocked(); err != nil {
		if existed {
			s.clusters[clusterID] = previous
		} else {
			delete(s.clusters, clusterID)
		}
		return err
	}
	return nil
}

func (s *RoutingStore) saveLocked() error {
	data, err := json.Marshal(routingFile{Clusters: s.clusters, Version: RoutingSchemaVersion})
	if err != nil {
		return fmt.Errorf("encode sealed routing state: %w", err)
	}
	if err := s.sealer.WriteFile(s.path, routingStateKey, append(data, '\n')); err != nil {
		return fmt.Errorf("save sealed routing state: %w", err)
	}
	return nil
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
		if _, found := cluster.Routes[binding.TargetRoute]; !found {
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
