import {
  Button,
  Columns,
  DetailHeader,
  EmptyState,
  Icon,
  List,
  ListRow,
  Metric,
  MetricGrid,
  Page,
  Panel,
  ResourceMeter,
  StatusDot,
} from '@nim.zone/ui'
import type { StatusTone } from '@nim.zone/ui'
import type {
  Capacity,
  Health,
  Node,
  ObservabilityStatus,
  Overview,
  Service,
  Stack,
  TraefikStatus,
} from './types'

interface OverviewDashboardProps {
  observability: ObservabilityStatus
  overview: Overview
  stacks: Stack[]
  traefik: TraefikStatus
}

interface AttentionItem {
  href: string
  icon: 'activity' | 'alert' | 'chart' | 'document' | 'external' | 'layers' | 'server'
  subtitle: string
  title: string
  tone: StatusTone
}

interface PlatformSignal {
  icon: 'chart' | 'document' | 'external' | 'server'
  subtitle: string
  title: string
  tone: StatusTone
  value: string
}

interface CapacityConstraint {
  label: string
  percent: number
}

export function OverviewDashboard({ observability, overview, stacks, traefik }: OverviewDashboardProps) {
  const { nodes, services, summary } = overview
  const hostProbes = nodes.filter((node) => node.agent.healthy).length
  const hasCompleteHostCoverage = nodes.length > 0 && hostProbes === nodes.length
  const tasks = taskCoverage(services)
  const constraint = mostConstrainedCapacity(summary, hasCompleteHostCoverage)
  const attention = attentionItems(nodes, services, observability, traefik)
  const platform = platformSignals(observability, traefik)
  const visibleNodes = [...nodes].sort(compareNodes).slice(0, 6)
  const visibleServices = [...services].sort(compareServices).slice(0, 6)
  const visibleStacks = [...stacks].sort(compareStacks).slice(0, 6)

  const nodeTone: StatusTone = summary.nodes === 0
    ? 'neutral'
    : summary.readyNodes === summary.nodes ? 'success' : 'warning'
  const probeTone: StatusTone = nodes.length === 0
    ? 'neutral'
    : hasCompleteHostCoverage ? 'success' : hostProbes === 0 ? 'neutral' : 'warning'

  return (
    <Page>
      <DetailHeader
        meta={`Snapshot generated ${formatDateTime(overview.generatedAt)} · ${hostProbeSummary(hostProbes, nodes.length)}`}
        status={<StatusDot tone={healthTone(overview.health)}>{healthLabel(overview.health)}</StatusDot>}
        subtitle="A live summary from the selected remote Docker Swarm manager. It prioritises readiness, task coverage, capacity evidence, and conditions that merit follow-up."
        title="Cluster state"
      />

      <MetricGrid aria-label="Cluster status summary" columns={5}>
        <Metric
          hint={`${summary.services} service${plural(summary.services)} in this snapshot`}
          icon="activity"
          label="Cluster state"
          tone={healthTone(overview.health)}
          value={healthLabel(overview.health)}
        />
        <Metric
          hint={`${summary.managers} manager${plural(summary.managers)}`}
          icon="server"
          label="Nodes ready"
          tone={nodeTone}
          value={`${summary.readyNodes}/${summary.nodes}`}
        />
        <Metric
          hint={tasks.desired === 0 ? 'No desired tasks reported' : `${formatPercent(tasks.percent)} of desired tasks running`}
          icon="layers"
          label="Task coverage"
          tone={healthTone(summary.serviceHealth)}
          value={tasks.desired === 0 ? '—' : `${tasks.running}/${tasks.desired}`}
        />
        <Metric
          hint="Full host probes unlock memory and disk use."
          icon="chart"
          label="Host evidence"
          tone={probeTone}
          value={`${hostProbes}/${nodes.length}`}
        />
        <Metric
          hint={constraint ? `${constraint.label} is ${formatPercent(constraint.percent)} used` : 'Awaiting complete memory and disk coverage'}
          icon="database"
          label="Tightest headroom"
          tone={constraint ? capacityTone(constraint.percent) : 'neutral'}
          value={constraint ? `${formatPercent(100 - constraint.percent)}` : '—'}
        />
      </MetricGrid>

      <Columns template="aside">
        <Panel
          description={hasCompleteHostCoverage
            ? 'Memory and disk utilisation are aggregated from healthy read-only host probes. CPU remains a capacity measure; one-minute load belongs with each node.'
            : 'Cluster capacity is available from Docker. Memory and disk utilisation stays unqualified until every node has a healthy read-only host probe.'}
          eyebrow="Capacity evidence"
          title="Cluster allocation"
        >
          <AllocationMeter capacity={summary.totalCpu} capacityOnly detail="CPU is shown as declared core capacity; the dashboard does not infer CPU use from load average." label="CPU capacity" unit="cores" />
          <AllocationMeter capacity={summary.totalMemory} measured={hasCompleteHostCoverage} label="Memory" />
          <AllocationMeter capacity={summary.totalDisk} measured={hasCompleteHostCoverage} label="Root disk" />
        </Panel>

        <Panel
          actions={<Button href="#nodes" size="sm" variant="secondary">Inspect nodes</Button>}
          description="Only present operational conditions are listed here. Optional capabilities that are simply not installed are kept as neutral platform signals."
          eyebrow={attention.length ? `${attention.length} condition${plural(attention.length)}` : 'Current snapshot'}
          title="Operator attention"
        >
          {attention.length ? (
            <List plain>
              {attention.map((item) => (
                <ListRow
                  href={item.href}
                  key={`${item.href}-${item.title}`}
                  leading={<Icon name={item.icon} size="sm" />}
                  subtitle={item.subtitle}
                  title={item.title}
                  trailing={<StatusDot tone={item.tone}>{toneLabel(item.tone)}</StatusDot>}
                />
              ))}
            </List>
          ) : (
            <EmptyState
              description="The selected manager reported no unavailable nodes, task deficits, or installed platform services in a degraded state."
              icon="check-circle"
              title="No immediate follow-up"
            />
          )}
        </Panel>
      </Columns>

      <Columns>
        <Panel
          actions={<Button href="#services" size="sm" variant="secondary">View services</Button>}
          description="Services with a task deficit or a non-completed update rise to the top; the full inventory remains on the Services page."
          eyebrow={`${services.length} service${plural(services.length)}`}
          title="Workload delivery"
        >
          {visibleServices.length ? (
            <List plain>
              {visibleServices.map((service) => (
                <ListRow
                  href="#services"
                  key={service.id}
                  leading={<Icon name="layers" size="sm" />}
                  subtitle={serviceSubtitle(service)}
                  title={service.name}
                  trailing={<StatusDot tone={healthTone(service.health)}>{healthLabel(service.health)}</StatusDot>}
                />
              ))}
            </List>
          ) : (
            <EmptyState description="Docker Engine returned no Swarm services for the selected manager." icon="layers" title="No services" />
          )}
        </Panel>

        <Panel
          actions={<Button href="#observability" size="sm" variant="secondary">Open observability</Button>}
          description="These signals describe the reviewed platform services. Their status does not imply a live Prometheus query or an external alert delivery check."
          eyebrow="Platform readiness"
          title="Platform signals"
        >
          <List plain>
            {platform.map((signal) => (
              <ListRow
                href={signal.title === 'Edge proxy' ? '#gateway' : '#observability'}
                key={signal.title}
                leading={<Icon name={signal.icon} size="sm" />}
                subtitle={signal.subtitle}
                title={signal.title}
                trailing={<StatusDot tone={signal.tone}>{signal.value}</StatusDot>}
              />
            ))}
          </List>
        </Panel>
      </Columns>

      <Columns>
        <Panel
          actions={<Button href="#stacks" size="sm" variant="secondary">View stacks</Button>}
          description="Stack status is derived from the services currently labelled with each Docker stack namespace."
          eyebrow={`${stacks.length} stack${plural(stacks.length)}`}
          title="Stack coverage"
        >
          {visibleStacks.length ? (
            <List plain>
              {visibleStacks.map((stack) => (
                <ListRow
                  href="#stacks"
                  key={stack.name}
                  leading={<Icon name="layers" size="sm" />}
                  subtitle={`${stack.serviceCount} service${plural(stack.serviceCount)} · ${stack.runningTasks} running task${plural(stack.runningTasks)}`}
                  title={stack.name}
                  trailing={<StatusDot tone={healthTone(stack.health)}>{healthLabel(stack.health)}</StatusDot>}
                />
              ))}
            </List>
          ) : (
            <EmptyState description="No Docker stack namespace labels were found in the current service inventory." icon="layers" title="No stacks" />
          )}
        </Panel>

        <Panel
          actions={<Button href="#nodes" size="sm" variant="secondary">View node inventory</Button>}
          description="Nodes needing attention are listed first. Host-probe wording distinguishes an unavailable installed agent from an optional agent that is not configured."
          eyebrow={`${nodes.length} node${plural(nodes.length)}`}
          title="Node posture"
        >
          {visibleNodes.length ? (
            <List plain>
              {visibleNodes.map((node) => {
                const health = nodeHealth(node)
                return (
                  <ListRow
                    href="#nodes"
                    key={node.id}
                    leading={<Icon name="server" size="sm" />}
                    subtitle={nodeSubtitle(node)}
                    title={node.hostname}
                    trailing={<StatusDot tone={healthTone(health)}>{healthLabel(health)}</StatusDot>}
                  />
                )
              })}
            </List>
          ) : (
            <EmptyState description="Docker Engine returned no Swarm nodes for the selected manager." icon="server" title="No nodes" />
          )}
        </Panel>
      </Columns>
    </Page>
  )
}

function AllocationMeter({
  capacity,
  capacityOnly = false,
  detail,
  label,
  measured = false,
  unit,
}: {
  capacity: Capacity
  capacityOnly?: boolean
  detail?: string
  label: string
  measured?: boolean
  unit?: string
}) {
  const percent = measured ? usagePercent(capacity) : undefined
  const value = capacityOnly
    ? `${formatNumber(capacity.capacity)} ${unit ?? ''}`.trim()
    : percent === undefined
      ? `${formatBytes(capacity.capacity)} capacity`
      : `${formatBytes(capacity.used)} / ${formatBytes(capacity.capacity)}`
  const meterDetail = detail ?? (percent === undefined
    ? 'Live utilisation needs healthy host-probe coverage across every node.'
    : `${formatPercent(percent)} used · ${formatBytes(capacity.available)} free`)

  return <ResourceMeter detail={meterDetail} label={label} percent={percent} tone={percent === undefined ? 'accent' : capacityTone(percent)} value={value} />
}

function attentionItems(nodes: Node[], services: Service[], observability: ObservabilityStatus, traefik: TraefikStatus): AttentionItem[] {
  const items: AttentionItem[] = []

  for (const node of nodes) {
    if (node.state !== 'ready') {
      items.push({ href: '#nodes', icon: 'server', subtitle: `Docker reports this node as ${node.state}.`, title: node.hostname, tone: 'danger' })
    } else if (node.availability !== 'active') {
      items.push({ href: '#nodes', icon: 'server', subtitle: `Scheduling availability is ${node.availability}.`, title: node.hostname, tone: 'warning' })
    } else if ((node.agent.address || node.agent.error) && !node.agent.healthy) {
      items.push({ href: '#nodes', icon: 'alert', subtitle: node.agent.error || 'The installed read-only host probe did not provide a current snapshot.', title: node.hostname, tone: 'warning' })
    }
  }

  for (const service of services) {
    if (service.health !== 'healthy') {
      items.push({ href: '#services', icon: 'layers', subtitle: serviceSubtitle(service), title: service.name, tone: healthTone(service.health) })
    }
  }

  if (observability.coreInstalled && !observability.coreHealthy) {
    items.push({ href: '#observability', icon: 'chart', subtitle: 'The reviewed observability stack is installed but its service coverage is degraded.', title: 'Core monitoring', tone: 'danger' })
  }
  if (observability.agentInstalled && !observability.agentHealthy) {
    items.push({ href: '#observability', icon: 'server', subtitle: 'The read-only node inventory stack is installed but degraded.', title: 'Node inventory', tone: 'warning' })
  }
  if (observability.logsEnabled && !observability.logsHealthy) {
    items.push({ href: '#observability', icon: 'document', subtitle: 'Docker log collection is enabled but its reviewed stack is degraded.', title: 'Log collection', tone: 'warning' })
  }
  if (traefik.service && traefik.service.health !== 'healthy') {
    items.push({ href: '#gateway', icon: 'external', subtitle: serviceSubtitle(traefik.service), title: 'Edge proxy', tone: healthTone(traefik.service.health) })
  }

  return items.sort((left, right) => attentionPriority(left.tone) - attentionPriority(right.tone) || left.title.localeCompare(right.title)).slice(0, 6)
}

function platformSignals(observability: ObservabilityStatus, traefik: TraefikStatus): PlatformSignal[] {
  return [
    observability.coreInstalled
      ? { icon: 'chart', subtitle: observability.coreHealthy ? 'The reviewed Prometheus, Alertmanager, and Jaeger stack is healthy.' : 'The reviewed observability stack is installed but degraded.', title: 'Core monitoring', tone: observability.coreHealthy ? 'success' : 'danger', value: observability.coreHealthy ? 'Healthy' : 'Degraded' }
      : { icon: 'chart', subtitle: 'The reviewed observability stack is not installed on this cluster.', title: 'Core monitoring', tone: 'neutral', value: 'Not installed' },
    observability.agentInstalled
      ? { icon: 'server', subtitle: observability.agentHealthy ? 'Read-only host inventory is installed and healthy.' : 'The read-only host inventory stack is installed but degraded.', title: 'Node inventory', tone: observability.agentHealthy ? 'success' : 'danger', value: observability.agentHealthy ? 'Healthy' : 'Degraded' }
      : { icon: 'server', subtitle: 'Host inventory remains optional until the reviewed agent stack is installed.', title: 'Node inventory', tone: 'neutral', value: 'Optional' },
    observability.logsEnabled
      ? { icon: 'document', subtitle: observability.logsHealthy ? 'Docker JSON-log collection is enabled and healthy.' : 'Docker JSON-log collection is enabled but degraded.', title: 'Log collection', tone: observability.logsHealthy ? 'success' : 'danger', value: observability.logsHealthy ? 'Healthy' : 'Degraded' }
      : { icon: 'document', subtitle: 'Log collection is not enabled for this cluster.', title: 'Log collection', tone: 'neutral', value: 'Disabled' },
    traefik.service
      ? { icon: 'external', subtitle: `${traefik.service.name} is present in the selected Docker inventory.`, title: 'Edge proxy', tone: healthTone(traefik.service.health), value: healthLabel(traefik.service.health) }
      : { icon: 'external', subtitle: 'The expected Traefik service was not found in the selected Docker inventory.', title: 'Edge proxy', tone: 'neutral', value: 'Not discovered' },
  ]
}

function taskCoverage(services: Service[]) {
  const desired = services.reduce((total, service) => total + service.desiredTasks, 0)
  const running = services.reduce((total, service) => total + service.runningTasks, 0)
  return { desired, percent: desired ? Math.min(100, running * 100 / desired) : 0, running }
}

function mostConstrainedCapacity(summary: Overview['summary'], measured: boolean): CapacityConstraint | null {
  if (!measured) return null
  const resources = [
    { capacity: summary.totalMemory, label: 'Memory' },
    { capacity: summary.totalDisk, label: 'Root disk' },
  ]
    .map(({ capacity, label }) => ({ label, percent: usagePercent(capacity) }))
    .filter((resource): resource is CapacityConstraint => resource.percent !== undefined)
  return resources.sort((left, right) => right.percent - left.percent)[0] ?? null
}

function usagePercent(capacity: Capacity): number | undefined {
  if (!capacity.capacity || (capacity.used === 0 && capacity.available === 0 && capacity.percent === 0)) return undefined
  const value = capacity.percent || capacity.used * 100 / capacity.capacity
  return Math.max(0, Math.min(100, value))
}

function serviceSubtitle(service: Service) {
  const tasks = `${service.runningTasks}/${service.desiredTasks} running task${plural(service.desiredTasks)}`
  const update = service.updateState && service.updateState !== 'completed' ? ` · update ${service.updateState}` : ''
  return `${service.mode} · ${tasks}${update}`
}

function nodeSubtitle(node: Node) {
  const manager = node.manager?.leader ? ' · leader' : ''
  const agent = node.agent.healthy
    ? 'host probe current'
    : node.agent.address || node.agent.error ? (node.agent.error || 'host probe unavailable') : 'host probe not configured'
  return `${node.role}${manager} · ${node.availability} · ${agent}`
}

function nodeHealth(node: Node): Health {
  if (node.state !== 'ready') return 'unhealthy'
  if (node.availability !== 'active' || (node.agent.address || node.agent.error) && !node.agent.healthy) return 'degraded'
  return 'healthy'
}

function compareNodes(left: Node, right: Node) {
  return healthPriority(nodeHealth(left)) - healthPriority(nodeHealth(right)) || left.hostname.localeCompare(right.hostname)
}

function compareServices(left: Service, right: Service) {
  return healthPriority(left.health) - healthPriority(right.health) || left.name.localeCompare(right.name)
}

function compareStacks(left: Stack, right: Stack) {
  return healthPriority(left.health) - healthPriority(right.health) || left.name.localeCompare(right.name)
}

function healthPriority(health: Health): number {
  if (health === 'unhealthy') return 0
  if (health === 'degraded') return 1
  if (health === 'unknown') return 2
  return 3
}

function attentionPriority(tone: StatusTone): number {
  if (tone === 'danger') return 0
  if (tone === 'warning') return 1
  if (tone === 'info') return 2
  if (tone === 'accent') return 3
  if (tone === 'neutral') return 4
  return 5
}

function capacityTone(percent: number): 'danger' | 'success' | 'warning' {
  if (percent >= 90) return 'danger'
  if (percent >= 75) return 'warning'
  return 'success'
}

function healthTone(health: Health): StatusTone {
  if (health === 'healthy') return 'success'
  if (health === 'degraded') return 'warning'
  if (health === 'unhealthy') return 'danger'
  return 'neutral'
}

function healthLabel(health: Health): string {
  return health[0].toUpperCase() + health.slice(1)
}

function toneLabel(tone: StatusTone): string {
  if (tone === 'danger') return 'Critical'
  if (tone === 'warning') return 'Review'
  if (tone === 'success') return 'Healthy'
  if (tone === 'info') return 'Info'
  return 'Review'
}

function hostProbeSummary(healthy: number, total: number): string {
  return `${healthy}/${total} healthy host probe${plural(total)}`
}

function plural(value: number): string {
  return value === 1 ? '' : 's'
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(Math.round(value))
}

function formatBytes(value: number): string {
  if (!value) return '0 B'
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB']
  const power = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1)
  return `${(value / 1024 ** power).toFixed(power > 1 ? 1 : 0)} ${units[power]}`
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function formatPercent(value: number): string {
  return `${Math.round(Math.max(0, value))}%`
}
