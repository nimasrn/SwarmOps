import { useState } from 'react'
import {
  Body,
  Columns,
  Label,
  Panel,
  Segmented,
  Select,
  Stack as Rows,
  Switch,
  useToast,
} from '@nim.zone/ui'
import { api } from '../../../data/api'
import type {
} from '../../../data/types'
import { formatBytes, shortID } from '../../../lib/format'
import { messageOf } from '../../../lib/errors'
import { useResource } from '../../../data/hooks'
import { ConfirmPhrase } from '../../../components/confirm-phrase'
import { Screen } from '../../../components/screen'
import type { DiskUsage, PruneResource } from '../../../data/types'
import { ContainersTab } from './containers'
import { ImagesTab } from './images'
import { NetworksTab } from './networks'
import { SwarmObjectsTab } from './swarm-objects'
import { VolumesTab } from './volumes'

type Toast = ReturnType<typeof useToast>

type ResourceTab = 'configs' | 'containers' | 'images' | 'networks' | 'secrets' | 'volumes'

const RESOURCE_TABS: { label: string; value: ResourceTab }[] = [
  { label: 'Containers', value: 'containers' },
  { label: 'Images', value: 'images' },
  { label: 'Volumes', value: 'volumes' },
  { label: 'Networks', value: 'networks' },
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
 * Everything the Engine is holding, and the only ways this console will delete
 * any of it.
 *
 * Reclaiming space lives HERE rather than on the health screen it used to sit
 * on. A prune is irreversible and object-shaped; putting it beside the objects
 * it destroys means the operator can see what they are about to lose, and it
 * keeps the screen people open while worried free of destructive controls.
 */
export function ResourcesPage({ toast }: { toast: Toast }) {
  const [tab, setTab] = useState<ResourceTab>('containers')
  const usage = useResource(() => api.diskUsage(), [])
  const volumes = usage.data?.Volumes ?? []
  const unreferenced = volumes.filter((volume) => (volume.UsageData?.RefCount ?? 0) === 0).length
  const containers = usage.data?.Containers ?? []
  const running = containers.filter((container) => container.State === 'running').length

  return (
    <Screen
      about="Creating or deleting any of these queues one fixed, audited command. A secret value and a config payload are never read back into the console."
      insights={[
        { hint: 'Images the Engine currently stores', icon: 'package', label: 'Images', source: 'docker system df', unmeasured: !usage.data, value: String(usage.data?.Images?.length ?? 0) },
        { hint: unreferenced ? `${unreferenced} referenced by no container` : 'Every volume is referenced', icon: 'database', label: 'Volumes', source: 'docker system df', tone: unreferenced ? 'warning' : 'neutral', unmeasured: !usage.data, value: String(volumes.length) },
        { hint: `${running} running`, icon: 'layers', label: 'Containers', source: 'docker system df', unmeasured: !usage.data, value: String(containers.length) },
        { hint: 'Total size of all image layers on this target', icon: 'trash', label: 'Image layers', source: 'docker system df', unmeasured: !usage.data, value: formatBytes(usage.data?.LayersSize ?? 0) },
      ]}
      page="resources"
      width="full"
    >
      <Segmented
        label="Resource kind"
        onChange={(value: string) => setTab(value as ResourceTab)}
        options={RESOURCE_TABS}
        value={tab}
      />
      {tab === 'containers' ? <ContainersTab toast={toast} /> : null}
      {tab === 'images' ? <ImagesTab toast={toast} /> : null}
      {tab === 'volumes' ? <VolumesTab toast={toast} /> : null}
      {tab === 'networks' ? <NetworksTab toast={toast} /> : null}
      {tab === 'secrets' ? <SwarmObjectsTab kind="secrets" toast={toast} /> : null}
      {tab === 'configs' ? <SwarmObjectsTab kind="configs" toast={toast} /> : null}

      <Panel description="Docker decides what counts as unused. SwarmOps only asks, and only after the exact phrase is typed." title="Reclaim space">
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
