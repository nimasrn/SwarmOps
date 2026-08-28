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
- `web/src/navigation.ts` is the console's information architecture and the
  ONLY place it is written down: areas, screens, icons, the one line each
  screen exists to answer, retired hashes, and the set that needs a selected
  cluster. Both navigation tiers, the breadcrumb, the palette, and the gating
  rule are derived from it. Adding a screen means adding it there — a routable
  screen in no area is a test failure, and is exactly how
  `agent-diagnostics` shipped for three releases with a title, a section, and
  no way to reach it. Never reintroduce a second list of pages.
- The palette's CONTENTS are this product's (`web/src/palette.tsx`); its
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
- The mark is `web/src/brand.tsx` — "Quorum", three hive cells for the three
  managers that have to agree — and `web/public/favicon.svg` is the same
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
2. `apps/nim/content/docs/swarmops.json` and
   `apps/nim/content/fa/docs/swarmops.json` gain the matching `changelog` entry
   and their `version` field matches it — the site generator fails the build
   when it does not — with `status`, `stats`, `use_cases`, and `roadmap`
   corrected wherever the release made them untrue. Roadmap entries carry a
   status, never a date.
3. README.md agrees with both: capabilities, boundaries, and limitations are
   the material those records are written from.
4. `npm --prefix ../nim run generate && npm --prefix ../nim test` passes.

Never write a secret, remote output, Compose body, or build context into any of
these documents. See the root `AGENTS.md` section "Released software is
documented on the site".
