import { useState } from 'react'
import {
  Badge,
  Banner,
  Button,
  Columns,
  DataTable,
  EmptyState,
  Facts,
  Mono,
  Panel,
  Stack as Rows,
  useToast,
} from '@nim.zone/ui'
import type { TableColumn } from '@nim.zone/ui'
import { api } from '../../data/api'
import type { CertificateStatus, RouteInventoryRow } from '../../data/types'
import { formatDateTime } from '../../lib/format'
import { messageOf } from '../../lib/errors'
import { queuedToast } from './lib'

type Toast = ReturnType<typeof useToast>

export function CertificatesTab({ certificates, onQueued, routes, toast }: { certificates: CertificateStatus[]; onQueued: () => void; routes: RouteInventoryRow[]; toast: Toast }) {
  const [pending, setPending] = useState('')
  const eligible = routes.filter((row) => row.route.enabled && row.route.tls === 'terminate' && row.route.scope !== 'internal' && row.route.protocol !== 'udp')
  const byRoute = new Map(certificates.map((certificate) => [certificate.routeKey, certificate]))
  const retry = async (key: string) => {
    setPending(key)
    try {
      const command = await api.retryTraefikCertificate(key)
      queuedToast(toast, command, 'Safe certificate retry')
      onQueued()
    } catch (reason) { toast({ message: messageOf(reason), tone: 'danger', duration: 0 }) } finally { setPending('') }
  }
  const columns: TableColumn<RouteInventoryRow>[] = [
    { header: 'Domain', key: 'domain', render: (row) => <Mono>{[...(row.route.match.hosts ?? []), ...(row.route.match.sni ?? [])].join(', ')}</Mono> },
    { header: 'Resolver', key: 'resolver', render: (row) => row.route.resolver || 'None configured' },
    { header: 'State', key: 'state', render: (row) => { const value = byRoute.get(row.route.key); return <Badge dot variant={value?.handshakeValid ? 'success' : value?.state === 'failed' ? 'danger' : 'warning'}>{value?.state ?? 'not observed'}</Badge> } },
    { header: 'Expires', key: 'expires', render: (row) => formatDateTime(byRoute.get(row.route.key)?.notAfter) },
    { header: 'Last attempt', key: 'attempt', render: (row) => formatDateTime(byRoute.get(row.route.key)?.lastAttempt) },
    { header: 'Action', key: 'action', render: (row) => <Button disabled={Boolean(pending)} loading={pending === row.route.key} onClick={() => void retry(row.route.key)} size="sm" variant="secondary">Safe retry</Button> },
  ]
  return (
    <Rows>
      <Banner title="Retry never deletes ACME storage" tone="info">SwarmOps reruns DNS, port, and credential preflight, creates a temporary lower-priority trigger router, then checks bounded logs and a real TLS handshake. Traefik remains responsible for renewal.</Banner>
      <Panel flush><DataTable caption="TLS certificate status" columns={columns} empty={<EmptyState description="Enable a public TLS-terminating HTTP or TCP route to request and observe a certificate." icon="shield" title="No certificate routes" />} rowKey={(row) => row.route.key} rows={eligible} /></Panel>
      <Columns>
        {eligible.map((row) => {
          const certificate = byRoute.get(row.route.key)
          return <Panel eyebrow={row.route.key} key={row.route.key} title={(row.route.match.hosts ?? row.route.match.sni ?? []).join(', ')}><Facts items={[{ label: 'Issuer', value: certificate?.issuer ?? 'Not observed' }, { label: 'SANs', mono: true, value: certificate?.domains?.join(', ') || 'None issued' }, { label: 'Fingerprint', mono: true, value: certificate?.fingerprint || 'None issued' }, { label: 'Valid from', value: formatDateTime(certificate?.notBefore) }, { label: 'Valid until', value: formatDateTime(certificate?.notAfter) }, { label: 'Handshake', value: certificate?.handshakeValid ? 'Validated' : 'Not validated' }]} />{certificate?.failureSummary ? <Banner title="Last failure" tone="danger">{certificate.failureSummary}</Banner> : null}</Panel>
        })}
      </Columns>
    </Rows>
  )
}
