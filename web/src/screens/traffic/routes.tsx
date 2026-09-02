import { useEffect, useMemo, useState } from 'react'
import {
  Badge,
  Banner,
  Body,
  Button,
  CodeBlock,
  Columns,
  DataTable,
  EmptyState,
  Inline,
  Input,
  Mono,
  Panel,
  Select,
  Stack as Rows,
  Switch,
  useToast,
} from '@nim.zone/ui'
import type { TableColumn } from '@nim.zone/ui'
import { api } from '../../data/api'
import type {
  CutoverPlan,
  DependencyBinding,
  RouteInventoryRow,
  RoutePlan,
  RouteProtocol,
  RouteScope,
  RouteSpec,
  RouteTLSMode,
  RoutingState,
  ServiceRouteRole,
} from '../../data/types'
import { messageOf } from '../../lib/errors'
import {
  cloneRoute,
  commaValues,
  filterOptions,
  option,
  protocolPatch,
  queuedToast,
  roleVariant,
  routeConfirmation,
  routeConfirmationHint,
  statusVariant,
  unique,
  updateRoute,
} from './lib'

type Toast = ReturnType<typeof useToast>

export function RoutesTab({ cutover, onQueued, routes, state, toast }: { cutover: CutoverPlan | null; onQueued: () => void; routes: RouteInventoryRow[]; state: RoutingState; toast: Toast }) {
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
    { header: 'Enabled', key: 'enabled', render: (row) => row.declaration.role === 'routed' ? (row.route.enabled ? 'Yes' : 'No') : 'Not routed' },
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
              {draft.protocol === 'http' ? <Columns><Input hint="Each hostname must already exist as a DNS record under an accepted domain." label="Hostnames" onChange={(event) => updateRoute(setDraft, { match: { ...draft.match, hosts: commaValues(event.target.value) } })} value={(draft.match.hosts ?? []).join(', ')} /><Input label="Path prefix" onChange={(event) => updateRoute(setDraft, { match: { ...draft.match, pathPrefix: event.target.value } })} value={draft.match.pathPrefix ?? '/'} /></Columns> : <Columns><Input disabled={draft.protocol === 'udp' || draft.tls === 'off'} hint="Each SNI name must already exist as a DNS record under an accepted domain." label="SNI hostnames" onChange={(event) => updateRoute(setDraft, { match: { ...draft.match, sni: commaValues(event.target.value) } })} value={(draft.match.sni ?? []).join(', ')} /><Input hint="10000–19999; leave 0 for deterministic allocation." label="Listen port" min="0" max="19999" onChange={(event) => updateRoute(setDraft, { listenPort: Number(event.target.value) })} type="number" value={draft.listenPort ?? 0} /></Columns>}
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
        {!cutover ? <Banner tone="warning">Cutover readiness could not be read. Runtime, metrics, or selected-manager checks may be unavailable.</Banner> : <Rows><Badge dot variant={cutover.ready ? 'success' : 'warning'}>{cutover.ready ? 'Ready' : `${cutover.blockers?.length ?? 0} blockers`}</Badge><Body size="sm">The action seals a rollback snapshot, provisions isolated routes and bindings, validates DNS/certificates, removes direct bypasses, then verifies runtime and Prometheus. DNS records are never deleted by rollback.</Body>{cutover.blockers?.length ? <Rows as="ul" gap="tight" className="nim-body nim-body--sm">{cutover.blockers.slice(0, 20).map((blocker) => <li key={blocker}>{blocker}</li>)}</Rows> : null}<Input disabled={!cutover.ready} hint="This exact phrase is intentionally cluster-wide." label="Cutover confirmation" onChange={(event) => setCutoverConfirmation(event.target.value)} placeholder="CUTOVER_CLUSTER_THROUGH_TRAEFIK" value={cutoverConfirmation} /><Button disabled={!cutover.ready || Boolean(pending) || cutoverConfirmation !== 'CUTOVER_CLUSTER_THROUGH_TRAEFIK'} loading={pending === 'cutover'} onClick={() => void queueCutover()} variant="danger">Queue one-action cutover</Button></Rows>}
      </Panel>
    </Rows>
  )
}
