package ops

import (
	"fmt"
	"net"
	"regexp"
	"strings"

	"gopkg.in/yaml.v3"
)

// TraefikStackSettings contains only public settings and immutable Swarm
// secret/config names. Secret values never pass through this type.
type TraefikStackSettings struct {
	ACMEEmail           string
	ArvanAPIKeySecret   string
	CFDNSTokenSecret    string
	DashboardAuthSecret string
	DashboardHost       string
	DynamicConfigName   string
	Image               string
}

var dockerReferenceName = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$`)

// RenderTraefikStack resolves the small allow-list of trusted host settings
// before the stack crosses the machine API. It also replaces the source-tree-relative
// dynamic config reference with the immutable external Swarm config that was
// created during platform bootstrap.
func RenderTraefikStack(source []byte, settings TraefikStackSettings) ([]byte, error) {
	if err := settings.Validate(); err != nil {
		return nil, err
	}
	text := string(source)
	text = strings.NewReplacer(
		"${TRAEFIK_IMAGE:-traefik:v3.6.13}", settings.Image,
		"${TRAEFIK_ACME_EMAIL:?set TRAEFIK_ACME_EMAIL}", settings.ACMEEmail,
		"${TRAEFIK_DASHBOARD_HOST:-traefik.nim.zone}", settings.DashboardHost,
		"${TRAEFIK_DYNAMIC_CONFIG_NAME:-nim_traefik_dynamic_v1}", settings.DynamicConfigName,
		"${TRAEFIK_CF_DNS_TOKEN_SECRET:-traefik_cf_dns_token_v1}", settings.CFDNSTokenSecret,
		"${TRAEFIK_ARVAN_API_KEY_SECRET:-traefik_arvan_api_key_v1}", settings.ArvanAPIKeySecret,
		"${TRAEFIK_DASHBOARD_AUTH_SECRET:-traefik_dashboard_auth_v1}", settings.DashboardAuthSecret,
	).Replace(text)
	if strings.Contains(text, "${") {
		return nil, fmt.Errorf("Traefik stack has an unresolved template expression")
	}
	var root map[string]any
	if err := yaml.Unmarshal([]byte(text), &root); err != nil {
		return nil, fmt.Errorf("parse trusted Traefik stack: %w", err)
	}
	configs, ok := asMap(root["configs"])
	if !ok {
		return nil, fmt.Errorf("trusted Traefik stack has no configs section")
	}
	dynamic, ok := asMap(configs["traefik_dynamic"])
	if !ok {
		return nil, fmt.Errorf("trusted Traefik stack has no traefik_dynamic config")
	}
	delete(dynamic, "file")
	dynamic["external"] = true
	dynamic["name"] = settings.DynamicConfigName
	rendered, err := yaml.Marshal(root)
	if err != nil {
		return nil, fmt.Errorf("serialize trusted Traefik stack: %w", err)
	}
	return rendered, nil
}

func (s TraefikStackSettings) Validate() error {
	if strings.TrimSpace(s.ACMEEmail) == "" || !strings.Contains(s.ACMEEmail, "@") || strings.ContainsAny(s.ACMEEmail, "\r\n\x00") {
		return fmt.Errorf("Traefik ACME email is not configured")
	}
	if !safeHostname(s.DashboardHost) {
		return fmt.Errorf("Traefik dashboard hostname is not configured")
	}
	if err := validateImage(s.Image); err != nil {
		return fmt.Errorf("Traefik image: %w", err)
	}
	for name, value := range map[string]string{
		"Traefik Arvan API-key secret":    s.ArvanAPIKeySecret,
		"Traefik Cloudflare token secret": s.CFDNSTokenSecret,
		"Traefik dashboard-auth secret":   s.DashboardAuthSecret,
		"Traefik dynamic config":          s.DynamicConfigName,
	} {
		if !dockerReferenceName.MatchString(strings.TrimSpace(value)) {
			return fmt.Errorf("%s name is invalid", name)
		}
	}
	return nil
}

func safeHostname(value string) bool {
	value = strings.ToLower(strings.TrimSpace(value))
	if value == "" || len(value) > 253 || net.ParseIP(value) != nil || strings.ContainsAny(value, "/:@?#\r\n\x00") {
		return false
	}
	parts := strings.Split(value, ".")
	if len(parts) < 2 {
		return false
	}
	for _, part := range parts {
		if len(part) == 0 || len(part) > 63 || strings.HasPrefix(part, "-") || strings.HasSuffix(part, "-") || !regexp.MustCompile(`^[a-z0-9-]+$`).MatchString(part) {
			return false
		}
	}
	return true
}
