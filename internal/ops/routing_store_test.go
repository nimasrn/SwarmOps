package ops

import (
	"bytes"
	"context"
	"encoding/json"
	"path/filepath"
	"testing"
	"time"

	"github.com/nimasrn/SwarmOps/internal/securestore"
	"github.com/nimasrn/SwarmOps/internal/sqlstore/sqltest"
)

// A cluster assembled through the store's own methods must read back field for
// field, with every child collection in order, after it has been decomposed
// into rows and rebuilt.
func TestRoutingClusterRoundTripsThroughItsTables(t *testing.T) {
	t.Parallel()
	db := sqltest.Open(t)
	store, err := NewRoutingStore(db, "ops@example.com")
	if err != nil {
		t.Fatal(err)
	}
	const cluster = "server-1"
	if err := store.PutDomain(cluster, DomainSpec{Zone: "example.com", Note: "primary zone", Version: RoutingSchemaVersion}); err != nil {
		t.Fatalf("put domain: %v", err)
	}
	const token = "cloudflare-token-value-1234567890"
	credential, err := store.RotateCredential(cluster, "cf-main", "Cloudflare", DNSProviderCloudflare, DNSCredentialIdentity{}, []byte(token))
	if err != nil {
		t.Fatalf("rotate credential: %v", err)
	}
	if err := store.MarkCredentialValidated(cluster, "cf-main", credential.Version); err != nil {
		t.Fatalf("validate credential: %v", err)
	}
	before, err := store.Snapshot(cluster)
	if err != nil {
		t.Fatal(err)
	}
	if len(before.Domains) != 1 || before.Domains[0].Note != "primary zone" || before.Domains[0].CreatedAt.IsZero() {
		t.Fatalf("domain = %#v", before.Domains)
	}
	if len(before.Credentials) != 1 || before.Credentials[0].State != "validated" || before.Credentials[0].ValidatedAt == nil {
		t.Fatalf("credentials = %#v", before.Credentials)
	}
	metadata, secret, err := store.CredentialSecret(cluster, "cf-main", 0)
	if err != nil || secret != token || metadata.SecretName != credential.SecretName {
		t.Fatalf("credential secret = %q, %#v, %v", secret, metadata, err)
	}
	var sealed []byte
	if err := db.Pool().QueryRow("SELECT secret_sealed FROM dns_credential_versions WHERE cluster_id = ? AND credential_id = 'cf-main'", cluster).Scan(&sealed); err != nil {
		t.Fatal(err)
	}
	if bytes.Contains(sealed, []byte(token)) {
		t.Fatal("a DNS provider token was stored in the clear")
	}

	// A second, independent store on the same database sees the same cluster.
	reopened, err := NewRoutingStore(db, "ops@example.com")
	if err != nil {
		t.Fatal(err)
	}
	after, err := reopened.Snapshot(cluster)
	if err != nil {
		t.Fatal(err)
	}
	beforeJSON, _ := json.Marshal(before)
	afterJSON, _ := json.Marshal(after)
	if !bytes.Equal(beforeJSON, afterJSON) {
		t.Fatalf("snapshot changed across stores:\nbefore %s\n after %s", beforeJSON, afterJSON)
	}
}

// A mutation that fails whole-cluster validation must leave no row behind:
// the transaction that would have written it is rolled back.
func TestARejectedRoutingChangeWritesNothing(t *testing.T) {
	t.Parallel()
	db := sqltest.Open(t)
	store, err := NewRoutingStore(db, "ops@example.com")
	if err != nil {
		t.Fatal(err)
	}
	if err := store.PutBinding("server-1", DependencyBinding{CallerService: "shop_app", TargetRoute: "missing-route", Name: "API_URL", Delivery: "env", Version: RoutingSchemaVersion}); err == nil {
		t.Fatal("a binding to a route that does not exist was accepted")
	}
	var bindings int
	if err := db.Pool().QueryRow("SELECT COUNT(*) FROM dependency_bindings").Scan(&bindings); err != nil {
		t.Fatal(err)
	}
	if bindings != 0 {
		t.Fatalf("a rejected change left %d binding rows", bindings)
	}
	if _, _, err := store.CredentialSecret("server-1", "nothing", 0); err == nil {
		t.Fatal("a credential that was never stored was returned")
	}
}

func TestImportRoutingFilesReSealsCredentialsPerRow(t *testing.T) {
	t.Parallel()
	dataDir := t.TempDir()
	key := sqltest.Key()
	sealer, err := securestore.New(key)
	if err != nil {
		t.Fatal(err)
	}
	const token = "arvan-api-key-value-1234567890"
	created := time.Date(2026, 8, 30, 10, 0, 0, 0, time.UTC)
	cluster := &routingCluster{
		Credentials: map[string][]DNSCredentialMetadata{"arvan-main": {{
			CreatedAt: created, ID: "arvan-main", Name: "Arvan", Provider: DNSProviderArvan,
			SecretName: "traefik_dns_arvan_arvan-main_v1", State: "sealed", Version: 1,
		}}},
		Domains: map[string]DomainSpec{"example.ir": {CreatedAt: created, Version: RoutingSchemaVersion, Zone: "example.ir"}},
		Secrets: map[string]string{"traefik_dns_arvan_arvan-main_v1": token},
	}
	encoded, err := json.Marshal(routingFile{Clusters: map[string]*routingCluster{"server-9": cluster}, Version: RoutingSchemaVersion})
	if err != nil {
		t.Fatal(err)
	}
	if err := sealer.WriteFile(filepath.Join(dataDir, "traefik-routing.sealed"), routingStateKey, encoded); err != nil {
		t.Fatal(err)
	}
	db := sqltest.Open(t)
	count, err := ImportRoutingFiles(context.Background(), db, dataDir, key, "ops@example.com")
	if err != nil || count != 1 {
		t.Fatalf("import = %d, %v", count, err)
	}
	store, err := NewRoutingStore(db, "ops@example.com")
	if err != nil {
		t.Fatal(err)
	}
	if _, secret, err := store.CredentialSecret("server-9", "arvan-main", 1); err != nil || secret != token {
		t.Fatalf("imported credential = %q, %v", secret, err)
	}
	snapshot, err := store.Snapshot("server-9")
	if err != nil || len(snapshot.Domains) != 1 || !snapshot.Domains[0].CreatedAt.Equal(created) {
		t.Fatalf("imported snapshot = %#v, %v", snapshot.Domains, err)
	}
}
