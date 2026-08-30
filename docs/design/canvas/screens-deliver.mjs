import { T, icon, badge, dot, button, mono, panel, insight, insights, table, meter, gauge, codeBlock, areaChart, sparkline, dualChart, walk, screen } from './lib.mjs'

const tab = (label, on) => `<span style="display: inline-flex; align-items: center; height: 32px; padding: 0 12px; font-size: 13px; font-weight: ${on ? 500 : 400}; color: ${on ? T.ink : T.ink3}; border-bottom: 2px solid ${on ? T.accent : 'transparent'}">${label}</span>`

const chartCard = (label, value, sub, series, colour, id) => `
<div style="border: 1px solid ${T.line}; border-radius: 3px; background: ${T.surface}; padding: 12px">
  <div style="display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 8px">
    <span style="font-size: 11px; font-weight: 500; letter-spacing: 0.44px; color: ${T.ink3}">${label}</span>
    <span style="font-family: ${T.mono}; font-size: 16px; color: ${T.ink}">${value}</span>
  </div>
  ${areaChart(series, { h: 64, color: colour, id })}
  <div style="font-size: 11px; color: ${T.ink3}; margin-top: 6px">${sub}</div>
</div>`

/* ═══════════════════════════════════════════════════════════════════════
   APPLICATIONS
   ═══════════════════════════════════════════════════════════════════════ */

export const Apps = screen({
  area: 'apps',
  screen: 'apps',
  title: 'Applications',
  purpose: 'The products you operate. One row is one lifecycle: its image, its domain, and what it is serving right now.',
  actions: `${button('Deploy', { tone: 'primary', ic: 'play' })}`,
  body: `
${insights([
  insight('Running', '7', 'Six are serving every replica they asked for.', { tone: 'success' }),
  insight('Degraded', '1', 'checkout-api has 2 of 3 tasks. The third cannot be placed.', { tone: 'warning', link: 'Explain →' }),
  insight('Deployed today', '3', 'All three rolled without dropping a request.', {}),
  insight('Requests', '1.2k/min', 'Across every published route, measured at the gateway.', { link: 'Gateway →' }),
])}

${panel('Applications', table(
  [
    { label: 'Application' }, { label: 'Domain' }, { label: 'Running' }, { label: 'Replicas' },
    { label: 'CPU' }, { label: 'Memory' }, { label: 'Traffic' }, { label: 'Last release' },
  ],
  [
    [
      `<div><div style="font-size: 13px; font-weight: 500">checkout-api</div>${dot('warning', '2 of 3 tasks')}</div>`,
      `<a href="#">checkout.nim.zone</a>`,
      mono('41ab77c'), mono('2 / 3'), mono('27%'), mono('3.8 GB'),
      sparkline(walk(5, 24, { base: 60, vol: 12 }), { w: 72, h: 18, color: T.accent }),
      `<span style="color: ${T.ink3}">38 min ago · admin</span>`,
    ],
    [
      `<div><div style="font-size: 13px; font-weight: 500">api-gateway</div>${dot('success', '3 of 3 tasks')}</div>`,
      `<a href="#">api.nim.zone</a>`,
      mono('9f2c1ab'), mono('3 / 3'), mono('14%'), mono('2.1 GB'),
      sparkline(walk(6, 24, { base: 70, vol: 8 }), { w: 72, h: 18, color: T.accent }),
      `<span style="color: ${T.ink3}">4 min ago · admin</span>`,
    ],
    [
      `<div><div style="font-size: 13px; font-weight: 500">shop-web</div>${dot('success', '2 of 2 tasks')}</div>`,
      `<a href="#">nim.zone</a>`,
      mono('41ab77c'), mono('2 / 2'), mono('6%'), mono('820 MB'),
      sparkline(walk(7, 24, { base: 40, vol: 16 }), { w: 72, h: 18, color: T.accent }),
      `<span style="color: ${T.ink3}">38 min ago · admin</span>`,
    ],
    [
      `<div><div style="font-size: 13px; font-weight: 500">worker</div>${dot('success', '3 of 3 tasks')}</div>`,
      `<span style="color: ${T.ink3}">Not published</span>`,
      mono('41ab77c'), mono('3 / 3'), mono('31%'), mono('1.2 GB'),
      `<span style="color: ${T.ink3}; font-size: 11px">No route</span>`,
      `<span style="color: ${T.ink3}">38 min ago · admin</span>`,
    ],
    [
      `<div><div style="font-size: 13px; font-weight: 500">docs</div>${dot('success', '1 of 1 task')}</div>`,
      `<a href="#">docs.nim.zone</a>`,
      mono('c81f0d3'), mono('1 / 1'), mono('1%'), mono('64 MB'),
      sparkline(walk(8, 24, { base: 20, vol: 10 }), { w: 72, h: 18, color: T.accent }),
      `<span style="color: ${T.ink3}">6 days ago · admin</span>`,
    ],
  ],
), { actions: `${button('Filter', { tone: 'quiet' })}${button('Compare releases', { tone: 'quiet' })}` })}`,
})

/* ═══════════════════════════════════════════════════════════════════════
   APPLICATION DETAIL
   ═══════════════════════════════════════════════════════════════════════ */

export const AppDetail = screen({
  area: 'apps',
  screen: 'apps',
  crumbTail: 'checkout-api',
  title: 'checkout-api',
  purpose: 'Serving checkout.nim.zone from ghcr.io/nimasrn/checkout:41ab77c, released 38 minutes ago.',
  actions: `${button('Deploy a new release', { tone: 'primary', ic: 'play' })}${button('Roll back', { ic: 'refresh' })}${button('Actions', { ic: 'dots' })}`,
  body: `
<div style="display: flex; gap: 4px; border-bottom: 1px solid ${T.line}; margin-bottom: 16px">
  ${tab('Overview', true)}${tab('Releases', false)}${tab('Route & domain', false)}${tab('Environment', false)}${tab('Attached services', false)}${tab('Logs', false)}
</div>

<div style="display: grid; grid-template-columns: minmax(0, 1fr) 352px; gap: 16px; align-items: start">
  <div style="display: flex; flex-direction: column; gap: 16px; min-width: 0">

    <div style="display: flex; align-items: flex-start; gap: 12px; padding: 12px; border: 1px solid ${T.warningSoft}; border-left: 2px solid ${T.warning}; border-radius: 2px; background: ${T.surface}">
      <div style="flex: 1">
        <div style="font-size: 13px; font-weight: 500">Two of three tasks are running</div>
        <div style="font-size: 12px; color: ${T.ink2}; margin-top: 3px; line-height: 1.5">
          The third task wants a node labelled <span style="font-family: ${T.mono}">tier=edge</span>. Two nodes carry that label and both already run a task of this service, so the scheduler has nowhere to put it.
        </div>
      </div>
      ${button('Show the chain')}${button('Label a node')}
    </div>

    <div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px">
      ${chartCard('Requests · 6 hours', '412/min', 'Measured at the gateway, not in the app', walk(31, 60, { base: 55, vol: 10 }), T.accent, 'ad1')}
      ${chartCard('Latency p95 · 6 hours', '184 ms', 'p50 41 ms · p99 890 ms', walk(32, 60, { base: 40, vol: 12, min: 15, max: 85 }), T.s2, 'ad2')}
      ${chartCard('5xx rate · 6 hours', '0.9%', 'Rose when the pool started timing out', walk(33, 60, { base: 20, drift: 0.6, vol: 8, min: 4, max: 78 }), T.danger, 'ad3')}
    </div>

    ${panel('Tasks', table(
      [{ label: 'Task' }, { label: 'Node' }, { label: 'CPU', right: true }, { label: 'Memory', right: true }, { label: 'Uptime', right: true }, { label: 'State' }],
      [
        [`<a href="#">checkout.1</a>`, 'node-2', mono('18.4%'), mono('1.9 / 2 GB'), mono('25 h'), dot('warning', 'Near the memory limit')],
        [`<a href="#">checkout.2</a>`, 'node-1', mono('9.2%'), mono('1.1 / 2 GB'), mono('38 m'), dot('success', 'Running')],
        [`<span style="color: ${T.ink3}">checkout.3</span>`, `<span style="color: ${T.ink3}">—</span>`, `<span style="color: ${T.ink3}">—</span>`, `<span style="color: ${T.ink3}">—</span>`, `<span style="color: ${T.ink3}">—</span>`, dot('danger', 'Cannot be placed')],
      ],
      { dense: true },
    ))}

    ${panel('Releases', table(
      [{ label: 'Image' }, { label: 'Source' }, { label: 'Released' }, { label: 'By' }, { label: 'Result' }, { label: '' }],
      [
        [mono('41ab77c'), `${icon('git', 13)} nimasrn/shop @ main`, '38 min ago', 'admin', dot('success', 'Healthy in 42 s'), badge('Running', 'accent')],
        [mono('9f2c1ab'), `${icon('git', 13)} nimasrn/shop @ main`, '3 days ago', 'admin', dot('success', 'Healthy in 51 s'), button('Roll back to this', { tone: 'quiet' })],
        [mono('c81f0d3'), `${icon('upload', 13)} uploaded archive`, '9 days ago', 'admin', dot('danger', 'Never became healthy — rolled back automatically'), ''],
      ],
      { dense: true },
    ), { meta: 'A release starts the new task first. The old one is stopped only after the new one passes its probe.' })}
  </div>

  <div style="display: flex; flex-direction: column; gap: 16px">
    ${panel('Published at', `
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px">
        <span style="color: ${T.accent}">${icon('globe', 18)}</span>
        <a href="#" style="font-size: 14px; font-weight: 500">checkout.nim.zone</a>
        <span style="color: ${T.ink3}">${icon('external', 14)}</span>
      </div>
      <dl style="display: grid; grid-template-columns: auto 1fr; gap: 7px 16px; margin: 0; font-size: 12px">
        <dt style="color: ${T.ink3}">Route</dt><dd style="margin: 0; color: ${T.ink}">HTTPS · host rule · port 8080</dd>
        <dt style="color: ${T.ink3}">Certificate</dt><dd style="margin: 0">${dot('success', 'Valid 68 more days')}</dd>
        <dt style="color: ${T.ink3}">Issued by</dt><dd style="margin: 0; color: ${T.ink}">Let’s Encrypt · DNS-01 via Cloudflare</dd>
        <dt style="color: ${T.ink3}">Health probe</dt><dd style="margin: 0">${mono('GET /healthz', { color: T.ink })} every 20 s</dd>
      </dl>
      <div style="display: flex; gap: 6px; margin-top: 12px">${button('Change domain')}${button('Unpublish', { tone: 'quiet' })}</div>`)}

    ${panel('Attached shared services', `
      <div style="display: flex; flex-direction: column; gap: 0">
        ${[
          ['PostgreSQL', 'DATABASE_URL', 'db-01 · 18 of 20 connections in use', 'warning'],
          ['Redis', 'REDIS_URL', 'db-01 · database 3', 'success'],
          ['Jaeger', 'OTEL_EXPORTER_OTLP_ENDPOINT', 'Receiving spans', 'success'],
          ['Prometheus', 'scrape target', 'Scraped every 15 s at /metrics', 'success'],
        ].map(([name, envName, meta, tone]) => `
        <div style="padding: 8px 0; border-bottom: 1px solid ${T.lineSoft}">
          <div style="display: flex; align-items: center; gap: 8px">
            ${dot(tone)}<span style="font-size: 13px; color: ${T.ink}; flex: 1">${name}</span>
            ${mono(envName, { size: 11, color: T.ink3 })}
          </div>
          <div style="font-size: 11px; color: ${T.ink3}; margin-top: 3px; padding-left: 14px">${meta}</div>
        </div>`).join('')}
      </div>`,
      { meta: 'SwarmOps wrote each of these variables. It never returns their values to a browser.', actions: button('Attach', { tone: 'quiet' }) })}

    ${panel('Placement', `
      <div style="display: flex; flex-direction: column; gap: 8px">
        ${[['node-1', 1, 'Manager'], ['node-2', 1, 'Worker'], ['web-01', 0, 'Worker · label missing']].map(([n, count, role]) => `
        <div style="display: flex; align-items: center; gap: 10px">
          <span style="font-size: 12px; color: ${T.ink}; width: 64px">${n}</span>
          <span style="display: flex; gap: 3px; flex: 1">${Array.from({ length: 3 }, (_, i) => `<span style="width: 18px; height: 18px; border-radius: 2px; background: ${i < count ? T.accent : T.muted}; border: 1px solid ${i < count ? T.accent : T.line}"></span>`).join('')}</span>
          <span style="font-size: 11px; color: ${T.ink3}">${role}</span>
        </div>`).join('')}
      </div>`,
      { note: 'One square is one task. Grey squares are capacity this service is allowed to use and is not using.' })}
  </div>
</div>`,
})

/* ═══════════════════════════════════════════════════════════════════════
   DEPLOY · stage 2, where the product earns its keep
   ═══════════════════════════════════════════════════════════════════════ */

const stage = (n, label, state) => {
  const tone = state === 'done' ? T.success : state === 'now' ? T.accent : T.ink3
  return `<div style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0">
  <span style="display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; border-radius: 999px; flex: none; font-size: 11px; font-weight: 600; ${state === 'done' ? `background: ${T.success}; color: #fff` : state === 'now' ? `background: ${T.accent}; color: #fff` : `border: 1px solid ${T.line}; color: ${T.ink3}`}">${state === 'done' ? icon('check', 12, 2) : n}</span>
  <span style="font-size: 13px; font-weight: ${state === 'now' ? 500 : 400}; color: ${tone}; white-space: nowrap">${label}</span>
  ${n < 4 ? `<span style="flex: 1; height: 1px; background: ${T.line}; min-width: 16px"></span>` : ''}
</div>`
}

const stageTrack = (active) => `
<div style="display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: ${T.surface}; border: 1px solid ${T.line}; border-radius: 2px; margin-bottom: 16px">
  ${stage(1, 'Source', active > 1 ? 'done' : active === 1 ? 'now' : 'todo')}
  ${stage(2, 'What we found', active > 2 ? 'done' : active === 2 ? 'now' : 'todo')}
  ${stage(3, 'Plan', active > 3 ? 'done' : active === 3 ? 'now' : 'todo')}
  ${stage(4, 'Release', active === 4 ? 'now' : 'todo')}
</div>`

const finding = (ic, path, meaning, decision, tone) => `
<div style="display: flex; align-items: center; gap: 10px; padding: 9px 0; border-bottom: 1px solid ${T.lineSoft}">
  <span style="color: ${T.ink3}; flex: none">${icon(ic, 16)}</span>
  <div style="flex: 1; min-width: 0">
    <div style="font-family: ${T.mono}; font-size: 12px; color: ${T.ink}">${path}</div>
    <div style="font-size: 11px; color: ${T.ink3}; margin-top: 2px">${meaning}</div>
  </div>
  ${badge(decision, tone)}
</div>`

export const Deploy = screen({
  area: 'apps',
  screen: 'deploy',
  title: 'Deploy',
  purpose: 'Point SwarmOps at code. It reads the repository, decides what can run, and rewires anything the cluster already provides.',
  actions: `${button('Save as draft', { tone: 'quiet' })}${button('Continue to plan', { tone: 'primary', ic: 'arrow' })}`,
  body: `
${stageTrack(2)}

<div style="display: grid; grid-template-columns: minmax(0, 1fr) 400px; gap: 16px; align-items: start">
  <div style="display: flex; flex-direction: column; gap: 16px; min-width: 0">

    ${panel('Source', `
      <div style="display: flex; align-items: center; gap: 12px">
        <span style="color: ${T.ink2}">${icon('git', 20)}</span>
        <div style="flex: 1; min-width: 0">
          <div style="font-size: 13px; font-weight: 500">nimasrn/shop</div>
          <div style="font-size: 12px; color: ${T.ink3}">GitHub · branch ${mono('main', { size: 11 })} · commit ${mono('41ab77c', { size: 11 })} · pushed 12 minutes ago</div>
        </div>
        ${button('Change')}
      </div>
      <div style="display: flex; gap: 8px; margin-top: 12px; padding-top: 12px; border-top: 1px solid ${T.lineSoft}">
        ${[['git', 'Git repository', true], ['upload', 'Upload an archive', false], ['down', 'Public URL', false], ['box', 'An image you pushed', false], ['document', 'Kubernetes manifests', false]].map(([ic, label, on]) => `
        <span style="display: inline-flex; align-items: center; gap: 6px; height: 27px; padding: 0 10px; border: 1px solid ${on ? T.accentLine : T.line}; border-radius: 2px; background: ${on ? T.accentSoft : 'transparent'}; color: ${on ? T.accent : T.ink2}; font-size: 12px">${icon(ic, 14)}${label}</span>`).join('')}
      </div>`)}

    ${panel('What is in the repository', `
      ${finding('document', 'docker-compose.yml', 'Seven services at the root of the tree', 'Read as evidence', 'info')}
      ${finding('document', 'services/api/Dockerfile', 'Builds against Go 1.26, exposes 8080', 'Buildable', 'accent')}
      ${finding('document', 'services/worker/Dockerfile', 'Builds against Go 1.26, no exposed port', 'Buildable', 'accent')}
      ${finding('document', 'web/Dockerfile', 'Multi-stage Node build, serves on 3000', 'Buildable', 'accent')}
      ${finding('document', 'docker-compose.override.yml', 'Binds ports to localhost and mounts the source tree', 'Development only — ignored', 'neutral')}
      ${finding('document', 'deploy/k8s/hpa.yaml', 'A Kubernetes autoscaler', 'Swarm has no equivalent', 'warning')}`,
      { meta: 'The whole tree is scanned, at any depth. Compose is read; it is never executed.', actions: button('View the tree', { tone: 'quiet' }) })}

    ${panel('What will run', table(
      [{ label: 'Service' }, { label: 'Comes from' }, { label: 'SwarmOps calls it' }, { label: 'Decision' }],
      [
        [mono('api', { color: T.ink }), 'services/api/Dockerfile', 'Application', badge('Build and deploy', 'accent')],
        [mono('worker', { color: T.ink }), 'services/worker/Dockerfile', 'Application', badge('Build and deploy', 'accent')],
        [mono('web', { color: T.ink }), 'web/Dockerfile', 'Application', badge('Build and deploy', 'accent')],
        [mono('postgres', { color: T.ink }), 'image postgres:16', 'Database', badge('Use the cluster’s', 'info')],
        [mono('redis', { color: T.ink }), 'image redis:7-alpine', 'Cache', badge('Use the cluster’s', 'info')],
        [mono('prometheus', { color: T.ink }), 'image prom/prometheus', 'Metrics', badge('Use the cluster’s', 'info')],
        [mono('jaeger', { color: T.ink }), 'image jaegertracing/all-in-one', 'Tracing', badge('Use the cluster’s', 'info')],
      ],
      { dense: true },
    ), { meta: 'Three services are yours to build. Four already exist for the whole cluster.' })}
  </div>

  <div style="display: flex; flex-direction: column; gap: 16px">
    ${panel('What gets rewired', `
      <p style="margin: 0 0 12px; font-size: 12px; color: ${T.ink2}; line-height: 1.5">
        A cluster runs one PostgreSQL, one MongoDB, one Redis, one Prometheus and one Jaeger. A repository that brings its own gets pointed at those instead — nothing is deployed twice, and nothing is silently dropped.
      </p>
      <div style="display: flex; flex-direction: column; gap: 10px">
        ${[
          ['DATABASE_URL', 'postgres://postgres:5432/shop', 'postgres://shop:••••@swarmops-postgres.internal:5432/shop', 'A database and a user are created. The password is a Swarm secret and is never shown.'],
          ['REDIS_URL', 'redis://redis:6379/0', 'redis://swarmops-redis.internal:6379/3', 'Database 3 is free on the shared instance.'],
          ['OTEL_EXPORTER_OTLP_ENDPOINT', 'http://jaeger:4318', 'http://swarmops-jaeger.internal:4318', 'Traces land beside every other application’s.'],
        ].map(([name, from, to, why]) => `
        <div style="padding: 10px; border: 1px solid ${T.line}; border-radius: 2px">
          <div style="font-family: ${T.mono}; font-size: 11px; font-weight: 500; color: ${T.ink}; margin-bottom: 6px">${name}</div>
          <div style="font-family: ${T.mono}; font-size: 11px; color: ${T.ink3}; text-decoration: line-through; word-break: break-all">${from}</div>
          <div style="display: flex; gap: 6px; align-items: flex-start; margin-top: 3px">
            <span style="color: ${T.accent}; flex: none; margin-top: -2px">${icon('arrow', 13)}</span>
            <span style="font-family: ${T.mono}; font-size: 11px; color: ${T.accent}; word-break: break-all">${to}</span>
          </div>
          <div style="font-size: 11px; color: ${T.ink3}; margin-top: 6px; line-height: 1.45">${why}</div>
        </div>`).join('')}
        <div style="padding: 10px; border: 1px solid ${T.line}; border-radius: 2px">
          <div style="font-size: 11px; font-weight: 500; color: ${T.ink}; margin-bottom: 4px">Prometheus</div>
          <div style="font-size: 11px; color: ${T.ink3}; line-height: 1.45">No container is deployed. <span style="font-family: ${T.mono}">api</span> exposes <span style="font-family: ${T.mono}">/metrics</span>, so it is added as a scrape target on the cluster’s Prometheus instead.</div>
        </div>
      </div>`,
      { meta: 'Four substitutions' })}

    ${panel('Still in the way', `
      <div style="display: flex; flex-direction: column; gap: 10px">
        <div style="display: flex; gap: 10px">
          <span style="color: ${T.warning}; flex: none">${icon('alert', 16)}</span>
          <div style="font-size: 12px; color: ${T.ink2}; line-height: 1.5">
            <span style="color: ${T.ink}; font-weight: 500">web has no health check.</span>
            Without one, a release cannot tell a started container from a working one, so it will be marked healthy the moment it starts.
            <div style="margin-top: 6px">${button('Set a health path')}</div>
          </div>
        </div>
        <div style="display: flex; gap: 10px">
          <span style="color: ${T.warning}; flex: none">${icon('alert', 16)}</span>
          <div style="font-size: 12px; color: ${T.ink2}; line-height: 1.5">
            <span style="color: ${T.ink}; font-weight: 500">hpa.yaml cannot be honoured.</span>
            Swarm has no autoscaler. Replicas are a number you set, not a target it pursues.
            <div style="margin-top: 6px">${button('Set replicas')}</div>
          </div>
        </div>
      </div>`,
      { note: 'Two warnings, no blockers. A blocker would disable the button rather than warn beside it.' })}
  </div>
</div>`,
})

/* ═══════════════════════════════════════════════════════════════════════
   DEPLOY · stage 4, the release actually happening
   ═══════════════════════════════════════════════════════════════════════ */

const step = (label, state, meta, dur) => {
  const tone = state === 'done' ? T.success : state === 'now' ? T.accent : state === 'fail' ? T.danger : T.ink3
  return `<div style="display: flex; gap: 12px">
  <div style="display: flex; flex-direction: column; align-items: center; width: 16px; flex: none">
    <span style="width: 10px; height: 10px; border-radius: 999px; margin-top: 5px; ${state === 'todo' ? `border: 1px solid ${T.line}` : `background: ${tone}`}"></span>
    <span style="flex: 1; width: 1px; background: ${T.line}"></span>
  </div>
  <div style="flex: 1; min-width: 0; padding-bottom: 14px">
    <div style="display: flex; align-items: baseline; gap: 8px">
      <span style="font-size: 13px; font-weight: ${state === 'now' ? 500 : 400}; color: ${state === 'todo' ? T.ink3 : T.ink}">${label}</span>
      <span style="flex: 1"></span>
      <span style="font-family: ${T.mono}; font-size: 11px; color: ${T.ink3}">${dur}</span>
    </div>
    <div style="font-size: 12px; color: ${T.ink3}; margin-top: 2px; line-height: 1.45">${meta}</div>
  </div>
</div>`
}

export const DeployRelease = screen({
  area: 'apps',
  screen: 'deploy',
  title: 'Deploy',
  purpose: 'Releasing shop @ 41ab77c. Every step is a durable run — closing this page does not stop it.',
  actions: `${button('Open in Runs', { ic: 'activity' })}${button('Stop after this step', { tone: 'quiet' })}`,
  body: `
${stageTrack(4)}

<div style="display: grid; grid-template-columns: minmax(0, 1fr) 400px; gap: 16px; align-items: start">
  <div style="display: flex; flex-direction: column; gap: 16px; min-width: 0">

    ${panel('Release', `
      ${step('Build api', 'done', 'ghcr.io/nimasrn/api:41ab77c · 214 MB · cached 6 of 9 layers', '1m 12s')}
      ${step('Build worker', 'done', 'ghcr.io/nimasrn/worker:41ab77c · 198 MB', '48s')}
      ${step('Build web', 'done', 'ghcr.io/nimasrn/web:41ab77c · 74 MB', '1m 31s')}
      ${step('Push to registry', 'done', 'Three tags pushed to ghcr.io', '22s')}
      ${step('Create the database and secrets', 'done', 'Database shop, user shop, password stored as a Swarm secret', '3s')}
      ${step('Start the new tasks beside the old ones', 'now', '5 of 6 tasks are running. Waiting for web.2 to pass /healthz.', '31s')}
      ${step('Publish the route', 'todo', 'checkout.nim.zone → api:8080, certificate already valid', '—')}
      ${step('Stop the previous tasks', 'todo', 'Only after every new task has answered its probe', '—')}`,
      { meta: 'Started 4 m 27 s ago by admin · run 8f21c4', actions: badge('Running', 'accent') })}

    ${panel('Build output', `
      <div style="background: ${T.sunken}; border: 1px solid ${T.line}; border-radius: 2px; padding: 10px 12px; font-family: ${T.mono}; font-size: 11.5px; line-height: 1.7; color: ${T.ink2}; max-height: 200px; overflow: hidden">
<div><span style="color: ${T.ink3}">18:41:02</span>  web        #12 [builder 6/8] RUN npm run build</div>
<div><span style="color: ${T.ink3}">18:41:44</span>  web        #12 DONE 41.6s</div>
<div><span style="color: ${T.ink3}">18:41:45</span>  web        exporting layers</div>
<div><span style="color: ${T.ink3}">18:42:12</span>  registry   pushed ghcr.io/nimasrn/web:41ab77c</div>
<div><span style="color: ${T.ink3}">18:42:31</span>  swarm      service shop_web updated (2/2 tasks)</div>
<div><span style="color: ${T.ink3}">18:42:58</span>  probe      web.1 GET /healthz 200 in 34ms</div>
<div><span style="color: ${T.accent}">18:43:29</span>  probe      web.2 GET /healthz — waiting (attempt 3 of 20)</div>
      </div>`,
      { note: 'Build output is shown while the run is live. It is not written to the audit record.' })}
  </div>

  <div style="display: flex; flex-direction: column; gap: 16px">
    ${panel('What this release creates', `
      <div style="display: flex; flex-direction: column; gap: 0">
        ${[
          ['3 Swarm services', 'api ×3, worker ×3, web ×2', 'accent'],
          ['1 overlay network', 'shop, encrypted, internal only', 'accent'],
          ['1 published route', 'checkout.nim.zone → api:8080', 'accent'],
          ['2 secrets', 'Generated database password, session key', 'accent'],
          ['1 database', 'shop on the cluster PostgreSQL', 'info'],
          ['1 scrape target', 'api /metrics on the cluster Prometheus', 'info'],
        ].map(([what, detail, tone]) => `
        <div style="display: flex; align-items: flex-start; gap: 10px; padding: 8px 0; border-bottom: 1px solid ${T.lineSoft}">
          ${dot(tone)}
          <div style="flex: 1; min-width: 0">
            <div style="font-size: 12px; color: ${T.ink}">${what}</div>
            <div style="font-size: 11px; color: ${T.ink3}; margin-top: 2px">${detail}</div>
          </div>
        </div>`).join('')}
      </div>`,
      { meta: 'Nothing outside this list is touched.' })}

    ${panel('If it fails', `
      <p style="margin: 0; font-size: 12px; color: ${T.ink2}; line-height: 1.55">
        The previous tasks are still running and still serving. A new task that never answers its probe is stopped, the route is left where it is, and the run stops at <span style="color: ${T.ink}; font-weight: 500">needs attention</span> with the reason — it is not retried blindly against a cluster whose state nobody has looked at.
      </p>
      <div style="margin-top: 10px; font-size: 12px; color: ${T.ink3}">
        Rolling back is one action on the application, and it re-sends the previous release’s exact spec.
      </div>`)}
  </div>
</div>`,
})

/* ═══════════════════════════════════════════════════════════════════════
   PLATFORM SERVICES · the cluster singletons, in one place
   ═══════════════════════════════════════════════════════════════════════ */

const service = (name, ic, state, tone, version, facts, actions) => `
<div style="border: 1px solid ${T.line}; border-radius: 3px; background: ${T.surface}; padding: 14px">
  <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px">
    <span style="color: ${tone === 'neutral' ? T.ink3 : T.accent}">${icon(ic, 20)}</span>
    <div style="flex: 1; min-width: 0">
      <div style="font-size: 14px; font-weight: 600; color: ${T.ink}">${name}</div>
      <div style="font-size: 11px; color: ${T.ink3}">${version}</div>
    </div>
    ${badge(state, tone)}
  </div>
  <dl style="display: grid; grid-template-columns: auto 1fr; gap: 5px 12px; margin: 0 0 12px; font-size: 11.5px">
    ${facts.map(([k, v]) => `<dt style="color: ${T.ink3}">${k}</dt><dd style="margin: 0; color: ${T.ink}">${v}</dd>`).join('')}
  </dl>
  <div style="display: flex; gap: 6px">${actions}</div>
</div>`

export const Platform = screen({
  area: 'apps',
  screen: 'platform',
  title: 'Platform services',
  purpose: 'One database of each engine, one Prometheus, one Jaeger — for the whole cluster. Every application is wired to these, not to its own copy.',
  actions: `${button('Deploy a service', { tone: 'primary', ic: 'plus' })}`,
  body: `
${insights([
  insight('Running', '5 of 7', 'MongoDB and Alertmanager have not been deployed.', {}),
  insight('Applications attached', '7', 'Every one of them through a generated secret.', { tone: 'success' }),
  insight('Stateful node', 'db-01', 'Every engine is pinned there. Losing it loses the data.', { tone: 'warning', link: 'Backups →' }),
  insight('Retention', '15 d / 7 d', 'Metrics for fifteen days, container logs for seven.', {}),
])}

<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px">
  ${service('PostgreSQL', 'database', 'Serving', 'success', '16.4 · pinned to db-01', [
    ['Storage', '38 GB of 200 GB'],
    ['Databases', '4 · one per application'],
    ['Connections', '31 of 100'],
    ['Backup', 'Nightly to S3 · verified 6 h ago'],
  ], `${button('Databases')}${button('Backups')}${button('Remove', { tone: 'quiet' })}`)}

  ${service('Redis', 'database', 'Serving', 'success', '7.4 · pinned to db-01', [
    ['Memory', '1.2 GB of 4 GB'],
    ['Databases in use', '3 of 16'],
    ['Persistence', 'AOF every second'],
    ['Backup', 'Not backed up — cache only'],
  ], `${button('Databases')}${button('Remove', { tone: 'quiet' })}`)}

  ${service('MongoDB', 'database', 'Not deployed', 'neutral', 'Would run 7.0', [
    ['Storage', 'Would claim 100 GB on db-01'],
    ['Applications waiting', 'None'],
    ['', ''],
    ['', ''],
  ], `${button('Deploy', { tone: 'primary' })}`)}

  ${service('Prometheus', 'activity', 'Scraping', 'success', '3.14 · pinned to db-01', [
    ['Targets', '3 hosts · 34 containers · 7 applications'],
    ['Series', '412k active'],
    ['Storage', '18 GB of 60 GB · 15 d retained'],
    ['Scrape interval', '15 s'],
  ], `${button('Targets')}${button('Retention')}`)}

  ${service('Jaeger', 'route', 'Receiving', 'success', '2.20 · pinned to db-01', [
    ['Applications reporting', '2 of 7'],
    ['Spans', '4.1M in the last day'],
    ['Storage', 'Badger · 6 GB · 3 d retained'],
    ['Note', 'Durable only on db-01'],
  ], `${button('Traces')}${button('Retention')}`)}

  ${service('Alertmanager', 'alert', 'Not deployed', 'neutral', 'Would run 0.33', [
    ['Rules ready', '11 shipped rules, none firing anywhere'],
    ['Routes', 'No destination configured'],
    ['', ''],
    ['', ''],
  ], `${button('Deploy', { tone: 'primary' })}`)}
</div>

<div style="margin-top: 16px">
  ${panel('Why there is only one of each', `
    <p style="margin: 0; font-size: 13px; color: ${T.ink2}; line-height: 1.6; max-width: 92ch">
      Six applications with six PostgreSQL containers is six things to back up, six versions to patch, and six sets of credentials nobody wrote down. When a deployment brings its own database, cache, metrics or tracing service, SwarmOps creates a database and a user on the shared engine and rewrites the application’s connection variables to point at it. The repository is unchanged; what runs is different, and the difference is shown before anything is deployed.
    </p>
    <div style="margin-top: 12px; display: flex; gap: 20px; font-size: 12px; color: ${T.ink3}">
      <span>${dot('info')} Substituted at deploy time, never at runtime</span>
      <span>${dot('info')} Credentials are Swarm secrets, generated per application</span>
      <span>${dot('info')} A dashboard container from a repository is refused, not replaced</span>
    </div>`)}
</div>`,
})
