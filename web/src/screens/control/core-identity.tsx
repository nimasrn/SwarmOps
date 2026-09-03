import { useEffect, useState } from 'react'
import { Badge, Banner, Body, Button, Columns, Facts, Inline, Mono, Panel, Spinner, Stack as Rows, Table, useToast } from '@nim.zone/ui'
import type { TableColumn } from '@nim.zone/ui'
import { api } from '../../data/api'
import type { CoreSelf } from '../../data/types'
import { messageOf } from '../../lib/errors'
import { formatBytes, formatDateTime } from '../../lib/format'

type Toast = ReturnType<typeof useToast>

/**
 * The controller, described by itself.
 *
 * "I cannot find the core service in my panel" was a fair complaint about a
 * screen that opened on a ten-row handoff timeline. Every row read "Pending",
 * none of them said what version was running, and the machine the process sits
 * on appeared nowhere — while the updater that could have answered all of it
 * had shipped and had no route.
 *
 * The move procedure still matters and is still below. It is not the first
 * thing you see, because it is not the thing you came for.
 */
export function CoreIdentityPanels({ toast }: { toast: Toast }) {
  const [self, setSelf] = useState<CoreSelf | null>(null)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  const read = () => api.coreSelf().then((next) => { setSelf(next); setError('') }).catch((reason) => setError(messageOf(reason)))
  useEffect(() => { void read() }, [])

  const update = async (version?: string) => {
    setPending(true)
    try {
      await api.requestCoreUpdate(version)
      toast({
        message: version
          ? `Install of ${version} scheduled. The updater starts it beside this process and keeps the running release if it does not answer its own health check.`
          : 'Update check scheduled. The updater starts the new release beside this one and retires this process only once the new one answers.',
        tone: 'success',
      })
      await read()
    } catch (reason) {
      toast({ duration: 0, message: messageOf(reason), tone: 'danger' })
    } finally {
      setPending(false)
    }
  }

  if (error) return <Banner title="This controller could not describe itself" tone="danger">{error}</Banner>
  if (!self) return <Panel><Spinner label="Reading the controller" /></Panel>

  const rollBack = (version: string) => {
    // A rollback is an install of a named release, not a separate mechanism:
    // the same staged start, the same health check, the same refusal to
    // retire the running process until the candidate answers.
    if (!window.confirm(`Install ${version} on this controller? The console is briefly unavailable while the updater restarts it, and the running release returns if ${version} does not answer its health check.`)) return
    void update(version)
  }

  const storageFull = self.storage.totalBytes > 0 && self.storage.freeBytes / self.storage.totalBytes < 0.1
  const available = self.update.available && self.update.available !== self.version ? self.update.available : ''

  return (
    <Rows gap="md">
      <Columns>
        <Panel title="This controller">
          <Facts
            columns={1}
            items={[
              { label: 'Version', value: <Mono>{self.version}</Mono> },
              { label: 'Runs on', value: `${self.hostname} · ${self.os}/${self.architecture}` },
              { label: 'In the cluster', value: self.inCluster ? 'Yes' : 'No — and it does not need to be' },
              { label: 'Started', value: formatDateTime(self.startedAt) },
              { label: 'Uptime', value: formatUptime(self.uptimeSeconds) },
            ]}
          />
          <Body size="sm" tone="muted">
            The controller is not a node and never appears in Machines. It holds state and decides; it has no Docker
            socket and cannot run a container. If this host should also run workloads, install an agent on it — it
            then appears in Machines as a separate thing, which is what it is.
          </Body>
        </Panel>

        <Panel title="State and storage">
          <Facts
            columns={1}
            items={[
              { label: 'Path', value: <Mono>{self.storage.path || 'Not reported'}</Mono> },
              { label: 'Holds', value: 'Machines, credentials, the run ledger, audit, deployment specs' },
              { label: 'Used', value: self.storage.usedBytes ? formatBytes(self.storage.usedBytes) : 'Not measured' },
              {
                label: 'Free on disk',
                value: self.storage.totalBytes
                  ? `${formatBytes(self.storage.freeBytes)} of ${formatBytes(self.storage.totalBytes)}`
                  : 'Not measured',
              },
            ]}
          />
          {storageFull ? (
            <Banner title="This controller is running out of disk" tone="danger">
              The command ledger is written before any operation is sent. A controller that cannot write it cannot
              accept work at all, so this is the one disk on the fleet that must never fill.
            </Banner>
          ) : null}
        </Panel>
      </Columns>

      <Panel
        actions={self.update.configured
          ? <Button disabled={pending} onClick={() => void update()} size="sm" variant={available ? 'accent' : 'secondary'}>
              {pending ? 'Scheduling…' : available ? `Install ${available}` : 'Check for an update'}
            </Button>
          : undefined}
        description="The controller does not update itself. A separate local updater starts the candidate beside this process, waits for it to answer its own health check, and retires this one only then — a process cannot supervise its own replacement."
        title="Version and updates"
      >
        {!self.update.configured ? (
          <Banner title="This controller has no updater" tone="neutral">
            <Rows gap="tight">
              <Body size="sm">
                Nothing here can be scheduled: this process was not told where an update request marker or status
                file lives. A source checkout has neither by design.
              </Body>
              <Body size="sm">
                An installed controller from before this wiring shipped also reports it. The installer refuses to
                touch an existing controller, so the repair is one command on the Core host — it writes the
                environment keys, adds the path unit, and restarts the controller:
              </Body>
              <Mono>curl -fsSL https://github.com/nimasrn/SwarmOps/releases/latest/download/repair-swarmops-core-update-wiring.sh | sudo bash</Mono>
            </Rows>
          </Banner>
        ) : (
          <Rows gap="tight">
            <Facts
              items={[
                { label: 'Running', value: <Mono>{self.version}</Mono> },
                { label: 'Available', value: available ? <Mono>{available}</Mono> : 'Nothing newer' },
                { label: 'Update policy', value: self.update.automatic ? 'Automatic' : 'Manual' },
                { label: 'Last checked', value: self.update.checkedAt ? formatDateTime(self.update.checkedAt) : 'Never' },
                { label: 'Last installed', value: self.update.lastUpdatedAt ? formatDateTime(self.update.lastUpdatedAt) : 'Never' },
              ]}
            />
            {self.update.state ? <Body size="sm" tone="muted">Last result: {self.update.state.replace(/_/g, ' ')}</Body> : null}
            {self.update.state === 'failed' ? (
              <Banner title="The last controller update failed" tone="warning">
                The updater kept the running release. Check the controller Warden log on this host before asking for
                the same version again, or install one of the releases below.
              </Banner>
            ) : null}
          </Rows>
        )}

        {self.releases?.length ? (
          <>
            <Body size="sm" tone="muted">
              Three releases are kept on disk. A fourth install deletes the oldest, and what is listed here is what a
              roll back can actually return to.
            </Body>
            <Table columns={releaseColumns(self.update.configured && !pending, rollBack)} rowKey={(row) => row.version} rows={self.releases ?? []} />
          </>
        ) : self.update.configured ? (
          <Body size="sm" tone="muted">No release directory is readable, so there is nothing to roll back to yet.</Body>
        ) : null}
      </Panel>
    </Rows>
  )
}

function releaseColumns(
  canInstall: boolean,
  onInstall: (version: string) => void,
): TableColumn<CoreSelf['releases'][number]>[] {
  return [
  {
    header: 'Version',
    key: 'version',
    render: (row) => (
      <Inline>
        <Mono>{row.version}</Mono>
        {row.running ? <Badge variant="accent">Running</Badge> : null}
      </Inline>
    ),
  },
  { header: 'Installed', key: 'installedAt', render: (row) => formatDateTime(row.installedAt) },
  { header: 'Size', key: 'size', numeric: true, render: (row) => formatBytes(row.sizeBytes) },
  {
    header: '',
    key: 'install',
    render: (row) => row.running
      ? null
      : <Button disabled={!canInstall} onClick={() => onInstall(row.version)} size="sm" variant="secondary">Install this version</Button>,
  },
  ]
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86_400)
  if (days >= 1) return `${days} day${days === 1 ? '' : 's'}`
  const hours = Math.floor(seconds / 3_600)
  if (hours >= 1) return `${hours} hour${hours === 1 ? '' : 's'}`
  return `${Math.max(1, Math.floor(seconds / 60))} minutes`
}
