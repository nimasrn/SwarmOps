import { useCallback, useEffect, useState } from 'react'
import {
  Banner,
  Body,
  Chart,
  Columns,
  Facts,
  Panel,
  ResourceMeter,
  Spinner,
  Stack as Rows,
} from '@nim.zone/ui'
import { api } from '../../data/api'
import type { Insights, InsightsSample } from '../../data/types'
import { formatBytes, formatTime } from '../../lib/format'
import { messageOf } from '../../lib/errors'
import { MetricChartGrid } from '../../components/metric-chart'

/**
 * What the whole cluster has been doing, as opposed to what it is doing now.
 *
 * These readings — the once-a-minute controller sample, its retained history,
 * and the `cluster` metric scope — were served by the controller and drawn
 * nowhere. They lived on an Insights screen that no route reached: the six-area
 * rebuild retired the Observe area on the grounds that a fleet-wide chart
 * cannot answer "for which node?", pointed `#insights` at the overview, and
 * left the screen itself behind with its four endpoints attached.
 *
 * The rule that retired it is right, and this is what it actually implies: a
 * reading about the CLUSTER belongs on the screen about the cluster. Home is
 * that screen. Per-node and per-container readings stay on the node and the
 * container, where they can name their object.
 */
export function ProductionTrend() {
  const [insights, setInsights] = useState<Insights | null>(null)
  const [history, setHistory] = useState<InsightsSample[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [reading, samples] = await Promise.all([api.insights(), api.insightsHistory()])
      setInsights(reading)
      setHistory(samples ?? [])
    } catch (reason) {
      setError(messageOf(reason))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  if (loading && !insights) {
    return <Panel title="Production over time"><Spinner label="Reading the controller's retained samples" /></Panel>
  }
  if (error && !insights) {
    return <Panel title="Production over time"><Banner tone="warning" title="The cluster sample is unavailable">{error}</Banner></Panel>
  }
  if (!insights) return null

  // One reading a minute, so the axis is the sample clock rather than an
  // invented one. A single point draws nothing useful, so the charts wait.
  const times = history.map((sample) => formatTime(sample.at))
  const charted = history.length > 1

  return (
    <Rows gap="md">
      {error ? <Banner tone="warning" title="Some readings are stale">{error}</Banner> : null}

      <Columns>
        <Panel
          caption={charted ? `${history.length} samples` : undefined}
          description="Sampled once a minute by the selected manager since this controller started. A rising desired line with a flat running line means Swarm is asking for work it cannot place."
          title="Tasks and containers"
        >
          {charted ? (
            <Chart
              categories={times}
              format={(value) => String(Math.round(value))}
              height={200}
              kind="line"
              legend
              series={[
                { label: 'Tasks running', values: history.map((sample) => sample.tasksRunning) },
                { label: 'Tasks desired', values: history.map((sample) => sample.tasksDesired) },
                { label: 'Containers running', values: history.map((sample) => sample.containersRunning) },
              ]}
              title="Tasks and containers"
            />
          ) : (
            <Body size="sm" tone="muted">
              The controller takes one reading a minute and has taken {history.length}. A trend line appears once a second
              reading exists; this is a statement about the sample count, not about the cluster.
            </Body>
          )}
        </Panel>

        <Panel
          description="A rising failed-task line beside a flat running line means Swarm is restarting work it cannot place."
          title="Failures and degradation"
        >
          {charted ? (
            <Chart
              categories={times}
              format={(value) => String(Math.round(value))}
              height={200}
              kind="area"
              legend
              series={[
                { label: 'Tasks failed', values: history.map((sample) => sample.tasksFailed) },
                { label: 'Services degraded', values: history.map((sample) => sample.servicesDegraded) },
                { label: 'Containers unhealthy', values: history.map((sample) => sample.containersUnhealthy) },
              ]}
              title="Failures and degradation"
            />
          ) : (
            <Body size="sm" tone="muted">Fault history appears once a second sample exists.</Body>
          )}
        </Panel>
      </Columns>

      {/* The `cluster` metric scope — seven series the controller has always
          answered and no screen had ever asked for. Unlike the samples above
          these come from Prometheus, so they say so and stay absent rather
          than drawing a flat line when no collector is deployed. */}
      <Panel
        description="Measured by Prometheus across every reporting machine. Absent, rather than zero, when no collector is deployed."
        title="The fleet, measured"
      >
        <MetricChartGrid
          lead={['cpu', 'memory', 'machines', 'containers', 'network-rx', 'network-tx']}
          query={{ scope: 'cluster' }}
          refreshMs={60_000}
        />
      </Panel>

      <Panel description="Counted from the selected manager's own last sample." title="What the cluster has">
        <Columns template="aside">
          <Facts items={[
            { label: 'CPU cores', value: String(insights.capacity.cpuCores) },
            { label: 'Memory', value: formatBytes(insights.capacity.memoryBytes) },
            { label: 'Overlay networks', value: `${insights.networks.overlay} of ${insights.networks.total}` },
            { label: 'Secrets / configs', value: `${insights.secrets} / ${insights.configs}` },
            { label: 'Retained samples', value: `${history.length} in memory` },
          ]} />
          {insights.capacity.diskBytes ? (
            <ResourceMeter
              detail="Reported by nodes running the machine agent; nodes without one contribute no figure"
              label="Fleet disk"
              percent={Math.round((insights.capacity.diskUsedBytes / insights.capacity.diskBytes) * 100)}
              value={`${formatBytes(insights.capacity.diskUsedBytes)} / ${formatBytes(insights.capacity.diskBytes)}`}
            />
          ) : (
            <Body size="sm" tone="muted">Disk capacity is reported by the machine agent. No node reported one, so no fleet figure is shown.</Body>
          )}
        </Columns>
      </Panel>
    </Rows>
  )
}
