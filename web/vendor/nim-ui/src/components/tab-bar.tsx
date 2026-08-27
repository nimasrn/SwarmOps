import type { CSSProperties, ReactNode } from 'react'
import { Icon, type IconName } from '@/components/icon'
import { cn } from '@/lib/cn'

export interface TabBarItem {
  /** Lifted and filled: the one action the product is for. At most one item
      should carry it — two centres is no centre. */
  center?: boolean
  href?: string
  icon: IconName
  /** Full name for assistive tech when `label` is shortened to fit. */
  fullLabel?: string
  key: string
  label: string
  onSelect?: () => void
}

export interface TabBarProps {
  /** Accessible name for the bar itself. */
  label: string
  className?: string
  items: TabBarItem[]
  /** `key` of the active item. */
  value: string
  /** Wrap items in the app's own router link. Given the item and the rendered
      content, returns the element to use — nim never imports a router. */
  renderItem?: (item: TabBarItem, content: ReactNode, props: Record<string, unknown>) => ReactNode
}

/**
 * The floating bottom navigation of a mobile app: three to five destinations,
 * one of them optionally lifted into a primary action.
 *
 * It renders real links or buttons and marks the active one with
 * `aria-current="page"`, so the bar is navigable by keyboard and readable by
 * assistive tech. Routing stays outside: `renderItem` hands the caller the
 * content and the props to spread onto their own `<Link>`, which is why the
 * kit ships no router dependency.
 *
 * It sits above the safe-area inset rather than under the home indicator, and
 * the page below owes it `padding-block-end` — a bar that covers the last row
 * of a list is the most common way this pattern goes wrong.
 */
export function TabBar({ className, items, label, renderItem, value }: TabBarProps) {
  return (
    <nav aria-label={label} className={cn('nim-tab-bar', className)}>
      <div className="nim-tab-bar__row" style={{ '--nim-tab-count': items.length } as CSSProperties}>
        {items.map((item) => {
          const active = item.key === value
          const content = (
            <>
              <Icon name={item.icon} size={item.center ? 'lg' : 'md'} />
              <span className="nim-tab-bar__label">{item.label}</span>
            </>
          )
          const props = {
            'aria-current': active ? ('page' as const) : undefined,
            'aria-label': item.fullLabel ?? item.label,
            className: cn('nim-tab-bar__item', item.center && 'nim-tab-bar__item--center'),
            'data-active': active ? 'true' : undefined,
          }

          if (renderItem) return (
              <div className="nim-tab-bar__slot" key={item.key}>
                {renderItem(item, content, props)}
              </div>
            )

          return item.href ? (
            <a href={item.href} key={item.key} {...props}>
              {content}
            </a>
          ) : (
            <button key={item.key} onClick={item.onSelect} type="button" {...props}>
              {content}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
