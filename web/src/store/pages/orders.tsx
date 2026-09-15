import { useState } from 'react'
import { Banner, Body, Button, Card, Caption, DataTable, EmptyState, Inline, SectionHeader, Stack as Rows, Stat, Title } from '@nim.zone/ui'
import type { TableColumn } from '@nim.zone/ui'
import type { CloudOrder } from '../../data/types'
import { useStore } from '../context'
import { StatusBadge, errorMessage, useStoreData } from './shared'

export function OrdersPage() {
  const { api, date, money, navigate, t } = useStore()
  const orders = useStoreData(() => api.orders())
  const [error, setError] = useState('')
  const [cancelling, setCancelling] = useState(0)

  const cancel = async (order: CloudOrder) => {
    setCancelling(order.id)
    setError('')
    try {
      await api.cancelOrder(order.id)
      orders.reload()
    } catch (reason) {
      setError(errorMessage(reason, t('common.error')))
    } finally {
      setCancelling(0)
    }
  }

  const columns: TableColumn<CloudOrder>[] = [
    { header: '#', key: 'id', render: (row) => String(row.id) },
    { header: t('column.date'), key: 'placed', render: (row) => date(row.placedAt) },
    { header: t('column.application'), key: 'app', render: (row) => <span dir="ltr">{row.items.map((item) => item.appName).join(', ')}</span> },
    { header: t('column.plan'), key: 'plan', render: (row) => row.items.map((item) => item.planName).join(', ') },
    { header: t('checkout.hourly'), key: 'price', numeric: true, render: (row) => money(row.items[0]?.hourlyPriceRial ?? 0) },
    {
      header: t('column.status'), key: 'status', render: (row) => (
        <Rows gap="tight">
          <StatusBadge status={row.status} />
          {row.reviewReason ? <Caption tone="muted">{t('orders.reason', { reason: row.reviewReason })}</Caption> : null}
        </Rows>
      ),
    },
    {
      header: '', key: 'actions', render: (row) => row.status === 'pending'
        ? <Button loading={cancelling === row.id} onClick={() => void cancel(row)} size="sm" variant="ghost">{t('action.cancelOrder')}</Button>
        : null,
    },
  ]

  return (
    <Rows gap="loose">
      <SectionHeader action={<Button onClick={() => navigate('plans')}>{t('dashboard.browse')}</Button>} description={t('orders.subtitle')} title={t('orders.title')} />
      {error ? <Banner tone="danger">{error}</Banner> : null}
      <DataTable
        columns={columns}
        empty={<EmptyState icon="package" title={t('orders.empty')} />}
        error={orders.error || undefined}
        loading={orders.loading}
        rowKey={(row) => String(row.id)}
        rows={orders.data ?? []}
      />
    </Rows>
  )
}

export function ProjectsPage() {
  const { api, date, money, navigate, t } = useStore()
  const projects = useStoreData(() => api.projects())

  return (
    <Rows gap="loose">
      <SectionHeader description={t('projects.subtitle')} title={t('projects.title')} />
      {projects.error ? <Banner tone="danger">{projects.error}</Banner> : null}
      {projects.data && projects.data.length === 0
        ? <EmptyState actions={<Button onClick={() => navigate('plans')}>{t('dashboard.browse')}</Button>} icon="layers" title={t('projects.empty')} />
        : null}
      <Rows gap="md">
        {projects.data?.map((project) => (
          <Card key={project.id}>
            <Rows gap="tight">
              <Inline wrap>
                <Title as="h3"><span dir="ltr">{project.appName}</span></Title>
                <StatusBadge status={project.status} />
              </Inline>
              <Body>{`${project.planName} · ${t('projects.rate', { price: money(project.hourlyPriceRial) })}`}</Body>
              <Inline gap="loose" wrap>
                <Stat label={t('projects.usage')} value={money(project.usageThisMonthRial)} />
                <Stat label={t('column.date')} value={date(project.activatedAt ?? project.createdAt)} />
              </Inline>
              {project.status === 'suspended'
                ? <Banner action={<Button onClick={() => navigate('wallet')} size="sm">{t('action.topUp')}</Button>} tone="warning">{t('projects.suspended')}</Banner>
                : null}
            </Rows>
          </Card>
        ))}
      </Rows>
    </Rows>
  )
}
