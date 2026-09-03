import { useState } from 'react'
import {
  Badge,
  Banner,
  Body,
  Button,
  Columns,
  DataTable,
  EmptyState,
  Facts,
  Input,
  Panel,
  RecordLink,
  Sheet,
  Spinner,
  Stack as Rows,
  useToast,
} from '@nim.zone/ui'
import type { TableColumn } from '@nim.zone/ui'
import { api } from '../../../data/api'
import type {
  VolumeSummary,
} from '../../../data/types'
import { formatBytes, formatDateTime, shortID } from '../../../lib/format'
import { messageOf } from '../../../lib/errors'
import { useResource } from '../../../data/hooks'
import { ConfirmPhrase } from '../../../components/confirm-phrase'

type Toast = ReturnType<typeof useToast>

export function VolumesTab({ toast }: { toast: Toast }) {
  const { data, error, loading, reload } = useResource(() => api.volumes(), [])
  const [name, setName] = useState('')
  const [pending, setPending] = useState('')
  // The list is `docker volume ls` plus usage; the inspector is `docker volume
  // inspect`, which is the only place the mountpoint, the driver options and
  // the labels exist. The endpoint was served and nothing asked for it, so a
  // volume was a row you could delete but not look at.
  const [inspected, setInspected] = useState<VolumeSummary | null>(null)
  const [inspectError, setInspectError] = useState('')

  const inspect = async (volume: VolumeSummary) => {
    setInspected(null)
    setInspectError('')
    setPending(`inspect-${volume.Name}`)
    try {
      setInspected(await api.volume(volume.Name))
    } catch (reason) {
      setInspectError(messageOf(reason))
    } finally {
      setPending('')
    }
  }

  const create = async () => {
    setPending('create')
    try {
      const command = await api.createVolume(name.trim())
      toast({ message: `Volume creation queued (${shortID(command.id)})`, tone: 'success' })
      setName('')
      await api.waitForCommand(command.id)
      await reload()
    } catch (reason) { toast({ message: messageOf(reason), tone: 'danger', duration: 0 }) } finally { setPending('') }
  }

  const columns: TableColumn<VolumeSummary>[] = [
    { header: 'Volume', key: 'name', render: (volume) => <RecordLink meta={volume.Driver} onClick={() => void inspect(volume)} title={volume.Name} /> },
    { header: 'Driver', key: 'driver', render: (volume) => volume.Driver },
    { header: 'Used by', key: 'refs', render: (volume) => (volume.UsageData ? (volume.UsageData.RefCount > 0 ? <Badge variant="success">{`${volume.UsageData.RefCount} container${volume.UsageData.RefCount === 1 ? '' : 's'}`}</Badge> : <Badge>Unreferenced</Badge>) : '—') },
    { header: 'Size', key: 'size', numeric: true, render: (volume) => (volume.UsageData && volume.UsageData.Size >= 0 ? formatBytes(volume.UsageData.Size) : '—') },
    {
      header: '',
      key: 'actions',
      render: (volume) => (
        <ConfirmPhrase
          busy={pending === volume.Name}
          compact
          phrase={`REMOVE_VOLUME_${volume.Name.toUpperCase()}`}
          action="Delete"
          onConfirm={async (confirmation) => {
            setPending(volume.Name)
            try {
              const command = await api.removeVolume(volume.Name, confirmation)
              toast({ message: `Volume removal queued (${shortID(command.id)})`, tone: 'success' })
              await api.waitForCommand(command.id)
              await reload()
            } catch (reason) { toast({ message: messageOf(reason), tone: 'danger', duration: 0 }) } finally { setPending('') }
          }}
        />
      ),
    },
  ]

  if (loading && !data) return <Spinner label="Reading volumes" />
  if (error) return <Banner tone="danger" title="Volumes are unavailable">{error}</Banner>
  return (
    <Rows>
      <Panel eyebrow="Local driver" title="Create a volume">
        <Columns>
          <Input hint="Lowercase name, letters and digits to start." label="Volume name" onChange={(event) => setName(event.target.value)} placeholder="postgres-data" value={name} />
          <Rows gap="tight">
            <Body size="sm">Managed databases create their own volumes. Create one here only for a stack you deploy yourself.</Body>
            <Button disabled={!name.trim()} loading={pending === 'create'} onClick={() => void create()} variant="secondary">Create volume</Button>
          </Rows>
        </Columns>
      </Panel>
      <Sheet closeLabel="Close the volume inspector" onClose={() => { setInspected(null); setInspectError('') }} open={Boolean(inspected) || Boolean(inspectError)} title={inspected?.Name ?? 'Volume'}>
        {inspectError ? <Banner tone="danger" title="This volume could not be inspected">{inspectError}</Banner> : null}
        {inspected ? (
          <Rows gap="tight">
            <Facts columns={1} items={[
              { label: 'Name', mono: true, value: inspected.Name },
              { label: 'Driver', value: inspected.Driver },
              { label: 'Scope', value: inspected.Scope },
              { label: 'Mountpoint', mono: true, value: inspected.Mountpoint || 'Not reported' },
              { label: 'Created', value: inspected.CreatedAt ? formatDateTime(inspected.CreatedAt) : 'Not reported' },
              { label: 'Referenced by', source: 'docker system df', unmeasured: !inspected.UsageData, value: inspected.UsageData ? `${inspected.UsageData.RefCount} container${inspected.UsageData.RefCount === 1 ? '' : 's'}` : 'not counted', why: 'the Engine returned no usage data for this volume' },
              { label: 'Size', source: 'docker system df', unmeasured: !inspected.UsageData || inspected.UsageData.Size < 0, value: inspected.UsageData && inspected.UsageData.Size >= 0 ? formatBytes(inspected.UsageData.Size) : 'not measured', why: 'the Engine did not measure this volume' },
            ]} />
            <Body size="sm" tone="muted">Driver options: {Object.entries(inspected.Options ?? {}).map(([key, value]) => `${key}=${value}`).join(', ') || 'none'}</Body>
            <Body size="sm" tone="muted">Labels: {Object.entries(inspected.Labels ?? {}).map(([key, value]) => `${key}=${value}`).join(', ') || 'none'}</Body>
          </Rows>
        ) : null}
      </Sheet>
      <Panel flush title={`Volumes (${data?.length ?? 0})`}>
        <DataTable
          caption="Volumes on the selected target"
          columns={columns}
          empty={<EmptyState description="This target reported no volumes." icon="database" title="No volumes" />}
          rowKey={(volume) => volume.Name}
          rows={data ?? []}
        />
      </Panel>
    </Rows>
  )
}
