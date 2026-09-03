import { useState } from 'react'
import {
  Badge,
  Banner,
  Body,
  Button,
  Columns,
  DataTable,
  DetailHeader,
  EmptyState,
  Facts,
  Inline,
  Input,
  Label,
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
import { ConfirmPhrase } from '../../components/confirm-phrase'

/**
 * One machine: what it is made of, what it is running, and the changes this
 * console will make to its membership.
 *
 * Availability was for a long time the whole mutation surface here, on the
 * argument that everything else worth doing to a host is a reviewed readiness
 * fix. That was true of the HOST and wrong about the NODE: promotion, labels
 * and removal are Swarm membership, the controller has always queued all three
 * as audited commands, and the navigation entry has always promised "roles,
 * labels, and placement". Only availability was wired, so the other three were
 * reachable solely through the generic Action catalogue — a form with a node ID
 * field, opened from a different area, for a decision made while looking at
 * this page.
 *
 * `Drain` and `Remove` carry the danger variant: one moves running work, the
 * other ends membership.
 */
export function NodeDetailView({
  busy,
  commands,
  containerColumns,
  containerError,
  containers,
  managers,
  node,
  onAvailability,
  onBack,
  onDiagnostics,
  onLabel,
  onReadiness,
  onRemove,
  onRole,
  taskError,
  tasks,
}: {
  busy: boolean
  commands: Command[]
  containerColumns: TableColumn<ContainerSummary>[]
  containerError: string
  containers: ContainerSummary[]
  /** How many managers the cluster has. Demoting the last one loses the
      cluster, so the count is the reason the control is disabled rather than
      an error the operator discovers from Docker after the fact. */
  managers: number
  node: Node
  onAvailability: (availability: string) => void
  onBack: () => void
  onDiagnostics: () => void
  onLabel: (key: string, value: string) => void
  onReadiness: () => void
  onRemove: (confirmation: string) => Promise<void>
  onRole: (role: 'demote' | 'promote') => void
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
          { label: 'Placement', value: 'placement' },
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
                <AvailabilityControls busy={busy} node={node} onAvailability={onAvailability} />
                <Button onClick={() => setTab('placement')} size="sm" variant="ghost">Role, labels and removal</Button>
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
      ) : tab === 'placement' ? (
        <NodePlacement
          busy={busy}
          managers={managers}
          node={node}
          onAvailability={onAvailability}
          onLabel={onLabel}
          onRemove={onRemove}
          onRole={onRole}
        />
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

/** Active, pause, drain — the three states Swarm will schedule against. */
function AvailabilityControls({ busy, node, onAvailability }: {
  busy: boolean
  node: Node
  onAvailability: (availability: string) => void
}) {
  return (
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
  )
}

/**
 * Swarm membership: what this node IS to the cluster, rather than what it is
 * made of.
 *
 * Four changes, in the order they are reached for and separated by how much
 * they cost to undo. Availability is a scheduling hint and reverses in a
 * click; a label is a placement fact and reverses by typing the key again;
 * role is a quorum change; removal ends membership and is the only one behind
 * a typed phrase.
 */
function NodePlacement({ busy, managers, node, onAvailability, onLabel, onRemove, onRole }: {
  busy: boolean
  managers: number
  node: Node
  onAvailability: (availability: string) => void
  onLabel: (key: string, value: string) => void
  onRemove: (confirmation: string) => Promise<void>
  onRole: (role: 'demote' | 'promote') => void
}) {
  const [key, setKey] = useState('')
  const [value, setValue] = useState('')
  const labels = Object.entries(node.labels ?? {})
  const manager = node.role === 'manager'
  // Demoting the last manager leaves the cluster with nobody to schedule it,
  // and Docker will refuse — but an operator should be told that before they
  // click, not by an error in the run ledger afterwards.
  const lastManager = manager && managers <= 1
  const draining = node.availability === 'drain'

  return (
    <Rows gap="md">
      <Columns template="aside">
        <Rows gap="md">
          <Panel
            description="A label is how a stack says where it must run. Adding one changes nothing on its own; it changes where the NEXT placement decision can put a task."
            title="Placement labels"
          >
            <Rows gap="tight">
              {labels.length ? (
                <Inline>
                  {labels.map(([name, held]) => (
                    <Badge key={name}>{held ? `${name}=${held}` : name}</Badge>
                  ))}
                </Inline>
              ) : (
                <Body size="sm" tone="muted">This node carries no labels, so only unconstrained tasks can be placed on it.</Body>
              )}
              <Columns>
                <Input
                  hint="For example, storage or zone."
                  label="Label key"
                  onChange={(event) => setKey(event.target.value)}
                  placeholder="zone"
                  value={key}
                />
                <Input
                  hint="Leave empty to REMOVE this key from the node."
                  label="Label value"
                  onChange={(event) => setValue(event.target.value)}
                  placeholder="eu-west-1a"
                  value={value}
                />
              </Columns>
              <Inline>
                <Button
                  disabled={busy || !key.trim()}
                  loading={busy}
                  onClick={() => { onLabel(key.trim(), value.trim()); setKey(''); setValue('') }}
                  size="sm"
                  variant="secondary"
                >
                  {value.trim() ? 'Set label' : 'Remove label'}
                </Button>
              </Inline>
            </Rows>
          </Panel>

          <Panel
            description="Draining moves running tasks off this node; pausing only stops new ones from arriving. Neither removes it from the cluster."
            title="Availability"
          >
            <Facts columns={1} items={[
              { label: 'Current', value: `${capitalize(node.availability)} · ${capitalize(node.state)}` },
              { label: 'Tasks placed here', value: draining ? 'Being moved off' : node.availability === 'pause' ? 'Existing tasks stay; no new ones arrive' : 'Scheduled normally' },
            ]} />
            <AvailabilityControls busy={busy} node={node} onAvailability={onAvailability} />
          </Panel>
        </Rows>

        <Rows gap="md">
          <Panel
            description="A manager holds a copy of cluster state and votes in quorum. A worker only runs tasks."
            title="Role"
          >
            <Facts columns={1} items={[
              { label: 'Role', value: `${capitalize(node.role)}${node.manager?.leader ? ' · leader' : ''}` },
              { label: 'Managers in cluster', value: String(managers) },
              { label: 'Reachability', value: node.manager?.reachability ?? 'Not a manager' },
            ]} />
            {lastManager ? (
              <Banner tone="warning" title="This is the only manager">
                Demoting it would leave the cluster with nothing to schedule it and no way to promote a replacement. Add and
                promote a second manager first.
              </Banner>
            ) : null}
            {manager && managers === 2 ? (
              <Banner tone="warning" title="Two managers is not a quorum">
                A two-manager cluster loses quorum when either one goes away. Three is the smallest number that survives
                losing one.
              </Banner>
            ) : null}
            <Inline>
              <Button
                disabled={busy || (manager ? lastManager : false)}
                loading={busy}
                onClick={() => onRole(manager ? 'demote' : 'promote')}
                size="sm"
                variant="secondary"
              >
                {manager ? 'Demote to worker' : 'Promote to manager'}
              </Button>
            </Inline>
          </Panel>

          <Panel
            description="Removal ends this node's membership of the cluster. The host itself, its agent, and its local Docker are untouched — it can be prepared and joined again."
            title="Remove from the cluster"
          >
            {!draining ? (
              <Banner tone="warning" title="Drain this node first">
                Tasks running here are not moved by a removal. Set availability to Drain, wait for its task count to reach
                zero, and remove it then.
              </Banner>
            ) : null}
            {node.state === 'ready' && manager ? (
              <Banner tone="warning" title="This node is a reachable manager">
                Demote it to a worker before removing it, so the cluster is not asked to give up a quorum member and a
                scheduler in one step.
              </Banner>
            ) : null}
            <ConfirmPhrase
              action="Remove node"
              busy={busy}
              consequence={<>Removes <strong>{node.hostname}</strong> from this Swarm. Any task still placed here stops. The machine stays enrolled and can rejoin.</>}
              disabled={busy}
              onConfirm={onRemove}
              phrase={`REMOVE_NODE_${node.id.toUpperCase()}`}
            />
          </Panel>
        </Rows>
      </Columns>
    </Rows>
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
