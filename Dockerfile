# syntax=docker/dockerfile:1.7

ARG GO_VERSION=1.26.6
ARG NODE_VERSION=24
ARG ALPINE_VERSION=3.23

# SwarmOps is deliberately built with the monorepo root as its context so the
# console consumes the same local UI kit as the other applications.
FROM node:${NODE_VERSION}-bookworm-slim AS web-build
WORKDIR /src
COPY nim-ui/package.json nim-ui/package-lock.json ./nim-ui/
COPY apps/swarmops/web/package.json apps/swarmops/web/package-lock.json ./apps/swarmops/web/
COPY nim-ui ./nim-ui
COPY apps/swarmops/web ./apps/swarmops/web
RUN --mount=type=cache,target=/root/.npm npm --prefix nim-ui ci \
    && npm --prefix apps/swarmops/web ci \
    && npm --prefix apps/swarmops/web run build

FROM golang:${GO_VERSION}-alpine${ALPINE_VERSION} AS go-build
WORKDIR /src/apps/swarmops
COPY apps/swarmops/go.mod apps/swarmops/go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod go mod download
COPY apps/swarmops ./
COPY --from=web-build /src/apps/swarmops/internal/web/static ./internal/web/static
ARG TARGETOS=linux
ARG TARGETARCH
RUN --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=${TARGETOS} GOARCH=${TARGETARCH:-amd64} \
    go build -trimpath -ldflags='-s -w' -o /out/swarmops-core ./cmd/api
RUN --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=${TARGETOS} GOARCH=${TARGETARCH:-amd64} \
    go build -trimpath -ldflags='-s -w' -o /out/swarmops-agent ./cmd/agent
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
COPY apps/swarmops/fluentd/filter_swarmops_normalize.rb /fluentd/plugins/filter_swarmops_normalize.rb
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
