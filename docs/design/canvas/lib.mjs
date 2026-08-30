/* Shared drawing vocabulary for the SwarmOps console redesign canvas.
 *
 * Every value here is lifted from the running console, not invented: the
 * colours are `nim-ui`'s malachite colourway resolved for light scheme, the
 * geometry is the `console` style at its resting density (0.76), and the
 * chrome measurements were read off the live DOM — 68px icon rail, 248px
 * context sidebar, 56px topbar, 24px main padding, 12px panel body.
 */

export const T = {
  canvas: '#f7f9f8',
  sunken: '#eef2f1',
  surface: '#ffffff',
  muted: '#eff3f2',
  ink: '#111820',
  ink2: '#3f4a55',
  ink3: '#68757f',
  line: 'rgba(17, 27, 34, 0.13)',
  lineSoft: 'rgba(17, 27, 34, 0.08)',
  lineStrong: 'rgba(17, 27, 34, 0.22)',
  accent: '#0f8a63',
  accentHover: '#0c7a58',
  accentSoft: 'rgba(15, 138, 99, 0.11)',
  accentLine: 'rgba(15, 138, 99, 0.26)',
  success: '#1c7f52',
  successSoft: 'rgba(28, 127, 82, 0.12)',
  warning: '#8a6206',
  warningSoft: 'rgba(138, 98, 6, 0.13)',
  danger: '#c1332c',
  dangerSoft: 'rgba(193, 51, 44, 0.11)',
  info: '#2f6ad0',
  infoSoft: 'rgba(47, 106, 208, 0.1)',
  s2: '#2f6ad0',
  s3: '#8a6206',
  s4: '#a34468',
  s5: '#6a4ea6',
  s6: '#2f7f79',
  sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  mono: "'Geist Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
}

/* ── Icons ──────────────────────────────────────────────────────────────
   One stroke family, 20px grid, 1.5 weight, currentColor. Never a glyph. */
const P = {
  home: '<path d="M3 9.5 10 4l7 5.5V16a1 1 0 0 1-1 1h-3.5v-4.5h-5V17H4a1 1 0 0 1-1-1z"/>',
  apps: '<path d="M10 3 3 6.5 10 10l7-3.5z"/><path d="M3 10.5 10 14l7-3.5"/><path d="M3 14 10 17.5 17 14"/>',
  server: '<rect x="3" y="4" width="14" height="5" rx="1"/><rect x="3" y="11" width="14" height="5" rx="1"/><path d="M6 6.5h.01M6 13.5h.01"/>',
  globe: '<circle cx="10" cy="10" r="7"/><path d="M3 10h14M10 3c1.8 2 2.7 4.4 2.7 7S11.8 15 10 17C8.2 15 7.3 12.6 7.3 10S8.2 5 10 3z"/>',
  activity: '<path d="M3 10.5h3l2.2-5.5 3.4 10 2.2-4.5h3.2"/>',
  control: '<path d="M10 3.2 16 6v4.4c0 3.4-2.4 5.6-6 6.6-3.6-1-6-3.2-6-6.6V6z"/><path d="M7.7 10.2 9.4 12l3.1-3.4"/>',
  search: '<circle cx="9" cy="9" r="5.2"/><path d="m13 13 3.6 3.6"/>',
  refresh: '<path d="M16.2 8.4A6.4 6.4 0 0 0 4.6 7.2"/><path d="M3.8 11.6a6.4 6.4 0 0 0 11.6 1.2"/><path d="M16.6 4.6v3.8h-3.8M3.4 15.4v-3.8h3.8"/>',
  alert: '<path d="M10 3.6 17.4 16H2.6z"/><path d="M10 8.4v3.4M10 14h.01"/>',
  chevron: '<path d="m7.5 5 5 5-5 5"/>',
  chevronDown: '<path d="m5 7.5 5 5 5-5"/>',
  check: '<path d="m4.5 10.5 3.6 3.6L15.5 6"/>',
  plus: '<path d="M10 4.2v11.6M4.2 10h11.6"/>',
  play: '<path d="M6.5 4.4 15.5 10l-9 5.6z"/>',
  arrow: '<path d="M4 10h11.4M11.2 5.8 15.4 10l-4.2 4.2"/>',
  cpu: '<rect x="6" y="6" width="8" height="8" rx="1"/><path d="M8 3.2v2.6M12 3.2v2.6M8 14.2v2.6M12 14.2v2.6M3.2 8h2.6M3.2 12h2.6M14.2 8h2.6M14.2 12h2.6"/>',
  database: '<ellipse cx="10" cy="5.4" rx="6" ry="2.4"/><path d="M4 5.4v9.2c0 1.3 2.7 2.4 6 2.4s6-1.1 6-2.4V5.4"/><path d="M4 10c0 1.3 2.7 2.4 6 2.4s6-1.1 6-2.4"/>',
  clock: '<circle cx="10" cy="10" r="7"/><path d="M10 5.8V10l2.8 1.8"/>',
  terminal: '<path d="m4.4 6.2 3.4 3.8-3.4 3.8M10.2 14h5.4"/>',
  down: '<path d="M10 3.8v9.4M6.2 9.6 10 13.4l3.8-3.8M4 16.2h12"/>',
  box: '<path d="m10 3.2 6.2 3.2v7.2L10 16.8 3.8 13.6V6.4z"/><path d="M3.8 6.4 10 9.6l6.2-3.2M10 9.6v7.2"/>',
  lock: '<rect x="4.4" y="8.6" width="11.2" height="7.6" rx="1.2"/><path d="M7.2 8.6V6.8a2.8 2.8 0 0 1 5.6 0v1.8"/>',
  git: '<circle cx="6" cy="5.6" r="2"/><circle cx="6" cy="14.4" r="2"/><circle cx="14" cy="10" r="2"/><path d="M6 7.6v4.8M8 5.6h3a1 1 0 0 1 1 1v1.6"/>',
  route: '<circle cx="5" cy="5.4" r="1.8"/><circle cx="15" cy="14.6" r="1.8"/><path d="M5 7.2v4.6a2.8 2.8 0 0 0 2.8 2.8h5.4"/>',
  shield: '<path d="M10 3.2 16 6v4.4c0 3.4-2.4 5.6-6 6.6-3.6-1-6-3.2-6-6.6V6z"/>',
  dots: '<circle cx="5" cy="10" r="1.2"/><circle cx="10" cy="10" r="1.2"/><circle cx="15" cy="10" r="1.2"/>',
  external: '<path d="M11.4 4.2h4.4v4.4M15.8 4.2 9.6 10.4"/><path d="M14 11.6v3.8a1 1 0 0 1-1 1H4.8a1 1 0 0 1-1-1V7.2a1 1 0 0 1 1-1h3.8"/>',
  copy: '<rect x="7" y="7" width="9.2" height="9.2" rx="1.2"/><path d="M13 7V4.8a1 1 0 0 0-1-1H4.8a1 1 0 0 0-1 1V12a1 1 0 0 0 1 1H7"/>',
  pause: '<path d="M7.6 4.8v10.4M12.4 4.8v10.4"/>',
  memory: '<rect x="4" y="7" width="12" height="6" rx="1"/><path d="M7 4.6v2.4M10 4.6v2.4M13 4.6v2.4M7 13v2.4M10 13v2.4M13 13v2.4"/>',
  document: '<path d="M5 3.4h6.4L15.4 7v9.6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4.4a1 1 0 0 1 1-1z"/><path d="M11 3.6V7.4h4.2M6.8 11h6.4M6.8 13.6h4.4"/>',
  upload: '<path d="M10 15.6V6.4M6.4 9.8 10 6.2l3.6 3.6M4 16.6h12"/>',
  bolt: '<path d="M11.2 2.8 4.6 11.4h4.2l-.8 5.8 6.6-8.6h-4.2z"/>',
  disk: '<circle cx="10" cy="10" r="7"/><circle cx="10" cy="10" r="2.2"/>',
  network: '<path d="M10 3.4v4.2M10 12.4v4.2"/><circle cx="10" cy="10" r="2.4"/><path d="M4.8 6.4 8 8.6M15.2 6.4 12 8.6M4.8 13.6 8 11.4M15.2 13.6 12 11.4"/>',
}

export function icon(name, size = 20, sw = 1.5) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] ?? P.box}</svg>`
}

/* ── Deterministic sample series ────────────────────────────────────────
   Charts on a mockup have to look like measurements, not like decoration,
   so the walks are seeded and reproducible rather than hand-drawn curves. */
export function walk(seed, n, { base = 50, drift = 0, vol = 6, min = 0, max = 100 } = {}) {
  let s = seed >>> 0
  const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
  const out = []
  let v = base
  for (let i = 0; i < n; i += 1) {
    v += (rand() - 0.5) * vol * 2 + drift
    v = Math.max(min, Math.min(max, v))
    out.push(+v.toFixed(2))
  }
  return out
}

function pathFor(values, w, h, pad = 0) {
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const span = hi - lo || 1
  const step = w / (values.length - 1)
  return values
    .map((v, i) => `${i ? 'L' : 'M'}${(i * step).toFixed(1)} ${(pad + (h - pad * 2) * (1 - (v - lo) / span)).toFixed(1)}`)
    .join(' ')
}

/** A filled area chart with an axis-free frame — the shape is the reading. */
export function areaChart(values, { w = 320, h = 72, color = T.accent, id = 'g' } = {}) {
  const d = pathFor(values, w, h, 4)
  return `<svg width="100%" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="display: block">
  <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="${color}" stop-opacity="0.22"/><stop offset="100%" stop-color="${color}" stop-opacity="0"/>
  </linearGradient></defs>
  <path d="${d} L${w} ${h} L0 ${h} Z" fill="url(#${id})"/>
  <path d="${d}" fill="none" stroke="${color}" stroke-width="1.5" vector-effect="non-scaling-stroke"/>
</svg>`
}

export function sparkline(values, { w = 96, h = 22, color = T.accent } = {}) {
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="display: block">
  <path d="${pathFor(values, w, h, 2)}" fill="none" stroke="${color}" stroke-width="1.25" vector-effect="non-scaling-stroke"/>
</svg>`
}

/** Two stacked series — the shape a request/error chart needs. */
export function dualChart(a, b, { w = 320, h = 72, ca = T.accent, cb = T.danger, id = 'd' } = {}) {
  return `<svg width="100%" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="display: block">
  <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="${ca}" stop-opacity="0.2"/><stop offset="100%" stop-color="${ca}" stop-opacity="0"/>
  </linearGradient></defs>
  <path d="${pathFor(a, w, h, 4)} L${w} ${h} L0 ${h} Z" fill="url(#${id})"/>
  <path d="${pathFor(a, w, h, 4)}" fill="none" stroke="${ca}" stroke-width="1.5" vector-effect="non-scaling-stroke"/>
  <path d="${pathFor(b, w, h, 4)}" fill="none" stroke="${cb}" stroke-width="1.25" stroke-dasharray="3 2" vector-effect="non-scaling-stroke"/>
</svg>`
}

/* ── Atoms ──────────────────────────────────────────────────────────────
   Copies of the kit's shapes at their measured values. Inline styles on
   purpose: they are what the properties panel edits. */

const TONES = {
  success: [T.success, T.successSoft],
  warning: [T.warning, T.warningSoft],
  danger: [T.danger, T.dangerSoft],
  info: [T.info, T.infoSoft],
  accent: [T.accent, T.accentSoft],
  neutral: [T.ink3, 'rgba(17, 27, 34, 0.06)'],
}

export function badge(text, tone = 'neutral') {
  const [fg, bg] = TONES[tone] ?? TONES.neutral
  return `<span style="display: inline-flex; align-items: center; padding: 4px 8px; border-radius: 999px; background: ${bg}; color: ${fg}; font-size: 11px; font-weight: 500; letter-spacing: 0.44px; white-space: nowrap">${text}</span>`
}

/** Status must never be colour alone — the accent on this colourway is green. */
export function dot(tone = 'neutral', label = '') {
  const [fg] = TONES[tone] ?? TONES.neutral
  return `<span style="display: inline-flex; align-items: center; gap: 6px; white-space: nowrap"><span style="width: 6px; height: 6px; border-radius: 999px; background: ${fg}; flex: none"></span>${label ? `<span style="font-size: 12px; color: ${T.ink2}">${label}</span>` : ''}</span>`
}

export function button(label, { tone = 'default', ic = null, sm = true } = {}) {
  const h = sm ? 27 : 33
  const styles = {
    primary: `background: ${T.accent}; color: #ffffff; border-color: ${T.accent}`,
    danger: `background: ${T.danger}; color: #ffffff; border-color: ${T.danger}`,
    default: `background: ${T.surface}; color: ${T.ink}; border-color: ${T.line}`,
    quiet: `background: transparent; color: ${T.ink2}; border-color: transparent`,
  }
  return `<span style="display: inline-flex; align-items: center; gap: 6px; height: ${h}px; padding: 0 12px; border: 1px solid; border-radius: 2px; font-size: 12px; font-weight: 500; white-space: nowrap; ${styles[tone] ?? styles.default}">${ic ? icon(ic, 14) : ''}${label}</span>`
}

export function mono(text, { size = 12, color = T.ink2 } = {}) {
  return `<span style="font-family: ${T.mono}; font-size: ${size}px; color: ${color}">${text}</span>`
}

export function panel(title, body, { meta = '', actions = '', pad = 12, note = '' } = {}) {
  const header = (title || actions || meta)
    ? `<div style="display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-bottom: 1px solid ${T.lineSoft}">
      <div style="flex: 1; min-width: 0">
        <div style="font-size: 14px; font-weight: 600; color: ${T.ink}; letter-spacing: -0.25px">${title}</div>
        ${meta ? `<div style="font-size: 12px; color: ${T.ink3}; margin-top: 2px">${meta}</div>` : ''}
      </div>
      <div style="display: flex; align-items: center; gap: 6px">${actions}</div>
    </div>`
    : ''
  return `<section style="background: ${T.surface}; border: 1px solid ${T.line}; border-radius: 2px">
  ${header}
  <div style="padding: ${pad}px">${body}</div>
  ${note ? `<div style="padding: 8px 12px; border-top: 1px solid ${T.lineSoft}; font-size: 12px; color: ${T.ink3}">${note}</div>` : ''}
</section>`
}

/** The screen's answer, not its statistics: figure, meaning, where to act. */
export function insight(label, value, hint, { tone = 'neutral', link = '' } = {}) {
  const [fg] = TONES[tone] ?? TONES.neutral
  return `<div style="flex: 1 1 0; min-width: 0; background: ${T.surface}; border: 1px solid ${T.line}; border-radius: 3px; padding: 12px 16px">
  <div style="font-size: 11px; font-weight: 500; letter-spacing: 0.52px; color: ${T.ink3}">${label}</div>
  <div style="font-family: ${T.mono}; font-size: 24px; font-weight: 500; letter-spacing: -0.43px; color: ${tone === 'neutral' ? T.ink : fg}; margin-top: 4px">${value}</div>
  <div style="font-size: 12px; color: ${T.ink3}; margin-top: 4px; line-height: 1.4">${hint}${link ? ` <span style="color: ${T.accent}">${link}</span>` : ''}</div>
</div>`
}

export function insights(items) {
  return `<div style="display: flex; gap: 12px; margin-bottom: 16px">${items.join('')}</div>`
}

export function table(cols, rows, { dense = false } = {}) {
  const pad = dense ? '6px 12px' : '8px 12px'
  const head = cols
    .map((c) => `<th style="text-align: ${c.right ? 'right' : 'left'}; padding: 8px 12px; font-size: 11px; font-weight: 500; letter-spacing: 0.44px; color: ${T.ink3}; border-bottom: 1px solid ${T.line}; white-space: nowrap; ${c.w ? `width: ${c.w}` : ''}">${c.label}</th>`)
    .join('')
  const body = rows
    .map((r) => `<tr>${r.map((cell, i) => `<td style="text-align: ${cols[i]?.right ? 'right' : 'left'}; padding: ${pad}; font-size: 12px; color: ${T.ink}; border-bottom: 1px solid ${T.lineSoft}; vertical-align: middle">${cell}</td>`).join('')}</tr>`)
    .join('')
  return `<table style="width: 100%; border-collapse: collapse; table-layout: auto"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`
}

/** A labelled bar. Used for a percentage that has a ceiling worth seeing. */
export function meter(pct, { tone = 'accent', w = 72 } = {}) {
  const [fg] = TONES[tone] ?? TONES.accent
  return `<span style="display: inline-flex; align-items: center; gap: 8px">
  <span style="width: ${w}px; height: 4px; border-radius: 999px; background: ${T.muted}; overflow: hidden; flex: none">
    <span style="display: block; width: ${Math.max(2, Math.min(100, pct))}%; height: 100%; background: ${fg}"></span>
  </span>
  <span style="font-family: ${T.mono}; font-size: 12px; color: ${T.ink2}; min-width: 34px; text-align: right">${pct}%</span>
</span>`
}

export function gauge(label, value, unit, pct, { tone = 'accent', sub = '' } = {}) {
  const [fg] = TONES[tone] ?? TONES.accent
  return `<div style="flex: 1 1 0; min-width: 0; padding: 12px; border: 1px solid ${T.line}; border-radius: 3px; background: ${T.surface}">
  <div style="display: flex; align-items: baseline; gap: 6px">
    <span style="font-family: ${T.mono}; font-size: 20px; font-weight: 500; color: ${T.ink}; letter-spacing: -0.3px">${value}</span>
    <span style="font-size: 12px; color: ${T.ink3}">${unit}</span>
  </div>
  <div style="font-size: 11px; font-weight: 500; letter-spacing: 0.44px; color: ${T.ink3}; margin: 6px 0 8px">${label}</div>
  <span style="display: block; width: 100%; height: 4px; border-radius: 999px; background: ${T.muted}; overflow: hidden">
    <span style="display: block; width: ${Math.max(2, Math.min(100, pct))}%; height: 100%; background: ${fg}"></span>
  </span>
  ${sub ? `<div style="font-size: 11px; color: ${T.ink3}; margin-top: 6px">${sub}</div>` : ''}
</div>`
}

export function codeBlock(lines, { copy = true } = {}) {
  return `<div style="position: relative; background: ${T.sunken}; border: 1px solid ${T.line}; border-radius: 2px; padding: 12px 14px; overflow-x: auto">
  <pre style="margin: 0; font-family: ${T.mono}; font-size: 12px; line-height: 1.7; color: ${T.ink}; white-space: pre">${lines}</pre>
  ${copy ? `<span style="position: absolute; top: 8px; right: 8px; display: inline-flex; align-items: center; gap: 6px; height: 25px; padding: 0 10px; border: 1px solid ${T.line}; border-radius: 2px; background: ${T.surface}; font-size: 11px; font-weight: 500; color: ${T.ink2}">${icon('copy', 13)}Copy</span>` : ''}
</div>`
}

/* ── The console frame ──────────────────────────────────────────────────
   Six areas in the rail. The old console had eight, and two of them —
   "Deliver" and "Workloads" — were the same object at two points in its
   life, which is why an application and the service running it lived in
   different halves of the navigation. */
export const AREAS = [
  { key: 'home', label: 'Home', ic: 'home' },
  { key: 'apps', label: 'Apps', ic: 'apps' },
  { key: 'machines', label: 'Machines', ic: 'server' },
  { key: 'traffic', label: 'Traffic', ic: 'globe' },
  { key: 'activity', label: 'Activity', ic: 'activity' },
  { key: 'control', label: 'Control', ic: 'control' },
]

export const AREA_NAV = {
  home: { summary: 'What production is doing, and the one thing worth doing about it.', items: [['Overview', 'home']] },
  apps: {
    summary: 'What you ship, and the shared services it runs against.',
    items: [['Applications', 'apps'], ['Deploy', 'deploy'], ['Platform services', 'platform'], ['Images & registries', 'images'], ['Stacks & services', 'stacks']],
  },
  machines: {
    summary: 'The hosts, their agents, and the cluster they form.',
    items: [['Machines', 'machines'], ['Swarm', 'swarm'], ['Containers', 'containers'], ['Storage & networks', 'storage']],
  },
  traffic: {
    summary: 'How a request from the internet reaches a workload.',
    items: [['Gateway', 'gateway'], ['Routes', 'routes'], ['Domains & DNS', 'dns'], ['Certificates', 'tls']],
  },
  activity: {
    summary: 'Everything this console did, and everything it may do.',
    items: [['Runs', 'runs'], ['Logs', 'logs'], ['Audit', 'audit'], ['Action catalog', 'catalog']],
  },
  control: {
    summary: 'The controller itself and the software on every host.',
    items: [['Core', 'core'], ['Agents & updates', 'agents'], ['Settings & access', 'settings']],
  },
}

function rail(active) {
  const items = AREAS.map((a) => {
    const on = a.key === active
    return `<div style="display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 7px 0; border-radius: 3px; background: ${on ? T.accentSoft : 'transparent'}; color: ${on ? T.accent : T.ink3}">
      ${icon(a.ic, 20)}
      <span style="font-size: 10px; font-weight: 500; letter-spacing: 0.1px">${a.label}</span>
    </div>`
  }).join('')
  return `<nav style="width: 68px; flex: none; border-right: 1px solid ${T.line}; background: ${T.surface}; display: flex; flex-direction: column">
  <div style="height: 56px; display: flex; align-items: center; justify-content: center; border-bottom: 1px solid ${T.line}">${quorum(22)}</div>
  <div style="display: flex; flex-direction: column; gap: 4px; padding: 12px 8px">${items}</div>
</nav>`
}

/** The Quorum mark: three hive cells for the three managers that must agree. */
export function quorum(size = 22, color = T.accent) {
  const cell = (cx, cy, r) => {
    const pts = []
    for (let i = 0; i < 6; i += 1) {
      const a = (Math.PI / 180) * (60 * i - 30)
      pts.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`)
    }
    return `<polygon points="${pts.join(' ')}"/>`
  }
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.6" stroke-linejoin="round">${cell(12, 6.4, 4.6)}${cell(7.4, 14.6, 4.6)}${cell(16.6, 14.6, 4.6)}</svg>`
}

function sidebar(area, screen) {
  const nav = AREA_NAV[area]
  const items = nav.items.map(([label, key]) => {
    const on = key === screen
    return `<div style="display: flex; align-items: center; gap: 8px; height: 30px; padding: 0 10px; border-radius: 2px; background: ${on ? T.accentSoft : 'transparent'}; color: ${on ? T.accent : T.ink}; font-size: 13px; font-weight: ${on ? 500 : 400}">
      <span style="width: 3px; height: 14px; border-radius: 999px; background: ${on ? T.accent : 'transparent'}; flex: none"></span>${label}
    </div>`
  }).join('')
  return `<aside style="width: 248px; flex: none; border-right: 1px solid ${T.line}; background: ${T.surface}; padding: 16px 12px">
  <div style="font-size: 11px; font-weight: 500; letter-spacing: 0.52px; color: ${T.ink3}; padding: 0 10px">${AREAS.find((a) => a.key === area).label.toUpperCase()}</div>
  <div style="font-size: 12px; color: ${T.ink3}; padding: 6px 10px 14px; line-height: 1.45">${nav.summary}</div>
  <div style="display: flex; flex-direction: column; gap: 2px">${items}</div>
</aside>`
}

function topbar({ scope = 'production', scopeKind = 'Cluster', attention = 2, connected = true }) {
  return `<header style="height: 56px; flex: none; display: flex; align-items: center; gap: 12px; padding: 0 16px; border-bottom: 1px solid ${T.line}; background: ${T.surface}">
  <div style="display: flex; align-items: center; gap: 8px; height: 27px; padding: 0 10px; border: 1px solid ${T.line}; border-radius: 2px">
    <span style="font-size: 11px; letter-spacing: 0.44px; color: ${T.ink3}">${scopeKind}</span>
    <span style="font-size: 13px; font-weight: 500; color: ${T.ink}">${scope}</span>
    <span style="color: ${T.ink3}">${icon('chevronDown', 14)}</span>
  </div>
  ${dot(connected ? 'success' : 'danger', connected ? '3 of 3 agents answering' : 'agent not answering')}
  <div style="flex: 1"></div>
  ${attention ? `<span style="display: inline-flex; align-items: center; gap: 6px; height: 27px; padding: 0 10px; border-radius: 2px; background: ${T.warningSoft}; color: ${T.warning}; font-size: 12px; font-weight: 500">${icon('alert', 14)}${attention} to decide</span>` : ''}
  <div style="display: flex; align-items: center; gap: 8px; width: 260px; height: 27px; padding: 0 10px; border: 1px solid ${T.line}; border-radius: 2px; color: ${T.ink3}">
    ${icon('search', 14)}<span style="font-size: 12px; flex: 1">Search or run…</span><span style="font-family: ${T.mono}; font-size: 11px">⌘K</span>
  </div>
  <span style="color: ${T.ink3}">${icon('refresh', 18)}</span>
  <span style="width: 26px; height: 26px; border-radius: 999px; background: ${T.muted}; display: inline-flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 600; color: ${T.ink2}">NS</span>
</header>`
}

/**
 * One console screen at desktop width.
 *
 * `title` and `purpose` are the same words as the navigation item that opens
 * it — in this design that is a derivation, not a convention someone has to
 * remember.
 */
export function screen({
  area, screen: scr, title, purpose, actions = '', body,
  crumbTail = '', scope, scopeKind, attention, connected, width = 1440,
}) {
  const areaLabel = AREAS.find((a) => a.key === area).label
  const crumb = `<div style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: ${T.ink3}; margin-bottom: 8px">
    <span>${areaLabel}</span><span style="opacity: 0.5">${icon('chevron', 12)}</span><span style="color: ${crumbTail ? T.ink3 : T.ink2}">${title}</span>
    ${crumbTail ? `<span style="opacity: 0.5">${icon('chevron', 12)}</span><span style="color: ${T.ink2}">${crumbTail}</span>` : ''}
  </div>`
  return `<div style="width: ${width}px; min-height: 100%; display: flex; flex-direction: column; background: ${T.canvas}; font-family: ${T.sans}; font-size: 13px; color: ${T.ink}; letter-spacing: -0.006em">
  ${topbar({ scope, scopeKind, attention, connected })}
  <div style="flex: 1; display: flex; min-height: 0">
    ${rail(area)}
    ${sidebar(area, scr)}
    <main style="flex: 1; min-width: 0; padding: 24px">
      ${crumb}
      <div style="display: flex; align-items: flex-start; gap: 16px; margin-bottom: 16px">
        <div style="flex: 1; min-width: 0">
          <h1 style="margin: 0; font-size: 24px; font-weight: 600; letter-spacing: -0.43px; color: ${T.ink}">${title}</h1>
          <p style="margin: 4px 0 0; font-size: 13px; color: ${T.ink3}; max-width: 62ch; line-height: 1.45">${purpose}</p>
        </div>
        <div style="display: flex; align-items: center; gap: 8px; padding-top: 4px">${actions}</div>
      </div>
      ${body}
    </main>
  </div>
</div>`
}

const HELMET = `<helmet>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap"/>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; background: ${T.canvas}; font-family: ${T.sans}; -webkit-font-smoothing: antialiased; font-variant-numeric: tabular-nums; }
    a { color: ${T.accent}; text-decoration: none; }
    a:hover { color: ${T.accentHover}; }
    table { font-variant-numeric: tabular-nums; }
  </style>
</helmet>`

/** Wraps authored markup as a Design Component artboard. */
export function artboard(inner) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
${HELMET}
${inner}
</x-dc>
</body>
</html>
`
}
