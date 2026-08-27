package ops

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/nimasrn/SwarmOps/internal/preflight"
)

// This drives the repository's own checked-in example files — the platform
// manifest and the vlora application specs — through the real renderer, the
// real Compose policy, and the real platform admission. It is the closest this
// repository can get to the end-to-end claim without a live cluster: it proves
// the documents are mutually consistent and that the rendered stacks would be
// admitted. It does not prove that a cluster accepted them, that DNS resolved,
// or that a certificate was issued.
func TestCheckedInVloraExamplesRenderAndAreAdmitted(t *testing.T) {
	root := filepath.Join("..", "..", "deploy", "swarmops")
	manifest, err := preflight.LoadFile(filepath.Join(root, "platform.example.yml"))
	if err != nil {
		t.Fatalf("load example platform manifest: %v", err)
	}
	admission, err := NewPlatformAdmission(manifest)
	if err != nil {
		t.Fatalf("example platform manifest is not admissible: %v", err)
	}

	raw, err := os.ReadFile(filepath.Join(root, "applications.example.json"))
	if err != nil {
		t.Fatalf("read example applications: %v", err)
	}
	var file struct {
		Applications []ApplicationSpec `json:"applications"`
	}
	if err := json.Unmarshal(raw, &file); err != nil {
		t.Fatalf("parse example applications: %v", err)
	}
	if len(file.Applications) != 2 {
		t.Fatalf("expected the two vlora examples, got %d", len(file.Applications))
	}

	uris := map[string]string{
		DatabaseMongo: "mongodb://swarmops:pw@swarmops-mongo_mongo:27017/swarmops?authSource=admin",
		DatabaseRedis: "redis://:pw@swarmops-redis_redis:6379/0",
	}
	specs := map[string]ApplicationSpec{}
	for _, spec := range file.Applications {
		specs[spec.Name] = spec.Normalize()
	}

	for _, spec := range file.Applications {
		spec = spec.Normalize()
		t.Run(spec.Name, func(t *testing.T) {
			input := ApplicationRenderInput{DatabaseURIs: uris, Namespace: manifest.Namespace, Spec: spec}
			if spec.Backend != "" {
				backend, found := specs[spec.Backend]
				if !found {
					t.Fatalf("example names an unknown backend %q", spec.Backend)
				}
				input.BackendDomain = backend.Domain
				input.BackendPort = backend.Port
			}
			rendered, err := RenderApplication(input)
			if err != nil {
				t.Fatalf("render: %v", err)
			}
			if _, err := ValidateCompose(rendered); err != nil {
				t.Fatalf("compose policy refused the example: %v\n%s", err, rendered)
			}
			stack := spec.StackName(manifest.Namespace)
			if err := admission.ValidateStack(stack, rendered); err != nil {
				t.Fatalf("platform admission refused the example: %v\n%s", err, rendered)
			}

			document := string(rendered)
			serviceKey := spec.ServiceDNSName(manifest.Namespace)
			internalHost := defaultRouteKey(serviceKey) + ".swarmops.internal"
			if !strings.Contains(document, "Host(`"+internalHost+"`)") {
				t.Fatalf("%s has no fail-closed internal route", spec.Name)
			}
			if !strings.Contains(document, "healthcheck") {
				t.Fatalf("%s has no health probe", spec.Name)
			}
			if !strings.Contains(document, RouteNetworkName(serviceKey)) || strings.Contains(document, "swarmops-data") || strings.Contains(document, "name: swarmops\n") {
				t.Fatalf("%s is not isolated on its dedicated Traefik route network", spec.Name)
			}
			for _, engine := range spec.Databases {
				if !strings.Contains(document, stack+"_"+engine+"_uri_v1") {
					t.Fatalf("%s is not wired to managed %s", spec.Name, engine)
				}
			}
			if strings.Contains(document, "pw@") {
				t.Fatalf("%s leaked a credential into its rendered compose", spec.Name)
			}
		})
	}
}
