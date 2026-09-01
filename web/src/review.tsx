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
    return json(sampleRange(parameters.get('scope') ?? 'machine', parameters.get('series') ?? 'cpu'))
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
  const COLLECTIONS = /\/(containers|images|networks|volumes|configs|secrets|nodes|services|stacks|databases|applications|builds|commands|audit-events|routes|certificates|replicas|connections)$/
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

function sampleRange(scope: string, series: string) {
  const unit = series === 'cpu' ? 'ratio'
    : series.startsWith('network') || series.startsWith('disk') || series.startsWith('block') ? 'bytes/s'
      : series === 'requests' || series === 'errors' ? 'req/s'
        : series === 'latency-p95' ? 'seconds' : 'bytes'
  const base = unit === 'ratio' ? 0.55 : unit === 'bytes/s' ? 4.2e7 : unit === 'req/s' ? 410 : unit === 'seconds' ? 0.18 : 22e9
  const to = new Date()
  const from = new Date(to.getTime() - 6 * 3600 * 1000)
  let seed = 0x5eed
  const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)
  const points = Array.from({ length: 72 }, (_, index) => ({
    at: new Date(from.getTime() + index * 300 * 1000).toISOString(),
    value: Math.max(0, base * (0.8 + random() * 0.4)),
  }))
  return { from: from.toISOString(), points, scope, series, source: 'prometheus', stepSeconds: 300, to: to.toISOString(), unit }
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
