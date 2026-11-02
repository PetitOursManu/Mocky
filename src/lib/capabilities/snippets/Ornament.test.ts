import { describe, expect, it } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { OrnamentSource, ORNAMENT_PATTERNS } from './Ornament'
import { ORNAMENTS, ORNAMENT_IDS, ORNAMENT_KINDS, ORNAMENT_PATTERN_IDS, isOrnament } from '../../ornaments'
import { FRAME_SHAPES } from '../../frameShapes'
import { CAPABILITY_MAP } from '../registry'
import { capabilitiesUsedBy } from '../select'
import { documentPipeline, ORNAMENTS_CAP } from '../../documentMode'

/**
 * `<Ornament>` rendered by the real React, from the very string the preview
 * prepends. What a browser adds — the path actually drawn at its size — was
 * checked on a contact sheet of the whole catalogue.
 */

const Ornament = new Function('React', `${OrnamentSource}\nreturn Ornament`)(React) as React.FC<Record<string, unknown>>
const html = (props: Record<string, unknown>) => renderToStaticMarkup(React.createElement(Ornament, props))

describe('the ornament catalogue', () => {
  it('names every shape once, in five kinds, with the frames’ solid shapes among them', () => {
    expect(new Set(ORNAMENT_IDS).size).toBe(ORNAMENT_IDS.length)
    for (const id of ORNAMENT_IDS) expect(id).toMatch(/^[a-z][a-z0-9-]*$/)
    for (const k of ORNAMENT_KINDS) expect(ORNAMENTS.filter((o) => o.kind === k).length, k).toBeGreaterThanOrEqual(9)
    for (const f of FRAME_SHAPES.filter((s) => s.family !== 'photo')) expect(isOrnament(f.id), f.id).toBe(true)
    // A photo frame's hole is a plain rectangle: as a decoration it is a box.
    expect(isOrnament('polaroid')).toBe(false)
  })

  it('draws exactly the textures the catalogue names', () => {
    expect([...ORNAMENT_PATTERNS].sort()).toEqual([...ORNAMENT_PATTERN_IDS].sort())
  })

  it('keeps its strokes and its layers inside their box, rounded to two decimals', () => {
    // A fluid's ribbon and a loader's dots too: the proposals they were drawn
    // from ran a curve to -11 and to 109, cut by the box they were drawn in.
    for (const o of ORNAMENTS.filter((x) => x.kind === 'line' || x.kind === 'fluid' || x.kind === 'motion')) {
      expect(o.ratio, o.id).toBeGreaterThan(0.3)
      for (const d of [o.d, ...(o.layers ?? []).map((l) => l.d)]) {
        expect(d, o.id).not.toMatch(/NaN|Infinity|\.\d{3}/)
        // End points and controls alike: a quadratic's control may sit outside
        // its curve, but these were written so that none needs to. An arc is
        // read by its end point; its radii are not coordinates.
        const nums = (d.replace(/A[^A-Za-z]*/g, (arc) => ` ${arc.trim().split(/[\s,]+/).slice(-2).join(' ')} `).match(/-?\d*\.?\d+/g) ?? []).map(Number)
        for (const n of nums) {
          expect(n, o.id).toBeGreaterThanOrEqual(0)
          expect(n, o.id).toBeLessThanOrEqual(100)
        }
      }
    }
  })

  it('gives every fluid shape its second colour, and every moving sign something that moves', () => {
    for (const o of ORNAMENTS.filter((x) => x.kind === 'fluid')) expect(o.layers?.some((l) => l.paint === 'accent' || l.paint === 'light'), o.id).toBe(true)
    for (const o of ORNAMENTS.filter((x) => x.kind === 'motion')) {
      expect(o.motion, o.id).toBeTruthy()
      expect(o.layers?.some((l) => l.moves), o.id).toBe(true)
    }
    for (const o of ORNAMENTS.filter((x) => x.kind !== 'motion')) expect(o.layers?.some((l) => l.moves) ?? false, o.id).toBe(false)
  })
})

describe('Ornament', () => {
  it('draws a solid shape with the catalogue’s path, hidden from screen readers', () => {
    const out = html({ shape: 'burst', color: '#e11d48', className: 'w-40' })
    expect(out).toContain('data-mocky-ornament="burst"')
    expect(out).toContain('aria-hidden="true"')
    expect(out).toContain('fill="#e11d48"')
    expect(out).toContain(`d="${ORNAMENTS.find((o) => o.id === 'burst')!.d}"`)
    expect(out).toContain('preserveAspectRatio="none"')
  })

  it('fills a shape of overlapping pieces nonzero, so a crossing is not a hole', () => {
    expect(html({ shape: 'asterisk-bold' })).toContain('fill-rule="nonzero"')
    expect(html({ shape: 'target' })).toContain('fill-rule="evenodd"')
    for (const o of ORNAMENTS.filter((x) => x.nonzero)) expect(['fill', 'fluid'], o.id).toContain(o.kind)
  })

  it('takes the text colour when it is given none, and refuses a colour that is not one', () => {
    expect(html({ shape: 'ring' })).toContain('fill="currentColor"')
    expect(html({ shape: 'ring', color: 'url(#x)' })).toContain('fill="currentColor"')
  })

  it('strokes a line without scaling the stroke, and slices a texture instead of stretching it', () => {
    const line = html({ shape: 'squiggle', color: '#111', weight: 5 })
    expect(line).toContain('fill="none"')
    expect(line).toContain('stroke-width="5"')
    expect(line).toContain('vector-effect="non-scaling-stroke"')
    const dots = html({ shape: 'dots', density: 4, className: 'absolute inset-0' })
    expect(dots).toContain('preserveAspectRatio="xMidYMid slice"')
    expect(dots.match(/<circle/g)?.length).toBe(16)
    expect(dots).not.toContain('aspect-ratio')
  })

  it('keeps the proportions it was drawn for, unless the page sized the box', () => {
    expect(html({ shape: 'squiggle', className: 'w-40' })).toContain('aspect-ratio:4')
    expect(html({ shape: 'squiggle', className: 'w-40 h-4' })).not.toContain('aspect-ratio')
  })

  it('draws every name in the catalogue, and nothing for a name it does not know', () => {
    for (const id of ORNAMENT_IDS) expect(html({ shape: id }), id).toContain(`data-mocky-ornament="${id}"`)
    expect(html({ shape: 'unicorn' })).toBe('')
    expect(html({})).toBe('')
  })

  it('scatters its confetti the same way on every render', () => {
    expect(html({ shape: 'confetti', accent: '#0ea5e9' })).toBe(html({ shape: 'confetti', accent: '#0ea5e9' }))
  })

  it('draws a traced stroke finished when nothing may move', () => {
    // No window here: the server render is a still, like a capture frame.
    const g = globalThis as Record<string, unknown>
    g.window = { __mockyStill: true }
    try {
      const out = html({ shape: 'underline', draw: true })
      expect(out).toContain('stroke-dashoffset:0')
    } finally {
      delete g.window
    }
  })

  it('paints a fluid shape’s ribbon in the accent, or in its own colour at half strength', () => {
    expect(html({ shape: 'liquid-ribbon', color: '#7c3aed', accent: '#fb7185' })).toMatch(/stroke="#fb7185" stroke-width="7"/)
    const alone = html({ shape: 'liquid-ribbon', color: '#7c3aed' })
    expect(alone).toMatch(/opacity="0.5"[^>]*stroke="#7c3aed"|stroke="#7c3aed"[^>]*opacity="0.5"/)
  })

  it('draws a solid or a fluid shape as its contour when asked, and nothing else changes', () => {
    const out = html({ shape: 'blob-3', outline: true, color: '#0f766e', weight: 2 })
    expect(out).toContain('fill="none"')
    expect(out).toContain('stroke="#0f766e"')
    expect(out).toContain('stroke-width="2"')
    expect(out).toContain('vector-effect="non-scaling-stroke"')
    expect(out).not.toContain('fill="#0f766e"')
    // A fluid's ribbon follows, and its white highlight is drawn in the colour.
    const fluid = html({ shape: 'liquid-ribbon', outline: true, color: '#7c3aed', accent: '#fb7185' })
    expect(fluid).not.toMatch(/fill="#(7c3aed|fb7185|ffffff)"/)
    expect(fluid).toContain('stroke="#fb7185"')
    // A texture and a moving sign have no contour to draw: the switch is ignored.
    expect(html({ shape: 'dots', outline: true })).toBe(html({ shape: 'dots' }))
    expect(html({ shape: 'orbit-loader', outline: true })).toBe(html({ shape: 'orbit-loader' }))
  })

  it('moves a moving sign only where something may move', () => {
    const g = globalThis as Record<string, unknown>
    g.window = {}
    g.document = { hidden: false, getElementById: () => null }
    try {
      expect(html({ shape: 'orbit-loader' })).toContain('mocky-orn-spin')
      expect(html({ shape: 'bar-loader' })).toContain('mocky-orn-pulse')
      g.window = { __mockyStill: true }
      expect(html({ shape: 'orbit-loader' })).not.toContain('animation')
    } finally {
      delete g.window
      delete g.document
    }
  })
})

describe('the ornaments capability', () => {
  it('tells the model every name', () => {
    const card = CAPABILITY_MAP.ornaments.components![0].description
    for (const id of ORNAMENT_IDS) expect(card, id).toContain(`"${id}"`)
  })

  it('is loaded by a screen that uses it', () => {
    expect(capabilitiesUsedBy('<Ornament shape="blob-1" />')).toContain('ornaments')
  })

  it('is offered to every document, paper and social alike', () => {
    expect(documentPipeline('a4').caps(['icons'])).toContain(ORNAMENTS_CAP)
    expect(documentPipeline('card').caps(['icons'])).toContain(ORNAMENTS_CAP)
    expect(documentPipeline('social-square').caps(['icons'])).toContain(ORNAMENTS_CAP)
    expect(documentPipeline(undefined).caps(['icons'])).toEqual(['icons'])
  })
})
