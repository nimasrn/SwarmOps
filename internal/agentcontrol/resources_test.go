package agentcontrol

import (
	"strings"
	"testing"
)

// Every resource operation must render to exactly one argv shape and be
// recognised again from that shape. A mismatch between the two directions is
// how an operation silently becomes unreachable through the machine API.
func TestResourceVocabularyRoundTrips(t *testing.T) {
	t.Parallel()
	cases := []struct {
		argv    string
		request Request
	}{
		{"node promote abc123", Request{Operation: OperationNodeRole, Role: "promote", ServiceID: "abc123"}},
		{"node demote abc123", Request{Operation: OperationNodeRole, Role: "demote", ServiceID: "abc123"}},
		{"node update --label-add tier=edge abc123", Request{Key: "tier", Operation: OperationNodeLabelAdd, ServiceID: "abc123", Value: "edge"}},
		{"node update --label-rm tier abc123", Request{Key: "tier", Operation: OperationNodeLabelRemove, ServiceID: "abc123"}},
		{"node rm --force abc123", Request{Operation: OperationNodeRemove, ServiceID: "abc123"}},
		{"service update --image registry.example.com/app:1.2.3 api", Request{Image: "registry.example.com/app:1.2.3", Operation: OperationServiceImage, ServiceID: "api"}},
		{"service update --limit-cpu 1.5 --limit-memory 512M api", Request{CPULimit: "1.5", MemoryLimit: "512M", Operation: OperationServiceLimits, ServiceID: "api"}},
		{"service rm api", Request{Operation: OperationServiceRemove, ServiceID: "api"}},
		{"network create --driver overlay --attachable edge", Request{Attachable: true, Driver: "overlay", Name: "edge", Operation: OperationNetworkCreate}},
		{"network create --driver overlay --attachable --opt encrypted=true traefik", Request{Attachable: true, Driver: "overlay", Encrypted: true, Name: "traefik", Operation: OperationNetworkCreate}},
		{"network create --driver overlay --internal private", Request{Driver: "overlay", Internal: true, Name: "private", Operation: OperationNetworkCreate}},
		{"network rm edge", Request{Name: "edge", Operation: OperationNetworkRemove}},
		{"network prune --force", Request{Operation: OperationNetworkPrune}},
		{"volume create --driver local data", Request{Name: "data", Operation: OperationVolumeCreate}},
		{"volume rm data", Request{Name: "data", Operation: OperationVolumeRemove}},
		{"volume prune --force", Request{Operation: OperationVolumePrune}},
		{"config rm swarmops_traefik_static_v1_0123456789abcdef", Request{Name: "swarmops_traefik_static_v1_0123456789abcdef", Operation: OperationConfigRemove}},
		{"image pull registry.example.com/app:1.2.3", Request{Image: "registry.example.com/app:1.2.3", Operation: OperationImagePull}},
		{"image rm registry.example.com/app:1.2.3", Request{Image: "registry.example.com/app:1.2.3", Operation: OperationImageRemove}},
		{"image prune --force", Request{Operation: OperationImagePrune}},
		{"image prune --force --all", Request{All: true, Operation: OperationImagePrune}},
		{"container start abc123", Request{Operation: OperationContainerStart, ServiceID: "abc123"}},
		{"container stop abc123", Request{Operation: OperationContainerStop, ServiceID: "abc123"}},
		{"container restart abc123", Request{Operation: OperationContainerRestart, ServiceID: "abc123"}},
		{"container rm --force abc123", Request{Operation: OperationContainerRemove, ServiceID: "abc123"}},
		{"container prune --force", Request{Operation: OperationContainerPrune}},
		{"builder prune --force", Request{Operation: OperationBuilderPrune}},
		{"swarm join-token --rotate --quiet worker", Request{Operation: OperationSwarmTokenRotate, Role: "worker"}},
		{"swarm update --task-history-limit 5", Request{Limit: 5, Operation: OperationSwarmUpdate}},
	}
	for _, testCase := range cases {
		args, input, err := DockerArgs(testCase.request)
		if err != nil {
			t.Fatalf("render %s: %v", testCase.argv, err)
		}
		if input != nil {
			t.Fatalf("%s produced standard input", testCase.argv)
		}
		if rendered := strings.Join(args, " "); rendered != testCase.argv {
			t.Fatalf("render = %q, want %q", rendered, testCase.argv)
		}
		parsed, err := FromDockerCLI("docker", args, nil)
		if err != nil {
			t.Fatalf("parse %s: %v", testCase.argv, err)
		}
		if parsed != testCase.request {
			t.Fatalf("parse %s = %#v, want %#v", testCase.argv, parsed, testCase.request)
		}
	}
}

func TestResourceVocabularyRejectsUnsafeArguments(t *testing.T) {
	t.Parallel()
	refused := []Request{
		{Operation: OperationNodeRole, Role: "root", ServiceID: "abc"},
		{Operation: OperationNodeLabelAdd, Key: "tier", ServiceID: "abc", Value: "edge;rm -rf /"},
		{Operation: OperationServiceImage, Image: "app:latest --entrypoint sh", ServiceID: "api"},
		{Operation: OperationServiceLimits, CPULimit: "1.5", MemoryLimit: "512", ServiceID: "api"},
		{Operation: OperationNetworkCreate, Driver: "macvlan", Name: "edge"},
		{Operation: OperationNetworkCreate, Driver: "overlay", Name: "../edge"},
		{Operation: OperationNetworkCreate, Driver: "bridge", Encrypted: true, Name: "edge"},
		{Operation: OperationVolumeCreate, Name: "/etc/passwd"},
		{Operation: OperationImagePull, Image: "app:latest\nrm"},
		{Operation: OperationSwarmTokenRotate, Role: "admin"},
		{Operation: OperationSwarmUpdate, Limit: 0},
		{Operation: OperationContainerRemove, ServiceID: "abc 123"},
	}
	for _, request := range refused {
		if _, _, err := DockerArgs(request); err == nil {
			t.Fatalf("unsafe operation was accepted: %#v", request)
		}
	}
}

// A rotated join token is cluster-admission material. The operation exists so
// an operator can invalidate a leaked token, never so the console can read one.
func TestJoinTokenRotationCarriesNoTokenBack(t *testing.T) {
	t.Parallel()
	args, _, err := DockerArgs(Request{Operation: OperationSwarmTokenRotate, Role: "manager"})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(strings.Join(args, " "), "--quiet") {
		t.Fatalf("join-token rotation did not suppress token output: %v", args)
	}
}
