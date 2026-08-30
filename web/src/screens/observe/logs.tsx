import { useCallback, useEffect, useState } from 'react'
import {
  Badge,
  Banner,
  Body,
  Button,
  EmptyState,
  Inline,
  Input,
  List,
  ListRow,
  Mono,
  Panel,
  Select,
  Spinner,
  Stack as Rows,
  StatusDot,
  Switch,
  Toolbar,
} from '@nim.zone/ui'
import type { StatusTone } from '@nim.zone/ui'
import { api } from '../../data/api'
import type { LogPage, LogStatus } from '../../data/types'
import { formatBytes, formatDateTime } from '../../lib/format'
import { messageOf } from '../../lib/errors'
import { Screen } from '../../components/screen'

const SOURCE_OPTIONS = ['', 'container', 'host', 'docker', 'traefik', 'core', 'agent', 'fluentd']
  .map((value) => ({ label: value || 'All sources', value }))
const LEVEL_OPTIONS = ['', 'trace', 'debug', 'info', 'warn', 'error', 'fatal']
  .map((value) => ({ label: value || 'All levels', value }))
const RANGE_OPTIONS = [
  { label: 'Last 15 minutes', value: '0.25' },
  { label: 'Last hour', value: '1' },
  { label: 'Last 6 hours', value: '6' },
  { label: 'Last 24 hours', value: '24' },
  { label: 'Last 7 days', value: '168' },
]

const LEVEL_TONE: Record<string, StatusTone> = {
  debug: 'neutral',
  error: 'danger',
  fatal: 'danger',
  info: 'accent',
  trace: 'neutral',
  warn: 'warning',
}

/**
 * Collected service and host output, and — separately — whether the pipeline
 * that collects it is working.
 *
 * The two are deliberately distinct claims. A connected agent proves the
 * authenticated transport is live; it says nothing about Fluentd coverage,
 * retention, or the bounded query route, and a screen that conflated them
 * would report "no logs" for a cluster that is simply not collecting any.
 */
export function LogsPage() {
  const [page, setPage] = useState<LogPage>()
  const [status, setStatus] = useState<LogStatus>()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [live, setLive] = useState(false)
  const [rangeHours, setRangeHours] = useState('1')
  const [cursor, setCursor] = useState('')
  const [filters, setFilters] = useState({ container: '', level: '', node: '', search: '', service: '', sourceKind: '', stack: '', unit: '' })

  const load = useCallback(async (nextCursor = '') => {
    setLoading(true)
    try {
      const to = new Date()
      const from = new Date(to.getTime() - Number(rangeHours) * 60 * 60 * 1000)
      const [records, pipeline] = await Promise.all([
        api.logs({ ...filters, cursor: nextCursor, from: from.toISOString(), limit: 200, to: to.toISOString() }),
        api.logsStatus(),
      ])
      setPage(records)
      setStatus(pipeline)
      setCursor(nextCursor)
      setError('')
    } catch (reason) {
      setError(messageOf(reason))
    } finally {
      setLoading(false)
    }
  }, [filters, rangeHours])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    if (!live) return
    const timer = window.setInterval(() => void load(), 5000)
    return () => window.clearInterval(timer)
  }, [live, load])

  const update = (key: keyof typeof filters, value: string) => setFilters((current) => ({ ...current, [key]: value }))
  const records = page?.records ?? []
  const coverage = status ? `${status.forwarders} / ${status.expectedNodes || '?'}` : '—'
  const complete = Boolean(status && status.expectedNodes && status.forwarders >= status.expectedNodes)

  return (
    <Screen
      about="Queries are literal, bounded to seven days, and never expose a file path or a regular expression."
      actions={
        <Inline>
          <Switch checked={live} description="Refreshes the newest window every five seconds." onChange={(event) => setLive(event.target.checked)}>Live</Switch>
          <Button disabled={loading} iconStart="refresh" loading={loading} onClick={() => void load(cursor)} variant="secondary">Refresh</Button>
        </Inline>
      }
      insights={[
        { hint: status?.healthy ? 'The bounded query route and collector both answer' : 'Records cannot be read from this cluster right now', icon: 'document', label: 'Pipeline', tone: status?.healthy ? 'success' : 'warning', unmeasured: !status, value: status?.healthy ? 'Healthy' : 'Unavailable' },
        { hint: complete ? 'Every expected node is forwarding' : 'Nodes without a forwarder contribute no records at all', icon: 'server', label: 'Node coverage', tone: complete ? 'success' : 'warning', unmeasured: !status, value: coverage },
        { hint: status ? `${formatBytes(status.bufferBytes)} buffered · 7-day policy against a ${formatBytes(status.capacityBytes)} cap` : 'No retention figure has been read', icon: 'database', label: 'Retained', unmeasured: !status, value: status ? formatBytes(status.retainedBytes) : '—' },
        { hint: status?.droppedRecords ? 'Records the pipeline could not keep — this window may be incomplete' : 'No record has been dropped', icon: 'alert', label: 'Dropped', tone: status?.droppedRecords ? 'danger' : 'success', unmeasured: !status, value: String(status?.droppedRecords ?? 0) },
      ]}
      page="logs"
      status={<Badge variant={status?.healthy ? 'success' : 'warning'}>{status?.healthy ? 'Pipeline healthy' : 'Pipeline unavailable'}</Badge>}
      width="full"
    >
      {error ? (
        <Banner title="Logs are unavailable; agent connectivity is evaluated separately" tone="danger">
          {error}. This failure belongs to the bounded log route or collector pipeline; it does not by itself mean the outbound agent is disconnected. Check the connection indicator, then repair or install the reviewed SwarmOps Logs stack.
        </Banner>
      ) : null}
      {status?.warnings?.length
        ? status.warnings.map((warning) => <Banner key={warning} title="Pipeline warning" tone="warning">{warning}</Banner>)
        : null}
      {status && status.capacityEvictions > 0 ? (
        <Banner title="Older records were evicted to stay inside the cap" tone="warning">
          {status.capacityEvictions} eviction{status.capacityEvictions === 1 ? '' : 's'} have occurred. A query over the full seven days may not return everything that was collected.
        </Banner>
      ) : null}

      <Panel caption={`${records.length} record${records.length === 1 ? '' : 's'} in this window`} flush title="Sanitized records">
        <Toolbar actions={<Button onClick={() => void load()} size="sm" variant="secondary">Apply</Button>}>
          <Select aria-label="Time range" onChange={(event) => setRangeHours(event.target.value)} options={RANGE_OPTIONS} value={rangeHours} />
          <Select aria-label="Log level" onChange={(event) => update('level', event.target.value)} options={LEVEL_OPTIONS} value={filters.level} />
          <Select aria-label="Log source" onChange={(event) => update('sourceKind', event.target.value)} options={SOURCE_OPTIONS} value={filters.sourceKind} />
          <Input aria-label="Node" onChange={(event) => update('node', event.target.value)} placeholder="Node" value={filters.node} />
          <Input aria-label="Stack" onChange={(event) => update('stack', event.target.value)} placeholder="Stack" value={filters.stack} />
          <Input aria-label="Service" onChange={(event) => update('service', event.target.value)} placeholder="Service" value={filters.service} />
          <Input aria-label="Container ID" onChange={(event) => update('container', event.target.value)} placeholder="Container ID" value={filters.container} />
          <Input aria-label="Systemd unit" onChange={(event) => update('unit', event.target.value)} placeholder="Systemd unit" value={filters.unit} />
          <Input aria-label="Literal text" iconStart="search" maxLength={256} onChange={(event) => update('search', event.target.value)} placeholder="Literal text (max 256)" value={filters.search} />
        </Toolbar>

        {loading && !page ? <Spinner label="Reading logs" /> : null}
        {!loading || page ? (
          records.length ? (
            <List plain>
              {records.map((record) => (
                <ListRow
                  key={record.id}
                  leading={<StatusDot tone={LEVEL_TONE[record.level] ?? 'neutral'}>{record.level || 'log'}</StatusDot>}
                  subtitle={<Mono size="inherit">{record.message}</Mono>}
                  title={record.service || record.unit || record.containerId?.slice(0, 12) || record.node || 'Host record'}
                  trailing={<Body size="sm" tone="muted">{formatDateTime(record.timestamp)}</Body>}
                />
              ))}
            </List>
          ) : (
            <EmptyState
              description="Nothing matched this filter in the selected window. That is a statement about the query, not a promise that the services produced no output."
              icon="document"
              reason="unknown"
              title="No matching records"
            />
          )
        ) : null}

        {page?.nextCursor ? (
          <Rows gap="tight">
            <Inline>
              <Button disabled={!cursor} onClick={() => void load('')} variant="ghost">Newest</Button>
              <Button onClick={() => void load(page.nextCursor)} variant="secondary">Older records</Button>
            </Inline>
          </Rows>
        ) : null}
      </Panel>
    </Screen>
  )
}
