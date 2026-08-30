import { useEffect, useState } from 'react'
import {
  Badge,
  Banner,
  Body,
  Button,
  Columns,
  DataTable,
  DetailHeader,
  DetailLayout,
  EmptyState,
  Facts,
  Inline,
  Input,
  Metric,
  MetricGrid,
  Mono,
  Panel,
  Rail,
  RailSection,
  RecordLink,
  Select,
  Spinner,
  Stack as Rows,
  StatusDot,
  Tabs,
  useToast,
} from '@nim.zone/ui'
import type { TableColumn } from '@nim.zone/ui'
import { api } from '../../../data/api'
import type {
  ContainerDetail,
  ContainerStats,
  ContainerSummary,
} from '../../../data/types'
import { formatBytes, formatDateTime, shortID } from '../../../lib/format'
import { messageOf } from '../../../lib/errors'
import { useResource } from '../../../data/hooks'

type Toast = ReturnType<typeof useToast>

export function ContainersTab({ toast }: { toast: Toast }) {
  const { data, error, loading, reload } = useResource(() => api.containers(), [])
  const [query, setQuery] = useState('')
  const [stateFilter, setStateFilter] = useState('all')
  const [selected, setSelected] = useState<ContainerDetail | null>(null)
  const [stats, setStats] = useState<ContainerStats | null>(null)
  const [detailError, setDetailError] = useState('')
  const [pending, setPending] = useState('')
  const [detailTab, setDetailTab] = useState('overview')
  const [autoOpened, setAutoOpened] = useState(false)

  const inspect = async (id: string) => {
    setDetailError('')
    setStats(null)
    try {
      setSelected(await api.container(id))
      setStats(await api.containerStats(id))
    } catch (reason) { setDetailError(messageOf(reason)) }
  }

  useEffect(() => {
    if (autoOpened || !data?.length) return
    setAutoOpened(true)
    void inspect(data[0].Id)
  }, [autoOpened, data])

  const act = async (id: string, action: 'remove' | 'restart' | 'start' | 'stop', confirmation?: string) => {
    setPending(action)
    try {
      const command = await api.containerAction(id, action, confirmation)
      toast({ message: `Container ${action} queued (${shortID(command.id)})`, tone: 'success' })
      await api.waitForCommand(command.id)
      await reload()
    } catch (reason) { toast({ message: messageOf(reason), tone: 'danger', duration: 0 }) } finally { setPending('') }
  }

  const columns: TableColumn<ContainerSummary>[] = [
    { header: 'Container', key: 'name', render: (container) => <RecordLink meta={container.Image} onClick={() => void inspect(container.Id)} title={containerName(container)} /> },
    { header: 'State', key: 'state', render: (container) => <Badge variant={container.State === 'running' ? 'success' : container.State === 'exited' ? 'neutral' : 'warning'}>{container.State}</Badge> },
    { header: 'Status', key: 'status', render: (container) => container.Status },
    { header: 'Ports', key: 'ports', render: (container) => <Mono>{portSummary(container)}</Mono> },
    { header: 'Size', key: 'size', numeric: true, render: (container) => formatBytes(container.SizeRw ?? 0) },
  ]

  if (loading && !data) return <Spinner label="Reading containers" />
  if (error) return <Banner tone="danger" title="Containers are unavailable">{error}</Banner>
  const allRows = data ?? []
  const rows = allRows.filter((container) => {
    const matchesQuery = !query || `${containerName(container)} ${container.Image} ${container.Id}`.toLowerCase().includes(query.toLowerCase())
    return matchesQuery && (stateFilter === 'all' || container.State === stateFilter)
  })
  if (selected) {
    const name = selected.Name.replace(/^\//, '')
    const environmentCount = selected.Config.EnvNames?.length ?? 0
    const labelCount = Object.keys(selected.Config.Labels ?? {}).length
    const mountCount = selected.Mounts?.length ?? 0
    return (
      <Rows>
        <DetailHeader
          actions={<Inline><Button disabled={pending !== ''} loading={pending === 'restart'} onClick={() => void act(selected.Id, 'restart')} variant="secondary">Restart container</Button><Button disabled={pending !== ''} loading={pending === 'stop'} onClick={() => void act(selected.Id, 'stop')} variant="danger">Stop container</Button></Inline>}
          back={{ label: 'Containers', onClick: () => { setSelected(null); setStats(null) } }}
          meta={<Inline><Mono>{shortID(selected.Id)}</Mono><StatusDot tone={selected.State.Running ? 'success' : 'warning'}>{selected.State.Status}</StatusDot><span>Image <Mono>{selected.Config.Image ?? selected.Image}</Mono></span></Inline>}
          subtitle={`Created ${formatDateTime(selected.Created)} · started ${formatDateTime(selected.State.StartedAt)}`}
          title={name}
        />
        <Tabs label="Container views" onChange={setDetailTab} options={[
          { label: 'Overview', value: 'overview' },
          { label: 'Metrics', value: 'metrics' },
          { label: 'Logs', value: 'logs' },
          { label: 'Network', value: 'network' },
          { label: 'Inspect', value: 'inspect' },
          { label: 'Activity', value: 'activity' },
        ]} value={detailTab} />
        {detailError ? <Banner tone="danger">{detailError}</Banner> : null}
        {detailTab === 'overview' || detailTab === 'metrics' ? <>
          <MetricGrid columns={4}>
            <Metric hint="One live sample" icon="activity" label="CPU" source={stats ? 'docker stats' : undefined} unmeasured={!stats} value={stats ? `${stats.cpuPercent.toFixed(2)}%` : 'no sample'} />
            <Metric hint={stats?.memoryLimitBytes ? `of ${formatBytes(stats.memoryLimitBytes)}` : 'No limit reported'} icon="activity" label="Memory" source={stats ? 'docker stats' : undefined} unmeasured={!stats} value={stats ? formatBytes(stats.memoryUsedBytes) : 'no sample'} />
            <Metric hint={stats ? `${formatBytes(stats.networkTxBytes)} egress` : undefined} icon="cloud" label="Network ingress" source={stats ? 'docker stats' : undefined} unmeasured={!stats} value={stats ? formatBytes(stats.networkRxBytes) : 'no sample'} />
            <Metric hint="Engine restart counter" icon="refresh" label="Restart count" value={String(selected.RestartCount)} />
          </MetricGrid>
          <DetailLayout aside={<Rail title="Container inspector">
            <RailSection title="Image"><Mono>{selected.Config.Image ?? selected.Image}</Mono></RailSection>
            <RailSection title="Entrypoint"><Mono>{selected.Path || 'Not set'}</Mono></RailSection>
            <RailSection meta={String(labelCount)} title="Labels"><Body size="sm">Values are available in Inspect.</Body></RailSection>
            <RailSection meta={String(mountCount)} title="Mounts"><Body size="sm">{selected.Mounts?.map((mount) => mount.Destination).join(', ') || 'No mounts'}</Body></RailSection>
            <RailSection title="Docker health"><StatusDot tone={selected.State.Health?.Status === 'healthy' || selected.State.Running ? 'success' : 'warning'}>{selected.State.Health?.Status ?? (selected.State.Running ? 'Running' : 'Stopped')}</StatusDot></RailSection>
            <RailSection title="Telemetry"><Body size="sm">One Engine resource sample is available. Cluster log and trace collectors are reported separately under Monitoring.</Body></RailSection>
          </Rail>}>
            <Columns template="one-third">
              <Panel title="Health & placement">
                <Facts columns={1} items={[
                  { label: 'State', value: selected.State.Status },
                  { label: 'Health check', value: selected.State.Health?.Status ?? 'Not configured' },
                  { label: 'Started', value: formatDateTime(selected.State.StartedAt) },
                  { label: 'Restart policy', value: selected.HostConfig.RestartPolicy?.Name || 'Not set' },
                  { label: 'Exit code', value: String(selected.State.ExitCode) },
                ]} />
              </Panel>
              <Panel title="Runtime configuration">
                <Facts columns={1} items={[
                  { label: 'Network mode', mono: true, value: selected.HostConfig.NetworkMode || 'Not set' },
                  { label: 'Working directory', mono: true, value: selected.Config.WorkingDir || 'Not set' },
                  { label: 'User', mono: true, value: selected.Config.User ?? 'Default image user' },
                  { label: 'Environment', value: `${environmentCount} variable names; values withheld` },
                  { label: 'Mounts', value: String(mountCount) },
                ]} />
              </Panel>
            </Columns>
            <Panel title="Recent log preview">
              <Body size="sm" tone="muted">Container log streaming is not exposed by this controller endpoint. Use the cluster-managed log collector under Monitoring when it is configured.</Body>
            </Panel>
            <Panel title="Recent activity">
              <Facts items={[
                { label: 'Created', value: formatDateTime(selected.Created) },
                { label: 'Started', value: formatDateTime(selected.State.StartedAt) },
                { label: 'Restarts', value: String(selected.RestartCount) },
                { label: 'Last sample', unmeasured: !stats, value: stats ? formatDateTime(stats.sampledAt) : 'never', why: stats ? undefined : 'no stats sample has been taken for this container' },
              ]} />
            </Panel>
          </DetailLayout>
        </> : detailTab === 'logs' ? <Panel title="Logs"><Banner tone="info">This manager does not expose raw container log streaming through the fixed command surface. Open Monitoring → Logs for collected records.</Banner></Panel> : detailTab === 'network' ? <Panel title="Network"><Facts items={[{ label: 'Network mode', mono: true, value: selected.HostConfig.NetworkMode || 'Not set' }, { label: 'Ingress sample', source: stats ? 'docker stats' : undefined, unmeasured: !stats, value: stats ? formatBytes(stats.networkRxBytes) : 'no sample', why: stats ? undefined : 'no stats sample has been taken' }, { label: 'Egress sample', source: stats ? 'docker stats' : undefined, unmeasured: !stats, value: stats ? formatBytes(stats.networkTxBytes) : 'no sample', why: stats ? undefined : 'no stats sample has been taken' }]} /></Panel> : detailTab === 'inspect' ? <Panel title="Inspect"><Facts items={[{ label: 'Container ID', mono: true, value: selected.Id }, { label: 'Image', mono: true, value: selected.Image }, { label: 'Command', mono: true, value: [selected.Path, ...(selected.Args ?? [])].filter(Boolean).join(' ') || '—' }, { label: 'Environment names', value: selected.Config.EnvNames?.join(', ') || 'None' }, { label: 'Privileged', value: selected.HostConfig.Privileged ? 'Yes' : 'No' }]} /></Panel> : <Panel title="Activity"><Facts items={[{ label: 'Created', value: formatDateTime(selected.Created) }, { label: 'Started', value: formatDateTime(selected.State.StartedAt) }, { label: 'Finished', value: formatDateTime(selected.State.FinishedAt) }, { label: 'OOM killed', value: selected.State.OOMKilled ? 'Yes' : 'No' }, { label: 'Restarts', value: String(selected.RestartCount) }]} /></Panel>}
      </Rows>
    )
  }
  return (
    <Panel flush title={`Containers (${allRows.length})`}>
      <DataTable
        caption="Containers on the selected target"
        columns={columns}
        empty={<EmptyState description="This target reported no containers." icon="layers" title="No containers" />}
        rowKey={(container) => container.Id}
        rows={rows}
        summary={`Showing ${rows.length} of ${allRows.length} containers`}
        toolbar={<Columns><Input iconStart="search" label="Search containers" onChange={(event) => setQuery(event.target.value)} placeholder="Name, image, or ID" value={query} /><Select label="State" onChange={(event) => setStateFilter(event.target.value)} options={[{ label: 'All states', value: 'all' }, ...Array.from(new Set(allRows.map((container) => container.State))).map((state) => ({ label: state.charAt(0).toUpperCase() + state.slice(1), value: state }))]} value={stateFilter} /></Columns>}
      />
    </Panel>
  )
}

export function containerName(container: ContainerSummary) {
  return container.Names?.[0]?.replace(/^\//, '') ?? shortID(container.Id)
}

export function portSummary(container: ContainerSummary) {
  const ports = (container.Ports ?? [])
    .filter((port) => port.PublicPort)
    .map((port) => `${port.PublicPort}\u2192${port.PrivatePort}/${port.Type}`)
  return ports.length ? ports.join(' ') : '\u2014'
}
