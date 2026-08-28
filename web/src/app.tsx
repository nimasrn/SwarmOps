import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  ActivityFeed,
  AdminShell,
  AuthScreen,
  Badge,
  Banner,
  Button,
  CodeBlock,
  CommandPalette,
  Columns,
  Breadcrumb,
  DataTable,
  DetailHeader,
  DetailLayout,
  EmptyState,
  Facts,
  Icon,
  IconButton,
  Inline,
  Input,
  Label,
  List,
  ListRow,
  Menu,
  Metric,
  MetricGrid,
  Mono,
  Page,
  Panel,
  RecordLink,
  Segmented,
  Select,
  Spinner,
  StatusDot,
  Stack as Rows,
  Switch,
  Table,
  Tabs,
  TaskProgress,
  Textarea,
  Toolbar,
  Body,
  useToast,
} from '@nim.zone/ui'
import type { BadgeVariant, TableColumn } from '@nim.zone/ui'
import { ServiceDiagnosis, useServiceDiagnosis } from './service-diagnosis'
import { APIError, api } from './api'
import { OverviewDashboard } from './dashboard'
import { Brand, SwarmOpsMark } from './brand'
import { KubernetesImportPage } from './kubernetes-import'
import { SourceDeployPage } from './source-deploy'
import { ServerReadinessPage } from './server-readiness'
import { AgentDiagnosticsPage } from './agent-diagnostics'
import { CoreTopologyPage } from './core-topology'
import { TraefikControlPage } from './traefik-page'
import { CommandCataloguePage, InsightsPage, ResourcesPage } from './inventory'
import { HomePage } from './home'
import { LogsPage } from './logs-page'
import { isNativeAgent, serverConnectionLabel, serverEndpointLabel } from './server-connection'
import {
  AREAS,
  CLUSTER_PAGES,
  LEGACY_ROUTES,
  areaOf,
  isWorkspacePage,
  landingPage,
  pageEntry,
} from './navigation'
import type { WorkspacePage } from './navigation'
import { paletteCommands } from './palette'
import type {
	AgentEnrollmentToken,
  AuditEvent,
  Command,
  ContainerDetail,
  ContainerStats,
  ContainerSummary,
  ApplicationSpec,
  ApplicationStatus,
  ApprovedWorkload,
  ComposePlan,
	CoreTopology,
  DatabaseStatus,
  Health,
  Node,
  ObservabilityStatus,
  Overview,
  Service,
  Server,
  ServerCredentials,
  ServerInput,
  Session,
  Stack,
  Task,
  TraefikStatus,
} from './types'

type ClusterPage = Extract<WorkspacePage, 'applications' | 'builds' | 'databases' | 'dns' | 'gateway' | 'insights' | 'logs' | 'nodes' | 'observability' | 'overview' | 'resources' | 'routes' | 'services' | 'stacks' | 'tls'>

interface DashboardData {
  nodes: Node[]
  observability: ObservabilityStatus
  overview: Overview
  services: Service[]
  stacks: Stack[]
  traefik: TraefikStatus
}

interface ConnectionError {
  detail?: string
  message: string
  requestID?: string
}

const AGENT_INSTALL_URL = 'https://github.com/nimasrn/SwarmOps/releases/latest/download/install-swarmops-agent.sh'
const SELECTED_SERVER_KEY = 'swarmops:selected-server'
const openLogsWorkspace = () => window.dispatchEvent(new Event('swarmops:open-logs'))

export function App() {
  return <SessionGate />
}

function SessionGate() {
  const [session, setSession] = useState<Session | null>(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    void api.me().then(setSession).catch(() => setSession(null)).finally(() => setChecking(false))
  }, [])

  if (checking) {
    return <LoadingScreen label="Checking the operator session" />
  }
  if (!session) {
    return <LoginScreen onLogin={setSession} />
  }
  return <Console session={session} onLogout={() => setSession(null)} />
}

function LoadingScreen({ label }: { label: string }) {
  return (
    <main className="swarmops-loading" aria-live="polite">
      <SwarmOpsMark size={52} />
      <Spinner label={label} size="lg" />
      <p>{label}</p>
    </main>
  )
}

function LoginScreen({ onLogin }: { onLogin: (session: Session) => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [showAgentSetup, setShowAgentSetup] = useState(false)

  const submit = async (event?: FormEvent) => {
    event?.preventDefault()
    setError('')
    setPending(true)
    try {
      onLogin(await api.login(username, password))
    } catch (reason) {
      setError(messageOf(reason))
    } finally {
      setPending(false)
    }
  }

  if (showAgentSetup) {
    return <AgentSetupScreen onBack={() => setShowAgentSetup(false)} />
  }

  return (
    <main className="swarmops-auth-page">
      <form onSubmit={submit}>
        <AuthScreen
          action={{ disabled: !username || !password, label: 'Sign in to SwarmOps', loading: pending, onClick: submit }}
          brand={<Brand size="lg" />}
          footer={
            <Rows gap="tight">
              <span>Use the configured operator account.</span>
              <Button onClick={() => setShowAgentSetup(true)} size="sm" type="button" variant="ghost">Install and connect a server</Button>
            </Rows>
          }
          subtitle="Audited operations for remote Docker Swarm servers."
          title="Remote operations, with a boundary."
        >
          <Input
            autoComplete="username"
            iconStart="user"
            label="Username"
            onChange={(event) => setUsername(event.target.value)}
            required
            value={username}
          />
          <Input
            autoComplete="current-password"
            error={error}
            label="Password"
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
        </AuthScreen>
      </form>
    </main>
  )
}

function AgentSetupScreen({ onBack }: { onBack: () => void }) {
	const [coreFingerprint, setCoreFingerprint] = useState('')
	const [identityError, setIdentityError] = useState('')
	useEffect(() => {
		void api.agentIdentity().then((identity) => {
			setCoreFingerprint(identity.coreFingerprint ?? '')
			setIdentityError(identity.coreFingerprint ? '' : 'The controller did not publish its TLS fingerprint.')
		}).catch((reason) => setIdentityError(messageOf(reason)))
	}, [])
	const command = coreFingerprint
		? `curl --fail --show-error --location '${AGENT_INSTALL_URL}' | sudo bash -s -- --core '${window.location.origin}' --core-fingerprint '${coreFingerprint}'`
		: 'Reading the pinned controller identity…'
  return (
    <main className="swarmops-auth-page">
      <AuthScreen
        action={{ label: 'I have the code — sign in to approve it', onClick: onBack }}
        back={{ label: 'Back to sign in', onClick: onBack }}
        brand={<Brand size="lg" />}
        subtitle="Run one command on Ubuntu, then sign in and approve the short-lived code it prints."
        title="Connect your first server"
      >
		<Rows gap="tight">
		  {identityError ? <Banner title="Pinned controller identity unavailable" tone="danger">{identityError}</Banner> : null}
		  <CodeBlock label="Ubuntu 22.04 or 24.04" wrap>{command}</CodeBlock>
		  <Body size="sm">The agent creates its private key locally and waits for approval. It then receives a renewable client certificate and connects to the controller with outbound HTTPS long polls. No inbound agent port, SSH access, Docker socket proxy, or long-lived printed key is required.</Body>
		  <TaskProgress steps={[{ id: 'install', label: 'Run the command on the host', status: 'active' }, { id: 'approve', label: 'Sign in and approve its code in Fleet → Servers', status: 'pending' }, { id: 'connect', label: 'Watch compatibility and host health appear', status: 'pending' }]} title="Install-first enrollment" />
		</Rows>
      </AuthScreen>
    </main>
  )
}

function OutboundEnrollmentGuide({ toast }: { toast: ReturnType<typeof useToast> }) {
	const [name, setName] = useState('')
	const [token, setToken] = useState<AgentEnrollmentToken | null>(null)
	const [pending, setPending] = useState(false)
	const secureOrigin = window.location.protocol === 'https:'
	const create = async () => {
		setPending(true)
		try {
			setToken(await api.createAgentEnrollment(name.trim()))
		} catch (reason) {
			toast({ message: messageOf(reason), tone: 'danger', duration: 0 })
		} finally {
			setPending(false)
		}
	}
	const command = token
		? `bash -o pipefail -c "curl --fail --show-error --location '${AGENT_INSTALL_URL}' | sudo bash -s -- --core '${window.location.origin}'${token.coreFingerprint ? ` --core-fingerprint '${token.coreFingerprint}'` : ''} --enrollment-code '${token.code}' --defer-docker"`
		: ''
	return (
		<Panel eyebrow="Recommended · outbound HTTPS" title="Install and enroll with one command">
			<Rows>
				<Body size="sm">The controller creates a short-lived, one-time certificate grant. The Ubuntu agent generates its private key locally, pins this controller, installs as a systemd service, and reconnects through outbound long polls. No inbound agent port or SSH access is required.</Body>
				{!secureOrigin ? <Banner title="HTTPS is required" tone="warning">Open the production HTTPS controller URL to generate an install command. Loopback HTTP remains available only for local development.</Banner> : null}
				<Input hint="Optional. The host name is used when this is empty." label="Agent name" onChange={(event) => setName(event.target.value)} value={name} />
				<Button disabled={!secureOrigin || pending} loading={pending} onClick={() => void create()} variant="accent">Generate one-time install command</Button>
				{token ? <><CodeBlock label="Run once on Ubuntu 22.04 or 24.04" wrap>{command}</CodeBlock><Body size="sm">Expires {formatDateTime(token.expiresAt)}. Generate another command if it expires; this code cannot be reused after enrollment.</Body></> : null}
			</Rows>
		</Panel>
	)
}

function StandaloneClaimGuide({ onApproved, toast }: { onApproved: () => Promise<void>; toast: ReturnType<typeof useToast> }) {
	const [code, setCode] = useState('')
	const [coreFingerprint, setCoreFingerprint] = useState('')
	const [pending, setPending] = useState(false)
	useEffect(() => {
		void api.agentIdentity().then((identity) => setCoreFingerprint(identity.coreFingerprint ?? '')).catch(() => setCoreFingerprint(''))
	}, [])
	const approve = async (event: FormEvent) => {
		event.preventDefault()
		setPending(true)
		try {
			const approval = await api.approveAgentClaim(code.trim())
			setCode('')
			await onApproved()
			toast({ message: `${approval.name} approved; the agent is receiving its certificate`, tone: 'success' })
		} catch (reason) {
			toast({ message: messageOf(reason), tone: 'danger', duration: 0 })
		} finally {
			setPending(false)
		}
	}
	return (
		<Panel eyebrow="Standalone · install first" title="Enter the code printed by the agent">
			<Rows as="form" onSubmit={approve}>
				<Body size="sm">Run the installer with the controller certificate pin. The agent keeps its private key and redemption secret, prints a short-lived code, and waits. Approving the code issues the same renewable client certificate as the dashboard-generated flow.</Body>
				<CodeBlock label="Install first on Ubuntu 22.04 or 24.04" wrap>{coreFingerprint ? `curl --fail --show-error --location '${AGENT_INSTALL_URL}' | sudo bash -s -- --core '${window.location.origin}' --core-fingerprint '${coreFingerprint}'` : 'Reading the pinned controller identity…'}</CodeBlock>
				<Input autoComplete="off" hint="Four groups of four characters; expires after 15 minutes." label="Agent enrollment code" onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="ABCD-EFGH-JKLM-NPQR" required value={code} />
				<Button disabled={pending || code.replaceAll('-', '').length !== 16} loading={pending} type="submit" variant="accent">Approve and enroll agent</Button>
			</Rows>
		</Panel>
	)
}

function Console({ onLogout, session }: { onLogout: () => void; session: Session }) {
  const [workspace, setWorkspace] = useHashWorkspace()
  const toast = useToast()
  const { error: serversError, loading: serversLoading, refresh: refreshServers, servers } = useServers(onLogout)
	const { error: auditError, events: auditEvents, initialLoading: auditInitialLoading, refreshing: auditRefreshing, refresh: refreshAudit } = useAuditEvents(workspace === 'audit', onLogout)
	const { commands, error: commandsError, initialLoading: commandsInitialLoading, refreshing: commandsRefreshing, refresh: refreshCommands } = useCommands(workspace === 'commands' || workspace === 'catalogue' || workspace === 'overview', onLogout)
	const { core, error: coreError, refresh: refreshCore } = useCoreTopology(onLogout)
  const [highlightedCommandID, setHighlightedCommandID] = useState('')
  const [activeServerID, setActiveServerID] = useState(() => window.sessionStorage.getItem(SELECTED_SERVER_KEY) ?? '')
	// Selection is operator intent, not a health result. Keep the explicit target
	// while its agent reconnects so a transient poll cannot throw the operator
	// back to the first-run screen or silently select a different cluster.
  const activeServer = servers.find((server) => server.id === activeServerID)
	const managers = servers.filter((server) => serverCanManage(server) || server.id === activeServerID)
  const { data, error, refresh, refreshing } = useDashboard(activeServer?.id ?? '', onLogout)

	const selectServer = useCallback((id: string) => {
		api.selectServer(id)
		setActiveServerID(id)
		if (id) window.sessionStorage.setItem(SELECTED_SERVER_KEY, id)
		else window.sessionStorage.removeItem(SELECTED_SERVER_KEY)
	}, [])

  useEffect(() => {
    const openLogs = () => setWorkspace('logs')
    window.addEventListener('swarmops:open-logs', openLogs)
    return () => window.removeEventListener('swarmops:open-logs', openLogs)
  }, [setWorkspace])

  useEffect(() => {
    if (serversLoading) return
    const next = servers.some((server) => server.id === activeServerID)
      ? activeServerID
	  : servers.find(serverCanManage)?.id ?? ''
    selectServer(next)
	}, [activeServerID, selectServer, servers, serversLoading])

  const connected = async (server: Server) => {
    await refreshServers()
    if (server.swarmControlAvailable) {
		selectServer(server.id)
      setWorkspace('overview')
      toast({ message: `${server.name} connected`, tone: 'success' })
      return
    }
		setWorkspace('provisioning')
    toast({ message: server.dockerAvailable ? `${server.name} is connected. Complete server readiness before using cluster operations.` : `${server.name} is connected through its machine API. Choose its readiness plan next.`, tone: 'accent' })
  }

  const signOut = async () => {
    try {
      await api.logout()
    } catch {
      // Removing the local session is safer than leaving a failed sign-out
      // screen usable; the server-side cookie expires independently.
    }
		selectServer('')
    onLogout()
  }

  const area = areaOf(workspace)
  const page = pageEntry(workspace)
  const [paletteOpen, setPaletteOpen] = useState(false)

  // The rail is the operator's JOB — deliver, fleet, workloads, traffic,
  // observe, activity, control — and every area opens on the screen that
  // answers its first question. Building both tiers from one source is why
  // `agent-diagnostics` is now reachable: a screen that exists but appears in
  // no group is a screen only its own author can find.
  const areaGroups = useMemo(() => [{
    key: 'areas',
    label: '',
    items: AREAS.map((entry) => ({
      icon: entry.icon,
      key: entry.key,
      label: entry.label,
      onSelect: () => setWorkspace(landingPage(entry)),
    })),
  }], [setWorkspace])

  const contextualGroups = useMemo(() => [{
    key: area.key,
    label: '',
    items: area.pages.map((entry) => ({
      icon: entry.icon,
      key: entry.key,
      label: entry.label,
      onSelect: () => setWorkspace(entry.key),
    })),
  }], [area, setWorkspace])

	const refreshAction = workspace === 'audit'
    ? refreshAudit
		: workspace === 'commands'
      ? refreshCommands
		: workspace === 'core'
			? refreshCore
		: workspace === 'servers' || workspace === 'agent-diagnostics' || !activeServer
        ? refreshServers
        : refresh
	const refreshLoading = workspace === 'audit'
    ? auditInitialLoading || auditRefreshing
		: workspace === 'commands'
      ? commandsInitialLoading || commandsRefreshing
		: workspace === 'servers' || workspace === 'agent-diagnostics' || !activeServer
        ? serversLoading
        : refreshing
	const refreshLabel = workspace === 'audit'
    ? 'Refresh audit trail'
		: workspace === 'commands'
      ? 'Refresh command queue'
		: workspace === 'servers' || workspace === 'agent-diagnostics'
        ? 'Refresh servers'
        : activeServer
          ? 'Refresh cluster snapshot'
          : 'Refresh server profiles'

  // ⌘K belongs to the app, not to the kit: which chord a product spends is a
  // product decision, and a component that bound a global key would collide
  // with every other consumer on the page.
  useEffect(() => {
    const hotkey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPaletteOpen(true)
      }
    }
    window.addEventListener('keydown', hotkey)
    return () => window.removeEventListener('keydown', hotkey)
  }, [])

  const commands_ = useMemo(() => paletteCommands({
    managers,
    onRefresh: () => void refreshAction(),
    onSelectServer: selectServer,
    onSignOut: () => void signOut(),
    open: setWorkspace,
    refreshLabel,
    selectedServerID: activeServerID,
  }), [activeServerID, managers, refreshAction, refreshLabel, selectServer, setWorkspace])

  const agentTone = activeServer?.connectionState === 'connected' ? 'success' : activeServer ? 'warning' : 'neutral'
  const agentLabel = activeServer?.connectionState === 'connected' ? 'Agent connected' : activeServer ? 'Agent reconnecting' : 'No target selected'

  return (
    <AdminShell
      brand={<Brand subtitle="" />}
      contextualFooter={
        <>
          {/* Observed scope only: what this console currently has authority
              over and how fresh the last read of it is. An assurance claim
              would be an unverified one, and this is the chrome an operator
              looks at when deciding whether to believe the screen. */}
          <StatusDot tone={!core ? 'neutral' : core.controlEnabled ? 'success' : 'warning'}>
            {!core ? 'Controller checking' : core.controlEnabled ? 'Controller holds authority' : 'Controller on standby'}
          </StatusDot>
          <span>
            {activeServer
              ? data
                ? `Snapshot of ${activeServer.name} read at ${formatClock(data.overview.generatedAt)}.`
                : `${activeServer.name} selected; no cluster snapshot has been read yet.`
              : 'No cluster is selected, so nothing on this screen is a claim about production.'}
          </span>
        </>
      }
      contextualGroups={contextualGroups}
      contextualHeader={
        <>
          <Label>{area.label}</Label>
          <strong>{page.label}</strong>
          <span>{area.summary}</span>
        </>
      }
      contextualValue={workspace}
      groups={areaGroups}
      navigation="rail"
      title={
        // The target and the evidence that it is reachable belong in the same
        // control. Before this the selector sat in the masthead and its
        // connection state sat in the sidebar footer, which asked the operator
        // to look in two places to answer one question.
        <Inline gap="tight" wrap={false}>
          <Label>Cluster</Label>
          {managers.length ? (
            <>
              <Select
                aria-label="Selected Docker Swarm cluster manager"
                onChange={(event) => event.target.value ? selectServer(event.target.value) : setWorkspace('servers')}
                options={managers.map((server) => ({ label: server.name, value: server.id }))}
                placeholder="Select a cluster"
                value={activeServerID}
              />
              <StatusDot pulse={agentTone === 'warning'} tone={agentTone}>{agentLabel}</StatusDot>
            </>
          ) : (
            <Button iconStart="plus" onClick={() => setWorkspace('servers')} size="sm" variant="secondary">Connect a server</Button>
          )}
        </Inline>
      }
      titleRole="scope"
      toolbar={
        <>
          <Button iconStart="search" onClick={() => setPaletteOpen(true)} size="sm" variant="secondary">
            Search or run…  ⌘K
          </Button>
          <IconButton disabled={refreshLoading} label={refreshLabel} name="refresh" onClick={() => void refreshAction()} size="sm" variant="ghost" />
          <Menu
            items={[
              { kind: 'heading', label: session.user.username },
              { icon: 'settings', label: 'Controller & recovery', onSelect: () => setWorkspace('core') },
              { icon: 'shield', label: 'Audit trail', onSelect: () => setWorkspace('audit') },
              { icon: 'link', label: 'Connection diagnostics', onSelect: () => setWorkspace('agent-diagnostics') },
              { kind: 'separator' },
              { icon: 'sign-out', label: 'Sign out', onSelect: () => void signOut() },
            ]}
            label={`Operator ${session.user.username}`}
          >
            {({ ref, toggle }) => (
              <IconButton label={`Operator ${session.user.username}`} name="user" onClick={toggle} ref={ref} size="sm" variant="ghost" />
            )}
          </Menu>
        </>
      }
      value={area.key}
    >
      <CommandPalette
        commands={commands_}
        emptyLabel={(query) => `No screen or action matches “${query}”.`}
        label="Search screens or run an action"
        onClose={() => setPaletteOpen(false)}
        open={paletteOpen}
        placeholder="Search screens or run an action…"
      />
      {/* Two tiers of navigation still leave "where am I" unanswered on a
          console with twenty-four screens; the crumb answers it in one line
          and gives the area back as a target. */}
      {workspace === 'overview' ? null : (
        <Breadcrumb
          items={[
            { href: `#${landingPage(area)}`, label: area.label },
            { label: page.label },
          ]}
        />
      )}
      {serversError ? <Banner title="Server list unavailable" tone="danger">{serversError}</Banner> : null}
	  {workspace === 'servers' ? (
		<ServersPage activeServerID={activeServerID} onConnected={connected} onDiagnostics={(id) => { selectServer(id); setWorkspace('agent-diagnostics') }} onProvision={() => setWorkspace('provisioning')} onRefresh={refreshServers} onSelect={selectServer} servers={servers} toast={toast} />
	  ) : workspace === 'agent-diagnostics' ? (
		<AgentDiagnosticsPage onRefreshServers={refreshServers} servers={servers} toast={toast} />
	  ) : workspace === 'core' ? (
		<>{coreError ? <Banner title="Controller status unavailable" tone="danger">{coreError}</Banner> : null}<CoreTopologyPage servers={servers} toast={toast} /></>
	  ) : workspace === 'provisioning' ? (
		<ServerReadinessPage servers={servers} toast={toast} />
	  ) : workspace === 'audit' ? (
        <>
          {auditError ? <Banner title="Audit trail unavailable" tone="danger">{auditError}</Banner> : null}
          {auditInitialLoading ? <LoadingScreen label="Reading the audit trail" /> : <AuditPage events={auditEvents} />}
        </>
	  ) : workspace === 'commands' ? (
        <>
          {commandsError ? <Banner title="Runs unavailable" tone="danger">{commandsError}</Banner> : null}
          {commandsInitialLoading ? <LoadingScreen label="Reading durable commands" /> : <CommandQueuePage commands={commands} dashboard={data} highlightedID={highlightedCommandID} onOpenDiagnostics={() => setWorkspace('agent-diagnostics')} onOpenGateway={() => setWorkspace('gateway')} onOpenSwarm={() => setWorkspace('nodes')} onRefresh={refreshCommands} servers={servers} toast={toast} />}
        </>
	  ) : workspace === 'catalogue' ? (
        <CommandCataloguePage activeServerID={activeServerID} onQueued={(commandID) => { setHighlightedCommandID(commandID); setWorkspace('commands') }} servers={servers} toast={toast} />
	  ) : workspace === 'kubernetes-import' ? (
		<KubernetesImportPage />
	  ) : workspace === 'source-deploy' || workspace === 'registry' ? (
		<SourceDeployPage managerID={activeServer?.id ?? ''} managerName={activeServer?.name} toast={toast} view={workspace === 'registry' ? 'registry' : 'source'} />
	  ) : workspace === 'overview' && core ? (
		<HomePage
		  cluster={activeServer && data ? data : undefined}
		  commands={commands}
		  core={core}
		  onAddNode={() => setWorkspace('servers')}
		  onDiagnose={() => setWorkspace('agent-diagnostics')}
		  onDeploy={() => setWorkspace('source-deploy')}
		  onOpenApplications={() => setWorkspace('applications')}
		  onOpenInfrastructure={() => setWorkspace('nodes')}
		  onOpenOperations={() => setWorkspace('commands')}
		  onOpenTraffic={() => setWorkspace('gateway')}
		  servers={servers}
		/>
	  ) : CLUSTER_PAGES.has(workspace) && !activeServer ? (
        <ServerRequiredPage
		  page={workspace as ClusterPage}
          servers={servers}
		  onOpenProvisioning={() => setWorkspace('provisioning')}
		  onOpenServers={() => setWorkspace('servers')}
        />
      ) : (
        <>
          {error ? <Banner title="Cluster snapshot unavailable" tone="danger">{error}</Banner> : null}
		  {!data ? <LoadingScreen label={serversLoading ? 'Reading server profiles' : 'Reading the selected Docker Swarm'} /> : <PageRouter
			commands={commands}
			data={data}
			onAddNode={() => setWorkspace('servers')}
			onDiagnostics={() => setWorkspace('agent-diagnostics')}
			onReadiness={() => setWorkspace('provisioning')}
			page={workspace as ClusterPage}
			toast={toast}
		  />}
        </>
      )}
    </AdminShell>
  )
}

function PageRouter({
  commands,
  data,
  onAddNode,
  onDiagnostics,
  onReadiness,
  page,
  toast,
}: {
  commands: Command[]
  data: DashboardData
  onAddNode: () => void
  onDiagnostics: () => void
  onReadiness: () => void
  page: ClusterPage
  toast: ReturnType<typeof useToast>
}) {
  switch (page) {
    case 'nodes': return <NodesPage commands={commands} nodes={data.nodes} onAddNode={onAddNode} onDiagnostics={onDiagnostics} onReadiness={onReadiness} overview={data.overview} toast={toast} />
    case 'stacks': return <StacksPage nodes={data.nodes} stacks={data.stacks} toast={toast} />
    case 'services': return <ServicesPage services={data.services} toast={toast} />
    case 'builds': return <BuildsPage toast={toast} />
    case 'gateway': return <TraefikControlPage initialTab="overview" status={data.traefik} toast={toast} />
    case 'routes': return <TraefikControlPage initialTab="routes" status={data.traefik} toast={toast} />
    case 'dns': return <TraefikControlPage initialTab="dns" status={data.traefik} toast={toast} />
    case 'tls': return <TraefikControlPage initialTab="certificates" status={data.traefik} toast={toast} />
    case 'observability': return <ObservabilityPage nodes={data.nodes} onOpenGateway={() => window.location.hash = 'gateway'} onOpenSwarm={() => window.location.hash = 'nodes'} status={data.observability} toast={toast} traefik={data.traefik} />
    case 'logs': return <LogsPage />
    case 'databases': return <DatabasesPage toast={toast} />
    case 'applications': return <ApplicationsPage toast={toast} />
    case 'resources': return <ResourcesPage toast={toast} />
    case 'insights': return <InsightsPage toast={toast} />
    case 'overview': return <OverviewDashboard observability={data.observability} overview={data.overview} stacks={data.stacks} traefik={data.traefik} />
  }
}

function ServerRequiredPage({
  onOpenProvisioning,
  onOpenServers,
  page,
  servers,
}: {
  onOpenProvisioning: () => void
  onOpenServers: () => void
  page: ClusterPage
  servers: Server[]
}) {
  const entry = pageEntry(page)
  const connected = servers.filter((server) => server.connectionState === 'connected' && serverHealth(server) !== 'unhealthy')
  const managers = servers.filter(serverCanManage)

  // Three genuinely different situations were previously one screen showing
  // the same three counters. What the operator has to DO differs in each, so
  // the heading, the button, and the reason differ with it.
  const stage = managers.length ? 'select' : connected.length ? 'prepare' : servers.length ? 'reconnect' : 'install'
  const copy = {
    install: {
      action: 'Connect your first server',
      reason: 'SwarmOps has no enrolled host yet. Enrollment is one outbound command on Ubuntu — the agent generates its own key, pins this controller, and waits for you to approve its code. No inbound port and no SSH access is opened.',
      title: 'No server is connected yet',
    },
    reconnect: {
      action: 'Review server connections',
      reason: `${servers.length === 1 ? 'The enrolled host is' : 'None of the enrolled hosts are'} currently answering the controller. Until an agent reconnects there is no evidence to read, and a screen drawn from stale evidence would be a claim SwarmOps cannot support.`,
      title: 'No agent is answering',
    },
    prepare: {
      action: 'Open host setup',
      reason: 'A host is connected but is not a Docker Swarm manager, so there is no cluster to read. Host setup installs Docker, initialises Swarm, and settles the firewall through reviewed, audited fixes.',
      title: 'The connected host is not a Swarm manager',
    },
    select: {
      action: 'Choose a cluster',
      reason: 'A Swarm manager is ready but this console is not pointed at one. Selection is deliberate: every read and every change stays scoped to one explicit target rather than fanning out across the fleet.',
      title: 'Choose which cluster to operate',
    },
  }[stage]

  return (
    <Page>
      <DetailHeader
        meta={<StatusDot tone={stage === 'select' ? 'accent' : 'warning'}>{entry.label} needs a selected cluster</StatusDot>}
        subtitle={copy.reason}
        title={copy.title}
      />

      <Columns align="start" template="two-thirds">
        <Panel
          actions={
            <Inline>
              <Button iconStart={stage === 'prepare' ? 'check-circle' : stage === 'install' ? 'plus' : 'server'} onClick={stage === 'prepare' ? onOpenProvisioning : onOpenServers} variant="accent">
                {copy.action}
              </Button>
            </Inline>
          }
          description={`Each step is reversible and leaves an audit record. ${entry.label} resumes by itself the moment the last one is done.`}
          title="What it takes to reach this screen"
        >
          <TaskProgress
            steps={[
              { id: 'enroll', label: 'Enroll a host and let its agent connect', status: servers.length ? (connected.length ? 'done' : 'active') : 'active' },
              { id: 'prepare', label: 'Make the host a Docker Swarm manager', status: managers.length ? 'done' : connected.length ? 'active' : 'pending' },
              { id: 'select', label: `Select that cluster and open ${entry.label}`, status: managers.length ? 'active' : 'pending' },
            ]}
            title="Three steps, in order"
          />
        </Panel>

        <Panel description="Nothing here depends on a selected cluster, so setup is never a dead end." title="Open while you wait">
          <List plain>
            <ListRow href="#servers" leading={<Icon name="server" size="sm" />} subtitle="Enroll a host, approve its code, or read why one dropped." title="Servers" />
            <ListRow href="#agent-diagnostics" leading={<Icon name="link" size="sm" />} subtitle="See which layer — agent, Docker, or Swarm — stopped answering." title="Connection diagnostics" />
            <ListRow href="#commands" leading={<Icon name="activity" size="sm" />} subtitle="Follow queued, running, failed, and recovered operations." title="Runs" />
            <ListRow href="#audit" leading={<Icon name="shield" size="sm" />} subtitle="Read the append-only record of operator activity." title="Audit trail" />
          </List>
        </Panel>
      </Columns>

      <MetricGrid aria-label="Fleet readiness" columns={3} dense>
        <Metric hint={servers.length ? 'Hosts with an approved agent identity' : 'No host has completed enrollment'} icon="server" label="Enrolled hosts" tone={servers.length ? 'accent' : 'neutral'} value={String(servers.length)} />
        <Metric hint={connected.length ? 'Agents currently answering outbound long polls' : 'No agent is answering the controller'} icon="link" label="Answering agents" tone={connected.length ? 'success' : 'warning'} value={String(connected.length)} />
        <Metric hint={managers.length ? 'Hosts that can be selected as a cluster target' : 'Swarm control is unavailable on every host'} icon="layers" label="Swarm managers" tone={managers.length ? 'success' : 'warning'} value={String(managers.length)} />
      </MetricGrid>
    </Page>
  )
}

function ServersPage({
  activeServerID,
  onConnected,
	onDiagnostics,
  onProvision,
  onRefresh,
  onSelect,
  servers,
  toast,
}: {
  activeServerID: string
  onConnected: (server: Server) => Promise<void>
	onDiagnostics: (id: string) => void
  onProvision: () => void
  onRefresh: () => Promise<void>
  onSelect: (id: string) => void
  servers: Server[]
  toast: ReturnType<typeof useToast>
}) {
  const [apiKey, setAPIKey] = useState('')
  const [apiURL, setAPIURL] = useState('')
  const [editing, setEditing] = useState<Server | null>(null)
  const [error, setError] = useState<ConnectionError | null>(null)
  const [name, setName] = useState('')
  const [pending, setPending] = useState(false)
  const [port, setPort] = useState('9180')
  const [tlsFingerprint, setTLSFingerprint] = useState('')
  const [manual, setManual] = useState(false)

  const reset = () => {
    setAPIKey('')
    setAPIURL('')
    setEditing(null)
    setError(null)
    setName('')
    setPort('9180')
    setTLSFingerprint('')
    setManual(false)
  }

  const beginReconnect = (server: Server) => {
    setAPIKey('')
    setAPIURL(server.apiUrl ?? '')
    setEditing(server)
    setError(null)
    setName(server.name)
    setPort(String(server.port))
    setTLSFingerprint(server.tlsCertificateFingerprint ?? '')
    setManual(true)
  }

  const submit = async (event?: FormEvent) => {
    event?.preventDefault()
    const parsedPort = Number(port)
    if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
      setError({ message: 'Machine API port must be between 1 and 65535.' })
      return
    }
    try {
      const parsedURL = new URL(apiURL)
      if (parsedURL.protocol !== 'https:' || parsedURL.port || parsedURL.pathname !== '/' || parsedURL.search || parsedURL.hash || parsedURL.username || parsedURL.password) {
        throw new Error('invalid')
      }
    } catch {
      setError({ message: 'Enter an HTTPS machine API origin without a port, path, query, or credentials.' })
      return
    }
    setPending(true)
    setError(null)
    const credentials: ServerCredentials = { apiKey }
    try {
      const connected = editing
        ? await api.connectServer(editing.id, credentials)
        : await api.addServer({ ...credentials, apiUrl: apiURL, name, port: parsedPort, tlsCertificateFingerprint: tlsFingerprint } satisfies ServerInput)
      setAPIKey('')
      await onConnected(connected)
      reset()
    } catch (reason) {
      setError(connectionErrorOf(reason))
    } finally {
      setPending(false)
    }
  }

  const disconnect = async (server: Server) => {
    try {
      await api.disconnectServer(server.id)
      if (activeServerID === server.id) onSelect('')
      await onRefresh()
      toast({ message: `${server.name} disconnected and its in-memory API key was cleared`, tone: 'success' })
    } catch (reason) {
      toast({ message: messageOf(reason), tone: 'danger', duration: 0 })
    }
  }

  const removeLegacyProfile = async (server: Server) => {
    if (!window.confirm(`Remove the legacy SSH profile for ${server.name}? Add the host again through its machine API after the agent is installed.`)) return
    try {
      await api.removeServer(server.id)
      if (activeServerID === server.id) onSelect('')
      await onRefresh()
      toast({ message: `${server.name} legacy profile removed`, tone: 'success' })
    } catch (reason) {
      toast({ message: messageOf(reason), tone: 'danger', duration: 0 })
    }
  }

  const columns: TableColumn<Server>[] = [
    { header: 'Server', key: 'server', render: (server) => <RecordLink meta={server.connectionType === 'agent_pull' ? 'Connects out securely · no inbound agent port' : serverEndpointLabel(server)} title={server.name} /> },
    { header: 'Connection', key: 'transport', render: serverConnectionLabel },
    { header: 'Docker', key: 'docker', render: (server) => server.dockerAvailable ? server.dockerVersion || 'Engine reachable' : 'Not detected' },
    { header: 'Swarm', key: 'swarm', render: (server) => server.swarmControlAvailable ? 'Manager' : server.dockerAvailable ? server.swarmState || 'Not active' : 'Bootstrap required' },
	{ header: 'Agent', key: 'agent', render: (server) => server.agentHealth?.agentVersion ? `v${server.agentHealth.agentVersion.replace(/^v/, '')}` : 'Version unavailable' },
	{ header: 'Status', key: 'connection', render: (server) => <StatusBadge health={serverHealth(server)} label={server.connectionState === 'connected' && serverHealth(server) === 'healthy' ? 'Connected' : server.agentHealth?.summary || (server.connectionState === 'connected' ? 'Checking connection' : 'Reconnect required')} /> },
    {
      header: 'Action',
      key: 'action',
      render: (server) => !isNativeAgent(server)
        ? <Button onClick={() => void removeLegacyProfile(server)} size="sm" variant="ghost">Remove legacy profile</Button>
		: server.connectionState === 'connected'
		? <Inline gap="tight"><Button onClick={() => onDiagnostics(server.id)} size="sm" variant="ghost">Diagnostics</Button>{serverCanManage(server) ? <Button onClick={() => onSelect(server.id)} size="sm" variant={activeServerID === server.id ? 'secondary' : 'ghost'}>{activeServerID === server.id ? 'Selected' : 'Use server'}</Button> : serverHealth(server) === 'unhealthy' ? null : <Button onClick={onProvision} size="sm" variant="secondary">Open provisioning</Button>}<Button onClick={() => void disconnect(server)} size="sm" variant="ghost">Disconnect</Button></Inline>
        : <Button onClick={() => beginReconnect(server)} size="sm" variant="secondary">Reconnect</Button>,
    },
  ]

  const connectionReady = Boolean(apiKey) && Boolean(apiURL) && Boolean(tlsFingerprint)
  return (
    <Page>
	  <DetailHeader subtitle="Connect servers, understand their Docker and Swarm role, and open setup or diagnostics from one place." title="Servers" />
	  <Columns>
		<OutboundEnrollmentGuide toast={toast} />
		<StandaloneClaimGuide onApproved={onRefresh} toast={toast} />
	  </Columns>
	  {!manual ? <Panel eyebrow="Migration only" title="Existing inbound machine API"><Rows gap="tight"><Body size="sm">New agents must use one of the outbound certificate flows above. Open this only to reconnect an older pinned HTTPS machine API while it is being migrated.</Body><Button onClick={() => setManual(true)} variant="ghost">Open legacy connection details</Button></Rows></Panel> : null}
      {manual ? (
      <Columns>
        <Panel eyebrow={editing ? 'Reconnect saved target' : 'Advanced'} title={editing ? `Reconnect ${editing.name}` : 'Add a server with explicit details'}>
          <Rows as="form" onSubmit={submit}>
            <Input disabled={Boolean(editing)} hint="A local label only; it never affects the remote host." label="Name" onChange={(event) => setName(event.target.value)} required value={name} />
            <Input disabled={Boolean(editing)} hint="HTTPS origin only, for example https://manager.example.com. Enter its port separately." label="Machine API URL" onChange={(event) => setAPIURL(event.target.value)} required type="url" value={apiURL} />
            <Columns><Input disabled={Boolean(editing)} label="Machine API port" min="1" onChange={(event) => setPort(event.target.value)} required type="number" value={port} /><Input disabled={Boolean(editing)} hint="Public SHA-256 fingerprint of the API certificate." label="TLS certificate fingerprint" onChange={(event) => setTLSFingerprint(event.target.value)} placeholder="SHA256:…" required value={tlsFingerprint} /></Columns>
            <Input autoComplete="off" hint="It is used to connect now and cleared on disconnect or API restart." label="Machine API key" onChange={(event) => setAPIKey(event.target.value)} required type="password" value={apiKey} />
            {error ? <Banner title={error.message} tone="danger"><Rows gap="tight">{error.detail ? <p>{error.detail}</p> : null}{error.requestID ? <Body size="sm">Request ID: <code>{error.requestID}</code></Body> : null}</Rows></Banner> : null}
            <Inline><Button disabled={pending || !connectionReady || (!editing && !name)} loading={pending} type="submit" variant="accent">{editing ? 'Reconnect server' : 'Add and connect server'}</Button><Button onClick={reset} type="button" variant="ghost">Cancel</Button></Inline>
          </Rows>
        </Panel>
        <Panel eyebrow="Verify before saving" title="Use the machine API certificate pin">
          <Rows gap="tight">
            <p>The API key authorizes SwarmOps but does not encrypt it. Use the machine agent’s HTTPS listener and enter its public certificate fingerprint in <code>SHA256:&lt;64-hex&gt;</code> form.</p>
            <CodeBlock label="Fingerprint command" wrap>{"openssl x509 -in <agent-certificate.pem> -outform DER | openssl dgst -sha256 -hex"}</CodeBlock>
            <Body size="sm">Verify the fingerprint from the target machine’s trusted console before saving it. An enrollment token already carries this fingerprint, so this manual path is only for a host enrolled before, or for reviewed TLS material you issued yourself.</Body>
          </Rows>
        </Panel>
      </Columns>
      ) : null}
      <Panel eyebrow="Connected infrastructure" title="Managed servers">
        <Banner title="How a server connects" tone="info">Each server initiates an encrypted connection to SwarmOps, so the agent does not expose an inbound port. The computer running this controller appears here only if you also install and enroll an agent on it.</Banner>
        <DataTable
          caption="Remote server profiles"
          columns={columns}
          empty={<EmptyState description="Choose either outbound enrollment flow above. The Ubuntu agent appears here after certificate issuance and its first long poll." icon="server" title="No agents connected" />}
          rowKey={(server) => server.id}
          rows={servers}
        />
      </Panel>
    </Page>
  )
}

function NodesPage({ commands, nodes, onAddNode, onDiagnostics, onReadiness, overview, toast }: {
  commands: Command[]
  nodes: Node[]
  onAddNode: () => void
  onDiagnostics: () => void
  onReadiness: () => void
  overview: Overview
  toast: ReturnType<typeof useToast>
}) {
  const [selectedID, setSelectedID] = useState('')
  const [detailTab, setDetailTab] = useState('overview')
  const [tasks, setTasks] = useState<Task[]>([])
  const [containers, setContainers] = useState<ContainerSummary[]>([])
  const [containerDetail, setContainerDetail] = useState<ContainerDetail | null>(null)
  const [containerStats, setContainerStats] = useState<ContainerStats | null>(null)
  const [taskError, setTaskError] = useState('')
  const [containerError, setContainerError] = useState('')
  const [busy, setBusy] = useState(false)
  const selected = nodes.find((node) => node.id === selectedID)

  useEffect(() => {
    if (!selected) return
    let live = true
    setTaskError('')
    setContainerError('')
    void api.nodeTasks(selected.id).then((value) => { if (live) setTasks(value) }).catch((reason) => { if (live) setTaskError(messageOf(reason)) })
    void api.containers().then((value) => { if (live) setContainers(value) }).catch((reason) => { if (live) setContainerError(messageOf(reason)) })
    return () => { live = false }
  }, [selected?.id])

  const updateAvailability = async (availability: string) => {
    if (!selected) return
    setBusy(true)
    try {
      const command = await api.setNodeAvailability(selected.id, availability)
      toast({ message: `${selected.hostname}: queued ${availability} (${shortID(command.id)})`, tone: 'success' })
    } catch (reason) {
      toast({ message: messageOf(reason), tone: 'danger', duration: 0 })
    } finally {
      setBusy(false)
    }
  }

  const inspectContainer = async (container: ContainerSummary) => {
    setBusy(true)
    setContainerError('')
    try {
      const [detail, stats] = await Promise.all([api.container(container.Id), api.containerStats(container.Id)])
      setContainerDetail(detail)
      setContainerStats(stats)
      setDetailTab('overview')
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
      toast({ message: messageOf(reason), tone: 'danger', duration: 0 })
    } finally {
      setBusy(false)
    }
  }

  const columns: TableColumn<Node>[] = [
    { header: 'Name / IP', key: 'node', render: (node) => <RecordLink meta={node.address ?? shortID(node.id)} onClick={() => { setSelectedID(node.id); setDetailTab('overview') }} title={node.hostname} /> },
    { header: 'Role', key: 'role', render: (node) => <span>{node.role}{node.manager?.leader ? ' · leader' : ''}</span> },
    { header: 'Availability', key: 'availability', render: (node) => <span>{node.availability}</span> },
    { header: 'Agent', key: 'agent', render: (node) => <StatusBadge health={hostProbeHealth(node)} label={node.agent.healthy ? node.agent.version || 'Online' : node.agent.error ? 'Unavailable' : 'Not configured'} /> },
    { header: 'Docker', key: 'docker', render: (node) => <Mono>{node.engine.version ?? node.dockerVersion ?? '—'}</Mono> },
    { header: 'CPU', key: 'cpu', numeric: true, render: (node) => `${formatNumber(node.cpu.capacity)} cores` },
    { header: 'Memory', key: 'memory', render: (node) => `${formatBytes(node.memory.used)} / ${formatBytes(node.memory.capacity)}` },
    { header: 'Disk', key: 'disk', render: (node) => `${formatBytes(node.disk.used)} / ${formatBytes(node.disk.capacity)}` },
    { header: 'Last seen', key: 'seen', render: (node) => node.agent.collectedAt ? formatDateTime(node.agent.collectedAt) : '—' },
  ]

  const attention = nodes.filter((node) => node.state !== 'ready' || node.availability !== 'active' || !node.agent.healthy)
  const manager = nodes.find((node) => node.manager?.leader) ?? nodes.find((node) => node.role === 'manager')
  const workers = nodes.filter((node) => node.id !== manager?.id)
  const nodeCommands = selected ? commands.filter((command) => command.nodeId === selected.id || command.target.includes(selected.id) || command.target.includes(selected.hostname)).slice(0, 8) : []
  const pending = commands.filter((command) => !['succeeded', 'failed', 'needs_attention', 'superseded', 'cancelled'].includes(command.state)).slice(0, 6)
  const containerColumns: TableColumn<ContainerSummary>[] = [
    { header: 'Name', key: 'name', render: (container) => <RecordLink meta={shortID(container.Id)} onClick={() => void inspectContainer(container)} title={container.Names?.[0]?.replace(/^\//, '') || shortID(container.Id)} /> },
    { header: 'Image', key: 'image', render: (container) => <Mono>{container.Image}</Mono> },
    { header: 'State', key: 'state', render: (container) => <StatusDot tone={container.State === 'running' ? 'success' : 'warning'}>{capitalize(container.State)}</StatusDot> },
    { header: 'Status', key: 'status', render: (container) => container.Status },
    { header: 'Networks', key: 'networks', render: (container) => Object.keys(container.NetworkSettings?.Networks ?? {}).join(', ') || '—' },
  ]

  if (selected && containerDetail) {
    const containerName = containerDetail.Name.replace(/^\//, '')
    return (
      <Page width="full">
        <DetailHeader
          actions={<Inline><Button onClick={openLogsWorkspace} variant="ghost">Open in Logs</Button><Button disabled={busy} loading={busy} onClick={() => void actOnContainer('restart')} variant="secondary">Restart container</Button><Button disabled={busy} onClick={() => void actOnContainer('stop')} variant="danger">Stop container</Button></Inline>}
          back={{ label: selected.hostname, onClick: () => { setContainerDetail(null); setContainerStats(null); setDetailTab('overview') } }}
          meta={<Inline><Mono>{shortID(containerDetail.Id)}</Mono><StatusDot tone={containerDetail.State.Running ? 'success' : 'warning'}>{capitalize(containerDetail.State.Status)}</StatusDot><span>Node <strong>{selected.hostname}</strong></span></Inline>}
          subtitle={<Inline><span>Image <Mono>{containerDetail.Config.Image ?? containerDetail.Image}</Mono></span><span>Uptime {formatDuration(containerStats ? Math.max(0, (Date.now() - new Date(containerDetail.State.StartedAt ?? containerDetail.Created).getTime()) / 1000) : 0)}</span></Inline>}
          title={containerName}
        />
        <Tabs label="Container views" onChange={setDetailTab} options={[
          { label: 'Overview', value: 'overview' },
          { label: 'Metrics', value: 'metrics' },
          { label: 'Logs', value: 'logs' },
          { label: 'Network', value: 'network' },
          { label: 'Inspect', value: 'inspect' },
          { label: 'Activity', value: 'activity' },
        ]} value={detailTab} />
        {detailTab === 'overview' || detailTab === 'metrics' ? <>
          <MetricGrid columns={4}>
            <Metric hint="One Engine sample" icon="activity" label="CPU" value={containerStats ? `${containerStats.cpuPercent.toFixed(2)}%` : '—'} />
            <Metric hint={containerStats?.memoryLimitBytes ? `of ${formatBytes(containerStats.memoryLimitBytes)}` : 'No limit reported'} icon="activity" label="Memory" value={containerStats ? formatBytes(containerStats.memoryUsedBytes) : '—'} />
            <Metric hint={containerStats ? `${formatBytes(containerStats.networkTxBytes)} egress` : 'No sample'} icon="cloud" label="Network ingress" value={containerStats ? formatBytes(containerStats.networkRxBytes) : '—'} />
            <Metric hint="Engine restart counter" icon="refresh" label="Restart count" value={String(containerDetail.RestartCount)} />
          </MetricGrid>
          <Columns template="aside">
            <Rows gap="md">
              <Columns template="one-third">
                <Panel title="Health & placement"><Facts columns={1} items={[
                  { label: 'Health check', value: containerDetail.State.Health?.Status ?? 'Not configured' },
                  { label: 'State', value: containerDetail.State.Status },
                  { label: 'Node', value: selected.hostname },
                  { label: 'Started', value: formatDateTime(containerDetail.State.StartedAt) },
                  { label: 'Restart policy', value: containerDetail.HostConfig.RestartPolicy?.Name ?? '—' },
                ]} /></Panel>
                <Panel title="Routes & ports"><Body size="sm" tone="muted">Published port and route evidence is shown in Traffic. This inspect payload does not claim an application route.</Body></Panel>
              </Columns>
              <Panel title="Recent log preview"><Body size="sm" tone="muted">Raw Engine log streaming is not part of the fixed manager API. Open Monitoring → Logs for sanitized Fluentd records from the selected cluster.</Body></Panel>
              <Panel title="Recent activity"><Facts items={[
                { label: 'Created', value: formatDateTime(containerDetail.Created) },
                { label: 'Started', value: formatDateTime(containerDetail.State.StartedAt) },
                { label: 'Restarts', value: String(containerDetail.RestartCount) },
                { label: 'Last sample', value: containerStats ? formatDateTime(containerStats.sampledAt) : '—' },
              ]} /></Panel>
            </Rows>
            <Rows gap="md">
              <Panel title="Container inspector"><Facts columns={1} items={[
                { label: 'Image', mono: true, value: containerDetail.Config.Image ?? containerDetail.Image },
                { label: 'Entrypoint', mono: true, value: containerDetail.Path ?? '—' },
                { label: 'Command', mono: true, value: containerDetail.Args?.join(' ') || '—' },
                { label: 'Labels', value: String(Object.keys(containerDetail.Config.Labels ?? {}).length) },
                { label: 'Mounts', value: String(containerDetail.Mounts?.length ?? 0) },
                { label: 'Network mode', value: containerDetail.HostConfig.NetworkMode ?? '—' },
                { label: 'Docker health', value: containerDetail.State.Health?.Status ?? (containerDetail.State.Running ? 'Running' : 'Stopped') },
              ]} /></Panel>
              <Panel title="Telemetry"><Body size="sm">Metrics are sampled from Docker. Logs and traces remain source-labeled under Monitoring and are never fabricated when collectors are absent.</Body></Panel>
            </Rows>
          </Columns>
        </> : detailTab === 'logs' ? <Panel title="Logs"><Banner tone="info">Use Monitoring → Logs for collected records. This controller does not proxy unrestricted container streams.</Banner></Panel> : detailTab === 'network' ? <Panel title="Network"><Facts items={[{ label: 'Mode', mono: true, value: containerDetail.HostConfig.NetworkMode ?? '—' }, { label: 'Ingress sample', value: containerStats ? formatBytes(containerStats.networkRxBytes) : '—' }, { label: 'Egress sample', value: containerStats ? formatBytes(containerStats.networkTxBytes) : '—' }]} /></Panel> : detailTab === 'inspect' ? <Panel title="Inspect"><Facts items={[{ label: 'Container ID', mono: true, value: containerDetail.Id }, { label: 'Image ID', mono: true, value: containerDetail.Image }, { label: 'Environment names', value: containerDetail.Config.EnvNames?.join(', ') || 'None' }, { label: 'Privileged', value: containerDetail.HostConfig.Privileged ? 'Yes' : 'No' }]} /></Panel> : <Panel title="Activity"><Facts items={[{ label: 'Created', value: formatDateTime(containerDetail.Created) }, { label: 'Started', value: formatDateTime(containerDetail.State.StartedAt) }, { label: 'Finished', value: formatDateTime(containerDetail.State.FinishedAt) }, { label: 'Restarts', value: String(containerDetail.RestartCount) }]} /></Panel>}
      </Page>
    )
  }

  if (!selected) return (
    <Page width="full">
      <DetailHeader
        actions={<Inline><Button iconStart="plus" onClick={onAddNode} variant="accent">Add node</Button><Button iconStart="activity" onClick={onDiagnostics} variant="secondary">Run health check</Button></Inline>}
        title="Infrastructure"
      />
      <Panel flush title="Cluster topology">
        <div className="nim-cluster-topology__body">
          <div className="nim-cluster-topology__flow">
            <div className="nim-cluster-topology__node">
              <Icon name="server" size="lg" tone={manager ? 'success' : 'warning'} />
              <span className="nim-cluster-topology__node-copy"><strong>{manager?.hostname ?? 'No manager'}</strong><Mono>{manager?.address ?? 'Manager required'}</Mono></span>
            </div>
            <span aria-hidden="true" className="nim-cluster-topology__connector" />
            <div className="nim-cluster-topology__state">
              <StatusDot tone={manager?.agent.healthy ? 'success' : 'warning'}>{manager?.agent.healthy ? 'Agent connected' : 'Agent unavailable'}</StatusDot>
            </div>
            <span aria-hidden="true" className="nim-cluster-topology__connector" />
            <div className="nim-cluster-topology__state">
              <StatusDot tone={overview.summary.managers ? 'success' : 'warning'}>Quorum {overview.summary.managers} / {overview.summary.managers}</StatusDot>
            </div>
            <span aria-hidden="true" className="nim-cluster-topology__connector" />
            <div className="nim-cluster-topology__workers">
              {workers.map((node) => <div className="nim-cluster-topology__node" key={node.id}><Icon name="server" size="sm" tone={nodeHealth(node) === 'healthy' ? 'success' : 'danger'} /><span className="nim-cluster-topology__node-copy"><strong>{node.hostname}</strong><Mono>{node.address ?? shortID(node.id)}</Mono></span></div>)}
            </div>
          </div>
          <div className="nim-cluster-topology__summary">
            <Facts columns={1} items={[
              { label: 'Swarm', value: overview.summary.managers ? 'Active' : 'Unavailable' },
              { label: 'Managers', value: String(overview.summary.managers) },
              { label: 'Workers', value: String(Math.max(0, overview.summary.nodes - overview.summary.managers)) },
              { label: 'Nodes', value: String(overview.summary.nodes) },
            ]} />
          </div>
        </div>
        <div className="nim-cluster-topology__capacity">
          <Body size="sm">Fleet capacity</Body>
          <MetricGrid columns={6} dense>
            <Metric label="CPU cores" value={formatNumber(overview.summary.totalCpu.capacity)} />
            <Metric label="Memory" value={formatBytes(overview.summary.totalMemory.capacity)} />
            <Metric label="Disk" value={formatBytes(overview.summary.totalDisk.capacity)} />
            <Metric label="Nodes" value={String(overview.summary.nodes)} />
            <Metric label="Services" value={String(overview.summary.services)} />
            <Metric label="Running tasks" value={String(overview.summary.runningTasks)} />
          </MetricGrid>
        </div>
      </Panel>
      <Columns template="aside">
        <Panel flush title={`Nodes (${nodes.length})`}>
          {nodes.length ? <DataTable columns={columns} rowKey={(node) => node.id} rows={nodes} summary={`1–${nodes.length} of ${nodes.length}`} /> : <EmptyState actions={<Button onClick={onAddNode} variant="accent">Add node</Button>} description="Enroll an Ubuntu machine agent, inspect its prerequisites, then initialise or join Docker Swarm." icon="server" title="No nodes" />}
        </Panel>
        <Panel title="Attention">
          {attention.length ? <List plain>{attention.map((node) => <ListRow key={node.id} leading={<StatusDot tone={node.state !== 'ready' ? 'danger' : 'warning'}>{node.hostname}</StatusDot>} subtitle={node.agent.error ?? `${capitalize(node.state)} · ${capitalize(node.availability)}`} title={node.agent.healthy ? 'Node needs review' : 'Agent unreachable'} />)}</List> : <StatusDot tone="success">No node needs attention</StatusDot>}
          <Inline><Button onClick={onDiagnostics} size="sm" variant="secondary">Diagnostics</Button><Button onClick={onReadiness} size="sm" variant="secondary">Readiness</Button></Inline>
        </Panel>
      </Columns>
      <Columns template="one-third">
        <Panel title="Swarm settings">
          <Facts columns={1} items={[
            { label: 'Swarm', value: overview.summary.managers ? 'Active' : 'Unavailable' },
            { label: 'Managers', value: String(overview.summary.managers) },
            { label: 'Workers', value: String(Math.max(0, overview.summary.nodes - overview.summary.managers)) },
            { label: 'Ready nodes', value: `${overview.summary.readyNodes} / ${overview.summary.nodes}` },
          ]} />
        </Panel>
        <Panel flush title={`Pending node operations (${pending.length})`}>
          {pending.length ? <DataTable caption="Pending node operations" columns={[
            { header: 'Target', key: 'target', render: (command: Command) => <Mono>{command.target}</Mono> },
            { header: 'Operation', key: 'action', render: (command: Command) => command.action },
            { header: 'Requested by', key: 'actor', render: (command: Command) => command.actor },
            { header: 'Status', key: 'state', render: (command: Command) => <StatusDot tone={command.state === 'retry_scheduled' ? 'warning' : 'accent'}>{capitalize(command.state.replaceAll('_', ' '))}</StatusDot> },
          ]} rowKey={(command) => command.id} rows={pending} /> : <Body size="sm" tone="muted">No node operation is queued or running.</Body>}
        </Panel>
      </Columns>
    </Page>
  )

  return (
    <Page width="full">
      <DetailHeader
        actions={<Inline><Button iconStart="activity" onClick={onDiagnostics} variant="secondary">Run diagnosis</Button><Button onClick={onReadiness} variant="secondary">Prepare node</Button></Inline>}
        back={{ label: 'Infrastructure', onClick: () => setSelectedID('') }}
        meta={<Inline><Mono>{selected.address ?? '—'}</Mono><StatusDot tone={nodeHealth(selected) === 'healthy' ? 'success' : 'warning'}>{capitalize(selected.state)}</StatusDot><span>{selected.role}{selected.manager?.leader ? ' · leader' : ''}</span><span>Agent {selected.agent.version ?? '—'}</span><span>Docker {selected.engine.version ?? selected.dockerVersion ?? '—'}</span></Inline>}
        title={selected.hostname}
      />
      <Tabs label="Node views" onChange={setDetailTab} options={[
        { label: 'Overview', value: 'overview' },
        { label: `Containers (${containers.length})`, value: 'containers' },
        { label: `Tasks (${tasks.length})`, value: 'tasks' },
        { label: 'Network', value: 'network' },
        { label: 'Packages', value: 'packages' },
        { label: 'Activity', value: 'activity' },
      ]} value={detailTab} />

      {detailTab === 'overview' ? <>
        <MetricGrid columns={4}>
          <Metric hint={selected.load1 !== undefined ? `1m load ${selected.load1.toFixed(2)}` : 'No load sample'} icon="activity" label="CPU capacity" value={`${formatNumber(selected.cpu.capacity)} cores`} />
          <Metric hint={`${formatNumber(selected.memory.percent)}% used`} icon="activity" label="Memory used" tone={selected.memory.percent >= 85 ? 'warning' : 'neutral'} value={formatBytes(selected.memory.used)} />
          <Metric hint={`${formatNumber(selected.disk.percent)}% used`} icon="activity" label="Disk used" tone={selected.disk.percent >= 85 ? 'warning' : 'neutral'} value={formatBytes(selected.disk.used)} />
          <Metric hint={`${tasks.filter((task) => task.currentState === 'running').length} running`} icon="layers" label="Tasks" value={String(tasks.length)} />
        </MetricGrid>
        <Columns template="aside">
          <Rows gap="md">
            <Panel flush title={`Containers (${containers.length})`}>
              {containerError ? <Banner tone="warning">{containerError}</Banner> : containers.length ? <DataTable columns={containerColumns} rowKey={(container) => container.Id} rows={containers.slice(0, 10)} summary={`Showing 1–${Math.min(10, containers.length)} of ${containers.length}`} /> : <EmptyState description="No local Engine containers were returned for this manager." icon="package" title="No containers" />}
            </Panel>
            <Panel flush title="Recent node operations">
              {nodeCommands.length ? <DataTable caption={`Operations targeting ${selected.hostname}`} columns={[
                { header: 'Time', key: 'time', render: (command: Command) => formatDateTime(command.updatedAt) },
                { header: 'Command', key: 'command', render: (command: Command) => command.action },
                { header: 'State', key: 'state', render: (command: Command) => <StatusDot tone={command.state === 'succeeded' ? 'success' : command.state === 'needs_attention' || command.state === 'failed' ? 'danger' : 'warning'}>{capitalize(command.state.replaceAll('_', ' '))}</StatusDot> },
                { header: 'Actor', key: 'actor', render: (command: Command) => command.actor },
              ]} rowKey={(command) => command.id} rows={nodeCommands} /> : <Body size="sm" tone="muted">No durable operation currently targets this node.</Body>}
            </Panel>
          </Rows>
          <Rows gap="md">
            <Panel title="System">
              <Facts columns={1} items={[
                { label: 'OS', value: selected.os ?? selected.platform.os ?? '—' },
                { label: 'Kernel', mono: true, value: selected.kernel ?? '—' },
                { label: 'CPU', value: `${formatNumber(selected.cpu.capacity)} cores` },
                { label: 'Memory', value: formatBytes(selected.memory.capacity) },
                { label: 'Storage', value: formatBytes(selected.disk.capacity) },
                { label: 'Architecture', value: selected.platform.architecture ?? '—' },
                { label: 'Storage driver', value: selected.engine.driver ?? '—' },
                { label: 'cgroup driver', value: selected.engine.cgroupDriver ?? '—' },
                { label: 'Uptime', value: formatDuration(selected.uptimeSeconds) },
              ]} />
            </Panel>
            <Panel title="Agent health">
              <StatusBadge health={hostProbeHealth(selected)} label={selected.agent.healthy ? 'Connected' : selected.agent.error ?? 'Not configured'} />
              <Facts columns={1} items={[
                { label: 'Address', mono: true, value: selected.agent.address ?? selected.address ?? '—' },
                { label: 'Version', mono: true, value: selected.agent.version ?? '—' },
                { label: 'Last inventory', value: selected.agent.collectedAt ? formatDateTime(selected.agent.collectedAt) : '—' },
                { label: 'Swarm membership', value: `${capitalize(selected.role)} · ${capitalize(selected.availability)}` },
              ]} />
              <Inline>{['active', 'pause', 'drain'].map((availability) => <Button disabled={busy || selected.availability === availability} key={availability} loading={busy && selected.availability !== availability} onClick={() => void updateAvailability(availability)} size="sm" variant={availability === 'drain' ? 'danger' : 'secondary'}>{capitalize(availability)}</Button>)}</Inline>
            </Panel>
          </Rows>
        </Columns>
      </> : detailTab === 'containers' ? <Panel flush title={`Containers on ${selected.hostname}`}>
        {containerError ? <Banner tone="warning">{containerError}</Banner> : <DataTable caption="Local Engine containers" columns={containerColumns} empty={<EmptyState description="No local Engine containers were returned." icon="package" title="No containers" />} rowKey={(container) => container.Id} rows={containers} />}
      </Panel> : detailTab === 'tasks' ? <Panel title={`Tasks on ${selected.hostname}`}>
        {taskError ? <Banner tone="warning">{taskError}</Banner> : tasks.length ? <TaskList tasks={tasks} /> : <EmptyState description="No task records are currently assigned to this node." icon="sparkle" title="No tasks" />}
      </Panel> : detailTab === 'network' ? <Panel title="Network">
        <Facts items={[
          { label: 'Advertised address', mono: true, value: selected.address ?? '—' },
          { label: 'Manager address', mono: true, value: selected.manager?.address ?? '—' },
          { label: 'Reachability', value: selected.manager?.reachability ?? 'Not a manager' },
          { label: 'Control path', value: 'Outbound pinned HTTPS' },
        ]} />
      </Panel> : detailTab === 'packages' ? <Panel actions={<Button onClick={onReadiness} variant="secondary">Open readiness</Button>} title="Packages">
        <Body size="sm">Package and Docker maintenance are fixed, audited server-readiness operations. SwarmOps does not expose arbitrary package names or a remote shell.</Body>
      </Panel> : <Panel flush title="Node activity">
        {nodeCommands.length ? <DataTable caption="Durable node operation history" columns={[
          { header: 'Time', key: 'time', render: (command: Command) => formatDateTime(command.updatedAt) },
          { header: 'Action', key: 'action', render: (command: Command) => command.action },
          { header: 'Target', key: 'target', render: (command: Command) => <Mono>{command.target}</Mono> },
          { header: 'State', key: 'state', render: (command: Command) => capitalize(command.state.replaceAll('_', ' ')) },
          { header: 'Actor', key: 'actor', render: (command: Command) => command.actor },
        ]} rowKey={(command) => command.id} rows={nodeCommands} /> : <Body size="sm" tone="muted">No durable operation has targeted this node.</Body>}
      </Panel>}
    </Page>
  )
}

function StacksPage({ nodes, stacks, toast }: { nodes: Node[]; stacks: Stack[]; toast: ReturnType<typeof useToast> }) {
  const [name, setName] = useState('')
  const [compose, setCompose] = useState('')
  const [targetNodeID, setTargetNodeID] = useState('')
  const [plan, setPlan] = useState<ComposePlan | null>(null)
  const [pending, setPending] = useState<'deploy' | 'validate' | null>(null)
  const [error, setError] = useState('')

  const importCompose = async (file: File | undefined) => {
    if (!file) return
    if (file.size > 512 * 1024) {
      setError('Compose files must be 512 KiB or smaller.')
      return
    }
    try {
      setCompose(await file.text())
      setPlan(null)
      setError('')
      if (!name) setName(file.name.replace(/\.(ya?ml)$/i, '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, ''))
    } catch {
      setError('The selected Compose file could not be read locally.')
    }
  }

  const validate = async () => {
    setPending('validate')
    setError('')
    try {
      setPlan(await api.validateStack(name, compose, targetNodeID))
    } catch (reason) {
      setPlan(null)
      setError(messageOf(reason))
    } finally {
      setPending(null)
    }
  }
  const deploy = async () => {
    setPending('deploy')
    setError('')
    try {
      const command = await api.deployStack(name, compose, targetNodeID)
      toast({ message: `Deployment queued for ${name} (${shortID(command.id)})`, tone: 'success' })
    } catch (reason) {
      setError(messageOf(reason))
    } finally {
      setPending(null)
    }
  }

  const columns: TableColumn<Stack>[] = [
    { header: 'Stack', key: 'name', render: (stack) => <strong>{stack.name}</strong> },
    { header: 'Services', key: 'services', numeric: true, render: (stack) => stack.serviceCount },
    { header: 'Running tasks', key: 'tasks', numeric: true, render: (stack) => stack.runningTasks },
    { header: 'Health', key: 'health', render: (stack) => <StatusBadge health={stack.health} /> },
    { header: 'Last change', key: 'updated', render: (stack) => formatDateTime(stack.updatedAt) },
  ]

  return (
    <Page>
      <DetailHeader subtitle="Deploy only reviewed namespace workloads as image-only Compose v3.9 stacks. Every service needs reservations and limits; host binds, direct ports, global modes, build directives, inline secrets, and unscoped routes are refused." title="Stack deployments" />
      <Columns>
        <Panel eyebrow="New deployment" title="Validate before applying">
          <Rows>
            <Input hint="Must be the reviewed namespace plus workload name, for example production-api." label="Stack name" onChange={(event) => setName(event.target.value)} value={name} />
            <Select label="Pin every service to one node" onChange={(event) => setTargetNodeID(event.target.value)} options={nodes.map((node) => ({ label: `${node.hostname} · ${node.state} · ${node.availability}`, value: node.id }))} placeholder="Let Swarm schedule this stack" value={targetNodeID} />
            <Input accept=".yaml,.yml,text/yaml,text/x-yaml" hint="Read locally only; the selected file is sent only when you validate or deploy it." label="Import Docker Compose file" onChange={(event) => void importCompose(event.target.files?.[0])} type="file" />
            <Textarea hint="External resources must be named production-api-* (or production-api_*); HTTPS router names must share that prefix and use the declared domain. Approved Compose is held in protected command storage only until its deployment succeeds." label="Compose v3.9" onChange={(event) => setCompose(event.target.value)} rows={18} value={compose} />
          </Rows>
          {error ? <Banner tone="danger">{error}</Banner> : null}
          {plan ? <DeploymentPlan plan={plan} /> : null}
          <Inline>
            <Button disabled={!compose || pending !== null} loading={pending === 'validate'} onClick={() => void validate()} variant="secondary">Validate Compose</Button>
            <Button disabled={!name || !compose || pending !== null} loading={pending === 'deploy'} onClick={() => void deploy()} variant="accent">Deploy stack</Button>
          </Inline>
        </Panel>
        <Panel eyebrow="Existing state" title="Managed stacks">
          <DataTable
            caption="Discovered Docker stacks"
            columns={columns}
            empty={<EmptyState description="No Docker stack labels were found in the current service inventory." icon="layers" title="No stacks" />}
            rowKey={(stack) => stack.name}
            rows={stacks}
          />
        </Panel>
      </Columns>
    </Page>
  )
}

function ServicesPage({ services, toast }: { services: Service[]; toast: ReturnType<typeof useToast> }) {
  const [selectedID, setSelectedID] = useState(services[0]?.id ?? '')
  const [logs, setLogs] = useState('')
  const [logsError, setLogsError] = useState('')
  const [busy, setBusy] = useState('')
  const [replicas, setReplicas] = useState(String(services[0]?.desiredTasks ?? 0))
  const [scaleError, setScaleError] = useState('')
  const selected = services.find((service) => service.id === selectedID) ?? services[0]
  // A degraded service is the only reason anyone opens this page in a hurry, so
  // the diagnosis is fetched for the selected service rather than hidden behind
  // a button — the question "why" is already the reason they are here.
  const degraded = selected ? selected.runningTasks < selected.desiredTasks : false
  const diagnosis = useServiceDiagnosis(
    degraded && selected ? selected.id : null,
    (id) => api.serviceDiagnosis(id),
  )

  useEffect(() => {
    if (selected) setReplicas(String(selected.desiredTasks))
    setScaleError('')
  }, [selected?.desiredTasks, selected?.id])

  const readLogs = async (service: Service) => {
    setSelectedID(service.id)
    setLogs('')
    setLogsError('')
    try { setLogs((await api.serviceLogs(service.id)).logs) } catch (reason) { setLogsError(messageOf(reason)) }
  }
  const action = async (kind: 'restart' | 'rollback' | 'scale') => {
    if (!selected) return
    const replicaCount = Number(replicas)
    if (kind === 'scale' && (!Number.isInteger(replicaCount) || replicaCount < 0 || replicaCount > 1000)) {
      setScaleError('Enter a whole replica count from 0 to 1000.')
      return
    }
    setBusy(kind)
    setScaleError('')
    try {
      const command = await api.serviceAction(selected.id, kind, kind === 'scale' ? replicaCount : undefined)
      const description = kind === 'scale' ? `scale to ${replicaCount}` : kind
      toast({ message: `${selected.name}: ${description} queued (${shortID(command.id)})`, tone: 'success' })
    } catch (reason) { toast({ message: messageOf(reason), tone: 'danger', duration: 0 }) } finally { setBusy('') }
  }
  const columns: TableColumn<Service>[] = [
    { header: 'Service', key: 'name', render: (service) => <RecordLink meta={service.stack ?? 'unmanaged service'} onClick={() => void readLogs(service)} title={service.name} /> },
    { header: 'Image', key: 'image', render: (service) => <Mono>{service.image ?? '—'}</Mono> },
    { header: 'Tasks', key: 'tasks', numeric: true, render: (service) => `${service.runningTasks} / ${service.desiredTasks}` },
    { header: 'Health', key: 'health', render: (service) => <StatusBadge health={service.health} /> },
    { header: 'Update', key: 'update', render: (service) => service.updateState || '—' },
  ]
  if (!selected) return <Page><DetailHeader subtitle="Long-running processes scheduled by Docker Swarm. Docker Compose and standalone containers are listed separately under Cluster → Docker resources." title="Swarm services" /><EmptyState description="Docker Engine is reachable, but this Swarm currently schedules zero services. This is normal when workloads run as Docker Compose or standalone containers." icon="layers" title="No Swarm services" /></Page>
  const canScale = selected.mode.toLowerCase() === 'replicated'
  return (
    <Page>
      <DetailHeader actions={<Button onClick={openLogsWorkspace} variant="ghost">Open Logs workspace</Button>} subtitle="Long-running processes scheduled by Docker Swarm. Compose and standalone containers are listed under Cluster → Docker resources. Restarts and rollbacks use fixed audited command shapes." title="Swarm services" />
      <Panel flush><DataTable caption="Docker Swarm services" columns={columns} empty={<EmptyState description="No services were returned by the remote Docker Engine." icon="layers" title="No services" />} rowKey={(service) => service.id} rows={services} /></Panel>
      {degraded && diagnosis.result ? (
        <ServiceDiagnosis
          onAction={(kind) => toast({ message: `The chain names "${kind}" as the fix, but the console does not run it yet.`, tone: 'neutral' })}
          result={diagnosis.result}
          serviceName={selected.name}
        />
      ) : null}
      <Columns>
        <Panel eyebrow={selected.stack ?? 'No stack label'} title={selected.name}>
          <Facts items={[{ label: 'Image', mono: true, value: selected.image ?? '—' }, { label: 'Desired tasks', value: String(selected.desiredTasks) }, { label: 'Running tasks', value: String(selected.runningTasks) }, { label: 'Last updated', value: formatDateTime(selected.updatedAt) }]} />
          <Inline><Button loading={busy === 'restart'} onClick={() => void action('restart')} variant="secondary">Force restart</Button><Button loading={busy === 'rollback'} onClick={() => void action('rollback')} variant="danger">Rollback</Button><Button onClick={() => void readLogs(selected)} variant="ghost">Read logs</Button></Inline>
          <Rows gap="tight">
            <Label as="p">Replica control</Label>
            {canScale ? (
              <Columns>
                <Input hint="Scale is queued as a fixed, audited Docker action." label="Desired replicas" max="1000" min="0" onChange={(event) => setReplicas(event.target.value)} step="1" type="number" value={replicas} />
                <Rows gap="tight">
                  <Body size="sm">A scale to zero is allowed and stops this replicated service without deleting it.</Body>
                  <Button disabled={busy !== ''} loading={busy === 'scale'} onClick={() => void action('scale')} variant="secondary">Set replicas</Button>
                </Rows>
              </Columns>
            ) : (
              <Body size="sm">This is a {selected.mode} service. Its task count is controlled by its mode, so SwarmOps does not offer a replica change.</Body>
            )}
            {scaleError ? <Banner tone="warning">{scaleError}</Banner> : null}
          </Rows>
        </Panel>
        <Panel eyebrow="Last 200 lines" title="Service logs">
          {logsError ? <Banner tone="danger">{logsError}</Banner> : null}
          {logs ? <CodeBlock label={`Last 200 lines · ${selected.name}`}>{logs}</CodeBlock> : <EmptyState description="Select a service name or use Read logs to fetch an on-demand, bounded log tail." icon="document" title="Logs are not loaded" />}
        </Panel>
      </Columns>
    </Page>
  )
}

function BuildsPage({ toast }: { toast: ReturnType<typeof useToast> }) {
  const [archive, setArchive] = useState<File | null>(null)
  const [image, setImage] = useState('')
  const [dockerfile, setDockerfile] = useState('Dockerfile')
  const [cpus, setCPUs] = useState('2')
  const [memoryMiB, setMemoryMiB] = useState('2048')
  const [push, setPush] = useState(false)
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState<Command | null>(null)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!archive) return
    setPending(true); setError(''); setResult(null)
    try {
      const queued = await api.build(archive, { cpus: Number(cpus), dockerfile, image, memoryMiB: Number(memoryMiB), push })
      setResult(queued)
      toast({ message: `Build queued for ${image} (${shortID(queued.id)})`, tone: 'success' })
    } catch (reason) { setError(messageOf(reason)) } finally { setPending(false) }
  }
  return (
    <Page>
      <DetailHeader subtitle="The console accepts a tarred local build context. The companion CLI can archive a directory while applying .dockerignore; both routes enforce the server’s CPU, RAM, image-prefix, and immutable-tag caps." title="Bounded image builds" />
      <Columns>
        <Panel eyebrow="Build request" title="Build and optionally push">
          <Rows>
            <Input accept=".tar,application/x-tar" label="Build context (.tar)" onChange={(event) => setArchive(event.target.files?.[0] ?? null)} type="file" />
            <Input hint="An allow-listed registry path with a non-latest tag is required." label="Image" onChange={(event) => setImage(event.target.value)} placeholder="ghcr.io/org/service:2026.08.23" value={image} />
            <Input label="Dockerfile path" onChange={(event) => setDockerfile(event.target.value)} value={dockerfile} />
            <Columns><Input label="vCPU cap" min="0.1" onChange={(event) => setCPUs(event.target.value)} step="0.1" type="number" value={cpus} /><Input label="RAM cap (MiB)" min="64" onChange={(event) => setMemoryMiB(event.target.value)} type="number" value={memoryMiB} /></Columns>
            <Switch checked={push} description="Requires the manager’s registry config secret. Build arguments are intentionally not accepted because they are not secret-safe." onChange={(event) => setPush(event.target.checked)}>Push after build</Switch>
          </Rows>
          {error ? <Banner tone="danger">{error}</Banner> : null}
          <Button disabled={!archive || !image || pending} loading={pending} onClick={() => void submit()} variant="accent">Start bounded build</Button>
        </Panel>
        <Panel eyebrow="Durable command" title="Build status">
          {result ? <Rows><Banner tone={result.state === 'needs_attention' ? 'warning' : 'success'} title={`Build ${result.state.replace('_', ' ')}`}>Run <Mono>{result.id}</Mono> owns this source archive until it succeeds or needs operator attention.</Banner><Body size="sm">Build output is never returned to the browser or audit trail. Follow this work under Activity → Runs.</Body></Rows> : <EmptyState description="A source archive is retained only in protected run storage until its queued build succeeds. Build output is not exposed in the console." icon="upload" title="No build run" />}
        </Panel>
      </Columns>
    </Page>
  )
}

// ApplicationsPage is the whole deploy flow: choose an approved slot, give it
// an image, tick the databases it needs, and SwarmOps renders and deploys the
// Compose. The operator writes no Compose, no Traefik label, and no
// connection string.
function ApplicationDetailView({ onBack, onDeploy, status }: { onBack: () => void; onDeploy: () => void; status: ApplicationStatus }) {
  const [tab, setTab] = useState('overview')
  const healthy = status.deployed && status.runningTasks >= status.spec.replicas
  const replicas = Array.from({ length: status.spec.replicas }, (_, index) => ({
    id: `${status.spec.name}-replica-${index + 1}`,
    replica: index + 1,
    state: index < status.runningTasks ? 'Running' : 'Pending',
  }))
  const version = status.spec.image.includes(':') ? status.spec.image.split(':').at(-1) ?? status.spec.image : status.spec.image
  const replicaColumns: TableColumn<(typeof replicas)[number]>[] = [
    { header: 'Replica', key: 'replica', render: (replica) => `Replica ${replica.replica}` },
    { header: 'State', key: 'state', render: (replica) => <StatusDot tone={replica.state === 'Running' ? 'success' : 'warning'}>{replica.state}</StatusDot> },
    { header: 'Health', key: 'health', render: (replica) => replica.state === 'Running' ? status.spec.healthPath ?? 'No probe declared' : 'Waiting for placement' },
    { header: 'Image', key: 'image', render: () => <Mono>{version}</Mono> },
  ]

  return (
    <Page width="full">
      <DetailHeader
        actions={<Inline><Button onClick={onDeploy} variant="accent">Deploy new release</Button><Button variant="secondary">More</Button></Inline>}
        back={{ label: 'Applications', onClick: onBack }}
        meta={<Inline><span>Replicas {status.runningTasks} / {status.spec.replicas}</span><span>Image <Mono>{version}</Mono></span><span>{status.deployed ? 'Deployed by SwarmOps' : 'Not deployed'}</span></Inline>}
        status={<StatusBadge health={healthy ? 'healthy' : 'degraded'} />}
        title={status.spec.name}
      />
      <Tabs label="Application views" onChange={setTab} options={[
        { label: 'Overview', value: 'overview' },
        { label: 'Containers', value: 'containers' },
        { label: 'Metrics', value: 'metrics' },
        { label: 'Logs', value: 'logs' },
        { label: 'Traces', value: 'traces' },
        { label: 'Routes', value: 'routes' },
        { label: 'Releases', value: 'releases' },
        { label: 'Configuration', value: 'configuration' },
      ]} value={tab} />

      {tab === 'overview' ? <>
        <Panel>
          <Columns template="quarters">
            <Facts columns={1} items={[{ label: 'Desired version', mono: true, value: version }, { label: 'Current version', mono: true, value: version }]} />
            <Facts columns={1} items={[{ label: 'Rollout strategy', value: 'Rolling update' }, { label: 'Replicas', value: String(status.spec.replicas) }]} />
            <Facts columns={1} items={[{ label: 'Health check', mono: true, value: status.spec.healthPath ?? 'Not declared' }, { label: 'Container port', value: String(status.spec.port) }]} />
            <Facts columns={1} items={[{ label: 'Current state', value: healthy ? 'Healthy' : 'Needs attention' }, { label: 'Source', value: 'Current manager snapshot' }]} />
          </Columns>
        </Panel>
        <Columns template="two-thirds">
          <Rows gap="md">
            <Panel flush title={`Replicas · ${status.runningTasks} / ${status.spec.replicas} running`}>
              <Table columns={replicaColumns} rowKey={(replica) => replica.id} rows={replicas} />
            </Panel>
            <MetricGrid columns={3}>
              <Metric label="Replica availability" tone={healthy ? 'success' : 'warning'} value={`${status.runningTasks} / ${status.spec.replicas}`} />
              <Metric label="CPU limit" value={`${status.spec.cpus} vCPU`} />
              <Metric label="Memory limit" value={`${status.spec.memoryMiB} MiB`} />
            </MetricGrid>
            <Panel flush title="Recent releases">
              <Table columns={[
                { header: 'Version', key: 'version', render: () => <Mono>{version}</Mono> },
                { header: 'Status', key: 'status', render: () => <StatusDot tone={healthy ? 'success' : 'warning'}>{healthy ? 'Healthy' : 'Degraded'}</StatusDot> },
                { header: 'Image', key: 'image', render: () => <Mono>{status.spec.image}</Mono> },
                { header: 'Note', key: 'note', render: () => 'Current manager snapshot' },
              ]} rowKey={() => status.spec.image} rows={[status]} />
            </Panel>
          </Rows>
          <Rows gap="md">
            <Panel title="Routes">
              <Facts columns={1} items={status.spec.domain ? [
                { label: 'Type', value: 'HTTPS' },
                { label: 'Hostname', mono: true, value: status.spec.domain },
                { label: 'TLS resolver', value: status.spec.resolver ?? 'Managed default' },
              ] : [{ label: 'Exposure', value: 'Internal only' }]} />
            </Panel>
            <Panel title="Managed bindings">
              <Body size="sm">{status.spec.databases?.length ? status.spec.databases.join(', ') : status.spec.backend ? `Backend: ${status.spec.backend}` : 'No managed data or backend binding is declared.'}</Body>
            </Panel>
            <Panel title="Telemetry">
              <Facts columns={1} items={[
                { label: 'Prometheus', value: status.spec.metrics ? `Enabled${status.spec.metricsPath ? ` · ${status.spec.metricsPath}` : ''}` : 'Disabled' },
                { label: 'Jaeger', value: status.spec.tracing ? 'Enabled' : 'Disabled' },
                { label: 'Logs', value: 'Collected by the shared Fluentd policy' },
              ]} />
            </Panel>
            <Panel title="Resource limits">
              <Facts columns={1} items={[
                { label: 'CPU', value: `${status.spec.cpus} vCPU` },
                { label: 'Memory', value: `${status.spec.memoryMiB} MiB` },
                { label: 'Replicas', value: String(status.spec.replicas) },
              ]} />
            </Panel>
          </Rows>
        </Columns>
      </> : <Panel title={capitalize(tab)}><Body size="sm">This view uses the selected manager’s bounded {tab} endpoint. No arbitrary shell or Docker socket access is exposed.</Body></Panel>}
    </Page>
  )
}

function ApplicationsPage({ toast }: { toast: ReturnType<typeof useToast> }) {
  const [applications, setApplications] = useState<ApplicationStatus[] | null>(null)
  const [approved, setApproved] = useState<ApprovedWorkload[]>([])
  const [databases, setDatabases] = useState<DatabaseStatus[]>([])
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [preview, setPreview] = useState('')
  const [removals, setRemovals] = useState<Record<string, string>>({})
  const [inspectedApplication, setInspectedApplication] = useState('')

  const [selected, setSelected] = useState('')
  const [image, setImage] = useState('')
  const [port, setPort] = useState('8080')
  const [healthPath, setHealthPath] = useState('/healthz')
  const [replicas, setReplicas] = useState('1')
  const [cpus, setCPUs] = useState('0.5')
  const [memoryMiB, setMemoryMiB] = useState('512')
  const [attached, setAttached] = useState<string[]>([])
  const [delivery, setDelivery] = useState<'secret' | 'env'>('secret')
  const [metrics, setMetrics] = useState(true)
  const [metricsPath, setMetricsPath] = useState('/metrics')
  const [tracing, setTracing] = useState(false)
  const [backend, setBackend] = useState('')
  const [domainApplication, setDomainApplication] = useState('')
  const [domainValue, setDomainValue] = useState('')
  const [domainConfirmation, setDomainConfirmation] = useState('')

  const refresh = async () => {
    const [apps, slots, dbs] = await Promise.all([api.applications(), api.approvedApplications(), api.databases()])
    const safeApps = Array.isArray(apps) ? apps : []
    const safeSlots = Array.isArray(slots) ? slots : []
    const safeDatabases = Array.isArray(dbs) ? dbs : []
    setApplications(safeApps)
    setApproved(safeSlots)
    setDatabases(safeDatabases)
    setInspectedApplication((current) => current || safeApps[0]?.spec.name || '')
    if (!selected && safeSlots.length > 0) setSelected(safeSlots[0].name)
  }
  useEffect(() => { void refresh().catch((reason) => setError(messageOf(reason))) }, [])
  useEffect(() => {
    if (!applications) return
    const eligible = applications.filter((status) => {
      const policy = approved.find((workload) => workload.name === status.spec.name)
      return Boolean(policy?.domainOptional || policy?.domainSuffixes?.length)
    })
    if (eligible.some((status) => status.spec.name === domainApplication)) return
    const next = eligible[0]
    setDomainApplication(next?.spec.name ?? '')
    setDomainValue(next?.spec.domain ?? '')
    setDomainConfirmation('')
  }, [applications, approved, domainApplication])

  const slot = approved.find((workload) => workload.name === selected)
  const runningDatabases = databases.filter((database) => database.installed)

  const specOf = (): ApplicationSpec => ({
    backend: backend || undefined,
    cpus: Number(cpus),
    databaseDelivery: delivery,
    databases: attached,
    domain: slot?.domain,
    healthPath,
    image: image.trim(),
    memoryMiB: Number(memoryMiB),
    metrics,
    metricsPath,
    name: selected,
    port: Number(port),
    replicas: Number(replicas),
    resolver: slot?.resolver,
    tracing,
  })

  const plan = async () => {
    setPending(true)
    setError('')
    try {
      const result = await api.planApplication(specOf())
      setPreview(result.compose)
    } catch (reason) { setError(messageOf(reason)) } finally { setPending(false) }
  }

  const deploy = async () => {
    setPending(true)
    setError('')
    try {
      const command = await api.deployApplication(specOf())
      toast({ message: `${selected} deployment queued (${shortID(command.id)})`, tone: 'success' })
      await refresh()
    } catch (reason) { setError(messageOf(reason)) } finally { setPending(false) }
  }

  const remove = async (status: ApplicationStatus) => {
    setPending(true)
    try {
      const command = await api.removeApplication(status.spec.name, removals[status.spec.name] ?? '')
      toast({ message: `${status.spec.name} removal queued (${shortID(command.id)})`, tone: 'success' })
      setRemovals((current) => ({ ...current, [status.spec.name]: '' }))
      await refresh()
    } catch (reason) { toast({ message: messageOf(reason), tone: 'danger', duration: 0 }) } finally { setPending(false) }
  }

  const toggleDatabase = (engine: string, checked: boolean) => {
    setAttached((current) => checked ? [...current.filter((value) => value !== engine), engine] : current.filter((value) => value !== engine))
  }

  if (!applications) return <LoadingScreen label="Reading applications" />
  const inspectedStatus = applications.find((status) => status.spec.name === inspectedApplication)
  if (inspectedStatus) return <ApplicationDetailView onBack={() => setInspectedApplication('')} onDeploy={() => setInspectedApplication('')} status={inspectedStatus} />
  const domainEligible = applications.filter((status) => {
    const policy = approved.find((workload) => workload.name === status.spec.name)
    return Boolean(policy?.domainOptional || policy?.domainSuffixes?.length)
  })
  const domainStatus = domainEligible.find((status) => status.spec.name === domainApplication)
  const domainPolicy = approved.find((workload) => workload.name === domainApplication)
  const chooseDomainApplication = (name: string) => {
    const next = domainEligible.find((status) => status.spec.name === name)
    setDomainApplication(name)
    setDomainValue(next?.spec.domain ?? '')
    setDomainConfirmation('')
  }
  const domainRemovalPhrase = domainStatus ? `REMOVE_DOMAIN_${domainStatus.spec.name.toUpperCase().replace(/-/g, '_')}` : ''
  const saveDomain = async () => {
    if (!domainStatus || !domainPolicy || (!domainValue.trim() && domainConfirmation !== domainRemovalPhrase)) return
    setPending(true)
    try {
      const command = await api.setApplicationDomain(domainStatus.spec.name, domainValue.trim(), domainValue.trim() ? domainPolicy.resolver ?? '' : '', domainConfirmation)
      toast({ message: `${domainStatus.spec.name} domain update queued (${shortID(command.id)})`, tone: 'success' })
      setDomainConfirmation('')
      await refresh()
    } catch (reason) { toast({ message: messageOf(reason), tone: 'danger', duration: 0 }) } finally { setPending(false) }
  }
  const columns: TableColumn<ApplicationStatus>[] = [
    { header: 'Application', key: 'name', render: (status) => <RecordLink meta={status.stack} onClick={() => setInspectedApplication(status.spec.name)} title={status.spec.name} /> },
    { header: 'Address', key: 'url', render: (status) => status.url ? <a href={status.url} rel="noreferrer" target="_blank">{status.url}</a> : 'Internal only' },
    { header: 'Image', key: 'image', render: (status) => <Mono>{status.spec.image}</Mono> },
    { header: 'Databases', key: 'databases', render: (status) => (status.spec.databases ?? []).join(', ') || '—' },
    { header: 'Tasks', key: 'tasks', render: (status) => <StatusBadge health={status.runningTasks > 0 ? 'healthy' : status.deployed ? 'degraded' : 'unknown'} label={status.deployed ? `${status.runningTasks} running` : 'Not deployed'} /> },
    {
      header: 'Action',
      key: 'action',
      render: (status) => (
        <Inline gap="tight">
          <Input
            aria-label={`Removal confirmation for ${status.spec.name}`}
            onChange={(event) => setRemovals((current) => ({ ...current, [status.spec.name]: event.target.value }))}
            placeholder={`REMOVE_APPLICATION_${status.spec.name.toUpperCase().replace(/-/g, '_')}`}
            value={removals[status.spec.name] ?? ''}
          />
          <Button disabled={pending || (removals[status.spec.name] ?? '') !== `REMOVE_APPLICATION_${status.spec.name.toUpperCase().replace(/-/g, '_')}`} onClick={() => void remove(status)} size="sm" variant="ghost">Remove</Button>
        </Inline>
      ),
    },
  ]

  return (
    <Page>
      <DetailHeader subtitle="Pick an approved application slot, give it a pushed image, and choose what it connects to. SwarmOps renders the Compose, the Traefik route, the health probe, and the database wiring, then puts its own output through the same policy as hand-written Compose." title="Applications" />
      {approved.length === 0 ? <Banner tone="warning" title="No application slots are approved">Add a workload with <Mono>profile: application</Mono>, a domain, a resolver, and a resource budget to the reviewed platform manifest, then reconnect.</Banner> : null}
      <Columns>
        <Panel eyebrow="Deploy" title="Application">
          <Rows>
            <Select
              label="Approved slot"
              onChange={(event) => setSelected(event.target.value)}
              options={approved.map((workload) => ({ label: workload.domain ? `${workload.name} — ${workload.domain}` : workload.name, value: workload.name }))}
              value={selected}
            />
            {slot ? <Facts items={[
              { label: 'Domain', value: slot.domain || 'Internal only' },
              { label: 'Certificate resolver', value: slot.resolver || '—' },
              { label: 'Budget', value: `${slot.cpuCores} vCPU · ${slot.memoryMiB} MiB` },
            ]} /> : null}
            <Input hint="An already-pushed, immutable image tag. SwarmOps deploys images; it does not build here." label="Image" onChange={(event) => setImage(event.target.value)} placeholder="ghcr.io/org/app:2026.08.25" value={image} />
            <Columns>
              <Input label="Container port" min="1" onChange={(event) => setPort(event.target.value)} type="number" value={port} />
              <Input hint="Probed inside the container; the image needs a shell with wget or curl." label="Health path" onChange={(event) => setHealthPath(event.target.value)} value={healthPath} />
            </Columns>
            <Columns>
              <Input label="Replicas" min="1" onChange={(event) => setReplicas(event.target.value)} type="number" value={replicas} />
              <Input label="vCPU" min="0.1" onChange={(event) => setCPUs(event.target.value)} step="0.1" type="number" value={cpus} />
              <Input label="Memory (MiB)" min="64" onChange={(event) => setMemoryMiB(event.target.value)} type="number" value={memoryMiB} />
            </Columns>
          </Rows>
        </Panel>
        <Panel eyebrow="Connections" title="What it talks to">
          <Rows>
            {runningDatabases.length === 0
              ? <Body size="sm">No managed database is running. Deploy one under Databases to attach it here.</Body>
              : runningDatabases.map((database) => (
                <Switch
                  checked={attached.includes(database.engine)}
                  description={`Injects the generated connection URI for ${database.host}:${database.port}.`}
                  key={database.engine}
                  onChange={(event) => toggleDatabase(database.engine, event.target.checked)}
                >
                  Attach {database.displayName}
                </Switch>
              ))}
            {attached.length > 0 ? (
              <Segmented
                fullWidth
                label="Deliver the connection URI as"
                onChange={(value) => setDelivery(value)}
                options={[
                  { label: 'Mounted secret file', value: 'secret' as const },
                  { label: 'Environment variable', value: 'env' as const },
                ]}
                value={delivery}
              />
            ) : null}
            {attached.length > 0 && delivery === 'env' ? <Banner tone="warning" title="The credential becomes readable">An environment variable is visible to anyone who can run <Mono>docker service inspect</Mono> on the cluster. The mounted file is not.</Banner> : null}
            <Select
              hint="A frontend receives its backend's in-cluster and public URLs."
              label="Backend application"
              onChange={(event) => setBackend(event.target.value)}
              options={[{ label: 'None', value: '' }, ...applications.filter((status) => status.spec.name !== selected).map((status) => ({ label: status.spec.name, value: status.spec.name }))]}
              value={backend}
            />
            <Switch checked={metrics} description="Prometheus discovers the application and starts scraping it without a configuration change." onChange={(event) => setMetrics(event.target.checked)}>Collect metrics</Switch>
            {metrics ? <Input label="Metrics path" onChange={(event) => setMetricsPath(event.target.value)} value={metricsPath} /> : null}
            <Switch checked={tracing} description="Connects the rendered application to the shared Jaeger OpenTelemetry endpoint; no provider Compose telemetry service is deployed." onChange={(event) => setTracing(event.target.checked)}>Send traces to shared Jaeger</Switch>
          </Rows>
        </Panel>
      </Columns>
      {error ? <Banner tone="danger" title="This application cannot be deployed">{error}</Banner> : null}
      <Inline>
        <Button disabled={pending || !selected || !image} loading={pending} onClick={() => void plan()} variant="secondary">Preview the rendered Compose</Button>
        <Button disabled={pending || !selected || !image} loading={pending} onClick={() => void deploy()} variant="accent">Deploy application</Button>
      </Inline>
      {preview ? <Panel eyebrow="Exactly what will be deployed" title="Rendered Compose"><CodeBlock wrap>{preview}</CodeBlock></Panel> : null}
      <Panel eyebrow="Deployed by SwarmOps" title="Applications">
        <DataTable
          caption="Rendered applications"
          columns={columns}
          empty={<EmptyState description="Choose an approved slot above, give it a pushed image, and deploy it." icon="layers" title="No applications yet" />}
          rowKey={(status) => status.spec.name}
          rows={applications}
        />
      </Panel>
      <Panel eyebrow="Routing" title="Assign or remove a domain">
        {domainEligible.length === 0 ? <EmptyState description="Only deployed applications whose reviewed platform slot permits an optional or suffix-bound domain can be changed here. Fixed manifest domains remain protected by admission." icon="external" title="No editable application domains" /> : (
          <Rows>
            <Select label="Deployed application" onChange={(event) => chooseDomainApplication(event.target.value)} options={domainEligible.map((status) => ({ label: `${status.spec.name}${status.spec.domain ? ` — ${status.spec.domain}` : ' — internal only'}`, value: status.spec.name }))} value={domainApplication} />
            {domainPolicy ? <Facts items={[
              { label: 'Current domain', value: domainStatus?.spec.domain || 'Internal only' },
              { label: 'Certificate resolver', value: domainPolicy.resolver || '—' },
              { label: 'Allowed policy', value: domainPolicy.domainSuffixes?.length ? `One hostname under ${domainPolicy.domainSuffixes.join(', ')}` : 'Optional route' },
            ]} /> : null}
            <Input hint={domainPolicy?.domainSuffixes?.length ? `Use one hostname under ${domainPolicy.domainSuffixes.join(' or ')}. Clear the field only to remove an optional route.` : 'Clear the field only to remove this optional route.'} label="Domain" onChange={(event) => setDomainValue(event.target.value)} placeholder={domainPolicy?.domainSuffixes?.[0] || 'app.example.com'} value={domainValue} />
            {!domainValue.trim() ? <Input hint={`Type ${domainRemovalPhrase} to remove the public route. The application and its internal service stay deployed.`} label="Removal confirmation" onChange={(event) => setDomainConfirmation(event.target.value)} value={domainConfirmation} /> : null}
            <Button disabled={pending || !domainStatus || (!domainValue.trim() && domainConfirmation !== domainRemovalPhrase)} loading={pending} onClick={() => void saveDomain()} variant={domainValue.trim() ? 'secondary' : 'danger'}>{domainValue.trim() ? 'Queue domain assignment' : 'Queue domain removal'}</Button>
          </Rows>
        )}
      </Panel>
    </Page>
  )
}

// DatabasesPage operates the three reviewed managed engines. The console
// chooses only whether one runs: the Compose content is a checked-in asset and
// the generated password is a Swarm secret the browser never sees.
function DatabasesPage({ toast }: { toast: ReturnType<typeof useToast> }) {
  const [databases, setDatabases] = useState<DatabaseStatus[] | null>(null)
  const [error, setError] = useState('')
  const [pending, setPending] = useState('')
  const [confirmations, setConfirmations] = useState<Record<string, string>>({})

  const refresh = () => api.databases().then(setDatabases).catch((reason) => setError(messageOf(reason)))
  useEffect(() => { void refresh() }, [])

  const set = async (database: DatabaseStatus, enabled: boolean) => {
    setPending(database.engine)
    try {
      const command = await api.setDatabase(database.engine, enabled, enabled ? '' : confirmations[database.engine] ?? '')
      toast({ message: `${database.displayName} ${enabled ? 'deployment' : 'removal'} queued (${shortID(command.id)})`, tone: 'success' })
      setConfirmations((current) => ({ ...current, [database.engine]: '' }))
      await refresh()
    } catch (reason) {
      toast({ message: messageOf(reason), tone: 'danger', duration: 0 })
    } finally {
      setPending('')
    }
  }

  if (error) return <Banner tone="danger" title="Managed databases are unavailable">{error}</Banner>
  if (!databases) return <LoadingScreen label="Reading managed databases" />
  return (
    <Page>
      <DetailHeader subtitle="Three reviewed database stacks ship with SwarmOps. Their Compose definitions are checked-in assets, their passwords are generated Swarm secrets, and each is reachable only on the internal swarmops overlay." title="Managed databases" />
      <Columns>
        {databases.map((database) => {
          const removal = `REMOVE_DATABASE_${database.engine.toUpperCase()}`
          return (
            <Panel eyebrow={database.installed ? `${database.runningTasks} running task${database.runningTasks === 1 ? '' : 's'}` : 'Not deployed'} key={database.engine} title={database.displayName}>
              <Rows>
                <StatusBadge health={database.installed ? (database.runningTasks > 0 ? 'healthy' : 'degraded') : 'unknown'} label={database.installed ? (database.runningTasks > 0 ? 'Running' : 'No running task') : 'Not deployed'} />
                <Facts items={[
                  { label: 'Image', mono: true, value: database.image },
                  { label: 'In-cluster host', mono: true, value: `${database.host}:${database.port}` },
                  ...(database.username ? [{ label: 'User', mono: true, value: database.username }] : []),
                  ...(database.database ? [{ label: 'Database', mono: true, value: database.database }] : []),
                  { label: 'Volume', mono: true, value: database.volume },
                ]} />
                {database.installed ? (
                  <Rows gap="tight">
                    <Input
                      hint="Removing the stack stops the only process serving this data. The named volume is left in place."
                      label="Removal confirmation"
                      onChange={(event) => setConfirmations((current) => ({ ...current, [database.engine]: event.target.value }))}
                      placeholder={removal}
                      value={confirmations[database.engine] ?? ''}
                    />
                    <Inline>
                      <Button disabled={pending === database.engine || (confirmations[database.engine] ?? '') !== removal} loading={pending === database.engine} onClick={() => void set(database, false)} variant="ghost">Remove {database.displayName}</Button>
                      <Button disabled={Boolean(pending)} loading={pending === database.engine} onClick={() => void set(database, true)} variant="secondary">Redeploy</Button>
                    </Inline>
                  </Rows>
                ) : (
                  <Button disabled={Boolean(pending)} loading={pending === database.engine} onClick={() => void set(database, true)} variant="accent">Deploy {database.displayName}</Button>
                )}
              </Rows>
            </Panel>
          )
        })}
      </Columns>
      <Panel eyebrow="How your services connect" title="Credentials and placement">
        <Rows as="ul" gap="tight" className="nim-body nim-body--sm">
          <li>The password is generated on the manager and stored as a Swarm secret. SwarmOps never returns it to this console; mount that secret into your own service to read it.</li>
          <li>Each engine is pinned to a node labelled <Mono>nim.stateful=true</Mono> and attached only to the internal <Mono>swarmops</Mono> overlay. Publishing a port to the host or the edge stays a separate, explicit decision.</li>
          <li>Redeploying applies the current checked-in asset and pinned image. It never rotates an existing password: Swarm secrets are immutable and a running database depends on the value it was created with.</li>
        </Rows>
      </Panel>
    </Page>
  )
}

function ObservabilityPage({ nodes, onOpenGateway, onOpenSwarm, status, toast, traefik }: { nodes: Node[]; onOpenGateway: () => void; onOpenSwarm: () => void; status: ObservabilityStatus; toast: ReturnType<typeof useToast>; traefik: TraefikStatus }) {
  const [pending, setPending] = useState(false)
  const [confirmation, setConfirmation] = useState('')
  const [coreConfirmation, setCoreConfirmation] = useState('')
  const [agentConfirmation, setAgentConfirmation] = useState('')
  const [logRemovalRequested, setLogRemovalRequested] = useState(false)
	const gatewayInstalled = Boolean(traefik.service)
	const statefulNodeReady = nodes.some((node) => node.state === 'ready' && node.availability === 'active' && node.labels?.['nim.stateful'] === 'true')
	const coreBlockers = [
		...(!gatewayInstalled ? ['Install the SwarmOps-managed Traefik gateway so private monitoring routes can be created.'] : []),
		...(!statefulNodeReady ? ['Assign nim.stateful=true to at least one ready, active Swarm node for Prometheus, Alertmanager, and Jaeger placement.'] : []),
	]
  const setCore = async (enabled: boolean) => {
    setPending(true)
    try {
      const command = await api.coreObservability(enabled, enabled ? '' : coreConfirmation)
      toast({ message: `${enabled ? 'Core monitoring deployment' : 'Core monitoring removal'} queued (${shortID(command.id)})`, tone: 'success' })
      setCoreConfirmation('')
    } catch (reason) { toast({ message: messageOf(reason), tone: 'danger', duration: 0 }) } finally { setPending(false) }
  }
  const setLogs = async (enabled: boolean) => {
    setPending(true)
    try {
      const command = await api.logsCollection(enabled, enabled ? '' : confirmation)
      toast({ message: `${enabled ? 'Log collection deployment' : 'Log collection removal'} queued (${shortID(command.id)})`, tone: 'success' })
      setConfirmation('')
      if (!enabled) setLogRemovalRequested(false)
    } catch (reason) { toast({ message: messageOf(reason), tone: 'danger', duration: 0 }) } finally { setPending(false) }
  }
  const setAgent = async (enabled: boolean) => {
    setPending(true)
    try {
      const command = await api.nodeAgentCollection(enabled, agentConfirmation)
      toast({ message: `${enabled ? 'Node inventory agent installation' : 'Node inventory agent removal'} queued (${shortID(command.id)})`, tone: 'success' })
      setAgentConfirmation('')
    } catch (reason) { toast({ message: messageOf(reason), tone: 'danger', duration: 0 }) } finally { setPending(false) }
  }
  return (
    <Page>
      <DetailHeader subtitle="One cluster-wide observability stack owns Prometheus, Alertmanager, and Jaeger. Log collection and host probes are separate, explicit global deployments because they inspect every node." title="Observability" />
      <MetricGrid>
        <Metric icon="chart" label="Core monitoring" tone={status.coreInstalled ? (status.coreHealthy ? 'success' : 'danger') : 'warning'} value={status.coreInstalled ? (status.coreHealthy ? 'Healthy' : 'Degraded') : 'Not installed'} />
        <Metric icon="settings" label="Node inventory" tone={status.agentInstalled ? (status.agentHealthy ? 'success' : 'danger') : 'neutral'} value={status.agentInstalled ? (status.agentHealthy ? 'Healthy' : 'Degraded') : 'Optional'} />
        <Metric icon="document" label="Log collection" tone={status.logsEnabled ? (status.logsHealthy ? 'success' : 'danger') : 'neutral'} value={status.logsEnabled ? (status.logsHealthy ? 'Healthy' : 'Degraded') : 'Disabled'} />
        <Metric icon="activity" label="Prometheus" value={status.coreInstalled ? (status.coreHealthy ? 'Healthy' : 'Check stack') : 'Pending'} />
        <Metric icon="activity" label="Alertmanager" value={status.coreInstalled ? (status.coreHealthy ? 'Healthy' : 'Check stack') : 'Pending'} />
        <Metric icon="activity" label="Jaeger" value={status.coreInstalled ? (status.coreHealthy ? 'Healthy' : 'Check stack') : 'Pending'} />
      </MetricGrid>
      <Columns>
        <Panel eyebrow="Shared platform service" title="Core monitoring stack">
          <Body size="sm">One API action deploys the reviewed Prometheus, Alertmanager, and Jaeger stack. SwarmOps will render the few operator graphs itself later; the baseline Alertmanager intentionally has no external receiver until an operator installs a reviewed receiver configuration.</Body>
			{!status.coreInstalled && coreBlockers.length ? <Banner title="Deployment prerequisites are not ready" tone="warning"><Rows gap="tight"><List plain>{coreBlockers.map((blocker) => <ListRow key={blocker} subtitle={blocker} title="Required before deployment" />)}</List><Inline><Button onClick={onOpenGateway} size="sm" variant="secondary">Open gateway setup</Button><Button onClick={onOpenSwarm} size="sm" variant="secondary">Open Swarm placement</Button></Inline></Rows></Banner> : null}
          <TaskProgress caption={status.coreInstalled ? (status.coreHealthy ? 'The core stack is healthy in Docker.' : 'The core stack is present but Docker reports at least one service as degraded.') : 'Provision the core stack before trusting monitoring state.'} steps={[{ id: 'prometheus', label: 'Prometheus discovery, rules, and retention', status: status.coreInstalled ? (status.coreHealthy ? 'done' : 'failed') : 'pending' }, { id: 'alertmanager', label: 'Alert grouping and routing boundary', status: status.coreInstalled ? (status.coreHealthy ? 'done' : 'failed') : 'pending' }, { id: 'jaeger', label: 'Jaeger durable storage', status: status.coreInstalled ? (status.coreHealthy ? 'done' : 'failed') : 'pending' }]} title="Core readiness" />
          {status.coreInstalled ? <><Input hint="Type the exact confirmation before removing shared monitoring." label="Remove-core confirmation" onChange={(event) => setCoreConfirmation(event.target.value)} value={coreConfirmation} /><Button disabled={pending || coreConfirmation !== 'REMOVE_OBSERVABILITY_CORE'} loading={pending} onClick={() => void setCore(false)} variant="danger">Remove core monitoring</Button></> : <Button disabled={pending || coreBlockers.length > 0} loading={pending} onClick={() => void setCore(true)} variant="accent">Deploy core monitoring</Button>}
        </Panel>
        <Panel eyebrow="Explicit cluster-wide collection" title="Fluentd log pipeline">
          <Switch checked={status.logsEnabled} disabled={pending} description={status.logsEnabled ? 'Fluentd is collecting container output and host journals globally. Turning the switch off opens the confirmation step; the stack is not removed until you confirm it.' : 'Runs the reviewed Fluentd forwarder globally with a stateful aggregator and bounded query service.'} onChange={(event) => { if (event.target.checked) void setLogs(true); else setLogRemovalRequested(true) }}>Enable log collection</Switch>
          {status.logsEnabled ? (
            <Rows gap="tight">
              {!logRemovalRequested ? <Button disabled={pending} onClick={() => setLogRemovalRequested(true)} variant="danger">Begin collection removal</Button> : null}
              {logRemovalRequested ? <Banner title="Confirm global log collector removal" tone="warning">This removes the reviewed Fluentd stack. Its local retained volume is left untouched for explicit operator recovery or separately approved cleanup.</Banner> : null}
              {logRemovalRequested ? <Input hint="Type the exact confirmation before SwarmOps queues the global stack removal." label="Disable confirmation" onChange={(event) => setConfirmation(event.target.value)} value={confirmation} /> : null}
              {logRemovalRequested ? <Inline><Button disabled={pending || confirmation !== 'DISABLE_LOG_COLLECTION'} loading={pending} onClick={() => void setLogs(false)} variant="danger">Disable collection</Button><Button disabled={pending} onClick={() => { setConfirmation(''); setLogRemovalRequested(false) }} variant="ghost">Keep collection enabled</Button></Inline> : null}
            </Rows>
          ) : <Button disabled={pending} loading={pending} onClick={() => void setLogs(true)} variant="accent">Enable collection</Button>}
        </Panel>
        <Panel eyebrow="Optional host probe" title="Node inventory agent">
          <Body size="sm">The optional global stack installs a read-only SwarmOps agent plus node-exporter. Together they expose host CPU, memory, disk, Docker metadata, and durable fleet-job status only on the private overlay. The SwarmOps agent has a read-only Docker socket and host-root mount, so installation and removal both require an exact confirmation.</Body>
          <Input hint={status.agentInstalled ? 'Type REMOVE_NODE_AGENT to remove the global host probe.' : 'Type INSTALL_NODE_AGENT to install the global host probe.'} label={status.agentInstalled ? 'Remove-agent confirmation' : 'Install-agent confirmation'} onChange={(event) => setAgentConfirmation(event.target.value)} value={agentConfirmation} />
          {status.agentInstalled ? <Button disabled={pending || agentConfirmation !== 'REMOVE_NODE_AGENT'} loading={pending} onClick={() => void setAgent(false)} variant="danger">Remove node agent</Button> : <Button disabled={pending || agentConfirmation !== 'INSTALL_NODE_AGENT'} loading={pending} onClick={() => void setAgent(true)} variant="accent">Install node agent</Button>}
        </Panel>
      </Columns>
    </Page>
  )
}

function AuditPage({ events }: { events: AuditEvent[] }) {
  return (
    <Page>
      <DetailHeader subtitle="SwarmOps writes append-only local audit records for each operation. The record contains actors, targets, outcomes, and request IDs—not passwords, Compose content, build contexts, or registry credentials." title="Audit trail" />
      <Panel>
        <ActivityFeed empty={<EmptyState description="The controller has not recorded an operation yet." icon="clock" title="No audit events" />} events={events.map((event) => ({ action: `${event.action} · ${event.outcome}`, actor: event.actor, at: event.occurredAt, icon: event.outcome === 'success' ? 'check' as const : 'danger' as const, id: event.id, target: event.target, tone: event.outcome === 'success' ? 'success' as const : 'danger' as const }))} />
      </Panel>
    </Page>
  )
}

function CommandQueuePage({ commands, dashboard, highlightedID, onOpenDiagnostics, onOpenGateway, onOpenSwarm, onRefresh, servers, toast }: { commands: Command[]; dashboard: DashboardData | null; highlightedID: string; onOpenDiagnostics: () => void; onOpenGateway: () => void; onOpenSwarm: () => void; onRefresh: () => Promise<void>; servers: Server[]; toast: ReturnType<typeof useToast> }) {
  const [retrying, setRetrying] = useState('')
  const [selectedID, setSelectedID] = useState(() => commands.find((command) => command.state === 'needs_attention')?.id ?? commands[0]?.id ?? '')
  const [query, setQuery] = useState('')
  const [stateFilter, setStateFilter] = useState('all')
  const [targetFilter, setTargetFilter] = useState('all')
  const [actionFilter, setActionFilter] = useState('all')
  const [timeFilter, setTimeFilter] = useState('all')
  useEffect(() => {
    if (highlightedID && commands.some((command) => command.id === highlightedID)) setSelectedID(highlightedID)
  }, [commands, highlightedID])
  const retry = async (command: Command) => {
    setRetrying(command.id)
    try {
      const updated = await api.retryCommand(command.id)
      toast({ message: `${updated.action} released for a new attempt (${shortID(updated.id)})`, tone: 'success' })
      await onRefresh()
    } catch (reason) {
      toast({ message: messageOf(reason), tone: 'danger', duration: 0 })
    } finally {
      setRetrying('')
    }
  }
  const attention = commands.filter((command) => command.state === 'needs_attention')
  const selected = commands.find((command) => command.id === selectedID)
	const guidance = selected ? commandAttentionGuidance(selected, dashboard, servers) : null
  const queued = commands.filter((command) => command.state === 'queued' || command.state === 'uploading').length
  const running = commands.filter((command) => command.state === 'leased' || command.state === 'preparing' || command.state === 'running').length
  const retryScheduled = commands.filter((command) => command.state === 'retry_scheduled').length
  const completed = commands.filter((command) => command.state === 'succeeded').length
  const filteredCommands = commands.filter((command) =>
    (!query || `${command.action} ${command.target} ${command.id} ${servers.find((server) => server.id === command.serverId)?.name ?? ''}`.toLowerCase().includes(query.toLowerCase()))
    && (stateFilter === 'all' || command.state === stateFilter)
    && (targetFilter === 'all' || command.target === targetFilter)
    && (actionFilter === 'all' || command.action === actionFilter)
    && (timeFilter === 'all' || Date.now() - new Date(command.createdAt).getTime() <= Number(timeFilter) * 60 * 60 * 1000))
  const columns: TableColumn<Command>[] = [
    { header: 'Command', key: 'command', render: (command) => <RecordLink meta={shortID(command.id)} title={command.action} /> },
    { header: 'Target', key: 'target', render: (command) => <Mono>{command.target}</Mono> },
    // A command carries the server it was queued for, and the runner lets an
    // operator queue against a target other than the selected one. The queue
    // has to say which cluster each row will actually change.
    { header: 'Server', key: 'server', render: (command) => servers.find((server) => server.id === command.serverId)?.name ?? <Mono>{shortID(command.serverId)}</Mono> },
    { header: 'State', key: 'state', render: (command) => <CommandStateBadge state={command.state} /> },
    { header: 'Attempts', key: 'attempts', numeric: true, render: (command) => `${command.attempt} / ${command.maxAttempts}` },
    { header: 'Next attempt', key: 'next', render: (command) => command.nextAttemptAt ? formatDateTime(command.nextAttemptAt) : '—' },
    { header: 'Updated', key: 'updated', render: (command) => formatDateTime(command.updatedAt) },
    { header: 'Action', key: 'action', render: (command) => <Button onClick={() => setSelectedID(command.id)} size="sm" variant={command.id === selectedID ? 'secondary' : 'ghost'}>{command.id === selectedID ? 'Selected' : 'Inspect'}</Button> },
  ]
  return (
    <Page width="full">
      <DetailHeader
        status={attention.length ? <StatusDot tone="danger">{attention.length} need attention</StatusDot> : <StatusDot tone="success">No attention required</StatusDot>}
        subtitle="Durable, explicitly targeted operations with ordered attempts and bounded retries."
        title="Runs"
      />
      <MetricGrid columns={5}>
        <Metric label="Queued" tone={queued ? 'accent' : 'neutral'} value={String(queued)} />
        <Metric label="Running" tone={running ? 'accent' : 'neutral'} value={String(running)} />
        <Metric label="Retry scheduled" tone={retryScheduled ? 'warning' : 'neutral'} value={String(retryScheduled)} />
        <Metric label="Needs attention" tone={attention.length ? 'danger' : 'success'} value={String(attention.length)} />
        <Metric label="Completed" tone="success" value={String(completed)} />
      </MetricGrid>
      <DetailLayout
        aside={selected ? (
          <Panel
            actions={<Button aria-label="Close command details" iconStart="close" onClick={() => setSelectedID('')} size="sm" variant="ghost">Close</Button>}
            caption={<CommandStateBadge state={selected.state} />}
            title={commandLabel(selected.action)}
          >
            <Rows>
				{guidance ? <Banner title="Why this needs attention" tone="warning"><Rows gap="tight"><Body size="sm">{guidance.summary}</Body>{guidance.blockers.length ? <List plain>{guidance.blockers.map((blocker) => <ListRow key={blocker} subtitle={blocker} title="Current blocker" />)}</List> : null}<Body size="sm"><strong>How to recover:</strong> {guidance.recovery}</Body>{selected.action === 'observability.core' ? <Inline><Button onClick={onOpenGateway} size="sm" variant="secondary">Gateway setup</Button><Button onClick={onOpenSwarm} size="sm" variant="secondary">Swarm placement</Button><Button onClick={onOpenDiagnostics} size="sm" variant="ghost">Agent diagnostics</Button></Inline> : null}</Rows></Banner> : null}
              <Facts columns={1} items={[
                { label: 'Command ID', mono: true, value: selected.id },
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
				{selected.state === 'needs_attention' || selected.state === 'retry_scheduled' ? <Button disabled={Boolean(retrying) || Boolean(guidance?.blockRetry)} loading={retrying === selected.id} onClick={() => void retry(selected)} variant="accent">{guidance?.blockRetry ? 'Resolve prerequisites before retrying' : 'Retry reviewed command'}</Button> : null}
            </Rows>
          </Panel>
        ) : undefined}
      >
        <Panel caption={`${commands.length} retained command${commands.length === 1 ? '' : 's'}`} flush title="Command ledger">
          <Toolbar actions={<Button iconStart="refresh" onClick={() => void onRefresh()} size="sm" variant="ghost">Refresh</Button>}>
            <Input aria-label="Search runs" iconStart="search" onChange={(event) => setQuery(event.target.value)} placeholder="Search action, target, or run ID" value={query} />
            <Select aria-label="Filter commands by state" onChange={(event) => setStateFilter(event.target.value)} options={[{ label: 'State: All', value: 'all' }, ...Array.from(new Set(commands.map((command) => command.state))).map((state) => ({ label: capitalize(state.replaceAll('_', ' ')), value: state }))]} value={stateFilter} />
            <Select aria-label="Filter commands by target" onChange={(event) => setTargetFilter(event.target.value)} options={[{ label: 'Target: All', value: 'all' }, ...Array.from(new Set(commands.map((command) => command.target))).map((target) => ({ label: target, value: target }))]} value={targetFilter} />
            <Select aria-label="Filter commands by action" onChange={(event) => setActionFilter(event.target.value)} options={[{ label: 'Action: All', value: 'all' }, ...Array.from(new Set(commands.map((command) => command.action))).map((action) => ({ label: action, value: action }))]} value={actionFilter} />
            <Select aria-label="Filter commands by time" onChange={(event) => setTimeFilter(event.target.value)} options={[{ label: 'Time: All retained', value: 'all' }, { label: 'Last hour', value: '1' }, { label: 'Last 24 hours', value: '24' }, { label: 'Last 7 days', value: '168' }]} value={timeFilter} />
          </Toolbar>
          <DataTable
            columns={columns}
            empty={<EmptyState description="No cluster mutations have been queued yet." icon="clock" title="No commands" />}
            rowKey={(command) => command.id}
            rows={filteredCommands}
          />
        </Panel>
      </DetailLayout>
      {selected ? <Panel title="Audit timeline"><ActivityFeed events={[
        { action: 'requested command', actor: selected.actor, at: selected.createdAt, id: `${selected.id}-requested`, target: selected.target, tone: 'accent' },
        ...(selected.lastAttemptAt ? [{ action: `attempt ${selected.attempt} started`, at: selected.lastAttemptAt, id: `${selected.id}-attempt`, target: selected.action, tone: 'warning' as const }] : []),
        { action: `recorded ${selected.state.replaceAll('_', ' ')}`, at: selected.updatedAt, id: `${selected.id}-result`, target: selected.action, tone: selected.state === 'succeeded' ? 'success' : selected.state === 'needs_attention' || selected.state === 'failed' ? 'danger' : 'default' },
      ]} /></Panel> : null}
      {attention.length > 0 ? <Panel caption="Uncertain outcomes are never replayed blindly" title="Failure evidence"><List plain>{attention.map((command) => <ListRow key={command.id} subtitle={command.failureSummary ?? command.lastError ?? 'Inspect the explicit target before retrying.'} title={`${command.action} · ${command.target}`} trailing={<CommandStateBadge state={command.state} />} />)}</List></Panel> : null}
    </Page>
  )
}

function commandAttentionGuidance(command: Command, dashboard: DashboardData | null, servers: Server[]) {
	if (command.state !== 'needs_attention' && command.state !== 'failed') return null
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
			if (!dashboard.nodes.some((node) => node.state === 'ready' && node.availability === 'active' && node.labels?.['nim.stateful'] === 'true')) blockers.push('No ready active node has the required nim.stateful=true placement label.')
			if (!dashboard.observability.coreInstalled) blockers.push('Docker currently reports no swarmops-observability stack, so the earlier run did not leave a working monitoring deployment.')
		}
	}
	return {
		blockRetry: blockers.some((blocker) => !blocker.startsWith('Docker currently reports')),
		blockers,
		recovery: command.recoveryHint ?? (command.action === 'observability.core' ? 'Restore the agent connection, install the managed gateway, assign stateful placement, then retry. SwarmOps will stop again if its reviewed assets or Swarm configs are missing.' : 'Inspect the explicit target and verify the intended change is absent before retrying.'),
		summary: command.failureSummary ?? (command.action === 'observability.core' ? 'SwarmOps started the core monitoring change but could not prove that Prometheus, Alertmanager, and Jaeger completed. Automatic replay stopped to avoid duplicating an uncertain cluster mutation.' : command.lastError ?? 'SwarmOps could not confirm that this operation completed.'),
	}
}

function commandLabel(action: string) {
	if (action === 'observability.core') return 'Core monitoring change'
	return action
}

function TaskList({ tasks }: { tasks: Task[] }) {
  const columns: TableColumn<Task>[] = [
    { header: 'Task', key: 'id', render: (task) => <Mono>{shortID(task.id)}</Mono> },
    { header: 'Desired', key: 'desired', render: (task) => task.desiredState },
    { header: 'Current', key: 'current', render: (task) => task.currentState },
    { header: 'Started', key: 'started', render: (task) => formatDateTime(task.startedAt) },
    { header: 'Error', key: 'error', render: (task) => task.error || '—' },
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

function DeploymentPlan({ plan }: { plan: ComposePlan }) {
  return <Banner title="Compose policy accepted" tone="success"><strong>{plan.services.join(', ')}</strong> · {shortDigest(plan.digest)}{plan.targetNodeId ? ` · pinned to ${shortID(plan.targetNodeId)}` : ''}{plan.warnings.map((warning) => <StatusDot key={warning} tone="warning">{warning}</StatusDot>)}</Banner>
}

function StatusBadge({ health, label }: { health: string; label?: string }) {
  const variant: BadgeVariant = health === 'healthy' ? 'success' : health === 'unhealthy' ? 'danger' : health === 'degraded' ? 'warning' : 'neutral'
  return <Badge dot pill size="sm" tone="soft" variant={variant}>{label ?? capitalize(health)}</Badge>
}

function CommandStateBadge({ state }: { state: Command['state'] }) {
  const variant: BadgeVariant = state === 'succeeded'
    ? 'success'
    : state === 'failed' || state === 'needs_attention'
      ? 'danger'
      : state === 'retry_scheduled'
        ? 'warning'
        : state === 'leased' || state === 'preparing' || state === 'running'
          ? 'accent'
          : 'neutral'
  return <Badge dot pill size="sm" tone="soft" variant={variant}>{state.replace('_', ' ')}</Badge>
}

function useHashWorkspace(): [WorkspacePage, (page: WorkspacePage) => void] {
	const read = () => {
		const value = window.location.hash.slice(1)
		if (isWorkspacePage(value)) return value
		return LEGACY_ROUTES[value] ?? 'overview'
	}
  const [page, setPage] = useState<WorkspacePage>(read)
  useEffect(() => { const update = () => setPage(read()); window.addEventListener('hashchange', update); return () => window.removeEventListener('hashchange', update) }, [])
  return [page, (next) => { window.location.hash = next; setPage(next) }]
}

function useCoreTopology(onExpired: () => void) {
	const [core, setCore] = useState<CoreTopology | null>(null)
	const [error, setError] = useState('')
	const refresh = useCallback(async () => {
		setError('')
		try {
			setCore(await api.coreTopology())
		} catch (reason) {
			if (reason instanceof APIError && reason.status === 401) onExpired()
			else setError(messageOf(reason))
		}
	}, [onExpired])
	useEffect(() => { void refresh() }, [refresh])
	return { core, error, refresh }
}

function useServers(onExpired: () => void) {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [servers, setServers] = useState<Server[]>([])
  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setServers(await api.servers())
    } catch (reason) {
      if (reason instanceof APIError && reason.status === 401) onExpired()
      else setError(messageOf(reason))
    } finally {
      setLoading(false)
    }
  }, [onExpired])
	useEffect(() => {
	  void refresh()
	  const timer = window.setInterval(() => void refresh(), 30_000)
	  return () => window.clearInterval(timer)
	}, [refresh])
  return { error, loading, refresh, servers }
}

function useAuditEvents(enabled: boolean, onExpired: () => void) {
  const [error, setError] = useState('')
  const [events, setEvents] = useState<AuditEvent[] | null>(null)
  const [loading, setLoading] = useState(false)
	const [settled, setSettled] = useState(false)
  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setEvents(await api.auditEvents())
    } catch (reason) {
      if (reason instanceof APIError && reason.status === 401) onExpired()
      else setError(messageOf(reason))
    } finally { setLoading(false); setSettled(true) }
  }, [onExpired])
  useEffect(() => {
    if (enabled) void refresh()
  }, [enabled, refresh])
  return {
		error,
		events: events ?? [],
		initialLoading: enabled && !settled,
		refresh,
		refreshing: enabled && settled && loading,
	}
}

function useCommands(enabled: boolean, onExpired: () => void) {
  const [commands, setCommands] = useState<Command[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
	const [settled, setSettled] = useState(false)
  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setCommands(await api.commands())
    } catch (reason) {
      if (reason instanceof APIError && reason.status === 401) onExpired()
      else setError(messageOf(reason))
    } finally {
      setLoading(false)
			setSettled(true)
    }
  }, [onExpired])
  useEffect(() => {
    if (!enabled) return
    void refresh()
    const timer = window.setInterval(() => void refresh(), 5000)
    return () => window.clearInterval(timer)
  }, [enabled, refresh])
  return {
		commands,
		error,
		initialLoading: enabled && !settled,
		refresh,
		refreshing: enabled && settled && loading,
	}
}

function useDashboard(serverID: string, onExpired: () => void) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const refresh = useCallback(async () => {
    if (!serverID) {
      setData(null)
      setError('')
      setRefreshing(false)
      return
    }
    api.selectServer(serverID)
    setRefreshing(true); setError('')
    try {
      const [overview, stacks, traefik, observability] = await Promise.all([api.overview(), api.stacks(), api.traefik(), api.observability()])
      setData({ nodes: overview.nodes, observability, overview, services: overview.services, stacks, traefik })
    } catch (reason) {
      if (reason instanceof APIError && reason.status === 401) onExpired()
      else setError(messageOf(reason))
    } finally { setRefreshing(false) }
  }, [onExpired, serverID])
  useEffect(() => {
    if (!serverID) {
      setData(null)
      setError('')
      return
    }
    void refresh()
    const timer = window.setInterval(() => void refresh(), 30000)
    return () => window.clearInterval(timer)
  }, [refresh, serverID])
  return { data, error, refresh, refreshing }
}

function nodeHealth(node: Node): 'healthy' | 'degraded' | 'unhealthy' {
  if (node.state !== 'ready') return 'unhealthy'
  if (node.availability !== 'active' || hostProbeHealth(node) === 'degraded') return 'degraded'
  return 'healthy'
}

function hostProbeHealth(node: Node): 'healthy' | 'degraded' | 'unknown' {
  if (node.agent.healthy) return 'healthy'
  return node.agent.address || node.agent.error ? 'degraded' : 'unknown'
}

function serverHealth(server: Server): Health {
	return server.agentHealth?.state ?? (server.connectionState === 'connected' ? 'unknown' : 'unknown')
}

function serverCanManage(server: Server) {
	return server.connectionState === 'connected' && server.swarmControlAvailable && serverHealth(server) === 'healthy'
}

function messageOf(reason: unknown) { return reason instanceof Error ? reason.message : 'Unexpected operation failure' }
function connectionErrorOf(reason: unknown): ConnectionError {
  if (reason instanceof APIError) return { detail: reason.detail, message: reason.message, requestID: reason.requestID }
  return { message: messageOf(reason) }
}
function capitalize(value: string) { return value ? value[0].toUpperCase() + value.slice(1) : 'Unknown' }
function shortID(value?: string) { return value ? value.slice(0, 12) : '—' }
function shortDigest(value: string) { return value.length > 20 ? `${value.slice(0, 19)}…` : value }
function formatNumber(value: number) { return new Intl.NumberFormat().format(Math.round(value)) }
function formatBytes(value: number) { if (!value) return '0 B'; const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB']; const power = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1); return `${(value / 1024 ** power).toFixed(power > 1 ? 1 : 0)} ${units[power]}` }
function formatDateTime(value?: string) { return value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—' }
function formatClock(value?: string) {
  const date = value ? new Date(value) : undefined
  if (!date || Number.isNaN(date.getTime())) return 'an unknown time'
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(date)
}

function formatDuration(seconds?: number) { if (!seconds) return '—'; const days = Math.floor(seconds / 86400); const hours = Math.floor((seconds % 86400) / 3600); return days ? `${days}d ${hours}h` : `${hours}h` }
