import type { Server } from './types'

export function isNativeAgent(server: Server) {
  return server.connectionType === 'agent_api' || server.connectionType === 'agent_pull'
}

export function isConnectedNativeAgent(server: Server) {
  return isNativeAgent(server) && server.connectionState === 'connected'
}

export function serverConnectionLabel(server: Server) {
  if (server.connectionType === 'agent_pull') return 'Outbound agent'
  if (server.connectionType === 'agent_api') return 'Pinned machine API'
  return 'Legacy SSH'
}

export function serverEndpointLabel(server: Server) {
  if (server.connectionType === 'agent_pull') return 'Outbound mTLS long poll'
  return `${server.apiUrl ?? server.host}:${server.port}`
}
