import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import net from 'node:net'
import { fileURLToPath } from 'node:url'
import { stopProcess, removeDir } from '../tests/support/stop.js'

/**
 * The free plan, end to end: a real server, real accounts, and two fake model
 * providers on loopback — one standing for the PAID model, one for the free one.
 *
 * What a unit test of `textTargetFor` cannot prove is that EVERY path a free
 * account's call takes ends at the free provider, and that the paid one hears
 * nothing from it — not even when the free model is left unconfigured. Counting
 * the requests each fake received is that proof.
 */

const here = path.dirname(fileURLToPath(import.meta.url))
let proc, base, dataDir
const fakes = {}

async function freePort() {
  return new Promise((resolve) => {
    const srv = net.createServer()
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address()
      srv.close(() => resolve(port))
    })
  })
}

/** An OpenAI-compatible provider that answers with its own name and counts its calls. */
function fakeProvider(name) {
  const state = { name, calls: 0, server: null, url: '' }
  state.server = http.createServer((req, res) => {
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', () => {
      state.calls++
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ choices: [{ message: { role: 'assistant', content: `answer from ${name}` }, finish_reason: 'stop' }] }))
    })
  })
  return new Promise((resolve) => {
    state.server.listen(0, '127.0.0.1', () => {
      state.url = `http://127.0.0.1:${state.server.address().port}`
      resolve(state)
    })
  })
}

/** A tiny cookie jar per account: the session is all the server knows. */
function client() {
  let cookie = ''
  return async function call(method, url, body, headers = {}) {
    const res = await fetch(base + url, {
      method,
      headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const set = res.headers.get('set-cookie')
    if (set) cookie = set.split(';')[0]
    const text = await res.text()
    let json = null
    try {
      json = JSON.parse(text)
    } catch {
      /* not JSON */
    }
    return { status: res.status, json }
  }
}

const admin = client()
const newcomer = client()
let newcomerId

const chat = (who, purpose = 'generate') =>
  who('POST', '/__provider/api/chat', { model: 'whatever-the-browser-says', stream: false, messages: [{ role: 'user', content: 'hi' }] }, { 'x-mocky-purpose': purpose })

beforeAll(async () => {
  fakes.paid = await fakeProvider('paid')
  fakes.free = await fakeProvider('free')
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mocky-plan-routes-'))
  // Both profiles point at loopback through "Compatible OpenAI": an admin
  // endpoint is trusted past the SSRF guard, which is what lets a test stand in
  // for a real provider.
  const profile = (url, model) => ({ provider: 'openai-compatible', 'openai-compatible': { baseUrl: url, model, apiKey: '' } })
  fs.writeFileSync(
    path.join(dataDir, 'text-config.json'),
    JSON.stringify({ generation: profile(fakes.paid.url, 'paid-model'), free: profile(fakes.free.url, 'free-model:free') }),
  )

  const port = await freePort()
  proc = spawn(process.execPath, [path.join(here, 'index.js')], {
    env: { ...process.env, MOCKY_DATA_DIR: dataDir, MOCKY_PORT: String(port), NODE_ENV: 'test' },
    stdio: 'ignore',
  })
  base = `http://127.0.0.1:${port}`
  const deadline = Date.now() + 15_000
  for (;;) {
    try {
      await fetch(`${base}/api/config`)
      break
    } catch {
      if (Date.now() > deadline) throw new Error('server did not start in time')
      await new Promise((r) => setTimeout(r, 100))
    }
  }

  // The first account is the administrator, and closes sign-ups behind it.
  expect((await admin('POST', '/api/register', { username: 'owner', password: 'correct-horse-battery' })).status).toBe(200)
  expect((await admin('PUT', '/api/admin/config', { allowRegistration: true })).status).toBe(200)
  const r = await newcomer('POST', '/api/register', { username: 'stranger', password: 'another-long-password' })
  expect(r.status).toBe(200)
  const list = await admin('GET', '/api/admin/users')
  newcomerId = list.json.users.find((u) => u.username === 'stranger').id
}, 30_000)

afterAll(async () => {
  await stopProcess(proc)
  for (const f of Object.values(fakes)) await new Promise((r) => f.server.close(r))
  try {
    removeDir(dataDir)
  } catch {
    /* best effort */
  }
})

describe('the free plan, through the real server', () => {
  it('a newcomer starts free; the administrator never does', async () => {
    expect((await newcomer('GET', '/api/me')).json.user.plan).toBe('free')
    expect((await admin('GET', '/api/me')).json.user.plan).toBe('standard')
    const cfg = await admin('GET', '/api/admin/config')
    expect(cfg.json.freePlan).toMatchObject({ newAccounts: 'free', dailyLimit: 20, modelConfigured: true })
  })

  it('a free account reaches the free model and the paid one hears nothing', async () => {
    const before = fakes.paid.calls
    const r = await chat(newcomer)
    expect(r.status).toBe(200)
    expect(r.json.message.content).toBe('answer from free')
    expect(fakes.paid.calls).toBe(before)

    const a = await chat(admin)
    expect(a.json.message.content).toBe('answer from paid')
  })

  it('the account reads its own plan, model and day', async () => {
    const r = await newcomer('GET', '/api/account/plan')
    expect(r.json).toMatchObject({ plan: 'free', model: 'free-model:free', dailyLimit: 20 })
    expect(r.json.used).toBeGreaterThanOrEqual(1)
    expect((await admin('GET', '/api/account/plan')).json).toEqual({ plan: 'standard' })
  })

  it('paid generators refuse a free account with a code, and say there is no image model', async () => {
    const img = await newcomer('POST', '/api/images/generate', { prompt: 'a cat' })
    expect(img.status).toBe(403)
    expect(img.json.code).toBe('free-plan')
    expect((await newcomer('POST', '/api/videos/generate', { prompt: 'a cat' })).json.code).toBe('free-plan')
    expect((await newcomer('POST', '/api/video/variants', { imageId: 'a'.repeat(64) })).json.code).toBe('free-plan')
    expect((await newcomer('GET', '/api/images/providers')).json).toEqual({ providers: [] })
  })

  it('the daily limit refuses the next generation with a code', async () => {
    expect((await admin('PUT', '/api/admin/config', { freePlan: { dailyLimit: 2 } })).json.freePlan.dailyLimit).toBe(2)
    // One generation was spent above; one left.
    expect((await chat(newcomer)).status).toBe(200)
    const over = await chat(newcomer)
    expect(over.status).toBe(429)
    expect(over.json.code).toBe('free-quota')
    // Every call, not only the counted ones: a planner call would spend the shared key for nothing.
    expect((await chat(newcomer, 'plan')).status).toBe(429)
    // The administrator's own calls are not on the free plan's books.
    expect((await chat(admin)).status).toBe(200)
    await admin('PUT', '/api/admin/config', { freePlan: { dailyLimit: 0 } })
    expect((await chat(newcomer)).status).toBe(200)
  })

  // The failure the free plan exists to rule out: an empty free profile must not
  // quietly become the paid one.
  it('with the free model unconfigured, a free account still never reaches the paid one', async () => {
    expect((await admin('PUT', '/api/admin/text/config', { free: { provider: '' } })).status).toBe(200)
    const before = fakes.paid.calls
    const r = await chat(newcomer)
    // No instance model for it: the proxy wants the browser's own provider.
    expect(r.status).toBe(400)
    expect(fakes.paid.calls).toBe(before)
    expect((await newcomer('GET', '/api/config')).json.textProvider).toMatchObject({ configured: false, plan: 'free' })
  })

  it('an administrator moves an account between plans; never themselves to free', async () => {
    expect((await admin('PUT', `/api/admin/users/${newcomerId}/plan`, { plan: 'standard' })).json.user.plan).toBe('standard')
    expect((await chat(newcomer)).json.message.content).toBe('answer from paid')
    expect((await admin('PUT', `/api/admin/users/${newcomerId}/plan`, { plan: 'free' })).json.user.plan).toBe('free')

    const me = (await admin('GET', '/api/admin/users')).json.users.find((u) => u.username === 'owner')
    expect((await admin('PUT', `/api/admin/users/${me.id}/plan`, { plan: 'free' })).status).toBe(400)
    expect((await newcomer('PUT', `/api/admin/users/${newcomerId}/plan`, { plan: 'standard' })).status).toBe(403)
  })

  it('accounts an administrator creates follow the form, then the default', async () => {
    const a = await admin('POST', '/api/admin/users', { username: 'chosen', password: 'long-enough-1', plan: 'standard' })
    expect(a.json.user.plan).toBe('standard')
    await admin('PUT', '/api/admin/config', { freePlan: { newAccounts: 'standard' } })
    const b = await admin('POST', '/api/admin/users', { username: 'defaulted', password: 'long-enough-2' })
    expect(b.json.user.plan).toBe('standard')
    await admin('PUT', '/api/admin/config', { freePlan: { newAccounts: 'free' } })
    const c = await admin('POST', '/api/admin/users', { username: 'newbie', password: 'long-enough-3' })
    expect(c.json.user.plan).toBe('free')
  })
})
