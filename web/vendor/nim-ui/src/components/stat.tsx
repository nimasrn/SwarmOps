import type { HTMLAttributes, ReactNode } from 'react'
import { Icon } from '@/components/icon'
import { cn } from '@/lib/cn'

export interface StatProps extends HTMLAttributes<HTMLDivElement> {
  /** Signed change, e.g. `+12%`. Direction colours it and picks the arrow. */
  delta?: string
  deltaDirection?: 'down' | 'up'
  label: ReactNode
  unit?: ReactNode
  value: ReactNode
}

export function Stat({ className, delta, deltaDirection = 'up', label, unit, value, ...props }: StatProps) {
  return (
    <div className={cn('nim-stat', className)} {...props}>
      <p className="nim-stat__value">
        {value}
        {unit ? <span className="nim-stat__unit">{unit}</span> : null}
      </p>
      <p className="nim-label nim-stat__label">{label}</p>
      {delta ? (
        <p className="nim-stat__delta" data-direction={deltaDirection}>
          <Icon name={deltaDirection === 'up' ? 'trend-up' : 'trend-down'} size="xs" />
          {delta}
        </p>
      ) : null}
    </div>
  )
}
