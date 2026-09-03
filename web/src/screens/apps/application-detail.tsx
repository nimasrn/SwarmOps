import { useState } from 'react'
import { Body, Button, Columns, DetailHeader, DetailLayout, Facts, IconButton, Inline, List, ListRow, Mono, Page, Panel, Select, Stack as Rows, StatusDot, Tabs } from '@nim.zone/ui'
import type { ApplicationStatus, Command } from '../../data/types'
import { MetricChart } from '../../components/metric-chart'
import { StatusBadge, CommandStateBadge } from '../../components/badges'
import { capitalize } from '../../lib/format'
import { pageEntry, workspaceHash } from '../../navigation/navigation'
import { useRecordView } from '../../navigation/use-workspace'

/** The API supplies aggregate counts, not individual replica health or release
 * history. This view never invents either from those counts. */
export function ApplicationDetailView({ onBack, onDeploy, onOpenRoutes, status, commands = [] }: {
  onBack: () => void
  onDeploy: () => void
  onOpenRoutes: () => void
  status: ApplicationStatus
  commands?: Command[]
}) {
  const [tab, setTab] = useRecordView()
  const [inspector, setInspector] = useState(true)
  const [windowSeconds, setWindowSeconds] = useState(21_600)
  const healthy = status.deployed && status.runningTasks >= status.spec.replicas
  const relatedRuns = commands.filter(command => command.target === `application/${status.spec.name}` && (command.action === 'application.deploy' || command.action === 'source.deploy')).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
  const tabs = pageEntry('applications').views!.map(value => ({ value, label: capitalize(value) }))
  const configuration = [
    { label: 'Image', mono: true, value: status.spec.image },
    { label: 'Desired replicas', value: String(status.spec.replicas) },
    { label: 'Running tasks', value: String(status.runningTasks), source: 'Selected manager snapshot' },
    { label: 'CPU limit / replica', value: `${status.spec.cpus} vCPU` },
    { label: 'Memory limit / replica', value: `${status.spec.memoryMiB} MiB` },
    { label: 'Container port', value: String(status.spec.port) },
    { label: 'Health path', mono: true, value: status.spec.healthPath || 'Not declared' },
    { label: 'Credential delivery', value: capitalize(status.spec.databaseDelivery ?? 'secret') },
  ]
  return <Page width="full">
    <DetailHeader
      title={status.spec.name}
      subtitle={status.url ? `Serving at ${status.url}` : 'Reachable inside the cluster only.'}
      back={{ label: 'Applications', onClick: onBack }}
      status={<StatusBadge health={!status.deployed ? 'unknown' : healthy ? 'healthy' : 'degraded'} />}
      actions={<Button iconStart="play" onClick={onDeploy} variant="accent">Deploy new version</Button>}
      meta={<Inline><span>{status.runningTasks} / {status.spec.replicas} running</span><Mono>{status.spec.image}</Mono><IconButton name="inspector" label={inspector ? 'Hide inspector' : 'Show inspector'} aria-pressed={inspector} onClick={() => setInspector(value => !value)} variant="ghost" /></Inline>}
    />
    <Tabs label="Application views" options={tabs} value={tab} onChange={setTab} panelId="application-view" />
    <div id="application-view" role="tabpanel" aria-labelledby={`application-view-tab-${tab}`}>
      <DetailLayout aside={inspector ? <Rows>
        <Panel variant="plain" title="Application"><Facts columns={1} items={[
          { label: 'Name', value: status.spec.name },
          { label: 'Stack', value: status.stack },
          { label: 'Container port', value: String(status.spec.port) },
          { label: 'Health path', mono: true, value: status.spec.healthPath || 'Not declared' },
          { label: 'Metrics', value: status.spec.metrics ? 'Enabled' : 'Disabled' },
          { label: 'Tracing', value: status.spec.tracing ? 'Enabled' : 'Disabled' },
        ]} /></Panel>
        <Panel variant="plain" title="Related objects"><List plain>
          <ListRow title="Gateway routes" onClick={onOpenRoutes} />
          {relatedRuns[0] ? <ListRow title="Latest run" href={workspaceHash('runs', relatedRuns[0].id)} /> : null}
          {status.url ? <ListRow title="Open application" href={status.url} /> : null}
        </List></Panel>
      </Rows> : undefined}>
        {tab === 'overview' || tab === 'traffic' ? <Rows>
          <Panel variant="plain" title="Traffic performance" actions={<Select aria-label="Metric time range" options={[{ label: '1 hour', value: '3600' }, { label: '6 hours', value: '21600' }, { label: '24 hours', value: '86400' }]} value={String(windowSeconds)} onChange={event => setWindowSeconds(Number(event.target.value))} />}>
            <Columns>
              <MetricChart query={{ application: status.spec.name, scope: 'application', series: 'requests', windowSeconds }} refreshMs={30_000} title="Requests" />
              <MetricChart query={{ application: status.spec.name, scope: 'application', series: 'errors', windowSeconds }} refreshMs={30_000} title="Failing requests" />
            </Columns>
          </Panel>
          {tab === 'overview' ? <Panel variant="plain" title="Current release" actions={relatedRuns[0] ? <Button href={workspaceHash('runs', relatedRuns[0].id)} variant="ghost" size="sm">Inspect run</Button> : undefined}>
            <Inline><Mono>{status.spec.image}</Mono><StatusDot tone={healthy ? 'success' : 'warning'}>{status.deployed ? `${status.runningTasks} of ${status.spec.replicas} tasks running` : 'Not deployed'}</StatusDot></Inline>
            <Body size="sm" tone="muted">Desired configuration and aggregate task counts from the selected manager. Individual health is not inferred.</Body>
          </Panel> : <Panel variant="plain" title="Routing" actions={<Button onClick={onOpenRoutes} variant="secondary" size="sm">Open Routes</Button>}><Facts items={[
            { label: 'Hostname', value: status.spec.domain || 'Internal only' },
            { label: 'TLS resolver', value: status.spec.resolver || 'Not configured' },
            { label: 'Container port', value: String(status.spec.port) },
          ]} /></Panel>}
          <Panel variant="plain" title="Dependencies"><Facts items={[
            { label: 'Managed databases', value: status.spec.databases?.join(', ') || 'None declared' },
            { label: 'Backend', value: status.spec.backend || 'None declared' },
          ]} /></Panel>
        </Rows> : tab === 'releases' ? <Panel variant="plain" title="Release activity" description="Retained commands for this application; not a complete deployment history.">
          {relatedRuns.length ? <List plain>{relatedRuns.map(command => <ListRow key={command.id} title={command.action} subtitle={command.target} trailing={<CommandStateBadge state={command.state} />} href={workspaceHash('runs', command.id)} />)}</List> : <Body size="sm">No matching command is present in the retained window. The current image is <Mono>{status.spec.image}</Mono>.</Body>}
        </Panel> : <Panel variant="plain" title="Resources" description="Declared limits and aggregate counts. No per-replica health is fabricated."><Facts items={configuration} /></Panel>}
      </DetailLayout>
    </div>
  </Page>
}
