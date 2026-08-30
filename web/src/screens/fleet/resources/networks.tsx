import { useState } from 'react'
import {
  Badge,
  Banner,
  Button,
  Columns,
  DataTable,
  EmptyState,
  Inline,
  Input,
  Mono,
  Panel,
  Select,
  Spinner,
  Stack as Rows,
  Switch,
  useToast,
} from '@nim.zone/ui'
import type { TableColumn } from '@nim.zone/ui'
import { api } from '../../../data/api'
import type {
  NetworkSummary,
} from '../../../data/types'
import { shortID } from '../../../lib/format'
import { messageOf } from '../../../lib/errors'
import { useResource } from '../../../data/hooks'
import { ConfirmPhrase } from '../../../components/confirm-phrase'

type Toast = ReturnType<typeof useToast>

export function NetworksTab({ toast }: { toast: Toast }) {
  const { data, error, loading, reload } = useResource(() => api.networks(), [])
  const [name, setName] = useState('')
  const [driver, setDriver] = useState('overlay')
  const [attachable, setAttachable] = useState(true)
  const [internal, setInternal] = useState(false)
  const [pending, setPending] = useState('')

  const create = async () => {
    setPending('create')
    try {
      const command = await api.createNetwork({ attachable, driver, internal, name: name.trim() })
      toast({ message: `Network creation queued (${shortID(command.id)})`, tone: 'success' })
      setName('')
      await api.waitForCommand(command.id)
      await reload()
    } catch (reason) { toast({ message: messageOf(reason), tone: 'danger', duration: 0 }) } finally { setPending('') }
  }

  const columns: TableColumn<NetworkSummary>[] = [
    { header: 'Network', key: 'name', render: (network) => <Mono>{network.Name}</Mono> },
    { header: 'Driver', key: 'driver', render: (network) => network.Driver },
    { header: 'Scope', key: 'scope', render: (network) => network.Scope },
    { header: 'Subnet', key: 'subnet', render: (network) => <Mono>{network.IPAM?.Config?.map((entry) => entry.Subnet).filter(Boolean).join(', ') || '—'}</Mono> },
    { header: 'Flags', key: 'flags', render: (network) => <Inline>{network.Ingress ? <Badge>Ingress</Badge> : null}{network.Attachable ? <Badge>Attachable</Badge> : null}{network.Internal ? <Badge>Internal</Badge> : null}</Inline> },
    {
      header: '',
      key: 'actions',
      render: (network) => (network.Ingress ? null : (
        <ConfirmPhrase
          busy={pending === network.Name}
          compact
          phrase={`REMOVE_NETWORK_${network.Name.toUpperCase()}`}
          action="Delete"
          onConfirm={async (confirmation) => {
            setPending(network.Name)
            try {
              const command = await api.removeNetwork(network.Name, confirmation)
              toast({ message: `Network removal queued (${shortID(command.id)})`, tone: 'success' })
              await api.waitForCommand(command.id)
              await reload()
            } catch (reason) { toast({ message: messageOf(reason), tone: 'danger', duration: 0 }) } finally { setPending('') }
          }}
        />
      )),
    },
  ]

  if (loading && !data) return <Spinner label="Reading networks" />
  if (error) return <Banner tone="danger" title="Networks are unavailable">{error}</Banner>
  return (
    <Rows>
      <Panel eyebrow="Overlay or bridge" title="Create a network">
        <Columns>
          <Rows gap="tight">
            <Input label="Network name" onChange={(event) => setName(event.target.value)} placeholder="edge" value={name} />
            <Select
              label="Driver"
              onChange={(event) => setDriver(event.target.value)}
              options={[{ label: 'Overlay (cluster-wide)', value: 'overlay' }, { label: 'Bridge (single host)', value: 'bridge' }]}
              value={driver}
            />
          </Rows>
          <Rows gap="tight">
            <Switch checked={attachable} description="Lets standalone containers join, not only services." onChange={(event) => setAttachable(event.target.checked)}>Attachable</Switch>
            <Switch checked={internal} description="No external routing. Use for database-only networks." onChange={(event) => setInternal(event.target.checked)}>Internal</Switch>
            <Button disabled={!name.trim()} loading={pending === 'create'} onClick={() => void create()} variant="secondary">Create network</Button>
          </Rows>
        </Columns>
      </Panel>
      <Panel flush title={`Networks (${data?.length ?? 0})`}>
        <DataTable
          caption="Networks on the selected target"
          columns={columns}
          empty={<EmptyState description="This target reported no networks." icon="external" title="No networks" />}
          rowKey={(network) => network.Id}
          rows={data ?? []}
        />
      </Panel>
    </Rows>
  )
}
