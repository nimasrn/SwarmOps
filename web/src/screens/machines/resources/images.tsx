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
  Facts,
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
  ImageDetail,
  ImageSummary,
} from '../../../data/types'
import { formatBytes, formatDateTime, formatTimestamp, shortID } from '../../../lib/format'
import { messageOf } from '../../../lib/errors'
import { useResource } from '../../../data/hooks'

type Toast = ReturnType<typeof useToast>

export function ImagesTab({ toast }: { toast: Toast }) {
  const { data, error, loading, reload } = useResource(() => api.images(), [])
  const [reference, setReference] = useState('')
  const [pending, setPending] = useState('')
  // The digest is the only identity that survives a tag being moved, so it is
  // the thing an operator checks before they trust that what is running is
  // what they built. `docker image inspect` is where it lives, and the
  // console had never asked.
  const [inspected, setInspected] = useState<ImageDetail | null>(null)
  const [inspectError, setInspectError] = useState('')

  const inspect = async (image: ImageSummary) => {
    setInspected(null)
    setInspectError('')
    setPending(`inspect-${image.Id}`)
    try {
      setInspected(await api.image(image.Id))
    } catch (reason) {
      setInspectError(messageOf(reason))
    } finally {
      setPending('')
    }
  }

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
    { header: 'Image', key: 'tags', render: (image) => <RecordLink meta={shortID(image.Id.replace('sha256:', ''))} onClick={() => void inspect(image)} title={image.RepoTags?.join(', ') || shortID(image.Id.replace('sha256:', ''))} /> },
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
      <Sheet closeLabel="Close the image inspector" onClose={() => { setInspected(null); setInspectError('') }} open={Boolean(inspected) || Boolean(inspectError)} title={inspected?.RepoTags?.[0] ?? 'Image'}>
        {inspectError ? <Banner tone="danger" title="This image could not be inspected">{inspectError}</Banner> : null}
        {inspected ? (
          <Rows gap="tight">
            <Facts columns={1} items={[
              { label: 'Tags', mono: true, value: inspected.RepoTags?.join(', ') || 'Untagged' },
              { label: 'Digests', mono: true, value: inspected.RepoDigests?.join(', ') || 'None recorded' },
              { label: 'Image ID', mono: true, value: inspected.Id },
              { label: 'Created', value: inspected.Created ? formatDateTime(inspected.Created) : 'Not reported' },
              { label: 'Platform', value: [inspected.Os, inspected.Architecture].filter(Boolean).join('/') || 'Not reported' },
              { label: 'Author', value: inspected.Author || 'Not recorded' },
              { label: 'Size', value: formatBytes(inspected.Size) },
              { label: 'Layers', value: String(inspected.RootFS?.Layers?.length ?? 0) },
            ]} />
            <Body size="sm" tone="muted">
              A digest identifies the exact bytes; a tag only says where they were last found. Compare the digest, not the
              tag, when checking that what is running is what was built.
            </Body>
          </Rows>
        ) : null}
      </Sheet>
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
