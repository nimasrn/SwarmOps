import type { HTMLAttributes, ReactNode } from 'react'
import { Icon } from '@/components/icon'
import { cn } from '@/lib/cn'

export interface ListProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  /** Drops the surrounding plate and keeps only the dividers. */
  plain?: boolean
}

export function List({ children, className, plain = false, ...props }: ListProps) {
  return (
    <div className={cn('nim-list', plain && 'nim-list--plain', className)} {...props}>
      {children}
    </div>
  )
}

export interface ListRowProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  /** Renders the row as a link. Mutually exclusive with `onClick`. */
  href?: string
  leading?: ReactNode
  subtitle?: ReactNode
  title: ReactNode
  trailing?: ReactNode
}

export function ListRow({
  className,
  href,
  leading,
  onClick,
  subtitle,
  title,
  trailing,
  ...props
}: ListRowProps) {
  const interactive = Boolean(href || onClick)
  const content = (
    <>
      {leading ? <span className="nim-list-row__leading">{leading}</span> : null}
      <span className="nim-list-row__content">
        <span className="nim-list-row__title">{title}</span>
        {subtitle ? <span className="nim-list-row__subtitle">{subtitle}</span> : null}
      </span>
      {trailing ? <span className="nim-list-row__trailing">{trailing}</span> : null}
      {interactive && !trailing ? (
        <Icon className="nim-list-row__chevron" name="chevron-forward" size="sm" />
      ) : null}
    </>
  )

  const classes = cn('nim-list-row', interactive && 'nim-list-row--interactive', className)

  // A row that does something is a real button or link, never a div with a
  // click handler — that is what gives it keyboard focus for free.
  if (href) {
    return (
      <a className={classes} href={href} {...props}>
        {content}
      </a>
    )
  }

  if (onClick) {
    return (
      <button className={classes} onClick={onClick} type="button" {...props}>
        {content}
      </button>
    )
  }

  return (
    <div className={classes} {...props}>
      {content}
    </div>
  )
}
