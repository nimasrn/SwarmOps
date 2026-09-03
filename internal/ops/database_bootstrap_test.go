package ops

import (
	"strings"
	"testing"
)

func TestApplicationDatabaseIdentityIsAStableSQLSafeName(t *testing.T) {
	identity, err := ApplicationDatabaseIdentityFor("checkout-api", DatabasePostgres)
	if err != nil {
		t.Fatal(err)
	}
	if identity.Username != "app_checkout_api" || identity.Database != "app_checkout_api" {
		t.Fatalf("identity = %#v", identity)
	}
	if !databaseIdentifier.MatchString(identity.Username) {
		t.Fatalf("identity is not a bare SQL identifier: %q", identity.Username)
	}
	repeat, err := ApplicationDatabaseIdentityFor("checkout-api", DatabasePostgres)
	if err != nil || repeat != identity {
		t.Fatalf("identity must be stable across calls: %#v %#v %v", identity, repeat, err)
	}
	if _, err := ApplicationDatabaseIdentityFor("Checkout API", DatabasePostgres); err == nil {
		t.Fatal("an invalid application name must not produce an identifier")
	}
	if _, err := ApplicationDatabaseIdentityFor("checkout", "mysql"); err == nil {
		t.Fatal("an unmanaged engine must not produce an identifier")
	}
}

func TestApplicationConnectionURIsScopeEachEngineToTheApplication(t *testing.T) {
	password, err := generatedPassword()
	if err != nil {
		t.Fatal(err)
	}
	for engine, want := range map[string]string{
		DatabasePostgres: "postgres://app_shop:" + password + "@swarmops-postgres-postgres.swarmops.internal:15432/app_shop?sslmode=disable",
		DatabaseMongo:    "mongodb://app_shop:" + password + "@swarmops-mongo-mongo.swarmops.internal:17017/app_shop?authSource=app_shop",
		DatabaseRedis:    "redis://app_shop:" + password + "@swarmops-redis-redis.swarmops.internal:16379/0",
	} {
		definition, err := DatabaseDefinitionFor(engine)
		if err != nil {
			t.Fatal(err)
		}
		identity, err := ApplicationDatabaseIdentityFor("shop", engine)
		if err != nil {
			t.Fatal(err)
		}
		uri, err := definition.applicationConnectionURI(identity, password)
		if err != nil {
			t.Fatal(err)
		}
		if uri != want {
			t.Fatalf("%s URI = %q, want %q", engine, uri, want)
		}
		// The sealed URI is the only record of a password that was written to
		// a write-only Swarm secret, so a rerun has to be able to recover it.
		if recovered := passwordFromURI(uri); recovered != password {
			t.Fatalf("%s password was not recoverable from its sealed URI", engine)
		}
		if definition.Username != "" && strings.Contains(uri, definition.Username+":"+password) {
			t.Fatalf("%s URI still carries the engine superuser: %q", engine, uri)
		}
	}
}

func TestGeneratedPasswordsAreURLSafeAndOthersAreRefused(t *testing.T) {
	for range 32 {
		password, err := generatedPassword()
		if err != nil {
			t.Fatal(err)
		}
		if err := validateGeneratedPassword(password); err != nil {
			t.Fatalf("generated password %q was refused: %v", password, err)
		}
	}
	for _, password := range []string{"", "with space", "at@sign", "slash/", "colon:", "percent%20"} {
		if err := validateGeneratedPassword(password); err == nil {
			t.Fatalf("password %q must be refused", password)
		}
	}
	if passwordFromURI("postgres://app_shop@host:5432/db") != "" {
		t.Fatal("a URI without a password must recover nothing")
	}
	if passwordFromURI("not-a-uri") != "" {
		t.Fatal("a malformed URI must recover nothing")
	}
}

func TestApplicationSecretAndBootstrapNamesAreDerivedFromTheApplication(t *testing.T) {
	if name := applicationPasswordSecretName("checkout-api", DatabaseMongo); name != "swarmops_app_checkout_api_mongo_password_v1" {
		t.Fatalf("password secret name = %q", name)
	}
	if name := bootstrapServiceName("checkout-api", DatabaseRedis); name != "swarmops-bootstrap-checkout-api-redis" {
		t.Fatalf("bootstrap service name = %q", name)
	}
	postgres, _ := DatabaseDefinitionFor(DatabasePostgres)
	target, argv := bootstrapCommand(postgres, ApplicationDatabaseIdentity{})
	if target != "/swarmops/bootstrap.sh" || strings.Join(argv, " ") != "sh /swarmops/bootstrap.sh" {
		t.Fatalf("postgres bootstrap command = %q %#v", target, argv)
	}
	mongo, _ := DatabaseDefinitionFor(DatabaseMongo)
	target, argv = bootstrapCommand(mongo, ApplicationDatabaseIdentity{})
	if target != "/swarmops/bootstrap.js" || strings.Join(argv, " ") != "mongosh --quiet --nodb --file /swarmops/bootstrap.js" {
		t.Fatalf("mongo bootstrap command = %q %#v", target, argv)
	}
	// The job reaches the engine on the internal data overlay by its Swarm
	// service name and target port, never through the routing mesh.
	environment := strings.Join(bootstrapEnvironment(postgres), " ")
	if !strings.Contains(environment, "PGHOST=swarmops-postgres_postgres") || !strings.Contains(environment, "PGPORT=5432") {
		t.Fatalf("postgres bootstrap environment = %q", environment)
	}
}

func TestRenderApplicationDeliversTheURIUnderTheNamesTheApplicationReads(t *testing.T) {
	spec := ApplicationSpec{
		DatabaseDelivery: DeliveryEnv,
		DatabaseEnv:      map[string][]string{DatabasePostgres: {"DATABASE_URL", "SQLALCHEMY_DATABASE_URI"}},
		Databases:        []string{DatabasePostgres},
		Image:            "ghcr.io/acme/shop:v1",
		Name:             "shop",
		Port:             8080,
	}
	rendered, err := RenderApplication(ApplicationRenderInput{
		DatabaseURIs: map[string]string{DatabasePostgres: "postgres://app_shop:secret@host:15432/app_shop"},
		Namespace:    "swarmops",
		Spec:         spec,
	})
	if err != nil {
		t.Fatal(err)
	}
	document := string(rendered)
	for _, variable := range []string{"DATABASE_URL:", "SQLALCHEMY_DATABASE_URI:", "POSTGRES_URL:"} {
		if !strings.Contains(document, variable) {
			t.Fatalf("rendered application is missing %s:\n%s", variable, document)
		}
	}

	spec.DatabaseDelivery = DeliverySecret
	rendered, err = RenderApplication(ApplicationRenderInput{
		DatabaseURIs: map[string]string{DatabasePostgres: "postgres://app_shop:secret@host:15432/app_shop"},
		Namespace:    "swarmops",
		Spec:         spec,
	})
	if err != nil {
		t.Fatal(err)
	}
	document = string(rendered)
	if strings.Contains(document, "postgres://app_shop:secret") {
		t.Fatalf("secret delivery must not inline the URI:\n%s", document)
	}
	for _, variable := range []string{"DATABASE_URL_FILE:", "SQLALCHEMY_DATABASE_URI_FILE:", "POSTGRES_URL_FILE:"} {
		if !strings.Contains(document, variable) {
			t.Fatalf("rendered application is missing %s:\n%s", variable, document)
		}
	}
}

func TestApplicationSpecRefusesConflictingDatabaseVariables(t *testing.T) {
	spec := ApplicationSpec{
		DatabaseEnv: map[string][]string{DatabasePostgres: {"DATABASE_URL"}},
		Databases:   []string{DatabasePostgres},
		Env:         map[string]string{"DATABASE_URL": "postgres://elsewhere"},
		Image:       "ghcr.io/acme/shop:v1",
		Name:        "shop",
		Port:        8080,
	}.Normalize()
	if err := spec.Validate(); err == nil {
		t.Fatal("a variable set both directly and by a managed database must be refused")
	}
	// An engine that is not attached contributes no variables at all.
	spec = ApplicationSpec{
		DatabaseEnv: map[string][]string{DatabaseMongo: {"MONGO_URI"}},
		Databases:   []string{DatabasePostgres},
		Image:       "ghcr.io/acme/shop:v1",
		Name:        "shop",
		Port:        8080,
	}.Normalize()
	if spec.DatabaseEnv != nil {
		t.Fatalf("unattached engine variables must be dropped: %#v", spec.DatabaseEnv)
	}
}
