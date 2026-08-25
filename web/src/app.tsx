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
  Columns,
  DataTable,
  DetailHeader,
  EmptyState,
  Facts,
  Icon,
  Inline,
  Input,
  Label,
  List,
  ListRow,
  Metric,
  MetricGrid,
  Mono,
  Page,
  Panel,
  RecordLink,
  ResourceMeter,
  Segmented,
  Select,
  Spinner,
  StatusDot,
  Stack as Rows,
  Switch,
  TaskProgress,
  Textarea,
  Body,
  useToast,
} from '@nim.zone/ui'
import type { BadgeVariant, TableColumn } from '@nim.zone/ui'
import { APIError, api } from './api'
import { OverviewDashboard } from './dashboard'
import type {
  AuditEvent,
  Capacity,
  Command,
  CommandLogEntry,
  ApplicationSpec,
  ApplicationStatus,
  ApprovedWorkload,
  ComposePlan,
  DatabaseStatus,
  Health,
  MobilityMigration,
  MobilityResource,
  MobilityStatus,
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

type Page = 'applications' | 'audit' | 'builds' | 'commands' | 'databases' | 'fleet' | 'mobility' | 'nodes' | 'observability' | 'overview' | 'provisioning' | 'servers' | 'services' | 'stacks' | 'traefik'
type ClusterPage = Exclude<Page, 'audit' | 'commands' | 'fleet' | 'mobility' | 'provisioning' | 'servers'>
type AgentPlatform = 'linux' | 'macos'

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

const PAGES: Record<Page, string> = {
  applications: 'Applications',
  audit: 'Audit trail',
  builds: 'Image builds',
  commands: 'Command queue',
  databases: 'Managed databases',
  fleet: 'Fleet operations',
  mobility: 'Data mobility',
  nodes: 'Nodes',
  observability: 'Observability',
  overview: 'Cluster overview',
  provisioning: 'Provisioning',
  servers: 'Servers',
  services: 'Services',
  stacks: 'Stacks',
  traefik: 'Traefik & TLS',
}

const AGENT_INSTALL_URL = 'https://github.com/nimasrn/SwarmOps/releases/latest/download/install-swarmops-agent.sh'
const AGENT_PLATFORM_OPTIONS: { label: string; value: AgentPlatform }[] = [
  { label: 'Linux', value: 'linux' },
  { label: 'macOS', value: 'macos' },
]

// One command per platform. The installer generates the agent's TLS material,
// machine API key, and one-time enrollment secret, then prints the single
// token pasted into the form beside it.
function agentInstallCommand(platform: AgentPlatform) {
  return platform === 'linux'
    ? `curl -fsSL ${AGENT_INSTALL_URL} | sudo bash`
    : `curl -fsSL ${AGENT_INSTALL_URL} | bash`
}

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
      <div className="swarmops-mark" aria-hidden="true">S</div>
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
          brand={<Brand />}
          footer={
            <Rows gap="tight">
              <span>Use the configured operator account.</span>
              <Button onClick={() => setShowAgentSetup(true)} size="sm" type="button" variant="ghost">Install and connect a server</Button>
            </Rows>
          }
          subtitle="An audited control plane for remote Docker Swarm servers."
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
  return (
    <main className="swarmops-auth-page">
      <AuthScreen
        action={{ label: 'I have the enrollment token — sign in to paste it', onClick: onBack }}
        back={{ label: 'Back to sign in', onClick: onBack }}
        brand={<Brand />}
        subtitle="Run one command on the target host, then sign in and paste the enrollment token it prints."
        title="Connect your first server"
      >
        <AgentInstallGuide />
      </AuthScreen>
    </main>
  )
}

function AgentInstallGuide({ nextStep = 'Sign in and paste the token into SwarmOps' }: { nextStep?: string }) {
  const [platform, setPlatform] = useState<AgentPlatform>('linux')
  const platformLabel = platform === 'linux' ? 'Linux' : 'macOS'
  return (
    <Rows gap="tight">
      <Segmented fullWidth label="Target operating system" onChange={setPlatform} options={AGENT_PLATFORM_OPTIONS} value={platform} />
      <CodeBlock label={`${platformLabel} installation command`} wrap>{agentInstallCommand(platform)}</CodeBlock>
      <Body size="sm">{platform === 'linux'
        ? 'This installs only the SwarmOps agent as a systemd service. It does not install Docker or create or join a Swarm. After enrollment, manage this server in SwarmOps to approve those fixed setup actions.'
        : 'This installs only the agent as a per-user LaunchAgent. Docker Desktop remains a separate managed prerequisite.'}</Body>
      <Body size="sm">The installer generates the agent’s TLS certificate, machine API key, and a single-use enrollment secret, then prints one enrollment token. Allow only the SwarmOps controller to reach the agent’s port.</Body>
      <TaskProgress
        caption="The enrollment token carries the host address, the pinned certificate fingerprint, and a one-time secret — never the machine API key. SwarmOps trades the secret for that key over the pinned connection, and the agent refuses every later use of the same token."
        steps={[
          { detail: 'Run the command above on the target machine.', id: 'install', label: 'Install the agent on the Docker host', status: 'active' },
          { id: 'copy-details', label: 'Copy the enrollment token it prints', status: 'pending' },
          { id: 'connect', label: nextStep, status: 'pending' },
        ]}
        title="Three-step setup"
      />
    </Rows>
  )
}

function Console({ onLogout, session }: { onLogout: () => void; session: Session }) {
  const [page, setPage] = useHashPage()
  const toast = useToast()
  const { error: serversError, loading: serversLoading, refresh: refreshServers, servers } = useServers(onLogout)
  const { error: auditError, events: auditEvents, loading: auditLoading, refresh: refreshAudit } = useAuditEvents(page === 'audit', onLogout)
  const { commands, error: commandsError, loading: commandsLoading, refresh: refreshCommands } = useCommands(page === 'commands', onLogout)
  const [activeServerID, setActiveServerID] = useState('')
  const activeServer = servers.find((server) => server.id === activeServerID && server.connectionState === 'connected' && server.swarmControlAvailable)
  const managers = servers.filter((server) => server.connectionState === 'connected' && server.swarmControlAvailable)
  const { data, error, refresh, refreshing } = useDashboard(activeServer?.id ?? '', onLogout)

  useEffect(() => {
    const next = servers.some((server) => server.id === activeServerID && server.connectionState === 'connected' && server.swarmControlAvailable)
      ? activeServerID
      : servers.find((server) => server.connectionState === 'connected' && server.swarmControlAvailable)?.id ?? ''
    api.selectServer(next)
    if (next !== activeServerID) setActiveServerID(next)
  }, [activeServerID, servers])

  const selectServer = (id: string) => {
    api.selectServer(id)
    setActiveServerID(id)
  }

  const connected = async (server: Server) => {
    await refreshServers()
    if (server.swarmControlAvailable) {
      selectServer(server.id)
      setPage('overview')
      toast({ message: `${server.name} connected`, tone: 'success' })
      return
    }
    setPage('servers')
    toast({ message: server.dockerAvailable ? `${server.name} connected, but cluster operations need a remote Swarm manager` : `${server.name} connected through its machine API, but Docker was not detected on that host.`, tone: 'accent' })
  }

  const signOut = async () => {
    try {
      await api.logout()
    } catch {
      // Removing the local session is safer than leaving a failed sign-out
      // screen usable; the server-side cookie expires independently.
    }
    api.selectServer('')
    onLogout()
  }

  const groups = useMemo(() => [
    {
      key: 'operate',
      label: 'Operate',
      items: [
        { icon: 'home' as const, key: 'overview', label: 'Overview', onSelect: () => setPage('overview') },
        { icon: 'layers' as const, key: 'applications', label: 'Applications', onSelect: () => setPage('applications') },
        { icon: 'server' as const, key: 'nodes', label: 'Nodes', onSelect: () => setPage('nodes') },
        { icon: 'layers' as const, key: 'stacks', label: 'Stacks', onSelect: () => setPage('stacks') },
        { icon: 'activity' as const, key: 'services', label: 'Services', onSelect: () => setPage('services') },
        { icon: 'package' as const, key: 'builds', label: 'Image builds', onSelect: () => setPage('builds') },
        { icon: 'database' as const, key: 'databases', label: 'Databases', onSelect: () => setPage('databases') },
        { icon: 'server' as const, key: 'mobility', label: 'Data mobility', onSelect: () => setPage('mobility') },
      ],
    },
    {
      key: 'platform',
      label: 'Platform',
      items: [
        { icon: 'external' as const, key: 'traefik', label: 'Traefik & TLS', onSelect: () => setPage('traefik') },
        { icon: 'trend-up' as const, key: 'observability', label: 'Observability', onSelect: () => setPage('observability') },
        { icon: 'clock' as const, key: 'commands', label: 'Command queue', onSelect: () => setPage('commands') },
        { icon: 'terminal' as const, key: 'fleet', label: 'Fleet operations', onSelect: () => setPage('fleet') },
        { icon: 'document' as const, key: 'audit', label: 'Audit trail', onSelect: () => setPage('audit') },
      ],
    },
    {
      key: 'bootstrap',
      label: 'Bootstrap',
      items: [
        { icon: 'server' as const, key: 'servers', label: 'Servers', onSelect: () => setPage('servers') },
        { icon: 'play' as const, key: 'provisioning', label: 'Provisioning', onSelect: () => setPage('provisioning') },
      ],
    },
  ], [setPage])

  const health = data?.overview.health ?? 'unknown'
  const refreshAction = page === 'audit'
    ? refreshAudit
    : page === 'commands'
      ? refreshCommands
      : page === 'servers' || !activeServer
        ? refreshServers
        : refresh
  const refreshLoading = page === 'audit'
    ? auditLoading
    : page === 'commands'
      ? commandsLoading
      : page === 'servers' || !activeServer
        ? serversLoading
        : refreshing
  const refreshLabel = page === 'audit'
    ? 'Refresh audit trail'
    : page === 'commands'
      ? 'Refresh command queue'
      : page === 'servers'
        ? 'Refresh servers'
        : activeServer
          ? 'Refresh cluster snapshot'
          : 'Refresh server profiles'

  return (
    <AdminShell
      brand={<Brand />}
      groups={groups}
      sidebarFooter={<><strong>{session.user.username}</strong><span>{activeServer ? `${activeServer.name} · selected manager` : managers.length ? `${managers.length} manager${managers.length === 1 ? '' : 's'} available` : 'No connected manager'}</span><span>{data ? `Snapshot ${formatDateTime(data.overview.generatedAt)}` : activeServer ? 'Refreshing cluster state' : 'Cluster controls are on hold'}</span></>}
      title={PAGES[page]}
      toolbar={
        <>
          <Button iconStart="server" onClick={() => setPage('servers')} size="sm" variant={activeServer ? 'secondary' : 'ghost'}>{activeServer ? activeServer.name : 'Select manager'}</Button>
          <StatusBadge health={activeServer ? health : 'unknown'} label={activeServer ? undefined : managers.length ? 'Manager available' : 'Manager required'} />
          <Button aria-label={refreshLabel} disabled={refreshLoading} iconStart="refresh" loading={refreshLoading} onClick={() => void refreshAction()} size="sm" variant="secondary">Refresh</Button>
          <Button iconStart="sign-out" onClick={() => void signOut()} size="sm" variant="ghost">Sign out</Button>
        </>
      }
      value={page}
    >
      {serversError ? <Banner title="Server list unavailable" tone="danger">{serversError}</Banner> : null}
      {page === 'servers' ? (
        <ServersPage activeServerID={activeServerID} onConnected={connected} onProvision={() => setPage('provisioning')} onRefresh={refreshServers} onSelect={selectServer} servers={servers} toast={toast} />
      ) : page === 'provisioning' ? (
        <ProvisioningPage />
      ) : page === 'fleet' ? (
        <FleetOperationsPage />
      ) : page === 'audit' ? (
        <>
          {auditError ? <Banner title="Audit trail unavailable" tone="danger">{auditError}</Banner> : null}
          {auditLoading ? <LoadingScreen label="Reading the audit trail" /> : <AuditPage events={auditEvents} />}
        </>
      ) : page === 'commands' ? (
        <>
          {commandsError ? <Banner title="Command queue unavailable" tone="danger">{commandsError}</Banner> : null}
          {commandsLoading ? <LoadingScreen label="Reading durable commands" /> : <CommandQueuePage commands={commands} onRefresh={refreshCommands} toast={toast} />}
        </>
      ) : page === 'mobility' ? (
        <MobilityPage activeServer={activeServer} servers={servers} toast={toast} />
      ) : !activeServer ? (
        <ServerRequiredPage
          page={page}
          servers={servers}
          onOpenProvisioning={() => setPage('provisioning')}
          onOpenServers={() => setPage('servers')}
        />
      ) : (
        <>
          {error ? <Banner title="Cluster snapshot unavailable" tone="danger">{error}</Banner> : null}
          {!data ? <LoadingScreen label={serversLoading ? 'Reading server profiles' : 'Reading the selected Docker Swarm'} /> : <PageRouter data={data} page={page} toast={toast} />}
        </>
      )}
    </AdminShell>
  )
}

function PageRouter({
  data,
  page,
  toast,
}: {
  data: DashboardData
  page: ClusterPage
  toast: ReturnType<typeof useToast>
}) {
  switch (page) {
    case 'nodes': return <NodesPage nodes={data.nodes} toast={toast} />
    case 'stacks': return <StacksPage nodes={data.nodes} stacks={data.stacks} toast={toast} />
    case 'services': return <ServicesPage services={data.services} toast={toast} />
    case 'builds': return <BuildsPage toast={toast} />
    case 'traefik': return <TraefikPage status={data.traefik} toast={toast} />
    case 'observability': return <ObservabilityPage status={data.observability} toast={toast} />
    case 'databases': return <DatabasesPage toast={toast} />
    case 'applications': return <ApplicationsPage toast={toast} />
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
  const connected = servers.filter((server) => server.connectionState === 'connected')
  const managers = connected.filter((server) => server.swarmControlAvailable)
  return (
    <Page>
      <DetailHeader
        status={<StatusBadge health="unknown" label="Manager required" />}
        subtitle={`${PAGES[page]} stays unavailable until SwarmOps has a connected remote Swarm manager. This is deliberate: every cluster read or change stays scoped to one explicit target.`}
        title="Connect a Swarm manager"
      />
      <MetricGrid aria-label="Manager connection readiness" columns={3}>
        <Metric
          hint={servers.length ? `${servers.length} saved machine API profile${servers.length === 1 ? '' : 's'}` : 'No machine API profile has been saved yet'}
          icon="server"
          label="Saved targets"
          tone={servers.length ? 'accent' : 'neutral'}
          value={String(servers.length)}
        />
        <Metric
          hint={connected.length ? `${connected.length} target${connected.length === 1 ? '' : 's'} currently connected` : 'Connect a target from the Servers workspace'}
          icon="link"
          label="Live connections"
          tone={connected.length ? 'success' : 'neutral'}
          value={String(connected.length)}
        />
        <Metric
          hint={managers.length ? 'Choose a connected manager in Servers to resume this workspace' : 'Docker cluster reads and mutations remain paused'}
          icon="shield"
          label="Swarm managers"
          tone={managers.length ? 'success' : 'warning'}
          value={String(managers.length)}
        />
      </MetricGrid>
      <Columns>
        <Panel
          description="The browser never receives a Docker socket or creates host credentials. It connects only to a pinned machine API that you add and select deliberately."
          eyebrow="First-run path"
          title="Bring a manager online"
        >
          <TaskProgress
            caption={managers.length
              ? 'A remote Swarm manager is ready. Open Servers to make it the selected target for this workspace.'
              : 'Install the native machine agent on a Docker host, then add its HTTPS endpoint, public certificate fingerprint, and API key in Servers.'}
            steps={[
              { id: 'agent', label: 'Install the machine agent on a Docker host', status: servers.length ? 'done' : 'active' },
              { id: 'connect', label: 'Connect and verify Docker / Swarm readiness', status: managers.length ? 'done' : connected.length ? 'active' : 'pending' },
              { id: 'select', label: `Select a manager and resume ${PAGES[page]}`, status: managers.length ? 'active' : 'pending' },
            ]}
            title="Three safe steps"
          />
          <Inline>
            <Button iconStart="plus" onClick={onOpenServers}>Add or select a server</Button>
            <Button onClick={onOpenProvisioning} variant="secondary">Open provisioning</Button>
          </Inline>
        </Panel>
        <Panel
          description="These controls are intentionally available before a manager is selected, so the setup path is not a dead end."
          eyebrow="Available now"
          title="Keep the control plane moving"
        >
          <List plain>
            <ListRow href="#servers" leading={<Icon name="server" size="sm" />} subtitle="Add, reconnect, or select a pinned machine API target." title="Servers" />
            <ListRow href="#provisioning" leading={<Icon name="play" size="sm" />} subtitle="Follow the reviewed Ansible path for fresh hosts and Swarm quorum." title="Provisioning" />
            <ListRow href="#commands" leading={<Icon name="clock" size="sm" />} subtitle="Review durable command state without exposing remote output." title="Command queue" />
            <ListRow href="#audit" leading={<Icon name="document" size="sm" />} subtitle="Inspect safe, append-only operator audit records." title="Audit trail" />
          </List>
        </Panel>
      </Columns>
    </Page>
  )
}

function ServersPage({
  activeServerID,
  onConnected,
  onProvision,
  onRefresh,
  onSelect,
  servers,
  toast,
}: {
  activeServerID: string
  onConnected: (server: Server) => Promise<void>
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
  const [token, setToken] = useState('')
  const [tokenPending, setTokenPending] = useState(false)
  const [manual, setManual] = useState(false)

  const reset = () => {
    setAPIKey('')
    setAPIURL('')
    setEditing(null)
    setError(null)
    setName('')
    setPort('9180')
    setTLSFingerprint('')
    setToken('')
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

  // The enrollment path is the whole connection flow: one pasted token, one
  // request. SwarmOps performs the one-time secret exchange itself, so the
  // operator never handles the machine API key.
  const enroll = async (event?: FormEvent) => {
    event?.preventDefault()
    setTokenPending(true)
    setError(null)
    try {
      const connected = await api.enrollServer(token.trim(), name.trim())
      setToken('')
      await onConnected(connected)
      reset()
      toast({ message: `${connected.name} enrolled and connected`, tone: 'success' })
    } catch (reason) {
      setError(connectionErrorOf(reason))
    } finally {
      setTokenPending(false)
    }
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

  const bootstrap = async (server: Server, action: 'docker_install' | 'swarm_init') => {
    const description = action === 'docker_install' ? 'install Docker Engine' : `initialise a new Swarm on ${server.host}`
    if (!window.confirm(`Queue a managed action to ${description}? The agent was enrolled by this control plane and will run only this fixed action.`)) return
    try {
      const command = await api.bootstrapServer(server.id, action === 'docker_install'
        ? { action }
        : { action, advertiseAddr: server.host })
      toast({ message: `${server.name}: ${description} queued (${shortID(command.id)})`, tone: 'success' })
    } catch (reason) {
      toast({ message: messageOf(reason), tone: 'danger', duration: 0 })
    }
  }

  const selectedManager = servers.find((server) => server.id === activeServerID && server.connectionState === 'connected' && server.swarmControlAvailable)

  const joinSelectedSwarm = async (server: Server) => {
    if (!selectedManager || selectedManager.id === server.id) {
      toast({ message: 'Select a connected Swarm manager first', tone: 'danger', duration: 0 })
      return
    }
    if (!window.confirm(`Queue a managed action for ${server.name} to join the Swarm managed by ${selectedManager.name}? SwarmOps transfers the join credential directly between enrolled agents and never displays it.`)) return
    try {
      const command = await api.joinServerSwarm(server.id)
      toast({ message: `${server.name}: join to ${selectedManager.name} queued (${shortID(command.id)})`, tone: 'success' })
    } catch (reason) {
      toast({ message: messageOf(reason), tone: 'danger', duration: 0 })
    }
  }

  const columns: TableColumn<Server>[] = [
    { header: 'Server', key: 'server', render: (server) => <RecordLink meta={`${server.apiUrl ?? server.host}:${server.port}`} title={server.name} /> },
    { header: 'Connection', key: 'transport', render: (server) => server.connectionType === 'agent_api' ? 'Machine API' : 'Legacy SSH' },
    { header: 'Docker', key: 'docker', render: (server) => server.dockerAvailable ? server.dockerVersion || 'Engine reachable' : 'Not detected' },
    { header: 'Swarm', key: 'swarm', render: (server) => server.swarmControlAvailable ? 'Manager' : server.dockerAvailable ? server.swarmState || 'Not active' : server.bootstrapAvailable ? 'Managed setup available' : 'Docker unavailable' },
    { header: 'Status', key: 'connection', render: (server) => <StatusBadge health={server.connectionState === 'connected' ? 'healthy' : 'unknown'} label={server.connectionState === 'connected' ? 'Connected' : 'Reconnect required'} /> },
    {
      header: 'Action',
      key: 'action',
      render: (server) => server.connectionType !== 'agent_api'
        ? <Button onClick={() => void removeLegacyProfile(server)} size="sm" variant="ghost">Remove legacy profile</Button>
        : server.connectionState === 'connected'
        ? <Inline gap="tight">{server.swarmControlAvailable ? <Button onClick={() => onSelect(server.id)} size="sm" variant={activeServerID === server.id ? 'secondary' : 'ghost'}>{activeServerID === server.id ? 'Selected' : 'Use server'}</Button> : !server.dockerAvailable && server.bootstrapAvailable ? <Button onClick={() => void bootstrap(server, 'docker_install')} size="sm" variant="secondary">Install Docker</Button> : server.dockerAvailable && server.bootstrapAvailable && server.swarmState === 'inactive' ? selectedManager && selectedManager.id !== server.id ? <Button onClick={() => void joinSelectedSwarm(server)} size="sm" variant="secondary">Join selected Swarm</Button> : <Button onClick={() => void bootstrap(server, 'swarm_init')} size="sm" variant="secondary">Initialize Swarm</Button> : <Button onClick={onProvision} size="sm" variant="secondary">Open provisioning</Button>}<Button onClick={() => void disconnect(server)} size="sm" variant="ghost">Disconnect</Button></Inline>
        : <Button onClick={() => beginReconnect(server)} size="sm" variant="secondary">Reconnect</Button>,
    },
  ]

  const connectionReady = Boolean(apiKey) && Boolean(apiURL) && Boolean(tlsFingerprint)
  return (
    <Page>
      <DetailHeader subtitle="Run one command on the target host, paste the enrollment token it prints, and SwarmOps connects over a pinned machine API. The installer does not install Docker or touch Swarm; managed setup is a separately queued, fixed action." title="Connect a remote server" />
      <Columns>
        <Panel eyebrow="Step 1 · target machine" title="Install the machine agent">
          <AgentInstallGuide nextStep="Paste the token in Step 2" />
        </Panel>
        <Panel eyebrow="Step 2 · SwarmOps" title="Paste the enrollment token">
          <Rows as="form" onSubmit={enroll}>
            <Textarea
              hint="One line, starting with swarmops1. — it carries the host, port, pinned certificate fingerprint, and a single-use secret."
              label="Enrollment token"
              onChange={(event) => setToken(event.target.value)}
              placeholder="swarmops1.…"
              required
              rows={3}
              value={token}
            />
            <Input hint="Optional local label. Defaults to the host in the token." label="Name" onChange={(event) => setName(event.target.value)} value={name} />
            {error && !manual ? <Banner title={error.message} tone="danger"><Rows gap="tight">{error.detail ? <p>{error.detail}</p> : null}{error.requestID ? <Body size="sm">Request ID: <code>{error.requestID}</code></Body> : null}</Rows></Banner> : null}
            <Inline>
              <Button disabled={tokenPending || !token.trim().startsWith('swarmops1.')} loading={tokenPending} type="submit">Enroll and connect server</Button>
              <Button onClick={() => setManual(true)} type="button" variant="ghost">Enter connection details manually</Button>
            </Inline>
          </Rows>
        </Panel>
      </Columns>
      {manual ? (
      <Columns>
        <Panel eyebrow={editing ? 'Reconnect saved target' : 'Advanced'} title={editing ? `Reconnect ${editing.name}` : 'Add a server with explicit details'}>
          <Rows as="form" onSubmit={submit}>
            <Input disabled={Boolean(editing)} hint="A local label only; it never affects the remote host." label="Name" onChange={(event) => setName(event.target.value)} required value={name} />
            <Input disabled={Boolean(editing)} hint="HTTPS origin only, for example https://manager.example.com. Enter its port separately." label="Machine API URL" onChange={(event) => setAPIURL(event.target.value)} required type="url" value={apiURL} />
            <Columns><Input disabled={Boolean(editing)} label="Machine API port" min="1" onChange={(event) => setPort(event.target.value)} required type="number" value={port} /><Input disabled={Boolean(editing)} hint="Public SHA-256 fingerprint of the API certificate." label="TLS certificate fingerprint" onChange={(event) => setTLSFingerprint(event.target.value)} placeholder="SHA256:…" required value={tlsFingerprint} /></Columns>
            <Input autoComplete="off" hint="It is used only for this connection and, when retention is enabled, sealed for restart recovery." label="Machine API key" onChange={(event) => setAPIKey(event.target.value)} required type="password" value={apiKey} />
            {error ? <Banner title={error.message} tone="danger"><Rows gap="tight">{error.detail ? <p>{error.detail}</p> : null}{error.requestID ? <Body size="sm">Request ID: <code>{error.requestID}</code></Body> : null}</Rows></Banner> : null}
            <Inline><Button disabled={pending || !connectionReady || (!editing && !name)} loading={pending} type="submit">{editing ? 'Reconnect server' : 'Add and connect server'}</Button><Button onClick={reset} type="button" variant="ghost">Cancel</Button></Inline>
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
      <Columns>
        <Panel eyebrow="Step 3 · connection check" title="What SwarmOps verifies">
          <TaskProgress caption="A successful connection verifies the certificate pin, authenticates the key, and then asks the local agent for Docker/Swarm readiness." steps={[{ id: 'tls', label: 'Match the required TLS certificate fingerprint', status: 'pending' }, { id: 'key', label: 'Authenticate with the supplied machine API key', status: 'pending' }, { id: 'docker', label: 'Probe Docker and Swarm readiness through fixed API operations', status: 'pending' }]} title="Connection sequence" />
          <Body size="sm">A connected managed machine without Docker remains visible. Its row can queue fixed Docker setup, then fixed Swarm initialization; cluster pages and mutations remain unavailable until a remote Swarm manager is healthy.</Body>
        </Panel>
        <Panel eyebrow="After enrollment" title="Where the machine API key lives">
          <Rows gap="tight">
            <p>SwarmOps receives the key during the one-time exchange and seals it in the controller’s encrypted volume so a restarted controller reconnects on its own. It is never returned by an endpoint, shown in this console, or written to the audit trail.</p>
            <Body size="sm">Disconnecting a server deletes the sealed copy along with the live one. To restore the memory-only posture, set <code>SWARMOPS_RETAIN_MACHINE_KEYS=false</code> and reconnect each host by hand after a restart.</Body>
          </Rows>
        </Panel>
      </Columns>
      <Panel eyebrow="Saved non-secret profiles" title="Servers">
        <DataTable
          caption="Remote server profiles"
          columns={columns}
          empty={<EmptyState description="Start with Step 1 above: run the one-line installer on a Linux or macOS Docker host, then paste the enrollment token it prints." icon="server" title="No servers connected" />}
          rowKey={(server) => server.id}
          rows={servers}
        />
      </Panel>
    </Page>
  )
}

function NodesPage({ nodes, toast }: { nodes: Node[]; toast: ReturnType<typeof useToast> }) {
  const [selectedID, setSelectedID] = useState(nodes[0]?.id ?? '')
  const [tasks, setTasks] = useState<Task[]>([])
  const [taskError, setTaskError] = useState('')
  const [busy, setBusy] = useState(false)
  const selected = nodes.find((node) => node.id === selectedID) ?? nodes[0]

  useEffect(() => {
    if (!selected) return
    let live = true
    setTaskError('')
    void api.nodeTasks(selected.id).then((value) => { if (live) setTasks(value) }).catch((reason) => { if (live) setTaskError(messageOf(reason)) })
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

  const columns: TableColumn<Node>[] = [
    { header: 'Node', key: 'node', render: (node) => <RecordLink meta={shortID(node.id)} onClick={() => setSelectedID(node.id)} title={node.hostname} /> },
    { header: 'Role', key: 'role', render: (node) => <span>{node.role}{node.manager?.leader ? ' · leader' : ''}</span> },
    { header: 'Availability', key: 'availability', render: (node) => <span>{node.availability}</span> },
    { header: 'Host probe', key: 'agent', render: (node) => <StatusBadge health={hostProbeHealth(node)} label={node.agent.healthy ? 'Online' : node.agent.error ? 'Unavailable' : 'Not configured'} /> },
    { header: 'State', key: 'state', render: (node) => <StatusBadge health={nodeHealth(node)} label={node.state} /> },
  ]

  if (!selected) return <EmptyState description="No nodes were returned by Docker Engine." icon="settings" title="No Swarm nodes" />
  return (
    <Page>
      <DetailHeader subtitle="Choose a node to inspect its Docker, operating-system, capacity, and task data." title="Node inventory" />
      <Panel flush><DataTable caption="Docker Swarm nodes" columns={columns} empty={<EmptyState description="No nodes were returned by the remote Docker Engine." icon="server" title="No Swarm nodes" />} rowKey={(node) => node.id} rows={nodes} /></Panel>
      <Columns aria-label={`${selected.hostname} details`}>
        <Panel eyebrow={`${selected.role} · ${selected.state}`} title={selected.hostname}>
          <Rows>
            <Resource capacity={selected.cpu} capacityOnly detail={selected.load1 !== undefined ? `One-minute load ${selected.load1.toFixed(2)} · CPU use is not inferred from load.` : 'No live load sample yet.'} label="CPU capacity" unit="cores" />
            <Resource capacity={selected.memory} label="Memory" />
            <Resource capacity={selected.disk} label="Host root disk" />
          </Rows>
          <Facts
            items={[
              { label: 'Address', mono: true, value: selected.address ?? '—' },
              { label: 'OS', value: selected.os ?? selected.platform.os ?? '—' },
              { label: 'Kernel', mono: true, value: selected.kernel ?? '—' },
              { label: 'Architecture', value: selected.platform.architecture ?? '—' },
              { label: 'Docker', mono: true, value: selected.engine.version ?? selected.dockerVersion ?? '—' },
              { label: 'Storage driver', value: selected.engine.driver ?? '—' },
              { label: 'cgroup driver', value: selected.engine.cgroupDriver ?? '—' },
              { label: 'Uptime', value: formatDuration(selected.uptimeSeconds) },
            ]}
          />
        </Panel>
        <Panel eyebrow="Controlled change" title="Availability">
          <Body size="sm">Changing availability is an audited Docker node update. Draining preserves stateful workload safety only when those services were designed for relocation.</Body>
          <Inline>
            {['active', 'pause', 'drain'].map((availability) => <Button disabled={busy || selected.availability === availability} key={availability} loading={busy && selected.availability !== availability} onClick={() => void updateAvailability(availability)} size="sm" variant={availability === 'drain' ? 'danger' : 'secondary'}>{capitalize(availability)}</Button>)}
          </Inline>
          <Label as="p">Host probe state</Label>
          <StatusBadge health={hostProbeHealth(selected)} label={selected.agent.healthy ? `Last inventory ${formatDateTime(selected.agent.collectedAt)}` : selected.agent.error ?? 'Not configured for this remote target'} />
        </Panel>
      </Columns>
      <Panel eyebrow="Workload placement" title={`Tasks on ${selected.hostname}`}>
        {taskError ? <Banner tone="warning">{taskError}</Banner> : null}
        {tasks.length === 0 ? <EmptyState description="No task records are currently assigned to this node." icon="sparkle" title="No tasks" /> : <TaskList tasks={tasks} />}
      </Panel>
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
            <Button disabled={!name || !compose || pending !== null} loading={pending === 'deploy'} onClick={() => void deploy()}>Deploy stack</Button>
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
  if (!selected) return <EmptyState description="Docker Engine returned no Swarm services." icon="sparkle" title="No services" />
  const canScale = selected.mode.toLowerCase() === 'replicated'
  return (
    <Page>
      <DetailHeader subtitle="Logs are read directly from Docker service logs. Restarts and rollbacks use fixed audited command shapes, not browser-supplied shell commands." title="Service control" />
      <Panel flush><DataTable caption="Docker Swarm services" columns={columns} empty={<EmptyState description="No services were returned by the remote Docker Engine." icon="layers" title="No services" />} rowKey={(service) => service.id} rows={services} /></Panel>
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
          <Button disabled={!archive || !image || pending} loading={pending} onClick={() => void submit()}>Start bounded build</Button>
        </Panel>
        <Panel eyebrow="Durable command" title="Build status">
          {result ? <Rows><Banner tone={result.state === 'needs_attention' ? 'warning' : 'success'} title={`Build ${result.state.replace('_', ' ')}`}>Command <Mono>{result.id}</Mono> owns this source archive until it succeeds or needs operator attention.</Banner><Body size="sm">Build output is never returned to the browser or audit trail. Follow this command in Command queue.</Body></Rows> : <EmptyState description="A source archive is retained only in protected command storage until its queued build succeeds. Build output is not exposed in the console." icon="upload" title="No build command" />}
        </Panel>
      </Columns>
    </Page>
  )
}

// ApplicationsPage is the whole deploy flow: choose an approved slot, give it
// an image, tick the databases it needs, and SwarmOps renders and deploys the
// Compose. The operator writes no Compose, no Traefik label, and no
// connection string.
function ApplicationsPage({ toast }: { toast: ReturnType<typeof useToast> }) {
  const [applications, setApplications] = useState<ApplicationStatus[] | null>(null)
  const [approved, setApproved] = useState<ApprovedWorkload[]>([])
  const [databases, setDatabases] = useState<DatabaseStatus[]>([])
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [preview, setPreview] = useState('')
  const [removals, setRemovals] = useState<Record<string, string>>({})

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
  const [backend, setBackend] = useState('')

  const refresh = async () => {
    const [apps, slots, dbs] = await Promise.all([api.applications(), api.approvedApplications(), api.databases()])
    setApplications(apps)
    setApproved(slots)
    setDatabases(dbs)
    if (!selected && slots.length > 0) setSelected(slots[0].name)
  }
  useEffect(() => { void refresh().catch((reason) => setError(messageOf(reason))) }, [])

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
  const columns: TableColumn<ApplicationStatus>[] = [
    { header: 'Application', key: 'name', render: (status) => <RecordLink meta={status.stack} title={status.spec.name} /> },
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
          </Rows>
        </Panel>
      </Columns>
      {error ? <Banner tone="danger" title="This application cannot be deployed">{error}</Banner> : null}
      <Inline>
        <Button disabled={pending || !selected || !image} loading={pending} onClick={() => void plan()} variant="secondary">Preview the rendered Compose</Button>
        <Button disabled={pending || !selected || !image} loading={pending} onClick={() => void deploy()}>Deploy application</Button>
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
                  <Button disabled={Boolean(pending)} loading={pending === database.engine} onClick={() => void set(database, true)}>Deploy {database.displayName}</Button>
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

function MobilityPage({ activeServer, servers, toast }: { activeServer?: Server; servers: Server[]; toast: ReturnType<typeof useToast> }) {
  const [status, setStatus] = useState<MobilityStatus | null>(null)
  const [error, setError] = useState('')
  const [pending, setPending] = useState('')
  const [targets, setTargets] = useState<Record<string, string>>({})
  const [abandonConfirmations, setAbandonConfirmations] = useState<Record<string, string>>({})

  const refresh = useCallback(async () => {
    try {
      setError('')
      setStatus(await api.mobility())
    } catch (reason) {
      setError(messageOf(reason))
    }
  }, [])

  useEffect(() => {
    void refresh()
    const timer = window.setInterval(() => { void refresh() }, 5000)
    return () => window.clearInterval(timer)
  }, [refresh])

  const targetsForMove = servers.filter((server) => server.connectionState === 'connected' && server.connectionType === 'agent_api' && server.dockerAvailable && server.managed && server.mobilityAvailable)

  const move = async (resource: MobilityResource) => {
    const target = targets[resource.resource] ?? ''
    if (!target) {
      toast({ message: 'Choose an enrolled destination server first.', tone: 'danger', duration: 0 })
      return
    }
    const destination = servers.find((server) => server.id === target)
    const handover = resource.resource === 'control_plane'
      ? 'SwarmOps will fence new panel mutations, copy its encrypted controller state, and move the API to the destination. The original data remains until the replacement has stayed healthy and an administrator explicitly retires it.'
      : 'The service will be quiesced before its local data is copied. The original data remains until the replacement has stayed healthy and an administrator explicitly retires it.'
    if (!window.confirm(`Move ${resource.displayName} to ${destination?.name ?? 'the selected server'}? ${handover}`)) return
    setPending(resource.resource)
    try {
      const command = await api.moveResource(resource.resource, target)
      toast({ message: `${resource.displayName} handover queued (${shortID(command.id)})`, tone: 'success' })
      await refresh()
    } catch (reason) {
      toast({ message: messageOf(reason), tone: 'danger', duration: 0 })
    } finally {
      setPending('')
    }
  }

  const retire = async (migration: MobilityMigration) => {
    if (!window.confirm(`Retire the original ${migration.displayName} data now? SwarmOps will first verify the replacement is no longer running on every source node, then remove only the reviewed source volumes.`)) return
    setPending(migration.id)
    try {
      const command = await api.retireMigration(migration.id)
      toast({ message: `Source retirement queued (${shortID(command.id)})`, tone: 'success' })
      await refresh()
    } catch (reason) {
      toast({ message: messageOf(reason), tone: 'danger', duration: 0 })
    } finally {
      setPending('')
    }
  }

  const abandon = async (migration: MobilityMigration) => {
    const confirmation = abandonConfirmations[migration.id] ?? ''
    const expected = `ABANDON_HANDOVER_${migration.id}`
    if (confirmation !== expected) return
    if (!window.confirm(`Close this failed ${migration.displayName} handover record? This does not delete source data, restart services, or make an uncertain workload safe. Complete any manual recovery first.`)) return
    setPending(migration.id)
    try {
      await api.abandonMigration(migration.id, confirmation)
      toast({ message: 'Handover record closed. Source data was retained.', tone: 'success' })
      await refresh()
    } catch (reason) {
      toast({ message: messageOf(reason), tone: 'danger', duration: 0 })
    } finally {
      setPending('')
    }
  }

  if (error) return <Banner tone="danger" title="Data mobility is unavailable">{error}</Banner>
  if (!status) return <LoadingScreen label="Reading handover status" />
  return (
    <Page>
      <DetailHeader subtitle="Move the control plane, managed databases, and retained monitoring data through a maintenance handover: databases and monitoring quiesce before transfer; the control plane uses a fenced self-handover. Every path streams the reviewed local volume, starts on the target, holds it healthy, then waits for explicit source retirement." title="Data mobility" />
      {!activeServer ? <Banner title="A selected Swarm manager is required to start or retire a handover" tone="warning">You can review existing handovers here, but choose a connected remote Swarm manager in Servers before making a change.</Banner> : null}
      <Banner title="No automatic deletion" tone="info">A successful copy does not remove any source volume. The Retire source button appears only after the replacement passes the configured sustained-health window.</Banner>
      <Columns>
        {status.resources.map((resource) => {
          const migration = status.migrations.find((candidate) => candidate.resource === resource.resource && candidate.state !== 'retired' && candidate.state !== 'abandoned')
          const target = targets[resource.resource] ?? ''
          const destinationOptions = targetsForMove.map((server) => ({ label: `${server.name} · ${server.host}`, value: server.id }))
          return (
            <Panel eyebrow={migration ? migration.state.replaceAll('_', ' ') : `requires ${resource.requiredNodeLabel}=true`} key={resource.resource} title={resource.displayName}>
              <Rows gap="tight">
                <StatusBadge health={mobilityHealth(migration?.state)} label={migration ? capitalize(migration.state.replaceAll('_', ' ')) : 'Ready to plan'} />
                <Body size="sm">{resource.requireManager ? 'The target must be an active Swarm manager with the control-plane label.' : 'The target must be an active Swarm node with the stateful label.'}</Body>
                <List plain>
                  {resource.components.map((component) => <ListRow key={component.service} subtitle={<Mono>{component.volume}</Mono>} title={component.displayName} />)}
                </List>
                {migration ? (
                  <Rows gap="tight">
                    <Facts items={[
                      { label: 'Destination node', mono: true, value: shortID(migration.targetNodeId) },
                      { label: 'Updated', value: formatDateTime(migration.updatedAt) },
                      ...(migration.cleanupEligibleAt ? [{ label: 'Source cleanup', value: migration.state === 'ready_for_retirement' ? 'Administrator decision required' : `Available after ${formatDateTime(migration.cleanupEligibleAt)}` }] : []),
                    ]} />
                    {migration.failure ? <Banner title="Operator review required" tone="warning">{migration.failure}</Banner> : null}
                    <List plain>
                      {migration.components.map((component) => <ListRow key={component.service} subtitle={`${component.state.replaceAll('_', ' ')}${component.healthySince ? ` · healthy since ${formatDateTime(component.healthySince)}` : ''}${component.bytes ? ` · ${formatBytes(component.bytes)} transferred` : ''}`} title={component.displayName} />)}
                    </List>
                    {migration.state === 'ready_for_retirement' ? <Button disabled={!activeServer || pending === migration.id} loading={pending === migration.id} onClick={() => void retire(migration)} variant="danger">Retire source data</Button> : null}
                    {migration.state === 'needs_attention' && !migration.sourceCleanupStarted ? <Rows gap="tight">
                      <Input hint="This only closes the failed handover record. It keeps source data and does not repair, remove, or restart any workload." label="Close handover confirmation" onChange={(event) => setAbandonConfirmations((current) => ({ ...current, [migration.id]: event.target.value }))} placeholder={`ABANDON_HANDOVER_${migration.id}`} value={abandonConfirmations[migration.id] ?? ''} />
                      <Button disabled={pending === migration.id || (abandonConfirmations[migration.id] ?? '') !== `ABANDON_HANDOVER_${migration.id}`} loading={pending === migration.id} onClick={() => void abandon(migration)} variant="ghost">Close failed handover record</Button>
                    </Rows> : null}
                  </Rows>
                ) : (
                  <Rows gap="tight">
                    <Select disabled={!activeServer || pending !== ''} label="Destination enrolled server" onChange={(event) => setTargets((current) => ({ ...current, [resource.resource]: event.target.value }))} options={destinationOptions} placeholder={destinationOptions.length ? 'Choose a managed destination' : 'No managed destinations connected'} value={target} />
                    <Button disabled={!activeServer || !target || pending !== ''} loading={pending === resource.resource} onClick={() => void move(resource)}>Start safe handover</Button>
                  </Rows>
                )}
              </Rows>
            </Panel>
          )
        })}
      </Columns>
      {status.migrations.some((migration) => migration.state === 'abandoned') ? <Panel eyebrow="Source retained" title="Closed handovers">
        <Rows as="ul" gap="tight" className="nim-body nim-body--sm">
          {status.migrations.filter((migration) => migration.state === 'abandoned').map((migration) => <li key={migration.id}>{migration.displayName} was closed after operator review on {formatDateTime(migration.updatedAt)}. No source cleanup ran for this record.</li>)}
        </Rows>
      </Panel> : null}
      <Panel eyebrow="Handover contract" title="What SwarmOps proves before cleanup">
        <Rows as="ul" gap="tight" className="nim-body nim-body--sm">
          <li>Database and monitoring services are stopped before a local-volume copy, so their archive is not a live database filesystem snapshot. The control-plane handover instead fences panel mutations and carries its durable handover state inside the encrypted copy.</li>
          <li>The target agent accepts only reviewed SwarmOps volume names and returns a streamed integrity receipt; it cannot receive a browser-selected path or arbitrary archive destination.</li>
          <li>The replacement must remain running and healthy for the configured burn-in before an administrator can retire the original source volume.</li>
          <li>Before cleanup, SwarmOps checks the replacement is still healthy on the exact target. A failed pre-cleanup check keeps source data intact; a failed record can be closed only with explicit confirmation before source cleanup begins.</li>
        </Rows>
      </Panel>
    </Page>
  )
}

function TraefikPage({ status, toast }: { status: TraefikStatus; toast: ReturnType<typeof useToast> }) {
  const running = status.service?.health === 'healthy'
  const [confirmation, setConfirmation] = useState('')
  const [pending, setPending] = useState(false)
  const reconcile = async () => {
    setPending(true)
    try {
      const command = await api.reconcileTraefik(confirmation)
      toast({ message: `Traefik reconciliation queued (${shortID(command.id)})`, tone: 'success' })
      setConfirmation('')
    } catch (reason) { toast({ message: messageOf(reason), tone: 'danger', duration: 0 }) } finally { setPending(false) }
  }
  return (
    <Page>
      <DetailHeader status={<StatusBadge health={running ? 'healthy' : 'degraded'} label={running ? 'Traefik healthy' : 'Traefik not healthy'} />} subtitle="SwarmOps discovers Traefik and can reconcile only the checked-in edge stack. DNS and certificate credentials stay in Swarm secrets, never browser inputs." title="Traefik & certificate management" />
      <Columns>
        <Panel eyebrow="Edge" title="Traefik service">
          {status.service ? <Facts items={[{ label: 'Service', value: status.service.name }, { label: 'Image', mono: true, value: status.service.image ?? '—' }, { label: 'Tasks', value: `${status.service.runningTasks} / ${status.service.desiredTasks}` }, { label: 'Update', value: status.service.updateState || '—' }]} /> : <EmptyState description="The expected traefik_traefik service was not found in the Docker inventory." icon="external" title="Traefik undiscovered" />}
          {status.dashboardURL ? <List plain><ListRow href={status.dashboardURL} leading={<Icon name="external" size="sm" />} rel="noreferrer" target="_blank" title="Open protected Traefik dashboard" /></List> : <Body size="sm">Set `SWARMOPS_TRAEFIK_DASHBOARD_URL` only to the protected dashboard hostname; it is not inferred from a route.</Body>}
          <Input hint="The trusted Traefik manifest uses existing external secrets and host settings; no browser-supplied routing or credentials are accepted." label="Reconcile confirmation" onChange={(event) => setConfirmation(event.target.value)} value={confirmation} />
          <Button disabled={pending || confirmation !== 'DEPLOY_TRAEFIK'} loading={pending} onClick={() => void reconcile()} variant="secondary">Reconcile Traefik</Button>
        </Panel>
        <Panel eyebrow="Certificates" title="Operational contract">
          <Rows as="ul" gap="tight" className="nim-body nim-body--sm"><li>ACME/DNS provider credentials are versioned external Swarm secrets.</li><li>The dashboard is available only through an authenticated `api@internal` route; port 8080 is never published.</li><li>Prometheus reads Traefik’s internal metrics entrypoint; metrics are not exposed on the public edge.</li><li>Certificate renewal health should be checked in Traefik logs and the dashboard before changing DNS or revoking credentials.</li></Rows>
        </Panel>
      </Columns>
    </Page>
  )
}

function ObservabilityPage({ status, toast }: { status: ObservabilityStatus; toast: ReturnType<typeof useToast> }) {
  const [pending, setPending] = useState(false)
  const [confirmation, setConfirmation] = useState('')
  const [coreConfirmation, setCoreConfirmation] = useState('')
  const [agentConfirmation, setAgentConfirmation] = useState('')
  const [logRemovalRequested, setLogRemovalRequested] = useState(false)
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
      <DetailHeader subtitle="One cluster-wide observability stack owns Grafana, Prometheus, Alertmanager, and Jaeger. Log collection and host probes are separate, explicit global deployments because they inspect every node." title="Observability" />
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
          <Body size="sm">One API action deploys the reviewed Grafana, Prometheus, Alertmanager, and Jaeger stack. It requires the Grafana admin-password secret and persistent capacity first; the baseline Alertmanager intentionally has no external receiver until an operator installs a reviewed receiver configuration.</Body>
          <TaskProgress caption={status.coreInstalled ? (status.coreHealthy ? 'The core stack is healthy in Docker.' : 'The core stack is present but Docker reports at least one service as degraded.') : 'Provision the core stack before trusting monitoring links.'} steps={[{ id: 'prometheus', label: 'Prometheus discovery, rules, and retention', status: status.coreInstalled ? (status.coreHealthy ? 'done' : 'failed') : 'pending' }, { id: 'alertmanager', label: 'Alert grouping and routing boundary', status: status.coreInstalled ? (status.coreHealthy ? 'done' : 'failed') : 'pending' }, { id: 'grafana', label: 'Grafana access control and overview', status: status.coreInstalled ? (status.coreHealthy ? 'done' : 'failed') : 'pending' }, { id: 'jaeger', label: 'Jaeger durable storage', status: status.coreInstalled ? (status.coreHealthy ? 'done' : 'failed') : 'pending' }]} title="Core readiness" />
          {status.coreInstalled ? <><Input hint="Type the exact confirmation before removing shared monitoring." label="Remove-core confirmation" onChange={(event) => setCoreConfirmation(event.target.value)} value={coreConfirmation} /><Button disabled={pending || coreConfirmation !== 'REMOVE_OBSERVABILITY_CORE'} loading={pending} onClick={() => void setCore(false)} variant="danger">Remove core monitoring</Button></> : <Button disabled={pending} loading={pending} onClick={() => void setCore(true)}>Deploy core monitoring</Button>}
        </Panel>
        <Panel eyebrow="Explicit cluster-wide collection" title="Docker service logs">
          <Switch checked={status.logsEnabled} disabled={pending} description={status.logsEnabled ? 'Alloy is collecting Docker JSON logs globally. Turning the switch off opens the confirmation step; the stack is not removed until you confirm it.' : 'Runs Alloy globally to collect Docker JSON logs into Loki. Enabling queues the reviewed global stack.'} onChange={(event) => { if (event.target.checked) void setLogs(true); else setLogRemovalRequested(true) }}>Enable log collection</Switch>
          {status.logsEnabled ? (
            <Rows gap="tight">
              {!logRemovalRequested ? <Button disabled={pending} onClick={() => setLogRemovalRequested(true)} variant="danger">Begin collection removal</Button> : null}
              {logRemovalRequested ? <Banner title="Confirm global log collector removal" tone="warning">This removes the reviewed global log-collection stack. Existing retained logs follow Loki retention; it does not delete them from the browser.</Banner> : null}
              {logRemovalRequested ? <Input hint="Type the exact confirmation before SwarmOps queues the global stack removal." label="Disable confirmation" onChange={(event) => setConfirmation(event.target.value)} value={confirmation} /> : null}
              {logRemovalRequested ? <Inline><Button disabled={pending || confirmation !== 'DISABLE_LOG_COLLECTION'} loading={pending} onClick={() => void setLogs(false)} variant="danger">Disable collection</Button><Button disabled={pending} onClick={() => { setConfirmation(''); setLogRemovalRequested(false) }} variant="ghost">Keep collection enabled</Button></Inline> : null}
            </Rows>
          ) : <Button disabled={pending} loading={pending} onClick={() => void setLogs(true)}>Enable collection</Button>}
        </Panel>
        <Panel eyebrow="Optional host probe" title="Node inventory agent">
          <Body size="sm">The optional global stack installs a read-only SwarmOps agent plus node-exporter. Together they expose host CPU, memory, disk, Docker metadata, and durable fleet-job status only on the private overlay. The SwarmOps agent has a read-only Docker socket and host-root mount, so installation and removal both require an exact confirmation.</Body>
          <Input hint={status.agentInstalled ? 'Type REMOVE_NODE_AGENT to remove the global host probe.' : 'Type INSTALL_NODE_AGENT to install the global host probe.'} label={status.agentInstalled ? 'Remove-agent confirmation' : 'Install-agent confirmation'} onChange={(event) => setAgentConfirmation(event.target.value)} value={agentConfirmation} />
          {status.agentInstalled ? <Button disabled={pending || agentConfirmation !== 'REMOVE_NODE_AGENT'} loading={pending} onClick={() => void setAgent(false)} variant="danger">Remove node agent</Button> : <Button disabled={pending || agentConfirmation !== 'INSTALL_NODE_AGENT'} loading={pending} onClick={() => void setAgent(true)}>Install node agent</Button>}
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
        <ActivityFeed empty={<EmptyState description="The control plane has not recorded an operation yet." icon="clock" title="No audit events" />} events={events.map((event) => ({ action: `${event.action} · ${event.outcome}`, actor: event.actor, at: event.occurredAt, icon: event.outcome === 'success' ? 'check' as const : 'danger' as const, id: event.id, target: event.target, tone: event.outcome === 'success' ? 'success' as const : 'danger' as const }))} />
      </Panel>
    </Page>
  )
}

function CommandQueuePage({ commands, onRefresh, toast }: { commands: Command[]; onRefresh: () => Promise<void>; toast: ReturnType<typeof useToast> }) {
  const [retrying, setRetrying] = useState('')
  const [logCommandID, setLogCommandID] = useState('')
  const [logs, setLogs] = useState<CommandLogEntry[]>([])
  const [logsError, setLogsError] = useState('')
  const [logsLoading, setLogsLoading] = useState(false)
  const selectedLogCommand = commands.find((command) => command.id === logCommandID)
  const loadLogs = useCallback(async (id: string, showLoading = false) => {
    if (showLoading) setLogsLoading(true)
    try {
      setLogs(await api.commandLogs(id))
      setLogsError('')
    } catch (reason) {
      setLogsError(messageOf(reason))
    } finally {
      if (showLoading) setLogsLoading(false)
    }
  }, [])
  const openLogs = (command: Command) => {
    setLogCommandID(command.id)
    setLogs([])
    setLogsError('')
    void loadLogs(command.id, true)
  }
  useEffect(() => {
    if (!logCommandID) return
    const active = selectedLogCommand?.state === 'queued' || selectedLogCommand?.state === 'running' || selectedLogCommand?.state === 'retry_scheduled'
    if (!active) return
    const timer = window.setInterval(() => { void loadLogs(logCommandID) }, 2000)
    return () => window.clearInterval(timer)
  }, [loadLogs, logCommandID, selectedLogCommand?.state])
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
  const columns: TableColumn<Command>[] = [
    { header: 'Command', key: 'command', render: (command) => <RecordLink meta={shortID(command.id)} title={command.action} /> },
    { header: 'Target', key: 'target', render: (command) => <Mono>{command.target}</Mono> },
    { header: 'State', key: 'state', render: (command) => <CommandStateBadge state={command.state} /> },
    { header: 'Attempts', key: 'attempts', numeric: true, render: (command) => `${command.attempt} / ${command.maxAttempts}` },
    { header: 'Next attempt', key: 'next', render: (command) => command.nextAttemptAt ? formatDateTime(command.nextAttemptAt) : '—' },
    { header: 'Updated', key: 'updated', render: (command) => formatDateTime(command.updatedAt) },
    {
      header: 'Action',
      key: 'action',
      render: (command) => (
        <Inline gap="tight">
          <Button onClick={() => openLogs(command)} size="sm" variant="ghost">{command.logCount ? `Logs (${command.logCount})` : 'Logs'}</Button>
          {command.state === 'needs_attention' || command.state === 'retry_scheduled'
            ? <Button disabled={Boolean(retrying)} loading={retrying === command.id} onClick={() => void retry(command)} size="sm" variant="secondary">Retry now</Button>
            : null}
        </Inline>
      ),
    },
  ]
  return (
    <Page>
      <DetailHeader subtitle="Every approved cluster mutation is written to durable command storage before execution. Declarative actions retry with bounded backoff; uncertain or non-idempotent outcomes stop for an operator decision." title="Command queue" />
      {attention.length > 0 ? <Banner title={`${attention.length} command${attention.length === 1 ? '' : 's'} need operator attention`} tone="warning">Inspect the target before retrying. SwarmOps does not replay an in-flight, timed-out, restarted, rollback, or build command automatically.</Banner> : null}
      <Columns>
        <Panel eyebrow="Durable ledger" title="Recent commands">
          <DataTable
            caption="SwarmOps command queue"
            columns={columns}
            empty={<EmptyState description="No cluster mutations have been queued yet." icon="clock" title="No commands" />}
            rowKey={(command) => command.id}
            rows={commands}
          />
        </Panel>
        <Panel eyebrow="Encrypted execution evidence" title={selectedLogCommand ? `Logs · ${selectedLogCommand.action}` : 'Command logs'}>
          <Rows gap="tight">
            {selectedLogCommand ? <Inline gap="tight"><Body size="sm">{selectedLogCommand.target} · attempt {selectedLogCommand.attempt || 1} · {selectedLogCommand.state.replace('_', ' ')}</Body><Button onClick={() => setLogCommandID('')} size="sm" variant="ghost">Clear</Button></Inline> : null}
            {logsError ? <Banner title="Command logs unavailable" tone="danger">{logsError}</Banner> : null}
            {logsLoading ? <Spinner label="Loading command logs" size="sm" /> : null}
            {selectedLogCommand && logs.length ? <CodeBlock label="Encrypted command evidence" wrap>{formatCommandLogs(logs)}</CodeBlock> : null}
            {!selectedLogCommand ? <EmptyState description="Choose Logs on a command to keep its durable execution evidence beside the queue. Running commands refresh here automatically." icon="document" title="No command selected" /> : null}
            {selectedLogCommand && !logsLoading && !logsError && !logs.length ? <EmptyState description="This command has not emitted a retained operational event yet. Running commands refresh here automatically." icon="document" title="No command logs yet" /> : null}
          </Rows>
        </Panel>
      </Columns>
      {attention.length > 0 ? <Panel eyebrow="Safe failure detail" title="Commands awaiting review"><List plain>{attention.map((command) => <ListRow key={command.id} subtitle={command.lastError ?? 'Inspect the target before retrying.'} title={`${command.action} · ${command.target}`} />)}</List></Panel> : null}
    </Page>
  )
}

function formatCommandLogs(logs: CommandLogEntry[]) {
  return logs.map((entry) => `${formatDateTime(entry.occurredAt)} · ${entry.source} · ${entry.level.toUpperCase()}\n${entry.message}`).join('\n\n')
}

function FleetOperationsPage() {
  return (
    <Page>
      <DetailHeader subtitle="Queue and inspect reviewed Ansible jobs from a trusted workstation. Remote SSH targets intentionally have no browser-to-host probe or arbitrary-command path." title="Fleet operations" />
      <Columns>
        <Panel eyebrow="SSH inventory" title="Read fleet status">
          <CodeBlock label="Command" wrap>{"make swarmops-fleet-status INVENTORY=deploy/ansible/inventory.yml RUN_ID=fleet-<generated-id>"}</CodeBlock>
          <Banner title="Safe operating boundary" tone="info">Use the workstation command to queue only <code>node-health-report</code> or <code>warm-docker-cache</code>. The remote-server console does not attach host probes or expose job output.</Banner>
        </Panel>
        <Panel eyebrow="Trusted workstation" title="Queue a durable run">
          <CodeBlock label="Command" wrap>{"make swarmops-fleet-run INVENTORY=deploy/ansible/inventory.yml OPERATION=node-health-report"}</CodeBlock>
          <Body size="sm">The workstation re-submits the same run ID with bounded exponential backoff. Once a host accepts its transient systemd unit, the host runner records attempts and retries its reviewed operation without exposing output.</Body>
        </Panel>
      </Columns>
    </Page>
  )
}

function ProvisioningPage() {
  return (
    <Page>
      <DetailHeader subtitle="Install the machine agent first, enroll it in Servers, then approve reviewed Docker and Swarm setup from the managed-server workflow. SwarmOps never performs an unauthorised host bootstrap from the installer." title="Cluster provisioning" />
      <Columns>
          <Panel eyebrow="Ansible workflow" title="From fresh hosts to a SwarmOps stack">
            <TaskProgress caption="Run the reviewed bootstrap from the checked-out monorepo after the remote servers are reachable." steps={[{ id: 'agent', label: 'Install the machine agent and add the server in Servers', status: 'pending' }, { id: 'docker', label: 'Approve Docker setup from the managed-server workflow', status: 'pending' }, { id: 'swarm', label: 'Initialise or join the Swarm and verify quorum', status: 'pending' }, { id: 'preflight', label: 'Check the reviewed platform manifest against live node capacity', status: 'pending' }, { id: 'secrets', label: 'Create versioned runtime secrets', status: 'pending' }, { id: 'platform', label: 'Deploy Traefik, SwarmOps, and monitoring', status: 'pending' }]} title="Bootstrap checklist" />
        </Panel>
        <Panel eyebrow="Runbook entrypoint" title="Credential-safe invocation">
          <CodeBlock label="Command" wrap>{"make swarmops-provision"}</CodeBlock>
          <Body size="sm">The command accepts fresh Debian/Ubuntu managers, asks for their SSH addresses, username, and password at the terminal, then installs Docker and forms the Swarm without writing credentials to an inventory file. Prefer SSH keys in production and use a vault/secret manager for long-lived credentials.</Body>
          <CodeBlock label="Command" wrap>{"make swarmops-preflight MANIFEST=deploy/swarmops/platform.example.yml"}</CodeBlock>
          <Banner tone="warning" title="Production gate">Do not enable browser mutations, image pushes, ACME DNS credentials, or a public dashboard until the preflight checks and secret creation steps complete.</Banner>
        </Panel>
      </Columns>
    </Page>
  )
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

function Resource({ capacity, capacityOnly = false, detail, label, unit }: { capacity: Capacity; capacityOnly?: boolean; detail?: string; label: string; unit?: string }) {
  const total = capacity.capacity
  const percent = capacity.percent || (total > 0 ? (capacity.used / total) * 100 : 0)
  const tone = percent >= 90 ? 'danger' : percent >= 75 ? 'warning' : 'accent'
  const value = capacityOnly
    ? `${formatNumber(total)} ${unit ?? ''}`.trim()
    : unit ? `${formatNumber(capacity.used)} / ${formatNumber(total)} ${unit}` : `${formatBytes(capacity.used)} / ${formatBytes(total)}`
  return <ResourceMeter detail={detail} label={label} percent={capacityOnly ? undefined : percent} tone={tone} value={value} />
}

function StatusBadge({ health, label }: { health: string; label?: string }) {
  const variant: BadgeVariant = health === 'healthy' ? 'success' : health === 'unhealthy' ? 'danger' : health === 'degraded' ? 'warning' : 'neutral'
  return <Badge dot pill size="sm" tone="soft" variant={variant}>{label ?? capitalize(health)}</Badge>
}

function mobilityHealth(state?: string): Health {
  if (state === 'ready_for_retirement' || state === 'retired') return 'healthy'
  if (state === 'needs_attention') return 'degraded'
  return 'unknown'
}

function CommandStateBadge({ state }: { state: Command['state'] }) {
  const variant: BadgeVariant = state === 'succeeded' ? 'success' : state === 'needs_attention' ? 'warning' : state === 'retry_scheduled' ? 'accent' : 'neutral'
  return <Badge dot pill size="sm" tone="soft" variant={variant}>{state.replace('_', ' ')}</Badge>
}

function Brand() { return <div className="swarmops-brand"><span className="swarmops-mark" aria-hidden="true">S</span><span><strong>SwarmOps</strong><small>Remote Docker Swarm control plane</small></span></div> }

function useHashPage(): [Page, (page: Page) => void] {
  const read = () => (Object.prototype.hasOwnProperty.call(PAGES, window.location.hash.slice(1)) ? window.location.hash.slice(1) as Page : 'overview')
  const [page, setPage] = useState<Page>(read)
  useEffect(() => { const update = () => setPage(read()); window.addEventListener('hashchange', update); return () => window.removeEventListener('hashchange', update) }, [])
  return [page, (next) => { window.location.hash = next; setPage(next) }]
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
    const timer = window.setInterval(() => void refresh(), 5000)
    return () => window.clearInterval(timer)
  }, [refresh])
  return { error, loading, refresh, servers }
}

function useAuditEvents(enabled: boolean, onExpired: () => void) {
  const [error, setError] = useState('')
  const [events, setEvents] = useState<AuditEvent[] | null>(null)
  const [loading, setLoading] = useState(false)
  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setEvents(await api.auditEvents())
    } catch (reason) {
      if (reason instanceof APIError && reason.status === 401) onExpired()
      else setError(messageOf(reason))
    } finally { setLoading(false) }
  }, [onExpired])
  useEffect(() => {
    if (enabled) void refresh()
  }, [enabled, refresh])
  return { error, events: events ?? [], loading: enabled && (loading || events === null && !error), refresh }
}

function useCommands(enabled: boolean, onExpired: () => void) {
  const [commands, setCommands] = useState<Command[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
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
    }
  }, [onExpired])
  useEffect(() => {
    if (!enabled) return
    void refresh()
    const timer = window.setInterval(() => void refresh(), 5000)
    return () => window.clearInterval(timer)
  }, [enabled, refresh])
  return { commands, error, loading, refresh }
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
function formatDuration(seconds?: number) { if (!seconds) return '—'; const days = Math.floor(seconds / 86400); const hours = Math.floor((seconds % 86400) / 3600); return days ? `${days}d ${hours}h` : `${hours}h` }
