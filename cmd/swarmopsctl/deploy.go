package main

import (
	"context"
	"fmt"
	"os"
	"strings"

	"github.com/nimasrn/SwarmOps/internal/cli"
	"github.com/nimasrn/SwarmOps/internal/source"
)

// runDeploy is the command the whole tool exists for. It reads swarmops.json,
// works out where the image comes from, and queues one application deploy.
//
// The default path is the repository the working directory is checked out
// from: the controller reads that repository itself, scans its Compose, and
// decides the image. Nothing is uploaded from the workstation, which is why it
// is the default — a deploy from a laptop with an uncommitted tree would put
// something in the cluster that exists nowhere else.
func runDeploy(arguments []string) error {
	var opts options
	flags := newFlagSet("deploy", &opts)
	image := flags.String("image", "", "deploy this already-built image instead of reading the repository")
	local := flags.Bool("local", false, "build the working directory here and deploy the result")
	service := flags.String("service", "", "Compose service to deploy when the repository defines several")
	composePath := flags.String("compose-path", "", "Compose file to read when the repository has several")
	ref := flags.String("ref", "", "branch, tag, or revision to deploy")
	detach := flags.Bool("detach", false, "queue the deploy and print its command ID without waiting")
	dockerfile := flags.String("dockerfile", "Dockerfile", "Dockerfile path within the context, with --local")
	maxContextMiB := flags.Int64("max-context-mib", 480, "local source-content cap, with --local")
	if err := flags.Parse(arguments); err != nil {
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
	client, err := opts.connect()
	if err != nil {
		return err
	}
	if err := requireServer(client); err != nil {
		return err
	}
	ctx, cancel := timeoutContext(followTimeout)
	defer cancel()

	switch {
	case *local:
		return deployLocalBuild(ctx, client, manifest, directory, *image, *dockerfile, *maxContextMiB, *detach)
	case *image != "":
		manifest.Image = *image
		return deployImage(ctx, client, manifest, *detach)
	case manifest.Image != "" && manifest.Source == nil:
		return deployImage(ctx, client, manifest, *detach)
	default:
		return deployFromSource(ctx, client, manifest, sourceChoice{
			composePath: *composePath,
			ref:         *ref,
			service:     *service,
		}, *detach)
	}
}

func deployImage(ctx context.Context, client *cli.Client, manifest cli.Manifest, detach bool) error {
	spec := manifest.Spec()
	if spec.Image == "" {
		return fmt.Errorf("no image to deploy; set \"image\" in %s or pass --image", cli.ManifestFile)
	}
	fmt.Fprintf(os.Stderr, "Deploying %s from image %s.\n", spec.Name, spec.Image)
	return submitAndFollow(ctx, client, "/api/v1/applications", "deploy", spec, detach)
}

// deployLocalBuild is the escape hatch for a workstation with no Git
// connection configured: the directory is archived, built on the selected
// machine, and then deployed by image reference.
func deployLocalBuild(ctx context.Context, client *cli.Client, manifest cli.Manifest, directory, image, dockerfile string, maxContextMiB int64, detach bool) error {
	reference := strings.TrimSpace(image)
	if reference == "" {
		reference = manifest.Image
	}
	if reference == "" {
		return fmt.Errorf("--local needs an image reference to push to; pass --image or set \"image\" in %s", cli.ManifestFile)
	}
	spec := manifest.Spec()
	fmt.Fprintf(os.Stderr, "Building %s from %s.\n", reference, directory)
	command, err := submitBuild(ctx, client, buildInput{
		contextDir:    directory,
		cpus:          2,
		dockerfile:    dockerfile,
		image:         reference,
		maxContextMiB: maxContextMiB,
		memoryMiB:     2048,
		push:          true,
	})
	if err != nil {
		return err
	}
	fmt.Fprintf(os.Stderr, "Queued build (%s).\n", command.ID)
	if _, err := client.Follow(ctx, command.ID, reportCommandState); err != nil {
		return err
	}
	spec.Image = reference
	return submitAndFollow(ctx, client, "/api/v1/applications", "deploy", spec, detach)
}

// sourceChoice is what the operator said on the command line about which part
// of the repository to deploy. Anything empty falls back to the manifest, and
// then to what discovery found.
type sourceChoice struct {
	composePath string
	ref         string
	service     string
}

func deployFromSource(ctx context.Context, client *cli.Client, manifest cli.Manifest, choice sourceChoice, detach bool) error {
	wanted := cli.ManifestSource{}
	if manifest.Source != nil {
		wanted = *manifest.Source
	}
	if choice.composePath != "" {
		wanted.ComposePath = choice.composePath
	}
	if choice.ref != "" {
		wanted.Ref = choice.ref
	}
	if choice.service != "" {
		wanted.Service = choice.service
	}
	connection, err := resolveConnection(ctx, client, wanted.Connection)
	if err != nil {
		return err
	}
	repository, err := resolveRepository(ctx, client, connection.ID, wanted.Repository)
	if err != nil {
		return err
	}
	ref := wanted.Ref
	if ref == "" {
		ref = gitOutput("rev-parse", "--abbrev-ref", "HEAD")
	}
	if ref == "" || ref == "HEAD" {
		ref = repository.DefaultBranch
	}
	fmt.Fprintf(os.Stderr, "Reading %s at %s through connection %s.\n", repository.Path, cli.Dash(ref), connection.Name)
	var plan source.Plan
	if err := client.Post(ctx, "/api/v1/sources/discover", source.DiscoverRequest{
		ConnectionID: connection.ID,
		Ref:          ref,
		RepositoryID: repository.ID,
	}, &plan); err != nil {
		return err
	}
	candidate, err := chooseService(plan, wanted)
	if err != nil {
		return err
	}
	reportFindings(plan, candidate)
	fmt.Fprintf(os.Stderr, "Deploying %s from %s at %s.\n", manifest.Name, candidate.ComposePath+"#"+candidate.Service, shortRevision(plan.Revision.SHA))
	body := map[string]any{
		"application": manifest.Spec(),
		"selection": source.Selection{
			ComposePath:  candidate.ComposePath,
			ConnectionID: connection.ID,
			PlanID:       plan.ID,
			RepositoryID: repository.ID,
			Revision:     plan.Revision.SHA,
			Service:      candidate.Service,
		},
	}
	return submitAndFollow(ctx, client, "/api/v1/sources/deploy", "deploy", body, detach)
}

func resolveConnection(ctx context.Context, client *cli.Client, wanted string) (source.Connection, error) {
	var connections []source.Connection
	if err := client.Get(ctx, "/api/v1/sources/connections", &connections); err != nil {
		return source.Connection{}, err
	}
	if len(connections) == 0 {
		return source.Connection{}, fmt.Errorf("no Git connection is configured; add one with `swarmops source connection add`, or deploy an image with --image")
	}
	if wanted == "" {
		if len(connections) == 1 {
			return connections[0], nil
		}
		names := make([]string, 0, len(connections))
		for _, connection := range connections {
			names = append(names, connection.Name)
		}
		return source.Connection{}, fmt.Errorf("several Git connections are configured (%s); name one under \"source\".\"connection\" in %s", strings.Join(names, ", "), cli.ManifestFile)
	}
	for _, connection := range connections {
		if connection.ID == wanted || strings.EqualFold(connection.Name, wanted) {
			return connection, nil
		}
	}
	return source.Connection{}, fmt.Errorf("Git connection %q is not configured", wanted)
}

func resolveRepository(ctx context.Context, client *cli.Client, connectionID, wanted string) (source.Repository, error) {
	var repositories []source.Repository
	if err := client.Get(ctx, "/api/v1/sources/connections/"+connectionID+"/repositories", &repositories); err != nil {
		return source.Repository{}, err
	}
	target := strings.TrimSpace(wanted)
	if target == "" {
		target = repositoryPath(gitOutput("remote", "get-url", "origin"))
	}
	if target == "" {
		return source.Repository{}, fmt.Errorf("could not tell which repository this is; set \"source\".\"repository\" in %s", cli.ManifestFile)
	}
	for _, repository := range repositories {
		if repository.ID == target || strings.EqualFold(repository.Path, target) {
			return repository, nil
		}
	}
	return source.Repository{}, fmt.Errorf("repository %q is not visible through this connection", target)
}

// chooseService picks the Compose service to deploy. One candidate needs no
// decision; several without a stated choice is a question for the operator,
// not something to guess at.
func chooseService(plan source.Plan, wanted cli.ManifestSource) (source.ServicePlan, error) {
	matches := make([]source.ServicePlan, 0, len(plan.Services))
	for _, candidate := range plan.Services {
		if wanted.Service != "" && candidate.Service != wanted.Service {
			continue
		}
		if wanted.ComposePath != "" && candidate.ComposePath != wanted.ComposePath {
			continue
		}
		matches = append(matches, candidate)
	}
	if len(matches) == 1 {
		return matches[0], nil
	}
	if len(matches) == 0 {
		return source.ServicePlan{}, fmt.Errorf("no deployable service matched in %s at %s%s", plan.Repository.Path, shortRevision(plan.Revision.SHA), findingSuffix(plan.Findings))
	}
	lines := make([]string, 0, len(matches))
	for _, candidate := range matches {
		lines = append(lines, "  "+candidate.ComposePath+"#"+candidate.Service)
	}
	return source.ServicePlan{}, fmt.Errorf("this repository defines several deployable services; choose one with --service (and --compose-path):\n%s", strings.Join(lines, "\n"))
}

// reportFindings surfaces what the scanner could not do before the deploy is
// queued, rather than leaving the operator to discover it from a failed task.
func reportFindings(plan source.Plan, candidate source.ServicePlan) {
	for _, finding := range append(append([]source.Finding{}, plan.Findings...), candidate.Findings...) {
		fmt.Fprintf(os.Stderr, "  note: %s\n", findingText(finding))
	}
}

func findingSuffix(findings []source.Finding) string {
	if len(findings) == 0 {
		return ""
	}
	lines := make([]string, 0, len(findings))
	for _, finding := range findings {
		lines = append(lines, "  "+findingText(finding))
	}
	return ":\n" + strings.Join(lines, "\n")
}

func shortRevision(sha string) string {
	if len(sha) > 12 {
		return sha[:12]
	}
	if sha == "" {
		return "an unknown revision"
	}
	return sha
}

// findingText renders one scanner finding on a single line.
func findingText(finding source.Finding) string {
	text := string(finding.Level) + ": " + finding.Message
	if finding.Subject != "" {
		text += " (" + finding.Subject + ")"
	}
	return text
}
