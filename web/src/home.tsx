import { useEffect, useState } from 'react'
import {
  Body,
  Button,
  Columns,
  DetailHeader,
  EmptyState,
  Facts,
  Icon,
  Inline,
  List,
  ListRow,
  Metric,
  MetricGrid,
  Mono,
  Page,
  Panel,
  Stack as Rows,
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
  const visibleCommands = commands.slice(0, 6)
  const primaryAttention = attention[0]

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

  return (
    <Page width="full">
      <DetailHeader
        actions={<Inline><Button iconStart="play" onClick={onDeploy} variant="accent">Deploy application</Button><Button iconStart="plus" onClick={onAddNode} variant="secondary">Add node</Button></Inline>}
        meta={cluster ? <StatusDot tone="success">Production snapshot · {formatTime(cluster.overview.generatedAt)}</StatusDot> : <StatusDot tone="neutral">Waiting for production evidence</StatusDot>}
        subtitle="Health, risk, and the next operator decision. Every signal names the source that produced it."
        title="Command center"
      />

      <StatusHero
        description={operating ? `Agent, Docker, and Swarm are responding${attention.length ? `; ${attention.length} reviewed operation${attention.length === 1 ? '' : 's'} still need an operator decision.` : '.'}` : connectedServer ? 'The agent connection or cluster evidence is incomplete. Open the attention item below for the exact failing layer.' : 'Connect an outbound machine agent to begin production inspection.'}
        icon={operating ? 'check' : 'alert'}
        title={operating ? 'Production is operating' : 'Production evidence is incomplete'}
        tone={operating ? 'success' : 'warning'}
      />

      <MetricGrid aria-label="Production signal summary" columns={4} dense>
        <Metric hint={activeCore ? 'Owns durable operations and policy' : `Local identity ${core.localId}`} icon="shield" label="Controller" tone={core.controlEnabled ? 'success' : 'warning'} value={core.controlEnabled ? 'Ready' : 'Standby'} />
        <Metric hint="Authenticated outbound TLS; no inbound agent port" icon="link" label="Agent connection" tone={connectedServer ? 'success' : 'warning'} value={connectedServer ? 'Connected' : 'Not connected'} />
        <Metric hint={connectedServer?.dockerVersion || 'No current Engine version'} icon="package" label="Docker Engine" tone={connectedServer?.dockerAvailable ? 'success' : 'warning'} value={connectedServer?.dockerAvailable ? 'Healthy' : 'Unavailable'} />
        <Metric hint={connectedServer?.swarmControlAvailable ? `${nodes.length} node${nodes.length === 1 ? '' : 's'} · selected manager` : 'Docker can run without Swarm services'} icon="layers" label="Docker Swarm" tone={connectedServer?.swarmControlAvailable ? 'success' : 'neutral'} value={connectedServer?.swarmControlAvailable ? 'Active' : connectedServer ? 'Not initialized' : 'Unknown'} />
      </MetricGrid>

      <Columns template="two-thirds">
        <Panel
          actions={primaryAttention ? <Inline><Button onClick={onOpenOperations} size="sm" variant="accent">Review recovery</Button><Button onClick={onDiagnose} size="sm" variant="secondary">Open evidence</Button></Inline> : undefined}
          caption={attention.length ? `${attention.length} open decision${attention.length === 1 ? '' : 's'}` : 'No open decision'}
          title={primaryAttention?.label ?? 'No operator action required'}
        >
          {primaryAttention ? <Rows gap="tight"><Body>{primaryAttention.detail}</Body><List plain>{attention.map((item) => <ListRow key={item.id} leading={<Icon name={item.tone === 'danger' ? 'alert' : 'activity'} size="sm" tone={item.tone === 'danger' ? 'danger' : 'warning'} />} subtitle={item.detail} title={item.label} trailing={<StatusDot tone={item.tone}>Review</StatusDot>} />)}</List></Rows> : <Body size="sm" tone="muted">The current controller, agent, cluster, and durable command evidence contains no condition requiring intervention.</Body>}
        </Panel>
        <Panel title="Where the signal comes from">
          <List plain>
            <ListRow leading={<Icon name="shield" size="sm" />} subtitle="Stores authority and durable operations" title="Controller" trailing={<StatusDot tone={core.controlEnabled ? 'success' : 'warning'}>{core.controlEnabled ? 'Ready' : 'Standby'}</StatusDot>} />
            <ListRow leading={<Icon name="link" size="sm" />} subtitle="Maintains authenticated long polling" title="Outbound agent" trailing={<StatusDot tone={connectedServer ? 'success' : 'warning'}>{connectedServer ? 'Connected' : 'Missing'}</StatusDot>} />
            <ListRow leading={<Icon name="package" size="sm" />} subtitle="Reports local containers and Swarm state" title="Docker Engine" trailing={<StatusDot tone={connectedServer?.dockerAvailable ? 'success' : 'warning'}>{connectedServer?.dockerAvailable ? 'Healthy' : 'Unavailable'}</StatusDot>} />
            <ListRow leading={<Icon name="layers" size="sm" />} subtitle="Leads the explicitly selected cluster" title="Swarm manager" trailing={<StatusDot tone={connectedServer?.swarmControlAvailable ? 'success' : 'neutral'}>{connectedServer?.swarmControlAvailable ? 'Active' : 'Not active'}</StatusDot>} />
          </List>
        </Panel>
      </Columns>

      <Panel actions={<Button onClick={onOpenInfrastructure} size="sm" variant="ghost">Browse resources</Button>} title="What actually runs on this server">
        <MetricGrid columns={3} dense>
          <Metric hint={containerEvidence === 'available' ? 'Docker containers, including Compose workloads' : containerEvidence === 'loading' ? 'Reading Docker container inventory' : 'Open Docker resources for current evidence'} label="Compose and Engine containers" value={containerEvidence === 'available' ? String(containers.length) : '—'} />
          <Metric hint={cluster?.overview.summary.services ? 'Services scheduled by Docker Swarm' : 'Swarm can be active while running zero services'} label="Swarm services" value={String(cluster?.overview.summary.services ?? 0)} />
          <Metric hint={cluster?.stacks.length ? 'Namespaces grouping Swarm services' : 'No namespaced service groups'} label="Swarm stacks" value={String(cluster?.stacks.length ?? 0)} />
        </MetricGrid>
      </Panel>

      <Columns>
        <Panel actions={<Button onClick={onOpenApplications} size="sm" variant="ghost">Open workloads</Button>} title="Application, service, or stack?">
          <Facts items={[
            { label: 'Application', value: 'The product you deploy and operate as one lifecycle.' },
            { label: 'Service', value: 'A long-running Swarm process inside an application or stack.' },
            { label: 'Stack', value: 'An advanced group of services, networks, configs, and secrets.' },
            { label: 'Managed database', value: 'A stateful dependency whose placement, credentials, backup posture, and lifecycle SwarmOps owns.' },
          ]} />
        </Panel>
        <Panel actions={<Button onClick={onOpenTraffic} size="sm" variant="ghost">Open gateway</Button>} title="Recommended sequence">
          <List plain>
            <ListRow leading={<Icon name="document" size="sm" />} subtitle="Confirm the failure is feature-specific, not an agent outage." title="1. Read the run evidence" />
            <ListRow leading={<Icon name="external" size="sm" />} subtitle="Choose the existing production gateway or install the managed one." title="2. Resolve gateway ownership" />
            <ListRow leading={<Icon name="server" size="sm" />} subtitle="Approve stateful and edge placement before retrying shared workloads." title="3. Confirm placement" />
          </List>
        </Panel>
      </Columns>

      <Panel actions={<Button onClick={onOpenOperations} size="sm" variant="ghost">View all runs</Button>} flush title="Recent operations">
        {visibleCommands.length ? <Table columns={COMMAND_COLUMNS.slice(1, 5)} rowKey={(command) => command.id} rows={visibleCommands} /> : <EmptyState description="Queued, running, retrying, and completed operations remain visible here." icon="terminal" title="No operations" />}
      </Panel>

    </Page>
  )
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
