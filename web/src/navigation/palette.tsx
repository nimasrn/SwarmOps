import type { PaletteCommand } from '@nim.zone/ui'
import { AREAS, pageEntry, type WorkspacePage } from './navigation'
import type { Server, Service, Stack } from '../data/types'

export interface PaletteEntity {
  /** The second line: what this thing currently is, not what it is called. */
  hint: string
  id: string
  kind: 'application' | 'route' | 'server' | 'service' | 'stack'
  name: string
  /** What the row opens. */
  page: WorkspacePage
}

export interface PaletteContext {
  /** Named things in the selected cluster, so the palette answers "where is
      checkout-api" as well as "where is the services screen". */
  entities: PaletteEntity[]
  /** Servers that can be made the selected target. */
  managers: Server[]
  onRefresh: () => void
  onSelectServer: (id: string) => void
  onShortcuts: () => void
  onSignOut: () => void
  open: (page: WorkspacePage) => void
  /** Screens this operator opened recently, newest first. */
  recents: WorkspacePage[]
  refreshLabel: string
  selectedServerID: string
}

const KIND_ICON = {
  application: 'layers',
  route: 'arrow-forward',
  server: 'server',
  service: 'terminal',
  stack: 'layers',
} as const

const KIND_LABEL = {
  application: 'Application',
  route: 'Route',
  server: 'Server',
  service: 'Swarm service',
  stack: 'Stack',
} as const

/**
 * Everything the console can be asked to do, as one flat, ranked list.
 *
 * The screen finder this replaces could only NAVIGATE, so the two things an
 * operator reaches for most under pressure — start a deployment, and change
 * which cluster they are pointed at — were the two things it could not do.
 * A palette that lists destinations and not actions has taught the operator
 * that the keyboard is for reading.
 *
 * The order is the order of certainty. Actions first, because a query that
 * matches both a screen and the operation that screen exists to run should
 * offer the operation: the operator who typed it is on their way to press a
 * button. Then the screens they were just on, then the named things in the
 * cluster, then every remaining destination.
 */
export function paletteCommands(context: PaletteContext): PaletteCommand[] {
  const { entities, managers, onRefresh, onSelectServer, onShortcuts, onSignOut, open, recents, refreshLabel, selectedServerID } = context

  const actions: PaletteCommand[] = [
    { group: 'Run an action', hint: 'Build a repository or directory and roll it out', icon: 'play', id: 'act-deploy', keywords: 'ship release rollout new', label: 'Deploy from source', onRun: () => open('deploy') },
    { group: 'Run an action', hint: 'Enroll a host with one outbound install command', icon: 'plus', id: 'act-add-server', keywords: 'enroll connect machine host agent new', label: 'Add a server', onRun: () => open('machines') },
    { group: 'Run an action', hint: refreshLabel, icon: 'refresh', id: 'act-refresh', keywords: 'reload update snapshot', label: 'Refresh this screen', onRun: onRefresh, shortcut: 'R' },
    { group: 'Run an action', hint: 'Find out why an agent, Docker, or Swarm is not answering', icon: 'link', id: 'act-diagnose', keywords: 'troubleshoot debug offline broken', label: 'Diagnose a connection', onRun: () => open('machines'), shortcut: 'D' },
    { group: 'Run an action', hint: 'Review queued, running, failed, and recovered operations', icon: 'activity', id: 'act-runs', keywords: 'queue jobs history operations', label: 'Review recent runs', onRun: () => open('runs') },
    { group: 'Run an action', hint: 'Every chord this console binds, in one sheet', icon: 'sparkle', id: 'act-shortcuts', keywords: 'keyboard keys help chord binding', label: 'Show keyboard shortcuts', onRun: onShortcuts, shortcut: '?' },
    { group: 'Run an action', hint: 'End this operator session in the browser', icon: 'sign-out', id: 'act-sign-out', keywords: 'logout leave exit', label: 'Sign out', onRun: onSignOut },
  ]

  // Switching the selected cluster is navigation of a different axis: the same
  // screen, pointed somewhere else. It is the change most likely to be made
  // from the keyboard mid-incident, so each target is its own row rather than
  // a row that opens a picker.
  const environments: PaletteCommand[] = managers
    .filter((server) => server.id !== selectedServerID)
    .map((server) => ({
      group: 'Point at another cluster',
      hint: server.connectionState === 'connected'
        ? `Agent connected${server.dockerVersion ? ` · Docker ${server.dockerVersion}` : ''}`
        : 'Agent reconnecting — reads may be stale',
      icon: 'server',
      id: `env-${server.id}`,
      keywords: `${server.host} cluster target manager environment`,
      label: `Point the console at ${server.name}`,
      onRun: () => onSelectServer(server.id),
    }))

  const recent: PaletteCommand[] = recents.map((page) => {
    const entry = pageEntry(page)
    return {
      group: 'Jump back to',
      hint: entry.summary,
      icon: entry.icon,
      id: `recent-${page}`,
      keywords: entry.keywords,
      label: entry.label,
      onRun: () => open(page),
    }
  })

  // A named thing an operator can see on a screen should be findable by that
  // name. Typing `checkout-api` and being offered the services screen — with
  // no idea whether `checkout-api` is on it — is the difference between a
  // palette and a menu.
  const named: PaletteCommand[] = entities.map((entity) => ({
    group: 'In this cluster',
    hint: entity.hint,
    icon: KIND_ICON[entity.kind],
    id: `entity-${entity.kind}-${entity.id}`,
    keywords: `${KIND_LABEL[entity.kind]} ${entity.kind}`,
    label: entity.name,
    onRun: () => open(entity.page),
  }))

  const destinations: PaletteCommand[] = AREAS.flatMap((area) =>
    area.pages
      // A screen already offered under "Jump back to" is the same row twice.
      .filter((page) => !recents.includes(page.key))
      .map((page) => ({
        group: `Go to · ${area.label}`,
        hint: page.summary,
        icon: page.icon,
        id: `go-${page.key}`,
        keywords: `${page.keywords ?? ''} ${area.label}`,
        label: page.label,
        onRun: () => open(page.key),
        shortcut: page.key === area.pages[0]?.key ? `G ${area.shortcut.toUpperCase()}` : undefined,
      })),
  )

  return [...actions, ...environments, ...recent, ...named, ...destinations]
}

/**
 * The searchable things in one cluster snapshot.
 *
 * Deliberately built from the snapshot the console has already read rather
 * than from a new query: the palette must open instantly, and a search box
 * that waits on the network is one an operator stops trusting mid-incident.
 */
export function paletteEntities({ servers, services, stacks }: {
  servers: Server[]
  services: Service[]
  stacks: Stack[]
}): PaletteEntity[] {
  return [
    ...servers.map((server) => ({
      hint: server.connectionState === 'connected' ? `Connected host · ${server.host}` : `Reconnecting · ${server.host}`,
      id: server.id,
      kind: 'server' as const,
      name: server.name,
      page: 'machines' as const,
    })),
    ...services.map((service) => ({
      hint: `${service.runningTasks} / ${service.desiredTasks} running${service.stack ? ` · ${service.stack}` : ''}`,
      id: service.id,
      kind: 'service' as const,
      name: service.name,
      page: 'workloads' as const,
    })),
    ...stacks.map((stack) => ({
      hint: `${stack.serviceCount} service${stack.serviceCount === 1 ? '' : 's'} · ${stack.runningTasks} running`,
      id: stack.name,
      kind: 'stack' as const,
      name: stack.name,
      page: 'workloads' as const,
    })),
  ]
}
