import { useEffect, useMemo, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import {
  Badge,
  Banner,
  Body,
  Button,
  CodeBlock,
  Columns,
  DataTable,
  DetailHeader,
  EmptyState,
  Facts,
  Inline,
  Input,
  Mono,
  Page,
  Panel,
  Segmented,
  Select,
  Stack as Rows,
  Switch,
  useToast,
} from '@nim.zone/ui'
import type { BadgeVariant, TableColumn } from '@nim.zone/ui'
import { api } from './api'
import type {
  CertificateStatus,
  Command,
  CutoverPlan,
  DependencyBinding,
  DNSCredentialMetadata,
  DNSPropagationStatus,
  DNSRecordPreview,
  DNSRecordSpec,
  PrometheusStatus,
  RouteInventoryRow,
  RoutePlan,
  RouteProtocol,
  RouteScope,
  RouteSpec,
  RouteTLSMode,
  RoutingState,
  ServiceRouteRole,
  TraefikLogRecord,
  TraefikSettings,
  TraefikStatus,
} from './types'

type Tab = 'routes' | 'certificates' | 'dns' | 'logs'
type Toast = ReturnType<typeof useToast>

const tabs = [
  { label: 'Routes', value: 'routes' as const },
  { label: 'Certificates', value: 'certificates' as const },
  { label: 'Entry points & DNS', value: 'dns' as const },
  { label: 'Logs & metrics', value: 'logs' as const },
]

export function TraefikControlPage({ status, toast }: { status: TraefikStatus; toast: Toast }) {
  const [tab, setTab] = useState<Tab>('routes')
  const [state, setState] = useState<RoutingState | null>(null)
  const [routes, setRoutes] = useState<RouteInventoryRow[]>([])
  const [certificates, setCertificates] = useState<CertificateStatus[]>([])
  const [prometheus, setPrometheus] = useState<PrometheusStatus | null>(null)
  const [cutover, setCutover] = useState<CutoverPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const load = async (refreshRuntime = false) => {
    setError('')
    if (state) setRefreshing(true)
    else setLoading(true)
    try {
      const [nextState, nextRoutes, nextCertificates] = await Promise.all([
        api.traefikRoutingState(refreshRuntime),
        api.traefikRoutes(),
        api.traefikCertificates(),
      ])
      setState(nextState)
      setRoutes(nextRoutes)
      setCertificates(nextCertificates)
      const [nextPrometheus, nextCutover] = await Promise.allSettled([
        api.traefikPrometheus(),
        api.traefikCutoverPlan(),
      ])
      setPrometheus(nextPrometheus.status === 'fulfilled' ? nextPrometheus.value : null)
      setCutover(nextCutover.status === 'fulfilled' ? nextCutover.value : null)
    } catch (reason) {
      setError(messageOf(reason))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { void load(false) }, [])

  const running = status.service?.health === 'healthy'
  return (
    <Page>
      <DetailHeader
        actions={<Button disabled={loading || refreshing} loading={refreshing} onClick={() => void load(true)} size="sm" variant="secondary">Refresh runtime</Button>}
        status={<Badge dot variant={running ? 'success' : 'danger'}>{running ? 'Singleton healthy' : 'Singleton unhealthy'}</Badge>}
        subtitle="Declare service routing, DNS, certificate, logs, and Prometheus collection through one typed control plane. Raw Traefik labels, rules, provider URLs, LogQL, and PromQL are never accepted here."
        title="Traefik & TLS"
      />
      <Banner title="One gateway, one accepted failure domain" tone="warning">
        Traefik intentionally runs as one task. Applying static settings or adding a TCP/UDP entrypoint restarts that singleton and can interrupt every routed connection. Route enable/disable is dynamic once its entrypoint exists.
      </Banner>
      <Segmented fullWidth label="Traefik control-plane sections" onChange={setTab} options={tabs} value={tab} />
      {error ? <Banner title="Routing state unavailable" tone="danger">{error}</Banner> : null}
      {loading || !state ? <Panel><Rows><Body>Loading the selected manager’s sealed routing state…</Body></Rows></Panel> : null}
      {!loading && state && tab === 'routes' ? <RoutesTab cutover={cutover} onQueued={() => void load(false)} routes={routes} state={state} toast={toast} /> : null}
      {!loading && state && tab === 'certificates' ? <CertificatesTab certificates={certificates} onQueued={() => void load(false)} routes={routes} toast={toast} /> : null}
      {!loading && state && tab === 'dns' ? <DNSSettingsTab onQueued={() => void load(false)} state={state} toast={toast} /> : null}
      {!loading && state && tab === 'logs' ? <LogsMetricsTab onQueued={() => void load(false)} prometheus={prometheus} settings={state.settings} toast={toast} /> : null}
    </Page>
  )
}

function RoutesTab({ cutover, onQueued, routes, state, toast }: { cutover: CutoverPlan | null; onQueued: () => void; routes: RouteInventoryRow[]; state: RoutingState; toast: Toast }) {
  const [query, setQuery] = useState('')
  const [protocol, setProtocol] = useState('all')
  const [scope, setScope] = useState('all')
  const [status, setStatus] = useState('all')
  const [selectedKey, setSelectedKey] = useState(routes[0]?.route.serviceKey ?? '')
  const selected = routes.find((row) => row.route.serviceKey === selectedKey) ?? routes[0]
  const [draft, setDraft] = useState<RouteSpec | null>(selected ? cloneRoute(selected.route) : null)
  const [plan, setPlan] = useState<RoutePlan | null>(null)
  const [pending, setPending] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [reason, setReason] = useState(selected?.declaration.reason ?? '')
  const [role, setRole] = useState<ServiceRouteRole>(selected?.declaration.role ?? 'needs-configuration')
  const [binding, setBinding] = useState<DependencyBinding>({ callerService: selected?.route.serviceKey ?? '', delivery: 'existing', name: '', targetRoute: state.routes[0]?.key ?? '', version: 1 })
  const [cutoverConfirmation, setCutoverConfirmation] = useState('')

  useEffect(() => {
    if (!selected) return
    setDraft(cloneRoute(selected.route))
    setPlan(null)
    setConfirmation('')
    setReason(selected.declaration.reason ?? '')
    setRole(selected.declaration.role)
    setBinding((current) => ({ ...current, callerService: selected.route.serviceKey }))
  }, [selectedKey, routes])

  const filtered = useMemo(() => routes.filter((row) => {
    const text = `${row.route.serviceKey} ${row.route.key} ${row.serviceImage ?? ''}`.toLowerCase()
    return (!query || text.includes(query.toLowerCase())) && (protocol === 'all' || row.route.protocol === protocol) && (scope === 'all' || row.route.scope === scope) && (status === 'all' || row.status === status)
  }), [protocol, query, routes, scope, status])

  const columns: TableColumn<RouteInventoryRow>[] = [
    { header: 'Service', key: 'service', render: (row) => <Rows gap="tight"><Mono>{row.route.serviceKey}</Mono><Body size="sm">{row.serviceImage ?? 'Image unavailable'}</Body></Rows> },
    { header: 'Route', key: 'route', render: (row) => row.route.key ? <Rows gap="tight"><Mono>{row.route.key}</Mono><Body size="sm">{row.route.protocol.toUpperCase()} · {row.route.scope}</Body></Rows> : 'Needs configuration' },
    { header: 'Role', key: 'role', render: (row) => <Badge variant={roleVariant(row.declaration.role)}>{row.declaration.role}</Badge> },
    { header: 'Status', key: 'status', render: (row) => <Badge dot variant={statusVariant(row.status)}>{row.status}</Badge> },
    { header: 'Enabled', key: 'enabled', render: (row) => row.declaration.role === 'routed' ? (row.route.enabled ? 'Yes' : 'No') : '—' },
    { header: 'Inspect', key: 'inspect', render: (row) => <Button onClick={() => setSelectedKey(row.route.serviceKey)} size="sm" variant={row.route.serviceKey === selected?.route.serviceKey ? 'primary' : 'secondary'}>Open</Button> },
  ]

  const preview = async (next = draft) => {
    if (!next) return
    setPending('plan')
    try {
      const value = await api.planTraefikRoute(next)
      setDraft(value.route)
      setPlan(value)
    } catch (reasonValue) {
      toast({ message: messageOf(reasonValue), tone: 'danger', duration: 0 })
      setPlan(null)
    } finally { setPending('') }
  }

  const queueRoute = async () => {
    if (!plan) return
    setPending('route')
    try {
      const command = await api.applyTraefikRoute(plan.route, confirmation)
      queuedToast(toast, command, 'Route reconciliation')
      setConfirmation('')
      onQueued()
    } catch (reasonValue) { toast({ message: messageOf(reasonValue), tone: 'danger', duration: 0 }) } finally { setPending('') }
  }

  const queueRole = async () => {
    if (!selected) return
    setPending('role')
    try {
      const command = await api.declareTraefikServiceRole(selected.route.serviceKey, role, reason)
      queuedToast(toast, command, 'Service role')
      onQueued()
    } catch (reasonValue) { toast({ message: messageOf(reasonValue), tone: 'danger', duration: 0 }) } finally { setPending('') }
  }

  const queueBinding = async () => {
    setPending('binding')
    try {
      const command = await api.applyTraefikBinding({ ...binding, name: binding.delivery === 'existing' ? '' : binding.name.toUpperCase() })
      queuedToast(toast, command, 'Dependency binding')
      onQueued()
    } catch (reasonValue) { toast({ message: messageOf(reasonValue), tone: 'danger', duration: 0 }) } finally { setPending('') }
  }

  const queueCutover = async () => {
    setPending('cutover')
    try {
      const command = await api.applyTraefikCutover(cutoverConfirmation)
      queuedToast(toast, command, 'Cluster cutover')
      setCutoverConfirmation('')
      onQueued()
    } catch (reasonValue) { toast({ message: messageOf(reasonValue), tone: 'danger', duration: 0 }) } finally { setPending('') }
  }

  return (
    <Rows>
      <Panel flush>
        <DataTable
          caption="Swarm service route inventory"
          columns={columns}
          empty={<EmptyState description="No Swarm services were discovered on the selected manager." icon="layers" title="No route candidates" />}
          rowKey={(row) => row.route.serviceKey}
          rows={filtered}
          summary={`Showing ${filtered.length} of ${routes.length} services. Swarm routes services and replica sets, not individual containers.`}
          toolbar={<Columns><Input label="Search services" onChange={(event) => setQuery(event.target.value)} placeholder="Service, route, or image" value={query} /><Select label="Protocol" onChange={(event) => setProtocol(event.target.value)} options={filterOptions(['http', 'tcp', 'udp'])} value={protocol} /><Select label="Scope" onChange={(event) => setScope(event.target.value)} options={filterOptions(['public', 'internal', 'both'])} value={scope} /><Select label="Status" onChange={(event) => setStatus(event.target.value)} options={filterOptions(unique(routes.map((row) => row.status)))} value={status} /></Columns>}
        />
      </Panel>
      {selected && draft ? (
        <Columns>
          <Panel eyebrow={selected.status} title={`Route · ${selected.route.serviceKey}`}>
            <Rows>
              {selected.exception ? <Banner tone="info" title="Declared platform exception">{selected.exception}</Banner> : null}
              <Columns>
                <Input label="Route key" onChange={(event) => updateRoute(setDraft, { key: event.target.value })} value={draft.key} />
                <Input label="Backend target port" min="1" max="65535" onChange={(event) => updateRoute(setDraft, { targetPort: Number(event.target.value) })} type="number" value={draft.targetPort} />
              </Columns>
              <Columns>
                <Select label="Protocol" onChange={(event) => updateRoute(setDraft, protocolPatch(event.target.value as RouteProtocol))} options={['http', 'tcp', 'udp'].map(option)} value={draft.protocol} />
                <Select label="Scope" onChange={(event) => updateRoute(setDraft, { scope: event.target.value as RouteScope })} options={['internal', 'public', 'both'].map(option)} value={draft.scope} />
                <Select label="TLS" onChange={(event) => updateRoute(setDraft, { tls: event.target.value as RouteTLSMode })} options={['off', 'terminate', 'passthrough'].map(option)} value={draft.tls} />
              </Columns>
              {draft.protocol === 'http' ? <Columns><Input label="Hostnames" onChange={(event) => updateRoute(setDraft, { match: { ...draft.match, hosts: commaValues(event.target.value) } })} value={(draft.match.hosts ?? []).join(', ')} /><Input label="Path prefix" onChange={(event) => updateRoute(setDraft, { match: { ...draft.match, pathPrefix: event.target.value } })} value={draft.match.pathPrefix ?? '/'} /></Columns> : <Columns><Input disabled={draft.protocol === 'udp' || draft.tls === 'off'} label="SNI hostnames" onChange={(event) => updateRoute(setDraft, { match: { ...draft.match, sni: commaValues(event.target.value) } })} value={(draft.match.sni ?? []).join(', ')} /><Input hint="10000–19999; leave 0 for deterministic allocation." label="Listen port" min="0" max="19999" onChange={(event) => updateRoute(setDraft, { listenPort: Number(event.target.value) })} type="number" value={draft.listenPort ?? 0} /></Columns>}
              <Columns><Input disabled={draft.tls !== 'terminate'} label="Certificate resolver" onChange={(event) => updateRoute(setDraft, { resolver: event.target.value })} value={draft.resolver ?? ''} /><Input disabled={draft.scope === 'internal'} label="DNS record reference" onChange={(event) => updateRoute(setDraft, { dnsReference: event.target.value })} value={draft.dnsReference ?? ''} /></Columns>
              <Columns>
                <Switch checked={draft.enabled} description="Disabled templates stay attached to the reviewed manifest but Traefik ignores them." onChange={(event) => { const next = { ...draft, enabled: event.target.checked }; setDraft(next); void preview(next) }}>Enable route</Switch>
                <Switch checked={draft.publicAllow} disabled={draft.scope === 'internal'} description="Public exposure is denied unless the workload’s reviewed manifest explicitly allows it." onChange={(event) => updateRoute(setDraft, { publicAllow: event.target.checked })}>Reviewed public exposure</Switch>
                <Switch checked={draft.sensitive} description="Sensitive public services require a service-specific PUBLISH confirmation." onChange={(event) => updateRoute(setDraft, { sensitive: event.target.checked })}>Sensitive service</Switch>
              </Columns>
              <Inline><Button disabled={Boolean(pending)} loading={pending === 'plan'} onClick={() => void preview()} variant="secondary">Validate & render</Button></Inline>
              {plan?.restartRequired ? <Banner title="Singleton restart required" tone="warning">This stream entrypoint does not exist yet. Applying it reserves {plan.entryPoint.protocol.toUpperCase()} port {plan.entryPoint.port} and restarts the single Traefik task.</Banner> : null}
              {plan ? <Rows gap="tight" as="ul" className="nim-body nim-body--sm">{plan.validation.map((item) => <li key={item.code}><Badge variant={item.valid ? 'success' : 'warning'}>{item.valid ? 'Passed' : 'Attention'}</Badge> {item.message}</li>)}</Rows> : null}
              {plan ? <CodeBlock label="Reviewed manifest sample" wrap>{plan.manifestSnippet}</CodeBlock> : null}
              {plan ? <Input hint={routeConfirmationHint(plan.route, plan.restartRequired)} label="Apply confirmation" onChange={(event) => setConfirmation(event.target.value)} value={confirmation} /> : null}
              {plan ? <Button disabled={Boolean(pending) || confirmation !== routeConfirmation(plan.route, plan.restartRequired)} loading={pending === 'route'} onClick={() => void queueRoute()} variant="accent">Queue route reconciliation</Button> : null}
            </Rows>
          </Panel>
          <Rows>
            <Panel eyebrow="Declared role" title="Cutover classification">
              <Rows>
                <Select label="Service role" onChange={(event) => setRole(event.target.value as ServiceRouteRole)} options={['routed', 'client-only', 'platform-exception', 'needs-configuration'].map(option)} value={role} />
                <Input hint="Required for client-only and platform exceptions." label="Reason" onChange={(event) => setReason(event.target.value)} value={reason} />
                <Button disabled={Boolean(pending)} loading={pending === 'role'} onClick={() => void queueRole()} variant="secondary">Queue role declaration</Button>
              </Rows>
            </Panel>
            <Panel eyebrow="East-west through Traefik" title="Dependency binding">
              <Rows>
                <Select label="Target route" onChange={(event) => setBinding({ ...binding, targetRoute: event.target.value })} options={state.routes.filter((route) => route.enabled && (route.scope === 'internal' || route.scope === 'both')).map((route) => ({ label: route.key, value: route.key }))} placeholder="Select an enabled internal route" value={binding.targetRoute} />
                <Select label="Delivery" onChange={(event) => setBinding({ ...binding, delivery: event.target.value as DependencyBinding['delivery'] })} options={[{ label: 'Use existing app setting', value: 'existing' }, { label: 'Environment variable', value: 'environment' }, { label: 'Mounted secret file', value: 'secret_file' }]} value={binding.delivery} />
                {binding.delivery !== 'existing' ? <Input label="Delivery name" onChange={(event) => setBinding({ ...binding, name: event.target.value.toUpperCase() })} placeholder="DATABASE_URL" value={binding.name} /> : null}
                <Body size="sm">SwarmOps derives the <Mono>.swarmops.internal</Mono> alias and endpoint. Traefik joins the caller’s private overlay; the target service never joins it.</Body>
                <Button disabled={Boolean(pending) || !binding.targetRoute || (binding.delivery !== 'existing' && !binding.name)} loading={pending === 'binding'} onClick={() => void queueBinding()} variant="secondary">Queue dependency binding</Button>
              </Rows>
            </Panel>
          </Rows>
        </Columns>
      ) : null}
      <Panel eyebrow="One durable phased saga" title="Cluster cutover">
        {!cutover ? <Banner tone="warning">Cutover readiness could not be read. Runtime, metrics, or selected-manager checks may be unavailable.</Banner> : <Rows><Badge dot variant={cutover.ready ? 'success' : 'warning'}>{cutover.ready ? 'Ready' : `${cutover.blockers.length} blockers`}</Badge><Body size="sm">The action seals a rollback snapshot, provisions isolated routes and bindings, validates DNS/certificates, removes direct bypasses, then verifies runtime and Prometheus. DNS records are never deleted by rollback.</Body>{cutover.blockers.length ? <Rows as="ul" gap="tight" className="nim-body nim-body--sm">{cutover.blockers.slice(0, 20).map((blocker) => <li key={blocker}>{blocker}</li>)}</Rows> : null}<Input disabled={!cutover.ready} hint="This exact phrase is intentionally cluster-wide." label="Cutover confirmation" onChange={(event) => setCutoverConfirmation(event.target.value)} placeholder="CUTOVER_CLUSTER_THROUGH_TRAEFIK" value={cutoverConfirmation} /><Button disabled={!cutover.ready || Boolean(pending) || cutoverConfirmation !== 'CUTOVER_CLUSTER_THROUGH_TRAEFIK'} loading={pending === 'cutover'} onClick={() => void queueCutover()} variant="danger">Queue one-action cutover</Button></Rows>}
      </Panel>
    </Rows>
  )
}

function CertificatesTab({ certificates, onQueued, routes, toast }: { certificates: CertificateStatus[]; onQueued: () => void; routes: RouteInventoryRow[]; toast: Toast }) {
  const [pending, setPending] = useState('')
  const eligible = routes.filter((row) => row.route.enabled && row.route.tls === 'terminate' && row.route.scope !== 'internal' && row.route.protocol !== 'udp')
  const byRoute = new Map(certificates.map((certificate) => [certificate.routeKey, certificate]))
  const retry = async (key: string) => {
    setPending(key)
    try {
      const command = await api.retryTraefikCertificate(key)
      queuedToast(toast, command, 'Safe certificate retry')
      onQueued()
    } catch (reason) { toast({ message: messageOf(reason), tone: 'danger', duration: 0 }) } finally { setPending('') }
  }
  const columns: TableColumn<RouteInventoryRow>[] = [
    { header: 'Domain', key: 'domain', render: (row) => <Mono>{[...(row.route.match.hosts ?? []), ...(row.route.match.sni ?? [])].join(', ')}</Mono> },
    { header: 'Resolver', key: 'resolver', render: (row) => row.route.resolver || '—' },
    { header: 'State', key: 'state', render: (row) => { const value = byRoute.get(row.route.key); return <Badge dot variant={value?.handshakeValid ? 'success' : value?.state === 'failed' ? 'danger' : 'warning'}>{value?.state ?? 'not observed'}</Badge> } },
    { header: 'Expires', key: 'expires', render: (row) => dateTime(byRoute.get(row.route.key)?.notAfter) },
    { header: 'Last attempt', key: 'attempt', render: (row) => dateTime(byRoute.get(row.route.key)?.lastAttempt) },
    { header: 'Action', key: 'action', render: (row) => <Button disabled={Boolean(pending)} loading={pending === row.route.key} onClick={() => void retry(row.route.key)} size="sm" variant="secondary">Safe retry</Button> },
  ]
  return (
    <Rows>
      <Banner title="Retry never deletes ACME storage" tone="info">SwarmOps reruns DNS, port, and credential preflight, creates a temporary lower-priority trigger router, then checks bounded logs and a real TLS handshake. Traefik remains responsible for renewal.</Banner>
      <Panel flush><DataTable caption="TLS certificate status" columns={columns} empty={<EmptyState description="Enable a public TLS-terminating HTTP or TCP route to request and observe a certificate." icon="shield" title="No certificate routes" />} rowKey={(row) => row.route.key} rows={eligible} /></Panel>
      <Columns>
        {eligible.map((row) => {
          const certificate = byRoute.get(row.route.key)
          return <Panel eyebrow={row.route.key} key={row.route.key} title={(row.route.match.hosts ?? row.route.match.sni ?? []).join(', ')}><Facts items={[{ label: 'Issuer', value: certificate?.issuer ?? 'Not observed' }, { label: 'SANs', mono: true, value: certificate?.domains.join(', ') || '—' }, { label: 'Fingerprint', mono: true, value: certificate?.fingerprint ?? '—' }, { label: 'Valid from', value: dateTime(certificate?.notBefore) }, { label: 'Valid until', value: dateTime(certificate?.notAfter) }, { label: 'Handshake', value: certificate?.handshakeValid ? 'Validated' : 'Not validated' }]} />{certificate?.failureSummary ? <Banner title="Last failure" tone="danger">{certificate.failureSummary}</Banner> : null}</Panel>
        })}
      </Columns>
    </Rows>
  )
}

function DNSSettingsTab({ onQueued, state, toast }: { onQueued: () => void; state: RoutingState; toast: Toast }) {
  const [settings, setSettings] = useState<TraefikSettings>(cloneSettings(state.settings))
  const [settingsConfirmation, setSettingsConfirmation] = useState('')
  const [pending, setPending] = useState('')
  const [credentialID, setCredentialID] = useState('')
  const [credentialName, setCredentialName] = useState('')
  const [provider, setProvider] = useState<'cloudflare' | 'arvan'>('cloudflare')
  const [credentialValue, setCredentialValue] = useState('')
  const latestCredentials = latestCredentialVersions(state.credentials)
  const [protocol, setProtocol] = useState<RouteProtocol>('http')
  const [record, setRecord] = useState<DNSRecordSpec>(() => emptyDNSRecord(latestCredentials[0]?.id ?? ''))
  const [preview, setPreview] = useState<DNSRecordPreview | null>(null)
  const [propagation, setPropagation] = useState<Record<string, DNSPropagationStatus>>({})
  const [deleteRecordConfirmation, setDeleteRecordConfirmation] = useState('')
  const [deleteRecordID, setDeleteRecordID] = useState('')
  const [deleteCredentialConfirmation, setDeleteCredentialConfirmation] = useState('')
  const [deleteCredentialID, setDeleteCredentialID] = useState('')
  const [deleteCredentialVersion, setDeleteCredentialVersion] = useState(0)

  useEffect(() => setSettings(cloneSettings(state.settings)), [state.settings])

  const queueSettings = async () => {
    setPending('settings')
    try {
      const command = await api.applyTraefikSettings(settings, settingsConfirmation)
      queuedToast(toast, command, 'Static Traefik settings')
      setSettingsConfirmation('')
      onQueued()
    } catch (reason) { toast({ message: messageOf(reason), tone: 'danger', duration: 0 }) } finally { setPending('') }
  }
  const queueCredential = async () => {
    setPending('credential')
    try {
      const command = await api.uploadDNSCredential(credentialID, credentialName, provider, credentialValue)
      queuedToast(toast, command, 'DNS credential rotation')
      setCredentialValue('')
      onQueued()
    } catch (reason) { toast({ message: messageOf(reason), tone: 'danger', duration: 0 }) } finally { setPending('') }
  }
  const previewRecord = async () => {
    setPending('preview')
    try { setPreview(await api.previewDNSRecord(record, protocol)) } catch (reason) { toast({ message: messageOf(reason), tone: 'danger', duration: 0 }); setPreview(null) } finally { setPending('') }
  }
  const queueRecord = async () => {
    if (!preview) return
    setPending('record')
    try {
      const command = await api.applyDNSRecord(preview.record, protocol)
      queuedToast(toast, command, 'DNS record change')
      setPreview(null)
      onQueued()
    } catch (reason) { toast({ message: messageOf(reason), tone: 'danger', duration: 0 }) } finally { setPending('') }
  }
  const verify = async (id: string) => {
    setPending(`verify-${id}`)
    try {
      const value = await api.verifyDNSRecord(id)
      setPropagation((current) => ({ ...current, [id]: value }))
    } catch (reason) { toast({ message: messageOf(reason), tone: 'danger', duration: 0 }) } finally { setPending('') }
  }
  const queueDelete = async () => {
    setPending('delete')
    try {
      const command = await api.deleteDNSRecord(deleteRecordID, deleteRecordConfirmation)
      queuedToast(toast, command, 'DNS record deletion')
      setDeleteRecordID(''); setDeleteRecordConfirmation('')
      onQueued()
    } catch (reason) { toast({ message: messageOf(reason), tone: 'danger', duration: 0 }) } finally { setPending('') }
  }

  const queueCredentialDelete = async () => {
    if (!deleteCredentialID || deleteCredentialVersion === 0) return
    setPending('credential-delete')
    try {
      const command = await api.removeDNSCredentialVersion(deleteCredentialID, deleteCredentialVersion, deleteCredentialConfirmation)
      queuedToast(toast, command, 'DNS credential version removal')
      setDeleteCredentialID('')
      setDeleteCredentialVersion(0)
      setDeleteCredentialConfirmation('')
      onQueued()
    } catch (reason) { toast({ message: messageOf(reason), tone: 'danger', duration: 0 }) } finally { setPending('') }
  }

  const removableCredentials = removableCredentialVersions(state.credentials)

  return (
    <Rows>
      <Columns>
        <Panel eyebrow="Static singleton configuration" title="Entry points & resolvers">
          <Rows>
            <Input label="ACME account email" onChange={(event) => setSettings({ ...settings, acmeEmail: event.target.value })} type="email" value={settings.acmeEmail} />
            <Columns><Input label="Stream port range start" min="10000" max="19999" onChange={(event) => setSettings({ ...settings, portRange: { ...settings.portRange, start: Number(event.target.value) } })} type="number" value={settings.portRange.start} /><Input label="Stream port range end" min="10000" max="19999" onChange={(event) => setSettings({ ...settings, portRange: { ...settings.portRange, end: Number(event.target.value) } })} type="number" value={settings.portRange.end} /></Columns>
            <Rows gap="tight">{settings.entryPoints.map((entry) => <Inline key={entry.name}><Mono>{entry.name}</Mono><Badge>{entry.protocol.toUpperCase()} {entry.port}</Badge><Badge variant={entry.public ? 'warning' : 'info'}>{entry.public ? 'published' : 'internal'}</Badge></Inline>)}</Rows>
            <Body size="sm">HTTP/HTTPS share 80 and 443. Internal HTTP and metrics are not published. New TCP/UDP entrypoints are added by a validated route plan and reserve only ports 10000–19999.</Body>
            <Rows gap="tight">{settings.resolvers.map((resolver, index) => <Columns key={resolver.name}><Input label="Resolver name" onChange={(event) => updateResolver(setSettings, index, { name: event.target.value })} value={resolver.name} /><Select label="Challenge" onChange={(event) => updateResolver(setSettings, index, { challenge: event.target.value as typeof resolver.challenge })} options={['dns-01', 'http-01', 'tls-alpn-01'].map(option)} value={resolver.challenge} /><Select disabled={resolver.challenge !== 'dns-01'} label="DNS provider" onChange={(event) => updateResolver(setSettings, index, { provider: event.target.value as 'cloudflare' | 'arvan' })} options={[{ label: 'Cloudflare', value: 'cloudflare' }, { label: 'ArvanCloud', value: 'arvan' }]} value={resolver.provider ?? 'cloudflare'} /><Select disabled={resolver.challenge !== 'dns-01'} label="Credential" onChange={(event) => updateResolver(setSettings, index, { dnsCredentialId: event.target.value })} options={latestCredentials.filter((item) => !resolver.provider || item.provider === resolver.provider).map((item) => ({ label: `${item.name} · v${item.version}`, value: item.id }))} placeholder="Latest provider credential" value={resolver.dnsCredentialId ?? ''} /></Columns>)}</Rows>
            <Banner title="Static change restarts the singleton" tone="warning">Access-log state, operational level, resolver definitions, entrypoints, and the port range are rendered into an immutable versioned Swarm config.</Banner>
            <Input hint="Type RESTART_SINGLETON_TRAEFIK." label="Settings confirmation" onChange={(event) => setSettingsConfirmation(event.target.value)} value={settingsConfirmation} />
            <Button disabled={Boolean(pending) || settingsConfirmation !== 'RESTART_SINGLETON_TRAEFIK'} loading={pending === 'settings'} onClick={() => void queueSettings()} variant="danger">Queue static settings</Button>
          </Rows>
        </Panel>
        <Panel eyebrow="Encrypted controller custody" title="Provider credentials">
          <Rows>
            <Banner tone="info">The value is written first to the encrypted durable command artifact, validated with the provider, sealed in controller state, then created as a new immutable Swarm secret. Responses, logs, commands, and audit records contain metadata only.</Banner>
            <Select label="Provider" onChange={(event) => setProvider(event.target.value as 'cloudflare' | 'arvan')} options={[{ label: 'Cloudflare scoped DNS token', value: 'cloudflare' }, { label: 'ArvanCloud DNS API key', value: 'arvan' }]} value={provider} />
            <Input label="Credential ID" onChange={(event) => setCredentialID(event.target.value)} placeholder="production-dns" value={credentialID} />
            <Input label="Display name" onChange={(event) => setCredentialName(event.target.value)} placeholder="Production DNS" value={credentialName} />
            <Input autoComplete="new-password" hint={provider === 'cloudflare' ? 'Use a token scoped to DNS read/write for the required zones.' : 'Paste the Arvan API key; an optional Apikey prefix is accepted.'} label="Credential value" onChange={(event) => setCredentialValue(event.target.value)} type="password" value={credentialValue} />
            <Button disabled={Boolean(pending) || !credentialID || !credentialName || credentialValue.length < 16} loading={pending === 'credential'} onClick={() => void queueCredential()} variant="accent">Validate & rotate credential</Button>
            <Rows gap="tight">{state.credentials.length ? state.credentials.map((credential) => <Inline key={`${credential.id}-${credential.version}`}><Mono>{credential.id}</Mono><Badge>{credential.provider}</Badge><Badge variant={credential.state === 'validated' ? 'success' : credential.state === 'removed' ? 'neutral' : 'warning'}>v{credential.version} · {credential.state}</Badge></Inline>) : <Body size="sm">No provider credential metadata is stored yet.</Body>}</Rows>
            <Panel eyebrow="Rotate history" title="Removable old versions">
              {removableCredentials.length ? removableCredentials.map((credential) => <Inline key={`${credential.id}-${credential.version}`}><Mono>{credential.id}</Mono><Badge>{credential.provider}</Badge><Badge variant="warning">v{credential.version}</Badge><Button disabled={Boolean(pending)} size="sm" onClick={() => { setDeleteCredentialID(credential.id); setDeleteCredentialVersion(credential.version); setDeleteCredentialConfirmation('') }}>Prepare removal</Button></Inline>) : <Body size="sm">No removable older versions.</Body>}
              {deleteCredentialID ? <Rows><Banner title="Removing old immutable versions" tone="warning"><Mono>Removing a credential version cannot be undone.</Mono></Banner><Input hint={`Type ${credentialRemovalConfirmation(deleteCredentialID, deleteCredentialVersion)}.`} label="Removal confirmation" onChange={(event) => setDeleteCredentialConfirmation(event.target.value)} value={deleteCredentialConfirmation} /><Inline><Button disabled={Boolean(pending) || deleteCredentialConfirmation !== credentialRemovalConfirmation(deleteCredentialID, deleteCredentialVersion)} loading={pending === 'credential-delete'} onClick={() => void queueCredentialDelete()} variant="danger">Queue credential version removal</Button><Button disabled={Boolean(pending)} onClick={() => { setDeleteCredentialID(''); setDeleteCredentialVersion(0); setDeleteCredentialConfirmation('') }} variant="ghost">Cancel</Button></Inline></Rows> : null}
            </Panel>
          </Rows>
        </Panel>
      </Columns>
      <Columns>
        <Panel eyebrow="Read before write" title="DNS record preview">
          <Rows>
            <Columns><Input label="Record ID" onChange={(event) => setRecord({ ...record, id: event.target.value })} value={record.id} /><Select label="Route protocol" onChange={(event) => { const next = event.target.value as RouteProtocol; setProtocol(next); if (next !== 'http') setRecord({ ...record, proxied: false }) }} options={['http', 'tcp', 'udp'].map(option)} value={protocol} /></Columns>
            <Columns><Input label="Zone" onChange={(event) => setRecord({ ...record, zone: event.target.value })} placeholder="example.com" value={record.zone} /><Input label="Record name" onChange={(event) => setRecord({ ...record, name: event.target.value })} placeholder="app.example.com" value={record.name} /></Columns>
            <Columns><Select label="Type" onChange={(event) => setRecord({ ...record, type: event.target.value as DNSRecordSpec['type'] })} options={['A', 'AAAA', 'CNAME'].map(option)} value={record.type} /><Input label="Content" onChange={(event) => setRecord({ ...record, content: event.target.value })} placeholder="203.0.113.10" value={record.content} /><Input label="TTL seconds" min="60" max="86400" onChange={(event) => setRecord({ ...record, ttl: Number(event.target.value) })} type="number" value={record.ttl} /></Columns>
            <Select label="Provider credential" onChange={(event) => setRecord({ ...record, credentialId: event.target.value })} options={latestCredentials.map((credential) => ({ label: `${credential.name} · ${credential.provider} v${credential.version}`, value: credential.id }))} placeholder="Select credential" value={record.credentialId} />
            <Columns><Switch checked={record.adopted} description="Required before SwarmOps may change a matching provider record it did not create." onChange={(event) => setRecord({ ...record, adopted: event.target.checked, managed: !event.target.checked })}>Adopt existing record</Switch><Switch checked={record.proxied} disabled={protocol !== 'http' || providerForCredential(latestCredentials, record.credentialId) !== 'cloudflare'} description="Raw TCP/UDP records are always DNS-only." onChange={(event) => setRecord({ ...record, proxied: event.target.checked })}>Cloudflare proxy</Switch></Columns>
            <Button disabled={Boolean(pending)} loading={pending === 'preview'} onClick={() => void previewRecord()} variant="secondary">Read provider & preview</Button>
            {preview ? <Banner title={`${preview.action.toUpperCase()} preview`} tone={preview.action === 'noop' ? 'info' : 'warning'}>{preview.existing ? `Provider record ${preview.existing.providerRecordId} was read before this change.` : 'No matching provider record exists.'} {preview.warnings.join(' ')}</Banner> : null}
            {preview ? <Button disabled={Boolean(pending)} loading={pending === 'record'} onClick={() => void queueRecord()} variant="accent">Queue reviewed DNS change</Button> : null}
          </Rows>
        </Panel>
        <Panel eyebrow="Authoritative + public resolvers" title="Owned records & propagation">
          <Rows>
            {state.dnsRecords.length ? state.dnsRecords.map((item) => <Rows gap="tight" key={item.id}><Inline><Mono>{item.name}</Mono><Badge>{item.type}</Badge><Badge variant={item.managed ? 'success' : 'info'}>{item.managed ? 'created' : 'adopted'}</Badge></Inline><Body size="sm">{item.content} · TTL {item.ttl} · {item.proxied ? 'proxied' : 'DNS-only'}</Body><Inline><Button disabled={Boolean(pending)} loading={pending === `verify-${item.id}`} onClick={() => void verify(item.id)} size="sm" variant="secondary">Verify propagation</Button><Button disabled={Boolean(pending)} onClick={() => { setDeleteRecordID(item.id); setDeleteRecordConfirmation('') }} size="sm" variant="ghost">Prepare deletion</Button></Inline>{propagation[item.id] ? <Propagation status={propagation[item.id]} /> : null}</Rows>) : <EmptyState description="Create or explicitly adopt A, AAAA, or CNAME records. Disabling a route never deletes DNS." icon="globe" title="No owned DNS records" />}
            {deleteRecordID ? <Rows><Banner title="Separate DNS deletion" tone="warning">A route must release this record first. Cutover rollback and route disable never delete it.</Banner><Input hint={`Type DELETE_DNS_RECORD_${deleteRecordID.toUpperCase().replaceAll('-', '_')}.`} label="Deletion confirmation" onChange={(event) => setDeleteRecordConfirmation(event.target.value)} value={deleteRecordConfirmation} /><Inline><Button disabled={Boolean(pending) || deleteRecordConfirmation !== `DELETE_DNS_RECORD_${deleteRecordID.toUpperCase().replaceAll('-', '_')}`} loading={pending === 'delete'} onClick={() => void queueDelete()} variant="danger">Queue record deletion</Button><Button disabled={Boolean(pending)} onClick={() => setDeleteRecordID('')} variant="ghost">Cancel</Button></Inline></Rows> : null}
          </Rows>
        </Panel>
      </Columns>
    </Rows>
  )
}

function LogsMetricsTab({ onQueued, prometheus, settings: initialSettings, toast }: { onQueued: () => void; prometheus: PrometheusStatus | null; settings: TraefikSettings; toast: Toast }) {
  const [settings, setSettings] = useState(cloneSettings(initialSettings))
  const [confirmation, setConfirmation] = useState('')
  const [logs, setLogs] = useState<TraefikLogRecord[]>([])
  const [level, setLevel] = useState('')
  const [router, setRouter] = useState('')
  const [service, setService] = useState('')
  const [requestID, setRequestID] = useState('')
  const [hours, setHours] = useState('1')
  const [pending, setPending] = useState('')
  const [logError, setLogError] = useState('')

  const queueSettings = async () => {
    setPending('settings')
    try {
      const command = await api.applyTraefikSettings(settings, confirmation)
      queuedToast(toast, command, 'Traefik logging settings')
      setConfirmation('')
      onQueued()
    } catch (reason) { toast({ message: messageOf(reason), tone: 'danger', duration: 0 }) } finally { setPending('') }
  }
  const loadLogs = async (live: boolean) => {
    setPending(live ? 'live' : 'history'); setLogError('')
    try {
      const to = new Date()
      const boundedHours = Math.max(1 / 12, Math.min(168, Number(hours) || 1))
      setLogs(await api.traefikLogs({ from: new Date(to.getTime() - boundedHours * 3600000).toISOString(), level, limit: live ? 200 : 1000, live, requestId: requestID, router, service, to: to.toISOString() }))
    } catch (reason) { setLogError(messageOf(reason)); setLogs([]) } finally { setPending('') }
  }

  const targetColumns: TableColumn<PrometheusStatus['targets'][number]>[] = [
    { header: 'Target', key: 'target', render: (target) => <Mono>{target.target}</Mono> },
    { header: 'Health', key: 'health', render: (target) => <Badge dot variant={target.health === 'up' ? 'success' : 'danger'}>{target.health}</Badge> },
    { header: 'Last scrape', key: 'scrape', render: (target) => dateTime(target.lastScrape) },
    { header: 'Labels', key: 'labels', render: (target) => target.labels.join(', ') || '—' },
    { header: 'Error', key: 'error', render: (target) => target.error || '—' },
  ]

  return (
    <Rows>
      <Columns>
        <Panel eyebrow="Real static toggles" title="Traefik logging">
          <Rows>
            <Switch checked={settings.accessLogs} description="When disabled, Traefik stops writing request access records. Operational logs remain controlled separately." onChange={(event) => setSettings({ ...settings, accessLogs: event.target.checked })}>Access logs</Switch>
            <Select label="Operational level" onChange={(event) => setSettings({ ...settings, operationalLog: event.target.value as TraefikSettings['operationalLog'] })} options={['DEBUG', 'INFO', 'WARN', 'ERROR'].map(option)} value={settings.operationalLog} />
            <Banner title="Minimal means ERROR, not off" tone="info">Traefik does not provide a complete operational-log OFF level. SwarmOps therefore labels ERROR as the minimal setting; metrics remain enabled in every state.</Banner>
            <Input hint="Logging changes render a new immutable static config and restart the singleton." label="Restart confirmation" onChange={(event) => setConfirmation(event.target.value)} placeholder="RESTART_SINGLETON_TRAEFIK" value={confirmation} />
            <Button disabled={Boolean(pending) || confirmation !== 'RESTART_SINGLETON_TRAEFIK'} loading={pending === 'settings'} onClick={() => void queueSettings()} variant="danger">Queue logging settings</Button>
          </Rows>
        </Panel>
        <Panel eyebrow="Fixed bounded Loki adapter" title="Live tail & seven-day history">
          <Rows>
            <Columns><Select label="Level" onChange={(event) => setLevel(event.target.value)} options={[{ label: 'All levels', value: '' }, ...['DEBUG', 'INFO', 'WARN', 'ERROR'].map(option)]} value={level} /><Input label="Router" onChange={(event) => setRouter(event.target.value)} value={router} /><Input label="Service" onChange={(event) => setService(event.target.value)} value={service} /></Columns>
            <Columns><Input label="Request ID" onChange={(event) => setRequestID(event.target.value)} value={requestID} /><Input hint="Maximum 168 hours and 1,000 records." label="History hours" min="0.083" max="168" onChange={(event) => setHours(event.target.value)} step="0.083" type="number" value={hours} /></Columns>
            <Inline><Button disabled={Boolean(pending)} loading={pending === 'live'} onClick={() => void loadLogs(true)} variant="accent">Read live window</Button><Button disabled={Boolean(pending)} loading={pending === 'history'} onClick={() => void loadLogs(false)} variant="secondary">Read history</Button></Inline>
            {logError ? <Banner tone="danger">{logError}</Banner> : null}
            {logs.length ? <CodeBlock label={`${logs.length} sanitized records`} wrap>{logs.map((record) => `${record.timestamp} ${record.level || 'INFO'} ${record.router ?? record.service ?? ''} ${record.message}`).join('\n')}</CodeBlock> : <Body size="sm">Log content is sanitized and capped, and is never copied into the audit trail.</Body>}
          </Rows>
        </Panel>
      </Columns>
      <Panel eyebrow="Collection health, no arbitrary PromQL" title="Prometheus scrape status">
        {!prometheus ? <Banner tone="warning">Prometheus target status is unavailable from the selected manager.</Banner> : <Rows><Badge dot variant={prometheus.collected ? 'success' : 'warning'}>{prometheus.collected ? 'Traefik target collected' : 'No Traefik target observed'}</Badge><Body size="sm">Observed {dateTime(prometheus.observedAt)} on Traefik’s internal metrics entrypoint. Stable entrypoint, router, and service labels are enabled. Graphs will be implemented directly in SwarmOps later.</Body><DataTable caption="Prometheus targets relevant to Traefik" columns={targetColumns} empty={<EmptyState description="Prometheus returned no Traefik target." icon="chart" title="No scrape target" />} rowKey={(target) => target.target} rows={prometheus.targets} /></Rows>}
      </Panel>
    </Rows>
  )
}

function Propagation({ status }: { status: DNSPropagationStatus }) {
  return <Rows gap="tight"><Badge dot variant={status.ready ? 'success' : 'warning'}>{status.ready ? 'Ready on all resolvers' : 'Propagation incomplete'}</Badge>{status.checks.map((check) => <Body key={check.resolver} size="sm"><Mono>{check.resolver}</Mono> · {check.valid ? check.answers.join(', ') : check.error || 'No matching answer'}</Body>)}</Rows>
}

function protocolPatch(protocol: RouteProtocol): Partial<RouteSpec> {
  if (protocol === 'http') return { listenPort: 0, match: { hosts: ['service.example.com'], pathPrefix: '/' }, protocol, tls: 'off', health: { kind: 'response', path: '/', timeoutSeconds: 5 } }
  if (protocol === 'tcp') return { match: {}, protocol, health: { kind: 'handshake', timeoutSeconds: 5 } }
  return { match: {}, protocol, tls: 'off', resolver: '', health: { kind: 'structural', timeoutSeconds: 5 } }
}

function updateRoute(setter: Dispatch<SetStateAction<RouteSpec | null>>, patch: Partial<RouteSpec>) {
  setter((current) => current ? { ...current, ...patch } : current)
}

function updateResolver(setter: Dispatch<SetStateAction<TraefikSettings>>, index: number, patch: Partial<TraefikSettings['resolvers'][number]>) {
  setter((current) => ({ ...current, resolvers: current.resolvers.map((resolver, resolverIndex) => resolverIndex === index ? { ...resolver, ...patch } : resolver) }))
}

function cloneRoute(route: RouteSpec): RouteSpec {
  return { ...route, health: { ...route.health }, match: { ...route.match, hosts: [...(route.match.hosts ?? [])], sni: [...(route.match.sni ?? [])] } }
}

function cloneSettings(settings: TraefikSettings): TraefikSettings {
  return { ...settings, entryPoints: settings.entryPoints.map((entry) => ({ ...entry })), portRange: { ...settings.portRange }, resolvers: settings.resolvers.map((resolver) => ({ ...resolver })) }
}

function latestCredentialVersions(credentials: DNSCredentialMetadata[]) {
  const latest = new Map<string, DNSCredentialMetadata>()
  for (const credential of credentials) if (credential.state !== 'removed' && (!latest.has(credential.id) || credential.version > latest.get(credential.id)!.version)) latest.set(credential.id, credential)
  return [...latest.values()].sort((left, right) => left.name.localeCompare(right.name))
}

function removableCredentialVersions(credentials: DNSCredentialMetadata[]) {
  const latest = new Map<string, number>()
  for (const credential of credentials) {
    if (credential.state === 'removed') continue
    if (!latest.has(credential.id) || credential.version > latest.get(credential.id)!) {
      latest.set(credential.id, credential.version)
    }
  }
  return credentials.filter((credential) => credential.state !== 'removed' && credential.version < (latest.get(credential.id) ?? 0)).sort((left, right) => left.id.localeCompare(right.id) || left.version - right.version)
}

function providerForCredential(credentials: DNSCredentialMetadata[], id: string) {
  return credentials.find((credential) => credential.id === id)?.provider
}

function emptyDNSRecord(credentialId: string): DNSRecordSpec {
  return { adopted: false, content: '', credentialId, id: '', managed: true, name: '', proxied: false, ttl: 300, type: 'A', version: 1, zone: '' }
}

function routeConfirmation(route: RouteSpec, restartRequired: boolean) {
  return routeConfirmations(route, restartRequired).join(' + ')
}

function routeConfirmationLabel(route: RouteSpec, restartRequired: boolean) {
  const required = routeConfirmations(route, restartRequired)
  if (!required.length) return 'no phrase for this dynamic non-sensitive change'
  return required.join(' + ')
}

function routeConfirmationHint(route: RouteSpec, restartRequired: boolean) {
  return `Type ${routeConfirmationLabel(route, restartRequired)}`
}

function routeConfirmations(route: RouteSpec, restartRequired: boolean) {
  const required: string[] = []
  if (route.enabled && route.sensitive && route.scope !== 'internal') {
    required.push(`PUBLISH_${route.serviceKey.toUpperCase().replaceAll(/[^A-Z0-9]/g, '_')}`)
  }
  if (restartRequired) {
    required.push('RESTART_SINGLETON_TRAEFIK')
  }
  return required
}

function credentialRemovalConfirmation(id: string, version: number) {
  const value = id.trim().toUpperCase().replaceAll(/[^A-Z0-9_]/g, '_')
  return `REMOVE_DNS_CREDENTIAL_${value}_V${version}`
}

function filterOptions(values: string[]) { return [{ label: 'All', value: 'all' }, ...values.map(option)] }
function option(value: string) { return { label: value === '' ? 'All levels' : value.replaceAll('-', ' '), value } }
function commaValues(value: string) { return value.split(',').map((item) => item.trim()).filter(Boolean) }
function unique(values: string[]) { return [...new Set(values)].sort() }
function roleVariant(role: ServiceRouteRole): BadgeVariant { return role === 'routed' ? 'success' : role === 'needs-configuration' ? 'warning' : role === 'platform-exception' ? 'info' : 'neutral' }
function statusVariant(status: string): BadgeVariant { return status === 'active' ? 'success' : status === 'drift' || status === 'service-missing' ? 'danger' : status === 'desired' ? 'info' : 'neutral' }
function dateTime(value?: string) { return value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—' }
function messageOf(reason: unknown) { return reason instanceof Error ? reason.message : 'The operation failed.' }
function queuedToast(toast: Toast, command: Command, label: string) { toast({ message: `${label} queued (${command.id.slice(0, 12)})`, tone: 'success' }) }
