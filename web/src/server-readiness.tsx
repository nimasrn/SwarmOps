import { useEffect, useMemo, useState } from 'react'
import {
  Banner,
  Button,
  Columns,
  DetailHeader,
  DetailLayout,
  Facts,
  Icon,
  Inline,
  Input,
  List,
  ListRow,
  Metric,
  MetricGrid,
  Mono,
  Page,
  Panel,
  Rail,
  RailSection,
  ResourceMeter,
  Select,
  Spinner,
  StageTrack,
  Stack as Rows,
  StatusDot,
  Switch,
  Textarea,
  Body,
  useToast,
} from '@nim.zone/ui'
import type { Stage } from '@nim.zone/ui'
import { api } from './api'
import { isConnectedNativeAgent, serverEndpointLabel } from './server-connection'
import type { Command, Server, ServerReadiness } from './types'

interface ServerReadinessPageProps {
  servers: Server[]
  toast: ReturnType<typeof useToast>
}

type ReadinessPlan = {
  advertiseAddress: string
  applyUFW: boolean
  controllerCIDRs: string
  initializeSwarm: boolean
  installDocker: boolean
  swarmPeerCIDRs: string
  updateDocker: boolean
  updateOS: boolean
}

const emptyPlan: ReadinessPlan = {
  advertiseAddress: '',
  applyUFW: false,
  controllerCIDRs: '',
  initializeSwarm: false,
  installDocker: false,
  swarmPeerCIDRs: '',
  updateDocker: false,
  updateOS: false,
}

// ServerReadinessPage uses the same five-decision spine and fixed rail as the
// source-deploy screen. The difference is intentional: source deploy maps
// repository evidence to application slots; this flow maps a pinned host's
// observed state to a closed, audited machine-readiness plan.
export function ServerReadinessPage({ servers, toast }: ServerReadinessPageProps) {
  const connected = useMemo(() => servers.filter(isConnectedNativeAgent), [servers])
  const [serverID, setServerID] = useState('')
  const [readiness, setReadiness] = useState<ServerReadiness | null>(null)
  const [plan, setPlan] = useState<ReadinessPlan>(emptyPlan)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [lastQueued, setLastQueued] = useState<Command | null>(null)

  const server = connected.find((candidate) => candidate.id === serverID)

  useEffect(() => {
    setServerID((current) => connected.some((server) => server.id === current) ? current : connected[0]?.id ?? '')
  }, [connected])

  useEffect(() => {
    let cancelled = false
    setReadiness(null)
    setError('')
    setLastQueued(null)
    if (!serverID) return () => { cancelled = true }
    void api.serverReadiness(serverID)
      .then((next) => {
        if (cancelled) return
        setReadiness(next)
        setPlan({
          ...emptyPlan,
          initializeSwarm: next.docker.installed && next.swarm.state !== 'active',
          installDocker: !next.docker.installed,
        })
      })
      .catch((reason) => {
        if (!cancelled) setError(messageOf(reason))
      })
    return () => { cancelled = true }
  }, [serverID])

  const blockers = readinessBlocks(server, readiness, plan)
  const selectedCount = countSelected(plan)
  const stages: Stage[] = [
    { caption: 'Pinned machine agent', id: 'server', label: 'Server', status: server ? 'done' : 'active' },
    { caption: 'Read live readiness', id: 'inspect', label: 'Inspect', status: readiness ? 'done' : server ? 'active' : 'pending' },
    { caption: 'Choose fixed changes', id: 'plan', label: 'Plan', status: selectedCount ? 'done' : readiness ? 'active' : 'pending' },
    { caption: 'Confirm boundaries', id: 'review', label: 'Review', status: blockers.length ? 'blocked' : selectedCount ? 'done' : 'pending' },
    { caption: 'Durable execution', id: 'run', label: 'Run', status: blockers.length === 0 && selectedCount ? 'active' : 'pending' },
  ]

  const refresh = async () => {
    if (!serverID) return
    setPending(true)
    try {
      setReadiness(await api.serverReadiness(serverID))
      toast({ message: 'Server readiness refreshed', tone: 'success' })
    } catch (reason) {
      setError(messageOf(reason))
    } finally {
      setPending(false)
    }
  }

  const queue = async () => {
    if (!server || blockers.length > 0 || !selectedCount) return
    setPending(true)
    setError('')
    try {
      const command = await api.prepareServer(server.id, {
        advertiseAddress: plan.advertiseAddress.trim() || undefined,
        applyUfw: plan.applyUFW,
        confirmation: 'PREPARE_SERVER',
        controllerCidrs: splitCIDRs(plan.controllerCIDRs),
        initializeSwarm: plan.initializeSwarm,
        installDocker: plan.installDocker,
        swarmPeerCidrs: splitCIDRs(plan.swarmPeerCIDRs),
        updateDocker: plan.updateDocker,
        updateOs: plan.updateOS,
      })
      setLastQueued(command)
      toast({ message: `Server readiness queued (${shortID(command.id)})`, tone: 'success' })
    } catch (reason) {
      setError(messageOf(reason))
    } finally {
      setPending(false)
    }
  }

  return (
    <Page width="full">
      <DetailHeader
        actions={<Button disabled={!serverID || pending} iconStart="refresh" loading={pending} onClick={() => void refresh()} variant="secondary">Refresh evidence</Button>}
        status={<StatusDot tone={!server ? 'neutral' : error ? 'danger' : readiness ? 'success' : 'warning'}>{!server ? 'Choose a host' : error ? 'Needs attention' : readiness ? 'Agent connected' : 'Inspecting host'}</StatusDot>}
        subtitle="Inspect the enrolled host before Docker exists, then queue only fixed, audited operating-system, Docker, Swarm, and firewall operations for that exact machine."
        title={server?.name ?? 'Server readiness'}
      />
      {error ? <Banner title="Server readiness needs attention" tone="danger">{error}</Banner> : null}
      <StageTrack label="Server readiness stages" stages={stages} />
      <DetailLayout
        aside={
          <ReadinessRail
            blockers={blockers}
            lastQueued={lastQueued}
            onQueue={() => void queue()}
            onRefresh={() => void refresh()}
            pending={pending}
            plan={plan}
            readiness={readiness}
            server={server}
            selectedCount={selectedCount}
          />
        }
      >
        <Panel marker="1" title="Server">
          <Rows>
            <Body size="sm">Choose a connected native machine agent. This is separate from the selected Swarm manager so a new server can become ready before it joins cluster operations.</Body>
            <Select
              label="Connected machine agent"
              onChange={(event) => setServerID(event.target.value)}
              options={connected.map((candidate) => ({ label: `${candidate.name} · ${candidate.host}`, value: candidate.id }))}
              placeholder="Connect a server in Servers"
              value={serverID}
            />
            {!connected.length ? <Banner title="No connected native agent" tone="warning">Run the one-command installer, paste its one-time enrollment token in Servers, then return here. SSH profiles intentionally cannot receive browser-driven host changes.</Banner> : null}
          </Rows>
        </Panel>

        {!server ? null : !readiness ? <Panel marker="2" title="Inspect"><Spinner label="Reading server readiness" /></Panel> : <>
          <Panel marker="2" caption="Observed through the pinned agent" title="Readiness evidence">
            <MetricGrid dense>
              <Metric icon="server" label="Operating system" layout="inline" tone={readiness.os.supported ? 'success' : 'warning'} value={readiness.os.name || readiness.os.id || 'Unknown'} />
              <Metric icon="package" label="Docker Engine" layout="inline" tone={readiness.docker.running ? 'success' : readiness.docker.installed ? 'warning' : 'neutral'} value={readiness.docker.running ? readiness.docker.version || 'Running' : readiness.docker.installed ? 'Installed, not ready' : 'Not installed'} />
              <Metric icon="layers" label="Swarm" layout="inline" tone={readiness.swarm.manager ? 'success' : readiness.swarm.state === 'active' ? 'warning' : 'neutral'} value={readiness.swarm.manager ? 'Manager' : readiness.swarm.state || 'Inactive'} />
              <Metric icon="shield" label="UFW" layout="inline" tone={readiness.firewall.enabled ? 'success' : readiness.firewall.available ? 'warning' : 'neutral'} value={readiness.firewall.enabled ? 'Enabled' : readiness.firewall.available ? 'Installed, disabled' : 'Not installed'} />
            </MetricGrid>
            <Facts items={[
              { label: 'Control transport', value: serverEndpointLabel(server) },
              { label: 'Docker state', value: readiness.docker.running ? 'Agent can reach the local engine' : 'No local Engine control yet' },
              { label: 'Swarm state', value: readiness.swarm.state || 'Not initialised' },
            ]} />
          </Panel>

          <Panel marker="3" caption={readiness.host ? `Collected ${formatDateTime(readiness.host.collectedAt)}` : 'No snapshot returned'} title="Host inventory">
            {readiness.host ? <Columns template="aside">
              <Rows gap="tight">
                <ResourceMeter detail={`Load average ${formatLoad(readiness.host.hardware.load1, readiness.host.hardware.load5, readiness.host.hardware.load15)}`} label="CPU capacity" value={`${readiness.host.hardware.cpuCores} core${readiness.host.hardware.cpuCores === 1 ? '' : 's'}`} />
                <ResourceMeter detail={`${formatBytes(readiness.host.hardware.memoryAvailableBytes)} available`} label="Memory" percent={usedPercent(readiness.host.hardware.memoryTotalBytes - readiness.host.hardware.memoryAvailableBytes, readiness.host.hardware.memoryTotalBytes)} tone={capacityTone(usedPercent(readiness.host.hardware.memoryTotalBytes - readiness.host.hardware.memoryAvailableBytes, readiness.host.hardware.memoryTotalBytes))} value={`${formatBytes(readiness.host.hardware.memoryTotalBytes - readiness.host.hardware.memoryAvailableBytes)} / ${formatBytes(readiness.host.hardware.memoryTotalBytes)}`} />
                <ResourceMeter detail={`${formatBytes(readiness.host.disk.availableBytes)} available`} label="Root disk" percent={usedPercent(readiness.host.disk.usedBytes, readiness.host.disk.totalBytes)} tone={capacityTone(usedPercent(readiness.host.disk.usedBytes, readiness.host.disk.totalBytes))} value={`${formatBytes(readiness.host.disk.usedBytes)} / ${formatBytes(readiness.host.disk.totalBytes)}`} />
              </Rows>
              <Facts columns={1} items={[
                { label: 'Hostname', mono: true, value: readiness.host.nodeName || server.name },
                { label: 'Operating system', value: readiness.host.os.name || readiness.os.name || 'Unknown' },
                { label: 'Kernel', mono: true, value: readiness.host.os.kernel || '—' },
                { label: 'Architecture', value: readiness.host.os.architecture || '—' },
                { label: 'Agent version', mono: true, value: readiness.host.version || server.agentHealth?.agentVersion || '—' },
                { label: 'Uptime', value: formatDuration(readiness.host.hardware.uptimeSeconds) },
              ]} />
            </Columns> : <Banner title="Host inventory is unavailable" tone="warning">The agent answered the readiness probe but did not return a host snapshot. Update the agent, then refresh this page; Docker and Swarm actions remain explicitly scoped and disabled when unsupported.</Banner>}
          </Panel>

          <Panel marker="4" title="Readiness plan">
            <Rows>
              <Body size="sm">Each switch maps to a fixed, reviewed operation on this exact server. SwarmOps does not accept package names, shell snippets, systemctl units, UFW rules, or arbitrary command output from this screen.</Body>
              <Switch checked={plan.updateOS} disabled={!readiness.capabilities.updateOs || pending} description="Runs the supported Debian/Ubuntu package update and upgrade flow. Review maintenance windows before selecting it." onChange={(event) => setPlan((current) => ({ ...current, updateOS: event.target.checked }))}>Update operating system packages</Switch>
              {!readiness.docker.installed ? <Switch checked={plan.installDocker} disabled={!readiness.capabilities.installDocker || pending} description="Installs Docker Engine from Docker’s signed Debian/Ubuntu repository and enables the service." onChange={(event) => setPlan((current) => ({ ...current, installDocker: event.target.checked, updateDocker: false }))}>Install Docker Engine</Switch> : <Switch checked={plan.updateDocker} disabled={!readiness.capabilities.updateDocker || pending} description="Updates the reviewed Docker Engine package set and ensures Docker is enabled." onChange={(event) => setPlan((current) => ({ ...current, updateDocker: event.target.checked, installDocker: false }))}>Update Docker Engine</Switch>}
              <Switch checked={plan.initializeSwarm} disabled={!readiness.capabilities.initializeSwarm || (!readiness.docker.installed && !plan.installDocker) || pending} description="Initialises only an inactive host as a single-node Swarm. Joining an existing Swarm stays an explicit, separate operator action." onChange={(event) => setPlan((current) => ({ ...current, initializeSwarm: event.target.checked }))}>Initialise single-node Swarm</Switch>
              {plan.initializeSwarm ? <Input hint="Optional. If blank, the helper chooses a non-loopback local IPv4 address; a supplied address must belong to this host." label="Swarm advertise address" onChange={(event) => setPlan((current) => ({ ...current, advertiseAddress: event.target.value }))} placeholder="10.0.10.12" value={plan.advertiseAddress} /> : null}
              <Switch checked={plan.applyUFW} disabled={!readiness.capabilities.applyUfw || pending} description="Preserves OpenSSH, limits the agent API to controller CIDRs, and opens Swarm ports only to peer CIDRs. It never opens the API to the internet by default." onChange={(event) => setPlan((current) => ({ ...current, applyUFW: event.target.checked }))}>Apply UFW baseline</Switch>
              {plan.applyUFW ? <>
                <Textarea hint="Comma or newline separated IPv4/IPv6 CIDRs. These are the only networks allowed to reach the machine API port." label="Controller CIDRs" onChange={(event) => setPlan((current) => ({ ...current, controllerCIDRs: event.target.value }))} placeholder={'10.10.0.0/16\n2001:db8:10::/64'} value={plan.controllerCIDRs} />
                <Textarea hint="Comma or newline separated CIDRs for managers and workers. These receive only Docker Swarm control, gossip, and overlay traffic." label="Swarm peer CIDRs" onChange={(event) => setPlan((current) => ({ ...current, swarmPeerCIDRs: event.target.value }))} placeholder="10.20.0.0/16" value={plan.swarmPeerCIDRs} />
              </> : null}
            </Rows>
          </Panel>

          <Panel marker="5" title="Review and queue">
            <Rows>
              <Banner title="Latest pending intent wins" tone="info">Submitting another identical readiness plan for this server removes the older queued or retry-scheduled plan. A running operation or a command needing attention is never hidden or cancelled.</Banner>
              <Banner title="No remote shell boundary" tone="neutral">The controller sends a typed plan to a local-only helper. The helper validates it again and runs only the reviewed OS, Docker, Swarm, and UFW steps; it returns no host command output to the browser.</Banner>
              {blockers.length ? <Banner title={`${blockers.length} blocker${blockers.length === 1 ? '' : 's'} to resolve`} tone="warning"><List plain>{blockers.map((blocker) => <ListRow key={blocker} leading={<Icon name="alert" size="sm" tone="warning" />} title={blocker} />)}</List></Banner> : <Inline><StatusDot tone="success">Ready to queue {selectedCount} fixed operation{selectedCount === 1 ? '' : 's'}.</StatusDot></Inline>}
            </Rows>
          </Panel>
        </>}
      </DetailLayout>
    </Page>
  )
}

function ReadinessRail({ blockers, lastQueued, onQueue, onRefresh, pending, plan, readiness, selectedCount, server }: {
  blockers: string[]
  lastQueued: Command | null
  onQueue: () => void
  onRefresh: () => void
  pending: boolean
  plan: ReadinessPlan
  readiness: ServerReadiness | null
  selectedCount: number
  server?: Server
}) {
  const firewallNetworks = splitCIDRs(plan.controllerCIDRs).length + splitCIDRs(plan.swarmPeerCIDRs).length
  return (
    <Rail
      actions={<Button disabled={!server || pending} iconStart="refresh" loading={pending} onClick={onRefresh} size="sm" variant="secondary">Refresh</Button>}
      footer={<><Button disabled={!server || pending || blockers.length > 0 || selectedCount === 0} fullWidth iconStart="play" loading={pending} onClick={onQueue} variant="accent">Queue readiness plan</Button><span>{blockers.length ? 'Resolve blockers to enable execution' : selectedCount ? 'The durable worker owns this server plan' : 'Choose at least one fixed operation'}</span></>}
      title="Server readiness plan"
    >
      <RailSection meta={server ? '1 target' : '—'} title="Server">
        {server ? <List plain><ListRow leading={<Icon name="server" size="sm" />} subtitle={<Mono>{serverEndpointLabel(server)}</Mono>} title={server.name} trailing={<Icon name="check-circle" size="xs" tone="success" />} /></List> : <Body size="sm">Select a connected native machine agent.</Body>}
      </RailSection>
      <RailSection meta={`${selectedCount} selected`} title="Fixed operations">
        <List plain>
          <ReadinessOperation active={plan.updateOS} label="Operating system packages" />
          <ReadinessOperation active={plan.installDocker} label="Install Docker Engine" />
          <ReadinessOperation active={plan.updateDocker} label="Update Docker Engine" />
          <ReadinessOperation active={plan.initializeSwarm} label="Initialise single-node Swarm" />
          <ReadinessOperation active={plan.applyUFW} label="Apply UFW baseline" />
        </List>
      </RailSection>
      <RailSection meta={readiness?.swarm.manager ? 'manager' : readiness?.swarm.state || 'inactive'} title="Swarm membership">
        <Body size="sm">{plan.initializeSwarm ? 'The helper will initialise only an inactive host. It will never join, leave, or alter an existing cluster.' : 'No Swarm membership change is selected.'}</Body>
      </RailSection>
      <RailSection meta={plan.applyUFW ? `${firewallNetworks} CIDRs` : 'not selected'} title="Firewall boundary">
        <Body size="sm">{plan.applyUFW ? 'OpenSSH remains allowed. The agent API is restricted to controller CIDRs; Swarm ports are restricted to peer CIDRs.' : 'UFW is not changed by this plan.'}</Body>
      </RailSection>
      {lastQueued ? <RailSection meta="queued" title="Latest command"><List plain><ListRow leading={<Icon name="clock" size="sm" tone="accent" />} subtitle={<Mono>{shortID(lastQueued.id)}</Mono>} title={lastQueued.action} /></List></RailSection> : null}
      {blockers.length ? <RailSection meta={String(blockers.length)} title="Blockers" tone="danger"><List plain>{blockers.map((blocker) => <ListRow key={blocker} leading={<Icon name="danger" size="sm" tone="danger" />} title={blocker} />)}</List></RailSection> : null}
    </Rail>
  )
}

function ReadinessOperation({ active, label }: { active: boolean; label: string }) {
  return <ListRow leading={<Icon name={active ? 'check-circle' : 'minus'} size="sm" tone={active ? 'success' : undefined} />} subtitle={active ? 'Included in this plan' : 'Not selected'} title={label} />
}

function readinessBlocks(server: Server | undefined, readiness: ServerReadiness | null, plan: ReadinessPlan) {
  const blocks: string[] = []
  if (!server) blocks.push('Select a connected native machine agent.')
  if (!readiness) return blocks
  if (!readiness.os.supported) blocks.push('Server readiness currently supports Debian and Ubuntu Linux only.')
  if (plan.installDocker && !readiness.capabilities.installDocker) blocks.push('Docker installation is not available from this agent.')
  if (plan.updateDocker && !readiness.capabilities.updateDocker) blocks.push('Docker updates are not available from this agent.')
  if (plan.updateOS && !readiness.capabilities.updateOs) blocks.push('Operating-system updates are not available from this agent.')
  if (plan.initializeSwarm && !readiness.capabilities.initializeSwarm) blocks.push('Swarm initialisation is not available from this agent.')
  if (plan.initializeSwarm && !readiness.docker.installed && !plan.installDocker) blocks.push('Install Docker before initialising a Swarm.')
  if (plan.applyUFW && !readiness.capabilities.applyUfw) blocks.push('UFW changes are not available from this agent.')
  if (plan.applyUFW && !splitCIDRs(plan.controllerCIDRs).length) blocks.push('Provide at least one controller CIDR for the machine API.')
  if (plan.applyUFW && !splitCIDRs(plan.swarmPeerCIDRs).length) blocks.push('Provide at least one Swarm peer CIDR for Docker Swarm traffic.')
  return blocks
}

function countSelected(plan: ReadinessPlan) {
  return [plan.updateOS, plan.installDocker, plan.updateDocker, plan.initializeSwarm, plan.applyUFW].filter(Boolean).length
}

function splitCIDRs(value: string) {
  return value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean)
}

function shortID(value: string) { return value.length > 12 ? `${value.slice(0, 12)}…` : value }
function usedPercent(used: number, total: number) { return total > 0 ? Math.min(100, Math.max(0, (used / total) * 100)) : 0 }
function capacityTone(percent: number): 'accent' | 'danger' | 'warning' { return percent >= 90 ? 'danger' : percent >= 75 ? 'warning' : 'accent' }
function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0 B'
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB']
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1)
  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value / (1024 ** index))} ${units[index]}`
}
function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—'
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return days ? `${days}d ${hours}h` : hours ? `${hours}h ${minutes}m` : `${minutes}m`
}
function formatLoad(load1: number, load5: number, load15: number) { return [load1, load5, load15].map((value) => Number.isFinite(value) ? value.toFixed(2) : '—').join(' / ') }
function formatDateTime(value: string) { return value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—' }
function messageOf(reason: unknown) { return reason instanceof Error ? reason.message : 'Unexpected server readiness error' }
