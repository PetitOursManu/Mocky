// End-to-end wiring test with the REAL MCP SDK: McpHost spawns a real Node
// subprocess (the mock-fetch stdio server), connects over stdio, lists tools,
// and the router calls one. Proves the real transport path, not just fakes.
import { describe, it, expect, afterAll } from 'vitest'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { McpHost } from './host.js'
import { McpToolRouter } from './router.js'
import { createStdioClientFactory } from './realClient.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FIXTURE = path.join(__dirname, '..', '__fixtures__', 'mock-fetch-server.js')

const host = new McpHost(
  {
    servers: [
      { name: 'mock', command: 'node', args: [FIXTURE], env: {}, role: 'inspiration-fetch', idleTimeoutMs: 60_000 },
    ],
  },
  { factory: createStdioClientFactory() },
)

afterAll(async () => {
  await host.shutdown()
})

describe('real stdio round-trip', () => {
  it('connects, lists tools, and calls one via the router', async () => {
    const adapter = await host.ensure('mock')
    expect(adapter).toBeTruthy()
    const status = host.status()[0]
    expect(status.state).toBe('ready')
    expect(status.tools).toEqual(expect.arrayContaining(['fetch_url', 'fetch_urls']))

    const router = new McpToolRouter(host)
    const result = await router.call(
      'inspiration-fetch',
      ['fetch_url', 'fetch_urls'],
      (tool) => (tool === 'fetch_urls' ? { urls: ['https://awwwards.test/site'] } : { url: 'https://awwwards.test/site' }),
    )
    expect(result).toBeTruthy()
    expect(result.content[0].text).toMatch(/Mock inspiration for https:\/\/awwwards\.test\/site/)
  }, 20_000)
})
