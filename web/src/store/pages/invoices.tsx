import { useState } from 'react'
import { Button, Caption, DataTable, Dialog, EmptyState, OrderSummary, SectionHeader, Stack as Rows } from '@nim.zone/ui'
import type { TableColumn } from '@nim.zone/ui'
import type { CloudInvoice } from '../../data/types'
import { formatBasisPoints } from '../../lib/format'
import { useStore } from '../context'
import { StatusBadge, useStoreData } from './shared'

export function InvoicesPage() {
  const { api, locale, money, t } = useStore()
  const invoices = useStoreData(() => api.invoices())
  const [openID, setOpenID] = useState(0)
  const months = new Intl.DateTimeFormat(locale === 'fa' ? 'fa-IR' : 'en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })

  const columns: TableColumn<CloudInvoice>[] = [
    { header: t('column.number'), key: 'number', render: (row) => <span dir="ltr">{row.number}</span> },
    { header: t('column.period'), key: 'period', render: (row) => months.format(new Date(row.periodStart)) },
    { header: t('column.tax'), key: 'tax', numeric: true, render: (row) => money(row.taxRial) },
    { header: t('column.total'), key: 'total', numeric: true, render: (row) => money(row.totalRial) },
    { header: t('column.status'), key: 'status', render: (row) => <StatusBadge status={row.status} /> },
    { header: '', key: 'open', render: (row) => <Button onClick={() => setOpenID(row.id)} size="sm" variant="ghost">{t('action.view')}</Button> },
  ]

  return (
    <Rows gap="loose">
      <SectionHeader description={t('invoices.subtitle')} title={t('invoices.title')} />
      <DataTable
        columns={columns}
        empty={<EmptyState icon="document" title={t('invoices.empty')} />}
        error={invoices.error || undefined}
        loading={invoices.loading}
        rowKey={(row) => String(row.id)}
        rows={invoices.data ?? []}
      />
      {openID ? <InvoiceDialog id={openID} onClose={() => setOpenID(0)} /> : null}
    </Rows>
  )
}

function InvoiceDialog({ id, onClose }: { id: number; onClose: () => void }) {
  const { api, money, t } = useStore()
  const invoice = useStoreData(() => api.invoice(id), [id])
  const value = invoice.data
  return (
    <Dialog closeLabel={t('action.close')} onClose={onClose} open title={value ? t('invoices.detail', { number: value.number }) : t('common.loading')}>
      {value ? (
        <Rows gap="md">
          <OrderSummary
            items={(value.lines ?? []).map((line) => ({ key: String(line.id), label: line.description, meta: `${line.quantityHours} ${t('column.hours')}`, value: money(line.amountRial) }))}
            totals={[
              { key: 'subtotal', label: t('invoices.subtotal'), value: money(value.subtotalRial) },
              { key: 'tax', label: t('column.tax'), value: money(value.taxRial) },
              { emphasis: true, key: 'total', label: t('column.total'), value: money(value.totalRial) },
            ]}
          />
          <Caption tone="muted">{t('invoices.taxNote', { rate: formatBasisPoints(value.taxRateBp) })}</Caption>
        </Rows>
      ) : null}
    </Dialog>
  )
}
