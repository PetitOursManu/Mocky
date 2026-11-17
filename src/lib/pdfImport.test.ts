import { describe, expect, it } from 'vitest'
import { cleanText, fitWithin, joinPages, keepPicture, pageText, PDF_PICTURE_MAX_SIDE } from './pdfImport'

const at = (str: string, y: number, hasEOL = false) => ({ str, hasEOL, transform: [12, 0, 0, 12, 72, y] })

describe('pageText', () => {
  it('rebuilds lines from the end-of-line flag and from a drop in height', () => {
    const items = [
      at('Menu de la semaine', 800, true),
      at('', 780, true),
      at('Lundi', 760),
      at(' : ', 760),
      at('Blanquette de veau', 760),
      // No flag, but lower: a new line all the same (a second column, a table cell).
      at('Mardi : Brandade', 740),
      at('Prix 12,50 €', 720, true),
    ]
    expect(pageText(items)).toBe('Menu de la semaine\n\nLundi : Blanquette de veau\nMardi : Brandade\nPrix 12,50 €')
  })

  it('puts a space between two words a producer glued, and none inside a word split in runs', () => {
    expect(pageText([at('Portes', 500), at('ouvertes', 500)])).toBe('Portes ouvertes')
    expect(pageText([at('Nîmes', 500), at(',', 500), at(' le 23', 500)])).toBe('Nîmes, le 23')
    expect(pageText([at('Elisa', 500), at('3', 500)])).toBe('Elisa3')
  })

  it('closes every line on its flag without leaving a blank line, and opens a paragraph on a wide gap', () => {
    // How pdf.js really ends a line: the run, then an empty flagged run.
    const items = [at('Lundi : Blanquette', 700), at('', 700, true), at('Mardi : Brandade', 682), at('', 682, true), at('Formule : 12,50 EUR', 600, true)]
    expect(pageText(items)).toBe('Lundi : Blanquette\nMardi : Brandade\n\nFormule : 12,50 EUR')
  })

  it('ignores what is not a text item', () => {
    expect(pageText([{ str: 'A', hasEOL: true }, { foo: 1 } as never, { str: 'B' }])).toBe('A\nB')
  })
})

describe('cleanText and joinPages', () => {
  it('folds spaces, trims lines, keeps at most one blank line', () => {
    expect(cleanText('  a  b \r\n\r\n\r\n\n c  ')).toBe('a b\n\nc')
    expect(joinPages(['Page un', '   ', 'Page deux'])).toBe('Page un\n\nPage deux')
  })
})

describe('pictures', () => {
  it('keeps photographs, drops icons, and never enlarges', () => {
    expect(keepPicture(800, 600)).toBe(true)
    expect(keepPicture(1200, 90)).toBe(false)
    expect(fitWithin(400, 300)).toEqual({ w: 400, h: 300 })
    expect(fitWithin(4000, 3000)).toEqual({ w: PDF_PICTURE_MAX_SIDE, h: 1500 })
  })
})
