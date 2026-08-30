import { Body, Button, Caveat, Columns, EvidenceLedger as Ledger, Label, Panel, Stack } from '@nim.zone/ui'
import type { Node, ObservabilityStatus, Overview, TraefikStatus } from '../../data/types'

/** One row of either column.
 *
 *  `source` on the measured side names what produced the figure; `why` on the
 *  other names what is missing. They are different questions and the component
 *  keeps them apart rather than sharing a vague "detail". */
interface Reading {
  label: string
  value: string
  source: string
}

interface Absence {
  label: string
  value: string
  why: string
}

/** An action that converts an absence into a measurement. */
interface Closer {
  title: string
  detail: string
  cta: string
  page: string
}

function probeCoverage(nodes: Node[]): { healthy: number; total: number; complete: boolean } {
  const healthy = nodes.filter((node) => node.agent.healthy).length
  return { healthy, total: nodes.length, complete: nodes.length > 0 && healthy === nodes.length }
}

/**
 * The command centre, arranged as the distinction the codebase already makes.
 *
 * The dashboard this replaces stated its evidence rules in panel prose — that
 * memory stays unqualified without a full probe, that CPU use is not inferred
 * from load average — while presenting every figure in one undifferentiated
 * grid. Here the distinction IS the layout: measured on the left with its
 * source named, not-evidence on the right with the reason, excluded from every
 * figure beside it.
 *
 * The right column is not a failure state. On a fresh install it is longer than
 * the left, and that is the honest first impression of a cluster nobody has
 * instrumented yet.
 */
export function EvidenceLedger({
  observability,
  onOpen,
  overview,
  traefik,
}: {
  observability: ObservabilityStatus
  onOpen?: (page: string) => void
  overview: Overview
  traefik: TraefikStatus
}) {
  const { nodes, services, summary } = overview
  const probes = probeCoverage(nodes)
  const desired = services.reduce((total, service) => total + service.desiredTasks, 0)
  const running = services.reduce((total, service) => total + service.runningTasks, 0)

  const swarm = 'Docker Swarm manager'
  const measured: Reading[] = [
    { label: 'Nodes ready', value: `${summary.readyNodes}/${summary.nodes}`, source: swarm },
    { label: 'Task coverage', value: desired === 0 ? '—' : `${running}/${desired}`, source: swarm },
    { label: 'CPU capacity', value: `${summary.totalCpu.capacity}`, source: 'declared cores, not use' },
  ]
  const absent: Absence[] = [
    { label: 'CPU utilisation', value: '—', why: 'load average is not utilisation, and SwarmOps will not present it as one' },
  ]

  // Memory and disk are evidence only with complete probe coverage. This is the
  // rule the old dashboard stated in prose and did not enforce in its layout.
  if (probes.complete) {
    measured.push(
      { label: 'Memory used', value: `${Math.round(summary.totalMemory.percent)}%`, source: `${probes.healthy} read-only host probes` },
      { label: 'Root disk used', value: `${Math.round(summary.totalDisk.percent)}%`, source: `${probes.healthy} read-only host probes` },
    )
  } else {
    const why = `${probes.healthy} of ${probes.total} hosts report a probe, so a cluster figure would average over hosts that never answered`
    absent.push(
      { label: 'Memory used', value: '—', why },
      { label: 'Root disk used', value: '—', why },
    )
  }

  const closers: Closer[] = []
  // Two collectors, each with its own installed/healthy pair. Installed but
  // unhealthy is still not evidence: a collector that is present and not
  // answering produces silence, not data, and the difference matters to
  // whoever is deciding whether to trust the figure.
  if (!observability.coreInstalled) {
    absent.push({ label: 'Metrics history', value: 'absent', why: 'the metrics collector is not installed' })
    closers.push({ title: 'Install the metrics collector', detail: 'Turns cluster history from absent into a measured series.', cta: 'Open Collectors', page: 'platform' })
  } else if (!observability.coreHealthy) {
    absent.push({ label: 'Metrics history', value: 'stale', why: 'the metrics collector is installed but not answering' })
    closers.push({ title: 'Repair the metrics collector', detail: 'It is installed and silent, which reads as no data rather than as a fault.', cta: 'Open Collectors', page: 'platform' })
  }
  if (!observability.logsEnabled) {
    absent.push({ label: 'Log retention', value: 'unknown', why: 'no log collector is enrolled' })
    closers.push({ title: 'Enrol the log collector', detail: 'Gives retention a number instead of a shrug.', cta: 'Open Collectors', page: 'platform' })
  } else if (!observability.logsHealthy) {
    absent.push({ label: 'Log retention', value: 'stale', why: 'the log collector is enrolled but not answering' })
  }
  if (!probes.complete && probes.total > 0) {
    closers.push({
      title: `Connect ${probes.total - probes.healthy} host probe${probes.total - probes.healthy === 1 ? '' : 's'}`,
      detail: 'Memory and disk become cluster figures once every host answers.',
      cta: 'Open Servers',
      page: 'machines',
    })
  }
  if (!traefik.service) {
    absent.push({ label: 'Certificate expiry', value: 'external', why: 'no gateway managed by SwarmOps is issuing them' })
  }

  return (
    <>
      <Panel
        description="Everything on the left is measured, with the thing that produced it named. Everything on the right is not yet evidence — shown so the gap is visible, never averaged into the figures beside it."
        title="Cluster state"
      >
        <Ledger
          absent={absent.map((row) => ({ label: row.label, value: row.value, why: row.why }))}
          coverage={`${probes.healthy}/${probes.total} probes healthy`}
          measured={measured.map((row) => ({ label: row.label, source: row.source, value: row.value }))}
        />
      </Panel>

      {closers.length ? (
        <Panel description="Each of these turns a right-hand row into a left-hand one." title="Close the gap">
          {/* Kit composition rather than a local grid: Columns for the row,
              Stack for each entry's rhythm. The bespoke CSS this replaces was
              deleted when the ledger moved into the kit and never restored, so
              title, detail and action sat flush against each other. */}
          <Columns align="start">
            {closers.map((closer) => (
              <Stack gap="tight" key={closer.title}>
                <Label as="p">{closer.title}</Label>
                <Body size="sm">{closer.detail}</Body>
                <div>
                  <Button onClick={() => onOpen?.(closer.page)} size="sm" variant="secondary">{closer.cta}</Button>
                </div>
              </Stack>
            ))}
          </Columns>
        </Panel>
      ) : (
        <Caveat title="Nothing is unmeasured">
          Every figure above has a source. That is unusual, and it is worth keeping — a cluster whose
          instrumentation lapses starts producing confident numbers with nothing behind them.
        </Caveat>
      )}
    </>
  )
}
