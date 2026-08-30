# ADR-0005: Render applications from a spec instead of accepting Compose

**Status:** Accepted for repository implementation; no rendered application has
been deployed to a live cluster by this repository change.

**Date:** 2026-08-25

**Deciders:** Nima Sarayan

## Context

SwarmOps deployed Compose that an operator wrote. Everything a small team
actually wants — put this image on this domain with HTTPS, connect it to
MongoDB and Redis, scrape its metrics, health-check it — was therefore a
hand-authoring exercise: write the Traefik labels exactly as admission expects,
write the health probe, write the connection string, and add a Prometheus job
by editing a config file and redeploying the observability stack.

Three specific things made the goal unreachable rather than merely tedious.
The managed databases were attached to the internal control-plane network, so
no application could reach them. Prometheus discovered targets from a static
list, so a new application was never scraped. And Traefik had no entrypoint
redirect, so the per-stack redirect middleware every hand-written stack carried
was something platform admission forbids a browser-originated stack to define.

## Decision

**SwarmOps renders application Compose from a closed spec.** The operator
supplies an approved slot name, an image, a port, a health path, resources, the
managed databases to attach, and optionally another application to point at.
Every field is a bounded scalar or a name from a closed set. There is no
free-form Compose, label, or command in the spec.

**The rendered document goes through the same policy as a hand-written one.**
`ValidateCompose` and `PlatformAdmission.ValidateStack` run on the renderer's
own output before anything is deployed. Generation is a convenience over the
policy, not a way around it; a renderer bug surfaces as a refused deployment.

**The reviewed manifest still owns identity.** Name, public domain, certificate
resolver, and resource ceiling come from the platform manifest's
`profile: application` workloads. An operator picks an approved domain rather
than claiming one, so one workload cannot take another's hostname.

**A dedicated data network.** `swarmops-data` is an internal, attachable
overlay declared by the control-plane stack. Managed databases moved onto it,
applications join it, and admission's network allow-list grew from `traefik`
alone to `traefik` and `swarmops-data`. The control-plane `swarmops` network
stays closed to applications.

**Connection URIs, not passwords.** Creating a managed database now generates
its password and its full connection URI together, because a Swarm secret
cannot be read back afterwards. The URI is sealed in the controller volume and
copied into a stack-scoped secret for each application that attaches it — the
namespace rule that stops one workload mounting another's material is preserved
by giving each application its own object rather than by relaxing the rule.
Delivery is per application: a mounted file, or an environment variable for
images that can only read one.

**Metrics discovery over HTTP, not the Docker socket.** Prometheus polls
`/metrics/targets` on the controller over the internal overlay and picks up an
application as soon as SwarmOps records it. The alternative — regenerating
Prometheus' config as a new versioned Swarm config and redeploying the
observability stack on every deployment — was rejected as far more machinery
for the same result. Giving Prometheus the Docker socket was rejected outright.

**A global HTTPS redirect at the edge.** Traefik's `web` entrypoint now
redirects to `websecure`. This is what lets a rendered application be routed
without per-stack middleware labels. Traefik serves the ACME HTTP-01 challenge
from a higher-priority internal router, so the `http` resolver still completes.

## Consequences

- Deploying an application is a form, not a Compose file. The operator writes
  no Traefik label, no health probe, and no connection string.
- The controller now holds database connection URIs in its sealed volume, on
  top of machine API keys. This is the second posture increase in the same
  direction, and for the same reason: a credential nobody can read back has to
  live somewhere if it is ever to be wired to a second consumer.
- Environment-variable delivery puts a credential where
  `docker service inspect` can read it. It exists because some images cannot
  read a file, and the console says so at the point of choice.
- The rendered health probe needs a shell with `wget` or `curl`. An image
  without either must supply an explicit health command.
- Applications are single-service. A workload needing several coordinated
  services, a volume, or a queue remains a reviewed Git manifest.
- Source builds are unchanged: SwarmOps deploys an image that was already built
  and pushed. Uploading a zip and having SwarmOps build it was considered and
  deliberately left out of this change.
