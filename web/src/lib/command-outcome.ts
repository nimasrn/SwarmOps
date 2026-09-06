import type { Command, CommandState } from '../data/types'

/**
 * What a queued command actually did, said in the controller's own words.
 *
 * A command is durable and asynchronous: the console gets a 202 and an ID, and
 * the work happens on a machine afterwards. Reporting that acknowledgement as
 * the outcome is the mistake this module exists to prevent — an operator told
 * "queued" reads it as "done", and a deployment that ends in needs_attention
 * looks identical to one that is serving.
 *
 * Nothing here invents an explanation. The summary, the code, and the hint are
 * all fields the controller set; when it set none, that is said plainly rather
 * than papered over with a generic sentence.
 */

/** A command in one of these states has stopped moving on its own. */
export const TERMINAL_STATES: CommandState[] = ['succeeded', 'failed', 'needs_attention', 'superseded', 'cancelled']

export function isTerminal(state: CommandState): boolean {
  return TERMINAL_STATES.includes(state)
}

/** commandProgressText names what is happening now, for the line an operator
    watches while they wait. */
export function commandProgressText(command: Command): string {
  const attempt = command.attempt > 1 ? ` · attempt ${command.attempt} of ${command.maxAttempts}` : ''
  switch (command.state) {
    case 'uploading': return `Uploading${attempt}`
    case 'queued': return `Queued${attempt}`
    case 'leased': return `Claimed by a machine${attempt}`
    case 'preparing': return `Preparing${attempt}`
    case 'running': return `Running${attempt}`
    case 'retry_scheduled': return `Failed and scheduled for retry${attempt}`
    default: return `${command.state}${attempt}`
  }
}

/** commandFailureText is everything the controller recorded about why a
    command did not succeed, in one sentence an operator can act on. */
export function commandFailureText(command: Command): string {
  const parts: string[] = []
  if (command.failureSummary) parts.push(command.failureSummary)
  // The last error usually restates the summary and then adds the attempt
  // count to it. Printing both puts the same sentence on screen twice, which
  // reads as two separate problems.
  if (command.lastError) {
    const extra = command.failureSummary && command.lastError.includes(command.failureSummary)
      ? command.lastError.replace(command.failureSummary, '').trim()
      : command.lastError
    if (extra && extra !== command.failureSummary) parts.push(extra)
  }
  if (parts.length === 0) {
    parts.push(command.state === 'superseded'
      ? 'A newer command replaced this one before it ran.'
      : `The controller ended this command as ${command.state} without recording a reason.`)
  }
  if (command.recoveryHint) parts.push(command.recoveryHint)
  return parts.join(' ')
}

/** commandOutcomeTitle heads the banner. It names the state rather than
    calling everything an error: a superseded command is not a failure, and a
    command needing attention is not one the operator can simply retry. */
export function commandOutcomeTitle(command: Command): string {
  switch (command.state) {
    case 'needs_attention': return 'This deployment needs attention'
    case 'superseded': return 'This deployment was superseded'
    case 'cancelled': return 'This deployment was cancelled'
    default: return 'This deployment failed'
  }
}

export function commandOutcomeTone(command: Command): 'danger' | 'warning' {
  return command.state === 'superseded' || command.state === 'cancelled' ? 'warning' : 'danger'
}
