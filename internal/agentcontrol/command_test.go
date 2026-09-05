package agentcontrol

import (
	"reflect"
	"testing"
)

func TestFromDockerCLIOnlyConvertsReviewedOperations(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name  string
		args  []string
		input []byte
		want  Request
	}{
		{
			name: "scale service",
			args: []string{"service", "scale", "catalog=3"},
			want: Request{Operation: OperationServiceScale, Replicas: 3, ServiceID: "catalog"},
		},
		{
			name:  "deploy stack",
			args:  []string{"stack", "deploy", "--detach=false", "--resolve-image=changed", "--with-registry-auth", "--compose-file", "-", "demo"},
			input: []byte("services:\n  app:\n    image: example/app:1\n"),
			want: Request{
				Compose:             "services:\n  app:\n    image: example/app:1\n",
				Name:                "demo",
				Operation:           OperationStackDeploy,
				ResolveImageChanged: true,
				WithRegistryAuth:    true,
			},
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got, err := FromDockerCLI("docker", test.args, test.input)
			if err != nil {
				t.Fatal(err)
			}
			if !reflect.DeepEqual(got, test.want) {
				t.Fatalf("request = %#v, want %#v", got, test.want)
			}
		})
	}
}

func TestCommandVocabularyRejectsArbitraryDockerOperations(t *testing.T) {
	t.Parallel()
	for _, args := range [][]string{
		{"container", "rm", "important"},
		{"service", "logs", "--follow", "catalog"},
		{"stack", "deploy", "--detach=false", "--compose-file", "compose.yml", "demo"},
		{"node", "rm", "manager"},
	} {
		if _, err := FromDockerCLI("docker", args, nil); err == nil {
			t.Fatalf("arbitrary Docker operation was accepted: %#v", args)
		}
	}
	if _, _, err := DockerArgs(Request{Operation: "shell", Name: "whoami"}); err == nil {
		t.Fatal("arbitrary structured operation was accepted")
	}
	if _, _, err := DockerArgs(Request{Operation: OperationStackRemove, Name: "Traefik Ingress"}); err == nil {
		t.Fatal("stack removal accepted a name outside the stack pattern")
	}
}

// Core renders the observability stack but declares its configs as external.
// Without these names in the allow-list it could never create them, and Docker
// refused the stack with "config not found" on every fresh cluster.
func TestManagedConfigAllowsReviewedObservabilityConfigs(t *testing.T) {
	t.Parallel()
	for _, name := range []string{
		"swarmops_prometheus_config_v1",
		"swarmops_prometheus_rules_v1",
		"swarmops_alertmanager_config_v1",
		"swarmops_jaeger_config_v1",
		"swarmops_fluentd_aggregator_v1",
		"swarmops_fluentd_forwarder_v1",
		"nim_traefik_dynamic_v1",
		"swarmops_redis_app_bootstrap_a1b2c3d4e5f6",
		"swarmops_postgres_app_bootstrap_0123456789ab",
		"swarmops_mongo_app_bootstrap_fedcba987654",
	} {
		if _, _, err := DockerArgs(Request{Config: "reviewed: true\n", Name: name, Operation: OperationConfigCreate}); err != nil {
			t.Fatalf("reviewed config %s was rejected: %v", name, err)
		}
	}
	for _, name := range []string{"arbitrary_config_v1", "swarmops_prometheus_config", "swarmops_secrets_v1", "../escape", "swarmops_redis_app_bootstrap_nothex", "swarmops_mysql_app_bootstrap_a1b2c3d4e5f6"} {
		if _, _, err := DockerArgs(Request{Config: "x: 1\n", Name: name, Operation: OperationConfigCreate}); err == nil {
			t.Fatalf("unreviewed config %s was accepted", name)
		}
	}
}

// A per-application connection secret is named <stack>_<engine>_uri_v<n>, and
// the stack carries the namespace and application name, so it never starts
// with "swarmops_". Refusing that shape blocked every deployment that attaches
// a managed database.
func TestManagedSecretAllowsApplicationConnectionSecrets(t *testing.T) {
	t.Parallel()
	uri := "redis://:s3cretpassw0rd@swarmops-redis-redis.swarmops.internal:16379/0"
	for _, name := range []string{
		"production-e2e-app_redis_uri_v1",
		"production-vlora-backend_postgres_uri_v1",
		"staging-app_mongo_uri_v2",
		"swarmops_redis_uri_v1",
	} {
		if _, _, err := DockerArgs(Request{Name: name, Operation: OperationSecretCreate, Secret: uri}); err != nil {
			t.Fatalf("reviewed connection secret %s was rejected: %v", name, err)
		}
	}
	for _, name := range []string{"production-app_mysql_uri_v1", "production-app_redis_uri", "../escape_redis_uri_v1"} {
		if _, _, err := DockerArgs(Request{Name: name, Operation: OperationSecretCreate, Secret: uri}); err == nil {
			t.Fatalf("unreviewed secret %s was accepted", name)
		}
	}
}
