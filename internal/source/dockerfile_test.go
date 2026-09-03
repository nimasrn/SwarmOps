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
