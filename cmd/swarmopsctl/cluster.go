package main

import (
	"fmt"
	"os"
	"strings"

	"github.com/nimasrn/SwarmOps/internal/cli"
	"github.com/nimasrn/SwarmOps/internal/ops"
)

func clusterCommands() []command {
	return []command{
		{Group: groupCluster, Name: "node", Summary: "Read and adjust Swarm nodes", Run: runNode, Usage: "node list|show <id>|tasks <id>|label <id> key=value|availability <id> <active|pause|drain>|role <id> <promote|demote>|remove <id>"},
		{Group: groupCluster, Name: "service", Summary: "Read and adjust Swarm services", Run: runService, Usage: "service list|show <id>|logs <id>|image <id> <ref>|remove <id>"},
		{Group: groupCluster, Name: "stack", Summary: "Read, validate, and deploy Compose stacks", Run: runStack, Usage: "stack list|validate <name> <file.yml>|deploy <name> <file.yml>|remove <name>"},
		{Group: groupCluster, Name: "network", Summary: "Read and manage overlay networks", Run: runNetwork, Usage: "network list|create <name> [--attachable] [--driver overlay]|remove <name>"},
		{Group: groupCluster, Name: "image", Summary: "Read, pull, and remove images", Run: runImage, Usage: "image list|pull <ref>|remove <ref>"},
		{Group: groupCluster, Name: "container", Summary: "Read containers and act on one", Run: runContainer, Usage: "container list|show <id>|stats <id>"},
		{Group: groupCluster, Name: "prune", Summary: "Reclaim space", Run: runPrune, Usage: "prune containers|images|networks|volumes|build-cache [--all]"},
		{Group: groupCluster, Name: "core", Summary: "Read the controller's own state", Run: runCore, Usage: "core status|self|console|registry-mirror"},
		{Group: groupCluster, Name: "metrics", Summary: "Read metric series", Run: runMetrics, Usage: "metrics series|range --query <promql>"},
		{Group: groupCluster, Name: "insights", Summary: "Read the controller's findings", Run: runInsights, Usage: "insights [--history]"},
		{Group: groupCluster, Name: "audit", Summary: "Read the audit ledger", Run: runAudit, Usage: "audit [--limit n]"},
		{Group: groupCluster, Name: "events", Summary: "Read cluster events", Run: runEvents, Usage: "events"},
		{Group: groupCluster, Name: "diagnose", Summary: "Explain why a service is unhealthy", Run: runDiagnose, Usage: "diagnose <service-id>|rules"},
		{Group: groupCluster, Name: "logs-status", Summary: "Report whether log collection is healthy", Run: runLogsStatus, Usage: "logs-status"},
	}
}

func runNode(arguments []string) error {
	if len(arguments) == 0 {
		return errUsage
	}
	switch arguments[0] {
	case "list":
		return listTable("/api/v1/nodes", arguments[1:], []column{
			{Header: "ID", Keys: []string{"ID", "id"}},
			{Header: "HOSTNAME", Keys: []string{"Hostname", "hostname"}},
			{Header: "ROLE", Keys: []string{"Role", "role"}},
			{Header: "AVAILABILITY", Keys: []string{"Availability", "availability"}},
			{Header: "STATE", Keys: []string{"State", "state", "Status"}},
		}, "No node is in this Swarm.")
	case "show":
		if len(arguments) < 2 {
			return errUsage
		}
		return showDocument("/api/v1/nodes/"+arguments[1], arguments[2:])
	case "tasks":
		if len(arguments) < 2 {
			return errUsage
		}
		return showDocument("/api/v1/nodes/"+arguments[1]+"/tasks", arguments[2:])
	case "availability", "role":
		if len(arguments) < 3 {
			return errUsage
		}
		return mutateNode(arguments[0], arguments[1], arguments[2], arguments[3:])
	case "label":
		if len(arguments) < 3 {
			return errUsage
		}
		key, value, _ := strings.Cut(arguments[2], "=")
		var opts options
		flags := newFlagSet("node label", &opts)
		if err := flags.Parse(arguments[3:]); err != nil {
			return err
		}
		client, err := opts.connect()
		if err != nil {
			return err
		}
		ctx, cancel := timeoutContext(followTimeout)
		defer cancel()
		return submitAndFollow(ctx, client, "/api/v1/nodes/"+arguments[1]+"/labels", "node", map[string]string{"key": key, "value": value}, false)
	case "remove":
		if len(arguments) < 2 {
			return errUsage
		}
		var opts options
		flags := newFlagSet("node", &opts)
		confirm := flags.Bool("yes", false, "skip the interactive confirmation")
		if err := flags.Parse(arguments[2:]); err != nil {
			return err
		}
		if err := requireConfirmation(*confirm, fmt.Sprintf("Remove node %s from the Swarm?", arguments[1])); err != nil {
			return err
		}
		client, err := opts.connect()
		if err != nil {
			return err
		}
		ctx, cancel := timeoutContext(followTimeout)
		defer cancel()
		body := map[string]string{"confirmation": ops.ResourceRemovalConfirmation("NODE", arguments[1])}
		return submitAndFollow(ctx, client, "/api/v1/nodes/"+arguments[1]+"/remove", "node", body, false)
	default:
		return errUsage
	}
}

func mutateNode(action, id, value string, arguments []string) error {
	var opts options
	flags := newFlagSet("node "+action, &opts)
	if err := flags.Parse(arguments); err != nil {
		return err
	}
	client, err := opts.connect()
	if err != nil {
		return err
	}
	ctx, cancel := timeoutContext(followTimeout)
	defer cancel()
	body := map[string]string{action: value}
	return submitAndFollow(ctx, client, "/api/v1/nodes/"+id+"/"+action, "node", body, false)
}

func runService(arguments []string) error {
	if len(arguments) == 0 {
		return errUsage
	}
	switch arguments[0] {
	case "list":
		return listTable("/api/v1/services", arguments[1:], []column{
			{Header: "ID", Keys: []string{"id", "ID"}},
			{Header: "NAME", Keys: []string{"name", "Name"}},
			{Header: "IMAGE", Keys: []string{"image", "Image"}},
			{Header: "DESIRED", Keys: []string{"desiredTasks"}},
			{Header: "RUNNING", Keys: []string{"runningTasks"}},
			{Header: "HEALTH", Keys: []string{"health"}},
		}, "No service is running.")
	case "show":
		if len(arguments) < 2 {
			return errUsage
		}
		return showDocument("/api/v1/services/"+arguments[1], arguments[2:])
	case "logs":
		if len(arguments) < 2 {
			return errUsage
		}
		return showDocument("/api/v1/services/"+arguments[1]+"/logs", arguments[2:])
	case "image":
		if len(arguments) < 3 {
			return errUsage
		}
		var opts options
		flags := newFlagSet("service image", &opts)
		if err := flags.Parse(arguments[3:]); err != nil {
			return err
		}
		client, err := opts.connect()
		if err != nil {
			return err
		}
		ctx, cancel := timeoutContext(followTimeout)
		defer cancel()
		return submitAndFollow(ctx, client, "/api/v1/services/"+arguments[1]+"/image", "service", map[string]string{"image": arguments[2]}, false)
	case "remove":
		if len(arguments) < 2 {
			return errUsage
		}
		var opts options
		flags := newFlagSet("service remove", &opts)
		confirm := flags.Bool("yes", false, "skip the interactive confirmation")
		if err := flags.Parse(arguments[2:]); err != nil {
			return err
		}
		if err := requireConfirmation(*confirm, fmt.Sprintf("Remove service %s?", arguments[1])); err != nil {
			return err
		}
		client, err := opts.connect()
		if err != nil {
			return err
		}
		ctx, cancel := timeoutContext(followTimeout)
		defer cancel()
		body := map[string]string{"confirmation": ops.ResourceRemovalConfirmation("SERVICE", arguments[1])}
		return submitAndFollow(ctx, client, "/api/v1/services/"+arguments[1]+"/remove", "service", body, false)
	default:
		return errUsage
	}
}

func runStack(arguments []string) error {
	if len(arguments) == 0 {
		return errUsage
	}
	switch arguments[0] {
	case "list":
		return listTable("/api/v1/stacks", arguments[1:], []column{
			{Header: "NAME", Keys: []string{"name"}},
			{Header: "SERVICES", Keys: []string{"serviceCount", "services"}},
		}, "No stack is deployed.")
	case "validate", "deploy":
		return applyStack(arguments)
	case "remove":
		if len(arguments) < 2 {
			return errUsage
		}
		var opts options
		flags := newFlagSet("stack remove", &opts)
		confirm := flags.Bool("yes", false, "skip the interactive confirmation")
		if err := flags.Parse(arguments[2:]); err != nil {
			return err
		}
		if err := requireConfirmation(*confirm, fmt.Sprintf("Remove stack %s and every service in it?", arguments[1])); err != nil {
			return err
		}
		client, err := opts.connect()
		if err != nil {
			return err
		}
		ctx, cancel := timeoutContext(followTimeout)
		defer cancel()
		body := map[string]string{"confirmation": ops.ResourceRemovalConfirmation("STACK", arguments[1])}
		return submitAndFollow(ctx, client, "/api/v1/stacks/"+arguments[1]+"/remove", "stack", body, false)
	default:
		return errUsage
	}
}

func applyStack(arguments []string) error {
	validate := arguments[0] == "validate"
	var opts options
	flags := newFlagSet("stack", &opts)
	rest, err := parseAfterPositionals(flags, arguments[1:])
	if err != nil {
		return err
	}
	if len(rest) != 2 {
		return errUsage
	}
	name, path := rest[0], rest[1]
	content, err := os.ReadFile(path)
	if err != nil {
		return fmt.Errorf("read %s: %w", path, err)
	}
	client, err := opts.connect()
	if err != nil {
		return err
	}
	ctx, cancel := timeoutContext(followTimeout)
	defer cancel()
	if validate {
		var report any
		if err := client.Post(ctx, "/api/v1/stacks/validate", map[string]string{"compose": string(content), "name": name}, &report); err != nil {
			return err
		}
		return cli.WriteJSON(os.Stdout, report)
	}
	body := map[string]string{"compose": string(content), "name": name}
	return submitAndFollow(ctx, client, "/api/v1/stacks/deploy", "stack", body, false)
}

func runNetwork(arguments []string) error {
	if len(arguments) == 0 {
		return errUsage
	}
	switch arguments[0] {
	case "list":
		return listTable("/api/v1/networks", arguments[1:], []column{
			{Header: "NAME", Keys: []string{"Name", "name"}},
			{Header: "DRIVER", Keys: []string{"Driver", "driver"}},
			{Header: "SCOPE", Keys: []string{"Scope", "scope"}},
		}, "No network exists on this machine.")
	case "create", "remove":
		if len(arguments) < 2 {
			return errUsage
		}
		var opts options
		flags := newFlagSet("network", &opts)
		attachable := flags.Bool("attachable", false, "let standalone containers attach")
		driver := flags.String("driver", "overlay", "network driver")
		internal := flags.Bool("internal", false, "isolate the network from external traffic")
		confirm := flags.Bool("yes", false, "skip the interactive confirmation")
		if err := flags.Parse(arguments[2:]); err != nil {
			return err
		}
		client, err := opts.connect()
		if err != nil {
			return err
		}
		ctx, cancel := timeoutContext(followTimeout)
		defer cancel()
		if arguments[0] == "create" {
			body := map[string]any{"attachable": *attachable, "driver": *driver, "internal": *internal, "name": arguments[1]}
			return submitAndFollow(ctx, client, "/api/v1/networks", "network", body, false)
		}
		if err := requireConfirmation(*confirm, fmt.Sprintf("Remove network %s?", arguments[1])); err != nil {
			return err
		}
		body := map[string]string{"confirmation": ops.ResourceRemovalConfirmation("NETWORK", arguments[1])}
		return submitAndFollow(ctx, client, "/api/v1/networks/"+arguments[1]+"/remove", "network", body, false)
	default:
		return errUsage
	}
}

func runImage(arguments []string) error {
	if len(arguments) == 0 {
		return errUsage
	}
	switch arguments[0] {
	case "list":
		return listTable("/api/v1/images", arguments[1:], []column{
			{Header: "ID", Keys: []string{"Id", "id"}},
			{Header: "TAGS", Keys: []string{"RepoTags", "repoTags"}},
			{Header: "SIZE", Keys: []string{"Size", "size"}},
		}, "No image is stored on this machine.")
	case "pull", "remove":
		if len(arguments) < 2 {
			return errUsage
		}
		var opts options
		flags := newFlagSet("image", &opts)
		confirm := flags.Bool("yes", false, "skip the interactive confirmation")
		if err := flags.Parse(arguments[2:]); err != nil {
			return err
		}
		client, err := opts.connect()
		if err != nil {
			return err
		}
		ctx, cancel := timeoutContext(followTimeout)
		defer cancel()
		if arguments[0] == "pull" {
			return submitAndFollow(ctx, client, "/api/v1/images/pull", "image", map[string]string{"image": arguments[1]}, false)
		}
		if err := requireConfirmation(*confirm, fmt.Sprintf("Remove image %s?", arguments[1])); err != nil {
			return err
		}
		return submitAndFollow(ctx, client, "/api/v1/images/remove", "image", map[string]string{"image": arguments[1]}, false)
	default:
		return errUsage
	}
}

func runContainer(arguments []string) error {
	if len(arguments) == 0 {
		return errUsage
	}
	switch arguments[0] {
	case "list":
		return listTable("/api/v1/containers", arguments[1:], []column{
			{Header: "ID", Keys: []string{"Id", "id"}},
			{Header: "IMAGE", Keys: []string{"Image", "image"}},
			{Header: "STATE", Keys: []string{"State", "state", "Status"}},
		}, "No container is running on this machine.")
	case "show":
		if len(arguments) < 2 {
			return errUsage
		}
		return showDocument("/api/v1/containers/"+arguments[1], arguments[2:])
	case "stats":
		if len(arguments) < 2 {
			return errUsage
		}
		return showDocument("/api/v1/containers/"+arguments[1]+"/stats", arguments[2:])
	default:
		return errUsage
	}
}

func runPrune(arguments []string) error {
	if len(arguments) == 0 {
		return errUsage
	}
	resource := arguments[0]
	var opts options
	flags := newFlagSet("prune", &opts)
	all := flags.Bool("all", false, "prune everything unused, not only dangling")
	confirm := flags.Bool("yes", false, "skip the interactive confirmation")
	if err := flags.Parse(arguments[1:]); err != nil {
		return err
	}
	if err := requireConfirmation(*confirm, fmt.Sprintf("Prune %s on the selected machine?", resource)); err != nil {
		return err
	}
	client, err := opts.connect()
	if err != nil {
		return err
	}
	ctx, cancel := timeoutContext(followTimeout)
	defer cancel()
	body := map[string]any{"all": *all, "confirmation": ops.PruneConfirmation(resource)}
	return submitAndFollow(ctx, client, "/api/v1/prune/"+resource, "prune", body, false)
}

func runCore(arguments []string) error {
	if len(arguments) == 0 {
		return errUsage
	}
	switch arguments[0] {
	case "status":
		return showDocument("/api/v1/core", arguments[1:])
	case "self":
		return showDocument("/api/v1/core/self", arguments[1:])
	case "console":
		return showDocument("/api/v1/core/console", arguments[1:])
	case "registry-mirror":
		return showDocument("/api/v1/core/registry-mirror", arguments[1:])
	default:
		return errUsage
	}
}

func runMetrics(arguments []string) error {
	if len(arguments) == 0 {
		return errUsage
	}
	var opts options
	flags := newFlagSet("metrics", &opts)
	query := flags.String("query", "", "PromQL expression")
	if err := flags.Parse(arguments[1:]); err != nil {
		return err
	}
	switch arguments[0] {
	case "series":
		return showDocument("/api/v1/metrics/series?query="+urlQueryEscape(*query), nil)
	case "range":
		if strings.TrimSpace(*query) == "" {
			return errUsage
		}
		return showDocument("/api/v1/metrics/range?query="+urlQueryEscape(*query), nil)
	default:
		return errUsage
	}
}

func runInsights(arguments []string) error {
	var opts options
	flags := newFlagSet("insights", &opts)
	history := flags.Bool("history", false, "read the recorded history instead of the current findings")
	if err := flags.Parse(arguments); err != nil {
		return err
	}
	if *history {
		return showDocument("/api/v1/insights/history", nil)
	}
	return showDocument("/api/v1/insights", nil)
}

func runAudit(arguments []string) error {
	var opts options
	flags := newFlagSet("audit", &opts)
	limit := flags.Int("limit", 50, "how many events to read")
	if err := flags.Parse(arguments); err != nil {
		return err
	}
	return listTable(fmt.Sprintf("/api/v1/audit-events?limit=%d", *limit), nil, []column{
		{Header: "AT", Keys: []string{"at", "occurredAt", "timestamp"}},
		{Header: "ACTOR", Keys: []string{"actor"}},
		{Header: "ACTION", Keys: []string{"action"}},
		{Header: "TARGET", Keys: []string{"target"}},
		{Header: "OUTCOME", Keys: []string{"outcome", "error"}},
	}, "The audit ledger is empty.")
}

func runEvents(arguments []string) error {
	return showDocument("/api/v1/events", arguments)
}

func runDiagnose(arguments []string) error {
	if len(arguments) == 0 {
		return errUsage
	}
	if arguments[0] == "rules" {
		return showDocument("/api/v1/diagnosis/rules", arguments[1:])
	}
	return showDocument("/api/v1/services/"+arguments[0]+"/diagnosis", arguments[1:])
}

func runLogsStatus(arguments []string) error {
	return showDocument("/api/v1/logs/status", arguments)
}
