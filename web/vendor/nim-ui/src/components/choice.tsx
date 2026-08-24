import { createContext, useContext, useId } from 'react'
import type { InputHTMLAttributes, ReactNode } from 'react'
import { Icon } from '@/components/icon'
import { cn } from '@/lib/cn'

interface ChoiceBaseProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Optional, because a checkbox in a table's selection column has no
      visible label — the row beside it is the label, and the control names
      itself with `aria-label`. Every other use should pass one: a bare
      checkbox with no name and no `aria-label` is unusable, and that is a
      review question rather than something the type system can decide. */
  children?: ReactNode
  description?: string
}

export type CheckboxProps = ChoiceBaseProps
export type SwitchProps = ChoiceBaseProps

/**
 * Both controls keep a real `<input>` in the tree — visually hidden but
 * focusable — so keyboard behaviour, form participation, and assistive tech
 * come from the platform rather than from re-implemented ARIA.
 */
export function Checkbox({ children, className, description, ...props }: CheckboxProps) {
  return (
    <label className={cn('nim-choice nim-choice--checkbox', className)}>
      <input className="nim-choice__input" type="checkbox" {...props} />
      <span aria-hidden="true" className="nim-checkbox__box">
        <Icon name="check" size="xs" />
      </span>
      <span className="nim-choice__text">
        {children}
        {description ? <span className="nim-choice__description">{description}</span> : null}
      </span>
    </label>
  )
}

export function Switch({ children, className, description, ...props }: SwitchProps) {
  return (
    <label className={cn('nim-choice nim-choice--switch', className)}>
      <input className="nim-choice__input" role="switch" type="checkbox" {...props} />
      <span aria-hidden="true" className="nim-switch__track">
        <span className="nim-switch__thumb" />
      </span>
      <span className="nim-choice__text">
        {children}
        {description ? <span className="nim-choice__description">{description}</span> : null}
      </span>
    </label>
  )
}

export interface RadioProps extends ChoiceBaseProps {
  value: string
}

/**
 * A radio is never alone — it is one answer among a set, and the set is what
 * assistive tech announces ("2 of 4"). `RadioGroup` supplies the name and the
 * grouping; a bare `Radio` outside one is valid markup but a broken control,
 * so the group is the documented entry point.
 */
export function Radio({ children, className, description, ...props }: RadioProps) {
  const group = useContext(RadioGroupContext)

  return (
    <label className={cn('nim-choice nim-choice--radio', className)}>
      <input
        {...props}
        checked={group ? group.value === props.value : props.checked}
        className="nim-choice__input"
        name={group?.name ?? props.name}
        onChange={(event) => {
          group?.onChange(event.target.value)
          props.onChange?.(event)
        }}
        type="radio"
      />
      <span aria-hidden="true" className="nim-radio__mark" />
      <span className="nim-choice__text">
        {children}
        {description ? <span className="nim-choice__description">{description}</span> : null}
      </span>
    </label>
  )
}

export interface RadioGroupProps {
  children: ReactNode
  className?: string
  error?: string
  hint?: string
  label: string
  /** Rows by default; `inline` puts the answers on one line when they are short. */
  layout?: 'inline' | 'stack'
  /** Left unset, a name is generated — two groups on a page never collide. */
  name?: string
  onChange: (value: string) => void
  value: string
}

interface RadioGroupValue {
  name: string
  onChange: (value: string) => void
  value: string
}

const RadioGroupContext = createContext<RadioGroupValue | null>(null)

/**
 * A `<fieldset>` with a real `<legend>`, because the question a radio set asks
 * has to be announced before the answers — a paragraph above the group reads
 * as unrelated text to a screen reader.
 */
export function RadioGroup({
  children,
  className,
  error,
  hint,
  label,
  layout = 'stack',
  name,
  onChange,
  value,
}: RadioGroupProps) {
  const generated = useId()
  const group = name ?? `nim-radio-${generated}`
  const hintId = hint ? `${group}-hint` : undefined
  const errorId = error ? `${group}-error` : undefined

  return (
    <RadioGroupContext.Provider value={{ name: group, onChange, value }}>
      <fieldset
        aria-describedby={[errorId, hintId].filter(Boolean).join(' ') || undefined}
        aria-invalid={error ? true : undefined}
        className={cn('nim-radio-group', error && 'nim-radio-group--invalid', className)}
      >
        <legend className="nim-radio-group__legend">{label}</legend>
        <div className={cn('nim-radio-group__options', `nim-radio-group__options--${layout}`)}>{children}</div>
        {error ? (
          <p className="nim-field__error" id={errorId}>
            {error}
          </p>
        ) : null}
        {hint && !error ? (
          <p className="nim-field__hint" id={hintId}>
            {hint}
          </p>
        ) : null}
      </fieldset>
    </RadioGroupContext.Provider>
  )
}
