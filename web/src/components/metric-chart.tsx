import { useEffect, useState } from 'react'
import { Banner, Body, Button, Chart, Columns, Panel, Spinner, Stack as Rows } from '@nim.zone/ui'
import { api } from '../data/api'
import type { MetricQuery, MetricRange } from '../data/types'
import { messageOf } from '../lib/errors'
import { formatBytes, formatDateTime } from '../lib/format'
import { metricSeries } from '../lib/metric-series'

export interface MetricChartProps {
  height?: number
  note?: string
  query: MetricQuery
  refreshMs?: number
  title: string
}

/** One chart contract: measurement, object, period and source. No source means no plot. */
export function MetricChart({ height = 200, note, query, refreshMs, title }: MetricChartProps) {
  const { application, container, machine, scope, series, windowSeconds = 21_600 } = query
  const key = JSON.stringify([application, container, machine, scope, series, windowSeconds])
  const [snapshot, setSnapshot] = useState<{ key: string; range?: MetricRange; error?: string }>()
  const [revision, setRevision] = useState(0)
  // Identity is checked during render, not only in an effect: old-object data
  // must never appear for even one paint under a new object's heading.
  const current = snapshot?.key === key ? snapshot : undefined
  const range = current?.range
  const points = range ? metricSeries(range) : null
  const object = [scope, application || container || machine || 'selected cluster', container && machine ? `on ${machine}` : ''].filter(Boolean).join(' · ')
  const period = range ? `${formatDateTime(range.from)} – ${formatDateTime(range.to)}` : `Last ${windowSeconds / 3600} hours`

  useEffect(() => {
    let live = true
    let timer: ReturnType<typeof setTimeout> | undefined
    const read = async () => {
      try {
        const to = new Date()
        const from = new Date(to.getTime() - windowSeconds * 1000)
        const result = await api.metricRange({ application, container, from, machine, scope, series, to })
        if (live) setSnapshot({ key, range: result })
      } catch (reason) {
        if (live) setSnapshot({ key, error: messageOf(reason) })
      } finally {
        // Schedule after completion: a slow source cannot reorder overlapping polls.
        if (live && refreshMs) timer = setTimeout(() => void read(), refreshMs)
      }
    }
    setSnapshot(undefined)
    void read()
    return () => { live = false; if (timer) clearTimeout(timer) }
  }, [application, container, key, machine, refreshMs, revision, scope, series, windowSeconds])

  const provenance = `${object} · ${period}`
  if (!current) return <Panel title={title} description={provenance}><Spinner label={`Reading ${title.toLowerCase()}`} /></Panel>
  if (current.error) return <Panel title={title} description={provenance}><Banner tone="danger" title="This reading could not be taken">{current.error}</Banner><Button onClick={() => setRevision((value) => value + 1)} variant="secondary">Try again</Button></Panel>
  if (!range || range.source !== 'prometheus' || !points || !points.some((point) => point.value !== null)) {
    return <Panel title={title} description={provenance}><Rows gap="tight"><Body size="sm" tone="muted">{range?.note || (range?.source === 'prometheus' && !points ? 'The source returned an invalid time grid. This reading cannot be plotted.' : 'No history is available for this reading.')}</Body><Body size="sm" tone="muted">Source: {range?.source === 'prometheus' ? points ? 'Prometheus, no measured samples' : 'Prometheus, invalid time grid' : 'unavailable'}. No measured value is implied.</Body></Rows></Panel>
  }
  const format = formatterFor(range.unit)
  const latest = points.at(-1)?.value
  return <Panel>
    <Chart
      categories={points.map((point) => point.at)}
      dataTableLabel="View data table"
      description={object}
      format={format}
      formatCategory={(_, index) => new Date(points[index].at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
      height={height}
      kind="line"
      maxXLabels={3}
      min={range.unit === 'ratio' ? 0 : undefined}
      max={range.unit === 'ratio' ? 1 : undefined}
      footer={`${note ? `${note} · ` : ''}${period} · Prometheus · ${range.unit}${latest == null ? ' · Latest sample unavailable' : ''}`}
      series={[{ label: title, values: points.map((point) => point.value) }]}
      title={title}
      value={latest != null && Number.isFinite(latest) ? format(latest) : '—'}
    />
  </Panel>
}

function formatterFor(unit: string): (value: number) => string {
  switch (unit) {
    case 'ratio': return (value) => `${Math.round(value * 100)}%`
    case 'bytes': return formatBytes
    case 'bytes/s': return (value) => `${formatBytes(value)}/s`
    case 'req/s': return (value) => `${value.toFixed(value < 10 ? 1 : 0)}/s`
    case 'seconds': return (value) => value < 1 ? `${Math.round(value * 1000)} ms` : `${value.toFixed(2)} s`
    default: return (value) => Number.isInteger(value) ? String(value) : value.toFixed(1)
  }
}

/**
 * What each series NAME means, in the words an operator uses.
 *
 * The controller owns the vocabulary; this owns only its English. A series the
 * controller adds and this record does not know still charts — under its own
 * name — so a new reading appears in the console the moment it is served
 * rather than the next time someone remembers to edit a screen.
 */
const SERIES_LABELS: Record<string, string> = {
  'block-read': 'Block read',
  'block-write': 'Block write',
  'cpu-iowait': 'CPU waiting on I/O',
  'disk-read': 'Disk read',
  'disk-write': 'Disk write',
  'latency-p95': 'Latency (p95)',
  'memory-limit': 'Memory limit',
  'memory-total': 'Memory installed',
  'network-rx': 'Network in',
  'network-tx': 'Network out',
  containers: 'Containers',
  cpu: 'CPU',
  errors: 'Failing requests',
  load: 'Load average',
  machines: 'Machines reporting',
  memory: 'Memory used',
  requests: 'Requests',
}

export function seriesLabel(series: string): string {
  return SERIES_LABELS[series] ?? series.replace(/-/g, ' ').replace(/^./, (letter) => letter.toUpperCase())
}

export interface MetricChartGridProps {
  /** Everything except `series` — which is the whole point: the grid asks the
      controller which series this scope has and charts each one. */
  query: Omit<MetricQuery, 'series'>
  refreshMs?: number
  /** Drawn first, in this order. Anything the controller also serves follows
      alphabetically, so the reading an operator opens the page for is at the
      top and nothing measured is silently dropped. */
  lead?: readonly string[]
}

/**
 * Every reading the controller will answer for one object.
 *
 * Screens used to name their series in JSX, which meant the console charted
 * four of the ten readings a machine actually reports and six were measured,
 * stored, and never drawn — including `load` and `cpu-iowait`, the two that
 * distinguish a busy host from a stuck one. `GET /api/v1/metrics/series` exists
 * to answer exactly this, and its own comment says so.
 */
export function MetricChartGrid({ lead = [], query, refreshMs }: MetricChartGridProps) {
  const { scope } = query
  const [names, setNames] = useState<{ scope: string; series?: string[]; error?: string }>()
  const current = names?.scope === scope ? names : undefined

  useEffect(() => {
    let live = true
    setNames(undefined)
    void api.metricSeries(scope)
      .then((value) => { if (live) setNames({ scope, series: value.series ?? [] }) })
      .catch((reason) => { if (live) setNames({ error: messageOf(reason), scope }) })
    return () => { live = false }
  }, [scope])

  if (!current) return <Panel><Spinner label={`Reading what a ${scope} can be asked for`} /></Panel>
  if (current.error) return <Panel><Banner tone="warning" title="The reading vocabulary is unavailable">{current.error}</Banner></Panel>

  const served = current.series ?? []
  const ordered = [
    ...lead.filter((name) => served.includes(name)),
    ...served.filter((name) => !lead.includes(name)).sort(),
  ]
  if (!ordered.length) {
    return <Panel><Body size="sm" tone="muted">The controller reports no series for this {scope}. No measurement is implied either way.</Body></Panel>
  }

  return (
    <Rows gap="md">
      {pairs(ordered).map(([left, right]) => (
        <Columns key={left}>
          <MetricChart query={{ ...query, series: left }} refreshMs={refreshMs} title={seriesLabel(left)} />
          {right ? <MetricChart query={{ ...query, series: right }} refreshMs={refreshMs} title={seriesLabel(right)} /> : null}
        </Columns>
      ))}
    </Rows>
  )
}

/** Two charts to a row. A grid component that reflowed to one column per
    reading made a machine's ten series a ten-screen scroll. */
function pairs(values: string[]): [string, string | undefined][] {
  const rows: [string, string | undefined][] = []
  for (let index = 0; index < values.length; index += 2) rows.push([values[index], values[index + 1]])
  return rows
}
