import { useCallback, useEffect, useState } from 'react'
import {
  Badge,
  Banner,
  Body,
  Button,
  Columns,
  DataTable,
  EmptyState,
  Input,
  Mono,
  Panel,
  Select,
  Spinner,
  StatusDot,
} from '@nim.zone/ui'
import type { TableColumn } from '@nim.zone/ui'
import { api } from '../../data/api'
import type { RouteInventoryRow, TraefikLogRecord } from '../../data/types'
import { formatDateTime } from '../../lib/format'
import { messageOf } from '../../lib/errors'

const LEVELS = [
  { label: 'Every level', value: '' },
  { label: 'Error', value: 'error' },
  { label: 'Warning', value: 'warn' },
  { label: 'Info', value: 'info' },
  { label: 'Debug', value: 'debug' },
]

interface Row extends TraefikLogRecord {
  key: string
}

/**
 * What the edge actually carried, request by request.
 *
 * `GET /api/v1/traefik/logs` was served, typed, given a client method with
 * router, service, level and request-id filters — and called from nowhere. The
 * Gateway screen promises "what the edge is carrying, and where it is failing",
 * and answered the second half with a rate chart, which says that failures are
 * happening but never which request failed.
 *
 * This is deliberately NOT the Logs screen. That one searches collected
 * container and host records; this reads the gateway's own access and error
 * log, where a request id is the thing that ties a 502 seen by a user to the
 * router and backend that produced it.
 */
export function AccessLogPanel({ routes }: { routes: RouteInventoryRow[] }) {
  // The gateway's log has no record id, and two requests in the same
  // millisecond are ordinary at the edge. Position in the answer is the only
  // identity available, so it is assigned once on arrival rather than
  // recomputed per render.
  const [records, setRecords] = useState<Row[]>([])
  const [level, setLevel] = useState('')
  const [router, setRouter] = useState('')
  const [requestID, setRequestID] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const answer = await api.traefikLogs({ level, limit: 200, requestId: requestID.trim(), router })
      setRecords((answer ?? []).map((record, index) => ({ ...record, key: `${index}-${record.timestamp}` })))
    } catch (reason) {
      setError(messageOf(reason))
      setRecords([])
    } finally {
      setLoading(false)
    }
  }, [level, requestID, router])

  useEffect(() => { void load() }, [load])

  const columns: TableColumn<Row>[] = [
    { header: 'When', key: 'time', render: (record) => formatDateTime(record.timestamp) },
    {
      header: 'Status',
      key: 'status',
      render: (record) => record.statusCode
        ? <StatusDot tone={record.statusCode >= 500 ? 'danger' : record.statusCode >= 400 ? 'warning' : 'success'}>{String(record.statusCode)}</StatusDot>
        : <Badge>{record.level}</Badge>,
    },
    { header: 'Method', key: 'method', render: (record) => <Mono>{record.method || '—'}</Mono> },
    { header: 'Router', key: 'router', render: (record) => <Mono>{record.router || '—'}</Mono> },
    { header: 'Service', key: 'service', render: (record) => <Mono>{record.service || '—'}</Mono> },
    { header: 'Client', key: 'client', render: (record) => <Mono>{record.client || '—'}</Mono> },
    { header: 'Request', key: 'request', render: (record) => <Mono>{record.requestId || '—'}</Mono> },
    { header: 'Message', key: 'message', render: (record) => record.message },
  ]

  // The routers the gateway actually observed, so the filter offers names that
  // exist rather than a free-text field that silently matches nothing.
  const routers = [...new Set(routes.map((row) => row.runtime?.router).filter((name): name is string => Boolean(name)))].sort()

  return (
    <Panel
      actions={<Button disabled={loading} iconStart="refresh" loading={loading} onClick={() => void load()} size="sm" variant="secondary">Refresh</Button>}
      description="Read from the gateway's own log, bounded to the most recent 200 matching records. This is what the edge saw; it is not the application's own output."
      flush
      title="Recent requests at the edge"
    >
      <Columns>
        <Select label="Level" onChange={(event) => setLevel(event.target.value)} options={LEVELS} value={level} />
        <Select
          label="Router"
          onChange={(event) => setRouter(event.target.value)}
          options={[{ label: 'Every router', value: '' }, ...routers.map((name) => ({ label: name, value: name }))]}
          value={router}
        />
        <Input
          hint="Ties one user-visible failure to the router and backend that produced it."
          label="Request id"
          onChange={(event) => setRequestID(event.target.value)}
          placeholder="Paste a request id"
          spellCheck={false}
          value={requestID}
        />
      </Columns>
      {error ? <Banner tone="warning" title="The gateway log is unavailable">{error}</Banner> : null}
      {loading && !records.length ? <Spinner label="Reading the gateway log" /> : null}
      <DataTable
        caption="Gateway access and error records, newest first"
        columns={columns}
        empty={
          <EmptyState
            description="No record matched. An empty result is a statement about this filter and the gateway's retained window, not about whether requests were served."
            icon="document"
            title="No matching records"
          />
        }
        rowKey={(record) => record.key}
        rows={records}
      />
      <Body size="sm" tone="muted">
        Access logging is written by the reviewed gateway stack. A gateway installed outside SwarmOps may not write it at
        all, in which case this stays empty rather than reporting zero requests.
      </Body>
    </Panel>
  )
}
