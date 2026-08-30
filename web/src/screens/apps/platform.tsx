import { useState } from 'react'
import { Banner, Segmented, useToast } from '@nim.zone/ui'
import type { Node, ObservabilityStatus, TraefikStatus } from '../../data/types'
import { Screen } from '../../components/screen'
import type { WorkspacePage } from '../../navigation/navigation'
import { DatabasesTab } from './databases'
import { TelemetryTab } from './observability'

type Toast = ReturnType<typeof useToast>

type PlatformTab = 'data' | 'telemetry'

/**
 * The cluster singletons, in one place.
 *
 * These were two screens in two different areas: managed databases under
 * Workloads, and "Collectors" under Observe. They are the same kind of thing —
 * one instance for the whole cluster, that every application is wired to
 * rather than shipping its own — and separating them meant nothing on either
 * screen could say so.
 *
 * Saying so matters, because it is the rule that governs what happens when a
 * repository arrives carrying its own PostgreSQL and its own Prometheus.
 * Deploy substitutes these for them, and this is the screen that explains what
 * it substituted.
 */
export function PlatformServicesPage({ nodes, onOpen, status, toast, traefik }: {
  nodes: Node[]
  onOpen: (page: WorkspacePage) => void
  status: ObservabilityStatus | null
  toast: Toast
  traefik: TraefikStatus | null
}) {
  const [tab, setTab] = useState<PlatformTab>('data')
  const stateful = nodes.filter((node) => node.labels?.['nim.stateful'] === 'true')

  return (
    <Screen
      about="One PostgreSQL, one MongoDB, one Redis, one Prometheus, one Jaeger — for the whole cluster. A deployment that brings its own is pointed at these instead, and the substitution is shown before anything is deployed."
      insights={[
        {
          hint: stateful.length
            ? `${stateful.map((node) => node.hostname).join(', ')} carries nim.stateful=true`
            : 'No node carries nim.stateful=true, so no database can be placed',
          icon: 'database',
          label: 'Stateful nodes',
          onOpen: () => onOpen('swarm'),
          source: 'node labels',
          tone: stateful.length ? 'neutral' : 'warning',
          value: String(stateful.length),
        },
        {
          hint: status?.agentInstalled ? 'Collecting from every node' : 'Not deployed — nothing is scraping the fleet',
          icon: 'activity',
          label: 'Metrics',
          source: 'observability status',
          tone: status?.agentInstalled ? 'success' : 'warning',
          unmeasured: !status,
          value: status?.agentInstalled ? (status.agentHealthy ? 'Healthy' : 'Degraded') : 'Not deployed',
        },
        {
          hint: status?.logsEnabled ? 'Container output kept for seven days' : 'Container output is not being collected',
          icon: 'document',
          label: 'Logs',
          onOpen: () => onOpen('logs'),
          source: 'observability status',
          tone: status?.logsEnabled ? 'success' : 'neutral',
          unmeasured: !status,
          value: status?.logsEnabled ? 'Collecting' : 'Off',
        },
        {
          hint: 'Everything published goes through the gateway, these included when you expose them',
          icon: 'external',
          label: 'Reached through',
          onOpen: () => onOpen('gateway'),
          source: 'routing state',
          value: traefik?.service ? 'Traefik' : 'No gateway',
        },
      ]}
      page="platform"
      width="full"
    >
      {stateful.length === 0 ? (
        <Banner title="No node can hold data yet" tone="warning">
          A managed database is pinned to a node labelled <code>nim.stateful=true</code>, so that its volume and its
          scheduler agree on where the data lives. Label a node in Swarm before deploying one.
        </Banner>
      ) : null}

      <Segmented
        label="Platform service"
        onChange={(value: string) => setTab(value as PlatformTab)}
        options={[
          { label: 'Databases & caches', value: 'data' },
          { label: 'Metrics, traces & logs', value: 'telemetry' },
        ]}
        value={tab}
      />

      {tab === 'data' ? <DatabasesTab toast={toast} /> : null}
      {tab === 'telemetry' && status && traefik ? (
        <TelemetryTab
          nodes={nodes}
          onOpenGateway={() => onOpen('gateway')}
          onOpenSwarm={() => onOpen('swarm')}
          status={status}
          toast={toast}
          traefik={traefik}
        />
      ) : null}
      {tab === 'telemetry' && !(status && traefik) ? (
        <Banner title="Collector status has not been read yet" tone="neutral">
          The controller has not returned the observability or routing state for this cluster. That is a missing
          reading, not a missing collector — the insights above say which.
        </Banner>
      ) : null}
    </Screen>
  )
}
