import { describe, it, expect } from 'vitest'
import { parseRobots, groupForAgent, isPathAllowed, robotsAllows } from './robots.js'

const SAMPLE = `
# comment
User-agent: *
Disallow: /private
Allow: /private/public

User-agent: Mocky-Muse
Disallow: /nope
`

describe('parseRobots / groupForAgent / isPathAllowed', () => {
  it('parses groups and applies longest-prefix with Allow winning ties', () => {
    const groups = parseRobots(SAMPLE)
    const star = groupForAgent(groups, 'SomeRandomBot')
    expect(isPathAllowed(star, '/private/secret')).toBe(false)
    expect(isPathAllowed(star, '/private/public/page')).toBe(true) // more specific Allow wins
    expect(isPathAllowed(star, '/open')).toBe(true)
  })

  it('prefers the UA-specific group over *', () => {
    const groups = parseRobots(SAMPLE)
    const mine = groupForAgent(groups, 'Mocky-Muse/0.1 (+repo)')
    expect(isPathAllowed(mine, '/nope/x')).toBe(false)
    // The specific group has no rule about /private, so it's allowed there.
    expect(isPathAllowed(mine, '/private/secret')).toBe(true)
  })

  it('treats an empty Disallow as allow-all', () => {
    const groups = parseRobots('User-agent: *\nDisallow:')
    expect(isPathAllowed(groupForAgent(groups, 'x'), '/anything')).toBe(true)
  })

  it('allows everything when there are no groups', () => {
    expect(isPathAllowed(groupForAgent(parseRobots(''), 'x'), '/a')).toBe(true)
  })
})

describe('robotsAllows (fail-open)', () => {
  const ok = (text) => async () => ({ ok: true, text: async () => text })

  it('allows when robots.txt disallows nothing relevant', async () => {
    const allowed = await robotsAllows('https://site.test/hello', 'Mocky-Muse', { fetchImpl: ok('User-agent: *\nDisallow: /admin') })
    expect(allowed).toBe(true)
  })

  it('blocks a disallowed path', async () => {
    const allowed = await robotsAllows('https://site.test/admin/x', 'Mocky-Muse', { fetchImpl: ok('User-agent: *\nDisallow: /admin') })
    expect(allowed).toBe(false)
  })

  it('fail-opens on a 404 robots.txt', async () => {
    const allowed = await robotsAllows('https://site.test/x', 'Mocky-Muse', { fetchImpl: async () => ({ ok: false }) })
    expect(allowed).toBe(true)
  })

  it('fail-opens when the fetch throws', async () => {
    const allowed = await robotsAllows('https://site.test/x', 'Mocky-Muse', { fetchImpl: async () => { throw new Error('net') } })
    expect(allowed).toBe(true)
  })

  it('fail-opens on an unparseable URL', async () => {
    expect(await robotsAllows('not a url', 'Mocky-Muse')).toBe(true)
  })
})
