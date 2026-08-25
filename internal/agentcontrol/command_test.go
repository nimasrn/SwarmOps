package agentcontrol

import (
	"reflect"
	"testing"
)

func TestManagedBootstrapVocabularyIsClosed(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name    string
		request BootstrapRequest
		valid   bool
	}{
		{name: "install Docker", request: BootstrapRequest{Action: BootstrapDockerInstall}, valid: true},
		{name: "init Swarm", request: BootstrapRequest{Action: BootstrapSwarmInit, AdvertiseAddr: "10.0.0.20"}, valid: true},
		{name: "join Swarm", request: BootstrapRequest{Action: BootstrapSwarmJoin, JoinToken: "SWMTKN-1-abcdefgh-abcdefghijklmnop", ManagerAddr: "manager.example.com:2377"}, valid: true},
		{name: "reject shell", request: BootstrapRequest{Action: "shell", ManagerAddr: "manager.example.com:2377"}},
		{name: "reject injected manager", request: BootstrapRequest{Action: BootstrapSwarmJoin, JoinToken: "SWMTKN-1-abcdefgh-abcdefghijklmnop", ManagerAddr: "manager:2377;id"}},
		{name: "reject token as Docker input", request: BootstrapRequest{Action: BootstrapDockerInstall, JoinToken: "SWMTKN-1-abcdefgh-abcdefghijklmnop"}},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			err := ValidateBootstrapRequest(test.request)
			if (err == nil) != test.valid {
				t.Fatalf("ValidateBootstrapRequest(%#v) error = %v", test.request, err)
			}
		})
	}
}

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
			name: "move reviewed service",
			args: []string{"service", "update", "--detach=false", "--constraint-rm", "node.id==node-old", "--constraint-add", "node.id==node-new", "swarmops-mongo_mongo"},
			want: Request{Operation: OperationServiceMove, PriorNodeID: "node-old", ServiceID: "swarmops-mongo_mongo", TargetNodeID: "node-new"},
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
		{"service", "update", "--detach=false", "--constraint-add", "node.id==node-new", "customer_api"},
	} {
		if _, err := FromDockerCLI("docker", args, nil); err == nil {
			t.Fatalf("arbitrary Docker operation was accepted: %#v", args)
		}
	}
	if _, _, err := DockerArgs(Request{Operation: "shell", Name: "whoami"}); err == nil {
		t.Fatal("arbitrary structured operation was accepted")
	}
	if _, _, err := DockerArgs(Request{Operation: OperationStackRemove, Name: "traefik"}); err == nil {
		t.Fatal("unreviewed stack removal was accepted")
	}
}

func TestManagedServiceMoveRoundTripsOnlyCatalogServices(t *testing.T) {
	t.Parallel()
	args, input, err := DockerArgs(Request{Operation: OperationServiceMove, PriorNodeID: "node-old", ServiceID: "swarmops-postgres_postgres", TargetNodeID: "node-new"})
	if err != nil || input != nil {
		t.Fatalf("DockerArgs error=%v input=%q", err, input)
	}
	want := []string{"service", "update", "--detach=false", "--constraint-rm", "node.id==node-old", "--constraint-add", "node.id==node-new", "swarmops-postgres_postgres"}
	if !reflect.DeepEqual(args, want) {
		t.Fatalf("args = %#v, want %#v", args, want)
	}
	if _, _, err := DockerArgs(Request{Operation: OperationServiceMove, ServiceID: "customer_api", TargetNodeID: "node-new"}); err == nil {
		t.Fatal("unreviewed service relocation was accepted")
	}
}
