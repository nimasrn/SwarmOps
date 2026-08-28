import { useState } from 'react'
import type { ReactNode } from 'react'
import { Icon, type IconName } from '@/components/icon'
import { IconButton } from '@/components/icon-button'
import { cn } from '@/lib/cn'

export interface AdminNavItem {
  href?: string
  icon?: IconName
  key: string
  label: ReactNode
  onSelect?: () => void
}

export interface AdminNavGroup {
  icon?: IconName
  items: AdminNavItem[]
  key: string
  label: ReactNode
}

export interface AdminShellProps {
  /** Brand mark at the top of the sidebar. */
  brand?: ReactNode
  children: ReactNode
  className?: string
  /** Adds the rail control: the sidebar narrows to its icons and the labels
      become tooltips. Off by default — a console with five destinations has
      nothing to reclaim, and the control is then one more thing to explain. */
  collapsible?: boolean
  /** Under the nav: session state, build version — the things an operator
      checks before believing a screen. */
  sidebarFooter?: ReactNode
  /** Optional second-level navigation for section-based consoles. It stays
      visible beside the workspace on wide containers and becomes a compact
      horizontal strip on smaller ones. */
  contextualGroups?: AdminNavGroup[]
  /** Identity or scope shown above contextual navigation. */
  contextualHeader?: ReactNode
  /** Evidence or a recovery shortcut shown below contextual navigation. */
  contextualFooter?: ReactNode
  /** Active item in contextualGroups. Defaults to value. */
  contextualValue?: string
  groups: AdminNavGroup[]
  labels?: { menu?: string; nav?: string; close?: string; collapse?: string; expand?: string }
  /** `sidebar` is the conventional deep console hierarchy. `sections` is a
      shallow control-plane shell: brand, scope, and actions share the
      masthead while primary destinations form a horizontal section bar.
      `rail` keeps primary areas as an icon-only first tier beside the
      contextual destination sidebar. Rail items must provide an icon. */
  navigation?: 'rail' | 'sections' | 'sidebar'
  /** `key` of the active item. */
  value: string
  /** Search field, status pills, the signed-in operator. */
  toolbar?: ReactNode
  title?: ReactNode
  /** `page` renders the topbar title as the screen's h1. Use `scope` when the
      topbar carries persistent Core/cluster selectors and the workspace owns
      its own h1 through `DetailHeader`. */
  titleRole?: 'page' | 'scope'
}

const DEFAULT_LABELS = {
  close: 'Close menu',
  collapse: 'Collapse',
  expand: 'Expand',
  menu: 'Open menu',
  nav: 'Admin navigation',
}

/**
 * The console layout: a grouped sidebar, a topbar, and one scrolling workspace.
 *
 * The counterpart to `AppShell`, and deliberately a different component rather
 * than a `variant`: an operator console is a desktop-first, two-column, deep
 * hierarchy, and a phone app is a single column with five destinations. Sharing
 * one component would mean every screen carrying the other's assumptions.
 *
 * Below the layout's breakpoint the same sidebar becomes a drawer — the same
 * markup, not a second nav to keep in sync, which is how the two drift apart.
 */
export function AdminShell({
  brand,
  children,
  className,
  collapsible = false,
  contextualFooter,
  contextualGroups,
  contextualHeader,
  contextualValue,
  groups,
  labels,
  navigation = 'sidebar',
  sidebarFooter,
  title,
  toolbar,
  value,
  titleRole = 'page',
}: AdminShellProps) {
  const text = { ...DEFAULT_LABELS, ...labels }
  const [open, setOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const Title = titleRole === 'scope' ? 'div' : 'h1'

  const renderNav = (items: AdminNavGroup[], activeValue: string, ariaLabel: string) => (
    <nav aria-label={ariaLabel} className="nim-admin__nav">
      {items.map((group) => (
        <div className="nim-admin__group" key={group.key}>
          {group.label ? <p className="nim-admin__group-label">
            {group.icon ? <Icon name={group.icon} size="xs" /> : null}
            {group.label}
          </p> : null}
          {group.items.map((item) => {
            const active = item.key === activeValue
            const content = (
              <>
                {item.icon ? <Icon name={item.icon} size="sm" /> : null}
                <span>{item.label}</span>
              </>
            )
            const props = {
              'aria-current': active ? ('page' as const) : undefined,
              className: 'nim-admin__link',
              'data-active': active ? 'true' : undefined,
              onClick: () => {
                item.onSelect?.()
                setOpen(false)
              },
              // The only text left in the rail is the icon, so the accessible
              // name has to survive the collapse — it is the label, always,
              // not a second string that can drift away from it.
              title: typeof item.label === 'string' ? item.label : undefined,
            }
            return item.href ? (
              <a href={item.href} key={item.key} {...props}>
                {content}
              </a>
            ) : (
              <button key={item.key} type="button" {...props}>
                {content}
              </button>
            )
          })}
        </div>
      ))}
    </nav>
  )
  const nav = renderNav(groups, value, text.nav)
  const contextualNav = contextualGroups?.length
    ? renderNav(contextualGroups, contextualValue ?? value, `${text.nav} · current section`)
    : null

  return (
    <div
      className={cn('nim-admin', className)}
      data-collapsed={collapsible && collapsed ? 'true' : undefined}
      data-drawer={open ? 'open' : undefined}
      data-navigation={navigation}
    >
      {navigation !== 'sections' ? <aside className="nim-admin__sidebar">
        {brand || collapsible ? (
          <div className="nim-admin__brand">
            {brand}
          </div>
        ) : null}
        {nav}
        {sidebarFooter ? <div className="nim-admin__sidebar-foot">{sidebarFooter}</div> : null}
        {collapsible ? (
          <button
            aria-label={collapsed ? text.expand : text.collapse}
            aria-expanded={!collapsed}
            className="nim-admin__rail-toggle"
            onClick={() => setCollapsed((current) => !current)}
            type="button"
          >
            <Icon name={collapsed ? 'chevron-forward' : 'chevron-back'} size="sm" />
            <span>{collapsed ? text.expand : text.collapse}</span>
          </button>
        ) : null}
      </aside> : null}

      {/* The drawer is the sidebar again, not a second navigation: one source
          for the items, so the two cannot disagree. */}
      <div className="nim-admin__drawer" hidden={!open}>
        <div className="nim-admin__scrim" onClick={() => setOpen(false)} />
        <div className="nim-admin__drawer-panel">
          <div className="nim-admin__drawer-head">
            {brand}
            <IconButton label={text.close} name="close" onClick={() => setOpen(false)} size="sm" />
          </div>
          {nav}
        </div>
      </div>

      <div className="nim-admin__workspace">
        <header className="nim-admin__topbar">
          <IconButton
            aria-expanded={open}
            className="nim-admin__menu"
            label={text.menu}
            name="menu"
            onClick={() => setOpen(true)}
            size="sm"
          />
          {navigation === 'sections' && brand ? <div className="nim-admin__masthead-brand">{brand}</div> : null}
          {title ? <Title className="nim-admin__title">{title}</Title> : null}
          {toolbar ? <div className="nim-admin__toolbar">{toolbar}</div> : null}
        </header>
        {navigation === 'sections' ? <div className="nim-admin__sections">{nav}</div> : null}
        {contextualNav ? (
          <div className="nim-admin__context-layout">
            <aside className="nim-admin__context">
              {contextualHeader ? <div className="nim-admin__context-head">{contextualHeader}</div> : null}
              <div className="nim-admin__context-nav">{contextualNav}</div>
              {contextualFooter ? <div className="nim-admin__context-foot">{contextualFooter}</div> : null}
            </aside>
            <main className="nim-admin__main">{children}</main>
          </div>
        ) : <main className="nim-admin__main">{children}</main>}
      </div>
    </div>
  )
}

export interface DetailHeaderProps {
  /** Buttons for this record: approve, retry, export. */
  actions?: ReactNode
  back?: { href?: string; label: string; onClick?: () => void }
  className?: string
  /** Status badge, owner, id — the facts that qualify the title. */
  meta?: ReactNode
  status?: ReactNode
  subtitle?: ReactNode
  title: ReactNode
}

/**
 * The top of a record: where it sits, what it is, and what can be done to it.
 *
 * The actions live here rather than at the bottom of the page because an
 * operator working a queue acts on the record without reading all of it, and a
 * button below a thousand-row table is a button nobody finds.
 */
export function DetailHeader({
  actions,
  back,
  className,
  meta,
  status,
  subtitle,
  title,
}: DetailHeaderProps) {
  return (
    <header className={cn('nim-detail-header', className)}>
      {back ? (
        back.href ? (
          <a className="nim-detail-header__back" href={back.href}>
            <Icon name="chevron-back" size="sm" />
            {back.label}
          </a>
        ) : (
          <button className="nim-detail-header__back" onClick={back.onClick} type="button">
            <Icon name="chevron-back" size="sm" />
            {back.label}
          </button>
        )
      ) : null}

      <div className="nim-detail-header__row">
        <div className="nim-detail-header__text">
          {/* The status sits beside the heading, not inside it: a badge folded
              into an <h1> becomes part of the heading's accessible name, and
              "Payment #48210 Awaiting review" is not what the record is
              called. */}
          <div className="nim-detail-header__headline">
            <h1 className="nim-detail-header__title">{title}</h1>
            {status ? <span className="nim-detail-header__status">{status}</span> : null}
          </div>
          {subtitle ? <p className="nim-detail-header__subtitle">{subtitle}</p> : null}
          {meta ? <div className="nim-detail-header__meta">{meta}</div> : null}
        </div>
        {actions ? <div className="nim-detail-header__actions">{actions}</div> : null}
      </div>
    </header>
  )
}

export interface FilterChip {
  key: string
  label: ReactNode
  onRemove: () => void
  /** The value the filter is set to, shown after the label. */
  value?: ReactNode
}

export interface FilterChipsProps {
  chips: FilterChip[]
  className?: string
  clearLabel?: string
  labels?: { remove: (label: string) => string; toolbar: string }
  onClearAll?: () => void
}

/**
 * The filters currently narrowing a table, each removable.
 *
 * It renders nothing when there are none — an empty toolbar reserving space
 * for filters nobody set is the reason these strips feel like chrome. Every
 * chip states what it removes in its accessible name, because "remove" ten
 * times over is no name at all.
 */
export function FilterChips({
  chips,
  className,
  clearLabel,
  labels,
  onClearAll,
}: FilterChipsProps) {
  if (chips.length === 0) return null
  const text = {
    remove: (label: string) => `Remove filter ${label}`,
    toolbar: 'Active filters',
    ...labels,
  }

  return (
    <div aria-label={text.toolbar} className={cn('nim-filter-chips', className)} role="toolbar">
      {chips.map((chip) => (
        <span className="nim-filter-chip" key={chip.key}>
          <span className="nim-filter-chip__label">
            {chip.label}
            {chip.value !== undefined ? <>: {chip.value}</> : null}
          </span>
          <button
            aria-label={text.remove(typeof chip.label === 'string' ? chip.label : chip.key)}
            className="nim-filter-chip__remove"
            onClick={chip.onRemove}
            type="button"
          >
            <Icon name="close" size="xs" />
          </button>
        </span>
      ))}
      {onClearAll && clearLabel ? (
        <button className="nim-filter-chips__clear" onClick={onClearAll} type="button">
          {clearLabel}
        </button>
      ) : null}
    </div>
  )
}

export interface ActivityEvent {
  /** What happened, in the product's own words. */
  action: ReactNode
  actor?: ReactNode
  /** ISO timestamp. Formatted here, in the viewer's locale. */
  at?: string
  icon?: IconName
  id: string
  target?: ReactNode
  tone?: 'accent' | 'danger' | 'default' | 'success' | 'warning'
}

export interface ActivityFeedProps {
  className?: string
  empty?: ReactNode
  events: ActivityEvent[]
  locale?: string
}

/**
 * Who did what, most recent first.
 *
 * Timestamps are absolute rather than "3 hours ago": an audit trail is read to
 * reconstruct a sequence, and a relative time that keeps moving is exactly
 * what you cannot compare two of.
 */
export function ActivityFeed({ className, empty, events, locale }: ActivityFeedProps) {
  const when = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  })

  if (events.length === 0) {
    return <div className={cn('nim-activity', className)}>{empty}</div>
  }

  return (
    <ol className={cn('nim-activity', className)}>
      {events.map((event) => (
        <li className="nim-activity__item" data-tone={event.tone} key={event.id}>
          <span className="nim-activity__marker">
            {event.icon ? <Icon name={event.icon} size="xs" /> : null}
          </span>
          <div className="nim-activity__body">
            <p className="nim-activity__action">
              {event.actor ? <strong>{event.actor}</strong> : null} {event.action}{' '}
              {event.target ? <span className="nim-activity__target">{event.target}</span> : null}
            </p>
            {event.at ? (
              <time className="nim-activity__time" dateTime={event.at}>
                {when.format(new Date(event.at))}
              </time>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  )
}
