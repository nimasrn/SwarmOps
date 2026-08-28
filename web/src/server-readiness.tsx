import { useEffect, useMemo, useState } from 'react'
import {
  Banner,
  Button,
  Columns,
  DetailHeader,
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
  ResourceMeter,
  Select,
  Sheet,
  Spinner,
  Stack as Rows,
  StatusDot,
  Textarea,
  Body,
  useToast,
} from '@nim.zone/ui'
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

type ReadinessAction = 'docker' | 'firewall' | 'os' | 'swarm'

export function ServerReadinessPage({ servers, toast }: ServerReadinessPageProps) {
  const connected = useMemo(() => servers.filter(isConnectedNativeAgent), [servers])
  const [serverID, setServerID] = useState('')
  const [readiness, setReadiness] = useState<ServerReadiness | null>(null)
  const [plan, setPlan] = useState<ReadinessPlan>(emptyPlan)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [lastQueued, setLastQueued] = useState<Command | null>(null)
  const [reviewing, setReviewing] = useState<ReadinessAction | null>(null)

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
        setPlan(emptyPlan)
      })
      .catch((reason) => {
        if (!cancelled) setError(messageOf(reason))
      })
    return () => { cancelled = true }
  }, [serverID])

  const blockers = readinessBlocks(server, readiness, plan)
  const selectedCount = countSelected(plan)

  const review = (action: ReadinessAction) => {
    if (!readiness) return
    setPlan({
      ...emptyPlan,
      applyUFW: action === 'firewall',
      initializeSwarm: action === 'swarm',
      installDocker: action === 'docker' && !readiness.docker.installed,
      updateDocker: action === 'docker' && readiness.docker.installed,
      updateOS: action === 'os',
    })
    setReviewing(action)
  }

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
      setReviewing(null)
      setPlan(emptyPlan)
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
        subtitle="Complete the checks below so this server can safely run workloads. Each fix opens a clear review before anything changes."
        title={server ? `Prepare ${server.name} for workloads` : 'Prepare a server for workloads'}
      />
      {error ? <Banner title="Server readiness needs attention" tone="danger">{error}</Banner> : null}
      <Panel title="Server">
          <Rows>
            <Body size="sm">Choose the connected server you want to prepare. A new server can be set up before it joins a Swarm.</Body>
            <Select
              label="Connected server"
              onChange={(event) => setServerID(event.target.value)}
              options={connected.map((candidate) => ({ label: `${candidate.name} · ${candidate.host}`, value: candidate.id }))}
              placeholder="Connect a server in Servers"
              value={serverID}
            />
            {!connected.length ? <Banner title="No connected native agent" tone="warning">Run the one-command installer, paste its one-time enrollment token in Servers, then return here. SSH profiles intentionally cannot receive browser-driven host changes.</Banner> : null}
          </Rows>
      </Panel>

      {!server ? null : !readiness ? <Panel title="Checking server"><Spinner label="Reading server readiness" /></Panel> : <>
          <Panel caption="Live evidence from the connected server" title="Current state">
            <MetricGrid dense>
              <Metric icon="server" label="Operating system" layout="inline" tone={readiness.os.supported ? 'success' : 'warning'} value={readiness.os.name || readiness.os.id || 'Unknown'} />
              <Metric icon="package" label="Docker Engine" layout="inline" tone={readiness.docker.running ? 'success' : readiness.docker.installed ? 'warning' : 'neutral'} value={readiness.docker.running ? readiness.docker.version || 'Running' : readiness.docker.installed ? 'Stopped' : 'Not installed'} />
              <Metric icon="layers" label="Swarm" layout="inline" tone={readiness.swarm.manager ? 'success' : readiness.swarm.state === 'active' ? 'warning' : 'neutral'} value={readiness.swarm.manager ? 'Manager' : readiness.swarm.state || 'Inactive'} />
              <Metric icon="shield" label="UFW" layout="inline" tone={readiness.firewall.enabled ? 'success' : readiness.firewall.available ? 'warning' : 'neutral'} value={readiness.firewall.enabled ? 'Enabled' : readiness.firewall.available ? 'Installed, disabled' : 'Not installed'} />
            </MetricGrid>
            <Facts items={[
                { label: 'Connection', value: serverEndpointLabel(server) },
              { label: 'Docker state', value: readiness.docker.running ? 'Agent can reach the local engine' : 'No local Engine control yet' },
              { label: 'Swarm state', value: readiness.swarm.state || 'Not initialised' },
            ]} />
          </Panel>

          <Panel caption={readiness.host ? `Collected ${formatDateTime(readiness.host.collectedAt)}` : 'No snapshot returned'} title="Host details">
            {readiness.host ? <Columns template="aside">
              <Rows gap="tight">
                <ResourceMeter detail={`Load average ${formatLoad(readiness.host.hardware.load1, readiness.host.hardware.load5, readiness.host.hardware.load15)}`} label="CPU capacity" value={`${readiness.host.hardware.cpuCores} core${readiness.host.hardware.cpuCores === 1 ? '' : 's'}`} />
                <ResourceMeter detail={`${formatBytes(readiness.host.hardware.memoryAvailableBytes)} available`} label="Memory" percent={usedPercent(readiness.host.hardware.memoryTotalBytes - readiness.host.hardware.memoryAvailableBytes, readiness.host.hardware.memoryTotalBytes)} tone={capacityTone(usedPercent(readiness.host.hardware.memoryTotalBytes - readiness.host.hardware.memoryAvailableBytes, readiness.host.hardware.memoryTotalBytes))} value={`${formatBytes(readiness.host.hardware.memoryTotalBytes - readiness.host.hardware.memoryAvailableBytes)} / ${formatBytes(readiness.host.hardware.memoryTotalBytes)}`} />
                <ResourceMeter detail={`${formatBytes(readiness.host.disk.availableBytes)} available`} label="Root disk" percent={usedPercent(readiness.host.disk.usedBytes, readiness.host.disk.totalBytes)} tone={capacityTone(usedPercent(readiness.host.disk.usedBytes, readiness.host.disk.totalBytes))} value={`${formatBytes(readiness.host.disk.usedBytes)} / ${formatBytes(readiness.host.disk.totalBytes)}`} />
              </Rows>
              <Facts columns={1} items={[
                { label: 'Hostname', mono: true, value: readiness.host.nodeName || server.name },
                { label: 'Operating system', value: readiness.host.os.name || readiness.os.name || 'Unknown' },
                { label: 'Kernel', mono: true, source: 'host probe', unmeasured: !readiness.host.os.kernel, value: readiness.host.os.kernel || 'not reported', why: 'the agent did not report a kernel version' },
                { label: 'Architecture', source: 'host probe', unmeasured: !readiness.host.os.architecture, value: readiness.host.os.architecture || 'not reported', why: 'the agent did not report an architecture' },
                { label: 'Agent', mono: true, value: versionLabel(readiness.host.version || server.agentHealth?.agentVersion) },
                { label: 'Uptime', value: formatDuration(readiness.host.hardware.uptimeSeconds) },
              ]} />
            </Columns> : <Banner title="Host inventory is unavailable" tone="warning">The agent answered the readiness probe but did not return a host snapshot. Update the agent, then refresh this page; Docker and Swarm actions remain explicitly scoped and disabled when unsupported.</Banner>}
          </Panel>

          <Panel
            caption={`${readinessIssueCount(readiness)} of 4 checks need action`}
            title="Setup checks"
          >
            <Rows>
              <ReadinessCheck action="Review updates" available={readiness.capabilities.updateOs} description="Keep the supported Ubuntu or Debian packages current." onAction={() => review('os')} ready={readiness.os.supported} title="Operating system packages" />
              <ReadinessCheck action={readiness.docker.installed ? 'Review update' : 'Install Docker'} available={readiness.docker.installed ? readiness.capabilities.updateDocker : readiness.capabilities.installDocker} description="Docker Engine must be installed, running, and reachable by the agent." onAction={() => review('docker')} ready={readiness.docker.running} title="Docker Engine" />
              <ReadinessCheck action="Start single-server cluster" available={readiness.capabilities.initializeSwarm && readiness.docker.installed} description="A manager is required to run and orchestrate workloads." onAction={() => review('swarm')} ready={readiness.swarm.state === 'active'} title="Swarm cluster" />
              <ReadinessCheck action="Configure firewall" available={readiness.capabilities.applyUfw} description="Allow the controller and Swarm peers without exposing the agent publicly." onAction={() => review('firewall')} ready={readiness.firewall.enabled} title="Firewall" />
            </Rows>
          </Panel>
          <Columns>
            <Panel title="How setup works"><Body size="sm">Choose one fix, review its exact target and impact, then run it. SwarmOps accepts only these fixed operations—never shell commands from the browser.</Body></Panel>
            <Panel title="Latest setup activity">{lastQueued ? <List plain><ListRow leading={<Icon name="clock" size="sm" tone="accent" />} subtitle={<Mono>{shortID(lastQueued.id)}</Mono>} title={`${lastQueued.action} queued`} /></List> : <Body size="sm">No setup action has been queued in this session.</Body>}</Panel>
          </Columns>
        </>}
      {reviewing && server && readiness ? (
        <Sheet closeLabel="Close setup review" onClose={() => { setReviewing(null); setPlan(emptyPlan) }} open title={readinessActionTitle(reviewing, readiness)}>
          <Rows>
            <Body size="sm">Review this fixed action before it is queued for the selected server.</Body>
            <Facts columns={1} items={readinessActionFacts(reviewing, server.name, readiness)} />
            {plan.initializeSwarm ? <Input hint="Optional. Leave blank to use a non-loopback local IPv4 address." label="Swarm advertise address" onChange={(event) => setPlan((current) => ({ ...current, advertiseAddress: event.target.value }))} placeholder="10.0.10.12" value={plan.advertiseAddress} /> : null}
            {plan.applyUFW ? <>
              <Textarea hint="Networks allowed to reach the machine API." label="Controller CIDRs" onChange={(event) => setPlan((current) => ({ ...current, controllerCIDRs: event.target.value }))} placeholder="10.10.0.0/16" value={plan.controllerCIDRs} />
              <Textarea hint="Networks allowed to exchange Docker Swarm traffic." label="Swarm peer CIDRs" onChange={(event) => setPlan((current) => ({ ...current, swarmPeerCIDRs: event.target.value }))} placeholder="10.20.0.0/16" value={plan.swarmPeerCIDRs} />
            </> : null}
            {blockers.length ? <Banner title="Resolve before running" tone="warning"><List plain>{blockers.map((blocker) => <ListRow key={blocker} leading={<Icon name="alert" size="sm" tone="warning" />} title={blocker} />)}</List></Banner> : null}
            <Inline><Button disabled={pending || blockers.length > 0 || selectedCount === 0} loading={pending} onClick={() => void queue()} variant="accent">{readinessActionButton(reviewing)}</Button><Button onClick={() => { setReviewing(null); setPlan(emptyPlan) }} variant="secondary">Cancel</Button></Inline>
          </Rows>
        </Sheet>
      ) : null}
    </Page>
  )
}

function ReadinessCheck({ action, available, description, onAction, ready, title }: { action: string; available: boolean; description: string; onAction: () => void; ready: boolean; title: string }) {
  return <List plain><ListRow leading={<Icon name={ready ? 'check-circle' : 'alert'} size="sm" tone={ready ? 'success' : 'warning'} />} subtitle={description} title={title} trailing={ready ? <StatusDot tone="success">Ready</StatusDot> : <Button disabled={!available} onClick={onAction} size="sm" variant="secondary">{available ? action : 'Unavailable'}</Button>} /></List>
}

function readinessActionTitle(action: ReadinessAction, readiness: ServerReadiness) {
  if (action === 'os') return 'Review operating system updates'
  if (action === 'docker') return readiness.docker.installed ? 'Update Docker Engine' : 'Install Docker Engine'
  if (action === 'swarm') return 'Start a single-server cluster'
  return 'Configure the firewall'
}

function readinessActionButton(action: ReadinessAction) {
  return action === 'swarm' ? 'Start cluster' : action === 'firewall' ? 'Configure firewall' : action === 'docker' ? 'Apply Docker change' : 'Apply updates'
}

function readinessActionFacts(action: ReadinessAction, serverName: string, readiness: ServerReadiness) {
  const result = action === 'os' ? 'Supported operating-system packages are updated.' : action === 'docker' ? (readiness.docker.installed ? 'Docker Engine is updated and left running.' : 'Docker Engine is installed and started.') : action === 'swarm' ? `${serverName} becomes the first Swarm manager.` : 'Only reviewed controller and Swarm peer networks are allowed.'
  const impact = action === 'os' ? 'Packages may restart services; use a maintenance window.' : action === 'docker' ? 'Docker may restart while packages are applied.' : action === 'swarm' ? 'Creates a new cluster; it never joins or changes an existing cluster.' : 'Preserves OpenSSH and does not expose the agent to the public internet.'
  return [{ label: 'Target', value: serverName }, { label: 'Result', value: result }, { label: 'Impact', value: impact }]
}

function readinessIssueCount(readiness: ServerReadiness) {
  return [readiness.os.supported, readiness.docker.running, readiness.swarm.state === 'active', readiness.firewall.enabled].filter((ready) => !ready).length
}

function versionLabel(version?: string) { return version ? `v${version.replace(/^v/, '')}` : 'Unavailable' }

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
