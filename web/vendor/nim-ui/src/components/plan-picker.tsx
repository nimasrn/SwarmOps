import { useState } from 'react'
import type { ReactNode } from 'react'
import { Button } from '@/components/button'
import { PlanCard, type PlanCardProps } from '@/components/plan-card'
import { Segmented } from '@/components/segmented'
import { cn } from '@/lib/cn'

export interface BillingCycle {
  id: string
  label: string
  /** "Save 15%" — the reason to pick the longer commitment. */
  note?: string
}

export interface PlanOffer
  extends Omit<PlanCardProps, 'onSelect' | 'price' | 'secondary' | 'selected'> {
  id: string
  /** Price per billing cycle, keyed by cycle id. Already formatted: currency
      and digit shaping are the product's locale decision, not the kit's. */
  prices: Record<string, { monthly?: ReactNode; price: ReactNode }>
}

export interface PlanPickerProps {
  className?: string
  /** Billing periods. One cycle, or none at all, hides the switch. */
  cycles?: BillingCycle[]
  cycle?: string
  defaultCycle?: string
  defaultPlan?: string
  labels?: { cycle: string; monthly: string; price: string }
  /** Fine print under the action — renewal terms, store rules. */
  note?: ReactNode
  onCycleChange?: (cycle: string) => void
  onPlanChange?: (plan: string) => void
  /** Fires with the chosen plan and cycle. Payment is the app's business. */
  onSubmit?: (plan: string, cycle: string) => void
  plans: PlanOffer[]
  plan?: string
  submitLabel?: string
}

const DEFAULT_LABELS = {
  cycle: 'Billing period',
  monthly: 'Per month',
  price: 'This package',
}

/**
 * The subscription screen: billing period, the tiers, and one action.
 *
 * Ready to mount — it holds the selection, keeps the cycle and the prices in
 * step, and hands `onSubmit` the pair the checkout needs. Pass `plan`/`cycle`
 * to drive it from outside instead, e.g. when a deep link opens the screen on
 * a specific tier.
 *
 * It deliberately does not take a payment handler, a store SDK, or a currency:
 * a plan picker that also knows how to charge is two screens welded together,
 * and only one of them is the same across products.
 */
export function PlanPicker({
  className,
  cycle,
  cycles = [],
  defaultCycle,
  defaultPlan,
  labels,
  note,
  onCycleChange,
  onPlanChange,
  onSubmit,
  plan,
  plans,
  submitLabel,
}: PlanPickerProps) {
  const text = { ...DEFAULT_LABELS, ...labels }
  const [ownCycle, setOwnCycle] = useState(defaultCycle ?? cycles[0]?.id ?? '')
  const [ownPlan, setOwnPlan] = useState(defaultPlan ?? plans[0]?.id ?? '')
  const activeCycle = cycle ?? ownCycle
  const activePlan = plan ?? ownPlan

  const choose = (next: string) => {
    setOwnPlan(next)
    onPlanChange?.(next)
  }

  const switchCycle = (next: string) => {
    setOwnCycle(next)
    onCycleChange?.(next)
  }

  const current = cycles.find((item) => item.id === activeCycle)

  return (
    <section className={cn('nim-plan-picker', className)}>
      {cycles.length > 1 ? (
        <div className="nim-plan-picker__cycles">
          <Segmented
            fullWidth
            label={text.cycle}
            onChange={switchCycle}
            options={cycles.map((item) => ({ label: item.label, value: item.id }))}
            value={activeCycle}
          />
          {current?.note ? <p className="nim-plan-picker__save">{current.note}</p> : null}
        </div>
      ) : null}

      <div className="nim-plan-picker__plans">
        {plans.map(({ id, prices, ...card }) => {
          const price = prices[activeCycle] ?? Object.values(prices)[0]
          return (
            <PlanCard
              {...card}
              key={id}
              onSelect={() => choose(id)}
              price={price?.price ?? ''}
              priceCaption={text.price}
              secondary={
                price?.monthly === undefined
                  ? undefined
                  : { caption: text.monthly, value: price.monthly }
              }
              selected={id === activePlan}
            />
          )
        })}
      </div>

      {submitLabel ? (
        <div className="nim-plan-picker__foot">
          <Button
            fullWidth
            onClick={() => onSubmit?.(activePlan, activeCycle)}
            size="lg"
            variant="accent"
          >
            {submitLabel}
          </Button>
          {note ? <p className="nim-plan-picker__note">{note}</p> : null}
        </div>
      ) : null}
    </section>
  )
}
