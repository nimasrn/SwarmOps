package cli

import "testing"

func TestManifestSecretEnvCarriesNamesAndReadsValuesFromEnvironment(t *testing.T) {
	manifest := Manifest{Name: "api", Kind: "Job", SecretEnv: []string{"JWT_SECRET", "UNSET_SECRET"}}
	values := manifest.secretEnv(func(name string) (string, bool) {
		if name == "JWT_SECRET" {
			return "from-environment", true
		}
		return "", false
	})
	if values["JWT_SECRET"] != "from-environment" || values["UNSET_SECRET"] != "" || len(values) != 2 {
		t.Fatalf("secret values = %#v", values)
	}
	if (Manifest{Name: "api"}).secretEnv(nil) != nil {
		t.Fatal("a manifest without secret names must leave stored secrets untouched")
	}
	if manifest.Spec().Kind != "job" {
		t.Fatalf("kind = %q", manifest.Spec().Kind)
	}
}
