import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@nim.zone/ui'
import type { BadgeVariant } from '@nim.zone/ui'
import type { MessageKey } from '../i18n'
import { useStore } from '../context'

/**
 * A storefront read: the data, whether it has arrived, the error it failed
 * with, and a way to read it again after a change.
 */
export function useStoreData<T>(read: () => Promise<T>, dependencies: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [nonce, setNonce] = useState(0)
  const reload = useCallback(() => setNonce((value) => value + 1), [])

  useEffect(() => {
    let live = true
    setLoading(true)
    setError('')
    void read()
      .then((value) => { if (live) setData(value) })
      .catch((reason: unknown) => { if (live) setError(reason instanceof Error ? reason.message : 'error') })
      .finally(() => { if (live) setLoading(false) })
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependencies, nonce])

  return { data, error, loading, reload }
}

const tones: Record<string, BadgeVariant> = {
  active: 'success',
  answered: 'info',
  cancelled: 'neutral',
  closed: 'neutral',
  deleted: 'neutral',
  draft: 'neutral',
  failed: 'danger',
  issued: 'info',
  open: 'warning',
  paid: 'success',
  pending: 'warning',
  provisioning: 'info',
  rejected: 'danger',
  suspended: 'danger',
  void: 'neutral',
}

/** A status in words and colour together, never colour alone. */
export function StatusBadge({ status }: { status: string }) {
  const { t } = useStore()
  return <Badge dot variant={tones[status] ?? 'neutral'}>{t(`status.${status}` as MessageKey)}</Badge>
}

export function errorMessage(reason: unknown, fallback: string) {
  return reason instanceof Error && reason.message ? reason.message : fallback
}
