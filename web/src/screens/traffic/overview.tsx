import { useState } from 'react'
import {
  Body,
  Button,
  Columns,
  DataTable,
  EmptyState,
  Facts,
  Metric,
  MetricGrid,
  Mono,
  Panel,
  Stack as Rows,
  StatusDot,
  Tabs,
} from '@nim.zone/ui'
import type { TableColumn } from '@nim.zone/ui'
import type { CertificateStatus, PrometheusStatus, RouteInventoryRow, RoutingState } from '../../data/types'
import { capitalize } from '../../lib/format'


export function TrafficOverview({ certificates, prometheus, routes, state }: { certificates: CertificateStatus[]; prometheus: PrometheusStatus | null; routes: RouteInventoryRow[]; state: RoutingState }) {
  const [protocol, setProtocol] = useState('all')
  const [selectedKey, setSelectedKey] = useState(routes[0]?.route.key ?? '')
  const filtered = protocol === 'all' ? routes : routes.filter((row) => row.route.protocol === protocol)
  const selected = routes.find((row) => row.route.key === selectedKey) ?? filtered[0] ?? routes[0]
  const expiring = certificates.filter((certificate) => certificate.notAfter && new Date(certificate.notAfter).getTime() < Date.now() + 30 * 86400000)
  const failingTargets = prometheus?.targets?.filter((target) => target.health !== 'up').length ?? 0
  const routeColumns: TableColumn<RouteInventoryRow>[] = [
    { header: 'Application / service', key: 'service', render: (row) => <Button onClick={() => setSelectedKey(row.route.key)} size="sm" variant="ghost">{row.route.serviceKey}</Button> },
    { header: 'Proto', key: 'protocol', render: (row) => row.route.protocol.toUpperCase() },
    { header: 'Public host / entrypoint', key: 'public', render: (row) => <Mono>{row.route.match.hosts?.join(', ') || row.route.match.sni?.join(', ') || row.route.listenPort || 'Internal only'}</Mono> },
    { header: 'Internal destination', key: 'target', render: (row) => <Mono>{`${row.route.serviceKey}:${row.route.targetPort}`}</Mono> },
    { header: 'TLS / resolver', key: 'tls', render: (row) => row.route.tls === 'off' ? 'Off' : `${row.route.tls}${row.route.resolver ? ` · ${row.route.resolver}` : ''}` },
    { header: 'Status', key: 'status', render: (row) => <StatusDot tone={row.status === 'enabled' || row.status === 'healthy' ? 'success' : row.status.includes('fail') ? 'danger' : 'warning'}>{capitalize(row.status)}</StatusDot> },
  ]
  return (
    <Rows>
      <Tabs label="Route protocol" onChange={setProtocol} options={['all', 'http', 'tcp', 'udp'].map((value) => ({ label: value === 'all' ? 'All' : value.toUpperCase(), value }))} value={protocol} />
      <MetricGrid columns={5}>
        <Metric label="Observed routes" value={String(routes.length)} />
        <Metric label="Enabled" tone="success" value={String(routes.filter((row) => row.route.enabled).length)} />
        <Metric label="Public routes" value={String(routes.filter((row) => row.route.scope !== 'internal').length)} />
        <Metric label="Runtime failures" tone={routes.some((row) => row.status.includes('fail')) ? 'danger' : 'success'} value={String(routes.filter((row) => row.status.includes('fail')).length)} />
        <Metric label="Certificates expiring" tone={expiring.length ? 'warning' : 'success'} value={String(expiring.length)} />
      </MetricGrid>
      <Columns template="two-thirds">
        <Panel flush title="Routes">
          <DataTable columns={routeColumns} empty={<EmptyState description="Declare a typed route for a reviewed service to make it visible here." icon="external" title="No routes" />} rowKey={(row) => row.route.key} rows={filtered} summary={`Showing ${filtered.length} of ${routes.length} routes`} />
        </Panel>
        <Rows gap="md">
          <Panel title={selected ? `Route · ${selected.route.serviceKey}` : 'Route diagnosis'}>
            {selected ? <Facts columns={1} items={[
              { label: 'Declaration', value: selected.declaration.role },
              { label: 'Protocol', value: selected.route.protocol.toUpperCase() },
              { label: 'Scope', value: selected.route.scope },
              { label: 'Entrypoints', value: selected.runtime?.entryPoints?.join(', ') || 'Not observed' },
              { label: 'Router', mono: true, value: selected.runtime?.router || 'Not observed' },
              { label: 'Backend', mono: true, value: `${selected.route.serviceKey}:${selected.route.targetPort}` },
              { label: 'Runtime', value: selected.runtime?.state || selected.status },
            ]} /> : <Body size="sm">Select a route to inspect its structural and runtime evidence.</Body>}
          </Panel>
          <Panel title={`Certificates (${certificates.length})`}>
            {certificates.length ? <Rows gap="tight">{certificates.slice(0, 4).map((certificate) => <StatusDot key={certificate.routeKey} tone={certificate.handshakeValid ? 'success' : 'warning'}>{certificate.domains.join(', ') || certificate.routeKey}</StatusDot>)}</Rows> : <Body size="sm">No TLS certificate is currently observed.</Body>}
          </Panel>
        </Rows>
      </Columns>
      <Columns template="thirds">
        <Panel title="Traffic by protocol"><Facts items={['http', 'tcp', 'udp'].map((value) => ({ label: value.toUpperCase(), value: String(routes.filter((row) => row.route.protocol === value).length) }))} /></Panel>
        <Panel title="Prometheus targets"><Facts items={[{ label: 'Collected', value: prometheus?.collected ? 'Yes' : 'No' }, { label: 'Targets', value: String(prometheus?.targets?.length ?? 0) }, { label: 'Failing', value: String(failingTargets) }]} /></Panel>
        <Panel title="Internal dependency routes">{state.bindings.length ? <Rows gap="tight">{state.bindings.map((binding) => <StatusDot key={`${binding.callerService}-${binding.targetRoute}`} tone="success">{binding.callerService} → {binding.targetRoute}</StatusDot>)}</Rows> : <Body size="sm">No managed east-west binding is declared.</Body>}</Panel>
      </Columns>
    </Rows>
  )
}
