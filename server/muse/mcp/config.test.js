import { describe, it, expect } from 'vitest'
import { parseMcpConfig, loadMcpConfig } from './config.js'

describe('parseMcpConfig', () => {
  it('normalizes a valid server entry with defaults', () => {
    const { servers } = parseMcpConfig({
      mcpServers: {
        fetcher: { command: 'npx', args: ['-y', 'fetcher-mcp'], role: 'inspiration-fetch' },
      },
    })
    expect(servers).toHaveLength(1)
    expect(servers[0]).toMatchObject({
      name: 'fetcher',
      command: 'npx',
      args: ['-y', 'fetcher-mcp'],
      role: 'inspiration-fetch',
      autoStart: false, // default
      idleTimeoutMs: 5 * 60 * 1000, // default
    })
  })

  it('drops entries with no command', () => {
    const { servers } = parseMcpConfig({ mcpServers: { bad: { args: ['x'] }, good: { command: 'node' } } })
    expect(servers.map((s) => s.name)).toEqual(['good'])
  })

  it('honors explicit autoStart/idleTimeoutMs/env', () => {
    const { servers } = parseMcpConfig({
      mcpServers: { s: { command: 'node', autoStart: true, idleTimeoutMs: 1234, env: { FOO: 'bar', N: 5 } } },
    })
    expect(servers[0].autoStart).toBe(true)
    expect(servers[0].idleTimeoutMs).toBe(1234)
    expect(servers[0].env).toEqual({ FOO: 'bar' }) // non-string env values dropped
  })

  it('defaults role to "generic" and ignores non-positive idle timeouts', () => {
    const { servers } = parseMcpConfig({ mcpServers: { s: { command: 'node', idleTimeoutMs: -1 } } })
    expect(servers[0].role).toBe('generic')
    expect(servers[0].idleTimeoutMs).toBe(5 * 60 * 1000)
  })

  it('returns empty for garbage input', () => {
    expect(parseMcpConfig(null).servers).toEqual([])
    expect(parseMcpConfig({}).servers).toEqual([])
    expect(parseMcpConfig({ mcpServers: 'nope' }).servers).toEqual([])
  })
})

describe('loadMcpConfig', () => {
  it('returns empty servers when the file is missing (never throws)', () => {
    const cfg = loadMcpConfig('/definitely/not/a/real/dir/xyz')
    expect(cfg).toEqual({ servers: [] })
  })
})
