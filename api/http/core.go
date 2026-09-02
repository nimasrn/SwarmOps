package apihttp

import (
	"errors"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/nimasrn/SwarmOps/internal/auth"
	"github.com/nimasrn/SwarmOps/internal/coreself"
	"github.com/nimasrn/SwarmOps/internal/coretopology"
)

const (
	coreReplicaConfirmation = "PREPARE_CORE_REPLICA"
	coreVerifyConfirmation  = "VERIFY_CORE_REPLICA"
)

// coreStatus is intentionally separate from /servers: the process serving the
// console is a control-plane member, not a machine-agent target. Linking a
// core member to a server requires a normal, explicit agent enrollment.
func (s *Server) coreStatus(response http.ResponseWriter, _ *http.Request, _ auth.Claims) {
	writeJSON(response, http.StatusOK, s.core.Status())
}

// coreSelf is what this process knows about ITSELF: the version it is, the
// host it runs on, the storage it holds the ledger in, and the releases it
// could roll back to.
//
// None of it is a cluster read. The controller is not a node, and the screen
// that describes it should not have to pretend it is one to say how much disk
// it has left.
func (s *Server) coreSelf(response http.ResponseWriter, _ *http.Request, _ auth.Claims) {
	writeJSON(response, http.StatusOK, coreself.Describe(s.selfConfig(), s.startedAt, time.Now().UTC()))
}

// coreUpdate asks the LOCAL updater to check for a release.
//
// The controller does not download, verify or restart itself: a process cannot
// supervise its own replacement, and one that tried would have no way to roll
// back after it had already exited. It writes a marker; the updater does the
// rest, starting the candidate beside this process and retiring this one only
// once the new one answers.
func (s *Server) coreUpdate(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
	// An empty body still means "check for the latest release", so a caller
	// that never learned about pinning keeps working.
	var input struct {
		Version string `json:"version"`
	}
	if request.Body != nil && request.ContentLength != 0 && !decodeJSON(response, request, &input) {
		return
	}
	version := strings.TrimSpace(input.Version)
	config := s.selfConfig()
	if strings.TrimSpace(config.UpdateRequestFile) == "" {
		writeError(response, http.StatusConflict, "This controller was not installed with an updater, so it cannot update itself. Reinstall from the release installer to gain one.")
		return
	}
	// A pinned version is only ever a release tag. The updater still verifies
	// the published checksum; this refuses the request before it is written.
	if version != "" && !releaseVersionAllowed(version) {
		writeError(response, http.StatusUnprocessableEntity, "A release version may contain only letters, digits, dots, dashes and underscores")
		return
	}
	if err := coreself.RequestUpdate(config, version); err != nil {
		if errors.Is(err, coreself.ErrVersion) {
			writeError(response, http.StatusUnprocessableEntity, "A release version may contain only letters, digits, dots, dashes and underscores")
			return
		}
		s.logger.Warn("core update request failed", "error", err)
		writeError(response, http.StatusServiceUnavailable, "The update check could not be scheduled on this host")
		return
	}
	detail := map[string]string{}
	if version != "" {
		detail["requested_version"] = version
	}
	s.record(claims.Username, requestID(request), "core.update.request", "core/"+s.core.Status().LocalID, nil, detail)
	writeJSON(response, http.StatusAccepted, map[string]string{"status": "scheduled", "version": version})
}

func releaseVersionAllowed(version string) bool { return releaseVersionPattern.MatchString(version) }

var releaseVersionPattern = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$`)

func (s *Server) selfConfig() coreself.Config {
	return coreself.Config{
		ReleaseDir:        s.config.CoreReleaseDir,
		StateDir:          s.config.DataDir,
		UpdateRequestFile: s.config.CoreUpdateRequestFile,
		UpdateStatusFile:  s.config.CoreUpdateStatusFile,
		Version:           s.version,
	}
}

func (s *Server) coreReplicaAdd(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
	var input struct {
		AgentServerID string `json:"agentServerId"`
		Confirmation  string `json:"confirmation"`
		Endpoint      string `json:"endpoint"`
		ID            string `json:"id"`
		Name          string `json:"name"`
	}
	if !decodeJSON(response, request, &input) {
		return
	}
	if input.Confirmation != coreReplicaConfirmation {
		writeError(response, http.StatusUnprocessableEntity, "replica preparation requires confirmation "+coreReplicaConfirmation)
		return
	}
	if input.AgentServerID != "" && !s.savedServer(input.AgentServerID) {
		writeError(response, http.StatusUnprocessableEntity, "linked agent server was not found; enroll it separately before linking it to the core member")
		return
	}
	topology, err := s.core.AddReplica(coretopology.ReplicaInput{
		AgentServerID: input.AgentServerID,
		Endpoint:      input.Endpoint,
		ID:            input.ID,
		Name:          input.Name,
	})
	if err != nil {
		s.coreError(response, request, err)
		return
	}
	s.record(claims.Username, requestID(request), "core.replica.prepare", "core/"+strings.TrimSpace(input.ID), nil, coreAuditDetail(input.AgentServerID, input.Endpoint))
	writeJSON(response, http.StatusCreated, topology)
}

func (s *Server) coreReplicaVerify(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
	var input struct {
		Confirmation string `json:"confirmation"`
	}
	if !decodeJSON(response, request, &input) {
		return
	}
	if input.Confirmation != coreVerifyConfirmation {
		writeError(response, http.StatusUnprocessableEntity, "replica verification requires confirmation "+coreVerifyConfirmation)
		return
	}
	id := request.PathValue("id")
	topology, err := s.core.VerifyReplica(id)
	if err != nil {
		s.coreError(response, request, err)
		return
	}
	s.record(claims.Username, requestID(request), "core.replica.verified", "core/"+id, nil, map[string]string{"verification": "operator-attested encrypted-state restore"})
	writeJSON(response, http.StatusOK, topology)
}

func (s *Server) coreHandoffPrepare(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
	var input struct {
		Confirmation string `json:"confirmation"`
		TargetID     string `json:"targetId"`
	}
	if !decodeJSON(response, request, &input) {
		return
	}
	targetID := strings.TrimSpace(input.TargetID)
	if input.Confirmation != "PREPARE_CORE_HANDOFF:"+targetID {
		writeError(response, http.StatusUnprocessableEntity, "handoff preparation requires confirmation PREPARE_CORE_HANDOFF:<target-id>")
		return
	}
	topology, err := s.core.PrepareHandoff(targetID)
	if err != nil {
		s.coreError(response, request, err)
		return
	}
	s.record(claims.Username, requestID(request), "core.handoff.prepare", "core/"+targetID, nil, nil)
	writeJSON(response, http.StatusOK, topology)
}

func (s *Server) coreHandoffFence(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
	var input struct {
		Confirmation string `json:"confirmation"`
	}
	if !decodeJSON(response, request, &input) {
		return
	}
	targetID := strings.TrimSpace(request.PathValue("id"))
	if input.Confirmation != "FENCE_CORE:"+targetID {
		writeError(response, http.StatusUnprocessableEntity, "fencing requires confirmation FENCE_CORE:<target-id>")
		return
	}
	topology, err := s.core.FenceForHandoff(targetID)
	if err != nil {
		s.coreError(response, request, err)
		return
	}
	s.record(claims.Username, requestID(request), "core.handoff.fenced", "core/"+targetID, nil, map[string]string{"primary": s.config.CoreID})
	writeJSON(response, http.StatusOK, topology)
}

func (s *Server) corePromote(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
	var input struct {
		Confirmation            string `json:"confirmation"`
		PrimaryConfirmedStopped bool   `json:"primaryConfirmedStopped"`
	}
	if !decodeJSON(response, request, &input) {
		return
	}
	expected := "PROMOTE_CORE:" + s.config.CoreID
	if input.Confirmation != expected {
		writeError(response, http.StatusUnprocessableEntity, "promotion requires confirmation "+expected)
		return
	}
	// A planned handoff is already fenced. Any other promotion is emergency
	// recovery and requires an explicit acknowledgement that the old primary is
	// stopped or fenced. This makes a network partition a visible human choice.
	planned := false
	if handoff := s.core.Status().Handoff; handoff != nil && handoff.State == "fenced" && handoff.ToID == s.config.CoreID {
		planned = true
	}
	if !planned && !input.PrimaryConfirmedStopped {
		writeError(response, http.StatusUnprocessableEntity, "emergency promotion requires confirmation that the previous primary is stopped or fenced")
		return
	}
	nextEpoch := s.core.AuthorityEpoch() + 1
	if err := s.commands.FenceAuthority(nextEpoch); err != nil {
		writeError(response, http.StatusServiceUnavailable, "Queued work could not be fenced for the Core authority change")
		return
	}
	topology, err := s.core.PromoteLocal(!planned)
	if err != nil {
		s.coreError(response, request, err)
		return
	}
	s.agentBroker.SetAuthorityEpoch(topology.AuthorityEpoch)
	s.agentRegistry.SetAuthorityEpoch(topology.AuthorityEpoch)
	detail := map[string]string{"mode": "planned"}
	if !planned {
		detail["mode"] = "emergency"
		detail["previous_primary_confirmed_stopped"] = "true"
	}
	s.record(claims.Username, requestID(request), "core.promote", "core/"+s.config.CoreID, nil, detail)
	writeJSON(response, http.StatusOK, topology)
}

func (s *Server) coreError(response http.ResponseWriter, request *http.Request, err error) {
	if errors.Is(err, coretopology.ErrStandby) {
		writeError(response, http.StatusConflict, "This control-plane replica is standby. Promote it before managing agents or changing topology.")
		return
	}
	if strings.Contains(err.Error(), "not found") || strings.Contains(err.Error(), "choose") || strings.Contains(err.Error(), "already") || strings.Contains(err.Error(), "requires") || strings.Contains(err.Error(), "must") || strings.Contains(err.Error(), "invalid") || strings.Contains(err.Error(), "in progress") || strings.Contains(err.Error(), "not a standby") {
		writeError(response, http.StatusUnprocessableEntity, err.Error())
		return
	}
	s.logger.Error("SwarmOps core topology operation failed", "request_id", requestID(request), "path", request.URL.Path, "error", err)
	writeError(response, http.StatusBadGateway, "The control-plane topology could not be saved")
}

func coreAuditDetail(agentServerID, endpoint string) map[string]string {
	detail := map[string]string{}
	if strings.TrimSpace(agentServerID) != "" {
		detail["agent_server_id"] = strings.TrimSpace(agentServerID)
	}
	if strings.TrimSpace(endpoint) != "" {
		detail["endpoint"] = strings.TrimSpace(endpoint)
	}
	return detail
}

// CanExecuteCommands lets the worker pause before claiming a command on a
// standby. It deliberately does not interrupt an already-running command:
// once a remote effect may exist, preserving the visible outcome is safer.
func (s *Server) CanExecuteCommands() bool { return s.core != nil && s.core.CanManage() }

func (s *Server) requireActiveControl(response http.ResponseWriter) bool {
	if s.core != nil && s.core.CanManage() {
		return true
	}
	writeError(response, http.StatusConflict, "This control-plane replica is standby. Promote it before contacting managed agents or cluster targets.")
	return false
}

func (s *Server) withActiveAuth(handler protectedHandler) http.HandlerFunc {
	return s.withAuth(true, func(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
		if !s.requireActiveControl(response) {
			return
		}
		handler(response, request, claims)
	})
}
