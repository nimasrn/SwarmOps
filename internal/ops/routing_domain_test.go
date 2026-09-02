package ops

import (
	"strings"
	"testing"
)

func domainTestStore(t *testing.T) *RoutingStore {
	t.Helper()
	store, err := NewRoutingStore(t.TempDir(), make([]byte, 32), "ops@example.com")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := store.RotateCredential("manager-1", "cf", "Cloudflare", DNSProviderCloudflare, []byte("token-value-0123456789abcdef")); err != nil {
		t.Fatal(err)
	}
	return store
}

func domainTestRecord() DNSRecordSpec {
	return DNSRecordSpec{
		Content:      "203.0.113.10",
		CredentialID: "cf",
		ID:           "app",
		Managed:      true,
		Name:         "app.example.com",
		TTL:          300,
		Type:         DNSRecordA,
		Version:      RoutingSchemaVersion,
		Zone:         "example.com",
	}
}

func domainTestRoute() RouteSpec {
	return RouteSpec{
		Enabled:    true,
		Key:        "app",
		Match:      RouteMatch{Hosts: []string{"app.example.com"}},
		Protocol:   RouteHTTP,
		Scope:      RouteInternal,
		ServiceKey: "app",
		TargetPort: 8080,
		TLS:        RouteTLSOff,
		Version:    RoutingSchemaVersion,
	}
}

func TestDNSRecordRequiresAnAcceptedDomain(t *testing.T) {
	t.Parallel()
	store := domainTestStore(t)
	err := store.PutDNSRecord("manager-1", domainTestRecord(), RouteHTTP)
	if err == nil || !strings.Contains(err.Error(), "not an accepted gateway domain") {
		t.Fatalf("err = %v, want an unaccepted domain rejection", err)
	}
}

func TestRouteRequiresAnExistingRecordUnderAnAcceptedDomain(t *testing.T) {
	t.Parallel()
	store := domainTestStore(t)

	// No domain at all: an internal route is refused as firmly as a public one.
	if err := store.PutRoute("manager-1", domainTestRoute()); err == nil || !strings.Contains(err.Error(), "accepted gateway domain") {
		t.Fatalf("err = %v, want an unaccepted domain rejection", err)
	}

	// Domain accepted, subdomain not created yet.
	if err := store.PutDomain("manager-1", DomainSpec{Zone: "example.com", Version: RoutingSchemaVersion}); err != nil {
		t.Fatal(err)
	}
	if err := store.PutRoute("manager-1", domainTestRoute()); err == nil || !strings.Contains(err.Error(), "no DNS record") {
		t.Fatalf("err = %v, want a missing record rejection", err)
	}

	// Subdomain created: the route is now assignable.
	if err := store.PutDNSRecord("manager-1", domainTestRecord(), RouteHTTP); err != nil {
		t.Fatal(err)
	}
	if err := store.PutRoute("manager-1", domainTestRoute()); err != nil {
		t.Fatalf("route apply after acceptance and record creation: %v", err)
	}

	state, err := store.Snapshot("manager-1")
	if err != nil {
		t.Fatal(err)
	}
	if len(state.Domains) != 1 || state.Domains[0].Zone != "example.com" || state.Domains[0].CreatedAt.IsZero() {
		t.Fatalf("domains = %#v, want one stamped accepted zone", state.Domains)
	}
}

func TestDomainRemovalIsRefusedWhileDependentsExist(t *testing.T) {
	t.Parallel()
	store := domainTestStore(t)
	if err := store.PutDomain("manager-1", DomainSpec{Zone: "example.com", Version: RoutingSchemaVersion}); err != nil {
		t.Fatal(err)
	}
	if err := store.PutDNSRecord("manager-1", domainTestRecord(), RouteHTTP); err != nil {
		t.Fatal(err)
	}
	if err := store.PutRoute("manager-1", domainTestRoute()); err != nil {
		t.Fatal(err)
	}
	if err := store.RemoveDomain("manager-1", "example.com"); err == nil || !strings.Contains(err.Error(), "still owns") {
		t.Fatalf("err = %v, want a dependent rejection", err)
	}
	if err := store.RemoveRoute("manager-1", "app"); err != nil {
		t.Fatal(err)
	}
	if err := store.RemoveDNSRecord("manager-1", "app"); err != nil {
		t.Fatal(err)
	}
	if err := store.RemoveDomain("manager-1", "example.com"); err != nil {
		t.Fatalf("domain removal after dependents are gone: %v", err)
	}
}

func TestSubdomainCannotEscapeItsAcceptedParent(t *testing.T) {
	t.Parallel()
	store := domainTestStore(t)
	if err := store.PutDomain("manager-1", DomainSpec{Zone: "example.com", Version: RoutingSchemaVersion}); err != nil {
		t.Fatal(err)
	}
	record := domainTestRecord()
	record.ID = "other"
	record.Name = "app.example.net"
	record.Zone = "example.net"
	if err := store.PutDNSRecord("manager-1", record, RouteHTTP); err == nil {
		t.Fatal("a record outside every accepted domain was created")
	}
}

func TestRouteAdmissionAcceptsAWildcardBackedByItsApexRecord(t *testing.T) {
	t.Parallel()
	domains := []DomainSpec{{Zone: "example.com", Version: RoutingSchemaVersion}}
	apex := domainTestRecord()
	apex.Name = "example.com"
	route := domainTestRoute()
	route.Match.Hosts = []string{"*.example.com"}
	if err := ValidateRouteAdmission(route, []DNSRecordSpec{apex}, domains); err != nil {
		t.Fatalf("wildcard backed by its apex record: %v", err)
	}
	if err := ValidateRouteAdmission(route, []DNSRecordSpec{domainTestRecord()}, domains); err == nil {
		t.Fatal("a wildcard without its apex record was admitted")
	}
}

func TestLegacyStateAdoptsTheZonesItsRecordsAlreadyUse(t *testing.T) {
	t.Parallel()
	cluster := &routingCluster{DNSRecords: map[string]DNSRecordSpec{"app": domainTestRecord()}}
	normalizeRoutingCluster(cluster, "ops@example.com")
	if domain, found := cluster.Domains["example.com"]; !found || domain.Zone != "example.com" {
		t.Fatalf("domains = %#v, want the record zone adopted once", cluster.Domains)
	}
}
