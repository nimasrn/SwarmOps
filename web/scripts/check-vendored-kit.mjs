#!/usr/bin/env node
/**
 * Fails when the vendored kit's built output no longer matches its own source.
 *
 * The console does not consume the nim-ui repository. package.json points at
 * `file:./vendor/nim-ui`, a tracked, prebuilt copy with no build step of its
 * own — so a change made to the kit upstream, or to the vendored source here,
 * is invisible until `dist` is refreshed. Nothing complains: the source reads
 * correctly, the types resolve, the build succeeds, and the browser quietly
 * serves the previous stylesheet.
 *
 * That failure cost an hour once. The fix was correct on disk, compiled into
 * the wrong dist, and never served, and every check said the code was right —
 * because it was. This script exists so the next person is told in a second.
 *
 * It compares the CSS class names and the exported symbols declared in the
 * vendored SOURCE against those present in the vendored DIST. That catches the
 * case that actually happens — new or renamed things missing from the build —
 * without pretending to be a full rebuild.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const web = dirname(dirname(fileURLToPath(import.meta.url)))
const kit = join(web, 'vendor', 'nim-ui')
const fail = (message) => {
  console.error(`\nvendored kit is stale: ${message}\n`)
  console.error('Rebuild the standalone nim-ui checkout and copy its dist across:')
  console.error('  npm --prefix /path/to/nim-ui run build')
  console.error('  cp -R /path/to/nim-ui/dist/. vendor/nim-ui/dist/\n')
  process.exit(1)
}

for (const required of ['src/theme/components.css', 'dist/nim.css', 'src/index.ts', 'dist/index.d.ts']) {
  if (!existsSync(join(kit, required))) fail(`${required} is missing`)
}

// --- CSS: every class the source declares must survive minification into dist
const css = readFileSync(join(kit, 'src/theme/components.css'), 'utf8')
const built = readFileSync(join(kit, 'dist/nim.css'), 'utf8')
const declared = new Set([...css.matchAll(/\.(nim-[a-z0-9-]+(?:__[a-z0-9-]+)?)/g)].map((m) => m[1]))
const missingCSS = [...declared].filter((name) => !built.includes(`.${name}`))
if (missingCSS.length) {
  fail(`${missingCSS.length} class(es) in the source are absent from dist/nim.css, e.g. ${missingCSS.slice(0, 5).join(', ')}`)
}

// --- Exports: every component the index exports must appear in the typings
const index = readFileSync(join(kit, 'src/index.ts'), 'utf8')
const types = readFileSync(join(kit, 'dist/index.d.ts'), 'utf8')
const exported = [...index.matchAll(/^export \{ ([A-Za-z, ]+) \}/gm)].flatMap((m) => m[1].split(',').map((s) => s.trim()))
const missingExports = exported.filter((name) => name && !types.includes(name))
if (missingExports.length) {
  fail(`${missingExports.length} export(s) are absent from dist/index.d.ts, e.g. ${missingExports.slice(0, 5).join(', ')}`)
}

// --- Components present as source but never built
const componentDir = join(kit, 'src/components')
const sources = readdirSync(componentDir).filter((f) => f.endsWith('.tsx')).map((f) => f.replace('.tsx', ''))
const js = readFileSync(join(kit, 'dist/nim.js'), 'utf8')
const unbuilt = sources.filter((name) => {
  const cls = `nim-${name}`
  return css.includes(`.${cls}`) && !js.includes(cls) && !built.includes(`.${cls}`)
})
if (unbuilt.length) fail(`component(s) present in source but not in dist: ${unbuilt.join(', ')}`)

console.log(`vendored kit is current — ${declared.size} classes, ${exported.length} exports.`)
