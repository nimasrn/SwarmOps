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
  bootstrapAvailable: boolean
  connectionState: 'connected' | 'disconnected'
  connectionType?: 'agent_api' | 'ssh'
  dockerAvailable: boolean
  dockerVersion?: string
  host: string
  hostKeyFingerprint: string
  id: string
  lastConnectedAt?: string
  managed: boolean
  mobilityAvailable: boolean
  name: string
  port: number
  swarmControlAvailable: boolean
  swarmState?: string
  tlsCertificateFingerprint?: string
  username: string
}

export type ManagedBootstrapAction = 'docker_install' | 'swarm_init'

export interface ManagedBootstrapRequest {
  action: ManagedBootstrapAction
  advertiseAddr?: string
}

export interface ServerCredentials {
  apiKey: string
}

export interface ServerReconnectInput extends ServerCredentials {
  tlsCertificateFingerprint?: string
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
  lastLogAt?: string
  logCount: number
  maxAttempts: number
  nextAttemptAt?: string
  requestId?: string
  serverId: string
  state: CommandState
  target: string
  updatedAt: string
}

export interface CommandLogEntry {
  attempt: number
  level: 'info' | 'warning' | 'error'
  message: string
  occurredAt: string
  source: 'controller' | 'machine'
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

export interface ApplicationSpec {
  backend?: string
  cpus: number
  databaseDelivery?: 'secret' | 'env'
  databases?: string[]
  domain?: string
  Env?: Record<string, string>
  healthCommand?: string[]
  healthPath?: string
  image: string
  memoryMiB: number
  metrics: boolean
  metricsPath?: string
  metricsPort?: number
  name: string
  port: number
  replicas: number
  resolver?: string
}

export interface ApplicationStatus {
  deployed: boolean
  runningTasks: number
  service: string
  spec: ApplicationSpec
  stack: string
  url?: string
}

export interface ApprovedWorkload {
  cpuCores: number
  domain?: string
  memoryMiB: number
  name: string
  replicas: number
  resolver?: string
}

export interface DatabaseStatus {
  database?: string
  displayName: string
  engine: string
  host: string
  image: string
  installed: boolean
  port: number
  runningTasks: number
  service: string
  stack: string
  uriSecret: string
  username?: string
  volume: string
}

export interface ObservabilityStatus {
  agentHealthy: boolean
  agentInstalled: boolean
  coreHealthy: boolean
  coreInstalled: boolean
  logsEnabled: boolean
  logsHealthy: boolean
}

export interface MobilityComponent {
  bytes?: number
  displayName: string
  healthySince?: string
  service: string
  sourceNodeId?: string
  state: string
  volume: string
}

export interface MobilityResource {
  components: Array<{ displayName: string; service: string; volume: string }>
  displayName: string
  requireManager: boolean
  requiredNodeLabel: string
  resource: string
}

export interface MobilityMigration {
  cleanupEligibleAt?: string
  components: MobilityComponent[]
  createdAt: string
  displayName: string
  failure?: string
  id: string
  resource: string
  sourceCleanupStarted?: boolean
  sourceServerIds?: string[]
  state: string
  targetNodeId: string
  targetServerId: string
  updatedAt: string
}

export interface MobilityStatus {
  migrations: MobilityMigration[]
  resources: MobilityResource[]
}
