import { createRoot } from 'react-dom/client'
import { StrictMode } from 'react'
import { NimProvider, ToastProvider } from '@nim.zone/ui'
import { FIXTURES } from './review-fixtures'
import { App } from './app'
import '@nim.zone/ui/styles.css'
import './styles.css'

/* Review build: the REAL app against a stubbed API.
 *
 * Nothing about the console is reproduced here — no shell is rebuilt, no page
 * is re-implemented. App renders exactly as it does in production; only fetch
 * is intercepted, so every screen, route, palette entry and empty state is the
 * shipped one. */
const realFetch = window.fetch.bind(window)

window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.pathname : input.url
  const path = url.startsWith('http') ? new URL(url).pathname : url.split('?')[0]

  if (!path.startsWith('/api/')) return realFetch(input as RequestInfo, init)

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' }, status })

  // The importer is a pure parser server-side, so its response is modelled
  // exactly as internal/k8simport produces it for the manifests below: the
  // Deployment and ClusterIP Service map, the autoscaler is a gap, and the
  // Namespace is skipped rather than counted.
  if (path === '/api/v1/import/kubernetes') {
    return json({
      mappings: [
        { from: 'Deployment/api-gateway', to: 'service api-gateway (replicas: 3)' },
        { from: 'Service/api-gateway', to: 'overlay network alias api-gateway', note: 'Swarm resolves a service by name on its overlay network, so no separate object is needed.' },
      ],
      gaps: [{
        object: 'HorizontalPodAutoscaler/api-gateway',
        why: 'Swarm has no autoscaler. A replica count is a number you set, not a target it pursues.',
        options: 'Set replicas to your observed peak and leave headroom, or keep this workload on Kubernetes.',
      }],
      skipped: ['Namespace/production'],
      compose: [
        'version: "3.9"', '', 'services:', '  api-gateway:',
        '    image: ghcr.io/nimasrn/api-gateway:9f2c1ab', '    ports:', '      - "8080:8080"',
        '    healthcheck:', '      test: ["CMD-SHELL", "curl -fsS http://localhost:8080/healthz"]',
        '      interval: 20s', '    deploy:', '      replicas: 3', '      placement:',
        '        constraints:', '          - node.labels.tier == edge',
        '      resources:', '        limits:', '          memory: 512M', '',
      ].join('\n'),
    })
  }

  // Per-service routes carry an id, so they are matched by shape rather than
  // listed. Diagnosis answers with a chain whose last link is the failing
  // measurement, because a refusal — while honest — shows none of the design.
  if (/^\/api\/v1\/services\/[^/]+\/diagnosis$/.test(path)) {
    const age = (s: number) => new Date(Date.now() - s * 1000).toISOString()
    return json({
      chain: {
        rule: 'node-cannot-hold-image',
        subject: 'api-gateway',
        links: [
          { step: 'observed', claim: 'api-gateway is running 2 of 3 desired tasks.', tone: 'warning', evidence: { label: '2/3 tasks', source: 'swarm manager', observedAt: age(4) } },
          { step: 'because', claim: 'Task 3 has stayed pending for 6 minutes, so this is placement, not a crash.', evidence: { label: 'no restart events', source: 'task history', observedAt: age(4) } },
          { step: 'because', claim: 'No eligible node has room for the image. The roomiest, edge-01, is short by 700 MB.', tone: 'danger', evidence: { label: '1.4 GB free · 2.1 GB required', source: 'read-only host probe · edge-01', observedAt: age(22) } },
          { step: 'because', claim: 'A constraint form this engine does not implement was skipped rather than guessed at.' },
        ],
        actions: [
          { kind: 'prune', label: 'Reclaim space on edge-01', detail: 'Prune images no running or desired task references. The run is recorded in the audit trail.', primary: true },
          { kind: 'reschedule', label: 'Place on another node', detail: 'Move this workload to a node with more room.' },
        ],
        elsewhere: {
          commands: ['kubectl get pods -l app=api-gateway', 'kubectl describe pod <name>', 'kubectl get events --sort-by=.lastTimestamp', 'kubectl describe node edge-01', 'ssh edge-01 df -h', '# then compare free space against the image size by hand'],
          note: 'The last two leave the cluster entirely: node capacity does not include image size, so the comparison is done off-cluster.',
        },
        evidence: [
          { label: '2/3 tasks', source: 'swarm manager', observedAt: age(4) },
          { label: 'no restart events', source: 'task history', observedAt: age(4) },
          { label: '1.4 GB free · 2.1 GB required', source: 'read-only host probe · edge-01', observedAt: age(22) },
        ],
        caveats: ['Disk is the only capacity checked here. A pull can also fail on registry authentication, which cannot be tested without attempting it.'],
      },
    })
  }

  if (/^\/api\/v1\/services\/[^/]+\/change-preview$/.test(path)) {
    return json({
      service: 'api-gateway', from: 'ghcr.io/nimasrn/api-gateway:7c41b8e', to: 'ghcr.io/nimasrn/api-gateway:9f2c1ab',
      consequences: [
        { label: 'Services changed', value: '1', note: 'api-gateway only' },
        { label: 'Tasks replaced', value: '3', note: '1 at a time, as this service is configured' },
        { label: 'Serving during rollout', value: 'yes', note: '2 of 3 tasks keep serving at every point', tone: 'good' },
        { label: 'Sharing this stack', value: '2', note: 'checkout, billing — sharing a stack is evidence of a dependency, not proof of one.', tone: 'caution' },
      ],
      steps: [
        { title: 'Pull api-gateway:9f2c1ab', detail: 'On each node that will run a replacement task.', mark: 'before any stop' },
        { title: 'Replace 1 task', detail: 'Round 1 of the rollout.', mark: '~30s' },
        { title: 'Health gate', detail: 'Swarm watches for 20s before continuing.', mark: 'gate' },
        { title: 'Replace 1 task', detail: 'Round 2 of the rollout.', mark: '~30s' },
        { title: 'Health gate', detail: 'Swarm watches for 20s before continuing.', mark: 'gate' },
        { title: 'Replace 1 task', detail: 'Round 3 of the rollout.', mark: '~30s' },
        { title: 'Converged', detail: 'The previous image is retained for rollback until the next prune.', mark: 'done' },
      ],
      diff: [
        { kind: 'context', text: 'services:' },
        { kind: 'context', text: '  api-gateway:' },
        { kind: 'removed', text: '    image: ghcr.io/nimasrn/api-gateway:7c41b8e' },
        { kind: 'added', text: '    image: ghcr.io/nimasrn/api-gateway:9f2c1ab' },
        { kind: 'context', text: '    deploy:' },
        { kind: 'context', text: '      replicas: 3' },
        { kind: 'context', text: '      placement: node.labels.tier==edge' },
        { kind: 'context', text: '      update: parallelism 1' },
      ],
      rollback: 'On failure Swarm rolls the replaced tasks back to api-gateway:7c41b8e automatically. Nothing proceeds past a failed step.',
      unknowns: [
        'Whether the new image starts cleanly. That is only knowable by running it, which is what the health gate is for.',
        'Registry authentication, which is untested until the first pull.',
      ],
    })
  }

  // The console-domain preview is a READ that happens to be a POST, so it has
  // to answer before the generic mutation echo below: a queued command in
  // place of a plan is a shape the panel would try to render.
  if (path === '/api/v1/core/console/plan') {
    const record = { adopted: false, content: '203.0.113.10', credentialId: 'production-dns', id: 'swarmops-console', managed: true, name: 'swarmops.nim.zone', proxied: false, ttl: 300, type: 'A', version: 1, zone: 'nim.zone' }
    return json({
      address: '203.0.113.10',
      confirmation: 'PUBLISH_SWARMOPS_API',
      host: 'swarmops.nim.zone',
      record,
      recordAction: 'create',
      resolver: 'le',
      restartsController: true,
      route: {
        accessLogs: true, dnsReference: 'swarmops-console', enabled: true,
        health: { kind: 'response', path: '/healthz', timeoutSeconds: 5 },
        key: 'swarmops-console', managed: true,
        match: { hosts: ['swarmops.nim.zone'], pathPrefix: '/' },
        metrics: true, protocol: 'http', publicAllow: true, resolver: 'le',
        scope: 'public', sensitive: true, serviceKey: 'swarmops_api',
        targetPort: 8084, tls: 'terminate', version: 1,
      },
      url: 'https://swarmops.nim.zone/',
      version: 1,
      warnings: ['Applying this replaces the controller task so it receives the route labels; the console is briefly unavailable and reconnects on the new name.'],
    })
  }

  if (path === '/api/v1/applications/plan' && init?.method === 'POST') {
    const spec = JSON.parse(String(init.body)) as {name: string; image: string; replicas: number}
    return json({ compose: `# Local review fixture only\nservices:\n  ${spec.name}:\n    image: ${spec.image}\n    deploy:\n      replicas: ${spec.replicas}\n` })
  }

  // Any other mutation is accepted and echoed as a queued command rather than
  // refused: the point is to walk the console, and a dead button teaches
  // nothing about the design.
  if (init?.method && init.method !== 'GET') {
    return json({ action: 'review.noop', attempt: 1, createdAt: new Date().toISOString(), id: `rev-${Date.now()}`, maxAttempts: 1, nodeId: 'n1', state: 'succeeded', target: 'review' })
  }

  // A machine's own measurements. Real shape, real absences: web-01 reports a
  // host it cannot measure CPU on, which is how a macOS or unprivileged agent
  // actually answers.
  const machineMetrics = path.match(/^\/api\/v1\/machines\/([^/]+)\/metrics$/)
  if (machineMetrics) return json(sampleMachineMetrics(machineMetrics[1]!))

  // A named reading. The harness answers with a walk so the chart, its units
  // and its provenance line are all exercised; `source` is what the console
  // reads to decide whether it may draw at all.
  if (path === '/api/v1/metrics/range') {
    const parameters = new URL(url, 'http://local').searchParams
    return json(sampleRange(parameters.get('scope') ?? 'machine', parameters.get('series') ?? 'cpu', parameters.get('from'), parameters.get('to')))
  }

  // The reading vocabulary. The harness answers it from the same table the
  // controller keeps, so the chart grids draw every series a scope has rather
  // than the handful a screen used to name by hand.
  if (path === '/api/v1/metrics/series') {
    const scope = new URL(url, 'http://local').searchParams.get('scope') ?? 'machine'
    const vocabulary: Record<string, string[]> = {
      application: ['errors', 'latency-p95', 'requests'],
      cluster: ['containers', 'cpu', 'machines', 'memory', 'memory-total', 'network-rx', 'network-tx'],
      container: ['block-read', 'block-write', 'cpu', 'memory', 'memory-limit', 'network-rx', 'network-tx'],
      gateway: ['bytes-out', 'errors', 'latency-p95', 'requests'],
      machine: ['containers', 'cpu', 'cpu-iowait', 'disk-read', 'disk-write', 'load', 'memory', 'memory-total', 'network-rx', 'network-tx'],
    }
    const series = vocabulary[scope]
    if (!series) return json({ error: 'Unknown metric scope' }, 422)
    return json({ scope, series })
  }

  // Single-object inspectors. Each answers from the list fixture so the sheet
  // shows the object the row named, and 404s otherwise rather than inventing
  // one.
  const volumeRead = path.match(/^\/api\/v1\/volumes\/([^/]+)$/)
  if (volumeRead && init?.method !== 'POST') {
    return json({
      CreatedAt: new Date(Date.now() - 86400000).toISOString(),
      Driver: 'local',
      Labels: {},
      Mountpoint: `/var/lib/docker/volumes/${volumeRead[1]}/_data`,
      Name: volumeRead[1],
      Options: {},
      Scope: 'local',
      UsageData: { RefCount: 1, Size: 2.4e9 },
    })
  }

  const networkRead = path.match(/^\/api\/v1\/networks\/([^/]+)$/)
  if (networkRead && init?.method !== 'POST') {
    return json({
      Attachable: true,
      Containers: { c1: { EndpointID: 'e1', IPv4Address: '10.0.1.4/24', Name: 'production_checkout-api.1' } },
      Created: new Date(Date.now() - 604800000).toISOString(),
      Driver: 'overlay',
      Id: networkRead[1],
      IPAM: { Config: [{ Gateway: '10.0.1.1', Subnet: '10.0.1.0/24' }] },
      Ingress: false,
      Internal: false,
      Name: 'production',
      Scope: 'swarm',
    })
  }

  const imageRead = path.match(/^\/api\/v1\/images\/([^/]+)$/)
  if (imageRead && init?.method !== 'POST') {
    return json({
      Architecture: 'arm64',
      Created: new Date(Date.now() - 172800000).toISOString(),
      Id: imageRead[1],
      Os: 'linux',
      RepoDigests: ['ghcr.io/example/checkout@sha256:9f2c1ab0000000000000000000000000000000000000000000000000000000ab'],
      RepoTags: ['ghcr.io/example/checkout:1.8.4'],
      RootFS: { Layers: ['sha256:aa', 'sha256:bb', 'sha256:cc'], Type: 'layers' },
      Size: 184e6,
    })
  }

  const containerRead = path.match(/^\/api\/v1\/containers\/([^/]+)(\/stats)?$/)
  if (containerRead) {
    const id = containerRead[1]
    const containers = FIXTURES['/api/v1/containers'] as { Id: string; Names: string[]; Image: string }[]
    const container = containers.find(item => item.Id === id)
    if (!container) return json({ error: 'Container not found in review fixture' }, 404)
    if (containerRead[2]) return json({ id, sampledAt: new Date().toISOString(), cpuPercent: 18.4, memoryUsedBytes: 310e6, memoryLimitBytes: 512e6, memoryPercent: 60.5, networkRxBytes: 4e6, networkTxBytes: 2e6, blockReadBytes: 0, blockWriteBytes: 0, pidsCurrent: 8 })
    return json({ Id: id, Name: container.Names[0], Image: container.Image, Config: { Image: container.Image, EnvNames: ['PORT'], Labels: {} }, Created: new Date(Date.now() - 86400000).toISOString(), HostConfig: { NetworkMode: 'production', RestartPolicy: { Name: 'unless-stopped', MaximumRetryCount: 0 } }, RestartCount: 0, State: { Running: true, Status: 'running', ExitCode: 0, StartedAt: new Date(Date.now() - 3600000).toISOString() }, Mounts: [] })
  }

  const since = (seconds: number) => new Date(Date.now() - seconds * 1000).toISOString()
  if (path === '/api/v1/core/self') {
    return json({
      architecture: 'arm64', hostname: 'nima-mbp', inCluster: false, os: 'darwin',
      releases: [
        { installedAt: since(1036800), running: true, sizeBytes: 38e6, version: 'v0.11.0' },
        { installedAt: since(1900800), running: false, sizeBytes: 37e6, version: 'v0.10.4' },
        { installedAt: since(3024000), running: false, sizeBytes: 37e6, version: 'v0.10.3' },
      ],
      startedAt: since(1036800),
      storage: { freeBytes: 84e9, path: '/var/lib/swarmops', totalBytes: 480e9, usedBytes: 412e6 },
      update: { automatic: false, available: 'v0.11.1', checkedAt: since(21600), configured: true, state: 'up_to_date' },
      uptimeSeconds: 1036800, version: 'v0.11.0',
    })
  }

  if (path in FIXTURES) return json(FIXTURES[path])

  // Unmodelled reads answer empty so a screen shows its own empty state rather
  // than an error banner. The shape matters more than it looks: an empty ARRAY
  // is truthy, so returning [] where a page expects a single object sends it
  // past its own `if (!thing)` guard and into `thing.field.length`. Collections
  // get []; everything else gets null, which guards correctly.
  const COLLECTIONS = /\/(containers|images|networks|volumes|configs|secrets|nodes|services|stacks|databases|applications|builds|commands|audit-events|routes|certificates|replicas|connections|tasks|events|logs|history)$/
  return json(COLLECTIONS.test(path) ? [] : null)
}

function sampleMachineMetrics(id: string) {
  const cores = 8
  // The second machine deliberately cannot measure its own CPU. An operator
  // has to be able to see the difference between "idle" and "not measured",
  // and the review build is where that gets checked.
  const measurable = id !== 'srv-2'
  return {
    collectedAt: new Date().toISOString(),
    containers: [
      { blockReadBytes: 1e6, blockWriteBytes: 4.2e6, cpuUsageSeconds: 1204.5, cpuUsedRatio: 0.184, id: 'c1f2a3b4c5d6', image: 'ghcr.io/nimasrn/checkout:41ab77c', memoryLimitBytes: 2147483648, memoryUsedBytes: 2040109465, name: 'production_checkout.1', processes: 42, receivedBytes: 8.1e8, restartCount: 0, sentBytes: 4.4e8, service: 'production_checkout', stack: 'production', state: 'running', taskSlot: '1' },
      { blockReadBytes: 2e5, blockWriteBytes: 1e5, cpuUsageSeconds: 4.2, cpuUsedRatio: -1, id: 'd2e3f4a5b6c7', image: 'traefik:v3.6', memoryLimitBytes: 0, memoryUsedBytes: 96e6, name: 'traefik.1', processes: 11, receivedBytes: 2e7, restartCount: 0, sentBytes: 3e7, state: 'running' },
      { blockReadBytes: 0, blockWriteBytes: 0, cpuUsageSeconds: 88.1, cpuUsedRatio: 0.04, id: 'a9b8c7d6e5f4', image: 'ghcr.io/nimasrn/worker:41ab77c', memoryLimitBytes: 536870912, memoryUsedBytes: 310e6, name: 'production_worker.3', processes: 8, receivedBytes: 4e6, restartCount: 2, sentBytes: 2e6, service: 'production_worker', stack: 'production', state: 'running', taskSlot: '3' },
    ],
    dockerAvailable: true,
    host: {
      cpuCores: cores,
      cpuIoWaitRatio: measurable ? 0.02 : -1,
      cpuUsedRatio: measurable ? 0.61 : -1,
      disks: [{ device: 'nvme0n1', readBytes: 8.1e9, writeBytes: 4.1e9 }],
      filesystems: [
        { availableBytes: 292e9, device: '/dev/nvme0n1p2', fstype: 'ext4', mount: '/', totalBytes: 480e9, usedBytes: 188e9 },
        { availableBytes: 9e9, device: '/dev/nvme0n1p3', fstype: 'xfs', mount: '/var/lib/docker', totalBytes: 200e9, usedBytes: 191e9 },
      ],
      interfaces: [{ name: 'ens3', receivedBytes: 9.1e10, sentBytes: 4.1e10 }],
      load1: 4.9, load5: 4.4, load15: 3.8,
      memoryAvailableBytes: 9.9e9, memoryTotalBytes: 34.3e9, memoryUsedBytes: 24e9,
      processCount: 314, swapTotalBytes: 2e9, swapUsedBytes: 0,
      uptimeSeconds: 2937600,
    },
  }
}

function sampleRange(scope: string, series: string, start: string | null, end: string | null) {
  const unit = series === 'cpu' ? 'ratio'
    : series.startsWith('network') || series.startsWith('disk') || series.startsWith('block') ? 'bytes/s'
      : series === 'requests' || series === 'errors' ? 'req/s'
        : series === 'latency-p95' ? 'seconds' : 'bytes'
  // Synthetic review values, never an operational measurement. Keep failures
  // distinct from total requests so the preview does not suggest 100% failure.
  const base = series === 'errors' ? 0.4 : unit === 'ratio' ? 0.55 : unit === 'bytes/s' ? 4.2e7 : unit === 'req/s' ? 410 : unit === 'seconds' ? 0.18 : 22e9
  const to = end ? new Date(end) : new Date()
  const from = start ? new Date(start) : new Date(to.getTime() - 6 * 3600 * 1000)
  const stepSeconds = (to.getTime() - from.getTime()) / 1000 / 71
  let seed = 0x5eed
  const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)
  const points = Array.from({ length: 72 }, (_, index) => ({
    at: new Date(from.getTime() + index * stepSeconds * 1000).toISOString(),
    value: Math.max(0, base * (0.8 + random() * 0.4)),
  }))
  return { from: from.toISOString(), points, scope, series, source: 'prometheus', stepSeconds, to: to.toISOString(), unit }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <NimProvider defaultColorway="malachite" defaultScheme="light" defaultStyle="console">
      <ToastProvider>
        <App />
      </ToastProvider>
    </NimProvider>
  </StrictMode>,
)
