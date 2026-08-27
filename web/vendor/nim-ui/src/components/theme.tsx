import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * nim has two independent appearance axes.
 *
 * A STYLE owns how the interface is shaped: radii, elevation geometry, type
 * voice, press behaviour. A COLOURWAY owns how it is coloured: surfaces, ink,
 * lines, accent, status. They compose freely — `ledger` + `teal` is a legal
 * pairing, not a mistake — which is why they are two attributes rather than
 * one `theme` name multiplying out into a file per combination.
 */
export type NimStyle = 'console' | 'dispatch' | 'ledger' | 'vlora'
export type NimColorway =
  | 'coral'
  | 'malachite'
  | 'oxblood'
  | 'sable'
  | 'signal'
  | 'teal'
  | 'vermilion'

/** `system` follows the OS and is resolved by CSS, not by JavaScript. */
export type NimScheme = 'dark' | 'light' | 'system'
export type NimDirection = 'ltr' | 'rtl'

interface NimContextValue {
  colorway: NimColorway
  direction: NimDirection
  /** BCP 47 tag. Components that format dates or numbers use it; the script
      corrections in `persian.css` key off the `lang` attribute it writes. */
  locale: string | undefined
  scheme: NimScheme
  setColorway: (colorway: NimColorway) => void
  setScheme: (scheme: NimScheme) => void
  setStyle: (style: NimStyle) => void
  style: NimStyle
}

const NimContext = createContext<NimContextValue | null>(null)

export interface NimProviderProps {
  children: ReactNode
  className?: string
  defaultColorway?: NimColorway
  defaultScheme?: NimScheme
  defaultStyle?: NimStyle
  direction?: NimDirection
  /** BCP 47 tag, e.g. `fa-IR`. Written to `lang`, which is what turns on the
      Persian script corrections and gives Calendar its month and weekday
      names and its digits. Direction is separate: `dir` says which way the
      line runs, `lang` says which script is being set. */
  locale?: string
  /** Writes the appearance attributes onto <html> as well, so portalled
      surfaces (sheets, dialogs, menus, toasts) inherit them from outside the
      React tree. */
  syncDocument?: boolean
}

export function NimProvider({
  children,
  className,
  defaultColorway = 'vermilion',
  defaultScheme = 'light',
  defaultStyle = 'ledger',
  direction = 'ltr',
  locale,
  syncDocument = true,
}: NimProviderProps) {
  const [style, setStyle] = useState<NimStyle>(defaultStyle)
  const [colorway, setColorway] = useState<NimColorway>(defaultColorway)
  const [scheme, setScheme] = useState<NimScheme>(defaultScheme)

  useEffect(() => {
    if (!syncDocument || typeof document === 'undefined') return
    const root = document.documentElement
    root.dataset.nimStyle = style
    root.dataset.nimColorway = colorway
    // `system` is the absence of a pin: the contract's `color-scheme: light dark`
    // then lets the OS decide, and every light-dark() pair follows.
    if (scheme === 'system') delete root.dataset.nimScheme
    else root.dataset.nimScheme = scheme
    root.dir = direction
    if (locale) root.lang = locale
  }, [colorway, direction, locale, scheme, style, syncDocument])

  const value = useMemo(
    () => ({ colorway, direction, locale, scheme, setColorway, setScheme, setStyle, style }),
    [colorway, direction, locale, scheme, style],
  )

  return (
    <NimContext.Provider value={value}>
      <div
        className={cn('nim-root', className)}
        data-nim-colorway={colorway}
        data-nim-scheme={scheme === 'system' ? undefined : scheme}
        data-nim-style={style}
        dir={direction}
        lang={locale}
      >
        {children}
      </div>
    </NimContext.Provider>
  )
}

export function useNim() {
  const context = useContext(NimContext)
  if (!context) throw new Error('useNim must be used inside <NimProvider>')
  return context
}

/** Convenience for a header toggle: flips light ⇄ dark, leaving `system`. */
export function useSchemeToggle() {
  const { scheme, setScheme } = useNim()
  return useCallback(() => setScheme(scheme === 'dark' ? 'light' : 'dark'), [scheme, setScheme])
}
