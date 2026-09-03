import { lazy, Suspense } from 'react'
import { Banner, Button, EmptyState } from '@nim.zone/ui'
import type { useToast } from '@nim.zone/ui'
import type { AuditEvent, Command, CoreTopology, Server } from '../data/types'
import type { DashboardData } from '../data/dashboard'
import { CLUSTER_PAGES, type WorkspacePage } from '../navigation/navigation'
import { WorkspaceLoading } from '../components/loading-screen'

const CommandCenter = lazy(() => import('../screens/home/command-center').then(module => ({ default: module.CommandCenter })))
const DeployPage = lazy(() => import('../screens/apps/deploy').then(module => ({ default: module.DeployPage })))
const ApplicationsPage = lazy(() => import('../screens/apps/applications').then(module => ({ default: module.ApplicationsPage })))
const ImagesPage = lazy(() => import('../screens/apps/images').then(module => ({ default: module.ImagesPage })))
const PlatformServicesPage = lazy(() => import('../screens/apps/platform').then(module => ({ default: module.PlatformServicesPage })))
const WorkloadsPage = lazy(() => import('../screens/apps/workloads').then(module => ({ default: module.WorkloadsPage })))
const MachinesPage = lazy(() => import('../screens/machines/machines').then(module => ({ default: module.MachinesPage })))
const MachineDetailView = lazy(() => import('../screens/machines/machine-detail').then(module => ({ default: module.MachineDetailView })))
const SwarmPage = lazy(() => import('../screens/machines/swarm').then(module => ({ default: module.SwarmPage })))
const ContainersPage = lazy(() => import('../screens/machines/containers').then(module => ({ default: module.ContainersPage })))
const StoragePage = lazy(() => import('../screens/machines/storage').then(module => ({ default: module.StoragePage })))
const ClusterRequiredPage = lazy(() => import('../screens/machines/cluster-required').then(module => ({ default: module.ClusterRequiredPage })))
const TraefikControlPage = lazy(() => import('../screens/traffic/gateway').then(module => ({ default: module.TraefikControlPage })))
const LogsPage = lazy(() => import('../screens/activity/logs').then(module => ({ default: module.LogsPage })))
const RunsPage = lazy(() => import('../screens/activity/runs').then(module => ({ default: module.RunsPage })))
const CommandCataloguePage = lazy(() => import('../screens/activity/catalog').then(module => ({ default: module.CommandCataloguePage })))
const AuditPage = lazy(() => import('../screens/activity/audit').then(module => ({ default: module.AuditPage })))
const CoreTopologyPage = lazy(() => import('../screens/control/core').then(module => ({ default: module.CoreTopologyPage })))
const AgentsPage = lazy(() => import('../screens/control/agents').then(module => ({ default: module.AgentsPage })))
const RegistryMirrorPage = lazy(() => import('../screens/control/registry-mirror').then(module => ({ default: module.RegistryMirrorPage })))

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
  onConnected: (server: Server) => Promise<void>
  onHighlightCommand: (id: string) => void
  onOpen: (page: WorkspacePage) => void
  onRefreshCommands: () => Promise<void>
  onRefreshServers: () => Promise<void>
  onSelectMachine: (id: string) => void
  onSelectServer: (id: string) => void
  selectedMachineID: string
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
  return <Suspense fallback={<WorkspaceLoading label="Opening workspace" />}><PageRouterContent {...props} /></Suspense>
}

function PageRouterContent(props: PageRouterProps) {
  const {
    activeServer, auditError, auditEvents, auditInitialLoading, clusterError, commands, commandsError,
    commandsInitialLoading, core, coreError, data, onConnected, onHighlightCommand,
    onOpen, onRefreshCommands, onRefreshServers, onSelectMachine, onSelectServer, selectedMachineID, servers,
    serversLoading, toast, workspace,
  } = props

  // Screens that never need a cluster. These are exactly what an operator needs
  // when nothing is connected, so none of them may be gated behind a selection.
  switch (workspace) {
    case 'machines': {
      // A machine in the hash opens that machine. Everything about a host —
      // its charts, its containers, its setup and its agent — is on its own
      // page, so the list's job is to get you there.
      const machine = servers.find((server) => server.id === selectedMachineID)
      if (selectedMachineID && serversLoading && !servers.length) return <WorkspaceLoading label="Reading machine profiles" />
      if (machine) {
        return (
          <MachineDetailView
            key={machine.id}
            onBack={() => onSelectMachine('')}
            onOpen={onOpen}
            onRefreshServers={onRefreshServers}
            server={machine}
            servers={servers}
            toast={toast}
          />
        )
      }
      if (selectedMachineID) return <EmptyState title="Machine not found" description="This machine is not present in the current server profiles." actions={<Button onClick={() => onSelectMachine('')}>Back to machines</Button>} />
      return (
        <MachinesPage
          activeServerID={activeServer?.id ?? ''}
          onConnected={onConnected}
          onOpenMachine={onSelectMachine}
          onRefresh={onRefreshServers}
          onSelect={onSelectServer}
          servers={servers}
          toast={toast}
        />
      )
    }
    case 'core':
      return (
        <>
          {coreError ? <Banner title="Controller status unavailable" tone="danger">{coreError}</Banner> : null}
          <CoreTopologyPage servers={servers} toast={toast} />
        </>
      )
    case 'agents':
      return <AgentsPage onOpen={onOpen} onRefresh={onRefreshServers} servers={servers} toast={toast} />
    // Where every host pulls PUBLIC images from is a fleet fact that belongs to
    // no cluster selection and no application, so it answers before the cluster
    // gate below rather than behind it.
    case 'registry-mirror':
      return <RegistryMirrorPage toast={toast} />
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
                onOpenDeploy={() => onOpen('deploy')}
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
          onQueued={onHighlightCommand}
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
          onOpenImages={() => onOpen('images')}
          onOpenPlatform={() => onOpen('platform-definition')}
          onOpenWorkloads={() => onOpen('workloads')}
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
      <ClusterScreen commands={commands} data={data} onOpen={onOpen} serverID={activeServer?.id ?? ''} toast={toast} workspace={workspace} />
    </>
  )
}

function ClusterScreen({ commands, data, onOpen, serverID, toast, workspace }: {
  commands: Command[]
  data: DashboardData
  serverID: string
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
          observability={data.observability}
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
    case 'platform-definition':
      return (
        <PlatformServicesPage
          initialTab={workspace === 'platform-definition' ? 'admission' : 'data'}
          nodes={data.nodes}
          onOpen={onOpen}
          status={data.observability}
          toast={toast}
          traefik={data.traefik}
        />
      )
    case 'applications':
      return <ApplicationsPage commands={commands.filter(command => command.serverId === serverID)} onDeployFromSource={() => onOpen('deploy')} onOpenPlatform={() => onOpen('platform-definition')} onOpenRoutes={() => onOpen('routes')} toast={toast} />
    case 'images':
      return <ImagesPage onDeployFromSource={() => onOpen('deploy')} toast={toast} />
    case 'gateway':
      return <TraefikControlPage initialTab="overview" status={data.traefik} toast={toast} />
    case 'gateway-settings':
      return <TraefikControlPage initialTab="settings" status={data.traefik} toast={toast} />
    case 'routes':
      return <TraefikControlPage initialTab="routes" status={data.traefik} toast={toast} />
    case 'dns':
      return <TraefikControlPage initialTab="dns" status={data.traefik} toast={toast} />
    case 'tls':
      return <TraefikControlPage initialTab="certificates" status={data.traefik} toast={toast} />
    case 'logs':
      return <LogsPage observability={data.observability} toast={toast} />
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
