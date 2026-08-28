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

export interface AgentEvent {
  code: string
  level: 'error' | 'info' | 'warning'
  message: string
  occurredAt: string
  source: 'agent' | 'core'
}

export interface AgentUpdateStatus {
  automatic: boolean
  checkedAt?: string
  lastUpdatedAt?: string
  requestedAt?: string
  revision?: string
  state?: 'deferred' | 'failed' | 'scheduled' | 'updated' | 'up_to_date'
}

export interface AgentHealth {
  agentVersion?: string
  checkedAt?: string
  detail?: string
  events?: AgentEvent[]
  lastFailureAt?: string
  lastReachableAt?: string
  protocolVersion?: number
  state?: Health
  summary?: string
  update?: AgentUpdateStatus
  uptimeSeconds?: number
}

export interface AgentEnrollmentToken {
	code: string
	coreFingerprint?: string
	expiresAt: string
	name?: string
}

export interface AgentIdentity {
	coreFingerprint?: string
	protocolVersion: number
}

export interface AgentClaimApproval {
	agentId: string
	expiresAt: string
	name: string
}

export interface Server {
  apiUrl?: string
	agentHealth?: AgentHealth
  authentication: 'api_key' | 'mutual_tls' | 'password' | 'private_key'
  connectionState: 'connected' | 'disconnected'
  connectionType?: 'agent_api' | 'agent_pull' | 'ssh'
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

export type CoreRole = 'active' | 'standby'
export type CoreReplicaState = 'awaiting_restore' | 'verified'
export type CoreHandoffState = 'prepared' | 'fenced'

// A CoreMember belongs to the SwarmOps control plane, not the managed-server
// inventory. agentServerId appears only after that same host has gone through
// ordinary, explicit machine-agent enrollment.
export interface CoreMember {
  agentServerId?: string
  endpoint: string
  id: string
  lastCheckpointAt?: string
  name: string
  replicaState: CoreReplicaState
  role: CoreRole
}

export interface CoreHandoff {
  fencedAt?: string
  fromId: string
  preparedAt: string
  state: CoreHandoffState
  toId: string
}

export interface CoreTopology {
  activeId?: string
	authorityEpoch: number
  controlEnabled: boolean
  handoff?: CoreHandoff
  localId: string
  localRole: CoreRole
  members: CoreMember[]
}

export interface CoreReplicaInput {
  agentServerId?: string
  endpoint: string
  id: string
  name: string
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

export interface ServerReadiness {
  capabilities: {
    applyUfw: boolean
    initializeSwarm: boolean
    installDocker: boolean
    updateDocker: boolean
    updateOs: boolean
  }
  docker: { installed: boolean; running: boolean; version?: string }
  firewall: { available: boolean; enabled: boolean }
  os: { id?: string; name?: string; supported: boolean }
  swarm: { manager: boolean; state?: string }
  host?: {
    collectedAt: string
    disk: { availableBytes: number; totalBytes: number; usedBytes: number }
    engine: { apiVersion?: string; cgroupDriver?: string; driver?: string; version?: string }
    hardware: {
      cpuCores: number
      load1: number
      load5: number
      load15: number
      memoryAvailableBytes: number
      memoryTotalBytes: number
      uptimeSeconds: number
    }
    nodeName: string
    os: { architecture: string; kernel?: string; name?: string }
    version: string
  }
}

export interface ServerReadinessRequest {
  advertiseAddress?: string
  applyUfw: boolean
  confirmation: 'PREPARE_SERVER'
  controllerCidrs?: string[]
  initializeSwarm: boolean
  installDocker: boolean
  swarmPeerCidrs?: string[]
  updateDocker: boolean
  updateOs: boolean
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

export type CommandState = 'uploading' | 'queued' | 'leased' | 'preparing' | 'running' | 'retry_scheduled' | 'succeeded' | 'failed' | 'needs_attention' | 'superseded' | 'cancelled'

export interface Command {
  action: string
  actor: string
  attempt: number
	authorityEpoch: number
  autoRetry: boolean
	clusterId: string
  createdAt: string
	failureCode?: string
	failureSummary?: string
  id: string
  lastAttemptAt?: string
  lastError?: string
	leaseExpiresAt?: string
  maxAttempts: number
  nextAttemptAt?: string
	nodeId: string
  requestId?: string
	recoveryHint?: string
  serverId: string
  state: CommandState
  target: string
  updatedAt: string
}

export interface Session {
  csrfToken: string
  user: { username: string }
}

export interface TraefikStatus {
  dashboardURL?: string
  service: Service | null
}

export type RouteProtocol = 'http' | 'tcp' | 'udp'
export type RouteScope = 'public' | 'internal' | 'both'
export type RouteTLSMode = 'off' | 'terminate' | 'passthrough'
export type ServiceRouteRole = 'routed' | 'client-only' | 'platform-exception' | 'needs-configuration'
export type DNSProvider = 'cloudflare' | 'arvan'
export type DNSRecordType = 'A' | 'AAAA' | 'CNAME'
export type ACMEChallenge = 'dns-01' | 'http-01' | 'tls-alpn-01'

export interface RouteSpec {
  accessLogs: boolean
  dnsReference?: string
  enabled: boolean
  health: { kind: 'response' | 'handshake' | 'structural'; path?: string; timeoutSeconds: number }
  key: string
  listenPort?: number
  managed: boolean
  match: { hosts?: string[]; pathPrefix?: string; sni?: string[] }
  metrics: boolean
  protocol: RouteProtocol
  publicAllow: boolean
  resolver?: string
  scope: RouteScope
  sensitive: boolean
  serviceKey: string
  tls: RouteTLSMode
  targetPort: number
  version: number
}

export interface ServiceRouteDeclaration {
  reason?: string
  role: ServiceRouteRole
  serviceKey: string
  version: number
}

export interface RouteRuntime {
  errors?: string[]
  entryPoints: string[]
  observedAt: string
  protocol: RouteProtocol
  routeKey: string
  router: string
  service: string
  state: string
  version: number
}

export interface RouteInventoryRow {
  declaration: ServiceRouteDeclaration
  exception?: string
  manifestSnippet?: string
  route: RouteSpec
  runtime?: RouteRuntime
  serviceImage?: string
  status: string
}

export interface StaticEntryPoint {
  name: string
  port: number
  protocol: RouteProtocol
  public: boolean
}

export interface ACMEPolicy {
  challenge: ACMEChallenge
  dnsCredentialId?: string
  name: string
  provider?: DNSProvider
}

export interface TraefikSettings {
  acmeEmail: string
  accessLogs: boolean
  entryPoints: StaticEntryPoint[]
  metricsEnabled: true
  operationalLog: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'
  portRange: { end: number; start: number }
  resolvers: ACMEPolicy[]
  version: number
}

export interface TraefikInstallCheck {
  detail: string
  id: string
  label: string
  recovery?: string
  required: boolean
  state: 'automatic' | 'blocked' | 'optional' | 'ready'
}

export interface TraefikInstallPreflight {
  challenge: 'dns-01' | 'http-01'
  checks: TraefikInstallCheck[]
  ready: boolean
}

export interface DNSCredentialMetadata {
  createdAt: string
  id: string
  name: string
  provider: DNSProvider
  secretName: string
  state: string
  validatedAt?: string
  version: number
}

export interface DNSRecordSpec {
  adopted: boolean
  content: string
  credentialId: string
  id: string
  managed: boolean
  name: string
  providerRecordId?: string
  proxied: boolean
  ttl: number
  type: DNSRecordType
  version: number
  zone: string
}

export interface DNSProviderRecord {
  content: string
  name: string
  protected: boolean
  providerRecordId: string
  proxied: boolean
  ttl: number
  type: DNSRecordType
}

export interface DNSRecordPreview {
  action: string
  existing?: DNSProviderRecord
  record: DNSRecordSpec
  warnings: string[]
}

export interface DNSPropagationStatus {
  checks: { answers: string[]; error?: string; resolver: string; valid: boolean }[]
  observedAt: string
  ready: boolean
}

export interface CertificateStatus {
  domains: string[]
  failureSummary?: string
  fingerprint?: string
  handshakeValid: boolean
  issuer?: string
  lastAttempt?: string
  notAfter?: string
  notBefore?: string
  resolver: string
  routeKey: string
  state: string
  version: number
}

export interface DependencyBinding {
  callerService: string
  delivery: 'existing' | 'environment' | 'secret_file'
  name: string
  targetRoute: string
  version: number
}

export interface RoutingState {
  bindings: DependencyBinding[]
  certificates: CertificateStatus[]
  credentials: DNSCredentialMetadata[]
  cutover?: CutoverPlan
  declarations: ServiceRouteDeclaration[]
  dnsRecords: DNSRecordSpec[]
  routes: RouteSpec[]
  runtime: RouteRuntime[]
  settings: TraefikSettings
  version: number
}

export interface RoutePlan {
  entryPoint: StaticEntryPoint
  labels: Record<string, string>
  manifestSnippet: string
  network: string
  restartRequired: boolean
  route: RouteSpec
  validation: { code: string; message: string; valid: boolean }[]
  version: number
}

export interface TraefikLogRecord {
  client?: string
  level: string
  message: string
  method?: string
  requestId?: string
  router?: string
  service?: string
  statusCode?: number
  timestamp: string
}

export interface LogRecord {
  id: string
  timestamp: string
  level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal'
  sourceKind: 'container' | 'host' | 'docker' | 'traefik' | 'core' | 'agent' | 'fluentd'
  node?: string
  stack?: string
  service?: string
  containerId?: string
  stream?: string
  unit?: string
  identifier?: string
  message: string
}

export interface LogPage {
  records: LogRecord[]
  nextCursor?: string
  truncated: boolean
  facets: { levels: string[]; sourceKinds: string[]; nodes: string[]; stacks: string[]; services: string[]; units: string[] }
}

export interface LogStatus {
  healthy: boolean
  forwarders: number
  expectedNodes: number
  bufferBytes: number
  retainedBytes: number
  oldest?: string
  newest?: string
  retentionSeconds: number
  capacityBytes: number
  capacityEvictions: number
  droppedRecords: number
  malformedRecords: number
  lastCleanupAt?: string
  warnings: string[]
}

export interface PrometheusStatus {
  collected: boolean
  observedAt: string
  targets: { error?: string; health: string; labels: string[]; lastScrape?: string; target: string }[]
}

export interface CutoverService {
  bindings: string[]
  blockers: string[]
  directPorts: number[]
  healthy: boolean
  legacyNetworks: string[]
  role: string
  routes: string[]
  serviceKey: string
}

export interface CutoverPlan {
  blockers: string[]
  generatedAt: string
  phases: string[]
  ready: boolean
  services: CutoverService[]
  version: number
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
  tracing?: boolean
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
  domainOptional: boolean
  domainSuffixes?: string[]
  memoryMiB: number
  name: string
  replicas: number
  resolver?: string
}

export type SourceProviderKind = 'github' | 'gitlab' | 'gitea'
export type SourceClassification = 'application' | 'managed_data' | 'shared_platform' | 'unsupported'
export type SourceFindingLevel = 'info' | 'warning' | 'blocker'

export interface SourceStatus {
  buildEnabled: boolean
  enabled: boolean
  imagePrefixConfigured: boolean
  privateHostsConfigured: boolean
}

// A source connection is intentionally metadata-only. Its provider token is
// accepted only by the write request and is never returned to the console.
export interface SourceConnection {
  account?: string
  baseUrl: string
  createdAt: string
  credentialState: string
  id: string
  kind: SourceProviderKind
  name: string
  updatedAt: string
}

export interface SourceConnectionInput {
  baseUrl: string
  kind: SourceProviderKind
  name: string
  token: string
}

export interface SourceRepository {
  defaultBranch?: string
  id: string
  name: string
  path: string
  private: boolean
  webUrl?: string
}

export interface SourceRevision {
  sha: string
  treeSha?: string
}

export interface SourceEvidenceFile {
  digest: string
  path: string
  size: number
}

export interface SourceFinding {
  code: string
  level: SourceFindingLevel
  message: string
  subject?: string
}

export interface SourceBuildPlan {
  contextPath: string
  dockerfilePath: string
  image: string
  required: boolean
}

// SourceServicePlan is a safe evidence summary. It never contains source
// bodies, labels, environment values, or provider credentials.
export interface SourceServicePlan {
  build?: SourceBuildPlan
  classification: SourceClassification
  composePath: string
  databases?: string[]
  findings?: SourceFinding[]
  healthPath?: string
  image?: string
  metrics: boolean
  name: string
  port?: number
  service: string
  sharedStacks?: string[]
  tracing: boolean
}

export interface SourcePlan {
  composeFiles: SourceEvidenceFile[]
  dockerfiles: SourceEvidenceFile[]
  findings?: SourceFinding[]
  generatedAt: string
  id: string
  ready: boolean
  repository: SourceRepository
  revision: SourceRevision
  scanner: string
  services: SourceServicePlan[]
  sharedStacks?: string[]
}

export interface SourceDiscoverRequest {
  connectionId: string
  ref: string
  repositoryId: string
}

export interface SourceSelection {
  composePath: string
  connectionId: string
  planId: string
  repositoryId: string
  revision: string
  service: string
}

export interface DatabaseStatus {
  database?: string
  displayName: string
  engine: string
  host: string
  image: string
  installed: boolean
  port: number
  targetPort: number
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

// The inventory types below mirror the control plane's Docker and Swarm
// projections. Fields the server withholds — container environment values,
// config payloads, swarm join tokens — are absent here too, so the console
// cannot display what it was never given.

export interface ContainerSummary {
  Command: string
  Created: number
  Id: string
  Image: string
  ImageID: string
  Labels?: Record<string, string>
  Mounts?: { Destination: string; Name: string; RW: boolean; Source: string; Type: string }[]
  Names?: string[]
  NetworkSettings?: { Networks?: Record<string, { IPAddress: string; NetworkID: string }> }
  Ports?: { IP?: string; PrivatePort: number; PublicPort?: number; Type: string }[]
  SizeRootFs?: number
  SizeRw?: number
  State: string
  Status: string
}

export interface ContainerDetail {
  Args?: string[]
  Config: {
    EnvNames?: string[]
    Hostname?: string
    Image?: string
    Labels?: Record<string, string>
    User?: string
    WorkingDir?: string
  }
  Created: string
  HostConfig: {
    CpuShares?: number
    Memory?: number
    NanoCpus?: number
    NetworkMode?: string
    Privileged?: boolean
    RestartPolicy?: { MaximumRetryCount: number; Name: string }
  }
  Id: string
  Image: string
  Mounts?: { Destination: string; Name: string; RW: boolean; Source: string; Type: string }[]
  Name: string
  Path?: string
  RestartCount: number
  State: {
    ExitCode: number
    FinishedAt?: string
    Health?: { FailingStreak: number; Status: string }
    OOMKilled?: boolean
    Running: boolean
    StartedAt?: string
    Status: string
  }
}

export interface ContainerStats {
  blockReadBytes: number
  blockWriteBytes: number
  cpuPercent: number
  id: string
  memoryLimitBytes: number
  memoryPercent: number
  memoryUsedBytes: number
  networkRxBytes: number
  networkTxBytes: number
  pidsCurrent: number
  sampledAt: string
}

export interface ImageSummary {
  Containers: number
  Created: number
  Id: string
  Labels?: Record<string, string>
  RepoDigests?: string[]
  RepoTags?: string[]
  SharedSize?: number
  Size: number
}

export interface ImageDetail {
  Architecture?: string
  Author?: string
  Created?: string
  Id: string
  Os?: string
  Parent?: string
  RepoDigests?: string[]
  RepoTags?: string[]
  RootFS?: { Layers?: string[]; Type?: string }
  Size: number
}

export interface VolumeSummary {
  CreatedAt?: string
  Driver: string
  Labels?: Record<string, string>
  Mountpoint: string
  Name: string
  Options?: Record<string, string>
  Scope: string
  UsageData?: { RefCount: number; Size: number }
}

export interface NetworkSummary {
  Attachable: boolean
  Created?: string
  Driver: string
  Id: string
  IPAM?: { Config?: { Gateway?: string; Subnet?: string }[]; Driver?: string }
  Ingress: boolean
  Internal: boolean
  Labels?: Record<string, string>
  Name: string
  Scope: string
}

export interface NetworkDetail extends NetworkSummary {
  Containers?: Record<string, { EndpointID: string; IPv4Address: string; Name: string }>
}

export interface SwarmObjectMeta {
  CreatedAt: string
  ID: string
  Spec: { Labels?: Record<string, string>; Name: string }
  UpdatedAt: string
  Version: { Index: number }
}

export interface SwarmSettings {
  CreatedAt: string
  ID: string
  Spec: {
    CAConfig?: { NodeCertExpiry?: number }
    Dispatcher?: { HeartbeatPeriod?: number }
    EncryptionConfig?: { AutoLockManagers?: boolean }
    Labels?: Record<string, string>
    Name?: string
    Orchestration?: { TaskHistoryRetentionLimit?: number }
    Raft?: {
      ElectionTick?: number
      HeartbeatTick?: number
      KeepOldSnapshots?: number
      LogEntriesForSlowFollowers?: number
      SnapshotInterval?: number
    }
  }
  UpdatedAt: string
  Version: { Index: number }
}

export interface DiskUsage {
  BuildCache?: { Description?: string; ID: string; InUse: boolean; LastUsedAt?: string; Shared: boolean; Size: number; Type: string; UsageCount: number }[]
  Containers?: ContainerSummary[]
  Images?: ImageSummary[]
  LayersSize: number
  Volumes?: VolumeSummary[]
}

export interface EngineEvent {
  Action: string
  Actor: { Attributes?: Record<string, string>; ID: string }
  Type: string
  scope?: string
  time: number
  timeNano: number
}

export interface Insights {
  capacity: { cpuCores: number; diskBytes: number; diskUsedBytes: number; memoryBytes: number }
  configs: number
  containers: { paused: number; running: number; stopped: number; total: number; unhealthy: number }
  generatedAt: string
  networks: { ingress: number; overlay: number; total: number }
  nodes: { managers: number; ready: number; total: number; unavailable: number }
  secrets: number
  services: { degraded: number; desiredTasks: number; runningTasks: number; total: number; unhealthy: number }
  storage: {
    buildCacheBytes: number
    containerWritableBytes: number
    imageBytes: number
    images: number
    layersBytes: number
    reclaimableBuildCacheBytes: number
    reclaimableImageBytes: number
    reclaimableVolumeBytes: number
    unusedImages: number
    unusedVolumes: number
    volumeBytes: number
    volumes: number
  }
  swarm: { autoLockManagers: boolean; createdAt: string; id: string; taskHistoryLimit: number }
  tasks: { desired: number; failed: number; total: number }
}

export interface CommandParameter {
  hint?: string
  in: 'body' | 'path' | 'query'
  kind: 'confirmation' | 'hidden' | 'number' | 'select' | 'switch' | 'text'
  label: string
  name: string
  options?: string[]
  placeholder?: string
  required: boolean
}

export interface InsightsSample {
  at: string
  buildCacheBytes: number
  containersRunning: number
  containersStopped: number
  containersTotal: number
  containersUnhealthy: number
  diskCapacityBytes: number
  diskUsedBytes: number
  imageBytes: number
  nodesReady: number
  nodesTotal: number
  nodesUnavailable: number
  reclaimableBytes: number
  servicesDegraded: number
  servicesTotal: number
  servicesUnhealthy: number
  tasksDesired: number
  tasksFailed: number
  tasksRunning: number
  tasksTotal: number
  volumeBytes: number
}

export interface CommandDefinition {
  action: string
  autoRetry: boolean
  confirmation?: string
  description: string
  destructive: boolean
  docker: string
  endpoint: string
  mutation: boolean
  parameters?: CommandParameter[]
  resource: string
  title: string
}

export type PruneResource = 'build-cache' | 'containers' | 'images' | 'networks' | 'volumes'
