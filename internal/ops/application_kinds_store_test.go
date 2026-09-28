package ops

import (
	"testing"

	"github.com/nimasrn/SwarmOps/internal/sqlstore/sqltest"
)

// Kind, database owner, and secret variables survive the store, and a secret
// is loaded back as a secret rather than as a plain environment variable.
func TestApplicationStoreRoundTripsKindsOwnersAndSecrets(t *testing.T) {
	store := newApplicationStore(t, sqltest.Open(t))
	job := ApplicationSpec{
		Name: "ilc-migrate", Kind: KindJob, Image: "ghcr.io/nimasrn/ilc-migrate:1", Plan: "small",
		Databases: []string{DatabaseMongo}, DatabaseOwner: "ilc-api", DatabaseEnv: map[string][]string{DatabaseMongo: {"MONGO_URI"}},
		Env:       map[string]string{"APP_ENVIRONMENT": "production"},
		SecretEnv: map[string]string{"LEGAL_DATA_ENCRYPTION_KEY": "sealed-value"},
	}
	if err := store.Put(job); err != nil {
		t.Fatalf("put job: %v", err)
	}
	loaded, found := store.Get("ilc-migrate")
	if !found {
		t.Fatal("job was not stored")
	}
	if loaded.Kind != KindJob || loaded.Port != 0 || loaded.DatabaseOwner != "ilc-api" {
		t.Fatalf("loaded = %+v", loaded)
	}
	if loaded.SecretEnv["LEGAL_DATA_ENCRYPTION_KEY"] != "sealed-value" || loaded.Env["LEGAL_DATA_ENCRYPTION_KEY"] != "" || loaded.Env["APP_ENVIRONMENT"] != "production" {
		t.Fatalf("env = %#v, secrets = %#v", loaded.Env, loaded.SecretEnv)
	}
	api := ApplicationSpec{Name: "ilc-api", Image: "ghcr.io/nimasrn/ilc-api:1", Port: 8080, Plan: "small",
		DependsOn: []ApplicationDependency{{Application: "ilc-clamav", Env: []string{"CLAMAV_ADDRESS"}}, {Application: "ilc-other"}}}
	if err := store.Put(api); err != nil {
		t.Fatalf("put api: %v", err)
	}
	if loadedAPI, _ := store.Get("ilc-api"); len(loadedAPI.DependsOn) != 2 || loadedAPI.DependsOn[0].Application != "ilc-clamav" || len(loadedAPI.DependsOn[0].Env) != 1 || loadedAPI.DependsOn[1].Env != nil {
		t.Fatalf("dependencies = %#v", loadedAPI.DependsOn)
	}
	if err := store.Put(ApplicationSpec{Name: "ilc-clamav", Image: "clamav/clamav:1.4.3", Port: 3310, Protocol: ProtocolTCP, HealthCommand: []string{"clamdcheck.sh"}, Plan: "small"}); err != nil {
		t.Fatalf("put tcp: %v", err)
	}
	if clamav, _ := store.Get("ilc-clamav"); clamav.Protocol != ProtocolTCP {
		t.Fatalf("protocol = %q", clamav.Protocol)
	}
	if err := store.Put(ApplicationSpec{Name: "ilc-web", Image: "ghcr.io/nimasrn/ilc-web:1", Port: 8080, Plan: "small"}); err != nil {
		t.Fatalf("put web: %v", err)
	}
	if web, _ := store.Get("ilc-web"); web.Kind != KindWeb {
		t.Fatalf("an application without a kind must load as web, got %q", web.Kind)
	}
}
