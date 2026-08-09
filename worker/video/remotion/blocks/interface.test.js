// The interface family's beats, as claims rather than as prose.
//
// Everything here is arithmetic on purpose. A block is a `.jsx` and a `.jsx`
// cannot be loaded in this suite — Remotion is not installed in Mocky and never
// will be — so the only part of `button`, `form`, `notification` and `lowerThird`
// a test can reach is the part that was deliberately taken out of them. That is
// why `interface.js` exists, and this file is the reason it earns its place.
//
// Three questions run through it, and they are the three that decide whether a
// film is worth rendering:
//
//   - does it still MOVE? Not "did it move once" — every frame of every scene,
//     from the frame the block arrives on to the cut. A control that eases onto
//     its mark and then holds for fourteen seconds is a screenshot with a fade in
//     front of it, and it renders perfectly.
//   - does it stay INSIDE its mark? `composedLayout` measured a box against the
//     safe area; a settle that overshoots spends that margin on an ornament.
//   - does it happen in ORDER? A submit that lights up while a field is still
//     filling is a form whose button means nothing.
import { describe, it, expect } from 'vitest'
import {
  BAND_GONE_BY,
  BAND_LEAVES_AT,
  BAND_SUBTITLE_FROM,
  BAND_TEXT_FROM,
  BUTTON_ENTER_SCALE,
  BUTTON_PRESS_AT,
  BUTTON_PRESS_SPAN,
  FORM_FILLED_BY,
  NOTICE_GONE_BY,
  NOTICE_LEAVES_AT,
  REST_CREEP,
  bandExit,
  bandReveal,
  bandWidth,
  buttonPress,
  buttonScale,
  controlClock,
  formCadence,
  markSwing,
  noticeExit,
  noticeSlide,
  restOffset,
} from './interface.js'
import { ANCHORS, COMPOSED_BLOCK_DRIFT, CUE_ENTER_FRAMES, composedPalette, cueProgress, layerCues, resolveTheme } from '../composition.js'
// The four components, and the schema that decides what they are handed. Both
// imports are TEST-ONLY and the second one has to stay that way, for the reason
// `blocks.test.js` spells out: the Docker build copies `worker/video/` and
// nothing else, so a runtime import of anything under `server/` is a container
// that boots and then fails every render on a missing module. Nothing in this
// directory imports `remotion`, which is the whole reason a `.jsx` can be loaded
// here at all — see the same file.
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Button } from './button.jsx'
import { Form } from './form.jsx'
import { LowerThird } from './lowerThird.jsx'
import { Notification } from './notification.jsx'
import { BlockSchema } from '../../../../server/video/timeline.js'

/** A sweep fine enough that a window 0.12 wide cannot hide between two samples. */
const sweep = (steps = 400) => Array.from({ length: steps + 1 }, (_, i) => i / steps)

describe('the clock an interface gesture runs on', () => {
  it('is nothing at all while the block is still off screen', () => {
    for (const life of sweep(20)) expect(controlClock(0, life)).toBe(0)
  })

  it('is the scene’s own clock once the arrival is complete', () => {
    for (const life of sweep(20)) expect(controlClock(1, life)).toBe(life)
  })

  /**
   * The property every beat below depends on: a block ranked last still gets a
   * clock that reaches the end of its scene, so an exit written at 0.96 happens
   * inside the film rather than after it.
   */
  it('reaches exactly 1 on the last frame, however late the block was ranked', () => {
    expect(controlClock(1, 1)).toBe(1)
  })

  it('never runs backwards over a scene', () => {
    const duration = 90
    const cue = 24
    let previous = -1
    for (let frame = 0; frame < duration; frame += 1) {
      const at = controlClock(cueProgress(frame, cue), frame / (duration - 1))
      expect(at).toBeGreaterThanOrEqual(previous)
      previous = at
    }
  })

  it('reads its two numbers as hostile, like everything else off a document', () => {
    expect(controlClock(undefined, 0.5)).toBe(0)
    expect(controlClock(Number.NaN, 0.5)).toBe(0)
    expect(controlClock(4, 4)).toBe(1)
    expect(controlClock(-1, 0.5)).toBe(0)
  })
})

describe('the settle, which is why nothing in this family freezes', () => {
  it('is a third of the drift the whole stack already rides, derived and not chosen', () => {
    expect(REST_CREEP * 3).toBeCloseTo(COMPOSED_BLOCK_DRIFT, 12)
  })

  /**
   * The claim that keeps a band off the safe margin: the residual is a distance
   * still to travel, never a distance already travelled past. A settle that
   * overshot would put a full-measure band a few pixels outside the box
   * `composedSafeArea` measured, on the anchors that sit against an edge.
   */
  it('only ever approaches the mark: positive, decreasing, and zero at the end', () => {
    let previous = Number.POSITIVE_INFINITY
    for (const clock of sweep()) {
      const offset = restOffset(clock)
      expect(offset).toBeGreaterThanOrEqual(0)
      expect(offset).toBeLessThanOrEqual(REST_CREEP)
      expect(offset).toBeLessThan(previous)
      previous = offset
    }
    expect(restOffset(1)).toBe(0)
  })
})

describe('the button', () => {
  it('is pressed once, inside its own window, and leaves it where it entered it', () => {
    expect(buttonPress(0)).toBe(0)
    expect(buttonPress(BUTTON_PRESS_AT)).toBe(0)
    expect(buttonPress(BUTTON_PRESS_AT + BUTTON_PRESS_SPAN)).toBe(0)
    expect(buttonPress(1)).toBe(0)
    // One hump: nothing before, nothing after, deepest in the middle.
    expect(buttonPress(BUTTON_PRESS_AT + BUTTON_PRESS_SPAN / 2)).toBeCloseTo(1, 12)
    for (const at of sweep()) {
      if (at <= BUTTON_PRESS_AT || at >= BUTTON_PRESS_AT + BUTTON_PRESS_SPAN) expect(buttonPress(at)).toBe(0)
    }
  })

  /**
   * A pill larger than its mark is a pill whose ink was measured on a box it is
   * not the size of, and on the four anchors that sit against an edge it is a
   * pill past the margin. `buttonScale` is an approach and a subtraction for
   * exactly that reason, and this is the assertion that keeps it one.
   */
  it('never grows past its mark, on any frame, pressed or not', () => {
    for (const progress of sweep(60)) {
      for (const clock of sweep(60)) {
        expect(buttonScale(progress, clock, true)).toBeLessThanOrEqual(1)
        expect(buttonScale(progress, clock, false)).toBeLessThanOrEqual(1)
      }
    }
  })

  it('comes from below its mark and lands on it exactly at the cut', () => {
    expect(buttonScale(0, 0, true)).toBeCloseTo(BUTTON_ENTER_SCALE * (1 - REST_CREEP), 12)
    expect(buttonScale(1, 1, true)).toBe(1)
    expect(buttonScale(1, 1, false)).toBe(1)
  })

  it('presses only when the document asked for it, and only there', () => {
    const inside = BUTTON_PRESS_AT + BUTTON_PRESS_SPAN / 2
    expect(buttonScale(1, inside, true)).toBeLessThan(buttonScale(1, inside, false))
    for (const clock of sweep()) {
      if (clock <= BUTTON_PRESS_AT || clock >= BUTTON_PRESS_AT + BUTTON_PRESS_SPAN) {
        expect(buttonScale(1, clock, true)).toBe(buttonScale(1, clock, false))
      }
    }
  })
})

describe('the form', () => {
  it('has nothing to say about a form with no fields', () => {
    expect(formCadence(0, 0.5)).toEqual({ fields: [], caret: -1, submit: 0 })
  })

  it('starts empty and ends filled, for every field count the schema allows', () => {
    for (let count = 1; count <= 4; count += 1) {
      const empty = formCadence(count, 0)
      expect(empty.fields).toEqual(Array.from({ length: count }, () => 0))
      expect(empty.caret).toBe(0)
      expect(empty.submit).toBe(0)

      const done = formCadence(count, 1)
      expect(done.fields).toEqual(Array.from({ length: count }, () => 1))
      expect(done.caret).toBe(-1)
      expect(done.submit).toBe(1)
    }
  })

  /**
   * One at a time, which is the whole difference between a form being filled in
   * and a marquee. A row is at zero until the one above it is at one, and that is
   * also what makes the dimmed row in `form.jsx` safe: reduced opacity only ever
   * lands on a row with no glyph in it.
   */
  it('fills its fields one after another, never two at once', () => {
    for (let count = 2; count <= 4; count += 1) {
      for (const clock of sweep()) {
        const { fields } = formCadence(count, clock)
        for (let i = 1; i < count; i += 1) {
          if (fields[i] > 0) expect(fields[i - 1], `field ${i} at ${clock}`).toBe(1)
        }
      }
    }
  })

  /**
   * "The button activates at the END", held to the letter. A submit that lights
   * while a field is still filling is a form whose control does not mean
   * anything — and the sequence is arithmetic, so it is a claim rather than a
   * hope about two constants that happen to be ordered today.
   */
  it('lights its submit only once every field is full', () => {
    for (let count = 1; count <= 4; count += 1) {
      for (const clock of sweep()) {
        const { fields, submit } = formCadence(count, clock)
        if (submit > 0) expect(fields.every((typed) => typed === 1), `count ${count} at ${clock}`).toBe(true)
      }
      expect(formCadence(count, FORM_FILLED_BY).submit).toBe(0)
    }
  })

  it('puts the caret in the first row that is not full, and takes it away when there is none', () => {
    for (const clock of sweep(200)) {
      const { fields, caret } = formCadence(4, clock)
      if (caret === -1) expect(fields.every((typed) => typed === 1)).toBe(true)
      else {
        expect(fields[caret]).toBeLessThan(1)
        for (let i = 0; i < caret; i += 1) expect(fields[i]).toBe(1)
      }
    }
  })

  it('never un-types a field', () => {
    let previous = [0, 0, 0, 0]
    for (const clock of sweep()) {
      const { fields } = formCadence(4, clock)
      fields.forEach((typed, i) => expect(typed).toBeGreaterThanOrEqual(previous[i]))
      previous = fields
    }
  })

})

describe('the notification', () => {
  it('holds until its window, then leaves before the cut rather than on it', () => {
    for (const clock of sweep()) {
      if (clock <= NOTICE_LEAVES_AT) expect(noticeExit(clock)).toBe(0)
      if (clock >= NOTICE_GONE_BY) expect(noticeExit(clock)).toBe(1)
    }
    expect(NOTICE_GONE_BY).toBeLessThan(1)
    expect(noticeExit(1)).toBe(1)
  })

  it('never re-enters: the departure only ever advances', () => {
    let previous = -1
    for (const clock of sweep()) {
      const exit = noticeExit(clock)
      expect(exit).toBeGreaterThanOrEqual(previous)
      previous = exit
    }
  })

  /**
   * The direction is read off `anchorCell`, so a card cannot slide out of the
   * frame's left edge while sitting against its right — the disagreement two
   * tables always produce, on the anchor nobody wrote a fixture for.
   */
  it('leaves by the edge it is anchored to, on every anchor the schema has', () => {
    for (const anchor of ANCHORS) {
      const { x, y } = noticeSlide(anchor)
      expect(Math.abs(x) + Math.abs(y), anchor).toBe(1)
      if (anchor.endsWith('-left')) expect([x, y], anchor).toEqual([-1, 0])
      if (anchor.endsWith('-right')) expect([x, y], anchor).toEqual([1, 0])
    }
    expect(noticeSlide('top-center')).toEqual({ x: 0, y: -1 })
    expect(noticeSlide('bottom-center')).toEqual({ x: 0, y: 1 })
    // A card in a centred column has no edge of its own and comes from above,
    // which is where a system notice has always come from.
    expect(noticeSlide('center')).toEqual({ x: 0, y: -1 })
    expect(noticeSlide('full')).toEqual({ x: 0, y: -1 })
    // And an anchor off a document that this build does not know is `center`,
    // once, in `anchorName` — never a second normalisation here.
    expect(noticeSlide('constructor')).toEqual(noticeSlide('center'))
    expect(noticeSlide(undefined)).toEqual(noticeSlide('center'))
  })

  it('gives the mark a pulse that swings both ways and stays bounded', () => {
    for (const life of sweep()) {
      expect(markSwing(life)).toBeGreaterThanOrEqual(-1)
      expect(markSwing(life)).toBeLessThanOrEqual(1)
    }
    expect(markSwing(0)).toBeCloseTo(0, 12)
  })
})

describe('the lower third', () => {
  it('is closed before it arrives, open through its hold, and closed again before the cut', () => {
    expect(bandWidth(0, 0)).toBe(0)
    expect(bandWidth(1, BAND_LEAVES_AT)).toBe(1)
    expect(bandWidth(1, BAND_GONE_BY)).toBe(0)
    expect(bandWidth(1, 1)).toBe(0)
    for (const clock of sweep()) {
      if (clock <= BAND_LEAVES_AT) expect(bandWidth(1, clock)).toBe(1)
    }
  })

  it('leaves later than a notification does, because it is also the outro', () => {
    expect(BAND_LEAVES_AT).toBeGreaterThan(NOTICE_LEAVES_AT)
    expect(bandExit(BAND_LEAVES_AT)).toBe(0)
    expect(bandExit(1)).toBe(1)
  })

  /**
   * The type rises from behind the band and starts INSIDE the wipe: a window on
   * the same arrival, not a second cue. A title that rose with the wipe would be
   * a title travelling across the frame in the open.
   */
  it('reveals its type from behind the band, after the band exists', () => {
    expect(bandReveal(0)).toBe(0)
    expect(bandReveal(BAND_TEXT_FROM)).toBe(0)
    expect(bandReveal(1)).toBe(1)
    expect(bandReveal(1, BAND_SUBTITLE_FROM)).toBe(1)
    // The subtitle follows the title rather than arriving with it.
    for (const progress of sweep()) {
      if (progress > 0 && progress < 1) {
        expect(bandReveal(progress, BAND_SUBTITLE_FROM)).toBeLessThanOrEqual(bandReveal(progress))
      }
    }
    expect(bandReveal(0.5, 1)).toBe(0.5)
  })
})

/**
 * The question the whole file is here for, asked the way
 * `tests/video-motion.test.js` asks it of a scene: not "did this block move" but
 * "is there any pair of consecutive frames it did not move between".
 *
 * The two scenes are the two ends of what the schema accepts, and the second one
 * is the one that catches a frozen block: on a 15 s scene a control reaches its
 * mark inside the first second and has fourteen left to hold still in.
 */
describe('nothing in this family holds still', () => {
  const vectors = {
    button: (progress, life) => [buttonScale(progress, controlClock(progress, life), true)],
    'button, unpressed': (progress, life) => [buttonScale(progress, controlClock(progress, life), false)],
    form: (progress, life) => {
      const clock = controlClock(progress, life)
      const { fields, submit } = formCadence(3, clock)
      return [...fields, submit, restOffset(clock)]
    },
    notification: (progress, life) => {
      const clock = controlClock(progress, life)
      return [progress, noticeExit(clock), markSwing(life), restOffset(clock)]
    },
    'notification, no mark': (progress, life) => {
      const clock = controlClock(progress, life)
      return [progress, noticeExit(clock), restOffset(clock)]
    },
    lowerThird: (progress, life) => {
      const clock = controlClock(progress, life)
      return [bandWidth(progress, clock), bandReveal(progress), restOffset(clock)]
    },
  }

  /**
   * The worst cue a block can be handed, and it is worth pinning rather than
   * assuming: eight blocks on the shortest legal scene is the one case where
   * `cueFrames` compresses, and the last of them arrives with a third of its
   * scene left.
   */
  const cramped = layerCues(Array.from({ length: 8 }, () => ({})), 45)

  const scenes = [
    { name: 'the shortest scene the schema accepts, with the last of eight blocks on it', duration: 45, cue: cramped[7] },
    { name: 'the longest scene the schema accepts, with a block on the first cue', duration: 450, cue: 2 },
  ]

  for (const [name, vector] of Object.entries(vectors)) {
    for (const scene of scenes) {
      it(`${name} moves on every frame of ${scene.name}`, () => {
        let previous = null
        for (let frame = scene.cue; frame < scene.duration; frame += 1) {
          const at = vector(cueProgress(frame, scene.cue), frame / (scene.duration - 1))
          if (previous) {
            const moved = at.some((value, i) => value !== previous[i])
            expect(moved, `frame ${frame} of ${scene.duration} is the frame before it`).toBe(true)
          }
          previous = at
        }
      })
    }
  }

  it('places that worst cue where the arrival still finishes inside its scene', () => {
    expect(cramped[7] + CUE_ENTER_FRAMES).toBeLessThan(45)
  })
})

/**
 * And the other half, which the arithmetic cannot reach: the components
 * themselves, rendered.
 *
 * `blocks.test.js` reads these four files as TEXT and can therefore only ask
 * whether a hex value was typed into one. The failure that shipped a dark green
 * headline on a near-black frame was not a hex value typed anywhere — it was a
 * colour arriving through a prop nobody had measured — so the question worth
 * asking is about the OUTPUT: is every colour in the painted markup one the
 * palette resolved?
 *
 * It is askable at all because nothing in this directory imports `remotion`. That
 * rule was written so the registry could be checked in Mocky's own suite; this is
 * the second thing it buys, and it also means a crash in one of these components
 * fails here rather than thirty seconds into a render inside Chromium.
 */
describe('what the four of them actually paint', () => {
  const THEME = resolveTheme({
    colors: { background: '#101014', text: '#f4f4f6', surface: '#1d1d24', accent: '#7f5af0' },
    fonts: { heading: 'Inter', body: 'Inter' },
    radiusPx: 10,
  })
  const PALETTE = composedPalette(THEME)
  const BASE = 1080

  /** Every colour the palette resolved, at any depth: the whole of what a block may paint with. */
  const allowed = new Set()
  const collect = (value) => {
    if (typeof value === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(value)) allowed.add(value.toLowerCase())
    else if (Array.isArray(value)) value.forEach(collect)
    else if (value && typeof value === 'object') Object.values(value).forEach(collect)
  }
  collect(PALETTE)

  const parse = (input) => BlockSchema.parse(input)
  const at = [
    { progress: 0, life: 0 },
    { progress: 0.5, life: 0.2 },
    { progress: 1, life: 0.5 },
    { progress: 1, life: 0.9 },
    { progress: 1, life: 1 },
  ]

  const paint = (Component, block, frame) =>
    renderToStaticMarkup(
      createElement(Component, { block, palette: PALETTE, theme: THEME, base: BASE, images: {}, ...frame }),
    )

  const cases = [
    ['button, filled', Button, { kind: 'button', label: 'Start the trial' }],
    ['button, outline', Button, { kind: 'button', label: 'Read the notes', variant: 'outline', press: false }],
    ['form', Form, { kind: 'form', title: 'Create an account', fields: ['Name', 'Email', 'Password'], submit: 'Create' }],
    ['form, bare', Form, { kind: 'form', fields: ['Email'] }],
    ['notification, dot', Notification, { kind: 'notification', title: 'Deployed', body: 'Two minutes ago.' }],
    ['notification, tick', Notification, { kind: 'notification', title: 'Saved', mark: 'check', anchor: 'top-right' }],
    ['notification, bell', Notification, { kind: 'notification', title: 'Reminder', mark: 'bell', anchor: 'bottom-left' }],
    ['notification, bare', Notification, { kind: 'notification', title: 'Nothing to report', mark: 'none' }],
    ['lowerThird', LowerThird, { kind: 'lowerThird', title: 'Ada Lovelace', subtitle: 'Analyst' }],
    ['lowerThird, right', LowerThird, { kind: 'lowerThird', title: 'Ada Lovelace', side: 'right' }],
  ]

  for (const [name, Component, input] of cases) {
    it(`${name} paints only colours the palette resolved`, () => {
      const block = parse(input)
      for (const frame of at) {
        const markup = paint(Component, block, frame)
        for (const hex of markup.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []) {
          expect(allowed.has(hex.toLowerCase()), `${name} at ${JSON.stringify(frame)} painted ${hex}`).toBe(true)
        }
        // A palette key spelt wrong reads back `undefined`, and React drops the
        // declaration rather than throwing — a block drawn in the browser's own
        // default colour, which is exactly the failure this whole file is about.
        expect(markup, name).not.toContain('undefined')
      }
    })

    /**
     * The lines the document wrote, and only those: an enum value is a treatment
     * and never a word on the frame. A block that dropped its subtitle would
     * render perfectly and deliver a film missing the thing it was cut for, which
     * is the failure the whole `.strict()` discipline is about, one layer in.
     */
    it(`${name} still has its words in the frame once the scene is under way`, () => {
      const block = parse(input)
      const markup = paint(Component, block, { progress: 1, life: 0.78 })
      const lines = [block.label, block.title, block.subtitle, block.body, block.submit, ...(block.fields ?? [])]
      for (const line of lines) if (typeof line === 'string') expect(markup, `${name}: ${line}`).toContain(line)
    })
  }

  /**
   * The one geometric claim the markup can answer: the submit is TWO controls in
   * one box, and the box has to be the same box. Different padding on the two
   * layers would slide every glyph sideways as the sweep crosses it.
   */
  it('sweeps the form’s submit across one box and not two', () => {
    const markup = paint(Form, parse({ kind: 'form', fields: ['Email'], submit: 'Create' }), { progress: 1, life: 0.95 })
    expect(markup.match(/clip-path:inset\(/g) ?? []).toHaveLength(1)
    expect(markup.match(/>Create</g) ?? []).toHaveLength(2)
  })
})
