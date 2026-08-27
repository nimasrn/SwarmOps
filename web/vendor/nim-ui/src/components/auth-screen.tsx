import type { ReactNode } from 'react'
import { Button } from '@/components/button'
import { cn } from '@/lib/cn'

export interface AuthScreenProps {
  /** The form itself: a PhoneField, an OtpInput, a PasswordField. */
  children: ReactNode
  className?: string
  /** Brand mark above the heading. */
  brand?: ReactNode
  /** Small link back to the previous step — the OTP step's way home. */
  back?: { label: string; onClick: () => void }
  /** Terms line, support link, resend timer. Sits under the CTA. */
  footer?: ReactNode
  subtitle?: ReactNode
  title: ReactNode
  /** The single primary action. A sign-in screen has exactly one. */
  action?: { disabled?: boolean; label: string; loading?: boolean; onClick: () => void }
}

/**
 * The frame every step of a sign-in flow shares: brand, one heading, one
 * explanation, the fields, and a single action pinned to the bottom.
 *
 * Keeping it one component is what makes the phone step, the code step and the
 * password step read as one screen changing rather than three screens — and it
 * puts the CTA in the same place each time, which is the part a thumb learns.
 */
export function AuthScreen({
  action,
  back,
  brand,
  children,
  className,
  footer,
  subtitle,
  title,
}: AuthScreenProps) {
  return (
    <section className={cn('nim-auth', className)}>
      {brand ? <div className="nim-auth__brand">{brand}</div> : null}

      <div className="nim-auth__body">
        {back ? (
          <Button className="nim-auth__back" iconStart="chevron-back" onClick={back.onClick} size="sm" variant="ghost">
            {back.label}
          </Button>
        ) : null}
        <h1 className="nim-auth__title">{title}</h1>
        {subtitle ? <p className="nim-auth__subtitle">{subtitle}</p> : null}
        <div className="nim-auth__fields">{children}</div>
      </div>

      <div className="nim-auth__foot">
        {action ? (
          <Button
            disabled={action.disabled}
            fullWidth
            loading={action.loading}
            onClick={action.onClick}
            size="lg"
            variant="accent"
          >
            {action.label}
          </Button>
        ) : null}
        {footer ? <div className="nim-auth__footer">{footer}</div> : null}
      </div>
    </section>
  )
}
