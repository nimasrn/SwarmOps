import type { HTMLAttributes, ReactNode } from 'react'
import { Icon, type IconName } from '@/components/icon'
import { cn } from '@/lib/cn'

export interface EmptyStateProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  actions?: ReactNode
  description?: ReactNode
  icon?: IconName
  title: ReactNode
}

export function EmptyState({ actions, className, description, icon = 'search', title, ...props }: EmptyStateProps) {
  return (
    <div className={cn('nim-empty', className)} {...props}>
      <span className="nim-empty__icon">
        <Icon name={icon} size="md" />
      </span>
      <p className="nim-title nim-title--md">{title}</p>
      {description ? <p className="nim-body nim-body--sm nim-empty__body">{description}</p> : null}
      {actions ? <div className="nim-empty__actions">{actions}</div> : null}
    </div>
  )
}
