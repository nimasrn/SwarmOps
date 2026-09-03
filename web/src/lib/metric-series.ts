import type { MetricRange } from '../data/types'

/** Reconstruct the bounded query grid. An omitted sample is a gap, not a
 * shorter period or a line connecting across missing measurement time. */
export function metricSeries(range: MetricRange): { at: string; value: number | null }[] | null {
  const from = Date.parse(range.from)
  const to = Date.parse(range.to)
  const step = range.stepSeconds * 1000
  if (!Number.isFinite(from) || !Number.isFinite(to) || !Number.isFinite(step) || step <= 0 || to < from) return null
  const count = Math.floor((to - from) / step + 1e-6) + 1
  // The machine API permits 1500 intervals, including both endpoints.
  if (count > 1501) return null
  const samples = Array.from({length: count}, (_, index) => ({ at: new Date(from + index * step).toISOString(), value: null as number | null }))
  for (const point of range.points) {
    const at = Date.parse(point.at)
    const index = Math.round((at - from) / step)
    // Prometheus truncates query bounds to seconds. Allow that rounding, not
    // arbitrary off-grid samples being silently assigned a different time.
    if (!Number.isFinite(at) || index < 0 || index >= count || Math.abs(at - (from + index * step)) > 1000) return null
    samples[index] = { at: point.at, value: Number.isFinite(point.value) ? point.value : null }
  }
  return samples
}
