package agentcontrol

import (
	"strings"
	"testing"

	"golang.org/x/crypto/bcrypt"
)

func TestSecretVocabularyAcceptsOnlySwarmOpsGeneratedCredentials(t *testing.T) {
	request, err := FromDockerCLI("docker", []string{"secret", "create", "swarmops_postgres_password_v1", "-"}, []byte("Zm9vYmFyLXBhc3N3b3JkLXZhbHVl"))
	if err != nil {
		t.Fatalf("convert secret create: %v", err)
	}
	args, stdin, err := DockerArgs(request)
	if err != nil {
		t.Fatalf("render secret create: %v", err)
	}
	if strings.Join(args, " ") != "secret create swarmops_postgres_password_v1 -" || string(stdin) != "Zm9vYmFyLXBhc3N3b3JkLXZhbHVl" {
		t.Fatalf("unexpected argv %q or stdin %q", args, stdin)
	}
}

func TestSecretVocabularyAcceptsOnlyBcryptDashboardAuthentication(t *testing.T) {
	hash, err := bcrypt.GenerateFromPassword([]byte("dashboard-password"), bcrypt.MinCost)
	if err != nil {
		t.Fatal(err)
	}
	value := "operator:" + string(hash)
	request, err := FromDockerCLI("docker", []string{"secret", "create", "traefik_dashboard_auth_v1", "-"}, []byte(value))
	if err != nil {
		t.Fatal(err)
	}
	args, stdin, err := DockerArgs(request)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Join(args, " ") != "secret create traefik_dashboard_auth_v1 -" || string(stdin) != value {
		t.Fatalf("dashboard secret render = %q, %q", args, stdin)
	}
	for _, invalid := range []string{"admin:" + string(hash), "operator:plaintext-password"} {
		if _, _, err := DockerArgs(Request{Name: "traefik_dashboard_auth_v1", Operation: OperationSecretCreate, Secret: invalid}); err == nil {
			t.Fatalf("invalid dashboard auth was accepted: %q", invalid)
		}
	}
}

func TestConfigVocabularyAcceptsReviewedTraefikDynamicConfig(t *testing.T) {
	content := "http:\n  middlewares: {}\n"
	request, err := FromDockerCLI("docker", []string{"config", "create", "nim_traefik_dynamic_v1", "-"}, []byte(content))
	if err != nil {
		t.Fatal(err)
	}
	args, stdin, err := DockerArgs(request)
	if err != nil || strings.Join(args, " ") != "config create nim_traefik_dynamic_v1 -" || string(stdin) != content {
		t.Fatalf("dynamic config render = %q, %q, %v", args, stdin, err)
	}
}

func TestSecretVocabularyRejectsForeignNamesAndValues(t *testing.T) {
	cases := map[string]Request{
		"name outside the swarmops prefix": {Name: "traefik_cf_dns_token_v1", Operation: OperationSecretCreate, Secret: "a-valid-secret-value"},
		"name with a path traversal":       {Name: "swarmops_../etc/passwd", Operation: OperationSecretCreate, Secret: "a-valid-secret-value"},
		"empty value":                      {Name: "swarmops_redis_password_v1", Operation: OperationSecretCreate},
		"value with a newline":             {Name: "swarmops_redis_password_v1", Operation: OperationSecretCreate, Secret: "value\nwith-newline-injection"},
	}
	for name, request := range cases {
		t.Run(name, func(t *testing.T) {
			if _, _, err := DockerArgs(request); err == nil {
				t.Fatalf("expected %s to be rejected", name)
			}
		})
	}
}

func TestSecretListIsTheOnlyReadShape(t *testing.T) {
	if _, err := FromDockerCLI("docker", []string{"secret", "ls"}, nil); err == nil {
		t.Fatal("an unbounded secret listing was accepted")
	}
	if _, err := FromDockerCLI("docker", []string{"secret", "inspect", "swarmops_redis_password_v1"}, nil); err == nil {
		t.Fatal("secret inspection was accepted")
	}
	if _, _, err := DockerArgs(Request{Name: "swarmops_redis_password_v1", Operation: OperationSecretRemove}); err == nil {
		t.Fatal("managed database secret removal was accepted")
	}
	request, err := FromDockerCLI("docker", []string{"secret", "rm", "traefik_dns_cloudflare_production_v1"}, nil)
	if err != nil {
		t.Fatalf("old provider secret removal conversion failed: %v", err)
	}
	args, _, err := DockerArgs(request)
	if err != nil || strings.Join(args, " ") != "secret rm traefik_dns_cloudflare_production_v1" {
		t.Fatalf("old provider secret removal render = %q, %v", strings.Join(args, " "), err)
	}
	request, err = FromDockerCLI("docker", []string{"secret", "ls", "--format", "{{.Name}}"}, nil)
	if err != nil || request.Operation != OperationSecretList {
		t.Fatalf("secret listing conversion failed: %v", err)
	}
}

// Stack removal is name-shaped rather than allow-listed: the console removes
// application stacks as well as the platform's own, and an application stack
// name is not knowable to the agent. The audited command ledger is the gate.
func TestStackRemovalRequiresAValidStackName(t *testing.T) {
	for _, name := range []string{"swarmops-postgres", "swarmops-mongo", "swarmops-redis", "production-api"} {
		if _, _, err := DockerArgs(Request{Name: name, Operation: OperationStackRemove}); err != nil {
			t.Fatalf("removal of %s was refused: %v", name, err)
		}
	}
	for _, name := range []string{"", "Production API", "../etc", "a;rm -rf /"} {
		if _, _, err := DockerArgs(Request{Name: name, Operation: OperationStackRemove}); err == nil {
			t.Fatalf("stack removal accepted invalid name %q", name)
		}
	}
}
