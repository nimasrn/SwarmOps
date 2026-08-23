import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface DataListRow {
  id: string
  label: ReactNode
  /** Values that should not wrap mid-token — an ID, a hash — set this. */
  mono?: boolean
  value?: ReactNode
}

export interface DataListProps {
  className?: string
  /** `rows` reads as a two-column ledger; `stack` puts the label above the
      value, which is what narrow columns and phone widths need. */
  layout?: 'rows' | 'stack'
  rows: DataListRow[]
}

/**
 * `<dl>` — the one element the platform has for "these labels describe these
 * values". A table would claim a grid that does not exist here, and a list of
 * `<div>`s would lose the pairing entirely.
 *
 * A row where the value is missing still renders: an empty field is
 * information, and hiding it makes two records with different data look alike.
 */
export function DataList({ className, layout = 'rows', rows }: DataListProps) {
  return (
    <dl className={cn('nim-data-list', `nim-data-list--${layout}`, className)}>
      {rows.map((row) => (
        <div className="nim-data-list__row" key={row.id}>
          <dt className="nim-data-list__label">{row.label}</dt>
          <dd className={cn('nim-data-list__value', row.mono && 'nim-data-list__value--mono')}>
            {row.value ?? <span className="nim-data-list__empty">—</span>}
          </dd>
        </div>
      ))}
    </dl>
  )
}
