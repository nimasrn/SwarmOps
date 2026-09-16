#!/usr/bin/env node
// Captures the user-manual screenshots from a running SwarmOps Cloud.
//
// It starts headless Chrome, signs in through the storefront and operator
// APIs, and drives each page over the Chrome DevTools Protocol, so every
// picture in the manual is of the real application. No browser automation
// package is needed: Node's built-in fetch and WebSocket speak the protocol.
//
// Usage:
//   node docs/cloud/tools/screenshots.mjs \
//     --base http://127.0.0.1:5284 --out docs/cloud/screenshots \
//     --customer-email sara.demo@example.com --customer-password '…' \
//     --operator-username admin --operator-password '…'

import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => {
  if (value.startsWith('--')) pairs.push([value.slice(2), all[index + 1]])
  return pairs
}, []))
const base = args.base ?? 'http://127.0.0.1:5284'
const out = args.out ?? 'docs/cloud/screenshots'
const chromePath = args.chrome ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const port = Number(args.port ?? 9333)
const only = args.only ? new Set(args.only.split(',')) : null

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function signIn(path, body) {
  const response = await fetch(`${base}${path}`, {
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  })
  if (!response.ok) throw new Error(`${path}: ${response.status} ${await response.text()}`)
  const cookie = response.headers.getSetCookie().map((value) => value.split(';')[0]).find(Boolean)
  if (!cookie) throw new Error(`${path}: no session cookie`)
  const [name, ...rest] = cookie.split('=')
  return { name, value: rest.join('=') }
}

class Page {
  constructor(socket) {
    this.socket = socket
    this.nextID = 0
    this.pending = new Map()
    this.listeners = []
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data)
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id)
        this.pending.delete(message.id)
        if (message.error) reject(new Error(message.error.message))
        else resolve(message.result)
      } else if (message.method) {
        this.listeners = this.listeners.filter((listener) => !listener(message))
      }
    })
  }

  send(method, params = {}) {
    const id = ++this.nextID
    this.socket.send(JSON.stringify({ id, method, params }))
    return new Promise((resolve, reject) => this.pending.set(id, { reject, resolve }))
  }

  waitFor(method, timeout = 15000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timed out waiting for ${method}`)), timeout)
      this.listeners.push((message) => {
        if (message.method !== method) return false
        clearTimeout(timer)
        resolve(message.params)
        return true
      })
    })
  }

  evaluate(expression) {
    return this.send('Runtime.evaluate', { awaitPromise: true, expression, returnByValue: true })
  }

  async navigate(url) {
    const loaded = this.waitFor('Page.loadEventFired')
    const result = await this.send('Page.navigate', { url })
    // A change of only the address's fragment is a same-document navigation:
    // Chrome returns no loaderId and fires no load event.
    if (!result.loaderId) {
      loaded.catch(() => {})
      return
    }
    await loaded
  }
}

async function launch() {
  const profile = mkdtempSync(join(tmpdir(), 'swarmops-shots-'))
  const chrome = spawn(chromePath, [
    '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--force-color-profile=srgb',
  ], { stdio: 'ignore' })
  // A first launch after a system update can take well over ten seconds.
  for (let attempt = 0; attempt < 200; attempt++) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`)
      if (response.ok) return { chrome, profile }
    } catch {
      // Chrome is still starting.
    }
    await sleep(200)
  }
  chrome.kill()
  throw new Error('Chrome did not start')
}

async function openPage() {
  const response = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })
  const target = await response.json()
  const socket = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true })
    socket.addEventListener('error', reject, { once: true })
  })
  const page = new Page(socket)
  await page.send('Page.enable')
  await page.send('Network.enable')
  return page
}

// Each shot: page address, viewport, language, theme, cookies to keep, an
// optional button to press first, and whether to capture the whole page.
const store = `${base}/store.html`
const shots = [
  { name: 'store-plans-en', url: `${store}#/plans`, full: true },
  { name: 'store-register-en', url: `${store}#/register`, signedOut: true },
  { name: 'store-wallet-en', url: `${store}#/wallet`, full: true },
  { name: 'store-checkout-en', url: `${store}#/checkout/basic`, full: true },
  { name: 'store-orders-en', url: `${store}#/orders` },
  { name: 'store-projects-en', url: `${store}#/projects`, full: true },
  { name: 'store-invoices-en', url: `${store}#/invoices` },
  { name: 'store-ticket-en', url: `${store}#/support`, press: 'View', full: true },
  { name: 'store-plans-fa', url: `${store}#/plans`, locale: 'fa', full: true },
  { name: 'store-wallet-fa', url: `${store}#/wallet`, locale: 'fa', full: true },
  { name: 'store-projects-fa', url: `${store}#/projects`, locale: 'fa' },
  { name: 'store-dashboard-dark', url: `${store}#/dashboard`, dark: true },
  { name: 'store-plans-phone', url: `${store}#/plans`, width: 390, height: 844, mobile: true },
  { name: 'store-wallet-phone-fa', url: `${store}#/wallet`, width: 390, height: 844, mobile: true, locale: 'fa' },
  { name: 'console-orders', url: `${base}/#orders`, console: true },
  { name: 'console-orders-history', url: `${base}/#orders`, console: true, press: 'active' },
  { name: 'console-customers-wallet', url: `${base}/#customers`, console: true, press: 'Wallet', full: true },
  { name: 'console-plans', url: `${base}/#plans`, console: true, full: true },
  { name: 'console-billing', url: `${base}/#billing`, console: true, full: true },
  { name: 'console-invoice-lines', url: `${base}/#billing`, console: true, press: 'Lines', full: true },
  { name: 'console-support', url: `${base}/#support`, console: true, press: 'answered', full: true },
  { name: 'console-gateway', url: `${base}/#gateway`, console: true },
  { name: 'console-orders-dark', url: `${base}/#orders`, console: true, dark: true },
]

async function capture(page, shot, cookies) {
  const width = shot.width ?? 1280
  const height = shot.height ?? 860
  await page.send('Network.clearBrowserCookies')
  if (!shot.signedOut) {
    for (const cookie of cookies) {
      await page.send('Network.setCookie', { ...cookie, domain: '127.0.0.1', path: '/' })
    }
  }
  await page.send('Emulation.setDeviceMetricsOverride', { deviceScaleFactor: shot.mobile ? 2 : 1, height, mobile: Boolean(shot.mobile), width })
  await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: shot.dark ? 'dark' : 'light' }] })

  // The language is chosen before the application loads, as a returning
  // visitor's saved choice would be.
  await page.navigate(`${base}/store.html#/plans`)
  await page.evaluate(`localStorage.setItem('swarmops-cloud-locale', ${JSON.stringify(shot.locale ?? 'en')}); true`)
  await page.navigate('about:blank')
  await page.navigate(shot.url)
  await sleep(2500)

  if (shot.press) {
    const pressed = await page.evaluate(`(() => {
      const target = [...document.querySelectorAll('button')].find((button) => button.innerText.trim() === ${JSON.stringify(shot.press)})
      if (!target) return false
      target.click()
      return true
    })()`)
    if (!pressed.result.value) throw new Error(`${shot.name}: no button "${shot.press}"`)
    await sleep(2000)
  }

  let clip
  if (shot.full) {
    const metrics = await page.send('Page.getLayoutMetrics')
    const contentHeight = Math.min(Math.ceil(metrics.cssContentSize.height), 3200)
    clip = { height: Math.max(contentHeight, height), scale: 1, width, x: 0, y: 0 }
  }
  const image = await page.send('Page.captureScreenshot', { captureBeyondViewport: Boolean(clip), clip, format: 'png' })
  const file = join(out, `${shot.name}.png`)
  writeFileSync(file, Buffer.from(image.data, 'base64'))
  return file
}

async function main() {
  mkdirSync(out, { recursive: true })
  const customer = await signIn('/api/store/v1/auth/login', { email: args['customer-email'], password: args['customer-password'] })
  const operator = await signIn('/api/v1/auth/login', { password: args['operator-password'], username: args['operator-username'] ?? 'admin' })
  const { chrome, profile } = await launch()
  let failures = 0
  try {
    const page = await openPage()
    for (const shot of shots) {
      if (only && !only.has(shot.name)) continue
      try {
        const file = await capture(page, shot, [customer, operator])
        console.log(`captured ${file}`)
      } catch (error) {
        failures++
        console.error(`failed ${shot.name}: ${error.message}`)
      }
    }
    page.socket.close()
  } finally {
    chrome.kill()
    await sleep(500)
    rmSync(profile, { force: true, recursive: true })
  }
  process.exitCode = failures ? 1 : 0
}

await main()
