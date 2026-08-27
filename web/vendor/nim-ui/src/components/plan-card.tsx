import type { ReactNode } from 'react'
import { Icon, type IconName } from '@/components/icon'
import { cn } from '@/lib/cn'

export interface PlanFeature {
  label: ReactNode
  /** `included` is shipped, `pending` is bought but not released yet, and
      `excluded` is what this plan does not get. All three are worth showing:
      a plan card that lists only wins tells the viewer nothing to choose on. */
  state?: 'excluded' | 'included' | 'pending'
  /** A short status word beside a pending row — "soon", "beta". */
  note?: string
}

export interface PlanCardProps {
  /** The one plan being recommended. At most one card in a set. */
  badge?: string
  className?: string
  features?: PlanFeature[]
  icon?: IconName
  /** The headline figure, already formatted and localised by the caller. */
  price: ReactNode
  /** What the price buys — "per month", "6 months". */
  priceCaption?: ReactNode
  /** The comparable unit price, so plans of different lengths can be read
      against each other. */
  secondary?: { caption: ReactNode; value: ReactNode }
  name: ReactNode
  onSelect?: () => void
  selected?: boolean
  tagline?: ReactNode
}

const STATE_ICON: Record<NonNullable<PlanFeature['state']>, IconName> = {
  excluded: 'minus',
  included: 'check',
  pending: 'clock',
}

/**
 * One subscription tier, as a card the viewer chooses.
 *
 * The whole card is the control — a radio hidden behind a tap target the size
 * of a fingernail is the reason plan pickers feel fussy — so it renders as a
 * `<button>` with `aria-pressed` when selectable, and as a plain plate when it
 * is only being displayed.
 *
 * Prices are `ReactNode` rather than numbers: currency, digit shaping and
 * grouping are the product's locale decisions, and a kit that formats them
 * would be wrong in Persian first.
 */
export function PlanCard({
  badge,
  className,
  features = [],
  icon,
  name,
  onSelect,
  price,
  priceCaption,
  secondary,
  selected = false,
  tagline,
}: PlanCardProps) {
  const body = (
    <>
      <div className="nim-plan__top">
        {icon ? (
          <span className="nim-plan__icon">
            <Icon name={icon} size="md" />
          </span>
        ) : null}
        <div className="nim-plan__heading">
          <span className="nim-plan__name">{name}</span>
          {tagline ? <span className="nim-plan__tagline">{tagline}</span> : null}
        </div>
        {badge ? <span className="nim-plan__badge">{badge}</span> : null}
        {onSelect ? (
          <span aria-hidden="true" className="nim-plan__radio">
            {selected ? <Icon name="check" size="xs" /> : null}
          </span>
        ) : null}
      </div>

      <div className="nim-plan__price-box">
        <div>
          {priceCaption ? <span className="nim-plan__price-caption">{priceCaption}</span> : null}
          <strong className="nim-plan__price">{price}</strong>
        </div>
        {secondary ? (
          <div className="nim-plan__secondary">
            <span className="nim-plan__price-caption">{secondary.caption}</span>
            <strong className="nim-plan__secondary-value">{secondary.value}</strong>
          </div>
        ) : null}
      </div>

      {features.length ? (
        <ul className="nim-plan__features">
          {features.map((feature, index) => {
            const state = feature.state ?? 'included'
            return (
              <li className="nim-plan__feature" data-state={state} key={index}>
                <Icon name={STATE_ICON[state]} size="xs" />
                <span className="nim-plan__feature-label">{feature.label}</span>
                {feature.note ? <span className="nim-plan__feature-note">{feature.note}</span> : null}
              </li>
            )
          })}
        </ul>
      ) : null}
    </>
  )

  const classes = cn('nim-plan', selected && 'nim-plan--selected', className)

  return onSelect ? (
    <button aria-pressed={selected} className={classes} onClick={onSelect} type="button">
      {body}
    </button>
  ) : (
    <article className={classes}>{body}</article>
  )
}
