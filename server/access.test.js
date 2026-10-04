import { describe, it, expect } from 'vitest'
import { onList, scopeAllows } from './access.js'

const alice = { id: 'u-alice', role: 'user' }
const admin = { id: 'u-admin', role: 'admin' }

describe('onList', () => {
  it('names an account by its id, trimmed', () => {
    expect(onList(['u-alice'], alice)).toBe(true)
    expect(onList(['u-alice'], { id: ' u-alice ' })).toBe(true)
  })

  it('never says yes to a missing id or a list that is not a list', () => {
    expect(onList(['u-alice'], null)).toBe(false)
    expect(onList(['u-alice'], { id: '' })).toBe(false)
    expect(onList([''], { id: '  ' })).toBe(false)
    expect(onList('u-alice', alice)).toBe(false)
    expect(onList(undefined, alice)).toBe(false)
  })

  it('does not let an administrator in on the role alone', () => {
    expect(onList(['u-alice'], admin)).toBe(false)
  })
})

describe('scopeAllows — a new scope fails closed', () => {
  it("opens to everyone only on 'all'", () => {
    expect(scopeAllows({ mode: 'all', userIds: [] }, alice)).toBe(true)
  })

  it('lets the list decide on anything else, an unknown mode included', () => {
    for (const mode of ['allowlist', 'everyone', undefined, null, 42]) {
      expect(scopeAllows({ mode, userIds: ['u-alice'] }, alice)).toBe(true)
      expect(scopeAllows({ mode, userIds: ['u-alice'] }, admin)).toBe(false)
    }
    expect(scopeAllows(undefined, alice)).toBe(false)
    expect(scopeAllows(null, admin)).toBe(false)
  })
})
