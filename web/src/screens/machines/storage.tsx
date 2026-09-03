import { useEffect, useState } from 'react'
import { Banner, Body, Chart, Columns, Label, Panel, Segmented, Select, Spinner, Stack as Rows, Switch, useToast } from '@nim.zone/ui'
import { api } from '../../data/api'
import { formatBytes, shortID } from '../../lib/format'
import { messageOf } from '../../lib/errors'
import { useResource } from '../../data/hooks'
import { ConfirmPhrase } from '../../components/confirm-phrase'
import { Screen } from '../../components/screen'
import type { DiskUsage, Insights, PruneResource } from '../../data/types'
import { ImagesTab } from './resources/images'
import { NetworksTab } from './resources/networks'
import { SwarmObjectsTab } from './resources/swarm-objects'
import { VolumesTab } from './resources/volumes'

type Toast = ReturnType<typeof useToast>

type StorageTab = 'configs' | 'images' | 'networks' | 'secrets' | 'volumes'

const STORAGE_TABS: { label: string; value: StorageTab }[] = [
  { label: 'Volumes', value: 'volumes' },
  { label: 'Networks', value: 'networks' },
  { label: 'Images on disk', value: 'images' },
  { label: 'Secrets', value: 'secrets' },
  { label: 'Configs', value: 'configs' },
]

function PruneControls({ toast, usage }: { toast: Toast; usage: DiskUsage | null }) {
  const [resource, setResource] = useState<PruneResource>('images')
  const [all, setAll] = useState(false)
  const [pending, setPending] = useState(false)
  const confirmation = `PRUNE_${resource.replace('-', '_').toUpperCase()}`
  return (
    <Rows gap="tight">
      <Label as="p">Reclaim space</Label>
      <Body size="sm">
        Pruning deletes data the Engine considers unused. A volume prune destroys the data inside every unreferenced
        volume, and SwarmOps cannot bring it back — the confirmation phrase is the only guard.
      </Body>
      <Columns>
        <Select
          label="Resource"
          onChange={(event) => { setResource(event.target.value as PruneResource); setAll(false) }}
          options={[
            { label: 'Images', value: 'images' },
            { label: 'Containers', value: 'containers' },
            { label: 'Volumes', value: 'volumes' },
            { label: 'Networks', value: 'networks' },
            { label: 'Build cache', value: 'build-cache' },
          ]}
          value={resource}
        />
        <Rows gap="tight">
          {resource === 'images' ? (
            <Switch checked={all} description="Without this, only dangling images are removed." onChange={(event) => setAll(event.target.checked)}>Remove every unused image</Switch>
          ) : (
            <Body size="sm">{pruneDescription(resource, usage)}</Body>
          )}
          <ConfirmPhrase
            busy={pending}
            phrase={confirmation}
            action="Prune"
            onConfirm={async (typed) => {
              setPending(true)
              try {
                const command = await api.prune(resource, typed, all)
                toast({ message: `Prune queued for ${resource} (${shortID(command.id)})`, tone: 'success' })
              } catch (reason) { toast({ message: messageOf(reason), tone: 'danger', duration: 0 }) } finally { setPending(false) }
            }}
          />
        </Rows>
      </Columns>
    </Rows>
  )
}


/**
 * Where the disk actually went, and how much of it a prune would return.
 *
 * `docker system df` already fed the four figures at the top of this screen;
 * the split between what is IN USE and what is RECLAIMABLE was computed by the
 * controller and drawn only on the unreachable Insights screen. It belongs
 * here, immediately above the control that acts on it — a prune is decided on
 * the size of the reclaimable bar, not on a total.
 */
function DiskBreakdown() {
  const [insights, setInsights] = useState<Insights | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let live = true
    void api.insights()
      .then((value) => { if (live) setInsights(value) })
      .catch((reason) => { if (live) setError(messageOf(reason)) })
      .finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [])

  if (loading) return <Spinner label="Reading the disk breakdown" />
  if (error) return <Banner tone="warning" title="The disk breakdown is unavailable">{error}</Banner>
  if (!insights) return null

  const { storage } = insights
  return (
    <Chart
      categories={['Images', 'Volumes', 'Containers', 'Build cache']}
      format={formatBytes}
      height={200}
      kind="bar"
      legend
      note="Reclaimable is the part Docker would delete on a prune of that resource. A container's writable layer is never reclaimable while it exists."
      series={[
        {
          label: 'In use',
          values: [
            storage.imageBytes - storage.reclaimableImageBytes,
            storage.volumeBytes - storage.reclaimableVolumeBytes,
            storage.containerWritableBytes,
            storage.buildCacheBytes - storage.reclaimableBuildCacheBytes,
          ],
        },
        {
          label: 'Reclaimable',
          values: [
            storage.reclaimableImageBytes,
            storage.reclaimableVolumeBytes,
            0,
            storage.reclaimableBuildCacheBytes,
          ],
        },
      ]}
      title="Disk by resource"
    />
  )
}

/**
 * What a host is holding, and what can safely be let go.
 *
 * Reclaiming disk lives here rather than on a health screen, beside the
 * objects it destroys. A prune is irreversible and object-shaped: putting it
 * next to the volumes it would empty means an operator can see what they are
 * about to lose, and it keeps the screen people open while worried free of
 * destructive controls.
 */
export function StoragePage({ toast }: { toast: Toast }) {
  const [tab, setTab] = useState<StorageTab>('volumes')
  const usage = useResource(() => api.diskUsage(), [])
  const volumes = usage.data?.Volumes ?? []
  const unreferenced = volumes.filter((volume) => (volume.UsageData?.RefCount ?? 0) === 0).length
  const images = usage.data?.Images ?? []

  return (
    <Screen
      about="Creating or deleting any of these queues one fixed, audited command. A secret value and a config payload are never read back into the console."
      insights={[
        {
          hint: unreferenced ? `${unreferenced} referenced by no container` : 'Every volume is referenced',
          icon: 'database',
          label: 'Volumes',
          source: 'docker system df',
          tone: unreferenced ? 'warning' : 'neutral',
          unmeasured: !usage.data,
          value: String(volumes.length),
        },
        {
          hint: 'Total size of every image layer on this target',
          icon: 'package',
          label: 'Image layers',
          source: 'docker system df',
          unmeasured: !usage.data,
          value: formatBytes(usage.data?.LayersSize ?? 0),
        },
        {
          hint: 'Images the Engine currently stores',
          icon: 'layers',
          label: 'Images',
          source: 'docker system df',
          unmeasured: !usage.data,
          value: String(images.length),
        },
        {
          hint: 'SwarmOps does not back these up. Snapshot the stateful host yourself.',
          icon: 'shield',
          label: 'Backed up',
          source: 'no backup subsystem',
          tone: 'warning',
          value: 'No',
        },
      ]}
      page="storage"
      width="full"
    >
      <Segmented
        label="Object kind"
        onChange={(value: string) => setTab(value as StorageTab)}
        options={STORAGE_TABS}
        value={tab}
      />
      {tab === 'volumes' ? <VolumesTab toast={toast} /> : null}
      {tab === 'networks' ? <NetworksTab toast={toast} /> : null}
      {tab === 'images' ? <ImagesTab toast={toast} /> : null}
      {tab === 'secrets' ? <SwarmObjectsTab kind="secrets" toast={toast} /> : null}
      {tab === 'configs' ? <SwarmObjectsTab kind="configs" toast={toast} /> : null}

      <Panel description="Docker decides what counts as unused. SwarmOps only asks, and only after the exact phrase is typed." title="Reclaim space">
        <DiskBreakdown />
        <PruneControls toast={toast} usage={usage.data} />
      </Panel>
    </Screen>
  )
}

function pruneDescription(resource: PruneResource, usage: DiskUsage | null) {
  switch (resource) {
    case 'containers':
      return 'Removes every stopped container. Swarm task containers are recreated by their service.'
    case 'volumes':
      return `Removes every volume no container references${usage?.Volumes?.length ? ` (${usage.Volumes.length} volumes known)` : ''}. The data inside them is destroyed.`
    case 'networks':
      return 'Removes user-defined networks nothing is attached to. Ingress is never touched.'
    case 'build-cache':
      return 'Clears the builder cache. The next build will be slower but identical.'
    default:
      return 'Removes unused image layers.'
  }
}
