import { useCallback, useEffect, useState } from 'react'
import {
  Banner,
  Body,
  Chart,
  Columns,
  DataTable,
  EmptyState,
  Facts,
  Mono,
  Panel,
  RecordLink,
  ResourceMeter,
  Select,
  Sparkline,
  Spinner,
  Stack as Rows,
  StatusDot,
} from '@nim.zone/ui'
import { api } from '../../data/api'
import type { DiskUsage, EngineEvent, ImageSummary, Insights, InsightsSample } from '../../data/types'
import { formatBytes, formatTime, formatTimestamp, shortID } from '../../lib/format'
import { messageOf } from '../../lib/errors'
import { Screen } from '../../components/screen'

const WINDOWS = [
  { label: 'Last 15 minutes', value: '15' },
  { label: 'Last hour', value: '60' },
  { label: 'Last 6 hours', value: '360' },
  { label: 'Last 24 hours', value: '1440' },
]

/**
 * Resource pressure, and the checks behind a verdict.
 *
 * This screen is READ-ONLY by design. It used to carry a prune form and the
 * Swarm task-history setting, which put two irreversible mutations on the one
 * screen an operator opens while they are already worried — and put them a long
 * way from the objects they act on. Pruning now lives with Docker resources and
 * the Swarm settings with Swarm placement; what is left here is evidence.
 *
 * Every figure names where it came from, and a reading the controller does not
 * have is stated as an absence rather than averaged into a number.
 */
export function InsightsPage({ onOpenNodes, onOpenResources, onOpenServices }: {
  onOpenNodes: () => void
  onOpenResources: () => void
  onOpenServices: () => void
}) {
  const [insights, setInsights] = useState<Insights | null>(null)
  const [usage, setUsage] = useState<DiskUsage | null>(null)
  const [events, setEvents] = useState<EngineEvent[]>([])
  const [history, setHistory] = useState<InsightsSample[]>([])
  const [images, setImages] = useState<ImageSummary[]>([])
  const [window, setWindow] = useState('60')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (minutes: number) => {
    setLoading(true)
    setError('')
    try {
      const [insightValue, usageValue, eventValues, historyValues, imageValues] = await Promise.all([
        api.insights(),
        api.diskUsage(),
        api.events(minutes),
        api.insightsHistory(),
        api.images(),
      ])
      setInsights(insightValue)
      setUsage(usageValue)
      setEvents(eventValues)
      setHistory(historyValues)
      setImages(imageValues)
    } catch (reason) {
      setError(messageOf(reason))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load(Number(window)) }, [load, window])

  if (!insights) {
    return (
      <Screen page="overview">
        <Panel>
          {loading
            ? <Spinner label="Reading cluster insights" />
            : error
              ? <Banner tone="danger" title="Insights are unavailable">{error}</Banner>
              : (
                <EmptyState
                  description="The Engine returned no inventory. That may mean nothing is running, or that this manager cannot see it — the two are not distinguishable from here."
                  icon="sparkle"
                  reason="unknown"
                  title="No insights"
                />
              )}
        </Panel>
      </Screen>
    )
  }

  const reading: Insights = insights
  const reclaimable = reading.storage.reclaimableImageBytes + reading.storage.reclaimableVolumeBytes + reading.storage.reclaimableBuildCacheBytes
  const onDisk = reading.storage.imageBytes + reading.storage.volumeBytes + reading.storage.containerWritableBytes + reading.storage.buildCacheBytes
  // One reading a minute, so the axis is the sample clock rather than an
  // invented one. A single point draws nothing useful, so the charts wait.
  const times = history.map((sample) => formatTime(sample.at))
  const charted = history.length > 1
  const eventCounts = countEvents(events)
  const largestImages = images.slice(0, 8)

  const alerts = [
    ...(reading.nodes.unavailable ? [{ affected: `${reading.nodes.unavailable} node${reading.nodes.unavailable === 1 ? '' : 's'} not active`, open: onOpenNodes, severity: 'Critical', where: 'Swarm & placement' }] : []),
    ...(reading.services.degraded ? [{ affected: `${reading.services.degraded} degraded service${reading.services.degraded === 1 ? '' : 's'}`, open: onOpenServices, severity: 'Warning', where: 'Swarm services' }] : []),
    ...(reading.containers.unhealthy ? [{ affected: `${reading.containers.unhealthy} unhealthy container${reading.containers.unhealthy === 1 ? '' : 's'}`, open: onOpenResources, severity: 'Warning', where: 'Docker resources' }] : []),
  ]

  return (
    <Screen
      about="Live Docker Engine and Swarm readings, sampled once a minute by the selected manager. Longer history lives in the Prometheus stack SwarmOps can deploy under Collectors."
      actions={<Select aria-label="Observation window" onChange={(event) => setWindow(event.target.value)} options={WINDOWS} value={window} />}
      insights={[
        {
          hint: `${reading.nodes.managers} manager${reading.nodes.managers === 1 ? '' : 's'} · ${reading.nodes.unavailable} not active`,
          icon: 'server',
          label: 'Nodes ready',
          onOpen: onOpenNodes,
          source: 'docker node ls',
          tone: reading.nodes.unavailable ? 'warning' : 'success',
          value: `${reading.nodes.ready} / ${reading.nodes.total}`,
        },
        {
          hint: `${reading.services.degraded} degraded · ${reading.services.unhealthy} unhealthy`,
          icon: 'activity',
          label: 'Service tasks',
          onOpen: onOpenServices,
          source: 'docker service ls',
          tone: reading.services.degraded ? 'warning' : 'success',
          value: `${reading.services.runningTasks} / ${reading.services.desiredTasks}`,
        },
        {
          hint: `${reading.containers.stopped} stopped · ${reading.containers.unhealthy} unhealthy`,
          icon: 'layers',
          label: 'Containers running',
          onOpen: onOpenResources,
          source: 'docker ps',
          tone: reading.containers.unhealthy ? 'warning' : 'success',
          value: `${reading.containers.running} / ${reading.containers.total}`,
        },
        {
          hint: reclaimable ? `${formatBytes(reclaimable)} could be reclaimed by a prune` : 'Nothing is reclaimable',
          icon: 'database',
          label: 'Engine disk',
          onOpen: onOpenResources,
          source: 'docker system df',
          tone: reclaimable > 0 ? 'warning' : 'neutral',
          value: formatBytes(onDisk),
        },
      ]}
      page="overview"
      status={<StatusDot tone={alerts.length ? 'warning' : 'success'}>{alerts.length ? `${alerts.length} condition${alerts.length === 1 ? '' : 's'} to review` : 'Nothing derivable needs review'}</StatusDot>}
      width="full"
    >
      {error ? <Banner tone="warning" title="Some readings are stale">{error}</Banner> : null}

      <Columns template="two-thirds">
        {charted ? (
          <Panel eyebrow={`${history.length} samples`} title="Workload over time">
            <Chart
              categories={times}
              format={(value) => String(Math.round(value))}
              height={200}
              kind="line"
              legend
              note="Sampled once a minute since the API started. A rising desired line with a flat running line means Swarm is asking for work it cannot place."
              series={[
                { label: 'Tasks running', values: history.map((sample) => sample.tasksRunning) },
                { label: 'Tasks desired', values: history.map((sample) => sample.tasksDesired) },
                { label: 'Containers running', values: history.map((sample) => sample.containersRunning) },
              ]}
              title="Tasks and containers"
            />
          </Panel>
        ) : (
          <Banner tone="info" title="Trend lines start after two samples">
            The controller takes one reading a minute. Charts over time appear once a second reading exists; the figures above are live either way.
          </Banner>
        )}

        <Panel description="Derived from the current sample, not from an alerting rule. Each row opens the screen that owns it." flush title="Conditions to review">
          <DataTable
            columns={[
              { header: 'Severity', key: 'severity', render: (alert: (typeof alerts)[number]) => <StatusDot tone={alert.severity === 'Critical' ? 'danger' : 'warning'}>{alert.severity}</StatusDot> },
              { header: 'Condition', key: 'affected', render: (alert: (typeof alerts)[number]) => <RecordLink meta={`Open ${alert.where}`} onClick={alert.open} title={alert.affected} /> },
            ]}
            empty={<EmptyState description="No condition is derivable from the current manager sample. That is a statement about this sample, not a promise about the cluster." icon="check-circle" title="Nothing to review" />}
            rowKey={(alert) => alert.affected}
            rows={alerts}
          />
        </Panel>
      </Columns>

      {charted ? (
        <Columns>
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
          <Panel eyebrow="Reclaimable" title="Disk over time">
            <Chart
              categories={times}
              format={formatBytes}
              height={200}
              kind="line"
              legend
              series={[
                { label: 'Used', values: history.map((sample) => sample.diskUsedBytes) },
                { label: 'Capacity', values: history.map((sample) => sample.diskCapacityBytes) },
              ]}
              title="Fleet disk"
            />
          </Panel>
        </Columns>
      ) : null}

      <Columns>
        <Panel
          actions={<Sparkline label="Reclaimable bytes over the sampled window" values={history.map((sample) => sample.reclaimableBytes)} />}
          eyebrow="docker system df"
          title="Where the disk went"
        >
          <Chart
            categories={['Images', 'Volumes', 'Containers', 'Build cache']}
            format={formatBytes}
            height={200}
            kind="bar"
            legend
            note="Reclaimable is the part Docker would delete on a prune of that resource. Pruning lives on Fleet → Docker resources, beside the objects it deletes."
            series={[
              {
                label: 'In use',
                values: [
                  reading.storage.imageBytes - reading.storage.reclaimableImageBytes,
                  reading.storage.volumeBytes - reading.storage.reclaimableVolumeBytes,
                  reading.storage.containerWritableBytes,
                  reading.storage.buildCacheBytes - reading.storage.reclaimableBuildCacheBytes,
                ],
              },
              {
                label: 'Reclaimable',
                values: [
                  reading.storage.reclaimableImageBytes,
                  reading.storage.reclaimableVolumeBytes,
                  0,
                  reading.storage.reclaimableBuildCacheBytes,
                ],
              },
            ]}
            title="Disk by resource"
          />
        </Panel>

        <Panel eyebrow={`${images.length} images`} title="Largest images">
          {largestImages.length ? (
            <Chart
              categories={largestImages.map(imageLabel)}
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
      </Columns>

      <Columns template="two-thirds">
        <Panel caption={`${events.length} in the last ${window} minutes`} flush title="Engine activity">
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
          <DataTable
            caption="Docker Engine events, newest first"
            columns={[
              { header: 'When', key: 'time', render: (event: EngineEvent) => formatTimestamp(event.time) },
              { header: 'Action', key: 'action', render: (event: EngineEvent) => <Mono>{`${event.Type} ${event.Action}`}</Mono> },
              { header: 'Object', key: 'object', render: (event: EngineEvent) => <Mono>{eventSubject(event)}</Mono> },
            ]}
            empty={<EmptyState description="No Engine event was recorded in this window." icon="clock" title="No events" />}
            rowKey={(event: EngineEvent) => `${event.timeNano}-${event.Actor.ID}-${event.Action}`}
            rows={events.slice(0, 25)}
          />
        </Panel>

        <Rows gap="md">
          <Panel eyebrow="Fleet capacity" title="What the cluster has">
            <Facts items={[
              { label: 'CPU cores', value: String(reading.capacity.cpuCores) },
              { label: 'Memory', value: formatBytes(reading.capacity.memoryBytes) },
              { label: 'Overlay networks', value: `${reading.networks.overlay} of ${reading.networks.total}` },
              { label: 'Secrets / configs', value: `${reading.secrets} / ${reading.configs}` },
              { label: 'Sample history', value: `${history.length} in-memory samples` },
              { label: 'Volumes known', source: 'docker system df', unmeasured: !usage?.Volumes, value: String(usage?.Volumes?.length ?? 0), why: 'the Engine returned no volume usage' },
            ]} />
            {reading.capacity.diskBytes ? (
              <ResourceMeter
                detail="Reported by nodes running the machine agent"
                label="Fleet disk"
                percent={Math.round((reading.capacity.diskUsedBytes / reading.capacity.diskBytes) * 100)}
                value={`${formatBytes(reading.capacity.diskUsedBytes)} / ${formatBytes(reading.capacity.diskBytes)}`}
              />
            ) : (
              <Body size="sm">Disk capacity is reported by the machine agent. Nodes without an agent contribute no disk figure.</Body>
            )}
          </Panel>
          <Panel title="What this screen cannot see">
            <Body size="sm" tone="muted">
              Trace and log records come from the collectors under Observe → Collectors, not from this manager endpoint. When they are absent the console says so rather than drawing an empty chart.
            </Body>
          </Panel>
        </Rows>
      </Columns>
    </Screen>
  )
}

function eventSubject(event: EngineEvent) {
  const name = event.Actor.Attributes?.name ?? event.Actor.Attributes?.image ?? event.Actor.ID
  return name ? (name.length > 48 ? `${name.slice(0, 48)}…` : name) : '—'
}

function imageLabel(image: ImageSummary) {
  const tag = image.RepoTags?.[0]
  if (!tag) return shortID(image.Id.replace('sha256:', ''))
  const short = tag.split('/').pop() ?? tag
  return short.length > 22 ? `${short.slice(0, 22)}…` : short
}

/**
 * Group the window by "type action" and keep the busiest ten, so the bar chart
 * says what the Engine did rather than listing everything twice.
 */
function countEvents(events: EngineEvent[]): [string, number][] {
  const counts = new Map<string, number>()
  for (const event of events) {
    const key = `${event.Type} ${event.Action.split(':')[0]}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return [...counts.entries()].sort(([, left], [, right]) => right - left).slice(0, 10)
}
