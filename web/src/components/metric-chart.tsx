import { useEffect, useState } from 'react'
import { Banner, Body, Button, Chart, Panel, Spinner, Stack as Rows } from '@nim.zone/ui'
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
