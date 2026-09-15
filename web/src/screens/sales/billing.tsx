import { useState } from 'react'
import { Banner, Button, DataTable, Input, OrderSummary, Panel, Toolbar } from '@nim.zone/ui'
import type { TableColumn, useToast } from '@nim.zone/ui'
import { api } from '../../data/api'
import { useResource } from '../../data/hooks'
import type { CloudInvoice, CloudProject, CloudRevenueMonth } from '../../data/types'
import { formatBasisPoints, formatDateTime, formatMoney } from '../../lib/format'
import { messageOf } from '../../lib/errors'
import { Screen } from '../../components/screen'
import { OrderStatus } from './status'

type Toast = ReturnType<typeof useToast>

/**
 * Where the money comes from. Core bills every running project each hour on
 * its own; the buttons here run the same idempotent jobs on demand, so pressing
 * one twice charges nothing twice.
 */
export function BillingPage({ toast }: { toast: Toast }) {
  const overview = useResource(() => api.commerceOverview(), [])
  const projects = useResource(() => api.commerceProjects(), [])
  const invoices = useResource(() => api.commerceInvoices(), [])
  const revenue = useResource(() => api.commerceRevenue(), [])
  const [month, setMonth] = useState(() => new Date(Date.now() - 28 * 86_400_000).toISOString().slice(0, 7))
  const [busy, setBusy] = useState(false)
  const [invoiceID, setInvoiceID] = useState(0)

  const reload = () => { overview.reload(); projects.reload(); invoices.reload(); revenue.reload() }
  const run = async (action: () => Promise<string>) => {
    setBusy(true)
    try {
      toast({ message: await action(), tone: 'success' })
      reload()
    } catch (reason) {
      toast({ duration: 0, message: messageOf(reason), tone: 'danger' })
    } finally {
      setBusy(false)
    }
  }

  const projectColumns: TableColumn<CloudProject>[] = [
    { header: 'Application', key: 'app', render: (row) => row.appName },
    { header: 'Plan', key: 'plan', render: (row) => row.planName },
    { header: 'Server', key: 'server', render: (row) => row.serverId },
    { header: 'Per hour', key: 'rate', numeric: true, render: (row) => formatMoney(row.hourlyPriceRial) },
    { header: 'This month', key: 'usage', numeric: true, render: (row) => formatMoney(row.usageThisMonthRial) },
    { header: 'Status', key: 'status', render: (row) => <OrderStatus status={row.status} /> },
  ]
  const invoiceColumns: TableColumn<CloudInvoice>[] = [
    { header: 'Number', key: 'number', render: (row) => row.number },
    { header: 'Customer', key: 'user', render: (row) => `user ${row.userId}` },
    { header: 'Period', key: 'period', render: (row) => row.periodStart.slice(0, 7) },
    { header: 'Tax', key: 'tax', numeric: true, render: (row) => `${formatMoney(row.taxRial)} (${formatBasisPoints(row.taxRateBp)})` },
    { header: 'Total', key: 'total', numeric: true, render: (row) => formatMoney(row.totalRial) },
    { header: 'Issued', key: 'issued', render: (row) => formatDateTime(row.issuedAt) },
    { header: '', key: 'open', render: (row) => <Button onClick={() => setInvoiceID(row.id)} size="sm" variant="secondary">Lines</Button> },
  ]
  const revenueColumns: TableColumn<CloudRevenueMonth>[] = [
    { header: 'Month', key: 'month', render: (row) => row.month },
    { header: 'Charged', key: 'charged', numeric: true, render: (row) => formatMoney(row.chargedRial) },
    { header: 'Refunded', key: 'refunded', numeric: true, render: (row) => formatMoney(row.refundedRial) },
    { header: 'Topped up', key: 'topped', numeric: true, render: (row) => formatMoney(row.toppedUpRial) },
    { header: 'Paying customers', key: 'customers', numeric: true, render: (row) => String(row.payingCustomers) },
  ]
  const figures = overview.data

  return (
    <Screen
      about="Prices include value-added tax; invoices state the tax contained in each total. Charges come from prepaid wallets, so every invoice is issued as paid."
      insights={[
        { hint: 'Charges less refunds since the first of the month', icon: 'trend-up', label: 'Revenue this month', value: figures ? formatMoney(figures.revenueThisMonthRial) : '—' },
        { hint: 'Projects billed by the hour', icon: 'layers', label: 'Active projects', tone: 'success', value: figures ? String(figures.activeProjects) : '—' },
        { hint: 'Stopped because the wallet could not pay', icon: 'alert', label: 'Suspended', tone: figures?.suspendedProjects ? 'warning' : 'success', value: figures ? String(figures.suspendedProjects) : '—' },
        { hint: 'Prepaid balance not yet spent', icon: 'wallet', label: 'Wallet float', value: figures ? formatMoney(figures.walletFloatRial) : '—' },
      ]}
      page="billing"
    >
      <Panel title="Billing jobs">
        <Toolbar actions={<Button disabled={busy} onClick={() => void run(async () => {
          const result = await api.runCloudBilling()
          return `Charged ${result.chargedHours} hours (${formatMoney(result.chargedRial)}); ${result.suspended} suspended`
        })} variant="secondary">Run billing now</Button>}>
          <Input aria-label="Invoice month" onChange={(event) => setMonth(event.target.value)} type="month" value={month} />
          <Button disabled={busy || !month} onClick={() => void run(async () => `Issued ${(await api.issueCloudInvoices(month)).issued} invoices for ${month}`)} variant="secondary">Issue invoices</Button>
        </Toolbar>
      </Panel>
      <Panel title="Projects">
        <DataTable columns={projectColumns} empty="No projects yet." error={projects.error || undefined} loading={projects.loading} rowKey={(row) => String(row.id)} rows={projects.data ?? []} />
      </Panel>
      <Panel title="Revenue by month">
        <DataTable columns={revenueColumns} empty="No money has moved yet." error={revenue.error || undefined} loading={revenue.loading} rowKey={(row) => row.month} rows={revenue.data ?? []} />
      </Panel>
      <Panel title="Invoices">
        <DataTable columns={invoiceColumns} empty="No invoices have been issued." error={invoices.error || undefined} loading={invoices.loading} rowKey={(row) => String(row.id)} rows={invoices.data ?? []} />
      </Panel>
      {invoiceID ? <InvoiceLines id={invoiceID} key={invoiceID} /> : null}
    </Screen>
  )
}

/** One invoice's lines: which project, how many hours, and what they cost. */
function InvoiceLines({ id }: { id: number }) {
  const invoice = useResource(() => api.commerceInvoice(id), [id])
  const value = invoice.data
  return (
    <Panel caption={value ? `${value.periodStart.slice(0, 7)} · user ${value.userId}` : undefined} title={value ? `Invoice ${value.number}` : 'Loading invoice'}>
      {invoice.error ? <Banner tone="danger">{invoice.error}</Banner> : null}
      {value ? (
        <OrderSummary
          items={(value.lines ?? []).map((line) => ({ key: String(line.id), label: line.description, meta: `${line.quantityHours} hours`, value: formatMoney(line.amountRial) }))}
          totals={[
            { key: 'subtotal', label: 'Subtotal', value: formatMoney(value.subtotalRial) },
            { key: 'tax', label: `Tax included (${formatBasisPoints(value.taxRateBp)})`, value: formatMoney(value.taxRial) },
            { emphasis: true, key: 'total', label: 'Total paid from the wallet', value: formatMoney(value.totalRial) },
          ]}
        />
      ) : null}
    </Panel>
  )
}
