import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ReactElement, ReactNode, Ref, RefObject } from 'react'
import { Icon, type IconName } from '@/components/icon'
import { cn } from '@/lib/cn'
import { useAnchor } from '@/lib/use-anchor'

export interface MenuAction {
  danger?: boolean
  disabled?: boolean
  icon?: IconName
  kind?: 'action'
  label: string
  onSelect: () => void
  /** Rendered in the mono, on the trailing edge — a hint, never a binding. */
  shortcut?: string
}

export interface MenuHeading {
  kind: 'heading'
  label: string
}

export interface MenuSeparator {
  kind: 'separator'
}

export type MenuItem = MenuAction | MenuHeading | MenuSeparator

export interface MenuProps {
  /** The trigger is the caller's, so the menu has no opinion about what opens
      it — it only needs the ref to anchor against. */
  children: (props: { open: boolean; ref: Ref<HTMLButtonElement>; toggle: () => void }) => ReactElement
  className?: string
  items: MenuItem[]
  label: string
}

const isAction = (item: MenuItem): item is MenuAction => item.kind === undefined || item.kind === 'action'

/**
 * A list of actions, dismissed by choosing one. A menu holds actions and never
 * inputs — something the viewer types into is a Popover.
 *
 * The trigger is supplied by the caller as a render prop so the menu never has
 * an opinion about what opens it; it only needs the ref to anchor against.
 * Arrow keys move a roving active item, Enter and Space choose it, Escape and
 * an outside click dismiss, and focus returns to the trigger either way.
 */
export function Menu({ children, className, items, label }: MenuProps) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const position = useAnchor(triggerRef, panelRef, { onDismiss: () => setOpen(false), open })

  const actions = items.filter(isAction)
  const enabled = actions.filter((item) => !item.disabled)

  const toggle = () => {
    setActive(0)
    setOpen((value) => !value)
  }

  const choose = (item: MenuAction) => {
    setOpen(false)
    item.onSelect()
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (enabled.length === 0) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActive((index) => (index + step + enabled.length) % enabled.length)
    }
    if (event.key === 'Home') {
      event.preventDefault()
      setActive(0)
    }
    if (event.key === 'End') {
      event.preventDefault()
      setActive(enabled.length - 1)
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      const item = enabled[active]
      if (item) choose(item)
    }
  }

  return (
    <>
      {children({ open, ref: triggerRef, toggle })}
      {open && typeof document !== 'undefined'
        ? createPortal(
            <div
              aria-label={label}
              className={cn('nim-menu', className)}
              onKeyDown={onKeyDown}
              ref={panelRef}
              role="menu"
              style={{ insetBlockStart: position.top, insetInlineStart: position.left }}
              tabIndex={-1}
            >
              {items.map((item, index) => {
                if (item.kind === 'separator') return <hr className="nim-menu__separator" key={`sep-${index}`} />
                if (item.kind === 'heading')
                  return (
                    <p className="nim-menu__label" key={`head-${index}`}>
                      {item.label}
                    </p>
                  )

                return (
                  <button
                    className={cn('nim-menu__item', item.danger && 'nim-menu__item--danger')}
                    data-active={enabled.indexOf(item) === active ? 'true' : undefined}
                    disabled={item.disabled}
                    key={item.label}
                    onClick={() => choose(item)}
                    onPointerEnter={() => setActive(enabled.indexOf(item))}
                    role="menuitem"
                    type="button"
                  >
                    {item.icon ? <Icon className="nim-menu__icon" name={item.icon} size="sm" /> : null}
                    <span>{item.label}</span>
                    {item.shortcut ? <span className="nim-menu__shortcut">{item.shortcut}</span> : null}
                  </button>
                )
              })}
            </div>,
            document.body,
          )
        : null}
    </>
  )
}

export interface PopoverProps {
  children: ReactNode
  className?: string
  label: string
  onClose: () => void
  open: boolean
  /** The element the panel is placed against. */
  triggerRef: RefObject<HTMLElement | null>
}

/**
 * A menu's geometry with a form's contents. Unlike a menu it does not close on
 * a click inside, because the thing inside is what the viewer came for.
 */
export function Popover({ children, className, label, onClose, open, triggerRef }: PopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const position = useAnchor(triggerRef, panelRef, { onDismiss: onClose, open })

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div
      aria-label={label}
      className={cn('nim-popover', className)}
      ref={panelRef}
      role="dialog"
      style={{ insetBlockStart: position.top, insetInlineStart: position.left }}
    >
      {children}
    </div>,
    document.body,
  )
}
