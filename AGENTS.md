# SwarmOps agent notes

Read [README.md](README.md) before changing this application. Root
`AGENTS.md` remains authoritative.

- Treat the API and machine agent as high-trust surfaces: the controller reaches
  a selected Docker Engine only through a pinned TLS machine API with a
  memory-only API key. The global overlay agent remains read-only. Never add an
  arbitrary command, arbitrary file-read, shell, or socket-proxy endpoint to
  either process.
- Browser mutations must be fixed-shape operations, CSRF-protected, audited,
  bounded by context/output/resource limits, and disabled by default.
- Never put a password, private key/passphrase, session key, registry config,
  cloud token, Compose content, build context, or service-log content into an
  audit record or log. Persist only non-secret remote-server profile metadata.
- `web/src/navigation/navigation.ts` is the console's information architecture
  and the ONLY place it is written down: the six areas, screens, icons,
  `G`-chord letters, the one line each screen exists to answer, retired hashes,
  and the set that needs a selected cluster. Both navigation tiers, the breadcrumb, the
  palette, the keyboard chords, and every screen's own TITLE and subtitle are
  derived from it. Adding a screen means adding it there and giving it a branch
  in `web/src/shell/page-router.tsx` — a routable screen in no area, or in no
  router branch, is a test failure, and the first of those is exactly how
  `agent-diagnostics` shipped for three releases with a title, a section, and
  no way to reach it. Never reintroduce a second list of pages.
- The palette's CONTENTS are this product's (`web/src/navigation/palette.tsx`);
  it lists actions, recently opened screens, the named things in the selected
  cluster, and finally every destination — a palette that lists only screens
  cannot answer "where is `checkout-api`", which is what an operator types. Its
  surface is the kit's `CommandPalette`. The ⌘K binding lives in the app for
  the same reason: a kit component binding a global chord collides with every
  other consumer on the page.
- The React console consumes `nim`'s **console layer** and holds no UI
  components of its own. `web/src/styles.css` is app chrome only — the mark,
  the wordmark, and the two full-viewport screens that exist before the shell
  does. A rule that creeps back into that file describing a LAYOUT is a missing
  kit component, not app styling.
- Appearance is set once in `web/src/main.tsx` and mirrored on `index.html`:
  `console` style + `malachite` colourway. This replaced `sable` on the
  product owner's design direction. `sable` was chosen for a CONSTRAINT — a
  cobalt accent cannot be mistaken for a green/amber/red node status — and
  `malachite` gives that constraint up deliberately: on the delivery screens
  the rows are decisions rather than health, and the states that still have to
  be told apart there (warning, blocker) are amber and red, which no reading
  of the accent reaches. The constraint still applies to the fleet screens, so
  a node/service status must keep saying its state in WORDS beside the colour;
  never let a green dot alone carry "healthy" on a page whose accent is also
  green.
- The brand LOCKUP is the kit's `Brand`; this app owns only the mark, the two
  words, and `--nim-brand-accent`. Never re-describe the row, the type, or the
  tagline in app CSS.
- The mark is `web/src/components/brand.tsx` — "Quorum", three hive cells for the
  three managers that have to agree — and `web/public/favicon.svg` is the same
  geometry written out. They are ONE mark: change both in the same edit or they
  drift. The mark uses the same malachite accent as navigation and primary
  actions; health must therefore remain explicit in words beside colour. The
  mark needs no simplified small variant — three shapes already survive 16px,
  and a second variant is a second thing to keep in step.
- The sidebar footer contains observed operational scope only: Core authority,
  authority epoch, and selected-cluster snapshot state. Do not place compliance
  claims or other unverified assurance copy in the persistent console chrome.
- A saved deployment-plan draft is browser-local and holds the SELECTION only —
  ids, ref, slot, domain, port, health path. Never write a path, digest,
  finding, provider response, or any evidence into browser storage.
- The console's directories decide what a file may contain, and nothing may
  reach across them the wrong way. `data/` reads the controller and owns the
  polling hooks; `lib/` computes and formats and imports no component;
  `navigation/` names screens and binds keys; `components/` composes the kit
  into the handful of app-level shapes every screen shares; `screens/<area>/`
  draws one destination each; `shell/` holds the three together. `app.tsx` is
  the entry point and nothing else — it was two and a half thousand lines once,
  and every bug in it was a bug nobody could find.
- One implementation of every number: `lib/format.ts` owns `formatBytes`,
  `formatDateTime`, `shortID` and the rest. Nine screens each had their own and
  they had already drifted. A local copy is a test failure.
- One confirmation control: `components/confirm-phrase.tsx`. A destructive
  action states its consequence, shows the phrase, and stays disabled until the
  phrase matches — eleven hand-rolled copies is how three of them stopped
  stating the consequence at all.
- Every top-level screen composes `components/screen.tsx`, which reads its
  title and its one-line purpose from `navigation.ts`. Only a detail view
  INSIDE a screen reaches for `Page` and `DetailHeader` directly. This is why
  the nav item and the heading it opens can no longer disagree.
- METRICS LIVE ON THEIR OBJECT. There is no Observe area and adding one back is
  a regression: a fleet-wide chart cannot say which node it means, and a console
  that shows one teaches operators to distrust every number on it. A machine, a
  container, an application and the gateway each carry their own charts.
- Every chart in the product is `components/metric-chart.tsx`, and it states
  four things rather than one: what was measured, about which object, over what
  period, and from which source. A range whose source is `unavailable` draws
  NOTHING and says why — an empty plot and an idle machine are
  indistinguishable, and only one of them is a measurement. A second charting
  component is a missing feature in that one.
- Reading a metric is a CLOSED vocabulary, exactly like changing something is.
  The browser names a series and an object; the query language is built on the
  machine from the fixed table in `internal/agentcontrol/metrics_query.go`.
  Never accept an expression from a browser, and never interpolate a selector
  that has not matched the selector pattern.
- Machine metrics cross the agent boundary as a TYPED document that Core
  sanitizes before rendering. The agent supplies numbers; Core chooses the
  metric names. An agent that could return exposition text could introduce
  metric families, overwrite another node's series, or break the whole scrape
  with one unescaped byte.
- A join token is read from the manager by the command worker at EXECUTION
  time and never written to the sealed payload, the audit record, or a browser
  response. `dockerapi.SwarmJoinToken` is the only function in that package
  that returns one, and nothing stores its result.
- A screen offers between two and four INSIGHTS under its title: a reading, what
  it means, and where to act on it. A fifth is a table. A control that does
  nothing is never rendered — a "Create alert" button with no handler teaches
  an operator that the console is a mock-up.
- Add a reusable kit component only when the
  need is general, then update `nim-ui` documentation and gallery per its own
  scoped policy.
- `cmd/swarmopsctl` may read a local build directory only to construct a tar
  stream. Respect `.dockerignore`, reject symlinks and special files, and do
  not turn a browser-selected path into a server filesystem path.
- Run `go test ./...`, the web typecheck/build, installer shell checks, and
  stack rendering after changes. A live Swarm/ACME/agent-pull
  result is a separate verification boundary and must not be implied by local
  checks.

## Release duty

The published version is the `version` constant in `cmd/api/main.go`. Bumping
it is not finished until, in the same task:

1. `CHANGELOG.md` here gains the release, newest first.
2. `content/docs/swarmops.json` and `content/fa/docs/swarmops.json` in the
   separate `nim-zone` repository gain the matching `changelog` entry
   and their `version` field matches it — the site generator fails the build
   when it does not — with `status`, `stats`, `use_cases`, and `roadmap`
   corrected wherever the release made them untrue. Roadmap entries carry a
   status, never a date.
3. README.md agrees with both: capabilities, boundaries, and limitations are
   the material those records are written from.
4. `npm run generate && npm test` passes in the separate `nim-zone` repository.

Never write a secret, remote output, Compose body, or build context into any of
these documents. See the root `AGENTS.md` section "Released software is
documented on the site".
