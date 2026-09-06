import type { useToast } from '@nim.zone/ui'
import { api } from '../data/api'
import type { Command } from '../data/types'
import { commandFailureText, commandProgressText, isTerminal } from './command-outcome'

type Toast = ReturnType<typeof useToast>

/**
 * Queue-and-forget was the console's most common way of lying.
 *
 * Every mutating screen submitted a command, toasted "queued" in success green,
 * and moved on. Some then awaited the command purely to know when to refresh a
 * list — and threw the result away. A volume that could not be created and a
 * volume that was created looked identical: one green toast, one unchanged
 * list, and the controller's stated reason discarded.
 *
 * This is the one place a queued command is reported. It says "queued" once,
 * follows the command to whatever it becomes, and then says that.
 */

/** Budgets, named for what is actually being waited on. A command that outlives
    its budget is still running; the screen just stops watching. */
export const FOLLOW_RESOURCE_MS = 30 * 1000
/** A pull crosses the network and a build precedes some deployments. */
export const FOLLOW_TRANSFER_MS = 5 * 60 * 1000

export interface FollowOptions {
  /** What was queued, as a noun phrase: "Volume creation", "Image pull". */
  label: string
  onState?: (command: Command) => void
  timeoutMs?: number
  toast: Toast
}

/**
 * Follow one queued command and report what it did.
 *
 * Returns the final record so a caller can render it; the caller does not have
 * to inspect it to have told the truth, because this already has.
 */
export async function followQueuedCommand(command: Command, { label, onState, timeoutMs = FOLLOW_RESOURCE_MS, toast }: FollowOptions): Promise<Command> {
  toast({ message: `${label} queued (${command.id.slice(0, 12)})`, tone: 'success' })
  const final = isTerminal(command.state)
    ? command
    : await api.waitForCommand(command.id, timeoutMs, (update) => onState?.(update))
  if (final.state === 'succeeded') {
    toast({ message: `${label} completed`, tone: 'success' })
    return final
  }
  if (isTerminal(final.state)) {
    // Duration zero: a failure an operator has to read is not a notification
    // that should time out while they are looking somewhere else.
    toast({ duration: 0, message: `${label} did not complete. ${commandFailureText(final)}`, tone: 'danger' })
    return final
  }
  toast({ message: `${label} is still running as ${final.id.slice(0, 12)}. Watch it under Activity → Runs.`, tone: 'neutral' })
  return final
}

/** succeeded is the check a caller makes before treating the change as real —
    clearing a form, closing a sheet, or navigating away from it. */
export function succeeded(command: Command): boolean {
  return command.state === 'succeeded'
}

export { commandProgressText }
