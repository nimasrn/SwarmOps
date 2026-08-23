import { useState } from 'react'
import type { InputHTMLAttributes } from 'react'
import { FieldShell } from '@/components/field'
import { Icon } from '@/components/icon'
import { cn } from '@/lib/cn'

export type PasswordStrength = 'fair' | 'good' | 'strong' | 'weak'

export interface PasswordFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'type'> {
  error?: string
  hint?: string
  label?: string
  /** Draws the meter. Omit on a sign-in field: scoring a password someone
      already has tells them nothing they can act on. */
  strength?: PasswordStrength
  /** Accessible names for the reveal toggle and the meter. */
  labels?: { hide: string; show: string; strength: (level: PasswordStrength) => string }
}

const DEFAULT_LABELS = {
  hide: 'Hide password',
  show: 'Show password',
  strength: (level: PasswordStrength) => `Password strength: ${level}`,
}

const STEPS: PasswordStrength[] = ['weak', 'fair', 'good', 'strong']

/**
 * A password input with a reveal toggle and an optional strength meter.
 *
 * Revealing is a real `type` swap rather than a font trick, so a password
 * manager still sees a password field, and the toggle is a button with a
 * label — an icon that changes silently leaves a screen reader unable to tell
 * whether the characters are showing.
 *
 * Scoring is the caller's: strength depends on the policy being enforced, and
 * a meter that disagrees with the server's rules is worse than none.
 */
export function PasswordField({
  className,
  error,
  hint,
  id,
  label,
  labels,
  required,
  strength,
  ...props
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false)
  const text = { ...DEFAULT_LABELS, ...labels }

  return (
    <FieldShell error={error} hint={hint} id={id} label={label} required={required}>
      {({ control, describedBy }) => (
        <>
          <div className="nim-input-shell nim-input-shell--has-end">
            <input
              aria-describedby={describedBy}
              aria-invalid={error ? true : undefined}
              autoComplete={props.autoComplete ?? 'current-password'}
              className={cn('nim-input', className)}
              id={control}
              required={required}
              {...props}
              type={visible ? 'text' : 'password'}
            />
            <button
              aria-controls={control}
              aria-label={visible ? text.hide : text.show}
              aria-pressed={visible}
              className="nim-password__toggle"
              onClick={() => setVisible((was) => !was)}
              type="button"
            >
              <Icon name="eye" size="sm" />
            </button>
          </div>

          {strength ? (
            <div
              aria-label={text.strength(strength)}
              className="nim-password__meter"
              data-level={strength}
              role="img"
            >
              {STEPS.map((step, index) => (
                <span
                  className="nim-password__step"
                  data-on={index <= STEPS.indexOf(strength) ? 'true' : undefined}
                  key={step}
                />
              ))}
            </div>
          ) : null}
        </>
      )}
    </FieldShell>
  )
}

/**
 * A default score for products without a policy of their own: length first,
 * then variety. Deliberately blunt — it is a hint, never a gate.
 */
export function scorePassword(password: string): PasswordStrength {
  if (password.length < 8) return 'weak'
  const variety = [/[a-z]/, /[A-Z]/, /\d/, /[^\w\s]/].filter((rule) => rule.test(password)).length
  if (password.length >= 14 && variety >= 3) return 'strong'
  if (password.length >= 10 && variety >= 2) return 'good'
  return 'fair'
}
