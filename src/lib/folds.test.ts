import { describe, expect, it } from 'vitest'
import { DocumentSource } from './capabilities/snippets/Document'
import {
  FOLDS,
  FOLD_IDS,
  foldFits,
  foldHint,
  foldSheet,
  foldsFor,
  getFold,
  normalizeFold,
  panelWidths,
  portraitOf,
} from './folds'
import { documentHint, foldedSheet, hintForScreen } from './documentMode'
import { getPageFormat } from './pageFormats'

/** The kit's own copy of the panel arithmetic, run as the frame runs it. */
function kitWidths(fold: string, face: number, w: number): number[] | null {
  return new Function('React', 'window', 'document', `${DocumentSource}\nreturn mockyFoldWidths(${JSON.stringify(fold)}, ${face}, ${w})`)(
    { createContext: () => ({}) },
    {},
    {},
  ) as number[] | null
}

describe('the folds', () => {
  it('cut every face into panels whose shares add up to the sheet', () => {
    for (const f of FOLDS) {
      for (const face of f.faces) {
        expect(face.reduce((n, p) => n + p.share, 0), f.id).toBeCloseTo(1, 9)
      }
      expect(f.faces[0].length, f.id).toBe(f.faces[1].length)
    }
  })

  it('tile the sheet exactly in whole pixels, the way the kit does', () => {
    for (const f of FOLDS) {
      for (const size of f.sheets) {
        const sheet = getPageFormat(foldSheet(f.id, size)!)
        const [outside, inside] = panelWidths(f.id, sheet)
        expect(outside.reduce((a, b) => a + b, 0)).toBe(sheet.w)
        expect(inside.reduce((a, b) => a + b, 0)).toBe(sheet.w)
        // The frame's arithmetic and the prompt's must be the same numbers,
        // or the model is told a width the panel does not have.
        expect(kitWidths(f.id, 0, sheet.w)).toEqual(outside)
        expect(kitWidths(f.id, 1, sheet.w)).toEqual(inside)
      }
    }
    expect(kitWidths('origami', 0, 1123)).toBeNull()
  })

  it('print a roll fold the way it folds: the narrow flap left outside and right inside, the cover on the right', () => {
    const roll = getFold('roll')
    expect(roll.faces[0][0].share).toBeLessThan(roll.faces[0][1].share)
    expect(roll.faces[0][2].role).toMatch(/^FRONT COVER/)
    expect(roll.faces[1][2].share).toBe(roll.faces[0][0].share)
    // 97 + 100 + 100 mm on an A4: a DL panel each.
    const [outside] = panelWidths('roll', getPageFormat('a4-landscape'))
    expect(outside).toEqual([367, 378, 378])
  })

  it('split a gate fold\'s cover across both ends of the outside face, right half printed on the left', () => {
    const gate = getFold('gate')
    expect(gate.faces[0][0].role).toMatch(/RIGHT HALF/)
    expect(gate.faces[0][2].role).toMatch(/LEFT HALF/)
    expect(gate.faces[1][1].share).toBe(0.5)
  })

  it('fold across the long side: the size chosen becomes its landscape sheet', () => {
    expect(foldSheet('roll', 'a4')).toBe('a4-landscape')
    expect(foldSheet('half', 'a5')).toBe('a5-landscape')
    expect(foldSheet('half', 'a4-landscape')).toBe('a4-landscape')
    expect(foldSheet('accordion4', 'a5')).toBeNull()
    expect(foldSheet('roll', 'a6')).toBeNull()
    expect(portraitOf('a3-landscape')).toBe('a3')
    expect(foldFits('roll', 'a4-landscape')).toBe(true)
    expect(foldFits('roll', 'a4')).toBe(false)
  })

  it('offer on a size only the folds it can take', () => {
    expect(foldsFor('a6')).toEqual([])
    expect(foldsFor('a5')).toEqual(['half'])
    expect(foldsFor('a4')).toEqual([...FOLD_IDS])
    expect(foldsFor('dl')).toEqual([])
  })

  it('read a stored fold back, or nothing', () => {
    expect(normalizeFold('z')).toBe('z')
    expect(normalizeFold('origami')).toBeUndefined()
    expect(normalizeFold(3)).toBeUndefined()
  })
})

describe('the folded leaflet in the prompt', () => {
  it('names both faces, every panel in print order with its width, and the Doc to write', () => {
    const hint = foldHint('roll', 'a4-landscape')
    expect(hint).toContain('<Doc format="a4-landscape" fold="roll">')
    expect(hint).toContain('EXACTLY 2 <Page>s')
    expect(hint).toMatch(/<Panel> 1 \(367px wide\) — INSIDE FLAP/)
    expect(hint).toMatch(/<Panel> 3 \(378px wide\) — FRONT COVER/)
    expect(hint).toMatch(/<Page> 2 — the INSIDE face/)
  })

  it('rides on the page hint only when the fold fits the sheet, and on every later pass of the screen', () => {
    const sheet = getPageFormat('a4-landscape')
    expect(documentHint(sheet, 'roll')).toContain('FOLDED LEAFLET')
    expect(documentHint(sheet)).not.toContain('FOLDED LEAFLET')
    // A fold that does not fit is not drawn as a guess.
    expect(documentHint(getPageFormat('a4'), 'roll')).not.toContain('FOLDED LEAFLET')
    expect(hintForScreen({ page: 'a4-landscape', fold: 'roll', device: 'none' })).toContain('FOLDED LEAFLET')
    expect(hintForScreen({ page: 'a4-landscape', device: 'none' })).not.toContain('FOLDED LEAFLET')
  })

  it('turns the composer\'s size and fold into the sheet to print, or a flat flyer', () => {
    expect(foldedSheet('a4', 'roll')).toEqual({ page: 'a4-landscape', fold: 'roll' })
    expect(foldedSheet('a6', 'roll')).toEqual({ page: 'a6' })
    expect(foldedSheet('a4', null)).toEqual({ page: 'a4' })
  })
})
