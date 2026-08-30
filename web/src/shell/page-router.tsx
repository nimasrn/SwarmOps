import { Banner } from '@nim.zone/ui'
import type { useToast } from '@nim.zone/ui'
import type { AuditEvent, Command, CoreTopology, Server } from '../data/types'
import type { DashboardData } from '../data/dashboard'
import { CLUSTER_PAGES, type WorkspacePage } from '../navigation/navigation'
import { WorkspaceLoading } from '../components/loading-screen'

import { CommandCenter } from '../screens/overview/command-center'
import { SourceDeployPage } from '../screens/deliver/source-deploy'
import { ApplicationsPage } from '../screens/deliver/applications'
import { BuildsPage } from '../screens/deliver/builds'
import { KubernetesImportPage } from '../screens/deliver/kubernetes-import'
import { ServersPage } from '../screens/fleet/servers'
import { ServerReadinessPage } from '../screens/fleet/server-readiness'
import { NodesPage } from '../screens/fleet/nodes'
import { AgentDiagnosticsPage } from '../screens/fleet/agent-diagnostics'
import { ResourcesPage } from '../screens/fleet/resources/index'
import { ClusterRequiredPage } from '../screens/fleet/cluster-required'
import { ServicesPage } from '../screens/workloads/services'
import { StacksPage } from '../screens/workloads/stacks'
import { DatabasesPage } from '../screens/workloads/databases'
import { TraefikControlPage } from '../screens/traffic/gateway'
import { InsightsPage } from '../screens/observe/insights'
import { LogsPage } from '../screens/observe/logs'
import { ObservabilityPage } from '../screens/observe/observability'
import { RunsPage } from '../screens/activity/runs'
import { CommandCataloguePage } from '../screens/activity/catalogue'
import { AuditPage } from '../screens/activity/audit'
import { CoreTopologyPage } from '../screens/control/core-topology'

type Toast = ReturnType<typeof useToast>

export interface PageRouterProps {
  activeServer?: Server
  auditError: string
  auditEvents: AuditEvent[]
  auditInitialLoading: boolean
  clusterError: string
  commands: Command[]
  commandsError: string
  commandsInitialLoading: boolean
  core: CoreTopology | null
  coreError: string
  data: DashboardData | null
  highlightedCommandID: string
  onConnected: (server: Server) => Promise<void>
  onHighlightCommand: (id: string) => void
  onOpen: (page: WorkspacePage) => void
  onRefreshCommands: () => Promise<void>
  onRefreshServers: () => Promise<void>
  onSelectServer: (id: string) => void
  servers: Server[]
  serversLoading: boolean
  toast: Toast
  workspace: WorkspacePage
}

/**
 * One screen per destination, and the three conditions under which a
 * destination cannot draw itself yet: no controller answer, no selected
 * cluster, no snapshot.
 *
 * The router exists so those three conditions are decided ONCE. They were
 * previously spread through a chain of ternaries inside the shell, which is how
 * `overview` ended up with no branch at all during the window before the
 * controller answered — the chain fell through to a switch with no case for it
 * and rendered nothing.
 */
export function PageRouter(props: PageRouterProps) {
  const {
    activeServer, auditError, auditEvents, auditInitialLoading, clusterError, commands, commandsError,
    commandsInitialLoading, core, coreError, data, highlightedCommandID, onConnected, onHighlightCommand,
    onOpen, onRefreshCommands, onRefreshServers, onSelectServer, servers, serversLoading, toast, workspace,
  } = props

  // Screens that never need a cluster. These are exactly what an operator needs
  // when nothing is connected, so none of them may be gated behind a selection.
  switch (workspace) {
    case 'servers':
      return (
        <ServersPage
          activeServerID={activeServer?.id ?? ''}
          onConnected={onConnected}
          onDiagnostics={(id) => { if (id) onSelectServer(id); onOpen('agent-diagnostics') }}
          onProvision={() => onOpen('provisioning')}
          onRefresh={onRefreshServers}
          onSelect={onSelectServer}
          servers={servers}
          toast={toast}
        />
      )
    case 'agent-diagnostics':
      return <AgentDiagnosticsPage onRefreshServers={onRefreshServers} servers={servers} toast={toast} />
    case 'provisioning':
      return <ServerReadinessPage servers={servers} toast={toast} />
    case 'core':
      return (
        <>
          {coreError ? <Banner title="Controller status unavailable" tone="danger">{coreError}</Banner> : null}
          <CoreTopologyPage servers={servers} toast={toast} />
        </>
      )
    case 'audit':
      return (
        <>
          {auditError ? <Banner title="Audit trail unavailable" tone="danger">{auditError}</Banner> : null}
          {auditInitialLoading ? <WorkspaceLoading label="Reading the audit trail" /> : <AuditPage events={auditEvents} />}
        </>
      )
    case 'commands':
      return (
        <>
          {commandsError ? <Banner title="Runs unavailable" tone="danger">{commandsError}</Banner> : null}
          {commandsInitialLoading
            ? <WorkspaceLoading label="Reading durable commands" />
            : (
              <RunsPage
                commands={commands}
                dashboard={data}
                highlightedID={highlightedCommandID}
                onOpenDiagnostics={() => onOpen('agent-diagnostics')}
                onOpenGateway={() => onOpen('gateway')}
                onOpenSwarm={() => onOpen('nodes')}
                onRefresh={onRefreshCommands}
                servers={servers}
                toast={toast}
              />
            )}
        </>
      )
    case 'catalogue':
      return (
        <CommandCataloguePage
          activeServerID={activeServer?.id ?? ''}
          onQueued={(commandID) => { onHighlightCommand(commandID); onOpen('commands') }}
          servers={servers}
          toast={toast}
        />
      )
    case 'kubernetes-import':
      return <KubernetesImportPage onOpenStacks={() => onOpen('stacks')} />
    case 'source-deploy':
    case 'registry':
      return (
        <SourceDeployPage
          managerID={activeServer?.id ?? ''}
          managerName={activeServer?.name}
          toast={toast}
          view={workspace === 'registry' ? 'registry' : 'source'}
        />
      )
    case 'overview':
      // The command centre is the only screen for `overview`, so the brief
      // window before the controller answers needs its own state rather than
      // falling through to a router with no case for it.
      return core
        ? <CommandCenter cluster={data ?? undefined} commands={commands} core={core} onOpen={onOpen} servers={servers} />
        : <WorkspaceLoading label="Reading controller authority" />
    default:
      break
  }

  if (CLUSTER_PAGES.has(workspace) && !activeServer) {
    return (
      <ClusterRequiredPage
        onOpenProvisioning={() => onOpen('provisioning')}
        onOpenServers={() => onOpen('servers')}
        page={workspace}
        servers={servers}
      />
    )
  }

  if (!data) {
    return (
      <>
        {clusterError ? <Banner title="Cluster snapshot unavailable" tone="danger">{clusterError}</Banner> : null}
        <WorkspaceLoading label={serversLoading ? 'Reading server profiles' : 'Reading the selected Docker Swarm'} />
      </>
    )
  }

  return (
    <>
      {clusterError ? <Banner title="Cluster snapshot unavailable" tone="danger">{clusterError}</Banner> : null}
      <ClusterScreen commands={commands} data={data} onOpen={onOpen} toast={toast} workspace={workspace} />
    </>
  )
}

function ClusterScreen({ commands, data, onOpen, toast, workspace }: {
  commands: Command[]
  data: DashboardData
  onOpen: (page: WorkspacePage) => void
  toast: Toast
  workspace: WorkspacePage
}) {
  switch (workspace) {
    case 'nodes':
      return (
        <NodesPage
          commands={commands}
          nodes={data.nodes}
          onAddNode={() => onOpen('servers')}
          onDiagnostics={() => onOpen('agent-diagnostics')}
          onOpenLogs={() => onOpen('logs')}
          onReadiness={() => onOpen('provisioning')}
          overview={data.overview}
          toast={toast}
        />
      )
    case 'stacks':
      return <StacksPage nodes={data.nodes} onDeployFromSource={() => onOpen('source-deploy')} stacks={data.stacks} toast={toast} />
    case 'services':
      return (
        <ServicesPage
          onDiagnosisAction={(kind) => {
            // A diagnosis hands off to the screen that owns the action; it does
            // not perform it. Prune in particular is gated behind an explicit
            // confirmation, and a destructive command run from a panel that
            // just told you what was wrong would bypass exactly the
            // deliberation that gate exists to force.
            const destination: Partial<Record<string, WorkspacePage>> = {
              'edit-constraint': 'services',
              'label-node': 'nodes',
              logs: 'logs',
              prune: 'resources',
              reschedule: 'nodes',
            }
            const next = destination[kind]
            if (next) onOpen(next)
            else toast({ message: `No screen owns "${kind}" yet.`, tone: 'neutral' })
          }}
          onOpenLogs={() => onOpen('logs')}
          services={data.services}
          toast={toast}
        />
      )
    case 'databases':
      return <DatabasesPage toast={toast} />
    case 'applications':
      return <ApplicationsPage onDeployFromSource={() => onOpen('source-deploy')} onOpenRoutes={() => onOpen('routes')} toast={toast} />
    case 'builds':
      return <BuildsPage onDeployFromSource={() => onOpen('source-deploy')} toast={toast} />
    case 'gateway':
      return <TraefikControlPage initialTab="overview" status={data.traefik} toast={toast} />
    case 'routes':
      return <TraefikControlPage initialTab="routes" status={data.traefik} toast={toast} />
    case 'dns':
      return <TraefikControlPage initialTab="dns" status={data.traefik} toast={toast} />
    case 'tls':
      return <TraefikControlPage initialTab="certificates" status={data.traefik} toast={toast} />
    case 'observability':
      return (
        <ObservabilityPage
          nodes={data.nodes}
          onOpenGateway={() => onOpen('gateway')}
          onOpenSwarm={() => onOpen('nodes')}
          status={data.observability}
          toast={toast}
          traefik={data.traefik}
        />
      )
    case 'logs':
      return <LogsPage />
    case 'resources':
      return <ResourcesPage toast={toast} />
    case 'insights':
      return (
        <InsightsPage
          onOpenNodes={() => onOpen('nodes')}
          onOpenResources={() => onOpen('resources')}
          onOpenServices={() => onOpen('services')}
        />
      )
    default:
      // Every routable screen appears above. This branch is reachable only if a
      // page is added to navigation and not to the router, which the workflow
      // test catches before it can ship.
      return null
  }
}
