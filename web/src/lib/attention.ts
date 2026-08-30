import type { StatusTone } from '@nim.zone/ui'
import type { WorkspacePage } from '../navigation/navigation'
import type { Command, CoreTopology, Server } from '../data/types'
import type { DashboardData } from '../data/dashboard'
import { isStalled, serverHealth } from './health'
import { sentence } from './format'

/**
 * What currently needs a person, computed once for the whole console.
 *
 * This list used to live inside the command centre, which meant it existed
 * only while that screen was open: an operator who went straight to Traffic
 * never learned that a run had stopped. It is now read by the command centre
 * AND by the attention control in the masthead, so the count in the chrome and
 * the rows on the overview cannot disagree — they are the same array.
 *
 * Ordering is dependency order, not severity order. Without authority nothing
 * may be changed, without an agent nothing may be read, without a cluster
 * nothing may be scheduled; a stalled run outranks new work because it is
 * already somebody's outage.
 */
export interface AttentionItem {
  detail: string
  id: string
  label: string
  /** The screen that can actually resolve it. */
  page: WorkspacePage
  tone: StatusTone
}

export function attentionItems(
  core: CoreTopology | null,
  cluster: DashboardData | undefined,
  servers: Server[],
  commands: Command[],
): AttentionItem[] {
  const items: AttentionItem[] = []

  if (core && !core.controlEnabled) {
    items.push({
      detail: 'Mutations are fenced until this controller owns the active authority epoch.',
      id: 'core-fenced',
      label: 'Controller is read-only',
      page: 'core',
      tone: 'warning',
    })
  }
  if (!cluster) {
    items.push({
      detail: 'Select a connected Swarm manager to resume cluster reads and operations.',
      id: 'manager-missing',
      label: 'Cluster manager is not connected',
      page: 'machines',
      tone: 'warning',
    })
  }
  for (const server of servers.filter((candidate) => candidate.connectionState !== 'connected' || serverHealth(candidate) === 'unhealthy').slice(0, 2)) {
    items.push({
      detail: server.agentHealth?.summary ?? 'The agent cannot currently be reached by the controller.',
      id: `server-${server.id}`,
      label: `${server.name} needs connectivity review`,
      page: 'machines',
      tone: 'danger',
    })
  }

  // One decision per ACTION, not per record. A failed operation and its failed
  // retry are two rows in the ledger and one thing for an operator to decide;
  // listing both produced two identical lines and a count that said "2 open
  // decisions" when there was one.
  const byAction = new Map<string, { attempts: number; command: Command }>()
  for (const command of commands.filter(isStalled)) {
    const seen = byAction.get(command.action)
    if (!seen) {
      byAction.set(command.action, { attempts: 1, command })
      continue
    }
    seen.attempts += 1
    // Keep the newest, because that is the one whose error is current.
    if (Date.parse(command.createdAt) > Date.parse(seen.command.createdAt)) seen.command = command
  }

  for (const { attempts, command } of [...byAction.values()].slice(0, 2)) {
    const base = command.failureSummary
      ?? command.lastError
      ?? `${command.action} on ${command.target || command.nodeId} stopped in ${sentence(command.state).toLowerCase()}.`
    items.push({
      detail: attempts > 1 ? `${base} ${attempts} attempts have stopped this way.` : base,
      id: `command-${command.action}`,
      label: command.action === 'observability.core' ? 'Monitoring deployment needs review' : `${command.action} needs review`,
      page: 'runs',
      tone: 'danger',
    })
  }

  return items.slice(0, 4)
}

/** How many of these actually stop work, as opposed to asking for a look. */
export function blockingCount(items: AttentionItem[]) {
  return items.filter((item) => item.tone === 'danger').length
}
