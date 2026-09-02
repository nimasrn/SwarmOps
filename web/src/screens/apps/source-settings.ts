import { useCallback, useRef, useState } from 'react'
import { api } from '../../data/api'
import { messageOf } from '../../lib/errors'
import type { SourceSettings, SourceSettingsInput } from '../../data/types'

/** Where the setup steps are written up in full. */
export const SOURCE_DOCS_URL = 'https://nim.zone/docs/swarmops'

/**
 * The sealed controller settings behind source deployment, read and written as
 * one record by the two screens that own halves of it.
 *
 * They were one form until an operator pointed out the obvious: the registry a
 * built image is pushed TO has nothing to do with the provider source is read
 * FROM, and putting them in the same sheet made the registry look like a step
 * in connecting GitHub. The provider boundary is on Apps → Deploy; the push
 * registry is on Apps → Images & registries.
 *
 * The controller still accepts only a complete document, so a screen that sent
 * nothing but its own fields would silently clear the other screen's. Every
 * save therefore starts from what was last read and changes only what its
 * caller passed.
 */
export type SourceSettingsPatch = Partial<SourceSettingsInput>

export interface SourceSettingsForm {
  error: string
  /** Read the sealed record. Safe to call again; the last answer is the base
      every later save is applied to. */
  load: () => Promise<void>
  loading: boolean
  /** True when the controller accepted the change. */
  save: (patch: SourceSettingsPatch) => Promise<boolean>
  saved: boolean
  saving: boolean
  settings: SourceSettings | null
}

export function useSourceSettings(): SourceSettingsForm {
  const [settings, setSettings] = useState<SourceSettings | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  // The base a patch is applied to has to be the newest answer rather than the
  // one this callback closed over, or a second save undoes the first.
  const current = useRef<SourceSettings | null>(null)

  const adopt = useCallback((next: SourceSettings) => {
    current.current = next
    setSettings(next)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      adopt(await api.sourceSettings())
    } catch (cause) {
      setError(messageOf(cause))
    } finally {
      setLoading(false)
    }
  }, [adopt])

  const save = useCallback(async (patch: SourceSettingsPatch) => {
    const base = current.current
    if (!base) {
      setError('The current settings have not been read yet.')
      return false
    }
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      // An omitted password means "keep the sealed one", which is also what the
      // controller does with an empty string — so it is never sent from a base.
      adopt(await api.saveSourceSettings({
        buildEnabled: base.buildEnabled,
        enabled: base.enabled,
        imagePrefix: base.imagePrefix,
        privateHosts: base.privateHosts ?? [],
        registryServer: base.registryServer,
        registryUsername: base.registryUsername,
        ...patch,
      }))
      setSaved(true)
      return true
    } catch (cause) {
      setError(messageOf(cause))
      return false
    } finally {
      setSaving(false)
    }
  }, [adopt])

  return { error, load, loading, save, saved, saving, settings }
}
