import { useEffect, useState } from 'react'
import {
  Button,
  Columns,
  DetailHeader,
  EmptyState,
  Icon,
  Inline,
  List,
  ListRow,
  Metric,
  MetricGrid,
  Mono,
  Page,
  Panel,
  StatusHero,
  StatusDot,
  Table,
} from '@nim.zone/ui'
import type { StatusTone, TableColumn } from '@nim.zone/ui'
import { api } from './api'
import type {
  Command,
  CoreTopology,
  ContainerSummary,
  ObservabilityStatus,
  Overview,
  Server,
  Stack,
  TraefikStatus,
} from './types'

interface HomeClusterData {
  observability: ObservabilityStatus
  overview: Overview
  stacks: Stack[]
  traefik: TraefikStatus
}

interface HomePageProps {
  commands: Command[]
  cluster?: HomeClusterData
  core: CoreTopology
  onAddNode: () => void
  onDiagnose: () => void
  onDeploy: () => void
  onOpenApplications: () => void
  onOpenInfrastructure: () => void
  onOpenOperations: () => void
  onOpenTraffic: () => void
  servers: Server[]
}

interface AttentionItem {
  detail: string
  id: string
  label: string
  tone: StatusTone
}

const COMMAND_COLUMNS: TableColumn<Command>[] = [
  { header: 'Operation', key: 'operation', render: (command) => <Mono size="inherit">{shortID(command.id)}</Mono> },
  { header: 'Action', key: 'action', render: (command) => command.action },
  { header: 'Target', key: 'target', render: (command) => <Mono>{command.target || command.nodeId}</Mono> },
  { header: 'State', key: 'state', render: (command) => <StatusDot pulse={command.state === 'running' || command.state === 'preparing'} tone={commandTone(command.state)}>{stateLabel(command.state)}</StatusDot> },
  { header: 'Actor', key: 'actor', render: (command) => command.actor },
  { header: 'Duration', key: 'duration', numeric: true, render: (command) => elapsed(command.createdAt, command.updatedAt) },
]

export function HomePage({
  cluster,
  commands,
  core,
  onAddNode,
  onDiagnose,
  onDeploy,
  onOpenApplications,
  onOpenInfrastructure,
  onOpenOperations,
  onOpenTraffic,
  servers,
}: HomePageProps) {
  const activeCore = core.members.find((member) => member.id === core.activeId)
  const connectedServer = servers.find((server) => server.connectionState === 'connected')
  const attention = attentionItems(core, cluster, servers, commands)
  const nodes = cluster?.overview.nodes ?? []
  const [containers, setContainers] = useState<ContainerSummary[]>([])
  const [containerEvidence, setContainerEvidence] = useState<'available' | 'loading' | 'unavailable'>('loading')
  const operating = core.controlEnabled && connectedServer?.connectionState === 'connected' && cluster?.overview.health !== 'unhealthy'
  const running = commands.filter((command) => command.state === 'running' || command.state === 'preparing' || command.state === 'leased')
  const visibleCommands = commands.slice(0, 6)
  const primaryAttention = attention[0]
  const next = nextStep({ attention: primaryAttention, cluster, connectedServer, core, servers })

  useEffect(() => {
    let cancelled = false
    if (!cluster) {
      setContainers([])
      setContainerEvidence('unavailable')
      return () => { cancelled = true }
    }
    setContainerEvidence('loading')
    void api.containers().then((next) => {
      if (!cancelled) {
        setContainers(Array.isArray(next) ? next : [])
        setContainerEvidence('available')
      }
    }).catch(() => {
      if (!cancelled) {
        setContainers([])
        setContainerEvidence('unavailable')
      }
    })
    return () => { cancelled = true }
  }, [cluster?.overview.generatedAt])

  const run = {
    deploy: onDeploy,
    diagnose: onDiagnose,
    operations: onOpenOperations,
    servers: onAddNode,
    traffic: onOpenTraffic,
  }[next.action]

  return (
    <Page width="full">
      <DetailHeader
        actions={
          <Inline>
            <Button iconStart="play" onClick={onDeploy} variant="accent">Deploy from source</Button>
            <Button iconStart="plus" onClick={onAddNode} variant="secondary">Add a server</Button>
          </Inline>
        }
        meta={
          <Inline gap="tight">
            {cluster
              ? <StatusDot tone="success">Snapshot read {formatTime(cluster.overview.generatedAt)}</StatusDot>
              : <StatusDot tone="neutral">No cluster snapshot</StatusDot>}
            {running.length ? <StatusDot pulse tone="accent">{running.length} operation{running.length === 1 ? '' : 's'} running</StatusDot> : null}
          </Inline>
        }
        subtitle="What production is doing, and the one thing worth doing about it. Every signal below names the layer that produced it."
        title="Command center"
      />

      {/* The hero used to state a verdict and stop. A console read under
          pressure should hand back the NEXT ACTION with the verdict, so the
          decision and the button that serves it are one glance apart. */}
      <StatusHero
        actions={<Button iconStart={next.icon} onClick={run} variant={operating && !primaryAttention ? 'secondary' : 'accent'}>{next.label}</Button>}
        description={next.detail}
        icon={operating ? 'check' : 'alert'}
        title={operating ? 'Production is operating' : 'Production evidence is incomplete'}
        tone={operating ? 'success' : 'warning'}
      />

      <Columns align="start" template="two-thirds">
        <Panel
          actions={attention.length ? <Button onClick={onOpenOperations} size="sm" variant="secondary">Open runs</Button> : undefined}
          caption={attention.length ? `${attention.length} open decision${attention.length === 1 ? '' : 's'}` : undefined}
          title={attention.length ? 'Needs an operator decision' : 'Nothing needs a decision'}
        >
          {attention.length ? (
            <List plain>
              {attention.map((item) => (
                <ListRow
                  key={item.id}
                  leading={<Icon name={item.tone === 'danger' ? 'alert' : 'activity'} size="sm" tone={item.tone === 'danger' ? 'danger' : 'warning'} />}
                  subtitle={item.detail}
                  title={item.label}
                  trailing={<StatusDot tone={item.tone}>{item.tone === 'danger' ? 'Blocking' : 'Review'}</StatusDot>}
                />
              ))}
            </List>
          ) : (
            <EmptyState
              description="The current controller, agent, cluster, and durable command evidence contains no condition that requires intervention."
              icon="check-circle"
              title="Clear"
            />
          )}
        </Panel>

        {/* The four layers a claim about production passes through, in the
            order they fail in. Reading it top to bottom is the diagnosis:
            the first row that is not green is the layer to open. */}
        <Panel description="The first row that is not healthy is the layer to open." title="Where the signal comes from">
          <List plain>
            <ListRow
              leading={<Icon name="shield" size="sm" />}
              subtitle={activeCore ? 'Owns durable operations and policy' : `Local identity ${core.localId}`}
              title="Controller"
              trailing={<StatusDot tone={core.controlEnabled ? 'success' : 'warning'}>{core.controlEnabled ? 'Ready' : 'Standby'}</StatusDot>}
            />
            <ListRow
              leading={<Icon name="link" size="sm" />}
              subtitle="Authenticated outbound TLS; no inbound agent port"
              title="Outbound agent"
              trailing={<StatusDot tone={connectedServer ? 'success' : 'warning'}>{connectedServer ? 'Connected' : 'Missing'}</StatusDot>}
            />
            <ListRow
              leading={<Icon name="package" size="sm" />}
              subtitle={connectedServer?.dockerVersion ? `Engine ${connectedServer.dockerVersion}` : 'Reports local containers and Swarm state'}
              title="Docker Engine"
              trailing={<StatusDot tone={connectedServer?.dockerAvailable ? 'success' : 'warning'}>{connectedServer?.dockerAvailable ? 'Healthy' : 'Unavailable'}</StatusDot>}
            />
            <ListRow
              leading={<Icon name="layers" size="sm" />}
              subtitle={connectedServer?.swarmControlAvailable ? `${nodes.length} node${nodes.length === 1 ? '' : 's'} in the selected cluster` : 'Docker can run without Swarm services'}
              title="Swarm manager"
              trailing={<StatusDot tone={connectedServer?.swarmControlAvailable ? 'success' : 'neutral'}>{connectedServer?.swarmControlAvailable ? 'Active' : 'Not active'}</StatusDot>}
            />
          </List>
        </Panel>
      </Columns>

      <Panel
        actions={<Inline><Button onClick={onOpenApplications} size="sm" variant="ghost">Applications</Button><Button onClick={onOpenInfrastructure} size="sm" variant="ghost">Swarm & placement</Button><Button onClick={onOpenTraffic} size="sm" variant="ghost">Traffic</Button></Inline>}
        description="Counted from the selected cluster's own last report, not from what SwarmOps was asked to create."
        title="What is actually running"
      >
        <MetricGrid columns={4} dense>
          <Metric
            hint={containerEvidence === 'available' ? 'Docker containers, including Compose workloads' : containerEvidence === 'loading' ? 'Reading Docker container inventory' : 'Open Docker resources for current evidence'}
            icon="package"
            label="Containers"
            value={containerEvidence === 'available' ? String(containers.length) : '—'}
          />
          <Metric
            hint={cluster?.overview.summary.services ? 'Processes scheduled by Docker Swarm' : 'Swarm can be active while running zero services'}
            icon="terminal"
            label="Swarm services"
            value={String(cluster?.overview.summary.services ?? 0)}
          />
          <Metric hint={cluster?.stacks.length ? 'Namespaces grouping Swarm services' : 'No namespaced service groups'} icon="layers" label="Stacks" value={String(cluster?.stacks.length ?? 0)} />
          <Metric
            hint={cluster?.traefik.service ? 'The managed gateway is scheduled and owns the edge' : 'Deployed applications have no public hostname until a gateway owns the edge'}
            icon="globe"
            label="Edge gateway"
            tone={cluster ? (cluster.traefik.service ? 'success' : 'warning') : undefined}
            value={cluster ? (cluster.traefik.service ? 'Running' : 'None') : '—'}
          />
        </MetricGrid>
      </Panel>

      <Panel actions={<Button onClick={onOpenOperations} size="sm" variant="ghost">View all runs</Button>} flush title="Recent operations">
        {visibleCommands.length
          ? <Table columns={COMMAND_COLUMNS.slice(1, 5)} rowKey={(command) => command.id} rows={visibleCommands} />
          : <EmptyState description="Queued, running, retrying, and completed operations appear here as they are recorded." icon="terminal" title="No operations yet" />}
      </Panel>
    </Page>
  )
}

interface NextStep {
  action: 'deploy' | 'diagnose' | 'operations' | 'servers' | 'traffic'
  detail: string
  icon: 'activity' | 'external' | 'link' | 'play' | 'plus'
  label: string
}

/**
 * One recommendation, chosen in the order a failure actually blocks work.
 *
 * A console that lists six things an operator could do has left the ranking —
 * the hard part — to the person under pressure. The order here is the order of
 * dependency: without authority nothing may be changed, without an agent
 * nothing may be read, without a cluster nothing may be scheduled, and a
 * failed run outranks new work because it is already someone's outage.
 */
function nextStep({ attention, cluster, connectedServer, core, servers }: {
  attention?: AttentionItem
  cluster?: HomeClusterData
  connectedServer?: Server
  core: CoreTopology
  servers: Server[]
}): NextStep {
  if (!core.controlEnabled) {
    return { action: 'operations', detail: 'This controller does not hold the active authority epoch, so every change is fenced. Resolve the handoff before anything else — no other step can complete while it stands.', icon: 'activity', label: 'Open controller recovery' }
  }
  if (!servers.length) {
    return { action: 'servers', detail: 'No host is enrolled yet. Enrollment is one outbound command on Ubuntu; the agent keeps its own key and waits for you to approve its code.', icon: 'plus', label: 'Connect your first server' }
  }
  if (!connectedServer) {
    return { action: 'diagnose', detail: 'No agent is answering the controller, so nothing on this screen is current. Diagnostics names the layer that stopped — transport, Docker, or Swarm.', icon: 'link', label: 'Diagnose the connection' }
  }
  if (attention) {
    return { action: 'operations', detail: `${attention.label}. ${attention.detail}`, icon: 'activity', label: 'Review the open decision' }
  }
  if (!cluster) {
    return { action: 'servers', detail: 'An agent is connected but this console is not pointed at a Swarm manager. Selection is deliberate: reads and changes stay scoped to one explicit cluster.', icon: 'plus', label: 'Choose a cluster' }
  }
  if (!cluster.traefik.service) {
    return { action: 'traffic', detail: 'The cluster is healthy and nothing needs a decision. No gateway owns the edge yet, so a deployed application has no public hostname until one does.', icon: 'external', label: 'Set up the gateway' }
  }
  return { action: 'deploy', detail: 'Controller, agent, Docker, and Swarm are all answering, and no run is waiting on a decision. The cluster is ready for a deployment.', icon: 'play', label: 'Deploy from source' }
}

function attentionItems(core: CoreTopology, cluster: HomeClusterData | undefined, servers: Server[], commands: Command[]): AttentionItem[] {
  const items: AttentionItem[] = []
  if (!core.controlEnabled) items.push({ detail: 'Mutations are fenced until this controller owns the active authority epoch.', id: 'core-fenced', label: 'Controller is read-only', tone: 'warning' })
  if (!cluster) items.push({ detail: 'Select a connected Swarm manager to resume cluster reads and operations.', id: 'manager-missing', label: 'Cluster manager is not connected', tone: 'warning' })
  for (const server of servers.filter((candidate) => candidate.connectionState !== 'connected' || candidate.agentHealth?.state === 'unhealthy').slice(0, 2)) {
    items.push({ detail: server.agentHealth?.summary ?? 'The agent cannot currently be reached by the controller.', id: `server-${server.id}`, label: `${server.name} needs connectivity review`, tone: 'danger' })
  }
  for (const command of commands.filter((candidate) => candidate.state === 'needs_attention' || candidate.state === 'failed').slice(0, 2)) {
    items.push({
      detail: command.failureSummary ?? command.lastError ?? `${command.action} on ${command.target || command.nodeId} stopped in ${stateLabel(command.state).toLowerCase()}.`,
      id: `command-${command.id}`,
      label: command.action === 'observability.core' ? 'Monitoring deployment needs review' : `${command.action} needs review`,
      tone: 'danger',
    })
  }
  return items.slice(0, 4)
}

function commandTone(state: Command['state']): StatusTone {
  if (state === 'succeeded') return 'success'
  if (state === 'failed' || state === 'needs_attention') return 'danger'
  if (state === 'retry_scheduled') return 'warning'
  if (state === 'running' || state === 'preparing' || state === 'leased') return 'accent'
  return 'neutral'
}

function stateLabel(state: Command['state']) {
  return state.split('_').map(capitalize).join(' ')
}

function capitalize(value: string) {
  return value ? `${value[0]?.toUpperCase()}${value.slice(1)}` : value
}

function shortID(value: string) {
  return value.length > 12 ? `${value.slice(0, 10)}…` : value
}

function elapsed(start: string, end: string) {
  const seconds = Math.max(0, Math.round((Date.parse(end) - Date.parse(start)) / 1000))
  if (!Number.isFinite(seconds)) return '—'
  if (seconds < 60) return `${seconds} s`
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return remainder ? `${minutes} m ${remainder} s` : `${minutes} m`
}

function formatTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(date)
}
