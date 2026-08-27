package ops

import (
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

func testDatabaseSettings() DatabaseSettings {
	return DatabaseSettings{
		MongoImage:             "mongo:8.2.3",
		MongoPasswordSecret:    "swarmops_mongo_password_v1",
		PostgresImage:          "postgres:18.2-alpine",
		PostgresPasswordSecret: "swarmops_postgres_password_v1",
		RedisImage:             "redis:8.4-alpine",
		RedisPasswordSecret:    "swarmops_redis_password_v1",
	}
}

func databaseAsset(t *testing.T, engine string) []byte {
	t.Helper()
	_, sourceFile, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("locate database test source")
	}
	repoRoot := filepath.Clean(filepath.Join(filepath.Dir(sourceFile), "../.."))
	raw, err := os.ReadFile(filepath.Join(repoRoot, "deploy", "stacks", "swarmops-"+engine+".yml"))
	if err != nil {
		t.Fatalf("read %s asset: %v", engine, err)
	}
	return raw
}

func TestRenderDatabaseStackResolvesEveryTemplate(t *testing.T) {
	for _, engine := range []string{DatabaseMongo, DatabasePostgres, DatabaseRedis} {
		t.Run(engine, func(t *testing.T) {
			rendered, err := RenderDatabaseStack(engine, databaseAsset(t, engine), testDatabaseSettings())
			if err != nil {
				t.Fatalf("render: %v", err)
			}
			if strings.Contains(string(rendered), "${") {
				t.Fatalf("rendered %s stack still has a template expression", engine)
			}
			if !strings.Contains(string(rendered), "swarmops_"+engine+"_password_v1") {
				t.Fatalf("rendered %s stack lost its password secret name", engine)
			}
		})
	}
}

func TestRenderDatabaseStackRejectsUnsafeSettings(t *testing.T) {
	settings := testDatabaseSettings()
	settings.PostgresImage = "postgres:latest"
	if _, err := RenderDatabaseStack(DatabasePostgres, databaseAsset(t, DatabasePostgres), settings); err == nil {
		t.Fatal("a mutable image tag was accepted")
	}

	settings = testDatabaseSettings()
	settings.RedisPasswordSecret = "not a secret name"
	if _, err := RenderDatabaseStack(DatabaseRedis, databaseAsset(t, DatabaseRedis), settings); err == nil {
		t.Fatal("an invalid secret name was accepted")
	}
}

func TestDatabaseCatalogIsClosed(t *testing.T) {
	if _, err := DatabaseDefinitionFor("mysql"); err == nil {
		t.Fatal("an unlisted engine was accepted")
	}
	if _, err := RenderDatabaseStack("mysql", []byte("services: {}"), testDatabaseSettings()); err == nil {
		t.Fatal("an unlisted engine rendered a stack")
	}
	if DatabaseRemovalConfirmation(DatabaseMongo) != "REMOVE_DATABASE_MONGO" {
		t.Fatalf("unexpected confirmation phrase %q", DatabaseRemovalConfirmation(DatabaseMongo))
	}
}

func TestGeneratedPasswordFitsTheAgentSecretVocabulary(t *testing.T) {
	seen := map[string]bool{}
	for range 32 {
		password, err := generatedPassword()
		if err != nil {
			t.Fatalf("generate: %v", err)
		}
		if len(password) < 16 || seen[password] {
			t.Fatalf("weak or repeated generated password %q", password)
		}
		seen[password] = true
	}
}
