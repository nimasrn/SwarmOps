import type {
  AuditEvent,
  Command,
  ComposePlan,
  FleetRun,
  Node,
  ObservabilityStatus,
  Overview,
  Service,
  Server,
  ServerCredentials,
  ServerInput,
  ServerReconnectInput,
  Session,
  Stack,
  Task,
  TraefikStatus,
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

  overview() { return this.request<Overview>('/api/v1/overview') }
  nodes() { return this.request<Node[]>('/api/v1/nodes') }
  node(id: string) { return this.request<Node>(`/api/v1/nodes/${encodeURIComponent(id)}`) }
  nodeTasks(id: string) { return this.request<Task[]>(`/api/v1/nodes/${encodeURIComponent(id)}/tasks`) }
  fleetRun(id: string) { return this.request<FleetRun>(`/api/v1/fleet/runs/${encodeURIComponent(id)}`) }
  stacks() { return this.request<Stack[]>('/api/v1/stacks') }
  services() { return this.request<Service[]>('/api/v1/services') }
  auditEvents() { return this.request<AuditEvent[]>('/api/v1/audit-events?limit=100') }
  commands() { return this.request<Command[]>('/api/v1/commands?limit=100') }
  command(id: string) { return this.request<Command>(`/api/v1/commands/${encodeURIComponent(id)}`) }
  retryCommand(id: string) { return this.request<Command>(`/api/v1/commands/${encodeURIComponent(id)}/retry`, { method: 'POST' }) }
  traefik() { return this.request<TraefikStatus>('/api/v1/traefik/status') }
  observability() { return this.request<ObservabilityStatus>('/api/v1/observability/status') }

  reconcileTraefik(confirmation: string) {
    return this.commandRequest<Command>('/api/v1/traefik/reconcile', {
      method: 'POST',
      body: JSON.stringify({ confirmation }),
    })
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
    if (this.serverID && path.startsWith('/api/v1/') && !path.startsWith('/api/v1/auth/')) {
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
