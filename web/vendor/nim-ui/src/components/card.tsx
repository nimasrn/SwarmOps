import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

export type CardPadding = 'lg' | 'md' | 'none' | 'sm'
export type CardVariant = 'accent' | 'default' | 'muted' | 'outline' | 'raised'

export interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: 'article' | 'div' | 'section'
  children: ReactNode
  footer?: ReactNode
  header?: ReactNode
  /** Visual affordance only. An interactive card must still be wrapped in, or
      rendered as, a real button or link — this never adds a handler. */
  interactive?: boolean
  padding?: CardPadding
  variant?: CardVariant
}

export function Card({
  as: Component = 'article',
  children,
  className,
  footer,
  header,
  interactive = false,
  padding = 'md',
  variant = 'default',
  ...props
}: CardProps) {
  return (
    <Component
      className={cn(
        'nim-card',
        `nim-card--${variant}`,
        `nim-card--pad-${padding}`,
        interactive && 'nim-card--interactive',
        className,
      )}
      {...props}
    >
      {header ? <div className="nim-card__header">{header}</div> : null}
      {children}
      {footer ? <div className="nim-card__footer">{footer}</div> : null}
    </Component>
  )
}
