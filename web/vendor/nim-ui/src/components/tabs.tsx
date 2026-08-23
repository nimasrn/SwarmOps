import { useRef } from 'react'
import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export interface TabOption<T extends string> {
  /** A trailing figure — a count, never a decoration. */
  count?: number | string
  disabled?: boolean
  label: string
  value: T
}

export interface TabsProps<T extends string> extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  label: string
  onChange: (value: T) => void
  options: TabOption<T>[]
  value: T
}

/**
 * Tabs switch a region of the page. A Segmented control sets a value. They
 * look similar and mean different things, and 0.1 had the segmented control
 * carrying both jobs.
 *
 * Arrow keys move between tabs and select as they go — the pattern a tablist
 * is expected to follow when its panels are cheap to render.
 */
export function Tabs<T extends string>({ className, label, onChange, options, value, ...props }: TabsProps<T>) {
  const listRef = useRef<HTMLDivElement>(null)

  const onKeyDown = (event: React.KeyboardEvent) => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (step === 0) return

    event.preventDefault()
    const selectable = options.filter((option) => !option.disabled)
    const current = selectable.findIndex((option) => option.value === value)
    const next = selectable[(current + step + selectable.length) % selectable.length]
    if (!next) return

    onChange(next.value)
    listRef.current?.querySelector<HTMLButtonElement>(`[data-value="${next.value}"]`)?.focus()
  }

  return (
    <div
      aria-label={label}
      className={cn('nim-tabs', className)}
      onKeyDown={onKeyDown}
      ref={listRef}
      role="tablist"
      {...props}
    >
      {options.map((option) => (
        <button
          aria-selected={option.value === value}
          className="nim-tab"
          data-value={option.value}
          disabled={option.disabled}
          key={option.value}
          onClick={() => onChange(option.value)}
          role="tab"
          tabIndex={option.value === value ? 0 : -1}
          type="button"
        >
          {option.label}
          {option.count === undefined ? null : <span className="nim-tab__count">{option.count}</span>}
        </button>
      ))}
    </div>
  )
}
