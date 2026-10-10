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
 * An account on its own key (server/own-text.js), end to end: a real server,
 * two fake providers on loopback standing for the instance's paid and free
 * models, and a count of what each one received.
 *
 * The person's own key is addressed through the browser path, which the SSRF
 * guard keeps off loopback — so here the own-key call is REFUSED by the guard,
 * and that refusal is the proof: the call went where the browser said, and
 * neither of the instance's providers heard it.
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
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mocky-own-text-routes-'))
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

const ownChat = (who) =>
  who(
    'POST',
    '/__provider/api/chat',
    { model: 'my-own-model', stream: false, messages: [{ role: 'user', content: 'hi' }] },
    { 'x-mocky-purpose': 'generate', 'x-provider-base': 'http://127.0.0.1:9', 'x-provider-kind': 'openai', authorization: 'Bearer sk-mine' },
  )

describe('an account on its own key, through the real server', () => {
  it('goes to the browser target, spends no quota, and the instance hears nothing', async () => {
    expect((await admin('PUT', '/api/admin/config', { freePlan: { dailyLimit: 1 } })).status).toBe(200)
    const cfg = (await newcomer('GET', '/api/config')).json.textProvider
    expect(cfg).toMatchObject({ configured: true, own: false, ownAllowed: true, instance: { model: 'free-model:free' } })

    const on = await newcomer('PUT', '/api/account/text-source', { own: true, provider: 'openrouter', model: 'openai/gpt-4o-mini' })
    expect(on.json).toEqual({ own: true })
    const after = (await newcomer('GET', '/api/config')).json.textProvider
    expect(after).toMatchObject({ configured: false, own: true, instance: { model: 'free-model:free' } })

    const before = { paid: fakes.paid.calls, free: fakes.free.calls }
    // More calls than the day allows: none of them is the instance's.
    for (let i = 0; i < 3; i++) {
      const r = await ownChat(newcomer)
      expect(r.status).toBe(400)
      expect(r.json.target).toContain('127.0.0.1:9')
    }
    expect({ paid: fakes.paid.calls, free: fakes.free.calls }).toEqual(before)
    expect((await newcomer('GET', '/api/account/plan')).json).toMatchObject({ plan: 'free', model: null, used: 0 })
  })

  it('shows the administrator the provider and the model, never the key', async () => {
    const list = await admin('GET', '/api/admin/users')
    const row = list.json.users.find((u) => u.username === 'stranger')
    expect(row.ownText).toEqual({ provider: 'openrouter', model: 'openai/gpt-4o-mini' })
    expect(JSON.stringify(list.json)).not.toContain('sk-mine')
    expect(fs.readFileSync(path.join(dataDir, 'users.json'), 'utf8')).not.toContain('sk-mine')
  })

  it('closed by the administrator, the account is back on the instance at its next call', async () => {
    expect((await admin('PUT', '/api/admin/config', { ownKeys: false })).json.ownKeys).toBe(false)
    const log = await admin('GET', '/api/admin/dashboard/audit?group=config')
    expect(log.json.entries.find((e) => e.action === 'config.ownKeys')?.detail).toEqual({ ownKeys: false })

    const r = await chat(newcomer)
    expect(r.status).toBe(200)
    expect(r.json.message.content).toBe('answer from free')
    expect((await admin('GET', '/api/admin/users')).json.users.find((u) => u.username === 'stranger').ownText).toBeNull()
    // Opting in again is refused while the door is closed.
    const again = await newcomer('PUT', '/api/account/text-source', { own: true, provider: 'openai', model: 'gpt-4o-mini' })
    expect(again.status).toBe(403)
    expect(again.json.code).toBe('own-keys-closed')

    // Reopened, the account's choice is still there.
    await admin('PUT', '/api/admin/config', { ownKeys: true })
    expect((await newcomer('GET', '/api/config')).json.textProvider.own).toBe(true)
  })

  it('goes back to the instance when the person says so, and refuses what is not a choice', async () => {
    expect((await newcomer('PUT', '/api/account/text-source', { own: false })).json).toEqual({ own: false })
    expect((await newcomer('GET', '/api/config')).json.textProvider).toMatchObject({ configured: true, own: false })
    expect((await newcomer('PUT', '/api/account/text-source', { own: true, provider: 'fal', model: 'x' })).status).toBe(400)
    expect((await newcomer('PUT', '/api/account/text-source', {})).status).toBe(400)
  })
})
