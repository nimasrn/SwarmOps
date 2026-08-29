import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = (name) => readFile(new URL(name, import.meta.url), 'utf8')

test('the information architecture is one source, and every screen is reachable from it', async () => {
  const [nav, app] = await Promise.all([source('navigation.ts'), source('app.tsx')])

  // Areas are named for the operator's job, not the system's object model.
  for (const area of ['Overview', 'Deliver', 'Fleet', 'Workloads', 'Traffic', 'Observe', 'Activity', 'Control']) {
    assert.match(nav, new RegExp(`label: '${area}'`))
  }

  // Every screen the console can route to must appear in an area. A screen
  // with a title and no group is the bug this file exists to catch:
  // `agent-diagnostics` had both a label and a section for three releases and
  // could not be opened from navigation at all.
  const declared = [...nav.matchAll(/key: '([a-z-]+)', label:/g)].map((match) => match[1])
  for (const destination of ['agent-diagnostics', 'applications', 'audit', 'builds', 'catalogue', 'commands', 'core', 'databases', 'dns', 'gateway', 'insights', 'logs', 'nodes', 'observability', 'overview', 'provisioning', 'registry', 'resources', 'routes', 'servers', 'services', 'source-deploy', 'stacks', 'tls']) {
    assert.ok(declared.includes(destination), `${destination} is routable but appears in no area`)
  }

  // Every page carries the one line that says what decision it serves; the
  // contextual sidebar and the palette both read it.
  assert.equal(declared.length, [...nav.matchAll(/summary: '/g)].length - 8, 'each page needs a summary and each of the 8 areas needs one too')

  assert.match(app, /navigation="rail"/)
  assert.match(app, /contextualGroups=\{contextualGroups\}/)
  assert.match(app, /groups=\{areaGroups\}/)
  // Both tiers are built from AREAS, so they cannot disagree.
  assert.match(app, /items: AREAS\.map/)
  assert.match(app, /items: area\.pages\.map/)
})

test('deploying is a first-class area, not a setting', async () => {
  const nav = await source('navigation.ts')
  const deliver = nav.slice(nav.indexOf("label: 'Deliver'"), nav.indexOf("label: 'Fleet'"))
  // Source deployment, applications, builds and the registry used to be split
  // between "Settings" and "Workloads" — the act of shipping was filed under
  // configuration. The whole path is one area now, and deploying opens it.
  for (const page of ['source-deploy', 'applications', 'builds', 'registry']) {
    assert.match(deliver, new RegExp(`key: '${page}'`))
  }
  assert.match(nav, /key: 'source-deploy', label: 'Deploy from source'/)
  const control = nav.slice(nav.indexOf("label: 'Control'"), nav.indexOf('export const PAGES'))
  assert.doesNotMatch(control, /source-deploy|registry/)
})

test('the palette runs actions, not only navigation', async () => {
  const [palette, app] = await Promise.all([source('palette.tsx'), source('app.tsx')])
  for (const action of ['Deploy from source', 'Add a server', 'Refresh this screen', 'Diagnose a connection', 'Sign out']) {
    assert.match(palette, new RegExp(`label: '${action}'`))
  }
  // Switching the target cluster is the change most likely to be made from the
  // keyboard mid-incident, so each manager is its own row.
  assert.match(palette, /Point the console at \$\{server\.name\}/)
  assert.match(palette, /group: `Go to · \$\{area\.label\}`/)
  // The chord belongs to the app, never to the kit.
  assert.match(app, /event\.key\.toLowerCase\(\) === 'k'/)
  assert.match(app, /<CommandPalette/)
  assert.doesNotMatch(app, /<Combobox/)
})

test('catalog actions open a sheet and activity/resources expose working filters', async () => {
  const [inventory, app] = await Promise.all([source('inventory.tsx'), source('app.tsx')])
  assert.match(inventory, /<Sheet closeLabel="Close action review"/)
  assert.match(inventory, />Review action<\/Button>/)
  assert.match(inventory, /label="Search actions"/)
  assert.match(inventory, /label="Search containers"/)
  assert.match(app, /aria-label="Search runs"/)
  assert.match(app, /Last 24 hours/)
})

test('readiness presents one reviewed fix at a time instead of a switch plan', async () => {
  const readiness = await source('server-readiness.tsx')
  assert.match(readiness, /title="Setup checks"/)
  assert.match(readiness, /Start single-server cluster/)
  assert.match(readiness, /<Sheet closeLabel="Close setup review"/)
  assert.doesNotMatch(readiness, /<Switch/)
  assert.doesNotMatch(readiness, /Review and queue/)
})

test('gateway and source dead ends have explicit setup actions', async () => {
  const [api, gateway, sourceDeploy] = await Promise.all([source('api.ts'), source('traefik-page.tsx'), source('source-deploy.tsx')])
  assert.match(gateway, />Install gateway<\/Button>/)
  assert.match(gateway, /Cloudflare and ArvanCloud/)
  assert.match(gateway, /Not managed by SwarmOps/)
  assert.match(gateway, /host-native or Docker Compose proxies/)
  assert.match(gateway, /another process already binds the configured HTTP or HTTPS ports/)
  assert.match(gateway, /api\.waitForCommand\(command\.id/)
  assert.match(gateway, /title="Gateway installation blocked"/)
  assert.match(gateway, /title="Gateway installation needs attention"/)
  assert.match(gateway, /title="Installation prerequisites"/)
  assert.match(gateway, /label="Dashboard hostname"/)
  assert.match(gateway, /normalizeDashboardHostname\(dashboardHost\)/)
  assert.match(gateway, /DNS provider credentials are optional/)
  assert.match(gateway, /SwarmOps renders HTTP-01 automatically/)
  assert.match(gateway, /!preflight\?\.ready/)
  assert.match(gateway, />Open run details<\/Button>/)
  assert.match(api, /JSON\.stringify\(\{ confirmation, dashboardHost \}\)/)
  assert.match(sourceDeploy, />Configure source deployment<\/Button>/)
  assert.match(sourceDeploy, />Configure registry<\/Button>/)
  assert.match(sourceDeploy, /Hosted GitHub \/ GitLab/)
})

test('gateway, routes, DNS, and certificates are separate operator destinations', async () => {
  const [nav, gateway] = await Promise.all([source('navigation.ts'), source('traefik-page.tsx')])
  assert.match(nav, /key: 'gateway', label: 'Gateway & ports'/)
  assert.match(nav, /key: 'routes', label: 'Routes'/)
  assert.match(nav, /key: 'dns', label: 'DNS providers'/)
  assert.match(nav, /key: 'tls', label: 'TLS certificates'/)
  assert.match(gateway, /scope="gateway"/)
  assert.match(gateway, /scope="dns"/)
})

test('controller recovery UI does not expose the internal Core name', async () => {
  const topology = await source('core-topology.tsx')
  for (const oldLabel of ['Open Core logs', 'Move Core', 'Core identity', 'Core members', 'Install new Core standby']) {
    assert.doesNotMatch(topology, new RegExp(oldLabel))
  }
  assert.match(topology, /title="Controller"/)
  assert.match(topology, /Controller members/)
})

test('background refreshes preserve the current workspace and loaded content', async () => {
  const [app, logs] = await Promise.all([source('app.tsx'), source('logs-page.tsx')])
  assert.match(app, /sessionStorage\.getItem\(SELECTED_SERVER_KEY\)/)
  assert.match(app, /servers\.some\(\(server\) => server\.id === activeServerID\)/)
  assert.doesNotMatch(app, /commandsLoading \? <LoadingScreen/)
  assert.doesNotMatch(app, /auditLoading \? <LoadingScreen/)
  assert.match(app, /commandsInitialLoading \? <LoadingScreen/)
  assert.match(logs, /loading && !page \? <Spinner/)
})

test('runs explain observability failures and block unsafe retries', async () => {
  const app = await source('app.tsx')
  assert.match(app, /title="Why this needs attention"/)
  assert.match(app, /The SwarmOps-managed Traefik gateway is not installed/)
  assert.match(app, /nim\.stateful=true placement label/)
  assert.match(app, /Resolve prerequisites before retrying/)
  assert.match(app, />Gateway setup<\/Button>/)
  assert.match(app, />Agent diagnostics<\/Button>/)
  assert.match(app, /command\.failureSummary \?\? command\.lastError/)
})

test('the command center verdict answers to the blockers listed under it', async () => {
  const home = await source('home.tsx')

  // The hero read a green "Production is operating" while rows beneath it were
  // marked Blocking, because the verdict was computed without reference to
  // them. A standing verdict that contradicts its own evidence is one
  // operators learn to stop reading.
  assert.match(home, /const blocked = attention\.filter\(\(item\) => item\.tone === 'danger'\)\.length/)
  assert.match(home, /const operating = serving && blocked === 0/)

  // Serving and unblocked are different claims, and the hero states which.
  assert.match(home, /Production is serving, and \$\{blocked\} operation/)
  assert.doesNotMatch(home, /title=\{operating \? 'Production is operating' : 'Production evidence is incomplete'\}/)
})

test('one stalled action is one decision, however many times it was attempted', async () => {
  const home = await source('home.tsx')

  // A failed operation and its failed retry are two records and one decision.
  // Listing both produced two identical rows and a count that said "2 open
  // decisions" when there was one.
  assert.match(home, /const byAction = new Map/)
  assert.match(home, /id: `command-\$\{command\.action\}`/)
  assert.doesNotMatch(home, /id: `command-\$\{command\.id\}`/)

  // The newest record is kept, because its error is the current one, and the
  // repeat count is surfaced rather than silently collapsed.
  assert.match(home, /Date\.parse\(command\.createdAt\) > Date\.parse\(seen\.command\.createdAt\)/)
  assert.match(home, /attempts have stopped this way/)
})

test('the command center is the only overview screen, and covers its own loading state', async () => {
  const app = await source('app.tsx')

  // Two command centers existed and only one was reachable: HomePage always
  // won the `workspace === 'overview' && core` branch, so OverviewDashboard
  // was dead code carrying the old five-metric dashboard.
  assert.doesNotMatch(app, /OverviewDashboard/)
  assert.doesNotMatch(app, /from '\.\/dashboard'/)

  // With the fallback gone, the window before the controller answers needs its
  // own branch — the router's switch has no case for 'overview' and would
  // render nothing.
  assert.match(app, /workspace === 'overview' && !core \?/)
  assert.match(app, /Reading controller authority/)
})

test('the evidence ledger survives on the screen that is actually reachable', async () => {
  const home = await source('home.tsx')

  // The measured / not-evidence split was only ever on the unreachable screen.
  assert.match(home, /import \{ EvidenceLedger \} from '\.\/evidence-ledger'/)
  assert.match(home, /<EvidenceLedger/)

  // Its closers each name the page owning the gap they describe, so the
  // callback has to carry the name — onOpenInfrastructure would have sent
  // "Open Collectors" to infrastructure.
  assert.match(home, /onOpen=\{onOpenPage\}/)
  assert.match(home, /onOpenPage: \(page: string\) => void/)
})
