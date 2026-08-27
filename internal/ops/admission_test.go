package ops

import (
	"strings"
	"testing"

	"github.com/nimasrn/SwarmOps/internal/preflight"
)

func TestPlatformAdmissionRestrictsBrowserDeploymentsToApplicationProfiles(t *testing.T) {
	t.Parallel()
	manifest := applicationManifest()
	manifest.Workloads = append(manifest.Workloads, preflight.Workload{Name: "mongo", Profile: "mongo-replicaset", Replicas: 3})
	manifest.Nodes = append(manifest.Nodes,
		preflight.Node{Name: "node-02", CPUCores: 4, AvailableCPUCores: 3, MemoryMiB: 4096, AvailableMemoryMiB: 3072, AvailableDiskGiB: 100, Labels: map[string]string{}},
		preflight.Node{Name: "node-03", CPUCores: 4, AvailableCPUCores: 3, MemoryMiB: 4096, AvailableMemoryMiB: 3072, AvailableDiskGiB: 100, Labels: map[string]string{}},
	)
	for index := range manifest.Nodes {
		manifest.Nodes[index].Labels["nim.mongo"] = "true"
		manifest.Nodes[index].Labels["nim.mongo.slot"] = string(rune('1' + index))
	}
	admission, err := NewPlatformAdmission(manifest)
	if err != nil {
		t.Fatal(err)
	}
	if err := admission.ValidateStack("production-mongo", []byte(validCompose)); err == nil || !strings.Contains(err.Error(), "reviewed Git manifest") {
		t.Fatalf("stateful browser deployment error = %v", err)
	}
}

func TestApprovedApplicationsUsesEmptyArrayWhenAdmissionIsDisabled(t *testing.T) {
	t.Parallel()
	var admission *PlatformAdmission
	if approved := admission.ApprovedApplications(); approved == nil || len(approved) != 0 {
		t.Fatalf("approved applications = %#v, want an empty non-nil slice", approved)
	}
}

func TestPlatformAdmissionRequiresARealApprovedRouter(t *testing.T) {
	t.Parallel()
	manifest := applicationManifest()
	manifest.Workloads[0].Domain = "api.example.com"
	manifest.Workloads[0].Resolver = "le"
	manifest.DNS.Providers = []preflight.DNSProvider{{Name: "cloudflare", Type: "cloudflare", CredentialSecret: "traefik_cf_dns_token_v1"}}
	manifest.DNS.Resolvers = []preflight.CertificateResolver{{Name: "le", Challenge: "dns", Provider: "cloudflare"}}
	admission, err := NewPlatformAdmission(manifest)
	if err != nil {
		t.Fatal(err)
	}
	missingRule := `version: "3.9"
services:
  api:
    image: ghcr.io/example/api:2026.08.23
    networks: [traefik-route]
    deploy:
      labels:
        traefik.enable: "true"
        traefik.swarm.network: $ROUTE_NETWORK
        traefik.http.routers.production-api-api.entrypoints: websecure
        traefik.http.routers.production-api-api.tls.certresolver: le
      resources:
        limits: {cpus: "1", memory: 256M}
        reservations: {cpus: "0.25", memory: 128M}
networks:
  traefik-route: {external: true, name: $ROUTE_NETWORK}
`
	missingRule = strings.ReplaceAll(missingRule, "$ROUTE_NETWORK", RouteNetworkName("production-api_api"))
	if err := admission.ValidateStack("production-api", []byte(missingRule)); err == nil || !strings.Contains(err.Error(), "incomplete Traefik router") {
		t.Fatalf("missing router rule error = %v", err)
	}
	validRoute := strings.Replace(missingRule, "        traefik.http.routers.production-api-api.tls.certresolver: le", "        traefik.http.routers.production-api-api.rule: Host(`api.example.com`)\n        traefik.http.routers.production-api-api.tls.certresolver: le", 1)
	if err := admission.ValidateStack("production-api", []byte(validRoute)); err != nil {
		t.Fatalf("approved route rejected: %v", err)
	}
}

func TestPlatformAdmissionAllowsAssignmentAndRemovalWithinReviewedDomainPolicy(t *testing.T) {
	t.Parallel()
	manifest := applicationManifest()
	manifest.Workloads[0].DomainOptional = true
	manifest.Workloads[0].DomainSuffixes = []string{"apps.example.com"}
	manifest.Workloads[0].Resolver = "le"
	manifest.DNS.Providers = []preflight.DNSProvider{{Name: "cloudflare", Type: "cloudflare", CredentialSecret: "traefik_cf_dns_token_v1"}}
	manifest.DNS.Resolvers = []preflight.CertificateResolver{{Name: "le", Challenge: "dns", Provider: "cloudflare"}}
	admission, err := NewPlatformAdmission(manifest)
	if err != nil {
		t.Fatal(err)
	}
	internalOnly := `version: "3.9"
services:
  api:
    image: ghcr.io/example/api:2026.08.25
    deploy:
      resources:
        limits: {cpus: "0.25", memory: 256M}
        reservations: {cpus: "0.25", memory: 256M}
`
	if err := admission.ValidateStack("production-api", []byte(internalOnly)); err != nil {
		t.Fatalf("optional domain removal was rejected: %v", err)
	}
	routed := strings.Replace(internalOnly, "    deploy:\n", `    networks: [traefik]
    deploy:
      labels:
        traefik.enable: "true"
        traefik.swarm.network: $ROUTE_NETWORK
        traefik.http.routers.production-api-web.rule: Host(`+"`"+`tenant.apps.example.com`+"`"+`)
        traefik.http.routers.production-api-web.entrypoints: websecure
        traefik.http.routers.production-api-web.tls.certresolver: le
        traefik.http.services.production-api-web.loadbalancer.server.port: "8080"
`, 1) + `networks:
  traefik-route: {external: true, name: $ROUTE_NETWORK}
`
	routed = strings.ReplaceAll(routed, "networks: [traefik]", "networks: [traefik-route]")
	routed = strings.ReplaceAll(routed, "$ROUTE_NETWORK", RouteNetworkName("production-api_api"))
	if err := admission.ValidateStack("production-api", []byte(routed)); err != nil {
		t.Fatalf("reviewed suffix assignment was rejected: %v\n%s", err, routed)
	}
	unapproved := strings.Replace(routed, "tenant.apps.example.com", "tenant.other.example.com", 1)
	if err := admission.ValidateStack("production-api", []byte(unapproved)); err == nil || !strings.Contains(err.Error(), "outside its reviewed policy") {
		t.Fatalf("unapproved domain error = %v", err)
	}
}

func TestPlatformAdmissionRejectsCrossNamespaceResourcesAndTraefikSurfaces(t *testing.T) {
	t.Parallel()
	manifest := applicationManifest()
	manifest.Workloads[0].Domain = "api.example.com"
	manifest.Workloads[0].Resolver = "le"
	manifest.DNS.Providers = []preflight.DNSProvider{{Name: "cloudflare", Type: "cloudflare", CredentialSecret: "traefik_cf_dns_token_v1"}}
	manifest.DNS.Resolvers = []preflight.CertificateResolver{{Name: "le", Challenge: "dns", Provider: "cloudflare"}}
	admission, err := NewPlatformAdmission(manifest)
	if err != nil {
		t.Fatal(err)
	}
	validRoute := `version: "3.9"
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
        traefik.http.routers.production-api-api.tls.certresolver: le
      resources:
        limits: {cpus: "1", memory: 256M}
        reservations: {cpus: "0.25", memory: 128M}
networks:
  traefik-route: {external: true, name: $ROUTE_NETWORK}
`
	validRoute = strings.ReplaceAll(validRoute, "$ROUTE_NETWORK", RouteNetworkName("production-api_api"))
	withForeignSecret := validRoute + `secrets:
  token:
    external: true
    name: swarmops_admin_password_hash_v1
`
	if err := admission.ValidateStack("production-api", []byte(withForeignSecret)); err == nil || !strings.Contains(err.Error(), "must start") {
		t.Fatalf("cross-namespace secret error = %v", err)
	}
	withTCPRouter := strings.Replace(validRoute, "        traefik.http.routers.production-api-api.entrypoints: websecure\n", "        traefik.http.routers.production-api-api.entrypoints: websecure\n        traefik.tcp.routers.production-api-tcp.rule: HostSNI(`*`)\n", 1)
	if err := admission.ValidateStack("production-api", []byte(withTCPRouter)); err == nil || !strings.Contains(err.Error(), "unsupported Traefik label") {
		t.Fatalf("unsafe Traefik surface error = %v", err)
	}
}

func TestPlatformAdmissionBindsBrowserCapacityToReviewedWorkload(t *testing.T) {
	t.Parallel()
	manifest := applicationManifest()
	manifest.Workloads[0].Resources = preflight.Resources{CPUCores: 0.25, MemoryMiB: 256, DiskGiB: 1}
	admission, err := NewPlatformAdmission(manifest)
	if err != nil {
		t.Fatal(err)
	}
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
	if err := admission.ValidateStack("production-api", []byte(withGlobalMode)); err == nil || !strings.Contains(err.Error(), "replicated mode") {
		t.Fatalf("global mode error = %v", err)
	}
	withExtraReplica := strings.Replace(base, "      resources:\n", "      replicas: 2\n      resources:\n", 1)
	if err := admission.ValidateStack("production-api", []byte(withExtraReplica)); err == nil || !strings.Contains(err.Error(), "exceeding the reviewed workload budget") {
		t.Fatalf("replica budget error = %v", err)
	}
	withNamedVolume := base + `volumes:
  data:
    name: another-stack-data
`
	if err := admission.ValidateStack("production-api", []byte(withNamedVolume)); err == nil || !strings.Contains(err.Error(), "must not override") {
		t.Fatalf("unscoped volume error = %v", err)
	}
}

func applicationManifest() preflight.Manifest {
	return preflight.Manifest{
		APIVersion: preflight.APIVersion,
		Kind:       preflight.Kind,
		Namespace:  "production",
		Registry:   preflight.Registry{Mode: "ghcr", Host: "ghcr.io", Namespace: "nimasrn"},
		Nodes: []preflight.Node{{
			Name: "node-01", CPUCores: 4, AvailableCPUCores: 3, MemoryMiB: 4096, AvailableMemoryMiB: 3072, AvailableDiskGiB: 100, Labels: map[string]string{},
		}},
		Workloads: []preflight.Workload{{Name: "api", Profile: "application", Replicas: 1}},
	}
}
