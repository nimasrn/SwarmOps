// Command swarmops drives a SwarmOps control plane from a terminal.
//
// The happy path is four commands — login, init, deploy, logs — and it is the
// only path most operators need. Everything below it (nodes, stacks, routing,
// the Core itself) is reachable but grouped out of the default help, because a
// platform that makes an operator meet the scheduler before their first deploy
// has already lost the thing that made it worth using.
package main

import (
	"errors"
	"fmt"
	"io"
	"os"
	"sort"
	"strings"
)

// group orders the help. Everything an operator needs on day one is in
// groupApp; the rest exists for the day something is wrong.
type group int

const (
	groupApp group = iota
	groupResource
	groupRouting
	groupCluster
	groupWorkstation
)

var groupTitles = map[group]string{
	groupApp:         "Applications",
	groupResource:    "Attached resources",
	groupRouting:     "Domains and routing",
	groupCluster:     "Cluster and controller",
	groupWorkstation: "Workstation",
}

type command struct {
	Group   group
	Name    string
	Run     func(arguments []string) error
	Summary string
	Usage   string
}

func commands() []command {
	registry := []command{
		{Group: groupApp, Name: "login", Summary: "Authenticate against a Core and store the session", Run: runLogin, Usage: "login --url <core-url> --username <name> [--core-fingerprint SHA256:...] [--profile <name>]"},
		{Group: groupApp, Name: "logout", Summary: "End the stored session", Run: runLogout, Usage: "logout [--profile <name>]"},
		{Group: groupApp, Name: "whoami", Summary: "Show who the stored session belongs to", Run: runWhoami, Usage: "whoami [--profile <name>]"},
		{Group: groupApp, Name: "profile", Summary: "List, select, and remove stored Cores", Run: runProfile, Usage: "profile list|use <name>|remove <name>"},
		{Group: groupApp, Name: "server", Summary: "List enrolled machines and choose the one commands run on", Run: runServer, Usage: "server list|use <id>|connect <id> [--api-key-file <path>]|disconnect <id>"},
		{Group: groupApp, Name: "init", Summary: "Write a swarmops.json for this directory", Run: runInit, Usage: "init [--name <app>] [--port <n>] [--plan <size>] [--domain <host>] [--from <deployed-app>] [--force]"},
		{Group: groupApp, Name: "deploy", Summary: "Deploy this directory's application", Run: runDeploy, Usage: "deploy [--image <ref>] [--local] [--service <name>] [--detach]"},
		{Group: groupApp, Name: "plan", Summary: "Render the Compose a deploy would produce, without deploying", Run: runPlan, Usage: "plan [--json]"},
		{Group: groupApp, Name: "plans", Summary: "List the sizes an application may be deployed at", Run: runPlans, Usage: "plans [--json]"},
		{Group: groupApp, Name: "app", Summary: "Inspect, scale, re-domain, and remove applications", Run: runApp, Usage: "app list|show <name>|scale <name> <n>|domain <name> <host>|remove <name>"},
		{Group: groupApp, Name: "env", Summary: "Read and change an application's environment", Run: runEnv, Usage: "env list|set KEY=VALUE...|unset KEY... [--app <name>]"},
		{Group: groupApp, Name: "logs", Summary: "Read collected logs", Run: runLogs, Usage: "logs [--app <name>] [--service <name>] [--level <level>] [--search <text>] [-f]"},
		{Group: groupApp, Name: "restart", Summary: "Restart an application's service", Run: runRestart, Usage: "restart [--app <name>]"},
		{Group: groupApp, Name: "status", Summary: "Show the cluster overview", Run: runStatus, Usage: "status [--json]"},
		{Group: groupApp, Name: "command", Summary: "Follow queued commands", Run: runCommand, Usage: "command list|show <id>|retry <id>|follow <id>"},

		{Group: groupWorkstation, Name: "build", Summary: "Build an image from a local directory", Run: build, Usage: "build --url <core-url> --username <name> --cluster-id default --server-id <id> --context <dir> --image <ref>"},
		{Group: groupWorkstation, Name: "password-hash", Summary: "Hash an admin password for the installer", Run: passwordHash, Usage: "password-hash --stdin"},
	}
	registry = append(registry, resourceCommands()...)
	registry = append(registry, routingCommands()...)
	registry = append(registry, clusterCommands()...)
	sort.SliceStable(registry, func(left, right int) bool { return registry[left].Group < registry[right].Group })
	return registry
}

func main() {
	if len(os.Args) < 2 {
		usage(os.Stderr, false)
		os.Exit(2)
	}
	name := os.Args[1]
	switch name {
	case "help", "--help", "-h":
		usage(os.Stdout, len(os.Args) > 2 && os.Args[2] == "all")
		return
	case "version", "--version":
		fmt.Println("swarmops " + version)
		return
	}
	for _, candidate := range commands() {
		if candidate.Name != name {
			continue
		}
		if err := candidate.Run(os.Args[2:]); err != nil {
			if errors.Is(err, errCancelled) {
				fmt.Fprintln(os.Stderr, "Cancelled.")
				return
			}
			if errors.Is(err, errUsage) {
				fmt.Fprintf(os.Stderr, "Usage: swarmops %s\n", candidate.Usage)
				os.Exit(2)
			}
			fmt.Fprintln(os.Stderr, "swarmops:", err)
			os.Exit(1)
		}
		return
	}
	fmt.Fprintf(os.Stderr, "unknown command %q\n", name)
	usage(os.Stderr, false)
	os.Exit(2)
}

// version is stamped at release time; an unstamped build says so rather than
// claiming a number it does not have.
var version = "dev"

// errUsage asks main to print the command's own usage line. A command returns
// it instead of printing, so every wrong invocation is reported identically.
var errUsage = errors.New("usage")

// errCancelled is a person declining a prompt. It is not a failure, so it
// leaves the exit status at zero.
var errCancelled = errors.New("cancelled")

func usage(writer io.Writer, all bool) {
	fmt.Fprint(writer, `SwarmOps — deploy an application without meeting the cluster.

  swarmops login --url https://swarmops.example.com --username operator
  swarmops init --name api --port 8080
  swarmops deploy
  swarmops logs -f

Usage:
  swarmops <command> [options]

`)
	shown := map[group]bool{groupApp: true, groupWorkstation: true}
	for _, current := range []group{groupApp, groupResource, groupRouting, groupCluster, groupWorkstation} {
		if !all && !shown[current] {
			continue
		}
		lines := make([]string, 0, 8)
		for _, candidate := range commands() {
			if candidate.Group == current {
				lines = append(lines, fmt.Sprintf("  %-14s %s", candidate.Name, candidate.Summary))
			}
		}
		if len(lines) == 0 {
			continue
		}
		fmt.Fprintf(writer, "%s:\n%s\n\n", groupTitles[current], strings.Join(lines, "\n"))
	}
	if !all {
		fmt.Fprint(writer, "Run `swarmops help all` for cluster, routing, and resource commands.\n")
	}
	fmt.Fprint(writer, `
Configuration:
  ~/.swarmops/config.json holds one profile per Core: its URL, the selected
  machine, an optional pinned certificate, and the session `+"`login`"+` obtained.
  The password is never stored. SWARMOPS_PROFILE, SWARMOPS_URL, and
  SWARMOPS_SERVER_ID override the selected profile for one invocation.
`)
}
