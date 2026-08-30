import { useCallback, useEffect, useState } from 'react'
import { api } from './api'
import type { AuditEvent, Command, CoreTopology, Server } from './types'
import type { DashboardData } from './dashboard'
import { isExpiredSession, messageOf } from '../lib/errors'

/**
 * Every durable read this console makes, as hooks with one shared shape.
 *
 * They separate two states that a single `loading` flag conflated and that
 * behave completely differently on screen: `initialLoading` is "nothing has
 * arrived yet, show a placeholder", and `refreshing` is "a poll is in flight,
 * keep showing what is already there". Collapsing them is what made a
 * background refresh blank the screen an operator was reading.
 *
 * A 401 is never rendered as an error. The session has ended, and the only
 * correct response is to return to the sign-in screen — which is why every
 * hook takes `onExpired` rather than reporting the status.
 */

interface Async<T> {
  data: T
  error: string
  initialLoading: boolean
  refresh: () => Promise<void>
  refreshing: boolean
}

function useAsync<T>(
  read: () => Promise<T>,
  initial: T,
  { enabled = true, intervalMs = 0, onExpired }: { enabled?: boolean; intervalMs?: number; onExpired: () => void },
): Async<T> {
  const [data, setData] = useState<T>(initial)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [settled, setSettled] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setData(await read())
    } catch (reason) {
      if (isExpiredSession(reason)) onExpired()
      else setError(messageOf(reason))
    } finally {
      setLoading(false)
      setSettled(true)
    }
    // `read` is re-created on every render by its callers; the dependency that
    // actually matters is whatever they close over, and they express that by
    // enabling or disabling the hook.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onExpired])

  useEffect(() => {
    if (!enabled) return
    void refresh()
    if (!intervalMs) return
    const timer = window.setInterval(() => void refresh(), intervalMs)
    return () => window.clearInterval(timer)
  }, [enabled, intervalMs, refresh])

  return {
    data,
    error,
    initialLoading: enabled && !settled,
    refresh,
    refreshing: enabled && settled && loading,
  }
}

export function useServers(onExpired: () => void) {
  const state = useAsync<Server[]>(() => api.servers(), [], { intervalMs: 30_000, onExpired })
  return {
    error: state.error,
    // The fleet screens are usable before any cluster exists, so their spinner
    // is the one an operator actually waits on.
    loading: state.initialLoading || state.refreshing,
    refresh: state.refresh,
    servers: state.data,
  }
}

export function useCoreTopology(onExpired: () => void) {
  const state = useAsync<CoreTopology | null>(() => api.coreTopology(), null, { onExpired })
  return { core: state.data, error: state.error, refresh: state.refresh }
}

export function useAuditEvents(enabled: boolean, onExpired: () => void) {
  const state = useAsync<AuditEvent[]>(() => api.auditEvents(), [], { enabled, onExpired })
  return {
    error: state.error,
    events: state.data,
    initialLoading: state.initialLoading,
    refresh: state.refresh,
    refreshing: state.refreshing,
  }
}

/**
 * The durable command ledger, read EVERYWHERE.
 *
 * It used to be fetched only on the screens that display it, which quietly
 * broke the attention control in the masthead: an operator on Traffic was told
 * nothing needed a decision because the list backing that claim had never been
 * read. Five seconds while someone is watching a queue they just added to;
 * thirty everywhere else, because the count in the chrome does not need to be
 * that fresh to be correct.
 */
export function useCommands(intervalMs: number, onExpired: () => void) {
  const state = useAsync<Command[]>(() => api.commands(), [], { intervalMs, onExpired })
  return {
    commands: state.data,
    error: state.error,
    initialLoading: state.initialLoading,
    refresh: state.refresh,
    refreshing: state.refreshing,
  }
}

/**
 * The selected cluster's whole picture, in one round of four reads.
 *
 * `api.selectServer` is called before every read because the target is a header
 * on the request, not a session property — a poll that raced a cluster switch
 * would otherwise answer for the previous target.
 */
export function useDashboard(serverID: string, onExpired: () => void) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const refresh = useCallback(async () => {
    if (!serverID) {
      setData(null)
      setError('')
      setRefreshing(false)
      return
    }
    api.selectServer(serverID)
    setRefreshing(true)
    setError('')
    try {
      const [overview, stacks, traefik, observability] = await Promise.all([
        api.overview(),
        api.stacks(),
        api.traefik(),
        api.observability(),
      ])
      setData({ nodes: overview.nodes, observability, overview, services: overview.services, stacks, traefik })
    } catch (reason) {
      if (isExpiredSession(reason)) onExpired()
      else setError(messageOf(reason))
    } finally {
      setRefreshing(false)
    }
  }, [onExpired, serverID])

  useEffect(() => {
    if (!serverID) {
      setData(null)
      setError('')
      return
    }
    void refresh()
    const timer = window.setInterval(() => void refresh(), 30_000)
    return () => window.clearInterval(timer)
  }, [refresh, serverID])

  return { data, error, refresh, refreshing }
}

/**
 * A one-shot read with its own loading and error state, for the panels that
 * fetch something the cluster snapshot does not carry.
 *
 * Four screens had written this by hand and two of them left the request
 * running after unmount, so a slow response arrived into a component that no
 * longer existed and React warned about it in the console an operator was
 * meant to be reading.
 */
export function useResource<T>(read: () => Promise<T>, dependencies: unknown[]) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    let live = true
    setLoading(true)
    setError('')
    void read()
      .then((value) => { if (live) setData(value) })
      .catch((reason) => { if (live) setError(messageOf(reason)) })
      .finally(() => { if (live) setLoading(false) })
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependencies, nonce])

  return { data, error, loading, reload: () => setNonce((value) => value + 1) }
}
