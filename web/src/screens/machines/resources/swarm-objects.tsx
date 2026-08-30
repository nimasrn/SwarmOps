import { useState } from 'react'
import {
  Banner,
  DataTable,
  EmptyState,
  Mono,
  Panel,
  Spinner,
  Stack as Rows,
  useToast,
} from '@nim.zone/ui'
import type { TableColumn } from '@nim.zone/ui'
import { api } from '../../../data/api'
import type {
  SwarmObjectMeta,
} from '../../../data/types'
import { formatDateTime, shortID } from '../../../lib/format'
import { messageOf } from '../../../lib/errors'
import { useResource } from '../../../data/hooks'
import { ConfirmPhrase } from '../../../components/confirm-phrase'

type Toast = ReturnType<typeof useToast>

export function SwarmObjectsTab({ kind, toast }: { kind: 'configs' | 'secrets'; toast: Toast }) {
  const { data, error, loading, reload } = useResource(() => (kind === 'secrets' ? api.secrets() : api.configs()), [kind])
  const [pending, setPending] = useState('')

  const columns: TableColumn<SwarmObjectMeta>[] = [
    { header: 'Name', key: 'name', render: (item) => <Mono>{item.Spec.Name}</Mono> },
    { header: 'Created', key: 'created', render: (item) => formatDateTime(item.CreatedAt) },
    { header: 'Updated', key: 'updated', render: (item) => formatDateTime(item.UpdatedAt) },
    { header: 'Version', key: 'version', numeric: true, render: (item) => String(item.Version.Index) },
    ...(kind === 'configs'
      ? [{
        header: '',
        key: 'actions',
        render: (item: SwarmObjectMeta) => (
          <ConfirmPhrase
            busy={pending === item.Spec.Name}
            compact
            phrase={`REMOVE_CONFIG_${item.Spec.Name.toUpperCase()}`}
            action="Delete"
            onConfirm={async (confirmation) => {
              setPending(item.Spec.Name)
              try {
                const command = await api.removeConfig(item.Spec.Name, confirmation)
                toast({ message: `Config removal queued (${shortID(command.id)})`, tone: 'success' })
                await api.waitForCommand(command.id)
                await reload()
              } catch (reason) { toast({ message: messageOf(reason), tone: 'danger', duration: 0 }) } finally { setPending('') }
            }}
          />
        ),
      } satisfies TableColumn<SwarmObjectMeta>]
      : []),
  ]

  if (loading && !data) return <Spinner label={`Reading ${kind}`} />
  if (error) return <Banner tone="danger" title={`${kind === 'secrets' ? 'Secrets' : 'Configs'} are unavailable`}>{error}</Banner>
  return (
    <Rows>
      <Banner tone="info" title={kind === 'secrets' ? 'Secret values are never readable' : 'Config payloads are not shown'}>
        {kind === 'secrets'
          ? 'Docker does not return a secret value once it is created, and SwarmOps does not keep a copy. Only names and versions appear here; a managed credential is rotated by redeploying the database that owns it.'
          : 'A config payload is operator material, so the console lists names and versions only. SwarmOps writes its own Traefik config objects during a reconcile.'}
      </Banner>
      <Panel flush title={`${kind === 'secrets' ? 'Secrets' : 'Configs'} (${data?.length ?? 0})`}>
        <DataTable
          caption={`Swarm ${kind} on the selected target`}
          columns={columns}
          empty={<EmptyState description={`This cluster holds no ${kind}.`} icon="document" title={`No ${kind}`} />}
          rowKey={(item) => item.ID}
          rows={data ?? []}
        />
      </Panel>
    </Rows>
  )
}
