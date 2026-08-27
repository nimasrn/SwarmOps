import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = (name) => readFile(new URL(name, import.meta.url), 'utf8')

test('navigation uses operator tasks and keeps every workspace directly reachable', async () => {
  const app = await source('app.tsx')
  for (const group of ['Cluster', 'Workloads', 'Networking', 'Monitoring', 'Activity', 'Settings']) {
    assert.match(app, new RegExp(`label: '${group}'`))
  }
  for (const destination of ['servers', 'nodes', 'resources', 'applications', 'databases', 'traefik', 'insights', 'logs', 'commands', 'catalogue', 'audit', 'core', 'source-deploy']) {
    assert.match(app, new RegExp(`setWorkspace\\('${destination}'\\)`))
  }
  assert.doesNotMatch(app, /label: 'Observe'/)
  assert.doesNotMatch(app, /label: 'Control plane'/)
})

test('catalog actions open a sheet and activity/resources expose working filters', async () => {
  const [inventory, app] = await Promise.all([source('inventory.tsx'), source('app.tsx')])
  assert.match(inventory, /<Sheet closeLabel="Close action review"/)
  assert.match(inventory, />Review action<\/Button>/)
  assert.match(inventory, /label="Search actions"/)
  assert.match(inventory, /label="Search containers"/)
  assert.match(app, /aria-label="Search runs"/)
  assert.match(app, /Last 24 hours/)
})

test('readiness presents one reviewed fix at a time instead of a switch plan', async () => {
  const readiness = await source('server-readiness.tsx')
  assert.match(readiness, /title="Setup checks"/)
  assert.match(readiness, /Start single-server cluster/)
  assert.match(readiness, /<Sheet closeLabel="Close setup review"/)
  assert.doesNotMatch(readiness, /<Switch/)
  assert.doesNotMatch(readiness, /Review and queue/)
})

test('gateway and source dead ends have explicit setup actions', async () => {
  const [gateway, sourceDeploy] = await Promise.all([source('traefik-page.tsx'), source('source-deploy.tsx')])
  assert.match(gateway, />Install gateway<\/Button>/)
  assert.match(gateway, /Cloudflare and ArvanCloud/)
  assert.match(sourceDeploy, />Configure source deployment<\/Button>/)
  assert.match(sourceDeploy, /Hosted GitHub \/ GitLab/)
})
