import { useEffect, useState } from 'react'
import {
  Banner,
  Body,
  Button,
  Inline,
  Input,
  Mono,
  Panel,
  Spinner,
  Stack as Rows,
  StatusDot,
  Table,
  useToast,
} from '@nim.zone/ui'
import type { TableColumn } from '@nim.zone/ui'
import { api } from '../../data/api'
import type { RegistryMirrorMachine } from '../../data/types'
import { messageOf } from '../../lib/errors'

type Toast = ReturnType<typeof useToast>

/**
 * The fleet's Docker image mirror.
 *
 * A mirror set on four machines out of five is worse than no mirror: the fifth
 * still goes to Docker Hub, and the service that happens to land there is the
 * one that stalls when Hub is slow, blocked, or rate-limiting. So this is one
 * control over every enrolled agent, and the table below reports what each
 * DAEMON says — not what was once asked for — so drift is visible.
 */
export function RegistryMirrorPanel({ toast }: { toast: Toast }) {
  const [machines, setMachines] = useState<RegistryMirrorMachine[] | null>(null)
  const [consistent, setConsistent] = useState(true)
  const [mirrors, setMirrors] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState('')

  const read = async () => {
    setPending('read')
    try {
      const fleet = await api.registryMirrors()
      setConsistent(fleet.consistent)
      setMachines(fleet.machines)
      setMirrors((fleet.mirrors ?? []).join('\n'))
      setError('')
    } catch (reason) {
      setError(messageOf(reason))
    } finally {
      setPending('')
    }
  }
  useEffect(() => { void read() }, [])

  const entries = mirrors.split('\n').map((line) => line.trim()).filter(Boolean)

  const apply = async () => {
    const question = entries.length
      ? `Point every enrolled machine at ${entries.join(', ')}? Docker restarts on each machine to read the new configuration, which briefly interrupts containers on that host.`
      : 'Remove the image mirror from every enrolled machine and pull from Docker Hub directly? Docker restarts on each machine, which briefly interrupts containers on that host.'
    if (!window.confirm(question)) return
    setPending('apply')
    try {
      const result = await api.applyRegistryMirrors(entries)
      const skipped = Object.keys(result.skipped ?? {}).length
      toast({
        message: `Queued the image mirror change on ${result.queued.length} machine${result.queued.length === 1 ? '' : 's'}${skipped ? `; ${skipped} skipped` : ''}. Each machine is a separate command in Commands.`,
        tone: skipped ? 'danger' : 'success',
      })
      setError('')
      await read()
    } catch (reason) {
      setError(messageOf(reason))
    } finally {
      setPending('')
    }
  }

  const columns: TableColumn<RegistryMirrorMachine>[] = [
    { header: 'Machine', key: 'name', render: (machine) => machine.name },
    {
      header: 'State',
      key: 'state',
      render: (machine) => machine.reachable
        ? <StatusDot tone={machine.supported ? 'success' : 'warning'}>{machine.supported ? 'Manageable' : 'Read-only'}</StatusDot>
        : <StatusDot tone="danger">Unreachable</StatusDot>,
    },
    {
      header: 'Mirror in effect',
      key: 'mirrors',
      render: (machine) => machine.mirrors?.length
        ? <Mono>{machine.mirrors.join(', ')}</Mono>
        : machine.reachable ? 'Docker Hub (no mirror)' : (machine.reason ?? 'Unknown'),
    },
  ]

  return (
    <Panel title="Docker image mirror">
      <Rows>
        <Body size="sm">
          One pull-through mirror for every enrolled machine. SwarmOps writes only the mirror list into each host&apos;s
          Docker daemon configuration, keeps every other setting the host already had, and restarts Docker so the
          change actually takes effect. Leave the box empty to go back to pulling from Docker Hub.
        </Body>
        {error ? <Banner title="The image mirror could not be read or changed" tone="danger">{error}</Banner> : null}
        {machines && !consistent ? (
          <Banner title="Machines disagree" tone="warning">
            Enrolled machines are not using the same mirror. Applying below makes the whole fleet match this list.
          </Banner>
        ) : null}
        <Input
          hint="One registry URL per line, at most four, tried in order. A bare host becomes HTTPS."
          label="Mirror URLs"
          onChange={(event) => setMirrors(event.target.value)}
          placeholder="https://mirror.example.com"
          value={mirrors}
        />
        <Inline>
          <Button disabled={Boolean(pending)} loading={pending === 'apply'} onClick={() => void apply()} variant="accent">
            {entries.length ? 'Apply to every machine' : 'Remove mirror everywhere'}
          </Button>
          <Button disabled={Boolean(pending)} iconStart="refresh" loading={pending === 'read'} onClick={() => void read()} variant="secondary">Re-read machines</Button>
        </Inline>
        {!machines ? <Spinner label="Reading each machine's Docker configuration" /> : (
          <Table columns={columns} rowKey={(machine) => machine.serverId} rows={machines} />
        )}
      </Rows>
    </Panel>
  )
}
