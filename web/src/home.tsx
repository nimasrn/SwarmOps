import {
  Badge,
  Banner,
  Body,
  Button,
  Chart,
  Columns,
  DetailHeader,
  DetailLayout,
  EmptyState,
  Facts,
  Inline,
  Metric,
  MetricGrid,
  Mono,
  Page,
  Panel,
  Stack as Rows,
  StatusDot,
  Table,
} from '@nim.zone/ui'
import type { StatusTone, TableColumn } from '@nim.zone/ui'
import type {
  Command,
  CoreTopology,
  InsightsSample,
  Node,
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
  activity: InsightsSample[]
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

const NODE_COLUMNS: TableColumn<Node>[] = [
  {
    header: 'Node',
    key: 'node',
    render: (node) => (
      <Inline gap="tight">
        <StatusDot tone={nodeTone(node)}>{node.hostname}</StatusDot>
        {node.address ? <Mono size="sm">{node.address}</Mono> : null}
      </Inline>
    ),
  },
  { header: 'Role', key: 'role', render: (node) => node.manager?.leader ? 'Manager · leader' : capitalize(node.role) },
  { header: 'Host probe', key: 'agent', render: (node) => node.agent.healthy ? `Online${node.agent.version ? ` · ${node.agent.version}` : ''}` : node.agent.error ? 'Unavailable' : 'Not configured' },
  { header: 'CPU', key: 'cpu', numeric: true, render: (node) => capacityLabel(node.cpu, 'cores') },
  { header: 'Memory', key: 'memory', numeric: true, render: (node) => capacityLabel(node.memory) },
  { header: 'Disk', key: 'disk', numeric: true, render: (node) => capacityLabel(node.disk) },
]

const COMMAND_COLUMNS: TableColumn<Command>[] = [
  { header: 'Operation', key: 'operation', render: (command) => <Mono size="inherit">{shortID(command.id)}</Mono> },
  { header: 'Action', key: 'action', render: (command) => command.action },
  { header: 'Target', key: 'target', render: (command) => <Mono>{command.target || command.nodeId}</Mono> },
  { header: 'State', key: 'state', render: (command) => <StatusDot pulse={command.state === 'running' || command.state === 'preparing'} tone={commandTone(command.state)}>{stateLabel(command.state)}</StatusDot> },
  { header: 'Actor', key: 'actor', render: (command) => command.actor },
  { header: 'Duration', key: 'duration', numeric: true, render: (command) => elapsed(command.createdAt, command.updatedAt) },
]

export function HomePage({
  activity,
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
  const connectedAgents = servers.filter((server) => server.connectionState === 'connected').length
  const openCommands = commands.filter((command) => !terminalCommand(command.state))
  const attention = attentionItems(core, cluster, servers, commands)
  const nodes = cluster?.overview.nodes ?? []
  const summary = cluster?.overview.summary
  const history = Array.isArray(activity) ? activity.slice(-12) : []
  const attentionItem = attention[0]

  return (
    <Page width="full">
      <DetailHeader
        actions={<Inline><Button iconStart="play" onClick={onDeploy} variant="accent">Deploy application</Button><Button iconStart="plus" onClick={onAddNode} variant="secondary">Add node</Button></Inline>}
        subtitle="One active Core coordinates this Docker Swarm cluster through durable outbound agent sessions."
        title="Production overview"
      />

      <MetricGrid columns={4}>
        <Metric hint={core.controlEnabled ? `Authority epoch ${core.authorityEpoch}` : 'Mutations are fenced'} icon="shield" label="Core authority" tone={core.controlEnabled ? 'success' : 'warning'} value={core.controlEnabled ? 'Active' : 'Standby'} />
        <Metric hint={summary ? `${summary.readyNodes} of ${summary.nodes} nodes ready` : 'Choose a connected manager'} icon="server" label="Cluster health" tone={cluster ? healthTone(cluster.overview.health) : 'neutral'} value={cluster ? healthLabel(cluster.overview.health) : 'Not connected'} />
        <Metric hint={cluster ? `${summary?.runningTasks ?? 0} running tasks` : 'Awaiting cluster state'} icon="layers" label="Applications" onClick={onOpenApplications} tone={cluster?.stacks.length ? 'success' : 'neutral'} value={cluster ? String(cluster.stacks.length) : '—'} />
        <Metric hint={openCommands.length ? 'Work remains visible in Operations' : 'No pending mutations'} icon="terminal" label="Pending operations" tone={openCommands.length ? 'warning' : 'success'} value={String(openCommands.length)} />
      </MetricGrid>

      <DetailLayout
        aside={
          <Rows gap="md">
            {attentionItem ? (
              <Banner action={<Button onClick={onDiagnose} size="sm" variant="ghost">Review</Button>} title={attentionItem.label} tone={attentionItem.tone === 'danger' ? 'danger' : 'warning'}>
                {attentionItem.detail}
              </Banner>
            ) : <Banner title="No action needs attention" tone="success">Core, agents, and the selected cluster report no current failure evidence.</Banner>}
            <Panel caption="Singletons" title="Shared platform">
              <Facts columns={1} items={[
                { label: 'Traefik', value: cluster ? serviceState(cluster.traefik.service?.health) : 'Not observed' },
                { label: 'Prometheus + Jaeger', value: cluster ? installedState(cluster.observability.coreInstalled, cluster.observability.coreHealthy) : 'Not observed' },
                { label: 'Loki', value: cluster ? installedState(cluster.observability.logsEnabled, cluster.observability.logsHealthy) : 'Not observed' },
                { label: 'PostgreSQL / MongoDB / Redis', value: cluster ? 'Managed per cluster' : 'Not observed' },
              ]} />
            </Panel>
            <Panel actions={<Button onClick={onOpenTraffic} size="sm" variant="ghost">Open</Button>} title="Traffic health">
              <Facts columns={1} items={[
                { label: 'HTTP, TCP, UDP', value: cluster?.traefik.service ? 'Typed routes active' : 'Not observed' },
                { label: 'Certificates', value: cluster?.traefik.service ? 'Open diagnostics' : 'Not observed' },
                { label: 'Control transport', value: 'Outbound agent HTTPS' },
              ]} />
            </Panel>
            <Body size="sm" tone="muted">
              Core and cluster remain separate identities. Every failure leads to evidence and a bounded action.
            </Body>
          </Rows>
        }
      >
        <Rows gap="loose">
          <Columns template="aside">
            <Panel actions={<Badge pill size="sm" tone="outline">Recent samples</Badge>} title="Cluster activity">
              {history.length > 1 ? (
                <Chart
                  categories={history.map((sample) => formatTime(sample.at))}
                  format={(value) => Number.isInteger(value) ? String(value) : value.toFixed(1)}
                  height={220}
                  legend
                  max={Math.max(1, ...history.map((sample) => Math.max(sample.tasksDesired, sample.containersTotal)))}
                  min={0}
                  note="Source: SwarmOps insight history · selected manager"
                  series={[
                    { label: 'Running tasks', series: 1, values: history.map((sample) => sample.tasksRunning) },
                    { label: 'Running containers', series: 2, values: history.map((sample) => sample.containersRunning) },
                  ]}
                />
              ) : <EmptyState description="Activity history begins after the selected manager produces more than one snapshot." icon="chart" title="Collecting cluster activity" />}
            </Panel>

            <Panel actions={<Badge dot pill size="sm" variant={core.controlEnabled ? 'success' : 'warning'}>{core.controlEnabled ? 'Active' : 'Standby'}</Badge>} title="Core authority">
              <Facts columns={1} items={[
                { label: 'Identity', mono: true, value: activeCore?.name ?? core.localId },
                { label: 'Location', mono: true, value: activeCore?.endpoint || 'Outside cluster' },
                { label: 'Storage', value: 'Encrypted controller state' },
                { label: 'Authority epoch', mono: true, value: String(core.authorityEpoch) },
                { label: 'Standby', value: `${core.members.filter((member) => member.role === 'standby').length} registered` },
                { label: 'Connected agents', value: String(connectedAgents) },
              ]} />
            </Panel>
          </Columns>

          <Panel actions={<Button onClick={onOpenInfrastructure} size="sm" variant="ghost">View topology</Button>} caption={`${nodes.length} node${nodes.length === 1 ? '' : 's'}`} flush title="Infrastructure">
            {nodes.length ? <Table columns={NODE_COLUMNS} rowKey={(node) => node.id} rows={nodes.slice(0, 6)} /> : (
              <EmptyState actions={<Button onClick={onAddNode} size="sm" variant="secondary">Add node</Button>} description="Node capacity, agent health, Docker state, and container inventory appear after enrollment." icon="server" title="Infrastructure is ready for its first node" />
            )}
          </Panel>

          <Panel actions={<Button onClick={onOpenOperations} size="sm" variant="ghost">Open ledger</Button>} caption={`${commands.length} recorded`} flush title="Recent operations">
            {commands.length ? <Table columns={COMMAND_COLUMNS} rowKey={(command) => command.id} rows={commands.slice(0, 6)} /> : (
              <EmptyState description="Queued, running, retrying, and completed operations remain visible here." icon="terminal" title="No operations recorded" />
            )}
          </Panel>
        </Rows>
      </DetailLayout>
    </Page>
  )
}

function attentionItems(core: CoreTopology, cluster: HomeClusterData | undefined, servers: Server[], commands: Command[]): AttentionItem[] {
  const items: AttentionItem[] = []
  if (!core.controlEnabled) items.push({ detail: 'Mutations are fenced until this Core owns the active authority epoch.', id: 'core-fenced', label: 'Core is read-only', tone: 'warning' })
  if (!cluster) items.push({ detail: 'Select a connected Swarm manager to resume cluster reads and operations.', id: 'manager-missing', label: 'Cluster manager is not connected', tone: 'warning' })
  for (const server of servers.filter((candidate) => candidate.connectionState !== 'connected' || candidate.agentHealth?.state === 'unhealthy').slice(0, 2)) {
    items.push({ detail: server.agentHealth?.summary ?? 'The agent cannot currently be reached by Core.', id: `server-${server.id}`, label: `${server.name} needs connectivity review`, tone: 'danger' })
  }
  for (const command of commands.filter((candidate) => candidate.state === 'needs_attention' || candidate.state === 'failed').slice(0, 2)) {
    items.push({ detail: `${command.action} on ${command.target || command.nodeId} stopped in ${stateLabel(command.state).toLowerCase()}.`, id: `command-${command.id}`, label: 'Operation needs attention', tone: 'danger' })
  }
  return items.slice(0, 4)
}

function nodeTone(node: Node): StatusTone {
  if (node.state !== 'ready') return 'danger'
  return node.availability === 'active' ? 'success' : 'warning'
}

function healthTone(health: string): StatusTone {
  if (health === 'healthy') return 'success'
  if (health === 'degraded') return 'warning'
  if (health === 'unhealthy') return 'danger'
  return 'neutral'
}

function healthLabel(health: string) {
  return health === 'healthy' ? 'Healthy' : health === 'degraded' ? 'Degraded' : health === 'unhealthy' ? 'Unhealthy' : 'Unknown'
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

function terminalCommand(state: Command['state']) {
  return state === 'succeeded' || state === 'failed' || state === 'needs_attention' || state === 'superseded' || state === 'cancelled'
}

function serviceState(health?: string) {
  return health ? healthLabel(health) : 'Not installed'
}

function installedState(installed: boolean, healthy: boolean) {
  return !installed ? 'Not installed' : healthy ? 'Healthy' : 'Needs attention'
}

function capacityLabel(capacity: { used: number; capacity: number }, unit?: string) {
  if (unit) return `${formatNumber(capacity.used)} / ${formatNumber(capacity.capacity)} ${unit}`
  return `${formatBytes(capacity.used)} / ${formatBytes(capacity.capacity)}`
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0 B'
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB']
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1)
  return `${formatNumber(value / (1024 ** index))} ${units[index]}`
}

function formatNumber(value: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value)
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
