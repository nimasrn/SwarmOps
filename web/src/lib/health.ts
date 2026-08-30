import type { StatusTone } from '@nim.zone/ui'
import type { Command, Health, Node, Server } from '../data/types'

/**
 * The rules that turn raw state into the words this console is allowed to say.
 *
 * The console's accent is malachite, so a green dot alone can never be the
 * claim: every helper here returns a tone AND the vocabulary that names it, and
 * callers are expected to print both.
 */

export function nodeHealth(node: Node): 'healthy' | 'degraded' | 'unhealthy' {
  if (node.state !== 'ready') return 'unhealthy'
  if (node.availability !== 'active' || hostProbeHealth(node) === 'degraded') return 'degraded'
  return 'healthy'
}

/**
 * A node with no probe is not an unhealthy node. "Unknown" is a real third
 * answer and collapsing it into "degraded" would report a fault the console
 * never observed.
 */
export function hostProbeHealth(node: Node): 'healthy' | 'degraded' | 'unknown' {
  if (node.agent.healthy) return 'healthy'
  return node.agent.address || node.agent.error ? 'degraded' : 'unknown'
}

export function serverHealth(server: Server): Health {
  return server.agentHealth?.state ?? 'unknown'
}

/** Whether this host may be made the console's selected cluster target. */
export function serverCanManage(server: Server) {
  return server.connectionState === 'connected' && server.swarmControlAvailable && serverHealth(server) === 'healthy'
}

export function isServerConnected(server: Server) {
  return server.connectionState === 'connected' && serverHealth(server) !== 'unhealthy'
}

export function healthTone(health: string): StatusTone {
  if (health === 'healthy') return 'success'
  if (health === 'unhealthy') return 'danger'
  if (health === 'degraded') return 'warning'
  return 'neutral'
}

export function commandTone(state: Command['state']): StatusTone {
  if (state === 'succeeded') return 'success'
  if (state === 'failed' || state === 'needs_attention') return 'danger'
  if (state === 'retry_scheduled') return 'warning'
  if (state === 'running' || state === 'preparing' || state === 'leased') return 'accent'
  return 'neutral'
}

/** States in which a run has stopped needing the queue and started needing a person. */
export function isStalled(command: Command) {
  return command.state === 'needs_attention' || command.state === 'failed'
}

export function isInFlight(command: Command) {
  return command.state === 'running' || command.state === 'preparing' || command.state === 'leased'
}

export function isPending(command: Command) {
  return !['cancelled', 'failed', 'needs_attention', 'succeeded', 'superseded'].includes(command.state)
}
