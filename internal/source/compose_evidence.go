package source

import (
	"regexp"
	"sort"
	"strconv"
	"strings"
)

// Everything in this file reads Compose values the scanner previously threw
// away. It reads them for one reason at a time and keeps only what an
// operator has to review before a deployment: the hostname a route serves,
// the variable NAME an application reads its database URI from, the port a
// Traefik label already names.
//
// The rule that source values are not retained still holds for anything that
// can carry a credential. Environment values are classified and discarded —
// only the key name survives — and no label, argument, command, or file
// content reaches the plan.

var (
	traefikHostRule    = regexp.MustCompile("(?i)Host\\(([^)]*)\\)")
	traefikPathRule    = regexp.MustCompile("(?i)PathPrefix\\(([^)]*)\\)")
	traefikQuoted      = regexp.MustCompile("[`\"']([^`\"']+)[`\"']")
	traefikRouterRule  = regexp.MustCompile(`^traefik\.(http|tcp)\.routers\.([^.]+)\.(.+)$`)
	traefikServicePort = regexp.MustCompile(`^traefik\.(http|tcp)\.services\.([^.]+)\.loadbalancer\.server\.port$`)
	memoryValue        = regexp.MustCompile(`^([0-9]+(?:\.[0-9]+)?)\s*([kmgKMG]?)[bB]?$`)
)

// composeRoute is the public entry a Compose file already describes through
// its Traefik labels. SwarmOps proposes the same route rather than asking the
// operator to retype a hostname their repository already carries.
type composeRoute struct {
	disabled   bool
	found      bool
	hosts      []string
	pathPrefix string
	port       uint16
	resolver   string
	tls        bool
}

// traefikRouteFromLabels reads the Traefik router a service declares. When a
// service declares several, the TLS router wins, because that is the one an
// operator means by "the route".
func traefikRouteFromLabels(labels map[string]string) (composeRoute, []Finding) {
	result := composeRoute{}
	var findings []Finding
	if enabled, ok := labels["traefik.enable"]; ok && strings.EqualFold(strings.TrimSpace(enabled), "false") {
		result.disabled = true
	}
	type router struct {
		entryPoints string
		hosts       []string
		name        string
		pathPrefix  string
		resolver    string
		tls         bool
	}
	routers := map[string]*router{}
	get := func(name string) *router {
		if existing, found := routers[name]; found {
			return existing
		}
		created := &router{name: name}
		routers[name] = created
		return created
	}
	keys := make([]string, 0, len(labels))
	for key := range labels {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	for _, key := range keys {
		value := strings.TrimSpace(labels[key])
		if match := traefikRouterRule.FindStringSubmatch(key); len(match) == 4 {
			current := get(match[2])
			switch strings.ToLower(match[3]) {
			case "rule":
				current.hosts = append(current.hosts, ruleHosts(value)...)
				current.pathPrefix = rulePathPrefix(value)
				if strings.Contains(strings.ToLower(value), "hostregexp") {
					findings = append(findings, Finding{Code: "route_host_regexp", Level: FindingWarning, Message: "A Traefik HostRegexp rule cannot be imported; name the hostnames this application serves instead."})
				}
			case "tls":
				current.tls = !strings.EqualFold(value, "false")
			case "tls.certresolver":
				current.resolver = value
				current.tls = true
			case "entrypoints":
				current.entryPoints = strings.ToLower(value)
			}
			continue
		}
		if match := traefikServicePort.FindStringSubmatch(key); len(match) == 3 {
			if parsed, err := strconv.ParseUint(value, 10, 16); err == nil && parsed > 0 {
				result.port = uint16(parsed)
			}
		}
	}
	names := make([]string, 0, len(routers))
	for name := range routers {
		names = append(names, name)
	}
	sort.Strings(names)
	var chosen *router
	for _, name := range names {
		candidate := routers[name]
		if len(candidate.hosts) == 0 {
			continue
		}
		secure := candidate.tls || strings.Contains(candidate.entryPoints, "secure") || strings.Contains(candidate.entryPoints, "443")
		if chosen == nil || (secure && !(chosen.tls || strings.Contains(chosen.entryPoints, "secure"))) {
			chosen = candidate
		}
	}
	if chosen == nil {
		return result, findings
	}
	result.found = true
	result.hosts = sortedUnique(chosen.hosts)
	result.pathPrefix = chosen.pathPrefix
	result.resolver = chosen.resolver
	result.tls = chosen.tls || strings.Contains(chosen.entryPoints, "secure") || strings.Contains(chosen.entryPoints, "443")
	return result, findings
}

func ruleHosts(rule string) []string {
	var result []string
	for _, group := range traefikHostRule.FindAllStringSubmatch(rule, -1) {
		for _, quoted := range traefikQuoted.FindAllStringSubmatch(group[1], -1) {
			host := strings.ToLower(strings.TrimSuffix(strings.TrimSpace(quoted[1]), "."))
			if applicationHostPattern.MatchString(host) {
				result = append(result, host)
			}
		}
	}
	return result
}

func rulePathPrefix(rule string) string {
	for _, group := range traefikPathRule.FindAllStringSubmatch(rule, -1) {
		for _, quoted := range traefikQuoted.FindAllStringSubmatch(group[1], -1) {
			prefix := strings.TrimSpace(quoted[1])
			if strings.HasPrefix(prefix, "/") && httpPathPattern.MatchString(prefix) {
				return prefix
			}
		}
	}
	return ""
}

// prometheusFromLabels reads the de facto scrape annotations. A repository
// that already carries them has told SwarmOps its metrics port and path.
func prometheusFromLabels(labels map[string]string) (scrape bool, port uint16, metricsPath string) {
	for key, value := range labels {
		lowered := strings.ToLower(strings.TrimSpace(key))
		value = strings.TrimSpace(value)
		switch {
		case strings.HasSuffix(lowered, "prometheus.io/scrape"):
			scrape = !strings.EqualFold(value, "false")
		case strings.HasSuffix(lowered, "prometheus.io/port"):
			if parsed, err := strconv.ParseUint(value, 10, 16); err == nil && parsed > 0 {
				port = uint16(parsed)
			}
		case strings.HasSuffix(lowered, "prometheus.io/path"):
			if strings.HasPrefix(value, "/") && httpPathPattern.MatchString(value) {
				metricsPath = value
			}
		}
	}
	return scrape, port, metricsPath
}

// databaseEnvironment classifies which managed engine each environment key
// refers to. It reads the value only to recognize a connection scheme and
// discards it immediately: the returned map holds key names and engines, and
// the caller never receives the value.
func databaseEnvironment(environment map[string]string) map[string][]string {
	result := map[string][]string{}
	ambiguous := []string{}
	for key, value := range environment {
		engine := databaseEngineFromURI(value)
		if engine == "" {
			engine = databaseEngineFromKey(key)
		}
		switch engine {
		case "":
			continue
		case "ambiguous":
			ambiguous = append(ambiguous, key)
		default:
			result[engine] = append(result[engine], key)
		}
	}
	// A bare DATABASE_URL only names an engine when exactly one SQL engine is
	// already evident. Guessing between Postgres and Mongo would wire an
	// application to the wrong database, which is the failure this whole path
	// exists to prevent.
	if len(ambiguous) > 0 && len(result[DatabasePostgres]) > 0 && len(result[DatabaseMongo]) == 0 {
		result[DatabasePostgres] = append(result[DatabasePostgres], ambiguous...)
	}
	for engine := range result {
		result[engine] = sortedUnique(result[engine])
	}
	return result
}

// databaseEngineFromURI recognizes a connection scheme. The value is examined
// here and nowhere else, and nothing derived from it but the engine escapes.
func databaseEngineFromURI(value string) string {
	scheme, _, found := strings.Cut(strings.TrimSpace(value), "://")
	if !found {
		return ""
	}
	switch strings.ToLower(scheme) {
	case "postgres", "postgresql", "psql":
		return DatabasePostgres
	case "mongodb", "mongodb+srv", "mongo":
		return DatabaseMongo
	case "redis", "rediss":
		return DatabaseRedis
	default:
		return ""
	}
}

func databaseEngineFromKey(key string) string {
	upper := strings.ToUpper(strings.TrimSpace(key))
	switch {
	case strings.Contains(upper, "MONGO"):
		return DatabaseMongo
	case strings.Contains(upper, "REDIS"), strings.Contains(upper, "VALKEY"):
		return DatabaseRedis
	case strings.Contains(upper, "POSTGRES"), strings.Contains(upper, "PSQL"), strings.HasPrefix(upper, "PG"):
		return DatabasePostgres
	case upper == "DATABASE_URL", upper == "DATABASE_URI", upper == "DB_URL", upper == "DB_URI", upper == "DB_DSN":
		return "ambiguous"
	default:
		return ""
	}
}

// composeResources reads the replica count and resource ceiling a Compose file
// already states, so an operator does not have to restate them. Values outside
// the application policy are clamped by ApplicationSpec validation rather than
// silently accepted here.
func composeResources(deploy map[string]any) (replicas uint64, cpus float64, memoryMiB int64) {
	if deploy == nil {
		return 0, 0, 0
	}
	switch value := deploy["replicas"].(type) {
	case int:
		if value > 0 {
			replicas = uint64(value)
		}
	case string:
		if parsed, err := strconv.ParseUint(strings.TrimSpace(value), 10, 32); err == nil {
			replicas = parsed
		}
	}
	resources, _ := deploy["resources"].(map[string]any)
	limits, _ := resources["limits"].(map[string]any)
	if limits == nil {
		return replicas, 0, 0
	}
	switch value := limits["cpus"].(type) {
	case string:
		if parsed, err := strconv.ParseFloat(strings.TrimSpace(value), 64); err == nil {
			cpus = parsed
		}
	case float64:
		cpus = value
	case int:
		cpus = float64(value)
	}
	if memory, ok := limits["memory"].(string); ok {
		memoryMiB = parseMemoryMiB(memory)
	}
	return replicas, cpus, memoryMiB
}

func parseMemoryMiB(value string) int64 {
	match := memoryValue.FindStringSubmatch(strings.TrimSpace(value))
	if len(match) != 3 {
		return 0
	}
	amount, err := strconv.ParseFloat(match[1], 64)
	if err != nil || amount <= 0 {
		return 0
	}
	switch strings.ToLower(match[2]) {
	case "g":
		return int64(amount * 1024)
	case "m":
		return int64(amount)
	case "k":
		return int64(amount / 1024)
	default:
		return int64(amount / (1024 * 1024))
	}
}

// environmentPairs reads the two Compose environment shapes into key/value
// form. Callers classify the value and discard it; nothing here is retained.
func environmentPairs(value any) map[string]string {
	result := map[string]string{}
	switch typed := value.(type) {
	case []any:
		for _, item := range typed {
			text, ok := item.(string)
			if !ok {
				continue
			}
			key, item, _ := strings.Cut(text, "=")
			if key = strings.TrimSpace(key); key != "" {
				result[key] = strings.TrimSpace(item)
			}
		}
	case map[string]any:
		for key, item := range typed {
			if key = strings.TrimSpace(key); key != "" {
				result[key] = strings.TrimSpace(scalarString(item))
			}
		}
	}
	return result
}

func scalarString(value any) string {
	switch typed := value.(type) {
	case string:
		return typed
	case int:
		return strconv.Itoa(typed)
	case bool:
		return strconv.FormatBool(typed)
	case float64:
		return strconv.FormatFloat(typed, 'f', -1, 64)
	default:
		return ""
	}
}

func mapKeys(values map[string]string) []string {
	result := make([]string, 0, len(values))
	for key := range values {
		result = append(result, key)
	}
	sort.Strings(result)
	return result
}

func hasListEntries(value any) bool {
	switch typed := value.(type) {
	case []any:
		return len(typed) > 0
	case map[string]any:
		return len(typed) > 0
	case string:
		return strings.TrimSpace(typed) != ""
	default:
		return false
	}
}
