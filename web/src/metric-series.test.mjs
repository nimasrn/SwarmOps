import assert from 'node:assert/strict'
import test from 'node:test'
import { metricSeries } from './lib/metric-series.ts'

const range = { from: '2026-09-03T00:00:00Z', to: '2026-09-03T00:03:00Z', stepSeconds: 60, points: [], scope: 'machine', series: 'cpu', source: 'prometheus', unit: 'ratio' }
test('missing intervals remain named gaps, including an absent latest sample', () => {
  const result = metricSeries({...range, points: [{at: range.from, value: 0}, {at: '2026-09-03T00:02:00Z', value: 0.4}]})
  assert.deepEqual(result.map(point => point.value), [0, null, 0.4, null])
  assert.equal(result[1].at, '2026-09-03T00:01:00.000Z')
})
test('invalid and unbounded metric grids are refused', () => {
  for (const patch of [{stepSeconds: 0}, {stepSeconds: NaN}, {stepSeconds: 0.01}, {to: 'bad'}, {points: [{at: '2026-09-03T00:01:20Z', value: 1}]}]) assert.equal(metricSeries({...range, ...patch}), null)
})
test('non-finite readings are not zero; reversed input still lands on the right time', () => {
  const result = metricSeries({...range, points: [{at: range.to, value: 1}, {at: range.from, value: NaN}]})
  assert.deepEqual(result.map(point => point.value), [null, null, null, 1])
})
