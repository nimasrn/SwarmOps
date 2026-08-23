import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import {
  ActivityFeed,
  AdminShell,
  AuthScreen,
  Badge,
  Banner,
  Button,
  Card,
  DetailHeader,
  EmptyState,
  Input,
  ResourceMeter,
  Select,
  Spinner,
  Stat,
  Switch,
  Table,
  TaskProgress,
  Textarea,
  useToast,
} from 'nim'
import type { BadgeVariant, TableColumn } from 'nim'
import { APIError, api } from './api'
import type {
  AuditEvent,
  BuildResult,
  Capacity,
  ComposePlan,
  Node,
  ObservabilityStatus,
  Overview,
  Service,
  Session,
  Stack,
  Task,
  TraefikStatus,
} from './types'

type Page = 'audit' | 'builds' | 'nodes' | 'observability' | 'overview' | 'provisioning' | 'services' | 'stacks' | 'traefik'

interface DashboardData {
  audit: AuditEvent[]
  nodes: Node[]
  observability: ObservabilityStatus
  overview: Overview
  services: Service[]
  stacks: Stack[]
  traefik: TraefikStatus
}

const PAGES: Record<Page, string> = {
  audit: 'Audit trail',
  builds: 'Image builds',
  nodes: 'Nodes',
  observability: 'Observability',
  overview: 'Cluster overview',
  provisioning: 'Provisioning',
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
          footer={<span>Use the single operator account configured as a Swarm secret.</span>}
          subtitle="An audited, manager-only control plane for this Docker Swarm."
          title="Cluster operations, with a boundary."
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
  const { data, error, refresh, refreshing } = useDashboard(onLogout)
  const toast = useToast()

  const signOut = async () => {
    try {
      await api.logout()
    } catch {
      // Removing the local session is safer than leaving a failed sign-out
      // screen usable; the server-side cookie expires independently.
    }
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
        { icon: 'clock' as const, key: 'audit', label: 'Audit trail', onSelect: () => setPage('audit') },
      ],
    },
    {
      key: 'bootstrap',
      label: 'Bootstrap',
      items: [
        { icon: 'play' as const, key: 'provisioning', label: 'Provisioning', onSelect: () => setPage('provisioning') },
      ],
    },
  ], [setPage])

  const health = data?.overview.health ?? 'unknown'
  return (
    <AdminShell
      brand={<Brand />}
      groups={groups}
      sidebarFooter={<><strong>{session.user.username}</strong><span>Manager-scoped session</span><span>{data ? `Snapshot ${formatDateTime(data.overview.generatedAt)}` : 'Waiting for snapshot'}</span></>}
      title={PAGES[page]}
      toolbar={
        <>
          <StatusBadge health={health} />
          <Button iconStart="loading" loading={refreshing} onClick={() => void refresh()} size="sm" variant="secondary">Refresh</Button>
          <Button iconStart="sign-out" onClick={() => void signOut()} size="sm" variant="ghost">Sign out</Button>
        </>
      }
      value={page}
    >
      {error ? <Banner className="swarmops-page-banner" title="Cluster snapshot unavailable" tone="danger">{error}</Banner> : null}
      {!data ? <LoadingScreen label="Reading the Docker Swarm state" /> : (
        <PageRouter data={data} onRefresh={refresh} page={page} toast={toast} />
      )}
    </AdminShell>
  )
}

function PageRouter({
  data,
  onRefresh,
  page,
  toast,
}: {
  data: DashboardData
  onRefresh: () => Promise<void>
  page: Page
  toast: ReturnType<typeof useToast>
}) {
  switch (page) {
    case 'nodes': return <NodesPage nodes={data.nodes} onRefresh={onRefresh} toast={toast} />
    case 'stacks': return <StacksPage nodes={data.nodes} stacks={data.stacks} onRefresh={onRefresh} toast={toast} />
    case 'services': return <ServicesPage onRefresh={onRefresh} services={data.services} toast={toast} />
    case 'builds': return <BuildsPage toast={toast} />
    case 'traefik': return <TraefikPage onRefresh={onRefresh} status={data.traefik} toast={toast} />
    case 'observability': return <ObservabilityPage onRefresh={onRefresh} status={data.observability} toast={toast} />
    case 'audit': return <AuditPage events={data.audit} />
    case 'provisioning': return <ProvisioningPage />
    default: return <OverviewPage overview={data.overview} />
  }
}

function OverviewPage({ overview }: { overview: Overview }) {
  const { summary } = overview
  return (
    <div className="swarmops-page">
      <DetailHeader
        meta={`Last refreshed ${formatDateTime(overview.generatedAt)}`}
        status={<StatusBadge health={overview.health} />}
        subtitle="Live inventory comes from Docker Engine and the read-only SwarmOps node agents."
        title="Cluster state"
      />
      <section className="swarmops-stat-grid" aria-label="Cluster summary">
        <Card variant="raised"><Stat label="Nodes ready" unit={`/ ${summary.nodes}`} value={summary.readyNodes} /></Card>
        <Card variant="raised"><Stat label="Managers" value={summary.managers} /></Card>
        <Card variant="raised"><Stat label="Services" unit={` · ${summary.runningTasks} tasks`} value={summary.services} /></Card>
        <Card variant="raised"><Stat label="Service health" value={<HealthWord health={summary.serviceHealth} />} /></Card>
      </section>
      <section className="swarmops-overview-grid">
        <Card header={<SectionTitle eyebrow="Capacity" title="Cluster allocation" />} variant="raised">
          <div className="swarmops-meter-list">
            <Resource capacity={summary.totalCpu} capacityOnly detail="Capacity is CPU cores; load is shown on individual nodes." label="CPU capacity" unit="cores" />
            <Resource capacity={summary.totalMemory} label="Memory" />
            <Resource capacity={summary.totalDisk} label="Root disk" />
          </div>
        </Card>
        <Card header={<SectionTitle eyebrow="Scheduling" title="Node posture" />} variant="raised">
          <div className="swarmops-node-posture">
            {overview.nodes.map((node) => (
              <div className="swarmops-node-posture__row" key={node.id}>
                <div><strong>{node.hostname}</strong><span>{node.role} · {node.availability}</span></div>
                <StatusBadge health={nodeHealth(node)} />
              </div>
            ))}
          </div>
        </Card>
      </section>
    </div>
  )
}

function NodesPage({ nodes, onRefresh, toast }: { nodes: Node[]; onRefresh: () => Promise<void>; toast: ReturnType<typeof useToast> }) {
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
      await api.setNodeAvailability(selected.id, availability)
      toast({ message: `${selected.hostname} is now ${availability}`, tone: 'success' })
      await onRefresh()
    } catch (reason) {
      toast({ message: messageOf(reason), tone: 'danger', duration: 0 })
    } finally {
      setBusy(false)
    }
  }

  const columns: TableColumn<Node>[] = [
    { header: 'Node', key: 'node', render: (node) => <button className="swarmops-table-link" onClick={() => setSelectedID(node.id)} type="button"><strong>{node.hostname}</strong><span>{shortID(node.id)}</span></button> },
    { header: 'Role', key: 'role', render: (node) => <span>{node.role}{node.manager?.leader ? ' · leader' : ''}</span> },
    { header: 'Availability', key: 'availability', render: (node) => <span>{node.availability}</span> },
    { header: 'Agent', key: 'agent', render: (node) => <StatusBadge health={node.agent.healthy ? 'healthy' : 'degraded'} label={node.agent.healthy ? 'Online' : 'Unavailable'} /> },
    { header: 'State', key: 'state', render: (node) => <StatusBadge health={nodeHealth(node)} label={node.state} /> },
  ]

  if (!selected) return <EmptyState description="No nodes were returned by Docker Engine." icon="settings" title="No Swarm nodes" />
  return (
    <div className="swarmops-page">
      <DetailHeader subtitle="Choose a node to inspect its Docker, operating-system, capacity, and task data." title="Node inventory" />
      <Card padding="none" variant="raised"><Table caption="Docker Swarm nodes" columns={columns} rowKey={(node) => node.id} rows={nodes} /></Card>
      <section className="swarmops-node-detail" aria-label={`${selected.hostname} details`}>
        <Card header={<SectionTitle eyebrow={`${selected.role} · ${selected.state}`} title={selected.hostname} />} variant="raised">
          <div className="swarmops-meter-list">
            <Resource capacity={selected.cpu} capacityOnly detail={selected.load1 !== undefined ? `One-minute load ${selected.load1.toFixed(2)} · CPU use is not inferred from load.` : 'No live load sample yet.'} label="CPU capacity" unit="cores" />
            <Resource capacity={selected.memory} label="Memory" />
            <Resource capacity={selected.disk} label="Host root disk" />
          </div>
          <dl className="swarmops-facts">
            <Fact label="Address" value={selected.address ?? '—'} />
            <Fact label="OS" value={selected.os ?? selected.platform.os ?? '—'} />
            <Fact label="Kernel" value={selected.kernel ?? '—'} />
            <Fact label="Architecture" value={selected.platform.architecture ?? '—'} />
            <Fact label="Docker" value={selected.engine.version ?? selected.dockerVersion ?? '—'} />
            <Fact label="Storage driver" value={selected.engine.driver ?? '—'} />
            <Fact label="cgroup driver" value={selected.engine.cgroupDriver ?? '—'} />
            <Fact label="Uptime" value={formatDuration(selected.uptimeSeconds)} />
          </dl>
        </Card>
        <Card header={<SectionTitle eyebrow="Controlled change" title="Availability" />} variant="raised">
          <p className="swarmops-muted">Changing availability is an audited Docker node update. Draining preserves stateful workload safety only when those services were designed for relocation.</p>
          <div className="swarmops-action-row">
            {['active', 'pause', 'drain'].map((availability) => <Button disabled={busy || selected.availability === availability} key={availability} loading={busy && selected.availability !== availability} onClick={() => void updateAvailability(availability)} size="sm" variant={availability === 'drain' ? 'danger' : 'secondary'}>{capitalize(availability)}</Button>)}
          </div>
          <p className="swarmops-fact-label">Agent state</p>
          <StatusBadge health={selected.agent.healthy ? 'healthy' : 'degraded'} label={selected.agent.healthy ? `Last inventory ${formatDateTime(selected.agent.collectedAt)}` : selected.agent.error ?? 'No agent snapshot'} />
        </Card>
      </section>
      <Card header={<SectionTitle eyebrow="Workload placement" title={`Tasks on ${selected.hostname}`} />} variant="raised">
        {taskError ? <Banner tone="warning">{taskError}</Banner> : null}
        {tasks.length === 0 ? <EmptyState description="No task records are currently assigned to this node." icon="sparkle" title="No tasks" /> : <TaskList tasks={tasks} />}
      </Card>
    </div>
  )
}

function StacksPage({ nodes, onRefresh, stacks, toast }: { nodes: Node[]; onRefresh: () => Promise<void>; stacks: Stack[]; toast: ReturnType<typeof useToast> }) {
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
      setPlan(await api.validateStack(compose, targetNodeID))
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
      const deployed = await api.deployStack(name, compose, targetNodeID)
      setPlan(deployed)
      toast({ message: `Deployment accepted for ${name}`, tone: 'success' })
      await onRefresh()
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
    <div className="swarmops-page">
      <DetailHeader subtitle="Deploy image-only Compose v3.9 stacks. Every service needs reservations and limits; host binds, direct ports, build directives, and inline secrets are refused." title="Stack deployments" />
      <section className="swarmops-two-column">
        <Card header={<SectionTitle eyebrow="New deployment" title="Validate before applying" />} variant="raised">
          <div className="swarmops-form-grid">
            <Input hint="Lowercase letters, numbers, and hyphens." label="Stack name" onChange={(event) => setName(event.target.value)} value={name} />
            <Select label="Pin every service to one node" onChange={(event) => setTargetNodeID(event.target.value)} options={nodes.map((node) => ({ label: `${node.hostname} · ${node.state} · ${node.availability}`, value: node.id }))} placeholder="Let Swarm schedule this stack" value={targetNodeID} />
            <Input accept=".yaml,.yml,text/yaml,text/x-yaml" hint="Read locally only; the selected file is sent only when you validate or deploy it." label="Import Docker Compose file" onChange={(event) => void importCompose(event.target.files?.[0])} type="file" />
            <Textarea hint="Secrets and configs must reference top-level external Swarm resources. Compose is retained only for the deployment transaction; its digest is audited." label="Compose v3.9" onChange={(event) => setCompose(event.target.value)} rows={18} value={compose} />
          </div>
          {error ? <Banner tone="danger">{error}</Banner> : null}
          {plan ? <DeploymentPlan plan={plan} /> : null}
          <div className="swarmops-action-row">
            <Button disabled={!compose || pending !== null} loading={pending === 'validate'} onClick={() => void validate()} variant="secondary">Validate Compose</Button>
            <Button disabled={!name || !compose || pending !== null} loading={pending === 'deploy'} onClick={() => void deploy()}>Deploy stack</Button>
          </div>
        </Card>
        <Card header={<SectionTitle eyebrow="Existing state" title="Managed stacks" />} variant="raised">
          {stacks.length ? <Table caption="Discovered Docker stacks" columns={columns} rowKey={(stack) => stack.name} rows={stacks} /> : <EmptyState description="No Docker stack labels were found in the current service inventory." icon="document" title="No stacks" />}
        </Card>
      </section>
    </div>
  )
}

function ServicesPage({ onRefresh, services, toast }: { onRefresh: () => Promise<void>; services: Service[]; toast: ReturnType<typeof useToast> }) {
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
      await api.serviceAction(selected.id, kind)
      toast({ message: `${selected.name}: ${kind} sent to Docker`, tone: 'success' })
      await onRefresh()
    } catch (reason) { toast({ message: messageOf(reason), tone: 'danger', duration: 0 }) } finally { setBusy('') }
  }
  const columns: TableColumn<Service>[] = [
    { header: 'Service', key: 'name', render: (service) => <button className="swarmops-table-link" onClick={() => void readLogs(service)} type="button"><strong>{service.name}</strong><span>{service.stack ?? 'unmanaged service'}</span></button> },
    { header: 'Image', key: 'image', render: (service) => <span className="swarmops-mono">{service.image ?? '—'}</span> },
    { header: 'Tasks', key: 'tasks', numeric: true, render: (service) => `${service.runningTasks} / ${service.desiredTasks}` },
    { header: 'Health', key: 'health', render: (service) => <StatusBadge health={service.health} /> },
    { header: 'Update', key: 'update', render: (service) => service.updateState || '—' },
  ]
  if (!selected) return <EmptyState description="Docker Engine returned no Swarm services." icon="sparkle" title="No services" />
  return (
    <div className="swarmops-page">
      <DetailHeader subtitle="Logs are read directly from Docker service logs. Restarts and rollbacks use fixed audited command shapes, not browser-supplied shell commands." title="Service control" />
      <Card padding="none" variant="raised"><Table caption="Docker Swarm services" columns={columns} rowKey={(service) => service.id} rows={services} /></Card>
      <section className="swarmops-two-column">
        <Card header={<SectionTitle eyebrow={selected.stack ?? 'No stack label'} title={selected.name} />} variant="raised">
          <dl className="swarmops-facts"><Fact label="Image" value={selected.image ?? '—'} /><Fact label="Desired tasks" value={String(selected.desiredTasks)} /><Fact label="Running tasks" value={String(selected.runningTasks)} /><Fact label="Last updated" value={formatDateTime(selected.updatedAt)} /></dl>
          <div className="swarmops-action-row"><Button loading={busy === 'restart'} onClick={() => void action('restart')} variant="secondary">Force restart</Button><Button loading={busy === 'rollback'} onClick={() => void action('rollback')} variant="danger">Rollback</Button><Button onClick={() => void readLogs(selected)} variant="ghost">Read logs</Button></div>
        </Card>
        <Card header={<SectionTitle eyebrow="Last 200 lines" title="Service logs" />} variant="raised">
          {logsError ? <Banner tone="danger">{logsError}</Banner> : null}
          {logs ? <pre className="swarmops-log-view"><code>{logs}</code></pre> : <EmptyState description="Select a service name or use Read logs to fetch an on-demand, bounded log tail." icon="document" title="Logs are not loaded" />}
        </Card>
      </section>
    </div>
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
  const [result, setResult] = useState<BuildResult | null>(null)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!archive) return
    setPending(true); setError(''); setResult(null)
    try {
      const built = await api.build(archive, { cpus: Number(cpus), dockerfile, image, memoryMiB: Number(memoryMiB), push })
      setResult(built)
      toast({ message: `Build completed for ${built.image}`, tone: 'success' })
    } catch (reason) { setError(messageOf(reason)) } finally { setPending(false) }
  }
  return (
    <div className="swarmops-page">
      <DetailHeader subtitle="The console accepts a tarred local build context. The companion CLI can archive a directory while applying .dockerignore; both routes enforce the server’s CPU, RAM, image-prefix, and immutable-tag caps." title="Bounded image builds" />
      <section className="swarmops-two-column">
        <Card header={<SectionTitle eyebrow="Build request" title="Build and optionally push" />} variant="raised">
          <div className="swarmops-form-grid">
            <Input accept=".tar,application/x-tar" label="Build context (.tar)" onChange={(event) => setArchive(event.target.files?.[0] ?? null)} type="file" />
            <Input hint="An allow-listed registry path with a non-latest tag is required." label="Image" onChange={(event) => setImage(event.target.value)} placeholder="ghcr.io/org/service:2026.08.23" value={image} />
            <Input label="Dockerfile path" onChange={(event) => setDockerfile(event.target.value)} value={dockerfile} />
            <div className="swarmops-inline-fields"><Input label="vCPU cap" min="0.1" onChange={(event) => setCPUs(event.target.value)} step="0.1" type="number" value={cpus} /><Input label="RAM cap (MiB)" min="64" onChange={(event) => setMemoryMiB(event.target.value)} type="number" value={memoryMiB} /></div>
            <Switch checked={push} description="Requires the manager’s registry config secret. Build arguments are intentionally not accepted because they are not secret-safe." onChange={(event) => setPush(event.target.checked)}>Push after build</Switch>
          </div>
          {error ? <Banner tone="danger">{error}</Banner> : null}
          <Button disabled={!archive || !image || pending} loading={pending} onClick={() => void submit()}>Start bounded build</Button>
        </Card>
        <Card header={<SectionTitle eyebrow="Result" title="Docker build output" />} variant="raised">
          {result ? <><Banner tone="success" title={result.image}>{result.pushed ? 'Image was built and push was requested.' : 'Image was built without a push request.'}</Banner><pre className="swarmops-log-view"><code>{result.log}</code></pre></> : <EmptyState description="No build output is retained until a build completes. The audit trail keeps the request outcome and target image, never registry credentials." icon="upload" title="No build run" />}
        </Card>
      </section>
    </div>
  )
}

function TraefikPage({ onRefresh, status, toast }: { onRefresh: () => Promise<void>; status: TraefikStatus; toast: ReturnType<typeof useToast> }) {
  const running = status.service?.health === 'healthy'
  const [confirmation, setConfirmation] = useState('')
  const [pending, setPending] = useState(false)
  const reconcile = async () => {
    setPending(true)
    try {
      await api.reconcileTraefik(confirmation)
      toast({ message: 'Traefik reconciliation requested', tone: 'success' })
      setConfirmation('')
      await onRefresh()
    } catch (reason) { toast({ message: messageOf(reason), tone: 'danger', duration: 0 }) } finally { setPending(false) }
  }
  return (
    <div className="swarmops-page">
      <DetailHeader status={<StatusBadge health={running ? 'healthy' : 'degraded'} label={running ? 'Traefik healthy' : 'Traefik not healthy'} />} subtitle="SwarmOps discovers Traefik and can reconcile only the checked-in edge stack. DNS and certificate credentials stay in Swarm secrets, never browser inputs." title="Traefik & certificate management" />
      <section className="swarmops-two-column">
        <Card header={<SectionTitle eyebrow="Edge" title="Traefik service" />} variant="raised">
          {status.service ? <dl className="swarmops-facts"><Fact label="Service" value={status.service.name} /><Fact label="Image" value={status.service.image ?? '—'} /><Fact label="Tasks" value={`${status.service.runningTasks} / ${status.service.desiredTasks}`} /><Fact label="Update" value={status.service.updateState || '—'} /></dl> : <EmptyState description="The expected traefik_traefik service was not found in the Docker inventory." icon="external" title="Traefik undiscovered" />}
          {status.dashboardURL ? <a className="swarmops-external-link" href={status.dashboardURL} rel="noreferrer" target="_blank">Open protected Traefik dashboard ↗</a> : <p className="swarmops-muted">Set `SWARMOPS_TRAEFIK_DASHBOARD_URL` only to the protected dashboard hostname; it is not inferred from a route.</p>}
          <Input hint="The trusted Traefik manifest uses existing external secrets and host settings; no browser-supplied routing or credentials are accepted." label="Reconcile confirmation" onChange={(event) => setConfirmation(event.target.value)} value={confirmation} />
          <Button disabled={pending || confirmation !== 'DEPLOY_TRAEFIK'} loading={pending} onClick={() => void reconcile()} variant="secondary">Reconcile Traefik</Button>
        </Card>
        <Card header={<SectionTitle eyebrow="Certificates" title="Operational contract" />} variant="raised">
          <ul className="swarmops-check-list"><li>ACME/DNS provider credentials are versioned external Swarm secrets.</li><li>The dashboard is available only through an authenticated `api@internal` route; port 8080 is never published.</li><li>Prometheus reads Traefik’s internal metrics entrypoint; metrics are not exposed on the public edge.</li><li>Certificate renewal health should be checked in Traefik logs and the dashboard before changing DNS or revoking credentials.</li></ul>
        </Card>
      </section>
    </div>
  )
}

function ObservabilityPage({ onRefresh, status, toast }: { onRefresh: () => Promise<void>; status: ObservabilityStatus; toast: ReturnType<typeof useToast> }) {
  const [pending, setPending] = useState(false)
  const [confirmation, setConfirmation] = useState('')
  const [coreConfirmation, setCoreConfirmation] = useState('')
  const setCore = async (enabled: boolean) => {
    setPending(true)
    try {
      await api.coreObservability(enabled, enabled ? '' : coreConfirmation)
      toast({ message: enabled ? 'Core monitoring deployment requested' : 'Core monitoring removal requested', tone: 'success' })
      setCoreConfirmation('')
      await onRefresh()
    } catch (reason) { toast({ message: messageOf(reason), tone: 'danger', duration: 0 }) } finally { setPending(false) }
  }
  const setLogs = async (enabled: boolean) => {
    setPending(true)
    try {
      await api.logsCollection(enabled, enabled ? '' : confirmation)
      toast({ message: enabled ? 'Log collection deployment requested' : 'Log collection removal requested', tone: 'success' })
      setConfirmation('')
      await onRefresh()
    } catch (reason) { toast({ message: messageOf(reason), tone: 'danger', duration: 0 }) } finally { setPending(false) }
  }
  return (
    <div className="swarmops-page">
      <DetailHeader subtitle="One cluster-wide observability stack owns Grafana, Prometheus, and Jaeger. Log collection is a separate, explicit global deployment because it can capture application output on every node." title="Observability" />
      <section className="swarmops-stat-grid">
        <Card variant="raised"><Stat label="Core monitoring" value={status.coreInstalled ? 'Installed' : 'Not installed'} /></Card>
        <Card variant="raised"><Stat label="Log collection" value={status.logsEnabled ? 'Enabled' : 'Disabled'} /></Card>
        <Card variant="raised"><Stat label="Prometheus" value={status.coreInstalled ? 'Expected' : 'Pending'} /></Card>
        <Card variant="raised"><Stat label="Jaeger" value={status.coreInstalled ? 'Expected' : 'Pending'} /></Card>
      </section>
      <section className="swarmops-two-column">
        <Card header={<SectionTitle eyebrow="Shared platform service" title="Core monitoring stack" />} variant="raised">
          <p className="swarmops-muted">One API action deploys the reviewed Grafana, Prometheus, and Jaeger stack. It requires the Grafana admin-password and Jaeger durable-storage secrets to exist first; the API reports discovered Docker state, not a guessed health check.</p>
          <TaskProgress caption={status.coreInstalled ? 'The core stack is present in Docker.' : 'Provision the core stack before trusting monitoring links.'} steps={[{ id: 'prometheus', label: 'Prometheus discovery and retention', status: status.coreInstalled ? 'done' : 'pending' }, { id: 'grafana', label: 'Grafana access control', status: status.coreInstalled ? 'done' : 'pending' }, { id: 'jaeger', label: 'Jaeger durable storage', status: status.coreInstalled ? 'done' : 'pending' }]} title="Core readiness" />
          {status.coreInstalled ? <><Input hint="Type the exact confirmation before removing shared monitoring." label="Remove-core confirmation" onChange={(event) => setCoreConfirmation(event.target.value)} value={coreConfirmation} /><Button disabled={pending || coreConfirmation !== 'REMOVE_OBSERVABILITY_CORE'} loading={pending} onClick={() => void setCore(false)} variant="danger">Remove core monitoring</Button></> : <Button disabled={pending} loading={pending} onClick={() => void setCore(true)}>Deploy core monitoring</Button>}
        </Card>
        <Card header={<SectionTitle eyebrow="Explicit cluster-wide collection" title="Docker service logs" />} variant="raised">
          <Switch checked={status.logsEnabled} disabled={pending} description="Runs Alloy globally to collect Docker JSON logs into Loki. Disabling removes that global stack; existing retained logs follow Loki retention." onChange={(event) => { if (event.target.checked) void setLogs(true) }}>Enable log collection</Switch>
          {status.logsEnabled ? <><Input hint="Type the exact confirmation before removing the global collector." label="Disable confirmation" onChange={(event) => setConfirmation(event.target.value)} value={confirmation} /><Button disabled={pending || confirmation !== 'DISABLE_LOG_COLLECTION'} loading={pending} onClick={() => void setLogs(false)} variant="danger">Disable collection</Button></> : <Button disabled={pending} loading={pending} onClick={() => void setLogs(true)}>Enable collection</Button>}
        </Card>
      </section>
    </div>
  )
}

function AuditPage({ events }: { events: AuditEvent[] }) {
  return (
    <div className="swarmops-page">
      <DetailHeader subtitle="SwarmOps writes append-only local audit records for each operation. The record contains actors, targets, outcomes, and request IDs—not passwords, Compose content, build contexts, or registry credentials." title="Audit trail" />
      <Card variant="raised">
        <ActivityFeed empty={<EmptyState description="The control plane has not recorded an operation yet." icon="clock" title="No audit events" />} events={events.map((event) => ({ action: `${event.action} · ${event.outcome}`, actor: event.actor, at: event.occurredAt, icon: event.outcome === 'success' ? 'check' as const : 'danger' as const, id: event.id, target: event.target, tone: event.outcome === 'success' ? 'success' as const : 'danger' as const }))} />
      </Card>
    </div>
  )
}

function ProvisioningPage() {
  return (
    <div className="swarmops-page">
      <DetailHeader subtitle="Bootstrap remains an operator-run Ansible action from a trusted workstation. SSH passwords are prompted locally and never traverse this browser, an API payload, Swarm state, or the audit file." title="Cluster provisioning" />
      <section className="swarmops-two-column">
        <Card header={<SectionTitle eyebrow="Ansible workflow" title="From fresh hosts to a SwarmOps stack" />} variant="raised">
          <TaskProgress caption="Run this from the checked-out SwarmOps repository on an operator workstation." steps={[{ id: 'inventory', label: 'Enter manager IPs, SSH user, and password locally', status: 'pending' }, { id: 'docker', label: 'Install Docker and verify managers', status: 'pending' }, { id: 'swarm', label: 'Initialise/join the Swarm and verify quorum', status: 'pending' }, { id: 'secrets', label: 'Create versioned runtime secrets', status: 'pending' }, { id: 'platform', label: 'Deploy Traefik, SwarmOps, and monitoring', status: 'pending' }]} title="Bootstrap checklist" />
        </Card>
        <Card header={<SectionTitle eyebrow="Runbook entrypoint" title="Credential-safe invocation" />} variant="raised">
          <pre className="swarmops-command"><code>make swarmops-provision</code></pre>
          <p className="swarmops-muted">The command asks for the target manager IPs, SSH username, and password at the terminal, then runs Ansible without writing them to an inventory file. Prefer SSH keys in production and use a vault/secret manager for long-lived credentials.</p>
          <Banner tone="warning" title="Production gate">Do not enable browser mutations, image pushes, ACME DNS credentials, or a public dashboard until the preflight checks and secret creation steps complete.</Banner>
        </Card>
      </section>
    </div>
  )
}

function TaskList({ tasks }: { tasks: Task[] }) {
  const columns: TableColumn<Task>[] = [
    { header: 'Task', key: 'id', render: (task) => <span className="swarmops-mono">{shortID(task.id)}</span> },
    { header: 'Desired', key: 'desired', render: (task) => task.desiredState },
    { header: 'Current', key: 'current', render: (task) => task.currentState },
    { header: 'Started', key: 'started', render: (task) => formatDateTime(task.startedAt) },
    { header: 'Error', key: 'error', render: (task) => task.error || '—' },
  ]
  return <Table caption="Tasks on the selected node" columns={columns} rowKey={(task) => task.id} rows={tasks} />
}

function DeploymentPlan({ plan }: { plan: ComposePlan }) {
  return <Banner title="Compose policy accepted" tone="success"><strong>{plan.services.join(', ')}</strong> · {shortDigest(plan.digest)}{plan.targetNodeId ? ` · pinned to ${shortID(plan.targetNodeId)}` : ''}{plan.warnings.map((warning) => <span className="swarmops-warning" key={warning}> · {warning}</span>)}</Banner>
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

function HealthWord({ health }: { health: string }) { return <span className={`swarmops-health-word swarmops-health-word--${health}`}>{capitalize(health)}</span> }
function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) { return <div className="swarmops-section-title"><span>{eyebrow}</span><h2>{title}</h2></div> }
function Fact({ label, value }: { label: string; value: ReactNode }) { return <div><dt>{label}</dt><dd>{value}</dd></div> }
function Brand() { return <div className="swarmops-brand"><span className="swarmops-mark" aria-hidden="true">S</span><span><strong>SwarmOps</strong><small>Docker Swarm control plane</small></span></div> }

function useHashPage(): [Page, (page: Page) => void] {
  const read = () => (Object.prototype.hasOwnProperty.call(PAGES, window.location.hash.slice(1)) ? window.location.hash.slice(1) as Page : 'overview')
  const [page, setPage] = useState<Page>(read)
  useEffect(() => { const update = () => setPage(read()); window.addEventListener('hashchange', update); return () => window.removeEventListener('hashchange', update) }, [])
  return [page, (next) => { window.location.hash = next; setPage(next) }]
}

function useDashboard(onExpired: () => void) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const refresh = useCallback(async () => {
    setRefreshing(true); setError('')
    try {
      const [overview, nodes, stacks, services, audit, traefik, observability] = await Promise.all([api.overview(), api.nodes(), api.stacks(), api.services(), api.auditEvents(), api.traefik(), api.observability()])
      setData({ audit, nodes, observability, overview, services, stacks, traefik })
    } catch (reason) {
      if (reason instanceof APIError && reason.status === 401) onExpired()
      else setError(messageOf(reason))
    } finally { setRefreshing(false) }
  }, [onExpired])
  useEffect(() => { void refresh(); const timer = window.setInterval(() => void refresh(), 30000); return () => window.clearInterval(timer) }, [refresh])
  return { data, error, refresh, refreshing }
}

function nodeHealth(node: Node): 'healthy' | 'degraded' | 'unhealthy' {
  if (node.state !== 'ready') return 'unhealthy'
  if (!node.agent.healthy || node.availability !== 'active') return 'degraded'
  return 'healthy'
}

function messageOf(reason: unknown) { return reason instanceof Error ? reason.message : 'Unexpected operation failure' }
function capitalize(value: string) { return value ? value[0].toUpperCase() + value.slice(1) : 'Unknown' }
function shortID(value?: string) { return value ? value.slice(0, 12) : '—' }
function shortDigest(value: string) { return value.length > 20 ? `${value.slice(0, 19)}…` : value }
function formatNumber(value: number) { return new Intl.NumberFormat().format(Math.round(value)) }
function formatBytes(value: number) { if (!value) return '0 B'; const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB']; const power = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1); return `${(value / 1024 ** power).toFixed(power > 1 ? 1 : 0)} ${units[power]}` }
function formatDateTime(value?: string) { return value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—' }
function formatDuration(seconds?: number) { if (!seconds) return '—'; const days = Math.floor(seconds / 86400); const hours = Math.floor((seconds % 86400) / 3600); return days ? `${days}d ${hours}h` : `${hours}h` }
