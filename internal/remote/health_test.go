package remote

import (
	"errors"
	"fmt"
	"net/http"
	"testing"
)

func TestObservedAgentFailureIgnoresManagedWorkloadResponseFailure(t *testing.T) {
	for _, status := range []int{http.StatusBadRequest, http.StatusConflict, http.StatusInternalServerError, http.StatusBadGateway} {
		err := fmt.Errorf("read optional runtime: %w", &AgentHTTPError{StatusCode: status})
		if isObservedAgentFailure(err) {
			t.Fatalf("status %d was classified as a machine-agent outage", status)
		}
	}
}

func TestObservedAgentFailureRetainsImmediateMachineBoundaryFailures(t *testing.T) {
	for name, err := range map[string]error{
		"missing protocol route": &AgentHTTPError{StatusCode: http.StatusNotFound},
		"fingerprint mismatch":   ErrAgentAPIFingerprint,
		"rejected key":           ErrAgentAPIUnauthorized,
		"docker unavailable":     ErrDockerUnavailable,
		"unreachable":            errors.New("connect to machine API: connection refused"),
	} {
		t.Run(name, func(t *testing.T) {
			if !isObservedAgentFailure(err) {
				t.Fatalf("expected %v to be classified as a machine-agent failure", err)
			}
		})
	}
}
