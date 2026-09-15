import type {
  CloudInvoice,
  CloudOrder,
  CloudPlan,
  CloudProject,
  CloudSession,
  CloudTicket,
  CloudTransaction,
  CloudUser,
  CloudWallet,
} from '../data/types'

/** A refusal from the storefront API, with the form field it concerns. */
export class StoreError extends Error {
  constructor(message: string, readonly status: number, readonly field?: string) {
    super(message)
    this.name = 'StoreError'
  }
}

export interface OrderRequest {
  appName: string
  image: string
  note: string
  planCode: string
  port: number
}

/**
 * The customer storefront's client. It talks only to /api/store/v1, whose
 * session cookie is not the operator console's, and it sends the CSRF token
 * the sign-in returned on every change.
 */
export class StoreAPI {
  private csrfToken = ''

  async login(email: string, password: string) {
    const session = await this.request<CloudSession>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
    this.csrfToken = session.csrfToken
    return session
  }

  async me() {
    const session = await this.request<CloudSession>('/auth/me')
    this.csrfToken = session.csrfToken
    return session
  }

  async logout() {
    await this.request<void>('/auth/logout', { method: 'POST' })
    this.csrfToken = ''
  }

  register(email: string, fullName: string, password: string) {
    return this.request<CloudUser>('/auth/register', { method: 'POST', body: JSON.stringify({ email, fullName, password }) })
  }

  plans() { return this.request<CloudPlan[]>('/plans') }
  wallet() { return this.request<{ transactions: CloudTransaction[]; wallet: CloudWallet }>('/wallet') }

  topUp(amountRial: number) {
    // The key stands in for a payment gateway's reference: a retried request
    // carrying the same key credits the wallet only once.
    return this.request<CloudTransaction>('/wallet/topups', {
      method: 'POST',
      body: JSON.stringify({ amountRial }),
      headers: { 'Idempotency-Key': crypto.randomUUID() },
    })
  }

  orders() { return this.request<CloudOrder[]>('/orders') }
  placeOrder(order: OrderRequest) { return this.request<CloudOrder>('/orders', { method: 'POST', body: JSON.stringify(order) }) }
  cancelOrder(id: number) { return this.request<CloudOrder>(`/orders/${id}/cancel`, { method: 'POST' }) }
  projects() { return this.request<CloudProject[]>('/projects') }
  invoices() { return this.request<CloudInvoice[]>('/invoices') }
  invoice(id: number) { return this.request<CloudInvoice>(`/invoices/${id}`) }
  tickets() { return this.request<CloudTicket[]>('/tickets') }
  ticket(id: number) { return this.request<CloudTicket>(`/tickets/${id}`) }

  openTicket(subject: string, body: string, priority: string, projectId: number) {
    return this.request<CloudTicket>('/tickets', { method: 'POST', body: JSON.stringify({ body, priority, projectId, subject }) })
  }

  replyTicket(id: number, body: string) {
    return this.request<CloudTicket>(`/tickets/${id}/replies`, { method: 'POST', body: JSON.stringify({ body }) })
  }

  closeTicket(id: number) { return this.request<CloudTicket>(`/tickets/${id}/close`, { method: 'POST' }) }

  private async request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
    const headers = new Headers(init.headers)
    if (init.body) headers.set('Content-Type', 'application/json')
    const change = Boolean(init.method && init.method !== 'GET')
    if (change && this.csrfToken) headers.set('X-CSRF-Token', this.csrfToken)
    const response = await fetch(`/api/store/v1${path}`, { ...init, credentials: 'same-origin', headers })
    // Signing in from another tab replaces the session cookie, so this page's
    // token can belong to a session that no longer answers. Read the current
    // session's token once and repeat the change only if the token differs;
    // the same Idempotency-Key travels with the repeat.
    if (response.status === 403 && change && retry) {
      const previous = this.csrfToken
      const current = await this.me().catch(() => null)
      if (current && current.csrfToken !== previous) return this.request<T>(path, init, false)
    }
    if (response.status === 204) return undefined as T
    const payload = (response.headers.get('content-type') ?? '').includes('application/json') ? await response.json() as unknown : undefined
    if (!response.ok) {
      const value = (payload && typeof payload === 'object' ? payload : {}) as { error?: unknown; field?: unknown }
      throw new StoreError(typeof value.error === 'string' ? value.error : `Request failed (${response.status})`, response.status,
        typeof value.field === 'string' ? value.field : undefined)
    }
    return payload as T
  }
}
