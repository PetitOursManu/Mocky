import { describe, expect, it } from 'vitest'
import { VISUAL_FAMILY_USES, VISUAL_FORMATS } from './visual-families.js'
import { FAMILY_USE, VISUAL_FAMILIES, VISUAL_THEME } from '../../src/lib/visuals/families'
import { themeDocumentFormats } from '../../src/lib/screenThemes'

describe('the server’s copy of the visual families', () => {
  it('names every family, in the same order, with the same sentence', () => {
    expect(Object.keys(VISUAL_FAMILY_USES)).toEqual([...VISUAL_FAMILIES])
    expect(VISUAL_FAMILY_USES).toEqual(FAMILY_USE)
  })

  it('offers exactly the Visual type’s formats', () => {
    expect(VISUAL_FORMATS).toEqual([...(themeDocumentFormats(VISUAL_THEME) ?? [])])
  })
})
