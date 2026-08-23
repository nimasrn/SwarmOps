# syntax=docker/dockerfile:1.7

ARG GO_VERSION=1.26.5
ARG NODE_VERSION=24
ARG ALPINE_VERSION=3.23

# The open-source release is self-contained: the Apache-2.0 nim UI kit used by
# the React console is vendored beside the web package for reliable type lookup.
FROM node:${NODE_VERSION}-bookworm-slim AS web-build
WORKDIR /src
COPY web ./web
RUN npm --prefix web ci \
    && npm --prefix web run build

FROM golang:${GO_VERSION}-alpine${ALPINE_VERSION} AS go-build
WORKDIR /src
COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod go mod download
COPY . .
COPY --from=web-build /src/internal/web/static ./internal/web/static
ARG TARGETOS=linux
ARG TARGETARCH
RUN --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=${TARGETOS} GOARCH=${TARGETARCH:-amd64} \
    go build -trimpath -ldflags='-s -w' -o /out/swarmops-api ./cmd/api
RUN --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=${TARGETOS} GOARCH=${TARGETARCH:-amd64} \
    go build -trimpath -ldflags='-s -w' -o /out/swarmops-agent ./cmd/agent
RUN --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=${TARGETOS} GOARCH=${TARGETARCH:-amd64} \
    go build -trimpath -ldflags='-s -w' -o /out/swarmopsctl ./cmd/swarmopsctl

FROM alpine:${ALPINE_VERSION} AS api-runtime
RUN apk add --no-cache ca-certificates docker-cli tzdata \
    && mkdir -p /opt/swarmops /opt/traefik
WORKDIR /app
COPY --from=go-build /out/swarmops-api /app/swarmops-api
EXPOSE 8084
ENTRYPOINT ["/app/swarmops-api"]

FROM alpine:${ALPINE_VERSION} AS agent-runtime
RUN apk add --no-cache ca-certificates tzdata
WORKDIR /app
COPY --from=go-build /out/swarmops-agent /app/swarmops-agent
EXPOSE 9180
ENTRYPOINT ["/app/swarmops-agent"]

FROM alpine:${ALPINE_VERSION} AS cli
RUN apk add --no-cache ca-certificates tzdata
WORKDIR /app
COPY --from=go-build /out/swarmopsctl /app/swarmopsctl
ENTRYPOINT ["/app/swarmopsctl"]
