import { useEffect, useState } from 'react'
import { Banner, Body, Chart, Panel, Spinner, Stack as Rows } from '@nim.zone/ui'
import { api } from '../data/api'
import type { MetricQuery, MetricRange } from '../data/types'
import { messageOf } from '../lib/errors'
import { formatBytes } from '../lib/format'

/**
 * Every chart in this console is this component.
 *
 * It exists because a chart makes four claims at once — what was measured,
 * about which object, over what period, and by whom — and only the first was
 * ever on screen. A reading with no scope beside it is the thing that made an
 * operator ask "for which node?", which is where this whole rebuild started.
 *
 * So the source is not decoration here. A range that came back `unavailable`
 * draws NOTHING and says why: a cluster with no Prometheus has no history, and
 * an empty plot area reads as an idle machine.
 */
export interface MetricChartProps {
  /** Height of the plot. The width is always the container's. */
  height?: number
  /** What the reading means, in one line. */
  note?: string
  query: MetricQuery
  /** How often to re-read. Omit for a chart that is read once. */
  refreshMs?: number
  title: string
}

export function MetricChart({ height = 140, note, query, refreshMs, title }: MetricChartProps) {
  const [range, setRange] = useState<MetricRange | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  // The query is an object literal at every call site, so its identity changes
  // on every render. Depending on the VALUES rather than the object is what
  // keeps this from re-reading forever.
  const { application, container, machine, scope, series, windowSeconds } = query

  useEffect(() => {
    let live = true
    const read = async () => {
      try {
        const to = new Date()
        const from = new Date(to.getTime() - (windowSeconds ?? 21_600) * 1000)
        const result = await api.metricRange({ application, container, from, machine, scope, series, to })
        if (live) { setRange(result); setError('') }
      } catch (reason) {
        if (live) setError(messageOf(reason))
      } finally {
        if (live) setLoading(false)
      }
    }
    void read()
    if (!refreshMs) return () => { live = false }
    const timer = setInterval(() => void read(), refreshMs)
    return () => { live = false; clearInterval(timer) }
  }, [application, container, machine, refreshMs, scope, series, windowSeconds])

  if (loading && !range) {
    return <Panel title={title}><Spinner label={`Reading ${title.toLowerCase()}`} /></Panel>
  }
  if (error) {
    return (
      <Panel title={title}>
        <Banner tone="danger" title="This reading could not be taken">{error}</Banner>
      </Panel>
    )
  }
  if (!range || range.source === 'unavailable' || range.points.length === 0) {
    return (
      <Panel title={title}>
        <Rows gap="tight">
          <Body size="sm" tone="muted">
            {range?.note ?? 'No history is available for this reading.'}
          </Body>
          <Body size="sm" tone="muted">
            Nothing is drawn rather than a flat line: an empty plot and an idle machine look identical, and only one
            of them is a measurement.
          </Body>
        </Rows>
      </Panel>
    )
  }

  const format = formatterFor(range.unit)
  return (
    <Chart
      categories={axisLabels(range)}
      format={format}
      height={height}
      kind="area"
      min={range.unit === 'ratio' ? 0 : undefined}
      max={range.unit === 'ratio' ? 1 : undefined}
      note={`${note ? `${note} · ` : ''}${sourceNote(range)}`}
      series={[{ label: title, values: range.points.map((point) => point.value) }]}
      title={title}
    />
  )
}

/**
 * One label per point is what the kit asks for and is not what a reader can
 * use: seventy-two timestamps in a half-width column overlap into a grey
 * smear. Every point keeps its slot — the tooltip and the table still name
 * each one — and only about six of them are drawn on the axis.
 */
function axisLabels(range: MetricRange): string[] {
  const stride = Math.max(1, Math.ceil(range.points.length / 6))
  return range.points.map((point, index) => (index % stride === 0
    ? new Date(point.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : ''))
}

/**
 * The provenance line under every chart.
 *
 * A reading from fifteen days of Prometheus and a reading from a four-hour
 * in-memory ring are different claims, and the console says which one it is
 * making rather than leaving the reader to assume the stronger one.
 */
function sourceNote(range: MetricRange): string {
  const minutes = Math.round((new Date(range.to).getTime() - new Date(range.from).getTime()) / 60_000)
  const window = minutes >= 120 ? `${Math.round(minutes / 60)} hours` : `${minutes} minutes`
  return range.source === 'prometheus'
    ? `Last ${window}, from the cluster's Prometheus`
    : `Last ${window}, source unstated`
}

function formatterFor(unit: string): (value: number) => string {
  switch (unit) {
    case 'ratio':
      return (value) => `${Math.round(value * 100)}%`
    case 'bytes':
      return (value) => formatBytes(value)
    case 'bytes/s':
      return (value) => `${formatBytes(value)}/s`
    case 'req/s':
      return (value) => `${value.toFixed(value < 10 ? 1 : 0)}/s`
    case 'seconds':
      return (value) => (value < 1 ? `${Math.round(value * 1000)} ms` : `${value.toFixed(2)} s`)
    default:
      return (value) => (Number.isInteger(value) ? String(value) : value.toFixed(1))
  }
}
