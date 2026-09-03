/* A stubbed SwarmOps API.
 *
 * This intercepts fetch so the REAL app — its router, its shell, every one of
 * its screens — runs with no controller behind it. Nothing here is a mock of a
 * component: the console is the shipped console, and only the data is invented.
 *
 * The cluster it describes is deliberately awkward rather than pristine. One
 * host is silent, one action has stalled twice, the gateway is absent and no
 * collectors are installed, because a review against a perfect fixture only
 * ever shows the happy path — and the whole argument of this redesign is what
 * the console does when it cannot see something.
 */
const now = () => new Date().toISOString()
const ago = (s: number) => new Date(Date.now() - s * 1000).toISOString()

const cap = (used: number, capacity: number) =>
  ({ available: capacity - used, capacity, percent: capacity ? (used / capacity) * 100 : 0, used })

const nodes = [
  {
    address: '10.0.0.11', agent: { healthy: true, collectedAt: ago(22), version: '0.10.3' },
    availability: 'active', cpu: cap(0, 8), disk: cap(28e9, 40e9),
    dockerVersion: '29.7.1', engine: { version: '29.7.1', driver: 'overlay2', cgroupDriver: 'systemd', apiVersion: '1.51' },
    hostname: 'edge-01', id: 'n1', kernel: '6.8.0-51-generic', labels: { tier: 'edge' },
    load1: 0.42, manager: { address: '10.0.0.11:2377', leader: true, reachability: 'reachable' },
    memory: cap(12.1e9, 32e9), os: 'Ubuntu 24.04.1 LTS', platform: { architecture: 'x86_64', os: 'linux' },
    role: 'manager', state: 'ready', uptimeSeconds: 812400,
  },
  {
    address: '10.0.0.12', agent: { healthy: false, error: 'no poll received in 4m' },
    availability: 'active', cpu: cap(0, 8), disk: cap(0, 0), engine: {},
    hostname: 'worker-02', id: 'n2', labels: {}, memory: cap(0, 0), platform: {},
    role: 'worker', state: 'ready',
  },
]

const services = [
  { createdAt: ago(864000), desiredTasks: 3, health: 'degraded', id: 's1', image: 'ghcr.io/nimasrn/api-gateway:9f2c1ab', mode: 'replicated', name: 'api-gateway', runningTasks: 2, stack: 'production', updatedAt: ago(400), updateState: 'updating' },
  { createdAt: ago(1728000), desiredTasks: 1, health: 'healthy', id: 's2', image: 'ghcr.io/nimasrn/checkout:41ab77c', mode: 'replicated', name: 'checkout', runningTasks: 1, stack: 'production', updatedAt: ago(90000) },
  { createdAt: ago(2592000), desiredTasks: 2, health: 'healthy', id: 's3', image: 'ghcr.io/nimasrn/billing:7c41b8e', mode: 'replicated', name: 'billing', runningTasks: 2, stack: 'production', updatedAt: ago(260000) },
]

const overview = {
  generatedAt: now(), health: 'degraded', nodes, services,
  summary: {
    managers: 1, nodes: 2, readyNodes: 2, runningTasks: 5, serviceHealth: 'degraded', services: 3,
    totalCpu: cap(0, 16), totalDisk: cap(28e9, 40e9), totalMemory: cap(12.1e9, 32e9),
  },
}

const commands = [
  { action: 'traefik.reconcile', actor: 'operator', attempt: 1, authorityEpoch: 1, createdAt: ago(300), failureCode: 'traefik_port_unavailable', failureSummary: 'Docker could not start Traefik because a configured gateway port is already in use.', id: 'cmd-1', lastAttemptAt: ago(280), maxAttempts: 8, nodeId: 'n1', recoveryHint: 'Inspect the selected manager for an existing gateway using ports 80 or 443, resolve the conflict, then retry.', serverId: 'srv-1', state: 'needs_attention', target: 'stack/traefik', updatedAt: ago(280) },
  { action: 'observability.logs', attempt: 2, createdAt: ago(1200), failureSummary: 'The managed Traefik gateway is required before this stack can create private routes.', id: 'cmd-2', maxAttempts: 5, nodeId: 'n1', state: 'failed', target: 'production' },
  { action: 'service.image', attempt: 1, createdAt: ago(60), id: 'cmd-3', maxAttempts: 3, nodeId: 'n1', state: 'running', target: 'api-gateway' },
  { action: 'prune', attempt: 1, createdAt: ago(7200), completedAt: ago(7180), id: 'cmd-4', maxAttempts: 3, nodeId: 'n1', state: 'succeeded', target: 'cluster/images' },
]

/** Anything not listed answers empty rather than 404, so a screen this fixture
 *  does not model renders its own empty state instead of an error — which is
 *  itself worth seeing. */
export const FIXTURES: Record<string, unknown> = {
  '/api/v1/auth/me': { csrfToken: 'review', user: { username: 'admin' } },
  '/api/v1/core': {
    activeId: 'core-1', authorityEpoch: 4, controlEnabled: true, localId: 'core-1', localRole: 'active',
    members: [{ endpoint: 'https://core.nim.zone', id: 'core-1', name: 'core-1', replicaState: 'verified', role: 'active' }],
  },
  // Two enrolled machines, described the way the controller actually
  // describes them. This fixture used to carry a `kind` field the API does not
  // have and no `connectionType`, so every screen read the profile as a legacy
  // SSH server and rendered "undefined:undefined" for its endpoint — a defect
  // in the harness that looked exactly like a defect in the product.
  '/api/v1/servers': [
    {
      agentHealth: { agentVersion: 'v0.11.0', checkedAt: ago(4), protocolVersion: 2, state: 'healthy', summary: 'Outbound poll received 4s ago', uptimeSeconds: 1036800 },
      authentication: 'mutual_tls', connectionState: 'connected', connectionType: 'agent_pull',
      dockerAvailable: true, dockerVersion: '27.3.1', host: '10.0.0.11', hostKeyFingerprint: '', id: 'srv-1',
      lastConnectedAt: ago(4), name: 'node-1', port: 9180, swarmControlAvailable: true, swarmState: 'active', username: '',
    },
    {
      // Two releases behind, which is what makes the fleet-wide agent view
      // worth having: this machine answers and still refuses newer commands.
      agentHealth: { agentVersion: 'v0.10.4', checkedAt: ago(9), protocolVersion: 2, state: 'healthy', summary: 'Outbound poll received 9s ago', uptimeSeconds: 1814400 },
      authentication: 'mutual_tls', connectionState: 'connected', connectionType: 'agent_pull',
      dockerAvailable: true, dockerVersion: '27.3.1', host: '10.0.0.21', hostKeyFingerprint: '', id: 'srv-2',
      lastConnectedAt: ago(9), name: 'web-01', port: 9180, swarmControlAvailable: false, swarmState: 'active', username: '',
    },
  ],
  '/api/v1/overview': overview,
  '/api/v1/nodes': nodes,
  '/api/v1/services': services,
  '/api/v1/stacks': [{ health: 'degraded', name: 'production', runningTasks: 5, serviceCount: 3, updatedAt: ago(400) }],
  '/api/v1/commands': commands,
  '/api/v1/observability/status': { agentHealthy: true, agentInstalled: true, coreHealthy: false, coreInstalled: false, logsEnabled: false, logsHealthy: false },
  '/api/v1/traefik/status': { service: null },
  '/api/v1/diagnosis/rules': { rules: ['constraint-unsatisfiable', 'node-cannot-hold-image', 'task-failing'] },
  '/api/v1/containers': [
    { Id: 'c1f2a3b4c5d6', Names: ['/production_api-gateway.1'], Image: 'ghcr.io/nimasrn/api-gateway:9f2c1ab', State: 'running', Status: 'Up 4 minutes', Created: Date.now() / 1000 - 240, NetworkSettings: { Networks: { production: {} } } },
    { Id: 'd2e3f4a5b6c7', Names: ['/production_checkout.1'], Image: 'ghcr.io/nimasrn/checkout:41ab77c', State: 'running', Status: 'Up 25 hours', Created: Date.now() / 1000 - 90000, NetworkSettings: { Networks: { production: {} } } },
  ],
  '/api/v1/images': [
    { Id: 'sha256:9f2c1ab', RepoTags: ['ghcr.io/nimasrn/api-gateway:9f2c1ab'], Size: 2.1e9, Created: Date.now() / 1000 - 400, Containers: 1 },
    { Id: 'sha256:7c41b8e', RepoTags: ['ghcr.io/nimasrn/api-gateway:7c41b8e'], Size: 2.0e9, Created: Date.now() / 1000 - 900000, Containers: 0 },
  ],
  // Traffic reads this as `state.settings.dashboardHost` with the optional
  // chain on `state` only, so an absent `settings` white-screens the whole
  // area. Supplied in full here; the missing guard is noted for the owner.
  '/api/v1/traefik/state': {
    bindings: [], certificates: [], credentials: [], declarations: [], dnsRecords: [], domains: [],
    routes: [], runtime: [], version: 1,
    settings: {
      acmeEmail: 'ops@nim.zone', accessLogs: true, dashboardHost: 'traefik.nim.zone',
      entryPoints: [], metricsEnabled: true, operationalLog: 'INFO',
      portRange: { end: 32767, start: 30000 }, resolvers: [], version: 1,
    },
  },
  '/api/v1/traefik/settings': {
    acmeEmail: 'ops@nim.zone', accessLogs: true, dashboardHost: 'traefik.nim.zone',
    entryPoints: [], metricsEnabled: true, operationalLog: 'INFO',
    portRange: { end: 32767, start: 30000 }, resolvers: [], version: 1,
  },
  '/api/v1/traefik/routes': [],
  // Null, not []: an empty array is truthy, so the page's `!cutover` guard
  // passes and it reads `cutover.blockers` on an object that has none.
  '/api/v1/traefik/cutover': null,
  '/api/v1/traefik/certificates': [],
  '/api/v1/traefik/prometheus': { installed: false },
  // `ready` is false only when a REQUIRED check is blocked — see
  // FinalizeTraefikInstallPreflight. A fixture with no checks and ready:false
  // cannot come from a real controller, and made the panel render a state the
  // product does not have.
  '/api/v1/traefik/preflight': {
    challenge: 'http-01',
    checks: [
      { detail: 'The reviewed swarmops overlay network is absent on this manager.', fixable: true, id: 'network', label: 'Overlay network', recovery: 'SwarmOps creates it during the repair.', required: true, state: 'blocked' },
      { detail: 'Created from the reviewed asset when the gateway is installed.', fixable: true, id: 'config', label: 'Static configuration', required: true, state: 'automatic' },
    ],
    ready: false,
    repairable: true,
  },
  '/api/v1/logs/status': { collectors: [], enabled: false },
  '/api/v1/insights': null,
  '/api/v1/commands/catalogue': [],
  '/api/v1/databases': [],
  '/api/v1/applications': [
    { deployed: true, runningTasks: 3, service: 'production_checkout-api', stack: 'production', url: 'https://checkout.example.test', spec: { name: 'checkout-api', image: 'ghcr.io/example/checkout:1.8.4', cpus: 0.5, memoryMiB: 512, port: 8080, replicas: 3, healthPath: '/healthz', domain: 'checkout.example.test', resolver: 'le', metrics: true, metricsPath: '/metrics', tracing: false, databases: ['postgres'], databaseDelivery: 'secret' } },
    { deployed: true, runningTasks: 1, service: 'production_api-gateway', stack: 'production', spec: { name: 'api-gateway', image: 'ghcr.io/example/gateway:2.1.0', cpus: 1, memoryMiB: 1024, port: 8080, replicas: 2, healthPath: '/healthz', metrics: false } },
  ],
  '/api/v1/applications/approved': [
    { name: 'checkout-api', profile: 'application', domain: 'checkout.example.test', resolver: 'le', cpuCores: 2, memoryMiB: 4096 },
    { name: 'api-gateway', profile: 'application', domainOptional: true, cpuCores: 2, memoryMiB: 4096 },
  ],
  // Without this the deploy screen reports a failed capability read — which is
  // correct behaviour and exactly what it did before this fixture existed.
  '/api/v1/sources/status': { buildEnabled: true, enabled: true, imagePrefixConfigured: true, privateHostsConfigured: false },
  '/api/v1/sources/connections': [],
  '/api/v1/builds': [],
  '/api/v1/volumes': [],
  '/api/v1/networks': [],
  '/api/v1/configs': [],
  '/api/v1/secrets': [],
  '/api/v1/audit-events': [
    { action: 'service.image', actor: 'admin', id: 'a1', occurredAt: ago(60), outcome: 'accepted' },
    { action: 'prune', actor: 'admin', id: 'a2', occurredAt: ago(7200), outcome: 'succeeded' },
  ],
}
