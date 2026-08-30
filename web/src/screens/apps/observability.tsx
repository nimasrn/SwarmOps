import { useState } from 'react'
import {
  Banner,
  Body,
  Button,
  Columns,
  Inline,
  List,
  ListRow,
  Panel,
  Stack as Rows,
  Switch,
  TaskProgress,
  useToast,
} from '@nim.zone/ui'
import { api } from '../../data/api'
import type { Node, ObservabilityStatus, TraefikStatus } from '../../data/types'
import { shortID } from '../../lib/format'
import { messageOf } from '../../lib/errors'
import { ConfirmPhrase } from '../../components/confirm-phrase'

type Toast = ReturnType<typeof useToast>

/**
 * The pipeline that produces the evidence the rest of the console reads.
 *
 * Three deployments, deliberately separate, because they inspect different
 * amounts of the cluster: the core stack runs where it is placed, log
 * collection runs on every node, and the host probe reads a Docker socket and a
 * host root mount. The console asks for a typed confirmation in proportion to
 * that reach rather than treating all three as one switch.
 */
export function TelemetryTab({ nodes, onOpenGateway, onOpenSwarm, status, toast, traefik }: {
  nodes: Node[]
  onOpenGateway: () => void
  onOpenSwarm: () => void
  status: ObservabilityStatus
  toast: Toast
  traefik: TraefikStatus
}) {
  const [pending, setPending] = useState(false)
  const [logRemovalRequested, setLogRemovalRequested] = useState(false)

  const gatewayInstalled = Boolean(traefik.service)
  const statefulNodeReady = nodes.some((node) => node.state === 'ready' && node.availability === 'active' && node.labels?.['nim.stateful'] === 'true')
  const coreBlockers = [
    ...(!gatewayInstalled ? ['Install the SwarmOps-managed Traefik gateway so private monitoring routes can be created.'] : []),
    ...(!statefulNodeReady ? ['Assign nim.stateful=true to at least one ready, active Swarm node for Prometheus, Alertmanager, and Jaeger placement.'] : []),
  ]

  const queue = async (label: string, run: () => Promise<{ id: string }>) => {
    setPending(true)
    try {
      const command = await run()
      toast({ message: `${label} queued (${shortID(command.id)})`, tone: 'success' })
    } catch (reason) {
      toast({ duration: 0, message: messageOf(reason), tone: 'danger' })
    } finally {
      setPending(false)
    }
  }

  const collectors = [status.coreInstalled, status.logsEnabled, status.agentInstalled].filter(Boolean).length

  return (
    <>
      <Columns>
        <Panel eyebrow="Shared platform service" title="Core monitoring stack">
          <Body size="sm">One API action deploys the reviewed Prometheus, Alertmanager, and Jaeger stack. The baseline Alertmanager intentionally has no external receiver until an operator installs a reviewed receiver configuration.</Body>
          {!status.coreInstalled && coreBlockers.length ? (
            <Banner title="Deployment prerequisites are not ready" tone="warning">
              <Rows gap="tight">
                <List plain>
                  {coreBlockers.map((blocker) => <ListRow key={blocker} subtitle={blocker} title="Required before deployment" />)}
                </List>
                <Inline>
                  <Button onClick={onOpenGateway} size="sm" variant="secondary">Open gateway setup</Button>
                  <Button onClick={onOpenSwarm} size="sm" variant="secondary">Open Swarm placement</Button>
                </Inline>
              </Rows>
            </Banner>
          ) : null}
          <TaskProgress
            caption={status.coreInstalled
              ? (status.coreHealthy ? 'The core stack is healthy in Docker.' : 'The core stack is present but Docker reports at least one service as degraded.')
              : 'Provision the core stack before trusting monitoring state.'}
            steps={[
              { id: 'prometheus', label: 'Prometheus discovery, rules, and retention', status: status.coreInstalled ? (status.coreHealthy ? 'done' : 'failed') : 'pending' },
              { id: 'alertmanager', label: 'Alert grouping and routing boundary', status: status.coreInstalled ? (status.coreHealthy ? 'done' : 'failed') : 'pending' },
              { id: 'jaeger', label: 'Jaeger durable storage', status: status.coreInstalled ? (status.coreHealthy ? 'done' : 'failed') : 'pending' },
            ]}
            title="Core readiness"
          />
          {status.coreInstalled ? (
            <ConfirmPhrase
              action="Remove core monitoring"
              consequence="Prometheus, Alertmanager, and Jaeger stop. Every metric and trace claim in this console loses its source until the stack is deployed again."
              busy={pending}
              onConfirm={() => void queue('Core monitoring removal', () => api.coreObservability(false, 'REMOVE_OBSERVABILITY_CORE'))}
              phrase="REMOVE_OBSERVABILITY_CORE"
            />
          ) : (
            <Button disabled={pending || coreBlockers.length > 0} loading={pending} onClick={() => void queue('Core monitoring deployment', () => api.coreObservability(true, ''))} variant="accent">Deploy core monitoring</Button>
          )}
        </Panel>

        <Panel eyebrow="Explicit cluster-wide collection" title="Fluentd log pipeline">
          <Switch
            checked={status.logsEnabled}
            disabled={pending}
            description={status.logsEnabled
              ? 'Fluentd is collecting container output and host journals globally. Turning the switch off opens the confirmation step; the stack is not removed until you confirm it.'
              : 'Runs the reviewed Fluentd forwarder globally with a stateful aggregator and bounded query service.'}
            onChange={(event) => {
              if (event.target.checked) void queue('Log collection deployment', () => api.logsCollection(true, ''))
              else setLogRemovalRequested(true)
            }}
          >
            Enable log collection
          </Switch>
          {status.logsEnabled && logRemovalRequested ? (
            <Rows gap="tight">
              <ConfirmPhrase
                action="Disable collection"
                consequence="This removes the reviewed Fluentd stack, and the Logs screen stops receiving records. Its local retained volume is left untouched for explicit operator recovery."
                busy={pending}
                onConfirm={() => { void queue('Log collection removal', () => api.logsCollection(false, 'DISABLE_LOG_COLLECTION')); setLogRemovalRequested(false) }}
                phrase="DISABLE_LOG_COLLECTION"
              />
              <Button disabled={pending} onClick={() => setLogRemovalRequested(false)} variant="ghost">Keep collection enabled</Button>
            </Rows>
          ) : null}
          {status.logsEnabled && !logRemovalRequested ? (
            <Button disabled={pending} onClick={() => setLogRemovalRequested(true)} variant="danger">Begin collection removal</Button>
          ) : null}
        </Panel>

        <Panel eyebrow="Optional host probe" title="Node inventory agent">
          <Body size="sm">The optional global stack installs a read-only SwarmOps agent plus node-exporter. Together they expose host CPU, memory, disk, Docker metadata, and durable fleet-job status only on the private overlay. The SwarmOps agent has a read-only Docker socket and host-root mount, so installation and removal both require an exact confirmation.</Body>
          {status.agentInstalled ? (
            <ConfirmPhrase
              action="Remove node agent"
              consequence="The global host probe stops. Host CPU, memory, and disk figures fall back to whatever the enrolled agent reports on its own schedule."
              busy={pending}
              onConfirm={() => void queue('Node inventory agent removal', () => api.nodeAgentCollection(false, 'REMOVE_NODE_AGENT'))}
              phrase="REMOVE_NODE_AGENT"
            />
          ) : (
            <ConfirmPhrase
              action="Install node agent"
              consequence="A read-only agent is installed on every node with a read-only Docker socket and a host-root mount. It reads; it never writes."
              busy={pending}
              onConfirm={() => void queue('Node inventory agent installation', () => api.nodeAgentCollection(true, 'INSTALL_NODE_AGENT'))}
              phrase="INSTALL_NODE_AGENT"
              variant="accent"
            />
          )}
        </Panel>
      </Columns>
    </>
  )
}
