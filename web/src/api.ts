import type {
  AuditEvent,
  BuildResult,
  ComposePlan,
  Node,
  ObservabilityStatus,
  Overview,
  Service,
  Session,
  Stack,
  Task,
  TraefikStatus,
} from './types'

export class APIError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
    this.name = 'APIError'
  }
}

export class SwarmOpsAPI {
  private csrfToken = ''

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

  overview() { return this.request<Overview>('/api/v1/overview') }
  nodes() { return this.request<Node[]>('/api/v1/nodes') }
  node(id: string) { return this.request<Node>(`/api/v1/nodes/${encodeURIComponent(id)}`) }
  nodeTasks(id: string) { return this.request<Task[]>(`/api/v1/nodes/${encodeURIComponent(id)}/tasks`) }
  stacks() { return this.request<Stack[]>('/api/v1/stacks') }
  services() { return this.request<Service[]>('/api/v1/services') }
  auditEvents() { return this.request<AuditEvent[]>('/api/v1/audit-events?limit=100') }
  traefik() { return this.request<TraefikStatus>('/api/v1/traefik/status') }
  observability() { return this.request<ObservabilityStatus>('/api/v1/observability/status') }

  reconcileTraefik(confirmation: string) {
    return this.request<void>('/api/v1/traefik/reconcile', {
      method: 'POST',
      body: JSON.stringify({ confirmation }),
    })
  }

  validateStack(compose: string, targetNodeId: string) {
    return this.request<ComposePlan>('/api/v1/stacks/validate', {
      method: 'POST',
      body: JSON.stringify({ compose, targetNodeId }),
    })
  }

  deployStack(name: string, compose: string, targetNodeId: string) {
    return this.request<ComposePlan>('/api/v1/stacks/deploy', {
      method: 'POST',
      body: JSON.stringify({ name, compose, targetNodeId }),
    })
  }

  setNodeAvailability(id: string, availability: string) {
    return this.request<void>(`/api/v1/nodes/${encodeURIComponent(id)}/availability`, {
      method: 'POST',
      body: JSON.stringify({ availability }),
    })
  }

  serviceLogs(id: string, tail = 200) {
    return this.request<{ logs: string }>(`/api/v1/services/${encodeURIComponent(id)}/logs?tail=${tail}`)
  }

  serviceAction(id: string, action: string, replicas?: number) {
    return this.request<void>(`/api/v1/services/${encodeURIComponent(id)}/actions`, {
      method: 'POST',
      body: JSON.stringify({ action, replicas }),
    })
  }

  logsCollection(enabled: boolean, confirmation = '') {
    return this.request<void>('/api/v1/observability/logs', {
      method: 'POST',
      body: JSON.stringify({ enabled, confirmation }),
    })
  }

  coreObservability(enabled: boolean, confirmation = '') {
    return this.request<void>('/api/v1/observability/core', {
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
    return this.request<BuildResult>('/api/v1/builds', { method: 'POST', body: file, headers })
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers)
    if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
    if (init.method && init.method !== 'GET' && init.method !== 'HEAD' && this.csrfToken) {
      headers.set('X-CSRF-Token', this.csrfToken)
    }
    const response = await fetch(path, { ...init, credentials: 'same-origin', headers })
    if (response.status === 204) return undefined as T
    const contentType = response.headers.get('content-type') ?? ''
    const payload = contentType.includes('application/json') ? await response.json() as unknown : undefined
    if (!response.ok) {
      const message = typeof payload === 'object' && payload && 'error' in payload && typeof payload.error === 'string'
        ? payload.error
        : `Request failed (${response.status})`
      throw new APIError(message, response.status)
    }
    return payload as T
  }
}

export const api = new SwarmOpsAPI()
