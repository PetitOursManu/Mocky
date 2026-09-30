import type { FieldBox, PageSnapshot, RunStyle, TextLine } from './types'

/**
 * Synthetic document pages for the export tests.
 *
 * The page kit that draws real documents is built beside this code, so the
 * tests do not wait for it: a snapshot is what the DOM walk WOULD report for a
 * flyer — a headline, a line of body copy, two fields, a link — and every
 * writer is checked against that.
 */

/** A valid 1 × 1 JPEG — enough for pdf-lib to embed and for a slide to reference. */
export const TINY_JPEG = Uint8Array.from(
  atob(
    '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
  ),
  (c) => c.charCodeAt(0),
)

export function style(over: Partial<RunStyle> = {}): RunStyle {
  return {
    fontSize: 16,
    fontWeight: 400,
    italic: false,
    underline: false,
    color: { r: 17, g: 24, b: 39, a: 1 },
    fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
    letterSpacing: 0,
    ...over,
  }
}

export function line(text: string, x: number, y: number, w: number, h: number, over: Partial<RunStyle> = {}, block = 0): TextLine {
  const s = style(over)
  return { text, rect: { x, y, w, h }, runs: [{ text, style: s }], block, fontSize: s.fontSize }
}

export function field(over: Partial<FieldBox> = {}): FieldBox {
  return {
    name: 'nom',
    type: 'text',
    rect: { x: 80, y: 700, w: 400, h: 40 },
    value: '',
    placeholder: 'Votre nom',
    checked: false,
    options: [],
    fontSize: 16,
    color: { r: 17, g: 24, b: 39, a: 1 },
    align: 'left',
    paddingLeft: 12,
    ...over,
  }
}

/** A flyer page: a headline, body copy, a text field, a checkbox, a select and a link. */
export function flyerPage(index = 0): PageSnapshot {
  const headline = line('Fête d’été — 21 juin', 80, 120, 620, 58, { fontSize: 48, fontWeight: 800 }, 0)
  const body = line('Concerts, food trucks & jeux', 80, 200, 420, 24, {}, 1)
  return {
    index,
    width: 794,
    height: 1123,
    lines: [headline, body],
    blocks: [
      { rect: headline.rect, lines: [headline], align: 'left', pitch: 58 },
      { rect: body.rect, lines: [body], align: 'left', pitch: 24 },
    ],
    fields: [
      field(),
      field({ name: 'newsletter', type: 'checkbox', rect: { x: 80, y: 760, w: 20, h: 20 }, placeholder: '', checked: true }),
      field({ name: 'créneau', type: 'select', rect: { x: 80, y: 800, w: 300, h: 40 }, options: ['Matin', 'Soir'], value: 'Soir' }),
    ],
    links: [{ href: 'https://example.org/fete', rect: { x: 80, y: 1000, w: 200, h: 20 } }],
  }
}
