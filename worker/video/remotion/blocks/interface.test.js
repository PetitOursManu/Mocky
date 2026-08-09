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
  NOTICE_TRAVEL,
  PANEL_SEPARATION,
  REST_CREEP,
  bandExit,
  bandGeometry,
  bandReveal,
  bandWidth,
  buttonGeometry,
  buttonPress,
  buttonScale,
  constantMetric,
  controlClock,
  formCadence,
  formGeometry,
  markSwing,
  noticeExit,
  noticeGeometry,
  noticeSlide,
  noticeTravel,
  panelEdge,
  panelInks,
  restOffset,
} from './interface.js'
import {
  ANCHORS,
  COMPOSED_BLOCK_DRIFT,
  CONSTANT_CEILING,
  CUE_ENTER_FRAMES,
  DIMENSIONS,
  blockExtent,
  composedLayout,
  composedPalette,
  contrastRatio,
  cueProgress,
  frameBase,
  layerCues,
  resolveTheme,
  surfaceRange,
  typeSize,
  worstRatio,
} from '../composition.js'
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
import { BLOCK_LIMITS, BlockSchema } from '../../../../server/video/timeline.js'

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

  /**
   * The box and the unit a block would really be handed, off the layout itself.
   *
   * Not a plausible rectangle: `composedLayout` is what divides a zone by
   * appetite and solves the stack's type unit, and a component fed a box nothing
   * computed is a component tested against a picture rather than against the
   * contract. It is also the cheapest way to keep these fixtures honest when the
   * weight table moves.
   */
  const laid = (block, ratio = '16:9') => {
    const { width, height } = DIMENSIONS[ratio]
    const [zone] = composedLayout({ layers: [block] }, width, height).zones
    return { box: zone.layers[0].box, unit: zone.layers[0].unit, base: frameBase(width, height) }
  }

  const paint = (Component, block, frame, where = laid(block)) =>
    renderToStaticMarkup(
      createElement(Component, {
        block,
        palette: PALETTE,
        theme: THEME,
        images: {},
        box: where.box,
        unit: where.unit,
        base: where.base ?? BASE,
        ...frame,
      }),
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

// ── A block inhabits the box it is given ────────────────────────────────────
//
// The defect a reading of six real exports named, in this family's own words: a
// pill was `base * 0.03` of type inside `base * 0.018` of padding and a card was
// `base * 0.56` wide, whether the zone was a third of a portrait column or the
// whole safe area. Every scene was a small element floating in a large void.
//
// Three claims, and each one fails a fraction of the frame however plausible the
// picture it drew: what the four of them draw IS the box they were handed; it
// stays inside it; and doubling the box doubles it while the frame stays put.

const parseBlock = (input) => BlockSchema.parse(input)
const filler = (n) => 'Mot '.repeat(Math.ceil(n / 4)).slice(0, n).trim()

/** The poorest and the longest legal block of each of the four, at the schema's own bounds. */
const POOREST = {
  button: parseBlock({ kind: 'button', label: 'Go' }),
  form: parseBlock({ kind: 'form', fields: ['Nom'] }),
  notification: parseBlock({ kind: 'notification', title: 'Ok', mark: 'none' }),
  lowerThird: parseBlock({ kind: 'lowerThird', title: 'Ada' }),
}
const LONGEST = {
  button: parseBlock({ kind: 'button', label: filler(BLOCK_LIMITS.buttonLabel) }),
  form: parseBlock({
    kind: 'form',
    title: filler(BLOCK_LIMITS.formTitle),
    fields: Array.from({ length: BLOCK_LIMITS.formFields }, () => filler(BLOCK_LIMITS.formField)),
    submit: filler(BLOCK_LIMITS.formSubmit),
  }),
  notification: parseBlock({
    kind: 'notification',
    title: filler(BLOCK_LIMITS.noticeTitle),
    body: filler(BLOCK_LIMITS.noticeBody),
    mark: 'bell',
  }),
  lowerThird: parseBlock({
    kind: 'lowerThird',
    title: filler(BLOCK_LIMITS.lowerTitle),
    subtitle: filler(BLOCK_LIMITS.lowerSubtitle),
  }),
}

const KINDS = ['button', 'form', 'notification', 'lowerThird']
const GEOMETRY = {
  button: buttonGeometry,
  form: formGeometry,
  notification: noticeGeometry,
  lowerThird: bandGeometry,
}
/** The two the weight table puts in the `both` row: a panel owes its box both axes. */
const PANELS = new Set(['form', 'notification'])

/** Every shape a zone can turn out to be, in all three ratios — the same sweep `blockExtent` gets. */
const SHAPES = []
for (const [ratio, { width, height }] of Object.entries(DIMENSIONS)) {
  const base = frameBase(width, height)
  const safe = { left: 0, top: 0, width: Math.round(width * 0.88), height: Math.round(height * 0.88) }
  SHAPES.push([`${ratio} whole`, safe, base])
  SHAPES.push([`${ratio} band`, { ...safe, height: Math.round(safe.height / 3) }, base])
  SHAPES.push([`${ratio} cell`, { ...safe, width: Math.round(safe.width / 3), height: Math.round(safe.height / 3) }, base])
  SHAPES.push([`${ratio} strip`, { ...safe, width: Math.round(safe.width / 3), height: Math.round(safe.height / 8) }, base])
}

describe('the box a block of this family is given, and what it draws in it', () => {
  /**
   * The claim itself, against the layout that hands out the boxes.
   *
   * `composedLayout` divides a zone by appetite and solves one type unit for the
   * stack; these four then answer for one box each. The two computations come
   * from opposite directions and have to agree, which is what would catch this
   * family drifting from the weight table that sized its allotment — the exact
   * shape of the defect, since `BLOCK_APPETITE` is where "a notification is a
   * title, a line and 1.6 units of card" is written down.
   */
  it('draws exactly the box `composedLayout` gave it, in every ratio', () => {
    for (const [ratio, { width, height }] of Object.entries(DIMENSIONS)) {
      const base = frameBase(width, height)
      for (const corpus of [POOREST, LONGEST]) {
        for (let count = 1; count <= KINDS.length; count += 1) {
          for (let seed = 0; seed < KINDS.length; seed += 1) {
            const layers = Array.from({ length: count }, (_, i) => corpus[KINDS[(seed + i) % KINDS.length]])
            for (const zone of composedLayout({ layers }, width, height).zones) {
              for (const { block, box, unit } of zone.layers) {
                const drawn = GEOMETRY[block.kind](block, box, base, unit)
                const where = `${ratio} ${block.kind} in a stack of ${count}`
                // The height, whole, on all four: the box IS the allotment, and
                // a block that drew less than it would be the void this pass is
                // about, one level in.
                expect(drawn.height, where).toBe(box.height)
                expect(drawn.height, where).toBeCloseTo(blockExtent(block, box, base, unit).height, -0.5)
                if (PANELS.has(block.kind)) expect(drawn.width, where).toBe(box.width)
                else {
                  // A run of type owes its box whichever axis its own words
                  // reach — two letters cannot fill a landscape measure without
                  // being taller than the box — so what is asserted here is that
                  // it is at least the measure `blockExtent` predicted and never
                  // past the box.
                  expect(drawn.width, where).toBeGreaterThan(0)
                  expect(drawn.width, where).toBeLessThanOrEqual(box.width)
                  // To within one line of its own type, which is exactly what
                  // the difference is: `blockExtent` caps a run by the measure
                  // and this family caps it by the measure its padding leaves,
                  // so a label that already ran the measure comes back one
                  // floored type size under the extent's own answer.
                  expect(drawn.width + (drawn.size ?? drawn.title), where).toBeGreaterThanOrEqual(
                    blockExtent(block, box, base, unit).width,
                  )
                }
              }
            }
          }
        }
      }
    }
  })

  /**
   * And nothing it draws crosses that box.
   *
   * `content` is what each geometry says it needs — the runs at the size it
   * solved, plus its own furniture — so this is the padding question asked
   * arithmetically: a card that spends 130 px of measure on padding wraps a line
   * the box was never sized for, which is `fitUnit`'s whole reason to exist.
   * Swept over both ends of the schema and every shape a zone can be, with and
   * without a stack's unit, because the lone block in a big box and the block in
   * a strip fail it in opposite directions.
   */
  it('keeps what it draws inside the box, at both ends of the schema', () => {
    for (const corpus of [POOREST, LONGEST]) {
      for (const kind of KINDS) {
        for (const [where, box, base] of SHAPES) {
          for (const unit of [undefined, typeSize('body', 40)]) {
            const drawn = GEOMETRY[kind](corpus[kind], box, base, unit)
            const at = `${kind} @ ${where}${unit ? ' in a stack' : ' alone'}`
            expect(drawn.width, at).toBeLessThanOrEqual(box.width)
            expect(drawn.height, at).toBeLessThanOrEqual(box.height)
            if (drawn.content !== undefined) expect(drawn.content, at).toBeLessThanOrEqual(box.height)
            // A control has one line and no card around it, so its own check is
            // that the line fits the pill the box turned out to be.
            if (kind === 'button') expect(drawn.size * 1.4, at).toBeLessThanOrEqual(box.height)
          }
        }
      }
    }
  })

  /**
   * The property a fraction of the frame cannot have: double the box and the
   * stack's unit, hold the FRAME still, and everything doubles.
   *
   * `base` is deliberately the same number in both halves. A size read off it —
   * which is what all four of these files did — comes back identical rather than
   * doubled, so this is the assertion that would have failed before the pass and
   * the one that fails if somebody puts a fraction of the frame back.
   */
  it('doubles everything it draws when its box doubles, with the frame held still', () => {
    const base = frameBase(1920, 1080)
    for (const corpus of [POOREST, LONGEST]) {
      for (const kind of KINDS) {
        for (const [w, h] of [[900, 400], [500, 500], [320, 700]]) {
          const unit = 30
          const one = GEOMETRY[kind](corpus[kind], { left: 0, top: 0, width: w, height: h }, base, unit)
          const two = GEOMETRY[kind](corpus[kind], { left: 0, top: 0, width: w * 2, height: h * 2 }, base, unit * 2)
          for (const [term, value] of Object.entries(one)) {
            if (typeof value !== 'number' || value === 0) continue
            // The constant metrics are the exception, and the only one: a rule
            // 3 px thick under a heading in one scene and 6 px under a smaller
            // one in the next is two design systems in one film.
            if (term === 'border' || term === 'caret') {
              expect(two[term], `${kind} ${term} @ ${w}×${h}`).toBe(value)
              continue
            }
            // Double, to within rounding — and rounding is the whole reason the
            // claim is not an equality: a type size is an INTEGER number of
            // pixels, so twice a floored 17 is 34 and the doubled box's own
            // answer is 35. Either form of "within rounding" will do, because
            // what is being caught is a term that does not move at all: a
            // fraction of `base` comes back at a ratio of exactly 1.
            const drift = Math.abs(two[term] - 2 * value)
            const ratio = two[term] / value
            expect(drift <= 4 || Math.abs(ratio - 2) <= 0.1, `${kind} ${term} @ ${w}×${h} → ${ratio}`).toBe(true)
          }
        }
      }
    }
  })

  /**
   * The same question asked of the markup, which is the half the arithmetic
   * cannot reach: a component that computed a size correctly and then painted a
   * fraction of `base` anyway would pass everything above.
   */
  it('paints type that doubles with the box, in the four components themselves', () => {
    const theme = resolveTheme({ colors: { background: '#101014', text: '#f4f4f6', accent: '#7f5af0' } })
    const palette = composedPalette(theme)
    const base = frameBase(1920, 1080)
    const sizes = (markup) => (markup.match(/font-size:(\d+(?:\.\d+)?)px/g) ?? []).map((hit) => Number(hit.slice(10, -2)))
    const components = { button: Button, form: Form, notification: Notification, lowerThird: LowerThird }

    for (const kind of KINDS) {
      const draw = (box, unit) =>
        renderToStaticMarkup(
          createElement(components[kind], {
            block: LONGEST[kind],
            palette,
            theme,
            box,
            unit,
            base,
            images: {},
            progress: 1,
            life: 0.5,
          }),
        )
      const one = sizes(draw({ left: 0, top: 0, width: 700, height: 320 }, 26))
      const two = sizes(draw({ left: 0, top: 0, width: 1400, height: 640 }, 52))
      expect(one.length, kind).toBeGreaterThan(0)
      expect(two.length, kind).toBe(one.length)
      one.forEach((size, i) => expect(two[i] / size, `${kind} run ${i}`).toBeCloseTo(2, 1))
    }
  })

  /** The exception, bounded: a radius wider than a quarter of its row is a lozenge, not a card. */
  it('bounds a constant metric inside the box it is drawn in', () => {
    expect(constantMetric(12, { width: 900, height: 400 })).toBe(12)
    expect(constantMetric(12, { width: 900, height: 20 })).toBe(Math.floor(20 * CONSTANT_CEILING))
    // A direction that states a square corner has stated one: rounding it up to
    // a pixel would be the layout overruling the document.
    expect(constantMetric(0, { width: 900, height: 400 })).toBe(0)
    expect(constantMetric(undefined, { width: 900, height: 400 })).toBe(0)
  })

  /** An amplitude belongs to the thing that moves, not to the frame it moves in. */
  it('travels a share of its own box and not of the film', () => {
    expect(noticeTravel({ width: 800, height: 400 })).toBeCloseTo(400 * NOTICE_TRAVEL, 6)
    expect(noticeTravel({ width: 200, height: 400 })).toBeCloseTo(200 * NOTICE_TRAVEL, 6)
    expect(noticeTravel(undefined)).toBe(0)
  })
})

/**
 * A panel has to be SEEN, and that is arithmetic too.
 *
 * The export that named it: on a light direction — surface `#ffffff` over a
 * background `#f7f5f0` — a notification had neither border nor shadow, so the
 * card was invisible and the notice read as a rectangle of text floating on the
 * frame. Every run on it had been measured against the panel and nothing had
 * asked whether the panel itself could be told apart from what it sits on.
 */
describe('a panel is distinguished from the ground, and it is measured', () => {
  const directions = {
    'the light direction that shipped the defect': {
      colors: { background: '#f7f5f0', surface: '#ffffff', text: '#111111', accent: '#20796c' },
    },
    'a dark direction whose card is a shade of its ground': {
      colors: { background: '#101014', surface: '#1d1d24', text: '#f4f4f6', accent: '#7f5af0' },
    },
    'a direction whose surface is the far end of its own scale': {
      colors: { background: '#0b0b0d', surface: '#e9e9ef', text: '#111111', accent: '#e4572e' },
    },
    'a direction that stated nothing at all': {},
  }

  for (const [name, spec] of Object.entries(directions)) {
    it(`draws a rule on ${name} exactly when the value alone does not carry it`, () => {
      const palette = composedPalette(resolveTheme(spec))
      const edge = panelEdge(palette.panel, palette.ground, panelInks(palette))
      const apart = worstRatio(
        palette.panel.color,
        surfaceRange(palette.ground.color, palette.ground.alpha, palette.ground.tint),
      )
      // The two branches are one question: an edge exists when the card cannot
      // be told apart from the ground on its own value, and never otherwise —
      // drawing one always would undo the "trois niveaux de surface" the design
      // system asks for with an ornament.
      expect(edge === null, name).toBe(apart >= PANEL_SEPARATION)
      if (!edge) return
      // And it is visible from BOTH sides. A rule that clears only against the
      // ground is a card with a halo; one that clears only against the panel is
      // a rule nobody can see the outside of.
      const inside = contrastRatio(edge.color, palette.panel.color)
      const outside = worstRatio(
        edge.color,
        surfaceRange(palette.ground.color, palette.ground.alpha, palette.ground.tint),
      )
      expect(Math.min(inside, outside), `${name} ${edge.color}`).toBeGreaterThanOrEqual(PANEL_SEPARATION)
    })
  }

  /** It measures; it never invents. Every candidate is a colour the palette already resolved. */
  it('draws its rule in a colour the palette resolved', () => {
    const palette = composedPalette(resolveTheme(directions['the light direction that shipped the defect']))
    const edge = panelEdge(palette.panel, palette.ground, panelInks(palette))
    expect(panelInks(palette)).toContain(edge.color)
  })

  /**
   * And the card really carries it. The arithmetic above is only half the claim —
   * a component that never read `panelEdge` would pass every one of those.
   */
  it('puts that rule on the card the light direction made invisible', () => {
    const theme = resolveTheme(directions['the light direction that shipped the defect'])
    const palette = composedPalette(theme)
    const block = parseBlock({ kind: 'notification', title: 'Deployed', body: 'Two minutes ago.' })
    const markup = renderToStaticMarkup(
      createElement(Notification, {
        block,
        palette,
        theme,
        box: { left: 0, top: 0, width: 900, height: 320 },
        unit: 34,
        base: 1080,
        images: {},
        progress: 1,
        life: 0.5,
      }),
    )
    expect(markup).toContain('border:')
  })

  /**
   * Nothing clears on a mid-tone panel over a mid-tone ground, and the answer is
   * the most visible candidate rather than none: a faint edge is a card, and no
   * edge is the rectangle of text this whole section is about (Q1).
   */
  it('degrades to the most visible rule rather than to none', () => {
    const edge = panelEdge({ color: '#808080' }, { color: '#7d7d7d' }, ['#8a8a8a', '#000000'])
    expect(edge).not.toBeNull()
    expect(edge.color).toBe('#000000')
    expect(panelEdge({ color: '#808080' }, { color: '#7d7d7d' }, [])).toBeNull()
  })
})
