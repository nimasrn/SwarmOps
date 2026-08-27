# syntax=docker/dockerfile:1.7

ARG GO_VERSION=1.26.6
ARG NODE_VERSION=24
ARG ALPINE_VERSION=3.23

# The open-source release is self-contained: the Apache-2.0 nim UI kit used by
# the React console is vendored beside the web package.
FROM node:${NODE_VERSION}-bookworm-slim AS web-build
WORKDIR /src
COPY web ./web
RUN --mount=type=cache,target=/root/.npm npm --prefix web ci \
    && npm --prefix web run build

FROM golang:${GO_VERSION}-alpine${ALPINE_VERSION} AS go-build
ARG APP_VERSION=dev
WORKDIR /src
COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod go mod download
COPY . .
COPY --from=web-build /src/internal/web/static ./internal/web/static
ARG TARGETOS=linux
ARG TARGETARCH
RUN --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=${TARGETOS} GOARCH=${TARGETARCH:-amd64} \
    go build -trimpath -ldflags="-s -w -X main.version=${APP_VERSION}" -o /out/swarmops-core ./cmd/api
RUN --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=${TARGETOS} GOARCH=${TARGETARCH:-amd64} \
    go build -trimpath -ldflags="-s -w -X main.version=${APP_VERSION}" -o /out/swarmops-agent ./cmd/agent
RUN --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=${TARGETOS} GOARCH=${TARGETARCH:-amd64} \
    go build -trimpath -ldflags='-s -w' -o /out/swarmops ./cmd/swarmopsctl
RUN --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=${TARGETOS} GOARCH=${TARGETARCH:-amd64} \
    go build -trimpath -ldflags='-s -w' -o /out/swarmops-logs ./cmd/logs

FROM fluentd:v1.19.3-debian-1.0 AS fluentd
USER root
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential libsystemd-dev pkg-config \
    && fluent-gem install fluent-plugin-systemd -v 1.1.1 --no-document \
    && apt-get purge -y --auto-remove build-essential libsystemd-dev pkg-config \
    && apt-get install -y --no-install-recommends libsystemd0 \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /var/lib/fluentd/cursors /var/lib/fluentd/buffer /var/lib/swarmops-logs/records /var/lib/swarmops-logs/buffer
COPY fluentd/filter_swarmops_normalize.rb /fluentd/plugins/filter_swarmops_normalize.rb
USER fluent

FROM alpine:${ALPINE_VERSION} AS api
RUN apk add --no-cache ca-certificates tzdata \
    && mkdir -p /opt/swarmops /opt/traefik
WORKDIR /app
COPY --from=go-build /out/swarmops-core /usr/local/bin/swarmops-core
EXPOSE 8084
ENTRYPOINT ["/usr/local/bin/swarmops-core"]

FROM alpine:${ALPINE_VERSION} AS agent
RUN apk add --no-cache ca-certificates tzdata
WORKDIR /app
COPY --from=go-build /out/swarmops-agent /app/swarmops-agent
EXPOSE 9180
ENTRYPOINT ["/app/swarmops-agent"]

FROM alpine:${ALPINE_VERSION} AS cli
RUN apk add --no-cache ca-certificates tzdata
WORKDIR /app
COPY --from=go-build /out/swarmops /usr/local/bin/swarmops
ENTRYPOINT ["/usr/local/bin/swarmops"]

FROM alpine:${ALPINE_VERSION} AS logs
RUN apk add --no-cache ca-certificates tzdata \
    && addgroup -S swarmops && adduser -S -G swarmops swarmops
COPY --from=go-build /out/swarmops-logs /usr/local/bin/swarmops-logs
USER swarmops
EXPOSE 8085
ENTRYPOINT ["/usr/local/bin/swarmops-logs"]
