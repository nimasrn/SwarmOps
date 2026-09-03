import { useId, useRef } from 'react'
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
  /** ID of the region switched by these tabs. */
  panelId?: string
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
export function Tabs<T extends string>({ className, label, onChange, options, panelId, value, ...props }: TabsProps<T>) {
  const listRef = useRef<HTMLDivElement>(null)
  const tabId = useId()

  const onKeyDown = (event: React.KeyboardEvent) => {
    const direction = listRef.current && getComputedStyle(listRef.current).direction === 'rtl' ? -1 : 1
    const step = (event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0) * direction
    if (step === 0 && event.key !== 'Home' && event.key !== 'End') return

    event.preventDefault()
    const selectable = options.filter((option) => !option.disabled)
    const current = selectable.findIndex((option) => option.value === value)
    const next = event.key === 'Home' ? selectable[0] : event.key === 'End' ? selectable.at(-1) : selectable[(current + step + selectable.length) % selectable.length]
    if (!next) return

    onChange(next.value)
    Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? []).find(button => button.dataset.value === next.value)?.focus()
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
          aria-controls={panelId}
          id={`${panelId ?? tabId}-tab-${option.value}`}
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
