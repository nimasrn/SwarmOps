package ops

import (
	"strings"
	"testing"
	"time"
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
