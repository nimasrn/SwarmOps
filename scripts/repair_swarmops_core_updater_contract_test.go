package scripts

import (
	"os"
	"os/exec"
	"strings"
	"testing"
)

func TestCoreUpdaterRecoveryUsesVerifiedFixedWarden(t *testing.T) {
	data, err := os.ReadFile("repair-swarmops-core-updater.sh")
	if err != nil {
		t.Fatal(err)
	}
	script := string(data)
	for _, required := range []string{
		`recovery_release="warden-v0.6.0.1"`,
		`curl_options=(--fail --silent --show-error --location --proto '=https' --proto-redir '=https')`,
		`checksum_command=(sha256sum --check -)`,
		`bundle_name="swarmops-warden_${recovery_release}_linux_${release_arch}.tar.gz"`,
		`tar -xzf "$bundle_file" -C "$recovery_dir" swarmops-warden`,
		`SWARMOPS_WARDEN_HEALTH_INTERVAL)`,
		`export "$key=$value"`,
		`"$recovery_dir/swarmops-warden" update`,
	} {
		if !strings.Contains(script, required) {
			t.Fatalf("Core updater recovery is missing contract %q", required)
		}
	}
	command := exec.Command("bash", "-n", "repair-swarmops-core-updater.sh")
	if output, err := command.CombinedOutput(); err != nil {
		t.Fatalf("Core updater recovery is not valid Bash: %v\n%s", err, output)
	}
}

func TestReleaseBuildPublishesCoreUpdaterRecovery(t *testing.T) {
	data, err := os.ReadFile("build-release-bundles.sh")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(data), `repair-swarmops-core-updater.sh "$output_dir/repair-swarmops-core-updater.sh"`) {
		t.Fatal("native release build does not publish Core updater recovery")
	}
}

func TestWardenRecoveryReleaseCannotReplaceStableLatest(t *testing.T) {
	build, err := os.ReadFile("build-warden-recovery-release.sh")
	if err != nil {
		t.Fatal(err)
	}
	for _, required := range []string{
		`^warden-v[A-Za-z0-9][A-Za-z0-9._-]*$`,
		`swarmops-warden_${release_tag}_linux_${architecture}.tar.gz`,
		`repair-swarmops-core-updater.sh "$output_dir/repair-swarmops-core-updater.sh"`,
	} {
		if !strings.Contains(string(build), required) {
			t.Fatalf("Warden recovery build is missing contract %q", required)
		}
	}
	workflow, err := os.ReadFile("../.github/workflows/release-warden.yml")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(workflow), "--prerelease --verify-tag") {
		t.Fatal("Warden recovery workflow could replace GitHub's stable latest release")
	}
}
