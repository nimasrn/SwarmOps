import type { HTMLAttributes, ReactNode } from 'react'
import { Icon, type IconName } from '@/components/icon'
import { cn } from '@/lib/cn'

export interface EmptyStateProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  actions?: ReactNode
  description?: ReactNode
  icon?: IconName
  title: ReactNode
  /** Why there is nothing here, and the two are not the same claim:
   *
   *  `empty`   — the thing was asked and the answer is none. A cluster with no
   *              stacks has no stacks.
   *  `unknown` — the thing could not be asked. No agent answered, no collector
   *              is installed, the API refused.
   *
   *  A console that renders both identically teaches its operators that an
   *  empty table means "nothing there", and one day that reading is wrong in
   *  an expensive way. `unknown` is hatched so the difference survives a
   *  screenshot. */
  reason?: 'empty' | 'unknown'
}

export function EmptyState({
  actions,
  className,
  description,
  icon = 'search',
  reason = 'empty',
  title,
  ...props
}: EmptyStateProps) {
  return (
    <div className={cn('nim-empty', className)} data-reason={reason === 'empty' ? undefined : reason} {...props}>
      <span className="nim-empty__icon">
        <Icon name={icon} size="md" />
      </span>
      <p className="nim-title nim-title--md">{title}</p>
      {description ? <p className="nim-body nim-body--sm nim-empty__body">{description}</p> : null}
      {actions ? <div className="nim-empty__actions">{actions}</div> : null}
    </div>
  )
}
