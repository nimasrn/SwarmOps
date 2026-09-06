package main

import (
	"context"
	"fmt"
	"os"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/nimasrn/SwarmOps/internal/cli"
	"github.com/nimasrn/SwarmOps/internal/domain"
	"github.com/nimasrn/SwarmOps/internal/ops"
)

func runInit(arguments []string) error {
	var opts options
	flags := newFlagSet("init", &opts)
	name := flags.String("name", "", "application name")
	port := flags.Uint("port", 0, "port the application listens on")
	plan := flags.String("plan", "", "size to deploy at")
	domainName := flags.String("domain", "", "public hostname")
	from := flags.String("from", "", "seed from an application already deployed")
	force := flags.Bool("force", false, "replace an existing swarmops.json")
	if err := flags.Parse(arguments); err != nil {
		return err
	}
	directory, err := os.Getwd()
	if err != nil {
		return err
	}
	manifest := cli.Manifest{Name: *name}
	if *from != "" {
		client, err := opts.connect()
		if err != nil {
			return err
		}
		ctx, cancel := timeoutContext(requestTimeout)
		defer cancel()
		status, err := findApplication(ctx, client, *from)
		if err != nil {
			return err
		}
		manifest = cli.ManifestFromSpec(status.Spec)
	}
	if *name != "" {
		manifest.Name = *name
	}
	if manifest.Name == "" {
		// The directory name is what the operator would have typed anyway, and
		// it keeps `init` from being a form to fill in.
		manifest.Name = strings.ToLower(sanitizeName(directory))
	}
	if *port != 0 {
		manifest.Port = uint16(*port)
	}
	if *plan != "" {
		manifest.Plan = *plan
	}
	if *domainName != "" {
		manifest.Domain = *domainName
	}
	if manifest.Plan == "" {
		manifest.Plan = ops.DefaultResourcePlan
	}
	if err := manifest.Save(directory, *force); err != nil {
		return err
	}
	fmt.Printf("Wrote %s.\n", cli.ManifestPath(directory))
	if manifest.Port == 0 {
		fmt.Println("Set \"port\" to the port your application listens on, then run `swarmops deploy`.")
	} else {
		fmt.Println("Run `swarmops deploy` when you are ready.")
	}
	return nil
}

// sanitizeName turns a directory path into a name the controller accepts:
// lowercase, leading letter, letters digits and dashes only.
func sanitizeName(path string) string {
	base := path
	if index := strings.LastIndexAny(path, "/\\"); index >= 0 {
		base = path[index+1:]
	}
	var builder strings.Builder
	for _, character := range strings.ToLower(base) {
		switch {
		case character >= 'a' && character <= 'z', character >= '0' && character <= '9':
			builder.WriteRune(character)
		case character == '-' || character == '_' || character == ' ' || character == '.':
			builder.WriteRune('-')
		}
	}
	name := strings.Trim(builder.String(), "-")
	if name == "" || name[0] < 'a' || name[0] > 'z' {
		name = "app-" + name
	}
	if len(name) > 41 {
		name = strings.TrimRight(name[:41], "-")
	}
	return name
}

func runPlans(arguments []string) error {
	var opts options
	flags := newFlagSet("plans", &opts)
	if err := flags.Parse(arguments); err != nil {
		return err
	}
	client, err := opts.connect()
	if err != nil {
		return err
	}
	ctx, cancel := timeoutContext(requestTimeout)
	defer cancel()
	var catalogue struct {
		Default string             `json:"default"`
		Plans   []ops.ResourcePlan `json:"plans"`
	}
	if err := client.Get(ctx, "/api/v1/applications/plans", &catalogue); err != nil {
		return err
	}
	if opts.json {
		return cli.WriteJSON(os.Stdout, catalogue)
	}
	table := cli.Table{Header: []string{"PLAN", "CPU", "MEMORY", "FOR"}}
	for _, plan := range catalogue.Plans {
		name := plan.Name
		if name == catalogue.Default {
			name += " (default)"
		}
		table.Add(name, strconv.FormatFloat(plan.CPUCores, 'g', -1, 64), fmt.Sprintf("%d MiB", plan.MemoryMiB), plan.Summary)
	}
	return table.Write(os.Stdout, "The controller offered no plans.")
}

func runPlan(arguments []string) error {
	var opts options
	flags := newFlagSet("plan", &opts)
	if err := flags.Parse(arguments); err != nil {
		return err
	}
	client, err := opts.connect()
	if err != nil {
		return err
	}
	directory, err := os.Getwd()
	if err != nil {
		return err
	}
	manifest, err := cli.LoadManifest(directory)
	if err != nil {
		return err
	}
	ctx, cancel := timeoutContext(requestTimeout)
	defer cancel()
	var rendered struct {
		Compose string `json:"compose"`
	}
	if err := client.Post(ctx, "/api/v1/applications/plan", manifest.Spec(), &rendered); err != nil {
		return err
	}
	if opts.json {
		return cli.WriteJSON(os.Stdout, rendered)
	}
	fmt.Print(rendered.Compose)
	return nil
}

func runApp(arguments []string) error {
	if len(arguments) == 0 {
		return errUsage
	}
	action := arguments[0]
	var opts options
	flags := newFlagSet("app", &opts)
	confirm := flags.Bool("yes", false, "skip the interactive confirmation")
	resolver := flags.String("resolver", "", "certificate resolver for a new domain")
	rest, err := parseAfterPositionals(flags, arguments[1:])
	if err != nil {
		return err
	}
	client, err := opts.connect()
	if err != nil {
		return err
	}
	ctx, cancel := timeoutContext(followTimeout)
	defer cancel()
	switch action {
	case "list":
		statuses, err := listApplications(ctx, client)
		if err != nil {
			return err
		}
		if opts.json {
			return cli.WriteJSON(os.Stdout, statuses)
		}
		table := cli.Table{Header: []string{"NAME", "STATE", "TASKS", "PLAN", "IMAGE", "URL"}}
		for _, status := range statuses {
			state := "not deployed"
			if status.Deployed {
				state = "running"
			}
			table.Add(status.Spec.Name, state, strconv.FormatUint(status.RunningTasks, 10),
				cli.Dash(status.Spec.Plan), cli.Dash(status.Spec.Image), cli.Dash(status.URL))
		}
		return table.Write(os.Stdout, "No application has been deployed yet. Run `swarmops init` then `swarmops deploy`.")
	case "show":
		if len(rest) != 1 {
			return errUsage
		}
		status, err := findApplication(ctx, client, rest[0])
		if err != nil {
			return err
		}
		if opts.json {
			return cli.WriteJSON(os.Stdout, status)
		}
		return printApplication(status)
	case "domain":
		if len(rest) < 1 || len(rest) > 2 {
			return errUsage
		}
		name := rest[0]
		host := ""
		if len(rest) == 2 {
			host = rest[1]
		}
		body := map[string]string{"domain": host, "resolver": *resolver}
		if host == "" {
			if err := requireConfirmation(*confirm, fmt.Sprintf("Remove the public domain from %s?", name)); err != nil {
				return err
			}
			body["confirmation"] = ops.ApplicationDomainRemovalConfirmation(name)
		}
		return submitAndFollow(ctx, client, "/api/v1/applications/"+name+"/domain", "domain", body, false)
	case "scale":
		if len(rest) != 2 {
			return errUsage
		}
		replicas, err := strconv.ParseUint(rest[1], 10, 64)
		if err != nil {
			return fmt.Errorf("replica count %q must be a whole number", rest[1])
		}
		status, err := findApplication(ctx, client, rest[0])
		if err != nil {
			return err
		}
		body := map[string]any{"action": "scale", "replicas": replicas}
		return submitAndFollow(ctx, client, "/api/v1/services/"+status.Service+"/actions", "scale", body, false)
	case "remove":
		if len(rest) != 1 {
			return errUsage
		}
		if err := requireConfirmation(*confirm, fmt.Sprintf("Remove application %s and its stack?", rest[0])); err != nil {
			return err
		}
		body := map[string]string{"confirmation": ops.ApplicationRemovalConfirmation(rest[0])}
		return submitAndFollow(ctx, client, "/api/v1/applications/"+rest[0]+"/remove", "remove", body, false)
	default:
		return errUsage
	}
}

func printApplication(status ops.ApplicationStatus) error {
	facts := cli.Table{}
	state := "not deployed"
	if status.Deployed {
		state = fmt.Sprintf("running (%d task(s))", status.RunningTasks)
	}
	facts.Add("name", status.Spec.Name)
	facts.Add("state", state)
	facts.Add("image", cli.Dash(status.Spec.Image))
	facts.Add("plan", cli.Dash(status.Spec.Plan))
	facts.Add("size", fmt.Sprintf("%g vCPU, %d MiB", status.Spec.CPUs, status.Spec.MemoryMiB))
	facts.Add("replicas", strconv.FormatUint(status.Spec.Replicas, 10))
	facts.Add("port", strconv.FormatUint(uint64(status.Spec.Port), 10))
	facts.Add("health", cli.Dash(status.Spec.HealthPath))
	facts.Add("url", cli.Dash(status.URL))
	facts.Add("stack", status.Stack)
	facts.Add("service", status.Service)
	if len(status.Spec.Databases) > 0 {
		facts.Add("databases", strings.Join(status.Spec.Databases, ", "))
	}
	if len(status.Spec.Env) > 0 {
		keys := make([]string, 0, len(status.Spec.Env))
		for key := range status.Spec.Env {
			keys = append(keys, key)
		}
		sort.Strings(keys)
		facts.Add("env", strings.Join(keys, ", "))
	}
	return facts.Write(os.Stdout, "")
}

func listApplications(ctx context.Context, client *cli.Client) ([]ops.ApplicationStatus, error) {
	var statuses []ops.ApplicationStatus
	if err := client.Get(ctx, "/api/v1/applications", &statuses); err != nil {
		return nil, err
	}
	sort.Slice(statuses, func(left, right int) bool { return statuses[left].Spec.Name < statuses[right].Spec.Name })
	return statuses, nil
}

func findApplication(ctx context.Context, client *cli.Client, name string) (ops.ApplicationStatus, error) {
	statuses, err := listApplications(ctx, client)
	if err != nil {
		return ops.ApplicationStatus{}, err
	}
	for _, status := range statuses {
		if status.Spec.Name == name {
			return status, nil
		}
	}
	return ops.ApplicationStatus{}, fmt.Errorf("application %q is not deployed on this controller", name)
}

// applicationName resolves which application a command acts on: an explicit
// flag, else the manifest in the working directory.
func applicationName(explicit string) (string, error) {
	if strings.TrimSpace(explicit) != "" {
		return explicit, nil
	}
	directory, err := os.Getwd()
	if err != nil {
		return "", err
	}
	manifest, err := cli.LoadManifest(directory)
	if err != nil {
		return "", fmt.Errorf("%w; or name one with --app", err)
	}
	return manifest.Name, nil
}

func runEnv(arguments []string) error {
	if len(arguments) == 0 {
		return errUsage
	}
	action := arguments[0]
	var opts options
	flags := newFlagSet("env", &opts)
	app := flags.String("app", "", "application to act on")
	rest, err := parseAfterPositionals(flags, arguments[1:])
	if err != nil {
		return err
	}
	client, err := opts.connect()
	if err != nil {
		return err
	}
	ctx, cancel := timeoutContext(followTimeout)
	defer cancel()
	name, err := applicationName(*app)
	if err != nil {
		return err
	}
	status, err := findApplication(ctx, client, name)
	if err != nil {
		return err
	}
	switch action {
	case "list":
		if opts.json {
			return cli.WriteJSON(os.Stdout, status.Spec.Env)
		}
		table := cli.Table{Header: []string{"KEY", "VALUE"}}
		keys := make([]string, 0, len(status.Spec.Env))
		for key := range status.Spec.Env {
			keys = append(keys, key)
		}
		sort.Strings(keys)
		for _, key := range keys {
			table.Add(key, status.Spec.Env[key])
		}
		return table.Write(os.Stdout, "This application declares no environment variables.")
	case "set", "unset":
		if len(rest) == 0 {
			return errUsage
		}
		// The environment lives in the application spec, so a change is a
		// redeploy of the same spec with one map edited. Reading the deployed
		// spec first is what keeps a set from dropping fields the manifest in
		// this directory never knew about.
		spec := status.Spec
		if spec.Env == nil {
			spec.Env = map[string]string{}
		}
		for _, argument := range rest {
			if action == "unset" {
				delete(spec.Env, argument)
				continue
			}
			key, value, found := strings.Cut(argument, "=")
			if !found || strings.TrimSpace(key) == "" {
				return fmt.Errorf("environment assignment %q must be KEY=VALUE", argument)
			}
			spec.Env[key] = value
		}
		return submitAndFollow(ctx, client, "/api/v1/applications", "env", spec, false)
	default:
		return errUsage
	}
}

func runRestart(arguments []string) error {
	var opts options
	flags := newFlagSet("restart", &opts)
	app := flags.String("app", "", "application to restart")
	if err := flags.Parse(arguments); err != nil {
		return err
	}
	client, err := opts.connect()
	if err != nil {
		return err
	}
	ctx, cancel := timeoutContext(followTimeout)
	defer cancel()
	name, err := applicationName(*app)
	if err != nil {
		return err
	}
	status, err := findApplication(ctx, client, name)
	if err != nil {
		return err
	}
	if !status.Deployed {
		return fmt.Errorf("application %q is not running", name)
	}
	body := map[string]any{"action": "restart"}
	return submitAndFollow(ctx, client, "/api/v1/services/"+status.Service+"/actions", "restart", body, false)
}

func runStatus(arguments []string) error {
	var opts options
	flags := newFlagSet("status", &opts)
	if err := flags.Parse(arguments); err != nil {
		return err
	}
	client, err := opts.connect()
	if err != nil {
		return err
	}
	ctx, cancel := timeoutContext(requestTimeout)
	defer cancel()
	var overview map[string]any
	if err := client.Get(ctx, "/api/v1/overview", &overview); err != nil {
		return err
	}
	if opts.json {
		return cli.WriteJSON(os.Stdout, overview)
	}
	table := cli.Table{Header: []string{"FIELD", "VALUE"}}
	keys := make([]string, 0, len(overview))
	for key := range overview {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	for _, key := range keys {
		table.Add(key, summarizeValue(overview[key]))
	}
	return table.Write(os.Stdout, "The controller returned an empty overview.")
}

// summarizeValue renders one overview field on a single line. Nested documents
// are counted rather than dumped; `--json` is there for the whole thing.
func summarizeValue(value any) string {
	switch typed := value.(type) {
	case nil:
		return "—"
	case []any:
		return fmt.Sprintf("%d item(s)", len(typed))
	case map[string]any:
		parts := make([]string, 0, len(typed))
		keys := make([]string, 0, len(typed))
		for key := range typed {
			keys = append(keys, key)
		}
		sort.Strings(keys)
		for _, key := range keys {
			if nested, isMap := typed[key].(map[string]any); isMap {
				parts = append(parts, fmt.Sprintf("%s=%d field(s)", key, len(nested)))
				continue
			}
			parts = append(parts, fmt.Sprintf("%s=%v", key, typed[key]))
		}
		return strings.Join(parts, "  ")
	case float64:
		return strconv.FormatFloat(typed, 'f', -1, 64)
	default:
		return fmt.Sprint(typed)
	}
}

func runCommand(arguments []string) error {
	if len(arguments) == 0 {
		return errUsage
	}
	action := arguments[0]
	var opts options
	flags := newFlagSet("command", &opts)
	limit := flags.Int("limit", 20, "how many commands to list")
	rest, err := parseAfterPositionals(flags, arguments[1:])
	if err != nil {
		return err
	}
	client, err := opts.connect()
	if err != nil {
		return err
	}
	ctx, cancel := timeoutContext(followTimeout)
	defer cancel()
	switch action {
	case "list":
		var records []domain.Command
		if err := client.Get(ctx, fmt.Sprintf("/api/v1/commands?limit=%d", *limit), &records); err != nil {
			return err
		}
		if opts.json {
			return cli.WriteJSON(os.Stdout, records)
		}
		table := cli.Table{Header: []string{"ID", "ACTION", "TARGET", "STATE", "AGE", "DETAIL"}}
		for _, record := range records {
			table.Add(record.ID, record.Action, cli.Dash(record.Target), string(record.State),
				cli.Age(record.CreatedAt), cli.Dash(firstNonEmpty(record.FailureSummary, record.LastError)))
		}
		return table.Write(os.Stdout, "No command has been queued.")
	case "show":
		if len(rest) != 1 {
			return errUsage
		}
		var record domain.Command
		if err := client.Get(ctx, "/api/v1/commands/"+rest[0], &record); err != nil {
			return err
		}
		return cli.WriteJSON(os.Stdout, record)
	case "events":
		if len(rest) != 1 {
			return errUsage
		}
		var events []domain.CommandEvent
		if err := client.Get(ctx, "/api/v1/commands/"+rest[0]+"/events", &events); err != nil {
			return err
		}
		if opts.json {
			return cli.WriteJSON(os.Stdout, events)
		}
		table := cli.Table{Header: []string{"#", "AT", "STATE", "STEP"}}
		for _, event := range events {
			table.Add(strconv.FormatUint(event.Sequence, 10), event.OccurredAt.Format(time.RFC3339), string(event.State), event.Evidence)
		}
		return table.Write(os.Stdout, "This command recorded no steps.")
	case "log":
		if len(rest) != 1 {
			return errUsage
		}
		// Plain text, straight through: this is what the machine printed, and
		// reshaping it would be this CLI editing evidence.
		log, err := client.Text(ctx, "/api/v1/commands/"+rest[0]+"/log")
		if err != nil {
			return err
		}
		fmt.Print(log)
		if !strings.HasSuffix(log, "\n") {
			fmt.Println()
		}
		return nil
	case "follow":
		if len(rest) != 1 {
			return errUsage
		}
		_, err := client.FollowWithSteps(ctx, rest[0], reportCommandState, reportCommandStep)
		return err
	case "retry":
		if len(rest) != 1 {
			return errUsage
		}
		return submitAndFollow(ctx, client, "/api/v1/commands/"+rest[0]+"/retry", "retry", nil, false)
	default:
		return errUsage
	}
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}

func runLogs(arguments []string) error {
	var opts options
	flags := newFlagSet("logs", &opts)
	app := flags.String("app", "", "application whose stack to read")
	service := flags.String("service", "", "service name filter")
	level := flags.String("level", "", "minimum level")
	search := flags.String("search", "", "substring to match")
	node := flags.String("node", "", "node filter")
	limit := flags.Int("limit", 100, "records per page")
	follow := flags.Bool("f", false, "keep reading as records arrive")
	if err := flags.Parse(arguments); err != nil {
		return err
	}
	client, err := opts.connect()
	if err != nil {
		return err
	}
	stack := ""
	if *app != "" || *service == "" {
		name, nameErr := applicationName(*app)
		// Reading every stack is a legitimate request, so a missing manifest
		// only means "no stack filter" rather than a refusal.
		if nameErr == nil {
			stack = ops.ApplicationNamespace + "-" + name
		} else if *app != "" {
			return nameErr
		}
	}
	query := func(from time.Time) string {
		values := []string{fmt.Sprintf("limit=%d", *limit)}
		add := func(key, value string) {
			if strings.TrimSpace(value) != "" {
				values = append(values, key+"="+urlQueryEscape(value))
			}
		}
		add("stack", stack)
		add("service", *service)
		add("level", *level)
		add("search", *search)
		add("node", *node)
		if !from.IsZero() {
			add("from", from.UTC().Format(time.RFC3339Nano))
		}
		return "/api/v1/logs?" + strings.Join(values, "&")
	}
	ctx, cancel := timeoutContext(followTimeout)
	defer cancel()
	seen := map[string]bool{}
	var latest time.Time
	for {
		var page logPage
		if err := client.Get(ctx, query(latest), &page); err != nil {
			return err
		}
		records := page.Records
		sort.Slice(records, func(left, right int) bool {
			return records[left].Timestamp.Before(records[right].Timestamp)
		})
		if opts.json && !*follow {
			return cli.WriteJSON(os.Stdout, page)
		}
		for _, record := range records {
			if seen[record.ID] {
				continue
			}
			seen[record.ID] = true
			if record.Timestamp.After(latest) {
				latest = record.Timestamp
			}
			fmt.Printf("%s  %-5s  %-24s  %s\n", record.Timestamp.Format(time.RFC3339),
				cli.Dash(record.Level), cli.Dash(record.Service), record.Message)
		}
		if !*follow {
			if len(records) == 0 {
				fmt.Fprintln(os.Stderr, "No log records matched. Check that log collection is enabled with `swarmops logs-status`.")
			}
			return nil
		}
		select {
		case <-ctx.Done():
			return nil
		case <-time.After(3 * time.Second):
		}
	}
}

type logPage struct {
	NextCursor string      `json:"nextCursor,omitempty"`
	Records    []logRecord `json:"records"`
	Truncated  bool        `json:"truncated"`
}

type logRecord struct {
	ID        string    `json:"id"`
	Level     string    `json:"level"`
	Message   string    `json:"message"`
	Node      string    `json:"node,omitempty"`
	Service   string    `json:"service,omitempty"`
	Stack     string    `json:"stack,omitempty"`
	Timestamp time.Time `json:"timestamp"`
}
