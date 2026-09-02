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
import { Screen } from '../../components/screen'

type Toast = ReturnType<typeof useToast>

/**
 * The fleet's Docker image mirror.
 *
 * A mirror set on four machines out of five is worse than no mirror: the fifth
 * still goes to Docker Hub, and the service that happens to land there is the
 * one that stalls when Hub is slow, blocked, or rate-limiting. So this is one
 * control over every enrolled agent, and the table below reports what each
 * DAEMON says — not what was once asked for — so drift is visible.
 *
 * It is its own destination because it belongs to no application and no
 * provider. It was a panel inside the Core screen, under a heading about
 * controller identity and authority handover, which is neither where it is
 * looked for nor what it is about: this changes where every HOST pulls public
 * images from, and it is unrelated both to the registry SwarmOps pushes builds
 * to and to the Git provider it reads source from.
 */
export function RegistryMirrorPage({ toast }: { toast: Toast }) {
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
  const mirrored = machines?.filter((machine) => machine.mirrors?.length).length ?? 0

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
    <Screen
      about="This is where every enrolled machine pulls PUBLIC images from. It is not the registry SwarmOps pushes its own builds to, and it has nothing to do with the Git provider source is read from — both of those are under Apps."
      insights={[
        { hint: entries.length ? 'Every enrolled machine is asked to pull through this' : 'Machines pull from Docker Hub directly', icon: 'cloud', label: 'Mirror in effect', tone: entries.length ? 'success' : 'neutral', value: entries[0] ?? 'Docker Hub' },
        { hint: 'Machines whose Docker daemon reports a mirror right now', icon: 'server', label: 'Machines mirrored', unmeasured: !machines, value: machines ? `${mirrored}/${machines.length}` : '—' },
        { hint: consistent ? 'Every reachable machine reports the same mirror' : 'At least one machine disagrees with the rest', icon: 'shield', label: 'Fleet agreement', tone: machines && !consistent ? 'warning' : 'success', unmeasured: !machines, value: machines ? (consistent ? 'Uniform' : 'Drifted') : '—' },
      ]}
      page="registry-mirror"
      width="full"
    >
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
    </Screen>
  )
}
