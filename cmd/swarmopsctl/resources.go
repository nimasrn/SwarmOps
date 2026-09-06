package main

import (
	"fmt"
	"os"
	"strconv"

	"github.com/nimasrn/SwarmOps/internal/cli"
	"github.com/nimasrn/SwarmOps/internal/ops"
)

func resourceCommands() []command {
	return []command{
		{Group: groupResource, Name: "db", Summary: "List, enable, and remove managed databases", Run: runDatabase, Usage: "db list|create <engine>|remove <engine>"},
		{Group: groupResource, Name: "disk", Summary: "List, create, and remove volumes", Run: runDisk, Usage: "disk list|create <name>|remove <name>"},
		{Group: groupResource, Name: "secret", Summary: "List secret names", Run: runSecret, Usage: "secret list"},
		{Group: groupResource, Name: "config", Summary: "List and remove Swarm configs", Run: runConfig, Usage: "config list|remove <name>"},
	}
}

func runDatabase(arguments []string) error {
	if len(arguments) == 0 {
		return errUsage
	}
	action := arguments[0]
	var opts options
	flags := newFlagSet("db", &opts)
	confirm := flags.Bool("yes", false, "skip the interactive confirmation")
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
		var statuses []ops.DatabaseStatus
		if err := client.Get(ctx, "/api/v1/databases", &statuses); err != nil {
			return err
		}
		if opts.json {
			return cli.WriteJSON(os.Stdout, statuses)
		}
		table := cli.Table{Header: []string{"ENGINE", "STATE", "TASKS", "HOST", "PORT", "URI SECRET"}}
		for _, status := range statuses {
			state := "available"
			if status.Installed {
				state = "installed"
			}
			table.Add(status.Engine, state, strconv.FormatUint(status.RunningTasks, 10),
				cli.Dash(status.Host), strconv.FormatUint(uint64(status.Port), 10), cli.Dash(status.URISecret))
		}
		return table.Write(os.Stdout, "The controller offers no managed engines.")
	case "create":
		if len(rest) != 1 {
			return errUsage
		}
		body := map[string]any{"enabled": true}
		return submitAndFollow(ctx, client, "/api/v1/databases/"+rest[0], "db", body, false)
	case "remove":
		if len(rest) != 1 {
			return errUsage
		}
		// Removing an engine takes its volume with it, so the confirmation is
		// the engine's own phrase rather than a bare yes.
		if err := requireConfirmation(*confirm, fmt.Sprintf("Remove the managed %s database and its data?", rest[0])); err != nil {
			return err
		}
		body := map[string]any{"enabled": false, "confirmation": ops.DatabaseRemovalConfirmation(rest[0])}
		return submitAndFollow(ctx, client, "/api/v1/databases/"+rest[0], "db", body, false)
	default:
		return errUsage
	}
}

func runDisk(arguments []string) error {
	if len(arguments) == 0 {
		return errUsage
	}
	action := arguments[0]
	var opts options
	flags := newFlagSet("disk", &opts)
	confirm := flags.Bool("yes", false, "skip the interactive confirmation")
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
		var volumes []map[string]any
		if err := client.Get(ctx, "/api/v1/volumes", &volumes); err != nil {
			return err
		}
		if opts.json {
			return cli.WriteJSON(os.Stdout, volumes)
		}
		table := cli.Table{Header: []string{"NAME", "DRIVER", "SCOPE"}}
		for _, volume := range volumes {
			table.Add(stringField(volume, "Name", "name"), stringField(volume, "Driver", "driver"), stringField(volume, "Scope", "scope"))
		}
		return table.Write(os.Stdout, "No volume exists on this machine.")
	case "create":
		if len(rest) != 1 {
			return errUsage
		}
		return submitAndFollow(ctx, client, "/api/v1/volumes", "disk", map[string]string{"name": rest[0]}, false)
	case "remove":
		if len(rest) != 1 {
			return errUsage
		}
		if err := requireConfirmation(*confirm, fmt.Sprintf("Remove volume %s and everything in it?", rest[0])); err != nil {
			return err
		}
		body := map[string]string{"confirmation": ops.ResourceRemovalConfirmation("VOLUME", rest[0])}
		return submitAndFollow(ctx, client, "/api/v1/volumes/"+rest[0]+"/remove", "disk", body, false)
	default:
		return errUsage
	}
}

func runSecret(arguments []string) error {
	if len(arguments) == 0 || arguments[0] != "list" {
		return errUsage
	}
	return listDocuments("/api/v1/secrets", arguments[1:], []string{"Name", "name"}, "No secret exists on this machine.")
}

func runConfig(arguments []string) error {
	if len(arguments) == 0 {
		return errUsage
	}
	if arguments[0] == "list" {
		return listDocuments("/api/v1/configs", arguments[1:], []string{"Name", "name"}, "No config exists on this machine.")
	}
	if arguments[0] != "remove" {
		return errUsage
	}
	var opts options
	flags := newFlagSet("config", &opts)
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
	if err := requireConfirmation(*confirm, fmt.Sprintf("Remove config %s?", rest[0])); err != nil {
		return err
	}
	ctx, cancel := timeoutContext(followTimeout)
	defer cancel()
	body := map[string]string{"confirmation": ops.ResourceRemovalConfirmation("CONFIG", rest[0])}
	return submitAndFollow(ctx, client, "/api/v1/configs/"+rest[0]+"/remove", "config", body, false)
}
