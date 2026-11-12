import { describe, expect, it } from 'vitest'
import { pickInspirations, pickLayoutModel } from './documentMode'
import { buildDocumentInspirationReference, buildDocumentLayoutReference } from './generate'

/*
 * A post started from a template copies the template's composition
 * (`followLayout`). Before, a document only ever inherited the IDENTITY of an
 * earlier screen — the name and the mark, "everything else is yours to decide"
 * — and a post made from a model came back in the model's colours and nothing
 * else of it.
 */
const s = (id: string, createdAt: number, extra: Record<string, unknown> = {}) => ({ id, createdAt, code: `export default function App(){ return <Doc>${id}</Doc> }`, ...extra })

describe('pickLayoutModel', () => {
  const web = s('web', 1)
  const linkedin = s('li', 2, { page: 'social-landscape', theme: 'linkedin' })
  const insta = s('ig', 3, { page: 'social-portrait', theme: 'instagram' })
  const insta2 = s('ig2', 4, { page: 'social-portrait', theme: 'instagram' })

  it('takes a document of the same format first, the oldest of them', () => {
    expect(pickLayoutModel([web, linkedin, insta2, insta], { page: 'social-portrait', theme: 'instagram' })).toEqual({ screen: insta, sameFormat: true })
  })

  it('falls back on the same screen type, then on any document, saying the format differs', () => {
    expect(pickLayoutModel([web, linkedin, insta], { page: 'social-square', theme: 'linkedin' })).toEqual({ screen: linkedin, sameFormat: false })
    expect(pickLayoutModel([web, insta, linkedin], { page: 'a4', theme: 'flyer' })).toEqual({ screen: linkedin, sameFormat: false })
  })

  it('never takes a web screen, an empty one or the one being made', () => {
    expect(pickLayoutModel([web], { page: 'social-portrait', theme: 'instagram' })).toBeUndefined()
    expect(pickLayoutModel([{ ...insta, code: '  ' }], { page: 'social-portrait', theme: 'instagram' })).toBeUndefined()
    expect(pickLayoutModel([insta], { page: 'social-portrait', theme: 'instagram', excludeId: 'ig' })).toBeUndefined()
  })
})

describe('buildDocumentLayoutReference', () => {
  it('asks for the composition, not only the identity, with the whole source', () => {
    const code = `export default function App(){ /* ${'x'.repeat(10000)} */ return <Doc/> }`
    const ref = buildDocumentLayoutReference(code, true)
    expect(ref).toMatch(/LAYOUT MODEL/)
    expect(ref).toMatch(/same blocks in the same places/)
    expect(ref).toMatch(/Replace only the CONTENT/)
    expect(ref).toContain(code) // 10 000 characters: the identity reference would have cut it at 4 000
    expect(buildDocumentLayoutReference(code, false)).toMatch(/adapt the proportions/)
  })
})

describe('style examples (inspiration_ids)', () => {
  const doc = (code: string, page: string, theme?: string) => ({ code, page, ...(theme ? { theme } : {}) })

  it('takes one screen per template, the closest, and never a web page', () => {
    const picked = pickInspirations(
      [
        { name: 'Portraits', screens: [doc('LANDSCAPE', 'social-landscape', 'linkedin'), doc('SQUARE', 'social-square', 'instagram')] },
        { name: 'Site', screens: [{ code: 'WEB' }] },
        { name: 'Ateliers', screens: [doc('PORTRAIT', 'social-portrait', 'instagram')] },
      ],
      { page: 'social-square', theme: 'instagram' },
    )
    expect(picked).toEqual([
      { name: 'Portraits', code: 'SQUARE', sameFormat: true },
      { name: 'Ateliers', code: 'PORTRAIT', sameFormat: false },
    ])
  })

  it('keeps four at most', () => {
    const many = Array.from({ length: 6 }, (_, i) => ({ name: `T${i}`, screens: [doc(`C${i}`, 'social-square')] }))
    expect(pickInspirations(many, { page: 'social-square', theme: null })).toHaveLength(4)
  })

  it('asks for the same family, never a copy, and says which example has another format', () => {
    const ref = buildDocumentInspirationReference([
      { name: 'Portraits', code: 'A', sameFormat: true },
      { name: 'Ateliers', code: 'B', sameFormat: false },
    ])
    expect(ref).toMatch(/STYLE EXAMPLES/)
    expect(ref).toMatch(/same family/)
    expect(ref).toMatch(/Do NOT copy one of them/)
    expect(ref).toContain('Example 1 — Portraits:\nA')
    expect(ref).toContain('Example 2 — Ateliers (drawn for another format):\nB')
  })
})
