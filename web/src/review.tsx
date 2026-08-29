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

  // Any other mutation is accepted and echoed as a queued command rather than
  // refused: the point is to walk the console, and a dead button teaches
  // nothing about the design.
  if (init?.method && init.method !== 'GET') {
    return json({ action: 'review.noop', attempt: 1, createdAt: new Date().toISOString(), id: `rev-${Date.now()}`, maxAttempts: 1, nodeId: 'n1', state: 'succeeded', target: 'review' })
  }

  if (path in FIXTURES) return json(FIXTURES[path])

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

  // Unmodelled reads answer empty so a screen shows its own empty state rather
  // than an error banner. The shape matters more than it looks: an empty ARRAY
  // is truthy, so returning [] where a page expects a single object sends it
  // past its own `if (!thing)` guard and into `thing.field.length`. Collections
  // get []; everything else gets null, which guards correctly.
  const COLLECTIONS = /\/(containers|images|networks|volumes|configs|secrets|nodes|services|stacks|databases|applications|builds|commands|audit-events|routes|certificates|replicas|connections)$/
  return json(COLLECTIONS.test(path) ? [] : null)
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
