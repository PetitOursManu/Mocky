import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createCreationStore, MAX_CREATION_SOURCE, MAX_CREATIONS_PER_USER } from './creations.js'

const input = (name = 'CustomThing', extra = {}) => ({ kind: 'element', name, description: 'd', usage: `<${name} />`, source: 'x', review: 'ok', ...extra })

describe('the creations store', () => {
  let dir
  let store

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mocky-creations-'))
    store = createCreationStore(dir)
  })
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

  it('keeps a creation for its account alone', () => {
    store.add('u1', input())
    expect(store.list('u1')).toHaveLength(1)
    expect(store.list('u2')).toEqual([])
  })

  it('holds one creation per name', () => {
    store.add('u1', input())
    store.add('u1', input('CustomThing', { description: 'second' }))
    expect(store.list('u1').map((c) => c.description)).toEqual(['second'])
  })

  it('refuses a name a screen could collide with, an unknown kind, an oversized source', () => {
    expect(() => store.add('u1', input('Button'))).toThrow(/name/)
    expect(() => store.add('u1', input('CustomThing', { kind: 'film' }))).toThrow(/kind/)
    expect(() => store.add('u1', input('CustomThing', { source: 'x'.repeat(MAX_CREATION_SOURCE + 1) }))).toThrow(/source/)
  })

  it('refuses an account id that would leave its directory', () => {
    expect(() => store.add('../x', input())).toThrow(/account/)
  })

  it('deletes only inside the account that asks', () => {
    const { id } = store.add('u1', input())
    expect(store.remove('u2', id)).toBe(false)
    expect(store.remove('u1', id)).toBe(true)
    expect(store.list('u1')).toEqual([])
  })

  it('stops at its ceiling, oldest first', () => {
    for (let i = 0; i < MAX_CREATIONS_PER_USER + 2; i++) store.add('u1', input(`CustomN${i}a`))
    const names = store.list('u1').map((c) => c.name)
    expect(names).toHaveLength(MAX_CREATIONS_PER_USER)
    expect(names).not.toContain('CustomN0a')
  })

  it('forgets an account', () => {
    store.add('u1', input())
    store.removeAllFor('u1')
    expect(store.list('u1')).toEqual([])
  })
})
