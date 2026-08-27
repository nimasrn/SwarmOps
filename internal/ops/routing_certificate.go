package ops

import (
	"context"
	"crypto/sha256"
	"crypto/tls"
	"encoding/hex"
	"fmt"
	"net"
	"sort"
	"strings"
	"time"

	"github.com/nimasrn/SwarmOps/internal/agentcontrol"
)

type TLSCertificateInspection struct {
	Domains     []string
	Fingerprint string
	Issuer      string
	NotAfter    time.Time
	NotBefore   time.Time
}

type TLSCertificateInspector interface {
	Inspect(context.Context, string, uint16) (TLSCertificateInspection, error)
}

type NetTLSCertificateInspector struct{}

func (NetTLSCertificateInspector) Inspect(ctx context.Context, serverName string, port uint16) (TLSCertificateInspection, error) {
	serverName = strings.TrimSuffix(strings.TrimSpace(serverName), ".")
	if !safeHostname(serverName) || strings.HasPrefix(serverName, "*.") || port == 0 {
		return TLSCertificateInspection{}, fmt.Errorf("TLS handshake target is invalid")
	}
	dialer := &tls.Dialer{
		Config:    &tls.Config{MinVersion: tls.VersionTLS12, ServerName: serverName},
		NetDialer: &net.Dialer{Timeout: 8 * time.Second},
	}
	connection, err := dialer.DialContext(ctx, "tcp", net.JoinHostPort(serverName, fmt.Sprintf("%d", port)))
	if err != nil {
		return TLSCertificateInspection{}, fmt.Errorf("TLS handshake validation failed")
	}
	defer connection.Close()
	state := connection.(*tls.Conn).ConnectionState()
	if !state.HandshakeComplete || len(state.PeerCertificates) == 0 {
		return TLSCertificateInspection{}, fmt.Errorf("TLS handshake returned no leaf certificate")
	}
	leaf := state.PeerCertificates[0]
	digest := sha256.Sum256(leaf.Raw)
	domains := normalizeHosts(leaf.DNSNames)
	if len(domains) == 0 && leaf.Subject.CommonName != "" {
		domains = normalizeHosts([]string{leaf.Subject.CommonName})
	}
	return TLSCertificateInspection{
		Domains:     domains,
		Fingerprint: "SHA256:" + strings.ToUpper(hex.EncodeToString(digest[:])),
		Issuer:      leaf.Issuer.String(),
		NotAfter:    leaf.NotAfter.UTC(),
		NotBefore:   leaf.NotBefore.UTC(),
	}, nil
}

func (c *ControlPlane) RetryCertificate(ctx context.Context, actor, requestID, routeKey string) (CertificateStatus, error) {
	if !c.Mutations {
		return CertificateStatus{}, fmt.Errorf("cluster mutations are disabled")
	}
	if err := c.requireAudit(); err != nil {
		return CertificateStatus{}, err
	}
	if err := c.requireRouting(); err != nil {
		return CertificateStatus{}, err
	}
	routeKey = strings.ToLower(strings.TrimSpace(routeKey))
	state, err := c.Routing.Snapshot(c.ServerID)
	if err != nil {
		return CertificateStatus{}, err
	}
	var route RouteSpec
	found := false
	for _, candidate := range state.Routes {
		if candidate.Key == routeKey {
			route, found = candidate, true
			break
		}
	}
	if !found {
		return CertificateStatus{}, fmt.Errorf("certificate route was not found")
	}
	if !route.Enabled || !routeIsPublic(route.Scope) || route.TLS != RouteTLSTerminate || route.Protocol == RouteUDP {
		return CertificateStatus{}, fmt.Errorf("certificate retry requires an enabled public terminating TLS route")
	}
	if err := ValidateRouteCompatibility(route, state.Settings, state.DNSRecords); err != nil {
		return CertificateStatus{}, err
	}
	if err := validateRouteResolverCredential(route, state); err != nil {
		return CertificateStatus{}, err
	}
	if route.DNSReference != "" {
		propagation, verifyErr := c.VerifyDNSRecord(ctx, route.DNSReference)
		if verifyErr != nil {
			return CertificateStatus{}, verifyErr
		}
		if !propagation.Ready {
			return CertificateStatus{}, fmt.Errorf("certificate retry DNS preflight did not pass all resolvers")
		}
	}
	adapter, err := c.traefikMachineAdapter()
	if err != nil {
		return CertificateStatus{}, err
	}
	serviceID, traefikID, err := c.routeServiceIDs(ctx, route.ServiceKey)
	if err != nil {
		return CertificateStatus{}, err
	}
	reconcile := agentcontrol.RoutingReconcileRequest{
		Network:          RouteNetworkName(route.ServiceKey),
		Route:            routeAgentContract(route),
		ServiceID:        serviceID,
		TraefikServiceID: traefikID,
		Version:          agentcontrol.RoutingVersion,
	}
	reconcile.Route.ACMETrigger = true
	attempt := c.now().UTC()
	status := CertificateStatus{Domains: certificateRouteDomains(route), LastAttempt: &attempt, Resolver: route.Resolver, RouteKey: route.Key, State: "requesting", Version: RoutingSchemaVersion}
	if err = adapter.ReconcileRouting(ctx, reconcile); err != nil {
		status.State = "failed"
		status.FailureSummary = "temporary ACME trigger router could not be installed"
		_ = c.Routing.PutCertificate(c.ServerID, status)
		c.record(actor, requestID, "traefik.certificate.retry", "certificate/"+route.Key, err, map[string]string{"resolver": route.Resolver})
		return status, err
	}
	// The trigger is deliberately temporary. Removing it never touches the
	// resolver or acme.json; Traefik remains responsible for renewal state.
	defer func() {
		reconcile.Route.ACMETrigger = false
		_ = adapter.ReconcileRouting(context.WithoutCancel(ctx), reconcile)
	}()
	_ = c.RefreshTraefikRuntime(ctx)
	logs, _ := c.TraefikLogs(ctx, TraefikLogFilter{From: attempt.Add(-5 * time.Minute), Limit: 100, Router: routeRouterName(route), To: c.now().UTC()})
	host, port, err := certificateHandshakeTarget(route)
	if err == nil {
		if c.TLSInspector == nil {
			err = fmt.Errorf("TLS certificate inspector is not configured")
		} else {
			var inspection TLSCertificateInspection
			inspection, err = c.TLSInspector.Inspect(ctx, host, port)
			if err == nil {
				status.Domains = append([]string(nil), inspection.Domains...)
				status.Fingerprint = inspection.Fingerprint
				status.HandshakeValid = true
				status.Issuer = inspection.Issuer
				status.NotAfter = timePointer(inspection.NotAfter)
				status.NotBefore = timePointer(inspection.NotBefore)
				status.State = "valid"
			}
		}
	}
	if err != nil {
		status.State = "failed"
		status.FailureSummary = certificateFailureSummary(logs)
		if status.FailureSummary == "" {
			status.FailureSummary = "TLS handshake did not present a trusted certificate after the retry trigger"
		}
	}
	storeErr := c.Routing.PutCertificate(c.ServerID, status)
	if err == nil {
		err = storeErr
	}
	c.record(actor, requestID, "traefik.certificate.retry", "certificate/"+route.Key, err, map[string]string{"handshake_valid": fmt.Sprintf("%t", status.HandshakeValid), "resolver": route.Resolver})
	return status, err
}

func certificateRouteDomains(route RouteSpec) []string {
	values := append([]string(nil), route.Match.Hosts...)
	values = append(values, route.Match.SNI...)
	return normalizeHosts(values)
}

func certificateHandshakeTarget(route RouteSpec) (string, uint16, error) {
	domains := certificateRouteDomains(route)
	if len(domains) == 0 {
		return "", 0, fmt.Errorf("certificate route has no TLS hostname")
	}
	host := domains[0]
	if strings.HasPrefix(host, "*.") {
		host = strings.TrimPrefix(host, "*.")
	}
	port := uint16(443)
	if route.Protocol == RouteTCP {
		port = route.ListenPort
	}
	return host, port, nil
}

func certificateFailureSummary(logs []TraefikLogRecord) string {
	for index := len(logs) - 1; index >= 0; index-- {
		entry := logs[index]
		if entry.Level != "ERROR" && entry.Level != "WARN" {
			continue
		}
		message := strings.TrimSpace(entry.Message)
		if len(message) > 256 {
			message = message[:256]
		}
		if message != "" {
			return message
		}
	}
	return ""
}

func timePointer(value time.Time) *time.Time {
	value = value.UTC()
	return &value
}

func sortedCertificateDomains(values []string) []string {
	values = normalizeHosts(values)
	sort.Strings(values)
	return values
}
