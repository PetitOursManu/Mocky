import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createThumbStore, MAX_THUMB_BYTES, MAX_THUMBS_PER_USER } from './thumbs.js'

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])
const H1 = 'abc-1'
const H2 = 'def-2'

describe('the thumbnail store', () => {
  let dir
  let store

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mocky-thumbs-'))
    store = createThumbStore(dir)
  })
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

  it('hands a picture back for the state it was taken of, and no other', () => {
    store.put('u1', 's1', H1, JPEG)
    expect(store.read('u1', 's1', H1)).toEqual(JPEG)
    expect(store.read('u1', 's1', H2)).toBeNull()
    expect(store.known('u1', [{ id: 's1', hash: H1 }, { id: 's1', hash: H2 }, { id: 'nope', hash: H1 }])).toEqual(['s1'])
  })

  it('keeps one picture per screen', () => {
    store.put('u1', 's1', H1, JPEG)
    store.put('u1', 's1', H2, JPEG)
    expect(store.read('u1', 's1', H1)).toBeNull()
    expect(store.read('u1', 's1', H2)).toEqual(JPEG)
  })

  it('never lets one account read another', () => {
    store.put('u1', 's1', H1, JPEG)
    expect(store.read('u2', 's1', H1)).toBeNull()
    expect(store.known('u2', [{ id: 's1', hash: H1 }])).toEqual([])
  })

  it('refuses anything that is not a small JPEG', () => {
    expect(() => store.put('u1', 's1', H1, Buffer.from('<svg onload=x>'))).toThrow(/JPEG/)
    expect(() => store.put('u1', 's1', H1, Buffer.alloc(MAX_THUMB_BYTES + 1, 0xff))).toThrow(/size/)
  })

  it('refuses an id that would leave its directory', () => {
    expect(() => store.put('u1', '../../x', H1, JPEG)).toThrow(/screen/)
    expect(() => store.put('../x', 's1', H1, JPEG)).toThrow(/account/)
    expect(store.read('u1', '../../x', H1)).toBeNull()
  })

  it('counts against the disk budget, and gives it back', () => {
    let used = 0
    const budget = { wouldExceed: () => false, add: (n) => (used += n), remove: (n) => (used -= n) }
    const counted = createThumbStore(dir, { budget })
    counted.put('u1', 's1', H1, JPEG)
    counted.put('u1', 's1', H2, JPEG)
    expect(used).toBe(JPEG.length)
    counted.removeAllFor('u1')
    expect(used).toBe(0)
  })

  it('drops the oldest past its ceiling', () => {
    let clock = 0
    const timed = createThumbStore(dir, { now: () => ++clock })
    const index = {}
    for (let i = 0; i < MAX_THUMBS_PER_USER; i++) index[`s${i}`] = { hash: H1, size: 1, at: i }
    fs.mkdirSync(path.join(dir, 'thumbs', 'u1'), { recursive: true })
    fs.writeFileSync(path.join(dir, 'thumbs', 'u1', 'index.json'), JSON.stringify(index))
    timed.put('u1', 'last', H1, JPEG)
    expect(timed.known('u1', [{ id: 's0', hash: H1 }, { id: 'last', hash: H1 }])).toEqual(['last'])
  })
})
