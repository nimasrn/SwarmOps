import { useState } from 'react'
import {
  Body,
  Button,
  Columns,
  DetailHeader,
  Facts,
  Inline,
  Metric,
  MetricGrid,
  Mono,
  Page,
  Panel,
  Stack as Rows,
  StatusDot,
  Table,
  Tabs,
} from '@nim.zone/ui'
import type { TableColumn } from '@nim.zone/ui'
import type { ApplicationStatus } from '../../data/types'
import { MetricChart } from '../../components/metric-chart'
import { capitalize } from '../../lib/format'
import { StatusBadge } from '../../components/badges'

/**
 * One deployed application, from the console's own point of view.
 *
 * Every figure here comes from the current manager snapshot, and the tabs that
 * do not yet have a bounded endpoint say so rather than rendering an empty
 * panel: a blank "Traces" tab is read as "there are no traces", which is a
 * claim this console has not earned.
 */
export function ApplicationDetailView({
  onBack,
  onDeploy,
  onOpenRoutes,
  status,
}: {
  onBack: () => void
  onDeploy: () => void
  onOpenRoutes: () => void
  status: ApplicationStatus
}) {
  const [tab, setTab] = useState('overview')
  const healthy = status.deployed && status.runningTasks >= status.spec.replicas
  const replicas = Array.from({ length: status.spec.replicas }, (_, index) => ({
    id: `${status.spec.name}-replica-${index + 1}`,
    replica: index + 1,
    state: index < status.runningTasks ? 'Running' : 'Pending',
  }))
  const version = status.spec.image.includes(':') ? status.spec.image.split(':').at(-1) ?? status.spec.image : status.spec.image

  const replicaColumns: TableColumn<(typeof replicas)[number]>[] = [
    { header: 'Replica', key: 'replica', render: (replica) => `Replica ${replica.replica}` },
    { header: 'State', key: 'state', render: (replica) => <StatusDot tone={replica.state === 'Running' ? 'success' : 'warning'}>{replica.state}</StatusDot> },
    { header: 'Health', key: 'health', render: (replica) => replica.state === 'Running' ? status.spec.healthPath ?? 'No probe declared' : 'Waiting for placement' },
    { header: 'Image', key: 'image', render: () => <Mono>{version}</Mono> },
  ]

  return (
    <Page width="full">
      <DetailHeader
        actions={
          <Inline>
            <Button iconStart="play" onClick={onDeploy} variant="accent">Deploy a new release</Button>
            {status.url ? <Button href={status.url} iconStart="external" target="_blank" variant="secondary">Open the application</Button> : null}
          </Inline>
        }
        back={{ label: 'Applications', onClick: onBack }}
        meta={
          <Inline>
            <span>Replicas {status.runningTasks} / {status.spec.replicas}</span>
            <span>Image <Mono>{version}</Mono></span>
            <span>{status.deployed ? 'Deployed by SwarmOps' : 'Not deployed'}</span>
          </Inline>
        }
        status={<StatusBadge health={healthy ? 'healthy' : 'degraded'} />}
        subtitle={status.url ? `Serving at ${status.url}` : 'Reachable inside the cluster only — no public hostname is assigned.'}
        title={status.spec.name}
      />

      <Tabs
        label="Application views"
        onChange={setTab}
        options={[
          { label: 'Overview', value: 'overview' },
          { label: 'Replicas', value: 'replicas' },
          { label: 'Routing', value: 'routing' },
          { label: 'Configuration', value: 'configuration' },
        ]}
        value={tab}
      />

      {tab === 'overview' ? (
        <>
          <MetricGrid columns={4}>
            <Metric hint={healthy ? 'Every desired replica is running' : 'Fewer replicas are running than desired'} icon="layers" label="Replica availability" tone={healthy ? 'success' : 'warning'} value={`${status.runningTasks} / ${status.spec.replicas}`} />
            <Metric hint="Per replica" icon="activity" label="CPU limit" value={`${status.spec.cpus} vCPU`} />
            <Metric hint="Per replica" icon="package" label="Memory limit" value={`${status.spec.memoryMiB} MiB`} />
            <Metric hint={status.spec.domain ? 'A public hostname routes to this application' : 'No public hostname is assigned'} icon="globe" label="Exposure" tone={status.spec.domain ? 'accent' : 'neutral'} value={status.spec.domain ? 'Public' : 'Internal'} />
          </MetricGrid>
          {/* Traffic is measured AT THE GATEWAY, not inside the application.
              An application that has stopped answering cannot report that it
              has stopped answering, so its own numbers are exactly the ones
              you cannot trust during an incident. */}
          <Columns>
            <MetricChart
              note="Reaching this application through the gateway"
              query={{ application: status.spec.name, scope: 'application', series: 'requests' }}
              refreshMs={30_000}
              title="Requests"
            />
            <MetricChart
              note="Responses the gateway recorded as failures"
              query={{ application: status.spec.name, scope: 'application', series: 'errors' }}
              refreshMs={30_000}
              title="Failing requests"
            />
          </Columns>
          <Columns template="two-thirds">
            <Rows gap="md">
              <Panel flush title={`Replicas · ${status.runningTasks} / ${status.spec.replicas} running`}>
                <Table columns={replicaColumns} rowKey={(replica) => replica.id} rows={replicas} />
              </Panel>
              <Panel description="Counted from the current manager snapshot, not from a release history this controller does not keep." flush title="Current release">
                <Table
                  columns={[
                    { header: 'Version', key: 'version', render: () => <Mono>{version}</Mono> },
                    { header: 'Status', key: 'status', render: () => <StatusDot tone={healthy ? 'success' : 'warning'}>{healthy ? 'Healthy' : 'Degraded'}</StatusDot> },
                    { header: 'Image', key: 'image', render: () => <Mono>{status.spec.image}</Mono> },
                  ]}
                  rowKey={() => status.spec.image}
                  rows={[status]}
                />
              </Panel>
            </Rows>
            <Rows gap="md">
              <Panel actions={<Button onClick={onOpenRoutes} size="sm" variant="ghost">Routes</Button>} title="Routing">
                <Facts columns={1} items={status.spec.domain ? [
                  { label: 'Type', value: 'HTTPS' },
                  { label: 'Hostname', mono: true, value: status.spec.domain },
                  { label: 'TLS resolver', value: status.spec.resolver ?? 'Managed default' },
                ] : [{ label: 'Exposure', value: 'Internal only' }]} />
              </Panel>
              <Panel title="Managed bindings">
                <Body size="sm">{status.spec.databases?.length ? status.spec.databases.join(', ') : status.spec.backend ? `Backend: ${status.spec.backend}` : 'No managed data or backend binding is declared.'}</Body>
              </Panel>
              <Panel title="Telemetry">
                <Facts columns={1} items={[
                  { label: 'Prometheus', value: status.spec.metrics ? `Enabled${status.spec.metricsPath ? ` · ${status.spec.metricsPath}` : ''}` : 'Disabled' },
                  { label: 'Jaeger', value: status.spec.tracing ? 'Enabled' : 'Disabled' },
                  { label: 'Logs', value: 'Collected by the shared Fluentd policy' },
                ]} />
              </Panel>
            </Rows>
          </Columns>
        </>
      ) : tab === 'replicas' ? (
        <Panel flush title={`Replicas · ${status.runningTasks} / ${status.spec.replicas} running`}>
          <Table columns={replicaColumns} rowKey={(replica) => replica.id} rows={replicas} />
        </Panel>
      ) : tab === 'routing' ? (
        <Panel actions={<Button onClick={onOpenRoutes} size="sm" variant="secondary">Open Routes</Button>} title="Routing">
          <Facts items={status.spec.domain ? [
            { label: 'Hostname', mono: true, value: status.spec.domain },
            { label: 'TLS resolver', value: status.spec.resolver ?? 'Managed default' },
            { label: 'Container port', value: String(status.spec.port) },
            { label: 'Health path', mono: true, value: status.spec.healthPath ?? 'Not declared' },
          ] : [
            { label: 'Exposure', value: 'Internal only' },
            { label: 'Container port', value: String(status.spec.port) },
          ]} />
        </Panel>
      ) : (
        <Panel description="The spec SwarmOps rendered this application from." title="Configuration">
          <Facts items={[
            { label: 'Image', mono: true, value: status.spec.image },
            { label: 'Replicas', value: String(status.spec.replicas) },
            { label: 'CPU', value: `${status.spec.cpus} vCPU` },
            { label: 'Memory', value: `${status.spec.memoryMiB} MiB` },
            { label: 'Container port', value: String(status.spec.port) },
            { label: 'Health path', mono: true, value: status.spec.healthPath ?? 'Not declared' },
            { label: 'Databases', value: status.spec.databases?.join(', ') || 'None' },
            { label: 'Credential delivery', value: capitalize(status.spec.databaseDelivery ?? 'secret') },
            { label: 'Stack', value: status.stack },
          ]} />
        </Panel>
      )}
    </Page>
  )
}
