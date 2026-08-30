import { Banner } from '@nim.zone/ui'
import type { useToast } from '@nim.zone/ui'
import type { AuditEvent, Command, CoreTopology, Server } from '../data/types'
import type { DashboardData } from '../data/dashboard'
import { CLUSTER_PAGES, type WorkspacePage } from '../navigation/navigation'
import { WorkspaceLoading } from '../components/loading-screen'

import { CommandCenter } from '../screens/home/command-center'
import { DeployPage } from '../screens/apps/deploy'
import { ApplicationsPage } from '../screens/apps/applications'
import { ImagesPage } from '../screens/apps/images'
import { PlatformServicesPage } from '../screens/apps/platform'
import { WorkloadsPage } from '../screens/apps/workloads'
import { MachinesPage } from '../screens/machines/machines'
import { SwarmPage } from '../screens/machines/swarm'
import { ContainersPage } from '../screens/machines/containers'
import { StoragePage } from '../screens/machines/storage'
import { ClusterRequiredPage } from '../screens/machines/cluster-required'
import { TraefikControlPage } from '../screens/traffic/gateway'
import { LogsPage } from '../screens/activity/logs'
import { RunsPage } from '../screens/activity/runs'
import { CommandCataloguePage } from '../screens/activity/catalog'
import { AuditPage } from '../screens/activity/audit'
import { CoreTopologyPage } from '../screens/control/core'
import { AgentsPage } from '../screens/control/agents'

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
    case 'machines':
      return (
        <MachinesPage
          activeServerID={activeServer?.id ?? ''}
          onConnected={onConnected}
          onDiagnostics={(id) => { if (id) onSelectServer(id) }}
          onProvision={() => undefined}
          onRefresh={onRefreshServers}
          onSelect={onSelectServer}
          servers={servers}
          toast={toast}
        />
      )
    case 'core':
      return (
        <>
          {coreError ? <Banner title="Controller status unavailable" tone="danger">{coreError}</Banner> : null}
          <CoreTopologyPage servers={servers} toast={toast} />
        </>
      )
    case 'agents':
      return <AgentsPage onOpen={onOpen} onRefresh={onRefreshServers} servers={servers} toast={toast} />
    case 'audit':
      return (
        <>
          {auditError ? <Banner title="Audit trail unavailable" tone="danger">{auditError}</Banner> : null}
          {auditInitialLoading ? <WorkspaceLoading label="Reading the audit trail" /> : <AuditPage events={auditEvents} />}
        </>
      )
    case 'runs':
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
                onOpenDiagnostics={() => onOpen('machines')}
                onOpenGateway={() => onOpen('gateway')}
                onOpenSwarm={() => onOpen('swarm')}
                onRefresh={onRefreshCommands}
                servers={servers}
                toast={toast}
              />
            )}
        </>
      )
    case 'catalog':
      return (
        <CommandCataloguePage
          activeServerID={activeServer?.id ?? ''}
          onQueued={(commandID) => { onHighlightCommand(commandID); onOpen('runs') }}
          servers={servers}
          toast={toast}
        />
      )
    case 'deploy':
      // Every way of starting a deployment is one screen with one plan: a
      // repository, an archive, an image already pushed, or a set of
      // Kubernetes manifests. Importing from Kubernetes used to be its own
      // destination, which made it look like a different product rather than a
      // different way in.
      return (
        <DeployPage
          managerID={activeServer?.id ?? ''}
          managerName={activeServer?.name}
          toast={toast}
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
        onOpenProvisioning={() => onOpen('machines')}
        onOpenServers={() => onOpen('machines')}
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
    case 'swarm':
      return (
        <SwarmPage
          commands={commands}
          nodes={data.nodes}
          onAddNode={() => onOpen('machines')}
          onDiagnostics={() => onOpen('machines')}
          onOpenLogs={() => onOpen('logs')}
          onReadiness={() => onOpen('machines')}
          overview={data.overview}
          toast={toast}
        />
      )
    case 'workloads':
      return <WorkloadsPage data={data} onOpen={onOpen} toast={toast} />
    case 'platform':
      return (
        <PlatformServicesPage
          nodes={data.nodes}
          onOpen={onOpen}
          status={data.observability}
          toast={toast}
          traefik={data.traefik}
        />
      )
    case 'applications':
      return <ApplicationsPage onDeployFromSource={() => onOpen('deploy')} onOpenRoutes={() => onOpen('routes')} toast={toast} />
    case 'images':
      return <ImagesPage onDeployFromSource={() => onOpen('deploy')} toast={toast} />
    case 'gateway':
      return <TraefikControlPage initialTab="overview" status={data.traefik} toast={toast} />
    case 'routes':
      return <TraefikControlPage initialTab="routes" status={data.traefik} toast={toast} />
    case 'dns':
      return <TraefikControlPage initialTab="dns" status={data.traefik} toast={toast} />
    case 'tls':
      return <TraefikControlPage initialTab="certificates" status={data.traefik} toast={toast} />
    case 'logs':
      return <LogsPage />
    case 'containers':
      return <ContainersPage onOpen={onOpen} toast={toast} />
    case 'storage':
      return <StoragePage toast={toast} />
    default:
      // Every routable screen appears above. This branch is reachable only if a
      // page is added to navigation and not to the router, which the workflow
      // test catches before it can ship.
      return null
  }
}
