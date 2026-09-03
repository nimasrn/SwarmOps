package source

import (
	"strings"
	"testing"
)

func TestAnalyzeDockerfileReadsFinalStageEvidence(t *testing.T) {
	content := []byte(`# syntax=docker/dockerfile:1
FROM golang:1.26-alpine AS build
ARG BUILD_TOKEN
WORKDIR /src
RUN go build \
      -o /out/app ./cmd/app

FROM alpine:3.22
RUN adduser -D -u 10001 app
USER app
WORKDIR /app
COPY --from=build /out/app /app/app
EXPOSE 8080 9090/tcp
HEALTHCHECK --interval=10s CMD wget -q -O - http://127.0.0.1:8080/livez || exit 1
ENTRYPOINT ["/app/app"]
`)
	plan, findings := analyzeDockerfile("Dockerfile", content)
	if plan.Stages != 2 {
		t.Fatalf("stages = %d", plan.Stages)
	}
	if strings.Join(plan.BaseImages, ",") != "golang:1.26-alpine,alpine:3.22" {
		t.Fatalf("base images = %#v", plan.BaseImages)
	}
	if len(plan.ExposedPorts) != 2 || plan.ExposedPorts[0] != 8080 || plan.ExposedPorts[1] != 9090 {
		t.Fatalf("exposed ports = %#v", plan.ExposedPorts)
	}
	if plan.RunsAsRoot {
		t.Fatal("USER app should not be reported as root")
	}
	if !plan.Entrypoint || !plan.Healthcheck || plan.HealthPath != "/livez" || plan.WorkDir != "/app" {
		t.Fatalf("final stage evidence = %#v", plan)
	}
	for _, finding := range findings {
		if finding.Level == FindingBlocker {
			t.Fatalf("unexpected blocker: %#v", finding)
		}
	}
}

func TestAnalyzeDockerfileReportsRootMutableBaseAndBakedCredential(t *testing.T) {
	content := []byte(`FROM node
ENV NODE_ENV=production API_TOKEN="ghp_notarealtokenvalue"
ARG BUILD_PASSWORD=$CI_PASSWORD
ADD https://example.com/tool.tar.gz /tmp/tool.tar.gz
CMD ["node", "server.js"]
`)
	plan, findings := analyzeDockerfile("apps/web/Dockerfile", content)
	if !plan.RunsAsRoot || plan.Healthcheck || len(plan.ExposedPorts) != 0 {
		t.Fatalf("plan = %#v", plan)
	}
	codes := map[string]FindingLevel{}
	for _, finding := range findings {
		codes[finding.Code] = finding.Level
		if finding.Subject != "apps/web/Dockerfile" {
			t.Fatalf("finding subject = %q", finding.Subject)
		}
		if strings.Contains(finding.Message, "ghp_notarealtokenvalue") {
			t.Fatalf("finding leaked a credential value: %q", finding.Message)
		}
	}
	if codes["dockerfile_secret_literal"] != FindingBlocker {
		t.Fatalf("a baked credential must block: %#v", codes)
	}
	for _, code := range []string{"dockerfile_mutable_base", "dockerfile_root_user", "dockerfile_remote_add"} {
		if codes[code] != FindingWarning {
			t.Fatalf("%s = %q, want warning: %#v", code, codes[code], codes)
		}
	}
	// BUILD_PASSWORD is a reference, not a literal, so it is not a finding of
	// its own; only one baked credential was declared.
	literals := 0
	for _, finding := range findings {
		if finding.Code == "dockerfile_secret_literal" {
			literals++
		}
	}
	if literals != 1 {
		t.Fatalf("literal credential findings = %d", literals)
	}
}

func TestAnalyzeDockerfileHonoursEscapeDirectiveAndRejectsEmptyFile(t *testing.T) {
	content := []byte("# escape=`\nFROM alpine:3.22\nRUN echo one `\n && echo two\nUSER 0\nCMD [\"sh\"]\n")
	plan, _ := analyzeDockerfile("Dockerfile", content)
	if plan.Stages != 1 || !plan.RunsAsRoot {
		t.Fatalf("plan = %#v", plan)
	}
	_, findings := analyzeDockerfile("Dockerfile", []byte("# nothing here\n"))
	if len(findings) != 1 || findings[0].Code != "dockerfile_no_from" || findings[0].Level != FindingBlocker {
		t.Fatalf("findings = %#v", findings)
	}
}

// The nim-zone Dockerfile pins both of its base images through build arguments
// declared above the first FROM. Reading `${GO_IMAGE}` literally reported four
// unpinned-base warnings for a build that is fully pinned, and repeated the
// same one three times because three stages share a base.
func TestBaseImagesResolveDeclaredBuildArguments(t *testing.T) {
	t.Parallel()
	plan, findings := analyzeDockerfile("Dockerfile", []byte(`ARG GO_IMAGE=golang:1.25-alpine
ARG NODE_IMAGE=node:22-alpine

FROM ${GO_IMAGE} AS content
FROM ${NODE_IMAGE} AS dependencies
FROM ${NODE_IMAGE} AS build
FROM ${NODE_IMAGE} AS runtime
COPY --from=build /app /app
EXPOSE 8080
USER node
CMD ["node", "server.js"]
`))
	for _, finding := range findings {
		if finding.Code == "dockerfile_mutable_base" {
			t.Fatalf("a pinned build reported an unpinned base image: %s", finding.Message)
		}
	}
	if len(plan.BaseImages) != 4 || plan.BaseImages[0] != "golang:1.25-alpine" || plan.BaseImages[3] != "node:22-alpine" {
		t.Fatalf("base images were not resolved: %#v", plan.BaseImages)
	}
}

// A stage name is not an image, and an argument with no default is not a pin.
func TestBaseImageFindingsSeparateStagesFromUnpinnedArguments(t *testing.T) {
	t.Parallel()
	_, findings := analyzeDockerfile("Dockerfile", []byte(`ARG RUNTIME_IMAGE

FROM alpine:3.20 AS base
FROM base AS build
FROM ${RUNTIME_IMAGE} AS runtime
USER app
CMD ["/app"]
`))
	mutable := 0
	for _, finding := range findings {
		if finding.Code != "dockerfile_mutable_base" {
			continue
		}
		mutable++
		if !strings.Contains(finding.Message, "${RUNTIME_IMAGE}") {
			t.Fatalf("unexpected unpinned base finding: %s", finding.Message)
		}
		if !strings.Contains(finding.Message, "no default in this file") {
			t.Fatalf("an unresolved build argument must say why it is unpinned: %s", finding.Message)
		}
	}
	if mutable != 1 {
		t.Fatalf("expected exactly one unpinned-base finding, got %d", mutable)
	}
}
