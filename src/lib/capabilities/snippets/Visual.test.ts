import { afterEach, describe, expect, it } from 'vitest'
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
  `${VisualSource}\nreturn { Visual: Visual, layout: mockyVisualLayout, timeline: mockyVisualTimeline, contrast: mockyVisualContrast, mark: mockyVisualMark, inkOn: mockyVisualInkOn, lines: mockyVisualLines, bounds: MOCKY_VISUAL_BOUNDS, families: MOCKY_VISUAL_FAMILIES };`,
)(React) as {
  Visual: React.FC<Record<string, unknown>>
  layout: (family: string, doc: unknown, W: number, H: number, opts?: Record<string, unknown>) => Layout
  timeline: (lay: Layout) => { header: number; nodes: number[]; links: number[]; footer: number; total: number }
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
    ...(b.children || ['mindmap', 'tree', 'before-after', 'fishbone', 'layers'].includes(family) ? { children: ['Premier point', 'Deuxième point', 'Troisième'].slice(0, 1 + (i % 3)) } : {}),
    // Positions spread over the plane, spans that overlap like a real plan.
    x: (i * 7) % 11,
    y: family === 'user-journey' ? ((i * 3) % 5) - 2 : (i * 4) % 11,
    start: i * 2,
    end: i * 2 + 3,
    total: 10,
  }))
  return {
    title: 'Notre méthode en quelques étapes',
    subtitle: 'Ce que nous faisons pour chaque projet, du premier appel à la mise en ligne.',
    items,
    ...(family === 'matrix' || family === 'quadrant-chart' ? { axes: { x: 'Effort', y: 'Impact' } } : {}),
    ...(family === 'quadrant-chart' ? { quadrants: ['À planifier', 'Priorités', 'À oublier', 'Gains rapides'] } : {}),
    ...(family === 'comparison-table' ? { criteria: ['Prix', 'Délai', 'Support'] } : {}),
    ...(family === 'decision-tree' ? { relations: Array.from({ length: count - 1 }, (_, i) => ({ from: Math.floor(i / 2), to: i + 1, label: i % 2 ? 'Non' : 'Oui' })) } : {}),
    ...(family === 'concept-map' ? { relations: Array.from({ length: count - 1 }, (_, i) => ({ from: i, to: i + 1, label: 'mène à' })) } : {}),
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

describe('<Visual> looks', () => {
  const html = (props: Record<string, unknown>) => renderToStaticMarkup(React.createElement(lib.Visual, props))
  const LOOKS = ['flat', 'raised', 'block', 'glass', 'gradient', 'neon']

  it('renders every family in every look, with nothing undefined', () => {
    for (const family of VISUAL_FAMILIES) {
      const b = VISUAL_BOUNDS[family]
      for (const look of LOOKS) {
        const out = html({ family, look, doc: docFor(family, b.exact ? b.min : Math.min(b.max, 4)), colors: ['#0f766e', '#f59e0b'], ink: '#f8fafc', ground: '#0f172a', width: 1180, height: 620 })
        expect(out, `${family}/${look}`).not.toMatch(/NaN|undefined|Infinity/)
      }
    }
  })

  it('moves no box: a look only repaints the rectangles the layout gave', () => {
    for (const family of ['steps', 'staircase', 'comparison-table', 'hub'] as VisualFamily[]) {
      const flat = lib.layout(family, docFor(family, 4), 1180, 620)
      const block = (lib.layout as unknown as (f: string, d: unknown, w: number, h: number, o: unknown) => Layout)(family, docFor(family, 4), 1180, 620, { look: 'block' })
      expect(block.nodes.map((n) => [n.kind, n.x, n.y, n.w, n.h])).toEqual(flat.nodes.map((n) => [n.kind, n.x, n.y, n.w, n.h]))
    }
  })

  it('draws 3D as faces, cylinders, spheres and a road with pins', () => {
    expect(html({ family: 'steps', look: 'block', doc: docFor('steps', 3), width: 1180, height: 620 })).toMatch(/skewX\(-45deg\)/)
    expect(html({ family: 'columns', look: 'block', doc: docFor('columns', 3), width: 1180, height: 620 })).toMatch(/border-radius:50%/)
    expect(html({ family: 'steps', look: 'raised', doc: docFor('steps', 3), width: 1180, height: 620 })).toMatch(/radial-gradient/)
    const road = html({ family: 'roadmap', look: 'block', doc: docFor('roadmap', 4), width: 1180, height: 620 })
    expect(road).toMatch(/stroke-dasharray/)
    expect(road).toMatch(/50% 50% 50% 0/)
    expect(html({ family: 'card-grid', look: 'glass', doc: docFor('card-grid', 3), width: 1180, height: 620 })).toMatch(/backdrop-filter/)
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

  it('draws a straight connector as a box, leaving only its tip to the SVG', () => {
    const out = html({ family: 'steps', doc: docFor('steps', 4), width: 1180, height: 620 })
    const paths = [...out.matchAll(/<path[^>]* d="M([\d.]+) ([\d.]+) L([\d.]+) ([\d.]+)"/g)].map((m) => m.slice(1).map(Number))
    expect(paths).toHaveLength(3)
    for (const [x0, y0, x1, y1] of paths) expect(Math.hypot(x1 - x0, y1 - y0)).toBeLessThan(0.1)
  })

  it('draws boxes in HTML and only connectors and a donut in SVG', () => {
    const out = html({ family: 'steps', doc: docFor('steps', 4), width: 1180, height: 620 })
    expect(out.match(/<svg/g)).toHaveLength(1)
    expect(out).not.toMatch(/<text/)
  })
})

describe('<Visual> motion', () => {
  // Every mount numbers its arrow marker; two renders differ by that alone.
  const html = (props: Record<string, unknown>) => renderToStaticMarkup(React.createElement(lib.Visual, props)).replace(/mocky-visual-\d+/g, 'mocky-visual-N')
  const base = { colors: ['#0f766e', '#f59e0b'], ink: '#1f2937', ground: '#fffbeb', width: 1180, height: 620 }
  /** A page the frame is running in, with nothing asking for stillness. */
  const live = (extra: Record<string, unknown> = {}, reduce = false) => {
    ;(globalThis as any).window = { matchMedia: () => ({ matches: reduce }), ...extra }
  }
  afterEach(() => {
    delete (globalThis as any).window
  })
  /** The markup with every trace of the entrance taken out: what is left is where things END. */
  const settled = (out: string) =>
    out
      .replace(/<style>[^<]*<\/style>/g, '')
      .replace(/<svg[^>]*data-mocky-visual-pulse[^>]*>.*?<\/svg>/g, '')
      .replace(/ data-mocky-visual-motion="[^"]*"/g, '')
      .replace(/ pathLength="1"| stroke-dasharray="1 1"/g, '')
      .replace(/(animation|animation-play-state|--mocky-vz-[a-z]+|transform-origin):[^;"]*;?/g, '')
      .replace(/ style=""/g, '')
      .replace(/;"/g, '"')

  it('brings boxes in the order of the content, and a connector after the box it leaves', () => {
    for (const family of VISUAL_FAMILIES) {
      const b = VISUAL_BOUNDS[family]
      for (const count of [b.min, b.max]) {
        const lay = lib.layout(family, docFor(family, count), 1180, 620)
        const tl = lib.timeline(lay)
        for (let i = 1; i < tl.nodes.length; i++) expect(tl.nodes[i], family).toBeGreaterThanOrEqual(tl.nodes[i - 1])
        for (const d of tl.links) expect(d, family).toBeGreaterThanOrEqual(tl.nodes[0] ?? 0)
        // Read past, never waited for: the forty-cell chart takes as long as the four steps.
        expect(tl.total, `${family} × ${count}`).toBeLessThanOrEqual(2600)
        expect(tl.total).toBeGreaterThanOrEqual(Math.max(0, ...tl.nodes, ...tl.links))
      }
    }
  })

  it('draws on every still path exactly what a visual with no motion draws', () => {
    for (const motion of ['reveal', 'flow']) {
      const still = html({ family: 'cycle', doc: docFor('cycle', 5), ...base })
      // No window at all (a server render), a capture, "Sans animation", reduced motion.
      expect(html({ family: 'cycle', doc: docFor('cycle', 5), motion, ...base })).toBe(still)
      for (const flag of [{ __mockyStill: true }, { __mockyAnimations: false }]) {
        live(flag)
        expect(html({ family: 'cycle', doc: docFor('cycle', 5), motion, ...base }), JSON.stringify(flag)).toBe(still)
      }
      live({}, true)
      expect(html({ family: 'cycle', doc: docFor('cycle', 5), motion, ...base })).toBe(still)
    }
  })

  it('ends on the frame a still draws: the entrance only adds timing, it moves nothing', () => {
    for (const family of VISUAL_FAMILIES) {
      const b = VISUAL_BOUNDS[family]
      const doc = docFor(family, b.exact ? b.min : 4)
      for (const look of ['flat', 'block', 'neon']) {
        const still = html({ family, doc, look, ...base })
        live()
        const moving = html({ family, doc, look, motion: 'flow', ...base })
        delete (globalThis as any).window
        expect(moving, family).toContain('mocky-vz-')
        expect(settled(moving), `${family} / ${look}`).toBe(settled(still))
      }
    }
  })

  it('holds everything at its first frame until the visual is on screen', () => {
    live()
    const out = html({ family: 'steps', doc: docFor('steps', 4), motion: 'reveal', ...base })
    expect(out).toContain('@keyframes mocky-vz-in')
    expect(out).toContain('animation-play-state:paused')
    expect(out).not.toContain('animation-play-state:running')
  })

  it('runs a pulse along the connectors only when asked for the flow', () => {
    live()
    const reveal = html({ family: 'cycle', doc: docFor('cycle', 5), motion: 'reveal', ...base })
    const flow = html({ family: 'cycle', doc: docFor('cycle', 5), motion: 'flow', ...base })
    expect(reveal).not.toContain('data-mocky-visual-pulse')
    expect(flow).toContain('data-mocky-visual-pulse')
    expect(flow).toContain('mocky-vz-flow')
    expect(flow).not.toMatch(/NaN|undefined|Infinity/)
  })

  it('ignores a motion it does not know', () => {
    live()
    const still = html({ family: 'steps', doc: docFor('steps', 4), ...base })
    expect(html({ family: 'steps', doc: docFor('steps', 4), motion: 'spin', ...base })).toBe(still)
  })
})

describe('<Visual> inside a document and under a direction', () => {
  const html = (props: Record<string, unknown>) => renderToStaticMarkup(React.createElement(lib.Visual, props))

  it('never sets type under the page’s own floor: details go first', () => {
    // A strip of a flyer: 700 × 180 is where a squeezed diagram set its details at 9px.
    for (const family of ['timeline', 'steps', 'stats', 'bars'] as VisualFamily[]) {
      const b = VISUAL_BOUNDS[family]
      const lay = lib.layout(family, docFor(family, Math.max(b.min, 3)), 700, 180, { floor: { line: 14, small: 11 } })
      for (const [role, fit] of Object.entries(lay.type)) {
        expect(fit.s.L, `${family} ${role}`).toBeGreaterThanOrEqual(14)
        if (fit.detail) expect(fit.s.D, `${family} ${role}`).toBeGreaterThanOrEqual(11)
      }
    }
  })

  it('takes the direction’s corners, and keeps a dot round', () => {
    const out = html({ family: 'steps', doc: docFor('steps', 4), radius: 'rounded-none', width: 1180, height: 620 })
    const radii = [...out.matchAll(/border-radius:([^;"]+)/g)].map((m) => m[1].trim())
    expect(radii.length).toBeGreaterThan(0)
    for (const r of radii) expect(['0', '0px', '50%'], r).toContain(r)
    const free = html({ family: 'steps', doc: docFor('steps', 4), width: 1180, height: 620 })
    expect(free).toMatch(/border-radius:(?!0|50%)[\d.]+px/)
  })

  it('sets its headings in the direction’s display face, and takes a NAME only', () => {
    expect(html({ family: 'steps', doc: docFor('steps', 4), headingFont: 'Archivo Black', width: 1180, height: 620 })).toContain('font-family:&quot;Archivo Black&quot;')
    const hostile = html({ family: 'steps', doc: docFor('steps', 4), headingFont: 'x;}body{color:red', width: 1180, height: 620 })
    expect(hostile).not.toContain('body{')
  })
})
