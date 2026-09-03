import { useEffect, useState } from 'react'
import {
  Badge,
  Banner,
  Body,
  Button,
  DetailHeader,
  Facts,
  Inline,
  Mono,
  Page,
  Panel,
  Tabs,
  Spinner,
  Stack as Rows,
  StatusDot,
  Table,
  useToast,
} from '@nim.zone/ui'
import type { TableColumn } from '@nim.zone/ui'
import { api } from '../../data/api'
import type { MachineMetrics, Server } from '../../data/types'
import { messageOf } from '../../lib/errors'
import { capitalize, formatBytes, formatDateTime, shortID } from '../../lib/format'
import { MetricChartGrid } from '../../components/metric-chart'
import { InsightRow } from '../../components/screen'
import { pageEntry, type WorkspacePage } from '../../navigation/navigation'
import { useRecordView } from '../../navigation/use-workspace'
import { serverConnectionLabel } from '../../data/server-connection'
import { AgentTab } from './agent'
import { SetupTab } from './setup'

type Toast = ReturnType<typeof useToast>

/**
 * One machine, and everything about it.
 *
 * This page is the reason the console was reorganised. Its content used to be
 * three destinations — the row in Servers, the whole of Host setup, and the
 * whole of Connection diagnostics — none of which could show a chart, because
 * charts lived in a fourth place that was about the fleet. An operator asking
 * "what is wrong with node-2" had to hold four screens in their head and
 * accept that none of them agreed on which node they were describing.
 *
 * Everything here is about the machine named in the heading. Nothing here is
 * about any other one.
 */
export function MachineDetailView({ onBack, onOpen, onRefreshServers, server, servers, toast }: {
  onBack: () => void
  onOpen: (page: WorkspacePage) => void
  onRefreshServers: () => Promise<void>
  server: Server
  servers: Server[]
  toast: Toast
}) {
  const [tab, setTab] = useRecordView()
  const [openContainer, setOpenContainer] = useState('')
  const [metrics, setMetrics] = useState<MachineMetrics | null>(null)
  const [metricsError, setMetricsError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let live = true
    setLoading(true)
    setMetrics(null)
    setMetricsError('')
    const read = () => api.machineMetrics(server.id)
      .then((next) => { if (live) { setMetrics(next); setMetricsError('') } })
      .catch((reason) => { if (live) setMetricsError(messageOf(reason)) })
      .finally(() => { if (live) setLoading(false) })
    void read()
    const timer = setInterval(() => void read(), 15_000)
    return () => { live = false; clearInterval(timer) }
  }, [server.id])

  const host = metrics?.host
  const memoryRatio = host?.memoryTotalBytes ? host.memoryUsedBytes / host.memoryTotalBytes : null
  const containers = metrics?.containers ?? []

  return (
    <Page width="full">
      <DetailHeader
        actions={
          <Inline>
            <Button onClick={onBack} variant="ghost">All machines</Button>
            <Button onClick={() => onOpen('runs')} variant="secondary">Runs on this machine</Button>
          </Inline>
        }
        meta={<Mono>{server.host}</Mono>}
        status={<StatusDot tone={server.connectionState === 'connected' ? 'success' : 'danger'}>{serverConnectionLabel(server)}</StatusDot>}
        subtitle={machineSubtitle(metrics, server)}
        title={server.name}
      />

      <InsightRow
        insights={[
          {
            hint: host && host.cpuUsedRatio >= 0
              ? `Load ${host.load1.toFixed(2)} across ${host.cpuCores} cores`
              : 'This machine does not report CPU utilisation',
            icon: 'activity',
            label: 'CPU',
            source: 'machine agent',
            tone: host && host.cpuUsedRatio > 0.85 ? 'warning' : 'neutral',
            unmeasured: !host || host.cpuUsedRatio < 0,
            value: host && host.cpuUsedRatio >= 0 ? `${Math.round(host.cpuUsedRatio * 100)}%` : 'Not measured',
          },
          {
            hint: host?.memoryTotalBytes ? `of ${formatBytes(host.memoryTotalBytes)} installed` : 'Memory has not been reported',
            icon: 'server',
            label: 'Memory',
            source: 'machine agent',
            tone: memoryRatio !== null && memoryRatio > 0.9 ? 'warning' : 'neutral',
            unmeasured: !host?.memoryTotalBytes,
            value: host?.memoryUsedBytes ? formatBytes(host.memoryUsedBytes) : 'Not measured',
          },
          {
            hint: metrics?.dockerAvailable
              ? `${containers.length} measured on this host`
              : 'Docker is not answering here, which is different from having no containers',
            icon: 'layers',
            label: 'Containers',
            onOpen: () => setTab('containers'),
            source: 'machine agent',
            tone: metrics && !metrics.dockerAvailable ? 'warning' : 'neutral',
            unmeasured: !metrics,
            value: metrics?.dockerAvailable ? String(containers.length) : 'No Docker',
          },
          {
            hint: server.agentHealth?.agentVersion
              ? `Reported at the last handshake · ${server.swarmState || 'Swarm state unknown'}`
              : 'The agent has not reported a version',
            icon: 'shield',
            label: 'Agent',
            onOpen: () => onOpen('agents'),
            source: 'agent handshake',
            value: server.agentHealth?.agentVersion || 'Unknown',
          },
        ]}
        label={`What ${server.name} currently reports`}
      />

      <Tabs
        panelId="machine-view"
        label="Machine view"
        onChange={setTab}
        options={pageEntry('machines').views!.map(value => ({ value, label: value === 'containers' ? `Containers · ${containers.length}` : capitalize(value) }))}
        value={tab}
      />

      <div id="machine-view" role="tabpanel" aria-labelledby={`machine-view-tab-${tab}`}>
      {tab === 'overview' ? (
        <Rows gap="md">
          {metricsError ? (
            <Banner title="This machine is not reporting measurements" tone="warning">{metricsError}</Banner>
          ) : null}
          {loading && !metrics ? <Panel title="Reading the machine"><Spinner label="Asking the agent for a sample" /></Panel> : null}

          {/* Every reading the controller will answer for this machine, in the
              order they are reached for. Four of the ten were named here by
              hand and the other six — `load` and `cpu-iowait` among them, the
              two that separate a busy host from a stuck one — were measured,
              stored, and never drawn. */}
          <MetricChartGrid
            lead={['cpu', 'memory', 'load', 'cpu-iowait', 'disk-write', 'disk-read', 'network-rx', 'network-tx']}
            query={{ machine: server.id, scope: 'machine' }}
            refreshMs={30_000}
          />

          {host?.filesystems?.length ? (
            <Panel
              description="Every mounted filesystem, not only the root one. A full /var/lib/docker beside a comfortable / is the ordinary way a node runs out of room."
              title="Filesystems"
            >
              <Table
                columns={filesystemColumns}
                rowKey={(row) => row.mount}
                rows={host.filesystems}
              />
            </Panel>
          ) : null}

          <Panel title="Host">
            <Facts
              items={[
                { label: 'Address', value: <Mono>{server.host}</Mono> },
                { label: 'Connection', value: serverConnectionLabel(server) },
                { label: 'Docker', value: server.dockerVersion || (metrics?.dockerAvailable ? 'Running' : 'Not answering') },
                { label: 'Swarm', value: server.swarmState || 'Unknown' },
                { label: 'Uptime', value: host?.uptimeSeconds ? formatUptime(host.uptimeSeconds) : 'Not reported' },
                { label: 'Processes', value: host?.processCount ? String(host.processCount) : 'Not reported' },
                { label: 'Last connected', value: server.lastConnectedAt ? formatDateTime(server.lastConnectedAt) : 'Never' },
                { label: 'Measured', value: metrics ? formatDateTime(metrics.collectedAt) : 'Not yet' },
              ]}
            />
          </Panel>
        </Rows>
      ) : null}

      {tab === 'containers' ? (
        <Rows gap="md">
          {/* A container's own charts live HERE and nowhere else, because a
              container series is only addressable together with the machine
              that measured it: two hosts can run a container with the same
              short id, and averaging them would be a fiction. */}
          {openContainer ? (
            <Panel
              actions={<Button onClick={() => setOpenContainer('')} size="sm" variant="ghost">Close</Button>}
              description={containerLabel(containers, openContainer)}
              title="Container"
            >
              <MetricChartGrid
                lead={['cpu', 'memory', 'memory-limit', 'network-rx', 'network-tx', 'block-read', 'block-write']}
                query={{ container: openContainer, machine: server.id, scope: 'container' }}
                refreshMs={30_000}
              />
            </Panel>
          ) : null}
          <Panel
            description="Measured by the agent on this host, on the same fifteen-second tick as the machine itself."
            title={`Containers on ${server.name}`}
          >
          {containers.length ? (
            <Table columns={containerColumns(setOpenContainer)} rowKey={(row) => row.id} rows={containers} />
          ) : (
            <Body size="sm" tone="muted">
              {metrics?.dockerAvailable
                ? 'Docker is answering and is running no containers on this host.'
                : 'Docker is not answering on this host, so its containers cannot be measured. That is different from having none.'}
            </Body>
          )}
          </Panel>
        </Rows>
      ) : null}

      {tab === 'setup' ? <SetupTab serverID={server.id} servers={servers} toast={toast} /> : null}
      {tab === 'agent' ? <AgentTab onRefreshServers={onRefreshServers} serverID={server.id} servers={servers} toast={toast} /> : null}
      </div>
    </Page>
  )
}

const filesystemColumns: TableColumn<NonNullable<MachineMetrics['host']['filesystems']>[number]>[] = [
  { header: 'Mount', key: 'mount', render: (row) => <Mono>{row.mount}</Mono> },
  { header: 'Type', key: 'fstype', render: (row) => row.fstype || '—' },
  { header: 'Size', key: 'total', numeric: true, render: (row) => formatBytes(row.totalBytes) },
  { header: 'Used', key: 'used', numeric: true, render: (row) => formatBytes(row.usedBytes) },
  {
    header: 'Free',
    key: 'available',
    numeric: true,
    render: (row) => {
      const ratio = row.totalBytes ? row.availableBytes / row.totalBytes : 1
      return (
        <Inline>
          {formatBytes(row.availableBytes)}
          {ratio < 0.1 ? <Badge variant="warning">Nearly full</Badge> : null}
        </Inline>
      )
    },
  },
]

function containerLabel(containers: MachineMetrics['containers'], id: string): string {
  const found = containers.find((container) => container.id === id)
  return found ? `${found.name} · ${found.image || 'no image reported'}` : id
}

const containerColumns = (open: (id: string) => void): TableColumn<MachineMetrics['containers'][number]>[] => [
  {
    header: 'Container',
    key: 'name',
    render: (row) => (
      <Rows gap="tight">
        <Button onClick={() => open(row.id)} size="sm" variant="ghost">{row.name}</Button>
        <Mono>{shortID(row.id)}</Mono>
      </Rows>
    ),
  },
  { header: 'Image', key: 'image', render: (row) => <Mono>{row.image || '—'}</Mono> },
  {
    header: 'CPU',
    key: 'cpu',
    numeric: true,
    // A container that could not be measured shows an absence. Zero would say
    // it was idle, which is a different and possibly untrue claim.
    render: (row) => (row.cpuUsedRatio >= 0 ? `${(row.cpuUsedRatio * 100).toFixed(1)}%` : '—'),
  },
  {
    header: 'Memory',
    key: 'memory',
    numeric: true,
    render: (row) => (row.memoryLimitBytes
      ? `${formatBytes(row.memoryUsedBytes)} / ${formatBytes(row.memoryLimitBytes)}`
      : formatBytes(row.memoryUsedBytes)),
  },
  { header: 'Restarts', key: 'restarts', numeric: true, render: (row) => String(row.restartCount) },
  { header: 'Service', key: 'service', render: (row) => row.service || row.stack || '—' },
]

function machineSubtitle(metrics: MachineMetrics | null, server: Server): string {
  const parts = [server.dockerVersion ? `Docker ${server.dockerVersion}` : 'Docker not reported']
  if (server.swarmState) parts.push(`Swarm ${server.swarmState}`)
  if (metrics?.host.cpuCores) parts.push(`${metrics.host.cpuCores} cores`)
  if (metrics?.host.memoryTotalBytes) parts.push(formatBytes(metrics.host.memoryTotalBytes))
  return parts.join(' · ')
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86_400)
  if (days >= 1) return `${days} day${days === 1 ? '' : 's'}`
  const hours = Math.floor(seconds / 3_600)
  if (hours >= 1) return `${hours} hour${hours === 1 ? '' : 's'}`
  return `${Math.max(1, Math.floor(seconds / 60))} minutes`
}
