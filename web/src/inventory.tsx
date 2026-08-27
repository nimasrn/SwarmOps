import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Badge,
  Banner,
  Body,
  Button,
  Chart,
  CodeBlock,
  Columns,
  DataTable,
  DetailHeader,
  DetailLayout,
  EmptyState,
  Facts,
  Inline,
  Input,
  Label,
  Metric,
  MetricGrid,
  Mono,
  Page,
  Panel,
  RecordLink,
  Rail,
  RailSection,
  ResourceMeter,
  Segmented,
  Select,
  Sparkline,
  Spinner,
  Stack as Rows,
  StatusDot,
  Switch,
  Tabs,
  useToast,
} from '@nim.zone/ui'
import type { TableColumn } from '@nim.zone/ui'
import { api } from './api'
import type {
  CommandDefinition,
  ContainerDetail,
  ContainerStats,
  ContainerSummary,
  DiskUsage,
  EngineEvent,
  ImageSummary,
  Insights,
  InsightsSample,
  CommandParameter,
  NetworkSummary,
  PruneResource,
  Server,
  SwarmObjectMeta,
  SwarmSettings,
  VolumeSummary,
} from './types'

// These three screens are the whole Docker and Swarm surface as the operator
// sees it: what the cluster holds (Resources), what it costs and what is
// happening (Insights), and what SwarmOps is able to do to it (Commands).
// Every change made here is queued in the command ledger; nothing on this page
// reaches the Engine directly.

type Toast = ReturnType<typeof useToast>

type ResourceTab = 'configs' | 'containers' | 'images' | 'networks' | 'secrets' | 'volumes'

const RESOURCE_TABS: { label: string; value: ResourceTab }[] = [
  { label: 'Containers', value: 'containers' },
  { label: 'Images', value: 'images' },
  { label: 'Volumes', value: 'volumes' },
  { label: 'Networks', value: 'networks' },
  { label: 'Secrets', value: 'secrets' },
  { label: 'Configs', value: 'configs' },
]

export function InsightsPage({ toast }: { toast: Toast }) {
  const [insights, setInsights] = useState<Insights | null>(null)
  const [usage, setUsage] = useState<DiskUsage | null>(null)
  const [events, setEvents] = useState<EngineEvent[]>([])
  const [swarm, setSwarm] = useState<SwarmSettings | null>(null)
  const [history, setHistory] = useState<InsightsSample[]>([])
  const [images, setImages] = useState<ImageSummary[]>([])
  const [window, setWindow] = useState('60')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (minutes: number) => {
    setLoading(true)
    setError('')
    try {
      const [insightValue, usageValue, eventValues, swarmValue, historyValues, imageValues] = await Promise.all([
        api.insights(),
        api.diskUsage(),
        api.events(minutes),
        api.swarm(),
        api.insightsHistory(),
        api.images(),
      ])
      setInsights(insightValue)
      setUsage(usageValue)
      setEvents(eventValues)
      setSwarm(swarmValue)
      setHistory(historyValues)
      setImages(imageValues)
    } catch (reason) {
      setError(messageOf(reason))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load(Number(window)) }, [load, window])

  if (loading && !insights) return <Spinner label="Reading cluster insights" />
  if (error && !insights) return <Banner tone="danger" title="Insights are unavailable">{error}</Banner>
  if (!insights) return <EmptyState description="The Engine returned no inventory." icon="sparkle" title="No insights" />
  const liveInsights: Insights = insights

  const reclaimable = liveInsights.storage.reclaimableImageBytes + liveInsights.storage.reclaimableVolumeBytes + liveInsights.storage.reclaimableBuildCacheBytes
  // One reading a minute, so the axis is the sample clock rather than an
  // invented one. A single point draws nothing useful, so the charts wait.
  const times = history.map((sample) => formatClock(sample.at))
  const charted = history.length > 1
  const eventCounts = countEvents(events)
  const largestImages = images.slice(0, 8)
  const alerts = [
    ...(liveInsights.nodes.unavailable ? [{ affected: `${liveInsights.nodes.unavailable} node${liveInsights.nodes.unavailable === 1 ? '' : 's'}`, diagnosis: 'Open Infrastructure', severity: 'Critical', since: 'Current sample' }] : []),
    ...(liveInsights.services.degraded ? [{ affected: `${liveInsights.services.degraded} degraded service${liveInsights.services.degraded === 1 ? '' : 's'}`, diagnosis: 'Inspect application', severity: 'Warning', since: 'Current sample' }] : []),
    ...(liveInsights.containers.unhealthy ? [{ affected: `${liveInsights.containers.unhealthy} unhealthy container${liveInsights.containers.unhealthy === 1 ? '' : 's'}`, diagnosis: 'Inspect container', severity: 'Warning', since: 'Current sample' }] : []),
  ]
  return (
    <Page width="full">
      <DetailHeader
        actions={<Inline><Button iconStart="plus" variant="accent">Create alert</Button><Button iconStart="settings" variant="secondary">Collection settings</Button></Inline>}
        meta={<StatusDot tone={alerts.length ? 'warning' : 'success'}>Collection state: {alerts.length ? 'Needs attention' : 'Healthy'}</StatusDot>}
        title="Observe"
      />
      {error ? <Banner tone="warning" title="Some readings are stale">{error}</Banner> : null}
      <div className="nim-console-filter-row"><Select aria-label="Observation window" onChange={(event) => setWindow(event.target.value)} options={[{ label: 'Last 15 minutes', value: '15' }, { label: 'Last hour', value: '60' }, { label: 'Last 6 hours', value: '360' }, { label: 'Last 24 hours', value: '1440' }]} value={window} /><Button size="sm" variant="secondary">Application: All</Button><Button size="sm" variant="secondary">Node: All</Button></div>
      <MetricGrid aria-label="Collector status" columns={6} dense>
        <Metric icon="activity" label="Prometheus" tone="success" value="Metrics" />
        <Metric icon="sparkle" label="Traces" value="Configured separately" />
        <Metric icon="document" label="Logs" value="Configured separately" />
        <Metric icon="server" label="Nodes ready" tone={liveInsights.nodes.unavailable ? 'warning' : 'success'} value={`${liveInsights.nodes.ready}/${liveInsights.nodes.total}`} />
        <Metric icon="layers" label="Containers" tone={liveInsights.containers.unhealthy ? 'warning' : 'success'} value={`${liveInsights.containers.running} running`} />
        <Metric icon="activity" label="Tasks" tone={liveInsights.services.degraded ? 'warning' : 'success'} value={`${liveInsights.services.runningTasks}/${liveInsights.services.desiredTasks}`} />
      </MetricGrid>
      <Columns template="two-thirds">
        <Panel title="Cluster">
          {charted ? <div className="nim-console-chart-grid">
            <Chart categories={times} format={(value) => String(Math.round(value))} height={110} kind="line" series={[{ label: 'Running', values: history.map((sample) => sample.tasksRunning) }, { label: 'Desired', values: history.map((sample) => sample.tasksDesired) }]} title="Tasks" />
            <Chart categories={times} format={(value) => String(Math.round(value))} height={110} kind="line" series={[{ label: 'Ready', values: history.map((sample) => sample.nodesReady) }, { label: 'Total', values: history.map((sample) => sample.nodesTotal) }]} title="Nodes" />
            <Chart categories={times} format={(value) => String(Math.round(value))} height={110} kind="line" series={[{ label: 'Running', values: history.map((sample) => sample.containersRunning) }, { label: 'Total', values: history.map((sample) => sample.containersTotal) }]} title="Containers" />
            <Chart categories={times} format={formatBytes} height={110} kind="line" series={[{ label: 'Used', values: history.map((sample) => sample.diskUsedBytes) }, { label: 'Capacity', values: history.map((sample) => sample.diskCapacityBytes) }]} title="Disk" />
          </div> : <Banner tone="info">Trend lines appear after two real samples.</Banner>}
        </Panel>
        <Rows gap="md">
          <Panel flush title="Active alerts">
            <DataTable columns={[
              { header: 'Severity', key: 'severity', render: (alert: (typeof alerts)[number]) => <StatusDot tone={alert.severity === 'Critical' ? 'danger' : 'warning'}>{alert.severity}</StatusDot> },
              { header: 'Affected resource', key: 'affected', render: (alert: (typeof alerts)[number]) => alert.affected },
              { header: 'Since', key: 'since', render: (alert: (typeof alerts)[number]) => alert.since },
              { header: 'Diagnosis', key: 'diagnosis', render: (alert: (typeof alerts)[number]) => <span className="nim-tone-success">{alert.diagnosis}</span> },
            ]} empty={<Body size="sm">No active alert is derivable from the current manager sample.</Body>} rowKey={(alert) => alert.affected} rows={alerts} />
          </Panel>
          <Panel title="Scrape target failures"><Body size="sm" tone="muted">Prometheus target-level failures are not returned by this manager endpoint. Open Collection settings for the source-specific view.</Body></Panel>
        </Rows>
      </Columns>
      <Columns>
        <Panel flush title="Recent Engine activity">
          <DataTable columns={[
            { header: 'Timestamp', key: 'time', render: (event: EngineEvent) => formatTimestamp(event.time) },
            { header: 'Level', key: 'level', render: () => <StatusDot tone="success">INFO</StatusDot> },
            { header: 'Resource', key: 'resource', render: (event: EngineEvent) => eventSubject(event) },
            { header: 'Message', key: 'message', render: (event: EngineEvent) => <Mono>{`${event.Type} ${event.Action}`}</Mono> },
          ]} empty={<Body size="sm">No Engine events were recorded in this window.</Body>} rowKey={(event) => `${event.timeNano}-${event.Actor.ID}`} rows={events.slice(0, 5)} />
        </Panel>
        <Panel title="Recent traces"><Body size="sm" tone="muted">Trace rows are shown only when a trace collector reports them. This Docker manager endpoint does not supply trace payloads.</Body></Panel>
      </Columns>
      <Panel title="Retention and storage">
        <Facts items={[
          { label: 'Sample history', value: `${history.length} in-memory samples` },
          { label: 'Engine event window', value: `${window} minutes` },
          { label: 'Engine disk', value: formatBytes(liveInsights.storage.imageBytes + liveInsights.storage.volumeBytes + liveInsights.storage.containerWritableBytes + liveInsights.storage.buildCacheBytes) },
          { label: 'Reclaimable', value: formatBytes(reclaimable) },
        ]} />
      </Panel>
      <Columns>
        <Panel title="Storage actions"><PruneControls toast={toast} usage={usage} /></Panel>
        <Panel title="Swarm orchestration">{swarm ? <SwarmControls settings={swarm} toast={toast} /> : <Body size="sm">The Swarm object was not returned by this target.</Body>}</Panel>
      </Columns>
    </Page>
  )
  /* The mutation controls below remain compiled while the operational Observe
     surface is kept read-only; they are being moved to resource settings. */
  return (
    <Page>
      <DetailHeader
        subtitle="Live Docker Engine and Swarm readings sampled once a minute by the selected manager. Collection settings remain separate from this operational view."
        title="Observe"
      />
      {error ? <Banner tone="warning" title="Some readings are stale">{error}</Banner> : null}
      <MetricGrid aria-label="Cluster totals" columns={4}>
        <Metric
          hint={<>{`${liveInsights.nodes.managers} manager${liveInsights.nodes.managers === 1 ? '' : 's'} · ${liveInsights.nodes.unavailable} not active`}{charted ? <Sparkline label="Nodes ready over the sampled window" values={history.map((sample) => sample.nodesReady)} /> : null}</>}
          icon="server"
          label="Nodes ready"
          value={`${liveInsights.nodes.ready} / ${liveInsights.nodes.total}`}
        />
        <Metric
          hint={<>{`${liveInsights.services.degraded} degraded · ${liveInsights.services.unhealthy} unhealthy`}{charted ? <Sparkline label="Running tasks over the sampled window" series={2} values={history.map((sample) => sample.tasksRunning)} /> : null}</>}
          icon="activity"
          label="Service tasks"
          value={`${liveInsights.services.runningTasks} / ${liveInsights.services.desiredTasks}`}
        />
        <Metric
          hint={<>{`${liveInsights.containers.stopped} stopped · ${liveInsights.containers.unhealthy} unhealthy`}{charted ? <Sparkline label="Running containers over the sampled window" series={3} values={history.map((sample) => sample.containersRunning)} /> : null}</>}
          icon="layers"
          label="Containers running"
          value={`${liveInsights.containers.running} / ${liveInsights.containers.total}`}
        />
        <Metric
          hint={<>{reclaimable ? `${formatBytes(reclaimable)} reclaimable` : 'Nothing reclaimable'}{charted ? <Sparkline label="Reclaimable bytes over the sampled window" series={4} values={history.map((sample) => sample.reclaimableBytes)} /> : null}</>}
          icon="database"
          label="Engine disk"
          tone={reclaimable > 0 ? 'warning' : 'neutral'}
          value={formatBytes(liveInsights.storage.imageBytes + liveInsights.storage.volumeBytes + liveInsights.storage.containerWritableBytes + liveInsights.storage.buildCacheBytes)}
        />
      </MetricGrid>
      {charted ? (
        <Columns>
          <Panel eyebrow={`${history.length} samples`} title="Workload over time">
            <Chart
              categories={times}
              format={(value) => String(Math.round(value))}
              height={200}
              kind="line"
              legend
              note="Sampled once a minute since the API started. Longer history lives in the Prometheus stack SwarmOps deploys."
              series={[
                { label: 'Tasks running', values: history.map((sample) => sample.tasksRunning) },
                { label: 'Tasks desired', values: history.map((sample) => sample.tasksDesired) },
                { label: 'Containers running', values: history.map((sample) => sample.containersRunning) },
              ]}
              title="Tasks and containers"
            />
          </Panel>
          <Panel eyebrow="Pressure" title="Faults over time">
            <Chart
              categories={times}
              format={(value) => String(Math.round(value))}
              height={200}
              kind="area"
              legend
              note="A rising failed-task line with a flat running line means Swarm is restarting work it cannot place."
              series={[
                { label: 'Tasks failed', values: history.map((sample) => sample.tasksFailed) },
                { label: 'Services degraded', values: history.map((sample) => sample.servicesDegraded) },
                { label: 'Containers unhealthy', values: history.map((sample) => sample.containersUnhealthy) },
              ]}
              title="Failures and degradation"
            />
          </Panel>
        </Columns>
      ) : (
        <Banner tone="info" title="Trend lines start after two samples">
          The control plane takes one reading a minute. Charts over time appear once a second reading exists; the totals
          above are live either way.
        </Banner>
      )}
      <Columns>
        <Panel eyebrow="Docker system df" title="Where the disk went">
          <Chart
            categories={['Images', 'Volumes', 'Containers', 'Build cache']}
            format={formatBytes}
            height={200}
            kind="bar"
            legend
            note="Reclaimable is the part Docker would delete on a prune of that resource."
            series={[
              {
                label: 'In use',
                values: [
                  liveInsights.storage.imageBytes - liveInsights.storage.reclaimableImageBytes,
                  liveInsights.storage.volumeBytes - liveInsights.storage.reclaimableVolumeBytes,
                  liveInsights.storage.containerWritableBytes,
                  liveInsights.storage.buildCacheBytes - liveInsights.storage.reclaimableBuildCacheBytes,
                ],
              },
              {
                label: 'Reclaimable',
                values: [
                  liveInsights.storage.reclaimableImageBytes,
                  liveInsights.storage.reclaimableVolumeBytes,
                  0,
                  liveInsights.storage.reclaimableBuildCacheBytes,
                ],
              },
            ]}
            title="Disk by resource"
          />
          <PruneControls toast={toast} usage={usage} />
        </Panel>
        <Panel eyebrow="Swarm settings" title="Orchestration">
          {swarm ? <SwarmControls settings={swarm!} toast={toast} /> : <Body size="sm">The Swarm object was not returned by this target.</Body>}
        </Panel>
      </Columns>
      <Columns>
        <Panel eyebrow={`${images.length} images`} title="Largest images">
          {largestImages.length ? (
            <Chart
              categories={largestImages.map((image) => imageLabel(image))}
              format={formatBytes}
              height={200}
              kind="bar"
              note="An image no container references is reclaimable by an image prune."
              series={[{ label: 'On disk', values: largestImages.map((image) => image.Size) }]}
              title="Image size"
            />
          ) : (
            <EmptyState description="This target reported no images." icon="package" title="No images" />
          )}
        </Panel>
        <Panel
          eyebrow={`${events.length} event${events.length === 1 ? '' : 's'}`}
          title="Engine activity"
          actions={(
            <Select
              aria-label="Event window"
              onChange={(event) => setWindow(event.target.value)}
              options={[
                { label: 'Last 15 minutes', value: '15' },
                { label: 'Last hour', value: '60' },
                { label: 'Last 6 hours', value: '360' },
                { label: 'Last 24 hours', value: '1440' },
              ]}
              value={window}
            />
          )}
        >
          {eventCounts.length ? (
            <Chart
              categories={eventCounts.map(([label]) => label)}
              format={(value) => String(Math.round(value))}
              height={180}
              kind="bar"
              note="What the Engine actually did in this window, by object type and action."
              series={[{ label: 'Events', series: 2, values: eventCounts.map(([, count]) => count) }]}
              title="Events by action"
            />
          ) : (
            <EmptyState description="No Engine event was recorded in this window." icon="clock" title="No events" />
          )}
        </Panel>
      </Columns>
      <Panel eyebrow="Fleet capacity" title="What the cluster has">
        <Columns>
          <Rows>
            <Facts items={[
              { label: 'CPU cores', value: String(liveInsights.capacity.cpuCores) },
              { label: 'Memory', value: formatBytes(liveInsights.capacity.memoryBytes) },
              { label: 'Overlay networks', value: `${liveInsights.networks.overlay} of ${liveInsights.networks.total}` },
              { label: 'Secrets / configs', value: `${liveInsights.secrets} / ${liveInsights.configs}` },
            ]} />
            {liveInsights.capacity.diskBytes ? (
              <ResourceMeter
                detail="Reported by nodes running the machine agent"
                label="Fleet disk"
                percent={Math.round((liveInsights.capacity.diskUsedBytes / liveInsights.capacity.diskBytes) * 100)}
                value={`${formatBytes(liveInsights.capacity.diskUsedBytes)} / ${formatBytes(liveInsights.capacity.diskBytes)}`}
              />
            ) : (
              <Body size="sm">Disk capacity is reported by the machine agent. Nodes without an agent contribute no disk figure.</Body>
            )}
          </Rows>
          <DataTable
            caption="Docker Engine events, newest first"
            columns={[
              { header: 'When', key: 'time', render: (event: EngineEvent) => formatTimestamp(event.time) },
              { header: 'Action', key: 'action', render: (event: EngineEvent) => <Mono>{`${event.Type} ${event.Action}`}</Mono> },
              { header: 'Object', key: 'object', render: (event: EngineEvent) => eventSubject(event) },
            ]}
            empty={<EmptyState description="No Engine event was recorded in this window." icon="clock" title="No events" />}
            rowKey={(event: EngineEvent) => `${event.timeNano}-${event.Actor.ID}-${event.Action}`}
            rows={events.slice(0, 25)}
          />
        </Columns>
      </Panel>
    </Page>
  )
}

function SwarmControls({ settings, toast }: { settings: SwarmSettings; toast: Toast }) {
  const [limit, setLimit] = useState(String(settings.Spec.Orchestration?.TaskHistoryRetentionLimit ?? 5))
  const [role, setRole] = useState<'manager' | 'worker'>('worker')
  const [pending, setPending] = useState('')

  const save = async () => {
    const value = Number(limit)
    if (!Number.isInteger(value) || value < 1 || value > 1000) {
      toast({ message: 'Task history limit must be a whole number from 1 to 1000.', tone: 'danger', duration: 0 })
      return
    }
    setPending('limit')
    try {
      const command = await api.updateSwarm(value)
      toast({ message: `Swarm update queued (${shortID(command.id)})`, tone: 'success' })
    } catch (reason) { toast({ message: messageOf(reason), tone: 'danger', duration: 0 }) } finally { setPending('') }
  }

  return (
    <Rows>
      <Facts items={[
        { label: 'Cluster ID', mono: true, value: settings.ID },
        { label: 'Created', value: formatDateTime(settings.CreatedAt) },
        { label: 'Autolock managers', value: settings.Spec.EncryptionConfig?.AutoLockManagers ? 'Enabled' : 'Disabled' },
        { label: 'Raft snapshot interval', value: String(settings.Spec.Raft?.SnapshotInterval ?? '—') },
      ]} />
      <Columns>
        <Input
          hint="How many historical tasks Swarm keeps per slot."
          label="Task history limit"
          max="1000"
          min="1"
          onChange={(event) => setLimit(event.target.value)}
          step="1"
          type="number"
          value={limit}
        />
        <Rows gap="tight">
          <Body size="sm">A shorter history frees manager memory; a longer one keeps more failure evidence on the Tasks screens.</Body>
          <Button loading={pending === 'limit'} onClick={() => void save()} variant="secondary">Update swarm</Button>
        </Rows>
      </Columns>
      <Rows gap="tight">
        <Label as="p">Join token</Label>
        <Body size="sm">
          Rotating invalidates the current token so a leaked one can no longer enrol a node. SwarmOps never returns the
          new token: enrolment stays an installer workflow on the machine itself.
        </Body>
        <Columns>
          <Select
            label="Token to rotate"
            onChange={(event) => setRole(event.target.value as 'manager' | 'worker')}
            options={[{ label: 'Worker', value: 'worker' }, { label: 'Manager', value: 'manager' }]}
            value={role}
          />
          <ConfirmAction
            busy={pending === 'token'}
            confirmation={`ROTATE_${role.toUpperCase()}_JOIN_TOKEN`}
            label="Rotate token"
            onConfirm={async (confirmation) => {
              setPending('token')
              try {
                const command = await api.rotateJoinToken(role, confirmation)
                toast({ message: `Join-token rotation queued (${shortID(command.id)})`, tone: 'success' })
              } catch (reason) { toast({ message: messageOf(reason), tone: 'danger', duration: 0 }) } finally { setPending('') }
            }}
          />
        </Columns>
      </Rows>
    </Rows>
  )
}

function PruneControls({ toast, usage }: { toast: Toast; usage: DiskUsage | null }) {
  const [resource, setResource] = useState<PruneResource>('images')
  const [all, setAll] = useState(false)
  const [pending, setPending] = useState(false)
  const confirmation = `PRUNE_${resource.replace('-', '_').toUpperCase()}`
  return (
    <Rows gap="tight">
      <Label as="p">Reclaim space</Label>
      <Body size="sm">
        Pruning deletes data the Engine considers unused. A volume prune destroys the data inside every unreferenced
        volume, and SwarmOps cannot bring it back — the confirmation phrase is the only guard.
      </Body>
      <Columns>
        <Select
          label="Resource"
          onChange={(event) => { setResource(event.target.value as PruneResource); setAll(false) }}
          options={[
            { label: 'Images', value: 'images' },
            { label: 'Containers', value: 'containers' },
            { label: 'Volumes', value: 'volumes' },
            { label: 'Networks', value: 'networks' },
            { label: 'Build cache', value: 'build-cache' },
          ]}
          value={resource}
        />
        <Rows gap="tight">
          {resource === 'images' ? (
            <Switch checked={all} description="Without this, only dangling images are removed." onChange={(event) => setAll(event.target.checked)}>Remove every unused image</Switch>
          ) : (
            <Body size="sm">{pruneDescription(resource, usage)}</Body>
          )}
          <ConfirmAction
            busy={pending}
            confirmation={confirmation}
            destructive
            label="Prune"
            onConfirm={async (typed) => {
              setPending(true)
              try {
                const command = await api.prune(resource, typed, all)
                toast({ message: `Prune queued for ${resource} (${shortID(command.id)})`, tone: 'success' })
              } catch (reason) { toast({ message: messageOf(reason), tone: 'danger', duration: 0 }) } finally { setPending(false) }
            }}
          />
        </Rows>
      </Columns>
    </Rows>
  )
}

export function ResourcesPage({ toast }: { toast: Toast }) {
  const [tab, setTab] = useState<ResourceTab>('containers')
  return (
    <Page>
      <DetailHeader
        subtitle="Containers, images, volumes, networks, secrets, and configs on the selected target. Creating or deleting any of them queues one fixed, audited command; a secret value and a config payload are never read back into the console."
        title="Docker resources"
      />
      <Segmented
        label="Resource kind"
        onChange={(value: string) => setTab(value as ResourceTab)}
        options={RESOURCE_TABS}
        value={tab}
      />
      {tab === 'containers' ? <ContainersTab toast={toast} /> : null}
      {tab === 'images' ? <ImagesTab toast={toast} /> : null}
      {tab === 'volumes' ? <VolumesTab toast={toast} /> : null}
      {tab === 'networks' ? <NetworksTab toast={toast} /> : null}
      {tab === 'secrets' ? <SwarmObjectsTab kind="secrets" toast={toast} /> : null}
      {tab === 'configs' ? <SwarmObjectsTab kind="configs" toast={toast} /> : null}
    </Page>
  )
}

function ContainersTab({ toast }: { toast: Toast }) {
  const { data, error, loading, reload } = useResource(() => api.containers(), [])
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
  const rows = data ?? []
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
            <Metric hint="One live sample" icon="activity" label="CPU" value={stats ? `${stats.cpuPercent.toFixed(2)}%` : '—'} />
            <Metric hint={stats?.memoryLimitBytes ? `of ${formatBytes(stats.memoryLimitBytes)}` : 'No limit reported'} icon="activity" label="Memory" value={stats ? formatBytes(stats.memoryUsedBytes) : '—'} />
            <Metric hint={stats ? `${formatBytes(stats.networkTxBytes)} egress` : 'No sample'} icon="cloud" label="Network ingress" value={stats ? formatBytes(stats.networkRxBytes) : '—'} />
            <Metric hint="Engine restart counter" icon="refresh" label="Restart count" value={String(selected.RestartCount)} />
          </MetricGrid>
          <DetailLayout aside={<Rail title="Container inspector">
            <RailSection title="Image"><Mono>{selected.Config.Image ?? selected.Image}</Mono></RailSection>
            <RailSection title="Entrypoint"><Mono>{selected.Path ?? '—'}</Mono></RailSection>
            <RailSection meta={String(labelCount)} title="Labels"><Body size="sm">Values are available in Inspect.</Body></RailSection>
            <RailSection meta={String(mountCount)} title="Mounts"><Body size="sm">{selected.Mounts?.map((mount) => mount.Destination).join(', ') || 'No mounts'}</Body></RailSection>
            <RailSection title="Docker health"><StatusDot tone={selected.State.Health?.Status === 'healthy' || selected.State.Running ? 'success' : 'warning'}>{selected.State.Health?.Status ?? (selected.State.Running ? 'Running' : 'Stopped')}</StatusDot></RailSection>
            <RailSection title="Telemetry"><Body size="sm">One Engine resource sample is available. Cluster log and trace collectors are reported separately under Observe.</Body></RailSection>
          </Rail>}>
            <Columns template="one-third">
              <Panel title="Health & placement">
                <Facts columns={1} items={[
                  { label: 'State', value: selected.State.Status },
                  { label: 'Health check', value: selected.State.Health?.Status ?? 'Not configured' },
                  { label: 'Started', value: formatDateTime(selected.State.StartedAt) },
                  { label: 'Restart policy', value: selected.HostConfig.RestartPolicy?.Name ?? '—' },
                  { label: 'Exit code', value: String(selected.State.ExitCode) },
                ]} />
              </Panel>
              <Panel title="Runtime configuration">
                <Facts columns={1} items={[
                  { label: 'Network mode', mono: true, value: selected.HostConfig.NetworkMode ?? '—' },
                  { label: 'Working directory', mono: true, value: selected.Config.WorkingDir ?? '—' },
                  { label: 'User', mono: true, value: selected.Config.User ?? 'Default image user' },
                  { label: 'Environment', value: `${environmentCount} variable names; values withheld` },
                  { label: 'Mounts', value: String(mountCount) },
                ]} />
              </Panel>
            </Columns>
            <Panel title="Recent log preview">
              <Body size="sm" tone="muted">Container log streaming is not exposed by this Core endpoint. Use the cluster-managed log collector in Observe when it is configured.</Body>
            </Panel>
            <Panel title="Recent activity">
              <Facts items={[
                { label: 'Created', value: formatDateTime(selected.Created) },
                { label: 'Started', value: formatDateTime(selected.State.StartedAt) },
                { label: 'Restarts', value: String(selected.RestartCount) },
                { label: 'Last sample', value: stats ? formatDateTime(stats.sampledAt) : '—' },
              ]} />
            </Panel>
          </DetailLayout>
        </> : detailTab === 'logs' ? <Panel title="Logs"><Banner tone="info">This manager does not expose raw container log streaming through the fixed command surface. Open Observe for collected logs.</Banner></Panel> : detailTab === 'network' ? <Panel title="Network"><Facts items={[{ label: 'Network mode', mono: true, value: selected.HostConfig.NetworkMode ?? '—' }, { label: 'Ingress sample', value: stats ? formatBytes(stats.networkRxBytes) : '—' }, { label: 'Egress sample', value: stats ? formatBytes(stats.networkTxBytes) : '—' }]} /></Panel> : detailTab === 'inspect' ? <Panel title="Inspect"><Facts items={[{ label: 'Container ID', mono: true, value: selected.Id }, { label: 'Image', mono: true, value: selected.Image }, { label: 'Command', mono: true, value: [selected.Path, ...(selected.Args ?? [])].filter(Boolean).join(' ') || '—' }, { label: 'Environment names', value: selected.Config.EnvNames?.join(', ') || 'None' }, { label: 'Privileged', value: selected.HostConfig.Privileged ? 'Yes' : 'No' }]} /></Panel> : <Panel title="Activity"><Facts items={[{ label: 'Created', value: formatDateTime(selected.Created) }, { label: 'Started', value: formatDateTime(selected.State.StartedAt) }, { label: 'Finished', value: formatDateTime(selected.State.FinishedAt) }, { label: 'OOM killed', value: selected.State.OOMKilled ? 'Yes' : 'No' }, { label: 'Restarts', value: String(selected.RestartCount) }]} /></Panel>}
      </Rows>
    )
  }
  return (
    <Panel flush title={`Containers (${rows.length})`}>
      <DataTable
        caption="Containers on the selected target"
        columns={columns}
        empty={<EmptyState description="This target reported no containers." icon="layers" title="No containers" />}
        rowKey={(container) => container.Id}
        rows={rows}
      />
    </Panel>
  )
}

function ImagesTab({ toast }: { toast: Toast }) {
  const { data, error, loading, reload } = useResource(() => api.images(), [])
  const [reference, setReference] = useState('')
  const [pending, setPending] = useState('')

  const pull = async () => {
    setPending('pull')
    try {
      const command = await api.pullImage(reference.trim())
      toast({ message: `Image pull queued (${shortID(command.id)})`, tone: 'success' })
      setReference('')
      await api.waitForCommand(command.id)
      await reload()
    } catch (reason) { toast({ message: messageOf(reason), tone: 'danger', duration: 0 }) } finally { setPending('') }
  }

  const remove = async (image: ImageSummary) => {
    const target = image.RepoTags?.[0] ?? image.Id
    setPending(target)
    try {
      const command = await api.removeImage(target)
      toast({ message: `Image removal queued (${shortID(command.id)})`, tone: 'success' })
      await api.waitForCommand(command.id)
      await reload()
    } catch (reason) { toast({ message: messageOf(reason), tone: 'danger', duration: 0 }) } finally { setPending('') }
  }

  const columns: TableColumn<ImageSummary>[] = [
    { header: 'Image', key: 'tags', render: (image) => <Mono>{image.RepoTags?.join(', ') || shortID(image.Id.replace('sha256:', ''))}</Mono> },
    { header: 'Created', key: 'created', render: (image) => formatTimestamp(image.Created) },
    { header: 'In use', key: 'containers', render: (image) => (image.Containers > 0 ? <Badge variant="success">{`${image.Containers} container${image.Containers === 1 ? '' : 's'}`}</Badge> : <Badge>Unused</Badge>) },
    { header: 'Size', key: 'size', numeric: true, render: (image) => formatBytes(image.Size) },
    {
      header: '',
      key: 'actions',
      render: (image) => (
        <Button loading={pending === (image.RepoTags?.[0] ?? image.Id)} onClick={() => void remove(image)} size="sm" variant="ghost">Remove</Button>
      ),
    },
  ]

  if (loading && !data) return <Spinner label="Reading images" />
  if (error) return <Banner tone="danger" title="Images are unavailable">{error}</Banner>
  return (
    <Rows>
      <Panel eyebrow="Pull an image" title="Bring an image onto this host">
        <Columns>
          <Input
            hint="An immutable tag or digest. The pull is queued as one audited command."
            label="Image reference"
            onChange={(event) => setReference(event.target.value)}
            placeholder="ghcr.io/org/service:2026.08.23"
            value={reference}
          />
          <Rows gap="tight">
            <Body size="sm">Pulling here only warms the host cache. Deployments still take their image from the application or stack they belong to.</Body>
            <Button disabled={!reference.trim()} loading={pending === 'pull'} onClick={() => void pull()} variant="secondary">Pull image</Button>
          </Rows>
        </Columns>
      </Panel>
      <Panel flush title={`Images (${data?.length ?? 0})`}>
        <DataTable
          caption="Images on the selected target, largest first"
          columns={columns}
          empty={<EmptyState description="This target reported no images." icon="package" title="No images" />}
          rowKey={(image) => image.Id}
          rows={data ?? []}
        />
      </Panel>
    </Rows>
  )
}

function VolumesTab({ toast }: { toast: Toast }) {
  const { data, error, loading, reload } = useResource(() => api.volumes(), [])
  const [name, setName] = useState('')
  const [pending, setPending] = useState('')

  const create = async () => {
    setPending('create')
    try {
      const command = await api.createVolume(name.trim())
      toast({ message: `Volume creation queued (${shortID(command.id)})`, tone: 'success' })
      setName('')
      await api.waitForCommand(command.id)
      await reload()
    } catch (reason) { toast({ message: messageOf(reason), tone: 'danger', duration: 0 }) } finally { setPending('') }
  }

  const columns: TableColumn<VolumeSummary>[] = [
    { header: 'Volume', key: 'name', render: (volume) => <Mono>{volume.Name}</Mono> },
    { header: 'Driver', key: 'driver', render: (volume) => volume.Driver },
    { header: 'Used by', key: 'refs', render: (volume) => (volume.UsageData ? (volume.UsageData.RefCount > 0 ? <Badge variant="success">{`${volume.UsageData.RefCount} container${volume.UsageData.RefCount === 1 ? '' : 's'}`}</Badge> : <Badge>Unreferenced</Badge>) : '—') },
    { header: 'Size', key: 'size', numeric: true, render: (volume) => (volume.UsageData && volume.UsageData.Size >= 0 ? formatBytes(volume.UsageData.Size) : '—') },
    {
      header: '',
      key: 'actions',
      render: (volume) => (
        <ConfirmAction
          busy={pending === volume.Name}
          compact
          confirmation={`REMOVE_VOLUME_${volume.Name.toUpperCase()}`}
          destructive
          label="Delete"
          onConfirm={async (confirmation) => {
            setPending(volume.Name)
            try {
              const command = await api.removeVolume(volume.Name, confirmation)
              toast({ message: `Volume removal queued (${shortID(command.id)})`, tone: 'success' })
              await api.waitForCommand(command.id)
              await reload()
            } catch (reason) { toast({ message: messageOf(reason), tone: 'danger', duration: 0 }) } finally { setPending('') }
          }}
        />
      ),
    },
  ]

  if (loading && !data) return <Spinner label="Reading volumes" />
  if (error) return <Banner tone="danger" title="Volumes are unavailable">{error}</Banner>
  return (
    <Rows>
      <Panel eyebrow="Local driver" title="Create a volume">
        <Columns>
          <Input hint="Lowercase name, letters and digits to start." label="Volume name" onChange={(event) => setName(event.target.value)} placeholder="postgres-data" value={name} />
          <Rows gap="tight">
            <Body size="sm">Managed databases create their own volumes. Create one here only for a stack you deploy yourself.</Body>
            <Button disabled={!name.trim()} loading={pending === 'create'} onClick={() => void create()} variant="secondary">Create volume</Button>
          </Rows>
        </Columns>
      </Panel>
      <Panel flush title={`Volumes (${data?.length ?? 0})`}>
        <DataTable
          caption="Volumes on the selected target"
          columns={columns}
          empty={<EmptyState description="This target reported no volumes." icon="database" title="No volumes" />}
          rowKey={(volume) => volume.Name}
          rows={data ?? []}
        />
      </Panel>
    </Rows>
  )
}

function NetworksTab({ toast }: { toast: Toast }) {
  const { data, error, loading, reload } = useResource(() => api.networks(), [])
  const [name, setName] = useState('')
  const [driver, setDriver] = useState('overlay')
  const [attachable, setAttachable] = useState(true)
  const [internal, setInternal] = useState(false)
  const [pending, setPending] = useState('')

  const create = async () => {
    setPending('create')
    try {
      const command = await api.createNetwork({ attachable, driver, internal, name: name.trim() })
      toast({ message: `Network creation queued (${shortID(command.id)})`, tone: 'success' })
      setName('')
      await api.waitForCommand(command.id)
      await reload()
    } catch (reason) { toast({ message: messageOf(reason), tone: 'danger', duration: 0 }) } finally { setPending('') }
  }

  const columns: TableColumn<NetworkSummary>[] = [
    { header: 'Network', key: 'name', render: (network) => <Mono>{network.Name}</Mono> },
    { header: 'Driver', key: 'driver', render: (network) => network.Driver },
    { header: 'Scope', key: 'scope', render: (network) => network.Scope },
    { header: 'Subnet', key: 'subnet', render: (network) => <Mono>{network.IPAM?.Config?.map((entry) => entry.Subnet).filter(Boolean).join(', ') || '—'}</Mono> },
    { header: 'Flags', key: 'flags', render: (network) => <Inline>{network.Ingress ? <Badge>Ingress</Badge> : null}{network.Attachable ? <Badge>Attachable</Badge> : null}{network.Internal ? <Badge>Internal</Badge> : null}</Inline> },
    {
      header: '',
      key: 'actions',
      render: (network) => (network.Ingress ? null : (
        <ConfirmAction
          busy={pending === network.Name}
          compact
          confirmation={`REMOVE_NETWORK_${network.Name.toUpperCase()}`}
          destructive
          label="Delete"
          onConfirm={async (confirmation) => {
            setPending(network.Name)
            try {
              const command = await api.removeNetwork(network.Name, confirmation)
              toast({ message: `Network removal queued (${shortID(command.id)})`, tone: 'success' })
              await api.waitForCommand(command.id)
              await reload()
            } catch (reason) { toast({ message: messageOf(reason), tone: 'danger', duration: 0 }) } finally { setPending('') }
          }}
        />
      )),
    },
  ]

  if (loading && !data) return <Spinner label="Reading networks" />
  if (error) return <Banner tone="danger" title="Networks are unavailable">{error}</Banner>
  return (
    <Rows>
      <Panel eyebrow="Overlay or bridge" title="Create a network">
        <Columns>
          <Rows gap="tight">
            <Input label="Network name" onChange={(event) => setName(event.target.value)} placeholder="edge" value={name} />
            <Select
              label="Driver"
              onChange={(event) => setDriver(event.target.value)}
              options={[{ label: 'Overlay (cluster-wide)', value: 'overlay' }, { label: 'Bridge (single host)', value: 'bridge' }]}
              value={driver}
            />
          </Rows>
          <Rows gap="tight">
            <Switch checked={attachable} description="Lets standalone containers join, not only services." onChange={(event) => setAttachable(event.target.checked)}>Attachable</Switch>
            <Switch checked={internal} description="No external routing. Use for database-only networks." onChange={(event) => setInternal(event.target.checked)}>Internal</Switch>
            <Button disabled={!name.trim()} loading={pending === 'create'} onClick={() => void create()} variant="secondary">Create network</Button>
          </Rows>
        </Columns>
      </Panel>
      <Panel flush title={`Networks (${data?.length ?? 0})`}>
        <DataTable
          caption="Networks on the selected target"
          columns={columns}
          empty={<EmptyState description="This target reported no networks." icon="external" title="No networks" />}
          rowKey={(network) => network.Id}
          rows={data ?? []}
        />
      </Panel>
    </Rows>
  )
}

function SwarmObjectsTab({ kind, toast }: { kind: 'configs' | 'secrets'; toast: Toast }) {
  const { data, error, loading, reload } = useResource(() => (kind === 'secrets' ? api.secrets() : api.configs()), [kind])
  const [pending, setPending] = useState('')

  const columns: TableColumn<SwarmObjectMeta>[] = [
    { header: 'Name', key: 'name', render: (item) => <Mono>{item.Spec.Name}</Mono> },
    { header: 'Created', key: 'created', render: (item) => formatDateTime(item.CreatedAt) },
    { header: 'Updated', key: 'updated', render: (item) => formatDateTime(item.UpdatedAt) },
    { header: 'Version', key: 'version', numeric: true, render: (item) => String(item.Version.Index) },
    ...(kind === 'configs'
      ? [{
        header: '',
        key: 'actions',
        render: (item: SwarmObjectMeta) => (
          <ConfirmAction
            busy={pending === item.Spec.Name}
            compact
            confirmation={`REMOVE_CONFIG_${item.Spec.Name.toUpperCase()}`}
            destructive
            label="Delete"
            onConfirm={async (confirmation) => {
              setPending(item.Spec.Name)
              try {
                const command = await api.removeConfig(item.Spec.Name, confirmation)
                toast({ message: `Config removal queued (${shortID(command.id)})`, tone: 'success' })
                await api.waitForCommand(command.id)
                await reload()
              } catch (reason) { toast({ message: messageOf(reason), tone: 'danger', duration: 0 }) } finally { setPending('') }
            }}
          />
        ),
      } satisfies TableColumn<SwarmObjectMeta>]
      : []),
  ]

  if (loading && !data) return <Spinner label={`Reading ${kind}`} />
  if (error) return <Banner tone="danger" title={`${kind === 'secrets' ? 'Secrets' : 'Configs'} are unavailable`}>{error}</Banner>
  return (
    <Rows>
      <Banner tone="info" title={kind === 'secrets' ? 'Secret values are never readable' : 'Config payloads are not shown'}>
        {kind === 'secrets'
          ? 'Docker does not return a secret value once it is created, and SwarmOps does not keep a copy. Only names and versions appear here; a managed credential is rotated by redeploying the database that owns it.'
          : 'A config payload is operator material, so the console lists names and versions only. SwarmOps writes its own Traefik config objects during a reconcile.'}
      </Banner>
      <Panel flush title={`${kind === 'secrets' ? 'Secrets' : 'Configs'} (${data?.length ?? 0})`}>
        <DataTable
          caption={`Swarm ${kind} on the selected target`}
          columns={columns}
          empty={<EmptyState description={`This cluster holds no ${kind}.`} icon="document" title={`No ${kind}`} />}
          rowKey={(item) => item.ID}
          rows={data ?? []}
        />
      </Panel>
    </Rows>
  )
}

export function CommandCataloguePage({
  activeServerID,
  servers,
  toast,
}: {
  activeServerID: string
  servers: Server[]
  toast: Toast
}) {
  const { data, error, loading } = useResource(() => api.commandCatalogue(), [])
  const [selected, setSelected] = useState<CommandDefinition | null>(null)
  const grouped = useMemo(() => {
    const groups = new Map<string, CommandDefinition[]>()
    for (const definition of data ?? []) {
      const entries = groups.get(definition.resource) ?? []
      entries.push(definition)
      groups.set(definition.resource, entries)
    }
    return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right))
  }, [data])

  if (loading && !data) return <Spinner label="Reading the command vocabulary" />
  if (error) return <Banner tone="danger" title="The catalogue is unavailable">{error}</Banner>

  const mutations = (data ?? []).filter((definition) => definition.mutation).length
  const reads = (data ?? []).length - mutations
  return (
    <Page>
      <DetailHeader
        subtitle="Everything SwarmOps can read from or do to a cluster, with the Docker command each entry becomes — and a Run button that executes it here. This vocabulary is closed: an operation absent from this list has no route, no queue action, and no argv the machine agent will accept."
        title="Supported commands"
      />
      <MetricGrid aria-label="Vocabulary size" columns={3}>
        <Metric hint="Projections of Docker and Swarm state" icon="document" label="Read operations" value={String(reads)} />
        <Metric hint="Queued, CSRF-protected, and audited" icon="terminal" label="Mutations" value={String(mutations)} />
        <Metric hint="Require a typed confirmation phrase" icon="alert" label="Destructive" tone="warning" value={String((data ?? []).filter((definition) => definition.destructive).length)} />
      </MetricGrid>
      {selected ? (
        <CommandRunner
          defaultServerID={activeServerID}
          definition={selected}
          onClose={() => setSelected(null)}
          servers={servers}
          toast={toast}
        />
      ) : null}
      {grouped.map(([resource, definitions]) => (
        <Panel eyebrow={`${definitions.length} operation${definitions.length === 1 ? '' : 's'}`} flush key={resource} title={resourceTitle(resource)}>
          <DataTable
            caption={`SwarmOps operations for ${resource}`}
            columns={[
              {
                header: 'Operation',
                key: 'title',
                render: (definition: CommandDefinition) => (
                  <Rows gap="tight">
                    <strong>{definition.title}</strong>
                    <Body size="sm">{definition.description}</Body>
                  </Rows>
                ),
              },
              { header: 'Docker', key: 'docker', render: (definition: CommandDefinition) => <Mono>{definition.docker}</Mono> },
              { header: 'API', key: 'endpoint', render: (definition: CommandDefinition) => <Mono>{definition.endpoint}</Mono> },
              {
                header: 'Guards',
                key: 'guards',
                render: (definition: CommandDefinition) => (
                  <Inline>
                    <Badge variant={definition.mutation ? 'warning' : 'neutral'}>{definition.mutation ? 'Mutation' : 'Read'}</Badge>
                    {definition.destructive ? <Badge variant="danger">Destructive</Badge> : null}
                    {definition.autoRetry ? <Badge>Auto-retry</Badge> : null}
                  </Inline>
                ),
              },
              {
                header: '',
                key: 'run',
                render: (definition: CommandDefinition) => (
                  <Button onClick={() => setSelected(definition)} size="sm" variant={definition.destructive ? 'ghost' : 'secondary'}>Run</Button>
                ),
              },
            ]}
            empty={<EmptyState description="No operation is registered for this resource." icon="terminal" title="No operations" />}
            rowKey={(definition: CommandDefinition) => definition.action}
            rows={definitions}
          />
        </Panel>
      ))}
    </Page>
  )
}

// CommandRunner builds its form from the catalogue entry alone and sends the
// request the same entry describes. It adds no capability: a read runs and
// shows what came back, a mutation is queued in the ledger like every other
// write, and a destructive entry stays disabled until its phrase is typed.
function CommandRunner({
  defaultServerID,
  definition,
  onClose,
  servers,
  toast,
}: {
  defaultServerID: string
  definition: CommandDefinition
  onClose: () => void
  servers: Server[]
  toast: Toast
}) {
  const [values, setValues] = useState<Record<string, boolean | number | string>>({})
  // An operation is executed on ONE named server. It defaults to the target
  // the shell has selected, but the runner asks explicitly: a command queued
  // against the wrong cluster is not recoverable by editing it afterwards.
  const [serverID, setServerID] = useState(defaultServerID)
  const [result, setResult] = useState<unknown>(null)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  useEffect(() => {
    const initial: Record<string, boolean | number | string> = {}
    for (const parameter of definition.parameters ?? []) {
      if (parameter.kind === 'switch') initial[parameter.name] = false
      if (parameter.kind === 'select' || parameter.kind === 'hidden') initial[parameter.name] = parameter.options?.[0] ?? ''
    }
    setValues(initial)
    setResult(null)
    setError('')
    setServerID(defaultServerID)
  }, [defaultServerID, definition.action])

  const set = (name: string, value: boolean | number | string) => setValues((current) => ({ ...current, [name]: value }))
  // The phrase the API will check, with the target the operator has typed
  // substituted in — so the console never asks for a phrase the server rejects.
  const confirmation = expectedConfirmation(definition, values)
  const confirmationParameter = (definition.parameters ?? []).find((parameter) => parameter.kind === 'confirmation')
  const unconfirmed = confirmationParameter ? values[confirmationParameter.name] !== confirmation : false
  const eligible = servers.filter(serverCanRunCataloguedOperation)
  const target = servers.find((server) => server.id === serverID)
  const targetReady = Boolean(target && serverCanRunCataloguedOperation(target))
  const blocked = unconfirmed || !targetReady

  const run = async () => {
    setPending(true)
    setError('')
    setResult(null)
    try {
      const payload = await api.runCatalogued(definition, values, serverID)
      setResult(payload)
      if (definition.mutation) {
        const queued = payload as { id?: string }
        toast({ message: `${definition.title} queued on ${target?.name ?? serverID}${queued?.id ? ` (${shortID(queued.id)})` : ''}`, tone: 'success' })
      }
    } catch (reason) {
      setError(messageOf(reason))
    } finally {
      setPending(false)
    }
  }

  return (
    <Panel
      actions={<Button onClick={onClose} size="sm" variant="ghost">Close</Button>}
      eyebrow={definition.docker}
      title={`Run: ${definition.title}`}
    >
      <Rows>
        <Body size="sm">{definition.description}</Body>
        <Facts items={[
          { label: 'Request', mono: true, value: definition.endpoint },
          { label: 'Kind', value: definition.mutation ? 'Queued mutation' : 'Read' },
          { label: 'Runs on', value: target ? `${target.name} · ${target.host}` : 'No server chosen' },
          ...(confirmation ? [{ label: 'Confirmation', mono: true, value: confirmation }] : []),
        ]} />
        <Select
          hint={
            definition.mutation
              ? 'The command is queued for this server and executed against it by the durable worker.'
              : 'The read is answered by this server, not by whichever target the shell has selected.'
          }
          label="Server"
          onChange={(event) => setServerID(event.target.value)}
          options={[
            { label: eligible.length ? 'Choose a server…' : 'No connected Swarm manager', value: '' },
            ...servers.map((server) => ({
              label: serverOptionLabel(server),
              value: server.id,
            })),
          ]}
          value={serverID}
        />
        {serverID && !targetReady ? (
          <Banner tone="warning" title="That server cannot run this">
            An operation runs only against a connected remote Swarm manager. Connect the target from Servers, or choose
            one that already reports Swarm control.
          </Banner>
        ) : null}
        {(definition.parameters ?? []).filter((parameter) => parameter.kind !== 'hidden').map((parameter) => (
          <CommandField
            confirmation={parameter.kind === 'confirmation' ? confirmation : undefined}
            key={parameter.name}
            onChange={(value) => set(parameter.name, value)}
            parameter={parameter}
            value={values[parameter.name]}
          />
        ))}
        {error ? <Banner tone="danger" title="The operation was refused">{error}</Banner> : null}
        <Inline>
          <Button
            disabled={blocked}
            loading={pending}
            onClick={() => void run()}
            variant={definition.destructive ? 'danger' : 'primary'}
          >
            {definition.mutation ? 'Queue command' : 'Run'}
          </Button>
          {!targetReady ? <Body size="sm">Choose a connected Swarm manager to run this on.</Body> : null}
          {targetReady && unconfirmed ? <Body size="sm">Type the confirmation phrase above to enable this.</Body> : null}
        </Inline>
        {result !== null && result !== undefined ? (
          <Rows gap="tight">
            <Label as="p">Result</Label>
            <CodeBlock label={`${definition.action} response`}>{JSON.stringify(result, null, 2).slice(0, 20000)}</CodeBlock>
            <Body size="sm">
              {definition.mutation
                ? `The response is the queued command record for ${target?.name ?? serverID}. Follow it to completion in Command queue.`
                : `This is exactly what ${target?.name ?? 'the control plane'} returned, including the fields it withholds by design.`}
            </Body>
          </Rows>
        ) : null}
      </Rows>
    </Panel>
  )
}

function CommandField({
  confirmation,
  onChange,
  parameter,
  value,
}: {
  confirmation?: string
  onChange: (value: boolean | number | string) => void
  parameter: CommandParameter
  value: boolean | number | string | undefined
}) {
  if (parameter.kind === 'switch') {
    return (
      <Switch checked={Boolean(value)} description={parameter.hint} onChange={(event) => onChange(event.target.checked)}>
        {parameter.label}
      </Switch>
    )
  }
  if (parameter.kind === 'select') {
    return (
      <Select
        hint={parameter.hint}
        label={parameter.label}
        onChange={(event) => onChange(event.target.value)}
        options={(parameter.options ?? []).map((option) => ({ label: option, value: option }))}
        value={String(value ?? '')}
      />
    )
  }
  return (
    <Input
      hint={parameter.kind === 'confirmation' ? `Type ${confirmation ?? 'the phrase'} exactly.` : parameter.hint}
      label={parameter.label}
      onChange={(event) => onChange(event.target.value)}
      placeholder={parameter.kind === 'confirmation' ? confirmation : parameter.placeholder}
      type={parameter.kind === 'number' ? 'number' : 'text'}
      value={String(value ?? '')}
    />
  )
}

// expectedConfirmation fills the catalogue's phrase template from what the
// operator has typed. The server derives the same phrase from the same target,
// so a mismatch here is a mismatch there.
function expectedConfirmation(definition: CommandDefinition, values: Record<string, boolean | number | string>) {
  if (!definition.confirmation) return ''
  return definition.confirmation.replace(/\{([A-Z]+)\}/g, (_match, token: string) => {
    const key = token.toLowerCase()
    const direct = values[key === 'role' ? 'role' : key]
    if (direct !== undefined && direct !== '') return String(direct).toUpperCase()
    // ID and NAME are the path target under whichever name the entry uses.
    const fallback = values.id ?? values.name ?? values.resource ?? ''
    return String(fallback).toUpperCase()
  })
}

// ConfirmAction is the one place a destructive phrase is typed. The button
// stays disabled until the operator has typed the exact phrase the API will
// check, so the console never claims an action is available that the server
// will refuse.
function ConfirmAction({
  busy,
  compact,
  confirmation,
  destructive,
  label,
  onConfirm,
}: {
  busy?: boolean
  compact?: boolean
  confirmation: string
  destructive?: boolean
  label: string
  onConfirm: (confirmation: string) => Promise<void> | void
}) {
  const [typed, setTyped] = useState('')
  const [open, setOpen] = useState(false)
  if (compact && !open) {
    return <Button onClick={() => setOpen(true)} size="sm" variant="ghost">{label}</Button>
  }
  return (
    <Rows gap="tight">
      <Input
        hint={`Type ${confirmation} to enable this action.`}
        label="Confirmation"
        onChange={(event) => setTyped(event.target.value)}
        placeholder={confirmation}
        value={typed}
      />
      <Inline>
        <Button
          disabled={typed !== confirmation}
          loading={busy}
          onClick={async () => { await onConfirm(typed); setTyped(''); setOpen(false) }}
          variant={destructive ? 'danger' : 'secondary'}
        >
          {label}
        </Button>
        {compact ? <Button onClick={() => { setOpen(false); setTyped('') }} size="sm" variant="ghost">Cancel</Button> : null}
      </Inline>
    </Rows>
  )
}

function useResource<T>(read: () => Promise<T>, dependencies: unknown[]) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const load = useCallback(async () => {
    setLoading(true)
    try {
      setData(await read())
      setError('')
    } catch (reason) {
      setError(messageOf(reason))
    } finally {
      setLoading(false)
    }
    // The reader closes over the props this tab was given; the caller lists
    // them so a tab switch refetches rather than showing another tab's rows.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies)
  useEffect(() => { void load() }, [load])
  return { data, error, loading, reload: load }
}

function containerName(container: ContainerSummary) {
  return container.Names?.[0]?.replace(/^\//, '') ?? shortID(container.Id)
}

function portSummary(container: ContainerSummary) {
  const ports = (container.Ports ?? [])
    .filter((port) => port.PublicPort)
    .map((port) => `${port.PublicPort}→${port.PrivatePort}/${port.Type}`)
  return ports.length ? ports.join(' ') : '—'
}

function eventSubject(event: EngineEvent) {
  const name = event.Actor.Attributes?.name ?? event.Actor.Attributes?.image ?? event.Actor.ID
  return <Mono>{name ? (name.length > 48 ? `${name.slice(0, 48)}…` : name) : '—'}</Mono>
}

function pruneDescription(resource: PruneResource, usage: DiskUsage | null) {
  switch (resource) {
    case 'containers':
      return 'Removes every stopped container. Swarm task containers are recreated by their service.'
    case 'volumes':
      return `Removes every volume no container references${usage?.Volumes?.length ? ` (${usage.Volumes.length} volumes known)` : ''}. The data inside them is destroyed.`
    case 'networks':
      return 'Removes user-defined networks nothing is attached to. Ingress is never touched.'
    case 'build-cache':
      return 'Clears the builder cache. The next build will be slower but identical.'
    default:
      return 'Removes unused image layers.'
  }
}

function resourceTitle(resource: string) {
  return resource.charAt(0).toUpperCase() + resource.slice(1)
}

function messageOf(reason: unknown) { return reason instanceof Error ? reason.message : 'Unexpected operation failure' }
function shortID(value: string) { return value.length > 12 ? `${value.slice(0, 12)}…` : value }
function formatDateTime(value?: string) { return value && !value.startsWith('0001-01-01') ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—' }
function formatTimestamp(seconds: number) { return seconds ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(seconds * 1000)) : '—' }
function formatBytes(value: number) {
  if (!value) return '0 B'
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB']
  const power = Math.min(Math.floor(Math.log(Math.abs(value)) / Math.log(1024)), units.length - 1)
  return `${(value / 1024 ** power).toFixed(power > 1 ? 1 : 0)} ${units[power]}`
}

function formatClock(value: string) {
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

function imageLabel(image: ImageSummary) {
  const tag = image.RepoTags?.[0]
  if (!tag) return shortID(image.Id.replace('sha256:', ''))
  const short = tag.split('/').pop() ?? tag
  return short.length > 22 ? `${short.slice(0, 22)}…` : short
}

// countEvents groups the window by "type action" and keeps the busiest ten, so
// the bar chart says what the Engine did rather than listing everything twice.
function countEvents(events: EngineEvent[]): [string, number][] {
  const counts = new Map<string, number>()
  for (const event of events) {
    const key = `${event.Type} ${event.Action.split(':')[0]}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return [...counts.entries()].sort(([, left], [, right]) => right - left).slice(0, 10)
}

// serverOptionLabel says in the option itself why a target cannot be used, so
// the operator does not pick one and then read a refusal.
function serverOptionLabel(server: Server) {
  if (server.connectionState !== 'connected') return `${server.name} — not connected`
	if (server.agentHealth?.state === 'unhealthy') return `${server.name} — machine agent unreachable`
	if (server.agentHealth?.state === 'degraded') return `${server.name} — agent needs attention`
  if (!server.swarmControlAvailable) return `${server.name} — not a Swarm manager`
  return `${server.name} · ${server.host}`
}

function serverCanRunCataloguedOperation(server: Server) {
	return server.connectionState === 'connected' && server.swarmControlAvailable && server.agentHealth?.state === 'healthy'
}
