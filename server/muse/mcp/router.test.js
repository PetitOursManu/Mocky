import { describe, it, expect, vi } from 'vitest'
import { McpToolRouter, pickTool } from './router.js'

/** A minimal fake host exposing only what the router needs. */
function fakeHost(overrides = {}) {
  return {
    serversForRole: overrides.serversForRole || ((role) =>
      role === 'inspiration-fetch' ? [{ name: 'fetcher', role }] : []),
    ensure: overrides.ensure || (async (name) => (name === 'fetcher' ? { tools: [{ name: 'fetch_url' }] } : null)),
    callTool: overrides.callTool || (async (name, tool, args) => ({ content: [{ type: 'text', text: `${tool}:${JSON.stringify(args)}` }] })),
  }
}

describe('pickTool', () => {
  it('prefers the earliest candidate that exists', () => {
    const tools = [{ name: 'fetch_urls' }, { name: 'fetch_url' }]
    expect(pickTool(tools, ['fetch_url', 'fetch_urls'])).toBe('fetch_url')
  })
  it('returns null when no candidate matches', () => {
    expect(pickTool([{ name: 'other' }], ['fetch_url'])).toBeNull()
  })
  it('falls back to the first tool when no candidates are given', () => {
    expect(pickTool([{ name: 'x' }, { name: 'y' }], [])).toBe('x')
    expect(pickTool([], [])).toBeNull()
  })
})

describe('McpToolRouter.call', () => {
  it('routes to a server for the role and returns the tool result', async () => {
    const router = new McpToolRouter(fakeHost())
    const res = await router.call('inspiration-fetch', ['fetch_url'], { url: 'https://x.test' })
    expect(res.content[0].text).toBe('fetch_url:{"url":"https://x.test"}')
  })

  it('supports an args factory that depends on the chosen tool', async () => {
    const captured = []
    const host = fakeHost({ callTool: async (n, t, a) => { captured.push([t, a]); return { content: [] } } })
    const router = new McpToolRouter(host)
    await router.call('inspiration-fetch', ['fetch_url'], (tool) => (tool === 'fetch_urls' ? { urls: ['u'] } : { url: 'u' }))
    expect(captured).toEqual([['fetch_url', { url: 'u' }]])
  })

  it('returns null + notice when no server declares the role', async () => {
    const onNotice = vi.fn()
    const router = new McpToolRouter(fakeHost())
    expect(await router.call('image-gen', ['gen'], {}, { onNotice })).toBeNull()
    expect(onNotice).toHaveBeenCalledWith(expect.stringMatching(/no MCP server/i))
  })

  it('returns null + notice when the server is unavailable', async () => {
    const onNotice = vi.fn()
    const router = new McpToolRouter(fakeHost({ ensure: async () => null }))
    expect(await router.call('inspiration-fetch', ['fetch_url'], {}, { onNotice })).toBeNull()
    expect(onNotice).toHaveBeenCalledWith(expect.stringMatching(/unavailable/i))
  })

  it('returns null + notice when no matching tool exists', async () => {
    const onNotice = vi.fn()
    const host = fakeHost({ ensure: async () => ({ tools: [{ name: 'something_else' }] }) })
    const router = new McpToolRouter(host)
    expect(await router.call('inspiration-fetch', ['fetch_url'], {}, { onNotice })).toBeNull()
    expect(onNotice).toHaveBeenCalledWith(expect.stringMatching(/no matching tool/i))
  })

  it('returns null + notice when the tool call throws', async () => {
    const onNotice = vi.fn()
    const host = fakeHost({ callTool: async () => { throw new Error('kaboom') } })
    const router = new McpToolRouter(host)
    expect(await router.call('inspiration-fetch', ['fetch_url'], {}, { onNotice })).toBeNull()
    expect(onNotice).toHaveBeenCalledWith(expect.stringMatching(/kaboom/))
  })
})
