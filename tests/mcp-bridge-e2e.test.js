import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import net from 'node:net'
import { fileURLToPath } from 'node:url'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

/**
 * The LAN bridge (phase 5, bridge/mocky-mcp.js), as Claude Desktop uses it: a
 * client starts it over stdio, the person allows it once in Mocky through the
 * browser, and from then on every message is relayed to Mocky's /mcp — and a
 * second start needs no browser at all.
 *
 * A real Mocky, no model: the tools listed and a read are proof enough that the
 * relay carries both directions; what the tools do is mcp-tools-e2e's business.
 */

const root = fileURLToPath(new URL('..', import.meta.url))
const BRIDGE = path.join(root, 'bridge', 'mocky-mcp.js')

let proc, base, dataDir, home, cookie

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

/** Start the bridge as a client would, and hand back the address it asks a person to open, if any. */
async function startBridge(callbackPort) {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [BRIDGE, '--url', base, '--port', String(callbackPort)],
    env: { ...process.env, MOCKY_MCP_BROWSER: 'none', MOCKY_MCP_HOME: home },
    stderr: 'pipe',
  })
  let log = ''
  transport.stderr?.on('data', (c) => (log += c))
  const client = new Client({ name: 'claude-desktop-like', version: '1.0.0' })
  const connected = client.connect(transport)
  return { client, connected, log: () => log }
}

/** What a person does in the browser: open the address, Allow, follow the redirect home. */
async function consent(url) {
  const id = (await fetch(url, { redirect: 'manual' })).headers.get('location').split('/').pop()
  const { redirect } = await (await call('POST', `/api/connect/${id}`, { approve: true })).json()
  expect(new URL(redirect).hostname).toBe('127.0.0.1')
  return fetch(redirect)
}

describe('the LAN bridge relays a local client to Mocky', () => {
  beforeAll(async () => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mocky-bridge-'))
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'mocky-bridge-home-'))
    const port = await freePort()
    base = `http://127.0.0.1:${port}`
    proc = spawn(process.execPath, [path.join(root, 'server/index.js')], {
      env: { ...process.env, MOCKY_DATA_DIR: dataDir, MOCKY_PORT: String(port), MOCKY_ORIGIN: base, MOCKY_MCP_INSECURE_LOOPBACK: '1', NODE_ENV: 'test' },
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
      body: JSON.stringify({ username: 'lan', password: 'correct-horse-battery' }),
    })
    cookie = (reg.headers.get('set-cookie') || '').split(';')[0]
    const adminId = (await (await call('GET', '/api/admin/mcp')).json()).users[0].id
    await call('PUT', '/api/admin/mcp/config', { enabled: true, access: { mode: 'allowlist', userIds: [adminId] } })
  }, 30_000)

  afterAll(() => {
    proc?.kill()
    for (const d of [dataDir, home]) if (d) fs.rmSync(d, { recursive: true, force: true })
  })

  it('asks once in the browser, then relays both ways — and remembers', async () => {
    const callbackPort = await freePort()
    const first = await startBridge(callbackPort)
    // The client's initialize waits while the person allows the bridge.
    let url = null
    for (let i = 0; i < 100 && !url; i++) {
      url = /allow the bridge: (\S+)/.exec(first.log())?.[1] ?? null
      if (!url) await new Promise((r) => setTimeout(r, 100))
    }
    expect(url, first.log()).toMatch(new RegExp(`^${base}/authorize\\?`))
    expect((await consent(url)).status).toBe(200)
    await first.connected
    const tools = (await first.client.listTools()).tools.map((t) => t.name)
    expect(tools).toContain('create_design')
    const listed = await first.client.callTool({ name: 'list_projects', arguments: {} })
    expect(listed.structuredContent.projects).toEqual([])
    await first.client.close()

    // The connection is the person's, and Mocky shows it.
    const mine = (await (await call('GET', '/api/account/mcp-connections')).json()).connections
    expect(mine.map((c) => c.clientName)).toContain('Mocky bridge (mocky-mcp)')
    // Its file is readable by its owner alone (where the platform has modes).
    const [file] = fs.readdirSync(home)
    if (process.platform !== 'win32') expect(fs.statSync(path.join(home, file)).mode & 0o077).toBe(0)

    // A second start: no browser, straight through.
    const second = await startBridge(callbackPort)
    await second.connected
    expect((await second.client.listTools()).tools.length).toBeGreaterThan(5)
    expect(second.log()).not.toMatch(/allow the bridge/)
    await second.client.close()
  }, 60_000)
})
