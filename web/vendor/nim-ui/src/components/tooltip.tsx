import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface TooltipProps {
  children: ReactNode
  className?: string
  /** The text shown on hover. Never the only place the name lives. */
  label: string
}

/**
 * A name for a control that shows only an icon.
 *
 * The bubble is `aria-hidden`: the trigger inside must already carry its own
 * accessible name (IconButton does), so a screen reader is never read the same
 * label twice, and a viewer who cannot hover never depends on this.
 *
 * Hover waits 200ms; keyboard focus does not, because a viewer who tabbed here
 * has already asked.
 */
export function Tooltip({ children, className, label }: TooltipProps) {
  return (
    <span className={cn('nim-tooltip', className)}>
      {children}
      <span aria-hidden="true" className="nim-tooltip__bubble" role="tooltip">
        {label}
      </span>
    </span>
  )
}
