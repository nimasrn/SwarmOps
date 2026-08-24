import type { ReactNode } from 'react'
import { Button } from '@/components/button'
import { EmptyState } from '@/components/empty-state'
import { Icon } from '@/components/icon'
import { Pagination } from '@/components/pagination'
import { Table, type SortDirection, type TableColumn } from '@/components/table'
import { Checkbox } from '@/components/choice'
import { Skeleton } from '@/components/feedback'
import { cn } from '@/lib/cn'

export interface DataTableSelection<Row> {
  /** Rows the caller considers selected. Held by the caller, because what a
      selection MEANS — survives a page change, survives a filter change,
      addresses ids the current page does not contain — is the product's
      decision and not a table's. */
  isSelected: (row: Row) => boolean
  onToggle: (row: Row, selected: boolean) => void
  onToggleAll?: (selected: boolean) => void
  label?: (row: Row) => string
}

export interface DataTableProps<Row> {
  caption?: string
  className?: string
  columns: TableColumn<Row>[]
  /** Rendered when `rows` is empty and nothing is loading or failing. */
  empty?: ReactNode
  /** A failed load. It replaces the rows rather than sitting above stale
      ones: a table showing yesterday's rows under a red banner is read as
      today's rows by everyone in a hurry, which is everyone. */
  error?: ReactNode
  labels?: {
    selectAll: string
    selectRow: string
  }
  /** First load only. A refetch keeps the current rows on screen and dims
      them — replacing a populated table with skeletons on every poll is how
      a live console becomes unreadable. */
  loading?: boolean
  onRetry?: () => void
  onSort?: (key: string) => void
  /** 1-based. Omit the whole group to render no pagination. */
  page?: number
  pageCount?: number
  onPageChange?: (page: number) => void
  /** Free text under the table — "Showing 1–25 of 3,120". */
  summary?: string
  refreshing?: boolean
  retryLabel?: string
  rowKey: (row: Row) => string
  rows: Row[]
  selection?: DataTableSelection<Row>
  skeletonRows?: number
  sort?: { direction: SortDirection; key: string }
  /** The filter/action strip. Passed in rather than assembled here: which
      filters a collection has is the screen's knowledge, and a table that
      generates its own controls from its columns generates the wrong ones. */
  toolbar?: ReactNode
}

/** Stable identities, so the skeleton does not re-mount on every render. */
const SKELETON_ROWS = (count: number) =>
  Array.from({ length: count }, (_, index) => ({ __skeleton: index }))

const DEFAULT_LABELS = {
  selectAll: 'Select all rows',
  selectRow: 'Select row',
}

/**
 * A collection screen in one component: toolbar, table, selection, the four
 * states a remote list is ever in, and pagination.
 *
 * `Table` stays the primitive underneath and is still the right choice for a
 * table that is just a table. This is the assembly both consumers had written
 * twice each — and had written differently each time, which is why one of them
 * lost its empty state and the other showed a spinner over stale rows.
 *
 * The four states are mutually exclusive and resolved in one place, in this
 * order: error, first load, empty, rows. That ordering is the component's
 * actual contract — every ad-hoc version of this got it wrong by rendering an
 * empty state during the first load.
 */
export function DataTable<Row>({
  caption,
  className,
  columns,
  empty,
  error,
  labels,
  loading = false,
  onPageChange,
  onRetry,
  onSort,
  page,
  pageCount,
  refreshing = false,
  retryLabel = 'Try again',
  rowKey,
  rows,
  selection,
  skeletonRows = 6,
  sort,
  summary,
  toolbar,
}: DataTableProps<Row>) {
  const text = { ...DEFAULT_LABELS, ...labels }

  const allSelected = rows.length > 0 && selection ? rows.every((row) => selection.isSelected(row)) : false

  const withSelection: TableColumn<Row>[] = selection
    ? [
        {
          header: selection.onToggleAll ? (
            <Checkbox
              aria-label={text.selectAll}
              checked={allSelected}
              onChange={(event) => selection.onToggleAll?.(event.currentTarget.checked)}
            />
          ) : (
            <span className="nim-visually-hidden">{text.selectAll}</span>
          ),
          key: '__select',
          render: (row) => (
            <Checkbox
              aria-label={selection.label?.(row) ?? text.selectRow}
              checked={selection.isSelected(row)}
              onChange={(event) => selection.onToggle(row, event.currentTarget.checked)}
            />
          ),
          width: '2.5rem',
        },
        ...columns,
      ]
    : columns

  let body: ReactNode

  if (error) {
    body = (
      <div className="nim-data-table__state">
        <EmptyState
          actions={onRetry ? <Button onClick={onRetry} size="sm" variant="secondary">{retryLabel}</Button> : undefined}
          icon="danger"
          title={error}
        />
      </div>
    )
  } else if (loading) {
    // Skeleton rows in the real table, with the real columns: the header stays
    // put and nothing jumps when the data lands.
    body = (
      <Table
        caption={caption}
        columns={withSelection.map((column) => ({
          ...column,
          render: () => <Skeleton height="0.9em" width={column.numeric ? '3rem' : '70%'} />,
          sortable: false,
        }))}
        rowKey={(row) => `skeleton-${(row as { __skeleton: number }).__skeleton}`}
        rows={SKELETON_ROWS(skeletonRows) as unknown as Row[]}
      />
    )
  } else if (rows.length === 0) {
    body = <div className="nim-data-table__state">{empty}</div>
  } else {
    body = (
      <Table
        caption={caption}
        columns={withSelection}
        onSort={onSort}
        rowKey={rowKey}
        rows={rows}
        sort={sort}
      />
    )
  }

  return (
    <div className={cn('nim-data-table', className)} data-refreshing={refreshing ? 'true' : undefined}>
      {toolbar}
      <div className="nim-data-table__body">
        {body}
        {refreshing ? (
          <span className="nim-data-table__pulse">
            <Icon name="loading" size="xs" />
          </span>
        ) : null}
      </div>
      {page && pageCount && pageCount > 1 && onPageChange ? (
        <Pagination onChange={onPageChange} page={page} pageCount={pageCount} summary={summary} />
      ) : summary ? (
        <p className="nim-data-table__summary">{summary}</p>
      ) : null}
    </div>
  )
}
