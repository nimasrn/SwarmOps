import type { StatusTone } from '@nim.zone/ui'
import type { Capacity, Command, Health, Node, Server } from '../data/types'

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

/**
 * What the host probe's state is called, everywhere it is named.
 *
 * "Agent" is already the word for the enrolled outbound agent, which is a
 * different thing that can be connected while this one is absent — the state
 * this cluster is in. The probe is therefore named the host probe, and its
 * absence is called "not installed" rather than "not configured": there is no
 * configuration an operator is missing, there is a stack that was never
 * deployed.
 */
export function hostProbeLabel(node: Node) {
  if (node.agent.healthy) return node.agent.version || 'Online'
  return node.agent.error ? 'Unreachable' : 'Not installed'
}

/**
 * Docker reports a node's CPU and memory capacity; only the host probe reports
 * what is used, and disk at all. A zero from an absent probe is not a
 * measurement, and printing it as `0 B` states a reading that was never taken.
 */
export function capacityMeasured(value: Capacity) {
  return value.used > 0 || value.available > 0
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
