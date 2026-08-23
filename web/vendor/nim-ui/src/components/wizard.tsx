import { useCallback, useState } from 'react'
import type { ReactNode } from 'react'
import { Button } from '@/components/button'
import { IconButton } from '@/components/icon-button'
import { cn } from '@/lib/cn'

export interface WizardStep {
  /** The step itself. A function receives nothing — the caller already holds
      the answers, because they are the app's, not the wizard's. */
  content: ReactNode
  /** Blocks the CTA until the step is answered. */
  canContinue?: boolean
  /** Overrides the CTA label on this step alone. */
  continueLabel?: string
  id: string
  /** The one thing being asked. Kept short: a wizard step is a question. */
  question?: ReactNode
  subtitle?: ReactNode
}

export interface WizardProps {
  className?: string
  continueLabel: string
  /** Label on the last step. */
  finishLabel: string
  labels?: { back: string; close: string; step: (index: number, total: number) => string }
  onClose?: () => void
  /** Fired from the last step's CTA. */
  onDone: () => void
  /** Every step change, including backwards — for analytics and autosave. */
  onStep?: (index: number) => void
  steps: WizardStep[]
}

const DEFAULT_LABELS = {
  back: 'Back',
  close: 'Close',
  step: (index: number, total: number) => `Step ${index + 1} of ${total}`,
}

/**
 * A short, one-question-per-screen flow: mood → cause → note, or any other
 * sequence a viewer walks once and abandons easily.
 *
 * The step index is the wizard's; the answers are not. A wizard that owned the
 * answers would have to know their shape, and every product's are different —
 * so each step is given its content and reports back through `canContinue`,
 * which is the only thing the shell needs to know.
 *
 * Progress is dots rather than a bar: a bar implies a percentage of work done,
 * and three questions are three questions. The close control is always present
 * — a flow the viewer cannot leave is a trap, and leaving is the most common
 * thing anyone does with one of these.
 */
export function Wizard({
  className,
  continueLabel,
  finishLabel,
  labels,
  onClose,
  onDone,
  onStep,
  steps,
}: WizardProps) {
  const text = { ...DEFAULT_LABELS, ...labels }
  const [index, setIndex] = useState(0)
  const step = steps[Math.min(index, steps.length - 1)]
  const last = index === steps.length - 1

  const goTo = useCallback(
    (next: number) => {
      setIndex(next)
      onStep?.(next)
    },
    [onStep],
  )

  return (
    <section className={cn('nim-wizard', className)}>
      <header className="nim-wizard__bar">
        <span className="nim-wizard__slot">
          {index > 0 ? (
            <IconButton label={text.back} name="chevron-back" onClick={() => goTo(index - 1)} size="sm" />
          ) : null}
        </span>

        <ol aria-label={text.step(index, steps.length)} className="nim-wizard__dots">
          {steps.map((item, dot) => (
            <li
              className="nim-wizard__dot"
              data-done={dot < index ? 'true' : undefined}
              data-on={dot === index ? 'true' : undefined}
              key={item.id}
            />
          ))}
        </ol>

        <span className="nim-wizard__slot">
          {onClose ? <IconButton label={text.close} name="close" onClick={onClose} size="sm" /> : null}
        </span>
      </header>

      {step.question ? (
        <div className="nim-wizard__ask">
          <h1 className="nim-wizard__question">{step.question}</h1>
          {step.subtitle ? <p className="nim-wizard__subtitle">{step.subtitle}</p> : null}
        </div>
      ) : null}

      <div className="nim-wizard__content">{step.content}</div>

      <footer className="nim-wizard__foot">
        <Button
          disabled={step.canContinue === false}
          fullWidth
          onClick={() => (last ? onDone() : goTo(index + 1))}
          size="lg"
          variant="accent"
        >
          {step.continueLabel ?? (last ? finishLabel : continueLabel)}
        </Button>
      </footer>
    </section>
  )
}

export interface ChoiceGridOption {
  disabled?: boolean
  icon?: ReactNode
  id: string
  label: ReactNode
}

export interface ChoiceGridProps {
  className?: string
  /** Cap a multi-select. Options past the cap disable rather than disappear,
      so the grid does not reflow under the viewer's finger. */
  max?: number
  multiple?: boolean
  onChange: (selected: string[]) => void
  options: ChoiceGridOption[]
  selected: string[]
}

/**
 * The grid of icon tiles a wizard step is usually made of.
 *
 * Single-select renders radios and multi-select renders checkboxes — stated in
 * ARIA rather than implied by how many are lit, because "pick one" and "pick
 * any" are different promises and only one of them is visible in a grid.
 */
export function ChoiceGrid({
  className,
  max,
  multiple = false,
  onChange,
  options,
  selected,
}: ChoiceGridProps) {
  const full = multiple && max !== undefined && selected.length >= max

  const toggle = (id: string) => {
    if (!multiple) {
      onChange([id])
      return
    }
    onChange(selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id])
  }

  return (
    <div className={cn('nim-choice-grid', className)} role={multiple ? 'group' : 'radiogroup'}>
      {options.map((option) => {
        const on = selected.includes(option.id)
        return (
          <button
            aria-checked={on}
            className="nim-choice-grid__tile"
            data-on={on ? 'true' : undefined}
            disabled={option.disabled || (full && !on)}
            key={option.id}
            onClick={() => toggle(option.id)}
            role={multiple ? 'checkbox' : 'radio'}
            type="button"
          >
            {option.icon ? <span className="nim-choice-grid__icon">{option.icon}</span> : null}
            <span className="nim-choice-grid__label">{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}
