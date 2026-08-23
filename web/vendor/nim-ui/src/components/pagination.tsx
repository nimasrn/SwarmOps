import { Icon } from '@/components/icon'
import { cn } from '@/lib/cn'

export interface PaginationProps {
  className?: string
  label?: string
  nextLabel?: string
  onChange: (page: number) => void
  page: number
  pageCount: number
  previousLabel?: string
  /** Free text on the leading edge — "Showing 1–6 of 84". */
  summary?: string
}

/**
 * Renders at most seven slots: first, last, the current page and its
 * neighbours, and an ellipsis wherever the run breaks. The window never
 * changes width as the viewer moves through it, so the control does not
 * reflow under the pointer.
 */
const windowFor = (page: number, pageCount: number): (number | 'gap')[] => {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, index) => index + 1)

  const pages = new Set([1, pageCount, page, page - 1, page + 1])
  if (page <= 3) [2, 3, 4].forEach((value) => pages.add(value))
  if (page >= pageCount - 2) [pageCount - 3, pageCount - 2, pageCount - 1].forEach((value) => pages.add(value))

  const sorted = [...pages].filter((value) => value >= 1 && value <= pageCount).sort((a, b) => a - b)

  return sorted.flatMap((value, index) => (index > 0 && value - sorted[index - 1]! > 1 ? ['gap' as const, value] : [value]))
}

export function Pagination({
  className,
  label = 'Pagination',
  nextLabel = 'Next page',
  onChange,
  page,
  pageCount,
  previousLabel = 'Previous page',
  summary,
}: PaginationProps) {
  return (
    <nav aria-label={label} className={cn('nim-pagination', className)}>
      {summary ? <p className="nim-pagination__summary">{summary}</p> : <span />}
      <div className="nim-pagination__list">
        <button
          aria-label={previousLabel}
          className="nim-pagination__item"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          type="button"
        >
          <Icon name="chevron-back" size="sm" />
        </button>
        {windowFor(page, pageCount).map((slot, index) =>
          slot === 'gap' ? (
            <span aria-hidden="true" className="nim-pagination__ellipsis" key={`gap-${index}`}>
              …
            </span>
          ) : (
            <button
              aria-current={slot === page ? 'page' : undefined}
              className="nim-pagination__item"
              key={slot}
              onClick={() => onChange(slot)}
              type="button"
            >
              {slot}
            </button>
          ),
        )}
        <button
          aria-label={nextLabel}
          className="nim-pagination__item"
          disabled={page >= pageCount}
          onClick={() => onChange(page + 1)}
          type="button"
        >
          <Icon name="chevron-forward" size="sm" />
        </button>
      </div>
    </nav>
  )
}
