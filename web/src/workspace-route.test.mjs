import assert from 'node:assert/strict'
import test from 'node:test'
import { AREAS, LEGACY_ROUTES, parseWorkspaceRoute, workspaceHash } from './navigation/navigation.ts'

test('every destination and declared object view round-trips through one route registry', () => {
  for (const area of AREAS) for (const entry of area.pages) {
    assert.deepEqual(parseWorkspaceRoute(workspaceHash(entry.key)), { page: entry.key, record: '', view: '', valid: true })
    if (entry.views) {
      assert.equal(parseWorkspaceRoute(workspaceHash(entry.key, 'object-123')).valid, true)
      for (const view of entry.views) assert.deepEqual(parseWorkspaceRoute(workspaceHash(entry.key, 'object-123', view)), {page: entry.key, record: 'object-123', view, valid: true})
    } else assert.equal(parseWorkspaceRoute(workspaceHash(entry.key, 'object-123')).valid, false)
  }
})

test('retired destinations retain their canonical landing page', () => {
  for (const [old, page] of Object.entries(LEGACY_ROUTES)) assert.equal(parseWorkspaceRoute(`#${old}`).page, page)
  assert.equal(parseWorkspaceRoute('').page, 'overview')
  assert.equal(parseWorkspaceRoute('#').valid, true)
})

test('malformed, unknown, double-encoded and extra route segments fail closed without throwing', () => {
  for (const hash of ['#no-such-page', '#applications/%', '#applications/%E0%A4%A', '#applications/%252f', '#applications/a%2fb', '#applications//overview', '#applications/a/unknown', '#applications/a/overview/extra', '#runs/a/overview', '#machines/a?scope=other', '#applications/' + 'a'.repeat(1025)]) {
    assert.doesNotThrow(() => parseWorkspaceRoute(hash))
    assert.equal(parseWorkspaceRoute(hash).valid, false, hash)
  }
})

test('object identity and selected tab survive a copied or reloaded URL', () => {
  assert.deepEqual(parseWorkspaceRoute('#applications/checkout-api/resources'), { page: 'applications', record: 'checkout-api', view: 'resources', valid: true })
  assert.equal(parseWorkspaceRoute('#machines/srv-1').view, 'overview')
  assert.deepEqual(parseWorkspaceRoute('#runs/cmd-1'), { page: 'runs', record: 'cmd-1', view: '', valid: true })
})
