import { describe, expect, it } from 'vitest'
import { FIT_NOISE_PX, fitFindings, fitVerdict, pageExcessPx, totalExcessPx, type FitReport, type PageOverflow } from './fit'
import { getPageFormat } from '../pageFormats'

const over = (page: number, bottom: number, extra: Partial<PageOverflow> = {}): PageOverflow => ({
  page,
  excess: { top: 0, right: 0, bottom, left: 0 },
  outside: [],
  ...extra,
})
const report = (pages: number, ...o: PageOverflow[]): FitReport => ({ pages, over: o })

describe('fitVerdict', () => {
  const before = report(2, over(1, 106))

  it('keeps a rewrite that fits', () => {
    expect(fitVerdict(before, report(2))).toBe('fits')
  })

  it('keeps a rewrite that comes closer, and says it is not there yet', () => {
    expect(fitVerdict(before, report(2, over(1, 30)))).toBe('closer')
  })

  it('rejects a rewrite that gained nothing, within the noise, or lost ground', () => {
    expect(fitVerdict(before, report(2, over(1, 106)))).toBe('rejected')
    expect(fitVerdict(before, report(2, over(1, 106 - FIT_NOISE_PX)))).toBe('rejected')
    expect(fitVerdict(before, report(2, over(1, 140)))).toBe('rejected')
  })

  it('rejects a rewrite that cuts a page that was whole, however much it saved elsewhere', () => {
    expect(fitVerdict(before, report(2, over(2, 10)))).toBe('rejected')
  })

  it('rejects a rewrite that changed the page count, even one where everything fits', () => {
    // "Fit to the page" is not "add a page": that is the person's to ask for.
    expect(fitVerdict(before, report(3))).toBe('rejected')
    expect(fitVerdict(before, report(1))).toBe('rejected')
  })
})

describe('the excess', () => {
  it('is a page’s worst edge, summed over the pages', () => {
    const wide = over(2, 0, { excess: { top: 3, right: 40, bottom: 12, left: 0 } })
    expect(pageExcessPx(wide)).toBe(40)
    expect(totalExcessPx(report(2, over(1, 106), wide))).toBe(146)
    expect(totalExcessPx(report(2))).toBe(0)
  })
})

describe('fitFindings', () => {
  it('gives the model the page size, the pixels per edge and the words, in the page’s own units', () => {
    const text = fitFindings(
      report(
        1,
        over(1, 106, {
          excess: { top: 0, right: 12, bottom: 106, left: 0 },
          outside: [{ text: 'Vibrations' }, { text: 'Un samedi de juin Entrée : 12 €' }, { text: 'email', field: true }],
        }),
      ),
      getPageFormat('a4'),
    )
    expect(text).toContain('794 × 1123 px')
    expect(text).toContain('Page 1: content runs 106 px past the BOTTOM edge, and 12 px past the RIGHT edge.')
    expect(text).toContain('Text outside the page: "Vibrations", "Un samedi de juin Entrée : 12 €".')
    expect(text).toContain('Fillable fields outside the page: "email".')
  })

  it('names no edge that was not crossed', () => {
    const text = fitFindings(report(1, over(1, 20)), getPageFormat('letter'))
    expect(text).toContain('816 × 1056 px')
    expect(text).not.toMatch(/TOP|LEFT|RIGHT/)
    expect(text).not.toContain('outside the page')
  })
})
