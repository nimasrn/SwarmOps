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
  ComposePlan,
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

type Page = 'audit' | 'builds' | 'commands' | 'fleet' | 'nodes' | 'observability' | 'overview' | 'provisioning' | 'servers' | 'services' | 'stacks' | 'traefik'
type ClusterPage = Exclude<Page, 'audit' | 'commands' | 'fleet' | 'provisioning' | 'servers'>

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
  audit: 'Audit trail',
  builds: 'Image builds',
  commands: 'Command queue',
  fleet: 'Fleet operations',
  nodes: 'Nodes',
  observability: 'Observability',
  overview: 'Cluster overview',
  provisioning: 'Provisioning',
  servers: 'Servers',
  services: 'Services',
  stacks: 'Stacks',
  traefik: 'Traefik & TLS',
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

  return (
    <main className="swarmops-auth-page">
      <form onSubmit={submit}>
        <AuthScreen
          action={{ disabled: !username || !password, label: 'Sign in to SwarmOps', loading: pending, onClick: submit }}
          brand={<Brand />}
          footer={<span>Use the configured operator account.</span>}
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

function Console({ onLogout, session }: { onLogout: () => void; session: Session }) {
  const [page, setPage] = useHashPage()
  const toast = useToast()
  const { error: serversError, loading: serversLoading, refresh: refreshServers, servers } = useServers(onLogout)
  const { error: auditError, events: auditEvents, loading: auditLoading } = useAuditEvents(page === 'audit', onLogout)
  const { commands, error: commandsError, loading: commandsLoading, refresh: refreshCommands } = useCommands(page === 'commands', onLogout)
  const [activeServerID, setActiveServerID] = useState('')
  const activeServer = servers.find((server) => server.id === activeServerID && server.connectionState === 'connected' && server.swarmControlAvailable)
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
        { icon: 'settings' as const, key: 'nodes', label: 'Nodes', onSelect: () => setPage('nodes') },
        { icon: 'document' as const, key: 'stacks', label: 'Stacks', onSelect: () => setPage('stacks') },
        { icon: 'sparkle' as const, key: 'services', label: 'Services', onSelect: () => setPage('services') },
        { icon: 'upload' as const, key: 'builds', label: 'Image builds', onSelect: () => setPage('builds') },
      ],
    },
    {
      key: 'platform',
      label: 'Platform',
      items: [
        { icon: 'external' as const, key: 'traefik', label: 'Traefik & TLS', onSelect: () => setPage('traefik') },
        { icon: 'trend-up' as const, key: 'observability', label: 'Observability', onSelect: () => setPage('observability') },
        { icon: 'clock' as const, key: 'commands', label: 'Command queue', onSelect: () => setPage('commands') },
        { icon: 'clock' as const, key: 'fleet', label: 'Fleet operations', onSelect: () => setPage('fleet') },
        { icon: 'clock' as const, key: 'audit', label: 'Audit trail', onSelect: () => setPage('audit') },
      ],
    },
    {
      key: 'bootstrap',
      label: 'Bootstrap',
      items: [
        { icon: 'settings' as const, key: 'servers', label: 'Servers', onSelect: () => setPage('servers') },
        { icon: 'play' as const, key: 'provisioning', label: 'Provisioning', onSelect: () => setPage('provisioning') },
      ],
    },
  ], [setPage])

  const health = data?.overview.health ?? 'unknown'
  return (
    <AdminShell
      brand={<Brand />}
      groups={groups}
      sidebarFooter={<><strong>{session.user.username}</strong><span>{activeServer ? `${activeServer.name} · machine API` : 'No server selected'}</span><span>{data ? `Snapshot ${formatDateTime(data.overview.generatedAt)}` : 'Waiting for snapshot'}</span></>}
      title={PAGES[page]}
      toolbar={
        <>
          <StatusBadge health={health} />
          <Button disabled={page === 'commands' ? commandsLoading : !activeServer} iconStart="loading" loading={page === 'commands' ? commandsLoading : refreshing} onClick={() => void (page === 'commands' ? refreshCommands() : refresh())} size="sm" variant="secondary">Refresh</Button>
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
      ) : !activeServer ? (
        <ServerRequiredPage page={page} onOpenServers={() => setPage('servers')} />
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
    case 'overview': return <OverviewDashboard observability={data.observability} overview={data.overview} stacks={data.stacks} traefik={data.traefik} />
  }
}

function ServerRequiredPage({ onOpenServers, page }: { onOpenServers: () => void; page: ClusterPage }) {
  return (
    <Page>
      <EmptyState
        actions={<Button onClick={onOpenServers} variant="secondary">Open servers</Button>}
        description={`${PAGES[page]} needs a connected remote Swarm manager. Connect or select one in Servers, then return here.`}
        icon="server"
        title="Select a Swarm manager"
      />
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

  const reset = () => {
    setAPIKey('')
    setAPIURL('')
    setEditing(null)
    setError(null)
    setName('')
    setPort('9180')
    setTLSFingerprint('')
  }

  const beginReconnect = (server: Server) => {
    setAPIKey('')
    setAPIURL(server.apiUrl ?? '')
    setEditing(server)
    setError(null)
    setName(server.name)
    setPort(String(server.port))
    setTLSFingerprint(server.tlsCertificateFingerprint ?? '')
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
    { header: 'Server', key: 'server', render: (server) => <RecordLink meta={`${server.apiUrl ?? server.host}:${server.port}`} title={server.name} /> },
    { header: 'Connection', key: 'transport', render: (server) => server.connectionType === 'agent_api' ? 'Machine API' : 'Legacy SSH' },
    { header: 'Docker', key: 'docker', render: (server) => server.dockerAvailable ? server.dockerVersion || 'Engine reachable' : 'Not detected' },
    { header: 'Swarm', key: 'swarm', render: (server) => server.swarmControlAvailable ? 'Manager' : server.dockerAvailable ? server.swarmState || 'Not active' : 'Bootstrap required' },
    { header: 'Status', key: 'connection', render: (server) => <StatusBadge health={server.connectionState === 'connected' ? 'healthy' : 'unknown'} label={server.connectionState === 'connected' ? 'Connected' : 'Reconnect required'} /> },
    {
      header: 'Action',
      key: 'action',
      render: (server) => server.connectionType !== 'agent_api'
        ? <Button onClick={() => void removeLegacyProfile(server)} size="sm" variant="ghost">Remove legacy profile</Button>
        : server.connectionState === 'connected'
        ? <Inline gap="tight">{server.swarmControlAvailable ? <Button onClick={() => onSelect(server.id)} size="sm" variant={activeServerID === server.id ? 'secondary' : 'ghost'}>{activeServerID === server.id ? 'Selected' : 'Use server'}</Button> : <Button onClick={onProvision} size="sm" variant="secondary">Open provisioning</Button>}<Button onClick={() => void disconnect(server)} size="sm" variant="ghost">Disconnect</Button></Inline>
        : <Button onClick={() => beginReconnect(server)} size="sm" variant="secondary">Reconnect</Button>,
    },
  ]

  const connectionReady = Boolean(apiKey) && Boolean(apiURL) && Boolean(tlsFingerprint)
  return (
    <Page>
      <DetailHeader subtitle="Install a native machine agent first, then connect it here with its HTTPS URL, port, certificate pin, and API key. SwarmOps never asks for a Docker socket or SSH account." title="Remote servers" />
      <Banner title="1. Install SwarmOps Agent on the Docker host" tone="info">
        <Rows gap="tight">
          <Body size="sm">The host downloads the release binary from GitHub. It runs only <code>swarmops-agent</code> and the local rollback updater, <code>SwarmOps Warden</code>; it does not clone or compile source. The default setup listens on port <code>9180</code>, creates its pinned TLS identity under <code>/etc/swarmops-agent/tls</code>, and generates the API key.</Body>
          <CodeBlock label="Linux installer or legacy-agent upgrade" wrap>{`curl -fsSL https://github.com/nimasrn/SwarmOps/releases/latest/download/install-swarmops-agent.sh | sudo bash`}</CodeBlock>
          <Body size="sm">For a current installation, run <code>sudo swarmops-agent upgrade</code>. The one-line installer is also the first-time upgrade for an older agent without that command; it preserves its API key, TLS identity, and listener. The installer prints the public TLS fingerprint, port, and protected API-key file path.</Body>
        </Rows>
      </Banner>
      <Banner title="Use the machine API certificate pin" tone="info">
        <Rows gap="tight">
          <p>The API key authorizes SwarmOps but does not encrypt it. Use the machine agent’s HTTPS listener and enter its public certificate fingerprint in <code>SHA256:&lt;64-hex&gt;</code> form.</p>
          <CodeBlock label="Fingerprint command" wrap>{"openssl x509 -in <agent-certificate.pem> -outform DER | openssl dgst -sha256 -hex"}</CodeBlock>
          <Body size="sm">Verify the fingerprint from the target machine’s trusted console before saving it. The API key is held only in this process while connected; it is never stored in the profile or audit trail.</Body>
        </Rows>
      </Banner>
      <Columns>
        <Panel eyebrow={editing ? 'Reconnect saved target' : '2. Add the installed machine'} title={editing ? `Reconnect ${editing.name}` : 'Add and connect a server'}>
          <Rows as="form" onSubmit={submit}>
            <Input disabled={Boolean(editing)} hint="A local label only; it never affects the remote host." label="Name" onChange={(event) => setName(event.target.value)} required value={name} />
            <Input disabled={Boolean(editing)} hint="HTTPS origin only, for example https://manager.example.com. Enter its port separately." label="Machine API URL" onChange={(event) => setAPIURL(event.target.value)} required type="url" value={apiURL} />
            <Columns><Input disabled={Boolean(editing)} label="Machine API port" min="1" onChange={(event) => setPort(event.target.value)} required type="number" value={port} /><Input disabled={Boolean(editing)} hint="Public SHA-256 fingerprint of the API certificate." label="TLS certificate fingerprint" onChange={(event) => setTLSFingerprint(event.target.value)} placeholder="SHA256:…" required value={tlsFingerprint} /></Columns>
            <Input autoComplete="off" hint={editing ? 'It is intentionally blank because Core never saves it. To rotate it on the host, run sudo swarmops-agent gen key, then paste the printed value here.' : 'It is used to connect now and cleared on disconnect or API restart.'} label="Machine API key" onChange={(event) => setAPIKey(event.target.value)} required type="password" value={apiKey} />
            {error ? <Banner title={error.message} tone="danger"><Rows gap="tight">{error.detail ? <p>{error.detail}</p> : null}{error.requestID ? <Body size="sm">Request ID: <code>{error.requestID}</code></Body> : null}</Rows></Banner> : null}
            <Inline><Button disabled={pending || !connectionReady || (!editing && !name)} loading={pending} type="submit">{editing ? 'Reconnect server' : 'Add and connect server'}</Button>{editing ? <Button onClick={reset} type="button" variant="ghost">Cancel</Button> : null}</Inline>
          </Rows>
        </Panel>
        <Panel eyebrow="3. Verify the connection" title="What SwarmOps checks">
          <TaskProgress caption="A successful connection verifies the certificate pin, authenticates the key, and then asks the local agent for Docker/Swarm readiness." steps={[{ id: 'tls', label: 'Match the required TLS certificate fingerprint', status: 'pending' }, { id: 'key', label: 'Authenticate with the supplied machine API key', status: 'pending' }, { id: 'docker', label: 'Probe Docker and Swarm readiness through fixed API operations', status: 'pending' }]} title="Connection sequence" />
          <Body size="sm">The machine agent must be installed and running first. A connected machine without Docker remains visible, but cluster pages and mutations require a remote Swarm manager.</Body>
        </Panel>
      </Columns>
      <Panel eyebrow="Saved non-secret profiles" title="Servers">
        <DataTable
          caption="Remote server profiles"
          columns={columns}
          empty={<EmptyState description="Install the release agent on a Linux or macOS Docker host, then add its HTTPS URL, port, certificate fingerprint, and API key above." icon="server" title="No servers connected" />}
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
  const selected = services.find((service) => service.id === selectedID) ?? services[0]

  const readLogs = async (service: Service) => {
    setSelectedID(service.id)
    setLogs('')
    setLogsError('')
    try { setLogs((await api.serviceLogs(service.id)).logs) } catch (reason) { setLogsError(messageOf(reason)) }
  }
  const action = async (kind: 'restart' | 'rollback') => {
    if (!selected) return
    setBusy(kind)
    try {
      const command = await api.serviceAction(selected.id, kind)
      toast({ message: `${selected.name}: ${kind} queued (${shortID(command.id)})`, tone: 'success' })
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
  return (
    <Page>
      <DetailHeader subtitle="Logs are read directly from Docker service logs. Restarts and rollbacks use fixed audited command shapes, not browser-supplied shell commands." title="Service control" />
      <Panel flush><DataTable caption="Docker Swarm services" columns={columns} empty={<EmptyState description="No services were returned by the remote Docker Engine." icon="layers" title="No services" />} rowKey={(service) => service.id} rows={services} /></Panel>
      <Columns>
        <Panel eyebrow={selected.stack ?? 'No stack label'} title={selected.name}>
          <Facts items={[{ label: 'Image', mono: true, value: selected.image ?? '—' }, { label: 'Desired tasks', value: String(selected.desiredTasks) }, { label: 'Running tasks', value: String(selected.runningTasks) }, { label: 'Last updated', value: formatDateTime(selected.updatedAt) }]} />
          <Inline><Button loading={busy === 'restart'} onClick={() => void action('restart')} variant="secondary">Force restart</Button><Button loading={busy === 'rollback'} onClick={() => void action('rollback')} variant="danger">Rollback</Button><Button onClick={() => void readLogs(selected)} variant="ghost">Read logs</Button></Inline>
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
          <Switch checked={status.logsEnabled} disabled={pending} description="Runs Alloy globally to collect Docker JSON logs into Loki. Disabling removes that global stack; existing retained logs follow Loki retention." onChange={(event) => { if (event.target.checked) void setLogs(true) }}>Enable log collection</Switch>
          {status.logsEnabled ? <><Input hint="Type the exact confirmation before removing the global collector." label="Disable confirmation" onChange={(event) => setConfirmation(event.target.value)} value={confirmation} /><Button disabled={pending || confirmation !== 'DISABLE_LOG_COLLECTION'} loading={pending} onClick={() => void setLogs(false)} variant="danger">Disable collection</Button></> : <Button disabled={pending} loading={pending} onClick={() => void setLogs(true)}>Enable collection</Button>}
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
    { header: 'Action', key: 'action', render: (command) => command.state === 'needs_attention' || command.state === 'retry_scheduled' ? <Button disabled={Boolean(retrying)} loading={retrying === command.id} onClick={() => void retry(command)} size="sm" variant="secondary">Retry now</Button> : '—' },
  ]
  return (
    <Page>
      <DetailHeader subtitle="Every approved cluster mutation is written to durable command storage before execution. Declarative actions retry with bounded backoff; uncertain or non-idempotent outcomes stop for an operator decision." title="Command queue" />
      {attention.length > 0 ? <Banner title={`${attention.length} command${attention.length === 1 ? '' : 's'} need operator attention`} tone="warning">Inspect the target before retrying. SwarmOps does not replay an in-flight, timed-out, restarted, rollback, or build command automatically.</Banner> : null}
      <Panel eyebrow="Durable ledger" title="Recent commands">
        <DataTable
          caption="SwarmOps command queue"
          columns={columns}
          empty={<EmptyState description="No cluster mutations have been queued yet." icon="clock" title="No commands" />}
          rowKey={(command) => command.id}
          rows={commands}
        />
      </Panel>
      {attention.length > 0 ? <Panel eyebrow="Safe failure detail" title="Commands awaiting review"><List plain>{attention.map((command) => <ListRow key={command.id} subtitle={command.lastError ?? 'Inspect the target before retrying.'} title={`${command.action} · ${command.target}`} />)}</List></Panel> : null}
    </Page>
  )
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
      <DetailHeader subtitle="A host only needs SSH, Python 3, and sudo access for Ansible provisioning. Install Docker and form the Swarm first, then install its machine API before adding it to Servers." title="Cluster provisioning" />
      <Columns>
          <Panel eyebrow="Ansible workflow" title="From fresh hosts to a SwarmOps stack">
            <TaskProgress caption="Run the reviewed bootstrap from the checked-out monorepo after the remote servers are reachable." steps={[{ id: 'docker', label: 'Install Docker and verify managers', status: 'pending' }, { id: 'swarm', label: 'Initialise/join the Swarm and verify quorum', status: 'pending' }, { id: 'agent', label: 'Install the machine API and add each manager in Servers', status: 'pending' }, { id: 'preflight', label: 'Check the reviewed platform manifest against live node capacity', status: 'pending' }, { id: 'secrets', label: 'Create versioned runtime secrets', status: 'pending' }, { id: 'platform', label: 'Deploy Traefik, SwarmOps, and monitoring', status: 'pending' }]} title="Bootstrap checklist" />
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
  const refresh = useCallback(async () => {
    setError('')
    try {
      setEvents(await api.auditEvents())
    } catch (reason) {
      if (reason instanceof APIError && reason.status === 401) onExpired()
      else setError(messageOf(reason))
    }
  }, [onExpired])
  useEffect(() => {
    if (enabled) void refresh()
  }, [enabled, refresh])
  return { error, events: events ?? [], loading: enabled && events === null && !error }
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
