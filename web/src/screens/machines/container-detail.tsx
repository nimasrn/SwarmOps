import { useState } from 'react'
import {
  Banner,
  Body,
  Button,
  Columns,
  Facts,
  Inline,
  Metric,
  MetricGrid,
  Mono,
  Page,
  Panel,
  DetailHeader,
  Stack as Rows,
  StatusDot,
  Tabs,
} from '@nim.zone/ui'
import type { ContainerDetail, ContainerStats, Node } from '../../data/types'
import { capitalize, formatBytes, formatDateTime, formatDuration, shortID } from '../../lib/format'

/**
 * One container, on one node.
 *
 * Every tab here reports what the Engine said and nothing else. The two places
 * an operator expects more — a live log stream and a route claim — say plainly
 * that this controller does not proxy them, because a panel that quietly showed
 * nothing would be read as "there is nothing", which is a different and false
 * statement.
 */
export function ContainerDetailView({
  container,
  node,
  onBack,
  onOpenLogs,
  onRestart,
  onStop,
  busy,
  stats,
}: {
  busy: boolean
  container: ContainerDetail
  node: Node
  onBack: () => void
  onOpenLogs: () => void
  onRestart: () => void
  onStop: () => void
  stats: ContainerStats | null
}) {
  const [tab, setTab] = useState('overview')
  const name = container.Name.replace(/^\//, '')
  const uptime = stats
    ? Math.max(0, (Date.now() - new Date(container.State.StartedAt ?? container.Created).getTime()) / 1000)
    : 0

  return (
    <Page width="full">
      <DetailHeader
        actions={
          <Inline>
            <Button onClick={onOpenLogs} variant="ghost">Open in Logs</Button>
            <Button disabled={busy} loading={busy} onClick={onRestart} variant="secondary">Restart container</Button>
            <Button disabled={busy} onClick={onStop} variant="danger">Stop container</Button>
          </Inline>
        }
        back={{ label: node.hostname, onClick: onBack }}
        meta={
          <Inline>
            <Mono>{shortID(container.Id)}</Mono>
            <StatusDot tone={container.State.Running ? 'success' : 'warning'}>{capitalize(container.State.Status)}</StatusDot>
            <span>Node <strong>{node.hostname}</strong></span>
          </Inline>
        }
        subtitle={
          <Inline>
            <span>Image <Mono>{container.Config.Image ?? container.Image}</Mono></span>
            <span>Uptime {formatDuration(uptime)}</span>
          </Inline>
        }
        title={name}
      />

      <Tabs
        label="Container views"
        onChange={setTab}
        options={[
          { label: 'Overview', value: 'overview' },
          { label: 'Metrics', value: 'metrics' },
          { label: 'Logs', value: 'logs' },
          { label: 'Network', value: 'network' },
          { label: 'Inspect', value: 'inspect' },
          { label: 'Activity', value: 'activity' },
        ]}
        value={tab}
      />

      {tab === 'overview' || tab === 'metrics' ? (
        <>
          <MetricGrid columns={4}>
            <Metric hint="One Engine sample" icon="activity" label="CPU" source={stats ? 'docker stats' : undefined} unmeasured={!stats} value={stats ? `${stats.cpuPercent.toFixed(2)}%` : 'no sample'} />
            <Metric hint={stats?.memoryLimitBytes ? `of ${formatBytes(stats.memoryLimitBytes)}` : 'No limit reported'} icon="activity" label="Memory" source={stats ? 'docker stats' : undefined} unmeasured={!stats} value={stats ? formatBytes(stats.memoryUsedBytes) : 'no sample'} />
            <Metric hint={stats ? `${formatBytes(stats.networkTxBytes)} egress` : undefined} icon="cloud" label="Network ingress" source={stats ? 'docker stats' : undefined} unmeasured={!stats} value={stats ? formatBytes(stats.networkRxBytes) : 'no sample'} />
            <Metric hint="Engine restart counter" icon="refresh" label="Restart count" value={String(container.RestartCount)} />
          </MetricGrid>
          <Columns template="aside">
            <Rows gap="md">
              <Columns template="one-third">
                <Panel title="Health & placement">
                  <Facts columns={1} items={[
                    { label: 'Health check', value: container.State.Health?.Status ?? 'Not configured' },
                    { label: 'State', value: container.State.Status },
                    { label: 'Node', value: node.hostname },
                    { label: 'Started', value: formatDateTime(container.State.StartedAt) },
                    { label: 'Restart policy', value: container.HostConfig.RestartPolicy?.Name || 'Not set' },
                  ]} />
                </Panel>
                <Panel title="Routes & ports">
                  <Body size="sm" tone="muted">Published port and route evidence is shown in Traffic. This inspect payload does not claim an application route.</Body>
                </Panel>
              </Columns>
              <Panel title="Recent activity">
                <Facts items={[
                  { label: 'Created', value: formatDateTime(container.Created) },
                  { label: 'Started', value: formatDateTime(container.State.StartedAt) },
                  { label: 'Restarts', value: String(container.RestartCount) },
                  { label: 'Last sample', value: stats ? formatDateTime(stats.sampledAt) : 'never' },
                ]} />
              </Panel>
            </Rows>
            <Rows gap="md">
              <Panel title="Container inspector">
                <Facts columns={1} items={[
                  { label: 'Image', mono: true, value: container.Config.Image ?? container.Image },
                  { label: 'Entrypoint', mono: true, value: container.Path || 'Not set' },
                  { label: 'Command', mono: true, value: container.Args?.join(' ') || 'Not set' },
                  { label: 'Labels', value: String(Object.keys(container.Config.Labels ?? {}).length) },
                  { label: 'Mounts', value: String(container.Mounts?.length ?? 0) },
                  { label: 'Network mode', value: container.HostConfig.NetworkMode || 'Not set' },
                  { label: 'Docker health', value: container.State.Health?.Status ?? (container.State.Running ? 'Running' : 'Stopped') },
                ]} />
              </Panel>
              <Panel title="Telemetry">
                <Body size="sm">Metrics are sampled from Docker. Logs and traces remain source-labeled under Observe and are never fabricated when collectors are absent.</Body>
              </Panel>
            </Rows>
          </Columns>
        </>
      ) : tab === 'logs' ? (
        <Panel actions={<Button onClick={onOpenLogs} size="sm" variant="secondary">Open Logs</Button>} title="Logs">
          <Banner tone="info">Use Observe → Logs for collected records. This controller does not proxy unrestricted container streams.</Banner>
        </Panel>
      ) : tab === 'network' ? (
        <Panel title="Network">
          <Facts items={[
            { label: 'Mode', mono: true, value: container.HostConfig.NetworkMode || 'Not set' },
            { label: 'Ingress sample', value: stats ? formatBytes(stats.networkRxBytes) : 'no sample' },
            { label: 'Egress sample', value: stats ? formatBytes(stats.networkTxBytes) : 'no sample' },
          ]} />
        </Panel>
      ) : tab === 'inspect' ? (
        <Panel title="Inspect">
          <Facts items={[
            { label: 'Container ID', mono: true, value: container.Id },
            { label: 'Image ID', mono: true, value: container.Image },
            { label: 'Environment names', value: container.Config.EnvNames?.join(', ') || 'None' },
            { label: 'Privileged', value: container.HostConfig.Privileged ? 'Yes' : 'No' },
          ]} />
        </Panel>
      ) : (
        <Panel title="Activity">
          <Facts items={[
            { label: 'Created', value: formatDateTime(container.Created) },
            { label: 'Started', value: formatDateTime(container.State.StartedAt) },
            { label: 'Finished', value: formatDateTime(container.State.FinishedAt) },
            { label: 'Restarts', value: String(container.RestartCount) },
          ]} />
        </Panel>
      )}
    </Page>
  )
}
