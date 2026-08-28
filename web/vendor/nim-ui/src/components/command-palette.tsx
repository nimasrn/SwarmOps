import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Icon, type IconName } from '@/components/icon'
import { cn } from '@/lib/cn'

export interface PaletteCommand {
  disabled?: boolean
  /** Heading the command is filed under. Commands keep the order they are
      given; a group is drawn where its first member appears. */
  group?: string
  /** The second line — what choosing this does, not a repeat of the label. */
  hint?: ReactNode
  icon?: IconName
  id: string
  /** Extra words the command should match on, never drawn. Synonyms and the
      old name of a screen belong here, so a rename does not make a
      destination unfindable by the name the operator still uses. */
  keywords?: string
  label: string
  onRun: () => void
  /** Drawn in the mono on the trailing edge — a hint, never a binding. */
  shortcut?: string
}

export interface CommandPaletteProps {
  className?: string
  commands: PaletteCommand[]
  emptyLabel?: (query: string) => ReactNode
  /** Accessible name of the surface, and the heading above the field. */
  label: string
  onClose: () => void
  open: boolean
  placeholder?: string
}

interface Ranked {
  command: PaletteCommand
  rank: number
}

/**
 * The console's keyboard surface: one field, one ranked list, one action.
 *
 * It is deliberately NOT a Combobox with a wider box. A combobox edits a
 * field's value and its result is a selection; a palette runs something and
 * leaves no value behind — which is why its rows carry an icon, a purpose and
 * a shortcut, and why closing it is the normal end of every interaction.
 *
 * The surface is a real `<dialog>` opened with `showModal()`, so the top
 * layer, the focus trap, the inert background and Escape come from the
 * platform. The hotkey that OPENS it is the app's: a component that bound a
 * global key would collide with every other consumer on the page, and which
 * chord an app spends is a product decision.
 */
export function CommandPalette({
  className,
  commands,
  emptyLabel = (query) => `Nothing matches “${query}”.`,
  label,
  onClose,
  open,
  placeholder = 'Search…',
}: CommandPaletteProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)

  const matches = useMemo(() => rank(commands, query), [commands, query])
  const runnable = matches.filter((command) => !command.disabled)
  const current = runnable[Math.min(active, Math.max(runnable.length - 1, 0))]

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      // The field IS the surface. Focusing it imperatively rather than with
      // `autoFocus` keeps the caret arriving on every opening, not only on
      // the first mount of a dialog that is never unmounted.
      inputRef.current?.focus()
    }
    if (!open && dialog.open) dialog.close()
  }, [open])

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    // A palette that reopens holding the last search reopens showing the
    // wrong list, so the search is cleared as it closes — from the platform's
    // own `close`, which fires for Escape and for every programmatic close
    // alike, rather than from a second key listener that could miss one.
    const closed = () => {
      setQuery('')
      setActive(0)
      onClose()
    }
    dialog.addEventListener('close', closed)
    return () => dialog.removeEventListener('close', closed)
  }, [onClose])

  // Keyboard movement must keep the active row on screen, or the selection
  // silently walks past the bottom of a scrolled list.
  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [active, query])

  const run = (command?: PaletteCommand) => {
    if (!command || command.disabled) return
    onClose()
    command.onRun()
  }

  const keydown = (event: React.KeyboardEvent) => {
    if (!runnable.length) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((index) => (index + 1) % runnable.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((index) => (index - 1 + runnable.length) % runnable.length)
    } else if (event.key === 'Home') {
      event.preventDefault()
      setActive(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      setActive(runnable.length - 1)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      run(current)
    }
  }

  // Group headings belong to the UNRANKED list only. Once a query reorders the
  // rows by where the match landed, a heading no longer describes what follows
  // it, and the same heading would be drawn again further down.
  const grouped = !query.trim()
  let group: string | undefined
  return (
    <dialog
      aria-label={label}
      className={cn('nim-palette', className)}
      onClick={(event) => {
        if (event.target === ref.current) onClose()
      }}
      ref={ref}
    >
      <div className="nim-palette__field">
        <Icon name="search" size="sm" />
        <input
          aria-activedescendant={current ? `${current.id}-palette-row` : undefined}
          aria-autocomplete="list"
          aria-controls="nim-palette-list"
          aria-expanded
          aria-label={label}
          autoComplete="off"
          className="nim-palette__input"
          onChange={(event) => {
            setQuery(event.target.value)
            // The ranking changes under the cursor, so the selection returns
            // to the top with it; leaving it where it was points Enter at a
            // row the viewer never looked at.
            setActive(0)
          }}
          onKeyDown={keydown}
          placeholder={placeholder}
          role="combobox"
          spellCheck={false}
          ref={inputRef}
          value={query}
        />
      </div>

      <div className="nim-palette__list" id="nim-palette-list" ref={listRef} role="listbox">
        {matches.length ? matches.map((command) => {
          const heading = grouped && command.group && command.group !== group ? command.group : undefined
          group = command.group
          const selected = command === current
          return (
            <div key={command.id}>
              {heading ? <p className="nim-palette__group" role="presentation">{heading}</p> : null}
              <button
                aria-selected={selected}
                className="nim-palette__row"
                data-active={selected ? 'true' : undefined}
                disabled={command.disabled}
                id={`${command.id}-palette-row`}
                onClick={() => run(command)}
                onMouseMove={() => {
                  const index = runnable.indexOf(command)
                  if (index >= 0 && index !== active) setActive(index)
                }}
                role="option"
                type="button"
              >
                <Icon name={command.icon ?? 'chevron-forward'} size="sm" />
                <span className="nim-palette__text">
                  <span className="nim-palette__label">{command.label}</span>
                  {command.hint ? <span className="nim-palette__hint">{command.hint}</span> : null}
                </span>
                {command.shortcut ? <kbd className="nim-palette__shortcut">{command.shortcut}</kbd> : null}
              </button>
            </div>
          )
        }) : <p className="nim-palette__empty">{emptyLabel(query)}</p>}
      </div>
    </dialog>
  )
}

/**
 * Rank, never merely filter. A palette whose first row is an alphabetical
 * accident makes the viewer read the list; ranking by WHERE the match landed
 * puts the thing they typed the start of at the top, where Enter already is.
 */
function rank(commands: PaletteCommand[], query: string): PaletteCommand[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return commands
  const ranked: Ranked[] = []
  for (const command of commands) {
    const label = command.label.toLowerCase()
    const rest = `${command.group ?? ''} ${command.keywords ?? ''}`.toLowerCase()
    const score = label.startsWith(needle) ? 0
      : label.includes(` ${needle}`) ? 1
      : label.includes(needle) ? 2
      : rest.includes(needle) ? 3
      : -1
    if (score >= 0) ranked.push({ command, rank: score })
  }
  // A stable sort keeps the caller's order inside a rank, so the groups the
  // caller built do not reshuffle every keystroke.
  return ranked.sort((left, right) => left.rank - right.rank).map((entry) => entry.command)
}
