import { useCallback, useEffect, useState } from 'react'
import { Badge, Banner, Body, Button, DetailHeader, Inline, Input, Label, Page, Panel, Select, Spinner, Stack, Switch } from '@nim.zone/ui'
import { api } from './api'
import type { LogPage, LogStatus } from './types'

const sourceOptions = ['', 'container', 'host', 'docker', 'traefik', 'core', 'agent', 'fluentd'].map(value => ({ label: value || 'All sources', value }))
const levelOptions = ['', 'trace', 'debug', 'info', 'warn', 'error', 'fatal'].map(value => ({ label: value || 'All levels', value }))

export function LogsPage() {
  const [page, setPage] = useState<LogPage>()
  const [status, setStatus] = useState<LogStatus>()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [live, setLive] = useState(false)
  const [rangeHours, setRangeHours] = useState('1')
  const [cursor, setCursor] = useState('')
  const [filters, setFilters] = useState({ level: '', sourceKind: '', node: '', stack: '', service: '', container: '', unit: '', search: '' })

  const load = useCallback(async (nextCursor = '') => {
    setLoading(true)
    try {
      const to = new Date()
      const from = new Date(to.getTime() - Number(rangeHours) * 60 * 60 * 1000)
      const [records, pipeline] = await Promise.all([api.logs({ ...filters, from: from.toISOString(), to: to.toISOString(), limit: 200, cursor: nextCursor }), api.logsStatus()])
      setPage(records); setStatus(pipeline); setCursor(nextCursor); setError('')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Logs are unavailable') }
    finally { setLoading(false) }
  }, [filters, rangeHours])

  useEffect(() => { void load() }, [load])
  useEffect(() => { if (!live) return; const timer = window.setInterval(() => void load(), 5000); return () => window.clearInterval(timer) }, [live, load])
  const update = (key: keyof typeof filters, value: string) => setFilters(current => ({ ...current, [key]: value }))

  return <Page>
    <DetailHeader title="Logs" subtitle="Sanitized container stdout/stderr and host journals from the explicitly selected Swarm. Queries are literal, bounded to seven days, and never expose a file path or regular expression." status={<Badge variant={status?.healthy ? 'success' : 'warning'}>{status?.healthy ? 'Pipeline healthy' : 'Pipeline unavailable'}</Badge>} />
    {error ? <Banner title="Log collection unavailable" tone="danger">{error}. Enable or repair the reviewed SwarmOps Logs stack on this manager.</Banner> : null}
    {status?.warnings?.map(warning => <Banner key={warning} title="Pipeline warning" tone="warning">{warning}</Banner>)}
    {status ? <Panel title="Pipeline health"><Inline wrap><Label>Coverage {status.forwarders}/{status.expectedNodes || 'unknown'} nodes</Label><Label>{formatBytes(status.retainedBytes)} retained</Label><Label>{formatBytes(status.bufferBytes)} buffered</Label><Label>7-day policy / {formatBytes(status.capacityBytes)} cap</Label><Label>{status.capacityEvictions} capacity evictions</Label><Label>{status.droppedRecords} dropped</Label></Inline></Panel> : null}
    <Panel title="Filters">
      <Stack gap="tight">
        <Inline wrap><Select aria-label="Time range" options={[{label:'Last 15 minutes',value:'0.25'},{label:'Last hour',value:'1'},{label:'Last 6 hours',value:'6'},{label:'Last 24 hours',value:'24'},{label:'Last 7 days',value:'168'}]} value={rangeHours} onChange={event => setRangeHours(event.target.value)} /><Select aria-label="Log level" options={levelOptions} value={filters.level} onChange={event => update('level', event.target.value)} /><Select aria-label="Log source" options={sourceOptions} value={filters.sourceKind} onChange={event => update('sourceKind', event.target.value)} /><Input aria-label="Node" placeholder="Node" value={filters.node} onChange={event => update('node', event.target.value)} /><Input aria-label="Stack" placeholder="Stack" value={filters.stack} onChange={event => update('stack', event.target.value)} /><Input aria-label="Service" placeholder="Service" value={filters.service} onChange={event => update('service', event.target.value)} /></Inline>
        <Inline wrap><Input aria-label="Container ID" placeholder="Container ID" value={filters.container} onChange={event => update('container', event.target.value)} /><Input aria-label="Systemd unit" placeholder="Systemd unit" value={filters.unit} onChange={event => update('unit', event.target.value)} /><Input aria-label="Literal text" placeholder="Literal text (max 256)" maxLength={256} value={filters.search} onChange={event => update('search', event.target.value)} /><Button onClick={() => void load()}>Apply</Button><Switch checked={live} description="Refreshes the newest one-hour window every five seconds." onChange={event => setLive(event.target.checked)}>Live polling</Switch></Inline>
      </Stack>
    </Panel>
    <Panel title="Sanitized records">
      {loading && !page ? <Spinner label="Reading logs" /> : !page?.records.length ? <Body tone="muted">No matching records in the selected time range.</Body> : <Stack gap="tight">{page.records.map(record => <Panel key={record.id} eyebrow={`${new Date(record.timestamp).toLocaleString()} · ${record.sourceKind} · ${record.level}`} title={record.service || record.unit || record.containerId?.slice(0,12) || record.node || 'Host record'}><Body>{record.message}</Body><Body size="sm" tone="muted">{[record.node, record.stack, record.service, record.containerId, record.unit, record.stream].filter(Boolean).join(' · ')}</Body></Panel>)}</Stack>}
      {page?.nextCursor ? <Inline><Button disabled={!cursor} onClick={() => void load('')} variant="ghost">Newest</Button><Button onClick={() => void load(page.nextCursor)}>Older records</Button></Inline> : null}
    </Panel>
  </Page>
}

function formatBytes(value: number) { if (!value) return '0 B'; const units=['B','KiB','MiB','GiB']; const power=Math.min(Math.floor(Math.log(value)/Math.log(1024)),units.length-1); return `${(value/1024**power).toFixed(power ? 1 : 0)} ${units[power]}` }
