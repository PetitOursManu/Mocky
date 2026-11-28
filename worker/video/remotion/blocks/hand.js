/**
 * The arithmetic of `handwriting`: what a hand writes, how large, and how much of
 * it the pen has reached on a given frame.
 *
 * The strokes are Tegaki's (MIT, https://github.com/gkurt/tegaki): a handwriting
 * font traced into pen strokes, in the order a pen takes them. Tegaki can write
 * them out itself, with CSS keyframes or a canvas on its own clock, and neither is
 * usable in a film: the frame arrives here as `progress` and `life`, and both
 * engines (`remotion/clock.js`) must draw the same frame for the same number. So
 * Tegaki is asked for the FINISHED words — `textToSvg` in its static mode, pressure
 * on, which writes every stroke as a run of short segments, each with the pen's
 * width there — and this file reveals that list by the length the pen has
 * travelled. Pure arithmetic on numbers Tegaki wrote, which is what lets
 * `hand.test.js` prove the reveal ends on the finished word and never goes back.
 *
 * Nothing here reads a clock, a die or the DOM, and no colour is written: the
 * words are drawn in the colour the block is handed.
 */
import { textToSvg } from 'tegaki/core'
import caveat from 'tegaki/fonts/caveat'
import emsAllure from 'tegaki/fonts/ems-allure'
import hersheyScript from 'tegaki/fonts/hershey-script'
import italianno from 'tegaki/fonts/italianno'
import parisienne from 'tegaki/fonts/parisienne'
import { typeScale } from '../composition.js'

/** The five hands, by the name a document writes (`HANDWRITING_HANDS`). */
export const HAND_FONTS = {
  parisienne,
  caveat,
  italianno,
  'ems-allure': emsAllure,
  'hershey-script': hersheyScript,
}

/**
 * The hand a line is written in when the one asked for cannot write all of it.
 *
 * Caveat, Parisienne and Italianno carry unaccented letters only, and a French
 * line has an accent every few words; EMS Allure carries Latin-1 and Latin
 * Extended-A. The same rule as a page's `<Handwriting>` — a word is never written
 * with a hole in it.
 */
export const HAND_FALLBACK = 'ems-allure'

/**
 * How much of the scene the pen spends writing: two thirds, `typewriter`'s share,
 * for `typewriter`'s reason — the words are READ, and a line finished at the cut
 * is a line nobody read.
 */
export const HAND_SHARE = 0.66

/**
 * Typography a pen does not have, written the way a hand would. The same table as
 * `mockyHwPlain` in `src/lib/capabilities/snippets/Handwriting.ts`, which this
 * worker cannot import; `hand.test.js` runs both on one corpus.
 */
export function handPlain(text) {
  return String(text ?? '')
    .replace(/[‘’‚′]/g, "'")
    .replace(/«[\s  ]*/g, '"')
    .replace(/[\s  ]*»/g, '"')
    .replace(/[“”„]/g, '"')
    .replace(/œ/g, 'oe')
    .replace(/Œ/g, 'OE')
    .replace(/æ/g, 'ae')
    .replace(/Æ/g, 'AE')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/[  ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Whether a hand has a glyph for every character of a line. */
export function handCovers(bundle, text) {
  const glyphs = bundle?.glyphData
  if (!glyphs) return false
  return Array.from(text).every((ch) => ch === ' ' || Boolean(glyphs[ch]))
}

/** The hand that writes a line: the one asked for, the fallback, or none. */
export function handFor(hand, text) {
  const asked = HAND_FONTS[hand] ?? HAND_FONTS.parisienne
  if (handCovers(asked, text)) return asked
  const fallback = HAND_FONTS[HAND_FALLBACK]
  return handCovers(fallback, text) ? fallback : null
}

const NUM = (s) => {
  const n = Number(s)
  return Number.isFinite(n) ? n : 0
}

function attrs(source) {
  const out = {}
  // Names with digits in them — `x1`, `y2` — are most of what a segment is.
  for (const m of source.matchAll(/([a-zA-Z][\w:-]*)="([^"]*)"/g)) out[m[1]] = m[2]
  return out
}

const cache = new Map()

/**
 * Every mark the pen makes, in the order it makes them, with the distance
 * travelled when each one starts and ends.
 *
 * Segments are `<line>`s and the polylines of a `<path>`; a nib stamp (`<ellipse>`,
 * where a stroke's end is wider than a line can draw) appears when the pen
 * reaches it. Answered once per line and hand: a film draws the same words on
 * every frame of a scene.
 *
 * @returns {{ viewBox: number[], marks: object[], total: number } | null}
 *   null when no hand can write the line whole.
 */
export function handStrokes(text, hand) {
  const plain = handPlain(text)
  const key = `${hand}\u0000${plain}`
  if (cache.has(key)) return cache.get(key)
  const bundle = plain ? handFor(hand, plain) : null
  let result = null
  if (bundle) {
    const svg = textToSvg(plain, bundle, { mode: 'static', pressure: 1, color: 'currentColor', fontSize: 100, crop: true })
    const box = /viewBox="([^"]+)"/.exec(svg)
    const viewBox = box ? box[1].trim().split(/[\s,]+/).map(NUM) : [0, 0, 100, 100]
    const group = /<g\b([^>]*)>/.exec(svg)
    const groupWidth = NUM(group ? attrs(group[1])['stroke-width'] : 0) || 1
    const marks = []
    let total = 0
    const segment = (x1, y1, x2, y2, w) => {
      const length = Math.hypot(x2 - x1, y2 - y1)
      marks.push({ type: 'line', x1, y1, x2, y2, w, from: total, to: total + length })
      total += length
    }
    for (const m of svg.matchAll(/<(line|ellipse|path)\b([^>]*?)\/?>/g)) {
      const a = attrs(m[2])
      const w = NUM(a['stroke-width']) || groupWidth
      if (m[1] === 'line') {
        segment(NUM(a.x1), NUM(a.y1), NUM(a.x2), NUM(a.y2), w)
      } else if (m[1] === 'path') {
        const pts = [...(a.d || '').matchAll(/-?\d*\.?\d+(?:e-?\d+)?/gi)].map((p) => NUM(p[0]))
        for (let i = 2; i + 1 < pts.length; i += 2) segment(pts[i - 2], pts[i - 1], pts[i], pts[i + 1], w)
      } else {
        const turn = /rotate\(([-\d.e]+)/.exec(a.transform || '')
        marks.push({ type: 'stamp', cx: NUM(a.cx), cy: NUM(a.cy), rx: NUM(a.rx), ry: NUM(a.ry), turn: turn ? NUM(turn[1]) : 0, from: total, to: total })
      }
    }
    result = { viewBox, marks, total }
  }
  cache.set(key, result)
  return result
}

/**
 * The marks drawn when the pen has covered `reveal` (0–1) of the line.
 *
 * A segment the pen is in the middle of is cut where the pen is, so the line
 * grows continuously rather than one segment at a time. Monotone by construction:
 * a larger reveal draws everything a smaller one did, and 1 draws every mark.
 */
export function handReveal(strokes, reveal) {
  if (!strokes) return []
  const r = Math.min(1, Math.max(0, Number(reveal) || 0))
  if (r >= 1) return strokes.marks
  const reached = r * strokes.total
  const out = []
  for (const mark of strokes.marks) {
    if (mark.type === 'stamp') {
      if (mark.from <= reached && r > 0) out.push(mark)
      continue
    }
    if (mark.to <= reached) out.push(mark)
    else if (mark.from < reached) {
      const k = (reached - mark.from) / (mark.to - mark.from)
      out.push({ ...mark, x2: mark.x1 + (mark.x2 - mark.x1) * k, y2: mark.y1 + (mark.y2 - mark.y1) * k })
    } else break
  }
  return out
}

/**
 * How large the words are drawn in the block's own box.
 *
 * `display`, the step every headline in the catalogue takes, solved against the
 * stack's unit like `funTitle`'s — and then held inside the box by the ink's own
 * proportions, because a script runs wider than the type the scale estimated and
 * a line that crosses its box crosses into the block beside it.
 *
 * The strokes are laid out at a font size of 100, so the scale is a size over 100.
 */
export function handLayout(strokes, text, box, unit) {
  const width = Math.max(0, Number(box?.width) || 0)
  const height = Math.max(0, Number(box?.height) || 0)
  if (!strokes) return { scale: 0, width: 0, height: 0, air: Math.round(height / 2) }
  const [, , vbW, vbH] = strokes.viewBox
  const size = typeScale('display', handPlain(text), box, { unit, nowrap: true })
  const scale = Math.max(0, Math.min(size / 100, vbW > 0 ? width / vbW : 0, vbH > 0 ? height / vbH : 0))
  const drawnH = Math.round(vbH * scale)
  return { scale, width: Math.round(vbW * scale), height: drawnH, air: Math.max(0, Math.round((height - drawnH) / 2)) }
}
