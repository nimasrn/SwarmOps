package agent

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"net/netip"
	"net/url"
	"os/exec"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/nimasrn/SwarmOps/internal/agentcontrol"
)

const routingRequestLimit = 64 << 10

type inspectedService struct {
	Spec struct {
		EndpointSpec struct {
			Ports []struct {
				Protocol      string `json:"Protocol"`
				PublishedPort uint32 `json:"PublishedPort"`
				TargetPort    uint32 `json:"TargetPort"`
			} `json:"Ports"`
		} `json:"EndpointSpec"`
		Labels       map[string]string `json:"Labels"`
		TaskTemplate struct {
			Networks []struct {
				Aliases []string `json:"Aliases"`
				Target  string   `json:"Target"`
			} `json:"Networks"`
		} `json:"TaskTemplate"`
	} `json:"Spec"`
}

type inspectedNetwork struct {
	Driver  string            `json:"Driver"`
	ID      string            `json:"Id"`
	Name    string            `json:"Name"`
	Options map[string]string `json:"Options"`
	Scope   string            `json:"Scope"`
}

func (s *Server) routingReconcile(response http.ResponseWriter, request *http.Request) {
	if !s.authorized(request) {
		http.Error(response, "unauthorized", http.StatusUnauthorized)
		return
	}
	var input agentcontrol.RoutingReconcileRequest
	if !decodeRoutingRequest(response, request, &input) {
		return
	}
	if err := input.Validate(); err != nil {
		http.Error(response, "invalid routing request", http.StatusBadRequest)
		return
	}
	if err := reconcileTypedRoute(request.Context(), input); err != nil {
		failGateway(response, "routing reconciliation failed", err, "network", input.Network, "service", input.ServiceID)
		return
	}
	writeJSON(response, map[string]string{"status": "ok"})
}

func (s *Server) routingNetwork(response http.ResponseWriter, request *http.Request) {
	if !s.authorized(request) {
		http.Error(response, "unauthorized", http.StatusUnauthorized)
		return
	}
	var input agentcontrol.RoutingNetworkRequest
	if !decodeRoutingRequest(response, request, &input) {
		return
	}
	if err := input.Validate(); err != nil {
		http.Error(response, "invalid routing network request", http.StatusBadRequest)
		return
	}
	network, err := ensureEncryptedRoutingNetwork(request.Context(), input.Network)
	if err == nil {
		err = ensureServiceNetwork(request.Context(), input.TraefikServiceID, network, "")
	}
	if err != nil {
		failGateway(response, "routing network preparation failed", err, "network", input.Network, "traefik_service", input.TraefikServiceID)
		return
	}
	writeJSON(response, map[string]string{"status": "ok"})
}

func (s *Server) routingBind(response http.ResponseWriter, request *http.Request) {
	if !s.authorized(request) {
		http.Error(response, "unauthorized", http.StatusUnauthorized)
		return
	}
	var input agentcontrol.RoutingBindingRequest
	if !decodeRoutingRequest(response, request, &input) {
		return
	}
	if err := input.Validate(); err != nil {
		http.Error(response, "invalid dependency binding", http.StatusBadRequest)
		return
	}
	if err := reconcileTypedBinding(request.Context(), input); err != nil {
		failGateway(response, "dependency binding failed", err)
		return
	}
	writeJSON(response, map[string]string{"status": "ok"})
}

func decodeRoutingRequest(response http.ResponseWriter, request *http.Request, target any) bool {
	request.Body = http.MaxBytesReader(response, request.Body, routingRequestLimit)
	decoder := json.NewDecoder(request.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil || decoder.Decode(&struct{}{}) != io.EOF {
		http.Error(response, "invalid typed request", http.StatusBadRequest)
		return false
	}
	return true
}

func reconcileTypedRoute(ctx context.Context, input agentcontrol.RoutingReconcileRequest) error {
	network, err := ensureEncryptedRoutingNetwork(ctx, input.Network)
	if err != nil {
		return err
	}
	if err := ensureServiceNetwork(ctx, input.TraefikServiceID, network, ""); err != nil {
		return err
	}
	current, err := inspectRoutingService(ctx, input.ServiceID)
	if err != nil {
		return err
	}
	labels, err := input.Route.Labels(input.Network)
	if err != nil {
		return err
	}
	args := []string{"service", "update"}
	owned, err := ownedRoutingLabels(current.Spec.Labels, input.Route.Key)
	if err != nil {
		return err
	}
	for _, key := range owned {
		args = append(args, "--label-rm", key)
	}
	keys := make([]string, 0, len(labels))
	for key := range labels {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	for _, key := range keys {
		args = append(args, "--label-add", key+"="+labels[key])
	}
	for _, networkName := range input.AddNetworks {
		network, err := ensureEncryptedRoutingNetwork(ctx, networkName)
		if err != nil {
			return err
		}
		args = append(args, "--network-add", networkName)
		if err := ensureServiceNetwork(ctx, input.TraefikServiceID, network, ""); err != nil {
			return err
		}
	}
	if !serviceHasNetwork(current, network.ID) {
		args = append(args, "--network-add", input.Network)
	}
	if input.RemoveDirectPorts {
		for _, port := range current.Spec.EndpointSpec.Ports {
			if port.PublishedPort > 0 {
				args = append(args, "--publish-rm", strconv.FormatUint(uint64(port.PublishedPort), 10))
			}
		}
	}
	// The request is de-duplicated against itself as well as against the
	// service. A port named twice in one reconcile — which happens as soon as
	// an application and a managed database it depends on are reconciled
	// together — produced two --publish-add flags in a single update, and
	// Docker rejected the whole thing with "port is already allocated".
	restored := map[uint16]bool{}
	for _, restoredPort := range input.RestorePublishedPorts {
		if restored[restoredPort.PublishedPort] || publishedPortExists(current, restoredPort) {
			continue
		}
		restored[restoredPort.PublishedPort] = true
		args = append(args, "--publish-add", formatPublishedPort(restoredPort))
	}
	for _, remove := range input.RemoveNetworks {
		args = append(args, "--network-rm", remove)
	}
	args = append(args, input.ServiceID)
	_, err = runRoutingDocker(ctx, nil, args...)
	return err
}

func formatPublishedPort(candidate agentcontrol.RoutingPublishedPort) string {
	return "published=" + strconv.FormatUint(uint64(candidate.PublishedPort), 10) + ",target=" + strconv.FormatUint(uint64(candidate.TargetPort), 10) + ",protocol=" + strings.ToLower(candidate.Protocol) + ",mode=ingress"
}

func publishedPortExists(service inspectedService, candidate agentcontrol.RoutingPublishedPort) bool {
	for _, port := range service.Spec.EndpointSpec.Ports {
		if port.PublishedPort == 0 {
			continue
		}
		if strings.EqualFold(port.Protocol, candidate.Protocol) &&
			uint16(port.PublishedPort) == candidate.PublishedPort &&
			uint16(port.TargetPort) == candidate.TargetPort {
			return true
		}
	}
	return false
}

func reconcileTypedBinding(ctx context.Context, input agentcontrol.RoutingBindingRequest) error {
	network, err := ensureEncryptedRoutingNetwork(ctx, input.Network)
	if err != nil {
		return err
	}
	if err := ensureServiceNetwork(ctx, input.CallerServiceID, network, ""); err != nil {
		return err
	}
	if err := ensureServiceNetwork(ctx, input.TraefikServiceID, network, input.Alias); err != nil {
		return err
	}
	switch input.Delivery {
	case "existing":
		return nil
	case "environment":
		_, err = runRoutingDocker(ctx, nil, "service", "update", "--env-add", input.Name+"="+input.Endpoint, input.CallerServiceID)
		return err
	case "secret_file":
		if _, inspectErr := runRoutingDocker(ctx, nil, "secret", "inspect", input.SecretName); inspectErr != nil {
			if _, err := runRoutingDocker(ctx, strings.NewReader(input.Endpoint), "secret", "create", input.SecretName, "-"); err != nil {
				return err
			}
		}
		target := strings.ToLower(input.Name)
		fileName := input.Name
		if !strings.HasSuffix(fileName, "_FILE") {
			fileName += "_FILE"
		}
		_, err = runRoutingDocker(ctx, nil, "service", "update",
			"--secret-add", "source="+input.SecretName+",target="+target+",mode=0444",
			"--env-add", fileName+"=/run/secrets/"+target,
			input.CallerServiceID,
		)
		return err
	default:
		return fmt.Errorf("unsupported dependency binding")
	}
}

func ensureEncryptedRoutingNetwork(ctx context.Context, name string) (inspectedNetwork, error) {
	// A miss here is the normal path for a route that has not been created yet,
	// so it is probed quietly; only a failure to CREATE the network is an error
	// worth reporting.
	output, err := runRoutingDockerQuiet(ctx, nil, "network", "inspect", name)
	if err != nil {
		if _, createErr := runRoutingDocker(ctx, nil, "network", "create", "--driver", "overlay", "--opt", "encrypted", name); createErr != nil {
			return inspectedNetwork{}, createErr
		}
		output, err = runRoutingDocker(ctx, nil, "network", "inspect", name)
		if err != nil {
			return inspectedNetwork{}, err
		}
	}
	var networks []inspectedNetwork
	if err := json.Unmarshal([]byte(output), &networks); err != nil || len(networks) != 1 {
		// The bounded error deliberately says nothing about the host. Record
		// what Docker actually returned here so an unparseable inspect is
		// diagnosable instead of being an unexplained routing failure.
		slog.Error("routing network inspect was not a single JSON network",
			"network", name, "matches", len(networks), "output", truncateForLog(output, 512), "error", err)
		return inspectedNetwork{}, fmt.Errorf("inspect routing network")
	}
	network := networks[0]
	_, encrypted := network.Options["encrypted"]
	if network.Name != name || network.Driver != "overlay" || network.Scope != "swarm" || !encrypted || network.ID == "" {
		return inspectedNetwork{}, fmt.Errorf("routing network is not an encrypted Swarm overlay")
	}
	return network, nil
}

// sortedUniqueStrings returns the distinct values in a stable order so a
// service update is deterministic and never re-applies the same attachment.
func sortedUniqueStrings(values []string) []string {
	seen := map[string]bool{}
	result := make([]string, 0, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" || seen[value] {
			continue
		}
		seen[value] = true
		result = append(result, value)
	}
	sort.Strings(result)
	return result
}

func ensureServiceNetwork(ctx context.Context, serviceID string, network inspectedNetwork, alias string) error {
	service, err := inspectRoutingService(ctx, serviceID)
	if err != nil {
		return err
	}
	for _, attachment := range service.Spec.TaskTemplate.Networks {
		if attachment.Target != network.ID {
			continue
		}
		if alias == "" || containsString(attachment.Aliases, alias) {
			return nil
		}
		// Docker cannot add an alias to an existing service network in place.
		// Replacing just this attachment is bounded and preserves every other
		// network; the controller surfaces the resulting singleton risk.
		//
		// The replacement must carry the aliases the attachment ALREADY has.
		// Dropping them made each dependency binding erase the previous one, so
		// a caller with more than one dependency could only ever reach the last
		// one applied — Prometheus lost its Alertmanager alias the moment the
		// Traefik metrics alias was bound, and that target went down.
		aliases := append(append([]string{}, attachment.Aliases...), alias)
		value := "name=" + network.Name
		for _, name := range sortedUniqueStrings(aliases) {
			value += ",alias=" + name
		}
		_, err = runRoutingDocker(ctx, nil, "service", "update", "--network-rm", network.Name, "--network-add", value, serviceID)
		return err
	}
	value := network.Name
	if alias != "" {
		value = "name=" + network.Name + ",alias=" + alias
	}
	_, err = runRoutingDocker(ctx, nil, "service", "update", "--network-add", value, serviceID)
	return err
}

func inspectRoutingService(ctx context.Context, serviceID string) (inspectedService, error) {
	output, err := runRoutingDocker(ctx, nil, "service", "inspect", serviceID)
	if err != nil {
		return inspectedService{}, err
	}
	var services []inspectedService
	if err := json.Unmarshal([]byte(output), &services); err != nil || len(services) != 1 {
		return inspectedService{}, fmt.Errorf("inspect routing service")
	}
	if services[0].Spec.Labels == nil {
		services[0].Spec.Labels = map[string]string{}
	}
	return services[0], nil
}

func ownedRoutingLabels(labels map[string]string, routeKey string) ([]string, error) {
	owner := labels["swarmops.routing.route"]
	if owner != "" && owner != routeKey {
		return nil, fmt.Errorf("service is already owned by another SwarmOps route")
	}
	if owner == "" {
		for key := range labels {
			if strings.HasPrefix(key, "traefik.") {
				return nil, fmt.Errorf("service has unmanaged Traefik labels and must be explicitly adopted")
			}
		}
		return nil, nil
	}
	marker := labels["swarmops.routing.labels"]
	if marker == "" {
		return nil, fmt.Errorf("owned route label manifest is missing")
	}
	keys := strings.Split(marker, ",")
	seen := map[string]bool{}
	for _, key := range keys {
		if !safeOwnedRoutingLabel(key, routeKey) || seen[key] {
			return nil, fmt.Errorf("owned route label manifest is invalid")
		}
		seen[key] = true
	}
	keys = append(keys, "swarmops.routing.labels")
	sort.Strings(keys)
	return keys, nil
}

func safeOwnedRoutingLabel(key, routeKey string) bool {
	if key == "traefik.enable" || key == "traefik.swarm.network" || key == "swarmops.routing.route" || key == "swarmops.routing.version" {
		return true
	}
	for _, protocol := range []string{"http", "tcp", "udp"} {
		for _, resource := range []string{"routers", "services"} {
			if strings.HasPrefix(key, "traefik."+protocol+"."+resource+"."+routeKey+"-") {
				return true
			}
		}
	}
	return false
}

func serviceHasNetwork(service inspectedService, networkID string) bool {
	for _, network := range service.Spec.TaskTemplate.Networks {
		if network.Target == networkID {
			return true
		}
	}
	return false
}

func containsString(values []string, expected string) bool {
	for _, value := range values {
		if value == expected {
			return true
		}
	}
	return false
}

// truncateForLog bounds diagnostic output so a large or hostile command result
// cannot flood the machine journal.
func truncateForLog(value string, limit int) string {
	value = strings.TrimSpace(value)
	if len(value) <= limit {
		return value
	}
	return value[:limit] + "…"
}

// runRoutingDockerQuiet is runRoutingDocker for probes whose failure is an
// expected outcome rather than a fault.
func runRoutingDockerQuiet(ctx context.Context, input io.Reader, args ...string) (string, error) {
	return routingDocker(ctx, false, input, args...)
}

func runRoutingDocker(ctx context.Context, input io.Reader, args ...string) (string, error) {
	return routingDocker(ctx, true, input, args...)
}

// routingDocker keeps stdout and stderr apart. The Docker CLI writes warnings
// to stderr — for example when the agent's ProtectHome sandbox makes
// /root/.docker/config.json unreadable — and folding those into stdout put a
// "WARNING: ..." line in front of every JSON document the routing code parses,
// so each of these operations failed on a healthy host. Diagnostics still get
// both streams; only the returned value is stdout.
func routingDocker(ctx context.Context, report bool, input io.Reader, args ...string) (string, error) {
	ctx, cancel := context.WithTimeout(ctx, commandTimeout)
	defer cancel()
	stdout := &limitedBuffer{limit: commandOutputLimit}
	stderr := &limitedBuffer{limit: commandOutputLimit}
	command := exec.CommandContext(ctx, "docker", args...)
	command.Stdin = input
	command.Stdout = stdout
	command.Stderr = stderr
	if err := command.Run(); err != nil || stdout.err != nil || stderr.err != nil {
		if report {
			slog.Error("fixed routing operation failed",
				"operation", strings.Join(args, " "),
				"stderr", truncateForLog(stderr.String(), 512),
				"error", err)
		}
		return "", fmt.Errorf("run fixed routing operation")
	}
	return stdout.String(), nil
}

// traefikAPIBaseURL resolves the Traefik API endpoint for THIS agent. The
// configured default names the Swarm service (traefik_traefik), which only
// resolves from inside the overlay network — that is, only when the agent is
// itself a container on that network. A host-native agent, which is the
// documented production model, cannot resolve it at all, so every Traefik
// runtime read failed with "no such host" and observability could never be
// confirmed. When the configured host does not resolve, fall back to the
// address of the Traefik task running on this machine.
func (s *Server) traefikAPIBaseURL(ctx context.Context) string {
	configured := strings.TrimSuffix(strings.TrimSpace(s.config.TraefikAPIBaseURL), "/")
	parsed, err := url.Parse(configured)
	if err != nil || parsed.Hostname() == "" {
		return configured
	}
	if _, err := net.DefaultResolver.LookupHost(ctx, parsed.Hostname()); err == nil {
		return configured
	}
	address := localTraefikAddress(ctx)
	if address == "" {
		return configured
	}
	port := parsed.Port()
	if port == "" {
		port = "8080"
	}
	parsed.Host = net.JoinHostPort(address, port)
	return strings.TrimSuffix(parsed.String(), "/")
}

// localTraefikAddress returns the container IP of the Traefik task running on
// this machine, or "" when none is present.
func localTraefikAddress(ctx context.Context) string {
	containers, err := runRoutingDocker(ctx, nil, "ps", "--filter", "label=com.docker.swarm.service.name=traefik_traefik", "--format", "{{.ID}}")
	if err != nil {
		return ""
	}
	for _, id := range strings.Fields(containers) {
		output, err := runRoutingDocker(ctx, nil, "inspect", "--format", "{{range .NetworkSettings.Networks}}{{.IPAddress}} {{end}}", id)
		if err != nil {
			continue
		}
		for _, candidate := range strings.Fields(output) {
			if parsed, err := netip.ParseAddr(candidate); err == nil && parsed.IsValid() && !parsed.IsUnspecified() {
				return candidate
			}
		}
	}
	return ""
}

func (s *Server) traefikRuntime(response http.ResponseWriter, request *http.Request) {
	if !s.authorized(request) {
		http.Error(response, "unauthorized", http.StatusUnauthorized)
		return
	}
	client := s.internalHTTPClient()
	snapshot := agentcontrol.TraefikRuntimeSnapshot{ObservedAt: time.Now().UTC(), Version: agentcontrol.RoutingVersion}
	for _, protocol := range []string{"http", "tcp", "udp"} {
		var routes []struct {
			Error       []string `json:"error"`
			EntryPoints []string `json:"entryPoints"`
			Name        string   `json:"name"`
			Provider    string   `json:"provider"`
			Service     string   `json:"service"`
			Status      string   `json:"status"`
			Using       []string `json:"using"`
		}
		if err := fixedInternalJSON(request.Context(), client, s.traefikAPIBaseURL(request.Context())+"/"+protocol+"/routers", &routes); err != nil {
			failGateway(response, "Traefik runtime unavailable", err)
			return
		}
		for _, route := range routes {
			if !strings.Contains(route.Name, "@swarm") && route.Provider != "swarm" {
				continue
			}
			errors := make([]string, 0, len(route.Error))
			for _, value := range route.Error {
				errors = append(errors, sanitizeAdapterText(value, 256))
			}
			entrypoints := route.EntryPoints
			if len(entrypoints) == 0 {
				entrypoints = route.Using
			}
			snapshot.Routes = append(snapshot.Routes, agentcontrol.RuntimeRoute{
				Errors: errors, EntryPoints: append([]string(nil), entrypoints...), Name: sanitizeAdapterText(route.Name, 128), Protocol: protocol,
				Provider: "swarm", Service: sanitizeAdapterText(route.Service, 128), Status: sanitizeAdapterText(route.Status, 32),
			})
		}
	}
	sort.Slice(snapshot.Routes, func(i, j int) bool { return snapshot.Routes[i].Name < snapshot.Routes[j].Name })
	writeJSON(response, snapshot)
}

func (s *Server) traefikLogs(response http.ResponseWriter, request *http.Request) {
	if !s.authorized(request) {
		http.Error(response, "unauthorized", http.StatusUnauthorized)
		return
	}
	var query agentcontrol.TraefikLogQuery
	if !decodeRoutingRequest(response, request, &query) {
		return
	}
	if err := query.Validate(time.Now().UTC()); err != nil {
		http.Error(response, "invalid Traefik log query", http.StatusBadRequest)
		return
	}
	entries, err := s.queryTraefikLogs(request.Context(), query)
	if err != nil {
		failGateway(response, "Traefik logs unavailable", err)
		return
	}
	writeJSON(response, entries)
}

func (s *Server) queryTraefikLogs(ctx context.Context, query agentcontrol.TraefikLogQuery) ([]agentcontrol.TraefikLogEntry, error) {
	search := query.RequestID
	if search == "" {
		search = query.Router
	}
	page, err := s.queryLogs(ctx, agentcontrol.LogQuery{From: query.From, To: query.To, Level: strings.ToLower(query.Level), SourceKind: "traefik", Service: query.Service, Search: search, Limit: query.Limit})
	if err != nil {
		return nil, err
	}
	entries := make([]agentcontrol.TraefikLogEntry, 0, len(page.Records))
	for _, record := range page.Records {
		entries = append(entries, agentcontrol.TraefikLogEntry{Timestamp: record.Timestamp, Level: record.Level, Message: record.Message, Service: record.Service})
	}
	return entries, nil
}

func (s *Server) logsQuery(response http.ResponseWriter, request *http.Request) {
	if !s.authorized(request) {
		http.Error(response, "unauthorized", http.StatusUnauthorized)
		return
	}
	var query agentcontrol.LogQuery
	if !decodeRoutingRequest(response, request, &query) {
		return
	}
	if err := query.Normalize(time.Now()); err != nil {
		http.Error(response, "invalid log query", http.StatusBadRequest)
		return
	}
	page, err := s.queryLogs(request.Context(), query)
	if err != nil {
		http.Error(response, "log collection unavailable", http.StatusServiceUnavailable)
		return
	}
	writeJSON(response, page)
}

func (s *Server) logsStatus(response http.ResponseWriter, request *http.Request) {
	if !s.authorized(request) {
		http.Error(response, "unauthorized", http.StatusUnauthorized)
		return
	}
	var status agentcontrol.LogStatus
	endpoint := strings.TrimSuffix(s.config.LogsBaseURL, "/") + "/v1/status"
	if err := fixedInternalJSON(request.Context(), s.internalHTTPClient(), endpoint, &status); err != nil {
		http.Error(response, "log collection unavailable", http.StatusServiceUnavailable)
		return
	}
	writeJSON(response, status)
}

func (s *Server) queryLogs(ctx context.Context, query agentcontrol.LogQuery) (agentcontrol.LogPage, error) {
	var page agentcontrol.LogPage
	endpoint := strings.TrimSuffix(s.config.LogsBaseURL, "/") + "/v1/query"
	if err := fixedInternalPostJSON(ctx, s.internalHTTPClient(), endpoint, query, &page); err != nil {
		return page, fmt.Errorf("query fixed Fluentd adapter: %w", err)
	}
	return page, nil
}

func sanitizeTraefikLogLine(line string) agentcontrol.TraefikLogEntry {
	var raw map[string]any
	_ = json.Unmarshal([]byte(line), &raw)
	entry := agentcontrol.TraefikLogEntry{
		Level:     sanitizeAdapterText(firstString(raw, "level", "Level"), 16),
		Message:   sanitizeAdapterText(firstString(raw, "msg", "message"), 512),
		Method:    sanitizeAdapterText(firstString(raw, "RequestMethod", "method"), 16),
		RequestID: sanitizeAdapterText(firstString(raw, "request_id", "RequestID"), 128),
		Router:    sanitizeAdapterText(firstString(raw, "RouterName", "router"), 128),
		Service:   sanitizeAdapterText(firstString(raw, "ServiceName", "service"), 128),
		Client:    sanitizeAdapterText(firstString(raw, "ClientHost", "client"), 128),
	}
	entry.StatusCode, _ = strconv.Atoi(firstString(raw, "DownstreamStatus", "status"))
	if entry.Level == "" {
		entry.Level = "INFO"
	}
	if entry.Message == "" {
		entry.Message = "Traefik request"
	}
	return entry
}

func (s *Server) traefikPrometheus(response http.ResponseWriter, request *http.Request) {
	if !s.authorized(request) {
		http.Error(response, "unauthorized", http.StatusUnauthorized)
		return
	}
	var payload struct {
		Data struct {
			ActiveTargets []struct {
				DiscoveredLabels map[string]string `json:"discoveredLabels"`
				Health           string            `json:"health"`
				Labels           map[string]string `json:"labels"`
				LastError        string            `json:"lastError"`
				LastScrape       time.Time         `json:"lastScrape"`
			} `json:"activeTargets"`
		} `json:"data"`
		Status string `json:"status"`
	}
	endpoint := strings.TrimSuffix(s.config.PrometheusBaseURL, "/") + "/api/v1/targets?state=active"
	if err := fixedInternalJSON(request.Context(), s.internalHTTPClient(), endpoint, &payload); err != nil || payload.Status != "success" {
		http.Error(response, "Prometheus target status unavailable", http.StatusBadGateway)
		return
	}
	snapshot := agentcontrol.PrometheusSnapshot{ObservedAt: time.Now().UTC(), Targets: []agentcontrol.PrometheusTarget{}}
	for _, target := range payload.Data.ActiveTargets {
		job := target.Labels["job"]
		if job == "" {
			job = target.DiscoveredLabels["job"]
		}
		if !strings.Contains(strings.ToLower(job), "traefik") {
			continue
		}
		labels := []string{}
		for _, key := range []string{"entrypoint", "router", "service"} {
			if value := target.Labels[key]; value != "" {
				labels = append(labels, key+"="+sanitizeAdapterText(value, 96))
			}
		}
		snapshot.Targets = append(snapshot.Targets, agentcontrol.PrometheusTarget{Error: sanitizeAdapterText(target.LastError, 256), Health: sanitizeAdapterText(target.Health, 32), Labels: labels, LastScrape: target.LastScrape, Target: "traefik"})
	}
	writeJSON(response, snapshot)
}

func (s *Server) internalHTTPClient() *http.Client {
	if s.config.InternalHTTP != nil {
		return s.config.InternalHTTP
	}
	return &http.Client{Timeout: 5 * time.Second}
}

func fixedInternalJSON(ctx context.Context, client *http.Client, endpoint string, output any) error {
	parsed, err := url.Parse(endpoint)
	if err != nil || parsed.Scheme != "http" || parsed.Host == "" {
		return fmt.Errorf("invalid fixed internal endpoint")
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, parsed.String(), nil)
	if err != nil {
		return err
	}
	response, err := client.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return fmt.Errorf("fixed internal endpoint failed")
	}
	decoder := json.NewDecoder(io.LimitReader(response.Body, 2<<20))
	return decoder.Decode(output)
}

func fixedInternalPostJSON(ctx context.Context, client *http.Client, endpoint string, input, output any) error {
	parsed, err := url.Parse(endpoint)
	if err != nil || parsed.Scheme != "http" || parsed.Host == "" {
		return fmt.Errorf("invalid fixed internal endpoint")
	}
	body, err := json.Marshal(input)
	if err != nil {
		return err
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, parsed.String(), strings.NewReader(string(body)))
	if err != nil {
		return err
	}
	request.Header.Set("Content-Type", "application/json")
	response, err := client.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return fmt.Errorf("fixed internal endpoint failed")
	}
	return json.NewDecoder(io.LimitReader(response.Body, 2<<20)).Decode(output)
}

func sanitizeAdapterText(value string, limit int) string {
	value = strings.Map(func(r rune) rune {
		if r == '\r' || r == '\n' || r == 0 {
			return ' '
		}
		return r
	}, value)
	value = strings.TrimSpace(value)
	if len(value) > limit {
		value = value[:limit]
	}
	return value
}

func firstString(values map[string]any, keys ...string) string {
	for _, key := range keys {
		switch value := values[key].(type) {
		case string:
			if value != "" {
				return value
			}
		case float64:
			return strconv.FormatFloat(value, 'f', -1, 64)
		}
	}
	return ""
}
