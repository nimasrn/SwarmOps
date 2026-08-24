export type Health = 'healthy' | 'degraded' | 'unknown' | 'unhealthy'

export interface Capacity {
  available: number
  capacity: number
  percent: number
  used: number
}

export interface NodeAgent {
  address?: string
  collectedAt?: string
  error?: string
  healthy: boolean
  version?: string
}

export interface Server {
  apiUrl?: string
  authentication: 'api_key' | 'password' | 'private_key'
  connectionState: 'connected' | 'disconnected'
  connectionType?: 'agent_api' | 'ssh'
  dockerAvailable: boolean
  dockerVersion?: string
  host: string
  hostKeyFingerprint: string
  id: string
  lastConnectedAt?: string
  name: string
  port: number
  swarmControlAvailable: boolean
  swarmState?: string
  tlsCertificateFingerprint?: string
  username: string
}

export interface ServerCredentials {
  apiKey: string
}

export interface ServerInput extends ServerCredentials {
  apiUrl: string
  name: string
  port: number
  tlsCertificateFingerprint: string
}

export interface Node {
  address?: string
  agent: NodeAgent
  availability: string
  cpu: Capacity
  disk: Capacity
  dockerVersion?: string
  engine: { apiVersion?: string; cgroupDriver?: string; driver?: string; version?: string }
  hostname: string
  id: string
  kernel?: string
  labels?: Record<string, string>
  load1?: number
  manager?: { address?: string; leader: boolean; reachability?: string }
  memory: Capacity
  os?: string
  platform: { architecture?: string; os?: string }
  role: string
  state: string
  uptimeSeconds?: number
}

export interface Service {
  createdAt?: string
  desiredTasks: number
  health: Health
  id: string
  image?: string
  labels?: Record<string, string>
  mode: string
  name: string
  runningTasks: number
  stack?: string
  updatedAt?: string
  updateState?: string
}

export interface Stack {
  health: Health
  name: string
  runningTasks: number
  serviceCount: number
  updatedAt?: string
}

export interface Task {
  currentState: string
  desiredState: string
  error?: string
  id: string
  image?: string
  nodeId: string
  serviceId: string
  slot: number
  startedAt?: string
}

export interface Overview {
  generatedAt: string
  health: Health
  nodes: Node[]
  services: Service[]
  summary: {
    managers: number
    nodes: number
    readyNodes: number
    runningTasks: number
    serviceHealth: Health
    services: number
    totalCpu: Capacity
    totalDisk: Capacity
    totalMemory: Capacity
  }
}

export interface AuditEvent {
  action: string
  actor: string
  detail?: Record<string, string>
  id: string
  occurredAt: string
  outcome: string
  requestId?: string
  target: string
}

export interface ComposePlan {
  digest: string
  services: string[]
  targetNodeId?: string
  warnings: string[]
}

export type CommandState = 'queued' | 'running' | 'retry_scheduled' | 'succeeded' | 'needs_attention'

export interface Command {
  action: string
  actor: string
  attempt: number
  autoRetry: boolean
  createdAt: string
  id: string
  lastAttemptAt?: string
  lastError?: string
  maxAttempts: number
  nextAttemptAt?: string
  requestId?: string
  serverId: string
  state: CommandState
  target: string
  updatedAt: string
}

export interface FleetRun {
  id: string
  nodes: FleetRunNode[]
}

export interface FleetRunNode {
  attempt?: number
  error?: string
  exitCode?: number
  finishedAt?: string
  hostname: string
  maxAttempts?: number
  nextAttemptAt?: string
  nodeId: string
  operation?: string
  startedAt?: string
  state: string
}

export interface Session {
  csrfToken: string
  user: { username: string }
}

export interface TraefikStatus {
  dashboardURL?: string
  service: Service | null
}

export interface ObservabilityStatus {
  agentHealthy: boolean
  agentInstalled: boolean
  coreHealthy: boolean
  coreInstalled: boolean
  logsEnabled: boolean
  logsHealthy: boolean
}
