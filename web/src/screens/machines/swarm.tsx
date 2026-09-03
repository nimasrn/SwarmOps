import { useEffect, useState } from 'react'
import {
  Body,
  Button,
  Columns,
  DataTable,
  EmptyState,
  Inline,
  List,
  ListRow,
  Mono,
  Panel,
  RecordLink,
  Stack as Rows,
  StatusDot,
  useToast,
} from '@nim.zone/ui'
import type { TableColumn } from '@nim.zone/ui'
import { api } from '../../data/api'
import type { Command, ContainerDetail, ContainerStats, ContainerSummary, Node, ObservabilityStatus, Overview, Task } from '../../data/types'
import { capitalize, formatBytes, formatDateTime, formatNumber, sentence, shortID } from '../../lib/format'
import { capacityMeasured, hostProbeHealth, hostProbeLabel, isPending, nodeHealth } from '../../lib/health'
import { messageOf } from '../../lib/errors'
import { Screen } from '../../components/screen'
import { StatusBadge } from '../../components/badges'
import { ConfirmPhrase } from '../../components/confirm-phrase'
import { ClusterTopologyPanel } from './cluster-topology'
import { ContainerDetailView } from './container-detail'
import { NodeDetailView } from './node-detail'
import { SwarmSettingsPanel } from './swarm-settings'

type Toast = ReturnType<typeof useToast>

/**
 * Swarm membership, placement, and the machines underneath it.
 *
 * The screen is three views and one selection: the cluster, one node, and one
 * container on it. They are separate components because they answer separate
 * questions, and because the list has to stay readable while a detail is open
 * behind it — a single component rendering all three grew to three hundred
 * lines and no longer said which state it was in.
 */
export function SwarmPage({
  commands,
  nodes,
  onAddNode,
  onDiagnostics,
  observability,
  onOpenLogs,
  onReadiness,
  overview,
  toast,
}: {
  commands: Command[]
  nodes: Node[]
  observability: ObservabilityStatus | null
  onAddNode: () => void
  onDiagnostics: () => void
  onOpenLogs: () => void
  onReadiness: () => void
  overview: Overview
  toast: Toast
}) {
  const [selectedID, setSelectedID] = useState('')
  const [tasks, setTasks] = useState<Task[]>([])
  const [containers, setContainers] = useState<ContainerSummary[]>([])
  const [containerDetail, setContainerDetail] = useState<ContainerDetail | null>(null)
  const [containerStats, setContainerStats] = useState<ContainerStats | null>(null)
  const [taskError, setTaskError] = useState('')
  const [containerError, setContainerError] = useState('')
  const [busy, setBusy] = useState(false)
  // The cluster snapshot arrives on a poll. A membership change queued from
  // this page lands between polls, so the page that queued it needs to be able
  // to ask about its own node — which is exactly what `GET /nodes/{id}` is
  // for, and what nothing had ever called it for.
  const [reread, setReread] = useState<Node | null>(null)
  const fromSnapshot = nodes.find((node) => node.id === selectedID)
  const selected = reread?.id === selectedID ? reread : fromSnapshot

  useEffect(() => {
    if (!selected) return
    let live = true
    setTaskError('')
    setContainerError('')
    setReread(null)
    // `?? []` rather than trust: a controller that answered an empty result as
    // JSON null took this whole screen down with it, because every reading
    // below counts what it got.
    void api.nodeTasks(selected.id).then((value) => { if (live) setTasks(value ?? []) }).catch((reason) => { if (live) setTaskError(messageOf(reason)) })
    void api.containers().then((value) => { if (live) setContainers(value ?? []) }).catch((reason) => { if (live) setContainerError(messageOf(reason)) })
    return () => { live = false }
  }, [selected?.id])

  // Every membership change is the same shape: queue one audited command,
  // name it in a toast with its id, and let the cluster poll report the
  // result. Writing that four times is how three of the four ended up
  // unwritten, so it is written once.
  const queueNodeChange = async (description: string, run: () => Promise<Command>) => {
    setBusy(true)
    try {
      const command = await run()
      toast({ message: `${selected?.hostname ?? 'Node'}: ${description} queued (${shortID(command.id)})`, tone: 'success' })
    } catch (reason) {
      toast({ duration: 0, message: messageOf(reason), tone: 'danger' })
      throw reason
    } finally {
      setBusy(false)
    }
  }

  const refreshNode = async () => {
    if (!selectedID) return
    setBusy(true)
    try {
      setReread(await api.node(selectedID))
    } catch (reason) {
      toast({ duration: 0, message: messageOf(reason), tone: 'danger' })
    } finally {
      setBusy(false)
    }
  }

  const updateAvailability = (availability: string) => {
    if (!selected) return
    void queueNodeChange(availability, () => api.setNodeAvailability(selected.id, availability)).catch(() => {})
  }

  const updateRole = (role: 'demote' | 'promote') => {
    if (!selected) return
    void queueNodeChange(role, () => api.setNodeRole(selected.id, role)).catch(() => {})
  }

  // An empty value removes the key: that is the control plane's own contract
  // for `node update --label-rm`, so the console names it rather than adding
  // a second button that means the same thing.
  const updateLabel = (key: string, value: string) => {
    if (!selected) return
    void queueNodeChange(value ? `label ${key}=${value}` : `label ${key} removal`, () => api.setNodeLabel(selected.id, key, value)).catch(() => {})
  }

  const removeNode = async (confirmation: string) => {
    if (!selected) return
    await queueNodeChange('removal', () => api.removeNode(selected.id, confirmation))
    // The node is gone from the cluster; keeping its detail page open would
    // show a record the next snapshot no longer contains.
    setSelectedID('')
  }

  const inspectContainer = async (container: ContainerSummary) => {
    setBusy(true)
    setContainerError('')
    try {
      const [detail, stats] = await Promise.all([api.container(container.Id), api.containerStats(container.Id)])
      setContainerDetail(detail)
      setContainerStats(stats)
    } catch (reason) {
      setContainerError(messageOf(reason))
    } finally {
      setBusy(false)
    }
  }

  const actOnContainer = async (action: 'restart' | 'stop') => {
    if (!containerDetail) return
    setBusy(true)
    try {
      const command = await api.containerAction(containerDetail.Id, action)
      toast({ message: `${action} queued for ${containerDetail.Name.replace(/^\//, '')} (${shortID(command.id)})`, tone: 'success' })
    } catch (reason) {
      toast({ duration: 0, message: messageOf(reason), tone: 'danger' })
    } finally {
      setBusy(false)
    }
  }

  const containerColumns: TableColumn<ContainerSummary>[] = [
    { header: 'Name', key: 'name', render: (container) => <RecordLink meta={shortID(container.Id)} onClick={() => void inspectContainer(container)} title={container.Names?.[0]?.replace(/^\//, '') || shortID(container.Id)} /> },
    { header: 'Image', key: 'image', render: (container) => <Mono>{container.Image}</Mono> },
    { header: 'State', key: 'state', render: (container) => <StatusDot tone={container.State === 'running' ? 'success' : 'warning'}>{capitalize(container.State)}</StatusDot> },
    { header: 'Status', key: 'status', render: (container) => container.Status },
    { header: 'Networks', key: 'networks', render: (container) => Object.keys(container.NetworkSettings?.Networks ?? {}).join(', ') || 'None' },
  ]

  if (selected && containerDetail) {
    return (
      <ContainerDetailView
        busy={busy}
        container={containerDetail}
        node={selected}
        onBack={() => { setContainerDetail(null); setContainerStats(null) }}
        onOpenLogs={onOpenLogs}
        onRestart={() => void actOnContainer('restart')}
        onStop={() => void actOnContainer('stop')}
        stats={containerStats}
      />
    )
  }

  if (selected) {
    const nodeCommands = commands
      .filter((command) => command.nodeId === selected.id || command.target.includes(selected.id) || command.target.includes(selected.hostname))
      .slice(0, 8)
    return (
      <NodeDetailView
        busy={busy}
        commands={nodeCommands}
        containerColumns={containerColumns}
        containerError={containerError}
        containers={containers}
        managers={nodes.filter((node) => node.role === 'manager').length}
        node={selected}
        onAvailability={updateAvailability}
        onBack={() => setSelectedID('')}
        onDiagnostics={onDiagnostics}
        onLabel={updateLabel}
        onReadiness={onReadiness}
        onRefresh={() => void refreshNode()}
        onRemove={removeNode}
        onRole={updateRole}
        taskError={taskError}
        tasks={tasks}
      />
    )
  }

  const attention = nodes.filter((node) => nodeHealth(node) !== 'healthy')
  const unprobed = nodes.filter((node) => hostProbeHealth(node) === 'unknown')

  // The stack this installs is the one the Platform screen owns; the button is
  // repeated here because this is the screen that shows the gap it explains,
  // and sending an operator to another screen to type the same phrase is not a
  // different decision.
  const installHostProbe = async () => {
    setBusy(true)
    try {
      const command = await api.nodeAgentCollection(true, 'INSTALL_NODE_AGENT')
      toast({ message: `Node inventory agent installation queued (${shortID(command.id)})`, tone: 'success' })
    } catch (reason) {
      toast({ duration: 0, message: messageOf(reason), tone: 'danger' })
    } finally {
      setBusy(false)
    }
  }
  const pending = commands.filter(isPending).slice(0, 6)
  const ready = nodes.filter((node) => nodeHealth(node) === 'healthy').length

  const columns: TableColumn<Node>[] = [
    { header: 'Name / IP', key: 'node', render: (node) => <RecordLink meta={node.address ?? shortID(node.id)} onClick={() => setSelectedID(node.id)} title={node.hostname} /> },
    { header: 'Role', key: 'role', render: (node) => <span>{node.role}{node.manager?.leader ? ' · leader' : ''}</span> },
    { header: 'Availability', key: 'availability', render: (node) => capitalize(node.availability) },
    { header: 'Host probe', key: 'agent', render: (node) => <StatusBadge health={hostProbeHealth(node)} label={hostProbeLabel(node)} /> },
    { header: 'Docker', key: 'docker', render: (node) => <Mono>{node.engine.version ?? node.dockerVersion ?? 'not reported'}</Mono> },
    { header: 'CPU', key: 'cpu', numeric: true, render: (node) => `${formatNumber(node.cpu.capacity)} cores` },
    { header: 'Memory', key: 'memory', render: (node) => capacityMeasured(node.memory) ? `${formatBytes(node.memory.used)} / ${formatBytes(node.memory.capacity)}` : `${formatBytes(node.memory.capacity)} capacity · usage unmeasured` },
    { header: 'Disk', key: 'disk', render: (node) => capacityMeasured(node.disk) ? `${formatBytes(node.disk.used)} / ${formatBytes(node.disk.capacity)}` : 'Unmeasured' },
    { header: 'Last seen', key: 'seen', render: (node) => node.agent.collectedAt ? formatDateTime(node.agent.collectedAt) : 'no probe' },
  ]

  return (
    <Screen
      actions={
        <Inline>
          <Button iconStart="plus" onClick={onAddNode} variant="accent">Add a node</Button>
          <Button iconStart="activity" onClick={onDiagnostics} variant="secondary">Run health check</Button>
        </Inline>
      }
      insights={[
        { hint: ready === nodes.length ? 'Every node is ready and active' : 'Ready, active, and answering their probe', icon: 'server', label: 'Healthy nodes', tone: nodes.length && ready === nodes.length ? 'success' : 'warning', value: `${ready} / ${nodes.length}` },
        { hint: overview.summary.managers > 1 ? 'A manager can be lost without losing quorum' : 'A single manager is a single point of failure', icon: 'shield', label: 'Managers', tone: overview.summary.managers > 1 ? 'success' : 'warning', value: String(overview.summary.managers) },
        { hint: 'Tasks Swarm currently reports as running', icon: 'layers', label: 'Running tasks', value: String(overview.summary.runningTasks) },
        { hint: attention.length ? 'Not ready, not active, or its probe is failing' : 'No node is drained, paused, or silent', icon: 'alert', label: 'Need review', onOpen: attention.length ? onDiagnostics : undefined, tone: attention.length ? 'danger' : 'success', value: String(attention.length) },
      ]}
      page="swarm"
      width="full"
    >
      <ClusterTopologyPanel nodes={nodes} overview={overview} />

      <Columns template="aside">
        <Panel caption={`${nodes.length} in this cluster`} flush title="Nodes">
          {nodes.length
            ? <DataTable columns={columns} rowKey={(node) => node.id} rows={nodes} summary={`1–${nodes.length} of ${nodes.length}`} />
            : <EmptyState actions={<Button onClick={onAddNode} variant="accent">Add a node</Button>} description="Enroll an Ubuntu machine agent, inspect its prerequisites, then initialise or join Docker Swarm." icon="server" title="No nodes" />}
        </Panel>
        <Panel description="A node listed here is not scheduling the work you think it is." title="Attention">
          {attention.length
            ? (
              <List plain>
                {attention.map((node) => (
                  <ListRow
                    key={node.id}
                    leading={<StatusDot tone={node.state !== 'ready' ? 'danger' : 'warning'}>{node.hostname}</StatusDot>}
                    subtitle={node.agent.error ?? `${capitalize(node.state)} · ${capitalize(node.availability)}`}
                    title={hostProbeHealth(node) === 'degraded' ? 'Host probe unreachable' : 'Node needs review'}
                  />
                ))}
              </List>
            )
            : <StatusDot tone="success">No node needs attention</StatusDot>}
          {unprobed.length > 0 && observability && !observability.agentInstalled ? (
            <Rows gap="tight">
              <Body size="sm">
                {unprobed.length} of {nodes.length} nodes report no host probe, so memory usage and disk are
                unmeasured here. That is separate from the enrolled agent's connection, which the header states on
                its own.
              </Body>
              <ConfirmPhrase
                action="Install host probe"
                busy={busy}
                consequence="A read-only agent is installed on every node with a read-only Docker socket and a host-root mount. It reads; it never writes."
                onConfirm={() => void installHostProbe()}
                phrase="INSTALL_NODE_AGENT"
                variant="accent"
              />
            </Rows>
          ) : null}
          <Inline>
            <Button onClick={onDiagnostics} size="sm" variant="secondary">Diagnostics</Button>
            <Button onClick={onReadiness} size="sm" variant="ghost">Host setup</Button>
          </Inline>
        </Panel>
      </Columns>

      <Columns template="two-thirds">
        <Panel caption={`${pending.length} queued or running`} flush title="Pending node operations">
        {pending.length
          ? (
            <DataTable
              caption="Pending node operations"
              columns={[
                { header: 'Target', key: 'target', render: (command: Command) => <Mono>{command.target}</Mono> },
                { header: 'Operation', key: 'action', render: (command: Command) => command.action },
                { header: 'Requested by', key: 'actor', render: (command: Command) => command.actor },
                { header: 'Status', key: 'state', render: (command: Command) => <StatusDot tone={command.state === 'retry_scheduled' ? 'warning' : 'accent'}>{sentence(command.state)}</StatusDot> },
              ]}
              rowKey={(command) => command.id}
              rows={pending}
            />
          )
            : <Body size="sm" tone="muted">No node operation is queued or running.</Body>}
        </Panel>
        <SwarmSettingsPanel toast={toast} />
      </Columns>
    </Screen>
  )
}
