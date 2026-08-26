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
		`bootstrap_phase="initializing"`,
		"trap unexpected_failure ERR",
		"Starting the SwarmOps Core installation; validating controller settings.",
		"Downloading checksum-verified Core release $release_version for Linux/$release_arch.",
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
