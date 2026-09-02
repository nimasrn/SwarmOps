package ops

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestCloudflareScopedTokenUsesBearerAuthorization(t *testing.T) {
	t.Parallel()
	var seen *http.Request
	service, cleanup := cloudflareTestService(t, func(response http.ResponseWriter, request *http.Request) {
		seen = request.Clone(request.Context())
		_, _ = response.Write([]byte(`{"success":true,"result":{"status":"active"}}`))
	})
	t.Cleanup(cleanup)

	metadata := DNSCredentialMetadata{ID: "cf", Name: "Cloudflare", Provider: DNSProviderCloudflare, Version: 1}
	if err := service.ValidateCredential(context.Background(), metadata, "token-value-0123456789abcdef"); err != nil {
		t.Fatal(err)
	}
	if seen.URL.Path != "/user/tokens/verify" {
		t.Fatalf("token validation used %s", seen.URL.Path)
	}
	if got := seen.Header.Get("Authorization"); got != "Bearer token-value-0123456789abcdef" {
		t.Fatalf("Authorization = %q", got)
	}
	if seen.Header.Get("X-Auth-Email") != "" || seen.Header.Get("X-Auth-Key") != "" {
		t.Fatalf("scoped token sent global-key headers: %#v", seen.Header)
	}
}

func TestCloudflareGlobalKeyUsesAccountEmailHeaders(t *testing.T) {
	t.Parallel()
	var seen *http.Request
	service, cleanup := cloudflareTestService(t, func(response http.ResponseWriter, request *http.Request) {
		seen = request.Clone(request.Context())
		_, _ = response.Write([]byte(`{"success":true,"result":{"email":"ops@example.com"}}`))
	})
	t.Cleanup(cleanup)

	metadata := DNSCredentialMetadata{Email: "ops@example.com", ID: "cf", Name: "Cloudflare", Provider: DNSProviderCloudflare, Version: 1}
	if err := service.ValidateCredential(context.Background(), metadata, "global-key-0123456789abcdef"); err != nil {
		t.Fatal(err)
	}
	if seen.URL.Path != "/user" {
		t.Fatalf("global key validation used %s", seen.URL.Path)
	}
	if seen.Header.Get("X-Auth-Email") != "ops@example.com" || seen.Header.Get("X-Auth-Key") != "global-key-0123456789abcdef" {
		t.Fatalf("global-key headers = %#v", seen.Header)
	}
	if seen.Header.Get("Authorization") != "" {
		t.Fatalf("global key also sent a bearer token: %#v", seen.Header)
	}
}

func TestCloudflareGlobalKeyRejectsAMismatchedAccount(t *testing.T) {
	t.Parallel()
	service, cleanup := cloudflareTestService(t, func(response http.ResponseWriter, request *http.Request) {
		_, _ = response.Write([]byte(`{"success":true,"result":{"email":"someone-else@example.com"}}`))
	})
	t.Cleanup(cleanup)

	metadata := DNSCredentialMetadata{Email: "ops@example.com", ID: "cf", Provider: DNSProviderCloudflare, Version: 1}
	err := service.ValidateCredential(context.Background(), metadata, "global-key-0123456789abcdef")
	if err == nil || !strings.Contains(err.Error(), "account email") {
		t.Fatalf("mismatched account was accepted: %v", err)
	}
}

func TestCloudflareAccountIDScopesTheZoneLookup(t *testing.T) {
	t.Parallel()
	var seen *http.Request
	service, cleanup := cloudflareTestService(t, func(response http.ResponseWriter, request *http.Request) {
		seen = request.Clone(request.Context())
		_, _ = response.Write([]byte(`{"success":true,"result":[{"id":"zone-1","name":"example.com"}]}`))
	})
	t.Cleanup(cleanup)

	metadata := DNSCredentialMetadata{AccountID: "0123456789abcdef0123456789abcdef", ID: "cf", Provider: DNSProviderCloudflare, Version: 1}
	zoneID, err := service.cloudflareZoneID(context.Background(), metadata, "token-value-0123456789abcdef", "example.com")
	if err != nil {
		t.Fatal(err)
	}
	if zoneID != "zone-1" {
		t.Fatalf("zone id = %q", zoneID)
	}
	if got := seen.URL.Query().Get("account.id"); got != "0123456789abcdef0123456789abcdef" {
		t.Fatalf("account.id = %q", got)
	}
}

func TestDNSCredentialIdentityRejectsUnusableValues(t *testing.T) {
	t.Parallel()
	if err := (DNSCredentialIdentity{AccountID: "not-hex"}).Validate(DNSProviderCloudflare); err == nil {
		t.Fatal("a malformed account identifier was accepted")
	}
	if err := (DNSCredentialIdentity{Email: "ops"}).Validate(DNSProviderCloudflare); err == nil {
		t.Fatal("a malformed account email was accepted")
	}
	if err := (DNSCredentialIdentity{Email: "ops@example.com"}).Validate(DNSProviderArvan); err == nil {
		t.Fatal("Arvan accepted a Cloudflare account email")
	}
	if err := (DNSCredentialIdentity{AccountID: " 0123456789ABCDEF0123456789abcdef ", Email: " Ops@Example.com "}).Normalize().Validate(DNSProviderCloudflare); err != nil {
		t.Fatal(err)
	}
}

func TestTraefikRendersGlobalKeyEnvironmentForCloudflareEmail(t *testing.T) {
	t.Parallel()
	settings := traefikDNSTestSettings(t, DNSCredentialMetadata{Email: "ops@example.com", ID: "cf", Name: "Cloudflare", Provider: DNSProviderCloudflare, SecretName: "traefik_dns_cloudflare_cf_v1", State: "validated", Version: 1})
	if settings.CloudflareAPIEmail != "ops@example.com" {
		t.Fatalf("CloudflareAPIEmail = %q", settings.CloudflareAPIEmail)
	}
	rendered, err := RenderTraefikStack(traefikStackSource(), settings)
	if err != nil {
		t.Fatal(err)
	}
	text := string(rendered)
	if !strings.Contains(text, "CF_API_EMAIL: ops@example.com") || !strings.Contains(text, "CF_API_KEY_FILE: /run/secrets/traefik_cf_dns_token") {
		t.Fatalf("global-key environment is missing:\n%s", text)
	}
	if strings.Contains(text, "CF_DNS_API_TOKEN_FILE") {
		t.Fatalf("global-key stack still asks for a scoped token:\n%s", text)
	}
	if !strings.Contains(text, "traefik_dns_cloudflare_cf_v1") {
		t.Fatalf("stack did not reference the sealed secret:\n%s", text)
	}
}

func TestTraefikKeepsScopedTokenEnvironmentWithoutAnEmail(t *testing.T) {
	t.Parallel()
	settings := traefikDNSTestSettings(t, DNSCredentialMetadata{ID: "cf", Name: "Cloudflare", Provider: DNSProviderCloudflare, SecretName: "traefik_dns_cloudflare_cf_v1", State: "validated", Version: 1})
	rendered, err := RenderTraefikStack(traefikStackSource(), settings)
	if err != nil {
		t.Fatal(err)
	}
	text := string(rendered)
	if !strings.Contains(text, "CF_DNS_API_TOKEN_FILE: /run/secrets/traefik_cf_dns_token") {
		t.Fatalf("scoped-token environment is missing:\n%s", text)
	}
	if strings.Contains(text, "CF_API_EMAIL") || strings.Contains(text, "CF_API_KEY_FILE") {
		t.Fatalf("scoped token rendered global-key environment:\n%s", text)
	}
}

func cloudflareTestService(t *testing.T, handler http.HandlerFunc) (*HTTPDNSProviderService, func()) {
	t.Helper()
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		response.Header().Set("Content-Type", "application/json")
		handler(response, request)
	}))
	service := NewHTTPDNSProviderService(server.Client())
	service.cloudflareBase = server.URL
	return service, server.Close
}

// traefikDNSTestSettings builds a typed stack whose only DNS credential is the
// supplied one, so the rendered environment reflects that credential alone.
func traefikDNSTestSettings(t *testing.T, credential DNSCredentialMetadata) TraefikStackSettings {
	t.Helper()
	settings := testTraefikSettings()
	settings.Control = DefaultTraefikSettings(settings.ACMEEmail)
	settings.Control.DashboardHost = "traefik.example.com"
	settings.Credentials = []DNSCredentialMetadata{credential}
	if err := applyTraefikChallengeFallback(&settings, nil, map[string]bool{credential.SecretName: true}); err != nil {
		t.Fatal(err)
	}
	static, err := RenderTraefikStaticConfig(settings.Control)
	if err != nil {
		t.Fatal(err)
	}
	settings.StaticConfigName = TraefikStaticConfigName(static)
	return settings
}

func traefikStackSource() []byte {
	return []byte(`version: "3.9"
services:
  traefik:
    image: ${TRAEFIK_IMAGE:-traefik:v3.6.13}
    environment:
      CF_DNS_API_TOKEN_FILE: /run/secrets/traefik_cf_dns_token
      ARVANCLOUD_API_KEY_FILE: /run/secrets/traefik_arvan_api_key
    secrets: [traefik_cf_dns_token, traefik_arvan_api_key, traefik_dashboard_auth]
configs:
  traefik_dynamic:
    file: dynamic.yml
    name: ${TRAEFIK_DYNAMIC_CONFIG_NAME:-nim_traefik_dynamic_v1}
secrets:
  traefik_cf_dns_token:
    external: true
  traefik_arvan_api_key:
    external: true
  traefik_dashboard_auth:
    external: true
`)
}
