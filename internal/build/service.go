// Package build implements resource-capped image builds through the Docker
// Engine API. It accepts tar contexts, never arbitrary server filesystem paths.
package build

import (
	"context"
	"encoding/base64"
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
	if request.Push {
		query.Set("push", "1")
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
	if strings.Contains(log, `"error"`) || strings.Contains(log, `"errorDetail"`) {
		return domain.BuildResult{}, fmt.Errorf("Docker reported a build error")
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
