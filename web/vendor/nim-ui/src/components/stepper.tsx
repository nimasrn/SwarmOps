import { Icon } from '@/components/icon'
import { cn } from '@/lib/cn'

export interface StepperProps {
  className?: string
  decrementLabel?: string
  incrementLabel?: string
  label: string
  max?: number
  min?: number
  onChange: (value: number) => void
  step?: number
  value: number
}

/**
 * A number with two full-size targets. Both buttons are control-height
 * squares, so the pair clears the touch minimum rather than shrinking into the
 * cramped ± chevrons this control usually becomes.
 */
export function Stepper({
  className,
  decrementLabel = 'Decrease',
  incrementLabel = 'Increase',
  label,
  max = Number.MAX_SAFE_INTEGER,
  min = 0,
  onChange,
  step = 1,
  value,
}: StepperProps) {
  const clamp = (next: number) => Math.min(Math.max(next, min), max)

  return (
    <div
      aria-label={label}
      aria-valuemax={max}
      aria-valuemin={min}
      aria-valuenow={value}
      className={cn('nim-stepper', className)}
      role="spinbutton"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'ArrowUp') {
          event.preventDefault()
          onChange(clamp(value + step))
        }
        if (event.key === 'ArrowDown') {
          event.preventDefault()
          onChange(clamp(value - step))
        }
      }}
    >
      <button
        aria-label={decrementLabel}
        className="nim-stepper__button"
        disabled={value <= min}
        onClick={() => onChange(clamp(value - step))}
        tabIndex={-1}
        type="button"
      >
        <Icon name="minus" size="sm" />
      </button>
      <span className="nim-stepper__value">{value}</span>
      <button
        aria-label={incrementLabel}
        className="nim-stepper__button"
        disabled={value >= max}
        onClick={() => onChange(clamp(value + step))}
        tabIndex={-1}
        type="button"
      >
        <Icon name="plus" size="sm" />
      </button>
    </div>
  )
}
