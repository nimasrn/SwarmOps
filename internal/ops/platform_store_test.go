package ops

import (
	"strings"
	"testing"
	"time"

	"github.com/nimasrn/SwarmOps/internal/preflight"
)

// The sealed stores take the controller's data-encryption key.
var testPlatformKey = []byte("0123456789abcdef0123456789abcdef")

func unmanagedCompose(stack, service, domain, resolver string) string {
	compose := `version: "3.9"
services:
  ` + service + `:
    image: registry.example.com/team/api:2026.08.23
    networks: [traefik-route]
    deploy:
      labels:
        traefik.enable: "true"
        traefik.swarm.network: $ROUTE_NETWORK
        traefik.http.routers.$STACK-$SERVICE.rule: Host(` + "`" + domain + "`" + `)
        traefik.http.routers.$STACK-$SERVICE.entrypoints: websecure
        traefik.http.routers.$STACK-$SERVICE.tls.certresolver: ` + resolver + `
      resources:
        limits: {cpus: "4", memory: 4096M}
        reservations: {cpus: "2", memory: 2048M}
networks:
  traefik-route: {external: true, name: $ROUTE_NETWORK}
`
	compose = strings.ReplaceAll(compose, "$ROUTE_NETWORK", RouteNetworkName(stack+"_"+service))
	compose = strings.ReplaceAll(compose, "$STACK", stack)
	return strings.ReplaceAll(compose, "$SERVICE", service)
}

// An install with no manifest has no reviewed domain, resolver, registry, or
// capacity budget, so admission cannot hold a deployment to any of them. What
// it must still hold is the stack namespace and the Traefik label subset.
func TestUnmanagedAdmissionAcceptsFreeFormApplicationsWithinItsNamespace(t *testing.T) {
	t.Parallel()
	admission, err := NewUnmanagedAdmission("apps")
	if err != nil {
		t.Fatal(err)
	}
	if !admission.Unmanaged() || admission.Namespace() != "apps" {
		t.Fatalf("unmanaged admission = %+v", admission)
	}
	if err := admission.ValidateApplicationImage("registry.example.com/team/api:2026.08.23"); err != nil {
		t.Fatalf("unreviewed registry refused: %v", err)
	}
	if approved := admission.ApprovedApplications(); len(approved) != 0 {
		t.Fatalf("approved applications = %#v, want none", approved)
	}
	if err := admission.ValidateStack("apps-invoices", []byte(unmanagedCompose("apps-invoices", "api", "invoices.example.com", "le"))); err != nil {
		t.Fatalf("free-form application refused: %v", err)
	}
	if err := admission.ValidateStack("other-invoices", []byte(unmanagedCompose("other-invoices", "api", "invoices.example.com", "le"))); err == nil || !strings.Contains(err.Error(), "namespace prefix") {
		t.Fatalf("cross-namespace stack error = %v", err)
	}
}

// Dropping the slot list must not drop the routing shape. A public router that
// names no certificate resolver would publish the domain without TLS.
func TestUnmanagedAdmissionStillRequiresApprovedRoutingLabels(t *testing.T) {
	t.Parallel()
	admission, err := NewUnmanagedAdmission("apps")
	if err != nil {
		t.Fatal(err)
	}
	compose := unmanagedCompose("apps-invoices", "api", "invoices.example.com", "le")
	noResolver := strings.Replace(compose, "        traefik.http.routers.apps-invoices-api.tls.certresolver: le\n", "", 1)
	if err := admission.ValidateStack("apps-invoices", []byte(noResolver)); err == nil || !strings.Contains(err.Error(), "certificate resolver") {
		t.Fatalf("missing resolver error = %v", err)
	}
	foreignRouter := strings.ReplaceAll(compose, "traefik.http.routers.apps-invoices-api", "traefik.http.routers.apps-billing-api")
	if err := admission.ValidateStack("apps-invoices", []byte(foreignRouter)); err == nil || !strings.Contains(err.Error(), "must start with") {
		t.Fatalf("foreign router error = %v", err)
	}
}

func TestPlatformStoreRefusesUnmanagedModeWithoutItsConfirmation(t *testing.T) {
	t.Parallel()
	store, err := NewPlatformStore(t.TempDir(), testPlatformKey, nil)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := store.Save("admin", PlatformInput{Mode: PlatformModeUnmanaged, Namespace: "apps"}, time.Now()); err == nil || !strings.Contains(err.Error(), UnmanagedConfirmation) {
		t.Fatalf("unconfirmed unmanaged mode error = %v", err)
	}
	if store.Admission() != nil {
		t.Fatal("refused save changed the admission in force")
	}
	saved, err := store.Save("admin", PlatformInput{Confirmation: UnmanagedConfirmation, Mode: PlatformModeUnmanaged, Namespace: "apps"}, time.Now())
	if err != nil {
		t.Fatal(err)
	}
	if saved.Mode != PlatformModeUnmanaged || !store.Admission().Unmanaged() {
		t.Fatalf("saved state = %+v", saved)
	}
}

// A panel-authored manifest goes through the same preflight as a reviewed
// file, and is reloaded from sealed state on the next start.
func TestPlatformStoreSealsAndReloadsAnAuthoredManifest(t *testing.T) {
	t.Parallel()
	dataDir := t.TempDir()
	store, err := NewPlatformStore(dataDir, testPlatformKey, nil)
	if err != nil {
		t.Fatal(err)
	}
	manifest := applicationManifest()
	if _, err := store.Save("admin", PlatformInput{Manifest: manifest, Mode: PlatformModeManifest}, time.Now()); err != nil {
		t.Fatal(err)
	}
	incomplete := applicationManifest()
	incomplete.Nodes = nil
	if _, err := store.Save("admin", PlatformInput{Manifest: incomplete, Mode: PlatformModeManifest}, time.Now()); err == nil || !strings.Contains(err.Error(), "not admissible") {
		t.Fatalf("unmeasured manifest error = %v", err)
	}
	reopened, err := NewPlatformStore(dataDir, testPlatformKey, nil)
	if err != nil {
		t.Fatal(err)
	}
	if state := reopened.State(); state.Mode != PlatformModeManifest || state.Namespace != "production" {
		t.Fatalf("reloaded state = %+v", state)
	}
	approved := reopened.Admission().ApprovedApplications()
	if len(approved) != 1 || approved[0].Name != "api" {
		t.Fatalf("reloaded slots = %#v", approved)
	}
}

// A mounted manifest is the reviewed artifact. The console may read it and
// must not be able to replace it from a browser.
func TestPlatformStoreKeepsAMountedManifestAuthoritative(t *testing.T) {
	t.Parallel()
	file, err := NewPlatformAdmission(applicationManifest())
	if err != nil {
		t.Fatal(err)
	}
	store, err := NewPlatformStore(t.TempDir(), testPlatformKey, file)
	if err != nil {
		t.Fatal(err)
	}
	if !store.FileManaged() || store.Admission() != file {
		t.Fatal("mounted manifest is not the admission in force")
	}
	if _, err := store.Save("admin", PlatformInput{Confirmation: UnmanagedConfirmation, Mode: PlatformModeUnmanaged, Namespace: "apps"}, time.Now()); err == nil || !strings.Contains(err.Error(), "SWARMOPS_PLATFORM_MANIFEST_FILE") {
		t.Fatalf("console override error = %v", err)
	}
	if store.Admission().Unmanaged() {
		t.Fatal("refused override still weakened admission")
	}
}

// Deploying a repository nobody has deployed before is the ordinary case. The
// slot it names is declared from the deployment itself — with the ceiling the
// operator chose and the one resolver the definition leaves no choice about —
// and it survives a restart, because it was written into the sealed manifest
// rather than held for the life of one request.
func TestPlatformStoreDeclaresTheSlotANewDeploymentNames(t *testing.T) {
	t.Parallel()
	dataDir := t.TempDir()
	store, err := NewPlatformStore(dataDir, testPlatformKey, nil)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := store.Save("admin", PlatformInput{Manifest: routedApplicationManifest(), Mode: PlatformModeManifest}, time.Now()); err != nil {
		t.Fatal(err)
	}
	slot := ApprovedWorkload{CPUCores: 0.5, Domain: "invoices.example.com", MemoryMiB: 512, Name: "invoices", Replicas: 2}
	created, err := store.EnsureApplicationSlot("admin", slot, time.Now())
	if err != nil || !created {
		t.Fatalf("declare new slot = %v, %v", created, err)
	}
	again, err := store.EnsureApplicationSlot("admin", slot, time.Now())
	if err != nil || again {
		t.Fatalf("re-declaring an existing slot = %v, %v", again, err)
	}
	reopened, err := NewPlatformStore(dataDir, testPlatformKey, nil)
	if err != nil {
		t.Fatal(err)
	}
	approved := reopened.Admission().ApprovedApplications()
	if len(approved) != 3 {
		t.Fatalf("reloaded slots = %#v", approved)
	}
	declared := approved[0]
	if declared.Name != "invoices" || declared.Domain != "invoices.example.com" || declared.Resolver != "le" {
		t.Fatalf("declared slot = %+v", declared)
	}
	if declared.CPUCores != 0.5 || declared.MemoryMiB != 512 || declared.Replicas != 2 {
		t.Fatalf("declared ceiling = %+v", declared)
	}
	// The ceiling is a ceiling: the deployment that declared it is admitted,
	// and one that asks for more of the same slot is not.
	compose := unmanagedCompose("production-invoices", "app", "invoices.example.com", "le")
	if err := reopened.Admission().ValidateStack("production-invoices", []byte(compose)); err == nil || !strings.Contains(err.Error(), "budget") {
		t.Fatalf("oversized deployment into the declared slot = %v", err)
	}
}

// A slot is declared, not waved through. The manifest still owns its domains,
// so a deployment that would take a hostname another workload holds is refused
// and the definition in force is left exactly as it was.
func TestPlatformStoreRefusesASlotThatCollidesWithAReviewedWorkload(t *testing.T) {
	t.Parallel()
	store, err := NewPlatformStore(t.TempDir(), testPlatformKey, nil)
	if err != nil {
		t.Fatal(err)
	}
	manifest := routedApplicationManifest()
	if _, err := store.Save("admin", PlatformInput{Manifest: manifest, Mode: PlatformModeManifest}, time.Now()); err != nil {
		t.Fatal(err)
	}
	created, err := store.EnsureApplicationSlot("admin", ApprovedWorkload{Domain: "api.vlora.ir", Name: "billing", Replicas: 1}, time.Now())
	if created || err == nil || !strings.Contains(err.Error(), "already belongs") {
		t.Fatalf("colliding slot = %v, %v", created, err)
	}
	if approved := store.Admission().ApprovedApplications(); len(approved) != 2 {
		t.Fatalf("refused declaration changed the slots in force: %#v", approved)
	}
	// A name a non-application workload already holds is refused by name
	// rather than by domain: that workload deploys from its reviewed Git
	// manifest, and a browser deployment must never take its place. The state
	// is seeded directly because a database workload only passes preflight on
	// a cluster labelled for it, which this check has nothing to do with.
	manifest.Workloads = append(manifest.Workloads, preflight.Workload{Name: "records", Profile: "mongo-replicaset", Replicas: 3})
	store.state.Manifest = manifest
	created, err = store.EnsureApplicationSlot("admin", ApprovedWorkload{Name: "records", Replicas: 1}, time.Now())
	if created || err == nil || !strings.Contains(err.Error(), "mongo-replicaset") {
		t.Fatalf("slot over a database workload = %v, %v", created, err)
	}
}

// A mounted manifest is the reviewed artifact. A deployment naming a slot it
// does not declare is refused by admission, exactly as before — nothing writes
// a slot into a file the console does not own.
func TestPlatformStoreDeclaresNoSlotAgainstAMountedManifest(t *testing.T) {
	t.Parallel()
	file, err := NewPlatformAdmission(applicationManifest())
	if err != nil {
		t.Fatal(err)
	}
	store, err := NewPlatformStore(t.TempDir(), testPlatformKey, file)
	if err != nil {
		t.Fatal(err)
	}
	created, err := store.EnsureApplicationSlot("admin", ApprovedWorkload{Name: "invoices", Replicas: 1}, time.Now())
	if created || err != nil {
		t.Fatalf("declaration against a mounted manifest = %v, %v", created, err)
	}
	if approved := store.Admission().ApprovedApplications(); len(approved) != 1 || approved[0].Name != "api" {
		t.Fatalf("mounted slots = %#v", approved)
	}
}

// An install that declared itself manifest-free has no slot list to add to,
// and one that has chosen no platform at all still refuses deployment.
func TestPlatformStoreDeclaresNoSlotWithoutAManifestMode(t *testing.T) {
	t.Parallel()
	store, err := NewPlatformStore(t.TempDir(), testPlatformKey, nil)
	if err != nil {
		t.Fatal(err)
	}
	created, err := store.EnsureApplicationSlot("admin", ApprovedWorkload{Name: "invoices", Replicas: 1}, time.Now())
	if created || err != nil {
		t.Fatalf("declaration with no platform definition = %v, %v", created, err)
	}
	if _, err := store.Save("admin", PlatformInput{Confirmation: UnmanagedConfirmation, Mode: PlatformModeUnmanaged, Namespace: "apps"}, time.Now()); err != nil {
		t.Fatal(err)
	}
	created, err = store.EnsureApplicationSlot("admin", ApprovedWorkload{Name: "invoices", Replicas: 1}, time.Now())
	if created || err != nil {
		t.Fatalf("declaration on a manifest-free install = %v, %v", created, err)
	}
}
