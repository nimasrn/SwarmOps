import { useEffect, useMemo, useState } from 'react'
import {
  Banner,
  Button,
  DetailHeader,
  Facts,
  Icon,
  Inline,
  List,
  ListRow,
  Metric,
  MetricGrid,
  CodeBlock,
  Mono,
  Page,
  Panel,
  Select,
  Spinner,
  Stack as Rows,
  StatusDot,
  Body,
  useToast,
} from '@nim.zone/ui'
import { api } from './api'
import { isNativeAgent, serverEndpointLabel } from './server-connection'
import type { AgentHealth, Server } from './types'

interface AgentDiagnosticsPageProps {
  onRefreshServers: () => Promise<void>
  servers: Server[]
  toast: ReturnType<typeof useToast>
}

const AGENT_INSTALL_URL = 'https://github.com/nimasrn/SwarmOps/releases/latest/download/install-swarmops-agent.sh'

function agentUpgradeCommand(platform: 'linux' | 'macos') {
  return platform === 'linux'
    ? `curl -fsSL ${AGENT_INSTALL_URL} | sudo bash -s --`
    : `curl -fsSL ${AGENT_INSTALL_URL} | bash`
}

// AgentDiagnosticsPage is intentionally a safe event view, not a host-log
// tail. It combines the core's retained transport observations with the
// bounded lifecycle events emitted by the native machine agent.
export function AgentDiagnosticsPage({ onRefreshServers, servers, toast }: AgentDiagnosticsPageProps) {
  const agents = useMemo(() => servers.filter(isNativeAgent), [servers])
  const [serverID, setServerID] = useState('')
  const [health, setHealth] = useState<AgentHealth | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [updating, setUpdating] = useState(false)
  const server = agents.find((candidate) => candidate.id === serverID)
  const current = health ?? server?.agentHealth
  const state = current?.state ?? 'unknown'
  const update = current?.update
  const compatibilityIssue = current?.events?.some((event) => event.code === 'agent_protocol_incompatible') ?? false

  useEffect(() => {
    setServerID((currentID) => agents.some((server) => server.id === currentID) ? currentID : agents[0]?.id ?? '')
  }, [agents])

  useEffect(() => {
    let cancelled = false
    setHealth(null)
    setError('')
    if (!serverID) return () => { cancelled = true }
    setLoading(true)
    void api.agentDiagnostics(serverID)
      .then((next) => { if (!cancelled) setHealth(next) })
      .catch((reason) => { if (!cancelled) setError(messageOf(reason)) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [serverID])

  const refresh = async () => {
    if (!serverID) return
    setLoading(true)
    setError('')
    try {
      setHealth(await api.agentDiagnostics(serverID))
      await onRefreshServers()
      toast({ message: 'Agent diagnostics refreshed', tone: 'success' })
    } catch (reason) {
      setError(messageOf(reason))
    } finally {
      setLoading(false)
    }
  }

  const requestUpdate = async () => {
    if (!server || compatibilityIssue || !update?.automatic) return
    setUpdating(true)
    setError('')
    try {
      setHealth(await api.requestAgentUpdate(server.id))
      await onRefreshServers()
      toast({ message: 'Core requested the server’s local agent update check', tone: 'success' })
    } catch (reason) {
      setError(messageOf(reason))
    } finally {
      setUpdating(false)
    }
  }

  const events = [...(current?.events ?? [])].reverse()
  return (
    <Page width="full">
      <DetailHeader
        status={<StatusDot tone={statusTone(state)}>{statusLabel(state, current?.summary)}</StatusDot>}
        subtitle="See the last authenticated agent probe, the controller’s safe failure observations, and the agent’s bounded lifecycle events. Service logs and command output stay on the server."
        title="Agent diagnostics"
      />
      {error ? <Banner title="Agent diagnostics need attention" tone="danger">{error}</Banner> : null}
      <Panel title="Machine agent">
        <Rows>
		  <Inline>
            <Select
              label="Saved native machine agent"
              onChange={(event) => setServerID(event.target.value)}
              options={agents.map((candidate) => ({ label: `${candidate.name} · ${candidate.host}`, value: candidate.id }))}
              placeholder="Add a native machine agent in Servers"
              value={serverID}
            />
            <Button disabled={!serverID || loading} iconStart="refresh" loading={loading} onClick={() => void refresh()} size="sm" variant="secondary">Refresh diagnosis</Button>
          </Inline>
          {!agents.length ? <Banner title="No native machine agent saved" tone="warning">Connect a server from Servers first. Legacy SSH profiles intentionally have no diagnostics or automatic update channel.</Banner> : null}
        </Rows>
      </Panel>
      {!server ? null : loading && !current ? <Panel title="Reading agent evidence"><Spinner label="Contacting the pinned machine agent" /></Panel> : <>
        <MetricGrid aria-label="Machine agent health" columns={4}>
          <Metric hint={current?.detail || 'No authenticated probe has completed yet.'} icon="activity" label="Agent health" tone={metricTone(state)} value={statusLabel(state, current?.summary)} />
          <Metric hint={current?.protocolVersion ? `Machine API protocol ${current.protocolVersion}` : 'The server has not reported its fixed agent protocol yet.'} icon="server" label="Agent version" tone={current?.agentVersion ? 'success' : 'neutral'} value={current?.agentVersion || 'Unknown'} />
          <Metric hint={current?.lastReachableAt ? `Last reachable ${formatDateTime(current.lastReachableAt)}` : 'No successful authenticated probe has been retained.'} icon="clock" label="Last probe" tone={current?.lastReachableAt ? 'success' : 'warning'} value={current?.lastReachableAt ? formatDateTime(current.lastReachableAt) : 'No response'} />
          <Metric hint={update?.automatic ? 'A trusted local Git check runs every six hours even if Core is unavailable.' : 'Automatic updates are not configured on this agent.'} icon="refresh" label="Automatic updates" tone={update?.automatic ? 'success' : 'neutral'} value={update?.state ? update.state.replace('_', ' ') : update?.automatic ? 'Scheduled' : 'Not configured'} />
        </MetricGrid>
        <Panel title="Safe connection evidence">
          <Facts items={[
            { label: 'Control transport', value: serverEndpointLabel(server) },
            { label: 'Last reachable', value: formatDateTime(current?.lastReachableAt) },
            { label: 'Last failed probe', value: formatDateTime(current?.lastFailureAt) },
            { label: 'Agent uptime', value: formatDuration(current?.uptimeSeconds) },
            { label: 'Git revision', value: update?.revision ? <Mono>{update.revision}</Mono> : '—' },
            { label: 'Last local update', value: formatDateTime(update?.lastUpdatedAt) },
          ]} />
        </Panel>
        {compatibilityIssue ? (
          <Banner title="This agent needs a one-time manual upgrade" tone="warning">
            The core reached the server, but this older agent does not have the fixed update endpoint. Run the current one-command installer once on that server. It preserves the existing API key on reinstall and enables future automatic updates.
            <Rows gap="tight">
              <Body size="sm">Use one of these commands:</Body>
              <CodeBlock label="Linux" wrap>{agentUpgradeCommand('linux')}</CodeBlock>
              <CodeBlock label="macOS" wrap>{agentUpgradeCommand('macos')}</CodeBlock>
            </Rows>
          </Banner>
        ) : null}
        <Panel title="Update policy">
          <Rows gap="tight">
            <Body size="sm">When the core can reach a current agent, it asks the server to run its own trusted Git check. When it cannot, the server’s local timer performs the same check. No browser or core request can supply a repository, branch, command, or binary.</Body>
            <Inline>
              <Button disabled={!update?.automatic || compatibilityIssue || state === 'unhealthy' || updating} iconStart="refresh" loading={updating} onClick={() => void requestUpdate()} variant="accent">Check and update agent</Button>
              <Body size="sm">{compatibilityIssue ? 'Manual one-time upgrade required' : update?.automatic ? `Last requested ${formatDateTime(update.requestedAt)}` : 'Automatic updates are disabled on this server'}</Body>
            </Inline>
          </Rows>
        </Panel>
        <Panel title="Agent event history">
          {events.length ? <List plain>{events.map((event) => <ListRow key={`${event.source}-${event.occurredAt}-${event.code}`} leading={<Icon name={event.level === 'error' ? 'danger' : event.level === 'warning' ? 'alert' : 'activity'} size="sm" tone={event.level === 'error' ? 'danger' : event.level === 'warning' ? 'warning' : 'accent'} />} subtitle={`${event.source === 'core' ? 'Core observation' : 'Machine agent'} · ${formatDateTime(event.occurredAt)}`} title={event.message} trailing={<Mono>{event.code}</Mono>} />)}</List> : <Body size="sm">No safe event has been retained yet. Refresh diagnostics after the agent completes an authenticated probe.</Body>}
        </Panel>
      </>}
    </Page>
  )
}

function statusLabel(state: string, summary?: string) { return summary || (state ? state[0].toUpperCase() + state.slice(1) : 'Unknown') }
function statusTone(state: string): 'danger' | 'neutral' | 'success' | 'warning' { return state === 'healthy' ? 'success' : state === 'degraded' ? 'warning' : state === 'unhealthy' ? 'danger' : 'neutral' }
function metricTone(state: string): 'danger' | 'neutral' | 'success' | 'warning' { return statusTone(state) }
function formatDateTime(value?: string) { return value && !value.startsWith('0001-01-01') ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—' }
function formatDuration(seconds?: number) { if (!seconds) return '—'; const days = Math.floor(seconds / 86400); const hours = Math.floor((seconds % 86400) / 3600); return days ? `${days}d ${hours}h` : `${hours}h` }
function messageOf(reason: unknown) { return reason instanceof Error ? reason.message : 'Unexpected agent diagnostic error' }
