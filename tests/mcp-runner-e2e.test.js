import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { spawn } from 'node:child_process'
import http from 'node:http'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import net from 'node:net'
import { fileURLToPath } from 'node:url'
import { findChromium } from '../server/mcp/runner.js'
import { stopProcess, removeDir } from './support/stop.js'

/**
 * The headless runner, end to end: a real server, a real Chromium, this
 * build's runner.html, and a fake model that records what it was sent.
 *
 * It proves the promise phase 2b was accepted on — "une génération et une
 * capture sans aucun onglet ouvert" — and the two things that make it safe:
 * the screen lands in the account's project through the merge, and the job's
 * token opens nothing but the pipeline's routes.
 *
 * Skipped, and says so, where it cannot run: no Chromium on the machine, or no
 * `npm run build` output to serve runner.html from.
 */

const root = fileURLToPath(new URL('..', import.meta.url))
const chromium = (() => {
  try {
    return findChromium()
  } catch {
    return null
  }
})()
const built = fs.existsSync(path.join(root, 'dist', 'runner.html'))
const can = Boolean(chromium && built)

let proc, base, dataDir, cookie, fake, calls, canary, canaryHits = 0, canaryPort

/**
 * What the "model" writes: a screen whose picture points at a server on this
 * machine's loopback — the request a prompt-injected page would make to reach
 * something internal. The runner's browser runs on the server, so it must
 * never be made.
 */
const code = () =>
  '```jsx\nexport default function App() {\n  return <main className="p-8"><h1 className="text-3xl font-bold">Covoiturage</h1>' +
  `<img src="http://127.0.0.1:${canaryPort}/ping" alt="" /></main>\n}\n\`\`\``

async function freePort() {
  return new Promise((resolve) => {
    const srv = net.createServer()
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address()
      srv.close(() => resolve(port))
    })
  })
}

const call = (method, p, body) =>
  fetch(base + p, {
    method,
    headers: { 'content-type': 'application/json', cookie },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

describe.skipIf(!can)('the headless runner', () => {
  beforeAll(async () => {
    calls = []
    canaryPort = await freePort()
    canary = http.createServer((_req, res) => {
      canaryHits++
      res.end()
    })
    await new Promise((r) => canary.listen(canaryPort, '127.0.0.1', r))
    const fakePort = await freePort()
    fake = http.createServer((req, res) => {
      let raw = ''
      req.on('data', (c) => (raw += c))
      req.on('end', () => {
        const body = raw ? JSON.parse(raw) : null
        calls.push(body)
        const content = body?.format ? JSON.stringify({ capabilities: [], layout: 'hero', sections: ['Hero'], contentNotes: '' }) : code()
        if (body?.stream) {
          res.setHeader('content-type', 'application/x-ndjson')
          res.end(JSON.stringify({ message: { content } }) + '\n' + JSON.stringify({ done: true, done_reason: 'stop' }) + '\n')
        } else {
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ message: { content }, done: true, done_reason: 'stop' }))
        }
      })
    })
    await new Promise((r) => fake.listen(fakePort, '127.0.0.1', r))

    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mocky-runner-'))
    fs.writeFileSync(
      path.join(dataDir, 'text-config.json'),
      JSON.stringify({ generation: { provider: 'ollama-cloud', 'ollama-cloud': { baseUrl: `http://127.0.0.1:${fakePort}`, model: 'fake', apiKey: '' } } }),
    )
    fs.writeFileSync(path.join(dataDir, 'images-config.json'), JSON.stringify({ content: { provider: 'none' } }))
    const port = await freePort()
    base = `http://127.0.0.1:${port}`
    proc = spawn(process.execPath, [path.join(root, 'server/index.js')], {
      env: {
        ...process.env,
        MOCKY_DATA_DIR: dataDir,
        MOCKY_PORT: String(port),
        MOCKY_ORIGIN: base,
        MOCKY_MCP_INSECURE_LOOPBACK: '1',
        MOCKY_RUNNER_CHROMIUM: chromium,
        NODE_ENV: 'test',
      },
      stdio: 'ignore',
    })
    const deadline = Date.now() + 15_000
    for (;;) {
      try {
        await fetch(`${base}/api/config`)
        break
      } catch {
        if (Date.now() > deadline) throw new Error('server did not start')
        await new Promise((r) => setTimeout(r, 100))
      }
    }
    const reg = await fetch(`${base}/api/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'runner', password: 'correct-horse-battery' }),
    })
    cookie = (reg.headers.get('set-cookie') || '').split(';')[0]
    // Something the account already has, and its DESIGN.md: neither may be touched.
    await call('PUT', '/api/data', { projects: JSON.stringify([{ id: 'existing01', name: 'Déjà là', updatedAt: Date.now(), screens: [] }]), design: '# Mine' })
  }, 30_000)

  afterAll(async () => {
    await stopProcess(proc)
    await new Promise((r) => fake?.close(r))
    await new Promise((r) => canary?.close(r))
    removeDir(dataDir)
  })

  it('photographs a fixed screen for free, with no model and no account', async () => {
    const before = calls.length
    const res = await call('POST', '/api/admin/mcp/runner/check')
    const body = await res.json()
    expect(res.status, JSON.stringify(body)).toBe(200)
    const png = Buffer.from(body.image.split(',')[1], 'base64')
    expect(png.subarray(1, 4).toString()).toBe('PNG')
    expect(png.readUInt32BE(16)).toBe(960) // width, from the IHDR chunk
    expect(calls.length).toBe(before)
  }, 60_000)

  it('generates a screen with no tab open, saves it, and photographs it', async () => {
    const start = await (await call('POST', '/api/admin/mcp/runner/try', { brief: 'Landing page de covoiturage' })).json()
    expect(start.job.status).toBe('queued')

    // One at a time per account: asking again returns the same job.
    const again = await (await call('POST', '/api/admin/mcp/runner/try', { brief: 'Autre chose' })).json()
    expect(again.existing).toBe(true)
    expect(again.job.id).toBe(start.job.id)

    let view
    for (let i = 0; i < 120; i++) {
      view = await (await call('GET', `/api/admin/mcp/runner/jobs/${start.job.id}`)).json()
      if (view.job.status === 'done' || view.job.status === 'failed') break
      await new Promise((r) => setTimeout(r, 500))
    }
    expect(view.job.status, view.job.error).toBe('done')
    expect(view.link).toBe(`${base}/p/${view.job.result.projectId}?screen=${view.job.result.screenId}`)

    // The same pipeline as the composer: the planner, then the generation.
    expect(calls.some((c) => c?.format)).toBe(true)
    expect(calls.some((c) => c?.stream && String(c.messages?.[0]?.content).startsWith('FORMAT: Design this as a DESKTOP'))).toBe(true)

    const data = await (await call('GET', '/api/data')).json()
    const projects = JSON.parse(data.projects)
    const made = projects.find((p) => p.id === view.job.result.projectId)
    expect(made.screens).toHaveLength(1)
    expect(made.screens[0].code).toContain('Covoiturage')
    // Nothing else of the account was rewritten.
    expect(projects.some((p) => p.id === 'existing01')).toBe(true)
    expect(data.design).toBe('# Mine')

    expect(view.job.result.shot, JSON.stringify(view.job.result)).toBeTruthy()
    const shot = await call('GET', `/api/admin/mcp/runner/shots/${view.job.result.shot}`)
    expect(shot.status).toBe(200)
    expect(shot.headers.get('content-type')).toBe('image/png')
  }, 120_000)

  it('never let the generated page reach an internal address', () => {
    // The screen above was rendered and photographed with an <img> pointing at
    // a loopback server. The SSRF rule in the runner's browser refused it.
    expect(canaryHits).toBe(0)
  })

  it('the job token is no session', async () => {
    // A token that was never issued, on a pipeline route: nobody.
    const res = await fetch(`${base}/api/data`, { headers: { 'x-mocky-runner': 'forged-token' } })
    expect(res.status).toBe(401)
  })
})

describe.skipIf(can)('the headless runner (skipped)', () => {
  it('needs a Chromium and `npm run build`', () => {
    expect(can).toBe(false)
  })
})
