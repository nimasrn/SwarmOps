package apihttp

import (
	"io"
	"net/http"

	"github.com/nimasrn/SwarmOps/internal/auth"
	"github.com/nimasrn/SwarmOps/internal/k8simport"
)

// maxManifestBytes caps a paste. A realistic application's manifests are a few
// tens of kilobytes; anything past this is a mistake or an attempt to make the
// parser work hard, and neither deserves the memory.
const maxManifestBytes = 1 << 20

// k8sImport reads Kubernetes manifests and reports what SwarmOps could run.
//
// It is a read: nothing is created, nothing is queued, and the generated
// Compose is returned for review rather than deployed. The importer's value is
// in what it refuses to translate, so applying its output automatically would
// throw away the only part that protects the operator.
func (s *Server) k8sImport(response http.ResponseWriter, request *http.Request, _ auth.Claims) {
	body, err := io.ReadAll(io.LimitReader(request.Body, maxManifestBytes))
	if err != nil {
		writeError(response, http.StatusBadRequest, "Could not read the manifests")
		return
	}
	if len(body) == 0 {
		writeError(response, http.StatusBadRequest, "Paste the manifests to read")
		return
	}
	report, err := k8simport.ParseString(string(body))
	if err != nil {
		writeError(response, http.StatusBadRequest, "Could not read the manifests")
		return
	}
	writeJSON(response, http.StatusOK, report)
}
