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

func TestAgentInstallerOutboundEnrollmentContract(t *testing.T) {
	script := readAgentInstaller(t)
	for _, required := range []string{
		`repo_url="https://github.com/nimasrn/SwarmOps.git"`,
		`trusted_update_repo="https://github.com/nimasrn/SwarmOps.git"`,
		`[[ -f "$source_dir/go.mod" ]]`,
		`CGO_ENABLED=0 go build -trimpath -o "$temporary_binary" ./cmd/agent`,
		`"SWARMOPS_CORE_URL=$core_url"`,
		`"SWARMOPS_AGENT_STATE_DIR=$update_status_dir"`,
		`enroll_args=(enroll --core "$core_url"`,
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
		"--enrollment-code <code>",
		"--defer-docker",
		"--no-auto-update",
		"default: nimasrn/SwarmOps",
	} {
		if !strings.Contains(text, required) {
			t.Fatalf("Agent installer help is missing %q", required)
		}
	}
}

func TestAgentInstallerKeepsUpdaterSourceFixed(t *testing.T) {
	script := readAgentInstaller(t)
	for _, required := range []string{
		`printf 'repo_url=%q\n' "$trusted_update_repo"`,
		`printf 'branch=%q\n' 'main'`,
		`if [[ "$automatic_updates" == true && ( "$repo_url" != "$trusted_update_repo" || "$branch" != main ) ]]; then`,
		`automatic_updates=false`,
	} {
		if !strings.Contains(script, required) {
			t.Fatalf("Agent installer is missing trusted-updater contract %q", required)
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
  /opt/swarmops-agent/source \
  /etc/swarmops-agent \
  /etc/swarmops-agent/tls \
  /usr/local/lib/swarmops-agent \
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
