package apihttp

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/nimasrn/SwarmOps/internal/auth"
	"github.com/nimasrn/SwarmOps/internal/dockerapi"
	"github.com/nimasrn/SwarmOps/internal/domain"
	"github.com/nimasrn/SwarmOps/internal/mobility"
	"github.com/nimasrn/SwarmOps/internal/ops"
	"github.com/nimasrn/SwarmOps/internal/queue"
	"github.com/nimasrn/SwarmOps/internal/remote"
)

const (
	commandMobilityMove   = "mobility.move"
	commandMobilityRetire = "mobility.retire"
	mobilityPollInterval  = 5 * time.Second
)

type mobilityCommand struct {
	MigrationID string `json:"migrationId"`
}

type mobilityMoveInput struct {
	TargetServerID string `json:"targetServerId"`
}

type mobilityAbandonInput struct {
	Confirmation string `json:"confirmation"`
}

// mobilityStatus is intentionally independent of the selected remote manager:
// an operator can still see a handover's state while a control-plane move is
// reconnecting the remote machine agents from sealed state.
func (s *Server) mobilityStatus(response http.ResponseWriter, _ *http.Request, _ auth.Claims) {
	resources := mobility.Resources()
	migrations := []mobility.Migration{}
	if s.mobility != nil {
		migrations = s.mobility.List()
	}
	writeJSON(response, http.StatusOK, map[string]any{"migrations": migrations, "resources": resources})
}

// mobilityMove admits a reviewed, service-and-volume-specific handover. The
// browser can choose only a resource and another enrolled server; source
// placement, volume names, service names, and all archive paths are resolved
// from the live Swarm and the fixed catalog.
func (s *Server) mobilityMove(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
	definition, err := mobility.ResourceFor(request.PathValue("resource"))
	if err != nil {
		writeError(response, http.StatusNotFound, "Unknown movable resource")
		return
	}
	for _, migration := range s.mobility.List() {
		if !mobility.IsTerminal(migration.State) {
			writeError(response, http.StatusConflict, "A durable handover is already in progress. Complete or review it before starting another.")
			return
		}
	}
	var input mobilityMoveInput
	if !decodeJSON(response, request, &input) {
		return
	}
	serverID, idempotencyKey, ok := s.commandSubmissionContext(response, request)
	if !ok {
		return
	}
	control, targetNodeID, err := s.validateMobilityTarget(request.Context(), serverID, input.TargetServerID, definition)
	if err != nil {
		s.operationError(response, request, err)
		return
	}
	if control == nil {
		writeError(response, http.StatusConflict, "Select a remote Swarm manager before moving data")
		return
	}
	migration, err := s.mobility.New(definition, strings.TrimSpace(input.TargetServerID), targetNodeID)
	if err != nil {
		s.commandStoreError(response, request, err)
		return
	}
	payload, err := json.Marshal(mobilityCommand{MigrationID: migration.ID})
	if err != nil {
		_ = s.mobility.DiscardPlanned(migration.ID)
		writeError(response, http.StatusInternalServerError, "Handover could not be queued")
		return
	}
	command, created, err := s.commands.Submit(queue.SubmitInput{
		Action:         commandMobilityMove,
		Actor:          claims.Username,
		AutoRetry:      false,
		IdempotencyKey: idempotencyKey,
		MaxAttempts:    1,
		Payload:        payload,
		RequestID:      requestID(request),
		ServerID:       serverID,
		Target:         "mobility/" + migration.Resource + "/" + migration.ID,
	})
	if err != nil {
		_ = s.mobility.DiscardPlanned(migration.ID)
		if errors.Is(err, queue.ErrIdempotencyConflict) {
			writeError(response, http.StatusConflict, "Idempotency key was already used for a different command")
			return
		}
		s.commandStoreError(response, request, err)
		return
	}
	if created {
		s.record(claims.Username, requestID(request), "command.queued", "command/"+command.ID, nil, commandAuditDetail(command))
	}
	writeJSON(response, http.StatusAccepted, command)
}

// mobilityRetire is deliberately a second, explicit action. The source
// volumes remain intact throughout burn-in, so this endpoint can never be
// reached as part of the automatic copy-and-start path.
func (s *Server) mobilityRetire(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
	if s.mobility == nil {
		writeError(response, http.StatusServiceUnavailable, "SwarmOps mobility storage is unavailable")
		return
	}
	migration, found := s.mobility.Get(request.PathValue("id"))
	if !found {
		writeError(response, http.StatusNotFound, "Handover was not found")
		return
	}
	if migration.State != mobility.StateReadyForRetirement || migration.CleanupEligibleAt == nil || time.Now().Before(*migration.CleanupEligibleAt) {
		writeError(response, http.StatusConflict, "The replacement has not completed its healthy burn-in")
		return
	}
	serverID, idempotencyKey, ok := s.commandSubmissionContext(response, request)
	if !ok {
		return
	}
	if _, err := s.targets.Resolve(serverID); err != nil {
		s.operationError(response, request, err)
		return
	}
	payload, err := json.Marshal(mobilityCommand{MigrationID: migration.ID})
	if err != nil {
		writeError(response, http.StatusInternalServerError, "Source retirement could not be queued")
		return
	}
	command, created, err := s.commands.Submit(queue.SubmitInput{
		Action:         commandMobilityRetire,
		Actor:          claims.Username,
		AutoRetry:      false,
		IdempotencyKey: idempotencyKey,
		MaxAttempts:    1,
		Payload:        payload,
		RequestID:      requestID(request),
		ServerID:       serverID,
		Target:         "mobility/" + migration.Resource + "/" + migration.ID + "/retire",
	})
	if err != nil {
		if errors.Is(err, queue.ErrIdempotencyConflict) {
			writeError(response, http.StatusConflict, "Idempotency key was already used for a different command")
			return
		}
		s.commandStoreError(response, request, err)
		return
	}
	if created {
		s.record(claims.Username, requestID(request), "command.queued", "command/"+command.ID, nil, commandAuditDetail(command))
	}
	writeJSON(response, http.StatusAccepted, command)
}

// mobilityAbandon is an explicit recovery release for a handover that failed
// before source cleanup could start. It is intentionally a local ledger
// transition, never a Docker operation: no volume, service, or target is
// removed or changed. A typed confirmation makes the operator acknowledge
// that manual workload/data review remains their responsibility.
func (s *Server) mobilityAbandon(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
	if s.mobility == nil {
		writeError(response, http.StatusServiceUnavailable, "SwarmOps mobility storage is unavailable")
		return
	}
	migration, found := s.mobility.Get(request.PathValue("id"))
	if !found {
		writeError(response, http.StatusNotFound, "Handover was not found")
		return
	}
	if migration.State != mobility.StateNeedsAttention {
		writeError(response, http.StatusConflict, "Only a handover needing attention can be closed")
		return
	}
	if migration.SourceCleanupStarted {
		writeError(response, http.StatusConflict, "Source cleanup may have started. Keep this handover open for recovery review.")
		return
	}
	var input mobilityAbandonInput
	if !decodeJSON(response, request, &input) {
		return
	}
	expected := "ABANDON_HANDOVER_" + migration.ID
	if strings.TrimSpace(input.Confirmation) != expected {
		writeError(response, http.StatusUnprocessableEntity, "closing this handover requires confirmation "+expected)
		return
	}
	if err := s.audit.Writable(); err != nil {
		s.commandStoreError(response, request, err)
		return
	}
	updated, err := s.mobility.Abandon(migration.ID)
	if err != nil {
		s.commandStoreError(response, request, err)
		return
	}
	s.record(claims.Username, requestID(request), "mobility.abandoned", "mobility/"+updated.Resource+"/"+updated.ID, nil, map[string]string{"source_data": "retained"})
	writeJSON(response, http.StatusOK, updated)
}

func (s *Server) validateMobilityTarget(ctx context.Context, managerID, targetServerID string, definition mobility.ResourceDefinition) (*ops.ControlPlane, string, error) {
	target, err := s.targets.Resolve(strings.TrimSpace(managerID))
	if err != nil {
		return nil, "", err
	}
	if target.Control == nil || target.Control.Docker == nil {
		return nil, "", fmt.Errorf("selected server has no compatible control plane")
	}
	connection, err := s.servers.Resolve(strings.TrimSpace(targetServerID))
	if err != nil {
		return nil, "", err
	}
	if connection.Profile.ConnectionType != remote.ConnectionAgentAPI || !connection.Profile.Managed || !connection.Profile.MobilityAvailable {
		return nil, "", fmt.Errorf("target server must be an enrolled agent with managed mobility enabled")
	}
	if _, ok := connection.Runner.(remote.VolumeMover); !ok {
		return nil, "", fmt.Errorf("target server does not support managed volume transfer")
	}
	targetNodeID, clusterID, err := s.servers.NodeIdentity(ctx, targetServerID)
	if err != nil {
		return nil, "", err
	}
	managerInfo, err := target.Control.Docker.Info(ctx)
	if err != nil {
		return nil, "", fmt.Errorf("read selected manager Swarm identity: %w", err)
	}
	if managerInfo.Swarm.Cluster.ID == "" || managerInfo.Swarm.Cluster.ID != clusterID {
		return nil, "", fmt.Errorf("target server is not in the selected Swarm")
	}
	nodes, err := target.Control.Docker.ListNodes(ctx)
	if err != nil {
		return nil, "", fmt.Errorf("read target Swarm node: %w", err)
	}
	for _, node := range nodes {
		if node.ID != targetNodeID {
			continue
		}
		if strings.ToLower(node.Status.State) != "ready" || strings.ToLower(node.Spec.Availability) != "active" {
			return nil, "", fmt.Errorf("target Swarm node is not ready and active")
		}
		if node.Spec.Labels[definition.RequiredNodeLabel] != "true" {
			return nil, "", fmt.Errorf("target Swarm node is missing required label %s=true", definition.RequiredNodeLabel)
		}
		if definition.RequireManager && strings.ToLower(node.Spec.Role) != "manager" {
			return nil, "", fmt.Errorf("control-plane target must be a Swarm manager")
		}
		return target.Control, targetNodeID, nil
	}
	return nil, "", fmt.Errorf("target Swarm node is unavailable")
}

func (s *Server) executeMobilityMove(ctx context.Context, record queue.Record) (err error) {
	var input mobilityCommand
	if err := decodeCommandPayload(record.Payload, &input); err != nil {
		return queue.PermanentError(err)
	}
	migration, found := s.mobility.Get(input.MigrationID)
	if !found {
		return queue.PermanentError(fmt.Errorf("migration record is unavailable"))
	}
	if migration.State != mobility.StatePlanned {
		return queue.PermanentError(fmt.Errorf("migration is not awaiting execution"))
	}
	definition, err := mobility.ResourceFor(migration.Resource)
	if err != nil {
		return queue.PermanentError(err)
	}
	defer func() {
		if err != nil && !errors.Is(err, queue.ErrExecutorHandoff) {
			s.markMigrationNeedsAttention(migration.ID)
		}
	}()
	control, targetNodeID, err := s.validateMobilityTarget(ctx, record.Command.ServerID, migration.TargetServerID, definition)
	if err != nil {
		return queue.PermanentError(err)
	}
	if targetNodeID != migration.TargetNodeID {
		return queue.PermanentError(fmt.Errorf("migration target identity changed before execution"))
	}
	var logErr error
	if definition.Resource == mobility.ResourceControlPlane {
		// The source volume is copied after the fence is written. Do not append
		// Docker service-update output after that copy or the source command
		// ledger could become newer than the replacement's archive.
		control.SetCommandOutput(nil)
	} else {
		control.SetCommandOutput(func(output string) {
			if logErr != nil {
				return
			}
			logErr = s.appendCommandLog(record.Command, "machine", "info", output)
		})
	}
	defer func() {
		if logErr != nil && err == nil {
			err = queue.PermanentError(fmt.Errorf("persist managed handover output: %w", logErr))
		}
	}()
	targetConnection, err := s.servers.Resolve(migration.TargetServerID)
	if err != nil {
		return err
	}
	targetMover, ok := targetConnection.Runner.(remote.VolumeMover)
	if !ok {
		return queue.PermanentError(fmt.Errorf("target server does not support managed volume transfer"))
	}
	if err := s.setMigrationState(migration.ID, mobility.StateQuiescing); err != nil {
		return queue.PermanentError(err)
	}
	if err := s.appendCommandLog(record.Command, "controller", "info", "Preflight passed. The reviewed handover is resolving the live source placement."); err != nil {
		return queue.PermanentError(fmt.Errorf("persist command log: %w", err))
	}
	for index, component := range migration.Components {
		if err := s.executeMobilityComponent(ctx, record.Command, control, targetNodeID, targetMover, migration.ID, index, component, definition.Resource == mobility.ResourceControlPlane); err != nil {
			return classifyCommandError(err)
		}
		// A control-plane service move stops the current API task. Once the
		// Docker manager accepts its update this process may lose its own
		// volume immediately, so the replacement owns burn-in and retirement.
		if definition.Resource == mobility.ResourceControlPlane {
			return queue.ErrExecutorHandoff
		}
	}
	if err := s.setMigrationReady(migration.ID); err != nil {
		return queue.PermanentError(err)
	}
	return nil
}

func (s *Server) executeMobilityComponent(ctx context.Context, command domain.Command, control *ops.ControlPlane, targetNodeID string, targetMover remote.VolumeMover, migrationID string, index int, component mobility.ComponentState, controlPlane bool) error {
	sourceNodeID, err := runningServiceNode(ctx, control.Docker, component.Service)
	if err != nil {
		return err
	}
	if sourceNodeID == targetNodeID {
		return fmt.Errorf("managed service is already placed on the selected target")
	}
	sourceConnection, sourceProfile, err := s.servers.ResolveNode(ctx, sourceNodeID)
	if err != nil {
		return err
	}
	sourceMover, ok := sourceConnection.Runner.(remote.VolumeMover)
	if !ok {
		return fmt.Errorf("source node does not support managed volume transfer")
	}
	if err := s.updateMigrationComponent(migrationID, index, func(value *mobility.ComponentState, record *mobility.Migration) {
		value.SourceNodeID = sourceNodeID
		value.State = mobility.StateQuiescing
		if !contains(record.SourceServerIDs, sourceProfile.ID) {
			record.SourceServerIDs = append(record.SourceServerIDs, sourceProfile.ID)
		}
	}); err != nil {
		return err
	}
	if err := s.appendCommandLog(command, "controller", "info", "Source placement resolved. The service is being quiesced before its local volume is copied."); err != nil {
		return err
	}
	if !controlPlane {
		if err := control.ScaleManagedService(ctx, component.Service, 0); err != nil {
			return err
		}
		if err := waitForServiceStopped(ctx, control.Docker, component.Service); err != nil {
			return err
		}
	}
	if err := s.updateMigrationComponent(migrationID, index, func(value *mobility.ComponentState, _ *mobility.Migration) {
		value.State = mobility.StateCopying
	}); err != nil {
		return err
	}
	if err := s.setMigrationState(migrationID, mobility.StateCopying); err != nil {
		return err
	}
	if err := s.appendCommandLog(command, "controller", "info", "The quiesced local volume is streaming through the pinned machine agents with an integrity receipt."); err != nil {
		return err
	}
	// The control-plane volume is the state this process is about to copy. Mark
	// it as starting before the archive begins, so the replacement receives the
	// durable handover state it must observe after this API task is moved. For
	// other resources we can record this state after their source copy because
	// the current controller remains available throughout their burn-in.
	if controlPlane {
		if err := s.updateMigrationComponent(migrationID, index, func(value *mobility.ComponentState, _ *mobility.Migration) {
			value.State = mobility.StateStarting
		}); err != nil {
			return err
		}
		if err := s.setMigrationState(migrationID, mobility.StateStarting); err != nil {
			return err
		}
	}
	archive, err := sourceMover.ExportVolume(ctx, component.Volume)
	if err != nil {
		return err
	}
	defer archive.Close()
	hash := sha256.New()
	count := &streamCounter{writer: hash}
	receipt, err := targetMover.ImportVolume(ctx, component.Volume, migrationID, io.TeeReader(archive, count))
	if err != nil {
		return err
	}
	if receipt.Bytes != count.bytes || !strings.EqualFold(receipt.Digest, hex.EncodeToString(hash.Sum(nil))) {
		return fmt.Errorf("managed volume transfer integrity check failed")
	}
	if !controlPlane {
		if err := s.updateMigrationComponent(migrationID, index, func(value *mobility.ComponentState, _ *mobility.Migration) {
			value.Bytes = receipt.Bytes
			value.State = mobility.StateStarting
		}); err != nil {
			return err
		}
		if err := s.setMigrationState(migrationID, mobility.StateStarting); err != nil {
			return err
		}
	}
	if err := control.MoveManagedService(ctx, component.Service, targetNodeID); err != nil {
		return err
	}
	if controlPlane {
		return nil
	}
	if err := control.ScaleManagedService(ctx, component.Service, 1); err != nil {
		return err
	}
	if err := s.setMigrationState(migrationID, mobility.StateBurnIn); err != nil {
		return err
	}
	if err := s.updateMigrationComponent(migrationID, index, func(value *mobility.ComponentState, _ *mobility.Migration) {
		value.State = mobility.StateBurnIn
		value.HealthySince = nil
	}); err != nil {
		return err
	}
	return s.waitForMobilityHealth(ctx, migrationID, index, control.Docker, component.Service, targetNodeID)
}

func (s *Server) waitForMobilityHealth(ctx context.Context, migrationID string, index int, docker *dockerapi.Client, service, targetNodeID string) error {
	ticker := time.NewTicker(mobilityPollInterval)
	defer ticker.Stop()
	var healthySince time.Time
	for {
		healthy, err := serviceHealthyOnNode(ctx, docker, service, targetNodeID)
		if err != nil {
			return err
		}
		if healthy {
			if healthySince.IsZero() {
				healthySince = time.Now().UTC()
				if err := s.updateMigrationComponent(migrationID, index, func(value *mobility.ComponentState, _ *mobility.Migration) {
					value.HealthySince = &healthySince
				}); err != nil {
					return err
				}
			}
			if time.Since(healthySince) >= s.config.MobilityHealthyFor {
				return nil
			}
		} else if !healthySince.IsZero() {
			healthySince = time.Time{}
			if err := s.updateMigrationComponent(migrationID, index, func(value *mobility.ComponentState, _ *mobility.Migration) {
				value.HealthySince = nil
			}); err != nil {
				return err
			}
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
		}
	}
}

func (s *Server) executeMobilityRetire(ctx context.Context, record queue.Record) (err error) {
	var input mobilityCommand
	if err := decodeCommandPayload(record.Payload, &input); err != nil {
		return queue.PermanentError(err)
	}
	migration, found := s.mobility.Get(input.MigrationID)
	if !found {
		return queue.PermanentError(fmt.Errorf("migration record is unavailable"))
	}
	if migration.State != mobility.StateReadyForRetirement || migration.CleanupEligibleAt == nil || time.Now().Before(*migration.CleanupEligibleAt) {
		return queue.PermanentError(fmt.Errorf("replacement healthy burn-in is incomplete"))
	}
	target, err := s.targets.Resolve(record.Command.ServerID)
	if err != nil {
		return err
	}
	if target.Control == nil || target.Control.Docker == nil {
		return queue.PermanentError(fmt.Errorf("selected server has no compatible control-plane capability"))
	}
	clusterID, err := s.retirementClusterID(ctx, target.Control.Docker, migration)
	if err != nil {
		return queue.PermanentError(err)
	}
	if err := retirementTargetHealthy(ctx, target.Control.Docker, migration); err != nil {
		return queue.PermanentError(err)
	}
	cleanupStarted := false
	defer func() {
		if err != nil && cleanupStarted {
			s.markMigrationNeedsAttention(migration.ID)
		}
	}()
	var logErr error
	target.Control.SetCommandOutput(func(output string) {
		if logErr != nil {
			return
		}
		logErr = s.appendCommandLog(record.Command, "machine", "info", output)
	})
	defer func() {
		if logErr != nil && err == nil {
			err = queue.PermanentError(fmt.Errorf("persist managed retirement output: %w", logErr))
		}
	}()
	if _, err := s.mobility.Update(migration.ID, func(value *mobility.Migration) error {
		value.State = mobility.StateRetiring
		value.SourceCleanupStarted = true
		return nil
	}); err != nil {
		return queue.PermanentError(err)
	}
	cleanupStarted = true
	if err := s.appendCommandLog(record.Command, "controller", "info", "The administrator approved source retirement. SwarmOps is verifying that no replacement service task remains on a source node."); err != nil {
		return queue.PermanentError(fmt.Errorf("persist command log: %w", err))
	}
	for _, component := range migration.Components {
		if component.SourceNodeID == "" {
			return queue.PermanentError(fmt.Errorf("source placement evidence is unavailable"))
		}
		running, err := serviceRunningOnNode(ctx, target.Control.Docker, component.Service, component.SourceNodeID)
		if err != nil {
			return err
		}
		if running {
			return queue.PermanentError(fmt.Errorf("source service task is still running"))
		}
		sourceConnection, sourceProfile, err := s.servers.ResolveNode(ctx, component.SourceNodeID)
		if err != nil {
			return err
		}
		sourceNodeID, sourceClusterID, err := s.servers.NodeIdentity(ctx, sourceProfile.ID)
		if err != nil {
			return err
		}
		if sourceNodeID != component.SourceNodeID || sourceClusterID != clusterID {
			return queue.PermanentError(fmt.Errorf("source server is not in the migrated Swarm"))
		}
		mover, ok := sourceConnection.Runner.(remote.VolumeMover)
		if !ok {
			return queue.PermanentError(fmt.Errorf("source node does not support managed source cleanup"))
		}
		if err := mover.RemoveVolume(ctx, component.Volume); err != nil {
			return err
		}
	}
	if _, err := s.mobility.Update(migration.ID, func(value *mobility.Migration) error {
		value.State = mobility.StateRetired
		for index := range value.Components {
			value.Components[index].State = mobility.StateRetired
		}
		return nil
	}); err != nil {
		return queue.PermanentError(err)
	}
	return nil
}

// retirementClusterID refuses cleanup unless the selected manager and the
// recorded target agent still identify the exact same Swarm and target node.
// This prevents a stale browser selection or a rejoined host from making an
// unrelated cluster look empty and triggering source-volume deletion.
func (s *Server) retirementClusterID(ctx context.Context, docker *dockerapi.Client, migration mobility.Migration) (string, error) {
	if docker == nil {
		return "", fmt.Errorf("selected manager Docker Engine is unavailable")
	}
	managerInfo, err := docker.Info(ctx)
	if err != nil {
		return "", fmt.Errorf("read selected manager Swarm identity: %w", err)
	}
	if !managerInfo.Swarm.ControlAvailable || strings.TrimSpace(managerInfo.Swarm.Cluster.ID) == "" {
		return "", fmt.Errorf("selected server is not in an active Swarm")
	}
	targetNodeID, targetClusterID, err := s.servers.NodeIdentity(ctx, migration.TargetServerID)
	if err != nil {
		return "", err
	}
	if targetNodeID != migration.TargetNodeID || targetClusterID != managerInfo.Swarm.Cluster.ID {
		return "", fmt.Errorf("selected manager is not the Swarm that received this handover")
	}
	return targetClusterID, nil
}

// retirementTargetHealthy rechecks the exact replacement placement immediately
// before any source volume is deleted. Burn-in proves sustained health at one
// point in time; this second check protects the gap between that proof and an
// administrator's later cleanup decision.
func retirementTargetHealthy(ctx context.Context, docker *dockerapi.Client, migration mobility.Migration) error {
	for _, component := range migration.Components {
		healthy, err := serviceHealthyOnNode(ctx, docker, component.Service, migration.TargetNodeID)
		if err != nil {
			return err
		}
		if !healthy {
			return fmt.Errorf("replacement service is not healthy on the handover target")
		}
	}
	return nil
}

func (s *Server) setMigrationState(id, state string) error {
	_, err := s.mobility.Update(id, func(value *mobility.Migration) error {
		value.State = state
		return nil
	})
	return err
}

func (s *Server) setMigrationReady(id string) error {
	_, err := s.mobility.Update(id, func(value *mobility.Migration) error {
		now := time.Now().UTC()
		value.State = mobility.StateReadyForRetirement
		value.CleanupEligibleAt = &now
		for index := range value.Components {
			value.Components[index].State = mobility.StateReadyForRetirement
		}
		return nil
	})
	return err
}

func (s *Server) updateMigrationComponent(id string, index int, change func(*mobility.ComponentState, *mobility.Migration)) error {
	_, err := s.mobility.Update(id, func(value *mobility.Migration) error {
		if index < 0 || index >= len(value.Components) {
			return fmt.Errorf("migration component is unavailable")
		}
		change(&value.Components[index], value)
		return nil
	})
	return err
}

func (s *Server) markMigrationNeedsAttention(id string) {
	if s.mobility == nil {
		return
	}
	_, _ = s.mobility.Update(id, func(value *mobility.Migration) error {
		if value.State != mobility.StateRetired {
			value.State = mobility.StateNeedsAttention
			if value.SourceCleanupStarted {
				// Once source retirement has been durably authorised, a failed
				// worker can be interrupted between individual volume removals.
				// Report ambiguity rather than implying that every source remains.
				value.Failure = "Source cleanup may have begun. Inspect source and target data before recovery; this handover cannot be closed automatically."
			} else {
				value.Failure = "The handover needs operator review. Source data was retained."
			}
		}
		return nil
	})
}

func runningServiceNode(ctx context.Context, docker *dockerapi.Client, service string) (string, error) {
	if docker == nil {
		return "", fmt.Errorf("selected Docker Engine is unavailable")
	}
	tasks, err := docker.ListTasks(ctx, map[string][]string{"service": {service}})
	if err != nil {
		return "", fmt.Errorf("read managed service task: %w", err)
	}
	var nodes []string
	for _, task := range tasks {
		if strings.EqualFold(task.Status.State, "running") && strings.TrimSpace(task.NodeID) != "" {
			nodes = append(nodes, task.NodeID)
		}
	}
	if len(nodes) == 0 {
		return "", fmt.Errorf("managed service is not running")
	}
	if len(nodes) != 1 {
		return "", fmt.Errorf("managed service has more than one running task")
	}
	return nodes[0], nil
}

func waitForServiceStopped(ctx context.Context, docker *dockerapi.Client, service string) error {
	ticker := time.NewTicker(mobilityPollInterval)
	defer ticker.Stop()
	for {
		running, err := serviceRunningOnNode(ctx, docker, service, "")
		if err != nil {
			return err
		}
		if !running {
			return nil
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
		}
	}
}

func serviceRunningOnNode(ctx context.Context, docker *dockerapi.Client, service, nodeID string) (bool, error) {
	if docker == nil {
		return false, fmt.Errorf("selected Docker Engine is unavailable")
	}
	tasks, err := docker.ListTasks(ctx, map[string][]string{"service": {service}})
	if err != nil {
		return false, fmt.Errorf("read managed service task: %w", err)
	}
	for _, task := range tasks {
		if strings.EqualFold(task.Status.State, "running") && (nodeID == "" || task.NodeID == nodeID) {
			return true, nil
		}
	}
	return false, nil
}

func serviceHealthyOnNode(ctx context.Context, docker *dockerapi.Client, service, nodeID string) (bool, error) {
	if docker == nil {
		return false, fmt.Errorf("selected Docker Engine is unavailable")
	}
	tasks, err := docker.ListTasks(ctx, map[string][]string{"service": {service}})
	if err != nil {
		return false, fmt.Errorf("read managed service task: %w", err)
	}
	var running []dockerapi.Task
	for _, task := range tasks {
		if strings.EqualFold(task.Status.State, "running") {
			running = append(running, task)
		}
	}
	if len(running) != 1 || running[0].NodeID != nodeID || strings.TrimSpace(running[0].Status.ContainerStatus.ContainerID) == "" {
		return false, nil
	}
	health, err := docker.ContainerHealth(ctx, running[0].Status.ContainerStatus.ContainerID)
	if err != nil {
		return false, fmt.Errorf("read managed service health: %w", err)
	}
	if !health.Running {
		return false, nil
	}
	return health.Health == "" || strings.EqualFold(health.Health, "healthy"), nil
}

type streamCounter struct {
	bytes  int64
	writer io.Writer
}

func (w *streamCounter) Write(value []byte) (int, error) {
	written, err := w.writer.Write(value)
	w.bytes += int64(written)
	return written, err
}

func contains(values []string, wanted string) bool {
	for _, value := range values {
		if value == wanted {
			return true
		}
	}
	return false
}

func (s *Server) controlPlaneHandoverActive() bool {
	if s.mobility == nil {
		return false
	}
	for _, migration := range s.mobility.List() {
		if migration.Resource == mobility.ResourceControlPlane && !mobility.IsTerminal(migration.State) {
			return true
		}
	}
	return false
}

// observeControlPlaneHandover advances only a restored control plane running
// on its nominated target. Docker's container healthcheck reaches /healthz on
// every interval, so this gives the replacement a sustained independent
// liveness window before the old local volume can be retired.
func (s *Server) observeControlPlaneHandover() error {
	if s.mobility == nil || strings.TrimSpace(s.config.InstanceNodeID) == "" {
		return nil
	}
	for _, migration := range s.mobility.List() {
		if migration.Resource != mobility.ResourceControlPlane || migration.TargetNodeID != s.config.InstanceNodeID {
			continue
		}
		if migration.State != mobility.StateStarting && migration.State != mobility.StateBurnIn {
			continue
		}
		_, err := s.mobility.Update(migration.ID, func(record *mobility.Migration) error {
			now := time.Now().UTC()
			if record.State == mobility.StateStarting {
				record.State = mobility.StateBurnIn
				for index := range record.Components {
					record.Components[index].State = mobility.StateBurnIn
					record.Components[index].HealthySince = &now
				}
				return nil
			}
			if record.State != mobility.StateBurnIn || len(record.Components) != 1 || record.Components[0].HealthySince == nil {
				return fmt.Errorf("control-plane handover health state is invalid")
			}
			if now.Sub(*record.Components[0].HealthySince) >= s.config.MobilityHealthyFor {
				record.State = mobility.StateReadyForRetirement
				record.Components[0].State = mobility.StateReadyForRetirement
				record.CleanupEligibleAt = &now
			}
			return nil
		})
		return err
	}
	return nil
}
