import { T, icon, badge, dot, button, mono, panel, insight, insights, table, meter, gauge, codeBlock, areaChart, sparkline, dualChart, walk, screen } from './lib.mjs'

/* ═══════════════════════════════════════════════════════════════════════
   HOME · the one screen an operator opens by reflex
   ═══════════════════════════════════════════════════════════════════════ */

const decision = (tone, title, evidence, action) => `
<div style="display: flex; align-items: flex-start; gap: 12px; padding: 12px; border: 1px solid ${tone === 'danger' ? T.dangerSoft : T.warningSoft}; border-left: 2px solid ${tone === 'danger' ? T.danger : T.warning}; border-radius: 2px; background: ${T.surface}">
  <div style="flex: 1; min-width: 0">
    <div style="font-size: 13px; font-weight: 500; color: ${T.ink}">${title}</div>
    <div style="font-size: 12px; color: ${T.ink2}; margin-top: 3px; line-height: 1.5">${evidence}</div>
  </div>
  ${button(action, { tone: 'default' })}
</div>`

const activityRow = (action, target, state, tone, when) => [
  `<span style="font-family: ${T.mono}; font-size: 12px">${action}</span>`,
  `<span style="color: ${T.ink2}">${target}</span>`,
  dot(tone, state),
  `<span style="color: ${T.ink3}">${when}</span>`,
]

export const Home = screen({
  area: 'home',
  screen: 'home',
  title: 'Overview',
  purpose: 'What production is doing, and the one thing worth doing about it.',
  actions: `${button('Deploy', { tone: 'primary', ic: 'play' })}${button('Add a machine', { ic: 'plus' })}`,
  body: `
${insights([
  insight('Applications', '7', 'One is degraded — checkout-api has 2 of 3 tasks.', { tone: 'warning', link: 'Apps →' }),
  insight('Machines', '3 / 3', '48 cores and 188 GB answering right now.', { link: 'Machines →' }),
  insight('Open decisions', '2', 'A stopped run and an agent two releases behind.', { tone: 'warning', link: 'Runs →' }),
  insight('Public traffic', '1.2k/min', '0.4% of responses were 5xx in the last hour.', { link: 'Gateway →' }),
])}

<div style="display: grid; grid-template-columns: minmax(0, 1fr) 352px; gap: 16px; align-items: start">
  <div style="display: flex; flex-direction: column; gap: 16px; min-width: 0">

    ${panel('Needs a decision', `
      <div style="display: flex; flex-direction: column; gap: 8px">
        ${decision('danger', 'The gateway could not start on node-2', 'Port 443 on 10.0.0.12 is already bound by a process SwarmOps does not own. Nothing else in the run failed, and the other two nodes are serving.', 'Open the run')}
        ${decision('warning', 'web-01 is running an agent two releases behind', 'v0.10.4 against a fleet on v0.11.0. It still answers, but it cannot accept the container-metrics command the other two accept.', 'Update the agent')}
      </div>`,
      { meta: 'One row is one action, not one record. A failed run and its failed retry are one decision.' })}

    ${panel('Fleet load', `
      <div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px">
        ${[
          ['CPU', '34%', '16.3 of 48 cores', walk(11, 40, { base: 34, vol: 5, min: 12, max: 62 }), T.accent],
          ['Memory', '41%', '77 of 188 GB', walk(23, 40, { base: 41, vol: 3, min: 30, max: 55 }), T.s2],
          ['Disk', '46%', '1.24 of 2.7 TB', walk(37, 40, { base: 46, vol: 1, min: 44, max: 49 }), T.s6],
          ['Network', '84 Mb/s', 'in, across three hosts', walk(51, 40, { base: 60, vol: 14, min: 10, max: 96 }), T.s5],
        ].map(([label, value, sub, series, colour], i) => `
        <div>
          <div style="display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 6px">
            <span style="font-size: 11px; font-weight: 500; letter-spacing: 0.44px; color: ${T.ink3}">${label}</span>
            <span style="font-family: ${T.mono}; font-size: 15px; color: ${T.ink}">${value}</span>
          </div>
          ${areaChart(series, { h: 54, color: colour, id: `home${i}` })}
          <div style="font-size: 11px; color: ${T.ink3}; margin-top: 4px">${sub}</div>
        </div>`).join('')}
      </div>`,
      { meta: 'Every machine, last six hours. Collected by the agent on each host.', actions: button('6h', { tone: 'quiet' }) })}

    ${panel('Recent activity', table(
      [{ label: 'Action' }, { label: 'Target' }, { label: 'State' }, { label: 'When', right: true }],
      [
        activityRow('traefik.reconcile', 'node-2', 'Needs attention', 'danger', '4 min ago'),
        activityRow('application.deploy', 'checkout-api → node-1', 'Succeeded', 'success', '38 min ago'),
        activityRow('image.build', 'checkout-api 41ab77c', 'Succeeded', 'success', '41 min ago'),
        activityRow('node.availability', 'web-01 → drain', 'Succeeded', 'success', '2 h ago'),
        activityRow('docker.install', 'db-01', 'Succeeded', 'success', 'yesterday'),
      ],
      { dense: true },
    ), { actions: button('All runs', { tone: 'quiet' }) })}
  </div>

  <div style="display: flex; flex-direction: column; gap: 16px">
    ${panel('Control plane', `
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px">
        <span style="color: ${T.accent}">${icon('control', 20)}</span>
        <div style="flex: 1; min-width: 0">
          <div style="font-size: 14px; font-weight: 600; color: ${T.ink}">core-1</div>
          <div style="font-size: 12px; color: ${T.ink3}">${'Active · authority term 4'}</div>
        </div>
        ${badge('Serving', 'success')}
      </div>
      <dl style="display: grid; grid-template-columns: auto 1fr; gap: 6px 16px; margin: 0; font-size: 12px">
        <dt style="color: ${T.ink3}">Runs on</dt><dd style="margin: 0; color: ${T.ink}">nima-mbp · outside the cluster</dd>
        <dt style="color: ${T.ink3}">Version</dt><dd style="margin: 0">${mono('v0.11.0', { color: T.ink })}</dd>
        <dt style="color: ${T.ink3}">Uptime</dt><dd style="margin: 0; color: ${T.ink}">12 days</dd>
        <dt style="color: ${T.ink3}">State</dt><dd style="margin: 0; color: ${T.ink}">412 MB sealed · backed up 6 h ago</dd>
      </dl>
      <div style="margin-top: 12px; padding: 10px; border-radius: 2px; background: ${T.accentSoft}; display: flex; align-items: center; gap: 10px">
        <div style="flex: 1; font-size: 12px; color: ${T.ink2}">v0.11.1 is available. The update starts beside this one and only retires it once the new process answers.</div>
        ${button('Review', { tone: 'primary' })}
      </div>`,
      { meta: 'The controller is not a node. It holds state; it never touches Docker.' })}

    ${panel('Shared services', `
      <div style="display: flex; flex-direction: column; gap: 2px">
        ${[
          ['PostgreSQL', 'success', '16.4 · db-01 · 4 apps attached'],
          ['Redis', 'success', '7.4 · db-01 · 3 apps attached'],
          ['MongoDB', 'neutral', 'Not deployed'],
          ['Prometheus', 'success', '3 nodes · 34 containers · 15 d retained'],
          ['Jaeger', 'success', '2 apps reporting traces'],
          ['Log collection', 'success', '34 containers · 7 d retained'],
        ].map(([name, tone, meta]) => `
        <div style="display: flex; align-items: center; gap: 10px; padding: 7px 0; border-bottom: 1px solid ${T.lineSoft}">
          ${dot(tone)}
          <span style="font-size: 13px; color: ${T.ink}; width: 108px; flex: none">${name}</span>
          <span style="font-size: 12px; color: ${T.ink3}; flex: 1; min-width: 0">${meta}</span>
        </div>`).join('')}
      </div>`,
      { meta: 'One of each, for the whole cluster. A deployment that brings its own is rewired to these.' })}
  </div>
</div>`,
})

/* ═══════════════════════════════════════════════════════════════════════
   MACHINES · the fleet, with its load on the same screen as its identity
   ═══════════════════════════════════════════════════════════════════════ */

const machineRow = (name, ip, role, roleTone, agent, agentTone, cpu, cpuSeries, mem, disk, containers, state, stateTone) => [
  `<div style="display: flex; align-items: center; gap: 10px">
    <span style="color: ${T.ink3}">${icon('server', 18)}</span>
    <div><div style="font-size: 13px; font-weight: 500; color: ${T.ink}">${name}</div>${mono(ip, { size: 11, color: T.ink3 })}</div>
  </div>`,
  badge(role, roleTone),
  `<div style="display: flex; align-items: center; gap: 8px">${mono(agent)}${agentTone === 'warning' ? badge('2 behind', 'warning') : ''}</div>`,
  `<div style="display: flex; align-items: center; gap: 10px">${sparkline(cpuSeries, { w: 64, h: 18, color: T.accent })}${mono(`${cpu}%`, { color: T.ink })}</div>`,
  meter(mem, { tone: mem > 80 ? 'warning' : 'accent', w: 56 }),
  meter(disk, { tone: disk > 80 ? 'warning' : 'accent', w: 56 }),
  mono(String(containers), { color: T.ink }),
  dot(stateTone, state),
]

export const Machines = screen({
  area: 'machines',
  screen: 'machines',
  title: 'Machines',
  purpose: 'Every host under management, what it is running, and how hard it is working.',
  actions: `${button('Add a machine', { tone: 'primary', ic: 'plus' })}${button('Run a command', { ic: 'terminal' })}`,
  body: `
${insights([
  insight('Under management', '3', 'All three answered a poll in the last ten seconds.', { tone: 'success' }),
  insight('Swarm managers', '1', 'One manager cannot survive its own reboot. Promote two more.', { tone: 'warning', link: 'Swarm →' }),
  insight('Capacity in use', '41%', '77 GB of 188 GB reserved across the fleet.', {}),
  insight('Containers', '34', 'Across three hosts, 34 reporting metrics and logs.', { link: 'Containers →' }),
])}

${panel('Fleet', table(
  [
    { label: 'Machine' }, { label: 'Swarm role' }, { label: 'Agent' }, { label: 'CPU' },
    { label: 'Memory' }, { label: 'Disk' }, { label: 'Containers', right: false }, { label: 'Connection' },
  ],
  [
    machineRow('node-1', '10.0.0.11', 'Manager · leader', 'accent', 'v0.11.0', 'ok', 38, walk(3, 24, { base: 38, vol: 9 }), 52, 44, 14, 'Answering · 2 s', 'success'),
    machineRow('node-2', '10.0.0.12', 'Worker', 'neutral', 'v0.11.0', 'ok', 61, walk(9, 24, { base: 61, vol: 11 }), 71, 39, 12, 'Answering · 4 s', 'success'),
    machineRow('web-01', '10.0.0.21', 'Worker', 'neutral', 'v0.10.4', 'warning', 12, walk(17, 24, { base: 12, vol: 6, min: 2, max: 30 }), 28, 63, 8, 'Answering · 9 s', 'success'),
  ],
), { meta: 'Numbers come from the agent on each host, not from Docker. They answer before Docker exists.', actions: button('Compare', { tone: 'quiet' }) })}

<div style="display: grid; grid-template-columns: minmax(0, 1fr) 352px; gap: 16px; margin-top: 16px; align-items: start">
  ${panel('Add a machine', `
    <p style="margin: 0 0 12px; font-size: 13px; color: ${T.ink2}; line-height: 1.5; max-width: 66ch">
      One command on the host. It installs the agent as a system service, generates its private key locally, pins this controller's certificate, and connects outward — so the machine never opens a port for us and needs no SSH key from us.
    </p>
    ${codeBlock(`curl -fsSL https://get.swarmops.dev/agent | sudo bash -s -- \\
  --core https://core.nim.zone --code 7K2M-9QX4-P3RV-8ZTN`)}
    <div style="display: flex; align-items: center; gap: 10px; margin-top: 12px; font-size: 12px; color: ${T.ink3}">
      ${dot('info')} The code expires in 15 minutes and can be redeemed once.
      <span style="flex: 1"></span>
      ${button('Regenerate', { tone: 'quiet' })}
    </div>`,
    { meta: 'Docker is not required first. Install it from the machine’s own page once the agent answers.' })}

  ${panel('Waiting for a machine', `
    <div style="display: flex; flex-direction: column; gap: 0">
      ${[
        ['Command copied', 'success', 'Ready to paste on the host'],
        ['Agent installed', 'success', 'systemd unit swarmops-agent, enabled'],
        ['Identity approved', 'success', 'Certificate issued, code burned'],
        ['First poll received', 'accent', 'Waiting… normally under 10 seconds'],
        ['Host inspected', 'neutral', 'OS, CPU, memory, disk, Docker state'],
      ].map(([label, tone, meta], i, all) => `
      <div style="display: flex; gap: 10px">
        <div style="display: flex; flex-direction: column; align-items: center; width: 14px; flex: none">
          <span style="width: 8px; height: 8px; border-radius: 999px; margin-top: 5px; background: ${tone === 'success' ? T.success : tone === 'accent' ? T.accent : T.muted}; ${tone === 'neutral' ? `border: 1px solid ${T.line}` : ''}"></span>
          ${i < all.length - 1 ? `<span style="flex: 1; width: 1px; background: ${T.line}"></span>` : ''}
        </div>
        <div style="padding-bottom: ${i < all.length - 1 ? 12 : 0}px">
          <div style="font-size: 13px; color: ${tone === 'neutral' ? T.ink3 : T.ink}">${label}</div>
          <div style="font-size: 12px; color: ${T.ink3}; margin-top: 1px">${meta}</div>
        </div>
      </div>`).join('')}
    </div>`,
    { meta: 'Live while you paste. A step that fails says which one and what to run.' })}
</div>`,
})

/* ═══════════════════════════════════════════════════════════════════════
   MACHINE DETAIL · the per-node dashboard the product did not have
   ═══════════════════════════════════════════════════════════════════════ */

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

export const MachineDetail = screen({
  area: 'machines',
  screen: 'machines',
  crumbTail: 'node-2',
  title: 'node-2',
  purpose: 'Ubuntu 24.04.1 · 6.8.0-45-generic · x86_64 · up 34 days · 10.0.0.12',
  actions: `${button('Run a command', { ic: 'terminal' })}${button('Open logs', { ic: 'document' })}${button('Actions', { ic: 'dots' })}`,
  body: `
<div style="display: flex; gap: 4px; border-bottom: 1px solid ${T.line}; margin-bottom: 16px">
  ${tab('Overview', true)}${tab('Containers · 12', false)}${tab('Logs', false)}${tab('Commands', false)}${tab('Setup', false)}${tab('Agent', false)}
</div>

<div style="display: grid; grid-template-columns: minmax(0, 1fr) 352px; gap: 16px; align-items: start">
  <div style="display: flex; flex-direction: column; gap: 16px; min-width: 0">

    <div style="display: flex; gap: 12px">
      ${gauge('CPU', '61', '%', 61, { tone: 'accent', sub: 'load 4.9 · 4.4 · 3.8 across 8 cores' })}
      ${gauge('Memory', '22.4', 'of 32 GB', 71, { tone: 'warning', sub: '2.1 GB cached · no swap in use' })}
      ${gauge('Disk /', '188', 'of 480 GB', 39, { tone: 'accent', sub: '14 GB reclaimable in Docker' })}
      ${gauge('Network', '42', 'Mb/s in', 44, { tone: 'accent', sub: '18 Mb/s out on ens3' })}
    </div>

    <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px">
      ${chartCard('CPU · 6 hours', '61%', 'Peaked at 88% during the 14:20 deploy', walk(101, 60, { base: 55, vol: 12, min: 20, max: 92 }), T.accent, 'nd1')}
      ${chartCard('Memory · 6 hours', '22.4 GB', 'Flat. Nothing on this host is leaking.', walk(202, 60, { base: 68, vol: 2, min: 62, max: 74 }), T.s2, 'nd2')}
      ${chartCard('Disk I/O · 6 hours', '31 MB/s', 'Write-heavy while the registry pulled two images', walk(303, 60, { base: 40, vol: 16, min: 4, max: 96 }), T.s6, 'nd3')}
      ${chartCard('Network · 6 hours', '42 Mb/s', 'Inbound. Egress tracks it within 10%.', walk(404, 60, { base: 46, vol: 14, min: 8, max: 90 }), T.s5, 'nd4')}
    </div>

    ${panel('Containers on this host', table(
      [{ label: 'Container' }, { label: 'Image' }, { label: 'CPU', right: true }, { label: 'Memory', right: true }, { label: 'Restarts', right: true }, { label: 'State' }],
      [
        [`<span style="font-weight: 500">production_checkout.1</span>`, mono('checkout:41ab77c'), mono('18.4%'), mono('1.9 / 2 GB'), mono('0'), dot('success', 'Up 25 h')],
        [`<span style="font-weight: 500">production_api-gateway.2</span>`, mono('api-gateway:9f2c1ab'), mono('9.1%'), mono('740 MB'), mono('0'), dot('success', 'Up 4 m')],
        [`<span style="font-weight: 500">swarmops-postgres.1</span>`, mono('postgres:16.4'), mono('21.7%'), mono('4.2 / 8 GB'), mono('0'), dot('success', 'Up 12 d')],
        [`<span style="font-weight: 500">production_worker.3</span>`, mono('worker:41ab77c'), mono('4.0%'), mono('310 MB'), mono('2'), dot('warning', 'Restarted 40 m ago')],
        [`<span style="font-weight: 500">traefik.1</span>`, mono('traefik:v3.6'), mono('2.2%'), mono('96 MB'), mono('0'), dot('success', 'Up 6 d')],
      ],
      { dense: true },
    ), { meta: 'Per-container CPU and memory come from the same agent, on the same 15-second tick.', actions: button('All 12', { tone: 'quiet' }) })}
  </div>

  <div style="display: flex; flex-direction: column; gap: 16px">
    ${panel('Agent', `
      <dl style="display: grid; grid-template-columns: auto 1fr; gap: 7px 16px; margin: 0; font-size: 12px">
        <dt style="color: ${T.ink3}">Version</dt><dd style="margin: 0">${mono('v0.11.0', { color: T.ink })} ${badge('Current', 'success')}</dd>
        <dt style="color: ${T.ink3}">Connection</dt><dd style="margin: 0; color: ${T.ink}">Outbound long poll · last 4 s ago</dd>
        <dt style="color: ${T.ink3}">Queue</dt><dd style="margin: 0; color: ${T.ink}">0 waiting · 0 running</dd>
        <dt style="color: ${T.ink3}">Service</dt><dd style="margin: 0">${mono('swarmops-agent.service', { color: T.ink })} · active</dd>
        <dt style="color: ${T.ink3}">Kept releases</dt><dd style="margin: 0">${mono('0.11.0 · 0.10.4 · 0.10.3', { color: T.ink })}</dd>
      </dl>
      <div style="display: flex; gap: 6px; margin-top: 12px">${button('Update agent')}${button('Roll back')}${button('Restart', { tone: 'quiet' })}</div>`,
      { meta: 'It runs on the host, not in a container, so it answers while Docker is down.' })}

    ${panel('Setup', `
      <div style="display: flex; flex-direction: column; gap: 0">
        ${[
          ['Docker Engine 27.3.1', 'success', 'From Docker’s signed apt repository'],
          ['Swarm · worker of node-1', 'success', 'Joined 12 days ago'],
          ['Firewall baseline', 'warning', 'Swarm ports are open to 0.0.0.0/0 rather than the peer CIDR'],
          ['Container log collection', 'success', 'Forwarding · 7 day retention'],
          ['Metrics export', 'success', 'Host and 12 containers scraped every 15 s'],
        ].map(([label, tone, meta]) => `
        <div style="display: flex; align-items: flex-start; gap: 10px; padding: 8px 0; border-bottom: 1px solid ${T.lineSoft}">
          <span style="color: ${tone === 'success' ? T.success : T.warning}; margin-top: 1px; flex: none">${icon(tone === 'success' ? 'check' : 'alert', 15)}</span>
          <div style="flex: 1; min-width: 0">
            <div style="font-size: 12px; color: ${T.ink}">${label}</div>
            <div style="font-size: 11px; color: ${T.ink3}; margin-top: 2px; line-height: 1.45">${meta}</div>
          </div>
          ${tone === 'warning' ? button('Fix') : ''}
        </div>`).join('')}
      </div>`,
      { meta: 'A missing requirement is a row with a button, never a switch.' })}

    ${panel('Recent commands here', `
      <div style="display: flex; flex-direction: column; gap: 0">
        ${[
          ['docker.install', 'Succeeded', 'success', '12 d ago · admin'],
          ['swarm.join', 'Succeeded', 'success', '12 d ago · admin'],
          ['traefik.reconcile', 'Needs attention', 'danger', '4 m ago · admin'],
          ['packages.update', 'Succeeded', 'success', '3 d ago · admin'],
        ].map(([action, state, tone, when]) => `
        <div style="display: flex; align-items: center; gap: 10px; padding: 7px 0; border-bottom: 1px solid ${T.lineSoft}">
          ${mono(action)}<span style="flex: 1"></span>${dot(tone, state)}
          <span style="font-size: 11px; color: ${T.ink3}; width: 96px; text-align: right">${when}</span>
        </div>`).join('')}
      </div>`,
      { note: 'Every command that ever touched this machine, and who asked for it.' })}
  </div>
</div>`,
})

/* ═══════════════════════════════════════════════════════════════════════
   CONTAINER DETAIL · the per-container dashboard
   ═══════════════════════════════════════════════════════════════════════ */

export const ContainerDetail = screen({
  area: 'machines',
  screen: 'containers',
  crumbTail: 'production_checkout.1',
  title: 'production_checkout.1',
  purpose: 'Task 1 of the checkout service, scheduled on node-2. Part of the checkout-api application.',
  actions: `${button('Restart')}${button('Stop')}${button('Actions', { ic: 'dots' })}`,
  body: `
<div style="display: flex; gap: 4px; border-bottom: 1px solid ${T.line}; margin-bottom: 16px">
  ${tab('Overview', true)}${tab('Logs', false)}${tab('Environment', false)}${tab('Mounts & ports', false)}${tab('Events', false)}
</div>

<div style="display: grid; grid-template-columns: minmax(0, 1fr) 352px; gap: 16px; align-items: start">
  <div style="display: flex; flex-direction: column; gap: 16px; min-width: 0">

    <div style="display: flex; gap: 12px">
      ${gauge('CPU', '18.4', '% of 2 cores', 37, { tone: 'accent', sub: 'Throttled 0 times in the last hour' })}
      ${gauge('Memory', '1.9', 'of 2 GB limit', 95, { tone: 'danger', sub: 'Within 100 MB of the limit. It will be killed.' })}
      ${gauge('Network', '6.2', 'Mb/s in', 31, { tone: 'accent', sub: '11 Mb/s out' })}
      ${gauge('Block I/O', '2.4', 'MB/s write', 12, { tone: 'accent', sub: '0.1 MB/s read' })}
    </div>

    <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px">
      ${chartCard('CPU · 1 hour', '18.4%', 'Steady, tracking request rate', walk(11, 60, { base: 18, vol: 5, min: 6, max: 34 }), T.accent, 'cd1')}
      ${chartCard('Memory · 1 hour', '1.9 GB', 'Climbing 40 MB an hour and not returning', walk(22, 60, { base: 62, drift: 0.5, vol: 1.5, min: 55, max: 97 }), T.danger, 'cd2')}
    </div>

    ${panel('Log tail', `
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px">
        <div style="display: flex; align-items: center; gap: 8px; flex: 1; height: 27px; padding: 0 10px; border: 1px solid ${T.line}; border-radius: 2px; color: ${T.ink3}">${icon('search', 14)}<span style="font-size: 12px">Filter these lines…</span></div>
        ${badge('Live', 'accent')}${button('Last 15 min', { tone: 'quiet' })}
      </div>
      <div style="background: ${T.sunken}; border: 1px solid ${T.line}; border-radius: 2px; padding: 10px 12px; font-family: ${T.mono}; font-size: 11.5px; line-height: 1.75; color: ${T.ink2}; max-height: 168px; overflow: hidden">
<div><span style="color: ${T.ink3}">18:44:02.118</span>  <span style="color: ${T.info}">INFO</span>   checkout  order 8841 authorised in 42ms</div>
<div><span style="color: ${T.ink3}">18:44:02.400</span>  <span style="color: ${T.info}">INFO</span>   checkout  order 8842 authorised in 39ms</div>
<div><span style="color: ${T.ink3}">18:44:03.912</span>  <span style="color: ${T.warning}">WARN</span>   pool      postgres pool at 18/20 connections</div>
<div><span style="color: ${T.ink3}">18:44:05.004</span>  <span style="color: ${T.info}">INFO</span>   checkout  order 8843 authorised in 51ms</div>
<div><span style="color: ${T.ink3}">18:44:06.771</span>  <span style="color: ${T.warning}">WARN</span>   pool      postgres pool at 20/20 connections, queuing</div>
<div><span style="color: ${T.ink3}">18:44:07.219</span>  <span style="color: ${T.danger}">ERROR</span>  checkout  order 8844 failed: pool timeout after 3s</div>
      </div>`,
      { meta: 'Kept for seven days on the host and searchable across the fleet.', actions: button('Open in Logs', { tone: 'quiet' }) })}
  </div>

  <div style="display: flex; flex-direction: column; gap: 16px">
    ${panel('Identity', `
      <dl style="display: grid; grid-template-columns: auto 1fr; gap: 7px 16px; margin: 0; font-size: 12px">
        <dt style="color: ${T.ink3}">State</dt><dd style="margin: 0">${dot('success', 'Running · up 25 h')}</dd>
        <dt style="color: ${T.ink3}">Image</dt><dd style="margin: 0">${mono('ghcr.io/nimasrn/checkout:41ab77c', { color: T.ink })}</dd>
        <dt style="color: ${T.ink3}">Digest</dt><dd style="margin: 0">${mono('sha256:7c41b8e…', { color: T.ink3 })}</dd>
        <dt style="color: ${T.ink3}">Host</dt><dd style="margin: 0"><a href="#">node-2</a> · 10.0.0.12</dd>
        <dt style="color: ${T.ink3}">Application</dt><dd style="margin: 0"><a href="#">checkout-api</a></dd>
        <dt style="color: ${T.ink3}">Restarts</dt><dd style="margin: 0; color: ${T.ink}">0</dd>
        <dt style="color: ${T.ink3}">Started</dt><dd style="margin: 0; color: ${T.ink}">yesterday, 17:44</dd>
      </dl>`)}

    ${panel('Environment', `
      <p style="margin: 0 0 10px; font-size: 12px; color: ${T.ink3}; line-height: 1.45">Names only. SwarmOps can tell you what a container was given; it will not read a value back out of Docker for a browser.</p>
      <div style="display: flex; flex-wrap: wrap; gap: 6px">
        ${['DATABASE_URL', 'REDIS_URL', 'OTEL_EXPORTER_OTLP_ENDPOINT', 'PORT', 'LOG_LEVEL', 'STRIPE_KEY', 'SESSION_SECRET'].map((n) => `<span style="display: inline-flex; align-items: center; gap: 5px; padding: 3px 8px; border: 1px solid ${T.line}; border-radius: 2px; font-family: ${T.mono}; font-size: 11px; color: ${T.ink2}">${['STRIPE_KEY', 'SESSION_SECRET'].includes(n) ? `<span style="color: ${T.ink3}">${icon('lock', 12)}</span>` : ''}${n}</span>`).join('')}
      </div>
      <div style="margin-top: 12px; font-size: 12px; color: ${T.ink3}">
        Three of these were written by SwarmOps when the shared PostgreSQL, Redis, and Jaeger were attached.
      </div>`)}

    ${panel('Health', `
      <div style="display: flex; align-items: flex-start; gap: 10px; padding: 10px; border-radius: 2px; background: ${T.dangerSoft}">
        <span style="color: ${T.danger}; flex: none; margin-top: 1px">${icon('alert', 16)}</span>
        <div style="font-size: 12px; color: ${T.ink2}; line-height: 1.5">
          Memory has risen 40 MB an hour for 25 hours without falling. At this rate the 2 GB limit is reached in about two hours and Docker will kill the task.
          <div style="margin-top: 8px; display: flex; gap: 6px">${button('Raise the limit')}${button('Explain', { tone: 'quiet' })}</div>
        </div>
      </div>`,
      { meta: 'Probe /healthz every 20 s · last 40 checks passed' })}
  </div>
</div>`,
})
