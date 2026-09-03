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
  RecordLink,
  Select,
  Sheet,
  Spinner,
  Stack as Rows,
  Switch,
  Facts,
  Body,
  DataTable as Table,
  useToast,
} from '@nim.zone/ui'
import type { TableColumn } from '@nim.zone/ui'
import { api } from '../../../data/api'
import type {
  NetworkDetail,
  NetworkSummary,
} from '../../../data/types'
import { formatDateTime, shortID } from '../../../lib/format'
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
  // `docker network inspect` is the only place the ATTACHED CONTAINERS live,
  // which is the one question a network row cannot answer and the one an
  // operator has before they remove it. The endpoint was served and unused.
  const [inspected, setInspected] = useState<NetworkDetail | null>(null)
  const [inspectError, setInspectError] = useState('')

  const inspect = async (network: NetworkSummary) => {
    setInspected(null)
    setInspectError('')
    setPending(`inspect-${network.Id}`)
    try {
      setInspected(await api.network(network.Id))
    } catch (reason) {
      setInspectError(messageOf(reason))
    } finally {
      setPending('')
    }
  }

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
    { header: 'Network', key: 'name', render: (network) => <RecordLink meta={`${network.Driver} · ${network.Scope}`} onClick={() => void inspect(network)} title={network.Name} /> },
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
      <Sheet closeLabel="Close the network inspector" onClose={() => { setInspected(null); setInspectError('') }} open={Boolean(inspected) || Boolean(inspectError)} title={inspected?.Name ?? 'Network'}>
        {inspectError ? <Banner tone="danger" title="This network could not be inspected">{inspectError}</Banner> : null}
        {inspected ? (
          <Rows gap="tight">
            <Facts columns={1} items={[
              { label: 'Name', mono: true, value: inspected.Name },
              { label: 'ID', mono: true, value: inspected.Id },
              { label: 'Driver', value: inspected.Driver },
              { label: 'Scope', value: inspected.Scope },
              { label: 'Subnets', mono: true, value: inspected.IPAM?.Config?.map((entry) => entry.Subnet).filter(Boolean).join(', ') || 'None assigned' },
              { label: 'Gateways', mono: true, value: inspected.IPAM?.Config?.map((entry) => entry.Gateway).filter(Boolean).join(', ') || 'None assigned' },
              { label: 'Created', value: inspected.Created ? formatDateTime(inspected.Created) : 'Not reported' },
              { label: 'Flags', value: [inspected.Ingress ? 'ingress' : '', inspected.Attachable ? 'attachable' : '', inspected.Internal ? 'internal' : ''].filter(Boolean).join(', ') || 'none' },
            ]} />
            <Body size="sm" tone="muted">
              Attached containers are those the SELECTED manager can see. On an overlay network, tasks on other nodes are
              attached too and are not listed here.
            </Body>
            <Table
              caption="Containers attached on this manager"
              columns={[
                { header: 'Container', key: 'name', render: (row: { id: string; ipv4: string; name: string }) => <Mono>{row.name}</Mono> },
                { header: 'Address', key: 'ipv4', render: (row: { id: string; ipv4: string; name: string }) => <Mono>{row.ipv4 || '—'}</Mono> },
              ]}
              empty={<EmptyState description="This manager reports nothing attached to this network." icon="external" title="Nothing attached here" />}
              rowKey={(row) => row.id}
              rows={Object.entries(inspected.Containers ?? {}).map(([id, value]) => ({ id, ipv4: value.IPv4Address, name: value.Name }))}
            />
          </Rows>
        ) : null}
      </Sheet>
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
