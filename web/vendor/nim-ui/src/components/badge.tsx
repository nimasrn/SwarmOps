import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

export type BadgeSize = 'md' | 'sm'
export type BadgeTone = 'outline' | 'soft' | 'solid'
export type BadgeVariant = 'accent' | 'danger' | 'info' | 'neutral' | 'success' | 'warning'

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode
  /** Shows a status dot before the label — for live/among-states meanings. */
  dot?: boolean
  pill?: boolean
  size?: BadgeSize
  tone?: BadgeTone
  variant?: BadgeVariant
}

export function Badge({
  children,
  className,
  dot = false,
  pill = false,
  size = 'md',
  tone = 'soft',
  variant = 'neutral',
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        'nim-badge',
        `nim-badge--${variant}`,
        `nim-badge--${tone}`,
        size === 'sm' && 'nim-badge--sm',
        pill && 'nim-badge--pill',
        className,
      )}
      {...props}
    >
      {dot ? <span aria-hidden="true" className="nim-badge__dot" /> : null}
      {children}
    </span>
  )
}
