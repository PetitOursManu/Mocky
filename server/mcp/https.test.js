import { describe, it, expect } from 'vitest'
import { originAllowsMcp, mcpReadiness } from './https.js'
import { redirectAllowed } from './provider.js'
import { mergeMcpConfig, defaultMcpConfig } from './config.js'

const req = (headers = {}, secure = false) => ({ secure, headers })

describe('when the MCP server may exist', () => {
  it('needs an https origin with no path', () => {
    expect(originAllowsMcp('https://mocky.example.com')).toBe(true)
    expect(originAllowsMcp('https://mocky.example.com/')).toBe(true)
    expect(originAllowsMcp('http://mocky.example.com')).toBe(false)
    expect(originAllowsMcp('https://mocky.example.com/sub')).toBe(false)
    expect(originAllowsMcp('')).toBe(false)
    expect(originAllowsMcp('not a url')).toBe(false)
  })

  it('accepts http only on loopback, only with the development flag', () => {
    expect(originAllowsMcp('http://localhost:8787', {})).toBe(false)
    expect(originAllowsMcp('http://localhost:8787', { MOCKY_MCP_INSECURE_LOOPBACK: '1' })).toBe(true)
    expect(originAllowsMcp('http://192.168.1.10:8787', { MOCKY_MCP_INSECURE_LOOPBACK: '1' })).toBe(false)
  })
})

describe('the checklist the admin section shows', () => {
  const origin = 'https://mocky.example.com'

  it('holds when the request itself came over TLS to that host', () => {
    expect(mcpReadiness(origin, req({ host: 'mocky.example.com' }, true), {}).ok).toBe(true)
    expect(mcpReadiness(origin, req({ host: 'internal:8787', 'x-forwarded-proto': 'https', 'x-forwarded-host': 'mocky.example.com' }), {}).ok).toBe(true)
  })

  it('does not take the configuration as proof of TLS', () => {
    const r = mcpReadiness(origin, req({ host: 'mocky.example.com' }), {})
    expect(r.originHttps).toBe(true)
    expect(r.requestHttps).toBe(false)
    expect(r.ok).toBe(false)
  })

  it('refuses a request to another host', () => {
    expect(mcpReadiness(origin, req({ host: '10.0.0.5:8787' }, true), {}).hostMatches).toBe(false)
  })

  it('never claims to know whether the Internet can reach it', () => {
    expect(mcpReadiness(origin, req({ host: 'mocky.example.com' }, true), {}).reachableFromInternet).toBe('unknown')
  })
})

describe('which clients may register', () => {
  it('known: Claude, ChatGPT and loopback', () => {
    expect(redirectAllowed('https://claude.ai/api/mcp/auth_callback', 'known')).toBe(true)
    expect(redirectAllowed('https://chatgpt.com/connector_platform_oauth_redirect', 'known')).toBe(true)
    expect(redirectAllowed('http://127.0.0.1:33418/callback', 'known')).toBe(true)
    expect(redirectAllowed('https://evil.example/cb', 'known')).toBe(false)
    expect(redirectAllowed('https://claude.ai.evil.example/cb', 'known')).toBe(false)
  })

  it('any: still https or loopback, never a fragment', () => {
    expect(redirectAllowed('https://other.example/cb', 'any')).toBe(true)
    expect(redirectAllowed('http://other.example/cb', 'any')).toBe(false)
    expect(redirectAllowed('https://other.example/cb#x', 'any')).toBe(false)
    expect(redirectAllowed('javascript:alert(1)', 'any')).toBe(false)
  })
})

describe('the configuration', () => {
  it('starts off, closed and empty', () => {
    expect(defaultMcpConfig()).toMatchObject({ enabled: false, access: { mode: 'allowlist', userIds: [] }, clients: 'known' })
  })

  it('reads an unknown access mode as the list, never as everyone', () => {
    expect(mergeMcpConfig(defaultMcpConfig(), { access: { mode: 'everyone' } }).access.mode).toBe('allowlist')
  })

  it('keeps token lifetimes inside their bounds', () => {
    const c = mergeMcpConfig(defaultMcpConfig(), { tokenTtl: { accessMin: 0, refreshDays: 9999 } })
    expect(c.tokenTtl).toEqual({ accessMin: 5, refreshDays: 365 })
  })

  it('lets the daily quota be cleared back to unlimited', () => {
    const set = mergeMcpConfig(defaultMcpConfig(), { dailyQuota: 20 })
    expect(set.dailyQuota).toBe(20)
    expect(mergeMcpConfig(set, { dailyQuota: null }).dailyQuota).toBeNull()
    expect(mergeMcpConfig(set, {}).dailyQuota).toBe(20)
  })
})
