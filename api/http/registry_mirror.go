package apihttp

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/nimasrn/SwarmOps/internal/agentcontrol"
	"github.com/nimasrn/SwarmOps/internal/auth"
	"github.com/nimasrn/SwarmOps/internal/queue"
)

// The image mirror is a fleet-wide fact, not a per-machine one.
//
// A registry mirror that is set on four machines out of five is worse than no
// mirror at all: the fifth still pulls from Docker Hub, and the service that
// happens to land there is the one that fails when Hub is slow, blocked, or
// rate-limiting. So this lives in the Core panel and is applied to every
// enrolled agent in one reviewed action, and the read below reports each
// machine's ACTUAL daemon configuration so a machine that drifted is visible
// rather than assumed.

const registryMirrorReadTimeout = 6 * time.Second

type registryMirrorMachine struct {
	Mirrors   []string `json:"mirrors,omitempty"`
	Reachable bool     `json:"reachable"`
	Reason    string   `json:"reason,omitempty"`
	ServerID  string   `json:"serverId"`
	Name      string   `json:"name"`
	Supported bool     `json:"supported"`
}

type registryMirrorFleet struct {
	Consistent bool                    `json:"consistent"`
	Machines   []registryMirrorMachine `json:"machines"`
	Mirrors    []string                `json:"mirrors,omitempty"`
}

// coreRegistryMirrors asks every enrolled agent what its daemon is actually
// using. It never reads a stored intent: the machines are the record.
func (s *Server) coreRegistryMirrors(response http.ResponseWriter, request *http.Request, _ auth.Claims) {
	servers := s.servers.List()
	machines := make([]registryMirrorMachine, len(servers))
	var group sync.WaitGroup
	for index, server := range servers {
		group.Add(1)
		go func(index int, id, name string) {
			defer group.Done()
			machines[index] = s.readRegistryMirrors(request.Context(), id, name)
		}(index, server.ID, server.Name)
	}
	group.Wait()
	sort.Slice(machines, func(a, b int) bool { return machines[a].Name < machines[b].Name })

	fleet := registryMirrorFleet{Consistent: true, Machines: machines}
	first := true
	for _, machine := range machines {
		if !machine.Reachable || !machine.Supported {
			continue
		}
		if first {
			fleet.Mirrors, first = machine.Mirrors, false
			continue
		}
		if !sameStrings(fleet.Mirrors, machine.Mirrors) {
			fleet.Consistent = false
		}
	}
	writeJSON(response, http.StatusOK, fleet)
}

func (s *Server) readRegistryMirrors(ctx context.Context, id, name string) registryMirrorMachine {
	machine := registryMirrorMachine{Name: name, ServerID: id}
	target, err := s.targets.Resolve(id)
	if err != nil {
		machine.Reason = "This machine could not be resolved"
		return machine
	}
	if target.Provisioner == nil {
		machine.Reason = "This machine does not expose the SwarmOps provisioning agent"
		return machine
	}
	readContext, cancel := context.WithTimeout(ctx, registryMirrorReadTimeout)
	defer cancel()
	status, err := target.Provisioner.ProvisioningStatus(readContext)
	if err != nil {
		machine.Reason = "The machine did not answer"
		return machine
	}
	machine.Mirrors = status.Docker.RegistryMirrors
	machine.Reachable = true
	machine.Supported = status.Capabilities.ApplyRegistryMirrors
	if !machine.Supported {
		machine.Reason = "This machine cannot change its Docker daemon configuration"
	}
	return machine
}

// coreRegistryMirrorApply queues ONE readiness command per machine.
//
// It is deliberately not a single fleet command: each machine's change is
// separately claimed, separately retried, separately audited, and separately
// visible in Commands — which is what lets an operator see that four hosts
// took the mirror and the fifth did not.
func (s *Server) coreRegistryMirrorApply(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
	var input struct {
		Confirmation string   `json:"confirmation"`
		Mirrors      []string `json:"mirrors"`
	}
	if !decodeJSON(response, request, &input) {
		return
	}
	plan := agentcontrol.ProvisioningRequest{
		ApplyRegistryMirrors: true,
		Confirmation:         strings.TrimSpace(input.Confirmation),
		RegistryMirrors:      input.Mirrors,
	}
	if err := plan.ValidateWithoutJoinToken(); err != nil {
		writeError(response, http.StatusUnprocessableEntity, err.Error())
		return
	}
	if !s.remoteMutationsEnabled(response) {
		return
	}
	if s.commands == nil || s.commands.Writable() != nil {
		writeError(response, http.StatusServiceUnavailable, "SwarmOps command storage is unavailable")
		return
	}
	if err := s.audit.Writable(); err != nil {
		writeError(response, http.StatusServiceUnavailable, "The audit ledger is unavailable; no command was queued")
		return
	}
	idempotencyKey := strings.TrimSpace(request.Header.Get("Idempotency-Key"))
	if idempotencyKey == "" {
		writeError(response, http.StatusBadRequest, "Idempotency-Key is required for every command")
		return
	}
	if strings.TrimSpace(request.Header.Get("X-SwarmOps-Cluster-ID")) != "default" {
		writeError(response, http.StatusConflict, "X-SwarmOps-Cluster-ID must explicitly select the v1 cluster as default")
		return
	}
	servers := s.servers.List()
	if len(servers) == 0 {
		writeError(response, http.StatusUnprocessableEntity, "No machine is enrolled, so there is nothing to apply the image mirror to")
		return
	}
	payload, err := json.Marshal(serverReadinessCommand{ProvisioningRequest: plan})
	if err != nil {
		writeError(response, http.StatusInternalServerError, "The image mirror change could not be queued")
		return
	}

	result := struct {
		Queued  []string          `json:"queued"`
		Skipped map[string]string `json:"skipped,omitempty"`
	}{Queued: []string{}, Skipped: map[string]string{}}
	for _, server := range servers {
		target, resolveErr := s.targets.Resolve(server.ID)
		if resolveErr != nil || target.Provisioner == nil {
			result.Skipped[server.ID] = "no provisioning agent"
			continue
		}
		submission, submitErr := s.commands.SubmitWithResult(queue.SubmitInput{
			Action:         commandServerReadiness,
			Actor:          claims.Username,
			AuthorityEpoch: s.core.AuthorityEpoch(),
			AutoRetry:      false,
			ClusterID:      "default",
			// One operator action fans out to many machines, so each machine
			// gets its own derived key. Re-submitting the same action stays
			// idempotent per machine instead of collapsing into one command.
			IdempotencyKey: idempotencyKey + ":" + server.ID,
			MaxAttempts:    1,
			Payload:        payload,
			RequestID:      requestID(request),
			ServerID:       server.ID,
			Target:         "server/" + server.ID + "/readiness",
		})
		if submitErr != nil {
			if errors.Is(submitErr, queue.ErrIdempotencyConflict) {
				result.Skipped[server.ID] = "idempotency key was already used for a different command"
				continue
			}
			s.commandStoreError(response, request, fmt.Errorf("queue image mirror change: %w", submitErr))
			return
		}
		s.recordCommandSubmission(claims, request, submission)
		result.Queued = append(result.Queued, submission.Command.ID)
	}
	mirrors, _ := plan.NormalizedRegistryMirrors()
	s.record(claims.Username, requestID(request), "core.registry_mirror.apply", "core/"+s.config.CoreID, nil, map[string]string{
		"machines": fmt.Sprintf("%d", len(result.Queued)),
		"mirrors":  strings.Join(mirrors, ","),
	})
	writeJSON(response, http.StatusAccepted, result)
}

func sameStrings(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for index := range a {
		if a[index] != b[index] {
			return false
		}
	}
	return true
}
