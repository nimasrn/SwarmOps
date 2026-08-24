import { forwardRef } from 'react'
import type { Ref } from 'react'
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react'
import { Icon, type IconName } from '@/components/icon'
import { cn } from '@/lib/cn'

export type ButtonSize = 'sm' | 'md' | 'lg'
export type ButtonVariant = 'accent' | 'danger' | 'ghost' | 'primary' | 'secondary'

interface ButtonOwnProps {
  children: ReactNode
  fullWidth?: boolean
  /** Icon on the trailing edge — travels with the reading direction. */
  iconEnd?: IconName
  iconStart?: IconName
  /** Blocks interaction and announces busy; the label stays in place so the
      button does not change width mid-request. */
  loading?: boolean
  size?: ButtonSize
  variant?: ButtonVariant
}

/**
 * `href` renders a real `<a>`.
 *
 * A control that navigates IS a link, and a `<button onClick={navigate}>`
 * cannot be opened in a new tab, cannot be copied, and does not announce
 * itself as a link. Consumers without this prop reach for an `asChild`
 * escape hatch and hand-write the classes, which is how the focus ring and
 * the press behaviour drift per call site.
 *
 * `loading` and `disabled` are button-only: there is no such thing as a
 * disabled link in HTML, and faking one with `aria-disabled` leaves it in the
 * tab order still navigating. Don't render a link for an action that can be
 * in flight — render a button.
 */
export type ButtonProps =
  | (ButtonOwnProps & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & { href?: never })
  | (ButtonOwnProps &
      Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'children'> & {
        disabled?: never
        href: string
        loading?: never
      })

/**
 * The ref is forwarded because overlays anchor to their trigger: Menu and
 * Popover need the element, not a wrapper around it.
 */
// Typed as the button element: every existing anchor point — Menu, Popover,
// Tooltip — holds a button ref, and widening this to a union would break all
// of them to serve the rarer link case, which is cast at the one use below.
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    children,
    className,
    fullWidth = false,
    iconEnd,
    iconStart,
    size = 'md',
    variant = 'primary',
    ...rest
  },
  ref,
) {
  const classes = cn(
    'nim-button',
    `nim-button--${variant}`,
    `nim-button--${size}`,
    fullWidth && 'nim-button--full',
    className,
  )

  const body = (
    <>
      {iconStart ? <Icon name={iconStart} size="sm" /> : null}
      <span className="nim-button__label">{children}</span>
      {iconEnd ? <Icon name={iconEnd} size="sm" /> : null}
    </>
  )

  if ('href' in rest && rest.href !== undefined) {
    const { href, rel, target, ...anchorProps } = rest as AnchorHTMLAttributes<HTMLAnchorElement>
    return (
      <a
        className={classes}
        href={href}
        ref={ref as Ref<HTMLAnchorElement>}
        rel={target === '_blank' ? (rel ?? 'noreferrer') : rel}
        target={target}
        {...anchorProps}
      >
        {body}
      </a>
    )
  }

  const {
    disabled = false,
    loading = false,
    type = 'button',
    ...buttonProps
  } = rest as ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }

  return (
    <button
      aria-busy={loading || undefined}
      className={cn(classes, loading && 'nim-button--loading')}
      disabled={disabled || loading}
      ref={ref}
      type={type}
      {...buttonProps}
    >
      {loading ? <span aria-hidden="true" className="nim-button__spinner" /> : null}
      {loading ? (
        <>
          <span className="nim-button__label">{children}</span>
          {iconEnd ? <Icon name={iconEnd} size="sm" /> : null}
        </>
      ) : (
        body
      )}
    </button>
  )
})
