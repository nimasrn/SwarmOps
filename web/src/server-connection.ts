import type { Server } from './types'

export function isNativeAgent(server: Server) {
  return server.connectionType === 'agent_api' || server.connectionType === 'agent_pull'
}

export function isConnectedNativeAgent(server: Server) {
  return isNativeAgent(server) && server.connectionState === 'connected'
}

export function serverConnectionLabel(server: Server) {
  if (server.connectionType === 'agent_pull') return 'Secure outbound connection'
  if (server.connectionType === 'agent_api') return 'Direct secure connection'
  return 'Legacy SSH'
}

export function serverEndpointLabel(server: Server) {
  if (server.connectionType === 'agent_pull') return 'Agent connects securely to SwarmOps'
  return `${server.apiUrl ?? server.host}:${server.port}`
}
