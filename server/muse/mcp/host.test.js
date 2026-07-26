import { describe, it, expect, vi } from 'vitest'
import { McpHost } from './host.js'

// --- test doubles ---------------------------------------------------------

/** A manual scheduler so idle timers fire only when the test says so. */
function manualScheduler() {
  let timers = []
  return {
    setTimeout: (fn) => {
      const id = { fn }
      timers.push(id)
      return id
    },
    clearTimeout: (id) => {
      timers = timers.filter((t) => t !== id)
    },
    pending: () => timers.length,
    async fireAll() {
      const cur = timers
      timers = []
      for (const t of cur) await t.fn()
    },
  }
}

/** A fake client factory. Fails the first `failTimes` calls, then connects. */
function fakeFactory({ tools = [{ name: 'fetch_url' }], failTimes = 0 } = {}) {
  const state = { calls: 0, closes: 0 }
  const factory = async () => {
    state.calls++
    if (state.calls <= failTimes) throw new Error('spawn boom')
    return {
      tools,
      callTool: async (name) => ({ content: [{ type: 'text', text: `called ${name}` }] }),
      close: async () => {
        state.closes++
      },
    }
  }
  factory.state = state
  return factory
}

function makeHost(overrides = {}) {
  const config = {
    servers: [
      { name: 'fetcher', command: 'x', args: [], env: {}, role: 'inspiration-fetch', idleTimeoutMs: 1000 },
    ],
  }
  const scheduler = overrides.scheduler || manualScheduler()
  const factory = overrides.factory || fakeFactory()
  const host = new McpHost(config, { factory, scheduler, now: overrides.now })
  return { host, scheduler, factory }
}

// --- tests ----------------------------------------------------------------

describe('McpHost lifecycle', () => {
  it('starts stopped and lazy-spawns on first ensure', async () => {
    const { host, factory } = makeHost()
    expect(host.status()[0].state).toBe('stopped')
    expect(factory.state.calls).toBe(0)

    const adapter = await host.ensure('fetcher')
    expect(adapter).toBeTruthy()
    const s = host.status()[0]
    expect(s.state).toBe('ready')
    expect(s.tools).toEqual(['fetch_url'])
    expect(factory.state.calls).toBe(1)
  })

  it('reuses a ready server instead of re-spawning', async () => {
    const { host, factory } = makeHost()
    await host.ensure('fetcher')
    await host.ensure('fetcher')
    expect(factory.state.calls).toBe(1)
  })

  it('dedupes concurrent ensure() into one spawn', async () => {
    const { host, factory } = makeHost()
    const [a, b] = await Promise.all([host.ensure('fetcher'), host.ensure('fetcher')])
    expect(a).toBe(b)
    expect(factory.state.calls).toBe(1)
  })

  it('degrades on spawn failure: returns null, records error, never throws', async () => {
    const { host } = makeHost({ factory: fakeFactory({ failTimes: 1 }) })
    const adapter = await host.ensure('fetcher')
    expect(adapter).toBeNull()
    const s = host.status()[0]
    expect(s.state).toBe('error')
    expect(s.lastError).toMatch(/spawn boom/)
  })

  it('callTool throws when the server is unavailable (router will catch)', async () => {
    const { host } = makeHost({ factory: fakeFactory({ failTimes: 1 }) })
    await expect(host.callTool('fetcher', 'fetch_url', {})).rejects.toThrow(/unavailable/)
  })

  it('returns null for an unknown server name', async () => {
    const { host } = makeHost()
    expect(await host.ensure('nope')).toBeNull()
  })

  it('kills an idle server, then re-spawns on next use', async () => {
    const { host, scheduler, factory } = makeHost()
    await host.ensure('fetcher')
    expect(scheduler.pending()).toBe(1)

    await scheduler.fireAll() // trigger the idle timeout
    expect(host.status()[0].state).toBe('stopped')
    expect(factory.state.closes).toBe(1)

    await host.ensure('fetcher') // usable again
    expect(host.status()[0].state).toBe('ready')
    expect(factory.state.calls).toBe(2)
  })

  it('shutdown closes connected servers and blocks further spawns', async () => {
    const { host, factory } = makeHost()
    await host.ensure('fetcher')
    await host.shutdown()
    expect(factory.state.closes).toBe(1)
    expect(host.status()[0].state).toBe('stopped')
    expect(await host.ensure('fetcher')).toBeNull() // shutting down
  })

  it('serversForRole filters by declared role', () => {
    const { host } = makeHost()
    expect(host.serversForRole('inspiration-fetch').map((d) => d.name)).toEqual(['fetcher'])
    expect(host.serversForRole('image-gen')).toEqual([])
  })

  it('startAutoStart only starts autoStart servers', async () => {
    const factory = fakeFactory()
    const host = new McpHost(
      {
        servers: [
          { name: 'a', command: 'x', args: [], env: {}, role: 'r', idleTimeoutMs: 1000, autoStart: true },
          { name: 'b', command: 'x', args: [], env: {}, role: 'r', idleTimeoutMs: 1000, autoStart: false },
        ],
      },
      { factory, scheduler: manualScheduler() },
    )
    await host.startAutoStart()
    const byName = Object.fromEntries(host.status().map((s) => [s.name, s.state]))
    expect(byName.a).toBe('ready')
    expect(byName.b).toBe('stopped')
  })
})
