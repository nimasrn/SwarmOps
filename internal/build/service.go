// Package build implements resource-capped image builds through the Docker
// Engine API. It accepts tar contexts, never arbitrary server filesystem paths.
package build

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/nimasrn/SwarmOps/internal/dockerapi"
	"github.com/nimasrn/SwarmOps/internal/domain"
)

var imagePattern = regexp.MustCompile(`^[a-z0-9][a-z0-9._/-]{0,220}:[A-Za-z0-9][A-Za-z0-9._-]{0,127}$`)

type Request struct {
	CPUs       float64
	Dockerfile string
	Image      string
	MemoryMiB  int64
	Push       bool
}

type Service struct {
	Docker        *dockerapi.Client
	Enabled       bool
	ImagePrefixes []string
	MaxCPUs       float64
	MaxMemoryMiB  int64
	RegistryAuth  []byte
}

func (s Service) Run(ctx context.Context, request Request, contextTar io.Reader, requestID string) (domain.BuildResult, error) {
	request, err := s.Validate(request)
	if err != nil {
		return domain.BuildResult{}, err
	}
	if s.Docker == nil {
		return domain.BuildResult{}, fmt.Errorf("Docker client is not configured")
	}

	period := int64(100_000)
	memoryBytes := request.MemoryMiB << 20
	query := url.Values{
		"cpuperiod":  {strconv.FormatInt(period, 10)},
		"cpuquota":   {strconv.FormatInt(int64(request.CPUs*float64(period)), 10)},
		"dockerfile": {request.Dockerfile},
		"forcerm":    {"1"},
		"memory":     {strconv.FormatInt(memoryBytes, 10)},
		"memswap":    {strconv.FormatInt(memoryBytes, 10)},
		"pull":       {"1"},
		"rm":         {"1"},
		"t":          {request.Image},
	}
	headers := make(http.Header)
	headers.Set("Content-Type", "application/x-tar")
	if request.Push {
		headers.Set("X-Registry-Config", base64.StdEncoding.EncodeToString(s.RegistryAuth))
	}
	buildContext, cancel := context.WithTimeout(ctx, 30*time.Minute)
	defer cancel()
	log, err := s.Docker.Build(buildContext, contextTar, query, headers)
	if err != nil {
		return domain.BuildResult{}, err
	}
	if buildLogReportsError(log) {
		return domain.BuildResult{}, fmt.Errorf("Docker reported a build error")
	}
	if request.Push {
		repository, tag, err := splitImage(request.Image)
		if err != nil {
			return domain.BuildResult{}, err
		}
		authHeader, err := registryAuthHeader(s.RegistryAuth, repository)
		if err != nil {
			return domain.BuildResult{}, err
		}
		pushContext, pushCancel := context.WithTimeout(ctx, 10*time.Minute)
		defer pushCancel()
		pushLog, err := s.Docker.PushImage(pushContext, repository, tag, authHeader)
		if err != nil {
			return domain.BuildResult{}, fmt.Errorf("push built image: %w", err)
		}
		if buildLogReportsError(pushLog) {
			return domain.BuildResult{}, fmt.Errorf("Docker reported an image push error")
		}
	}
	return domain.BuildResult{Image: request.Image, Log: log, Pushed: request.Push, RequestID: requestID}, nil
}

// Validate normalizes a browser build request without touching Docker. The
// command queue uses it before retaining a source archive, while Run calls it
// again immediately before execution so a changed runtime policy remains
// authoritative.
func (s Service) Validate(request Request) (Request, error) {
	if !s.Enabled {
		return Request{}, fmt.Errorf("image builds are disabled")
	}
	if !imagePattern.MatchString(request.Image) || strings.HasSuffix(request.Image, ":latest") {
		return Request{}, fmt.Errorf("image must have a non-latest immutable tag")
	}
	if !allowedPrefix(request.Image, s.ImagePrefixes) {
		return Request{}, fmt.Errorf("image registry is not allow-listed")
	}
	if request.Dockerfile == "" {
		request.Dockerfile = "Dockerfile"
	}
	if strings.HasPrefix(request.Dockerfile, "/") || strings.Contains(request.Dockerfile, "..") {
		return Request{}, fmt.Errorf("invalid Dockerfile path")
	}
	if request.CPUs <= 0 {
		request.CPUs = s.MaxCPUs
	}
	if request.MemoryMiB <= 0 {
		request.MemoryMiB = s.MaxMemoryMiB
	}
	if request.CPUs > s.MaxCPUs || request.MemoryMiB > s.MaxMemoryMiB {
		return Request{}, fmt.Errorf("requested build resources exceed the configured cap")
	}
	if request.Push && len(s.RegistryAuth) == 0 {
		return Request{}, fmt.Errorf("registry push requires a configured registry credential secret")
	}
	return request, nil
}

func allowedPrefix(image string, prefixes []string) bool {
	for _, prefix := range prefixes {
		if strings.HasPrefix(image, prefix) {
			return true
		}
	}
	return false
}

func splitImage(image string) (repository, tag string, err error) {
	lastSlash := strings.LastIndex(image, "/")
	separator := strings.LastIndex(image, ":")
	if separator <= lastSlash || separator == len(image)-1 {
		return "", "", fmt.Errorf("image must contain a repository and tag")
	}
	return image[:separator], image[separator+1:], nil
}

func registryAuthHeader(configuration []byte, repository string) (string, error) {
	var dockerConfig struct {
		Auths map[string]json.RawMessage `json:"auths"`
	}
	if err := json.Unmarshal(configuration, &dockerConfig); err != nil || len(dockerConfig.Auths) == 0 {
		return "", fmt.Errorf("registry push requires a valid Docker auth configuration")
	}
	registry := strings.SplitN(repository, "/", 2)[0]
	candidates := []string{registry, "https://" + registry, "http://" + registry}
	if !strings.ContainsAny(registry, ".:") && registry != "localhost" {
		registry = "https://index.docker.io/v1/"
		candidates = []string{registry, "index.docker.io", "docker.io"}
	}
	var raw json.RawMessage
	for _, candidate := range candidates {
		if value, found := dockerConfig.Auths[candidate]; found {
			raw = value
			break
		}
	}
	if len(raw) == 0 {
		return "", fmt.Errorf("registry push credential is not configured for %q", registry)
	}
	var auth map[string]any
	if err := json.Unmarshal(raw, &auth); err != nil || auth == nil {
		return "", fmt.Errorf("registry push credential is invalid")
	}
	auth["serveraddress"] = registry
	encoded, err := json.Marshal(auth)
	if err != nil {
		return "", fmt.Errorf("encode registry push credential")
	}
	return base64.URLEncoding.EncodeToString(encoded), nil
}

// buildLogReportsError decodes the Docker Engine build stream, whose entries
// are JSON objects per line, and reports whether an error entry appeared.
// Decoding real JSON keys is stricter than a substring scan: a build step that
// merely echoes the text `"error"` into its output no longer looks like a
// failure. Output that contains no parseable JSON at all falls back to the
// previous heuristic for non-standard engines.
func buildLogReportsError(log string) bool {
	decoder := json.NewDecoder(strings.NewReader(log))
	decoded := false
	for {
		var entry map[string]json.RawMessage
		if err := decoder.Decode(&entry); err != nil {
			break
		}
		decoded = true
		if _, ok := entry["error"]; ok {
			return true
		}
		if _, ok := entry["errorDetail"]; ok {
			return true
		}
	}
	return !decoded && strings.Contains(log, `"error"`)
}
