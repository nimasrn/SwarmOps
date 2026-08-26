package scripts

import (
	"os"
	"strings"
	"testing"
)

// The installer writes to real host service locations, so its integration path
// is validated in release-host testing. This contract test prevents the legacy
// native-install branch from regressing to the old unsafe refusal or from
// rewriting the protected key before the release switch.
func TestNativeAgentInstallerLegacyUpgradeContract(t *testing.T) {
	data, err := os.ReadFile("install-swarmops-agent.sh")
	if err != nil {
		t.Fatal(err)
	}
	script := string(data)
	for _, required := range []string{
		"existing_native_install=true",
		"install_command_shim",
		"restart_existing_native_install",
		"Upgraded the existing SwarmOps machine agent and preserved its API key, TLS identity, listener, and service configuration.",
		"unit_has_namespace_error",
		"RestrictNamespaces=no",
		"sudo swarmops-agent upgrade",
	} {
		if !strings.Contains(script, required) {
			t.Fatalf("installer is missing legacy-upgrade contract %q", required)
		}
	}
	legacyBranch := strings.Index(script, "if [[ \"$existing_native_install\" == true ]]; then")
	installKey := strings.LastIndex(script, "\ninstall_api_key\n")
	if legacyBranch < 0 || installKey < 0 || legacyBranch > installKey {
		t.Fatal("legacy installer branch must complete before install_api_key can replace a protected key")
	}
}
