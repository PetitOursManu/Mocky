import { describe, expect, it } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { InteractSource } from './Interact'
import { CAPABILITY_MAP } from '../registry'
import { capabilitiesUsedBy, selectCapabilities } from '../select'
import { DOCUMENT_EXCLUDED_CAPS } from '../../documentMode'

/**
 * The interaction kit, from the very string the preview prepends. What only a
 * browser can show — a drag, a mask growing — was checked in a preview against
 * a scripted scene; what arithmetic can say is said here.
 */

type Sheet = { src: string; w: number; h: number }
type Box = [number, number, number, number]
const kit = new Function(
  'React',
  `${InteractSource}
return { SheetCrop, sheetCropSvg, MaskSwap, mockyCropCss, mockyCropProblem, mockyTrackWrap };`,
)(React) as {
  SheetCrop: React.FC<Record<string, unknown>>
  sheetCropSvg: (s: Sheet, b: Box, vw: number, vh: number) => Record<string, number | string>
  MaskSwap: React.FC<Record<string, unknown>>
  mockyCropCss: (s: Sheet, b: Box) => Record<string, string>
  mockyCropProblem: (s: unknown, b: unknown) => string | null
  mockyTrackWrap: (i: number, n: number) => number
}

const covers: Sheet = { src: 'https://img.example/covers.webp', w: 1744, h: 2336 }

describe('SheetCrop arithmetic', () => {
  it('turns a box in source pixels into percentages that hold at any served size', () => {
    const css = kit.mockyCropCss(covers, [497, 72, 344, 659])
    const [sw, sh] = css.backgroundSize.split(' ').map(parseFloat)
    const [px, py] = css.backgroundPosition.split(' ').map(parseFloat)
    expect(sw).toBeCloseTo((1744 / 344) * 100, 6)
    expect(sh).toBeCloseTo((2336 / 659) * 100, 6)
    expect(px).toBeCloseTo((497 / (1744 - 344)) * 100, 6)
    expect(py).toBeCloseTo((72 / (2336 - 659)) * 100, 6)
  })

  it('does not divide by zero when the box spans the whole sheet', () => {
    const css = kit.mockyCropCss({ src: 's', w: 400, h: 300 }, [0, 0, 400, 300])
    expect(css.backgroundPosition).toBe('0% 0%')
    expect(css.backgroundSize).toBe('100% 100%')
  })

  it('names what is wrong with a crop instead of drawing a wrong one', () => {
    expect(kit.mockyCropProblem(covers, [497, 72, 344, 659])).toBeNull()
    expect(kit.mockyCropProblem(covers, [1500, 72, 344, 659])).toBe('box outside the sheet')
    expect(kit.mockyCropProblem(covers, [0, 0, 0, 10])).toBe('empty box')
    expect(kit.mockyCropProblem({ src: 'x' }, [0, 0, 1, 1])).toBe('sheet size unknown')
    expect(kit.mockyCropProblem(covers, [0, 0, 1])).toBe('box must be [x, y, w, h]')
  })

  it('places the same crop in an SVG viewBox', () => {
    const a = kit.sheetCropSvg(covers, [74, 72, 347, 659], 474, 900)
    expect(a.x).toBeCloseTo((-74 * 474) / 347, 6)
    expect(a.y).toBeCloseTo((-72 * 900) / 659, 6)
    expect(a.width).toBeCloseTo((1744 * 474) / 347, 6)
    expect(a.height).toBeCloseTo((2336 * 900) / 659, 6)
    expect(a.preserveAspectRatio).toBe('none')
  })
})

describe('SheetCrop', () => {
  const html = (p: Record<string, unknown>) => renderToStaticMarkup(React.createElement(kit.SheetCrop, p))

  it('keeps the box proportions unless the page sized it, and labels it', () => {
    const out = html({ sheet: covers, box: [497, 72, 344, 659], name: 'cover-valley', alt: 'The Silent Valley', className: 'w-40' })
    expect(out).toContain('aspect-ratio:344 / 659')
    expect(out).toContain('data-mocky-crop="cover-valley"')
    expect(out).toContain('role="img"')
    expect(out).toContain('aria-label="The Silent Valley"')
    expect(html({ sheet: covers, box: [497, 72, 344, 659], className: 'h-64 w-40' })).not.toContain('aspect-ratio')
  })

  it('draws a placeholder that names the problem for a box outside the sheet', () => {
    const out = html({ sheet: covers, box: [1600, 0, 344, 659], name: 'bad' })
    expect(out).toContain('data-mocky-crop-error="box outside the sheet"')
    expect(out).not.toContain('background-image')
  })
})

describe('MaskSwap', () => {
  it('renders the current value inside a clipping grid', () => {
    const out = renderToStaticMarkup(React.createElement(kit.MaskSwap, { value: 'Noon in Ashes', className: 'text-3xl' }))
    expect(out).toContain('overflow:hidden')
    expect(out).toContain('Noon in Ashes')
  })

  it('never breaks a word when it staggers by letter', () => {
    const out = renderToStaticMarkup(React.createElement(kit.MaskSwap, { value: 'Salted Caramel', by: 'letter' }))
    expect(out.match(/white-space:nowrap/g)?.length).toBe(2)
  })
})

describe('useGlideTrack', () => {
  it('wraps any position onto an item of the loop', () => {
    expect(kit.mockyTrackWrap(17, 12)).toBe(5)
    expect(kit.mockyTrackWrap(-1, 12)).toBe(11)
    expect(kit.mockyTrackWrap(4.6, 5)).toBe(0)
  })
})

describe('the interact capability', () => {
  it('is inferred from a hook call as well as from a tag', () => {
    expect(capabilitiesUsedBy('const t = useGlideTrack({ count: 12 })')).toContain('interact')
    expect(capabilitiesUsedBy('<SheetCrop sheet={S} box={[0,0,1,1]} />')).toContain('interact')
    expect(capabilitiesUsedBy('MockyMorph.grow(a, b)')).toContain('interact')
  })

  it('is not inferred from a screen that declares its own components with ordinary names', () => {
    // `function Counter(` must not load the retired pack that defines Counter.
    expect(capabilitiesUsedBy('function Counter() { return null }')).not.toContain('motion')
    expect(capabilitiesUsedBy('const Cursor = () => null; <Cursor />')).not.toContain('interact')
  })

  it('is offered on the words of a page the visitor handles, and not on a plain one', () => {
    expect(selectCapabilities('An endless shelf of VHS tapes; drag or scroll to change film, with a custom cursor')).toContain('interact')
    expect(selectCapabilities('A pricing page for a pink SaaS with a link to the docs')).not.toContain('interact')
  })

  it('stays off paper', () => {
    expect(DOCUMENT_EXCLUDED_CAPS).toContain('interact')
    expect(CAPABILITY_MAP.interact.kind).toBe('snippet-pack')
  })
})
