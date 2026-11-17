import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MAX_BLOCKS_PER_USER, createBlockStore } from './blocks.js'

let dir
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mocky-blocks-'))
})
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

const draft = (over = {}) => ({
  name: '  Pied de page  Elisa30 ',
  kind: 'footer',
  jsx: '<footer>Tél {phone}</footer>',
  decls: ["const phone = '04 66 05 10 11';"],
  rev: 'abc.def',
  from: { project: 'Post 23-11', screen: 'Carré', extra: 'dropped' },
  ...over,
})

describe('block store', () => {
  it('keeps a block per account, and lists it to that account only', () => {
    const store = createBlockStore(dir)
    const b = store.add('u1', draft())
    expect(b).toMatchObject({ name: 'Pied de page Elisa30', kind: 'footer', rev: 'abc.def', from: { project: 'Post 23-11', screen: 'Carré' } })
    expect(b.id).toMatch(/^b[a-f0-9]{24}$/)
    expect(store.list('u1').map((x) => x.id)).toEqual([b.id])
    expect(store.list('u2')).toEqual([])
    expect(store.update('u2', b.id, { name: 'x' })).toBeNull()
    expect(store.remove('u2', b.id)).toBe(false)
  })

  it('refuses a bad shape, an unknown kind on update, and content without its rev', () => {
    const store = createBlockStore(dir)
    expect(() => store.add('u1', draft({ jsx: '' }))).toThrow()
    expect(() => store.add('u1', draft({ rev: 'not a rev' }))).toThrow()
    expect(() => store.add('u1', draft({ decls: [1] }))).toThrow()
    const b = store.add('u1', draft({ kind: 'weird' }))
    expect(b.kind).toBe('other')
    expect(() => store.update('u1', b.id, { kind: 'weird' })).toThrow()
    expect(() => store.update('u1', b.id, { jsx: '<p/>' })).toThrow()
    const next = store.update('u1', b.id, { jsx: '<p/>', decls: [], rev: '1.2', name: 'Bandeau' })
    expect(next).toMatchObject({ jsx: '<p/>', decls: [], rev: '1.2', name: 'Bandeau', kind: 'other' })
  })

  it('stops at the per-account ceiling and before the disk budget', () => {
    const store = createBlockStore(dir)
    for (let i = 0; i < MAX_BLOCKS_PER_USER; i++) store.add('u1', draft())
    expect(() => store.add('u1', draft())).toThrow(/Delete one first/)
    const full = createBlockStore(dir, { budget: { wouldExceed: () => true, add() {}, remove() {} } })
    expect(() => full.add('u2', draft())).toThrow(/storage limit/)
    expect(fs.existsSync(path.join(dir, 'blocks', 'u2'))).toBe(false)
    // A hundred atomic writes, each listing the directory: slow on a loaded runner.
  }, 30_000)

  it('removes everything of a deleted account', () => {
    const store = createBlockStore(dir)
    store.add('u1', draft())
    store.removeAllFor('u1')
    expect(store.list('u1')).toEqual([])
  })
})
