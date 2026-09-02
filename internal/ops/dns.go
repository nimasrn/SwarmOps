package ops

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"
)

const (
	cloudflareAPIBase = "https://api.cloudflare.com/client/v4"
	arvanAPIBase      = "https://napi.arvancloud.com"
	maxDNSAPIResponse = 1 << 20
)

// DNSProviderService is the fixed Cloudflare/Arvan boundary. Browser input
// cannot choose an API host, HTTP method, path, or provider-specific payload.
type DNSProviderService interface {
	DeleteRecord(context.Context, DNSCredentialMetadata, string, DNSRecordSpec) error
	FindRecord(context.Context, DNSCredentialMetadata, string, DNSRecordSpec) (*DNSProviderRecord, error)
	UpsertRecord(context.Context, DNSCredentialMetadata, string, DNSRecordSpec, *DNSProviderRecord) (DNSProviderRecord, error)
	ValidateCredential(context.Context, DNSCredentialMetadata, string) error
}

type DNSPropagationVerifier interface {
	Verify(context.Context, DNSRecordSpec) DNSPropagationStatus
}

type HTTPDNSProviderService struct {
	arvanBase      string
	client         *http.Client
	cloudflareBase string
}

func NewHTTPDNSProviderService(client *http.Client) *HTTPDNSProviderService {
	if client == nil {
		client = &http.Client{Timeout: 15 * time.Second}
	}
	return &HTTPDNSProviderService{arvanBase: arvanAPIBase, client: client, cloudflareBase: cloudflareAPIBase}
}

func (s *HTTPDNSProviderService) ValidateCredential(ctx context.Context, metadata DNSCredentialMetadata, secret string) error {
	switch metadata.Provider {
	case DNSProviderCloudflare:
		if strings.TrimSpace(metadata.Email) != "" {
			// A global API key cannot be introspected through the token
			// endpoint; the account it belongs to is the only proof available.
			var response struct {
				Result struct {
					Email string `json:"email"`
				} `json:"result"`
				Success bool `json:"success"`
			}
			if err := s.doJSON(ctx, http.MethodGet, s.cloudflareBase+"/user", cloudflareAuthorization(metadata, secret), nil, &response); err != nil {
				return fmt.Errorf("validate Cloudflare global API key: %w", err)
			}
			if !response.Success || !strings.EqualFold(strings.TrimSpace(response.Result.Email), strings.TrimSpace(metadata.Email)) {
				return fmt.Errorf("Cloudflare global API key does not belong to the stated account email")
			}
			return nil
		}
		var response struct {
			Result struct {
				Status string `json:"status"`
			} `json:"result"`
			Success bool `json:"success"`
		}
		if err := s.doJSON(ctx, http.MethodGet, s.cloudflareBase+"/user/tokens/verify", cloudflareAuthorization(metadata, secret), nil, &response); err != nil {
			return fmt.Errorf("validate Cloudflare DNS token: %w", err)
		}
		if !response.Success || !strings.EqualFold(response.Result.Status, "active") {
			return fmt.Errorf("Cloudflare DNS token is not active")
		}
		return nil
	case DNSProviderArvan:
		var response map[string]any
		endpoint := s.arvanBase + "/paas/v1/regions/ir-thr-at1/g/user"
		if err := s.doJSON(ctx, http.MethodGet, endpoint, arvanAuthorization(secret), nil, &response); err != nil {
			return fmt.Errorf("validate Arvan API key: %w", err)
		}
		return nil
	default:
		return fmt.Errorf("DNS provider is unsupported")
	}
}

func (s *HTTPDNSProviderService) FindRecord(ctx context.Context, metadata DNSCredentialMetadata, secret string, requested DNSRecordSpec) (*DNSProviderRecord, error) {
	switch metadata.Provider {
	case DNSProviderCloudflare:
		zoneID, err := s.cloudflareZoneID(ctx, metadata, secret, requested.Zone)
		if err != nil {
			return nil, err
		}
		query := url.Values{}
		query.Set("name", requested.Name)
		query.Set("type", string(requested.Type))
		query.Set("match", "all")
		query.Set("per_page", "100")
		var response struct {
			Result []struct {
				Content string `json:"content"`
				ID      string `json:"id"`
				Name    string `json:"name"`
				Proxied bool   `json:"proxied"`
				TTL     uint32 `json:"ttl"`
				Type    string `json:"type"`
			} `json:"result"`
			Success bool `json:"success"`
		}
		endpoint := s.cloudflareBase + "/zones/" + url.PathEscape(zoneID) + "/dns_records?" + query.Encode()
		if err := s.doJSON(ctx, http.MethodGet, endpoint, cloudflareAuthorization(metadata, secret), nil, &response); err != nil {
			return nil, fmt.Errorf("read Cloudflare DNS record: %w", err)
		}
		if !response.Success {
			return nil, fmt.Errorf("Cloudflare DNS record lookup failed")
		}
		for _, record := range response.Result {
			if strings.EqualFold(record.Name, requested.Name) && strings.EqualFold(record.Type, string(requested.Type)) {
				return &DNSProviderRecord{Content: strings.TrimSuffix(record.Content, "."), Name: strings.ToLower(record.Name), ProviderRecordID: record.ID, Proxied: record.Proxied, TTL: record.TTL, Type: DNSRecordType(strings.ToUpper(record.Type))}, nil
			}
		}
		return nil, nil
	case DNSProviderArvan:
		return s.findArvanRecord(ctx, secret, requested)
	default:
		return nil, fmt.Errorf("DNS provider is unsupported")
	}
}

func (s *HTTPDNSProviderService) UpsertRecord(ctx context.Context, metadata DNSCredentialMetadata, secret string, requested DNSRecordSpec, existing *DNSProviderRecord) (DNSProviderRecord, error) {
	switch metadata.Provider {
	case DNSProviderCloudflare:
		zoneID, err := s.cloudflareZoneID(ctx, metadata, secret, requested.Zone)
		if err != nil {
			return DNSProviderRecord{}, err
		}
		method := http.MethodPost
		endpoint := s.cloudflareBase + "/zones/" + url.PathEscape(zoneID) + "/dns_records"
		if existing != nil {
			if existing.Protected || existing.ProviderRecordID == "" {
				return DNSProviderRecord{}, fmt.Errorf("provider DNS record cannot be updated")
			}
			method = http.MethodPut
			endpoint += "/" + url.PathEscape(existing.ProviderRecordID)
		}
		body := map[string]any{"comment": "Managed by SwarmOps", "content": requested.Content, "name": requested.Name, "proxied": requested.Proxied, "ttl": requested.TTL, "type": requested.Type}
		var response struct {
			Result struct {
				Content string `json:"content"`
				ID      string `json:"id"`
				Name    string `json:"name"`
				Proxied bool   `json:"proxied"`
				TTL     uint32 `json:"ttl"`
				Type    string `json:"type"`
			} `json:"result"`
			Success bool `json:"success"`
		}
		if err := s.doJSON(ctx, method, endpoint, cloudflareAuthorization(metadata, secret), body, &response); err != nil {
			return DNSProviderRecord{}, fmt.Errorf("write Cloudflare DNS record: %w", err)
		}
		if !response.Success || response.Result.ID == "" {
			return DNSProviderRecord{}, fmt.Errorf("Cloudflare DNS record write failed")
		}
		return DNSProviderRecord{Content: strings.TrimSuffix(response.Result.Content, "."), Name: strings.ToLower(response.Result.Name), ProviderRecordID: response.Result.ID, Proxied: response.Result.Proxied, TTL: response.Result.TTL, Type: DNSRecordType(strings.ToUpper(response.Result.Type))}, nil
	case DNSProviderArvan:
		body, err := arvanRecordBody(requested)
		if err != nil {
			return DNSProviderRecord{}, err
		}
		method := http.MethodPost
		endpoint := s.arvanBase + "/cdn/4.0/domains/" + url.PathEscape(requested.Zone) + "/dns-records"
		if existing != nil {
			if existing.Protected || existing.ProviderRecordID == "" {
				return DNSProviderRecord{}, fmt.Errorf("provider DNS record cannot be updated")
			}
			method = http.MethodPut
			endpoint += "/" + url.PathEscape(existing.ProviderRecordID)
		}
		var response map[string]any
		if err := s.doJSON(ctx, method, endpoint, arvanAuthorization(secret), body, &response); err != nil {
			return DNSProviderRecord{}, fmt.Errorf("write Arvan DNS record: %w", err)
		}
		created, err := s.findArvanRecord(ctx, secret, requested)
		if err != nil {
			return DNSProviderRecord{}, err
		}
		if created == nil || created.ProviderRecordID == "" {
			return DNSProviderRecord{}, fmt.Errorf("Arvan DNS record write could not be verified")
		}
		return *created, nil
	default:
		return DNSProviderRecord{}, fmt.Errorf("DNS provider is unsupported")
	}
}

func (s *HTTPDNSProviderService) DeleteRecord(ctx context.Context, metadata DNSCredentialMetadata, secret string, requested DNSRecordSpec) error {
	if requested.ProviderRecordID == "" {
		return fmt.Errorf("tracked provider DNS record identifier is required")
	}
	var endpoint string
	var authorization http.Header
	switch metadata.Provider {
	case DNSProviderCloudflare:
		zoneID, err := s.cloudflareZoneID(ctx, metadata, secret, requested.Zone)
		if err != nil {
			return err
		}
		endpoint = s.cloudflareBase + "/zones/" + url.PathEscape(zoneID) + "/dns_records/" + url.PathEscape(requested.ProviderRecordID)
		authorization = cloudflareAuthorization(metadata, secret)
	case DNSProviderArvan:
		endpoint = s.arvanBase + "/cdn/4.0/domains/" + url.PathEscape(requested.Zone) + "/dns-records/" + url.PathEscape(requested.ProviderRecordID)
		authorization = arvanAuthorization(secret)
	default:
		return fmt.Errorf("DNS provider is unsupported")
	}
	var response map[string]any
	if err := s.doJSON(ctx, http.MethodDelete, endpoint, authorization, nil, &response); err != nil {
		return fmt.Errorf("delete provider DNS record: %w", err)
	}
	return nil
}

// cloudflareAuthorization picks the authentication Cloudflare expects for this
// credential: a scoped bearer token, or the global API key paired with the
// account email when one was stored with the credential.
func cloudflareAuthorization(metadata DNSCredentialMetadata, secret string) http.Header {
	if email := strings.TrimSpace(metadata.Email); email != "" {
		return http.Header{"X-Auth-Email": []string{email}, "X-Auth-Key": []string{secret}}
	}
	return http.Header{"Authorization": []string{"Bearer " + secret}}
}

func (s *HTTPDNSProviderService) cloudflareZoneID(ctx context.Context, metadata DNSCredentialMetadata, secret, zone string) (string, error) {
	query := url.Values{}
	query.Set("name", zone)
	query.Set("status", "active")
	query.Set("per_page", "2")
	if accountID := strings.TrimSpace(metadata.AccountID); accountID != "" {
		query.Set("account.id", accountID)
	}
	var response struct {
		Result []struct {
			ID   string `json:"id"`
			Name string `json:"name"`
		} `json:"result"`
		Success bool `json:"success"`
	}
	if err := s.doJSON(ctx, http.MethodGet, s.cloudflareBase+"/zones?"+query.Encode(), cloudflareAuthorization(metadata, secret), nil, &response); err != nil {
		return "", fmt.Errorf("read Cloudflare DNS zone: %w", err)
	}
	if !response.Success || len(response.Result) != 1 || !strings.EqualFold(response.Result[0].Name, zone) || response.Result[0].ID == "" {
		return "", fmt.Errorf("Cloudflare DNS zone was not found or is ambiguous")
	}
	return response.Result[0].ID, nil
}

func (s *HTTPDNSProviderService) findArvanRecord(ctx context.Context, secret string, requested DNSRecordSpec) (*DNSProviderRecord, error) {
	query := url.Values{}
	query.Set("search", arvanRelativeName(requested.Name, requested.Zone))
	query.Set("per_page", "100")
	var response struct {
		Data []struct {
			Cloud       bool            `json:"cloud"`
			ID          string          `json:"id"`
			IsProtected bool            `json:"is_protected"`
			Name        string          `json:"name"`
			TTL         uint32          `json:"ttl"`
			Type        string          `json:"type"`
			Value       json.RawMessage `json:"value"`
		} `json:"data"`
	}
	endpoint := s.arvanBase + "/cdn/4.0/domains/" + url.PathEscape(requested.Zone) + "/dns-records?" + query.Encode()
	if err := s.doJSON(ctx, http.MethodGet, endpoint, arvanAuthorization(secret), nil, &response); err != nil {
		return nil, fmt.Errorf("read Arvan DNS record: %w", err)
	}
	for _, record := range response.Data {
		name := arvanFQDN(record.Name, requested.Zone)
		if !strings.EqualFold(name, requested.Name) || !strings.EqualFold(record.Type, string(requested.Type)) {
			continue
		}
		var value struct {
			Host string `json:"host"`
			IP   string `json:"ip"`
		}
		if err := json.Unmarshal(record.Value, &value); err != nil {
			return nil, fmt.Errorf("Arvan DNS record response is invalid")
		}
		content := value.IP
		if requested.Type == DNSRecordCNAME {
			content = value.Host
		}
		return &DNSProviderRecord{Content: strings.TrimSuffix(content, "."), Name: name, Protected: record.IsProtected, ProviderRecordID: record.ID, Proxied: record.Cloud, TTL: record.TTL, Type: DNSRecordType(strings.ToUpper(record.Type))}, nil
	}
	return nil, nil
}

func (s *HTTPDNSProviderService) doJSON(ctx context.Context, method, endpoint string, auth http.Header, body, destination any) error {
	var reader io.Reader
	if body != nil {
		encoded, err := json.Marshal(body)
		if err != nil {
			return fmt.Errorf("encode provider request")
		}
		reader = bytes.NewReader(encoded)
	}
	request, err := http.NewRequestWithContext(ctx, method, endpoint, reader)
	if err != nil {
		return fmt.Errorf("build provider request")
	}
	request.Header.Set("Accept", "application/json")
	for name, values := range auth {
		for _, value := range values {
			request.Header.Set(name, value)
		}
	}
	request.Header.Set("User-Agent", "SwarmOps/1")
	if body != nil {
		request.Header.Set("Content-Type", "application/json")
	}
	response, err := s.client.Do(request)
	if err != nil {
		return fmt.Errorf("provider request failed")
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		_, _ = io.Copy(io.Discard, io.LimitReader(response.Body, maxDNSAPIResponse))
		return fmt.Errorf("provider API rejected request (HTTP %d)", response.StatusCode)
	}
	if destination == nil || response.StatusCode == http.StatusNoContent {
		_, _ = io.Copy(io.Discard, io.LimitReader(response.Body, maxDNSAPIResponse))
		return nil
	}
	decoder := json.NewDecoder(io.LimitReader(response.Body, maxDNSAPIResponse))
	if err := decoder.Decode(destination); err != nil && err != io.EOF {
		return fmt.Errorf("provider API returned invalid JSON")
	}
	return nil
}

func arvanAuthorization(secret string) http.Header {
	return http.Header{"Authorization": []string{"Apikey " + strings.TrimSpace(strings.TrimPrefix(secret, "Apikey "))}}
}

func arvanRecordBody(record DNSRecordSpec) (map[string]any, error) {
	allowedTTL := map[uint32]bool{120: true, 180: true, 300: true, 600: true, 900: true, 1800: true, 3600: true, 7200: true, 18000: true, 43200: true, 86400: true}
	if !allowedTTL[record.TTL] {
		return nil, fmt.Errorf("Arvan DNS TTL must be one of 120, 180, 300, 600, 900, 1800, 3600, 7200, 18000, 43200, or 86400")
	}
	value := map[string]any{"ip": record.Content}
	if record.Type == DNSRecordCNAME {
		value = map[string]any{"host": record.Content}
	}
	return map[string]any{
		"cloud":          record.Proxied,
		"name":           arvanRelativeName(record.Name, record.Zone),
		"ttl":            record.TTL,
		"type":           strings.ToLower(string(record.Type)),
		"upstream_https": "default",
		"value":          value,
	}, nil
}

func arvanRelativeName(name, zone string) string {
	name, zone = strings.TrimSuffix(strings.ToLower(name), "."), strings.TrimSuffix(strings.ToLower(zone), ".")
	if name == zone {
		return "@"
	}
	return strings.TrimSuffix(name, "."+zone)
}

func arvanFQDN(name, zone string) string {
	name = strings.TrimSuffix(strings.ToLower(strings.TrimSpace(name)), ".")
	zone = strings.TrimSuffix(strings.ToLower(strings.TrimSpace(zone)), ".")
	if name == "" || name == "@" {
		return zone
	}
	if name == zone || strings.HasSuffix(name, "."+zone) {
		return name
	}
	return name + "." + zone
}

// NetDNSPropagationVerifier checks both fixed public resolvers and one
// authoritative nameserver. It never accepts a resolver address or query type
// from the browser.
type NetDNSPropagationVerifier struct{}

func (NetDNSPropagationVerifier) Verify(ctx context.Context, record DNSRecordSpec) DNSPropagationStatus {
	status := DNSPropagationStatus{Checks: []DNSPropagationCheck{}, ObservedAt: time.Now().UTC()}
	resolvers := []struct {
		address string
		label   string
	}{{address: "1.1.1.1:53", label: "1.1.1.1"}, {address: "8.8.8.8:53", label: "8.8.8.8"}}
	if nameservers, err := net.DefaultResolver.LookupNS(ctx, record.Zone); err == nil && len(nameservers) > 0 {
		host := strings.TrimSuffix(nameservers[0].Host, ".")
		if addresses, lookupErr := net.DefaultResolver.LookupHost(ctx, host); lookupErr == nil && len(addresses) > 0 {
			resolvers = append([]struct {
				address string
				label   string
			}{{address: net.JoinHostPort(addresses[0], "53"), label: "authoritative:" + host}}, resolvers...)
		}
	}
	for _, item := range resolvers {
		resolver := &net.Resolver{PreferGo: true, Dial: func(ctx context.Context, network, _ string) (net.Conn, error) {
			return (&net.Dialer{Timeout: 4 * time.Second}).DialContext(ctx, network, item.address)
		}}
		check := verifyDNSRecord(ctx, resolver, item.label, record)
		status.Checks = append(status.Checks, check)
	}
	status.Ready = len(status.Checks) == 3
	for _, check := range status.Checks {
		status.Ready = status.Ready && check.Valid
	}
	return status
}

func verifyDNSRecord(ctx context.Context, resolver *net.Resolver, label string, record DNSRecordSpec) DNSPropagationCheck {
	check := DNSPropagationCheck{Answers: []string{}, Resolver: label}
	var err error
	switch record.Type {
	case DNSRecordA, DNSRecordAAAA:
		var addresses []net.IPAddr
		addresses, err = resolver.LookupIPAddr(ctx, record.Name)
		for _, address := range addresses {
			if record.Type == DNSRecordA && address.IP.To4() != nil || record.Type == DNSRecordAAAA && address.IP.To4() == nil {
				check.Answers = append(check.Answers, address.IP.String())
			}
		}
	case DNSRecordCNAME:
		var cname string
		cname, err = resolver.LookupCNAME(ctx, record.Name)
		if cname != "" {
			check.Answers = append(check.Answers, strings.TrimSuffix(cname, "."))
		}
	default:
		err = fmt.Errorf("unsupported record type")
	}
	check.Answers = sortedDNSAnswers(check.Answers)
	if err != nil {
		check.Error = "DNS lookup failed"
		return check
	}
	want := strings.TrimSuffix(strings.ToLower(record.Content), ".")
	for _, answer := range check.Answers {
		if strings.EqualFold(strings.TrimSuffix(answer, "."), want) {
			check.Valid = true
			break
		}
	}
	if !check.Valid {
		check.Error = "expected DNS answer was not observed"
	}
	return check
}

func sortedDNSAnswers(values []string) []string {
	seen := map[string]bool{}
	result := make([]string, 0, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value != "" && !seen[value] {
			seen[value] = true
			result = append(result, value)
		}
	}
	sort.Slice(result, func(i, j int) bool {
		left, leftErr := strconv.ParseUint(strings.ReplaceAll(result[i], ".", ""), 10, 64)
		right, rightErr := strconv.ParseUint(strings.ReplaceAll(result[j], ".", ""), 10, 64)
		if leftErr == nil && rightErr == nil && left != right {
			return left < right
		}
		return result[i] < result[j]
	})
	return result
}
