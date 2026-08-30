import { useState } from 'react'
import {
  Banner,
  Body,
  Button,
  Columns,
  DataTable,
  DetailHeader,
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
  Tabs,
} from '@nim.zone/ui'
import type { TableColumn } from '@nim.zone/ui'
import type { Command, ContainerSummary, Node, Task } from '../../data/types'
import { capitalize, formatBytes, formatDateTime, formatDuration, formatNumber, sentence, shortID } from '../../lib/format'
import { hostProbeHealth, nodeHealth } from '../../lib/health'
import { StatusBadge } from '../../components/badges'

/**
 * One machine: what it is made of, what it is running, and the only three
 * changes this console will make to it.
 *
 * Availability is the whole mutation surface — active, pause, drain — because
 * everything else worth doing to a host is a reviewed readiness fix rather than
 * a button here. `Drain` carries the danger variant: it moves running work.
 */
export function NodeDetailView({
  busy,
  commands,
  containerColumns,
  containerError,
  containers,
  node,
  onAvailability,
  onBack,
  onDiagnostics,
  onReadiness,
  taskError,
  tasks,
}: {
  busy: boolean
  commands: Command[]
  containerColumns: TableColumn<ContainerSummary>[]
  containerError: string
  containers: ContainerSummary[]
  node: Node
  onAvailability: (availability: string) => void
  onBack: () => void
  onDiagnostics: () => void
  onReadiness: () => void
  taskError: string
  tasks: Task[]
}) {
  const [tab, setTab] = useState('overview')

  return (
    <Page width="full">
      <DetailHeader
        actions={
          <Inline>
            <Button iconStart="activity" onClick={onDiagnostics} variant="secondary">Run diagnosis</Button>
            <Button onClick={onReadiness} variant="secondary">Prepare node</Button>
          </Inline>
        }
        back={{ label: 'Swarm & placement', onClick: onBack }}
        meta={
          <Inline>
            <Mono>{node.address ?? '—'}</Mono>
            <StatusDot tone={nodeHealth(node) === 'healthy' ? 'success' : 'warning'}>{capitalize(node.state)}</StatusDot>
            <span>{node.role}{node.manager?.leader ? ' · leader' : ''}</span>
            <span>Agent {node.agent.version ?? 'not reported'}</span>
            <span>Docker {node.engine.version ?? node.dockerVersion ?? 'not reported'}</span>
          </Inline>
        }
        title={node.hostname}
      />

      <Tabs
        label="Node views"
        onChange={setTab}
        options={[
          { label: 'Overview', value: 'overview' },
          { label: `Containers (${containers.length})`, value: 'containers' },
          { label: `Tasks (${tasks.length})`, value: 'tasks' },
          { label: 'Network', value: 'network' },
          { label: 'Packages', value: 'packages' },
          { label: 'Activity', value: 'activity' },
        ]}
        value={tab}
      />

      {tab === 'overview' ? (
        <>
          <MetricGrid columns={4}>
            <Metric hint={node.load1 !== undefined ? `1m load ${node.load1.toFixed(2)}` : 'No load sample'} icon="activity" label="CPU capacity" value={`${formatNumber(node.cpu.capacity)} cores`} />
            <Metric hint={`${formatNumber(node.memory.percent)}% used`} icon="activity" label="Memory used" tone={node.memory.percent >= 85 ? 'warning' : 'neutral'} value={formatBytes(node.memory.used)} />
            <Metric hint={`${formatNumber(node.disk.percent)}% used`} icon="activity" label="Disk used" tone={node.disk.percent >= 85 ? 'warning' : 'neutral'} value={formatBytes(node.disk.used)} />
            <Metric hint={`${tasks.filter((task) => task.currentState === 'running').length} running`} icon="layers" label="Tasks" value={String(tasks.length)} />
          </MetricGrid>
          <Columns template="aside">
            <Rows gap="md">
              <Panel flush title={`Containers (${containers.length})`}>
                {containerError
                  ? <Banner tone="warning">{containerError}</Banner>
                  : containers.length
                    ? <DataTable columns={containerColumns} rowKey={(container) => container.Id} rows={containers.slice(0, 10)} summary={`Showing 1–${Math.min(10, containers.length)} of ${containers.length}`} />
                    : <EmptyState description="No local Engine containers were returned for this manager." icon="package" title="No containers" />}
              </Panel>
              <Panel flush title="Recent node operations">
                {commands.length
                  ? <DataTable caption={`Operations targeting ${node.hostname}`} columns={NODE_COMMAND_COLUMNS} rowKey={(command) => command.id} rows={commands} />
                  : <Body size="sm" tone="muted">No durable operation currently targets this node.</Body>}
              </Panel>
            </Rows>
            <Rows gap="md">
              <Panel title="System">
                <Facts columns={1} items={[
                  { label: 'OS', source: 'host probe', unmeasured: !(node.os ?? node.platform.os), value: node.os ?? node.platform.os ?? 'not reported', why: 'the agent did not report an OS' },
                  { label: 'Kernel', mono: true, source: 'host probe', unmeasured: !node.kernel, value: node.kernel ?? 'not reported', why: 'the agent did not report a kernel version' },
                  { label: 'CPU', value: `${formatNumber(node.cpu.capacity)} cores` },
                  { label: 'Memory', value: formatBytes(node.memory.capacity) },
                  { label: 'Storage', value: formatBytes(node.disk.capacity) },
                  { label: 'Architecture', source: 'host probe', unmeasured: !node.platform.architecture, value: node.platform.architecture ?? 'not reported', why: 'the agent did not report an architecture' },
                  { label: 'Storage driver', source: 'docker info', unmeasured: !node.engine.driver, value: node.engine.driver ?? 'not reported', why: 'the Engine did not report a storage driver' },
                  { label: 'cgroup driver', source: 'docker info', unmeasured: !node.engine.cgroupDriver, value: node.engine.cgroupDriver ?? 'not reported', why: 'the Engine did not report a cgroup driver' },
                  { label: 'Uptime', value: formatDuration(node.uptimeSeconds) },
                ]} />
              </Panel>
              <Panel description="Draining moves running tasks off this node; pausing only stops new ones from arriving." title="Agent health and placement">
                <StatusBadge health={hostProbeHealth(node)} label={node.agent.healthy ? 'Connected' : node.agent.error ?? 'Not configured'} />
                <Facts columns={1} items={[
                  { label: 'Address', mono: true, value: node.agent.address ?? node.address ?? 'None advertised' },
                  { label: 'Version', mono: true, source: 'agent', unmeasured: !node.agent.version, value: node.agent.version ?? 'not reported', why: 'the agent has not reported a version' },
                  { label: 'Last inventory', value: node.agent.collectedAt ? formatDateTime(node.agent.collectedAt) : 'no probe' },
                  { label: 'Swarm membership', value: `${capitalize(node.role)} · ${capitalize(node.availability)}` },
                ]} />
                <Inline>
                  {['active', 'pause', 'drain'].map((availability) => (
                    <Button
                      disabled={busy || node.availability === availability}
                      key={availability}
                      loading={busy && node.availability !== availability}
                      onClick={() => onAvailability(availability)}
                      size="sm"
                      variant={availability === 'drain' ? 'danger' : 'secondary'}
                    >
                      {capitalize(availability)}
                    </Button>
                  ))}
                </Inline>
              </Panel>
            </Rows>
          </Columns>
        </>
      ) : tab === 'containers' ? (
        <Panel flush title={`Containers on ${node.hostname}`}>
          {containerError
            ? <Banner tone="warning">{containerError}</Banner>
            : <DataTable caption="Local Engine containers" columns={containerColumns} empty={<EmptyState description="No local Engine containers were returned." icon="package" title="No containers" />} rowKey={(container) => container.Id} rows={containers} />}
        </Panel>
      ) : tab === 'tasks' ? (
        <Panel flush title={`Tasks on ${node.hostname}`}>
          {taskError ? <Banner tone="warning">{taskError}</Banner> : <TaskList tasks={tasks} />}
        </Panel>
      ) : tab === 'network' ? (
        <Panel title="Network">
          <Facts items={[
            { label: 'Advertised address', mono: true, value: node.address || 'None advertised' },
            { label: 'Manager address', mono: true, value: node.manager?.address || 'None advertised' },
            { label: 'Reachability', value: node.manager?.reachability ?? 'Not a manager' },
            { label: 'Control path', value: 'Outbound pinned HTTPS' },
          ]} />
        </Panel>
      ) : tab === 'packages' ? (
        <Panel actions={<Button onClick={onReadiness} variant="secondary">Open host setup</Button>} title="Packages">
          <Body size="sm">Package and Docker maintenance are fixed, audited server-readiness operations. SwarmOps does not expose arbitrary package names or a remote shell.</Body>
        </Panel>
      ) : (
        <Panel flush title="Node activity">
          {commands.length
            ? <DataTable caption="Durable node operation history" columns={NODE_COMMAND_COLUMNS} rowKey={(command) => command.id} rows={commands} />
            : <Body size="sm" tone="muted">No durable operation has targeted this node.</Body>}
        </Panel>
      )}
    </Page>
  )
}

const NODE_COMMAND_COLUMNS: TableColumn<Command>[] = [
  { header: 'Time', key: 'time', render: (command) => formatDateTime(command.updatedAt) },
  { header: 'Action', key: 'action', render: (command) => command.action },
  { header: 'Target', key: 'target', render: (command) => <Mono>{command.target}</Mono> },
  { header: 'State', key: 'state', render: (command) => <StatusDot tone={command.state === 'succeeded' ? 'success' : command.state === 'needs_attention' || command.state === 'failed' ? 'danger' : 'warning'}>{sentence(command.state)}</StatusDot> },
  { header: 'Actor', key: 'actor', render: (command) => command.actor },
]

export function TaskList({ tasks }: { tasks: Task[] }) {
  const columns: TableColumn<Task>[] = [
    { header: 'Task', key: 'id', render: (task) => <Mono>{shortID(task.id)}</Mono> },
    { header: 'Desired', key: 'desired', render: (task) => task.desiredState },
    { header: 'Current', key: 'current', render: (task) => task.currentState },
    { header: 'Started', key: 'started', render: (task) => formatDateTime(task.startedAt) },
    { header: 'Error', key: 'error', render: (task) => task.error || 'None' },
  ]
  return (
    <DataTable
      caption="Tasks on the selected node"
      columns={columns}
      empty={<EmptyState description="Docker reported no tasks scheduled on this node." icon="layers" title="No tasks" />}
      rowKey={(task) => task.id}
      rows={tasks}
    />
  )
}
