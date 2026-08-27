import assert from 'node:assert/strict'
import test from 'node:test'

import {
  isConnectedNativeAgent,
  isNativeAgent,
  serverConnectionLabel,
  serverEndpointLabel,
} from './server-connection.ts'

const base = {
  authentication: 'api_key',
  connectionState: 'connected',
  dockerAvailable: false,
  host: 'worker-1',
  hostKeyFingerprint: '',
  id: 'agent-1',
  name: 'worker-1',
  port: 0,
  swarmControlAvailable: false,
  username: '',
}

test('outbound agents remain visible to host readiness and diagnostics', () => {
  const server = { ...base, authentication: 'mutual_tls', connectionType: 'agent_pull' }
  assert.equal(isNativeAgent(server), true)
  assert.equal(isConnectedNativeAgent(server), true)
  assert.equal(serverConnectionLabel(server), 'Outbound agent')
  assert.equal(serverEndpointLabel(server), 'Outbound mTLS long poll')
})

test('legacy SSH profiles do not enter native-agent workflows', () => {
  const server = { ...base, connectionType: 'ssh' }
  assert.equal(isNativeAgent(server), false)
  assert.equal(isConnectedNativeAgent(server), false)
  assert.equal(serverConnectionLabel(server), 'Legacy SSH')
})
