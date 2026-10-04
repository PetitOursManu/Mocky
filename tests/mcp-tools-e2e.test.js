import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { spawn } from 'node:child_process'
import crypto from 'node:crypto'
import http from 'node:http'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import net from 'node:net'
import { fileURLToPath } from 'node:url'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { findChromium } from '../server/mcp/runner.js'

/**
 * The whole promise of the MCP plan, from an assistant's side: connect through
 * OAuth, ask for a design, get a picture of it and a link back — with no Mocky
 * tab open — and see the account marked "MCP" in the admin while it happens.
 *
 * A real server, a real Chromium, a fake model. Skipped where a Chromium or
 * `npm run build` is missing, like tests/mcp-runner-e2e.test.js.
 */

const root = fileURLToPath(new URL('..', import.meta.url))
const chromium = (() => {
  try {
    return findChromium()
  } catch {
    return null
  }
})()
const can = Boolean(chromium && fs.existsSync(path.join(root, 'dist', 'runner.html')))

const REDIRECT = 'http://127.0.0.1:9/callback'
const CODE = '```jsx\nexport default function App() {\n  return <main className="p-8"><h1 className="text-3xl font-bold">Boulangerie</h1></main>\n}\n```'

let proc, base, dataDir, fake, cookie, adminId, token, mcp
/** What the fake model was sent, to check what reached the prompt. */
const modelCalls = []

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
    redirect: 'manual',
  })

/** OAuth, the way an assistant does it: register, consent in Mocky, exchange. */
async function connect() {
  const client = await (await call('POST', '/register', { client_name: 'Claude', redirect_uris: [REDIRECT], token_endpoint_auth_method: 'none' })).json()
  const verifier = crypto.randomBytes(32).toString('base64url')
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url')
  const q = new URLSearchParams({ response_type: 'code', client_id: client.client_id, redirect_uri: REDIRECT, code_challenge: challenge, code_challenge_method: 'S256', resource: `${base}/mcp` })
  const id = (await fetch(`${base}/authorize?${q}`, { redirect: 'manual' })).headers.get('location').split('/').pop()
  const { redirect } = await (await call('POST', `/api/connect/${id}`, { approve: true })).json()
  const code = new URL(redirect).searchParams.get('code')
  const tok = await fetch(`${base}/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, code_verifier: verifier, client_id: client.client_id, redirect_uri: REDIRECT, resource: `${base}/mcp` }),
  })
  return (await tok.json()).access_token
}

describe.skipIf(!can)('an assistant designs a screen through Mocky', () => {
  beforeAll(async () => {
    const fakePort = await freePort()
    fake = http.createServer((req, res) => {
      let raw = ''
      req.on('data', (c) => (raw += c))
      req.on('end', () => {
        const body = raw ? JSON.parse(raw) : null
        modelCalls.push(body)
        const content = body?.format ? JSON.stringify({ capabilities: [], layout: 'hero', sections: ['Hero'], contentNotes: '' }) : CODE
        res.setHeader('content-type', body?.stream ? 'application/x-ndjson' : 'application/json')
        res.end(body?.stream ? JSON.stringify({ message: { content } }) + '\n' + JSON.stringify({ done: true }) + '\n' : JSON.stringify({ message: { content }, done: true }))
      })
    })
    await new Promise((r) => fake.listen(fakePort, '127.0.0.1', r))
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mocky-tools-'))
    fs.writeFileSync(
      path.join(dataDir, 'text-config.json'),
      JSON.stringify({ generation: { provider: 'ollama-cloud', 'ollama-cloud': { baseUrl: `http://127.0.0.1:${fakePort}`, model: 'fake', apiKey: '' } } }),
    )
    fs.writeFileSync(path.join(dataDir, 'images-config.json'), JSON.stringify({ content: { provider: 'none' } }))
    const port = await freePort()
    base = `http://127.0.0.1:${port}`
    proc = spawn(process.execPath, [path.join(root, 'server/index.js')], {
      env: { ...process.env, MOCKY_DATA_DIR: dataDir, MOCKY_PORT: String(port), MOCKY_ORIGIN: base, MOCKY_MCP_INSECURE_LOOPBACK: '1', MOCKY_RUNNER_CHROMIUM: chromium, NODE_ENV: 'test' },
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
      body: JSON.stringify({ username: 'boulanger', password: 'correct-horse-battery' }),
    })
    cookie = (reg.headers.get('set-cookie') || '').split(';')[0]
    adminId = (await (await call('GET', '/api/admin/mcp')).json()).users[0].id
    await call('PUT', '/api/admin/mcp/config', { enabled: true, access: { mode: 'allowlist', userIds: [adminId] } })
    token = await connect()
    mcp = new Client({ name: 'test-assistant', version: '1.0.0' })
    await mcp.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`), { requestInit: { headers: { authorization: `Bearer ${token}` } } }))
  }, 60_000)

  afterAll(async () => {
    await mcp?.close().catch(() => {})
    proc?.kill()
    await new Promise((r) => fake?.close(r))
    fs.rmSync(dataDir, { recursive: true, force: true })
  })

  it('offers the tools and the interview prompt', async () => {
    const tools = (await mcp.listTools()).tools.map((t) => t.name).sort()
    expect(tools).toEqual(['add_image', 'add_screen', 'create_design', 'get_design', 'get_project', 'get_screenshot', 'list_projects', 'search_free_images'])
    const prompts = (await mcp.listPrompts()).prompts.map((p) => p.name)
    expect(prompts).toContain('new-design')
  })

  it('asks before generating from a brief that says nothing', async () => {
    const out = await mcp.callTool({ name: 'create_design', arguments: { brief: 'un site' } })
    expect(out.structuredContent.status).toBe('needs_clarification')
    expect(out.content[0].text).toMatch(/De quel écran/)
  })

  it('makes the design, and hands back its picture and its link', async () => {
    let out = await mcp.callTool({
      name: 'create_design',
      arguments: { brief: 'Une page d’accueil pour une boulangerie de quartier', style: 'chaleureux', project_name: 'Boulangerie' },
    })
    // The fake model is instant, but a slow machine may still need a second call.
    for (let i = 0; i < 5 && out.structuredContent?.status === 'running'; i++) {
      out = await mcp.callTool({ name: 'get_design', arguments: { job_id: out.structuredContent.jobId } })
    }
    expect(out.structuredContent.status, JSON.stringify(out.content)).toBe('done')
    const image = out.content.find((c) => c.type === 'image')
    expect(image.mimeType).toBe('image/jpeg')
    expect(Buffer.from(image.data, 'base64').subarray(0, 2).toString('hex')).toBe('ffd8')
    const { link, picture, projectId, screenId } = out.structuredContent
    expect(link).toBe(`${base}/p/${projectId}?screen=${screenId}`)

    // The picture link works for a day, signed; touched, it does not.
    expect((await fetch(picture)).headers.get('content-type')).toBe('image/jpeg')
    expect((await fetch(picture.replace(/s=[^&]+/, 's=forged'))).status).toBe(404)

    // It is in the account, in the project it named.
    const projects = JSON.parse((await (await call('GET', '/api/data')).json()).projects)
    expect(projects.find((p) => p.id === projectId).name).toBe('Boulangerie')
  }, 120_000)

  it('shows a project and photographs an existing screen', async () => {
    const list = await mcp.callTool({ name: 'list_projects', arguments: {} })
    const projectId = list.structuredContent.projects[0].id
    const project = await mcp.callTool({ name: 'get_project', arguments: { project_id: projectId } })
    const screenId = project.structuredContent.screens[0].id
    const shot = await mcp.callTool({ name: 'get_screenshot', arguments: { project_id: projectId, screen_id: screenId } })
    expect(shot.content.some((c) => c.type === 'image')).toBe(true)
  }, 60_000)

  it('answers someone else’s project like a missing one (X4)', async () => {
    const out = await mcp.callTool({ name: 'get_project', arguments: { project_id: 'not-mine-01' } })
    expect(out.isError).toBe(true)
    const add = await mcp.callTool({ name: 'add_screen', arguments: { brief: 'Un tableau de bord pour suivre les ventes du jour', project_id: 'not-mine-01' } })
    expect(add.isError).toBe(true)
  })

  it('uses the pictures the assistant chose, by URL, in the prompt', async () => {
    // A picture already in this account's library (as add_image would leave it).
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')
    const up = await fetch(`${base}/api/images/upload?name=storefront`, { method: 'POST', headers: { 'content-type': 'image/png', cookie }, body: png })
    const { hash } = await up.json()
    const before = modelCalls.length
    let out = await mcp.callTool({
      name: 'create_design',
      arguments: { brief: 'La page d’accueil de la boulangerie Dupont, chaleureuse', images: [{ image_id: hash, use: 'hero: la devanture' }] },
    })
    for (let i = 0; i < 5 && out.structuredContent?.status === 'running'; i++) {
      out = await mcp.callTool({ name: 'get_design', arguments: { job_id: out.structuredContent.jobId } })
    }
    expect(out.structuredContent.status, JSON.stringify(out.content)).toBe('done')
    const sent = modelCalls.slice(before).map((c) => JSON.stringify(c)).join('\n')
    expect(sent).toContain('PICTURES — the person supplied one picture')
    expect(sent).toContain(`hero: la devanture → ${base}/api/images/${hash}`)
  }, 120_000)

  it('refuses a picture that is not in this account’s library, and one at an internal address', async () => {
    const foreign = await mcp.callTool({
      name: 'create_design',
      arguments: { brief: 'Une page de contact pour la boulangerie Dupont', images: [{ image_id: 'e'.repeat(64), use: 'hero' }] },
    })
    expect(foreign.isError).toBe(true)
    const internal = await mcp.callTool({ name: 'add_image', arguments: { use: 'x', image_url: `${base}/api/images/x.png` } })
    expect(internal.isError).toBe(true)
    expect(internal.content[0].text).toMatch(/could not be added/)
    const none = await mcp.callTool({ name: 'search_free_images', arguments: { query: 'bakery' } })
    // No Pexels/Pixabay key in this test: said, not a crash.
    expect(none.isError).toBe(true)
  })

  it('never puts a new design into an old project on its own', async () => {
    // What ChatGPT did on the first real test: list the projects, then pass one
    // of them to create_design. The field no longer exists there; whatever a
    // model sends, create_design makes a NEW project.
    const before = (await mcp.callTool({ name: 'list_projects', arguments: {} })).structuredContent.projects
    const old = before[0]
    let out = await mcp.callTool({
      name: 'create_design',
      arguments: { brief: 'Une page de connexion pour une appli de covoiturage', project_id: old.id },
    })
    for (let i = 0; i < 5 && out.structuredContent?.status === 'running'; i++) {
      out = await mcp.callTool({ name: 'get_design', arguments: { job_id: out.structuredContent.jobId } })
    }
    expect(out.structuredContent.status).toBe('done')
    expect(out.structuredContent.projectId).not.toBe(old.id)
    const after = (await mcp.callTool({ name: 'list_projects', arguments: {} })).structuredContent.projects
    expect(after.find((p) => p.id === old.id).screens).toBe(old.screens)
  }, 120_000)

  it('gives a screen the type the request names — a flyer is an A4 page', async () => {
    // The second real test: the type was asked for in words and the result was
    // a generic web page, because the pipeline's own type was never set.
    let out = await mcp.callTool({ name: 'create_design', arguments: { brief: 'Un flyer pour la fête du quartier samedi soir' } })
    for (let i = 0; i < 5 && out.structuredContent?.status === 'running'; i++) {
      out = await mcp.callTool({ name: 'get_design', arguments: { job_id: out.structuredContent.jobId } })
    }
    expect(out.structuredContent.status, JSON.stringify(out.content)).toBe('done')
    expect(out.content.find((c) => c.type === 'text').text).toContain('Type d’écran : flyer')
    const project = await mcp.callTool({ name: 'get_project', arguments: { project_id: out.structuredContent.projectId } })
    const screen = project.structuredContent.screens[0]
    expect(screen.height).toBeGreaterThan(screen.width)
  }, 120_000)

  it('adds to an existing project only through add_screen, and says which one', async () => {
    const projects = (await mcp.callTool({ name: 'list_projects', arguments: {} })).structuredContent.projects
    const target = projects.find((p) => p.name === 'Boulangerie')
    let out = await mcp.callTool({
      name: 'add_screen',
      arguments: { project_id: target.id, brief: 'Une page de contact pour la boulangerie, avec horaires et plan' },
    })
    for (let i = 0; i < 5 && out.structuredContent?.status === 'running'; i++) {
      out = await mcp.callTool({ name: 'get_design', arguments: { job_id: out.structuredContent.jobId } })
    }
    expect(out.structuredContent.projectId).toBe(target.id)
    expect(out.content[0].text).toContain('« Boulangerie »')
  }, 120_000)

  it('marks the account "MCP" in the admin while it uses Mocky through an assistant', async () => {
    const overview = await (await call('GET', '/api/admin/dashboard/overview')).json()
    const me = overview.people.find((p) => p.id === adminId)
    expect(me.mcp).toBe(true)
    expect(me.state).toBe('active')
  })

  it('refuses to write during maintenance, and still reads', async () => {
    await call('PUT', '/api/admin/maintenance', { on: true })
    const create = await mcp.callTool({ name: 'create_design', arguments: { brief: 'Une page de contact pour la boulangerie du quartier' } })
    expect(create.isError).toBe(true)
    const list = await mcp.callTool({ name: 'list_projects', arguments: {} })
    expect(list.isError).toBeFalsy()
    await call('PUT', '/api/admin/maintenance', { on: false })
  })
})

describe.skipIf(can)('an assistant designs a screen through Mocky (skipped)', () => {
  it('needs a Chromium and `npm run build`', () => {
    expect(can).toBe(false)
  })
})
