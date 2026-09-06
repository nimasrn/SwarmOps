package main

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"strings"

	"github.com/nimasrn/SwarmOps/internal/cli"
	"github.com/nimasrn/SwarmOps/internal/domain"
	"golang.org/x/term"
)

// parseAfterPositionals lets flags and positional arguments interleave, so
// `app show api --json` and `app show --json api` both work. Go's flag package
// stops at the first non-flag, which would make the first form silently drop
// the flag.
func parseAfterPositionals(flags *flag.FlagSet, arguments []string) ([]string, error) {
	var positionals []string
	for {
		if err := flags.Parse(arguments); err != nil {
			return nil, err
		}
		rest := flags.Args()
		if len(rest) == 0 {
			return positionals, nil
		}
		positionals = append(positionals, rest[0])
		arguments = rest[1:]
	}
}

// requireConfirmation asks before something irreversible. A non-interactive run
// is refused rather than assumed: a script that meant to remove an application
// says --yes, and one that did not should not discover the difference in
// production — so that refusal is an error, not a quiet success. A person who
// answers "no" at a prompt has not hit an error, and gets errCancelled.
func requireConfirmation(skip bool, question string) error {
	if skip {
		return nil
	}
	if !term.IsTerminal(int(os.Stdin.Fd())) {
		return errors.New("this changes or removes something; pass --yes to confirm it without a terminal")
	}
	fmt.Fprintf(os.Stderr, "%s [y/N] ", question)
	answer, err := bufio.NewReader(os.Stdin).ReadString('\n')
	if err != nil {
		return err
	}
	switch strings.ToLower(strings.TrimSpace(answer)) {
	case "y", "yes":
		return nil
	default:
		return errCancelled
	}
}

// reportCommandStep prints one piece of work as the controller enters it.
func reportCommandStep(event domain.CommandEvent) {
	fmt.Fprintln(os.Stderr, "  · "+event.Evidence)
}

// reportCommandState is the progress line a following command prints. It says
// only what the controller said.
func reportCommandState(command domain.Command) {
	line := "  " + string(command.State)
	if command.Attempt > 1 {
		line += fmt.Sprintf(" (attempt %d/%d)", command.Attempt, command.MaxAttempts)
	}
	if command.LastError != "" {
		line += ": " + command.LastError
	}
	fmt.Fprintln(os.Stderr, line)
}

// submitAndFollow queues one command and watches it to a terminal state,
// which is what turns "accepted" into an answer an operator can act on.
func submitAndFollow(ctx context.Context, client *cli.Client, path, prefix string, body any, detach bool) error {
	return submitMethodAndFollow(ctx, client, http.MethodPost, path, prefix, body, detach)
}

// deleteWithBody queues a removal whose endpoint is addressed with DELETE and
// still carries a confirmation.
func deleteWithBody(ctx context.Context, client *cli.Client, path string, body any) error {
	return submitMethodAndFollow(ctx, client, http.MethodDelete, path, "remove", body, false)
}

func submitMethodAndFollow(ctx context.Context, client *cli.Client, method, path, prefix string, body any, detach bool) error {
	if err := requireServer(client); err != nil {
		return err
	}
	command, err := client.SubmitWith(ctx, method, path, prefix, body)
	if err != nil {
		return err
	}
	fmt.Fprintf(os.Stderr, "Queued %s (%s).\n", command.Action, command.ID)
	if detach {
		fmt.Println(command.ID)
		return nil
	}
	final, err := client.FollowWithSteps(ctx, command.ID, reportCommandState, reportCommandStep)
	if err != nil {
		return err
	}
	fmt.Fprintf(os.Stderr, "Done: %s.\n", final.Action)
	return nil
}

func urlQueryEscape(value string) string { return url.QueryEscape(value) }

// gitOutput reads one value out of the working directory's repository. Git
// absence is not an error: it only means the CLI has nothing to infer from and
// the operator must state it in swarmops.json.
func gitOutput(arguments ...string) string {
	command := exec.Command("git", arguments...)
	output, err := command.Output()
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(output))
}

// repositoryPath normalises a Git remote to the owner/name form providers
// report, so a local checkout can be matched against the connection's
// repository list without asking the operator to paste an ID.
func repositoryPath(remote string) string {
	remote = strings.TrimSpace(remote)
	if remote == "" {
		return ""
	}
	remote = strings.TrimSuffix(remote, ".git")
	if index := strings.Index(remote, "://"); index >= 0 {
		remote = remote[index+3:]
		if at := strings.Index(remote, "@"); at >= 0 {
			remote = remote[at+1:]
		}
		if slash := strings.Index(remote, "/"); slash >= 0 {
			return strings.Trim(remote[slash+1:], "/")
		}
		return ""
	}
	// scp-like form: git@host:owner/name
	if colon := strings.LastIndex(remote, ":"); colon >= 0 {
		return strings.Trim(remote[colon+1:], "/")
	}
	return strings.Trim(remote, "/")
}

// readJSONFile loads a document an operator wrote for an endpoint whose input
// is too large to express as flags — a route or a DNS record.
func readJSONFile(path string) (any, error) {
	content, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read %s: %w", path, err)
	}
	var document any
	if err := json.Unmarshal(content, &document); err != nil {
		return nil, fmt.Errorf("parse %s: %w", path, err)
	}
	return document, nil
}
