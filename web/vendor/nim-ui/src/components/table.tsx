import type { ReactNode } from 'react'
import { Icon } from '@/components/icon'
import { cn } from '@/lib/cn'

export type SortDirection = 'ascending' | 'descending'

export interface TableColumn<Row> {
  /** Aligns to the trailing edge in tabular figures. Use it for money, counts,
      and dates — anything a reader compares down a column. */
  numeric?: boolean
  header: ReactNode
  key: string
  render: (row: Row) => ReactNode
  sortable?: boolean
  width?: string
}

export interface TableProps<Row> {
  caption?: string
  className?: string
  columns: TableColumn<Row>[]
  onSort?: (key: string) => void
  rowKey: (row: Row) => string
  rows: Row[]
  sort?: { direction: SortDirection; key: string }
}

/**
 * A table, not a grid of divs: the caller supplies columns and rows and gets
 * real `<table>` semantics, which is what lets a screen reader announce "row 3
 * of 84, Amount 4,200".
 *
 * Row height follows `--nim-density`, the same multiplier that drives control
 * heights — the reason density is a token rather than a prop here.
 */
export function Table<Row>({ caption, className, columns, onSort, rowKey, rows, sort }: TableProps<Row>) {
  return (
    <div className={cn('nim-table-wrap', className)}>
      <table className="nim-table">
        {caption ? <caption className="nim-caption">{caption}</caption> : null}
        <thead>
          <tr>
            {columns.map((column) => {
              const sorted = sort?.key === column.key ? sort.direction : undefined

              return (
                <th
                  aria-sort={sorted}
                  className={cn(column.numeric && 'nim-table__cell--numeric')}
                  key={column.key}
                  scope="col"
                  style={column.width ? { inlineSize: column.width } : undefined}
                >
                  {column.sortable && onSort ? (
                    <button className="nim-table__sort" onClick={() => onSort(column.key)} type="button">
                      {column.header}
                      {sorted ? <Icon name={sorted === 'ascending' ? 'chevron-up' : 'chevron-down'} size="xs" /> : null}
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((column) => (
                <td className={cn(column.numeric && 'nim-table__cell--numeric')} key={column.key}>
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
