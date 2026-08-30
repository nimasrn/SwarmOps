# SwarmOps console information architecture

This document is the product contract for where information and actions live in
the SwarmOps console. Navigation is organized around an operator's task, not an
implementation subsystem. Eight primary areas live in a persistent icon rail; a
labelled contextual sidebar exposes the screens inside the active area and
states what the area is for. The command palette reaches every destination
directly and every route preserves the explicitly selected server.

The table below is not a description of the code: `web/src/navigation/navigation.ts`
is the code, and it is the only place any of it is written down. Both navigation
tiers, the breadcrumb, the palette, the keyboard chords, every screen's own
heading, and the rule deciding which screens require a selected cluster are
built from it, so they cannot fall out of step. A screen that is routable and
belongs to no area — or to no branch of `web/src/shell/page-router.tsx` — fails
[`operator-workflows.test.mjs`](../web/src/operator-workflows.test.mjs) — the
condition that let **Connection diagnostics** exist with a title, a section,
and no way to reach it.

## The frame every screen is drawn in

`web/src/components/screen.tsx` supplies the title, the one-line purpose, the
insight strip, and the optional boundary note. A screen passes its `page` key
and gets its own name back, which is why a nav item and the heading it opens
can no longer disagree — the item once read "Swarm & placement" and opened a
screen titled "Infrastructure".

**Insights are the screen's answer, not its statistics.** Two to four readings
sit under every title: a figure, one line saying what it means, and where a
reading exists that the operator could act on, the screen that owns it. A
reading the controller does not have is stated as an absence rather than
averaged into a number, and a fifth reading is a table.

**Nothing is drawn that does nothing.** A button with no handler, a tab with no
content, and a filter that filters nothing all teach an operator that the
console is a mock-up of itself, which is a lesson they then apply to the
controls that DO work.

## The keyboard

One list — `web/src/navigation/shortcuts.ts` — both installs the bindings and
draws the help sheet that `?` opens, so a chord cannot exist undocumented. `⌘K`
and `/` open the palette, `G` then an area letter jumps, `R` re-reads the
screen, `D` opens connection diagnostics, and Escape dismisses. Every bare
letter checks that the operator is not typing first: this console asks for exact
confirmation phrases, and that is precisely where a stolen keystroke costs the
most.

## What needs a decision

`web/src/lib/attention.ts` computes it once, from the controller topology, the
agent list, the cluster snapshot, and the durable command ledger. The command
centre lists it and the masthead carries the count, so an operator who went
straight to Traffic still learns that a run has stopped. One decision is one
ACTION, not one record: a failed operation and its failed retry are two rows in
the ledger and one thing to decide.

## Navigation

| Area | Screens | Operator question |
| --- | --- | --- |
| **Overview** | Command center | Is the environment healthy, where did each signal come from, and what is the one thing to do next? |
| **Deliver** | Deploy from source, Applications, Images & builds, Container registry | How do I get a change from source into running production, and what was built to get it there? |
| **Fleet** | Servers, Host setup, Swarm & placement, Connection diagnostics, Docker resources | Which hosts are under management, what is answering, what is their Swarm role, and how do I repair one? |
| **Workloads** | Swarm services, Stacks, Managed databases | What is scheduled and running right now, and what does it depend on? |
| **Traffic** | Gateway & ports, Routes, DNS providers, TLS certificates | Is a gateway installed, which routes are published, which ports listen, and how are DNS and certificates managed? |
| **Observe** | Health, Logs, Collectors | What is happening now, what evidence was collected, and which collection sources are healthy? |
| **Activity** | Runs, Action catalog, Audit trail | What work was requested, what can SwarmOps safely do, and who did what? |
| **Control** | Controller & recovery | How is the controller's authority held, moved, and restored? |

**Deliver exists because shipping is not configuration.** Source deployment and
the registry used to sit under Settings while Applications sat under Workloads,
which split one job across two areas and filed the act of shipping under
setup. The whole path is one area, and it is the second thing in the rail.

**Workloads is what is running, not what you deploy.** An application is a
lifecycle you own and therefore belongs to Deliver; a service, a stack, and a
managed database are things currently scheduled, and belong here.

**Control plane** and **Operations** are not used as navigation labels. They
described implementation concepts without telling an operator where to find
controller recovery or a run. **Observe** and **Traffic** are used, and are
named for what the operator is doing rather than for the subsystem underneath.

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
5. Traffic concerns have distinct destinations: gateway entrypoints are
   listening ports, routes publish workloads, certificate resolvers and status
   live under TLS, and Cloudflare or ArvanCloud credentials and records live
   under DNS providers.
6. A contextual summary links to its owner rather than cloning the owner's
   table, filters, configuration, or mutation controls.
7. Direct hash routes identify the actual destination (for example,
   `#provisioning`, `#commands`, and `#gateway`). Every retired hash keeps
   resolving through `LEGACY_ROUTES` and maps to the nearest current
   destination without silently changing the selected server: a name changes
   when a console learns what a screen is for, and a bookmark should not become
   a dead end because of it.
8. The command palette lists ACTIONS above destinations. A query that matches
   both a screen and the operation that screen exists to run offers the
   operation, because the operator who typed it is on their way to press a
   button. Switching the selected cluster is one row per cluster, not a row
   that opens a picker.
9. A screen that cannot render without a selected cluster says which of the
   four situations it is in — no server, no answering agent, a host that is not
   a manager, or a manager that is not selected — and offers the button for
   that one. Everything not gated by a cluster stays open, so setup is never a
   dead end.
10. Queue acceptance is not operation success. The screen that starts a
    mutation follows its run long enough to show a terminal result, preserves
    safe typed prerequisite failures beside the initiating control, and links
    to **Runs** for the durable lifecycle. Raw remote output, response bodies,
    and secrets remain excluded from both surfaces.
11. **Gateway & ports** owns a live installation-prerequisite checklist. It
    distinguishes required resources from items SwarmOps creates during the
    run and optional DNS credentials. An absent DNS provider credential selects
    HTTP-01; it does not masquerade as a failed prerequisite. Agent compatibility
    is based on the machine protocol, while the reported release remains visible
    as evidence. The installation sheet owns the non-secret dashboard hostname;
    the durable install command stores it with the selected cluster's sealed
    Traefik settings and derives the dashboard URL without editing Core's
    environment.

## Responsive and accessibility contract

- Primary areas remain available from the desktop icon rail and labelled mobile
  drawer; contextual screens become a horizontal strip on narrow screens. A
  breadcrumb names the area and the screen on every destination except the
  command center, which is the root.
- Controls are named by their result: **Install gateway**, **Start cluster**,
  **Configure source deployment**, **Review action**, and **Run diagnostics**.
- Status always appears in words, not color alone. Versions use a separate
  label and value such as **Agent** / **v0.7.0**.
- Tables with operational volume provide filters or search before they become
  long inventories. Sheets trap focus, close with Escape, lock background
  scrolling, and restore focus to the invoking control.
- A 390-pixel viewport must have no document-level horizontal overflow.
