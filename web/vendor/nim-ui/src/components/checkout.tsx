import type { ReactNode } from 'react'
import { Icon, type IconName } from '@/components/icon'
import { cn } from '@/lib/cn'

export interface OptionCardProps {
  /** A short word on the trailing edge: "manual review", "default". */
  badge?: ReactNode
  className?: string
  description?: ReactNode
  disabled?: boolean
  icon?: IconName
  /** Rendered under the description when chosen — an account number, a
      delivery window. Hidden otherwise, because it is only true of the
      selected option. */
  detail?: ReactNode
  name?: string
  onSelect: () => void
  selected: boolean
  title: ReactNode
}

/**
 * One choice in a list of choices: a payment method, a saved address, a
 * delivery window.
 *
 * A real `<input type="radio">` inside the card, visually hidden, is what makes
 * a set of these behave like a radio group — arrow keys move between them, the
 * name groups them, and a form submits the chosen one. The card is the label,
 * so the whole plate is the target rather than a 20px dot beside it.
 */
export function OptionCard({
  badge,
  className,
  description,
  detail,
  disabled = false,
  icon,
  name,
  onSelect,
  selected,
  title,
}: OptionCardProps) {
  return (
    <label className={cn('nim-option-card', selected && 'nim-option-card--selected', className)}>
      <input
        checked={selected}
        className="nim-option-card__input"
        disabled={disabled}
        name={name}
        onChange={onSelect}
        type="radio"
      />
      {icon ? (
        <span className="nim-option-card__icon">
          <Icon name={icon} size="md" />
        </span>
      ) : null}
      <span className="nim-option-card__text">
        <span className="nim-option-card__title">{title}</span>
        {description ? <span className="nim-option-card__description">{description}</span> : null}
        {selected && detail ? <span className="nim-option-card__detail">{detail}</span> : null}
      </span>
      {badge ? <span className="nim-option-card__badge">{badge}</span> : null}
      <span aria-hidden="true" className="nim-option-card__dot" />
    </label>
  )
}

export interface SummaryLine {
  /** Set on the line the eye should land on — the total. At most one. */
  emphasis?: boolean
  key: string
  label: ReactNode
  /** A qualifier under the label: "6 months · renews 1405/12/01". */
  meta?: ReactNode
  /** Already formatted. Currency and digits are the product's locale call. */
  value: ReactNode
}

export interface OrderSummaryProps {
  className?: string
  /** Deductions. Rendered in the success tone with the sign the caller gives
      them — the kit does not do arithmetic on money it cannot see. */
  items: SummaryLine[]
  /** Subtotal, tax, fees, total: the arithmetic, under a rule. */
  totals?: SummaryLine[]
  title?: ReactNode
}

/**
 * What is being bought, and what it comes to.
 *
 * Every figure is a `ReactNode` the caller has already formatted. That is
 * deliberate: money is the last thing a UI kit should be computing or
 * rounding, and a component that took numbers would have to guess a currency,
 * a tax rule and a digit shape — three decisions that belong to the product
 * and are wrong in Persian first.
 */
export function OrderSummary({ className, items, title, totals = [] }: OrderSummaryProps) {
  return (
    <section className={cn('nim-summary', className)}>
      {title ? <h2 className="nim-summary__title">{title}</h2> : null}

      <dl className="nim-summary__lines">
        {items.map((line) => (
          <div className="nim-summary__line" key={line.key}>
            <dt>
              <span className="nim-summary__label">{line.label}</span>
              {line.meta ? <span className="nim-summary__meta">{line.meta}</span> : null}
            </dt>
            <dd className="nim-summary__value">{line.value}</dd>
          </div>
        ))}
      </dl>

      {totals.length ? (
        <>
          <hr className="nim-summary__rule" />
          <dl className="nim-summary__lines nim-summary__lines--totals">
            {totals.map((line) => (
              <div
                className="nim-summary__line"
                data-emphasis={line.emphasis ? 'true' : undefined}
                key={line.key}
              >
                <dt>
                  <span className="nim-summary__label">{line.label}</span>
                </dt>
                <dd className="nim-summary__value">{line.value}</dd>
              </div>
            ))}
          </dl>
        </>
      ) : null}
    </section>
  )
}

export interface ActionBarProps {
  /** The primary control. One only: a bar with two equal buttons has none. */
  action: ReactNode
  className?: string
  /** Fine print under the row — renewal terms, delivery estimate. */
  note?: ReactNode
  /** The figure the action commits to, beside it rather than above it, so it
      is read in the same glance as the button. */
  total?: { label: ReactNode; value: ReactNode }
}

/**
 * The bar a purchase screen ends with: what it costs, and the button.
 *
 * It sticks to the bottom of the scroll container rather than the viewport, so
 * it belongs to the screen it is part of and cannot end up floating over an
 * unrelated one. It sits above the safe-area inset, and the content above owes
 * it room the way it does the tab bar.
 */
export function ActionBar({ action, className, note, total }: ActionBarProps) {
  return (
    <div className={cn('nim-action-bar', className)}>
      <div className="nim-action-bar__row">
        {total ? (
          <div className="nim-action-bar__total">
            <span className="nim-action-bar__total-label">{total.label}</span>
            <strong className="nim-action-bar__total-value">{total.value}</strong>
          </div>
        ) : null}
        <div className="nim-action-bar__action">{action}</div>
      </div>
      {note ? <p className="nim-action-bar__note">{note}</p> : null}
    </div>
  )
}
