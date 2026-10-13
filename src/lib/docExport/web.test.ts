import { describe, expect, it } from 'vitest'
import { planSlides, sliceSnapshot, slideSize, webFormat } from './web'
import { pinViewportHeights } from './render'
import type { PageSnapshot, TextBlock } from './types'

const block = (y: number, h: number): TextBlock => ({
  rect: { x: 0, y, w: 100, h },
  lines: [{ text: 't', rect: { x: 0, y, w: 100, h }, runs: [], block: 0, fontSize: 16 }],
  align: 'left',
  pitch: 0,
})

describe('a web screen as slides', () => {
  it('cuts a wide page in 16:9 and a phone page in 9:16', () => {
    expect(slideSize(1440)).toEqual({ w: 1440, h: 810 })
    expect(slideSize(390)).toEqual({ w: 390, h: 693 })
    expect(webFormat({ w: 1440, h: 900 })).toMatchObject({ w: 1440, h: 900, kind: 'slides' })
    expect(webFormat({ w: 0, h: 0 })).toMatchObject({ w: 1440, h: 900 })
  })

  it('covers the whole page, and never cuts a text block in half when it can move up to its top', () => {
    const blocks = [block(100, 50), block(780, 60), block(1500, 40)]
    const plan = planSlides(blocks, 2000, 810)
    // The second slide starts at the block that crossed 810, not at 810.
    expect(plan.map((p) => p.start)).toEqual([0, 780, 1590])
    expect(plan[0].blocks).toEqual([0])
    expect(plan[1].blocks).toEqual([1, 2])
    // Every block is on at least one slide, whole.
    expect(new Set(plan.flatMap((p) => p.blocks))).toEqual(new Set([0, 1, 2]))
  })

  it('still advances through a page that is one endless block', () => {
    const plan = planSlides([block(10, 5000)], 5000, 810)
    expect(plan.length).toBeGreaterThan(5)
    expect(plan.every((p, i) => i === 0 || p.start > plan[i - 1].start)).toBe(true)
  })

  it('moves a slide\'s blocks and links to its own origin', () => {
    const snap: PageSnapshot = {
      index: 0,
      width: 1440,
      height: 2000,
      blocks: [block(100, 50), block(900, 40)],
      lines: [],
      fields: [],
      links: [{ href: 'https://x.test', rect: { x: 0, y: 950, w: 10, h: 10 } }],
    }
    const s = sliceSnapshot(snap, 810, 810, [1], 1)
    expect(s.blocks[0].rect.y).toBe(90)
    expect(s.lines[0].rect.y).toBe(90)
    expect(s.links).toEqual([{ href: 'https://x.test', rect: { x: 0, y: 140, w: 10, h: 10 } }])
    expect(s.height).toBe(810)
  })
})

describe('pinViewportHeights', () => {
  it('holds whatever is sized on the viewport at the height it has, and nothing else', () => {
    const el = (id: string, cls: string, style = '') => {
      const set: Record<string, string> = {}
      return {
        id,
        className: cls,
        getAttribute: (n: string) => (n === 'style' ? style : n === 'class' ? cls : null),
        getBoundingClientRect: () => ({ height: 900 }),
        style: { setProperty: (k: string, v: string) => (set[k] = v) },
        set,
      }
    }
    const els = [
      el('root', ''),
      el('a', 'min-h-screen bg-black'),
      el('b', 'md:h-[80vh]'),
      el('c', '', 'height: 50vh'),
      el('d', 'h-screen-like text-sm'),
      el('e', 'max-h-dvh'),
    ]
    const doc = { querySelectorAll: () => els } as unknown as Document
    expect(pinViewportHeights({} as Window, doc)).toBe(5)
    expect(els[1].set['min-height']).toBe('900px')
    expect(els[2].set.height).toBe('900px')
    expect(els[3].set.height).toBe('900px')
    expect(els[4].set).toEqual({})
    expect(els[5].set['max-height']).toBe('none')
    // The root keeps growing with its content: only its floor is pinned.
    expect(els[0].set).toEqual({ 'min-height': '900px' })
  })
})
