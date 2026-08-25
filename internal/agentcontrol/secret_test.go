package agentcontrol

import (
	"strings"
	"testing"
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
	if _, err := FromDockerCLI("docker", []string{"secret", "rm", "swarmops_redis_password_v1"}, nil); err == nil {
		t.Fatal("secret removal was accepted")
	}
	request, err := FromDockerCLI("docker", []string{"secret", "ls", "--format", "{{.Name}}"}, nil)
	if err != nil || request.Operation != OperationSecretList {
		t.Fatalf("secret listing conversion failed: %v", err)
	}
}

func TestDatabaseStackRemovalIsAllowListed(t *testing.T) {
	for _, name := range []string{"swarmops-postgres", "swarmops-mongo", "swarmops-redis"} {
		if _, _, err := DockerArgs(Request{Name: name, Operation: OperationStackRemove}); err != nil {
			t.Fatalf("removal of %s was refused: %v", name, err)
		}
	}
	if _, _, err := DockerArgs(Request{Name: "production-api", Operation: OperationStackRemove}); err == nil {
		t.Fatal("an application stack removal was accepted")
	}
}
