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
