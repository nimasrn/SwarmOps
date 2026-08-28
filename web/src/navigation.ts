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
 * The order here is the order on screen, and it is ordered by the operator's
 * JOB rather than by the system's object model: what you deliver, what you
 * deliver it onto, what is running, how traffic reaches it, what it is doing,
 * and what you did to it.
 */

export type WorkspacePage =
  | 'agent-diagnostics'
  | 'applications'
  | 'audit'
  | 'builds'
  | 'catalogue'
  | 'commands'
  | 'core'
  | 'databases'
  | 'dns'
  | 'gateway'
  | 'insights'
  | 'logs'
  | 'nodes'
  | 'observability'
  | 'overview'
  | 'provisioning'
  | 'registry'
  | 'resources'
  | 'routes'
  | 'servers'
  | 'services'
  | 'kubernetes-import'
  | 'source-deploy'
  | 'stacks'
  | 'tls'

export type AreaKey =
  | 'activity'
  | 'control'
  | 'deliver'
  | 'fleet'
  | 'observe'
  | 'overview'
  | 'traffic'
  | 'workloads'

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
  /** Shown above the contextual navigation — what this whole area is for. */
  summary: string
}

export const AREAS: AreaEntry[] = [
  {
    icon: 'home',
    key: 'overview',
    label: 'Overview',
    summary: 'The state of production and the next decision it needs.',
    pages: [
      { icon: 'home', key: 'overview', label: 'Command center', summary: 'Health, risk, and what to do next.', keywords: 'home dashboard start' },
    ],
  },
  {
    icon: 'play',
    key: 'deliver',
    label: 'Deliver',
    summary: 'Getting a change from source to running production.',
    pages: [
      { icon: 'play', key: 'source-deploy', label: 'Deploy from source', summary: 'Build a repository or directory and roll it out.', keywords: 'ship release rollout git build deploy' },
      { icon: 'layers', key: 'applications', label: 'Applications', summary: 'The products you operate as one lifecycle.', keywords: 'apps workload product' },
      { icon: 'package', key: 'builds', label: 'Images & builds', summary: 'Image history, digests, and build results.', keywords: 'docker image tag digest' },
      { icon: 'download', key: 'kubernetes-import', label: 'Import from Kubernetes', summary: 'Read manifests and see what Swarm can run, and what it cannot.', keywords: 'kubernetes k8s migrate import yaml manifest deployment helm' },
      { icon: 'cloud', key: 'registry', label: 'Container registry', summary: 'Where built images are pushed and pulled from.', keywords: 'ghcr docker hub credentials push' },
    ],
  },
  {
    icon: 'server',
    key: 'fleet',
    label: 'Fleet',
    summary: 'The machines under management and their connection evidence.',
    pages: [
      { icon: 'server', key: 'servers', label: 'Servers', summary: 'Enrolled hosts, their agents, and how to add one.', keywords: 'hosts machines agent enroll connect add' },
      { icon: 'check-circle', key: 'provisioning', label: 'Host setup', summary: 'Readiness plans that make a host safe to operate.', keywords: 'provisioning readiness bootstrap prepare' },
      { icon: 'layers', key: 'nodes', label: 'Swarm & placement', summary: 'Cluster membership, roles, labels, and drain.', keywords: 'nodes cluster manager worker placement' },
      { icon: 'link', key: 'agent-diagnostics', label: 'Connection diagnostics', summary: 'Why an agent, Docker, or Swarm layer is not answering.', keywords: 'agent debug troubleshoot offline unreachable' },
      { icon: 'package', key: 'resources', label: 'Docker resources', summary: 'Containers, volumes, networks, and images on a host.', keywords: 'containers volumes networks prune disk' },
    ],
  },
  {
    icon: 'database',
    key: 'workloads',
    label: 'Workloads',
    summary: 'What is scheduled and running right now.',
    pages: [
      { icon: 'terminal', key: 'services', label: 'Swarm services', summary: 'Long-running replicated processes and their tasks.', keywords: 'replicas tasks scale service' },
      { icon: 'layers', key: 'stacks', label: 'Stacks', summary: 'Namespaced groups of services, networks, and configs.', keywords: 'compose namespace stack' },
      { icon: 'database', key: 'databases', label: 'Managed databases', summary: 'Stateful dependencies with owned placement and backups.', keywords: 'postgres mongo redis backup stateful' },
    ],
  },
  {
    icon: 'globe',
    key: 'traffic',
    label: 'Traffic',
    summary: 'How requests from the internet reach a workload.',
    pages: [
      { icon: 'external', key: 'gateway', label: 'Gateway & ports', summary: 'Which gateway owns the edge, and what it publishes.', keywords: 'traefik ingress edge proxy ports' },
      { icon: 'arrow-forward', key: 'routes', label: 'Routes', summary: 'Hostname and path rules mapped onto services.', keywords: 'router host rule path traefik' },
      { icon: 'cloud', key: 'dns', label: 'DNS providers', summary: 'Where records are published from, and their credentials.', keywords: 'domain record cloudflare provider' },
      { icon: 'shield', key: 'tls', label: 'TLS certificates', summary: 'Certificate issuance, renewal, and expiry.', keywords: 'ssl https acme letsencrypt certificate' },
    ],
  },
  {
    icon: 'trend-up',
    key: 'observe',
    label: 'Observe',
    summary: 'The evidence a claim about production is made from.',
    pages: [
      { icon: 'trend-up', key: 'insights', label: 'Health', summary: 'Resource pressure and the checks behind a verdict.', keywords: 'metrics cpu memory insights monitoring' },
      { icon: 'document', key: 'logs', label: 'Logs', summary: 'Service and container output, live and searchable.', keywords: 'output stdout stderr tail fluentd' },
      { icon: 'chart', key: 'observability', label: 'Collectors', summary: 'The metric and log pipeline that produces the evidence.', keywords: 'prometheus grafana loki telemetry stack' },
    ],
  },
  {
    icon: 'activity',
    key: 'activity',
    label: 'Activity',
    summary: 'Every operation this console has run, and what it may run.',
    pages: [
      { icon: 'activity', key: 'commands', label: 'Runs', summary: 'Durable operations: queued, running, failed, recovered.', keywords: 'queue commands jobs operations history' },
      { icon: 'terminal', key: 'catalogue', label: 'Action catalog', summary: 'The fixed set of operations that may be queued.', keywords: 'actions catalogue run command available' },
      { icon: 'shield', key: 'audit', label: 'Audit trail', summary: 'Who did what, when, and against which host.', keywords: 'log security compliance events who' },
    ],
  },
  {
    icon: 'settings',
    key: 'control',
    label: 'Control',
    summary: 'The controller itself: authority, recovery, and policy.',
    pages: [
      { icon: 'settings', key: 'core', label: 'Controller & recovery', summary: 'Authority epoch, members, failover, and restore.', keywords: 'core settings quorum failover backup topology' },
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
 */
export const LEGACY_ROUTES: Record<string, WorkspacePage> = {
  agents: 'servers',
  applications: 'applications',
  deploy: 'source-deploy',
  diagnostics: 'agent-diagnostics',
  home: 'overview',
  infrastructure: 'nodes',
  observe: 'insights',
  operations: 'commands',
  settings: 'core',
  traefik: 'gateway',
  traffic: 'gateway',
}

/**
 * Screens that read the SELECTED cluster and therefore cannot render without
 * a connected Swarm manager. Everything else — the fleet screens, the
 * controller, the audit trail — is exactly what an operator needs when no
 * manager is connected, and must never be gated behind one.
 */
export const CLUSTER_PAGES: ReadonlySet<WorkspacePage> = new Set<WorkspacePage>([
  'applications', 'builds', 'databases', 'dns', 'gateway', 'insights', 'logs',
  'nodes', 'observability', 'resources', 'routes', 'services', 'stacks', 'tls',
])
