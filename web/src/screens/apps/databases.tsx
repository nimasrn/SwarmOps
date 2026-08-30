import { useEffect, useState } from 'react'
import {
  Banner,
  Body,
  Button,
  Columns,
  Facts,
  Inline,
  Mono,
  Panel,
  Spinner,
  Stack as Rows,
  useToast,
} from '@nim.zone/ui'
import { api } from '../../data/api'
import type { DatabaseStatus } from '../../data/types'
import { shortID } from '../../lib/format'
import { messageOf } from '../../lib/errors'
import { StatusBadge } from '../../components/badges'
import { ConfirmPhrase } from '../../components/confirm-phrase'

type Toast = ReturnType<typeof useToast>

/**
 * The three reviewed managed engines. The console chooses only whether one
 * runs: the Compose content is a checked-in asset and the generated password is
 * a Swarm secret the browser never sees.
 *
 * This is a tab body rather than a screen. It used to be its own destination
 * under Workloads, which put "the database every application shares" in a
 * different area from "the Prometheus every application shares"; both are
 * cluster singletons and both now live on Platform services.
 */
export function DatabasesTab({ toast }: { toast: Toast }) {
  const [databases, setDatabases] = useState<DatabaseStatus[] | null>(null)
  const [error, setError] = useState('')
  const [pending, setPending] = useState('')

  const refresh = () => api.databases().then(setDatabases).catch((reason) => setError(messageOf(reason)))
  useEffect(() => { void refresh() }, [])

  const set = async (database: DatabaseStatus, enabled: boolean, confirmation = '') => {
    setPending(database.engine)
    try {
      const command = await api.setDatabase(database.engine, enabled, confirmation)
      toast({ message: `${database.displayName} ${enabled ? 'deployment' : 'removal'} queued (${shortID(command.id)})`, tone: 'success' })
      await refresh()
    } catch (reason) {
      toast({ duration: 0, message: messageOf(reason), tone: 'danger' })
    } finally {
      setPending('')
    }
  }

  if (error) return <Banner tone="danger" title="Managed databases are unavailable">{error}</Banner>
  if (!databases) return <Panel><Spinner label="Reading managed databases" /></Panel>

  const running = databases.filter((database) => database.installed && database.runningTasks > 0)
  const stalled = databases.filter((database) => database.installed && database.runningTasks === 0)

  return (
    <>
      <Columns>
        {databases.map((database) => (
          <Panel
            eyebrow={database.installed ? `${database.runningTasks} running task${database.runningTasks === 1 ? '' : 's'}` : 'Not deployed'}
            key={database.engine}
            title={database.displayName}
          >
            <Rows>
              <StatusBadge
                health={database.installed ? (database.runningTasks > 0 ? 'healthy' : 'degraded') : 'unknown'}
                label={database.installed ? (database.runningTasks > 0 ? 'Running' : 'No running task') : 'Not deployed'}
              />
              <Facts items={[
                { label: 'Image', mono: true, value: database.image },
                { label: 'In-cluster host', mono: true, value: `${database.host}:${database.port}` },
                ...(database.username ? [{ label: 'User', mono: true, value: database.username }] : []),
                ...(database.database ? [{ label: 'Database', mono: true, value: database.database }] : []),
                { label: 'Volume', mono: true, value: database.volume },
              ]} />
              {database.installed ? (
                <Rows gap="tight">
                  <Inline>
                    <Button disabled={Boolean(pending)} loading={pending === database.engine} onClick={() => void set(database, true)} variant="secondary">Redeploy</Button>
                  </Inline>
                  <ConfirmPhrase
                    action={`Remove ${database.displayName}`}
                    consequence="Removing the stack stops the only process serving this data. The named volume is left in place, so the data survives — nothing is currently reading it."
                    busy={pending === database.engine}
                    onConfirm={() => void set(database, false, `REMOVE_DATABASE_${database.engine.toUpperCase()}`)}
                    phrase={`REMOVE_DATABASE_${database.engine.toUpperCase()}`}
                  />
                </Rows>
              ) : (
                <Button disabled={Boolean(pending)} loading={pending === database.engine} onClick={() => void set(database, true)} variant="accent">Deploy {database.displayName}</Button>
              )}
            </Rows>
          </Panel>
        ))}
      </Columns>

      <Panel eyebrow="How your services connect" title="Credentials and placement">
        <Rows as="ul" className="nim-body nim-body--sm" gap="tight">
          <li>The password is generated on the manager and stored as a Swarm secret. SwarmOps never returns it to this console; mount that secret into your own service to read it.</li>
          <li>Each engine is pinned to a node labelled <Mono>nim.stateful=true</Mono> and attached only to the internal <Mono>swarmops</Mono> overlay. Publishing a port to the host or the edge stays a separate, explicit decision.</li>
          <li>Redeploying applies the current checked-in asset and pinned image. It never rotates an existing password: Swarm secrets are immutable and a running database depends on the value it was created with.</li>
        </Rows>
        <Body size="sm" tone="muted">Attach one of these to an application under Apps → Deploy; SwarmOps injects the connection URI as a mounted secret file.</Body>
      </Panel>
    </>
  )
}
