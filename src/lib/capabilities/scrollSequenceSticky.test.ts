import { describe, it, expect, vi, afterEach } from 'vitest'
import { ScrollVideoSource } from './snippets/ScrollVideo'

/**
 * The scroll sequence pins its canvas with `position: sticky`, and an ancestor
 * with `overflow: hidden` silently cancels that — the canvas then scrolls away
 * over a black section three screens tall. Three Motion Ultra pages in a row
 * wrapped themselves in `overflow-hidden`. `mockySeqFreeSticky` is the fix,
 * lifted out of the shipped source and run against a hand-made tree of nodes.
 */
const free = ScrollVideoSource.match(/function mockySeqFreeSticky[\s\S]*?\n\}/)?.[0] ?? ''
const keep = ScrollVideoSource.match(/function mockySeqKeepSticky[\s\S]*?\n\}/)?.[0] ?? ''
const freeSticky = new Function(`${free}\nreturn mockySeqFreeSticky`)() as (el: unknown) => () => void
const keepSticky = new Function(`${free}\n${keep}\nreturn mockySeqKeepSticky`)() as (el: unknown) => () => void

type Node = { parentElement: Node | null; style: Record<string, string>; computed: Record<string, string> }
const node = (parent: Node | null, overflowX = 'visible', overflowY = 'visible'): Node => ({
  parentElement: parent,
  style: {},
  computed: { overflowX, overflowY },
})

afterEach(() => vi.unstubAllGlobals())

function world() {
  const html = node(null)
  const body = node(html)
  const page = node(body, 'hidden', 'hidden') // <main className="overflow-hidden">
  const band = node(page, 'hidden', 'visible') // overflow-x-hidden
  const scroller = node(band, 'auto', 'auto') // a real scrolling panel
  const section = node(scroller)
  vi.stubGlobal('document', { documentElement: html })
  vi.stubGlobal('window', { CSS: { supports: () => true } })
  vi.stubGlobal('CSS', { supports: () => true })
  // Like a browser: an inline value wins over what the stylesheet says.
  vi.stubGlobal('getComputedStyle', (n: Node) => ({
    overflowX: n.style.overflowX || n.computed.overflowX,
    overflowY: n.style.overflowY || n.computed.overflowY,
  }))
  return { html, body, page, band, scroller, section }
}

describe('mockySeqFreeSticky', () => {
  it('turns every hidden ancestor into clip, axis by axis, and leaves real scrollers alone', () => {
    const w = world()
    freeSticky(w.section)
    expect(w.page.style).toEqual({ overflowX: 'clip', overflowY: 'clip' })
    expect(w.band.style).toEqual({ overflowX: 'clip' })
    expect(w.scroller.style).toEqual({})
    expect(w.html.style).toEqual({})
  })

  it('puts everything back when the sequence leaves the page', () => {
    const w = world()
    w.page.style.overflowX = 'hidden'
    const undo = freeSticky(w.section)
    undo()
    // Each property gets back exactly what was written inline before.
    expect(w.page.style.overflowX).toBe('hidden')
    expect(w.page.style.overflowY).toBeUndefined()
    expect(w.band.style.overflowX).toBeUndefined()
  })

  it('does nothing in a browser that has no overflow: clip', () => {
    const w = world()
    vi.stubGlobal('window', { CSS: { supports: () => false } })
    vi.stubGlobal('CSS', { supports: () => false })
    freeSticky(w.section)
    expect(w.page.style).toEqual({})
  })
})

describe('mockySeqKeepSticky — the check that runs again', () => {
  it('fixes a wrapper whose overflow only became hidden AFTER the sequence mounted', () => {
    vi.useFakeTimers()
    const w = world()
    vi.stubGlobal('window', {
      CSS: { supports: () => true },
      requestAnimationFrame: () => 0,
      cancelAnimationFrame: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
    })
    // At mount Tailwind has not written the class yet: the wrapper reads visible.
    w.page.computed = { overflowX: 'visible', overflowY: 'visible' }
    const stop = keepSticky(w.section)
    expect(w.page.style).toEqual({})
    // A moment later it has — exactly what a single check at mount missed.
    w.page.computed = { overflowX: 'hidden', overflowY: 'hidden' }
    vi.advanceTimersByTime(200)
    expect(w.page.style).toEqual({ overflowX: 'clip', overflowY: 'clip' })
    stop()
    expect(w.page.style.overflowX).toBeUndefined()
    vi.useRealTimers()
  })
})
