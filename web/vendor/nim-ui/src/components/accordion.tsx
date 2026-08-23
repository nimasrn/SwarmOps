import { useId, useState } from 'react'
import type { ReactNode } from 'react'
import { Icon } from '@/components/icon'
import { cn } from '@/lib/cn'

export interface AccordionItem {
  /** Rendered when the panel is open. Mounted whether or not it is open, so
      in-panel form state survives a collapse. */
  content: ReactNode
  disabled?: boolean
  id: string
  /** A short right-aligned note on the header row — a count, a status. */
  meta?: ReactNode
  title: string
}

export interface AccordionProps {
  className?: string
  /** Uncontrolled starting state. Ignored when `open` is given. */
  defaultOpen?: string[]
  items: AccordionItem[]
  /** One panel at a time. The default lets several stand open, because a
      reader comparing two sections should not have to choose between them. */
  mode?: 'multiple' | 'single'
  onOpenChange?: (open: string[]) => void
  open?: string[]
  /** Flush rows on the page's own surface, rather than a bordered block. */
  variant?: 'plain' | 'panel'
}

/**
 * Disclosure built on `<button aria-expanded>` + a height transition, not on
 * `<details>`: `<details>` cannot animate its own open state across browsers,
 * and it cannot be driven from outside without fighting the element.
 *
 * The panel animates `grid-template-rows: 0fr → 1fr`, which is what lets it
 * open to its CONTENT's height without measuring anything in JavaScript.
 */
export function Accordion({
  className,
  defaultOpen = [],
  items,
  mode = 'multiple',
  onOpenChange,
  open,
  variant = 'panel',
}: AccordionProps) {
  const base = useId()
  const [internal, setInternal] = useState<string[]>(defaultOpen)
  const value = open ?? internal

  const toggle = (id: string) => {
    const isOpen = value.includes(id)
    const next = mode === 'single' ? (isOpen ? [] : [id]) : isOpen ? value.filter((entry) => entry !== id) : [...value, id]
    if (!open) setInternal(next)
    onOpenChange?.(next)
  }

  return (
    <div className={cn('nim-accordion', `nim-accordion--${variant}`, className)}>
      {items.map((item) => {
        const isOpen = value.includes(item.id)
        const panelId = `${base}-${item.id}`

        return (
          <div className="nim-accordion__item" data-open={isOpen || undefined} key={item.id}>
            <button
              aria-controls={panelId}
              aria-expanded={isOpen}
              className="nim-accordion__trigger"
              disabled={item.disabled}
              id={`${panelId}-trigger`}
              onClick={() => toggle(item.id)}
              type="button"
            >
              <span className="nim-accordion__title">{item.title}</span>
              {item.meta ? <span className="nim-accordion__meta">{item.meta}</span> : null}
              <Icon className="nim-accordion__chevron" name="chevron-down" size="sm" />
            </button>
            <div
              aria-labelledby={`${panelId}-trigger`}
              className="nim-accordion__panel"
              id={panelId}
              role="region"
            >
              {/* A collapsed panel is zero pixels tall but its controls are
                  still in the tab order — `inert` is what actually takes them
                  out. It is not in React 18's JSX types, hence the cast. */}
              <div
                className="nim-accordion__panel-inner"
                {...({ inert: isOpen ? undefined : '' } as { inert?: string })}
              >
                {item.content}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
