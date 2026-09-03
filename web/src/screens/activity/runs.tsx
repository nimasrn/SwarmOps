import { useEffect, useState } from 'react'
import {
  ActivityFeed,
  Banner,
  Body,
  Button,
  CodeBlock,
  DataTable,
  DetailLayout,
  EmptyState,
  Facts,
  Inline,
  Input,
  List,
  ListRow,
  Mono,
  Panel,
  RecordLink,
  Select,
  Stack as Rows,
  StatusDot,
  Toolbar,
  useToast,
} from '@nim.zone/ui'
import type { TableColumn } from '@nim.zone/ui'
import { api } from '../../data/api'
import type { Command, Server } from '../../data/types'
import type { DashboardData } from '../../data/dashboard'
import { formatDateTime, sentence, shortID } from '../../lib/format'
import { isInFlight, isStalled, serverHealth } from '../../lib/health'
import { messageOf } from '../../lib/errors'
import { Screen } from '../../components/screen'
import { CommandStateBadge } from '../../components/badges'
import { useSelectedRecord } from '../../navigation/use-workspace'

type Toast = ReturnType<typeof useToast>

/**
 * Durable, explicitly targeted operations with ordered attempts and bounded
 * retries — and, when one stops, the reason it stopped and whether retrying it
 * is safe.
 *
 * The retry button is disabled while a prerequisite is still missing. A queue
 * that offers "retry" for an operation which cannot possibly succeed teaches
 * operators to press it repeatedly, which is exactly the blind replay of an
 * uncertain cluster mutation the whole queue exists to prevent.
 */
export function RunsPage({
  commands,
  dashboard,
  onOpenDeploy,
  onOpenDiagnostics,
  onOpenGateway,
  onOpenSwarm,
  onRefresh,
  servers,
  toast,
}: {
  commands: Command[]
  dashboard: DashboardData | null
  onOpenDeploy: () => void
  onOpenDiagnostics: () => void
  onOpenGateway: () => void
  onOpenSwarm: () => void
  onRefresh: () => Promise<void>
  servers: Server[]
  toast: Toast
}) {
  const [retrying, setRetrying] = useState('')
  const [selectedID, setSelectedID] = useSelectedRecord()
  const [query, setQuery] = useState('')
  const [stateFilter, setStateFilter] = useState('all')
  const [targetFilter, setTargetFilter] = useState('all')
  const [actionFilter, setActionFilter] = useState('all')
  const [timeFilter, setTimeFilter] = useState('all')

  const retry = async (command: Command) => {
    setRetrying(command.id)
    try {
      const updated = await api.retryCommand(command.id)
      toast({ message: `${updated.action} released for a new attempt (${shortID(updated.id)})`, tone: 'success' })
      await onRefresh()
    } catch (reason) {
      toast({ duration: 0, message: messageOf(reason), tone: 'danger' })
    } finally {
      setRetrying('')
    }
  }

  // The list is the last 100 runs. A run linked into an incident channel an
  // hour ago is routinely older than that, and the screen used to answer such
  // a link with "not found in the retained window" — which is true of the LIST
  // and not of the controller, which will still serve that run by id. So when
  // the window does not hold it, ask for it.
  const attention = commands.filter((command) => command.state === 'needs_attention')
  const listed = commands.find((command) => command.id === selectedID)
  const [fetched, setFetched] = useState<{ command?: Command; error?: string; id: string }>()

  useEffect(() => {
    if (!selectedID || listed) return
    let live = true
    setFetched({ id: selectedID })
    void api.command(selectedID)
      .then((command) => { if (live) setFetched({ command, id: selectedID }) })
      .catch((reason) => { if (live) setFetched({ error: messageOf(reason), id: selectedID }) })
    return () => { live = false }
  }, [listed, selectedID])

  const beyondWindow = !listed && fetched?.id === selectedID ? fetched : undefined
  const selected = listed ?? beyondWindow?.command
  const guidance = selected ? attentionGuidance(selected, dashboard, servers) : null
  const queued = commands.filter((command) => command.state === 'queued' || command.state === 'uploading').length
  const running = commands.filter(isInFlight).length
  const retryScheduled = commands.filter((command) => command.state === 'retry_scheduled').length
  const completed = commands.filter((command) => command.state === 'succeeded').length

  const filtered = commands.filter((command) =>
    (!query || `${command.action} ${command.target} ${command.id} ${servers.find((server) => server.id === command.serverId)?.name ?? ''}`.toLowerCase().includes(query.toLowerCase()))
    && (stateFilter === 'all' || command.state === stateFilter)
    && (targetFilter === 'all' || command.target === targetFilter)
    && (actionFilter === 'all' || command.action === actionFilter)
    && (timeFilter === 'all' || Date.now() - new Date(command.createdAt).getTime() <= Number(timeFilter) * 60 * 60 * 1000))

  const columns: TableColumn<Command>[] = [
    { header: 'Command', key: 'command', render: (command) => <RecordLink meta={shortID(command.id)} onClick={() => setSelectedID(command.id)} title={commandLabel(command.action)} /> },
    { header: 'Target', key: 'target', render: (command) => <Mono>{command.target}</Mono> },
    // A command carries the server it was queued for, and the runner lets an
    // operator queue against a target other than the selected one. The queue
    // has to say which cluster each row will actually change.
    { header: 'Server', key: 'server', render: (command) => servers.find((server) => server.id === command.serverId)?.name ?? <Mono>{shortID(command.serverId)}</Mono> },
    { header: 'State', key: 'state', render: (command) => <CommandStateBadge state={command.state} /> },
    // The ledger used to show a state badge and an attempt count, so rows
    // failing for four different reasons were indistinguishable from four
    // rows failing for one.
    { header: 'Reason', key: 'reason', render: (command) => command.failureSummary ?? command.lastError ?? (command.state === 'succeeded' ? '—' : 'No result has been recorded yet.') },
    { header: 'Attempts', key: 'attempts', numeric: true, render: (command) => `${command.attempt} / ${command.maxAttempts}` },
    { header: 'Next attempt', key: 'next', render: (command) => command.nextAttemptAt ? formatDateTime(command.nextAttemptAt) : 'No retry scheduled' },
    { header: 'Updated', key: 'updated', render: (command) => formatDateTime(command.updatedAt) },
  ]

  return (
    <Screen
      insights={[
        { hint: queued ? 'Waiting for a lease on their target' : 'Nothing is waiting to start', icon: 'clock', label: 'Queued', tone: queued ? 'accent' : 'neutral', value: String(queued) },
        { hint: running ? 'Leased and executing against a host now' : 'No operation is executing', icon: 'activity', label: 'Running', tone: running ? 'accent' : 'neutral', value: String(running) },
        { hint: attention.length ? 'Stopped rather than replayed — an outcome could not be proven' : 'No run is waiting on a decision', icon: 'alert', label: 'Needs attention', tone: attention.length ? 'danger' : 'success', value: String(attention.length) },
        { hint: retryScheduled ? 'A bounded retry is already scheduled' : `${completed} completed in the retained window`, icon: 'refresh', label: 'Retry scheduled', tone: retryScheduled ? 'warning' : 'neutral', value: String(retryScheduled) },
      ]}
      page="runs"
      status={attention.length ? <StatusDot tone="danger">{attention.length} need attention</StatusDot> : <StatusDot tone="success">No attention required</StatusDot>}
      width="full"
    >
      {selectedID && !selected && beyondWindow?.error ? <Banner title="This run could not be read" tone="warning" action={<Button onClick={() => setSelectedID('')}>Clear selection</Button>}>{beyondWindow.error} No outcome is inferred.</Banner> : null}
      {selectedID && !selected && !beyondWindow?.error ? <Banner title="Reading this run" tone="info">It is older than the retained window shown below, so it is being read from the controller by id.</Banner> : null}
      {selected && !listed ? <Banner title="Older than the retained window" tone="info">This run was read from the controller by id. It is not in the list below, and the figures above count only the retained window.</Banner> : null}
      <DetailLayout
        aside={selected ? (
          <Panel
            actions={<Button aria-label="Close run details" iconStart="close" onClick={() => setSelectedID('')} size="sm" variant="ghost">Close</Button>}
            caption={<CommandStateBadge state={selected.state} />}
            title={commandLabel(selected.action)}
          >
            <Rows>
              {guidance ? (
                <Banner title={selected.state === 'retry_scheduled' ? 'Why this run keeps failing' : 'Why this needs attention'} tone="warning">
                  <Rows gap="tight">
                    <Body size="sm">{guidance.summary}</Body>
                    {guidance.blockers.length ? (
                      <List plain>
                        {guidance.blockers.map((blocker) => <ListRow key={blocker} subtitle={blocker} title="Current blocker" />)}
                      </List>
                    ) : null}
                    <Body size="sm"><strong>How to recover:</strong> {guidance.recovery}</Body>
                    {selected.action === 'observability.core' ? (
                      <Inline>
                        <Button onClick={onOpenGateway} size="sm" variant="secondary">Gateway setup</Button>
                        <Button onClick={onOpenSwarm} size="sm" variant="secondary">Swarm placement</Button>
                        <Button onClick={onOpenDiagnostics} size="sm" variant="ghost">Agent diagnostics</Button>
                      </Inline>
                    ) : selected.action === 'traefik.reconcile' ? (
                      <Inline>
                        <Button onClick={onOpenGateway} size="sm" variant="secondary">Gateway &amp; ports</Button>
                        <Button onClick={onOpenSwarm} size="sm" variant="secondary">Swarm placement</Button>
                      </Inline>
                    ) : null}
                  </Rows>
                </Banner>
              ) : null}
              <Facts columns={1} items={[
                { label: 'Command ID', mono: true, value: selected.id },
                ...(selected.failureCode ? [{ label: 'Failure code', mono: true, value: selected.failureCode }] : []),
                ...(selected.failureSummary ? [{ label: 'Failure', value: selected.failureSummary }] : []),
                ...(selected.recoveryHint ? [{ label: 'Recovery', value: selected.recoveryHint }] : []),
                { label: 'Explicit target', mono: true, value: selected.target || selected.nodeId },
                { label: 'Server', value: servers.find((server) => server.id === selected.serverId)?.name ?? shortID(selected.serverId) },
                { label: 'Actor', value: selected.actor },
                { label: 'Authority epoch', mono: true, value: String(selected.authorityEpoch) },
                { label: 'Attempt', value: `${selected.attempt} / ${selected.maxAttempts}` },
                { label: 'Queued', value: formatDateTime(selected.createdAt) },
                { label: 'Last attempt', value: formatDateTime(selected.lastAttemptAt) },
                { label: 'Updated', value: formatDateTime(selected.updatedAt) },
              ]} />
              {selected.lastError ? <CodeBlock label="Latest result summary" wrap>{selected.lastError}</CodeBlock> : null}
              {/* A run whose source input never reached the controller has no
                  build context to retry with: the artifact was removed when the
                  upload failed, and the controller refuses to requeue it. The
                  honest next step is a new submission, so that is the button. */}
              {needsResubmission(selected) ? (
                <Button onClick={onOpenDeploy} variant="accent">Submit this deployment again</Button>
              ) : selected.state === 'needs_attention' || selected.state === 'retry_scheduled' ? (
                <Button
                  disabled={Boolean(retrying) || Boolean(guidance?.blockRetry)}
                  loading={retrying === selected.id}
                  onClick={() => void retry(selected)}
                  variant="accent"
                >
                  {guidance?.blockRetry ? 'Resolve prerequisites before retrying' : 'Retry reviewed command'}
                </Button>
              ) : null}
              <ActivityFeed events={[
                { action: 'requested command', actor: selected.actor, at: selected.createdAt, id: `${selected.id}-requested`, target: selected.target, tone: 'accent' },
                ...(selected.lastAttemptAt ? [{ action: `attempt ${selected.attempt} started`, at: selected.lastAttemptAt, id: `${selected.id}-attempt`, target: selected.action, tone: 'warning' as const }] : []),
                { action: `recorded ${sentence(selected.state).toLowerCase()}`, at: selected.updatedAt, id: `${selected.id}-result`, target: selected.action, tone: selected.state === 'succeeded' ? 'success' : isStalled(selected) ? 'danger' : 'default' },
              ]} />
            </Rows>
          </Panel>
        ) : undefined}
      >
        <Panel caption={`${filtered.length} of ${commands.length} retained`} flush title="Command ledger">
          <Toolbar actions={<Button iconStart="refresh" onClick={() => void onRefresh()} size="sm" variant="ghost">Refresh</Button>}>
            <Input aria-label="Search runs" iconStart="search" onChange={(event) => setQuery(event.target.value)} placeholder="Search action, target, or run ID" value={query} />
            <Select aria-label="Filter commands by state" onChange={(event) => setStateFilter(event.target.value)} options={[{ label: 'State: All', value: 'all' }, ...[...new Set(commands.map((command) => command.state))].map((state) => ({ label: sentence(state), value: state }))]} value={stateFilter} />
            <Select aria-label="Filter commands by target" onChange={(event) => setTargetFilter(event.target.value)} options={[{ label: 'Target: All', value: 'all' }, ...[...new Set(commands.map((command) => command.target))].map((target) => ({ label: target, value: target }))]} value={targetFilter} />
            <Select aria-label="Filter commands by action" onChange={(event) => setActionFilter(event.target.value)} options={[{ label: 'Action: All', value: 'all' }, ...[...new Set(commands.map((command) => command.action))].map((action) => ({ label: commandLabel(action), value: action }))]} value={actionFilter} />
            <Select aria-label="Filter commands by time" onChange={(event) => setTimeFilter(event.target.value)} options={[{ label: 'Time: All retained', value: 'all' }, { label: 'Last hour', value: '1' }, { label: 'Last 24 hours', value: '24' }, { label: 'Last 7 days', value: '168' }]} value={timeFilter} />
          </Toolbar>
          <DataTable
            columns={columns}
            empty={<EmptyState description="No cluster mutations have been queued yet." icon="clock" title="No commands" />}
            rowKey={(command) => command.id}
            rows={filtered}
          />
        </Panel>
      </DetailLayout>

      {attention.length > 0 ? (
        <Panel caption="Uncertain outcomes are never replayed blindly" title="Failure evidence">
          <List plain>
            {attention.map((command) => (
              <ListRow
                key={command.id}
                onClick={() => setSelectedID(command.id)}
                subtitle={command.failureSummary ?? command.lastError ?? 'Inspect the explicit target before retrying.'}
                title={`${commandLabel(command.action)} · ${command.target}`}
                trailing={<CommandStateBadge state={command.state} />}
              />
            ))}
          </List>
        </Panel>
      ) : null}
    </Screen>
  )
}

/**
 * Why a run stopped, and whether pressing retry can possibly help.
 *
 * `blockRetry` is deliberately narrower than `blockers`: a missing gateway or a
 * missing placement label means the retry cannot succeed, but "Docker reports
 * no stack" is evidence about the LAST attempt rather than a prerequisite, and
 * blocking on it would strand a run that is now perfectly retryable.
 */
export function attentionGuidance(command: Command, dashboard: DashboardData | null, servers: Server[]) {
  // A retry-scheduled run has already failed at least once, for the same
  // reason it will most likely fail again. Excluding it meant four stacks
  // failing on the same missing placement label showed a state badge, an
  // attempt count, and nothing an operator could act on.
  if (command.state !== 'needs_attention' && command.state !== 'failed' && command.state !== 'retry_scheduled') return null
  const server = servers.find((candidate) => candidate.id === command.serverId)
  const blockers: string[] = []

  if (!server || server.connectionState !== 'connected' || serverHealth(server) === 'unhealthy') {
    blockers.push('The selected server is not currently reachable through a healthy agent connection.')
  }
  if (command.action === 'observability.core') {
    if (!dashboard) {
      blockers.push('No current cluster snapshot is available, so SwarmOps cannot verify monitoring prerequisites.')
    } else {
      if (!dashboard.traefik.service) blockers.push('The SwarmOps-managed Traefik gateway is not installed.')
      if (!dashboard.nodes.some((node) => node.state === 'ready' && node.availability === 'active' && node.labels?.['nim.stateful'] === 'true')) {
        blockers.push('No ready active node has the required nim.stateful=true placement label.')
      }
      if (!dashboard.observability.coreInstalled) {
        blockers.push('Docker currently reports no swarmops-observability stack, so the earlier run did not leave a working monitoring deployment.')
      }
    }
  }

  return {
    blockRetry: blockers.some((blocker) => !blocker.startsWith('Docker currently reports')),
    blockers,
    recovery: command.recoveryHint ?? (command.action === 'observability.core'
      ? 'Restore the agent connection, install the managed gateway, assign stateful placement, then retry. SwarmOps will stop again if its reviewed assets or Swarm configs are missing.'
      : 'Inspect the explicit target and verify the intended change is absent before retrying.'),
    summary: command.failureSummary ?? (command.action === 'observability.core'
      ? 'SwarmOps started the core monitoring change but could not prove that Prometheus, Alertmanager, and Jaeger completed. Automatic replay stopped to avoid duplicating an uncertain cluster mutation.'
      : command.lastError ?? 'SwarmOps could not confirm that this operation completed.'),
  }
}

/** Failure classes that mean the source input never reached the controller.
    Nothing ran, nothing is stored, and the command cannot be requeued — only
    submitted again from the deployment screen. */
function needsResubmission(command: Command) {
  const code = command.failureCode ?? ''
  return code.startsWith('source_input_') || code.startsWith('build_context_') || code.startsWith('provider_archive_')
}

/** The operator's name for an action, where the wire name is a code. */
export function commandLabel(action: string) {
  if (action === 'observability.core') return 'Core monitoring change'
  if (action === 'traefik.reconcile') return 'Gateway installation'
  return action
}
