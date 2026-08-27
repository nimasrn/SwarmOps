import { useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { Icon, type IconName } from '@/components/icon'
import { cn } from '@/lib/cn'

export type ChipTone = 'accent' | 'danger' | 'neutral' | 'success' | 'warning'

export interface ChipProps {
  children: ReactNode
  className?: string
  disabled?: boolean
  icon?: IconName
  /** Turns the chip into a toggle. Without it the chip is a static token. */
  onClick?: () => void
  /** Adds the remove affordance. The chip's own click stays separate. */
  onRemove?: () => void
  removeLabel?: string
  selected?: boolean
  tone?: ChipTone
}

/**
 * A chip is an OBJECT — a filter in force, a recipient, a tag — where a badge
 * is a label ABOUT an object. That difference is why a chip can be pressed and
 * removed and a badge never is; a badge with an × in it is a chip wearing the
 * wrong name.
 *
 * The remove control is a sibling button, never a nested one: a button inside
 * a button is invalid markup and the inner one stops being reachable.
 */
export function Chip({
  children,
  className,
  disabled = false,
  icon,
  onClick,
  onRemove,
  removeLabel = 'Remove',
  selected = false,
  tone = 'neutral',
}: ChipProps) {
  const interactive = Boolean(onClick)

  return (
    <span
      className={cn('nim-chip', interactive && 'nim-chip--interactive', className)}
      data-selected={selected || undefined}
      data-tone={tone === 'neutral' ? undefined : tone}
    >
      {interactive ? (
        <button
          aria-pressed={selected}
          className="nim-chip__body"
          disabled={disabled}
          onClick={onClick}
          type="button"
        >
          {icon ? <Icon name={icon} size="xs" /> : null}
          {children}
        </button>
      ) : (
        <span className="nim-chip__body">
          {icon ? <Icon name={icon} size="xs" /> : null}
          {children}
        </span>
      )}
      {onRemove ? (
        <button
          aria-label={removeLabel}
          className="nim-chip__remove"
          disabled={disabled}
          onClick={onRemove}
          type="button"
        >
          <Icon name="close" size="xs" />
        </button>
      ) : null}
    </span>
  )
}

export interface ChipInputProps {
  className?: string
  disabled?: boolean
  error?: string
  hint?: string
  label?: string
  /** Rejected entries are dropped silently; return `false` to refuse one. */
  onChange: (values: string[]) => void
  placeholder?: string
  removeLabel?: string
  /** Keys that commit the draft. Comma is included because pasted lists use it. */
  separators?: string[]
  validate?: (value: string) => boolean
  values: string[]
}

/**
 * The tokens live BEFORE the input, in the same box, so the caret sits after
 * the last chip the way it does in a mail client's To: field.
 *
 * Backspace on an empty draft removes the last chip — the behaviour every
 * token field has had since address bars, and the one users try first.
 */
export function ChipInput({
  className,
  disabled = false,
  error,
  hint,
  label,
  onChange,
  placeholder,
  removeLabel = 'Remove',
  separators = ['Enter', ',', 'Tab'],
  validate,
  values,
}: ChipInputProps) {
  const [draft, setDraft] = useState('')

  const commit = () => {
    const entry = draft.trim()
    if (!entry) return
    if (validate && !validate(entry)) return
    if (values.includes(entry)) {
      setDraft('')
      return
    }
    onChange([...values, entry])
    setDraft('')
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (separators.includes(event.key)) {
      // Tab only commits when there is something to commit, or the field
      // would swallow every attempt to leave it.
      if (event.key === 'Tab' && !draft.trim()) return
      event.preventDefault()
      commit()
      return
    }
    if (event.key === 'Backspace' && !draft && values.length > 0) {
      onChange(values.slice(0, -1))
    }
  }

  return (
    <div className={cn('nim-field', error && 'nim-field--invalid', className)}>
      {label ? <span className="nim-field__label">{label}</span> : null}
      <div className="nim-chip-input" data-disabled={disabled || undefined}>
        {values.map((value) => (
          <Chip
            disabled={disabled}
            key={value}
            onRemove={() => onChange(values.filter((entry) => entry !== value))}
            removeLabel={`${removeLabel} ${value}`}
          >
            {value}
          </Chip>
        ))}
        <input
          aria-invalid={error ? true : undefined}
          aria-label={label}
          className="nim-chip-input__field"
          disabled={disabled}
          onBlur={commit}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={values.length === 0 ? placeholder : undefined}
          value={draft}
        />
      </div>
      {error ? <p className="nim-field__error">{error}</p> : null}
      {hint && !error ? <p className="nim-field__hint">{hint}</p> : null}
    </div>
  )
}
