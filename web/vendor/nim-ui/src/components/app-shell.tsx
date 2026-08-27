import type { ReactNode } from 'react'
import { TabBar, type TabBarProps } from '@/components/tab-bar'
import { cn } from '@/lib/cn'

export interface AppShellProps {
  children: ReactNode
  className?: string
  /** Sticky top row: a title, a back control, an action. Optional — many
      screens carry their own header inside the content instead. */
  header?: ReactNode
  /** The bottom navigation. Omit it on a screen deeper in the stack: a tab bar
      that stays visible under a detail page invites the viewer to leave. */
  tabs?: TabBarProps
  /** `'responsive'` (the default) widens the frame and turns the tab bar into
      a side rail on a laptop. `'phone'` keeps the phone frame at every width —
      for a product that is only ever a phone screen. */
  frame?: 'responsive' | 'phone'
}

/**
 * The frame an app lives in: a sticky header, one scrolling region, and the
 * tab bar.
 *
 * On a laptop the same shell widens and the tab bar becomes a side rail, so a
 * product ships one navigation rather than a mobile one and a desktop one.
 *
 * The scroll container is here and nowhere else, which is what makes scroll
 * restoration, pull-to-refresh and "scroll to top on tab change" one thing to
 * implement rather than one per screen. The content region reserves room for
 * the bar it is drawn under, so the last row of a list is never hidden behind
 * it — the failure this component exists to prevent.
 */
export function AppShell({ children, className, frame = 'responsive', header, tabs }: AppShellProps) {
  return (
    <div className={cn('nim-app-shell', className)} data-frame={frame === 'phone' ? 'phone' : undefined}>
      {header ? <header className="nim-app-shell__header">{header}</header> : null}
      <main className="nim-app-shell__content" data-has-tabs={tabs ? 'true' : undefined}>
        {children}
      </main>
      {tabs ? <TabBar {...tabs} /> : null}
    </div>
  )
}
