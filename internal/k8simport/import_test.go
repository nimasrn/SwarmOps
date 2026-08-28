package k8simport

import (
	"strings"
	"testing"
)

const deployment = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-gateway
spec:
  replicas: 3
  template:
    spec:
      nodeSelector:
        tier: edge
      containers:
        - name: api
          image: ghcr.io/nimasrn/api-gateway:9f2c1ab
          ports:
            - containerPort: 8080
          livenessProbe:
            httpGet:
              path: /healthz
              port: 8080
          resources:
            limits:
              memory: 512Mi
`

func TestDeploymentBecomesAService(t *testing.T) {
	got, err := ParseString(deployment)
	if err != nil {
		t.Fatal(err)
	}
	if len(got.Mappings) != 1 || !strings.Contains(got.Mappings[0].To, "replicas: 3") {
		t.Fatalf("want one service with 3 replicas, got %+v", got.Mappings)
	}
	for _, want := range []string{"image: ghcr.io/nimasrn/api-gateway:9f2c1ab", "node.labels.tier == edge", "replicas: 3", "memory: 512M", "healthcheck"} {
		if !strings.Contains(got.Compose, want) {
			t.Fatalf("compose is missing %q:\n%s", want, got.Compose)
		}
	}
}

// The whole point of the package: an object with no equivalent is reported,
// not quietly mapped to something that behaves differently.
func TestAutoscalerIsReportedAsAGapNotMapped(t *testing.T) {
	got, _ := ParseString("kind: HorizontalPodAutoscaler\nmetadata:\n  name: api\n")
	if len(got.Gaps) != 1 {
		t.Fatalf("want a gap, got %+v", got)
	}
	if got.Safe() {
		t.Fatal("a report with a gap is not safe to apply")
	}
	if !strings.Contains(got.Gaps[0].Options, "Kubernetes") {
		t.Fatal("the options must include staying where they are")
	}
}

// A pod with a sidecar has no Swarm equivalent. Mapping it would produce a
// service that starts and silently fails to reach its sidecar on localhost.
func TestMultiContainerPodIsAGap(t *testing.T) {
	manifest := `
kind: Deployment
metadata:
  name: api
spec:
  template:
    spec:
      containers:
        - name: app
          image: app:1
        - name: sidecar
          image: envoy:1
`
	got, _ := ParseString(manifest)
	if len(got.Mappings) != 0 {
		t.Fatalf("mapped a multi-container pod: %+v", got.Mappings)
	}
	if len(got.Gaps) != 1 || !strings.Contains(got.Gaps[0].Why, "localhost") {
		t.Fatalf("the gap must explain what breaks: %+v", got.Gaps)
	}
}

func TestStatefulSetMapsButSaysWhatItLoses(t *testing.T) {
	got, _ := ParseString("kind: StatefulSet\nmetadata:\n  name: db\nspec:\n  replicas: 2\n  template:\n    spec:\n      containers:\n        - name: db\n          image: pg:16\n")
	if len(got.Mappings) != 1 {
		t.Fatalf("want a mapping, got %+v", got)
	}
	if !strings.Contains(got.Mappings[0].Note, "ordinal") {
		t.Fatalf("a translation that changes behaviour must say so: %q", got.Mappings[0].Note)
	}
}

func TestDaemonSetBecomesGlobalMode(t *testing.T) {
	got, _ := ParseString("kind: DaemonSet\nmetadata:\n  name: agent\nspec:\n  template:\n    spec:\n      containers:\n        - name: a\n          image: agent:1\n")
	if !strings.Contains(got.Compose, "mode: global") {
		t.Fatalf("a DaemonSet is a global service:\n%s", got.Compose)
	}
}

func TestLoadBalancerServiceIsAGapButClusterIPIsNot(t *testing.T) {
	lb, _ := ParseString("kind: Service\nmetadata:\n  name: api\nspec:\n  type: LoadBalancer\n")
	if len(lb.Gaps) != 1 {
		t.Fatalf("LoadBalancer needs a provider Swarm cannot ask: %+v", lb)
	}
	cip, _ := ParseString("kind: Service\nmetadata:\n  name: api\nspec:\n  type: ClusterIP\n")
	if len(cip.Mappings) != 1 || len(cip.Gaps) != 0 {
		t.Fatalf("ClusterIP is just an overlay alias: %+v", cip)
	}
}

func TestSecretMappingWarnsAboutTheMountDifference(t *testing.T) {
	got, _ := ParseString("kind: Secret\nmetadata:\n  name: creds\n")
	if !strings.Contains(got.Mappings[0].Note, "environment") {
		t.Fatalf("Swarm secrets are files, and a reader of env vars must be told: %q", got.Mappings[0].Note)
	}
}

func TestUnknownKindIsRefusedRatherThanGuessedAt(t *testing.T) {
	got, _ := ParseString("kind: SealedSecret\nmetadata:\n  name: x\n")
	if len(got.Gaps) != 1 || !strings.Contains(got.Gaps[0].Why, "will not guess") {
		t.Fatalf("an unknown kind must be refused: %+v", got.Gaps)
	}
}

func TestNoiseObjectsAreSkippedAndCounted(t *testing.T) {
	got, _ := ParseString("kind: Namespace\nmetadata:\n  name: prod\n")
	if len(got.Skipped) != 1 || len(got.Gaps) != 0 {
		t.Fatalf("a Namespace is neither a mapping nor a gap: %+v", got)
	}
}

func TestMultiDocumentStreamIsReadWhole(t *testing.T) {
	got, _ := ParseString(deployment + "---\nkind: Service\nmetadata:\n  name: api-gateway\nspec:\n  type: ClusterIP\n---\nkind: HorizontalPodAutoscaler\nmetadata:\n  name: api-gateway\n")
	if len(got.Mappings) != 2 || len(got.Gaps) != 1 {
		t.Fatalf("want 2 mappings and 1 gap, got %d and %d", len(got.Mappings), len(got.Gaps))
	}
}

func TestMalformedYAMLIsReportedNotSwallowed(t *testing.T) {
	got, _ := ParseString("kind: Deployment\n  bad indent: [")
	if len(got.Errors) == 0 {
		t.Fatal("a manifest that cannot be parsed must say so")
	}
	if got.Safe() {
		t.Fatal("a report with parse errors is not safe")
	}
}

// An object name longer than Kubernetes permits is invalid input, and echoing
// it verbatim would let a large paste produce a large response — the request
// limit bounds what is read, not what is returned.
func TestOversizedNameIsBounded(t *testing.T) {
	got, _ := ParseString("kind: ConfigMap\nmetadata:\n  name: " + strings.Repeat("x", 5000) + "\n")
	if len(got.Mappings) != 1 {
		t.Fatalf("want one mapping, got %+v", got)
	}
	if len(got.Mappings[0].From) > 400 {
		t.Fatalf("the name was echoed unbounded: %d chars", len(got.Mappings[0].From))
	}
	if !strings.Contains(got.Mappings[0].From, "truncated") {
		t.Fatal("truncation must be visible, not silent")
	}
}
