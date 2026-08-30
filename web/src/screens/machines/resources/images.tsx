import { useState } from 'react'
import {
  Badge,
  Banner,
  Body,
  Button,
  Columns,
  DataTable,
  EmptyState,
  Input,
  Mono,
  Panel,
  Spinner,
  Stack as Rows,
  useToast,
} from '@nim.zone/ui'
import type { TableColumn } from '@nim.zone/ui'
import { api } from '../../../data/api'
import type {
  ImageSummary,
} from '../../../data/types'
import { formatBytes, formatTimestamp, shortID } from '../../../lib/format'
import { messageOf } from '../../../lib/errors'
import { useResource } from '../../../data/hooks'

type Toast = ReturnType<typeof useToast>

export function ImagesTab({ toast }: { toast: Toast }) {
  const { data, error, loading, reload } = useResource(() => api.images(), [])
  const [reference, setReference] = useState('')
  const [pending, setPending] = useState('')

  const pull = async () => {
    setPending('pull')
    try {
      const command = await api.pullImage(reference.trim())
      toast({ message: `Image pull queued (${shortID(command.id)})`, tone: 'success' })
      setReference('')
      await api.waitForCommand(command.id)
      await reload()
    } catch (reason) { toast({ message: messageOf(reason), tone: 'danger', duration: 0 }) } finally { setPending('') }
  }

  const remove = async (image: ImageSummary) => {
    const target = image.RepoTags?.[0] ?? image.Id
    setPending(target)
    try {
      const command = await api.removeImage(target)
      toast({ message: `Image removal queued (${shortID(command.id)})`, tone: 'success' })
      await api.waitForCommand(command.id)
      await reload()
    } catch (reason) { toast({ message: messageOf(reason), tone: 'danger', duration: 0 }) } finally { setPending('') }
  }

  const columns: TableColumn<ImageSummary>[] = [
    { header: 'Image', key: 'tags', render: (image) => <Mono>{image.RepoTags?.join(', ') || shortID(image.Id.replace('sha256:', ''))}</Mono> },
    { header: 'Created', key: 'created', render: (image) => formatTimestamp(image.Created) },
    { header: 'In use', key: 'containers', render: (image) => (image.Containers > 0 ? <Badge variant="success">{`${image.Containers} container${image.Containers === 1 ? '' : 's'}`}</Badge> : <Badge>Unused</Badge>) },
    { header: 'Size', key: 'size', numeric: true, render: (image) => formatBytes(image.Size) },
    {
      header: '',
      key: 'actions',
      render: (image) => (
        <Button loading={pending === (image.RepoTags?.[0] ?? image.Id)} onClick={() => void remove(image)} size="sm" variant="ghost">Remove</Button>
      ),
    },
  ]

  if (loading && !data) return <Spinner label="Reading images" />
  if (error) return <Banner tone="danger" title="Images are unavailable">{error}</Banner>
  return (
    <Rows>
      <Panel eyebrow="Pull an image" title="Bring an image onto this host">
        <Columns>
          <Input
            hint="An immutable tag or digest. The pull is queued as one audited command."
            label="Image reference"
            onChange={(event) => setReference(event.target.value)}
            placeholder="ghcr.io/org/service:2026.08.23"
            value={reference}
          />
          <Rows gap="tight">
            <Body size="sm">Pulling here only warms the host cache. Deployments still take their image from the application or stack they belong to.</Body>
            <Button disabled={!reference.trim()} loading={pending === 'pull'} onClick={() => void pull()} variant="secondary">Pull image</Button>
          </Rows>
        </Columns>
      </Panel>
      <Panel flush title={`Images (${data?.length ?? 0})`}>
        <DataTable
          caption="Images on the selected target, largest first"
          columns={columns}
          empty={<EmptyState description="This target reported no images." icon="package" title="No images" />}
          rowKey={(image) => image.Id}
          rows={data ?? []}
        />
      </Panel>
    </Rows>
  )
}
