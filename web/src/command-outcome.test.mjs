import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { commandFailureText, commandOutcomeTitle, commandOutcomeTone, commandProgressText, isTerminal } from './lib/command-outcome.ts'

const source = (name) => readFileSync(new URL(name, import.meta.url), 'utf8')
const command = (patch) => ({ attempt: 1, id: 'cmd-0123456789abcdef', maxAttempts: 8, state: 'queued', ...patch })

test('a command that has stopped moving is told apart from one still working', () => {
  for (const state of ['succeeded', 'failed', 'needs_attention', 'superseded', 'cancelled']) assert.ok(isTerminal(state), state)
  for (const state of ['uploading', 'queued', 'leased', 'preparing', 'running', 'retry_scheduled']) assert.ok(!isTerminal(state), state)
})

test('the progress line names the state, and the attempt only once there is more than one', () => {
  assert.equal(commandProgressText(command({ state: 'running' })), 'Running')
  assert.equal(commandProgressText(command({ state: 'running', attempt: 3 })), 'Running · attempt 3 of 8')
  assert.match(commandProgressText(command({ state: 'retry_scheduled', attempt: 2 })), /Failed and scheduled for retry · attempt 2 of 8/)
})

test('the failure is the controller’s own words, with its recovery hint kept', () => {
  const text = commandFailureText(command({
    failureSummary: 'The managed Traefik gateway is required before this stack can create private routes.',
    recoveryHint: 'Install and verify Traefik under Gateway, routes & DNS, then retry.',
    state: 'needs_attention',
  }))
  assert.match(text, /managed Traefik gateway is required/)
  assert.match(text, /Install and verify Traefik/)
})

test('a last error that only repeats the summary is not printed twice', () => {
  const repeated = commandFailureText(command({ failureSummary: 'same', lastError: 'same', state: 'failed' }))
  assert.equal(repeated, 'same')
  const both = commandFailureText(command({ failureSummary: 'summary', lastError: 'detail', state: 'failed' }))
  assert.equal(both, 'summary detail')
})

test('the last error keeps only what it adds to the summary', () => {
  // This is the real shape: lastError restates failureSummary and appends the
  // attempt count, so a naive inequality check printed the sentence twice.
  const summary = 'The managed Traefik gateway is required before this stack can create private routes.'
  const text = commandFailureText(command({
    failureSummary: summary,
    lastError: `${summary} Attempt 8 of 8 failed and no retry is scheduled; inspect the target before retrying.`,
    recoveryHint: 'Install and verify Traefik under Gateway, routes & DNS, then retry.',
    state: 'needs_attention',
  }))
  assert.equal(text.indexOf(summary), text.lastIndexOf(summary), 'the summary appears twice')
  assert.match(text, /Attempt 8 of 8 failed/)
  assert.match(text, /Install and verify Traefik/)
})

test('a command that ended without a reason says so instead of inventing one', () => {
  assert.match(commandFailureText(command({ state: 'failed' })), /without recording a reason/)
  assert.match(commandFailureText(command({ state: 'superseded' })), /newer command replaced this one/)
})

test('a superseded or cancelled command is not reported as a failure', () => {
  assert.equal(commandOutcomeTone(command({ state: 'superseded' })), 'warning')
  assert.equal(commandOutcomeTone(command({ state: 'cancelled' })), 'warning')
  assert.equal(commandOutcomeTone(command({ state: 'failed' })), 'danger')
  assert.equal(commandOutcomeTone(command({ state: 'needs_attention' })), 'danger')
  assert.match(commandOutcomeTitle(command({ state: 'needs_attention' })), /needs attention/)
  assert.match(commandOutcomeTitle(command({ state: 'superseded' })), /superseded/)
})

test('both deploy paths follow the command instead of reporting the acknowledgement', () => {
  for (const screen of ['screens/apps/deploy.tsx', 'screens/apps/applications.tsx']) {
    const text = source(screen)
    assert.match(text, /api\.waitForCommand\(command\.id, DEPLOY_FOLLOW_MS/, screen)
    assert.match(text, /isTerminal\(command\.state\)/, `${screen} must not poll a command the controller already ended`)
    assert.match(text, /commandFailureText\(final\)/, `${screen} must report the controller's reason`)
  }
})

test('a deployment is watched for minutes, because it builds before it runs', () => {
  for (const screen of ['screens/apps/deploy.tsx', 'screens/apps/applications.tsx']) {
    assert.match(source(screen), /const DEPLOY_FOLLOW_MS = 10 \* 60 \* 1000/, screen)
  }
  // The resource screens keep the short default; a volume is not a build.
  assert.match(source('data/api.ts'), /waitForCommand\(id: string, timeoutMs = 8000/)
})

test('outliving the watch is reported as still running, never as a failure', () => {
  for (const screen of ['screens/apps/deploy.tsx', 'screens/apps/applications.tsx']) {
    assert.match(source(screen), /still deploying/, screen)
  }
  assert.match(source('data/api.ts'), /is RETURNED, not thrown/)
})

test('the poll backs off so a ten-minute watch is not a ten-minute flood', () => {
  const text = source('data/api.ts')
  assert.match(text, /interval = Math\.min\(interval \* 1\.5, 2000\)/)
  assert.match(text, /onState\?\.\(command\)/)
})

test('every resource screen reports what its command did, not that it was queued', () => {
  const screens = [
    'screens/machines/resources/volumes.tsx',
    'screens/machines/resources/networks.tsx',
    'screens/machines/resources/images.tsx',
    'screens/machines/resources/containers.tsx',
    'screens/machines/resources/swarm-objects.tsx',
  ]
  for (const screen of screens) {
    const text = source(screen)
    assert.match(text, /followQueuedCommand\(command, \{/, screen)
    // The old shape: await the command only to know when to refresh, and throw
    // the result away. A creation that failed looked like one that worked.
    assert.doesNotMatch(text, /await api\.waitForCommand\(command\.id\)/, `${screen} still discards the outcome`)
    assert.doesNotMatch(text, /queued \(\$\{shortID\(command\.id\)\}\)/, `${screen} still hand-rolls the queued toast`)
  }
})

test('a transfer gets a budget matched to what it is waiting on', () => {
  // A pull crosses the network; the resource default would report a working
  // pull as "still running" every time.
  assert.match(source('screens/machines/resources/images.tsx'), /timeoutMs: FOLLOW_TRANSFER_MS/)
  const helper = source('lib/command-follow.ts')
  assert.match(helper, /FOLLOW_RESOURCE_MS = 30 \* 1000/)
  assert.match(helper, /FOLLOW_TRANSFER_MS = 5 \* 60 \* 1000/)
})

test('the queued toast is written once, in the follow helper', () => {
  const helper = source('lib/command-follow.ts')
  assert.match(helper, /toast\(\{ message: `\$\{label\} queued/)
  assert.match(helper, /duration: 0/, 'a failure must not time out while it is being read')
  assert.match(helper, /Watch it under Activity → Runs/)
})

test('a form is only cleared when the command actually succeeded', () => {
  for (const screen of ['screens/machines/resources/volumes.tsx', 'screens/machines/resources/networks.tsx']) {
    assert.match(source(screen), /if \(succeeded\(await followQueuedCommand\([^)]*\)\)\) setName\(''\)/, screen)
  }
  assert.match(source('screens/machines/resources/images.tsx'), /succeeded\(await followQueuedCommand\(.*\)\) setReference\(''\)/)
})

test('every traffic action reports what its command did', () => {
  for (const screen of ['screens/traffic/dns.tsx', 'screens/traffic/routes.tsx', 'screens/traffic/certificates.tsx']) {
    const text = source(screen)
    assert.match(text, /followQueuedCommand\(command, \{/, screen)
    // queuedToast said "queued" in success green and never spoke again.
    assert.doesNotMatch(text, /queuedToast\(/, `${screen} still queues and forgets`)
  }
})

test('a refresh waits for the command it is refreshing after', () => {
  // onQueued() used to fire the instant the controller acknowledged, so the
  // list it reloaded could not yet show the change it was reloading for.
  for (const screen of ['screens/traffic/dns.tsx', 'screens/traffic/routes.tsx']) {
    const text = source(screen)
    assert.doesNotMatch(text, /followQueuedCommand[^\n]*\n\s*onQueued\(\)\s*\n\s*await/, screen)
    assert.match(text, /await followQueuedCommand[\s\S]{0,200}?onQueued\(\)/, screen)
  }
})

test('an ACME round trip and a cutover are not held to a local-change budget', () => {
  assert.match(source('screens/traffic/certificates.tsx'), /timeoutMs: FOLLOW_TRANSFER_MS/)
  assert.match(source('screens/traffic/routes.tsx'), /timeoutMs: FOLLOW_TRANSFER_MS/)
})

test('a confirmation phrase and a provider token clear whether or not it worked', () => {
  const dns = source('screens/traffic/dns.tsx')
  // The phrase is a deliberation gate: a retry should be typed again.
  assert.match(dns, /setSettingsConfirmation\(''\)\n\s*await followQueuedCommand/)
  assert.match(dns, /setDeleteRecordID\(''\); setDeleteRecordConfirmation\(''\)\n\s*await followQueuedCommand/)
  // A token does not sit in component state waiting for a retry.
  assert.match(dns, /setCredentialValue\(''\)\n\s*await followQueuedCommand/)
  // Typed data does survive, so a failure is not also a retype.
  assert.match(dns, /if \(succeeded\(await followQueuedCommand\([^)]*\)\)\) \{\n\s*setDomainZone\(''\); setDomainNote\(''\)/)
})

test('"this command stopped, and not well" has one definition', () => {
  assert.match(source('screens/traffic/lib.ts'), /return isTerminal\(command\.state\) && command\.state !== 'succeeded'/)
  // The gateway keeps its own queued toast because it renders the command in a
  // banner of its own rather than in a toast.
  assert.match(source('screens/traffic/gateway.tsx'), /commandFailureText\(completed\)/)
  assert.match(source('screens/traffic/preflight.tsx'), /commandFailureText\(command\)/)
})

test('a command is followed through its steps, not only its state', () => {
  // The state alone showed one word for a source deployment that installs a
  // gateway, enables databases, reconciles stacks, builds an image and deploys
  // it. The steps come from the controller's own worker: the agent serves
  // requests and has no notion of a command.
  assert.match(source('screens/activity/runs.tsx'), /api\.commandEvents\(selectedID\)/)
  assert.match(source('screens/activity/runs.tsx'), /steps\.events\.map/)
  assert.match(source('data/api.ts'), /commandEvents\(id: string\)/)
  assert.match(source('data/types.ts'), /export interface CommandEvent/)
})

test('a step carries no remote output', () => {
  // Evidence is a sentence the controller wrote about its own progress. The
  // type says so, and the producer is Core's worker rather than the agent.
  const types = source('data/types.ts')
  assert.match(types, /carries no remote output/)
})
