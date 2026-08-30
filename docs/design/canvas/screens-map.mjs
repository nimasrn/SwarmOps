import { T, icon, badge, dot, mono, quorum } from './lib.mjs'

/* ═══════════════════════════════════════════════════════════════════════
   THE MAP · six areas, and where every existing screen went
   ═══════════════════════════════════════════════════════════════════════ */

const areaCard = (ic, name, purpose, screens, objects) => `
<div style="border: 1px solid ${T.line}; border-radius: 3px; background: ${T.surface}; padding: 14px; display: flex; flex-direction: column; gap: 12px">
  <div style="display: flex; align-items: center; gap: 8px">
    <span style="width: 28px; height: 28px; border-radius: 3px; background: ${T.accentSoft}; color: ${T.accent}; display: inline-flex; align-items: center; justify-content: center; flex: none">${icon(ic, 17)}</span>
    <span style="font-size: 14px; font-weight: 600; color: ${T.ink}">${name}</span>
  </div>
  <p style="margin: 0; font-size: 12px; color: ${T.ink3}; line-height: 1.5; min-height: 54px">${purpose}</p>
  <div>
    <div style="font-size: 10.5px; font-weight: 500; letter-spacing: 0.5px; color: ${T.ink3}; margin-bottom: 6px">SCREENS</div>
    <div style="display: flex; flex-direction: column; gap: 3px">
      ${screens.map((s) => `<div style="font-size: 12px; color: ${T.ink}; padding: 3px 0">${s}</div>`).join('')}
    </div>
  </div>
  ${objects.length ? `<div style="padding-top: 10px; border-top: 1px solid ${T.lineSoft}">
    <div style="font-size: 10.5px; font-weight: 500; letter-spacing: 0.5px; color: ${T.ink3}; margin-bottom: 6px">AND THE THINGS THEY OPEN</div>
    <div style="display: flex; flex-wrap: wrap; gap: 4px">
      ${objects.map((o) => `<span style="display: inline-flex; padding: 3px 7px; border: 1px solid ${T.line}; border-radius: 2px; font-size: 11px; color: ${T.ink2}">${o}</span>`).join('')}
    </div>
  </div>` : ''}
</div>`

const moved = (from, to, why) => `
<div style="display: grid; grid-template-columns: 210px 24px 210px minmax(0, 1fr); gap: 12px; align-items: start; padding: 10px 0; border-bottom: 1px solid ${T.lineSoft}">
  <span style="font-size: 12px; color: ${T.ink3}">${from}</span>
  <span style="color: ${T.ink3}; margin-top: 1px">${icon('arrow', 14)}</span>
  <span style="font-size: 12px; color: ${T.ink}; font-weight: 500">${to}</span>
  <span style="font-size: 12px; color: ${T.ink2}; line-height: 1.5">${why}</span>
</div>`

export const Map = `<div style="width: 1520px; min-height: 100%; background: ${T.canvas}; font-family: ${T.sans}; color: ${T.ink}; padding: 36px 40px; letter-spacing: -0.006em">
  <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px">${quorum(22)}<span style="font-size: 14px; font-weight: 600">SwarmOps</span><span style="font-size: 13px; color: ${T.ink3}">console information architecture</span></div>
  <h1 style="margin: 0 0 6px; font-size: 26px; font-weight: 600; letter-spacing: -0.55px">Six places, named after what you came to do</h1>
  <p style="margin: 0 0 24px; font-size: 13.5px; color: ${T.ink2}; max-width: 104ch; line-height: 1.6">
    The console had eight areas and twenty-four flat screens, and its two largest — <em>Deliver</em> and <em>Workloads</em> — were the same object at two points in its life, which is why an application and the service running it lived in different halves of the navigation. There are now six areas and, more importantly, the depth has moved: you open a <strong>thing</strong> — a machine, a container, an application, a run — and everything about that thing is on its page, including its metrics. <em>Observe</em> is gone as a destination for exactly that reason. A chart with no object beside it can never answer “for which node?”.
  </p>

  <div style="display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 12px; margin-bottom: 28px">
    ${areaCard('home', 'Home', 'What production is doing, and the one thing worth doing about it.', ['Overview'], [])}
    ${areaCard('apps', 'Apps', 'What you ship, and the shared services it runs against. Shipping and running are one lifecycle, not two areas.', ['Applications', 'Deploy', 'Platform services', 'Images &amp; registries', 'Stacks &amp; services'], ['An application', 'A release', 'A build'])}
    ${areaCard('server', 'Machines', 'The hosts, their agents, and the cluster they form. Setup and diagnostics belong to a host, so they live on its page.', ['Machines', 'Swarm', 'Containers', 'Storage &amp; networks'], ['A machine', 'A container', 'A volume', 'A network'])}
    ${areaCard('globe', 'Traffic', 'How a request from the internet reaches a workload — and what that traffic actually looks like.', ['Gateway', 'Routes', 'Domains &amp; DNS', 'Certificates'], ['A route', 'A certificate'])}
    ${areaCard('activity', 'Activity', 'Everything this console did, and everything it may do.', ['Runs', 'Logs', 'Audit', 'Action catalog'], ['A run', 'An audit record'])}
    ${areaCard('control', 'Control', 'The controller itself and the software on every host. The core is a destination now, not a footnote.', ['Core', 'Agents &amp; updates', 'Settings &amp; access'], ['A release', 'A backup'])}
  </div>

  <div style="display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr); gap: 24px; align-items: start">
    <div>
      <h2 style="margin: 0 0 4px; font-size: 17px; font-weight: 600; letter-spacing: -0.3px">What moved, and why</h2>
      <p style="margin: 0 0 8px; font-size: 12.5px; color: ${T.ink3}; line-height: 1.5">Nothing is removed. Every screen that exists today has a home, and most of them stopped being screens.</p>
      ${moved('Observe → Health', 'The object’s own page', 'A fleet-wide chart cannot say which node it means. CPU for node-2 lives on node-2.')}
      ${moved('Observe → Collectors', 'Apps → Platform services', 'Prometheus and Jaeger are shared services an application uses, not a separate discipline.')}
      ${moved('Fleet → Host setup', 'A machine’s Setup tab', 'Readiness is a property of one host. It was never a fleet-wide screen.')}
      ${moved('Fleet → Connection diagnostics', 'A machine’s Agent tab', 'You diagnose a connection to a machine, while looking at that machine.')}
      ${moved('Deliver + Workloads', 'Apps', 'An application, its services and its releases are one lifecycle. Splitting them filed shipping under setup.')}
      ${moved('Deliver → Import from Kubernetes', 'A source kind inside Deploy', 'It is a way to start a deployment, not a place you visit.')}
      ${moved('Control → Controller &amp; recovery', 'Control → Core', 'Ten pending timeline rows described a procedure nobody had started. Three steps describe the one they will.')}
      ${moved('Traffic → Gateway &amp; ports', 'Traffic → Gateway', 'Same screen, now with the gateway’s own request, latency and error metrics on it.')}
    </div>

    <div>
      <h2 style="margin: 0 0 4px; font-size: 17px; font-weight: 600; letter-spacing: -0.3px">Rules the screens are held to</h2>
      <p style="margin: 0 0 12px; font-size: 12.5px; color: ${T.ink3}; line-height: 1.5">Carried forward from the current console, because they were right; two are new.</p>
      <div style="display: flex; flex-direction: column; gap: 10px">
        ${[
          ['A screen answers, it does not report', 'Two to four readings under the title: a figure, what it means, and where to act on it. A fifth is a table.'],
          ['Nothing is drawn that does nothing', 'A button with no handler teaches an operator that the console is a mock-up of itself.'],
          ['A number states its scope', 'New. Every figure says whether it is this container, this machine, or the cluster — the confusion this redesign started from.'],
          ['Metrics live on their object', 'New. There is no metrics area. A machine has charts; a container has charts; the gateway has charts.'],
          ['Status is words as well as colour', 'The accent is green on this colourway, so a green dot alone can never carry “healthy”.'],
          ['A prerequisite is a row with a button', 'Never a switch that quietly means “install Docker”.'],
          ['Every action shows what it will do first', 'Target, expected result, impact, blockers — then the button.'],
          ['A failure says what to run', 'One production command, for this exact host, not a documentation link with placeholders in it.'],
        ].map(([title, body]) => `
        <div style="display: flex; gap: 10px">
          <span style="color: ${T.accent}; flex: none; margin-top: 1px">${icon('check', 15)}</span>
          <div><div style="font-size: 12.5px; font-weight: 500; color: ${T.ink}">${title}</div><div style="font-size: 12px; color: ${T.ink3}; margin-top: 2px; line-height: 1.5">${body}</div></div>
        </div>`).join('')}
      </div>
    </div>
  </div>
</div>`

/* ═══════════════════════════════════════════════════════════════════════
   THE MODEL · what actually talks to what
   ═══════════════════════════════════════════════════════════════════════ */

const box = (x, y, w, h, title, lines, { tone = 'neutral', dashed = false } = {}) => {
  const stroke = tone === 'accent' ? T.accentLine : tone === 'info' ? 'rgba(47,106,208,0.32)' : T.line
  const fill = tone === 'accent' ? T.accentSoft : tone === 'info' ? T.infoSoft : T.surface
  return `<g>
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="${fill}" stroke="${stroke}" stroke-width="1"${dashed ? ' stroke-dasharray="4 3"' : ''}/>
  <text x="${x + 12}" y="${y + 20}" font-family="${T.sans}" font-size="13" font-weight="600" fill="${T.ink}">${title}</text>
  ${lines.map((l, i) => `<text x="${x + 12}" y="${y + 38 + i * 15}" font-family="${T.sans}" font-size="11" fill="${T.ink3}">${l}</text>`).join('')}
</g>`
}

const arrow = (x1, y1, x2, y2, label, { dashed = false, colour = T.ink3, lx = 0, ly = -6, anchor = 'middle' } = {}) => `<g>
  <path d="M${x1} ${y1} L${x2} ${y2}" stroke="${colour}" stroke-width="1.25" fill="none"${dashed ? ' stroke-dasharray="4 3"' : ''} marker-end="url(#head)"/>
  ${label ? `<text x="${(x1 + x2) / 2 + lx}" y="${(y1 + y2) / 2 + ly}" text-anchor="${anchor}" font-family="${T.sans}" font-size="10.5" fill="${T.ink3}">${label}</text>` : ''}
</g>`

const DEFS = `<defs>
  <marker id="head" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
    <path d="M0 0 L8 4 L0 8 z" fill="${T.ink3}"/>
  </marker>
</defs>`

export const Model = `<div style="width: 1440px; min-height: 100%; background: ${T.canvas}; font-family: ${T.sans}; color: ${T.ink}; padding: 36px 40px; letter-spacing: -0.006em">
  <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px">${quorum(22)}<span style="font-size: 14px; font-weight: 600">SwarmOps</span><span style="font-size: 13px; color: ${T.ink3}">how the pieces actually talk</span></div>
  <h1 style="margin: 0 0 6px; font-size: 26px; font-weight: 600; letter-spacing: -0.55px">One controller, an agent on every host, and nothing that dials in</h1>
  <p style="margin: 0 0 22px; font-size: 13.5px; color: ${T.ink2}; max-width: 106ch; line-height: 1.6">
    Two paths, drawn separately because they fail separately. The control path is how a decision becomes a change on a host; the observation path is how a reading gets back. Ansible is not in either of them — an agent that is already installed, already authenticated and already resumable is a better transport than an SSH session that has to be re-established for every task.
  </p>

  <div style="border: 1px solid ${T.line}; border-radius: 3px; background: ${T.surface}; padding: 18px 20px; margin-bottom: 18px">
    <div style="font-size: 13px; font-weight: 600; margin-bottom: 2px">Control · a decision becomes a change</div>
    <div style="font-size: 12px; color: ${T.ink3}; margin-bottom: 12px">Every mutation is written down before it is sent, and no host ever opens a port for the controller.</div>
    <svg viewBox="0 0 1340 250" width="100%" height="250" style="display: block">
      ${DEFS}
      ${box(0, 78, 150, 70, 'Browser', ['You, pressing a button'])}
      ${box(215, 30, 300, 190, 'SwarmOps Core', [
        'One host process. No Docker socket.',
        'Runs anywhere — inside or outside the cluster.',
        '',
        '· API and this console',
        '· Sealed state: machines, specs, audit',
        '· The run ledger — written before sending',
      ], { tone: 'accent' })}
      ${box(600, 30, 280, 190, 'Agent on each host', [
        'A host process, not a container.',
        'Answers while Docker is stopped.',
        '',
        '· Dials out; nothing dials in',
        '· Leases one run at a time',
        '· Resumes after hours offline',
      ], { tone: 'accent' })}
      ${box(960, 30, 240, 88, 'Docker Engine', ['Local socket, never proxied', 'Only catalogued command shapes'])}
      ${box(960, 148, 240, 72, 'The host itself', ['Packages, firewall, disks', 'Same closed catalogue'])}
      ${arrow(150, 113, 213, 113, 'HTTPS')}
      ${arrow(598, 82, 517, 82, 'outbound mutual TLS', { lx: 0, ly: -8 })}
      ${arrow(517, 130, 598, 130, 'the run, on that same connection', { dashed: true, ly: 16 })}
      ${arrow(880, 74, 958, 74, '')}
      ${arrow(880, 184, 958, 184, '')}
      <text x="557" y="176" text-anchor="middle" font-family="${T.sans}" font-size="10.5" fill="${T.ink3}">the agent asks;</text>
      <text x="557" y="190" text-anchor="middle" font-family="${T.sans}" font-size="10.5" fill="${T.ink3}">core answers</text>
      ${box(215, 236, 985, 0, '', [])}
    </svg>
    <div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; margin-top: 4px; padding-top: 14px; border-top: 1px solid ${T.lineSoft}">
      ${[
        ['Written before it is sent', 'A run exists in the sealed ledger before any agent hears about it, so an interrupted controller loses nothing.'],
        ['Queued, never streamed', 'A network that dies for six hours delays a run; it does not lose one. The agent picks up where it stopped.'],
        ['Duplicates collapse', 'A newer identical request for the same machine, action and target replaces the older queued one instead of running twice.'],
        ['Failures stop, they do not guess', 'A deterministic failure is not retried into a cluster nobody has looked at. It waits, with the reason and the command to run.'],
      ].map(([t, b]) => `<div><div style="font-size: 12px; font-weight: 500; color: ${T.ink}; margin-bottom: 3px">${t}</div><div style="font-size: 11.5px; color: ${T.ink3}; line-height: 1.5">${b}</div></div>`).join('')}
    </div>
  </div>

  <div style="border: 1px solid ${T.line}; border-radius: 3px; background: ${T.surface}; padding: 18px 20px">
    <div style="font-size: 13px; font-weight: 600; margin-bottom: 2px">Observation · a reading gets back</div>
    <div style="font-size: 12px; color: ${T.ink3}; margin-bottom: 12px">The agent is the only collector. It measures the host it lives on and every container on it, and exposes both on one endpoint.</div>
    <svg viewBox="0 0 1340 220" width="100%" height="220" style="display: block">
      ${DEFS}
      ${box(0, 24, 260, 172, 'Agent /metrics', [
        'One endpoint per host, 15 s tick.',
        '',
        '· CPU, load, memory, swap',
        '· Every disk and every filesystem',
        '· Network in and out per interface',
        '· Per container: CPU, memory, net, I/O',
        '· Its own queue depth and lease age',
      ], { tone: 'accent' })}
      ${box(360, 44, 250, 96, 'Prometheus', ['One per cluster. Targets come', 'from the enrolled machines —', 'nobody edits a scrape file.'], { tone: 'info' })}
      ${box(360, 160, 250, 40, 'Jaeger', ['One per cluster, for traces'], { tone: 'info' })}
      ${box(710, 44, 250, 96, 'Core', ['Reads Prometheus and renders', 'the console’s own panels.', 'No second dashboard to run.'], { tone: 'accent' })}
      ${box(1060, 24, 260, 172, 'Where you see it', [
        '',
        '· A machine’s page — its host charts',
        '· A container’s page — its own charts',
        '· An application — request rate, latency',
        '· The gateway — traffic and errors',
        '· Home — the fleet, at a glance',
      ])}
      ${arrow(262, 92, 358, 92, 'scraped')}
      ${arrow(612, 92, 708, 92, 'queried')}
      ${arrow(962, 92, 1058, 92, 'drawn')}
      ${arrow(612, 178, 708, 140, '', { dashed: true })}
      <text x="130" y="212" text-anchor="middle" font-family="${T.sans}" font-size="10.5" fill="${T.ink3}">no cAdvisor, no node-exporter, no privileged extra container</text>
    </svg>
    <div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; margin-top: 4px; padding-top: 14px; border-top: 1px solid ${T.lineSoft}">
      ${[
        ['Container logs, seven days', 'Collected on the host that produced them and searchable across the fleet. Turn it off per machine and the collection stops rather than silently failing.'],
        ['Traefik measures the traffic', 'Requests, latency percentiles and error rates come from the gateway’s own metrics, so an application’s numbers do not depend on the application.'],
        ['Everything published goes through Traefik', 'Applications, TCP and UDP, and this console if you publish it. Agents deliberately do not — the gateway is a thing you install with agents, so it cannot be what they need to reach you.'],
      ].map(([t, b]) => `<div><div style="font-size: 12px; font-weight: 500; color: ${T.ink}; margin-bottom: 3px">${t}</div><div style="font-size: 11.5px; color: ${T.ink3}; line-height: 1.5">${b}</div></div>`).join('')}
    </div>
  </div>
</div>`
