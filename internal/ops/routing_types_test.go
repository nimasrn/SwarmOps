package ops

import (
	"strings"
	"testing"
	"time"
)

func TestRouteSpecNormalizeAndValidate(t *testing.T) {
	t.Parallel()

	t.Run("normalize", func(t *testing.T) {
		t.Parallel()
		route := RouteSpec{
			Key:          "API-ROUTE",
			Protocol:     RouteHTTP,
			ServiceKey:   " FrontEnd ",
			Resolver:     " LE ",
			DNSReference: " EXAMPLE.COM ",
			Match:        RouteMatch{Hosts: []string{" Example.COM ", "example.com", "example.com."}, PathPrefix: " /api "},
			Health:       RouteHealthProof{Kind: "", TimeoutSeconds: 0, Path: "/health"},
		}.Normalize()

		if route.Key != "api-route" {
			t.Fatalf("key = %q, want api-route", route.Key)
		}
		if route.ServiceKey != "FrontEnd" {
			t.Fatalf("service key = %q, want FrontEnd", route.ServiceKey)
		}
		if route.Resolver != "le" {
			t.Fatalf("resolver = %q, want le", route.Resolver)
		}
		if route.DNSReference != "example.com" {
			t.Fatalf("dns reference = %q, want example.com", route.DNSReference)
		}
		if route.Health.Kind != "response" || route.Health.TimeoutSeconds != 5 || route.Health.Path != "/health" {
			t.Fatalf("health = %#v", route.Health)
		}
		if route.Match.PathPrefix != "/api" {
			t.Fatalf("path prefix = %q, want /api", route.Match.PathPrefix)
		}
		if len(route.Match.Hosts) != 1 || route.Match.Hosts[0] != "example.com" {
			t.Fatalf("hosts = %#v", route.Match.Hosts)
		}
	})

	valid := RouteSpec{
		Key:          "web-http",
		ServiceKey:   "web",
		Protocol:     RouteHTTP,
		Scope:        RoutePublic,
		TLS:          RouteTLSOff,
		Enabled:      true,
		PublicAllow:  true,
		DNSReference: "example.com",
		TargetPort:   8080,
		Match:        RouteMatch{Hosts: []string{"example.com"}},
		Health:       RouteHealthProof{Kind: "response", Path: "/"},
	}

	if err := valid.Validate(); err != nil {
		t.Fatalf("valid http route = %v", err)
	}

	t.Run("validation cases", func(t *testing.T) {
		t.Parallel()
		cases := []struct {
			name  string
			route RouteSpec
			err   string
		}{
			{name: "invalid version", route: RouteSpec{Version: 2}, err: "unsupported route schema version"},
			{name: "invalid key", route: RouteSpec{Protocol: RouteHTTP, ServiceKey: "web", Enabled: true, TargetPort: 80, Match: RouteMatch{Hosts: []string{"example.com"}}, Health: RouteHealthProof{Kind: "response", Path: "/"}, Version: RoutingSchemaVersion}, err: "route key must"},
			{name: "http route cannot use SNI", route: RouteSpec{Key: "http-sni", Protocol: RouteHTTP, Scope: RouteInternal, TLS: RouteTLSOff, ServiceKey: "web", Enabled: true, TargetPort: 80, Match: RouteMatch{Hosts: []string{"example.com"}, SNI: []string{"example.com"}}, Health: RouteHealthProof{Kind: "response", Path: "/"}, Version: RoutingSchemaVersion}, err: "HTTP routes cannot declare an SNI"},
			{name: "tcp route requires sni for tls", route: RouteSpec{Key: "tcp-tls", Protocol: RouteTCP, Scope: RouteInternal, TLS: RouteTLSTerminate, ServiceKey: "web", Enabled: true, TargetPort: 80, Health: RouteHealthProof{Kind: "handshake"}, Version: RoutingSchemaVersion}, err: "TLS TCP routes require at least one SNI host"},
			{name: "udp route must be ssl off", route: RouteSpec{Key: "udp-tls", Protocol: RouteUDP, Scope: RouteInternal, TLS: RouteTLSTerminate, ServiceKey: "web", Enabled: true, TargetPort: 80, Health: RouteHealthProof{Kind: "structural"}, Version: RoutingSchemaVersion}, err: "UDP routes support TLS off"},
			{name: "udp route cannot require sni", route: RouteSpec{Key: "udp-sni", Protocol: RouteUDP, Scope: RouteInternal, ServiceKey: "web", TLS: RouteTLSOff, Enabled: true, TargetPort: 80, Match: RouteMatch{SNI: []string{"example.com"}}, Health: RouteHealthProof{Kind: "structural"}, Version: RoutingSchemaVersion}, err: "UDP routes support TLS off"},
			{name: "public route requires reviewed allow", route: RouteSpec{Key: "public-missing-allow", Protocol: RouteHTTP, Scope: RoutePublic, TLS: RouteTLSOff, ServiceKey: "web", Enabled: true, PublicAllow: false, TargetPort: 8080, Match: RouteMatch{Hosts: []string{"example.com"}}, Health: RouteHealthProof{Kind: "response", Path: "/"}, Version: RoutingSchemaVersion}, err: "public routes require reviewed publicAllow"},
			{name: "public route requires dns when enabled", route: RouteSpec{Key: "public-missing-dns", Protocol: RouteHTTP, Scope: RoutePublic, TLS: RouteTLSOff, ServiceKey: "web", Enabled: true, PublicAllow: true, TargetPort: 8080, Match: RouteMatch{Hosts: []string{"example.com"}}, Health: RouteHealthProof{Kind: "response", Path: "/"}, Version: RoutingSchemaVersion}, err: "enabled public hostname routes require a DNS reference"},
			{name: "http health path timeout too high", route: RouteSpec{Key: "http-timeout", Protocol: RouteHTTP, Scope: RouteInternal, TLS: RouteTLSOff, ServiceKey: "web", Enabled: true, TargetPort: 8080, Match: RouteMatch{Hosts: []string{"example.com"}}, Health: RouteHealthProof{Kind: "response", Path: "/", TimeoutSeconds: 61}, Version: RoutingSchemaVersion}, err: "route health timeout"},
		}
		for _, tc := range cases {
			tc := tc
			t.Run(tc.name, func(t *testing.T) {
				t.Parallel()
				err := tc.route.Validate()
				if err == nil || err.Error() != tc.err && !contains(err.Error(), tc.err) {
					t.Fatalf("validate() = %v, want substring %q", err, tc.err)
				}
			})
		}
	})
}

func TestDependencyBindingNormalizeAndValidate(t *testing.T) {
	t.Parallel()

	t.Run("normalize", func(t *testing.T) {
		t.Parallel()
		binding := DependencyBinding{
			CallerService: " api ",
			TargetRoute:   " My-Service ",
			Name:          " my_name ",
			Version:       0,
			Delivery:      DependencyEnvironment,
		}.Normalize()

		if binding.CallerService != "api" {
			t.Fatalf("caller service = %q, want api", binding.CallerService)
		}
		if binding.TargetRoute != "my-service" {
			t.Fatalf("target route = %q, want my-service", binding.TargetRoute)
		}
		if binding.Name != "MY_NAME" {
			t.Fatalf("name = %q, want MY_NAME", binding.Name)
		}
		if binding.Version != RoutingSchemaVersion {
			t.Fatalf("version = %d, want %d", binding.Version, RoutingSchemaVersion)
		}
	})

	cases := []struct {
		name    string
		input   DependencyBinding
		wantErr string
	}{
		{name: "existing binding requires no name", input: DependencyBinding{CallerService: "api", Delivery: DependencyExisting, TargetRoute: "web", Version: RoutingSchemaVersion}, wantErr: ""},
		{name: "environment delivery requires uppercase env name", input: DependencyBinding{CallerService: "api", Delivery: DependencyEnvironment, Name: "1low", TargetRoute: "web", Version: RoutingSchemaVersion}, wantErr: "uppercase"},
		{name: "invalid caller service", input: DependencyBinding{CallerService: "bad service", Delivery: DependencyExisting, TargetRoute: "web", Version: RoutingSchemaVersion}, wantErr: "dependency binding identity is invalid"},
		{name: "unsupported delivery method", input: DependencyBinding{CallerService: "api", Delivery: "bad", TargetRoute: "web", Version: RoutingSchemaVersion}, wantErr: "dependency delivery is unsupported"},
	}

	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			if tc.wantErr == "" {
				if err := tc.input.Validate(); err != nil {
					t.Fatalf("unexpected validate error: %v", err)
				}
				return
			}
			if err := tc.input.Validate(); err == nil || !contains(err.Error(), tc.wantErr) {
				t.Fatalf("validate() = %v, want substring %q", err, tc.wantErr)
			}
		})
	}
}

func TestTraefikSettingsValidate(t *testing.T) {
	t.Parallel()

	settings := DefaultTraefikSettings("Ops-Admin@example.com")
	settings.DashboardHost = "traefik.example.com"
	if err := settings.Validate(); err != nil {
		t.Fatalf("default settings should validate: %v", err)
	}

	t.Run("normalize defaults", func(t *testing.T) {
		t.Parallel()
		cfg := TraefikSettings{ACMEEmail: " Ops@Admin@Example.com ", DashboardHost: " Traefik.Example.com. ", Version: 0}
		cfg = cfg.Normalize()
		if cfg.ACMEEmail != "Ops@Admin@Example.com" {
			t.Fatalf("acme email = %q, want trimmed value", cfg.ACMEEmail)
		}
		if cfg.DashboardHost != "traefik.example.com" {
			t.Fatalf("dashboard host = %q, want normalized hostname", cfg.DashboardHost)
		}
		if cfg.Version != RoutingSchemaVersion {
			t.Fatalf("version = %d, want %d", cfg.Version, RoutingSchemaVersion)
		}
		if cfg.PortRange.Start != RoutePortMin || cfg.PortRange.End != RoutePortMax {
			t.Fatalf("port range = %#v", cfg.PortRange)
		}
	})

	cases := []struct {
		name string
		cfg  TraefikSettings
		err  string
	}{
		{name: "metrics disabled", cfg: func() TraefikSettings { copy := settings; copy.MetricsEnabled = false; return copy }(), err: "metrics are mandatory"},
		{name: "bad operational log level", cfg: func() TraefikSettings { copy := settings; copy.OperationalLog = "VERBOSE"; return copy }(), err: "operational log level"},
		{name: "missing required entrypoint", cfg: func() TraefikSettings { copy := settings; copy.EntryPoints = copy.EntryPoints[:0]; return copy }(), err: "require the web"},
		{name: "duplicate entrypoint port", cfg: func() TraefikSettings {
			copy := settings
			copy.EntryPoints = append(copy.EntryPoints, StaticEntryPoint{Name: "dup", Protocol: RouteHTTP, Port: 80})
			return copy
		}(), err: "entrypoint name or protocol port conflicts"},
		{name: "dns-01 without supported credential", cfg: func() TraefikSettings {
			copy := settings
			copy.Resolvers = []ACMEPolicy{{Name: "bad", Challenge: ChallengeDNS01}}
			return copy
		}(), err: "DNS-01 resolver requires"},
		{name: "invalid email", cfg: func() TraefikSettings { copy := settings; copy.ACMEEmail = "not-an-email"; return copy }(), err: "Traefik ACME email is invalid"},
		{name: "invalid dashboard hostname", cfg: func() TraefikSettings {
			copy := settings
			copy.DashboardHost = "https://traefik.example.com/dashboard/"
			return copy
		}(), err: "Traefik dashboard hostname is invalid"},
	}
	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			if err := tc.cfg.Validate(); err == nil || !contains(err.Error(), tc.err) {
				t.Fatalf("validate() = %v, want substring %q", err, tc.err)
			}
		})
	}
	withoutDashboard := settings
	withoutDashboard.DashboardHost = ""
	if err := withoutDashboard.Validate(); err != nil {
		t.Fatalf("legacy settings without dashboard host should remain loadable: %v", err)
	}
	if err := withoutDashboard.ValidateForApply(); err == nil || !contains(err.Error(), "dashboard hostname is not configured") {
		t.Fatalf("apply validation error = %v", err)
	}
}

func TestTraefikSettingsNormalizeDoesNotMutateInput(t *testing.T) {
	t.Parallel()

	input := TraefikSettings{
		Resolvers:   []ACMEPolicy{{Name: " LE ", DNSCredentialID: " DNS-CREDENTIAL "}},
		EntryPoints: []StaticEntryPoint{{Name: " Web ", Protocol: RouteHTTP, Port: 80}},
	}

	normalized := input.Normalize()
	if normalized.Resolvers[0].Name != "le" || normalized.Resolvers[0].DNSCredentialID != "dns-credential" {
		t.Fatalf("normalized resolver = %#v", normalized.Resolvers[0])
	}
	if normalized.EntryPoints[0].Name != "web" {
		t.Fatalf("normalized entrypoint = %#v", normalized.EntryPoints[0])
	}
	if input.Resolvers[0].Name != " LE " || input.Resolvers[0].DNSCredentialID != " DNS-CREDENTIAL " {
		t.Fatalf("Normalize mutated resolver input: %#v", input.Resolvers[0])
	}
	if input.EntryPoints[0].Name != " Web " {
		t.Fatalf("Normalize mutated entrypoint input: %#v", input.EntryPoints[0])
	}
}

func TestDNSRecordSpecNormalizeAndValidate(t *testing.T) {
	t.Parallel()

	t.Run("normalize", func(t *testing.T) {
		t.Parallel()
		record := DNSRecordSpec{
			ID:           " Example-ID ",
			CredentialID: " Provider-ID ",
			Name:         " Api.Example.com. ",
			Zone:         " Example.com. ",
			Content:      " 203.0.113.10 ",
			TTL:          0,
			Version:      0,
			Managed:      true,
			Adopted:      true,
			Type:         DNSRecordA,
		}.Normalize()
		if record.ID != "example-id" {
			t.Fatalf("id = %q, want example-id", record.ID)
		}
		if record.CredentialID != "provider-id" {
			t.Fatalf("credential id = %q, want provider-id", record.CredentialID)
		}
		if record.Name != "api.example.com" || record.Zone != "example.com" {
			t.Fatalf("name=%q zone=%q", record.Name, record.Zone)
		}
		if record.TTL != 300 {
			t.Fatalf("ttl = %d, want 300", record.TTL)
		}
	})

	valid := DNSRecordSpec{ID: "credential-id", CredentialID: "provider-id", Name: "api.example.com", Zone: "example.com", Content: "203.0.113.10", TTL: 300, Type: DNSRecordA, Managed: true, Adopted: true, Version: RoutingSchemaVersion}
	if err := valid.Validate(RouteHTTP); err != nil {
		t.Fatalf("valid record should validate: %v", err)
	}

	cases := []struct {
		name string
		rec  DNSRecordSpec
		err  string
	}{
		{name: "bad id", rec: DNSRecordSpec{Name: "api.example.com", Zone: "example.com", Content: "1.1.1.1", TTL: 300, Type: DNSRecordA, Managed: true, Adopted: true, Version: RoutingSchemaVersion}, err: "DNS record identity"},
		{name: "invalid name for zone", rec: DNSRecordSpec{ID: "credential-id", CredentialID: "provider-id", Name: "bad.zone", Zone: "example.org", Content: "203.0.113.10", TTL: 300, Type: DNSRecordA, Managed: true, Adopted: true, Version: RoutingSchemaVersion}, err: "must belong to its zone"},
		{name: "bad content for A", rec: DNSRecordSpec{ID: "credential-id", CredentialID: "provider-id", Name: "api.example.com", Zone: "example.com", Content: "2001:db8::1", TTL: 300, Type: DNSRecordA, Managed: true, Adopted: true, Version: RoutingSchemaVersion}, err: "A record content"},
		{name: "tcp raw dns record cannot be proxied", rec: DNSRecordSpec{ID: "credential-id", CredentialID: "provider-id", Name: "api.example.com", Zone: "example.com", Content: "203.0.113.10", TTL: 300, Type: DNSRecordA, Managed: true, Adopted: true, Proxied: true, Version: RoutingSchemaVersion}, err: "raw TCP and UDP DNS records must remain DNS-only"},
		{name: "managed/adopted requirement", rec: DNSRecordSpec{ID: "credential-id", CredentialID: "provider-id", Name: "api.example.com", Zone: "example.com", Content: "203.0.113.10", TTL: 300, Type: DNSRecordA, Version: RoutingSchemaVersion}, err: "managed or explicitly adopted"},
	}
	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			if err := tc.rec.Validate(RouteTCP); err == nil || !contains(err.Error(), tc.err) {
				t.Fatalf("validate() = %v, want substring %q", err, tc.err)
			}
		})
	}
}

func TestTraefikLogFilterNormalizeAndValidate(t *testing.T) {
	t.Parallel()
	now := time.Date(2026, time.August, 26, 9, 0, 0, 0, time.UTC)
	filter := TraefikLogFilter{}.Normalize(now)
	if filter.Limit != 200 {
		t.Fatalf("default limit = %d, want 200", filter.Limit)
	}
	if filter.From.IsZero() || filter.To.IsZero() || filter.To.Before(filter.From) {
		t.Fatalf("unexpected normalized window: from=%s to=%s", filter.From, filter.To)
	}

	cases := []struct {
		name string
		f    TraefikLogFilter
		err  string
	}{
		{name: "limit too high", f: TraefikLogFilter{Limit: 1001}, err: "between 1 and 1000"},
		{name: "invalid level", f: TraefikLogFilter{Limit: 50, Level: "TRACE"}, err: "log level filter is invalid"},
		{name: "too wide range", f: TraefikLogFilter{Limit: 50, From: now.Add(-8 * 24 * time.Hour), To: now}, err: "at most seven days"},
		{name: "long router value", f: TraefikLogFilter{Limit: 50, Router: "x", To: now}, err: "log filter is invalid"},
	}
	cases[3].f.Router = string(make([]byte, 129))

	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			if tc.f.To.IsZero() {
				tc.f.To = now
			}
			if err := tc.f.Validate(now); err == nil || !contains(err.Error(), tc.err) {
				t.Fatalf("validate() = %v, want substring %q", err, tc.err)
			}
		})
	}
}

func contains(haystack, needle string) bool {
	return len(needle) > 0 && (strings.Contains(haystack, needle))
}
