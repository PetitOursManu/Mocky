import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  createTemplateStore,
  MAX_TEMPLATE_CODE_BYTES,
  MAX_TEMPLATE_SCREENS,
  MAX_TEMPLATES_PER_USER,
  TEMPLATE_SCREEN_KEYS,
} from './templates.js'
import { TEMPLATE_SCREEN_KEYS as BROWSER_KEYS } from '../src/lib/templates.ts'

const screen = (id = 's1', extra = {}) => ({ id, name: `Screen ${id}`, prompt: 'p', code: 'export default function App(){return null}', componentName: 'App', x: 0, y: 0, w: 1024, h: 720, device: 'none', links: [], ...extra })
const input = (extra = {}) => ({ name: 'Landing kit', design: '# Design', settings: { useBrand: true, ultra: { count: 6 } }, screens: [screen()], ...extra })

describe('the template store', () => {
  let dir
  let store

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mocky-templates-'))
    store = createTemplateStore(dir)
  })
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

  it('keeps a template for its account alone, and lists it without the code', () => {
    const t = store.add('u1', input())
    const [summary] = store.list('u1')
    expect(summary).toMatchObject({ id: t.id, name: 'Landing kit', screenCount: 1, design: '# Design' })
    expect(summary.screens).toBeUndefined()
    expect(store.list('u2')).toEqual([])
    expect(store.get('u2', t.id)).toBeNull()
    expect(store.get('u1', t.id).screens[0].code).toContain('function App')
  })

  it('keeps only the screen fields a template carries', () => {
    const t = store.add('u1', input({ screens: [screen('s1', { userNotes: [{ text: 'private' }], quality: { score: 3 }, previousCode: 'old', campaign: {}, publication: {} })] }))
    const kept = store.get('u1', t.id).screens[0]
    expect(kept).not.toHaveProperty('userNotes')
    expect(kept).not.toHaveProperty('quality')
    expect(kept).not.toHaveProperty('previousCode')
    expect(kept).not.toHaveProperty('campaign')
    expect(kept).not.toHaveProperty('publication')
  })

  it('keeps only the settings that make sense to carry', () => {
    const t = store.add('u1', input({ settings: { useBrand: true, creative: 'yes', branch: 'x', ultra: { count: 9, video: true } } }))
    expect(store.get('u1', t.id).settings).toEqual({ useBrand: true, ultra: { count: 3, video: true } })
  })

  it('drops a reference screen the template does not hold', () => {
    const a = store.add('u1', input({ referenceScreenId: 's1' }))
    const b = store.add('u1', input({ referenceScreenId: 'gone' }))
    expect(store.get('u1', a.id).referenceScreenId).toBe('s1')
    expect(store.get('u1', b.id).referenceScreenId).toBeUndefined()
  })

  it('refuses a nameless template, too many screens, an oversized screen', () => {
    expect(() => store.add('u1', input({ name: '  ' }))).toThrow(/name/)
    expect(() => store.add('u1', input({ screens: Array.from({ length: MAX_TEMPLATE_SCREENS + 1 }, (_, i) => screen(`s${i}`)) }))).toThrow(/too many/)
    expect(() => store.add('u1', input({ screens: [screen('s1', { code: 'x'.repeat(MAX_TEMPLATE_CODE_BYTES + 1) })] }))).toThrow(/too large/)
  })

  it('stops at its ceiling rather than dropping the oldest', () => {
    for (let i = 0; i < MAX_TEMPLATES_PER_USER; i++) store.add('u1', input({ name: `T${i}` }))
    expect(() => store.add('u1', input())).toThrow(/Delete one first/)
    expect(store.list('u1')).toHaveLength(MAX_TEMPLATES_PER_USER)
  })

  it('refuses an account id or a template id that would leave its directory', () => {
    expect(() => store.add('../x', input())).toThrow(/account/)
    expect(store.get('u1', '../../etc')).toBeNull()
    expect(store.remove('u1', '../x')).toBe(false)
  })

  it('renames and deletes only inside the account that asks', () => {
    const { id } = store.add('u1', input())
    expect(store.rename('u2', id, 'Other')).toBeNull()
    expect(store.rename('u1', id, '  Brand   kit ').name).toBe('Brand kit')
    expect(store.remove('u2', id)).toBe(false)
    expect(store.remove('u1', id)).toBe(true)
    expect(store.list('u1')).toEqual([])
  })

  it('counts what it writes against the disk budget, and refuses before writing', () => {
    let used = 0
    const budget = { wouldExceed: (n) => used + n > 2000, add: (n) => (used += n), remove: (n) => (used -= n) }
    const s = createTemplateStore(dir, { budget })
    const { id } = s.add('u1', input())
    expect(used).toBeGreaterThan(0)
    expect(() => s.add('u1', input({ screens: [screen('s1', { code: 'x'.repeat(3000) })] }))).toThrow(/storage limit/)
    expect(s.list('u1')).toHaveLength(1)
    s.remove('u1', id)
    expect(used).toBe(0)
  })

  it('keeps the same screen fields as the browser sends (src/lib/templates.ts)', () => {
    expect(TEMPLATE_SCREEN_KEYS).toEqual([...BROWSER_KEYS])
  })

  it('forgets an account', () => {
    const t = store.add('u1', input())
    store.putThumbs('u1', t.id, { s1: JPEG })
    store.removeAllFor('u1')
    expect(store.list('u1')).toEqual([])
    expect(fs.existsSync(path.join(dir, 'templates', 'u1'))).toBe(false)
  })

  it('keeps templates together under a section name, renamed or dissolved at once', () => {
    const a = store.add('u1', input({ name: 'Post', section: '  Posts   Elisa30 ' }))
    const b = store.add('u1', input({ name: 'Story' }))
    expect(store.list('u1').find((x) => x.id === a.id).section).toBe('Posts Elisa30')
    expect(store.update('u1', b.id, { section: 'Posts Elisa30' }).section).toBe('Posts Elisa30')
    expect(store.renameSection('u1', 'Posts Elisa30', 'Réseaux')).toBe(2)
    expect(store.list('u1').map((x) => x.section)).toEqual(['Réseaux', 'Réseaux'])
    expect(store.update('u1', a.id, { section: '' })).not.toHaveProperty('section')
    expect(store.renameSection('u1', 'Réseaux', '')).toBe(1)
    expect(store.list('u1').every((x) => !x.section)).toBe(true)
    expect(() => store.update('u1', a.id, { section: 3 })).toThrow()
    expect(store.update('u2', a.id, { section: 'x' })).toBeNull()
  })

  it('keeps JPEG pictures of its own screens beside it, reference first, and drops them with it', () => {
    const t = store.add('u1', input({ screens: [screen('s1'), screen('s2'), screen('s3')], referenceScreenId: 's2' }))
    expect(store.list('u1')[0].thumbs).toEqual([])
    expect(() => store.putThumbs('u1', t.id, { s1: Buffer.from('not a jpeg').toString('base64') })).toThrow(/JPEG/)
    const out = store.putThumbs('u1', t.id, { s1: JPEG, s2: JPEG, nope: JPEG })
    expect(out.thumbs).toEqual(['s2', 's1'])
    expect(store.readThumb('u1', t.id, 's2')[0]).toBe(0xff)
    expect(store.readThumb('u2', t.id, 's2')).toBeNull()
    expect(store.readThumb('u1', t.id, '../s2')).toBeNull()
    // A second call replaces the set.
    expect(store.putThumbs('u1', t.id, { s3: JPEG }).thumbs).toEqual(['s3'])
    // The list still reads names only, not pictures.
    expect(store.list('u1')[0]).toMatchObject({ name: 'Landing kit', thumbs: ['s3'] })
    expect(store.remove('u1', t.id)).toBe(true)
    expect(fs.readdirSync(path.join(dir, 'templates', 'u1'))).toEqual([])
  })

  it('rewrites a template’s content from the project that edits it, keeping its name and section', () => {
    const t = store.add('u1', input({ section: 'Posts', screens: [screen('s1'), screen('s2')] }))
    store.putThumbs('u1', t.id, { s1: JPEG, s2: JPEG })
    const out = store.replace('u1', t.id, {
      name: 'ignored',
      section: 'ignored',
      design: '# New',
      settings: { creative: true, useBrand: 'yes' },
      referenceScreenId: 'n1',
      screens: [screen('s1', { code: 'export default () => "new"', userNotes: [{ text: 'private' }] }), screen('n1')],
    })
    expect(out).toMatchObject({ id: t.id, name: 'Landing kit', section: 'Posts', design: '# New', screenCount: 2, settings: { creative: true } })
    const kept = store.get('u1', t.id)
    expect(kept.createdAt).toBe(store.get('u1', t.id).createdAt)
    expect(kept.referenceScreenId).toBe('n1')
    expect(kept.screens.map((s) => s.id)).toEqual(['s1', 'n1'])
    expect(kept.screens[0]).not.toHaveProperty('userNotes')
    // The picture of a screen that is gone goes too; the one still there stays.
    expect(out.thumbs).toEqual(['s1'])
    expect(store.readThumb('u1', t.id, 's2')).toBeNull()
    // Someone else's, a missing one, garbage.
    expect(store.replace('u2', t.id, input())).toBeNull()
    expect(store.replace('u1', 't' + '0'.repeat(24), input())).toBeNull()
    expect(() => store.replace('u1', t.id, { screens: 'nope' })).toThrow(/screens/)
    expect(() => store.replace('u1', t.id, { screens: [screen('s1', { code: 'x'.repeat(MAX_TEMPLATE_CODE_BYTES + 1) })] })).toThrow(/too large/)
  })
})

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46]).toString('base64')
