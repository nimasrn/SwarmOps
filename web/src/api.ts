import type {
	AgentEnrollmentToken,
	AgentClaimApproval,
  ApplicationSpec,
	AgentHealth,
  CommandDefinition,
  ContainerDetail,
  ContainerStats,
  ContainerSummary,
  DiskUsage,
  EngineEvent,
  ImageDetail,
  ImageSummary,
  Insights,
  InsightsSample,
  NetworkDetail,
  NetworkSummary,
  PruneResource,
  SwarmObjectMeta,
  SwarmSettings,
  VolumeSummary,
  ApplicationStatus,
  ApprovedWorkload,
  AuditEvent,
  Command,
  ComposePlan,
  DatabaseStatus,
  Node,
  ObservabilityStatus,
  Overview,
  Service,
  Server,
  ServerInput,
  ServerReconnectInput,
  ServerReadiness,
  ServerReadinessRequest,
  Session,
  SourceConnection,
  SourceConnectionInput,
  SourceDiscoverRequest,
  SourcePlan,
  SourceRepository,
  SourceSelection,
  SourceStatus,
  Stack,
  Task,
  TraefikStatus,
  CertificateStatus,
  CoreReplicaInput,
  CoreTopology,
  CutoverPlan,
  DependencyBinding,
  DNSPropagationStatus,
  DNSRecordPreview,
  DNSRecordSpec,
  PrometheusStatus,
  RouteInventoryRow,
  RoutePlan,
  RouteProtocol,
  RouteSpec,
  RoutingState,
  ServiceRouteRole,
  TraefikLogRecord,
  TraefikSettings,
} from './types'

export class APIError extends Error {
  constructor(message: string, readonly status: number, readonly detail?: string, readonly requestID?: string) {
    super(message)
    this.name = 'APIError'
  }
}

export class SwarmOpsAPI {
  private csrfToken = ''
  private serverID = ''

  selectServer(id: string) {
    this.serverID = id
  }

  async login(username: string, password: string): Promise<Session> {
    const session = await this.request<Session>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    })
    this.csrfToken = session.csrfToken
    return session
  }

  async me(): Promise<Session> {
    const session = await this.request<Session>('/api/v1/auth/me')
    this.csrfToken = session.csrfToken
    return session
  }

  async logout(): Promise<void> {
    await this.request<void>('/api/v1/auth/logout', { method: 'POST' })
    this.csrfToken = ''
  }

  servers() { return this.request<Server[]>('/api/v1/servers') }
	createAgentEnrollment(name: string) {
		return this.request<AgentEnrollmentToken>('/api/v1/agents/enrollment-tokens', { method: 'POST', body: JSON.stringify({ name }) })
	}
	approveAgentClaim(code: string) {
		return this.request<AgentClaimApproval>('/api/v1/agents/claims/approve', { method: 'POST', body: JSON.stringify({ code }) })
	}

  coreTopology() { return this.request<CoreTopology>('/api/v1/core') }

  addCoreReplica(input: CoreReplicaInput) {
    return this.request<CoreTopology>('/api/v1/core/replicas', {
      method: 'POST',
      body: JSON.stringify({ ...input, confirmation: 'PREPARE_CORE_REPLICA' }),
    })
  }

  verifyCoreReplica(id: string) {
    return this.request<CoreTopology>(`/api/v1/core/replicas/${encodeURIComponent(id)}/verify`, {
      method: 'POST',
      body: JSON.stringify({ confirmation: 'VERIFY_CORE_REPLICA' }),
    })
  }

  prepareCoreHandoff(targetId: string) {
    return this.request<CoreTopology>('/api/v1/core/handoff', {
      method: 'POST',
      body: JSON.stringify({ confirmation: `PREPARE_CORE_HANDOFF:${targetId}`, targetId }),
    })
  }

  fenceCoreHandoff(targetId: string) {
    return this.request<CoreTopology>(`/api/v1/core/handoff/${encodeURIComponent(targetId)}/fence`, {
      method: 'POST',
      body: JSON.stringify({ confirmation: `FENCE_CORE:${targetId}` }),
    })
  }

  promoteCore(primaryConfirmedStopped: boolean) {
    const topology = this.request<CoreTopology>('/api/v1/core')
    return topology.then(({ localId }) => this.request<CoreTopology>('/api/v1/core/promote', {
      method: 'POST',
      body: JSON.stringify({ confirmation: `PROMOTE_CORE:${localId}`, primaryConfirmedStopped }),
    }))
  }

  enrollServer(token: string, name: string) {
    return this.request<Server>('/api/v1/servers/enroll', {
      method: 'POST',
      body: JSON.stringify({ token, name }),
    })
  }

  addServer(input: ServerInput) {
    return this.request<Server>('/api/v1/servers', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  }

  connectServer(id: string, credentials: ServerReconnectInput) {
    return this.request<Server>(`/api/v1/servers/${encodeURIComponent(id)}/connect`, {
      method: 'POST',
      body: JSON.stringify(credentials),
    })
  }

  disconnectServer(id: string) {
    return this.request<void>(`/api/v1/servers/${encodeURIComponent(id)}/disconnect`, { method: 'POST' })
  }

  removeServer(id: string) {
    return this.request<void>(`/api/v1/servers/${encodeURIComponent(id)}`, { method: 'DELETE' })
  }

  serverReadiness(id: string) {
	return this.request<ServerReadiness>(`/api/v1/servers/${encodeURIComponent(id)}/readiness`)
  }

  agentDiagnostics(id: string) {
	return this.request<AgentHealth>(`/api/v1/servers/${encodeURIComponent(id)}/diagnostics`)
  }

  requestAgentUpdate(id: string) {
	return this.request<AgentHealth>(`/api/v1/servers/${encodeURIComponent(id)}/agent-update`, { method: 'POST' })
  }

  prepareServer(id: string, input: ServerReadinessRequest) {
    return this.commandRequest<Command>(`/api/v1/servers/${encodeURIComponent(id)}/readiness`, {
      method: 'POST',
      body: JSON.stringify(input),
    })
  }

  overview() { return this.request<Overview>('/api/v1/overview') }
  nodes() { return this.request<Node[]>('/api/v1/nodes') }
  node(id: string) { return this.request<Node>(`/api/v1/nodes/${encodeURIComponent(id)}`) }
  nodeTasks(id: string) { return this.request<Task[]>(`/api/v1/nodes/${encodeURIComponent(id)}/tasks`) }
  stacks() { return this.request<Stack[]>('/api/v1/stacks') }
  services() { return this.request<Service[]>('/api/v1/services') }
  auditEvents() { return this.request<AuditEvent[]>('/api/v1/audit-events?limit=100') }

  // The Docker and Swarm inventory. Every entry here is a read; the console
  // never reaches the Engine except through these projections.
  insights() { return this.request<Insights>('/api/v1/insights') }
  diskUsage() { return this.request<DiskUsage>('/api/v1/system/df') }
  events(minutes = 60) { return this.request<EngineEvent[]>(`/api/v1/events?minutes=${minutes}`) }
  swarm() { return this.request<SwarmSettings>('/api/v1/swarm') }
  containers() { return this.request<ContainerSummary[]>('/api/v1/containers') }
  container(id: string) { return this.request<ContainerDetail>(`/api/v1/containers/${encodeURIComponent(id)}`) }
  containerStats(id: string) { return this.request<ContainerStats>(`/api/v1/containers/${encodeURIComponent(id)}/stats`) }
  images() { return this.request<ImageSummary[]>('/api/v1/images') }
  image(id: string) { return this.request<ImageDetail>(`/api/v1/images/${encodeURIComponent(id)}`) }
  volumes() { return this.request<VolumeSummary[]>('/api/v1/volumes') }
  volume(name: string) { return this.request<VolumeSummary>(`/api/v1/volumes/${encodeURIComponent(name)}`) }
  networks() { return this.request<NetworkSummary[]>('/api/v1/networks') }
  network(id: string) { return this.request<NetworkDetail>(`/api/v1/networks/${encodeURIComponent(id)}`) }
  secrets() { return this.request<SwarmObjectMeta[]>('/api/v1/secrets') }
  configs() { return this.request<SwarmObjectMeta[]>('/api/v1/configs') }
  commandCatalogue() { return this.request<CommandDefinition[]>('/api/v1/commands/catalogue') }
  insightsHistory() { return this.request<InsightsSample[]>('/api/v1/insights/history') }

  // runCatalogued executes one catalogue entry from the values an operator
  // typed into its generated form. It builds the request from the definition
  // alone — the same closed vocabulary the server serves — so the console
  // gains no route the catalogue does not already describe.
  async runCatalogued(definition: CommandDefinition, values: Record<string, boolean | number | string>, serverID: string): Promise<unknown> {
    if (!serverID) throw new APIError('Choose the server to run this on', 422)
    const [method, template] = definition.endpoint.split(' ')
    const body: Record<string, boolean | number | string> = {}
    const query = new URLSearchParams()
    let path = template
    for (const parameter of definition.parameters ?? []) {
      const value = values[parameter.name]
      if (parameter.in === 'path') {
        const supplied = String(value ?? '').trim()
        if (!supplied) throw new APIError(`${parameter.label} is required`, 422)
        path = path.replace(`{${parameter.name}}`, encodeURIComponent(supplied))
        continue
      }
      if (parameter.in === 'query') {
        if (value !== undefined && value !== '') query.set(parameter.name, String(value))
        continue
      }
      if (value === undefined || value === '') {
        if (parameter.required) throw new APIError(`${parameter.label} is required`, 422)
        continue
      }
      body[parameter.name] = parameter.kind === 'number' ? Number(value) : value
    }
    const url = query.toString() ? `${path}?${query.toString()}` : path
    // The target travels with the request, so a read runs against the chosen
    // server and a mutation is queued for it in the ledger.
    const headers = new Headers({ 'X-SwarmOps-Server-ID': serverID })
    if (method === 'GET') return this.request<unknown>(url, { headers })
    return this.commandRequest<unknown>(url, { method: 'POST', body: JSON.stringify(body), headers })
  }

  // Resource mutations. Each returns the queued command rather than a result:
  // the ledger owns the outcome, exactly as it does for every other write.
  setNodeRole(id: string, role: 'demote' | 'promote') {
    return this.commandRequest<Command>(`/api/v1/nodes/${encodeURIComponent(id)}/role`, { method: 'POST', body: JSON.stringify({ role }) })
  }

  setNodeLabel(id: string, key: string, value: string) {
    return this.commandRequest<Command>(`/api/v1/nodes/${encodeURIComponent(id)}/labels`, { method: 'POST', body: JSON.stringify({ key, value }) })
  }

  removeNode(id: string, confirmation: string) {
    return this.commandRequest<Command>(`/api/v1/nodes/${encodeURIComponent(id)}/remove`, { method: 'POST', body: JSON.stringify({ confirmation }) })
  }

  updateServiceImage(id: string, image: string) {
    return this.commandRequest<Command>(`/api/v1/services/${encodeURIComponent(id)}/image`, { method: 'POST', body: JSON.stringify({ image }) })
  }

  updateServiceLimits(id: string, cpus: string, memory: string) {
    return this.commandRequest<Command>(`/api/v1/services/${encodeURIComponent(id)}/limits`, { method: 'POST', body: JSON.stringify({ cpus, memory }) })
  }

  removeService(id: string, confirmation: string) {
    return this.commandRequest<Command>(`/api/v1/services/${encodeURIComponent(id)}/remove`, { method: 'POST', body: JSON.stringify({ confirmation }) })
  }

  removeStack(name: string, confirmation: string) {
    return this.commandRequest<Command>(`/api/v1/stacks/${encodeURIComponent(name)}/remove`, { method: 'POST', body: JSON.stringify({ confirmation }) })
  }

  containerAction(id: string, action: 'remove' | 'restart' | 'start' | 'stop', confirmation?: string) {
    return this.commandRequest<Command>(`/api/v1/containers/${encodeURIComponent(id)}/actions`, { method: 'POST', body: JSON.stringify({ action, confirmation }) })
  }

  pullImage(image: string) {
    return this.commandRequest<Command>('/api/v1/images/pull', { method: 'POST', body: JSON.stringify({ image }) })
  }

  removeImage(image: string) {
    return this.commandRequest<Command>('/api/v1/images/remove', { method: 'POST', body: JSON.stringify({ image }) })
  }

  createNetwork(input: { attachable: boolean; driver: string; internal: boolean; name: string }) {
    return this.commandRequest<Command>('/api/v1/networks', { method: 'POST', body: JSON.stringify(input) })
  }

  removeNetwork(name: string, confirmation: string) {
    return this.commandRequest<Command>(`/api/v1/networks/${encodeURIComponent(name)}/remove`, { method: 'POST', body: JSON.stringify({ confirmation }) })
  }

  createVolume(name: string) {
    return this.commandRequest<Command>('/api/v1/volumes', { method: 'POST', body: JSON.stringify({ name }) })
  }

  removeVolume(name: string, confirmation: string) {
    return this.commandRequest<Command>(`/api/v1/volumes/${encodeURIComponent(name)}/remove`, { method: 'POST', body: JSON.stringify({ confirmation }) })
  }

  removeConfig(name: string, confirmation: string) {
    return this.commandRequest<Command>(`/api/v1/configs/${encodeURIComponent(name)}/remove`, { method: 'POST', body: JSON.stringify({ confirmation }) })
  }

  prune(resource: PruneResource, confirmation: string, all = false) {
    return this.commandRequest<Command>(`/api/v1/prune/${encodeURIComponent(resource)}`, { method: 'POST', body: JSON.stringify({ all, confirmation }) })
  }

  rotateJoinToken(role: 'manager' | 'worker', confirmation: string) {
    return this.commandRequest<Command>('/api/v1/swarm/join-token', { method: 'POST', body: JSON.stringify({ confirmation, role }) })
  }

  updateSwarm(taskHistoryLimit: number) {
    return this.commandRequest<Command>('/api/v1/swarm', { method: 'POST', body: JSON.stringify({ taskHistoryLimit }) })
  }
  commands() { return this.request<Command[]>('/api/v1/commands?limit=100') }
  command(id: string) { return this.request<Command>(`/api/v1/commands/${encodeURIComponent(id)}`) }
  async waitForCommand(id: string, timeoutMs = 8000) {
    const terminal = new Set<Command['state']>(['succeeded', 'failed', 'needs_attention', 'superseded', 'cancelled'])
    const deadline = Date.now() + timeoutMs
    let command = await this.command(id)
    while (!terminal.has(command.state) && Date.now() < deadline) {
      await new Promise((resolve) => window.setTimeout(resolve, 200))
      command = await this.command(id)
    }
    return command
  }
  retryCommand(id: string) { return this.request<Command>(`/api/v1/commands/${encodeURIComponent(id)}/retry`, { method: 'POST' }) }
  traefik() { return this.request<TraefikStatus>('/api/v1/traefik/status') }
  observability() { return this.request<ObservabilityStatus>('/api/v1/observability/status') }
  databases() { return this.request<DatabaseStatus[]>('/api/v1/databases') }
  applications() { return this.request<ApplicationStatus[]>('/api/v1/applications') }
  approvedApplications() { return this.request<ApprovedWorkload[]>('/api/v1/applications/approved') }
  sourceStatus() { return this.request<SourceStatus>('/api/v1/sources/status') }
  sourceConnections() { return this.request<SourceConnection[]>('/api/v1/sources/connections') }

  createSourceConnection(input: SourceConnectionInput) {
    return this.request<SourceConnection>('/api/v1/sources/connections', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  }

  updateSourceConnection(id: string, input: SourceConnectionInput) {
    return this.request<SourceConnection>(`/api/v1/sources/connections/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    })
  }

  removeSourceConnection(id: string) {
    return this.request<void>(`/api/v1/sources/connections/${encodeURIComponent(id)}`, { method: 'DELETE' })
  }

  sourceRepositories(connectionID: string) {
    return this.request<SourceRepository[]>(`/api/v1/sources/connections/${encodeURIComponent(connectionID)}/repositories`)
  }

  discoverSource(input: SourceDiscoverRequest) {
    return this.request<SourcePlan>('/api/v1/sources/discover', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  }

  deploySource(selection: SourceSelection, application: ApplicationSpec) {
    return this.commandRequest<Command>('/api/v1/sources/deploy', {
      method: 'POST',
      body: JSON.stringify({ application, selection }),
    })
  }

  planApplication(spec: ApplicationSpec) {
    return this.request<{ compose: string }>('/api/v1/applications/plan', {
      method: 'POST',
      body: JSON.stringify(spec),
    })
  }

  deployApplication(spec: ApplicationSpec) {
    return this.commandRequest<Command>('/api/v1/applications', {
      method: 'POST',
      body: JSON.stringify(spec),
    })
  }

  removeApplication(name: string, confirmation: string) {
    return this.commandRequest<Command>(`/api/v1/applications/${encodeURIComponent(name)}/remove`, {
      method: 'POST',
      body: JSON.stringify({ confirmation }),
    })
  }

  setApplicationDomain(name: string, domain: string, resolver: string, confirmation = '') {
    return this.commandRequest<Command>(`/api/v1/applications/${encodeURIComponent(name)}/domain`, {
      method: 'POST',
      body: JSON.stringify({ confirmation, domain, resolver }),
    })
  }

  setDatabase(engine: string, enabled: boolean, confirmation = '') {
    return this.commandRequest<Command>(`/api/v1/databases/${encodeURIComponent(engine)}`, {
      method: 'POST',
      body: JSON.stringify({ enabled, confirmation }),
    })
  }

  reconcileTraefik(confirmation: string) {
    return this.commandRequest<Command>('/api/v1/traefik/reconcile', {
      method: 'POST',
      body: JSON.stringify({ confirmation }),
    })
  }

  traefikRoutingState(refresh = false) {
    return this.request<RoutingState>(`/api/v1/traefik/state?refresh=${String(refresh)}`)
  }

  traefikRoutes() { return this.request<RouteInventoryRow[]>('/api/v1/traefik/routes') }

  planTraefikRoute(route: RouteSpec) {
    return this.request<RoutePlan>('/api/v1/traefik/routes/plan', { method: 'POST', body: JSON.stringify(route) })
  }

  applyTraefikRoute(route: RouteSpec, confirmation = '') {
    return this.commandRequest<Command>('/api/v1/traefik/routes', { method: 'POST', body: JSON.stringify({ confirmation, route }) })
  }

  declareTraefikServiceRole(service: string, role: ServiceRouteRole, reason = '') {
    return this.commandRequest<Command>(`/api/v1/traefik/services/${encodeURIComponent(service)}/role`, {
      method: 'POST', body: JSON.stringify({ reason, role }),
    })
  }

  applyTraefikBinding(binding: DependencyBinding) {
    return this.commandRequest<Command>('/api/v1/traefik/bindings', { method: 'POST', body: JSON.stringify(binding) })
  }

  applyTraefikSettings(settings: TraefikSettings, confirmation: string) {
    return this.commandRequest<Command>('/api/v1/traefik/settings', { method: 'POST', body: JSON.stringify({ confirmation, settings }) })
  }

  uploadDNSCredential(id: string, name: string, provider: 'cloudflare' | 'arvan', value: string) {
    const query = new URLSearchParams({ id, name, provider })
    const headers = new Headers({ 'Content-Type': 'text/plain' })
    return this.commandRequest<Command>(`/api/v1/traefik/dns/credentials?${query}`, { method: 'POST', body: value, headers })
  }

  previewDNSRecord(record: DNSRecordSpec, protocol: RouteProtocol) {
    return this.request<DNSRecordPreview>('/api/v1/traefik/dns/records/preview', { method: 'POST', body: JSON.stringify({ protocol, record }) })
  }

  applyDNSRecord(record: DNSRecordSpec, protocol: RouteProtocol) {
    return this.commandRequest<Command>('/api/v1/traefik/dns/records', { method: 'POST', body: JSON.stringify({ protocol, record }) })
  }

  removeDNSCredentialVersion(id: string, version: number, confirmation: string) {
    return this.commandRequest<Command>(`/api/v1/traefik/dns/credentials/${encodeURIComponent(id)}/versions/${version}`, {
      method: 'DELETE',
      body: JSON.stringify({ confirmation, id, version }),
    })
  }

  deleteDNSRecord(id: string, confirmation: string) {
    return this.commandRequest<Command>(`/api/v1/traefik/dns/records/${encodeURIComponent(id)}`, { method: 'DELETE', body: JSON.stringify({ confirmation }) })
  }

  verifyDNSRecord(id: string) {
    return this.request<DNSPropagationStatus>(`/api/v1/traefik/dns/records/${encodeURIComponent(id)}/verify`)
  }

  traefikCertificates() { return this.request<CertificateStatus[]>('/api/v1/traefik/certificates') }

  retryTraefikCertificate(route: string) {
    return this.commandRequest<Command>(`/api/v1/traefik/certificates/${encodeURIComponent(route)}/retry`, { method: 'POST' })
  }

  traefikLogs(input: { from?: string; level?: string; limit?: number; live?: boolean; requestId?: string; router?: string; service?: string; to?: string } = {}) {
    const query = new URLSearchParams()
    for (const [key, value] of Object.entries(input)) if (value !== undefined && value !== '') query.set(key, String(value))
    return this.request<TraefikLogRecord[]>(`/api/v1/traefik/logs?${query}`)
  }

  traefikPrometheus() { return this.request<PrometheusStatus>('/api/v1/traefik/prometheus') }
  traefikCutoverPlan() { return this.request<CutoverPlan>('/api/v1/traefik/cutover/plan') }
  applyTraefikCutover(confirmation: string) {
    return this.commandRequest<Command>('/api/v1/traefik/cutover', { method: 'POST', body: JSON.stringify({ confirmation }) })
  }

  validateStack(name: string, compose: string, targetNodeId: string) {
    return this.request<ComposePlan>('/api/v1/stacks/validate', {
      method: 'POST',
      body: JSON.stringify({ name, compose, targetNodeId }),
    })
  }

  deployStack(name: string, compose: string, targetNodeId: string) {
    return this.commandRequest<Command>('/api/v1/stacks/deploy', {
      method: 'POST',
      body: JSON.stringify({ name, compose, targetNodeId }),
    })
  }

  setNodeAvailability(id: string, availability: string) {
    return this.commandRequest<Command>(`/api/v1/nodes/${encodeURIComponent(id)}/availability`, {
      method: 'POST',
      body: JSON.stringify({ availability }),
    })
  }

  serviceLogs(id: string, tail = 200) {
    return this.request<{ logs: string }>(`/api/v1/services/${encodeURIComponent(id)}/logs?tail=${tail}`)
  }

  serviceAction(id: string, action: string, replicas?: number) {
    return this.commandRequest<Command>(`/api/v1/services/${encodeURIComponent(id)}/actions`, {
      method: 'POST',
      body: JSON.stringify({ action, replicas }),
    })
  }

  logsCollection(enabled: boolean, confirmation = '') {
    return this.commandRequest<Command>('/api/v1/observability/logs', {
      method: 'POST',
      body: JSON.stringify({ enabled, confirmation }),
    })
  }

  nodeAgentCollection(enabled: boolean, confirmation = '') {
    return this.commandRequest<Command>('/api/v1/observability/node-agent', {
      method: 'POST',
      body: JSON.stringify({ enabled, confirmation }),
    })
  }

  coreObservability(enabled: boolean, confirmation = '') {
    return this.commandRequest<Command>('/api/v1/observability/core', {
      method: 'POST',
      body: JSON.stringify({ enabled, confirmation }),
    })
  }

  async build(file: File, input: { cpus: number; dockerfile: string; image: string; memoryMiB: number; push: boolean }) {
    const headers = new Headers({
      'Content-Type': 'application/x-tar',
      'X-SwarmOps-CPUs': String(input.cpus),
      'X-SwarmOps-Dockerfile': input.dockerfile,
      'X-SwarmOps-Image': input.image,
      'X-SwarmOps-Memory-MiB': String(input.memoryMiB),
      'X-SwarmOps-Push': String(input.push),
    })
    return this.commandRequest<Command>('/api/v1/builds', { method: 'POST', body: file, headers })
  }

  private async commandRequest<T>(path: string, init: RequestInit): Promise<T> {
    const headers = new Headers(init.headers)
    headers.set('Idempotency-Key', newCommandKey())
	headers.set('X-SwarmOps-Cluster-ID', 'default')
    let lastError: unknown
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await this.request<T>(path, { ...init, headers })
      } catch (reason) {
        lastError = reason
        if (attempt === 1 || (reason instanceof APIError && reason.status < 500)) throw reason
        await new Promise((resolve) => window.setTimeout(resolve, 250))
      }
    }
    throw lastError
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers)
    // A caller may name the target explicitly — the command runner does, so an
    // operator can execute against a server other than the one the shell has
    // selected. Only fall back to the shell's selection when it has not.
    if (this.serverID && !headers.has('X-SwarmOps-Server-ID') && path.startsWith('/api/v1/') && !path.startsWith('/api/v1/auth/')) {
      headers.set('X-SwarmOps-Server-ID', this.serverID)
    }
    if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
    if (init.method && init.method !== 'GET' && init.method !== 'HEAD' && this.csrfToken) {
      headers.set('X-CSRF-Token', this.csrfToken)
    }
    const response = await fetch(path, { ...init, credentials: 'same-origin', headers })
    if (response.status === 204) return undefined as T
    const contentType = response.headers.get('content-type') ?? ''
    const payload = contentType.includes('application/json') ? await response.json() as unknown : undefined
    if (!response.ok) {
      const errorPayload = errorDetails(payload)
      const message = errorPayload.error
        ? errorPayload.error
        : `Request failed (${response.status})`
      throw new APIError(message, response.status, errorPayload.detail, errorPayload.requestID ?? response.headers.get('X-Request-Id') ?? undefined)
    }
    return payload as T
  }
}

function errorDetails(payload: unknown): { detail?: string; error?: string; requestID?: string } {
  if (!payload || typeof payload !== 'object') return {}
  const value = payload as Record<string, unknown>
  return {
    detail: typeof value.detail === 'string' ? value.detail : undefined,
    error: typeof value.error === 'string' ? value.error : undefined,
    requestID: typeof value.requestId === 'string' ? value.requestId : undefined,
  }
}

export const api = new SwarmOpsAPI()

function newCommandKey(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID()
  if (typeof globalThis.crypto?.getRandomValues !== 'function') {
    throw new Error('Secure browser randomness is required to queue a command')
  }
  const values = new Uint32Array(4)
  globalThis.crypto.getRandomValues(values)
  return Array.from(values, (value) => value.toString(16).padStart(8, '0')).join('-')
}
