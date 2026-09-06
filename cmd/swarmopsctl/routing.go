package main

import (
	"fmt"
	"os"

	"github.com/nimasrn/SwarmOps/internal/cli"
	"github.com/nimasrn/SwarmOps/internal/ops"
)

func routingCommands() []command {
	return []command{
		{Group: groupRouting, Name: "domain", Summary: "List and manage routed domains", Run: runDomain, Usage: "domain list|add <zone> [--note <owner>]|remove <zone>"},
		{Group: groupRouting, Name: "route", Summary: "Read and apply Traefik routes", Run: runRoute, Usage: "route list|plan <file.json>|apply <file.json>"},
		{Group: groupRouting, Name: "cert", Summary: "Read certificates and retry issuance", Run: runCert, Usage: "cert list|retry <route>"},
		{Group: groupRouting, Name: "dns", Summary: "Manage DNS records and provider credentials", Run: runDNS, Usage: "dns records|record add <file.json>|record remove <id>|verify <id>|credentials"},
		{Group: groupRouting, Name: "traefik", Summary: "Inspect and reconcile the ingress", Run: runTraefik, Usage: "traefik status|preflight|state|reconcile|logs"},
		{Group: groupRouting, Name: "source", Summary: "Manage Git provider connections", Run: runSource, Usage: "source status|connections|repos <connection>|discover <connection> <repository> [ref]"},
	}
}

func runDomain(arguments []string) error {
	if len(arguments) == 0 {
		return errUsage
	}
	switch arguments[0] {
	case "list":
		return listStateSection("domains", arguments[1:], []column{
			{Header: "ZONE", Keys: []string{"zone"}},
			{Header: "NOTE", Keys: []string{"note"}},
			{Header: "ACCEPTED", Keys: []string{"createdAt"}},
		}, "No domain is accepted.")
	case "add", "remove":
		var opts options
		flags := newFlagSet("domain", &opts)
		note := flags.String("note", "", "who owns this zone")
		confirm := flags.Bool("yes", false, "skip the interactive confirmation")
		rest, err := parseAfterPositionals(flags, arguments[1:])
		if err != nil {
			return err
		}
		if len(rest) != 1 {
			return errUsage
		}
		client, err := opts.connect()
		if err != nil {
			return err
		}
		ctx, cancel := timeoutContext(followTimeout)
		defer cancel()
		if arguments[0] == "add" {
			// The controller reads the zone as a nested spec, and owns the
			// acceptance timestamp: sending one it did not set is refused.
			body := map[string]any{"domain": map[string]any{"note": *note, "zone": rest[0]}}
			return submitAndFollow(ctx, client, "/api/v1/traefik/domains", "domain", body, false)
		}
		if err := requireConfirmation(*confirm, fmt.Sprintf("Stop managing domain %s?", rest[0])); err != nil {
			return err
		}
		body := map[string]string{"confirmation": ops.DomainRemovalConfirmation(rest[0])}
		return deleteWithBody(ctx, client, "/api/v1/traefik/domains/"+rest[0], body)
	default:
		return errUsage
	}
}

func runRoute(arguments []string) error {
	if len(arguments) == 0 {
		return errUsage
	}
	switch arguments[0] {
	case "list":
		return listTable("/api/v1/traefik/routes", arguments[1:], []column{
			{Header: "NAME", Keys: []string{"name", "router", "Name"}},
			{Header: "HOST", Keys: []string{"host", "hosts", "Host"}},
			{Header: "SERVICE", Keys: []string{"service", "Service"}},
			{Header: "STATE", Keys: []string{"state", "status"}},
		}, "No route is published.")
	case "plan", "apply":
		var opts options
		flags := newFlagSet("route", &opts)
		rest, err := parseAfterPositionals(flags, arguments[1:])
		if err != nil {
			return err
		}
		if len(rest) != 1 {
			return errUsage
		}
		document, err := readJSONFile(rest[0])
		if err != nil {
			return err
		}
		client, err := opts.connect()
		if err != nil {
			return err
		}
		ctx, cancel := timeoutContext(followTimeout)
		defer cancel()
		if arguments[0] == "plan" {
			var rendered any
			if err := client.Post(ctx, "/api/v1/traefik/routes/plan", document, &rendered); err != nil {
				return err
			}
			return cli.WriteJSON(os.Stdout, rendered)
		}
		return submitAndFollow(ctx, client, "/api/v1/traefik/routes", "route", document, false)
	default:
		return errUsage
	}
}

func runCert(arguments []string) error {
	if len(arguments) == 0 {
		return errUsage
	}
	switch arguments[0] {
	case "list":
		return listTable("/api/v1/traefik/certificates", arguments[1:], []column{
			{Header: "ROUTE", Keys: []string{"route", "name"}},
			{Header: "HOST", Keys: []string{"host", "domain"}},
			{Header: "STATE", Keys: []string{"state", "status"}},
			{Header: "EXPIRES", Keys: []string{"expiresAt", "notAfter"}},
		}, "No certificate has been issued.")
	case "retry":
		var opts options
		flags := newFlagSet("cert", &opts)
		rest, err := parseAfterPositionals(flags, arguments[1:])
		if err != nil {
			return err
		}
		if len(rest) != 1 {
			return errUsage
		}
		client, err := opts.connect()
		if err != nil {
			return err
		}
		ctx, cancel := timeoutContext(followTimeout)
		defer cancel()
		return submitAndFollow(ctx, client, "/api/v1/traefik/certificates/"+rest[0]+"/retry", "cert", nil, false)
	default:
		return errUsage
	}
}

func runDNS(arguments []string) error {
	if len(arguments) == 0 {
		return errUsage
	}
	switch arguments[0] {
	case "records":
		return listStateSection("dnsRecords", arguments[1:], []column{
			{Header: "ID", Keys: []string{"id"}},
			{Header: "NAME", Keys: []string{"name"}},
			{Header: "TYPE", Keys: []string{"type"}},
			{Header: "VALUE", Keys: []string{"value", "content"}},
			{Header: "STATE", Keys: []string{"state", "status"}},
		}, "No DNS record is managed.")
	case "credentials":
		return listStateSection("credentials", arguments[1:], []column{
			{Header: "ID", Keys: []string{"id"}},
			{Header: "PROVIDER", Keys: []string{"provider"}},
			{Header: "VERSION", Keys: []string{"version"}},
			{Header: "STATE", Keys: []string{"state", "status"}},
		}, "No DNS credential is stored.")
	case "verify":
		var opts options
		flags := newFlagSet("dns", &opts)
		rest, err := parseAfterPositionals(flags, arguments[1:])
		if err != nil {
			return err
		}
		if len(rest) != 1 {
			return errUsage
		}
		return showDocument("/api/v1/traefik/dns/records/"+rest[0]+"/verify", nil)
	case "record":
		if len(arguments) < 2 {
			return errUsage
		}
		var opts options
		flags := newFlagSet("dns record", &opts)
		confirm := flags.Bool("yes", false, "skip the interactive confirmation")
		rest, err := parseAfterPositionals(flags, arguments[2:])
		if err != nil {
			return err
		}
		if len(rest) != 1 {
			return errUsage
		}
		client, err := opts.connect()
		if err != nil {
			return err
		}
		ctx, cancel := timeoutContext(followTimeout)
		defer cancel()
		switch arguments[1] {
		case "add":
			document, err := readJSONFile(rest[0])
			if err != nil {
				return err
			}
			return submitAndFollow(ctx, client, "/api/v1/traefik/dns/records", "dns", document, false)
		case "remove":
			if err := requireConfirmation(*confirm, fmt.Sprintf("Delete DNS record %s?", rest[0])); err != nil {
				return err
			}
			return deleteWithBody(ctx, client, "/api/v1/traefik/dns/records/"+rest[0], map[string]string{"confirmation": ops.DNSRecordDeletionConfirmation(rest[0])})
		default:
			return errUsage
		}
	default:
		return errUsage
	}
}

func runTraefik(arguments []string) error {
	if len(arguments) == 0 {
		return errUsage
	}
	switch arguments[0] {
	case "status":
		return showDocument("/api/v1/traefik/status", arguments[1:])
	case "preflight":
		return showDocument("/api/v1/traefik/preflight", arguments[1:])
	case "state":
		return showDocument("/api/v1/traefik/state", arguments[1:])
	case "logs":
		return showDocument("/api/v1/traefik/logs", arguments[1:])
	case "reconcile":
		var opts options
		flags := newFlagSet("traefik", &opts)
		dashboard := flags.String("dashboard-host", "", "hostname for the Traefik dashboard")
		confirm := flags.Bool("yes", false, "skip the interactive confirmation")
		if err := flags.Parse(arguments[1:]); err != nil {
			return err
		}
		if err := requireConfirmation(*confirm, "Reconcile the ingress stack now?"); err != nil {
			return err
		}
		client, err := opts.connect()
		if err != nil {
			return err
		}
		ctx, cancel := timeoutContext(followTimeout)
		defer cancel()
		body := map[string]string{"confirmation": "DEPLOY_TRAEFIK", "dashboardHost": *dashboard}
		return submitAndFollow(ctx, client, "/api/v1/traefik/reconcile", "traefik", body, false)
	default:
		return errUsage
	}
}

func runSource(arguments []string) error {
	if len(arguments) == 0 {
		return errUsage
	}
	switch arguments[0] {
	case "status":
		return showDocument("/api/v1/sources/status", arguments[1:])
	case "connections":
		return listTable("/api/v1/sources/connections", arguments[1:], []column{
			{Header: "ID", Keys: []string{"id"}},
			{Header: "NAME", Keys: []string{"name"}},
			{Header: "KIND", Keys: []string{"kind"}},
			{Header: "ACCOUNT", Keys: []string{"account"}},
			{Header: "CREDENTIAL", Keys: []string{"credentialState"}},
		}, "No Git connection is configured.")
	case "repos":
		if len(arguments) < 2 {
			return errUsage
		}
		return listTable("/api/v1/sources/connections/"+arguments[1]+"/repositories", arguments[2:], []column{
			{Header: "PATH", Keys: []string{"path"}},
			{Header: "DEFAULT BRANCH", Keys: []string{"defaultBranch"}},
			{Header: "PRIVATE", Keys: []string{"private"}},
		}, "This connection sees no repository.")
	case "discover":
		if len(arguments) < 3 {
			return errUsage
		}
		var opts options
		flags := newFlagSet("source discover", &opts)
		if err := flags.Parse(arguments[4:]); err != nil {
			return err
		}
		client, err := opts.connect()
		if err != nil {
			return err
		}
		ctx, cancel := timeoutContext(requestTimeout)
		defer cancel()
		ref := ""
		if len(arguments) > 3 {
			ref = arguments[3]
		}
		var plan any
		if err := client.Post(ctx, "/api/v1/sources/discover", map[string]string{
			"connectionId": arguments[1],
			"repositoryId": arguments[2],
			"ref":          ref,
		}, &plan); err != nil {
			return err
		}
		return cli.WriteJSON(os.Stdout, plan)
	default:
		return errUsage
	}
}
