/**
 * Every number, byte count, identifier and timestamp this console prints.
 *
 * Nine screens each carried their own `formatBytes` and their own
 * `formatDateTime`, and they had already drifted: one rounded a gibibyte to a
 * whole number and another to one decimal, one printed `—` for a zero-value
 * timestamp and another printed `1 January 1`. A console whose numbers do not
 * agree with each other teaches an operator to distrust all of them, so there
 * is one implementation of each here and no local copies anywhere.
 */

const BYTE_UNITS = ['B', 'KiB', 'MiB', 'GiB', 'TiB'] as const

/** Docker reports a zero time as this sentinel rather than as an empty field. */
const ZERO_TIME = '0001-01-01'

export function capitalize(value: string) {
  return value ? `${value[0]?.toUpperCase()}${value.slice(1)}` : 'Unknown'
}

/** `needs_attention` → `Needs attention`. */
export function sentence(value: string) {
  return capitalize(value.replaceAll('_', ' '))
}

export function shortID(value?: string) {
  return value ? value.slice(0, 12) : '—'
}

export function shortDigest(value: string) {
  return value.length > 20 ? `${value.slice(0, 19)}…` : value
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat().format(Math.round(value))
}

export function formatBytes(value: number) {
  if (!value) return '0 B'
  const power = Math.min(Math.floor(Math.log(value) / Math.log(1024)), BYTE_UNITS.length - 1)
  return `${(value / 1024 ** power).toFixed(power > 1 ? 1 : 0)} ${BYTE_UNITS[power]}`
}

export function formatPercent(value: number) {
  return `${Math.round(value)}%`
}

export function formatDateTime(value?: string) {
  if (!value || value.startsWith(ZERO_TIME)) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

/** Unix seconds, as Docker reports image and volume creation. */
export function formatTimestamp(seconds: number) {
  return seconds ? formatDateTime(new Date(seconds * 1000).toISOString()) : '—'
}

/** Wall-clock only: used where the DATE is already established by context. */
export function formatClock(value?: string) {
  const date = value ? new Date(value) : undefined
  if (!date || Number.isNaN(date.getTime())) return 'an unknown time'
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(date)
}

export function formatTime(value?: string) {
  const date = value ? new Date(value) : undefined
  if (!date || Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(date)
}

export function formatDuration(seconds?: number) {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return '—'
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  // Minutes matter under an hour and are noise above a day, which is why one
  // screen had grown its own copy of this rather than use the shared one.
  return days ? `${days}d ${hours}h` : hours ? `${hours}h ${minutes}m` : `${minutes}m`
}

/** How long a run took, from two ISO timestamps. */
export function elapsed(start: string, end: string) {
  const seconds = Math.max(0, Math.round((Date.parse(end) - Date.parse(start)) / 1000))
  if (!Number.isFinite(seconds)) return '—'
  if (seconds < 60) return `${seconds} s`
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return remainder ? `${minutes} m ${remainder} s` : `${minutes} m`
}

/**
 * "4 minutes ago". Used only where recency is the point being made — an
 * absolute time still appears beside it wherever the reader may need to
 * correlate the event with something outside this console.
 */
export function relativeTime(value?: string) {
  if (!value) return 'never'
  const at = Date.parse(value)
  if (!Number.isFinite(at)) return 'never'
  const seconds = Math.round((Date.now() - at) / 1000)
  if (seconds < 45) return 'just now'
  const format = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [['second', 60], ['minute', 60], ['hour', 24], ['day', 7], ['week', 4.35], ['month', 12]]
  let amount = seconds
  for (const [unit, size] of steps) {
    if (Math.abs(amount) < size) return format.format(-Math.round(amount), unit)
    amount /= size
  }
  return format.format(-Math.round(amount), 'year')
}

/** A count with its noun, pluralised: `1 server`, `3 servers`. */
export function countOf(value: number, singular: string, plural = `${singular}s`) {
  return `${value} ${value === 1 ? singular : plural}`
}
