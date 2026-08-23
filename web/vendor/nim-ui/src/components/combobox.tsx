import { useId, useMemo, useRef, useState } from 'react'
import { FieldShell } from '@/components/field'
import { Icon } from '@/components/icon'
import { cn } from '@/lib/cn'

export interface ComboboxOption<T extends string> {
  disabled?: boolean
  label: string
  /** A trailing hint set in the mono — a count, a code, a date. */
  meta?: string
  value: T
}

export interface ComboboxProps<T extends string> {
  className?: string
  /** Shown when nothing matches. Give the viewer the way forward rather than
      a dead end: "No client matches — create it". */
  emptyState?: (query: string) => React.ReactNode
  error?: string
  hint?: string
  id?: string
  label?: string
  onChange: (value: T | null) => void
  options: ComboboxOption<T>[]
  placeholder?: string
  required?: boolean
  value: T | null
}

/**
 * A text input that suggests, and can still be typed into.
 *
 * A real `<input>` with `role="combobox"` over a `role="listbox"`, so the
 * platform's text editing, autofill and form participation are untouched.
 * Arrow keys move the active option, Enter commits it, Escape reverts to the
 * last committed value rather than clearing the field.
 */
export function Combobox<T extends string>({
  className,
  emptyState,
  error,
  hint,
  id,
  label,
  onChange,
  options,
  placeholder,
  required,
  value,
}: ComboboxProps<T>) {
  const listId = useId()
  const selected = options.find((option) => option.value === value) ?? null
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return options
    return options.filter((option) => option.label.toLowerCase().includes(needle))
  }, [options, query])

  const commit = (option: ComboboxOption<T>) => {
    onChange(option.value)
    setQuery('')
    setOpen(false)
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      setQuery('')
      setOpen(false)
      return
    }
    if (!open && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      setOpen(true)
      return
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      const usable = matches.filter((option) => !option.disabled)
      if (usable.length === 0) return
      setActive((index) => (index + step + usable.length) % usable.length)
    }
    if (event.key === 'Enter') {
      const usable = matches.filter((option) => !option.disabled)
      const option = usable[active]
      if (option) {
        event.preventDefault()
        commit(option)
      }
    }
  }

  const usable = matches.filter((option) => !option.disabled)

  return (
    <FieldShell className={className} error={error} hint={hint} id={id} label={label} required={required}>
      {({ control, describedBy }) => (
        <div className="nim-combobox">
          <div className={cn('nim-input-shell', 'nim-input-shell--has-end')}>
            <input
              aria-autocomplete="list"
              aria-controls={open ? listId : undefined}
              aria-describedby={describedBy}
              aria-expanded={open}
              className="nim-input"
              id={control}
              onBlur={() => window.setTimeout(() => setOpen(false), 120)}
              onChange={(event) => {
                setQuery(event.target.value)
                setActive(0)
                setOpen(true)
              }}
              onFocus={() => setOpen(true)}
              onKeyDown={onKeyDown}
              placeholder={placeholder}
              ref={inputRef}
              role="combobox"
              value={open ? query : (selected?.label ?? '')}
            />
            <span className="nim-input-shell__affix nim-input-shell__affix--end">
              <Icon name="chevron-down" size="sm" />
            </span>
          </div>
          {open ? (
            <div className="nim-combobox__list" id={listId} role="listbox">
              {usable.length === 0 ? (
                <div className="nim-combobox__empty">
                  {emptyState ? emptyState(query) : `Nothing matches “${query}”.`}
                </div>
              ) : (
                matches.map((option) => (
                  <button
                    aria-selected={usable.indexOf(option) === active}
                    className="nim-combobox__option"
                    disabled={option.disabled}
                    key={option.value}
                    onClick={() => commit(option)}
                    onPointerEnter={() => setActive(usable.indexOf(option))}
                    role="option"
                    type="button"
                  >
                    <span>{option.label}</span>
                    {option.meta ? <span className="nim-combobox__meta">{option.meta}</span> : null}
                  </button>
                ))
              )}
            </div>
          ) : null}
        </div>
      )}
    </FieldShell>
  )
}
