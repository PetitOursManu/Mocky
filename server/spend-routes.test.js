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
 * The spending ledger (server/admin/spend.js), end to end: a real server, a fake
 * OpenAI-compatible provider that reports its tokens and its price the way
 * OpenRouter does — in the answer, and in the last frame of a stream — and the
 * administrator's panel reading them back, filed under the project the browser
 * was working in.
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

/** An OpenAI-compatible provider that reports usage and a price, streamed or not, and counts its calls. */
function fakeProvider(name) {
  const state = { name, calls: 0, server: null, url: '', bodies: [] }
  state.server = http.createServer((req, res) => {
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', () => {
      state.calls++
      let parsed = {}
      try {
        parsed = JSON.parse(body)
      } catch {
        /* not JSON */
      }
      state.bodies.push(parsed)
      const usage = { prompt_tokens: 1200, completion_tokens: 300, cost: 0.0042 }
      if (parsed.stream) {
        res.setHeader('content-type', 'text/event-stream')
        res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: 'streamed' } }] })}\n\n`)
        res.write(`data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }] })}\n\n`)
        res.write(`data: ${JSON.stringify({ choices: [], usage })}\n\n`)
        res.end('data: [DONE]\n\n')
        return
      }
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ choices: [{ message: { role: 'assistant', content: `answer from ${name}` }, finish_reason: 'stop' }], usage }))
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
  const call = async function call(method, url, body, headers = {}) {
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
  call.cookie = () => cookie
  return call
}

const admin = client()
const adminCookie = () => admin.cookie()
const newcomer = client()
let newcomerId

const chat = (who, purpose = 'generate') =>
  who('POST', '/__provider/api/chat', { model: 'whatever-the-browser-says', stream: false, messages: [{ role: 'user', content: 'hi' }] }, { 'x-mocky-purpose': purpose })

beforeAll(async () => {
  fakes.paid = await fakeProvider('paid')
  fakes.free = await fakeProvider('free')
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mocky-spend-routes-'))
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

const ask = (who, { stream = false, project = 'proj_1' } = {}) =>
  who(
    'POST',
    '/__provider/api/chat',
    { model: 'whatever', stream, messages: [{ role: 'user', content: 'hi' }] },
    { 'x-mocky-purpose': 'generate', ...(project ? { 'x-mocky-project': project } : {}) },
  )

describe('the spending ledger, through the real server', () => {
  it('files each call under its account, project and model, with the price the provider reported', async () => {
    expect((await ask(admin)).json.message.content).toBe('answer from paid')
    const streamed = await fetch(base + '/__provider/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: adminCookie(), 'x-mocky-project': 'proj_1' },
      body: JSON.stringify({ model: 'x', stream: true, messages: [{ role: 'user', content: 'hi' }] }),
    })
    expect(await streamed.text()).toContain('streamed')
    await ask(admin, { project: null })

    const r = await admin('GET', '/api/admin/spend?days=7')
    expect(r.status).toBe(200)
    const filed = r.json.entries.find((e) => e.projectId === 'proj_1')
    expect(filed).toMatchObject({ username: 'owner', provider: 'openai-compatible', source: 'instance', model: 'paid-model', calls: 2, input: 2400, output: 600, reported: 2, unpriced: false, estimated: 0 })
    expect(filed.cost).toBeCloseTo(0.0084, 10)
    // The project id the browser sent names no project of this account: said so, not invented.
    expect(filed.project).toBeNull()
    expect(filed.projectDeleted).toBe(true)
    expect(r.json.entries.find((e) => e.projectId === null)).toMatchObject({ calls: 1 })
  })

  it('asks the provider for no key it did not ask for before, on a host it cannot vouch for', () => {
    // A loopback "compatible" provider is not on the stream-usage list: its
    // stream body is what it always was. The usage it volunteers is still read.
    const streamedBody = fakes.paid.bodies.find((b) => b.stream)
    expect(streamedBody.stream_options).toBeUndefined()
  })

  it('keeps the price table, and the audit says who changed it', async () => {
    const put = await admin('PUT', '/api/admin/spend/prices', { prices: { 'paid-model': { in: 1, out: 2 } } })
    expect(put.json.prices).toEqual({ 'paid-model': { in: 1, out: 2 } })
    expect((await admin('GET', '/api/admin/spend')).json.prices).toEqual({ 'paid-model': { in: 1, out: 2 } })
    const log = await admin('GET', '/api/admin/dashboard/audit?group=config')
    expect(log.json.entries.find((e) => e.action === 'config.prices')?.detail).toEqual({ models: 1 })
    expect((await newcomer('GET', '/api/admin/spend')).status).toBe(403)
  })

  it('records nothing of what was said', () => {
    const ledger = fs.readFileSync(path.join(dataDir, 'spend.jsonl'), 'utf8')
    expect(ledger).not.toContain('hi')
    expect(ledger).not.toContain('answer from')
  })
})
