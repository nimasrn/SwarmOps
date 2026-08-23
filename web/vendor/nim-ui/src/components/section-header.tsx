import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface SectionHeaderProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  action?: ReactNode
  description?: ReactNode
  eyebrow?: ReactNode
  title: ReactNode
}

export function SectionHeader({
  action,
  className,
  description,
  eyebrow,
  title,
  ...props
}: SectionHeaderProps) {
  return (
    <header className={cn('nim-section-header', className)} {...props}>
      <div>
        {eyebrow ? <p className="nim-label nim-section-header__eyebrow">{eyebrow}</p> : null}
        <h2 className="nim-title nim-title--md">{title}</h2>
        {description ? (
          <p className="nim-body nim-body--sm nim-section-header__description">{description}</p>
        ) : null}
      </div>
      {action ? <div className="nim-section-header__action">{action}</div> : null}
    </header>
  )
}
