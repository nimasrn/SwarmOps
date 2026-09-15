import { useState } from 'react'
import { Button, DataTable, Input, Panel, Segmented, Stack as Rows, Textarea, Toolbar } from '@nim.zone/ui'
import type { TableColumn, useToast } from '@nim.zone/ui'
import { api } from '../../data/api'
import { useResource } from '../../data/hooks'
import type { CloudPlan, CloudPlanInput } from '../../data/types'
import { formatMoney } from '../../lib/format'
import { messageOf } from '../../lib/errors'
import { Screen } from '../../components/screen'
import { OrderStatus } from './status'

type Toast = ReturnType<typeof useToast>

const BLANK: CloudPlanInput = {
  active: true, code: '', cpuMillicores: 500, description: '', diskGiB: 10, features: [], hourlyPriceRial: 10_000,
  memoryMiB: 512, monthlyPriceRial: 6_000_000, name: '', sortOrder: 100,
}

/**
 * The storefront catalogue. Changing a price never alters an order already
 * placed: every order copies the prices it was placed at.
 */
export function PlansPage({ toast }: { toast: Toast }) {
  const plans = useResource(() => api.commercePlans(), [])
  const [editing, setEditing] = useState<CloudPlanInput | null>(null)
  const rows = plans.data ?? []

  const columns: TableColumn<CloudPlan>[] = [
    { header: 'Plan', key: 'name', render: (row) => `${row.name} (${row.code})` },
    { header: 'CPU', key: 'cpu', numeric: true, render: (row) => `${row.cpuMillicores / 1000} vCPU` },
    { header: 'Memory', key: 'memory', numeric: true, render: (row) => `${row.memoryMiB} MiB` },
    { header: 'Per hour', key: 'hourly', numeric: true, render: (row) => formatMoney(row.hourlyPriceRial) },
    { header: 'Monthly cap', key: 'monthly', numeric: true, render: (row) => formatMoney(row.monthlyPriceRial) },
    { header: 'Offered', key: 'active', render: (row) => <OrderStatus status={row.active ? 'active' : 'cancelled'} /> },
    { header: '', key: 'edit', render: (row) => <Button onClick={() => setEditing({ ...row })} size="sm" variant="secondary">Edit</Button> },
  ]

  return (
    <Screen
      about="A plan's CPU and memory become the application's reservation and hard limit when an order for it is deployed."
      insights={[
        { hint: 'Plans customers can order now', icon: 'tag', label: 'Offered', value: String(rows.filter((plan) => plan.active).length) },
        { hint: 'Kept for existing orders, hidden from the storefront', icon: 'eye', label: 'Withdrawn', value: String(rows.filter((plan) => !plan.active).length) },
      ]}
      page="plans"
    >
      <Panel title="Catalogue">
        <Toolbar actions={<Button onClick={() => setEditing({ ...BLANK })}>New plan</Button>} />
        <DataTable columns={columns} empty="No plans." error={plans.error || undefined} loading={plans.loading} rowKey={(row) => row.code} rows={rows} />
      </Panel>
      {editing ? <PlanEditor input={editing} key={editing.code || 'new'} onDone={() => { setEditing(null); plans.reload() }} toast={toast} /> : null}
    </Screen>
  )
}

function PlanEditor({ input, onDone, toast }: { input: CloudPlanInput; onDone: () => void; toast: Toast }) {
  const [plan, setPlan] = useState(input)
  const [features, setFeatures] = useState(input.features.join('\n'))
  const [busy, setBusy] = useState(false)
  const set = <K extends keyof CloudPlanInput>(key: K, value: CloudPlanInput[K]) => setPlan((current) => ({ ...current, [key]: value }))

  const save = async () => {
    setBusy(true)
    try {
      await api.saveCloudPlan({ ...plan, features: features.split('\n').map((line) => line.trim()).filter(Boolean) })
      toast({ message: `Plan ${plan.code} saved`, tone: 'success' })
      onDone()
    } catch (reason) {
      toast({ duration: 0, message: messageOf(reason), tone: 'danger' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Panel title={input.code ? `Edit ${input.name}` : 'New plan'}>
      <Rows>
        <Input disabled={Boolean(input.code)} label="Code" onChange={(event) => set('code', event.target.value.toLowerCase())} value={plan.code} />
        <Input label="Name" onChange={(event) => set('name', event.target.value)} value={plan.name} />
        <Input label="Description" onChange={(event) => set('description', event.target.value)} value={plan.description} />
        <Input label="CPU (millicores)" onChange={(event) => set('cpuMillicores', Number(event.target.value))} type="number" value={String(plan.cpuMillicores)} />
        <Input label="Memory (MiB)" onChange={(event) => set('memoryMiB', Number(event.target.value))} type="number" value={String(plan.memoryMiB)} />
        <Input label="Disk (GiB)" onChange={(event) => set('diskGiB', Number(event.target.value))} type="number" value={String(plan.diskGiB)} />
        <Input hint={formatMoney(plan.hourlyPriceRial)} label="Price per hour (rial)" onChange={(event) => set('hourlyPriceRial', Number(event.target.value))} type="number" value={String(plan.hourlyPriceRial)} />
        <Input hint={formatMoney(plan.monthlyPriceRial)} label="Monthly cap (rial)" onChange={(event) => set('monthlyPriceRial', Number(event.target.value))} type="number" value={String(plan.monthlyPriceRial)} />
        <Input label="Display order" onChange={(event) => set('sortOrder', Number(event.target.value))} type="number" value={String(plan.sortOrder)} />
        <Textarea hint="One feature per line." label="Features" onChange={(event) => setFeatures(event.target.value)} value={features} />
        <Segmented
          label="Storefront availability"
          onChange={(value) => set('active', value === 'offered')}
          options={[{ label: 'Offered', value: 'offered' }, { label: 'Withdrawn', value: 'withdrawn' }]}
          value={plan.active ? 'offered' : 'withdrawn'}
        />
        <Button disabled={busy || !plan.code || !plan.name} onClick={() => void save()}>Save plan</Button>
      </Rows>
    </Panel>
  )
}
