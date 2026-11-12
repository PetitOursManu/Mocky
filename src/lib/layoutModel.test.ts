import { describe, expect, it } from 'vitest'
import { pickLayoutModel } from './documentMode'
import { buildDocumentLayoutReference } from './generate'

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
