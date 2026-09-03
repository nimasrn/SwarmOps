import { Body, Facts, Icon, Metric, MetricGrid, Mono, Panel, StatusDot } from '@nim.zone/ui'
import type { Node, Overview } from '../../data/types'
import { formatBytes, formatNumber, shortID } from '../../lib/format'
import { capacityMeasured, hostProbeHealth, nodeHealth } from '../../lib/health'

/**
 * The cluster drawn as the path a scheduling decision takes: the manager, the
 * agent that answers for it, the quorum that authorises it, and the workers it
 * places onto.
 *
 * It is a picture because the question it answers — "is this one machine or
 * several, and which of them is in charge" — is spatial, and a table of node
 * rows answers it only after the reader has assembled the picture themselves.
 * Every node still states its condition in WORDS beside its colour: this
 * console's accent is green, so a green dot cannot be the claim.
 */
export function ClusterTopologyPanel({ nodes, overview }: { nodes: Node[]; overview: Overview }) {
  const manager = nodes.find((node) => node.manager?.leader) ?? nodes.find((node) => node.role === 'manager')
  const workers = nodes.filter((node) => node.id !== manager?.id)
  // The enrolled agent's connection is stated in the shell header. This dot is
  // the host probe, which can be absent on a cluster whose agent is connected,
  // so it says which of the two it is naming.
  const probe = manager ? hostProbeHealth(manager) : 'unknown'

  return (
    <Panel description="Read left to right: the manager, the host probe reporting for it, the quorum that authorises a change, and the workers it can place onto." flush title="Cluster topology">
      <div className="nim-cluster-topology__body">
        <div className="nim-cluster-topology__flow">
          <div className="nim-cluster-topology__node">
            <Icon name="server" size="lg" tone={manager ? 'success' : 'warning'} />
            <span className="nim-cluster-topology__node-copy">
              <strong>{manager?.hostname ?? 'No manager'}</strong>
              <Mono>{manager?.address ?? 'Manager required'}</Mono>
            </span>
          </div>
          <span aria-hidden="true" className="nim-cluster-topology__connector" />
          <div className="nim-cluster-topology__state">
            <StatusDot tone={probe === 'healthy' ? 'success' : probe === 'degraded' ? 'warning' : 'neutral'}>
              {probe === 'healthy' ? 'Host probe reporting' : probe === 'degraded' ? 'Host probe unreachable' : 'Host probe not installed'}
            </StatusDot>
          </div>
          <span aria-hidden="true" className="nim-cluster-topology__connector" />
          <div className="nim-cluster-topology__state">
            <StatusDot tone={overview.summary.managers ? 'success' : 'warning'}>Quorum {overview.summary.managers} / {overview.summary.managers}</StatusDot>
          </div>
          <span aria-hidden="true" className="nim-cluster-topology__connector" />
          <div className="nim-cluster-topology__workers">
            {workers.map((node) => (
              <div className="nim-cluster-topology__node" key={node.id}>
                <Icon name="server" size="sm" tone={nodeHealth(node) === 'healthy' ? 'success' : 'danger'} />
                <span className="nim-cluster-topology__node-copy">
                  <strong>{node.hostname}</strong>
                  <Mono>{node.address ?? shortID(node.id)}</Mono>
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="nim-cluster-topology__summary">
          <Facts columns={1} items={[
            { label: 'Swarm', value: overview.summary.managers ? 'Active' : 'Unavailable' },
            { label: 'Managers', value: String(overview.summary.managers) },
            { label: 'Workers', value: String(Math.max(0, overview.summary.nodes - overview.summary.managers)) },
            { label: 'Nodes', value: String(overview.summary.nodes) },
          ]} />
        </div>
      </div>
      <div className="nim-cluster-topology__capacity">
        <Body size="sm">Fleet capacity</Body>
        <MetricGrid columns={6} dense>
          <Metric label="CPU cores" value={formatNumber(overview.summary.totalCpu.capacity)} />
          <Metric label="Memory" value={formatBytes(overview.summary.totalMemory.capacity)} />
          <Metric label="Disk" value={capacityMeasured(overview.summary.totalDisk) ? formatBytes(overview.summary.totalDisk.capacity) : 'Unmeasured'} />
          <Metric label="Nodes" value={String(overview.summary.nodes)} />
          <Metric label="Services" value={String(overview.summary.services)} />
          <Metric label="Running tasks" value={String(overview.summary.runningTasks)} />
        </MetricGrid>
      </div>
    </Panel>
  )
}
