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
- The React console consumes `nim`'s **console layer** and holds no UI
  components of its own. `web/src/styles.css` is app chrome only — the mark,
  the wordmark, and the two full-viewport screens that exist before the shell
  does. A rule that creeps back into that file describing a LAYOUT is a missing
  kit component, not app styling.
- Appearance is set once in `web/src/main.tsx`: `console` style + `sable`
  colourway. `sable` is the operator palette, chosen because cobalt is the one
  accent family that cannot be mistaken for a green/amber/red node status.
- Add a reusable kit component only when the
  need is general, then update `nim-ui` documentation and gallery per its own
  scoped policy.
- `cmd/swarmopsctl` may read a local build directory only to construct a tar
  stream. Respect `.dockerignore`, reject symlinks and special files, and do
  not turn a browser-selected path into a server filesystem path.
- Run `go test ./...`, the web typecheck/build, stack rendering, and the
  relevant Ansible syntax check after changes. A live Swarm/ACME/machine-API
  result is a separate verification boundary and must not be implied by local
  checks.
