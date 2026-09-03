import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { readLocalJSON, writeLocalJSON } from '../lib/storage'
import { isWorkspacePage, parseWorkspaceRoute, workspaceHash, type WorkspacePage } from './navigation'

const RECENTS_KEY = 'swarmops:recent-screens'
const PINNED_KEY = 'swarmops:pinned-screens'
const RECENTS_LIMIT = 6

/**
 * The address bar is the router.
 *
 * A hash is what an operator pastes into an incident channel, so every screen
 * has to be reachable by one — and a hash that USED to address a screen keeps
 * resolving, because a console renames its screens as it learns what they are
 * for and a bookmark should not pay for that.
 */
export function useWorkspace(): [WorkspacePage, (page: WorkspacePage) => void] {
  const route = useWorkspaceRoute()
  return [route.page, useCallback((next: WorkspacePage) => { window.location.hash = workspaceHash(next) }, [])]
}

const subscribeRoute = (notify: () => void) => {
  window.addEventListener('hashchange', notify)
  return () => window.removeEventListener('hashchange', notify)
}
const readHash = () => window.location.hash
export function useWorkspaceRoute() {
  return parseWorkspaceRoute(useSyncExternalStore(subscribeRoute, readHash, () => ''))
}

export function useRecordView(fallback = 'overview'): [string, (view: string) => void] {
  const route = useWorkspaceRoute()
  return [route.view || fallback, useCallback((view: string) => {
    const current = parseWorkspaceRoute(window.location.hash)
    if (current.valid && current.record) window.location.hash = workspaceHash(current.page, current.record, view)
  }, [])]
}

/**
 * The object a screen is currently opened ON, as `#machines/srv-1`.
 *
 * A machine, a container and an application are things an operator links to in
 * an incident channel, and a console where "the node that is wrong" cannot be
 * pasted makes everyone describe it in prose instead. The screen key stays
 * first in the hash so every existing rule — which area is active, which
 * screens need a cluster, which legacy hash resolves where — keeps working
 * unchanged.
 */
export function useSelectedRecord(): [string, (id: string) => void] {
  const route = useWorkspaceRoute()
  const select = useCallback((next: string) => {
    const current = parseWorkspaceRoute(window.location.hash)
    window.location.hash = workspaceHash(current.page, next)
  }, [])
  return [route.record, select]
}

/**
 * The screens this operator actually uses, remembered between sessions.
 *
 * A console with twenty-four screens has, for any one person, about five that
 * matter. Recents make the palette open on those five instead of on an
 * alphabet, and pins put them one click away in the rail. Both are preference,
 * never evidence — see `lib/storage`.
 */
export function useScreenMemory(current: WorkspacePage) {
  const [recents, setRecents] = useState<WorkspacePage[]>(() => sanitize(readLocalJSON<string[]>(RECENTS_KEY, [])))
  const [pinned, setPinned] = useState<WorkspacePage[]>(() => sanitize(readLocalJSON<string[]>(PINNED_KEY, [])))

  useEffect(() => {
    setRecents((previous) => {
      const next = [current, ...previous.filter((page) => page !== current)].slice(0, RECENTS_LIMIT)
      writeLocalJSON(RECENTS_KEY, next)
      return next
    })
  }, [current])

  const togglePin = useCallback((page: WorkspacePage) => {
    setPinned((previous) => {
      const next = previous.includes(page) ? previous.filter((entry) => entry !== page) : [...previous, page]
      writeLocalJSON(PINNED_KEY, next)
      return next
    })
  }, [])

  // The screen someone is already looking at is not a suggestion.
  const suggestions = useMemo(() => recents.filter((page) => page !== current), [current, recents])

  return { isPinned: (page: WorkspacePage) => pinned.includes(page), pinned, recents: suggestions, togglePin }
}

function sanitize(values: string[]): WorkspacePage[] {
  return Array.isArray(values) ? values.filter(isWorkspacePage) : []
}
