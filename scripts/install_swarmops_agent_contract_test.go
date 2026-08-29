package scripts

import (
	"os"
	"os/exec"
	"strings"
	"testing"
)

func readAgentInstaller(t *testing.T) string {
	t.Helper()
	data, err := os.ReadFile("install-swarmops-agent.sh")
	if err != nil {
		t.Fatal(err)
	}
	return string(data)
}

func readInstaller(t *testing.T, filename string) string {
	t.Helper()
	data, err := os.ReadFile(filename)
	if err != nil {
		t.Fatal(err)
	}
	return string(data)
}

func shellFunction(t *testing.T, script, name string) string {
	t.Helper()
	start := strings.Index(script, name+"() {")
	if start < 0 {
		t.Fatalf("installer is missing %s", name)
	}
	end := strings.Index(script[start:], "\n}\n")
	if end < 0 {
		t.Fatalf("installer has an incomplete %s", name)
	}
	return script[start : start+end+3]
}

func TestPinnedReleaseResolversReturnSuccessUnderErrexit(t *testing.T) {
	for _, filename := range []string{"install-swarmops-agent.sh", "bootstrap-swarmops-control-plane.sh"} {
		t.Run(filename, func(t *testing.T) {
			script := readInstaller(t, filename)
			command := exec.Command("bash", "-s")
			command.Stdin = strings.NewReader("set -e\nrelease_version=v0.10.2\n" + shellFunction(t, script, "resolve_release_version") + "\nresolve_release_version\nprintf 'reached\\n'\n")
			output, err := command.CombinedOutput()
			if err != nil {
				t.Fatalf("pinned release resolver exited under errexit: %v\n%s", err, output)
			}
			if string(output) != "reached\n" {
				t.Fatalf("pinned release resolver output = %q, want reached", output)
			}
		})
	}
}

func TestDisabledAgentUpdatesFinishStatusStepUnderErrexit(t *testing.T) {
	script := readAgentInstaller(t)
	command := exec.Command("bash", "-s")
	command.Stdin = strings.NewReader("set -e\nautomatic_updates=false\n" + shellFunction(t, script, "write_initial_update_status") + "\nwrite_initial_update_status\nprintf 'reached\\n'\n")
	output, err := command.CombinedOutput()
	if err != nil {
		t.Fatalf("disabled update status step exited under errexit: %v\n%s", err, output)
	}
	if string(output) != "reached\n" {
		t.Fatalf("disabled update status output = %q, want reached", output)
	}
}

func TestAgentInstallerOutboundEnrollmentContract(t *testing.T) {
	script := readAgentInstaller(t)
	for _, required := range []string{
		`github_repository="nimasrn/SwarmOps"`,
		`asset_name="swarmops-agent_${release_version}_${release_os}_${release_arch}.tar.gz"`,
		`Agent release bundle checksum does not match checksums.txt`,
		`verify_agent_bundle_layout`,
		`ExecStart=$release_dir/current/swarmops-agent`,
		`"SWARMOPS_CORE_URL=$core_url"`,
		`"SWARMOPS_AGENT_STATE_DIR=$update_status_dir"`,
		`enroll_args=(enroll --core "$core_url"`,
		`enroll_args+=(--core-fingerprint "$core_fingerprint")`,
		`enroll_args+=(--code "$enrollment_code")`,
		`--defer-docker`,
	} {
		if !strings.Contains(script, required) {
			t.Fatalf("Agent installer is missing outbound-enrollment contract %q", required)
		}
	}
}

func TestAgentInstallerHelpDocumentsOutboundInstall(t *testing.T) {
	command := exec.Command("bash", "install-swarmops-agent.sh", "--help")
	output, err := command.CombinedOutput()
	if err != nil {
		t.Fatalf("read Agent installer help: %v\n%s", err, output)
	}
	text := string(output)
	for _, required := range []string{
		"--core <https-url>",
		"--core-fingerprint <SHA256:",
		"--enrollment-code <code>",
		"--defer-docker",
		"--no-auto-update",
		"--release <tag|latest>",
		"--github-repository <owner/name>",
	} {
		if !strings.Contains(text, required) {
			t.Fatalf("Agent installer help is missing %q", required)
		}
	}
}

func TestAgentInstallerUsesChecksumVerifiedWardenUpdates(t *testing.T) {
	script := readAgentInstaller(t)
	for _, required := range []string{
		`SWARMOPS_WARDEN_COMPONENT=agent`,
		`SWARMOPS_WARDEN_RELEASE_DIR=$release_dir`,
		`SWARMOPS_WARDEN_BUSY_FILE=$update_busy_file`,
		`SWARMOPS_WARDEN_REQUEST_FILE=$update_request_file`,
		`SWARMOPS_WARDEN_STATUS_FILE=$update_status_file`,
		`ExecStart=$release_dir/current/swarmops-warden update`,
		`wait_for_agent_health`,
		`set_current_release "$previous_release"`,
	} {
		if !strings.Contains(script, required) {
			t.Fatalf("Agent installer is missing trusted-updater contract %q", required)
		}
	}
	for _, forbidden := range []string{
		`go build`,
		`git clone`,
		`git -C`,
		`GOPROXY`,
		`GOCACHE`,
		`GOMODCACHE`,
	} {
		if strings.Contains(script, forbidden) {
			t.Fatalf("Agent installer still contains source-build dependency %q", forbidden)
		}
	}
}

func TestAgentInstallerAcceptsDefaultLinuxPaths(t *testing.T) {
	script := readAgentInstaller(t)
	functionStart := strings.Index(script, "value_is_safe() {")
	if functionStart < 0 {
		t.Fatal("installer is missing value_is_safe")
	}
	functionEnd := strings.Index(script[functionStart:], "\n}\n")
	if functionEnd < 0 {
		t.Fatal("installer has an incomplete value_is_safe")
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
  /var/lib/swarmops-agent; do
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

func TestCoreReleaseSwitchReplacesExistingCurrentSymlink(t *testing.T) {
	data, err := os.ReadFile("bootstrap-swarmops-control-plane.sh")
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
release_version=v0.6.0
mkdir "$release_dir/v0.5.10" "$release_dir/$release_version"
ln -s v0.5.10 "$release_dir/current"
set_current_release
[ "$(readlink "$release_dir/current")" = "$release_version" ]
[ ! -e "$release_dir/v0.5.10/.current-next" ]
`)
	if output, err := command.CombinedOutput(); err != nil {
		t.Fatalf("atomic current-switch contract failed: %v\n%s", err, output)
	}
}
