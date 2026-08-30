import { useEffect, useState } from 'react'
import {
  Badge,
  Banner,
  Body,
  Button,
  Facts,
  Inline,
  Input,
  Mono,
  Panel,
  Sheet,
  Stack as Rows,
  useToast,
} from '@nim.zone/ui'
import { api } from '../../data/api'
import type {
  CertificateStatus,
  Command,
  CutoverPlan,
  PrometheusStatus,
  RouteInventoryRow,
  RoutingState,
  TraefikInstallPreflight,
  TraefikStatus,
} from '../../data/types'
import { messageOf } from '../../lib/errors'
import { sentence } from '../../lib/format'
import type { WorkspacePage } from '../../navigation/navigation'
import { Screen } from '../../components/screen'
import type { Insight } from '../../components/screen'
import { commandFailed, normalizeDashboardHostname, queuedToast, validDashboardHostname } from './lib'
import { TraefikPreflightPanel } from './preflight'
import { TrafficOverview } from './overview'
import { RoutesTab } from './routes'
import { CertificatesTab } from './certificates'
import { DNSSettingsTab } from './dns'

type Tab = 'certificates' | 'dns' | 'overview' | 'routes'
type Toast = ReturnType<typeof useToast>

const TAB_PAGE: Record<Tab, WorkspacePage> = {
  certificates: 'tls',
  dns: 'dns',
  overview: 'gateway',
  routes: 'routes',
}

/**
 * The edge, split into the four questions an operator actually asks about it:
 * what owns the edge, what is published on it, where records are written, and
 * whether certificates are valid.
 *
 * They share one controller because they share one read — the sealed routing
 * state, the route inventory, and the certificate list arrive together, and
 * four screens each fetching their own would disagree with each other within a
 * second of one another. What they do NOT share is a heading: each tab is its
 * own destination in navigation, with its own name and its own summary, so an
 * operator who wants DNS credentials never lands on a gateway installer.
 */
export function TraefikControlPage({ initialTab = 'overview', status, toast }: { initialTab?: Tab; status: TraefikStatus; toast: Toast }) {
  const tab = initialTab
  const [state, setState] = useState<RoutingState | null>(null)
  const [routes, setRoutes] = useState<RouteInventoryRow[]>([])
  const [certificates, setCertificates] = useState<CertificateStatus[]>([])
  const [prometheus, setPrometheus] = useState<PrometheusStatus | null>(null)
  const [cutover, setCutover] = useState<CutoverPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [installOpen, setInstallOpen] = useState(false)
  const [installConfirmation, setInstallConfirmation] = useState('')
  const [dashboardHost, setDashboardHost] = useState('')
  const [installing, setInstalling] = useState(false)
  const [installCommand, setInstallCommand] = useState<Command | null>(null)
  const [installError, setInstallError] = useState('')
  const [preflight, setPreflight] = useState<TraefikInstallPreflight | null>(null)
  const [preflightError, setPreflightError] = useState('')
  const [repairing, setRepairing] = useState(false)
  const [repairCommand, setRepairCommand] = useState<Command | null>(null)
  const [repairError, setRepairError] = useState('')
  const [dashboardCredentials, setDashboardCredentials] = useState<{ password: string; username: string } | null>(null)

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
      const [nextPrometheus, nextCutover, nextPreflight] = await Promise.allSettled([
        api.traefikPrometheus(),
        api.traefikCutoverPlan(),
        api.traefikPreflight(),
      ])
      setPrometheus(nextPrometheus.status === 'fulfilled' ? nextPrometheus.value : null)
      setCutover(nextCutover.status === 'fulfilled' ? nextCutover.value : null)
      setPreflight(nextPreflight.status === 'fulfilled' ? nextPreflight.value : null)
      setPreflightError(nextPreflight.status === 'rejected' ? messageOf(nextPreflight.reason) : '')
    } catch (reason) {
      setError(messageOf(reason))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { void load(false) }, [])
  useEffect(() => { setDashboardHost(state?.settings.dashboardHost ?? '') }, [state?.settings.dashboardHost])

  const installed = Boolean(status.service)
  const running = status.service?.health === 'healthy'

  const install = async () => {
    setInstalling(true)
    setInstallError('')
    setInstallCommand(null)
    try {
      const command = await api.reconcileTraefik(installConfirmation, normalizeDashboardHostname(dashboardHost))
      queuedToast(toast, command, 'Gateway installation')
      setInstallCommand(command)
      setInstallOpen(false)
      setInstallConfirmation('')
      const completed = await api.waitForCommand(command.id, 30000)
      setInstallCommand(completed)
      if (completed.state === 'succeeded') {
        toast({ message: `Gateway installation completed (${completed.id.slice(0, 12)})`, tone: 'success' })
        await load(true)
      } else if (commandFailed(completed)) {
        toast({ duration: 0, message: completed.failureSummary ?? completed.lastError ?? 'Gateway installation needs attention.', tone: 'danger' })
      }
    } catch (reason) {
      setInstallError(messageOf(reason))
    } finally {
      setInstalling(false)
    }
  }

  const repairPrerequisites = async () => {
    setRepairing(true)
    setRepairError('')
    setRepairCommand(null)
    setDashboardCredentials(null)
    try {
      const result = await api.repairTraefikPrerequisites()
      setRepairCommand(result.command)
      if (result.dashboardUsername && result.dashboardPassword) {
        setDashboardCredentials({ password: result.dashboardPassword, username: result.dashboardUsername })
      }
      queuedToast(toast, result.command, 'Traefik prerequisite repair')
      const completed = await api.waitForCommand(result.command.id, 30000)
      setRepairCommand(completed)
      if (completed.state === 'succeeded') {
        toast({ message: 'Traefik prerequisites are complete.', tone: 'success' })
        await load(false)
      } else if (commandFailed(completed)) {
        toast({ duration: 0, message: completed.failureSummary ?? completed.lastError ?? 'Prerequisite repair needs attention.', tone: 'danger' })
      }
    } catch (reason) {
      setRepairError(messageOf(reason))
    } finally {
      setRepairing(false)
    }
  }

  const active = routes.filter((row) => row.status === 'active').length
  const drifted = routes.filter((row) => row.status === 'drift' || row.status === 'service-missing').length
  const expiring = certificates.filter((certificate) => certificate.notAfter && new Date(certificate.notAfter).getTime() < Date.now() + 30 * 86400000).length
  const declarations = state?.declarations ?? []
  const needsConfiguration = declarations.filter((declaration) => declaration.role === 'needs-configuration').length
  const credentials = state ? state.credentials.length : 0
  const dnsRecords = state ? state.dnsRecords.length : 0
  const dnsResolvers = (state?.settings.resolvers ?? []).filter((resolver) => resolver.challenge === 'dns-01').length
  const entryPoints = (state?.settings.entryPoints ?? []).length

  const insights: Record<Tab, Insight[]> = {
    overview: [
      { hint: installed ? (running ? 'One reviewed Traefik task owns the edge' : 'The gateway service is scheduled but unhealthy') : 'Nothing SwarmOps manages is answering on the edge', icon: 'globe', label: 'Gateway', tone: installed ? (running ? 'success' : 'danger') : 'warning', value: installed ? (running ? 'Healthy' : 'Unhealthy') : 'Not installed' },
      { hint: 'Entrypoints the reviewed stack publishes', icon: 'external', label: 'Entrypoints', unmeasured: !state, value: String(entryPoints) },
      { hint: active === routes.length ? 'Every declared route matches runtime' : `${drifted} route${drifted === 1 ? '' : 's'} do not match runtime`, icon: 'arrow-forward', label: 'Routes active', tone: drifted ? 'warning' : 'success', value: `${active} / ${routes.length}` },
      { hint: expiring ? 'Certificates inside their 30-day renewal window' : 'No certificate expires in the next 30 days', icon: 'shield', label: 'Expiring soon', tone: expiring ? 'warning' : 'success', value: String(expiring) },
    ],
    routes: [
      { hint: 'Declared routes SwarmOps owns', icon: 'arrow-forward', label: 'Routes', value: String(routes.length) },
      { hint: active === routes.length ? 'Runtime matches every declaration' : 'Runtime matches this many declarations', icon: 'check-circle', label: 'Active', tone: drifted ? 'warning' : 'success', value: String(active) },
      { hint: drifted ? 'Declared but missing or different in runtime' : 'No route has drifted from its declaration', icon: 'alert', label: 'Drifted', tone: drifted ? 'danger' : 'success', value: String(drifted) },
      { hint: 'Services declared as needing a route decision', icon: 'terminal', label: 'Needs configuration', tone: needsConfiguration ? 'warning' : 'success', unmeasured: !state, value: String(needsConfiguration) },
    ],
    dns: [
      { hint: credentials ? 'Cloudflare or ArvanCloud credentials stored' : 'No provider credential is stored', icon: 'key', label: 'Credentials', tone: credentials ? 'success' : 'neutral', value: String(credentials) },
      { hint: 'Records SwarmOps owns and can verify', icon: 'cloud', label: 'Owned records', unmeasured: !state, value: String(dnsRecords) },
      { hint: 'Certificates issued through a DNS-01 challenge', icon: 'shield', label: 'DNS-01 resolvers', unmeasured: !state, value: String(dnsResolvers) },
    ],
    certificates: [
      { hint: 'Certificates the gateway currently serves', icon: 'shield', label: 'Certificates', value: String(certificates.length) },
      { hint: expiring ? 'Inside the 30-day renewal window' : 'None expires in the next 30 days', icon: 'clock', label: 'Expiring soon', tone: expiring ? 'warning' : 'success', value: String(expiring) },
      { hint: 'Routes that terminate TLS at the gateway', icon: 'lock', label: 'TLS routes', value: String(routes.filter((row) => row.route.tls && row.route.tls !== 'off').length) },
    ],
  }

  return (
    <Screen
      about="Gateway & ports owns the Traefik runtime and entrypoints. Routes owns published application traffic. DNS providers owns Cloudflare and ArvanCloud credentials and records. TLS certificates owns ACME and handshake evidence."
      actions={
        <Inline>
          {!installed ? <Button disabled={installing} iconStart="plus" onClick={() => setInstallOpen(true)} variant="accent">Install gateway</Button> : null}
          <Button onClick={() => { window.location.hash = 'logs' }} variant="ghost">Open gateway logs</Button>
          <Button disabled={loading || refreshing} loading={refreshing} onClick={() => void load(true)} size="sm" variant="ghost">Refresh</Button>
        </Inline>
      }
      insights={insights[tab]}
      page={TAB_PAGE[tab]}
      status={<Badge dot variant={!installed ? 'neutral' : running ? 'success' : 'danger'}>{!installed ? 'Not managed by SwarmOps' : running ? 'Singleton healthy' : 'Singleton unhealthy'}</Badge>}
      width="full"
    >
      {tab !== 'overview' ? (!installed ? (
        <Banner title="No SwarmOps-managed Traefik is installed" tone="info">
          Runtime routes, access logs, certificates, and Prometheus targets remain empty until the reviewed Traefik stack is deployed. SwarmOps does not claim that host-native or Docker Compose gateways are absent; check the selected host before installing.
        </Banner>
      ) : (
        <Banner title="One gateway, one accepted failure domain" tone="warning">
          Traefik intentionally runs as one task. Applying static settings or adding a TCP/UDP entrypoint restarts that singleton and can interrupt every routed connection. Route enable/disable is dynamic once its entrypoint exists.
        </Banner>
      )) : null}

      {error ? <Banner title="Routing state unavailable" tone="danger">{error}</Banner> : null}
      {preflightError ? <Banner title="Installation prerequisites unavailable" tone="danger">{preflightError}</Banner> : null}
      {!installOpen && installError ? <Banner title="Gateway installation blocked" tone="danger">{installError}</Banner> : null}
      {installCommand && commandFailed(installCommand) ? (
        <Banner title="Gateway installation needs attention" tone="danger">
          <Rows gap="tight">
            <Body size="sm">{installCommand.failureSummary ?? installCommand.lastError ?? 'SwarmOps could not confirm that Traefik was installed.'}</Body>
            {installCommand.recoveryHint ? <Body size="sm"><strong>How to recover:</strong> {installCommand.recoveryHint}</Body> : null}
            <Inline>
              <Mono>{installCommand.id}</Mono>
              <Button onClick={() => { window.location.hash = 'commands' }} size="sm" variant="secondary">Open run details</Button>
            </Inline>
          </Rows>
        </Banner>
      ) : installCommand && installCommand.state !== 'succeeded' ? (
        <Banner title="Gateway installation is running" tone="info">
          <Inline>
            <Body size="sm">Run {installCommand.id.slice(0, 12)} remains {sentence(installCommand.state).toLowerCase()}.</Body>
            <Button onClick={() => { window.location.hash = 'commands' }} size="sm" variant="secondary">Open run details</Button>
          </Inline>
        </Banner>
      ) : null}

      {loading || !state ? <Panel><Rows><Body>Loading the selected manager’s sealed routing state…</Body></Rows></Panel> : null}

      {!loading && state && tab === 'overview' ? (
        <Rows>
          {!installed && preflight ? (
            <TraefikPreflightPanel
              command={repairCommand}
              credentials={dashboardCredentials}
              dashboardHost={state.settings.dashboardHost}
              error={repairError}
              onRepair={() => void repairPrerequisites()}
              preflight={preflight}
              repairing={repairing}
            />
          ) : null}
          <TrafficOverview certificates={certificates} prometheus={prometheus} routes={routes} state={state} />
          <DNSSettingsTab onQueued={() => void load(false)} scope="gateway" state={state} toast={toast} />
        </Rows>
      ) : null}
      {!loading && state && tab === 'routes' ? <RoutesTab cutover={cutover} onQueued={() => void load(false)} routes={routes} state={state} toast={toast} /> : null}
      {!loading && state && tab === 'certificates' ? <CertificatesTab certificates={certificates} onQueued={() => void load(false)} routes={routes} toast={toast} /> : null}
      {!loading && state && tab === 'dns' ? <DNSSettingsTab onQueued={() => void load(false)} scope="dns" state={state} toast={toast} /> : null}

      <Sheet closeLabel="Close gateway installation" onClose={() => { setInstallOpen(false); setInstallConfirmation('') }} open={installOpen} title="Install Traefik gateway">
        <Rows>
          <Body size="sm">SwarmOps will deploy its reviewed singleton Traefik stack on the selected manager. Routes, certificates, access logs, and metrics become available after the run succeeds.</Body>
          {installError ? <Banner title="Gateway installation blocked" tone="danger">{installError}</Banner> : null}
          <Input autoCapitalize="none" hint="Use the public hostname that will open the protected dashboard, without https:// or a path." label="Dashboard hostname" onChange={(event) => setDashboardHost(event.target.value)} placeholder="traefik.example.com" spellCheck={false} value={dashboardHost} />
          {preflight
            ? (
              <TraefikPreflightPanel
                command={repairCommand}
                credentials={dashboardCredentials}
                dashboardHost={dashboardHost}
                error={repairError}
                onRepair={() => void repairPrerequisites()}
                preflight={preflight}
                repairing={repairing}
              />
            )
            : <Banner title="Prerequisites not loaded" tone="warning">Refresh Gateway &amp; ports before installing so SwarmOps can verify the selected manager.</Banner>}
          <Banner title="Check for an existing gateway first" tone="warning">SwarmOps detects its own Swarm service, but not host-native or Docker Compose proxies. Do not continue if another process already binds the configured HTTP or HTTPS ports.</Banner>
          <Facts columns={1} items={[
            { label: 'Target', value: 'Selected Swarm manager' },
            { label: 'Result', value: 'One Traefik gateway service managed by SwarmOps' },
            { label: 'Impact', value: 'Publishes configured gateway ports. A port conflict prevents the new gateway from starting; existing services are not replaced.' },
          ]} />
          <Input hint="Type DEPLOY_TRAEFIK exactly." label="Confirmation" onChange={(event) => setInstallConfirmation(event.target.value)} placeholder="DEPLOY_TRAEFIK" value={installConfirmation} />
          <Inline>
            <Button disabled={installing || !preflight?.ready || !validDashboardHostname(dashboardHost) || installConfirmation !== 'DEPLOY_TRAEFIK'} loading={installing} onClick={() => void install()} variant="accent">Install gateway</Button>
            <Button onClick={() => { setInstallOpen(false); setInstallConfirmation('') }} variant="secondary">Cancel</Button>
          </Inline>
        </Rows>
      </Sheet>
    </Screen>
  )
}
