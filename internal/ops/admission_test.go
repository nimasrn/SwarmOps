package ops

import (
	"strings"
	"testing"
)

const routedCompose = `version: "3.9"
services:
  api:
    image: ghcr.io/example/api:2026.08.23
    networks: [traefik-route]
    deploy:
      labels:
        traefik.enable: "true"
        traefik.swarm.network: $ROUTE_NETWORK
        traefik.http.routers.production-api-api.rule: Host(api.example.com)
        traefik.http.routers.production-api-api.entrypoints: websecure
        traefik.http.routers.production-api-api.tls.certresolver: http
      resources:
        limits: {cpus: "1", memory: 256M}
        reservations: {cpus: "0.25", memory: 128M}
networks:
  traefik-route: {external: true, name: $ROUTE_NETWORK}
`

func applicationCompose() string {
	return strings.ReplaceAll(routedCompose, "$ROUTE_NETWORK", RouteNetworkName("production-api_api"))
}

// A hostname is the deployment's own choice. This is the whole point of
// removing the platform definition: nothing has to declare "api.example.com"
// anywhere before a deployment may claim it.
func TestApplicationStackAdmissionAcceptsAnyHostnameTheDeploymentClaims(t *testing.T) {
	t.Parallel()
	if err := ValidateApplicationStack("production-api", []byte(applicationCompose())); err != nil {
		t.Fatalf("routed application refused: %v", err)
	}
	other := strings.Replace(applicationCompose(), "api.example.com", "anything.someone-else.test", 1)
	if err := ValidateApplicationStack("production-api", []byte(other)); err != nil {
		t.Fatalf("undeclared hostname refused: %v", err)
	}
}

func TestApplicationStackAdmissionConfinesStacksToTheApplicationNamespace(t *testing.T) {
	t.Parallel()
	err := ValidateApplicationStack("swarmops-observability", []byte(applicationCompose()))
	if err == nil || !strings.Contains(err.Error(), "namespace prefix") {
		t.Fatalf("out-of-namespace stack error = %v", err)
	}
}

func TestApplicationStackAdmissionRequiresACompleteTLSRoute(t *testing.T) {
	t.Parallel()
	missingRule := strings.Replace(applicationCompose(), "        traefik.http.routers.production-api-api.rule: Host(api.example.com)\n", "", 1)
	if err := ValidateApplicationStack("production-api", []byte(missingRule)); err == nil || !strings.Contains(err.Error(), "incomplete Traefik router") {
		t.Fatalf("missing router rule error = %v", err)
	}
	plaintext := strings.Replace(applicationCompose(), "entrypoints: websecure", "entrypoints: web", 1)
	if err := ValidateApplicationStack("production-api", []byte(plaintext)); err == nil || !strings.Contains(err.Error(), "websecure entrypoint") {
		t.Fatalf("plaintext entrypoint error = %v", err)
	}
	noResolver := strings.Replace(applicationCompose(), "        traefik.http.routers.production-api-api.tls.certresolver: http\n", "", 1)
	if err := ValidateApplicationStack("production-api", []byte(noResolver)); err == nil || !strings.Contains(err.Error(), "certificate resolver") {
		t.Fatalf("missing resolver error = %v", err)
	}
}

func TestApplicationStackAdmissionAllowsAnUnroutedApplication(t *testing.T) {
	t.Parallel()
	internalOnly := `version: "3.9"
services:
  api:
    image: ghcr.io/example/api:2026.08.25
    deploy:
      resources:
        limits: {cpus: "0.25", memory: 256M}
        reservations: {cpus: "0.25", memory: 256M}
`
	if err := ValidateApplicationStack("production-api", []byte(internalOnly)); err != nil {
		t.Fatalf("unrouted application refused: %v", err)
	}
}

func TestApplicationStackAdmissionRejectsCrossNamespaceResourcesAndTraefikSurfaces(t *testing.T) {
	t.Parallel()
	withForeignSecret := applicationCompose() + `secrets:
  token:
    external: true
    name: swarmops_admin_password_hash_v1
`
	if err := ValidateApplicationStack("production-api", []byte(withForeignSecret)); err == nil || !strings.Contains(err.Error(), "must start") {
		t.Fatalf("cross-namespace secret error = %v", err)
	}
	withTCPRouter := strings.Replace(applicationCompose(), "        traefik.http.routers.production-api-api.entrypoints: websecure\n", "        traefik.http.routers.production-api-api.entrypoints: websecure\n        traefik.tcp.routers.production-api-tcp.rule: HostSNI(`*`)\n", 1)
	if err := ValidateApplicationStack("production-api", []byte(withTCPRouter)); err == nil || !strings.Contains(err.Error(), "unsupported Traefik label") {
		t.Fatalf("unsafe Traefik surface error = %v", err)
	}
	withForeignRouter := strings.ReplaceAll(applicationCompose(), "traefik.http.routers.production-api-api.", "traefik.http.routers.production-other-api.")
	if err := ValidateApplicationStack("production-api", []byte(withForeignRouter)); err == nil || !strings.Contains(err.Error(), "must start with") {
		t.Fatalf("foreign router name error = %v", err)
	}
}

func TestApplicationStackAdmissionKeepsTheSwarmShapeItCanOperate(t *testing.T) {
	t.Parallel()
	base := `version: "3.9"
services:
  api:
    image: ghcr.io/example/api:2026.08.23
    deploy:
      resources:
        limits: {cpus: "1", memory: 256M}
        reservations: {cpus: "0.25", memory: 128M}
`
	withGlobalMode := strings.Replace(base, "    deploy:\n", "    deploy:\n      mode: global\n", 1)
	if err := ValidateApplicationStack("production-api", []byte(withGlobalMode)); err == nil || !strings.Contains(err.Error(), "replicated mode") {
		t.Fatalf("global mode error = %v", err)
	}
	// Replicas are the deployment's choice now; no ceiling was declared for
	// them anywhere, and the live cluster decides whether Swarm can place them.
	withExtraReplica := strings.Replace(base, "      resources:\n", "      replicas: 3\n      resources:\n", 1)
	if err := ValidateApplicationStack("production-api", []byte(withExtraReplica)); err != nil {
		t.Fatalf("extra replicas refused: %v", err)
	}
	withoutReservations := strings.Replace(base, "        reservations: {cpus: \"0.25\", memory: 128M}\n", "", 1)
	if err := ValidateApplicationStack("production-api", []byte(withoutReservations)); err == nil || !strings.Contains(err.Error(), "resources.reservations") {
		t.Fatalf("missing reservations error = %v", err)
	}
	withNamedVolume := base + `volumes:
  data:
    name: another-stack-data
`
	if err := ValidateApplicationStack("production-api", []byte(withNamedVolume)); err == nil || !strings.Contains(err.Error(), "must not override") {
		t.Fatalf("unscoped volume error = %v", err)
	}
}
