/**
 * Browser-local operator preferences.
 *
 * Only SELECTION and PREFERENCE live here — which screens someone pinned, which
 * ones they opened last, which cluster they were pointed at. Never a path, a
 * digest, a finding, a provider response, or any other piece of evidence: a
 * claim about production has to be re-read from the controller every time it is
 * made, and a value that survives a refresh would eventually be shown as
 * current when it is not.
 *
 * Every accessor is guarded. A private window, a browser with site data
 * disabled, and a thumbnailing context all throw on the first property read
 * rather than returning empty, and a console that white-screens because someone
 * has cookies off is a console that failed for no reason.
 */

export function readLocal(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

export function writeLocal(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // A preference that cannot be remembered is not worth failing a render for.
  }
}

export function removeLocal(key: string) {
  try {
    window.localStorage.removeItem(key)
  } catch {
    // As above.
  }
}

export function readLocalJSON<T>(key: string, fallback: T): T {
  const raw = readLocal(key)
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function writeLocalJSON(key: string, value: unknown) {
  try {
    writeLocal(key, JSON.stringify(value))
  } catch {
    // As above.
  }
}

export function readSession(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key)
  } catch {
    return null
  }
}

export function writeSession(key: string, value: string) {
  try {
    if (value) window.sessionStorage.setItem(key, value)
    else window.sessionStorage.removeItem(key)
  } catch {
    // As above.
  }
}
