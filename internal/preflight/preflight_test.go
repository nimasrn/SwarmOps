package preflight

import "testing"

func validManifest() Manifest {
	return Manifest{
		APIVersion: APIVersion,
		Kind:       Kind,
		Namespace:  "production",
		Registry:   Registry{Mode: "ghcr", Host: "ghcr.io", Namespace: "nimasrn"},
		Build:      Build{NodeLabel: "nim.build", CacheNodeLabel: "nim.cache"},
		Ingress:    Ingress{PublicIPs: []string{"198.51.100.10"}},
		DNS: DNS{
			Providers: []DNSProvider{
				{Name: "cloudflare", Type: "cloudflare", CredentialSecret: "traefik_cf_dns_token_v1"},
				{Name: "arvan", Type: "arvancloud", CredentialSecret: "traefik_arvan_api_key_v1"},
			},
			Resolvers: []CertificateResolver{
				{Name: "le", Challenge: "dns", Provider: "cloudflare"},
				{Name: "arvan", Challenge: "dns", Provider: "arvan"},
				{Name: "http", Challenge: "http"},
			},
		},
		Storage: []ObjectStorageProvider{{Name: "primary", Endpoint: "https://s3.example.com", Bucket: "swarmops", CredentialSecret: "swarmops_s3_primary_v1"}},
		Backup:  Backup{Provider: "primary", Prefix: "swarmops/production", Schedule: "15 3 * * *"},
		Nodes: []Node{
			{Name: "node-01", CPUCores: 8, AvailableCPUCores: 6, MemoryMiB: 16384, AvailableMemoryMiB: 12288, AvailableDiskGiB: 400, Labels: map[string]string{"nim.build": "true", "nim.cache": "true", "nim.mongo": "true", "nim.mongo.slot": "1", "nim.postgres": "true", "nim.postgres.slot": "primary", "nim.redis": "true", "nim.jitsi": "true", "nim.observability": "true"}},
			{Name: "node-02", CPUCores: 8, AvailableCPUCores: 6, MemoryMiB: 16384, AvailableMemoryMiB: 12288, AvailableDiskGiB: 400, Labels: map[string]string{"nim.mongo": "true", "nim.mongo.slot": "2", "nim.postgres": "true", "nim.postgres.slot": "replica", "nim.redis": "true"}},
			{Name: "node-03", CPUCores: 8, AvailableCPUCores: 6, MemoryMiB: 16384, AvailableMemoryMiB: 12288, AvailableDiskGiB: 400, Labels: map[string]string{"nim.mongo": "true", "nim.mongo.slot": "3", "nim.redis": "true"}},
		},
		Workloads: []Workload{
			{Name: "mongo", Profile: "mongo-replicaset", Replicas: 3},
			{Name: "postgres", Profile: "postgres-primary-replica", Replicas: 2},
			{Name: "redis", Profile: "redis-sentinel", Replicas: 3},
			{Name: "jitsi", Profile: "jitsi", Replicas: 1, Domain: "meet.example.com", Resolver: "le", AdvertiseIP: "198.51.100.10", ObjectStorageProvider: "primary"},
			{Name: "observability", Profile: "observability", Replicas: 1, Domain: "grafana.example.com", Resolver: "arvan"},
		},
	}
}

func TestCheckAcceptsCapacityGatedPlatform(t *testing.T) {
	t.Parallel()
	report := Check(validManifest())
	if !report.Valid() {
		t.Fatalf("expected a valid report, got %#v", report.Findings)
	}
	if report.Totals.Requested.MemoryMiB == 0 || report.Totals.Available.MemoryMiB == 0 {
		t.Fatalf("expected resource totals, got %#v", report.Totals)
	}
}

func TestCheckRejectsDuplicateDomainAcrossOneNamespace(t *testing.T) {
	t.Parallel()
	manifest := validManifest()
	manifest.Workloads[4].Domain = "meet.example.com"
	manifest.Workloads[4].Resolver = "le"
	report := Check(manifest)
	if report.Valid() || !hasCode(report, "domain-duplicate") {
		t.Fatalf("expected duplicate-domain rejection, got %#v", report.Findings)
	}
}

func TestCheckRejectsReplicaPlacementOnOneNode(t *testing.T) {
	t.Parallel()
	manifest := validManifest()
	for index := range manifest.Nodes {
		delete(manifest.Nodes[index].Labels, "nim.mongo")
	}
	manifest.Nodes[0].Labels["nim.mongo"] = "true"
	report := Check(manifest)
	if report.Valid() || !hasCode(report, "placement-anti-affinity") {
		t.Fatalf("expected anti-affinity rejection, got %#v", report.Findings)
	}
}

func TestCheckRejectsMissingDedicatedStatefulSlot(t *testing.T) {
	t.Parallel()
	manifest := validManifest()
	manifest.Nodes[2].Labels["nim.mongo.slot"] = "2"
	report := Check(manifest)
	if report.Valid() || !hasCode(report, "placement-slot") {
		t.Fatalf("expected stateful slot rejection, got %#v", report.Findings)
	}
}

func TestCheckRejectsJitsiOutsideIngress(t *testing.T) {
	t.Parallel()
	manifest := validManifest()
	manifest.Workloads[3].AdvertiseIP = "198.51.100.99"
	report := Check(manifest)
	if report.Valid() || !hasCode(report, "jitsi-ingress-ip") {
		t.Fatalf("expected Jitsi ingress rejection, got %#v", report.Findings)
	}
}

func TestCheckObservedRejectsStaleCapacityAndLabels(t *testing.T) {
	t.Parallel()
	manifest := validManifest()
	observed := []ObservedNode{
		{Name: "node-01", State: "ready", AgentHealthy: true, CPUCores: 8, MemoryMiB: 16384, AvailableMemoryMiB: 12288, AvailableDiskGiB: 400, Labels: manifest.Nodes[0].Labels},
		{Name: "node-02", State: "ready", AgentHealthy: true, CPUCores: 8, MemoryMiB: 16384, AvailableMemoryMiB: 1024, AvailableDiskGiB: 400, Labels: manifest.Nodes[1].Labels},
		{Name: "node-03", State: "ready", AgentHealthy: true, CPUCores: 8, MemoryMiB: 16384, AvailableMemoryMiB: 12288, AvailableDiskGiB: 400, Labels: map[string]string{"nim.mongo": "true"}},
	}
	report := CheckObserved(manifest, observed)
	if report.Valid() || !hasCode(report, "live-memory-available") || !hasCode(report, "live-label") {
		t.Fatalf("expected stale live inventory rejection, got %#v", report.Findings)
	}
}

func TestCheckObservedRejectsMissingAgent(t *testing.T) {
	t.Parallel()
	manifest := validManifest()
	observed := []ObservedNode{
		{Name: "node-01", State: "ready", AgentHealthy: true, CPUCores: 8, MemoryMiB: 16384, AvailableMemoryMiB: 12288, AvailableDiskGiB: 400, Labels: manifest.Nodes[0].Labels},
		{Name: "node-02", State: "ready", AgentHealthy: false, CPUCores: 8, MemoryMiB: 16384, AvailableMemoryMiB: 12288, AvailableDiskGiB: 400, Labels: manifest.Nodes[1].Labels},
		{Name: "node-03", State: "ready", AgentHealthy: true, CPUCores: 8, MemoryMiB: 16384, AvailableMemoryMiB: 12288, AvailableDiskGiB: 400, Labels: manifest.Nodes[2].Labels},
	}
	report := CheckObserved(manifest, observed)
	if report.Valid() || !hasCode(report, "live-agent") {
		t.Fatalf("expected missing agent rejection, got %#v", report.Findings)
	}
}

func TestLoadRejectsUnknownFields(t *testing.T) {
	t.Parallel()
	if _, err := Load([]byte("apiVersion: swarmops.nim.zone/v1alpha1\nkind: Platform\nnamespace: production\nunknown: true\n")); err == nil {
		t.Fatal("unknown manifest field was accepted")
	}
}

func hasCode(report Report, wanted string) bool {
	for _, finding := range report.Findings {
		if finding.Code == wanted {
			return true
		}
	}
	return false
}
