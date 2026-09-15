import { useState } from 'react'
import type { FormEvent } from 'react'
import { Banner, Button, Card, EmptyState, Input, OrderSummary, PlanCard, SectionHeader, Stack as Rows, Textarea } from '@nim.zone/ui'
import type { CloudPlan } from '../../data/types'
import { useStore } from '../context'
import { errorMessage, useStoreData } from './shared'

/** Hours of a plan a wallet must hold when an order is approved. */
const RESERVE_HOURS = 24

export function CataloguePage() {
  const { api, locale, money, navigate, session, t } = useStore()
  const plans = useStoreData(() => api.plans())

  return (
    <Rows gap="loose">
      <SectionHeader description={t('plans.subtitle')} title={t('plans.title')} />
      {plans.error ? <Banner tone="danger">{plans.error}</Banner> : null}
      {plans.loading && !plans.data ? <Card>{t('common.loading')}</Card> : null}
      {plans.data && plans.data.length === 0 ? <EmptyState icon="tag" title={t('plans.title')} /> : null}
      <Rows gap="md">
        {plans.data?.map((plan) => (
          <PlanCard
            features={[
              { label: t('plans.cpu', { value: plan.cpuMillicores / 1000 }) },
              { label: t('plans.memory', { value: plan.memoryMiB }) },
              { label: t('plans.disk', { value: plan.diskGiB }) },
              ...(locale === 'fa' && plan.featuresFa.length ? plan.featuresFa : plan.features).map((feature) => ({ label: feature })),
            ]}
            key={plan.code}
            name={plan.name}
            onSelect={() => navigate(session ? `checkout/${plan.code}` : 'signin')}
            price={money(plan.hourlyPriceRial)}
            priceCaption={t('plans.perHour')}
            secondary={{ caption: t('plans.monthlyCap'), value: money(plan.monthlyPriceRial) }}
            tagline={locale === 'fa' ? plan.descriptionFa || undefined : plan.description}
          />
        ))}
      </Rows>
    </Rows>
  )
}

export function CheckoutPage({ planCode }: { planCode: string }) {
  const { api, money, navigate, t } = useStore()
  const plans = useStoreData(() => api.plans())
  const plan = plans.data?.find((candidate) => candidate.code === planCode)

  if (plans.error) return <Banner tone="danger">{plans.error}</Banner>
  if (!plans.data) return <Card>{t('common.loading')}</Card>
  if (!plan) return <EmptyState actions={<Button onClick={() => navigate('plans')}>{t('nav.plans')}</Button>} icon="tag" title={t('plans.title')} />
  return <CheckoutForm money={money} plan={plan} />
}

function CheckoutForm({ money, plan }: { money: (rial: number) => string; plan: CloudPlan }) {
  const { api, navigate, t } = useStore()
  const [appName, setAppName] = useState('')
  const [image, setImage] = useState('')
  const [port, setPort] = useState('8080')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [field, setField] = useState('')
  const [pending, setPending] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setPending(true)
    setError('')
    setField('')
    try {
      await api.placeOrder({ appName, image, note, planCode: plan.code, port: Number(port) })
      navigate('orders')
    } catch (reason) {
      setError(errorMessage(reason, t('common.error')))
      setField(reason instanceof Error && 'field' in reason ? String((reason as { field?: string }).field ?? '') : '')
    } finally {
      setPending(false)
    }
  }

  return (
    <Rows gap="loose">
      <SectionHeader action={<Button onClick={() => navigate('plans')} variant="ghost">{t('action.back')}</Button>} description={t('checkout.review')} title={t('checkout.title', { plan: plan.name })} />
      <OrderSummary
        items={[
          { key: 'hourly', label: t('checkout.hourly'), value: money(plan.hourlyPriceRial) },
          { key: 'cap', label: t('checkout.cap'), value: money(plan.monthlyPriceRial) },
        ]}
        title={t('checkout.summary')}
        totals={[{ emphasis: true, key: 'reserve', label: t('checkout.reserve'), value: money(plan.hourlyPriceRial * RESERVE_HOURS) }]}
      />
      <Card>
        <form onSubmit={(event) => void submit(event)}>
          <Rows gap="md">
            {error ? <Banner tone="danger">{error}</Banner> : null}
            <Input dir="ltr" error={field === 'application' ? error : undefined} hint={t('field.appNameHint')} label={t('field.appName')} maxLength={41} onChange={(event) => setAppName(event.target.value.toLowerCase())} required value={appName} />
            <Input dir="ltr" hint={t('field.imageHint')} label={t('field.image')} onChange={(event) => setImage(event.target.value)} required value={image} />
            <Input dir="ltr" inputMode="numeric" label={t('field.port')} max={65535} min={1} onChange={(event) => setPort(event.target.value)} required type="number" value={port} />
            <Textarea label={t('field.note')} maxLength={500} onChange={(event) => setNote(event.target.value)} rows={3} value={note} />
            <Button disabled={!appName || !image || !port} loading={pending} type="submit">{t('action.placeOrder')}</Button>
          </Rows>
        </form>
      </Card>
    </Rows>
  )
}
