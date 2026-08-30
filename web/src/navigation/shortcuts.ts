import { useEffect, useRef } from 'react'
import { AREAS, areaByShortcut, landingPage, type WorkspacePage } from './navigation'

/**
 * The console's keyboard, written down once.
 *
 * Before this, three shortcuts existed and none of them was documented
 * anywhere an operator could find: ⌘K was printed on a button, `D` was known
 * only to the person who added it, and nothing else was bound at all. A
 * shortcut nobody can discover is a shortcut nobody uses, so the same list that
 * INSTALLS the bindings also draws the help sheet — they cannot drift.
 *
 * Only ⌘K and Escape take a modifier. Everything else is a bare letter, which
 * is why every handler checks that the operator is not typing first: this
 * console asks people to type exact confirmation phrases, and a swallowed
 * keystroke there is expensive.
 */

export interface ShortcutHint {
  hint: string
  keys: string
  label: string
}

export interface ShortcutGroup {
  hints: ShortcutHint[]
  title: string
}

export function shortcutGroups(): ShortcutGroup[] {
  return [
    {
      title: 'Anywhere',
      hints: [
        { hint: 'Search every screen, every action, and every connected cluster.', keys: '⌘ K', label: 'Command palette' },
        { hint: 'The same palette, for when the hands are already on the keyboard.', keys: '/', label: 'Search' },
        { hint: 'Re-read whatever this screen is drawn from.', keys: 'R', label: 'Refresh this screen' },
        { hint: 'Find out which layer — agent, Docker, or Swarm — stopped answering.', keys: 'D', label: 'Connection diagnostics' },
        { hint: 'This sheet.', keys: '?', label: 'Keyboard shortcuts' },
        { hint: 'Close a sheet, a dialog, or the palette.', keys: 'Esc', label: 'Dismiss' },
      ],
    },
    {
      title: 'Go to',
      hints: AREAS.map((area) => ({
        hint: area.summary,
        keys: `G ${area.shortcut.toUpperCase()}`,
        label: area.label,
      })),
    },
  ]
}

interface ShortcutActions {
  onDiagnostics: () => void
  onHelp: () => void
  onOpen: (page: WorkspacePage) => void
  onPalette: () => void
  onRefresh: () => void
}

/** How long a `G` stays armed before it goes back to being an ordinary key. */
const CHORD_MS = 1500

export function useShortcuts({ onDiagnostics, onHelp, onOpen, onPalette, onRefresh }: ShortcutActions) {
  const actions = useRef(({ onDiagnostics, onHelp, onOpen, onPalette, onRefresh }))
  actions.current = { onDiagnostics, onHelp, onOpen, onPalette, onRefresh }

  useEffect(() => {
    let chordUntil = 0

    const typing = (target: EventTarget | null) => {
      const element = target as HTMLElement | null
      return Boolean(element && (element.isContentEditable || /^(input|textarea|select)$/i.test(element.tagName)))
    }

    const handle = (event: KeyboardEvent) => {
      const { onDiagnostics, onHelp, onOpen, onPalette, onRefresh } = actions.current

      // ⌘K belongs to the app, not to the kit: which chord a product spends is
      // a product decision, and a component that bound a global key would
      // collide with every other consumer on the page.
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        onPalette()
        return
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (typing(event.target)) return

      const key = event.key.toLowerCase()

      if (Date.now() < chordUntil) {
        chordUntil = 0
        const area = areaByShortcut(key)
        if (area) {
          event.preventDefault()
          onOpen(landingPage(area))
          return
        }
      }

      if (key === 'g') {
        chordUntil = Date.now() + CHORD_MS
        return
      }
      if (key === '/') {
        event.preventDefault()
        onPalette()
        return
      }
      if (key === '?') {
        event.preventDefault()
        onHelp()
        return
      }
      if (key === 'r') {
        event.preventDefault()
        onRefresh()
        return
      }
      // D goes to connection diagnostics. Unmodified, so it must not fire while
      // someone is typing a hostname or a confirmation phrase — a bare-letter
      // shortcut that steals keystrokes from a text field is worse than no
      // shortcut, and confirmation phrases are exactly where a lost keystroke
      // costs the most.
      if (event.key.toLowerCase() === 'd') {
        event.preventDefault()
        onDiagnostics()
      }
    }

    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [])
}
