package ops

import (
	"fmt"
	"strings"
	"time"
)

// DomainSpec is an apex zone the gateway has accepted. Acceptance is the first
// step of the publication order: a zone is registered here, subdomain records
// are created under it, and only then may a route claim one of those names.
// Registration is a reviewed operator declaration — it does not call the DNS
// provider, so a registered zone means "this gateway is allowed to publish
// here", not "this zone was proven to exist".
type DomainSpec struct {
	CreatedAt time.Time `json:"createdAt"`
	Note      string    `json:"note,omitempty"`
	Version   int       `json:"version"`
	Zone      string    `json:"zone"`
}

func (d DomainSpec) Normalize() DomainSpec {
	d.Zone = strings.ToLower(strings.TrimSuffix(strings.TrimSpace(d.Zone), "."))
	d.Note = strings.TrimSpace(d.Note)
	if d.Version == 0 {
		d.Version = RoutingSchemaVersion
	}
	return d
}

func (d DomainSpec) Validate() error {
	d = d.Normalize()
	if d.Version != RoutingSchemaVersion {
		return fmt.Errorf("unsupported domain schema version")
	}
	if !safeHostname(d.Zone) {
		return fmt.Errorf("domain zone is invalid")
	}
	if len(d.Note) > 256 || strings.ContainsAny(d.Note, "\r\n\x00") {
		return fmt.Errorf("domain note must be a single line of at most 256 characters")
	}
	return nil
}

func DomainRemovalConfirmation(zone string) string {
	value := strings.ToUpper(strings.Map(func(r rune) rune {
		if r >= 'A' && r <= 'Z' || r >= '0' && r <= '9' || r == '_' {
			return r
		}
		if r >= 'a' && r <= 'z' {
			return r - ('a' - 'A')
		}
		return '_'
	}, strings.TrimSpace(zone)))
	return "REMOVE_DOMAIN_" + value
}

// acceptedZone reports the accepted domain that owns a hostname. A name is
// owned by its own zone or by any registered parent zone.
func acceptedZone(domains []DomainSpec, host string) (DomainSpec, bool) {
	host = strings.ToLower(strings.TrimSuffix(strings.TrimSpace(host), "."))
	best, found := DomainSpec{}, false
	for _, domain := range domains {
		domain = domain.Normalize()
		if host != domain.Zone && !strings.HasSuffix(host, "."+domain.Zone) {
			continue
		}
		if !found || len(domain.Zone) > len(best.Zone) {
			best, found = domain, true
		}
	}
	return best, found
}

func dnsRecordNamed(records []DNSRecordSpec, name string) (DNSRecordSpec, bool) {
	name = strings.ToLower(strings.TrimSuffix(strings.TrimSpace(name), "."))
	for _, record := range records {
		if record.Normalize().Name == name {
			return record, true
		}
	}
	return DNSRecordSpec{}, false
}

// ValidateDomainAdmission enforces that a DNS record is created under a zone
// the gateway has already accepted. Without it a subdomain could be published
// under a zone this gateway was never given.
func ValidateDomainAdmission(record DNSRecordSpec, domains []DomainSpec) error {
	record = record.Normalize()
	if _, found := acceptedZone(domains, record.Name); !found {
		return fmt.Errorf("DNS record zone %q is not an accepted gateway domain", record.Zone)
	}
	return nil
}

// ValidateRouteAdmission is the second half of the publication order: every
// hostname a route claims — public or internal, host match or SNI — must
// already exist as a DNS record under an accepted domain. A route that names a
// host nobody registered gets no router at all rather than an unresolvable one.
//
// A wildcard host is admitted against its own base name: *.example.com needs
// example.com to be both an accepted domain and an existing record, because a
// wildcard by construction covers subdomains that were never created one by one.
func ValidateRouteAdmission(route RouteSpec, records []DNSRecordSpec, domains []DomainSpec) error {
	route = route.Normalize()
	hosts := append(append([]string{}, route.Match.Hosts...), route.Match.SNI...)
	for _, host := range hosts {
		name := strings.TrimPrefix(host, "*.")
		if name == "" {
			return fmt.Errorf("route host %q is invalid", host)
		}
		if _, found := acceptedZone(domains, name); !found {
			return fmt.Errorf("route host %q does not belong to an accepted gateway domain", host)
		}
		if _, found := dnsRecordNamed(records, name); !found {
			return fmt.Errorf("route host %q has no DNS record; create the subdomain before assigning it to a service", host)
		}
	}
	if route.DNSReference != "" {
		record := DNSRecordSpec{}
		found := false
		for _, candidate := range records {
			if candidate.ID == route.DNSReference {
				record, found = candidate, true
				break
			}
		}
		if !found {
			return fmt.Errorf("route DNS reference was not found")
		}
		if err := ValidateDomainAdmission(record, domains); err != nil {
			return err
		}
	}
	return nil
}
