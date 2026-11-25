import { describe, expect, it } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { VisualSource } from './Visual'
import { VISUAL_BOUNDS, VISUAL_FAMILIES, type VisualDoc, type VisualFamily } from '../../visuals/families'

/**
 * `<Visual>` and its layout, run from the very string the preview prepends.
 * The layout is pure arithmetic, so the suite asks it what a browser would
 * take an afternoon to try: every family, at three frame shapes, on the
 * smallest and the largest document it accepts, with long words.
 */

type Node = { kind: string; x: number; y: number; w: number; h: number; g: string; t: Record<string, unknown> }
type Layout = { nodes: Node[]; links: { points: number[][] }[]; type: Record<string, { s: { L: number; D: number; V: number }; detail: boolean; fits: boolean }>; header: { h: number } }

const lib = new Function(
  'React',
  `${VisualSource}\nreturn { Visual: Visual, layout: mockyVisualLayout, contrast: mockyVisualContrast, mark: mockyVisualMark, inkOn: mockyVisualInkOn, lines: mockyVisualLines, bounds: MOCKY_VISUAL_BOUNDS, families: MOCKY_VISUAL_FAMILIES };`,
)(React) as {
  Visual: React.FC<Record<string, unknown>>
  layout: (family: string, doc: unknown, W: number, H: number) => Layout
  contrast: (a: string, b: string) => number
  mark: (c: string, bg: string, ink: string, floor: number) => string
  inkOn: (bg: string, prefs: string[], floor?: number) => string
  lines: (text: string, size: number, width: number) => number
  bounds: unknown
  families: unknown
}

const FRAMES: [number, number][] = [
  [1180, 620], // a 16:9 slide inside its margin
  [980, 980], // square
  [980, 1250], // 4:5 portrait
]

const WORDS = ['Écouter', 'Cadrer le besoin', 'Prototyper vite', 'Tester avec dix utilisateurs', 'Livrer', 'Mesurer', 'Ajuster', 'Recommencer', 'Partager', 'Documenter']

function docFor(family: VisualFamily, count: number, long = false): VisualDoc {
  const b = VISUAL_BOUNDS[family]
  const items = Array.from({ length: count }, (_, i) => ({
    label: long ? `${WORDS[i % WORDS.length]} anticonstitutionnellement` : WORDS[i % WORDS.length],
    detail: long
      ? 'Une phrase de détail assez longue pour remplir deux lignes au moins dans une carte de taille ordinaire.'
      : 'Une phrase courte de détail.',
    ...(b.values ? { value: (count - i) * 12.5, unit: '%' } : {}),
    ...(b.children || family === 'mindmap' || family === 'tree' || family === 'before-after' ? { children: ['Premier point', 'Deuxième point', 'Troisième'].slice(0, 1 + (i % 3)) } : {}),
  }))
  return {
    title: 'Notre méthode en quelques étapes',
    subtitle: 'Ce que nous faisons pour chaque projet, du premier appel à la mise en ligne.',
    items,
    ...(family === 'matrix' ? { axes: { x: 'Effort', y: 'Impact' } } : {}),
    ...(family === 'flow' ? { relations: [{ from: 0, to: 1 }, ...(count > 2 ? [{ from: 0, to: 2, label: 'non' }, { from: count - 1, to: 0, label: 'retour' }] : [])] } : {}),
    source: 'Source : étude interne, 2025',
  }
}

const BOXES = new Set(['card', 'band', 'centre', 'dot', 'text', 'swatch', 'donut'])

function overlaps(a: Node, b: Node) {
  return a.x < b.x + b.w - 0.5 && b.x < a.x + a.w - 0.5 && a.y < b.y + b.h - 0.5 && b.y < a.y + a.h - 0.5
}

describe('<Visual> layout', () => {
  it('is built from the catalogue, not from a copy of it', () => {
    expect(lib.bounds).toEqual(VISUAL_BOUNDS)
    expect(lib.families).toEqual([...VISUAL_FAMILIES])
  })

  for (const family of VISUAL_FAMILIES) {
    const b = VISUAL_BOUNDS[family]
    for (const [W, H] of FRAMES) {
      for (const count of b.exact ? [b.min] : [b.min, b.max]) {
        for (const long of [false, true]) {
          it(`${family} — ${count} items${long ? ', long words' : ''}, ${W}×${H}: inside the frame, nothing on top of anything`, () => {
            const lay = lib.layout(family, docFor(family, count, long), W, H)
            const boxes = lay.nodes.filter((n) => BOXES.has(n.kind))
            expect(boxes.length).toBeGreaterThan(0)
            for (const n of lay.nodes) {
              for (const v of [n.x, n.y, n.w, n.h]) expect(Number.isFinite(v), `${n.kind} ${JSON.stringify(n)}`).toBe(true)
              expect(n.x, n.kind).toBeGreaterThanOrEqual(-0.5)
              expect(n.y, n.kind).toBeGreaterThanOrEqual(lay.header.h - 0.5)
              expect(n.x + n.w, n.kind).toBeLessThanOrEqual(W + 0.5)
              expect(n.y + n.h, n.kind).toBeLessThanOrEqual(H + 0.5)
            }
            for (let i = 0; i < boxes.length; i++)
              for (let j = i + 1; j < boxes.length; j++)
                expect(overlaps(boxes[i], boxes[j]), `${boxes[i].kind} ${i} over ${boxes[j].kind} ${j}`).toBe(false)
            for (const l of lay.links) for (const p of l.points) for (const v of p) expect(Number.isFinite(v)).toBe(true)
          })
        }
      }
    }
  }

  it('sizes type per role: one label size for every card, the detail always smaller', () => {
    for (const family of VISUAL_FAMILIES) {
      const b = VISUAL_BOUNDS[family]
      const lay = lib.layout(family, docFor(family, b.exact ? b.min : Math.min(b.max, 5)), 1180, 620)
      for (const [role, fit] of Object.entries(lay.type)) {
        expect(fit.s.D, `${family}/${role}`).toBeLessThan(fit.s.L)
        expect(fit.s.L, `${family}/${role}`).toBeGreaterThanOrEqual(11)
      }
    }
  })

  it('fits an ordinary document on a slide with its details', () => {
    for (const family of VISUAL_FAMILIES) {
      const b = VISUAL_BOUNDS[family]
      const lay = lib.layout(family, docFor(family, b.exact ? b.min : Math.min(b.max, 4)), 1180, 620)
      for (const [role, fit] of Object.entries(lay.type)) expect(fit.fits, `${family}/${role}`).toBe(true)
    }
  })

  it('never cuts a word: a word longer than the line is refused, so the size comes down', () => {
    expect(lib.lines('anticonstitutionnellement', 40, 200)).toBe(Infinity)
    expect(lib.lines('anticonstitutionnellement', 12, 200)).toBe(1)
    expect(lib.lines('un deux trois quatre cinq six sept', 20, 120)).toBeGreaterThan(1)
  })

  it('degrades on an empty, a malformed or an unknown document instead of throwing', () => {
    for (const doc of [null, undefined, {}, { items: 'x' }, { items: [null, 3, { detail: 'no label' }] }]) {
      expect(() => lib.layout('cycle', doc, 800, 450)).not.toThrow()
    }
    expect(() => lib.layout('not-a-family', docFor('steps', 3), 800, 450)).not.toThrow()
    expect(() => lib.layout('flow', { items: [{ label: 'a' }, { label: 'b' }], relations: [{ from: 0, to: 9 }, { from: 1, to: 1 }, { from: 1, to: 0 }] }, 800, 450)).not.toThrow()
  })

  it('draws the items past a family’s maximum no more', () => {
    const doc = docFor('steps', 12)
    const lay = lib.layout('steps', doc, 1180, 620)
    expect(lay.nodes.filter((n) => n.kind === 'card')).toHaveLength(VISUAL_BOUNDS.steps.max)
  })
})

describe('<Visual> colour', () => {
  it('keeps a palette colour used as ink above the floor, on any ground', () => {
    for (const c of ['#fde047', '#22d3ee', '#1e3a8a', '#9ca3af', '#ffffff', '#000000']) {
      for (const bg of ['#ffffff', '#0b1020', '#f5f0e6', '#6b7280']) {
        const ink = lib.contrast('#111827', bg) > lib.contrast('#ffffff', bg) ? '#111827' : '#ffffff'
        expect(lib.contrast(lib.mark(c, bg, ink, 3), bg), `${c} on ${bg}`).toBeGreaterThanOrEqual(3)
      }
    }
  })

  it('chooses the page’s own colours for text first, black or white only when they fail', () => {
    expect(lib.inkOn('#ffffff', ['#0f766e'])).toBe('#0f766e')
    expect(lib.inkOn('#0f766e', ['#ffffff', '#111827'])).toBe('#ffffff')
    expect(lib.inkOn('#777777', ['#888888'])).toMatch(/^#(000000|ffffff)$/)
  })
})

describe('<Visual> rendered', () => {
  const html = (props: Record<string, unknown>) => renderToStaticMarkup(React.createElement(lib.Visual, props))

  it('renders every family with the text as real text and no stray number', () => {
    for (const family of VISUAL_FAMILIES) {
      const b = VISUAL_BOUNDS[family]
      const out = html({ family, doc: docFor(family, b.exact ? b.min : 3), colors: ['#0f766e', '#f59e0b'], ink: '#1f2937', ground: '#fffbeb', width: 1180, height: 620 })
      expect(out, family).toContain(`data-mocky-visual="${family}"`)
      expect(out, family).toContain('Écouter')
      expect(out, family).not.toMatch(/NaN|undefined|Infinity/)
    }
  })

  it('draws boxes in HTML and only connectors and a donut in SVG', () => {
    const out = html({ family: 'steps', doc: docFor('steps', 4), width: 1180, height: 620 })
    expect(out.match(/<svg/g)).toHaveLength(1)
    expect(out).not.toMatch(/<text/)
  })
})
