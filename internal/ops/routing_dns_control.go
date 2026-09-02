package ops

import (
	"context"
	"fmt"
	"strconv"
	"strings"
)

func DNSRecordDeletionConfirmation(id string) string {
	value := strings.ToUpper(strings.Map(func(r rune) rune {
		if r >= 'A' && r <= 'Z' || r >= '0' && r <= '9' || r == '_' {
			return r
		}
		if r >= 'a' && r <= 'z' {
			return r - ('a' - 'A')
		}
		return '_'
	}, strings.TrimSpace(id)))
	return "DELETE_DNS_RECORD_" + value
}

func (c *ControlPlane) PreviewDNSRecord(ctx context.Context, requested DNSRecordSpec, protocol RouteProtocol) (DNSRecordPreview, error) {
	if err := c.requireRouting(); err != nil {
		return DNSRecordPreview{}, err
	}
	if c.DNSProviders == nil {
		return DNSRecordPreview{}, fmt.Errorf("DNS provider adapter is not configured")
	}
	record := requested.Normalize()
	if err := record.Validate(protocol); err != nil {
		return DNSRecordPreview{}, err
	}
	state, err := c.Routing.Snapshot(c.ServerID)
	if err != nil {
		return DNSRecordPreview{}, err
	}
	// Acceptance is checked before the provider is contacted: an unaccepted
	// zone must not produce provider traffic at all.
	if err := ValidateDomainAdmission(record, state.Domains); err != nil {
		return DNSRecordPreview{}, err
	}
	tracked := findDNSRecord(state.DNSRecords, record.ID)
	metadata, secret, err := c.Routing.CredentialSecret(c.ServerID, record.CredentialID, 0)
	if err != nil {
		return DNSRecordPreview{}, err
	}
	defer func() { secret = "" }()
	existing, err := c.DNSProviders.FindRecord(ctx, metadata, secret, record)
	if err != nil {
		return DNSRecordPreview{}, err
	}
	preview := DNSRecordPreview{Action: "create", Existing: existing, Record: record, Warnings: []string{}}
	if existing == nil {
		if record.Adopted {
			return DNSRecordPreview{}, fmt.Errorf("DNS record cannot adopt a provider record that does not exist")
		}
		if tracked != nil && tracked.ProviderRecordID != "" {
			return DNSRecordPreview{}, fmt.Errorf("tracked provider DNS record is missing")
		}
		return preview, nil
	}
	if existing.Protected {
		return DNSRecordPreview{}, fmt.Errorf("provider DNS record is protected and cannot be changed")
	}
	if tracked == nil && !record.Adopted {
		return DNSRecordPreview{}, fmt.Errorf("an existing provider DNS record must be explicitly adopted before SwarmOps can manage it")
	}
	if tracked != nil && tracked.ProviderRecordID != "" && tracked.ProviderRecordID != existing.ProviderRecordID {
		return DNSRecordPreview{}, fmt.Errorf("tracked provider DNS record identifier has drifted")
	}
	preview.Record.ProviderRecordID = existing.ProviderRecordID
	if dnsProviderRecordMatches(*existing, record) {
		preview.Action = "noop"
		if tracked == nil {
			preview.Action = "adopt"
		}
		return preview, nil
	}
	preview.Action = "update"
	if tracked == nil {
		preview.Action = "adopt-and-update"
	}
	if existing.Proxied != record.Proxied {
		preview.Warnings = append(preview.Warnings, "provider proxy state will change")
	}
	return preview, nil
}

func (c *ControlPlane) ApplyDNSRecord(ctx context.Context, actor, requestID string, requested DNSRecordSpec, protocol RouteProtocol) (DNSRecordSpec, error) {
	if !c.Mutations {
		return DNSRecordSpec{}, fmt.Errorf("cluster mutations are disabled")
	}
	if err := c.requireAudit(); err != nil {
		return DNSRecordSpec{}, err
	}
	preview, err := c.PreviewDNSRecord(ctx, requested, protocol)
	if err != nil {
		c.record(actor, requestID, "traefik.dns-record.apply", "dns-record/"+requested.ID, err, nil)
		return DNSRecordSpec{}, err
	}
	metadata, secret, err := c.Routing.CredentialSecret(c.ServerID, preview.Record.CredentialID, 0)
	if err != nil {
		return DNSRecordSpec{}, err
	}
	defer func() { secret = "" }()
	record := preview.Record
	if preview.Action == "create" || preview.Action == "update" || preview.Action == "adopt-and-update" {
		providerRecord, writeErr := c.DNSProviders.UpsertRecord(ctx, metadata, secret, record, preview.Existing)
		if writeErr != nil {
			c.record(actor, requestID, "traefik.dns-record.apply", "dns-record/"+record.ID, writeErr, map[string]string{"action": preview.Action, "provider": string(metadata.Provider)})
			return DNSRecordSpec{}, writeErr
		}
		record.ProviderRecordID = providerRecord.ProviderRecordID
	} else if preview.Existing != nil {
		record.ProviderRecordID = preview.Existing.ProviderRecordID
	}
	if preview.Action == "create" {
		record.Managed = true
		record.Adopted = false
	}
	err = c.Routing.PutDNSRecord(c.ServerID, record, protocol)
	c.record(actor, requestID, "traefik.dns-record.apply", "dns-record/"+record.ID, err, map[string]string{"action": preview.Action, "provider": string(metadata.Provider), "type": string(record.Type)})
	return record, err
}

func (c *ControlPlane) DeleteDNSRecord(ctx context.Context, actor, requestID, id, confirmation string) error {
	if !c.Mutations {
		return fmt.Errorf("cluster mutations are disabled")
	}
	if err := c.requireAudit(); err != nil {
		return err
	}
	id = strings.ToLower(strings.TrimSpace(id))
	if confirmation != DNSRecordDeletionConfirmation(id) {
		return fmt.Errorf("DNS record deletion requires confirmation %s", DNSRecordDeletionConfirmation(id))
	}
	state, err := c.Routing.Snapshot(c.ServerID)
	if err != nil {
		return err
	}
	record := findDNSRecord(state.DNSRecords, id)
	if record == nil {
		return fmt.Errorf("DNS record was not found")
	}
	if !record.Managed && !record.Adopted {
		return fmt.Errorf("DNS record is not owned or adopted by SwarmOps")
	}
	for _, route := range state.Routes {
		if route.DNSReference == id {
			return fmt.Errorf("DNS record remains referenced by route %q", route.Key)
		}
	}
	metadata, secret, err := c.Routing.CredentialSecret(c.ServerID, record.CredentialID, 0)
	if err == nil {
		err = c.DNSProviders.DeleteRecord(ctx, metadata, secret, *record)
		secret = ""
	}
	if err == nil {
		err = c.Routing.RemoveDNSRecord(c.ServerID, id)
	}
	c.record(actor, requestID, "traefik.dns-record.delete", "dns-record/"+id, err, map[string]string{"provider": string(metadata.Provider)})
	return err
}

func (c *ControlPlane) VerifyDNSRecord(ctx context.Context, id string) (DNSPropagationStatus, error) {
	if err := c.requireRouting(); err != nil {
		return DNSPropagationStatus{}, err
	}
	if c.DNSVerifier == nil {
		return DNSPropagationStatus{}, fmt.Errorf("DNS propagation verifier is not configured")
	}
	state, err := c.Routing.Snapshot(c.ServerID)
	if err != nil {
		return DNSPropagationStatus{}, err
	}
	record := findDNSRecord(state.DNSRecords, strings.ToLower(strings.TrimSpace(id)))
	if record == nil {
		return DNSPropagationStatus{}, fmt.Errorf("DNS record was not found")
	}
	status := c.DNSVerifier.Verify(ctx, *record)
	return status, nil
}

func findDNSRecord(records []DNSRecordSpec, id string) *DNSRecordSpec {
	for index := range records {
		if records[index].ID == id {
			copy := records[index]
			return &copy
		}
	}
	return nil
}

func dnsProviderRecordMatches(existing DNSProviderRecord, requested DNSRecordSpec) bool {
	return strings.EqualFold(strings.TrimSuffix(existing.Name, "."), strings.TrimSuffix(requested.Name, ".")) &&
		existing.Type == requested.Type &&
		strings.EqualFold(strings.TrimSuffix(existing.Content, "."), strings.TrimSuffix(requested.Content, ".")) &&
		existing.TTL == requested.TTL &&
		existing.Proxied == requested.Proxied
}

func credentialVersionDetail(metadata DNSCredentialMetadata) map[string]string {
	return map[string]string{"provider": string(metadata.Provider), "version": strconv.Itoa(metadata.Version)}
}

// RegisterDomain accepts an apex zone for this gateway. It is the first step of
// the publication order: accept the domain, create the subdomain record, then
// assign that name to a service.
func (c *ControlPlane) RegisterDomain(actor, requestID string, requested DomainSpec) error {
	if !c.Mutations {
		return fmt.Errorf("cluster mutations are disabled")
	}
	if err := c.requireAudit(); err != nil {
		return err
	}
	if err := c.requireRouting(); err != nil {
		return err
	}
	domain := requested.Normalize()
	err := c.Routing.PutDomain(c.ServerID, domain)
	c.record(actor, requestID, "traefik.domain.register", "domain/"+domain.Zone, err, map[string]string{"zone": domain.Zone})
	return err
}

// RemoveDomain withdraws acceptance of a zone. It fails while any record or
// route still depends on it, so acceptance can never be revoked out from under
// something that is already published.
func (c *ControlPlane) RemoveDomain(actor, requestID, zone, confirmation string) error {
	if !c.Mutations {
		return fmt.Errorf("cluster mutations are disabled")
	}
	if err := c.requireAudit(); err != nil {
		return err
	}
	if err := c.requireRouting(); err != nil {
		return err
	}
	zone = strings.ToLower(strings.TrimSuffix(strings.TrimSpace(zone), "."))
	if confirmation != DomainRemovalConfirmation(zone) {
		return fmt.Errorf("domain removal requires confirmation %s", DomainRemovalConfirmation(zone))
	}
	err := c.Routing.RemoveDomain(c.ServerID, zone)
	c.record(actor, requestID, "traefik.domain.remove", "domain/"+zone, err, map[string]string{"zone": zone})
	return err
}
