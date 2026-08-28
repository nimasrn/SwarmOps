package agent

import (
	"crypto/subtle"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"sync"
)

// maxEnrollmentAttempts bounds guessing against the one-time secret. The
// secret has 256 bits of entropy, so this is defence in depth rather than the
// primary control; burning the secret after a small number of failures means a
// probing client cannot keep an enrollment window open.
const maxEnrollmentAttempts = 10

// enrollment holds the one-time secret an installer wrote for the very first
// controller handshake. It is single-use: the first successful exchange
// returns the long-lived machine API key, clears the secret from memory, and
// removes the on-disk secret file.
type enrollment struct {
	attempts int
	file     string
	mu       sync.Mutex
	secret   []byte
	spent    bool
}

func newEnrollment(secret []byte, file string) (*enrollment, error) {
	if len(secret) == 0 {
		return nil, nil
	}
	if len(secret) < 16 {
		return nil, fmt.Errorf("agent enrollment secret must contain at least 16 bytes")
	}
	return &enrollment{file: file, secret: append([]byte(nil), secret...)}, nil
}

// exchange verifies the presented one-time secret and, on the single accepted
// call, burns it. It returns false for every later call so a replayed token
// cannot hand the machine API key to a second party.
func (e *enrollment) exchange(presented []byte) bool {
	if e == nil {
		return false
	}
	e.mu.Lock()
	defer e.mu.Unlock()
	if e.spent || len(presented) == 0 {
		return false
	}
	if subtle.ConstantTimeCompare(presented, e.secret) != 1 {
		e.attempts++
		if e.attempts >= maxEnrollmentAttempts {
			e.burn()
		}
		return false
	}
	e.burn()
	return true
}

// burn must be called with the mutex held.
func (e *enrollment) burn() {
	e.spent = true
	for index := range e.secret {
		e.secret[index] = 0
	}
	e.secret = nil
	if e.file != "" {
		_ = os.Remove(filepath.Clean(e.file))
	}
}

func (e *enrollment) available() bool {
	if e == nil {
		return false
	}
	e.mu.Lock()
	defer e.mu.Unlock()
	return !e.spent
}

// enroll exchanges the one-time secret presented as a bearer credential for
// the long-lived machine API key. It is the only endpoint that returns the key
// and it can succeed at most once per installation.
func (s *Server) enroll(response http.ResponseWriter, request *http.Request) {
	if !s.enrollment.available() {
		http.Error(response, "enrollment is closed", http.StatusGone)
		return
	}
	if !s.enrollment.exchange([]byte(bearer(request))) {
		http.Error(response, "unauthorized", http.StatusUnauthorized)
		return
	}
	writeJSON(response, map[string]string{"apiKey": string(s.token), "nodeName": s.config.NodeName})
}
