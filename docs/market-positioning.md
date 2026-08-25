# Iranian managed-container market and SwarmOps positioning

**Research snapshot:** 2026-08-24. This is a product-discovery record, not a
claim of exhaustive market coverage or a feature-comparison scorecard.

## Scope and terminology

This scan includes Iran-focused commercial services that operate the container
runtime and let a customer deploy source code, a Dockerfile, a Docker image, or
a provider-specific declaration. It excludes ordinary VPS/cloud-server
products, where a customer receives a machine and can install any orchestrator,
manifest, or Helm client themselves.

“Does not accept a manifest or Helm” must be handled precisely:

- A public page can show what a provider documents as supported input; it
  cannot prove an undocumented capability is unavailable.
- Docker Compose is a deployment manifest. A provider that accepts Compose is
  not a strict example of a no-manifest PaaS, even if it does not expose raw
  Kubernetes YAML or Helm.
- “No public Kubernetes/Helm input found” below means only that the cited,
  customer-facing material did not describe it. Confirm paid-plan capabilities
  with the provider before relying on the conclusion.

## Publicly documented market set

| Provider | Publicly documented customer input | Kubernetes / Helm conclusion | Why it matters to SwarmOps |
| --- | --- | --- | --- |
| [Liara](https://developers.liara.ir/pages/paas) | Source archive or Docker image through its PaaS API; its Docker hosting page also describes automatic `docker build` from a Dockerfile and browser/CLI deployment. | The reviewed PaaS material documents source and image deployment, not user-supplied Kubernetes YAML or Helm. That is not proof they are unavailable. | Closest direct reference for a developer-facing Iranian PaaS that hides infrastructure. |
| [ParsPack PaaS](https://docs.parspack.com/paas/deploy/docker/docker-container/) | Dockerfile-backed source, a ready Docker image, Git source, and configuration through the panel. | It explicitly accepts a `docker-compose.yaml` and turns it into its own PaaS deployment, so it is **not** a no-manifest example if Compose counts. The reviewed pages do not document raw Kubernetes YAML or Helm input. | Shows that a better alternative must preserve declarative, multi-service deployment rather than force a one-container UI model. |
| [Roham Cloud PaaS](https://roham.cloud/paas) | GitHub/GitLab push, Dockerfile, and a provider-specific `roham-app.yaml` with runtime, command, scaling, and environment settings. | It has its own manifest, so it is not a strict no-manifest example. The cited public page does not describe Helm or raw Kubernetes manifests. | A useful benchmark for Git-driven deployment, autoscaling, managed databases, logs, and rollback. |
| [Chabokan Docker hosting](https://chabokan.net/products/cloud-hosting/docker/) | Docker Hub or private-registry image and a Dockerfile; its hosted panel provides logs, monitoring, resource changes, and deployment guidance. | No Kubernetes YAML or Helm input is described on the cited product page; this remains a public-documentation finding, not a guarantee. | Direct comparison for image-first, managed container hosting and a simpler operator experience. |
| [DockIran](https://www.docker.host/) | A selected Docker image through a control-panel flow; plans are stated in containers, CPU, memory, disk, and traffic. | No manifest or Helm input is described on the cited customer page. It is closer to managed single-container/CaaS than a full application PaaS. | Establishes the low-end baseline: fast container provisioning alone is not sufficient differentiation. |

## Important adjacent platform: not part of the target gap

[Arvan Cloud Container](https://t.me/s/arvancloud?before=1584) should be
tracked, but it does **not** match a “no Helm” definition. Its official public
update describes a Kubernetes-based service with Helm support and ready Helm
charts. It is therefore a capability benchmark, not evidence of the specific
gap above.

## Program goal

SwarmOps should create an open-source, self-hostable alternative to this class
of managed container platform: make ordinary application deployment simple
without taking away deployment ownership. An installation should remain under
the operator's control, preserve a portable image and declarative deployment
definition, and provide safe, auditable lifecycle operations instead of a
provider-specific opaque control plane.

In practical terms, the target is better in four measurable ways:

1. **Open and self-hostable:** the control plane, deployment policy, audit
   history, and infrastructure stay with the operator rather than a required
   hosting vendor.
2. **Portable by design:** use standard images and owned deployment
   definitions; do not make a proprietary panel the only source of deployment
   truth.
3. **Safer operations:** expose only reviewed, fixed-shape, audited actions
   instead of granting a browser unrestricted Docker access.
4. **Transparent boundaries:** document what is managed, what remains an
   operator responsibility, and what is not yet supported.

## Current truth and product boundary

SwarmOps already supplies an open-source, self-hostable Docker Swarm control
plane with a reviewed Compose v3.9 application-stack path, encrypted local
state, and bounded audited operations. It is **not yet** a multi-tenant managed
PaaS, a hosting provider, or a Kubernetes/Helm control plane. In particular,
it does not currently accept Kubernetes manifests or Helm charts, and it must
not imply otherwise in product copy or sales material.

The next product decisions should distinguish a SwarmOps control plane from a
commercial PaaS offering: tenancy/RBAC, quotas and metering, Git/build
automation, customer-facing provisioning, support obligations, and the
portable declaration format. Those are deliberate product-scope choices, not
features silently implied by this landscape.

## Sources reviewed

- [Liara PaaS API](https://developers.liara.ir/pages/paas) and
  [Docker hosting](https://liara.ir/landing/%D9%87%D8%A7%D8%B3%D8%AA-%D8%AF%D8%A7%DA%A9%D8%B1-docker)
- [ParsPack Docker container](https://docs.parspack.com/paas/deploy/docker/docker-container/)
  and [Docker Compose](https://docs.parspack.com/paas/deploy/docker/docker-compose/)
- [Roham Cloud PaaS](https://roham.cloud/paas)
- [Chabokan Docker hosting](https://chabokan.net/products/cloud-hosting/docker/)
- [DockIran Docker service](https://www.docker.host/)
- [Arvan Cloud's public Helm update](https://t.me/s/arvancloud?before=1584)
