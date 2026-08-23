package ops

import (
	"strings"
	"testing"
)

const validCompose = `version: "3.9"
services:
  api:
    image: ghcr.io/example/api:2026.08.23
    environment:
      APP_ENV: production
    volumes:
      - app-data:/var/lib/api
    secrets:
      - source: api_token
        target: api_token
    configs:
      - source: api_config
        target: /etc/api/config.yaml
    deploy:
      resources:
        limits:
          cpus: "1.0"
          memory: 512M
        reservations:
          cpus: "0.25"
          memory: 128M
secrets:
  api_token:
    external: true
configs:
  api_config:
    external: true
volumes:
  app-data: {}
`

func TestValidateComposeAcceptsBoundedImageOnlyStack(t *testing.T) {
	t.Parallel()
	plan, err := ValidateCompose([]byte(validCompose))
	if err != nil {
		t.Fatalf("validate: %v", err)
	}
	if len(plan.Services) != 1 || plan.Services[0] != "api" || !strings.HasPrefix(plan.Digest, "sha256:") {
		t.Fatalf("unexpected plan: %#v", plan)
	}
}

func TestValidateComposeRejectsUnsafeSurfaces(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name string
		edit string
	}{
		{name: "build", edit: "    build: .\n"},
		{name: "port", edit: "    ports:\n      - \"8080:8080\"\n"},
		{name: "secret environment", edit: "    environment:\n      API_TOKEN: leaked\n"},
		{name: "host bind", edit: "    volumes:\n      - /etc:/host\n"},
		{name: "latest image", edit: ""},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			input := strings.Replace(validCompose, "    environment:\n      APP_ENV: production\n", test.edit, 1)
			if test.name == "port" || test.name == "host bind" || test.name == "build" {
				input = strings.Replace(validCompose, "    environment:\n      APP_ENV: production\n", "    environment:\n      APP_ENV: production\n"+test.edit, 1)
			}
			if test.name == "latest image" {
				input = strings.Replace(validCompose, "ghcr.io/example/api:2026.08.23", "ghcr.io/example/api:latest", 1)
			}
			if _, err := ValidateCompose([]byte(input)); err == nil {
				t.Fatal("unsafe compose was accepted")
			}
		})
	}
}

func TestValidateComposeRejectsVolumeDriverOptions(t *testing.T) {
	t.Parallel()
	input := strings.Replace(validCompose, "volumes:\n  app-data: {}", "volumes:\n  app-data:\n    driver: local\n    driver_opts:\n      type: none\n      o: bind\n      device: /etc", 1)
	if _, err := ValidateCompose([]byte(input)); err == nil {
		t.Fatal("host bind hidden behind driver_opts was accepted")
	}
}

func TestValidateComposeRejectsNonOverlayNetworkDriver(t *testing.T) {
	t.Parallel()
	input := validCompose + "\nnetworks:\n  exposed:\n    driver: macvlan\n"
	if _, err := ValidateCompose([]byte(input)); err == nil {
		t.Fatal("macvlan network was accepted")
	}
}

func TestPinComposeToNodeMakesPlacementExplicit(t *testing.T) {
	t.Parallel()
	effective, err := PinComposeToNode([]byte(validCompose), "node-123")
	if err != nil {
		t.Fatalf("pin compose: %v", err)
	}
	if !strings.Contains(string(effective), "node.id == node-123") {
		t.Fatalf("missing placement constraint: %s", effective)
	}
	if _, err := ValidateCompose(effective); err != nil {
		t.Fatalf("effective compose invalid: %v", err)
	}
	withConstraint := strings.Replace(validCompose, "      resources:\n", "      placement:\n        constraints:\n          - node.id == another-node\n      resources:\n", 1)
	if _, err := PinComposeToNode([]byte(withConstraint), "node-123"); err == nil {
		t.Fatal("existing node id constraint should not be overwritten")
	}
}
