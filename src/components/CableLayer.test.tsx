import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import CableLayer from './CableLayer'
import { routeCables, type CableLink, type Rect } from '../lib/cables'

/**
 * What the layer paints, read off its static markup. The geometry has its own
 * tests; these hold the PAINTING decisions a refactor could quietly undo — the
 * quiet map takes no pointer, a dead link is still drawn, a whole-screen source
 * gets no second frame around its frame.
 */

const r = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h })
const boxes = new Map<string, Rect>([
  ['a', r(0, 0, 400, 300)],
  ['b', r(1000, 0, 400, 300)],
])
const names = new Map([
  ['a', 'Accueil'],
  ['b', 'Tarifs'],
])
const everywhere = r(-1e6, -1e6, 2e6, 2e6)

const links: CableLink[] = [
  { id: 'h1', sourceId: 'a', targetId: 'b', rect: r(0.4, 0.4, 0.2, 0.1), label: 'Voir les prix' },
  { id: 'h2', sourceId: 'a', targetId: 'gone', rect: r(0.1, 0.8, 0.2, 0.1) },
  { id: 'h3', sourceId: 'b', targetId: 'a', rect: r(0, 0, 0, 0) },
]
const cables = routeCables(links, boxes)

const render = (props: Partial<Parameters<typeof CableLayer>[0]> = {}) =>
  renderToStaticMarkup(
    <CableLayer cables={cables} scale={1} cull={everywhere} mode="edit" names={names} onRemove={() => {}} {...props} />,
  )

describe('CableLayer', () => {
  it('draws every cable, a dead link included', () => {
    const html = render()
    for (const c of cables) expect(html).toContain(`d="${c.path}"`)
    // The dead link is dashed and says where it no longer goes.
    expect(html).toContain('stroke-dasharray')
    expect(html).toContain('écran manquant')
  })

  it('labels a cable with its element and its target', () => {
    expect(render()).toContain('« Voir les prix » → Tarifs')
  })

  it('outlines picked elements but not a whole-screen source', () => {
    const html = render()
    // h1 and h2 carry an element; h3 was recorded with no rectangle.
    expect(html.match(/<rect /g)?.length).toBe(2)
  })

  it('keeps the quiet map deaf to the pointer', () => {
    const html = render({ mode: 'map' })
    expect(html).not.toContain('pointer-events:stroke')
    expect(html).not.toContain('<button')
    expect(html).not.toContain('<rect ')
  })

  it('offers a hit area and a draggable socket in link mode', () => {
    const html = render({ onRetargetStart: () => {} })
    expect(html).toContain('pointer-events:stroke')
    // One socket per cable: a dead link's too, so it can be plugged back in.
    expect(html.match(/cursor:grab/g)?.length).toBe(cables.length)
  })

  it('lays the hit area only over the part outside the source screen', () => {
    const html = render()
    for (const c of cables) expect(html).toContain(`d="${c.hitPath}"`)
  })

  it('hides the cable being reconnected', () => {
    const html = render({ hiddenId: 'h1' })
    expect(html).not.toContain(`d="${cables[0].path}"`)
  })

  it('draws nothing outside the culling window', () => {
    expect(render({ cull: r(50_000, 50_000, 10, 10) })).toBe('')
  })

  it('drops the labels of the quiet map when zoomed out', () => {
    expect(render({ mode: 'map', scale: 0.1 })).not.toContain('Tarifs')
  })
})
