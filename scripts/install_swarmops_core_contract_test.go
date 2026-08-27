package scripts

import (
	"os"
	"os/exec"
	"strings"
	"testing"
)

func TestCoreInstallerReportsProgressAndPrintsTheProductionUsername(t *testing.T) {
	data, err := os.ReadFile("bootstrap-swarmops-control-plane.sh")
	if err != nil {
		t.Fatal(err)
	}
	script := string(data)
	for _, required := range []string{
		`automatic_setup=false`,
		`if [[ "$#" -eq 0 ]]`,
		`configure_automatic_network`,
		`prompt_value 'Controller IP'`,
		`prompt_value 'Allowed operator CIDR'`,
		`install_dependencies=true`,
		`generate_admin_password=true`,
		`apt-get update </dev/null`,
		`apt-get install --yes --no-install-recommends ca-certificates curl iproute2 openssl </dev/null`,
		`bootstrap_phase="initializing"`,
		"trap unexpected_failure ERR",
		"Starting the SwarmOps Core installation; validating controller settings.",
		"Downloading checksum-verified Core release $release_version for Linux/$release_arch.",
		`os_name="$(uname -s)"`,
		`[[ "$os_name" == Linux ]]`,
		`0.0.0.0/32 permits only the unspecified address; use 0.0.0.0/0 for every IPv4 client`,
		`Change operator access later with: sudo swarmops-core access set-cidrs <CIDR> [CIDR...]`,
		"Waiting for the local Core readiness check.",
		"failed during $bootstrap_phase (exit $status); no URL or credentials were printed.",
		"SWARMOPS_ADMIN_USERNAME=operator",
		"Username: operator",
	} {
		if !strings.Contains(script, required) {
			t.Fatalf("Core installer is missing progress or credential contract %q", required)
		}
	}

	startup := strings.Index(script, "Starting the SwarmOps Core installation; validating controller settings.")
	rootPreflight := strings.Index(script, "\nrequire_root\n")
	if rootPreflight < 0 || startup > rootPreflight {
		t.Fatal("Core installer must announce startup before a root preflight failure")
	}

	command := exec.Command("bash", "-n", "bootstrap-swarmops-control-plane.sh")
	if output, err := command.CombinedOutput(); err != nil {
		t.Fatalf("Core installer is not valid Bash: %v\n%s", err, output)
	}
}

func TestCoreInstallerHelpStartsWithZeroArgumentOnlineInstall(t *testing.T) {
	command := exec.Command("bash", "bootstrap-swarmops-control-plane.sh", "--help")
	output, err := command.CombinedOutput()
	if err != nil {
		t.Fatalf("read Core installer help: %v\n%s", err, output)
	}
	text := string(output)
	canonical := "curl -fsSL https://github.com/nimasrn/SwarmOps/releases/latest/download/install-swarmops-core.sh | sudo bash"
	if !strings.Contains(text, canonical) {
		t.Fatalf("Core installer help is missing canonical online install %q", canonical)
	}
	if strings.Index(text, canonical) > strings.Index(text, "Automation:") {
		t.Fatal("zero-argument online install must be documented before advanced automation")
	}
}

func TestCoreInstallerOnePasteDocumentationKeepsDownloadFailuresVisible(t *testing.T) {
	for _, document := range []string{
		"../README.md",
		"../docs/Native-Release-Updates.md",
		"../deploy/README.md",
	} {
		data, err := os.ReadFile(document)
		if err != nil {
			t.Fatalf("read %s: %v", document, err)
		}
		text := string(data)
		for _, required := range []string{
			"curl -fsSL https://github.com/nimasrn/SwarmOps/releases/latest/download/install-swarmops-core.sh | sudo bash",
			"set -o pipefail",
			"curl --fail --silent --show-error --location",
			"--generate-admin-password",
		} {
			if !strings.Contains(text, required) {
				t.Fatalf("%s is missing one-paste installer contract %q", document, required)
			}
		}
	}
}

func TestCoreReleaseCarriesEveryCollectorConfig(t *testing.T) {
	for _, scriptName := range []string{"build-release-bundles.sh", "bootstrap-swarmops-control-plane.sh"} {
		data, err := os.ReadFile(scriptName)
		if err != nil {
			t.Fatal(err)
		}
		script := string(data)
		for _, asset := range []string{
			"assets/alertmanager.yml",
			"assets/fluentd-aggregator.conf",
			"assets/fluentd-forwarder.conf",
			"assets/jaeger.yml",
			"assets/prometheus-alerts.yml",
			"assets/prometheus.yml",
			"assets/traefik-dynamic.yml",
		} {
			if !strings.Contains(script, asset) {
				t.Fatalf("%s does not carry or verify %s", scriptName, asset)
			}
		}
	}
}
