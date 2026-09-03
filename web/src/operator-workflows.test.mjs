import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import test from 'node:test'

const source = (name) => readFile(new URL(name, import.meta.url), 'utf8')

async function tree(directory = '.', prefix = '') {
  const entries = await readdir(new URL(directory, import.meta.url), { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const path = `${prefix}${entry.name}`
    if (entry.isDirectory()) files.push(...await tree(`${directory}/${entry.name}`, `${path}/`))
    else files.push(path)
  }
  return files
}

test('the information architecture is one source, and every screen is reachable from it', async () => {
  const [nav, console_] = await Promise.all([source('navigation/navigation.ts'), source('shell/console.tsx')])

  // Six areas, named for the operator's job rather than the system's object
  // model. There were eight: Deliver and Workloads were the same object at two
  // points in its life, and Observe was a place charts went to be unattached
  // from the thing they measured.
  for (const area of ['Home', 'Apps', 'Machines', 'Traffic', 'Activity', 'Control']) {
    assert.match(nav, new RegExp(`label: '${area}'`))
  }
  for (const retired of ["label: 'Deliver'", "label: 'Workloads'", "label: 'Observe'", "label: 'Fleet'"]) {
    assert.doesNotMatch(nav, new RegExp(retired), 'an area that was merged away is still declared')
  }

  // Every screen the console can route to must appear in an area. A screen
  // with a title and no group is the bug this file exists to catch:
  // `agent-diagnostics` had both a label and a section for three releases and
  // could not be opened from navigation at all.
  const declared = [...nav.matchAll(/key: '([a-z-]+)', label:/g)].map((match) => match[1])
  for (const destination of ['agents', 'applications', 'audit', 'catalog', 'containers', 'core', 'deploy', 'dns', 'gateway', 'gateway-settings', 'images', 'logs', 'machines', 'overview', 'platform', 'registry-mirror', 'routes', 'storage', 'swarm', 'tls', 'workloads']) {
    assert.ok(declared.includes(destination), `${destination} is routable but appears in no area`)
  }

  // Every hash that used to address a screen still resolves. This rebuild
  // retired more of them at once than every previous release together, and a
  // bookmark should not pay for the console learning what its screens are for.
  const legacy = nav.slice(nav.indexOf('LEGACY_ROUTES'))
  for (const retired of ['servers', 'nodes', 'commands', 'catalogue', 'resources', 'databases', 'observability', 'insights', 'provisioning', 'agent-diagnostics', 'source-deploy', 'registry', 'builds', 'services', 'stacks', 'kubernetes-import']) {
    assert.match(legacy, new RegExp(`'?${retired}'?:`), `the retired hash #${retired} no longer resolves`)
  }

  // Every page carries the one line that says what decision it serves; the
  // contextual sidebar, the palette, and now every screen heading read it.
  assert.equal(declared.length, [...nav.matchAll(/summary: '/g)].length - 6, 'each page needs a summary and each of the 6 areas needs one too')

  assert.match(console_, /navigation="nested"/)
  assert.match(console_, /contextualGroups=\{contextualGroups\}/)
  assert.match(console_, /groups=\{areaGroups\}/)
  // Both tiers are built from AREAS, so they cannot disagree.
  assert.match(console_, /items: AREAS\.map/)
  assert.match(console_, /items: area\.pages\.map/)
})

test('every routable screen has a branch in the router', async () => {
  const [nav, router] = await Promise.all([source('navigation/navigation.ts'), source('shell/page-router.tsx')])
  const declared = [...nav.matchAll(/key: '([a-z-]+)', label:/g)].map((match) => match[1])

  // The router is now the single place a destination becomes a component. A
  // page in navigation with no case here renders an empty workspace — which is
  // exactly how `overview` lost its screen during the window before the
  // controller answered.
  for (const page of declared) {
    assert.match(router, new RegExp(`case '${page}':`), `${page} is in navigation but has no branch in the router`)
  }
})

test('an application and the service running it live in the same area', async () => {
  const nav = await source('navigation/navigation.ts')
  const apps = nav.slice(nav.indexOf("label: 'Apps'"), nav.indexOf("label: 'Machines'"))

  // Shipping and running were two areas: an application was a lifecycle under
  // Deliver and the service running it was an object under Workloads, so the
  // same thing at two levels of abstraction sat in different halves of the
  // navigation. One area owns the whole life of a workload now.
  for (const page of ['applications', 'deploy', 'platform', 'images', 'workloads']) {
    assert.match(apps, new RegExp(`key: '${page}'`))
  }
  assert.match(nav, /key: 'deploy', label: 'Deploy'/)

  // The cluster singletons are one destination, because they are one idea: a
  // database every application shares and a Prometheus every application
  // shares were in different areas and neither could say so.
  assert.match(apps, /key: 'platform', label: 'Platform services'/)

  const control = nav.slice(nav.indexOf("label: 'Control'"), nav.indexOf('export const PAGES'))
  assert.doesNotMatch(control, /'deploy'|'images'/)
})

test('every reading sits beside the object it describes', async () => {
  const [nav, files] = await Promise.all([source('navigation/navigation.ts'), tree()])

  // There is no Observe area. A fleet-wide chart cannot answer "for which
  // node?", which is the question this rebuild started from — so metrics live
  // on the machine, the container, the application and the gateway.
  assert.doesNotMatch(nav, /key: 'insights'/)
  assert.doesNotMatch(nav, /key: 'observability'/)
  assert.ok(!files.some((file) => file.startsWith('screens/observe/')), 'the observe area still has screens')

  // Its two screens each went somewhere an object owns them.
  assert.match(nav, /key: 'platform'/)
  assert.match(nav, /key: 'containers'/)

  // The rule retired the AREA and left the screen. `screens/home/insights.tsx`
  // survived with four endpoints wired to it and no route reaching it, which
  // is the same failure one level down: a reading that sits beside no object
  // at all. Its content now sits with the objects it describes.
  assert.ok(!files.includes('screens/home/insights.tsx'), 'the unreachable insights screen is back')
})

test('every reading the controller serves is drawn somewhere', async () => {
  const [api, files] = await Promise.all([source('data/api.ts'), tree()])

  // The bug this catches, in its general form: a method on the API client that
  // nothing calls is an endpoint the controller serves and the console never
  // asks for. Eight of them had accumulated — node role, labels and removal,
  // service image, limits and removal, stack removal, the gateway access log —
  // each one a control the navigation promised and no screen offered.
  //
  // A method may be added here before its screen. It may not be FORGOTTEN
  // here, which is what happened every time.
  const methods = [...api.matchAll(/^\s{2}([a-zA-Z][A-Za-z0-9]*)(?:<[^>]*>)?\(/gm)]
    .map((match) => match[1])
    .filter((name) => name !== 'constructor' && name !== 'request' && name !== 'commandRequest')

  const callers = await Promise.all(
    files.filter((file) => (file.endsWith('.ts') || file.endsWith('.tsx')) && file !== 'data/api.ts').map(source),
  )
  const everywhereElse = callers.join('\n')

  const uncalled = methods.filter((name) => !everywhereElse.includes(`.${name}(`))
  assert.deepEqual(uncalled, [], `these API methods are served by the controller and called by no screen: ${uncalled.join(', ')}`)
})

test('the palette runs actions and finds named things, not only screens', async () => {
  const [palette, console_] = await Promise.all([source('navigation/palette.tsx'), source('shell/console.tsx')])
  for (const action of ['Deploy from source', 'Add a server', 'Refresh this screen', 'Diagnose a connection', 'Sign out']) {
    assert.match(palette, new RegExp(`label: '${action}'`))
  }
  // Switching the target cluster is the change most likely to be made from the
  // keyboard mid-incident, so each manager is its own row.
  assert.match(palette, /Point the console at \$\{server\.name\}/)
  assert.match(palette, /group: `Go to · \$\{area\.label\}`/)

  // A palette that only lists destinations cannot answer "where is
  // checkout-api", which is the question an operator actually types.
  assert.match(palette, /group: 'In this cluster'/)
  assert.match(palette, /export function paletteEntities/)
  assert.match(console_, /paletteEntities\(\{ servers, services/)

  // Recents come before the full destination list, and are removed from it, so
  // the same screen is never offered twice.
  assert.match(palette, /group: 'Jump back to'/)
  assert.match(palette, /\.filter\(\(page\) => !recents\.includes\(page\.key\)\)/)

  // The chord belongs to the app, never to the kit.
  assert.match(console_, /<CommandPalette/)
  assert.doesNotMatch(console_, /<Combobox/)
})

test('every keyboard shortcut is installed and documented from one list', async () => {
  const [shortcuts, sheet, console_] = await Promise.all([
    source('navigation/shortcuts.ts'),
    source('components/shortcuts-sheet.tsx'),
    source('shell/console.tsx'),
  ])

  // ⌘K belongs to the app: a kit component binding a global chord would
  // collide with every other consumer on the page.
  assert.match(shortcuts, /event\.key\.toLowerCase\(\) === 'k'/)

  // The artboard carried a bare `D` and it was never documented anywhere an
  // operator could find it. Unmodified, so it must not fire while someone is
  // typing — this console asks people to type exact confirmation phrases, and
  // a swallowed keystroke there is expensive.
  assert.match(shortcuts, /event\.key\.toLowerCase\(\) === 'd'/)
  assert.match(shortcuts, /isContentEditable/)
  assert.match(shortcuts, /if \(typing\(event\.target\)\) return/)

  // The help sheet is generated from the same list that installs the bindings,
  // so a shortcut cannot exist without being discoverable.
  assert.match(shortcuts, /export function shortcutGroups/)
  assert.match(sheet, /shortcutGroups\(\)/)
  assert.match(shortcuts, /areaByShortcut\(key\)/)
  assert.match(console_, /useShortcuts\(\{/)
})

test('catalog actions open a sheet and activity/resources expose working filters', async () => {
  const [catalogue, resources, runs] = await Promise.all([
    source('screens/activity/catalog.tsx'),
    source('screens/machines/resources/containers.tsx'),
    source('screens/activity/runs.tsx'),
  ])
  assert.match(catalogue, /<Sheet closeLabel="Close action review"/)
  assert.match(catalogue, />Review action<\/Button>/)
  assert.match(catalogue, /label="Search actions"/)
  assert.match(resources, /label="Search containers"/)
  assert.match(runs, /aria-label="Search runs"/)
  assert.match(runs, /Last 24 hours/)
})

test('readiness presents one reviewed fix at a time instead of a switch plan', async () => {
  const readiness = await source('screens/machines/setup.tsx')
  assert.match(readiness, /title="Setup checks"/)
  assert.match(readiness, /Start single-server cluster/)
  assert.match(readiness, /<Sheet closeLabel="Close setup review"/)
  assert.doesNotMatch(readiness, /<Switch/)
  assert.doesNotMatch(readiness, /Review and queue/)
})

test('gateway and source dead ends have explicit setup actions', async () => {
  const [api, gateway, preflight, dns, sourceDeploy, registry, setup] = await Promise.all([
    source('data/api.ts'),
    source('screens/traffic/gateway.tsx'),
    source('screens/traffic/preflight.tsx'),
    source('screens/traffic/dns.tsx'),
    source('screens/apps/deploy.tsx'),
    source('screens/apps/push-registry.tsx'),
    source('screens/apps/deploy-parts/setup.tsx'),
  ])
  assert.match(gateway, />Install gateway<\/Button>/)
  assert.match(dns, /Cloudflare and ArvanCloud/)
  assert.match(gateway, /Not managed by SwarmOps/)
  assert.match(gateway, /host-native or Docker Compose proxies/)
  assert.match(gateway, /another process already binds the configured HTTP or HTTPS ports/)
  assert.match(gateway, /api\.waitForCommand\(command\.id/)
  assert.match(gateway, /title="Gateway installation blocked"/)
  assert.match(gateway, /title="Gateway installation needs attention"/)
  assert.match(preflight, /title="Installation prerequisites"/)
  assert.match(gateway, /label="Dashboard hostname"/)
  assert.match(gateway, /normalizeDashboardHostname\(dashboardHost\)/)
  assert.match(preflight, /DNS provider credentials are optional/)
  assert.match(preflight, /SwarmOps renders HTTP-01 automatically/)
  assert.match(gateway, /!preflight\?\.ready/)
  assert.match(gateway, />Open run details<\/Button>/)
  assert.match(api, /JSON\.stringify\(\{ confirmation, dashboardHost \}\)/)
  assert.match(setup, />Set up source deployment<\/Button>/)
  assert.match(registry, />Configure registry<\/Button>/)

  // A failed capability read must beat the spinner: this screen used to spin
  // forever with its own explanation rendered under a branch that never ran.
  assert.match(sourceDeploy, /Source deployment capability is unavailable/)
})

test('reading source, pushing an image, and pulling one are three separate screens', async () => {
  const [nav, setup, registry, core, images, router] = await Promise.all([
    source('navigation/navigation.ts'),
    source('screens/apps/deploy-parts/setup.tsx'),
    source('screens/apps/push-registry.tsx'),
    source('screens/control/core.tsx'),
    source('screens/apps/images.tsx'),
    source('shell/page-router.tsx'),
  ])

  // One sheet used to hold all three, so connecting GitHub asked for a registry
  // namespace and a push password before it would let you enter a provider
  // token. Where source is READ FROM, where a built image is PUSHED TO, and
  // where every host PULLS public images from are three different boundaries.
  for (const registryField of [/label="Registry namespace"/, /label="Registry server"/, /label="Registry password or token"/, />Allow bounded image builds</]) {
    assert.doesNotMatch(setup, registryField, 'the source boundary still collects registry settings')
    assert.match(registry, registryField, 'the push registry screen does not collect its own settings')
  }

  // The push registry is editable where the builds are, not a read-only card
  // pointing back at the deploy screen.
  assert.match(images, /<PushRegistryPanel onApplied=/)
  assert.match(registry, /api\.saveSourceSettings|useSourceSettings/)

  // The pull-through mirror is fleet-wide and belongs to no application, so it
  // is its own destination rather than a panel under controller identity.
  assert.match(nav, /key: 'registry-mirror'/)
  assert.match(router, /case 'registry-mirror':/)
  assert.doesNotMatch(core, /RegistryMirror/, 'the fleet image mirror is still buried in the Core screen')

  // Both halves write the same sealed record, and a half that sent only its own
  // fields would clear the other half's.
  const settings = await source('screens/apps/source-settings.ts')
  assert.match(settings, /const base = current\.current/)
  assert.match(settings, /\.\.\.patch,/)
})

test('gateway, routes, DNS, and certificates are separate operator destinations', async () => {
  const [nav, gateway, dns] = await Promise.all([
    source('navigation/navigation.ts'),
    source('screens/traffic/gateway.tsx'),
    source('screens/traffic/dns.tsx'),
  ])
  assert.match(nav, /key: 'gateway', label: 'Gateway'/)
  assert.match(nav, /key: 'routes', label: 'Routes'/)
  assert.match(nav, /key: 'dns', label: 'Domains & DNS'/)
  assert.match(nav, /key: 'tls', label: 'Certificates'/)

  // Each tab is its own destination with its own heading, so an operator who
  // wanted DNS credentials never lands on a gateway installer.
  assert.match(gateway, /const TAB_PAGE: Record<Tab, WorkspacePage>/)
  assert.match(gateway, /scope="dns"/)
  assert.match(gateway, /scope="gateway"/)
  assert.match(dns, /export function DNSSettingsTab/)
})

test('controller recovery UI does not expose the internal Core name', async () => {
  const [topology, nav] = await Promise.all([
    source('screens/control/core.tsx'),
    source('navigation/navigation.ts'),
  ])
  for (const oldLabel of ['Open Core logs', 'Move Core', 'Core identity', 'Core members', 'Install new Core standby']) {
    assert.doesNotMatch(topology, new RegExp(oldLabel))
  }
  // The screen is titled from navigation now, so the name lives in one place.
  assert.match(nav, /key: 'core', label: 'Core'/)
  assert.match(topology, /Controller members/)
  assert.match(topology, /Controller identity <Mono>/)
})

test('background refreshes preserve the current workspace and loaded content', async () => {
  const [console_, hooks, router, logs] = await Promise.all([
    source('shell/console.tsx'),
    source('data/hooks.ts'),
    source('shell/page-router.tsx'),
    source('screens/activity/logs.tsx'),
  ])
  assert.match(console_, /readSession\(SELECTED_SERVER_KEY\)/)
  assert.match(console_, /servers\.some\(\(server\) => server\.id === activeServerID\)/)

  // `initialLoading` and `refreshing` are different states and behave
  // differently on screen: a poll must never replace what someone is reading.
  assert.match(hooks, /initialLoading: enabled && !settled/)
  assert.match(hooks, /refreshing: enabled && settled && loading/)
  assert.match(router, /commandsInitialLoading\n\s*\? <WorkspaceLoading/)
  assert.doesNotMatch(router, /commandsRefreshing \? <WorkspaceLoading/)

  // A workspace wait keeps the chrome. `LoadingScreen` is the full-viewport
  // surface for the two moments before the shell exists, and using it inside
  // the workspace centred a spinner in the whole page.
  assert.doesNotMatch(router, /<LoadingScreen/)
  assert.match(logs, /loading && !page \? <Spinner/)
})

test('runs explain observability failures and block unsafe retries', async () => {
  const runs = await source('screens/activity/runs.tsx')
  assert.match(runs, /title="Why this needs attention"/)
  assert.match(runs, /The SwarmOps-managed Traefik gateway is not installed/)
  assert.match(runs, /nim\.stateful=true placement label/)
  assert.match(runs, /Resolve prerequisites before retrying/)
  assert.match(runs, />Gateway setup<\/Button>/)
  assert.match(runs, />Agent diagnostics<\/Button>/)
  assert.match(runs, /command\.failureSummary \?\? command\.lastError/)
  assert.match(runs, /label: 'Failure code'/)
  assert.match(runs, /selected\.action === 'traefik\.reconcile'/)
  assert.match(runs, />Gateway &amp; ports<\/Button>/)
})

test('the command center verdict answers to the blockers listed under it', async () => {
  const home = await source('screens/home/command-center.tsx')

  // The hero read a green "Production is operating" while rows beneath it were
  // marked Blocking, because the verdict was computed without reference to
  // them. A standing verdict that contradicts its own evidence is one
  // operators learn to stop reading.
  assert.match(home, /const blocked = attention\.filter\(\(item\) => item\.tone === 'danger'\)\.length/)
  assert.match(home, /const operating = serving && blocked === 0/)

  // Serving and unblocked are different claims, and the hero states which.
  assert.match(home, /Production is serving, and \$\{blocked\} operation/)
})

test('one stalled action is one decision, however many times it was attempted', async () => {
  const attention = await source('lib/attention.ts')

  // A failed operation and its failed retry are two records and one decision.
  // Listing both produced two identical rows and a count that said "2 open
  // decisions" when there was one.
  assert.match(attention, /const byAction = new Map/)
  assert.match(attention, /id: `command-\$\{command\.action\}`/)
  assert.doesNotMatch(attention, /id: `command-\$\{command\.id\}`/)

  // The newest record is kept, because its error is the current one, and the
  // repeat count is surfaced rather than silently collapsed.
  assert.match(attention, /Date\.parse\(command\.createdAt\) > Date\.parse\(seen\.command\.createdAt\)/)
  assert.match(attention, /attempts have stopped this way/)
})

test('what needs a decision is computed once and reachable from every screen', async () => {
  const [attention, menu, console_, home] = await Promise.all([
    source('lib/attention.ts'),
    source('components/attention-menu.tsx'),
    source('shell/console.tsx'),
    source('screens/home/command-center.tsx'),
  ])

  // The list used to live inside the command centre, so an operator who went
  // straight to Traffic never learned that a run had stopped.
  assert.match(attention, /export function attentionItems/)
  assert.match(home, /attentionItems\(core, cluster, servers, commands\)/)
  assert.match(console_, /attentionItems\(core, data \?\? undefined, servers, commands\)/)
  assert.match(console_, /<AttentionMenu items=\{attention\}/)

  // The ledger it is computed from has to be read on every screen. Fetching it
  // only where it is displayed made the masthead say "nothing needs a decision"
  // on the screens where that claim was never checked.
  assert.match(console_, /useCommands\(\n\s*watchingQueue \? 5_000 : 30_000,/)

  // Every row opens the screen that can resolve it, not the screen that
  // noticed it — which is why the item carries a page.
  assert.match(attention, /page: WorkspacePage/)
  assert.match(menu, /onSelect: \(\) => onOpen\(item\.page\)/)

  // Colour alone cannot carry a status in a console whose accent is green.
  assert.match(menu, /\{items\.length\} to decide/)
})

test('the command center is the only overview screen, and covers its own loading state', async () => {
  const router = await source('shell/page-router.tsx')

  // Two command centers existed and only one was reachable: HomePage always
  // won the `workspace === 'overview' && core` branch, so OverviewDashboard
  // was dead code carrying the old five-metric dashboard.
  assert.doesNotMatch(router, /OverviewDashboard/)

  // With the fallback gone, the window before the controller answers needs its
  // own branch — the router has no case for it and would render nothing.
  assert.match(router, /Reading controller authority/)
  assert.match(router, /return core\n\s*\? <CommandCenter/)
})

test('the evidence ledger survives on the screen that is actually reachable', async () => {
  const home = await source('screens/home/command-center.tsx')

  // The measured / not-evidence split was only ever on the unreachable screen.
  assert.match(home, /import \{ EvidenceLedger \} from '\.\/evidence-ledger'/)
  assert.match(home, /<EvidenceLedger/)

  // Its closers each name the page owning the gap they describe, so the
  // callback has to carry the name — a callback fixed to one screen would
  // send "Open Collectors" to infrastructure.
  assert.match(home, /onOpen=\{\(page\) => onOpen\(page as WorkspacePage\)\}/)
})

test('the path from an empty controller to a served request is written down', async () => {
  const home = await source('screens/home/command-center.tsx')

  // Every step existed; nothing showed them as a sequence. An operator who has
  // just enrolled a host has no way to know that a gateway is what stands
  // between a deployed application and a hostname that resolves.
  assert.match(home, /function setupSteps/)
  for (const step of ['enroll', 'swarm', 'gateway', 'deploy', 'observe']) {
    assert.match(home, new RegExp(`id: '${step}'`))
  }
  // A checklist that stays on screen after it is finished is furniture.
  assert.match(home, /\{!setupDone \? \(/)
})

test('every field read behind an object guard is guarded itself', async () => {
  const [gateway, routes, dns, logs] = await Promise.all([
    source('screens/traffic/gateway.tsx'),
    source('screens/traffic/routes.tsx'),
    source('screens/traffic/dns.tsx'),
    source('screens/activity/logs.tsx'),
  ])

  // `a?.b.c` reads as defensive and is not: the chain short-circuits only when
  // `a` is nullish, so a response that arrives present but INCOMPLETE walks
  // into the unguarded access and white-screens the area.
  //
  // Six of these shipped. They are invisible to review and invisible to the
  // type checker, because the types promise the field is there and only the
  // runtime disagrees.
  for (const text of [gateway, routes, dns, logs]) {
    assert.doesNotMatch(text, /\w\?\.\w+\.(filter|map|join|toUpperCase|length)\b/,
      'an optional chain that stops before the field it reads')
  }

  // An empty array is truthy, so `!cutover` passes for a cutover with no
  // blockers and the read below it must still be guarded.
  assert.match(routes, /cutover\.blockers\?\.length/)
})

test('a screen that fails does not take the navigation with it', async () => {
  const console_ = await source('shell/console.tsx')

  // React unmounts from the root when a render throws and nothing catches it.
  // Six crashes in this console did exactly that: the workspace went blank AND
  // the rail disappeared, leaving an operator with no way back and no sign
  // that anything had failed rather than finished loading.
  assert.match(console_, /<ErrorBoundary resetKey=\{`\$\{workspace\}\/\$\{selectedRecordID\}\/\$\{route\.view\}`\}>/)

  // Around the workspace, never the shell. The chrome that lets someone leave
  // a broken screen has to outlive it, so a boundary wrapping AdminShell would
  // protect nothing worth protecting.
  const shellAt = console_.indexOf('<AdminShell')
  const boundaryAt = console_.indexOf('<ErrorBoundary')
  assert.ok(shellAt > -1 && boundaryAt > shellAt, 'the boundary must sit inside the shell')
})

test('a screen is titled what its navigation item is called', async () => {
  const [screen, files] = await Promise.all([source('components/screen.tsx'), tree()])

  // The nav item said "Swarm & placement" and the screen it opened was titled
  // "Infrastructure". Title and purpose are now read from the same record the
  // rail, the breadcrumb, and the palette are drawn from, so they cannot
  // disagree — there is only one place the name is written.
  assert.match(screen, /const entry = pageEntry\(page\)/)
  assert.match(screen, /title=\{title \?\? entry\.label\}/)
  assert.match(screen, /subtitle=\{subtitle \?\? entry\.summary\}/)

  // A top-level screen composes `Screen`; only detail views inside one reach
  // for `Page` and `DetailHeader` directly.
  const screens = files.filter((file) => file.startsWith('screens/') && file.endsWith('.tsx'))
  assert.ok(screens.length > 20, 'the screens should be split into modules, not one file')
})

test('confirmation is one component, not eleven hand-rolled copies', async () => {
  const [confirm, ...users] = await Promise.all([
    source('components/confirm-phrase.tsx'),
    source('screens/apps/databases.tsx'),
    source('screens/apps/observability.tsx'),
    source('screens/apps/applications.tsx'),
    source('screens/machines/resources/volumes.tsx'),
    source('screens/machines/swarm-settings.tsx'),
  ])

  // The phrase is shown and copyable: the friction that makes this gate work
  // is deliberation, not recall.
  assert.match(confirm, /<CopyChip copyLabel="Copy the confirmation phrase">/)
  assert.match(confirm, /const matched = typed\.trim\(\) === phrase/)
  assert.match(confirm, /disabled=\{disabled \|\| busy \|\| !matched\}/)

  // A row shape for a table cell, so six stacked confirmation forms never
  // happen again.
  assert.match(confirm, /if \(compact && !open\)/)

  for (const user of users) {
    assert.match(user, /<ConfirmPhrase/, 'a destructive action must use the shared confirmation')
  }
})

test('one implementation of every number the console prints', async () => {
  const files = await tree()
  const modules = files.filter((file) => (file.endsWith('.ts') || file.endsWith('.tsx')) && !file.endsWith('.test.mjs') && file !== 'lib/format.ts')

  // Nine screens each carried their own formatBytes and their own
  // formatDateTime, and they had already drifted: one rounded a gibibyte to a
  // whole number and another to one decimal.
  for (const file of modules) {
    const text = await source(file)
    assert.doesNotMatch(text, /^function (formatBytes|formatDateTime|formatTimestamp|shortID|shortDigest|messageOf)\b/m,
      `${file} redefines a formatting helper that lib/format.ts already owns`)
  }
})

test('the console holds no UI components of its own beyond kit compositions', async () => {
  const styles = await source('styles.css')

  // `web/src/styles.css` is app chrome only — the mark, the wordmark, and the
  // two full-viewport screens that exist before the shell does. A rule that
  // creeps back into it describing a LAYOUT is a missing kit component.
  const layoutRules = [...styles.matchAll(/^\s*(display|grid-template|flex-direction):/gm)]
  assert.ok(layoutRules.length <= 4, `styles.css has grown ${layoutRules.length} layout declarations; a layout belongs in the kit`)
})
