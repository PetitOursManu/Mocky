import { describe, expect, it } from 'vitest'
import React from 'react'
import { HAND_FALLBACK, HAND_FONTS, handCovers, handFor, handLayout, handPlain, handReveal, handStrokes } from './hand.js'
import { HANDWRITING_HANDS } from '../../validate.js'
import { HandwritingSource } from '../../../../src/lib/capabilities/snippets/Handwriting.ts'

/**
 * The pen of the `handwriting` block, as arithmetic: which hand, how much of the
 * line on a given frame, and how large. A film is one number per frame, so the
 * questions that matter — does the line end finished, does it ever un-write —
 * are questions about these functions.
 */

describe('the hands', () => {
  it('are the five the schema names', () => {
    expect(Object.keys(HAND_FONTS).sort()).toEqual([...HANDWRITING_HANDS].sort())
  })

  it('write a French line whole, through the fallback when they must', () => {
    const line = handPlain('Été à Noël, déjà « oui »')
    expect(handCovers(HAND_FONTS.parisienne, line)).toBe(false)
    expect(handFor('parisienne', line)).toBe(HAND_FONTS[HAND_FALLBACK])
    expect(handFor('caveat', 'Merci')).toBe(HAND_FONTS.caveat)
    expect(handStrokes('Été', 'parisienne')).not.toBeNull()
  })

  it('answers null for a line no hand can write, so the block sets it as type', () => {
    expect(handStrokes('漢字', 'parisienne')).toBeNull()
  })

  /**
   * The worker cannot import the page component's helper, so the table is copied;
   * this is what holds the copy to the original.
   */
  it('plainens typography exactly as a page’s <Handwriting> does', () => {
    const page = new Function('React', `${HandwritingSource}\nreturn mockyHwPlain`)(React)
    for (const text of ['l’œuf « Bonjour »… — fin', 'Æsop — “quote”', '  a  b  ', 'Noël !']) {
      expect(handPlain(text), text).toBe(page(text))
    }
  })
})

describe('the reveal', () => {
  const strokes = handStrokes('Merci', 'parisienne')

  it('starts empty and ends on every mark the hand made', () => {
    expect(handReveal(strokes, 0)).toEqual([])
    expect(handReveal(strokes, 1)).toEqual(strokes.marks)
    expect(strokes.total).toBeGreaterThan(0)
  })

  it('never un-writes: each frame draws all the previous one did', () => {
    let previous = 0
    let reached = 0
    for (let i = 0; i <= 60; i++) {
      const marks = handReveal(strokes, i / 60)
      expect(marks.length).toBeGreaterThanOrEqual(previous)
      const ink = marks.reduce((sum, m) => sum + (m.type === 'line' ? Math.hypot(m.x2 - m.x1, m.y2 - m.y1) : 0), 0)
      expect(ink).toBeGreaterThanOrEqual(reached - 1e-6)
      previous = marks.length
      reached = ink
    }
  })

  it('cuts the segment the pen is in the middle of, so the line grows continuously', () => {
    const half = handReveal(strokes, 0.5)
    const last = half[half.length - 1]
    const whole = strokes.marks.find((m) => m.type === 'line' && m.x1 === last.x1 && m.y1 === last.y1)
    expect(Math.hypot(last.x2 - last.x1, last.y2 - last.y1)).toBeLessThanOrEqual(Math.hypot(whole.x2 - whole.x1, whole.y2 - whole.y1) + 1e-9)
  })
})

describe('the size', () => {
  it('stays inside the box it was given, whatever the box', () => {
    const strokes = handStrokes('Avec toute mon amitié', 'italianno')
    for (const box of [
      { width: 1600, height: 300 },
      { width: 300, height: 600 },
      { width: 900, height: 90 },
    ]) {
      const layout = handLayout(strokes, 'Avec toute mon amitié', box, 80)
      expect(layout.width).toBeLessThanOrEqual(box.width)
      expect(layout.height).toBeLessThanOrEqual(box.height)
      expect(layout.width).toBeGreaterThan(0)
    }
  })
})
