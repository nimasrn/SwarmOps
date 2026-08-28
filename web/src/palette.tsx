import type { PaletteCommand } from '@nim.zone/ui'
import { AREAS, type WorkspacePage } from './navigation'
import type { Server } from './types'

export interface PaletteContext {
  /** Servers that can be made the selected target. */
  managers: Server[]
  onRefresh: () => void
  onSelectServer: (id: string) => void
  onSignOut: () => void
  open: (page: WorkspacePage) => void
  refreshLabel: string
  selectedServerID: string
}

/**
 * Everything the console can be asked to do, as one flat, ranked list.
 *
 * The screen finder this replaces could only NAVIGATE, so the two things an
 * operator reaches for most under pressure — start a deployment, and change
 * which cluster they are pointed at — were the two things it could not do.
 * A palette that lists destinations and not actions has taught the operator
 * that the keyboard is for reading.
 *
 * Actions come first: a query that matches both a screen and the operation
 * that screen exists to run should offer the operation, because the operator
 * who typed it is on their way to press a button.
 */
export function paletteCommands(context: PaletteContext): PaletteCommand[] {
  const { managers, onRefresh, onSelectServer, onSignOut, open, refreshLabel, selectedServerID } = context

  const actions: PaletteCommand[] = [
    { group: 'Run an action', hint: 'Build a repository or directory and roll it out', icon: 'play', id: 'act-deploy', keywords: 'ship release rollout new', label: 'Deploy from source', onRun: () => open('source-deploy') },
    { group: 'Run an action', hint: 'Enroll a host with one outbound install command', icon: 'plus', id: 'act-add-server', keywords: 'enroll connect machine host agent new', label: 'Add a server', onRun: () => open('servers') },
    { group: 'Run an action', hint: refreshLabel, icon: 'refresh', id: 'act-refresh', keywords: 'reload update snapshot', label: 'Refresh this screen', onRun: onRefresh, shortcut: 'R' },
    { group: 'Run an action', hint: 'Find out why an agent, Docker, or Swarm is not answering', icon: 'link', id: 'act-diagnose', keywords: 'troubleshoot debug offline broken', label: 'Diagnose a connection', onRun: () => open('agent-diagnostics') },
    { group: 'Run an action', hint: 'Review queued, running, failed, and recovered operations', icon: 'activity', id: 'act-runs', keywords: 'queue jobs history operations', label: 'Review recent runs', onRun: () => open('commands') },
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

  const destinations: PaletteCommand[] = AREAS.flatMap((area) =>
    area.pages.map((page) => ({
      group: `Go to · ${area.label}`,
      hint: page.summary,
      icon: page.icon,
      id: `go-${page.key}`,
      keywords: `${page.keywords ?? ''} ${area.label}`,
      label: page.label,
      onRun: () => open(page.key),
    })),
  )

  return [...actions, ...environments, ...destinations]
}
