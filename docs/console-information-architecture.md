# SwarmOps console information architecture

This document is the product contract for where information and actions live in
the SwarmOps console. Navigation is organized around an operator's task, not an
implementation subsystem. Seven primary areas live in the top navigation; a
contextual rail exposes the workspaces inside the active area. The feature
finder reaches every destination directly and every route preserves the
explicitly selected server.

## Navigation

| Group | Destinations | Operator question |
| --- | --- | --- |
| **Overview** | Command center | Is the environment healthy, where did each signal come from, and what needs action next? |
| **Cluster** | Servers, Swarm & placement, Host setup, Docker resources | Which servers are connected, what is their Swarm role, what capacity and Docker resources exist, and how do I repair a host? |
| **Workloads** | Applications, Managed databases, Swarm services, Stacks, Images & builds | What products and runtime units are deployed, what do they depend on, and how were their images produced? |
| **Network** | Gateway & ports, Routes, DNS providers, TLS certificates | Is the managed gateway installed, which routes are published, which ports listen, and how are DNS and certificates managed? |
| **Monitoring** | Health, Logs, Collectors | What is happening now, what evidence was collected, and which collection sources are healthy? |
| **Activity** | Runs, Action catalog, Audit trail | What work was requested, what can SwarmOps safely do, and who did what? |
| **Settings** | Controller, Source deployment, Container registry | How is the controller protected and recovered, and which source and registry boundaries are enabled? |

The old **Observe**, **Operations**, **Traffic**, and **Control plane** labels are
not used as navigation. They described implementation concepts without telling
an operator where to find health, a run, a gateway, or controller recovery.

## Workload vocabulary

- An **application** is the operator-owned product and lifecycle unit.
- A **service** is a long-running Swarm process inside an application or stack.
- A **stack** is an advanced group of services, networks, configs, and secrets
  deployed together.
- A **managed database** is a database whose placement, generated credentials,
  backup posture, and lifecycle are owned by SwarmOps. It is not generic
  "shared data."

## Interaction rules

1. A missing prerequisite is a checklist row with a concrete fix action. A
   switch never stands in for "install Docker," "start Swarm," or "configure
   the firewall."
2. Every action opens a visible review sheet immediately. Desktop uses a side
   sheet and mobile uses a bottom sheet. It states the target, expected result,
   impact, blockers, and final action.
3. A mutation remains fixed-shape, explicitly server-targeted, CSRF-protected,
   audited, and durable. The interface never accepts an arbitrary shell command.
4. **Runs** owns status, search, server/action/state filters, bounded time
   filters, attempts, failure evidence, and retry. **Action catalog** owns
   discovery and review of the closed operation vocabulary.
5. Network concerns have distinct destinations: gateway entrypoints are
   listening ports, routes publish workloads, certificate resolvers and status
   live under TLS, and Cloudflare or ArvanCloud credentials and records live
   under DNS providers.
6. A contextual summary links to its owner rather than cloning the owner's
   table, filters, configuration, or mutation controls.
7. Direct hash routes identify the actual destination (for example,
   `#provisioning`, `#commands`, and `#gateway`). Legacy top-level hashes map to
   the nearest new destination without silently changing the selected server.

## Responsive and accessibility contract

- Primary areas remain available from the desktop top row and mobile drawer;
  contextual workspaces become a horizontal strip on narrow screens.
- Controls are named by their result: **Install gateway**, **Start cluster**,
  **Configure source deployment**, **Review action**, and **Run diagnostics**.
- Status always appears in words, not color alone. Versions use a separate
  label and value such as **Agent** / **v0.7.0**.
- Tables with operational volume provide filters or search before they become
  long inventories. Sheets trap focus, close with Escape, lock background
  scrolling, and restore focus to the invoking control.
- A 390-pixel viewport must have no document-level horizontal overflow.
