import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Icon } from '@/components/icon'
import { cn } from '@/lib/cn'
import { COUNTRIES, countryByIso2, countryNamer, toAsciiDigits } from '@/lib/countries'

export interface PhoneFieldProps {
  className?: string
  /** ISO 3166-1 alpha-2 of the selected country, e.g. `IR`. */
  country: string
  error?: string
  hint?: string
  id?: string
  label?: string
  /** Locale the country names are shown in. Defaults to the document's. */
  locale?: string
  onChange: (value: string) => void
  onCountryChange: (iso2: string) => void
  onSubmit?: () => void
  placeholder?: string
  /** Countries to float above the alphabetical list — the ones most viewers
      of this product will pick. */
  priority?: string[]
  required?: boolean
  /** Accessible names for the picker. */
  labels?: { pickCountry: string; search: string; noMatch: string }
  /** The national number, ASCII digits only, without the dialling code. */
  value: string
}

const DEFAULT_LABELS = {
  noMatch: 'No country matches',
  pickCountry: 'Country code',
  search: 'Search countries',
}

/**
 * Phone number entry: a country picker welded to a number input.
 *
 * The two halves are separate props on purpose. A field that owns one E.164
 * string has to re-parse it on every keystroke to know which flag to draw, and
 * gets it wrong the moment someone types a `+` themselves; keeping the country
 * and the national digits apart means `+${dial}${value}` is the whole
 * serialisation and there is nothing to guess.
 *
 * The picker lists every ISO country, named in the viewer's locale, searchable
 * by name, code, or ISO letters. The input is `dir="ltr"` in every direction —
 * a phone number reads left to right in Persian too — and Persian digits are
 * normalised to ASCII on the way in.
 */
export function PhoneField({
  className,
  country,
  error,
  hint,
  id,
  label,
  labels,
  locale,
  onChange,
  onCountryChange,
  onSubmit,
  placeholder,
  priority = [],
  required,
  value,
}: PhoneFieldProps) {
  const generated = useId()
  const controlId = id ?? `nim-${generated}`
  const hintId = hint ? `${controlId}-hint` : undefined
  const errorId = error ? `${controlId}-error` : undefined
  const text = { ...DEFAULT_LABELS, ...labels }

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const shell = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const search = useRef<HTMLInputElement>(null)

  const resolvedLocale =
    locale ?? (typeof document === 'undefined' ? 'en' : document.documentElement.lang || 'en')
  const nameOf = useMemo(() => countryNamer(resolvedLocale), [resolvedLocale])
  const selected = countryByIso2(country) ?? COUNTRIES[0]

  const options = useMemo(() => {
    const collator = new Intl.Collator(resolvedLocale)
    const named = COUNTRIES.map((item) => ({ ...item, name: nameOf(item.iso2) }))
    const rank = (iso2: string) => {
      const index = priority.indexOf(iso2)
      return index === -1 ? priority.length : index
    }
    return named.sort(
      (a, b) => rank(a.iso2) - rank(b.iso2) || collator.compare(a.name, b.name),
    )
  }, [nameOf, priority, resolvedLocale])

  const matches = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase(resolvedLocale)
    if (!needle) return options
    const digits = toAsciiDigits(needle)
    return options.filter(
      (item) =>
        item.name.toLocaleLowerCase(resolvedLocale).includes(needle) ||
        item.iso2.toLowerCase().includes(needle) ||
        (digits ? item.dial.startsWith(digits) : false),
    )
  }, [options, query, resolvedLocale])

  useEffect(() => {
    if (!open) return
    search.current?.focus()
    const dismiss = (event: MouseEvent) => {
      if (!shell.current?.contains(event.target as Node)) setOpen(false)
    }
    const escape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      trigger.current?.focus()
    }
    document.addEventListener('mousedown', dismiss)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('mousedown', dismiss)
      document.removeEventListener('keydown', escape)
    }
  }, [open])

  const choose = (iso2: string) => {
    onCountryChange(iso2)
    setOpen(false)
    setQuery('')
    trigger.current?.focus()
  }

  return (
    <div className={cn('nim-field', error && 'nim-field--invalid', className)}>
      {label ? (
        <label className="nim-field__label" htmlFor={controlId}>
          {label}
          {required ? (
            <span aria-hidden="true" className="nim-field__required">
              *
            </span>
          ) : null}
        </label>
      ) : null}

      <div className="nim-phone" ref={shell}>
        <div className="nim-phone__shell" dir="ltr">
          <button
            aria-expanded={open}
            aria-haspopup="listbox"
            aria-label={`${text.pickCountry}: ${nameOf(selected.iso2)} +${selected.dial}`}
            className="nim-phone__country"
            onClick={() => setOpen((was) => !was)}
            ref={trigger}
            type="button"
          >
            <span aria-hidden="true" className="nim-phone__flag">
              {selected.flag}
            </span>
            <span className="nim-phone__dial">+{selected.dial}</span>
            <Icon className="nim-phone__caret" name="chevron-down" size="xs" />
          </button>

          <input
            aria-describedby={[errorId, hintId].filter(Boolean).join(' ') || undefined}
            aria-invalid={error ? true : undefined}
            autoComplete="tel-national"
            className="nim-phone__input"
            enterKeyHint="go"
            id={controlId}
            inputMode="tel"
            onChange={(event) => onChange(toAsciiDigits(event.target.value))}
            onKeyDown={(event) => {
              if (event.key === 'Enter') onSubmit?.()
            }}
            placeholder={placeholder}
            required={required}
            type="tel"
            value={value}
          />
        </div>

        {open ? (
          <div className="nim-phone__picker">
            <div className="nim-phone__search">
              <Icon name="search" size="sm" />
              <input
                aria-label={text.search}
                className="nim-phone__search-input"
                onChange={(event) => setQuery(event.target.value)}
                placeholder={text.search}
                ref={search}
                type="search"
                value={query}
              />
            </div>
            <ul className="nim-phone__list" role="listbox">
              {matches.map((item) => (
                <li key={item.iso2}>
                  <button
                    aria-selected={item.iso2 === selected.iso2}
                    className="nim-phone__option"
                    onClick={() => choose(item.iso2)}
                    role="option"
                    type="button"
                  >
                    <span aria-hidden="true" className="nim-phone__flag">
                      {item.flag}
                    </span>
                    <span className="nim-phone__name">{item.name}</span>
                    <span className="nim-phone__option-dial" dir="ltr">
                      +{item.dial}
                    </span>
                  </button>
                </li>
              ))}
              {matches.length === 0 ? <li className="nim-phone__empty">{text.noMatch}</li> : null}
            </ul>
          </div>
        ) : null}
      </div>

      {error ? (
        <p className="nim-field__error" id={errorId}>
          {error}
        </p>
      ) : null}
      {hint && !error ? (
        <p className="nim-field__hint" id={hintId}>
          {hint}
        </p>
      ) : null}
    </div>
  )
}

/** `+${dial}${national}` — what an auth API actually wants. */
export function toE164(country: string, national: string): string {
  const dial = countryByIso2(country)?.dial ?? ''
  return `+${dial}${toAsciiDigits(national).replace(/^0+/, '')}`
}
