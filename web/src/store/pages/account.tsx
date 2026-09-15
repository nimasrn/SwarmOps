import { useState } from 'react'
import { Banner, Button, Card, DataTable, Input, Inline, SectionHeader, Segmented, Stack as Rows, Stat } from '@nim.zone/ui'
import type { TableColumn } from '@nim.zone/ui'
import type { CloudTransaction } from '../../data/types'
import type { MessageKey } from '../i18n'
import { useStore } from '../context'
import { errorMessage, useStoreData } from './shared'

function useTransactionColumns(): TableColumn<CloudTransaction>[] {
  const { date, money, t } = useStore()
  return [
    { header: t('column.date'), key: 'date', render: (row) => date(row.createdAt) },
    { header: t('column.description'), key: 'description', render: (row) => `${t(`tx.${row.kind}` as MessageKey)} · ${row.description}` },
    { header: t('column.amount'), key: 'amount', numeric: true, render: (row) => money(row.amountRial) },
    { header: t('column.balance'), key: 'balance', numeric: true, render: (row) => money(row.balanceAfterRial) },
  ]
}

export function DashboardPage() {
  const { api, money, navigate, session, t } = useStore()
  const wallet = useStoreData(() => api.wallet())
  const projects = useStoreData(() => api.projects())
  const orders = useStoreData(() => api.orders())
  const columns = useTransactionColumns()

  return (
    <Rows gap="loose">
      <SectionHeader
        action={<Inline gap="tight"><Button onClick={() => navigate('wallet')}>{t('dashboard.topUp')}</Button><Button onClick={() => navigate('plans')} variant="secondary">{t('dashboard.browse')}</Button></Inline>}
        title={t('dashboard.welcome', { name: session?.user.fullName ?? '' })}
      />
      <Inline gap="md" wrap>
        <Card><Stat label={t('dashboard.balance')} value={wallet.data ? money(wallet.data.wallet.balanceRial) : '—'} /></Card>
        <Card><Stat label={t('dashboard.running')} value={projects.data ? String(projects.data.filter((project) => project.status === 'active').length) : '—'} /></Card>
        <Card><Stat label={t('dashboard.pending')} value={orders.data ? String(orders.data.filter((order) => order.status === 'pending').length) : '—'} /></Card>
      </Inline>
      <SectionHeader title={t('dashboard.recent')} />
      <DataTable
        columns={columns}
        empty={t('wallet.empty')}
        error={wallet.error || undefined}
        loading={wallet.loading}
        rowKey={(row) => String(row.id)}
        rows={wallet.data?.transactions.slice(0, 5) ?? []}
      />
    </Rows>
  )
}

/** Top-up amounts offered as one tap, in tomans. */
const PRESETS = [100_000, 500_000, 1_000_000]

export function WalletPage() {
  const { api, locale, money, t } = useStore()
  const wallet = useStoreData(() => api.wallet())
  const columns = useTransactionColumns()
  const [preset, setPreset] = useState(String(PRESETS[1]))
  const [custom, setCustom] = useState('')
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<{ text: string; tone: 'danger' | 'success' } | null>(null)
  const toman = custom ? Number(custom) : Number(preset)

  const topUp = async () => {
    setPending(true)
    setMessage(null)
    try {
      await api.topUp(toman * 10)
      setMessage({ text: t('wallet.toppedUp'), tone: 'success' })
      setCustom('')
      wallet.reload()
    } catch (reason) {
      setMessage({ text: errorMessage(reason, t('common.error')), tone: 'danger' })
    } finally {
      setPending(false)
    }
  }

  const numbers = new Intl.NumberFormat(locale === 'fa' ? 'fa-IR' : 'en-US')
  return (
    <Rows gap="loose">
      <SectionHeader description={t('wallet.subtitle')} title={t('wallet.title')} />
      <Card>
        <Rows gap="md">
          <Stat label={t('dashboard.balance')} value={wallet.data ? money(wallet.data.wallet.balanceRial) : '—'} />
          <Banner tone="info">{t('wallet.simulated')}</Banner>
          {message ? <Banner tone={message.tone}>{message.text}</Banner> : null}
          <Segmented
            label={t('field.amount')}
            onChange={(value) => { setPreset(value); setCustom('') }}
            options={PRESETS.map((value) => ({ label: numbers.format(value), value: String(value) }))}
            value={custom ? '' : preset}
          />
          <Input dir="ltr" inputMode="numeric" label={t('wallet.custom')} min={10_000} onChange={(event) => setCustom(event.target.value.replace(/[^0-9]/g, ''))} value={custom} />
          <Button disabled={!toman || toman < 10_000} loading={pending} onClick={() => void topUp()}>{`${t('action.topUp')} · ${money(toman * 10)}`}</Button>
        </Rows>
      </Card>
      <SectionHeader title={t('wallet.history')} />
      <DataTable
        columns={columns}
        empty={t('wallet.empty')}
        error={wallet.error || undefined}
        loading={wallet.loading}
        rowKey={(row) => String(row.id)}
        rows={wallet.data?.transactions ?? []}
      />
    </Rows>
  )
}
