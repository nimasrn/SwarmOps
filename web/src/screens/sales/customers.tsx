import { useState } from 'react'
import { Badge, Banner, Button, DataTable, Input, Panel, Stack as Rows } from '@nim.zone/ui'
import type { TableColumn, useToast } from '@nim.zone/ui'
import { api } from '../../data/api'
import { useResource } from '../../data/hooks'
import type { CloudCustomerAccount, CloudTransaction } from '../../data/types'
import { formatDateTime, formatMoney } from '../../lib/format'
import { messageOf } from '../../lib/errors'
import { ConfirmPhrase } from '../../components/confirm-phrase'
import { Screen } from '../../components/screen'
import { OrderStatus } from './status'

type Toast = ReturnType<typeof useToast>

/**
 * Customer accounts and their wallets. A balance is never edited: a
 * correction is a new ledger row with its reason, and the ledger check beside
 * each wallet says whether the balance still equals the sum of its rows.
 */
export function CustomersPage({ toast }: { toast: Toast }) {
  const customers = useResource(() => api.commerceCustomers(), [])
  const [selectedID, setSelectedID] = useState(0)
  const rows = customers.data ?? []
  const selected = rows.find((customer) => customer.userId === selectedID)

  const columns: TableColumn<CloudCustomerAccount>[] = [
    { header: 'Customer', key: 'email', render: (row) => `${row.fullName} · ${row.email}` },
    { header: 'Balance', key: 'balance', numeric: true, render: (row) => formatMoney(row.balanceRial) },
    { header: 'Live projects', key: 'projects', numeric: true, render: (row) => String(row.liveProjects) },
    { header: 'Pending orders', key: 'orders', numeric: true, render: (row) => String(row.pendingOrders) },
    { header: 'Joined', key: 'joined', render: (row) => formatDateTime(row.createdAt) },
    { header: 'Status', key: 'status', render: (row) => <OrderStatus status={row.status} /> },
    { header: '', key: 'open', render: (row) => <Button onClick={() => setSelectedID(row.userId)} size="sm" variant="secondary">Wallet</Button> },
  ]

  return (
    <Screen
      about="Balances are derived from the append-only ledger. Adjustments are recorded with their reason and audited under your name."
      insights={[
        { hint: 'Registered storefront accounts', icon: 'users', label: 'Customers', value: String(rows.length) },
        { hint: 'Money customers hold that is not yet spent', icon: 'wallet', label: 'Wallet float', value: formatMoney(rows.reduce((sum, row) => sum + row.balanceRial, 0)) },
        { hint: 'Accounts that cannot sign in', icon: 'lock', label: 'Suspended', tone: rows.some((row) => row.status === 'suspended') ? 'warning' : 'success', value: String(rows.filter((row) => row.status === 'suspended').length) },
      ]}
      page="customers"
    >
      <Panel caption={`${rows.length} accounts`} title="Customers">
        <DataTable columns={columns} empty="No customer has registered yet." error={customers.error || undefined} loading={customers.loading} rowKey={(row) => String(row.userId)} rows={rows} />
      </Panel>
      {selected ? <WalletPanel customer={selected} key={selected.userId} onChanged={customers.reload} toast={toast} /> : null}
    </Screen>
  )
}

function WalletPanel({ customer, onChanged, toast }: { customer: CloudCustomerAccount; onChanged: () => void; toast: Toast }) {
  const wallet = useResource(() => api.commerceCustomerWallet(customer.userId), [customer.userId])
  const [toman, setToman] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  const run = async (action: () => Promise<unknown>, message: string) => {
    setBusy(true)
    try {
      await action()
      toast({ message, tone: 'success' })
      setToman('')
      setReason('')
      wallet.reload()
      onChanged()
    } catch (reason) {
      toast({ duration: 0, message: messageOf(reason), tone: 'danger' })
    } finally {
      setBusy(false)
    }
  }

  const columns: TableColumn<CloudTransaction>[] = [
    { header: 'When', key: 'when', render: (row) => formatDateTime(row.createdAt) },
    { header: 'Kind', key: 'kind', render: (row) => row.kind },
    { header: 'Description', key: 'description', render: (row) => row.description },
    { header: 'Amount', key: 'amount', numeric: true, render: (row) => formatMoney(row.amountRial) },
    { header: 'Balance after', key: 'after', numeric: true, render: (row) => formatMoney(row.balanceAfterRial) },
  ]
  const amountRial = Math.round(Number(toman) * 10)
  const suspending = customer.status === 'active'

  return (
    <Panel
      actions={wallet.data ? <Badge dot variant={wallet.data.ledgerConsistent ? 'success' : 'danger'}>{wallet.data.ledgerConsistent ? 'ledger consistent' : 'ledger mismatch'}</Badge> : null}
      caption={wallet.data ? formatMoney(wallet.data.wallet.balanceRial) : undefined}
      title={`Wallet of ${customer.email}`}
    >
      <Rows>
        {wallet.error ? <Banner tone="danger">{wallet.error}</Banner> : null}
        <DataTable columns={columns} empty="No transactions." loading={wallet.loading} rowKey={(row) => String(row.id)} rows={wallet.data?.transactions ?? []} />
        <Input hint="Negative to deduct. The balance can never go below zero." inputMode="decimal" label="Adjustment (toman)" onChange={(event) => setToman(event.target.value)} value={toman} />
        <Input label="Reason (kept in the ledger)" onChange={(event) => setReason(event.target.value)} value={reason} />
        <Button
          disabled={busy || !amountRial || reason.trim().length < 5}
          onClick={() => void run(() => api.adjustCloudWallet(customer.userId, amountRial, reason, crypto.randomUUID()), 'Adjustment recorded')}
          variant="secondary"
        >
          Record adjustment
        </Button>
        <ConfirmPhrase
          action={suspending ? 'Suspend account' : 'Reactivate account'}
          busy={busy}
          compact
          consequence={suspending ? 'Ends every session of this customer and stops them signing in. Running projects are not stopped.' : 'Lets this customer sign in again.'}
          onConfirm={() => void run(() => api.setCloudCustomerStatus(customer.userId, suspending ? 'suspended' : 'active'), suspending ? 'Account suspended' : 'Account reactivated')}
          phrase={`${suspending ? 'SUSPEND' : 'REACTIVATE'}_CUSTOMER_${customer.userId}`}
        />
      </Rows>
    </Panel>
  )
}
