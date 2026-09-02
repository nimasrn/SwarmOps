import type { IconName } from '@nim.zone/ui'

/**
 * The console's information architecture, in one place.
 *
 * Before this file the IA lived in five: a page-title record, a
 * page-to-section record, two hand-written nav trees, and the finder's option
 * list. Adding a screen meant editing all five, and the ones that were missed
 * are why `agent-diagnostics` had a title and a section but no way to reach
 * it from navigation at all.
 *
 * There are six areas. There were eight, and two of them — Deliver and
 * Workloads — were the same object at two points in its life, which is why an
 * application and the service running it lived in different halves of the
 * navigation. More importantly the DEPTH moved: you open a machine, a
 * container, an application or a run, and everything about that thing is on
 * its page, its charts included.
 *
 * That is why there is no Observe area any more. A fleet-wide chart cannot
 * answer "for which node?", and every reading in this console now sits beside
 * the object it describes.
 */

export type WorkspacePage =
  // Home — the state of production and the next decision it needs.
  | 'overview'
  // Apps — what you ship, and the shared services it runs against.
  | 'applications'
  | 'deploy'
  | 'platform'
  | 'images'
  | 'workloads'
  // Machines — the hosts, their agents, and the cluster they form.
  | 'machines'
  | 'swarm'
  | 'containers'
  | 'storage'
  // Traffic — how a request from the internet reaches a workload.
  | 'gateway'
  | 'gateway-settings'
  | 'routes'
  | 'dns'
  | 'tls'
  // Activity — everything this console did, and everything it may do.
  | 'runs'
  | 'logs'
  | 'audit'
  | 'catalog'
  // Control — the controller itself and the software on every host.
  | 'core'
  | 'agents'

export type AreaKey = 'home' | 'apps' | 'machines' | 'traffic' | 'activity' | 'control'

export interface PageEntry {
  icon: IconName
  key: WorkspacePage
  /** The label in navigation, and the noun the page is called everywhere. */
  label: string
  /** Words the palette should match that the label does not carry — the old
      name of a screen included, so a rename never makes it unreachable by the
      name the operator still types. */
  keywords?: string
  /** One line: what decision this screen serves. Drawn beside the destination
      in the palette and under the section heading, so the second tier of
      navigation teaches rather than merely lists. */
  summary: string
}

export interface AreaEntry {
  icon: IconName
  key: AreaKey
  label: string
  pages: PageEntry[]
  /** The letter that follows `G` to jump here. Chosen to be the word an
      operator would say out loud — G then H for home, G then M for machines —
      because a shortcut that has to be looked up is a shortcut nobody uses.
      Listed in the shortcuts sheet (`?`) so it is discoverable rather than
      folklore. */
  shortcut: string
  /** Shown above the contextual navigation — what this whole area is for. */
  summary: string
}

export const AREAS: AreaEntry[] = [
  {
    icon: 'home',
    key: 'home',
    shortcut: 'h',
    label: 'Home',
    summary: 'What production is doing, and the one thing worth doing about it.',
    pages: [
      { icon: 'home', key: 'overview', label: 'Overview', summary: 'Health, risk, and what to do next.', keywords: 'home dashboard start command center' },
    ],
  },
  {
    icon: 'layers',
    key: 'apps',
    shortcut: 'a',
    label: 'Apps',
    summary: 'What you ship, and the shared services it runs against.',
    pages: [
      { icon: 'layers', key: 'applications', label: 'Applications', summary: 'The products you operate as one lifecycle.', keywords: 'apps workload product service' },
      { icon: 'play', key: 'deploy', label: 'Deploy', summary: 'Build a repository, archive, or image and roll it out.', keywords: 'ship release rollout git build source kubernetes import' },
      { icon: 'database', key: 'platform', label: 'Platform services', summary: 'One database, one Prometheus, one Jaeger — shared by every app.', keywords: 'postgres mongo redis prometheus jaeger observability collectors databases' },
      { icon: 'package', key: 'images', label: 'Images & registries', summary: 'What was built, and where it is pushed and pulled from.', keywords: 'docker image tag digest builds ghcr registry credentials' },
      { icon: 'terminal', key: 'workloads', label: 'Stacks & services', summary: 'The Swarm objects underneath an application.', keywords: 'compose namespace stack replicas tasks scale advanced' },
    ],
  },
  {
    icon: 'server',
    key: 'machines',
    shortcut: 'm',
    label: 'Machines',
    summary: 'The hosts, their agents, and the cluster they form.',
    pages: [
      { icon: 'server', key: 'machines', label: 'Machines', summary: 'Every host under management, and how hard it is working.', keywords: 'hosts servers agent enroll connect add setup provisioning diagnostics' },
      { icon: 'users', key: 'swarm', label: 'Swarm', summary: 'Cluster membership, roles, labels, and placement.', keywords: 'nodes cluster manager worker quorum drain infrastructure' },
      { icon: 'layers', key: 'containers', label: 'Containers', summary: 'Everything running, on every host, with what it is using.', keywords: 'docker ps container task metrics' },
      { icon: 'package', key: 'storage', label: 'Storage & networks', summary: 'Volumes, networks, images on disk, and what can be reclaimed.', keywords: 'volumes networks prune disk secrets configs resources' },
    ],
  },
  {
    icon: 'globe',
    key: 'traffic',
    shortcut: 't',
    label: 'Traffic',
    summary: 'How a request from the internet reaches a workload.',
    pages: [
      { icon: 'external', key: 'gateway', label: 'Gateway', summary: 'What the edge is carrying, and where it is failing.', keywords: 'traefik ingress proxy ports entrypoints metrics' },
      { icon: 'settings', key: 'gateway-settings', label: 'Gateway settings', summary: 'Entrypoints, ports, and certificate resolver policy.', keywords: 'traefik global settings entrypoints ports resolvers acme static' },
      { icon: 'arrow-forward', key: 'routes', label: 'Routes', summary: 'Hostname, TCP and UDP rules mapped onto workloads.', keywords: 'router host rule path port publish' },
      { icon: 'cloud', key: 'dns', label: 'Domains & DNS', summary: 'Where records are published from, and their credentials.', keywords: 'domain record cloudflare arvan provider' },
      { icon: 'shield', key: 'tls', label: 'Certificates', summary: 'Issuance, renewal, and expiry.', keywords: 'ssl https acme letsencrypt certificate' },
    ],
  },
  {
    icon: 'activity',
    key: 'activity',
    shortcut: 'r',
    label: 'Activity',
    summary: 'Everything this console did, and everything it may do.',
    pages: [
      { icon: 'activity', key: 'runs', label: 'Runs', summary: 'Durable operations: queued, running, failed, recovered.', keywords: 'queue commands jobs operations history retry' },
      { icon: 'document', key: 'logs', label: 'Logs', summary: 'Container and service output, live and searchable.', keywords: 'output stdout stderr tail fluentd' },
      { icon: 'shield', key: 'audit', label: 'Audit', summary: 'Who did what, when, and against which host.', keywords: 'log security compliance events who' },
      { icon: 'terminal', key: 'catalog', label: 'Action catalog', summary: 'The fixed set of operations that may be queued.', keywords: 'actions catalogue run command available vocabulary' },
    ],
  },
  {
    icon: 'settings',
    key: 'control',
    shortcut: 'c',
    label: 'Control',
    summary: 'The controller itself and the software on every host.',
    pages: [
      { icon: 'settings', key: 'core', label: 'Core', summary: 'Where the controller runs, what version it is, and how to move it.', keywords: 'controller authority quorum failover backup restore topology recovery update' },
      { icon: 'download', key: 'agents', label: 'Agents & updates', summary: 'Which version each machine runs, and how it gets the next one.', keywords: 'agent version rollout rollback upgrade policy' },
    ],
  },
]

export const PAGES: PageEntry[] = AREAS.flatMap((area) => area.pages)

const PAGE_INDEX = new Map(PAGES.map((page) => [page.key, page]))
const AREA_OF_PAGE = new Map<WorkspacePage, AreaEntry>(
  AREAS.flatMap((area) => area.pages.map((page) => [page.key, area] as const)),
)

export function pageEntry(page: WorkspacePage): PageEntry {
  return PAGE_INDEX.get(page) ?? AREAS[0]!.pages[0]!
}

export function areaOf(page: WorkspacePage): AreaEntry {
  return AREA_OF_PAGE.get(page) ?? AREAS[0]!
}

/** The screen an area opens on when its rail icon is chosen. */
export function landingPage(area: AreaEntry): WorkspacePage {
  return area.pages[0]!.key
}

export function isWorkspacePage(value: string): value is WorkspacePage {
  return PAGE_INDEX.has(value as WorkspacePage)
}

/**
 * Hashes that used to address a screen. Names change when a console learns
 * what its screens are actually for; a bookmark should not become a 404
 * because of it, so every retired hash keeps resolving.
 *
 * The six-area rebuild retired more of these at once than every previous
 * release together, and each one still lands on the screen that took over its
 * job — not on the home page, which is what a redirect that has given up
 * looks like.
 */
export const LEGACY_ROUTES: Record<string, WorkspacePage> = {
  // Retired with the six-area rebuild.
  'agent-diagnostics': 'machines',
  builds: 'images',
  catalogue: 'catalog',
  commands: 'runs',
  databases: 'platform',
  diagnostics: 'machines',
  insights: 'overview',
  'kubernetes-import': 'deploy',
  nodes: 'swarm',
  observability: 'platform',
  observe: 'overview',
  provisioning: 'machines',
  registry: 'images',
  resources: 'containers',
  servers: 'machines',
  services: 'workloads',
  'source-deploy': 'deploy',
  stacks: 'workloads',
  // Retired earlier, and still resolving.
  home: 'overview',
  infrastructure: 'swarm',
  operations: 'runs',
  settings: 'core',
  traefik: 'gateway',
  traffic: 'gateway',
}

/**
 * Screens that read the SELECTED cluster and therefore cannot render without
 * a connected Swarm manager. Everything else — machines, the controller, the
 * audit trail — is exactly what an operator needs when no manager is
 * connected, and must never be gated behind one.
 */
export const CLUSTER_PAGES: ReadonlySet<WorkspacePage> = new Set<WorkspacePage>([
  'applications', 'containers', 'dns', 'gateway', 'gateway-settings', 'images', 'logs', 'platform',
  'routes', 'storage', 'swarm', 'tls', 'workloads',
])

const AREA_BY_SHORTCUT = new Map(AREAS.map((area) => [area.shortcut, area]))

/** The area a `G`-chord addresses, or nothing when the letter is unbound. */
export function areaByShortcut(letter: string): AreaEntry | undefined {
  return AREA_BY_SHORTCUT.get(letter.toLowerCase())
}
