import { useId } from 'react'
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { Icon, type IconName } from '@/components/icon'
import { cn } from '@/lib/cn'

export interface FieldShellProps {
  children: (ids: { control: string; describedBy?: string }) => ReactNode
  className?: string
  error?: string
  hint?: string
  id?: string
  label?: string
  required?: boolean
}

/**
 * Every nim form control shares this frame, which is what guarantees that a
 * label, a hint, and an error are wired to the control with the right ids on
 * every screen — the part teams most often get wrong by hand.
 */
export function FieldShell({ children, className, error, hint, id, label, required }: FieldShellProps) {
  const generated = useId()
  const control = id ?? `nim-${generated}`
  const hintId = hint ? `${control}-hint` : undefined
  const errorId = error ? `${control}-error` : undefined
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined

  return (
    <div className={cn('nim-field', error && 'nim-field--invalid', className)}>
      {label ? (
        <label className="nim-field__label" htmlFor={control}>
          {label}
          {required ? (
            <span aria-hidden="true" className="nim-field__required">
              *
            </span>
          ) : null}
        </label>
      ) : null}
      {children({ control, describedBy })}
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
    </div>
  )
}

export interface FieldProps extends Omit<FieldShellProps, 'children'> {
  children: ReactNode
}

/**
 * The label/hint/error frame on its own, for a control the kit does not own —
 * a colour picker, a rich-text area, a group of chips.
 *
 * It hands the control an id through `htmlFor` and nothing else, so the
 * consumer still has to put that id on the thing being labelled. That is the
 * honest contract: this component cannot reach inside an arbitrary child, and
 * pretending otherwise is how a field ends up labelled in the markup and
 * unlabelled to a screen reader. Every kit control already carries its own
 * label prop and should use that instead of being wrapped in one of these.
 */
export function Field({ children, ...props }: FieldProps) {
  return <FieldShell {...props}>{() => children}</FieldShell>
}

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  error?: string
  hint?: string
  iconEnd?: IconName
  iconStart?: IconName
  label?: string
}

export function Input({ className, error, hint, iconEnd, iconStart, id, label, required, ...props }: InputProps) {
  return (
    <FieldShell error={error} hint={hint} id={id} label={label} required={required}>
      {({ control, describedBy }) => (
        <div
          className={cn(
            'nim-input-shell',
            iconStart && 'nim-input-shell--has-start',
            iconEnd && 'nim-input-shell--has-end',
          )}
        >
          {iconStart ? (
            <span className="nim-input-shell__affix nim-input-shell__affix--start">
              <Icon name={iconStart} size="sm" />
            </span>
          ) : null}
          <input
            aria-describedby={describedBy}
            aria-invalid={error ? true : undefined}
            className={cn('nim-input', className)}
            id={control}
            required={required}
            {...props}
          />
          {iconEnd ? (
            <span className="nim-input-shell__affix nim-input-shell__affix--end">
              <Icon name={iconEnd} size="sm" />
            </span>
          ) : null}
        </div>
      )}
    </FieldShell>
  )
}

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string
  hint?: string
  label?: string
}

export function Textarea({ className, error, hint, id, label, required, rows = 4, ...props }: TextareaProps) {
  return (
    <FieldShell error={error} hint={hint} id={id} label={label} required={required}>
      {({ control, describedBy }) => (
        <textarea
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          className={cn('nim-textarea', className)}
          id={control}
          required={required}
          rows={rows}
          {...props}
        />
      )}
    </FieldShell>
  )
}

export interface SelectOption {
  disabled?: boolean
  label: string
  value: string
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  error?: string
  hint?: string
  label?: string
  options: SelectOption[]
  placeholder?: string
}

export function Select({
  className,
  error,
  hint,
  id,
  label,
  options,
  placeholder,
  required,
  ...props
}: SelectProps) {
  return (
    <FieldShell error={error} hint={hint} id={id} label={label} required={required}>
      {({ control, describedBy }) => (
        <div className="nim-input-shell nim-input-shell--has-end">
          <select
            aria-describedby={describedBy}
            aria-invalid={error ? true : undefined}
            className={cn('nim-select', className)}
            id={control}
            required={required}
            {...props}
          >
            {placeholder ? (
              <option value="" disabled>
                {placeholder}
              </option>
            ) : null}
            {options.map((option) => (
              <option disabled={option.disabled} key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <span className="nim-input-shell__affix nim-input-shell__affix--end">
            <Icon name="chevron-down" size="sm" />
          </span>
        </div>
      )}
    </FieldShell>
  )
}
