package scripts

import (
	"os"
	"os/exec"
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

func TestNativeAgentInstallerHelpStartsWithOnlineInstallCommands(t *testing.T) {
	command := exec.Command("bash", "install-swarmops-agent.sh", "--help")
	output, err := command.CombinedOutput()
	if err != nil {
		t.Fatalf("read Agent installer help: %v\n%s", err, output)
	}
	text := string(output)
	linux := "curl -fsSL https://github.com/nimasrn/SwarmOps/releases/latest/download/install-swarmops-agent.sh | sudo bash"
	macOS := "curl -fsSL https://github.com/nimasrn/SwarmOps/releases/latest/download/install-swarmops-agent.sh | bash"
	for _, required := range []string{linux, macOS} {
		if !strings.Contains(text, required) {
			t.Fatalf("Agent installer help is missing canonical online install %q", required)
		}
	}
	if strings.Index(text, linux) > strings.Index(text, "Advanced use:") {
		t.Fatal("zero-argument online installs must be documented before advanced options")
	}
}

func TestNativeAgentInstallerZeroArgumentContract(t *testing.T) {
	data, err := os.ReadFile("install-swarmops-agent.sh")
	if err != nil {
		t.Fatal(err)
	}
	script := string(data)
	for _, required := range []string{
		`if [[ "$#" -eq 0 ]]`,
		`if [[ "$os_name" == Linux ]]`,
		`install_dependencies=true`,
		`apt-get update </dev/null`,
		`apt-get install --yes --no-install-recommends ca-certificates curl openssl </dev/null`,
		`Waiting for the local Agent health check.`,
	} {
		if !strings.Contains(script, required) {
			t.Fatalf("Agent installer is missing zero-argument contract %q", required)
		}
	}
}

func TestNativeAgentOnlineInstallDocumentation(t *testing.T) {
	for _, document := range []string{"../README.md", "../docs/Native-Release-Updates.md", "../deploy/README.md"} {
		data, err := os.ReadFile(document)
		if err != nil {
			t.Fatalf("read %s: %v", document, err)
		}
		text := string(data)
		for _, required := range []string{
			"curl -fsSL https://github.com/nimasrn/SwarmOps/releases/latest/download/install-swarmops-agent.sh | sudo bash",
			"curl -fsSL https://github.com/nimasrn/SwarmOps/releases/latest/download/install-swarmops-agent.sh | bash",
		} {
			if !strings.Contains(text, required) {
				t.Fatalf("%s is missing online Agent install %q", document, required)
			}
		}
	}
}

func TestNativeAgentInstallerAcceptsDefaultLinuxPaths(t *testing.T) {
	data, err := os.ReadFile("install-swarmops-agent.sh")
	if err != nil {
		t.Fatal(err)
	}
	script := string(data)
	functionStart := strings.Index(script, "value_is_safe() {")
	functionEnd := strings.Index(script[functionStart:], "\n}\n")
	if functionStart < 0 || functionEnd < 0 {
		t.Fatal("installer is missing value_is_safe")
	}
	command := exec.Command("bash", "-s")
	command.Stdin = strings.NewReader(script[functionStart:functionStart+functionEnd+3] + `
set -e
for path in \
  /etc/swarmops-agent \
  /etc/swarmops-agent/tls \
  /usr/local/lib/swarmops-agent \
  /usr/local/lib/swarmops-agent/releases \
  /etc/systemd/system/swarmops-agent.service \
  /etc/systemd/system/swarmops-agent-warden.service; do
  value_is_safe "$path"
done
if value_is_safe '/etc/swarmops agent'; then
  exit 1
fi
`)
	if output, err := command.CombinedOutput(); err != nil {
		t.Fatalf("safe-path validation contract failed: %v\n%s", err, output)
	}
}

func TestReleaseSwitchReplacesExistingCurrentSymlink(t *testing.T) {
	for _, scriptName := range []string{
		"install-swarmops-agent.sh",
		"bootstrap-swarmops-control-plane.sh",
	} {
		t.Run(scriptName, func(t *testing.T) {
			data, err := os.ReadFile(scriptName)
			if err != nil {
				t.Fatal(err)
			}
			script := string(data)
			for _, required := range []string{
				"Linux) mv -Tf \"$temporary_link\" \"$release_dir/current\" ;;",
				"Darwin) mv -fh \"$temporary_link\" \"$release_dir/current\" ;;",
			} {
				if !strings.Contains(script, required) {
					t.Fatalf("missing atomic current-switch contract %q", required)
				}
			}
			functionStart := strings.Index(script, "set_current_release() {")
			if functionStart < 0 {
				t.Fatal("installer is missing set_current_release")
			}
			functionEnd := strings.Index(script[functionStart:], "\n}\n")
			if functionEnd < 0 {
				t.Fatal("installer has an incomplete set_current_release")
			}
			command := exec.Command("bash", "-s")
			command.Env = append(os.Environ(), "TMPDIR="+t.TempDir())
			command.Stdin = strings.NewReader(script[functionStart:functionStart+functionEnd+3] + `
set -e
case "$(uname -s)" in
  Linux) os_name=Linux ;;
  Darwin) os_name=Darwin ;;
  *) exit 2 ;;
esac
release_dir="$(mktemp -d "${TMPDIR}/swarmops-current.XXXXXX")"
release_version=v0.5.3
mkdir "$release_dir/v0.5.0" "$release_dir/$release_version"
ln -s v0.5.0 "$release_dir/current"
set_current_release
[ "$(readlink "$release_dir/current")" = "$release_version" ]
[ ! -e "$release_dir/v0.5.0/.current-next" ]
`)
			if output, err := command.CombinedOutput(); err != nil {
				t.Fatalf("atomic current-switch contract failed: %v\n%s", err, output)
			}
		})
	}
}
