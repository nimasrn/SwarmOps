package queue

import (
	"errors"
	"fmt"
	"log/slog"
	"regexp"
	"strings"

	"github.com/nimasrn/SwarmOps/internal/agentcontrol"
	"github.com/nimasrn/SwarmOps/internal/domain"
)

var commandIDPattern = regexp.MustCompile(`^cmd-[a-f0-9]{32}$`)

// ErrIdempotencyConflict means an operator reused a key for a different
// command. Returning the original command in that case could direct an
// operator to the wrong mutation, so callers must choose a new key instead.
var ErrIdempotencyConflict = errors.New("idempotency key belongs to a different command")

// Permanent marks an execution failure that must not be retried
// automatically. Its wrapped error is intentionally not persisted by Store.
type Permanent struct{ err error }

func (e *Permanent) Error() string { return e.err.Error() }
func (e *Permanent) Unwrap() error { return e.err }

func PermanentError(err error) error {
	if err == nil {
		return nil
	}
	return &Permanent{err: err}
}

func isPermanent(err error) bool {
	var value *Permanent
	return errors.As(err, &value)
}

// IsPermanent reports whether an execution failure was explicitly marked as
// never-retryable. Command classifiers and callers use it so an already
// classified outcome cannot be reinterpreted by later heuristics.
func IsPermanent(err error) bool { return isPermanent(err) }

type safeFailureCoder interface {
	SafeFailureCode() string
}

func safeFailureCode(err error) string {
	var value safeFailureCoder
	if errors.As(err, &value) {
		return value.SafeFailureCode()
	}
	return ""
}

// FailureCodeUnclassified is the bucket an execution error lands in when the
// classifier recognises nothing about it. It is a statement that SwarmOps does
// not know what happened, not a description of what happened — which is why a
// command carrying it is also written to the controller log with its cause.
const FailureCodeUnclassified = "execution_not_confirmed"

// maxLoggedCause bounds what one failure may write to the log. The cause can
// carry an agent's wrapped output, and an unbounded one turns a repeating
// failure into a disk-filling loop.
const maxLoggedCause = 2048

// commandFailureDiagnostic converts locally generated execution errors into a
// bounded operator explanation. Raw remote output never enters the command
// ledger or browser, but the safe failure class and next action must survive.
func commandFailureDiagnostic(action string, err error) (code, summary, recovery string) {
	message := ""
	if err != nil {
		message = strings.ToLower(err.Error())
	}
	safeCode := safeFailureCode(err)
	switch {
	case strings.Contains(message, "command execution ended before completion") || strings.Contains(message, "core restarted while"):
		return "execution_interrupted", "The controller stopped before it could confirm the remote result.", "Verify the target's current state, then retry only if the intended change is still missing."
	case strings.Contains(message, "server is not connected") || strings.Contains(message, "select a connected server"):
		return "target_disconnected", "The selected server was not connected when execution started.", "Open Diagnostics, restore the agent connection, then retry this command."
	// A build that ran and failed is not an unconfirmed change: SwarmOps knows
	// exactly what happened, and now keeps the machine's own output to prove
	// it. Saying "could not confirm" sent the operator to inspect Docker when
	// the answer was already retained against the command.
	case strings.Contains(message, "docker reported a build error"):
		return "build_failed", "The image build failed on the machine.", "Read this command's execution log for the failing step and its output, correct it in the repository, then retry."
	case strings.Contains(message, "docker reported an image push error"), strings.Contains(message, "push built image"):
		return "image_push_failed", "The image built, but pushing it to the registry failed.", "Read this command's execution log for the push output, check the registry credential and that the namespace accepts this image, then retry."
	// These five are the gateway's own prerequisites, and the routing store
	// checks them for every command that touches it — accepting a domain,
	// applying a record, publishing a route — not only for the installation.
	// Matching them on traefik.reconcile alone meant that every other routing
	// command hit the same guard and reported "SwarmOps could not confirm that
	// the requested change completed", which names neither the missing
	// prerequisite nor the page that supplies it. The message is specific
	// enough to classify on its own.
	case strings.Contains(message, "traefik acme email"):
		return "traefik_acme_email_required", "Traefik has no valid ACME contact email configured, and the gateway cannot be used until it does.", "Open Gateway & ports, enter the ACME email under static settings, apply it, then retry."
	case strings.Contains(message, "external traefik overlay network"):
		return "traefik_network_required", "Traefik requires the external attachable overlay network named traefik.", "Open Docker resources and create the reviewed encrypted traefik overlay, then retry."
	case strings.Contains(message, "nim.edge=true"):
		return "traefik_edge_label_required", "Traefik has no eligible manager because nim.edge=true is missing.", "Open Swarm & placement, label the reviewed manager nim.edge=true, then retry."
	case strings.Contains(message, "dynamic config"):
		return "traefik_dynamic_config_required", "The reviewed Traefik dynamic config is missing.", "Create the configured dynamic Swarm config, then retry."
	case strings.Contains(message, "dashboard") && strings.Contains(message, "secret"):
		return "traefik_dashboard_auth_required", "The Traefik dashboard-auth secret is missing.", "Create the configured htpasswd Swarm secret, then retry."
	case safeCode == "docker_ingress_network_missing":
		return "swarm_ingress_network_missing", "Docker has no swarm ingress network, so no service can publish a port.", "Recreate the ingress network on the manager (docker network create --driver overlay --ingress --subnet 10.0.0.0/24 --gateway 10.0.0.1 ingress), then retry."
	case action == "traefik.reconcile" && safeCode == "docker_external_network_missing":
		return "traefik_network_required", "Docker rejected the Traefik deployment because its required external overlay network is missing.", "Open Gateway & ports, refresh Installation prerequisites, repair the missing resources, then retry."
	case action == "traefik.reconcile" && safeCode == "docker_external_config_missing":
		return "traefik_config_required", "Docker rejected the Traefik deployment because a required external configuration is missing.", "Open Gateway & ports, refresh Installation prerequisites, repair the missing resources, then retry."
	case action == "traefik.reconcile" && safeCode == "docker_external_secret_missing":
		return "traefik_secret_required", "Docker rejected the Traefik deployment because a required external secret is missing.", "Open Gateway & ports, refresh Installation prerequisites, repair the missing resources, then retry."
	case action == "traefik.reconcile" && safeCode == "docker_placement_unsatisfied":
		return "traefik_placement_unsatisfied", "Docker could not place the Traefik service on an eligible node.", "Open Swarm placement, verify a ready active manager has nim.edge=true and sufficient capacity, then retry."
	case action == "traefik.reconcile" && safeCode == "docker_port_unavailable":
		return "traefik_port_unavailable", "Docker could not start Traefik because a configured gateway port is already in use.", "Inspect the selected manager for an existing gateway using ports 80 or 443, resolve the conflict, then retry."
	case action == "traefik.reconcile" && safeCode == "docker_image_unavailable":
		return "traefik_image_unavailable", "The selected manager could not pull the reviewed Traefik image.", "Verify registry reachability and the configured immutable Traefik image, then retry."
	case action == "traefik.reconcile" && safeCode == "docker_command_timed_out":
		return "traefik_deploy_timed_out", "The Traefik deployment did not converge before the machine-agent deadline.", "Inspect the Traefik service tasks and manager capacity, confirm the intended stack state, then retry only if it is absent."
	case action == "traefik.reconcile" && safeCode == "docker_command_output_limit":
		return "traefik_deploy_output_limit", "The Traefik deployment produced more status output than the bounded machine-agent response allows.", "Inspect the Traefik service tasks for repeated failures, resolve them, then retry only if the stack is absent."
	case action == "traefik.reconcile" && safeCode == "docker_stack_deploy_failed":
		return "traefik_deploy_failed", "Docker rejected or failed to converge the reviewed Traefik stack.", "Inspect Traefik service tasks and the selected manager's current gateway state, resolve the reported Docker condition, then retry only if the stack is absent."
	case strings.Contains(message, "traefik singleton service was not found"):
		return "gateway_required", "The managed Traefik gateway is required before this stack can create private routes.", "Install and verify Traefik under Gateway, routes & DNS, then retry."
	case strings.Contains(message, "nim.stateful"):
		return "stateful_node_required", "No ready active node satisfies the required nim.stateful=true placement.", "Open Swarm, assign the stateful label to the reviewed node, then retry."
	// A policy refusal is not an unconfirmed change. This one fell through to
	// the default bucket and told operators "SwarmOps could not confirm that
	// the requested change completed", which sends them to inspect Docker —
	// where nothing is wrong, because the controller declined before it ever
	// spoke to a machine. It is also deterministic: retrying cannot help.
	case strings.Contains(message, "namespace prefix"):
		return "stack_outside_namespace", "This stack name is outside the namespace SwarmOps deploys applications into.", "Rename the stack so it starts with the application namespace prefix, then retry."
	case strings.Contains(message, "read trusted stack asset"):
		return "controller_asset_missing", "The controller's reviewed deployment asset is unavailable.", "Repair or update the controller installation before retrying."
	case strings.Contains(message, "config") && strings.Contains(message, "not found"):
		return "swarm_config_missing", "A required versioned Swarm configuration is missing.", "Repair the reviewed platform configurations, then retry the stack deployment."
	case action == "observability.core":
		return "observability_not_confirmed", "SwarmOps could not confirm the Prometheus, Alertmanager, and Jaeger deployment.", "Check the selected manager, Traefik gateway, stateful placement, and reviewed Swarm configs before retrying."
	// The agent's failure class survived the boundary and was then thrown
	// away: every code above is matched only for traefik.reconcile, so a
	// managed database or the log aggregator failing on placement reported
	// "SwarmOps could not confirm that the requested change completed" — the
	// bucket for an UNKNOWN outcome — when the agent had said exactly which
	// Docker condition refused it.
	case safeCode != "":
		return dockerFailureDiagnostic(safeCode)
	default:
		return FailureCodeUnclassified, "SwarmOps could not confirm that the requested change completed.", "Inspect the explicit target and current resource state before retrying."
	}
}

// dockerFailureDiagnostic explains an allow-listed agent failure class for any
// stack, in the vocabulary the agent used. It is the fallback for actions with
// no wording of their own; a specific case above always wins.
func dockerFailureDiagnostic(safeCode string) (code, summary, recovery string) {
	switch safeCode {
	case agentcontrol.CommandFailurePlacement:
		return "stack_placement_unsatisfied", "Docker could not place this stack's services on any eligible node.", "Check the placement this stack requires against the cluster: managed databases and the log aggregator need a ready, active node labelled nim.stateful=true, and every service needs a node with free capacity. Fix the placement, then retry."
	case agentcontrol.CommandFailureImageUnavailable:
		return "stack_image_unavailable", "The selected manager could not pull an image this stack declares.", "Verify registry reachability and the image reference, then retry."
	case agentcontrol.CommandFailurePortUnavailable:
		return "stack_port_unavailable", "Docker could not start the stack because a port it publishes is already in use.", "Inspect the selected manager for the process or service holding that port, resolve the conflict, then retry."
	case agentcontrol.CommandFailureNetworkMissing:
		return "stack_network_missing", "Docker rejected the stack because an external network it attaches to does not exist.", "Create the reviewed overlay network on the manager, then retry."
	case agentcontrol.CommandFailureConfigMissing:
		return "stack_config_missing", "Docker rejected the stack because an external configuration it mounts does not exist.", "Repair the reviewed platform configurations, then retry."
	case agentcontrol.CommandFailureSecretMissing:
		return "stack_secret_missing", "Docker rejected the stack because an external secret it mounts does not exist.", "Create the reviewed secret on the manager, then retry."
	case agentcontrol.CommandFailureTimedOut:
		return "stack_deploy_timed_out", "The deployment did not converge before the machine-agent deadline.", "Inspect the stack's service tasks and the manager's capacity, confirm the intended state, then retry only if the change is still missing."
	case agentcontrol.CommandFailureOutputLimit:
		return "stack_deploy_output_limit", "The deployment produced more status output than the bounded machine-agent response allows, which usually means services restarting repeatedly.", "Inspect the stack's service tasks for a repeating failure, resolve it, then retry."
	case agentcontrol.CommandFailureStackDeploy:
		return "stack_deploy_failed", "Docker rejected or failed to converge this stack.", "Inspect the stack's service tasks on the selected manager, resolve the reported Docker condition, then retry only if the change is still missing."
	default:
		return "stack_operation_failed", "The machine agent reported that the Docker operation failed.", "Inspect the target's current state on the selected manager before retrying."
	}
}

// uploadFailureDiagnostic explains why source input never reached the sealed
// command store. The record used to carry one sentence — "Command input upload
// did not complete" — for a limit that was exceeded, a controller disk with no
// space left, and a provider stream that ended early, which are three
// different problems with three different fixes and only one of them worth
// retrying unchanged. The underlying error itself is never copied into the
// ledger: it carries controller paths.
func uploadFailureDiagnostic(err error, limit int64) (code, summary, recovery string) {
	message := ""
	if err != nil {
		message = strings.ToLower(err.Error())
	}
	switch {
	case strings.Contains(message, "encrypted state source exceeds"), strings.Contains(message, "http: request body too large"):
		return "source_input_too_large",
			fmt.Sprintf("The source input is larger than this controller's %d MiB build limit.", limit>>20),
			"Reduce what the build context carries — a .dockerignore excluding vendor, node_modules, build output and history is usually enough — or raise SWARMOPS_BUILD_MAX_BYTES on the controller, then submit again."
	case strings.Contains(message, "no space left on device"):
		return "controller_storage_full",
			"The controller has no disk space left to store the source input.",
			"Free space in the controller's state directory — Controller & recovery reports what it holds — then submit again. The command ledger is written before any operation runs, so this disk must never fill."
	case strings.Contains(message, "permission denied"), strings.Contains(message, "read-only file system"):
		return "controller_storage_unwritable",
			"The controller could not write to its own state directory.",
			"Check the ownership and mount of the controller's state directory, then submit again."
	// Everything below this point is deterministic: the same submission fails
	// the same way, so telling the operator to "submit again" would be advice
	// that cannot work. These reach the store as read errors on the pipe that
	// normalizes the provider archive, which is why they have to be matched
	// before the stream case.
	case strings.Contains(message, "file limit"):
		return "build_context_too_many_files",
			"The build context holds more files than a deployment may carry.",
			"Exclude what the image does not need — a .dockerignore covering vendor, node_modules, build output and .git is usually enough — then submit again."
	case strings.Contains(message, "build context exceeds"), strings.Contains(message, "provider archive exceeds"):
		return "build_context_too_large",
			"The build context is larger than this controller allows.",
			"Exclude what the image does not need with a .dockerignore, or raise the configured archive limit on the controller, then submit again."
	case strings.Contains(message, "symbolic link or special file"):
		return "build_context_unsupported_entry",
			"The build context contains a symbolic link or a special file, which is not carried into a build.",
			"Replace it with a regular file, or move the build context to a directory that does not contain it, then submit again."
	case strings.Contains(message, "no regular files"):
		return "build_context_empty",
			"The selected build context contains no regular files.",
			"Check the build context path against the repository — a path that matches nothing produces an empty context — then submit again."
	case strings.Contains(message, "repository root"), strings.Contains(message, "invalid path"), strings.Contains(message, "invalid root"):
		return "provider_archive_malformed",
			"The archive the provider returned is not shaped like a repository export.",
			"Verify the repository and revision resolve to a normal source archive; nothing was stored."
	case strings.Contains(message, "open provider archive"):
		return "provider_archive_unreadable",
			"The provider returned something that is not a gzipped source archive, which usually means the request was answered by an error or a login page.",
			"Check the connection's token and its scope for this repository, then submit again."
	case strings.Contains(message, "archive request failed with status"):
		return "provider_archive_rejected",
			"The provider refused the archive request for this revision.",
			"Check that the connection still has access to the repository and that the revision exists, then submit again."
	// A cancelled request reaches the store wrapped in the same read error as
	// an interrupted stream, so it has to be matched first or it is reported
	// as a network fault the operator cannot find.
	case strings.Contains(message, "context canceled"), strings.Contains(message, "context deadline exceeded"):
		return "source_input_canceled",
			"The request carrying the source input ended before the archive was stored.",
			"Submit again and leave the deployment screen open; closing the tab, a reverse-proxy timeout, or navigating away all end the request this way."
	case strings.Contains(message, "unexpected eof"), strings.Contains(message, "connection reset"), strings.Contains(message, "broken pipe"), strings.Contains(message, "read encrypted state source"), strings.Contains(message, "made no progress"):
		return "source_input_stream_failed",
			"The source input stream ended before the whole archive arrived.",
			"Nothing was stored and no build ran. Check that the provider is reachable from the controller and that the revision still resolves, then submit again from the deployment screen."
	default:
		return "source_input_not_stored",
			"The controller could not store the source input.",
			"Nothing was stored and no build ran. Submit a new command with the source input; if it fails again, check the controller's disk and its state directory."
	}
}

// failureNarrative is what a run says about itself in one line, wherever it is
// listed. It used to be one of two fixed sentences — "Execution failed; retry
// scheduled with backoff." — which said only what the state badge beside it
// already said, so an operator watching four stacks fail could not tell from
// the console whether they had failed for the same reason or four different
// ones.
func failureNarrative(command domain.Command) string {
	summary := strings.TrimSpace(command.FailureSummary)
	if summary == "" {
		summary = "SwarmOps could not confirm that the requested change completed."
	}
	if command.State == domain.CommandRetryScheduled {
		return fmt.Sprintf("%s Attempt %d of %d failed; a retry is scheduled with backoff.", summary, command.Attempt, command.MaxAttempts)
	}
	return fmt.Sprintf("%s Attempt %d of %d failed and no retry is scheduled; inspect the target before retrying.", summary, command.Attempt, command.MaxAttempts)
}

func setCommandFailureDiagnostic(command *domain.Command, err error) {
	command.FailureCode, command.FailureSummary, command.RecoveryHint = commandFailureDiagnostic(command.Action, err)
}

// logUnclassifiedFailure keeps the cause of a failure the classifier could not
// name.
//
// A classified failure carries its own reason to the operator. An unclassified
// one carried nothing: the error reached commandFailureDiagnostic, was matched
// against every known pattern, and was then dropped — LastError is rebuilt from
// the generic summary, so the ledger, the console and the CLI all reported
// "SwarmOps could not confirm that the requested change completed" and there
// was nowhere left to look. The cause was destroyed at the only point that
// still had it.
//
// The log is not the ledger and not the browser, so the boundary that keeps
// remote output out of both is intact: this is the operator's own controller
// log, bounded in length, and it is written only when SwarmOps has nothing
// else to say.
func (s *Store) logUnclassifiedFailure(command domain.Command, err error) {
	if err == nil || command.FailureCode != FailureCodeUnclassified {
		return
	}
	s.logger().Warn("command failed with no classified cause",
		"action", command.Action,
		"attempt", command.Attempt,
		"cause", boundedCause(err.Error()),
		"command_id", command.ID,
		"server_id", command.ServerID,
		"target", command.Target,
	)
}

func (s *Store) logger() *slog.Logger {
	if s.log != nil {
		return s.log
	}
	return slog.Default()
}

// SetLogger directs the store's diagnostics at the controller's own logger. A
// store without one still logs, through the process default.
func (s *Store) SetLogger(logger *slog.Logger) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.log = logger
}

func boundedCause(cause string) string {
	cause = strings.TrimSpace(cause)
	if len(cause) <= maxLoggedCause {
		return cause
	}
	return cause[:maxLoggedCause] + "… (truncated)"
}

func clearCommandFailureDiagnostic(command *domain.Command) {
	command.FailureCode = ""
	command.FailureSummary = ""
	command.RecoveryHint = ""
}
