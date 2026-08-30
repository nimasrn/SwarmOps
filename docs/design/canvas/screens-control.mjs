import { T, icon, badge, dot, button, mono, panel, insight, insights, table, meter, gauge, codeBlock, areaChart, sparkline, walk, screen, quorum } from './lib.mjs'

/* ═══════════════════════════════════════════════════════════════════════
   CORE · the screen whose absence was the loudest complaint
   ═══════════════════════════════════════════════════════════════════════ */

export const Core = screen({
  area: 'control',
  screen: 'core',
  title: 'Core',
  purpose: 'The controller itself: where it runs, what version it is, how it is backed up, and how to move it.',
  actions: `${button('Update to v0.11.1', { tone: 'primary', ic: 'down' })}${button('Back up now', { ic: 'shield' })}`,
  body: `
${insights([
  insight('Authority', 'Held here', 'This process may change the cluster. No other core may.', { tone: 'success' }),
  insight('Version', 'v0.11.0', 'v0.11.1 is available and has been verified.', { tone: 'accent' }),
  insight('State', '412 MB', 'Sealed with AES-256-GCM. Backed up 6 hours ago.', {}),
  insight('Standbys', '0', 'Nothing could take over today. A move needs one prepared first.', { tone: 'warning' }),
])}

<div style="display: grid; grid-template-columns: minmax(0, 1fr) 400px; gap: 16px; align-items: start">
  <div style="display: flex; flex-direction: column; gap: 16px; min-width: 0">

    ${panel('This controller', `
      <div style="display: flex; align-items: flex-start; gap: 16px">
        <div style="width: 56px; height: 56px; border-radius: 3px; background: ${T.accentSoft}; display: flex; align-items: center; justify-content: center; flex: none">${quorum(30)}</div>
        <div style="flex: 1; min-width: 0">
          <div style="display: flex; align-items: center; gap: 8px">
            <span style="font-size: 18px; font-weight: 600; color: ${T.ink}">core-1</span>${badge('Active', 'success')}${badge('Authority term 4', 'neutral')}
          </div>
          <div style="font-size: 12px; color: ${T.ink3}; margin-top: 3px">Serving this console and the API since 18 August, 12 days ago.</div>
          <dl style="display: grid; grid-template-columns: auto 1fr auto 1fr; gap: 8px 16px; margin: 14px 0 0; font-size: 12px">
            <dt style="color: ${T.ink3}">Runs on</dt><dd style="margin: 0; color: ${T.ink}">nima-mbp · macOS 15.6 · arm64</dd>
            <dt style="color: ${T.ink3}">In the cluster</dt><dd style="margin: 0; color: ${T.ink}">No — and it does not need to be</dd>
            <dt style="color: ${T.ink3}">Reached at</dt><dd style="margin: 0"><a href="#">https://core.nim.zone</a></dd>
            <dt style="color: ${T.ink3}">Certificate</dt><dd style="margin: 0">${mono('SHA256:4f1a…9c2e', { size: 11 })}</dd>
            <dt style="color: ${T.ink3}">Process</dt><dd style="margin: 0; color: ${T.ink}">142 MB resident · 0.4% CPU</dd>
            <dt style="color: ${T.ink3}">Disk</dt><dd style="margin: 0; color: ${T.ink}">412 MB used · 84 GB free</dd>
          </dl>
        </div>
      </div>
      <div style="margin-top: 14px; padding: 10px 12px; border-radius: 2px; background: ${T.muted}; font-size: 12px; color: ${T.ink2}; line-height: 1.55">
        The controller is not a node and never appears in <a href="#">Machines</a>. It holds state and decides; it has no Docker socket and cannot run a container. If this machine should also be a Docker host, install an agent on it — it will then appear in Machines as a separate thing, which is what it is.
      </div>`)}

    ${panel('Version and updates', `
      <div style="display: flex; align-items: center; gap: 12px; padding: 12px; border: 1px solid ${T.accentLine}; border-radius: 2px; background: ${T.accentSoft}; margin-bottom: 14px">
        <span style="color: ${T.accent}">${icon('down', 20)}</span>
        <div style="flex: 1">
          <div style="font-size: 13px; font-weight: 500; color: ${T.ink}">v0.11.1 is ready to install</div>
          <div style="font-size: 12px; color: ${T.ink2}; margin-top: 2px">Downloaded and checksum-verified. Released 2 days ago.</div>
        </div>
        ${button('Install it', { tone: 'primary' })}${button('Release notes', { tone: 'quiet' })}
      </div>

      <div style="font-size: 11px; font-weight: 500; letter-spacing: 0.44px; color: ${T.ink3}; margin-bottom: 8px">WHAT INSTALLING DOES</div>
      <div style="display: flex; gap: 0; margin-bottom: 14px">
        ${[
          ['Download and verify', 'The bundle’s SHA-256 must match the release'],
          ['Start the new one beside this one', 'On a second port, not replacing anything yet'],
          ['Wait for it to answer', 'Its own health endpoint, up to 45 seconds'],
          ['Hand over and retire', 'This process finishes its work and exits'],
        ].map(([label, meta], i, all) => `
        <div style="flex: 1; min-width: 0; position: relative; padding-right: ${i < all.length - 1 ? 12 : 0}px">
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 5px">
            <span style="width: 18px; height: 18px; border-radius: 999px; background: ${T.surface}; border: 1px solid ${T.line}; display: inline-flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 600; color: ${T.ink2}; flex: none">${i + 1}</span>
            ${i < all.length - 1 ? `<span style="flex: 1; height: 1px; background: ${T.line}"></span>` : ''}
          </div>
          <div style="font-size: 12px; font-weight: 500; color: ${T.ink}">${label}</div>
          <div style="font-size: 11px; color: ${T.ink3}; margin-top: 2px; line-height: 1.45">${meta}</div>
        </div>`).join('')}
      </div>
      <div style="padding: 10px 12px; border-radius: 2px; background: ${T.muted}; font-size: 12px; color: ${T.ink2}; line-height: 1.55; margin-bottom: 14px">
        If the new process never answers, it is stopped and this one keeps serving. Nothing is migrated until the replacement has proved it can start.
      </div>

      <div style="font-size: 11px; font-weight: 500; letter-spacing: 0.44px; color: ${T.ink3}; margin-bottom: 8px">RELEASES KEPT ON DISK</div>
      ${table(
        [{ label: 'Version' }, { label: 'Installed' }, { label: 'Size', right: true }, { label: '' }],
        [
          [mono('v0.11.0', { color: T.ink }) + ' ' + badge('Running', 'accent'), '12 days ago', mono('38 MB'), ''],
          [mono('v0.10.4', { color: T.ink }), '3 weeks ago', mono('37 MB'), button('Roll back to this', { tone: 'quiet' })],
          [mono('v0.10.3', { color: T.ink }), '5 weeks ago', mono('37 MB'), button('Roll back to this', { tone: 'quiet' })],
        ],
        { dense: true },
      )}
      <div style="font-size: 11px; color: ${T.ink3}; margin-top: 8px">Three are kept. A fourth install deletes the oldest.</div>`,
      { meta: 'The updater is a separate small binary. It has no network control endpoint and can also update itself.' })}
  </div>

  <div style="display: flex; flex-direction: column; gap: 16px">
    ${panel('Move this controller', `
      <p style="margin: 0 0 12px; font-size: 12px; color: ${T.ink2}; line-height: 1.55">
        The controller can live anywhere — a node, a laptop, a box that has never seen Docker. Moving it moves the state with it.
      </p>
      <div style="display: flex; flex-direction: column">
        ${[
          ['Prepare the target', 'Run the core installer there in standby mode. It starts with no cluster and cannot act.', 'now'],
          ['Copy the sealed state', 'A single encrypted file plus its key, taken at the moment this one is fenced.', 'todo'],
          ['Promote the target', 'This one stops accepting work; that one takes the next authority term.', 'todo'],
        ].map(([label, meta, state], i, all) => `
        <div style="display: flex; gap: 10px">
          <div style="display: flex; flex-direction: column; align-items: center; width: 20px; flex: none">
            <span style="width: 20px; height: 20px; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 600; ${state === 'now' ? `background: ${T.accent}; color: #fff` : `border: 1px solid ${T.line}; color: ${T.ink3}`}">${i + 1}</span>
            ${i < all.length - 1 ? `<span style="flex: 1; width: 1px; background: ${T.line}"></span>` : ''}
          </div>
          <div style="flex: 1; padding-bottom: ${i < all.length - 1 ? 14 : 0}px">
            <div style="font-size: 12px; font-weight: 500; color: ${state === 'todo' ? T.ink3 : T.ink}">${label}</div>
            <div style="font-size: 11px; color: ${T.ink3}; margin-top: 2px; line-height: 1.45">${meta}</div>
          </div>
        </div>`).join('')}
      </div>
      <div style="margin-top: 12px">${button('Prepare a target', { tone: 'primary' })}</div>
      <div style="margin-top: 10px; font-size: 11px; color: ${T.ink3}; line-height: 1.5">
        There is no automatic failover, and SwarmOps will not pretend otherwise. Two active controllers would both believe they own the cluster, so a move is a deliberate act with a fence in the middle of it.
      </div>`)}

    ${panel('State and backup', `
      <dl style="display: grid; grid-template-columns: auto 1fr; gap: 7px 16px; margin: 0 0 12px; font-size: 12px">
        <dt style="color: ${T.ink3}">Holds</dt><dd style="margin: 0; color: ${T.ink}">Machines, credentials, the run ledger, audit, deployment specs</dd>
        <dt style="color: ${T.ink3}">Encryption</dt><dd style="margin: 0; color: ${T.ink}">AES-256-GCM, key held separately</dd>
        <dt style="color: ${T.ink3}">Last backup</dt><dd style="margin: 0">${dot('success', '6 hours ago · 118 MB')}</dd>
        <dt style="color: ${T.ink3}">Destination</dt><dd style="margin: 0; color: ${T.ink}">S3-compatible · verified restore 2 days ago</dd>
      </dl>
      <div style="display: flex; gap: 6px">${button('Back up now')}${button('Restore')}${button('Download key', { tone: 'quiet' })}</div>`,
      { note: 'A backup you have never restored is a hope, not a backup. The date above is a real restore.' })}

    ${panel('Access', `
      <div style="display: flex; flex-direction: column; gap: 0">
        ${[
          ['Administrator', 'admin', 'Password set 12 days ago'],
          ['Active sessions', '2', 'This browser and one other, both from 10.0.0.4'],
          ['Failed sign-ins', '0', 'In the last 24 hours'],
        ].map(([k, v, meta]) => `
        <div style="display: flex; align-items: flex-start; gap: 10px; padding: 8px 0; border-bottom: 1px solid ${T.lineSoft}">
          <span style="font-size: 12px; color: ${T.ink3}; width: 116px; flex: none">${k}</span>
          <div style="flex: 1"><div style="font-size: 12px; color: ${T.ink}">${v}</div><div style="font-size: 11px; color: ${T.ink3}; margin-top: 2px">${meta}</div></div>
        </div>`).join('')}
      </div>
      <div style="display: flex; gap: 6px; margin-top: 12px">${button('Change password')}${button('End other sessions', { tone: 'quiet' })}</div>`)}
  </div>
</div>`,
})

/* ═══════════════════════════════════════════════════════════════════════
   AGENTS & UPDATES
   ═══════════════════════════════════════════════════════════════════════ */

export const Agents = screen({
  area: 'control',
  screen: 'agents',
  title: 'Agents & updates',
  purpose: 'The software on every host: which version each machine runs, how it gets the next one, and how to put it back.',
  actions: `${button('Update the fleet', { tone: 'primary', ic: 'down' })}`,
  body: `
${insights([
  insight('On the current version', '2 of 3', 'web-01 is two releases behind and will not accept new commands.', { tone: 'warning' }),
  insight('Update policy', 'Manual', 'Nothing installs itself. You choose when, and it rolls one host at a time.', {}),
  insight('Available', 'v0.11.0', 'Verified against the release checksum.', { tone: 'accent' }),
  insight('Rollbacks kept', '3', 'Every host keeps its last three releases on disk.', {}),
])}

<div style="display: grid; grid-template-columns: minmax(0, 1fr) 400px; gap: 16px; align-items: start">
  <div style="display: flex; flex-direction: column; gap: 16px; min-width: 0">
    ${panel('Every machine', table(
      [{ label: 'Machine' }, { label: 'Running' }, { label: 'Kept on disk' }, { label: 'Connection' }, { label: 'Last updated' }, { label: '' }],
      [
        ['node-1', `${mono('v0.11.0', { color: T.ink })} ${badge('Current', 'success')}`, mono('0.11.0 · 0.10.4 · 0.10.3', { size: 11 }), dot('success', 'Answering · 2 s'), '12 days ago', button('Roll back', { tone: 'quiet' })],
        ['node-2', `${mono('v0.11.0', { color: T.ink })} ${badge('Current', 'success')}`, mono('0.11.0 · 0.10.4 · 0.10.3', { size: 11 }), dot('success', 'Answering · 4 s'), '12 days ago', button('Roll back', { tone: 'quiet' })],
        ['web-01', `${mono('v0.10.4', { color: T.ink })} ${badge('2 behind', 'warning')}`, mono('0.10.4 · 0.10.3', { size: 11 }), dot('success', 'Answering · 9 s'), '3 weeks ago', button('Update', { tone: 'primary' })],
      ],
    ), { meta: 'An agent updates itself the way the controller does: start, prove it answers, then retire the old one.' })}

    ${panel('What a stale agent costs you', `
      <p style="margin: 0 0 10px; font-size: 13px; color: ${T.ink2}; line-height: 1.55">
        An older agent is not merely old — it does not know the commands added since it shipped. web-01 cannot accept the per-container metrics command, so it appears in Machines with host readings and no container readings, and nothing else on the screen explains why.
      </p>
      <div style="display: flex; flex-direction: column; gap: 6px">
        ${[
          ['container.metrics', 'Added in v0.11.0 — web-01 will reject it', 'danger'],
          ['logs.query', 'Added in v0.11.0 — web-01 will reject it', 'danger'],
          ['docker.install', 'Available since v0.9.0', 'success'],
          ['swarm.join', 'Available since v0.9.0', 'success'],
        ].map(([name, meta, tone]) => `
        <div style="display: flex; align-items: center; gap: 10px; padding: 7px 0; border-bottom: 1px solid ${T.lineSoft}">
          ${dot(tone)}${mono(name, { color: T.ink })}<span style="flex: 1"></span>
          <span style="font-size: 11px; color: ${T.ink3}">${meta}</span>
        </div>`).join('')}
      </div>`,
      { meta: 'Derived from the action catalog, not written by hand.' })}
  </div>

  <div style="display: flex; flex-direction: column; gap: 16px">
    ${panel('How updates happen', `
      <div style="display: flex; flex-direction: column; gap: 10px">
        ${[
          ['Manual', 'You press update. One machine at a time, and it stops on the first failure.', true],
          ['Automatic, in a window', 'Same rollout, started for you inside the hours you name.', false],
          ['Never', 'Agents stay where they are until you say otherwise.', false],
        ].map(([name, meta, on]) => `
        <div style="display: flex; gap: 10px; padding: 10px; border: 1px solid ${on ? T.accentLine : T.line}; border-radius: 2px; background: ${on ? T.accentSoft : 'transparent'}">
          <span style="width: 14px; height: 14px; border-radius: 999px; border: 1px solid ${on ? T.accent : T.lineStrong}; flex: none; margin-top: 2px; display: inline-flex; align-items: center; justify-content: center">${on ? `<span style="width: 7px; height: 7px; border-radius: 999px; background: ${T.accent}"></span>` : ''}</span>
          <div><div style="font-size: 12px; font-weight: 500; color: ${T.ink}">${name}</div><div style="font-size: 11px; color: ${T.ink3}; margin-top: 2px; line-height: 1.45">${meta}</div></div>
        </div>`).join('')}
      </div>
      <div style="margin-top: 12px; font-size: 11px; color: ${T.ink3}; line-height: 1.5">
        The same three choices apply to the controller, on its own screen.
      </div>`)}

    ${panel('A rollout, step by step', `
      <div style="display: flex; flex-direction: column">
        ${[
          ['Download and verify on the host', 'The agent fetches its own bundle; the controller sends no binary'],
          ['Start the new agent on a second socket', 'The running one keeps answering polls'],
          ['Health check for up to 45 seconds', 'If it never answers, it is deleted and nothing changed'],
          ['Hand over the poll loop', 'In-flight work finishes on the old process'],
          ['Retire the old release', 'Kept on disk — this is what roll back restores'],
        ].map(([label, meta], i, all) => `
        <div style="display: flex; gap: 10px">
          <div style="display: flex; flex-direction: column; align-items: center; width: 12px; flex: none">
            <span style="width: 7px; height: 7px; border-radius: 999px; margin-top: 5px; background: ${T.accent}"></span>
            ${i < all.length - 1 ? `<span style="flex: 1; width: 1px; background: ${T.line}"></span>` : ''}
          </div>
          <div style="flex: 1; padding-bottom: ${i < all.length - 1 ? 12 : 0}px">
            <div style="font-size: 12px; color: ${T.ink}">${label}</div>
            <div style="font-size: 11px; color: ${T.ink3}; margin-top: 2px; line-height: 1.45">${meta}</div>
          </div>
        </div>`).join('')}
      </div>`,
      { note: 'A machine that goes offline mid-rollout is skipped, not abandoned: it resumes when it comes back.' })}
  </div>
</div>`,
})

/* ═══════════════════════════════════════════════════════════════════════
   FIRST RUN · one command, then a console that says what to do next
   ═══════════════════════════════════════════════════════════════════════ */

export const FirstRun = `<div style="width: 1440px; min-height: 100%; background: ${T.canvas}; font-family: ${T.sans}; color: ${T.ink}; padding: 40px 48px; letter-spacing: -0.006em">
  <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px">${quorum(24)}<span style="font-size: 15px; font-weight: 600">SwarmOps</span></div>
  <h1 style="margin: 0 0 6px; font-size: 28px; font-weight: 600; letter-spacing: -0.6px">From nothing to a console in one command</h1>
  <p style="margin: 0 0 28px; font-size: 14px; color: ${T.ink3}; max-width: 78ch; line-height: 1.55">
    The controller installs on any machine — a server, a laptop, something that has never run Docker. It prints where to reach it and the password it generated, and then it waits for you to add a machine.
  </p>

  <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px; align-items: start">
    <div>
      <div style="font-size: 11px; font-weight: 500; letter-spacing: 0.52px; color: ${T.ink3}; margin-bottom: 8px">ON THE MACHINE THAT WILL HOLD THE CONTROLLER</div>
      <div style="background: #0d1117; border: 1px solid ${T.lineStrong}; border-radius: 3px; padding: 16px 18px; font-family: ${T.mono}; font-size: 12.5px; line-height: 1.85; color: #e6edf3">
<div><span style="color: #56c98e">$</span> curl -fsSL https://get.swarmops.dev | sh</div>
<div style="color: rgba(230,237,243,0.55)">&nbsp;</div>
<div style="color: rgba(230,237,243,0.76)">  Verifying checksum for swarmops-core v0.11.1  <span style="color: #56c98e">ok</span></div>
<div style="color: rgba(230,237,243,0.76)">  Installing to /usr/local/bin/swarmops           <span style="color: #56c98e">ok</span></div>
<div style="color: rgba(230,237,243,0.76)">  Creating state at /var/lib/swarmops             <span style="color: #56c98e">ok</span></div>
<div style="color: rgba(230,237,243,0.76)">  Starting swarmops-core                          <span style="color: #56c98e">ok</span></div>
<div style="color: rgba(230,237,243,0.55)">&nbsp;</div>
<div style="color: #2fbf8f">  SwarmOps is serving.</div>
<div style="color: rgba(230,237,243,0.55)">&nbsp;</div>
<div>  Console      <span style="color: #7aa2ef">https://10.0.0.4:8084</span></div>
<div>  Username     admin</div>
<div>  Password     <span style="color: #d6a13a">jaunty-harbour-42-vellum</span></div>
<div>  Fingerprint  SHA256:4f1a…9c2e</div>
<div style="color: rgba(230,237,243,0.55)">&nbsp;</div>
<div style="color: rgba(230,237,243,0.55)">  This password is shown once. It is not stored in plain text.</div>
      </div>
      <div style="margin-top: 12px; font-size: 12px; color: ${T.ink3}; line-height: 1.55; max-width: 60ch">
        No Docker, no compose file, no reverse proxy to configure first. The controller is a single process with a single state directory, and <span style="font-family: ${T.mono}; color: ${T.ink2}">swarmops</span> is now on the path — everything this console can do, that command can do too.
      </div>
    </div>

    <div style="border: 1px solid ${T.line}; border-radius: 3px; background: ${T.surface}; overflow: hidden">
      <div style="height: 56px; display: flex; align-items: center; gap: 12px; padding: 0 16px; border-bottom: 1px solid ${T.line}">
        ${quorum(22)}<span style="font-size: 14px; font-weight: 600">SwarmOps</span>
        <span style="flex: 1"></span>
        <span style="width: 26px; height: 26px; border-radius: 999px; background: ${T.muted}; display: inline-flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 600; color: ${T.ink2}">NS</span>
      </div>
      <div style="padding: 32px">
        <div style="max-width: 52ch">
          <h2 style="margin: 0 0 6px; font-size: 22px; font-weight: 600; letter-spacing: -0.4px">Nothing is being managed yet</h2>
          <p style="margin: 0 0 20px; font-size: 13px; color: ${T.ink3}; line-height: 1.55">
            The controller is running and holds no cluster. Add a machine and it becomes one — SwarmOps will read what is already on that host before it changes anything.
          </p>
        </div>

        <div style="border: 1px solid ${T.line}; border-radius: 3px; padding: 16px; margin-bottom: 16px">
          <div style="font-size: 13px; font-weight: 500; margin-bottom: 4px">Run this on the machine you want to manage</div>
          <div style="font-size: 12px; color: ${T.ink3}; margin-bottom: 10px">Ubuntu 22.04 or 24.04. Docker is not required first.</div>
          ${codeBlock(`curl -fsSL https://get.swarmops.dev/agent | sudo bash -s -- \\
  --core https://10.0.0.4:8084 \\
  --fingerprint SHA256:4f1a…9c2e \\
  --code 7K2M-9QX4-P3RV-8ZTN`)}
          <div style="display: flex; align-items: center; gap: 10px; margin-top: 10px; font-size: 12px; color: ${T.ink3}">
            ${dot('accent')} Waiting for the first poll…
            <span style="flex: 1"></span>
            ${button('Regenerate the code', { tone: 'quiet' })}
          </div>
        </div>

        <div style="font-size: 11px; font-weight: 500; letter-spacing: 0.52px; color: ${T.ink3}; margin-bottom: 10px">THEN, IN ORDER</div>
        <div style="display: flex; flex-direction: column">
          ${[
            ['Install Docker on it', 'One button. From Docker’s signed repository.'],
            ['Make it a Swarm manager', 'A single node is a valid cluster. Add two more when you want it to survive a reboot.'],
            ['Install the gateway', 'Traefik on every node, so a hostname can reach a workload.'],
            ['Deploy something', 'Point at a repository and watch it start.'],
          ].map(([label, meta], i, all) => `
          <div style="display: flex; gap: 12px">
            <div style="display: flex; flex-direction: column; align-items: center; width: 20px; flex: none">
              <span style="width: 20px; height: 20px; border-radius: 999px; border: 1px solid ${T.line}; display: inline-flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 600; color: ${T.ink3}">${i + 1}</span>
              ${i < all.length - 1 ? `<span style="flex: 1; width: 1px; background: ${T.line}"></span>` : ''}
            </div>
            <div style="flex: 1; padding-bottom: ${i < all.length - 1 ? 14 : 0}px">
              <div style="font-size: 13px; color: ${T.ink3}">${label}</div>
              <div style="font-size: 12px; color: ${T.ink3}; opacity: 0.8; margin-top: 2px; line-height: 1.45">${meta}</div>
            </div>
          </div>`).join('')}
        </div>
      </div>
    </div>
  </div>
</div>`
