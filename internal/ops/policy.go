package ops

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"regexp"
	"sort"
	"strings"

	"github.com/nimasrn/SwarmOps/internal/domain"
	"gopkg.in/yaml.v3"
)

const maxComposeBytes = 512 << 10

var (
	composeNamePattern = regexp.MustCompile(`^[a-z][a-z0-9-]{0,62}$`)
	secretLikeKey      = regexp.MustCompile(`(?i)(password|secret|token|credential|api[_-]?key|private[_-]?key)`)
)

// ValidateCompose rejects input that cannot safely become a Swarm stack in
// this monorepo. The policy deliberately favors image-only, resource-bounded
// services behind Traefik over accepting every Compose feature from the web.
func ValidateCompose(raw []byte) (domain.ComposePlan, error) {
	if len(raw) == 0 {
		return domain.ComposePlan{}, fmt.Errorf("compose content is required")
	}
	if len(raw) > maxComposeBytes {
		return domain.ComposePlan{}, fmt.Errorf("compose content exceeds %d KiB", maxComposeBytes>>10)
	}
	var root map[string]any
	if err := yaml.Unmarshal(raw, &root); err != nil {
		return domain.ComposePlan{}, fmt.Errorf("parse compose YAML: %w", err)
	}
	services, ok := asMap(root["services"])
	if !ok || len(services) == 0 {
		return domain.ComposePlan{}, fmt.Errorf("compose must declare at least one service")
	}
	if len(services) > 50 {
		return domain.ComposePlan{}, fmt.Errorf("compose declares more than 50 services")
	}
	for _, kind := range []string{"secrets", "configs"} {
		if err := validateTopLevelExternalResources(root, kind); err != nil {
			return domain.ComposePlan{}, err
		}
	}
	if err := validateTopLevelVolumes(root); err != nil {
		return domain.ComposePlan{}, err
	}
	if err := validateTopLevelNetworks(root); err != nil {
		return domain.ComposePlan{}, err
	}

	plan := domain.ComposePlan{Digest: digest(raw)}
	for name, rawService := range services {
		if !composeNamePattern.MatchString(name) {
			return domain.ComposePlan{}, fmt.Errorf("service %q has an invalid name", name)
		}
		service, ok := asMap(rawService)
		if !ok {
			return domain.ComposePlan{}, fmt.Errorf("service %q must be an object", name)
		}
		image, ok := service["image"].(string)
		if !ok || strings.TrimSpace(image) == "" {
			return domain.ComposePlan{}, fmt.Errorf("service %q must use an image", name)
		}
		if err := validateImage(image); err != nil {
			return domain.ComposePlan{}, fmt.Errorf("service %q: %w", name, err)
		}
		if _, hasBuild := service["build"]; hasBuild {
			return domain.ComposePlan{}, fmt.Errorf("service %q uses build; build and publish an immutable image before deployment", name)
		}
		if boolValue(service["privileged"]) || hostValue(service["pid"]) || hostValue(service["network_mode"]) || hostValue(service["ipc"]) {
			return domain.ComposePlan{}, fmt.Errorf("service %q requests a host-level privilege", name)
		}
		if hasNonEmpty(service, "devices") || hasNonEmpty(service, "cap_add") || hasNonEmpty(service, "device_cgroup_rules") || hasNonEmpty(service, "security_opt") {
			return domain.ComposePlan{}, fmt.Errorf("service %q requests restricted Linux capabilities or devices", name)
		}
		if _, hasRuntime := service["runtime"]; hasRuntime {
			return domain.ComposePlan{}, fmt.Errorf("service %q selects a custom runtime", name)
		}
		if hasNonEmpty(service, "ports") {
			return domain.ComposePlan{}, fmt.Errorf("service %q publishes a port; route web traffic through Traefik", name)
		}
		if err := validateVolumes(name, service["volumes"]); err != nil {
			return domain.ComposePlan{}, err
		}
		if err := validateEnvironment(name, service["environment"]); err != nil {
			return domain.ComposePlan{}, err
		}
		if err := validateServiceResources(name, "secrets", service["secrets"]); err != nil {
			return domain.ComposePlan{}, err
		}
		if err := validateServiceResources(name, "configs", service["configs"]); err != nil {
			return domain.ComposePlan{}, err
		}
		if err := validateResources(name, service["deploy"]); err != nil {
			return domain.ComposePlan{}, err
		}
		plan.Services = append(plan.Services, name)
	}
	sort.Strings(plan.Services)
	if _, ok := root["version"]; !ok {
		plan.Warnings = append(plan.Warnings, "Docker stack deploy uses the legacy Compose v3 format; include an explicit version: '3.9' before promotion.")
	}
	return plan, nil
}

func ValidStackName(name string) bool { return composeNamePattern.MatchString(name) }

// PinComposeToNode makes an explicit operator choice visible in the effective
// Compose file. It refuses to overwrite a pre-existing node.id constraint,
// rather than quietly deploying somewhere other than the author specified.
func PinComposeToNode(raw []byte, nodeID string) ([]byte, error) {
	if strings.TrimSpace(nodeID) == "" {
		return raw, nil
	}
	if _, err := serviceReference(nodeID); err != nil {
		return nil, err
	}
	var root map[string]any
	if err := yaml.Unmarshal(raw, &root); err != nil {
		return nil, fmt.Errorf("parse compose YAML: %w", err)
	}
	services, ok := asMap(root["services"])
	if !ok || len(services) == 0 {
		return nil, fmt.Errorf("compose must declare at least one service")
	}
	for name, rawService := range services {
		service, ok := asMap(rawService)
		if !ok {
			return nil, fmt.Errorf("service %q must be an object", name)
		}
		deploy := ensureMap(service, "deploy")
		placement := ensureMap(deploy, "placement")
		constraints, err := constraintsList(placement["constraints"])
		if err != nil {
			return nil, fmt.Errorf("service %q placement constraints: %w", name, err)
		}
		for _, constraint := range constraints {
			compact := strings.ToLower(strings.ReplaceAll(constraint, " ", ""))
			if strings.HasPrefix(compact, "node.id==") {
				return nil, fmt.Errorf("service %q already has a node.id constraint", name)
			}
		}
		constraints = append(constraints, "node.id == "+nodeID)
		placement["constraints"] = stringsToAny(constraints)
	}
	effective, err := yaml.Marshal(root)
	if err != nil {
		return nil, fmt.Errorf("serialize node-targeted compose: %w", err)
	}
	return effective, nil
}

func digest(value []byte) string {
	sum := sha256.Sum256(value)
	return "sha256:" + hex.EncodeToString(sum[:])
}

func asMap(value any) (map[string]any, bool) {
	mapValue, ok := value.(map[string]any)
	return mapValue, ok
}

func ensureMap(parent map[string]any, key string) map[string]any {
	if existing, ok := asMap(parent[key]); ok {
		return existing
	}
	created := map[string]any{}
	parent[key] = created
	return created
}

func constraintsList(value any) ([]string, error) {
	if value == nil {
		return nil, nil
	}
	list, ok := value.([]any)
	if !ok {
		return nil, fmt.Errorf("must be a list")
	}
	constraints := make([]string, 0, len(list))
	for _, raw := range list {
		constraint, ok := raw.(string)
		if !ok || strings.TrimSpace(constraint) == "" {
			return nil, fmt.Errorf("must contain only non-empty strings")
		}
		constraints = append(constraints, constraint)
	}
	return constraints, nil
}

func stringsToAny(values []string) []any {
	result := make([]any, len(values))
	for index, value := range values {
		result[index] = value
	}
	return result
}

func boolValue(value any) bool {
	parsed, _ := value.(bool)
	return parsed
}

func hostValue(value any) bool {
	text, _ := value.(string)
	return strings.EqualFold(strings.TrimSpace(text), "host")
}

func hasNonEmpty(service map[string]any, field string) bool {
	value, found := service[field]
	if !found || value == nil {
		return false
	}
	if list, ok := value.([]any); ok {
		return len(list) > 0
	}
	if mapValue, ok := asMap(value); ok {
		return len(mapValue) > 0
	}
	return true
}

func validateVolumes(service string, value any) error {
	if value == nil {
		return nil
	}
	list, ok := value.([]any)
	if !ok {
		return fmt.Errorf("service %q volumes must be a list", service)
	}
	for _, item := range list {
		switch volume := item.(type) {
		case string:
			source := strings.SplitN(volume, ":", 2)[0]
			if strings.HasPrefix(source, "/") || strings.HasPrefix(source, ".") || strings.HasPrefix(source, "~") {
				return fmt.Errorf("service %q uses a host bind mount", service)
			}
		case map[string]any:
			kind := strings.ToLower(strings.TrimSpace(fmt.Sprint(volume["type"])))
			if kind == "bind" || kind == "npipe" || kind == "image" || kind == "cluster" {
				return fmt.Errorf("service %q uses a host bind mount", service)
			}
			if kind == "" || kind == "volume" {
				source, ok := volume["source"].(string)
				if !ok || strings.TrimSpace(source) == "" || strings.HasPrefix(source, "/") || strings.HasPrefix(source, ".") || strings.HasPrefix(source, "~") {
					return fmt.Errorf("service %q uses an invalid named volume", service)
				}
			}
			if kind != "" && kind != "volume" && kind != "tmpfs" {
				return fmt.Errorf("service %q uses an unsupported mount type", service)
			}
		default:
			return fmt.Errorf("service %q has an invalid volume", service)
		}
	}
	return nil
}

// validateTopLevelVolumes prevents a Compose author from hiding a host bind
// behind a named-volume driver option. Managed local volumes and operator-owned
// external volumes are safe; custom drivers/options belong in reviewed Git.
func validateTopLevelVolumes(root map[string]any) error {
	value, found := root["volumes"]
	if !found || value == nil {
		return nil
	}
	volumes, ok := asMap(value)
	if !ok {
		return fmt.Errorf("top-level volumes must be a map")
	}
	for name, rawVolume := range volumes {
		volume, ok := asMap(rawVolume)
		if !ok {
			return fmt.Errorf("top-level volume %q must be an object", name)
		}
		if _, hasOptions := volume["driver_opts"]; hasOptions {
			return fmt.Errorf("top-level volume %q uses driver_opts; use a reviewed Git manifest for custom storage", name)
		}
		external, hasExternal := volume["external"]
		if hasExternal {
			if !boolValue(external) {
				return fmt.Errorf("top-level volume %q must use external: true when external is set", name)
			}
			if _, hasDriver := volume["driver"]; hasDriver {
				return fmt.Errorf("top-level external volume %q must not set a driver", name)
			}
			continue
		}
		if driver, hasDriver := volume["driver"]; hasDriver && !strings.EqualFold(strings.TrimSpace(fmt.Sprint(driver)), "local") {
			return fmt.Errorf("top-level volume %q uses a custom driver; use a reviewed Git manifest for custom storage", name)
		}
	}
	return nil
}

// validateTopLevelNetworks applies the same boundary to network drivers. A
// stack may use Swarm's managed overlay or an operator-created external
// network, but it cannot create host/macvlan/custom-driver networks from the
// browser.
func validateTopLevelNetworks(root map[string]any) error {
	value, found := root["networks"]
	if !found || value == nil {
		return nil
	}
	networks, ok := asMap(value)
	if !ok {
		return fmt.Errorf("top-level networks must be a map")
	}
	for name, rawNetwork := range networks {
		network, ok := asMap(rawNetwork)
		if !ok {
			return fmt.Errorf("top-level network %q must be an object", name)
		}
		if _, hasOptions := network["driver_opts"]; hasOptions {
			return fmt.Errorf("top-level network %q uses driver_opts; use a reviewed Git manifest for custom networking", name)
		}
		external, hasExternal := network["external"]
		if hasExternal {
			if !boolValue(external) {
				return fmt.Errorf("top-level network %q must use external: true when external is set", name)
			}
			if _, hasDriver := network["driver"]; hasDriver {
				return fmt.Errorf("top-level external network %q must not set a driver", name)
			}
			continue
		}
		if driver, hasDriver := network["driver"]; hasDriver && !strings.EqualFold(strings.TrimSpace(fmt.Sprint(driver)), "overlay") {
			return fmt.Errorf("top-level network %q uses a non-overlay driver; use a reviewed Git manifest for custom networking", name)
		}
	}
	return nil
}

func validateImage(value string) error {
	image := strings.TrimSpace(value)
	if strings.ContainsAny(image, " \t\r\n") {
		return fmt.Errorf("image reference is invalid")
	}
	if strings.Contains(image, "@sha256:") {
		return nil
	}
	lastSlash := strings.LastIndex(image, "/")
	lastColon := strings.LastIndex(image, ":")
	if lastColon <= lastSlash || lastColon == len(image)-1 {
		return fmt.Errorf("image must use a non-latest tag or digest")
	}
	if strings.EqualFold(image[lastColon+1:], "latest") {
		return fmt.Errorf("image must not use the latest tag")
	}
	return nil
}

func validateEnvironment(service string, value any) error {
	if value == nil {
		return nil
	}
	keys := make([]string, 0)
	switch environment := value.(type) {
	case map[string]any:
		for key := range environment {
			keys = append(keys, key)
		}
	case []any:
		for _, item := range environment {
			text, ok := item.(string)
			if !ok {
				return fmt.Errorf("service %q has a non-string environment value", service)
			}
			keys = append(keys, strings.SplitN(text, "=", 2)[0])
		}
	default:
		return fmt.Errorf("service %q environment must be a map or list", service)
	}
	for _, key := range keys {
		if secretLikeKey.MatchString(key) {
			return fmt.Errorf("service %q supplies secret-like environment variable %q; use an external Swarm secret", service, key)
		}
	}
	return nil
}

func validateTopLevelExternalResources(root map[string]any, kind string) error {
	value, found := root[kind]
	if !found || value == nil {
		return nil
	}
	resources, ok := asMap(value)
	if !ok {
		return fmt.Errorf("top-level %s must be a map", kind)
	}
	for name, rawResource := range resources {
		resource, ok := asMap(rawResource)
		if !ok {
			return fmt.Errorf("top-level %s.%s must be an object with external: true", kind, name)
		}
		if !boolValue(resource["external"]) {
			return fmt.Errorf("top-level %s.%s must use external: true", kind, name)
		}
	}
	return nil
}

func validateServiceResources(service, kind string, value any) error {
	if value == nil {
		return nil
	}
	list, ok := value.([]any)
	if !ok {
		return fmt.Errorf("service %q %s must be a list", service, kind)
	}
	for _, item := range list {
		switch resource := item.(type) {
		case string:
			if strings.TrimSpace(resource) == "" {
				return fmt.Errorf("service %q %s includes an empty reference", service, kind)
			}
		case map[string]any:
			source, ok := resource["source"].(string)
			if !ok || strings.TrimSpace(source) == "" || resource["file"] != nil {
				return fmt.Errorf("service %q %s must reference a top-level external resource", service, kind)
			}
		default:
			return fmt.Errorf("service %q %s must reference a top-level external resource", service, kind)
		}
	}
	return nil
}

func validateResources(service string, value any) error {
	deploy, ok := asMap(value)
	if !ok {
		return fmt.Errorf("service %q must declare deploy resources", service)
	}
	resources, ok := asMap(deploy["resources"])
	if !ok {
		return fmt.Errorf("service %q must declare deploy.resources", service)
	}
	for _, level := range []string{"limits", "reservations"} {
		values, ok := asMap(resources[level])
		if !ok {
			return fmt.Errorf("service %q must declare deploy.resources.%s", service, level)
		}
		for _, required := range []string{"cpus", "memory"} {
			text, ok := values[required].(string)
			if !ok || strings.TrimSpace(text) == "" {
				return fmt.Errorf("service %q must declare %s %s", service, level, required)
			}
		}
	}
	return nil
}
