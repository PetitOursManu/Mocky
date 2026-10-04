import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { createRunnerAuth, runnerRouteAllowed, RUNNER_TOKEN_TTL_MS } from './runner-auth.js'
import { findChromium } from './runner.js'

describe('the runner token opens the routes a generation needs, and nothing else', () => {
  it('opens the pipeline routes', () => {
    for (const p of ['/__provider/api/chat', '/api/data', '/api/muse/dossier', '/api/images/generate', '/api/images/abc', '/api/text/vision', '/api/videos/generate', '/api/config', '/api/mcp/status']) {
      expect(runnerRouteAllowed(p), p).toBe(true)
    }
  })

  it('closes everything a session could do beyond that', () => {
    for (const p of [
      '/api/account/password',
      '/api/admin/users',
      '/api/admin/mcp',
      '/api/mcp/connections',
      '/api/share',
      '/api/logout',
      '/api/data/events',
      '/api/account/mcp-connections',
      '/api/connect/abc',
      '/mcp',
      '/api/dataX',
      '/__providerX',
      '/api/video/exports',
    ]) {
      expect(runnerRouteAllowed(p), p).toBe(false)
    }
  })

  it('reads the full path, not the one a mount stripped', () => {
    // Under app.use('/__provider') Express hands handlers '/api/chat'.
    expect(runnerRouteAllowed('/api/chat')).toBe(false)
    expect(runnerRouteAllowed('/__provider/api/chat?x=1')).toBe(true)
  })

  it('names one account and one job, and dies with the job', () => {
    let now = 1_000
    const auth = createRunnerAuth({ now: () => now })
    const token = auth.issue('u1', 'job1')
    expect(auth.resolve(token, '/api/data')).toEqual({ userId: 'u1', jobId: 'job1' })
    expect(auth.resolve(token, '/api/admin/users')).toBeNull()
    expect(auth.resolve('forged', '/api/data')).toBeNull()
    auth.revokeJob('job1')
    expect(auth.resolve(token, '/api/data')).toBeNull()
    const late = auth.issue('u1', 'job2')
    now += RUNNER_TOKEN_TTL_MS + 1
    expect(auth.resolve(late, '/api/data')).toBeNull()
  })
})

describe('finding a Chromium', () => {
  const fakeFs = (files) => ({
    exists: (p) => files.includes(p.replace(/\\/g, '/')),
    readdir: (dir) => {
      const prefix = dir.replace(/\\/g, '/') + '/'
      return [...new Set(files.filter((f) => f.startsWith(prefix)).map((f) => f.slice(prefix.length).split('/')[0]))]
    },
  })

  it('takes what the administrator named, or nothing', () => {
    const fs = fakeFs(['/opt/chrome'])
    expect(findChromium({ env: { MOCKY_RUNNER_CHROMIUM: '/opt/chrome' }, ...fs })).toBe('/opt/chrome')
    expect(findChromium({ env: { MOCKY_RUNNER_CHROMIUM: '/missing' }, ...fs })).toBeNull()
  })

  it('prefers the build playwright-core expects, then the newest other one', () => {
    const root = '/ms-playwright'
    const files = [`${root}/chromium-1148/chrome-linux/chrome`, `${root}/chromium-1243/chrome-linux/chrome`]
    const fs = fakeFs(files)
    expect(findChromium({ env: { PLAYWRIGHT_BROWSERS_PATH: root }, expected: files[0], ...fs })).toBe(files[0])
    expect(findChromium({ env: { PLAYWRIGHT_BROWSERS_PATH: root }, expected: '/nope', ...fs }).replace(/\\/g, '/')).toBe(path.posix.join(root, 'chromium-1243/chrome-linux/chrome'))
  })

  it('says null when there is none', () => {
    expect(findChromium({ env: {}, ...fakeFs([]) })).toBeNull()
  })
})
