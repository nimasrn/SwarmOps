import { useState } from 'react'
import { Banner, Button, DataTable, Input, Panel, Segmented, Select, Stack as Rows, Toolbar } from '@nim.zone/ui'
import type { TableColumn, useToast } from '@nim.zone/ui'
import { api } from '../../data/api'
import { useResource } from '../../data/hooks'
import type { CloudOrder, Server } from '../../data/types'
import { formatDateTime, formatMoney, shortID } from '../../lib/format'
import { messageOf } from '../../lib/errors'
import { ConfirmPhrase } from '../../components/confirm-phrase'
import { Screen } from '../../components/screen'
import { OrderStatus } from './status'

type Toast = ReturnType<typeof useToast>

const FILTERS = ['pending', 'provisioning', 'active', 'failed', 'rejected', 'cancelled'] as const

/**
 * The review queue for SwarmOps Cloud orders.
 *
 * Confirming is the one decision here with an effect outside the database: in
 * a single transaction it charges the customer's wallet and queues the
 * application's deployment on the chosen server. It therefore uses the
 * console's confirmation phrase, and the deployment it queues appears in Runs
 * like any other.
 */
export function OrdersPage({ servers, toast }: { servers: Server[]; toast: Toast }) {
  const [status, setStatus] = useState<string>('pending')
  const orders = useResource(() => api.commerceOrders(status), [status])
  const all = useResource(() => api.commerceOrders(), [])
  const [selectedID, setSelectedID] = useState(0)
  const rows = orders.data ?? []
  const selected = rows.find((order) => order.id === selectedID)
  const counts = (value: string) => (all.data ?? []).filter((order) => order.status === value).length

  const columns: TableColumn<CloudOrder>[] = [
    { header: 'Order', key: 'id', render: (row) => `#${row.id}` },
    { header: 'Customer', key: 'customer', render: (row) => row.customerEmail ?? `user ${row.userId}` },
    { header: 'Application', key: 'app', render: (row) => row.items.map((item) => item.appName).join(', ') },
    { header: 'Plan', key: 'plan', render: (row) => row.items.map((item) => item.planName).join(', ') },
    { header: 'Per hour', key: 'price', numeric: true, render: (row) => formatMoney(row.items[0]?.hourlyPriceRial ?? 0) },
    { header: 'Placed', key: 'placed', render: (row) => formatDateTime(row.placedAt) },
    { header: 'Status', key: 'status', render: (row) => <OrderStatus status={row.status} /> },
    { header: '', key: 'review', render: (row) => row.status === 'pending' ? <Button onClick={() => setSelectedID(row.id)} size="sm" variant="secondary">Review</Button> : null },
  ]

  const refresh = () => { orders.reload(); all.reload() }

  return (
    <Screen
      about="Confirming charges the first hour and queues the deployment together, in one database transaction: if either cannot happen, neither does."
      insights={[
        { hint: 'Orders waiting for a decision', icon: 'clock', label: 'Pending', tone: counts('pending') ? 'warning' : 'success', value: String(counts('pending')) },
        { hint: 'Confirmed; the deployment is running', icon: 'loading', label: 'Deploying', value: String(counts('provisioning')) },
        { hint: 'Deployed and billed by the hour', icon: 'check-circle', label: 'Active', tone: 'success', value: String(counts('active')) },
        { hint: 'Deployments that did not succeed and were refunded', icon: 'danger', label: 'Failed', tone: counts('failed') ? 'danger' : 'neutral', value: String(counts('failed')) },
      ]}
      page="orders"
    >
      <Panel caption={`${rows.length} shown`} title="Orders">
        <Toolbar actions={<Button onClick={refresh} variant="secondary">Refresh</Button>}>
          <Segmented label="Order status" onChange={(value) => { setStatus(value); setSelectedID(0) }} options={FILTERS.map((value) => ({ label: value, value }))} value={status} />
        </Toolbar>
        <DataTable columns={columns} empty="No orders in this state." error={orders.error || undefined} loading={orders.loading} rowKey={(row) => String(row.id)} rows={rows} />
      </Panel>
      {selected ? <ReviewPanel key={selected.id} onDone={() => { setSelectedID(0); refresh() }} order={selected} servers={servers} toast={toast} /> : null}
    </Screen>
  )
}

function ReviewPanel({ onDone, order, servers, toast }: { onDone: () => void; order: CloudOrder; servers: Server[]; toast: Toast }) {
  const eligible = servers.filter((server) => server.connectionState === 'connected' && server.swarmControlAvailable)
  const [serverID, setServerID] = useState(eligible[0]?.id ?? '')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const item = order.items[0]

  const confirm = async () => {
    setBusy(true)
    try {
      const result = await api.confirmCloudOrder(order.id, serverID)
      toast({ message: `Order #${order.id} confirmed; deployment ${shortID(result.command.id)} queued`, tone: 'success' })
      onDone()
    } catch (reason) {
      toast({ duration: 0, message: messageOf(reason), tone: 'danger' })
    } finally {
      setBusy(false)
    }
  }

  const reject = async () => {
    setBusy(true)
    try {
      await api.rejectCloudOrder(order.id, reason)
      toast({ message: `Order #${order.id} rejected`, tone: 'neutral' })
      onDone()
    } catch (reason) {
      toast({ duration: 0, message: messageOf(reason), tone: 'danger' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Panel description={`${order.customerEmail ?? ''} ordered ${item?.appName ?? ''} (${item?.image ?? ''}, port ${item?.port ?? ''}) on the ${item?.planName ?? ''} plan.`} title={`Review order #${order.id}`}>
      <Rows>
        {order.customerNote ? <Banner title="Customer note" tone="info">{order.customerNote}</Banner> : null}
        {eligible.length === 0
          ? <Banner title="No server can take this deployment" tone="warning">Connect a Swarm manager under Machines before confirming.</Banner>
          : <Select label="Deploy on" onChange={(event) => setServerID(event.target.value)} options={eligible.map((server) => ({ label: server.name, value: server.id }))} value={serverID} />}
        <ConfirmPhrase
          action="Confirm and deploy"
          busy={busy}
          consequence={`Charges ${formatMoney(item?.hourlyPriceRial ?? 0)} for the first hour and queues the deployment of ${item?.appName ?? 'the application'}. A deployment that does not succeed is refunded.`}
          disabled={!serverID}
          onConfirm={() => void confirm()}
          phrase={`CONFIRM_ORDER_${order.id}`}
        />
        <Input label="Reason for rejecting (sent to the customer)" onChange={(event) => setReason(event.target.value)} value={reason} />
        <Button disabled={busy || reason.trim().length < 5} onClick={() => void reject()} variant="secondary">Reject order</Button>
      </Rows>
    </Panel>
  )
}
