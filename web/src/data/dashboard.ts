import type { Node, ObservabilityStatus, Overview, Service, Stack, TraefikStatus } from './types'

/**
 * One read of one selected cluster.
 *
 * Every cluster screen is drawn from this single snapshot rather than fetching
 * on its own, so two panels on the same screen can never disagree about what
 * the cluster was doing — and `overview.generatedAt` is the one timestamp the
 * console shows to say how old the whole picture is.
 */
export interface DashboardData {
  nodes: Node[]
  observability: ObservabilityStatus
  overview: Overview
  services: Service[]
  stacks: Stack[]
  traefik: TraefikStatus
}
