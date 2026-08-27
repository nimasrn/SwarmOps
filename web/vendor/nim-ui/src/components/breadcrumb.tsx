import { Fragment } from 'react'
import { Icon } from '@/components/icon'
import { cn } from '@/lib/cn'

export interface Crumb {
  href?: string
  label: string
}

export interface BreadcrumbProps {
  className?: string
  /** The trail, root first. The last entry is the current page and is never a
      link — a link to where the reader already is has nothing to offer. */
  items: Crumb[]
  label?: string
}

export function Breadcrumb({ className, items, label = 'Breadcrumb' }: BreadcrumbProps) {
  return (
    <nav aria-label={label} className={cn('nim-breadcrumb', className)}>
      {items.map((item, index) => {
        const last = index === items.length - 1

        return (
          <Fragment key={item.label}>
            {index > 0 ? (
              <span aria-hidden="true" className="nim-breadcrumb__separator">
                <Icon name="chevron-forward" size="xs" />
              </span>
            ) : null}
            {last || !item.href ? (
              <span aria-current={last ? 'page' : undefined} className="nim-breadcrumb__current">
                {item.label}
              </span>
            ) : (
              <a className="nim-breadcrumb__link" href={item.href}>
                {item.label}
              </a>
            )}
          </Fragment>
        )
      })}
    </nav>
  )
}
