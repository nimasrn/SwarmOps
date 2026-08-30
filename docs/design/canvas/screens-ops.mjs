import { T, icon, badge, dot, button, mono, panel, insight, insights, table, meter, gauge, codeBlock, areaChart, sparkline, dualChart, walk, screen } from './lib.mjs'

const chartCard = (label, value, sub, svg) => `
<div style="border: 1px solid ${T.line}; border-radius: 3px; background: ${T.surface}; padding: 12px">
  <div style="display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 8px">
    <span style="font-size: 11px; font-weight: 500; letter-spacing: 0.44px; color: ${T.ink3}">${label}</span>
    <span style="font-family: ${T.mono}; font-size: 16px; color: ${T.ink}">${value}</span>
  </div>
  ${svg}
  <div style="font-size: 11px; color: ${T.ink3}; margin-top: 6px">${sub}</div>
</div>`

/* ═══════════════════════════════════════════════════════════════════════
   GATEWAY · the Traefik dashboard the product pointed at but never drew
   ═══════════════════════════════════════════════════════════════════════ */

export const Gateway = screen({
  area: 'traffic',
  screen: 'gateway',
  title: 'Gateway',
  purpose: 'One Traefik owns the edge of this cluster. This is what it is carrying, and where it is failing.',
  actions: `${button('Add a route', { tone: 'primary', ic: 'plus' })}${button('Reconcile', { ic: 'refresh' })}`,
  body: `
${insights([
  insight('Requests', '1.2k/min', 'Across 14 routers on three nodes.', {}),
  insight('Failing', '0.4%', 'Almost all of it is checkout-api returning 502.', { tone: 'warning', link: 'checkout-api →' }),
  insight('Latency p95', '184 ms', 'p50 is 41 ms. The tail is one slow route.', {}),
  insight('Certificates', '4', 'One renews in nine days, automatically.', { tone: 'success', link: 'Certificates →' }),
])}

<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-bottom: 16px">
  ${chartCard('Requests and errors · 6 hours', '1.2k/min', 'Solid line is all requests, dashed is 5xx', dualChart(
    walk(61, 60, { base: 55, vol: 9 }),
    walk(62, 60, { base: 12, drift: 0.4, vol: 6, min: 2, max: 60 }),
    { h: 68, id: 'gw1' },
  ))}
  ${chartCard('Latency · 6 hours', '184 ms', 'p95. The step at 14:20 is the checkout release.', areaChart(walk(63, 60, { base: 30, vol: 6, min: 18, max: 82 }), { h: 68, color: T.s2, id: 'gw2' }))}
  ${chartCard('Bytes · 6 hours', '312 Mb/s', 'Out. Inbound is 46 Mb/s.', areaChart(walk(64, 60, { base: 50, vol: 13 }), { h: 68, color: T.s5, id: 'gw3' }))}
</div>

<div style="display: grid; grid-template-columns: minmax(0, 1fr) 352px; gap: 16px; align-items: start">
  <div style="display: flex; flex-direction: column; gap: 16px; min-width: 0">
    ${panel('Busiest routes', table(
      [{ label: 'Route' }, { label: 'Serves' }, { label: 'Req/min', right: true }, { label: 'p95', right: true }, { label: '4xx', right: true }, { label: '5xx', right: true }, { label: 'Last hour' }],
      [
        [`<a href="#">api.nim.zone</a>`, 'api-gateway', mono('612'), mono('38 ms'), mono('0.2%'), mono('0.0%'), sparkline(walk(71, 30, { base: 60, vol: 8 }), { w: 84, h: 18 })],
        [`<a href="#">checkout.nim.zone</a>`, 'checkout-api', mono('412'), mono('890 ms'), mono('1.1%'), `<span style="color: ${T.danger}; font-family: ${T.mono}">1.4%</span>`, sparkline(walk(72, 30, { base: 55, vol: 14 }), { w: 84, h: 18, color: T.danger })],
        [`<a href="#">nim.zone</a>`, 'shop-web', mono('148'), mono('24 ms'), mono('0.0%'), mono('0.0%'), sparkline(walk(73, 30, { base: 40, vol: 10 }), { w: 84, h: 18 })],
        [`<a href="#">docs.nim.zone</a>`, 'docs', mono('31'), mono('12 ms'), mono('0.0%'), mono('0.0%'), sparkline(walk(74, 30, { base: 20, vol: 8 }), { w: 84, h: 18 })],
        [`<a href="#">:30001 (TCP)</a>`, 'swarmops-postgres', mono('—'), mono('—'), mono('—'), mono('—'), `<span style="font-size: 11px; color: ${T.ink3}">18 connections</span>`],
      ],
      { dense: true },
    ), { meta: 'From Traefik’s own metrics, scraped by the cluster Prometheus every 15 seconds.' })}

    ${panel('Entry points', table(
      [{ label: 'Port' }, { label: 'Protocol' }, { label: 'Purpose' }, { label: 'Routes' }, { label: 'State' }],
      [
        [mono(':80'), 'HTTP', 'Redirects everything to 443', mono('—'), dot('success', 'Listening on 3 nodes')],
        [mono(':443'), 'HTTPS', 'Every published application', mono('12'), dot('success', 'Listening on 3 nodes')],
        [mono(':30001'), 'TCP', 'PostgreSQL, reachable from the office CIDR only', mono('1'), dot('success', 'Listening on 3 nodes')],
        [mono(':30002'), 'UDP', 'Game server, allocated automatically', mono('1'), dot('success', 'Listening on 3 nodes')],
        [mono(':8082'), 'HTTP', 'Traefik’s own metrics, internal only', mono('—'), dot('info', 'Cluster-internal')],
      ],
      { dense: true },
    ), { meta: 'A TCP or UDP route gets a port from the 30000–32767 range unless you name one.', actions: button('Add an entry point', { tone: 'quiet' }) })}
  </div>

  <div style="display: flex; flex-direction: column; gap: 16px">
    ${panel('Installation', `
      <dl style="display: grid; grid-template-columns: auto 1fr; gap: 7px 16px; margin: 0; font-size: 12px">
        <dt style="color: ${T.ink3}">Version</dt><dd style="margin: 0">${mono('traefik:v3.6', { color: T.ink })}</dd>
        <dt style="color: ${T.ink3}">Mode</dt><dd style="margin: 0; color: ${T.ink}">Global — one task per node</dd>
        <dt style="color: ${T.ink3}">Dashboard</dt><dd style="margin: 0"><a href="#">traefik.nim.zone</a></dd>
        <dt style="color: ${T.ink3}">Certificates</dt><dd style="margin: 0; color: ${T.ink}">DNS-01 via Cloudflare</dd>
      </dl>
      <div style="margin-top: 12px; display: flex; flex-direction: column; gap: 6px">
        ${[['node-1', 'success', 'Serving · 6 d'], ['node-2', 'danger', 'Not started — port 443 is taken'], ['web-01', 'success', 'Serving · 6 d']].map(([n, tone, meta]) => `
        <div style="display: flex; align-items: center; gap: 8px; padding: 6px 0; border-bottom: 1px solid ${T.lineSoft}">
          ${dot(tone)}<span style="font-size: 12px; width: 60px">${n}</span>
          <span style="font-size: 11px; color: ${T.ink3}; flex: 1">${meta}</span>
          ${tone === 'danger' ? button('Fix') : ''}
        </div>`).join('')}
      </div>`)}

    ${panel('Certificates', `
      <div style="display: flex; flex-direction: column; gap: 0">
        ${[
          ['checkout.nim.zone', '68 days', 'success'],
          ['api.nim.zone', '68 days', 'success'],
          ['nim.zone', '9 days', 'warning'],
          ['docs.nim.zone', '54 days', 'success'],
        ].map(([host, left, tone]) => `
        <div style="display: flex; align-items: center; gap: 10px; padding: 7px 0; border-bottom: 1px solid ${T.lineSoft}">
          ${dot(tone)}<span style="font-size: 12px; flex: 1">${host}</span>
          <span style="font-family: ${T.mono}; font-size: 11px; color: ${T.ink3}">${left}</span>
        </div>`).join('')}
      </div>`,
      { note: 'Renewal starts 30 days out and retries on its own. A failure appears as a decision on the overview.' })}

    ${panel('Where SwarmOps uses the gateway', `
      <p style="margin: 0; font-size: 12px; color: ${T.ink2}; line-height: 1.55">
        Everything the cluster publishes goes through Traefik: applications, TCP and UDP services, the shared databases when you expose them, and this console itself if you publish it.
      </p>
      <p style="margin: 10px 0 0; font-size: 12px; color: ${T.ink3}; line-height: 1.55">
        Agents do not. They reach the controller directly over pinned mutual TLS, because a cluster you cannot reach is exactly when you need them — including before a gateway exists at all.
      </p>`)}
  </div>
</div>`,
})

/* ═══════════════════════════════════════════════════════════════════════
   ROUTES
   ═══════════════════════════════════════════════════════════════════════ */

const seg = (label, on) => `<span style="display: inline-flex; align-items: center; height: 27px; padding: 0 12px; font-size: 12px; font-weight: 500; border: 1px solid ${on ? T.accentLine : T.line}; background: ${on ? T.accentSoft : T.surface}; color: ${on ? T.accent : T.ink2}">${label}</span>`

export const Routes = screen({
  area: 'traffic',
  screen: 'routes',
  title: 'Routes',
  purpose: 'Which hostname or port reaches which workload, and whether it is actually serving.',
  actions: `${button('Add a route', { tone: 'primary', ic: 'plus' })}`,
  body: `
${insights([
  insight('Published', '14', 'Twelve over HTTPS, one TCP, one UDP.', {}),
  insight('Not serving', '1', 'staging.nim.zone points at a service with no tasks.', { tone: 'warning' }),
  insight('Ports allocated', '2', 'From the 30000–32767 range reserved for TCP and UDP.', {}),
  insight('Private', '3', 'Reachable only from the office CIDR.', {}),
])}

<div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px">
  <div style="display: flex">${seg('All · 14', true)}${seg('HTTP · 12', false)}${seg('TCP · 1', false)}${seg('UDP · 1', false)}</div>
  <div style="display: flex; align-items: center; gap: 8px; flex: 1; max-width: 320px; height: 27px; padding: 0 10px; border: 1px solid ${T.line}; border-radius: 2px; color: ${T.ink3}; background: ${T.surface}">${icon('search', 14)}<span style="font-size: 12px">Filter routes…</span></div>
</div>

${panel('', table(
  [{ label: 'Rule' }, { label: 'Kind' }, { label: 'Reaches' }, { label: 'Port' }, { label: 'TLS' }, { label: 'Exposure' }, { label: 'Traffic' }, { label: 'State' }],
  [
    [`<span style="font-weight: 500">checkout.nim.zone</span>`, badge('HTTPS', 'accent'), `<a href="#">checkout-api</a>`, mono('8080'), dot('success', 'Valid'), 'Public', sparkline(walk(81, 24, { base: 55, vol: 12 }), { w: 72, h: 18 }), dot('warning', '1.4% failing')],
    [`<span style="font-weight: 500">api.nim.zone</span>`, badge('HTTPS', 'accent'), `<a href="#">api-gateway</a>`, mono('8080'), dot('success', 'Valid'), 'Public', sparkline(walk(82, 24, { base: 65, vol: 8 }), { w: 72, h: 18 }), dot('success', 'Serving')],
    [`<span style="font-weight: 500">nim.zone</span>`, badge('HTTPS', 'accent'), `<a href="#">shop-web</a>`, mono('3000'), dot('warning', '9 days'), 'Public', sparkline(walk(83, 24, { base: 45, vol: 11 }), { w: 72, h: 18 }), dot('success', 'Serving')],
    [`<span style="font-weight: 500">staging.nim.zone</span>`, badge('HTTPS', 'accent'), `<span style="color: ${T.ink3}">staging-web</span>`, mono('3000'), dot('success', 'Valid'), 'Office CIDR', `<span style="font-size: 11px; color: ${T.ink3}">No traffic</span>`, dot('danger', 'No tasks behind it')],
    [`<span style="font-weight: 500">:30001</span>`, badge('TCP', 'info'), `<a href="#">swarmops-postgres</a>`, mono('5432'), `<span style="color: ${T.ink3}">—</span>`, 'Office CIDR', `<span style="font-size: 11px; color: ${T.ink3}">18 open</span>`, dot('success', 'Listening')],
    [`<span style="font-weight: 500">:30002</span>`, badge('UDP', 'info'), `<a href="#">game-server</a>`, mono('7777'), `<span style="color: ${T.ink3}">—</span>`, 'Public', `<span style="font-size: 11px; color: ${T.ink3}">2.1 Mb/s</span>`, dot('success', 'Listening')],
  ],
), { meta: 'A route is created with the application by default. Nothing is public until you say so.' })}

<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin-top: 16px">
  ${panel('Add a route', `
    <div style="display: flex; flex-direction: column; gap: 12px">
      <div>
        <div style="font-size: 11px; font-weight: 500; letter-spacing: 0.44px; color: ${T.ink3}; margin-bottom: 4px">Kind</div>
        <div style="display: flex">${seg('HTTPS', true)}${seg('TCP', false)}${seg('UDP', false)}</div>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px">
        <div>
          <div style="font-size: 11px; font-weight: 500; letter-spacing: 0.44px; color: ${T.ink3}; margin-bottom: 4px">Hostname</div>
          <div style="display: flex; align-items: center; height: 33px; padding: 0 10px; border: 1px solid ${T.line}; border-radius: 2px; font-size: 13px; color: ${T.ink}">shop.<span style="color: ${T.ink3}">nim.zone</span></div>
        </div>
        <div>
          <div style="font-size: 11px; font-weight: 500; letter-spacing: 0.44px; color: ${T.ink3}; margin-bottom: 4px">Reaches</div>
          <div style="display: flex; align-items: center; height: 33px; padding: 0 10px; border: 1px solid ${T.line}; border-radius: 2px; font-size: 13px; color: ${T.ink}">shop-web<span style="flex: 1"></span><span style="color: ${T.ink3}">${icon('chevronDown', 14)}</span></div>
        </div>
      </div>
      <div style="padding: 10px; border-radius: 2px; background: ${T.muted}; font-size: 12px; color: ${T.ink2}; line-height: 1.5">
        The certificate is requested through Cloudflare DNS-01 the moment this is applied. The DNS record is created for you; nothing has to exist first.
      </div>
      <div>${button('Review and apply', { tone: 'primary' })}</div>
    </div>`,
    { meta: 'No label, rule or provider URL is ever typed by hand.' })}

  ${panel('Exposure', `
    <p style="margin: 0 0 12px; font-size: 13px; color: ${T.ink2}; line-height: 1.55">
      A new route is private until it is published. Private means the gateway answers only from the CIDRs you named, and the certificate is still issued so the hostname works the moment you open it up.
    </p>
    <div style="display: flex; flex-direction: column; gap: 8px">
      ${[['Public', 'Anyone on the internet', '11 routes'], ['Office CIDR', '203.0.113.0/24 and 10.0.0.0/8', '3 routes'], ['Cluster only', 'No entry point at all', '6 services']].map(([name, meaning, count]) => `
      <div style="display: flex; align-items: center; gap: 10px; padding: 8px 10px; border: 1px solid ${T.line}; border-radius: 2px">
        <div style="flex: 1"><div style="font-size: 12px; color: ${T.ink}">${name}</div><div style="font-size: 11px; color: ${T.ink3}; margin-top: 2px">${meaning}</div></div>
        <span style="font-family: ${T.mono}; font-size: 11px; color: ${T.ink3}">${count}</span>
      </div>`).join('')}
    </div>`)}
</div>`,
})

/* ═══════════════════════════════════════════════════════════════════════
   RUNS · the durable command ledger, with one run opened
   ═══════════════════════════════════════════════════════════════════════ */

const runRow = (action, target, state, tone, attempts, when, dur, on = false) => [
  `<div style="display: flex; align-items: center; gap: 8px">${on ? `<span style="color: ${T.accent}">${icon('chevronDown', 13)}</span>` : `<span style="color: ${T.ink3}">${icon('chevron', 13)}</span>`}${mono(action, { color: T.ink })}</div>`,
  `<span style="color: ${T.ink2}">${target}</span>`,
  dot(tone, state),
  mono(attempts),
  `<span style="color: ${T.ink3}">${when}</span>`,
  mono(dur),
]

export const Runs = screen({
  area: 'activity',
  screen: 'runs',
  title: 'Runs',
  purpose: 'Every operation SwarmOps was asked to perform: what it was, where it went, how it ended, and what to do about it.',
  actions: `${button('Retry all failed', { ic: 'refresh' })}`,
  body: `
${insights([
  insight('Needs attention', '1', 'A gateway install stopped rather than retrying blindly.', { tone: 'danger' }),
  insight('Running', '1', 'A release, on its sixth of eight steps.', { tone: 'accent' }),
  insight('Queued', '0', 'Nothing is waiting for an agent to pick it up.', {}),
  insight('Succeeded today', '23', 'Median 4.1 seconds from queued to done.', { tone: 'success' }),
])}

<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px">
  <div style="display: flex">${seg('All', true)}${seg('Needs attention · 1', false)}${seg('Running · 1', false)}${seg('Succeeded', false)}</div>
  <div style="display: flex; align-items: center; gap: 8px; flex: 1; max-width: 280px; height: 27px; padding: 0 10px; border: 1px solid ${T.line}; border-radius: 2px; color: ${T.ink3}; background: ${T.surface}">${icon('search', 14)}<span style="font-size: 12px">Filter by action or target…</span></div>
  ${button('Any machine', { ic: 'chevronDown' })}
  ${button('Last 24 hours', { ic: 'chevronDown' })}
</div>

<div style="display: grid; grid-template-columns: minmax(0, 1fr) 420px; gap: 16px; align-items: start">
  ${panel('', table(
    [{ label: 'Action' }, { label: 'Target' }, { label: 'State' }, { label: 'Attempts', right: true }, { label: 'Queued' }, { label: 'Took', right: true }],
    [
      runRow('traefik.reconcile', 'node-2', 'Needs attention', 'danger', '3 of 8', '4 min ago', '2.1 s', true),
      runRow('application.deploy', 'checkout-api → node-1', 'Running · step 6 of 8', 'accent', '1', '5 min ago', '4m 27s'),
      runRow('image.build', 'checkout-api 41ab77c', 'Succeeded', 'success', '1', '41 min ago', '3m 51s'),
      runRow('node.availability', 'web-01 → drain', 'Succeeded', 'success', '1', '2 h ago', '0.8 s'),
      runRow('database.create', 'shop on PostgreSQL', 'Succeeded', 'success', '1', '5 min ago', '3.0 s'),
      runRow('agent.update', 'web-01 → v0.11.0', 'Superseded', 'neutral', '1', '3 h ago', '—'),
      runRow('packages.update', 'node-1', 'Succeeded', 'success', '2', 'yesterday', '1m 04s'),
    ],
  ), { meta: 'A newer identical request replaces an older queued one rather than running twice.' })}

  ${panel('traefik.reconcile', `
    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px">
      ${badge('Needs attention', 'danger')}${mono('run 8f21c4', { size: 11 })}
      <span style="flex: 1"></span>${button('Retry', { tone: 'primary' })}
    </div>

    <dl style="display: grid; grid-template-columns: auto 1fr; gap: 7px 16px; margin: 0 0 14px; font-size: 12px">
      <dt style="color: ${T.ink3}">Requested by</dt><dd style="margin: 0; color: ${T.ink}">admin, from Gateway</dd>
      <dt style="color: ${T.ink3}">Machine</dt><dd style="margin: 0"><a href="#">node-2</a> · 10.0.0.12</dd>
      <dt style="color: ${T.ink3}">Authority term</dt><dd style="margin: 0">${mono('4', { color: T.ink })}</dd>
      <dt style="color: ${T.ink3}">Idempotency key</dt><dd style="margin: 0">${mono('a41f…c9', { color: T.ink3 })}</dd>
      <dt style="color: ${T.ink3}">Replaced</dt><dd style="margin: 0; color: ${T.ink2}">One identical queued run, 6 minutes ago</dd>
    </dl>

    <div style="font-size: 11px; font-weight: 500; letter-spacing: 0.44px; color: ${T.ink3}; margin-bottom: 8px">LIFECYCLE</div>
    <div style="display: flex; flex-direction: column; margin-bottom: 14px">
      ${[
        ['Accepted and written to the ledger', 'success', '18:39:58.104', 'Before anything was sent anywhere'],
        ['Leased by the agent on node-2', 'success', '18:40:01.882', 'Poll answered in 3.8 s'],
        ['Running', 'success', '18:40:02.010', 'docker service create traefik'],
        ['Failed — port occupied', 'danger', '18:40:04.117', 'Attempt 1 of 8'],
        ['Retried after 2 s, 4 s, then 8 s', 'danger', '18:40:16.402', 'Same result each time'],
        ['Stopped', 'danger', '18:40:16.402', 'The failure is deterministic. Retrying will not change it.'],
      ].map(([label, tone, at, meta], i, all) => `
      <div style="display: flex; gap: 10px">
        <div style="display: flex; flex-direction: column; align-items: center; width: 12px; flex: none">
          <span style="width: 7px; height: 7px; border-radius: 999px; margin-top: 5px; background: ${tone === 'success' ? T.success : T.danger}"></span>
          ${i < all.length - 1 ? `<span style="flex: 1; width: 1px; background: ${T.line}"></span>` : ''}
        </div>
        <div style="flex: 1; min-width: 0; padding-bottom: ${i < all.length - 1 ? 10 : 0}px">
          <div style="display: flex; align-items: baseline; gap: 8px">
            <span style="font-size: 12px; color: ${T.ink}">${label}</span><span style="flex: 1"></span>${mono(at, { size: 10.5, color: T.ink3 })}
          </div>
          <div style="font-size: 11px; color: ${T.ink3}; margin-top: 2px">${meta}</div>
        </div>
      </div>`).join('')}
    </div>

    <div style="padding: 12px; border-radius: 2px; background: ${T.dangerSoft}">
      <div style="font-size: 12px; font-weight: 500; color: ${T.ink}; margin-bottom: 6px">Port 443 on node-2 is already bound</div>
      <p style="margin: 0 0 10px; font-size: 12px; color: ${T.ink2}; line-height: 1.5">
        A process SwarmOps does not manage is listening on 443. Traefik is a global service, so it will keep failing on this node while the other two serve.
      </p>
      <div style="font-size: 11px; font-weight: 500; letter-spacing: 0.44px; color: ${T.ink3}; margin-bottom: 6px">RUN THIS ON node-2</div>
      ${codeBlock('sudo ss -ltnp \'sport = :443\'')}
      <div style="display: flex; gap: 6px; margin-top: 10px">${button('Run it from here', { tone: 'primary' })}${button('Open node-2')}</div>
    </div>

    <div style="margin-top: 12px; font-size: 11px; color: ${T.ink3}; line-height: 1.5">
      The agent reported a failure class, not a message. SwarmOps maps that class to this explanation; raw remote output never crosses the boundary.
    </div>`,
    { meta: 'Queued 18:39:58 · node-2 · attempt 3 of 8' })}
</div>`,
})
