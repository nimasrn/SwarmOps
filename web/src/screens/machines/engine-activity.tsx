import { useCallback, useEffect, useState } from 'react'
import {
  Banner,
  Chart,
  DataTable,
  EmptyState,
  Mono,
  Panel,
  Select,
  Spinner,
} from '@nim.zone/ui'
import { api } from '../../data/api'
import type { EngineEvent } from '../../data/types'
import { formatTimestamp } from '../../lib/format'
import { messageOf } from '../../lib/errors'

const WINDOWS = [
  { label: 'Last 15 minutes', value: '15' },
  { label: 'Last hour', value: '60' },
  { label: 'Last 6 hours', value: '360' },
  { label: 'Last 24 hours', value: '1440' },
]

/**
 * What the Docker Engine itself did, as opposed to what SwarmOps asked it to.
 *
 * `GET /api/v1/events` was served and read by no reachable screen. It is not
 * the audit trail — that records this console's own operations — and it is not
 * a log. It is the Engine's own account of containers starting, images being
 * pulled and volumes being mounted, which is why it sits with the containers
 * rather than under Activity: the objects it describes are on this screen.
 */
export function EngineActivityPanel() {
  const [events, setEvents] = useState<EngineEvent[]>([])
  const [window, setWindow] = useState('60')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (minutes: number) => {
    setLoading(true)
    setError('')
    try {
      setEvents(await api.events(minutes))
    } catch (reason) {
      setError(messageOf(reason))
      setEvents([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load(Number(window)) }, [load, window])

  const counts = countEvents(events)

  return (
    <Panel
      actions={<Select aria-label="Observation window" onChange={(event) => setWindow(event.target.value)} options={WINDOWS} value={window} />}
      caption={loading ? undefined : `${events.length} in the last ${window} minutes`}
      description="Reported by the Engine on the selected manager. An empty window means the Engine recorded nothing, not that nothing happened elsewhere in the cluster."
      title="Engine activity"
    >
      {error ? <Banner tone="warning" title="Engine events are unavailable">{error}</Banner> : null}
      {loading && !events.length ? <Spinner label="Reading Engine events" /> : null}
      {counts.length ? (
        <Chart
          categories={counts.map(([label]) => label)}
          format={(value) => String(Math.round(value))}
          height={180}
          kind="bar"
          note="What the Engine actually did in this window, by object type and action."
          series={[{ label: 'Events', series: 2, values: counts.map(([, count]) => count) }]}
          title="Events by action"
        />
      ) : null}
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
  )
}

function eventSubject(event: EngineEvent) {
  const name = event.Actor.Attributes?.name ?? event.Actor.Attributes?.image ?? event.Actor.ID
  return name ? (name.length > 48 ? `${name.slice(0, 48)}…` : name) : '—'
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
