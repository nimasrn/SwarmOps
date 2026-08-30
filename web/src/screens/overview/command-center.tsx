import { useEffect, useState } from 'react'
import {
  Button,
  Columns,
  EmptyState,
  Icon,
  Inline,
  List,
  ListRow,
  Metric,
  MetricGrid,
  Mono,
  Panel,
  StatusDot,
  StatusHero,
  Table,
  TaskProgress,
} from '@nim.zone/ui'
import type { TableColumn, TaskStepStatus } from '@nim.zone/ui'
import { api } from '../../data/api'
import type { Command, ContainerSummary, CoreTopology, Server } from '../../data/types'
import type { DashboardData } from '../../data/dashboard'
import { attentionItems, type AttentionItem } from '../../lib/attention'
import { elapsed, formatTime, sentence } from '../../lib/format'
import { commandTone, isInFlight, isServerConnected } from '../../lib/health'
import type { WorkspacePage } from '../../navigation/navigation'
import { Screen } from '../../components/screen'
import { EvidenceLedger } from './evidence-ledger'

interface CommandCenterProps {
  cluster?: DashboardData
  commands: Command[]
  core: CoreTopology
  onOpen: (page: WorkspacePage) => void
  servers: Server[]
}

const COMMAND_COLUMNS: TableColumn<Command>[] = [
  { header: 'Action', key: 'action', render: (command) => command.action },
  { header: 'Target', key: 'target', render: (command) => <Mono>{command.target || command.nodeId}</Mono> },
  { header: 'State', key: 'state', render: (command) => <StatusDot pulse={isInFlight(command)} tone={commandTone(command.state)}>{sentence(command.state)}</StatusDot> },
  { header: 'Actor', key: 'actor', render: (command) => command.actor },
  { header: 'Duration', key: 'duration', numeric: true, render: (command) => elapsed(command.createdAt, command.updatedAt) },
]

/**
 * What production is doing, and the one thing worth doing about it.
 *
 * The screen ranks rather than lists. A console that shows six things an
 * operator COULD do has left the hard part — deciding which one — to the person
 * under pressure, so there is exactly one recommended action beside the
 * verdict, and the verdict answers to the rows underneath it.
 */
export function CommandCenter({ cluster, commands, core, onOpen, servers }: CommandCenterProps) {
  const activeCore = core.members.find((member) => member.id === core.activeId)
  const connectedServer = servers.find(isServerConnected)
  const attention = attentionItems(core, cluster, servers, commands)
  const nodes = cluster?.overview.nodes ?? []
  const [containers, setContainers] = useState<ContainerSummary[]>([])
  const [containerEvidence, setContainerEvidence] = useState<'available' | 'loading' | 'unavailable'>('loading')

  // The verdict has to answer to the rows underneath it. `serving` is what the
  // cluster is doing; `blocked` is what an operator cannot currently do. The
  // old check ignored `attention` entirely, so the hero could read a green
  // "Production is operating" directly above two rows marked Blocking — which
  // is exactly how a standing verdict stops being read.
  const serving = core.controlEnabled && Boolean(connectedServer) && cluster?.overview.health !== 'unhealthy'
  const blocked = attention.filter((item) => item.tone === 'danger').length
  const operating = serving && blocked === 0
  const running = commands.filter(isInFlight)
  const primaryAttention = attention[0]
  const next = nextStep({ attention: primaryAttention, cluster, connectedServer, core, servers })
  const setup = setupSteps({ cluster, servers })
  const setupDone = setup.every((step) => step.status === 'done')

  useEffect(() => {
    let cancelled = false
    if (!cluster) {
      setContainers([])
      setContainerEvidence('unavailable')
      return () => { cancelled = true }
    }
    setContainerEvidence('loading')
    void api.containers().then((value) => {
      if (!cancelled) {
        setContainers(Array.isArray(value) ? value : [])
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
    <Screen
      actions={
        <Inline>
          <Button iconStart="play" onClick={() => onOpen('source-deploy')} variant="accent">Deploy from source</Button>
          <Button iconStart="plus" onClick={() => onOpen('servers')} variant="secondary">Add a server</Button>
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
      page="overview"
      subtitle="What production is doing, and the one thing worth doing about it. Every signal below names the layer that produced it."
      width="full"
    >
      {/* The hero used to state a verdict and stop. A console read under
          pressure should hand back the NEXT ACTION with the verdict, so the
          decision and the button that serves it are one glance apart. */}
      <StatusHero
        actions={<Button iconStart={next.icon} onClick={() => onOpen(next.page)} variant={operating && !primaryAttention ? 'secondary' : 'accent'}>{next.label}</Button>}
        description={next.detail}
        icon={operating ? 'check' : 'alert'}
        title={
          operating
            ? 'Production is operating'
            : serving
              ? `Production is serving, and ${blocked} operation${blocked === 1 ? ' is' : 's are'} blocked`
              : 'Production evidence is incomplete'
        }
        tone={operating ? 'success' : 'warning'}
      />

      {/* The path from an empty controller to a served request, with the steps
          already done marked off. It disappears once every step is done: a
          checklist that stays on screen after it is finished is furniture. */}
      {!setupDone ? (
        <Panel
          caption={`${setup.filter((step) => step.status === 'done').length} of ${setup.length} done`}
          description="Each step is reversible, leaves an audit record, and opens where it is performed."
          title="Get this cluster serving"
        >
          <TaskProgress steps={setup} title="From an empty controller to a served request" />
          <Inline>
            {setup.filter((step) => step.status !== 'done').slice(0, 1).map((step) => (
              <Button key={step.id} onClick={() => onOpen(step.page)} variant="accent">{step.action}</Button>
            ))}
            {setup.filter((step) => step.status !== 'done').slice(1, 3).map((step) => (
              <Button key={step.id} onClick={() => onOpen(step.page)} variant="ghost">{step.action}</Button>
            ))}
          </Inline>
        </Panel>
      ) : null}

      <Columns align="start" template="two-thirds">
        <Panel
          actions={attention.length ? <Button onClick={() => onOpen('commands')} size="sm" variant="secondary">Open runs</Button> : undefined}
          caption={attention.length ? `${attention.length} open decision${attention.length === 1 ? '' : 's'}` : undefined}
          title={attention.length ? 'Needs an operator decision' : 'Nothing needs a decision'}
        >
          {attention.length ? (
            <List plain>
              {attention.map((item) => (
                <ListRow
                  key={item.id}
                  leading={<Icon name={item.tone === 'danger' ? 'alert' : 'activity'} size="sm" tone={item.tone === 'danger' ? 'danger' : 'warning'} />}
                  onClick={() => onOpen(item.page)}
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
              onClick={() => onOpen('core')}
              subtitle={activeCore ? 'Owns durable operations and policy' : `Local identity ${core.localId}`}
              title="Controller"
              trailing={<StatusDot tone={core.controlEnabled ? 'success' : 'warning'}>{core.controlEnabled ? 'Ready' : 'Standby'}</StatusDot>}
            />
            <ListRow
              leading={<Icon name="link" size="sm" />}
              onClick={() => onOpen('servers')}
              subtitle="Authenticated outbound TLS; no inbound agent port"
              title="Outbound agent"
              trailing={<StatusDot tone={connectedServer ? 'success' : 'warning'}>{connectedServer ? 'Connected' : 'Missing'}</StatusDot>}
            />
            <ListRow
              leading={<Icon name="package" size="sm" />}
              onClick={() => onOpen('resources')}
              subtitle={connectedServer?.dockerVersion ? `Engine ${connectedServer.dockerVersion}` : 'Reports local containers and Swarm state'}
              title="Docker Engine"
              trailing={<StatusDot tone={connectedServer?.dockerAvailable ? 'success' : 'warning'}>{connectedServer?.dockerAvailable ? 'Healthy' : 'Unavailable'}</StatusDot>}
            />
            <ListRow
              leading={<Icon name="layers" size="sm" />}
              onClick={() => onOpen('nodes')}
              subtitle={connectedServer?.swarmControlAvailable ? `${nodes.length} node${nodes.length === 1 ? '' : 's'} in the selected cluster` : 'Docker can run without Swarm services'}
              title="Swarm manager"
              trailing={<StatusDot tone={connectedServer?.swarmControlAvailable ? 'success' : 'neutral'}>{connectedServer?.swarmControlAvailable ? 'Active' : 'Not active'}</StatusDot>}
            />
          </List>
        </Panel>

        {/* "Where the signal comes from" names the LAYER that produced a
            signal. This names which signals are measurements at all, and which
            are absences the console refuses to average into a figure. Same
            argument, one level deeper.

            EvidenceLedger brings its own Panel — wrapping it in a second one
            printed the heading and its description twice. */}
        {cluster ? (
          <EvidenceLedger
            observability={cluster.observability}
            onOpen={(page) => onOpen(page as WorkspacePage)}
            overview={cluster.overview}
            traefik={cluster.traefik}
          />
        ) : null}
      </Columns>

      <Panel
        actions={
          <Inline>
            <Button onClick={() => onOpen('applications')} size="sm" variant="ghost">Applications</Button>
            <Button onClick={() => onOpen('nodes')} size="sm" variant="ghost">Swarm &amp; placement</Button>
            <Button onClick={() => onOpen('gateway')} size="sm" variant="ghost">Traffic</Button>
          </Inline>
        }
        description="Counted from the selected cluster's own last report, not from what SwarmOps was asked to create."
        title="What is actually running"
      >
        <MetricGrid columns={4} dense>
          <Metric
            hint={containerEvidence === 'available' ? 'Docker containers, including Compose workloads' : containerEvidence === 'loading' ? 'Reading Docker container inventory' : 'Open Docker resources for current evidence'}
            icon="package"
            label="Containers"
            onClick={() => onOpen('resources')}
            unmeasured={containerEvidence !== 'available'}
            value={containerEvidence === 'available' ? String(containers.length) : 'cannot see'}
          />
          <Metric
            hint={cluster?.overview.summary.services ? 'Processes scheduled by Docker Swarm' : 'Swarm can be active while running zero services'}
            icon="terminal"
            label="Swarm services"
            onClick={() => onOpen('services')}
            value={String(cluster?.overview.summary.services ?? 0)}
          />
          <Metric
            hint={cluster?.stacks.length ? 'Namespaces grouping Swarm services' : 'No namespaced service groups'}
            icon="layers"
            label="Stacks"
            onClick={() => onOpen('stacks')}
            value={String(cluster?.stacks.length ?? 0)}
          />
          <Metric
            hint={cluster?.traefik.service ? 'The managed gateway is scheduled and owns the edge' : 'Deployed applications have no public hostname until a gateway owns the edge'}
            icon="globe"
            label="Edge gateway"
            onClick={() => onOpen('gateway')}
            tone={cluster ? (cluster.traefik.service ? 'success' : 'warning') : undefined}
            unmeasured={!cluster}
            value={cluster ? (cluster.traefik.service ? 'Running' : 'None') : 'cannot see'}
          />
        </MetricGrid>
      </Panel>

      <Panel actions={<Button onClick={() => onOpen('commands')} size="sm" variant="ghost">View all runs</Button>} flush title="Recent operations">
        {commands.length
          ? <Table columns={COMMAND_COLUMNS} rowKey={(command) => command.id} rows={commands.slice(0, 6)} />
          : <EmptyState description="Queued, running, retrying, and completed operations appear here as they are recorded." icon="terminal" title="No operations yet" />}
      </Panel>
    </Screen>
  )
}

interface NextStep {
  detail: string
  icon: 'activity' | 'external' | 'link' | 'play' | 'plus'
  label: string
  page: WorkspacePage
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
  cluster?: DashboardData
  connectedServer?: Server
  core: CoreTopology
  servers: Server[]
}): NextStep {
  if (!core.controlEnabled) {
    return { detail: 'This controller does not hold the active authority epoch, so every change is fenced. Resolve the handoff before anything else — no other step can complete while it stands.', icon: 'activity', label: 'Open controller recovery', page: 'core' }
  }
  if (!servers.length) {
    return { detail: 'No host is enrolled yet. Enrollment is one outbound command on Ubuntu; the agent keeps its own key and waits for you to approve its code.', icon: 'plus', label: 'Connect your first server', page: 'servers' }
  }
  if (!connectedServer) {
    return { detail: 'No agent is answering the controller, so nothing on this screen is current. Diagnostics names the layer that stopped — transport, Docker, or Swarm.', icon: 'link', label: 'Diagnose the connection', page: 'agent-diagnostics' }
  }
  if (attention) {
    return { detail: `${attention.label}. ${attention.detail}`, icon: 'activity', label: 'Review the open decision', page: attention.page }
  }
  if (!cluster) {
    return { detail: 'An agent is connected but this console is not pointed at a Swarm manager. Selection is deliberate: reads and changes stay scoped to one explicit cluster.', icon: 'plus', label: 'Choose a cluster', page: 'servers' }
  }
  if (!cluster.traefik.service) {
    return { detail: 'The cluster is healthy and nothing needs a decision. No gateway owns the edge yet, so a deployed application has no public hostname until one does.', icon: 'external', label: 'Set up the gateway', page: 'gateway' }
  }
  return { detail: 'Controller, agent, Docker, and Swarm are all answering, and no run is waiting on a decision. The cluster is ready for a deployment.', icon: 'play', label: 'Deploy from source', page: 'source-deploy' }
}

interface SetupStep {
  action: string
  id: string
  label: string
  page: WorkspacePage
  status: TaskStepStatus
}

/**
 * The shortest path from an empty controller to a request being served, as a
 * list that marks itself off.
 *
 * Every one of these steps existed before; what did not exist was anywhere
 * showing them as a sequence. An operator who has just enrolled their first
 * host has no way to know that a gateway is what stands between a deployed
 * application and a hostname that resolves — so they deploy, find nothing
 * answering, and conclude the product is broken.
 */
function setupSteps({ cluster, servers }: { cluster?: DashboardData; servers: Server[] }): SetupStep[] {
  const done = {
    deploy: (cluster?.overview.summary.services ?? 0) > 0,
    enroll: servers.some(isServerConnected),
    gateway: Boolean(cluster?.traefik.service),
    observe: Boolean(cluster?.observability.coreInstalled),
    swarm: Boolean(cluster),
  }

  const steps = [
    { action: 'Connect a server', id: 'enroll', label: 'Enroll a host and let its agent connect', page: 'servers' as const },
    { action: 'Open host setup', id: 'swarm', label: 'Make the host a Docker Swarm manager', page: 'provisioning' as const },
    { action: 'Install the gateway', id: 'gateway', label: 'Give the cluster an edge gateway, so a hostname can resolve', page: 'gateway' as const },
    { action: 'Deploy from source', id: 'deploy', label: 'Deploy something and watch it start serving', page: 'source-deploy' as const },
    { action: 'Deploy monitoring', id: 'observe', label: 'Collect metrics and traces, so a verdict has evidence behind it', page: 'observability' as const },
  ]

  // Exactly one step is `active`: the first one that is not done. Marking every
  // unmet step active produced three spinners at once and answered "what now"
  // with a list, which is the question the track exists to close.
  const next = steps.findIndex((step) => !done[step.id as keyof typeof done])
  return steps.map((step, index) => ({
    ...step,
    status: done[step.id as keyof typeof done] ? 'done' : index === next ? 'active' : 'pending',
  }))
}
