// The one block that sets type in three dimensions, as arithmetic.
//
// Everything here is a property a rendered frame would show and a unit test can
// prove without one: a title that left the box the layout gave it, a word cut in
// half, a line that turned by a whole period and came back on the phase it
// started on, and a word that arrived from in FRONT of the plane and was
// magnified through the edge of its own canvas.
//
// It imports `server/video/timeline.js` for the schema's own enums, exactly as
// `blocks.test.js` does and with the same rule: that import is TEST-ONLY. The
// Docker build copies `worker/video/` and nothing else, so a runtime import of
// anything under `server/` produces a container that boots and then fails every
// render on a missing module.
import { describe, it, expect } from 'vitest'
import {
  BLOCK_APPETITE,
  BOX_FILL_FLOOR,
  DIMENSIONS,
  blockExtent,
  composedSafeArea,
  frameBase,
  typeRole,
} from '../composition.js'
import { blockCanvas } from './canvases.js'
import {
  SPATIAL_CAMERA_Z,
  SPATIAL_DEPTHS,
  SPATIAL_ENTER_DEPTH,
  SPATIAL_FOV,
  SPATIAL_GLYPH_BOX,
  SPATIAL_GROUPS,
  SPATIAL_HALF,
  SPATIAL_KEYSTONE_MAX,
  SPATIAL_LAYERS,
  SPATIAL_RELIEF_FLOOR,
  SPATIAL_REST_PITCH_DEG,
  SPATIAL_REST_YAW_DEG,
  SPATIAL_NO_SHADE,
  SPATIAL_SHADE_FLOOR,
  spatialShade,
  SPATIAL_ROLES,
  SPATIAL_ROOM,
  SPATIAL_SWAY_FLOOR,
  spatialDepthShare,
  spatialExtent,
  spatialGroupEnter,
  spatialGroupTurn,
  spatialGroups,
  spatialLayout,
  spatialLinePitch,
  spatialLineTurn,
  spatialMoved,
  spatialRelief,
  spatialRestTurn,
  spatialRole,
  spatialFloat,
  spatialSize,
  spatialSpin,
} from './spatialType.js'
import { BLOCK_LIMITS, EXTRUDED_DEPTHS, EXTRUDED_SPINS } from '../../../../server/video/timeline.js'

const line = (text, over = {}) => ({ kind: 'extrudedType', text, level: 'display', depth: 'medium', spin: 'sway', ...over })

/** Words rather than a repeated letter, for the reason `composition.test.js` gives. */
const filler = (n) => 'Mot '.repeat(Math.ceil(n / 4)).slice(0, n).trim()

/** Every combination the schema can produce, at both ends of the text bound. */
const CORPUS = []
for (const level of ['display', 'title']) {
  for (const depth of EXTRUDED_DEPTHS) {
    for (const spin of EXTRUDED_SPINS) {
      for (const text of ['M', 'Go', filler(12), filler(BLOCK_LIMITS.extrudedType), 'A'.repeat(BLOCK_LIMITS.extrudedType)]) {
        CORPUS.push(line(text, { level, depth, spin }))
      }
    }
  }
}

/** Boxes of every shape a zone can turn out to be, in all three ratios. */
const SHAPES = []
for (const [ratio, { width, height }] of Object.entries(DIMENSIONS)) {
  const safe = composedSafeArea(width, height)
  SHAPES.push([`${ratio} whole`, safe, frameBase(width, height)])
  SHAPES.push([`${ratio} band`, { ...safe, height: Math.round(safe.height / 3) }, frameBase(width, height)])
  SHAPES.push([`${ratio} cell`, { ...safe, width: Math.round(safe.width / 3), height: Math.round(safe.height / 3) }, frameBase(width, height)])
  SHAPES.push([`${ratio} strip`, { ...safe, width: Math.round(safe.width / 3), height: Math.round(safe.height / 8) }, frameBase(width, height)])
}

describe('the schema and the arithmetic name the same things', () => {
  /**
   * A depth the schema offers and this file has no share for is a `medium`
   * extrusion drawn where the document asked for a deep one — silently, because
   * `spatialDepthShare` falls back rather than throwing (Q1). The fallback is
   * right and it must never be reached.
   */
  it('has a share for every depth the schema offers, and no others', () => {
    expect(Object.keys(SPATIAL_DEPTHS).sort()).toEqual([...EXTRUDED_DEPTHS].sort())
  })

  it('orders the three depths, so a name means what it says', () => {
    expect(SPATIAL_DEPTHS.shallow).toBeLessThan(SPATIAL_DEPTHS.medium)
    expect(SPATIAL_DEPTHS.medium).toBeLessThan(SPATIAL_DEPTHS.deep)
    // Past about four tenths of the type size the sides close over the counters
    // of the round letters at the turn, and the word stops being a word.
    expect(SPATIAL_DEPTHS.deep).toBeLessThanOrEqual(0.4)
  })

  /**
   * Every spin the schema offers moves something, and the block's own weight
   * table sets the same role this file solves against.
   */
  it('moves for every spin the schema offers', () => {
    for (const spin of EXTRUDED_SPINS) {
      expect(spatialMoved(line('Mocky', { spin }), 5, 0, 1), spin).toBe(true)
    }
  })

  it('sets the role its appetite budgeted for', () => {
    for (const level of ['display', 'title']) {
      const block = line('Mocky', { level })
      expect(BLOCK_APPETITE.extrudedType.runs(block)[0].role).toBe(spatialRole(block))
    }
    // A level this build does not know is a title card and not a caption: the
    // fallback has to be the loud one, since the block exists to be seen.
    expect(spatialRole({ level: 'subtitle' })).toBe(SPATIAL_ROLES.display)
    expect(spatialRole({ level: 'constructor' })).toBe(SPATIAL_ROLES.display)
    expect(spatialDepthShare('constructor')).toBe(SPATIAL_DEPTHS.medium)
  })

  /**
   * The run is unbreakable, and that is the whole of "a word is not cut in half"
   * for this block. `cappedByWidth` bounds an unbreakable run by its WHOLE length
   * across the measure, which is stricter than `wordCeiling`'s longest word by
   * definition — so there is no wrap for a browser to fall back on and no
   * `word-break` for `blocks.test.js` to require.
   */
  it('declares its run unbreakable, which is what keeps a word whole', () => {
    expect(BLOCK_APPETITE.extrudedType.runs(line('Mot mot')).every((run) => run.nowrap)).toBe(true)
  })
})

describe('an extruded line inhabits the box it is given', () => {
  it('draws nothing outside its box, at either end of what the schema allows', () => {
    for (const block of CORPUS) {
      for (const [where, box] of SHAPES) {
        const drawn = spatialExtent(block, box)
        expect(drawn.width, `${block.text.length}/${block.depth}/${block.spin} @ ${where}`).toBeLessThanOrEqual(box.width + 1)
        expect(drawn.height, `${block.text.length}/${block.depth}/${block.spin} @ ${where}`).toBeLessThanOrEqual(box.height + 1)
      }
    }
  })

  /**
   * And the canvas is inside it too, which is a second claim rather than the
   * same one: the drawing is what the type takes, the canvas is what the GL
   * context covers, and a context larger than its box paints over the zone next
   * door with a layer nothing in the layout accounted for.
   */
  it('opens a canvas inside its box, at whole pixels', () => {
    for (const block of CORPUS) {
      for (const [where, box, base] of SHAPES) {
        const canvas = blockCanvas(block, box, base)
        expect(canvas, where).not.toBeNull()
        expect(canvas.width, where).toBeLessThanOrEqual(box.width)
        expect(canvas.height, where).toBeLessThanOrEqual(box.height)
        expect(Number.isInteger(canvas.width) && canvas.width >= 1, where).toBe(true)
        expect(Number.isInteger(canvas.height) && canvas.height >= 1, where).toBe(true)
        expect(canvas.camera.fov).toBe(SPATIAL_FOV)
        expect(canvas.camera.position[2]).toBeCloseTo(SPATIAL_CAMERA_Z, 6)
      }
    }
  })

  /**
   * The drawing fills the canvas it asked for, which is what stops the block
   * paying render seconds for pixels nothing is painted on — the one currency
   * this family spends that a flat block does not.
   *
   * `BOX_FILL_FLOOR`, the same three quarters a block owes the box it was given.
   * It is not `SPATIAL_ROOM`: the canvas is sized before the projection is known
   * and the fit then gives back whatever the claim and the magnification took,
   * so a short word in a wide box really does leave a margin. Three quarters is
   * where that stops being a margin and starts being a canvas nobody paints on.
   */
  it('fills the canvas it opened', () => {
    for (const block of CORPUS) {
      for (const [where, box, base] of SHAPES) {
        const canvas = blockCanvas(block, box, base)
        const drawn = spatialExtent(block, box)
        const filled = Math.max(drawn.width / canvas.width, drawn.height / canvas.height)
        expect(filled, `${block.text.length}/${block.depth} @ ${where}`).toBeGreaterThanOrEqual(BOX_FILL_FLOOR)
      }
    }
  })

  /**
   * Double the box, double the drawing — the property that says a size came off
   * the box rather than off the frame, and the one a fraction of `base` fails
   * however plausible the picture it drew.
   *
   * Approximately and not exactly, unlike the flat blocks: two of the terms here
   * are `Math.round`ed pixel counts that the world scale then divides, so the
   * ratio carries a rounding the flat estimate does not have. A tenth of a per
   * cent is three orders of magnitude away from the defect this catches, which is
   * a term that did not scale at all.
   */
  it('draws twice as much in twice the box', () => {
    for (const block of CORPUS) {
      for (const [w, h] of [[600, 200], [900, 300], [420, 640]]) {
        const one = spatialExtent(block, { left: 0, top: 0, width: w, height: h })
        const two = spatialExtent(block, { left: 0, top: 0, width: w * 2, height: h * 2 })
        expect(two.width / one.width, `${block.text.length} @ ${w}x${h}`).toBeCloseTo(2, 1)
        expect(two.height / one.height, `${block.text.length} @ ${w}x${h}`).toBeCloseTo(2, 1)
      }
    }
  })

  /**
   * A longer line is set smaller, because it cannot wrap. That is the trade the
   * schema's bound of 24 characters was chosen against, and it is the reason the
   * block refuses a sentence: at the far end of the bound a full-frame title is
   * already down to a size where the thickness is a few pixels.
   */
  it('sets a longer line smaller, since it has no second line to give', () => {
    const box = composedSafeArea(1920, 1080)
    const short = spatialSize(line('Motion'), box)
    const long = spatialSize(line(filler(BLOCK_LIMITS.extrudedType)), box)
    expect(long).toBeLessThan(short)
  })

  /**
   * What it draws agrees with what `blockExtent` claims for the kind, which is
   * the contract every block in this directory is written against. It draws a
   * little LESS — the estimate carries `LINE_SAFETY` and the projection gives
   * some back — and it may never draw more.
   */
  it('agrees with the claim `blockExtent` makes for it', () => {
    for (const block of CORPUS) {
      for (const [where, box, base] of SHAPES) {
        const claimed = blockExtent(block, box, base)
        const drawn = spatialExtent(block, box)
        const label = `${block.text.length}/${block.depth}/${block.spin} @ ${where}`
        expect(drawn.width, label).toBeLessThanOrEqual(claimed.width + 1)
        expect(drawn.width / Math.max(1, claimed.width), label).toBeGreaterThanOrEqual(BOX_FILL_FLOOR)
      }
    }
  })

  /**
   * THE FURNITURE BUDGET COVERS THE PROJECTION, which is the inequality
   * `BLOCK_APPETITE.extrudedType.fixed` was chosen to satisfy.
   *
   * `stackIn` divided the zone on that number, so anything the block draws past
   * its own line box is height the layout did not allot it — the `funTitleHeadroom`
   * argument, arriving through a lens instead of through a padding. The first
   * version of `spatialExtent` added the WHOLE thickness to both axes and failed
   * this by a factor of three, which is what the comment in `spatialLayout` is
   * about.
   */
  it('draws its thickness inside the furniture its appetite reserved', () => {
    const budget = BLOCK_APPETITE.extrudedType.fixed
    for (const block of CORPUS) {
      for (const [where, box] of SHAPES) {
        const layout = spatialLayout(block, box)
        const unit = layout.size / typeRole(spatialRole(block)).step
        const past = spatialExtent(block, box).height - layout.lineHeight
        expect(past / unit, `${block.level}/${block.depth}/${block.spin} @ ${where}`).toBeLessThanOrEqual(budget)
      }
    }
  })
})

describe('nothing about it holds still', () => {
  /**
   * A film in which nothing moves must not be producible by accident, and this
   * family is where the accident is most likely to come back: `solidSpin` shipped
   * a cube spun exactly 2π that was pixel-identical at its first and last frame,
   * and a probe rendering three frames of it produced three byte-identical PNGs.
   *
   * The first and last frame of a scene are exactly what
   * `tests/video-motion.test.js` compares, so those are the two asked about here
   * — for every spin, and for a letter as well as for the line, since `roll`
   * moves the second and barely moves the first.
   */
  it('differs between the first and the last frame of a scene, for every spin', () => {
    for (const spin of EXTRUDED_SPINS) {
      const block = line('MOTION', { spin })
      expect(spatialMoved(block, 6, 0, 1), spin).toBe(true)
      // And in the middle of it, so a move that happened to return at the ends
      // is not the one that passes.
      expect(spatialMoved(block, 6, 0.25, 0.75), spin).toBe(true)
      expect(spatialMoved(block, 6, 0.4, 0.6), spin).toBe(true)
    }
  })

  /**
   * And between EVERY consecutive pair of a real scene, which three hand-picked
   * intervals cannot say.
   *
   * The three above are wide, and a wide interval is the one measurement a
   * stalled frame survives: every term here is a sine, a sine is flat at its own
   * turning point, and two of them summed can hold for a frame while differing
   * over any span that contains the turn. That is precisely the shape of
   * `solidSpin`'s three identical PNGs — none of which was the first frame or
   * the last.
   *
   * A hundred and twenty frames is four seconds at 30 fps, the shortest scene the
   * schema accepts and therefore the coarsest step a real film takes; the terms
   * are continuous in `life`, so a longer scene samples between these.
   */
  it('differs between every consecutive pair of frames, for every spin', () => {
    const frames = 120
    for (const spin of EXTRUDED_SPINS) {
      const block = line('MOTION', { spin })
      const held = []
      for (let i = 0; i < frames - 1; i += 1) {
        const a = i / (frames - 1)
        const b = (i + 1) / (frames - 1)
        if (!spatialMoved(block, 6, a, b)) held.push([a, b])
      }
      expect(held, `${spin} held still`).toEqual([])
    }
  })

  it('is not sitting at the middle of its own swing on the first frame', () => {
    for (const spin of EXTRUDED_SPINS) {
      const at = spatialSpin(spin, 0)
      expect(Math.abs(at.yaw) + Math.abs(at.pitch), spin).toBeGreaterThan(1e-3)
    }
  })

  /**
   * `float` is a wave travelling along the line and not a pulse: two words are
   * never on the same phase, which is what the lag buys.
   */
  it('floats its words one after another rather than together', () => {
    // Over the scene rather than at one instant: a sine crosses every value
    // twice, so two neighbouring words really are level with each other for one
    // frame out of a period. What a wave means is that they are not level for
    // the rest of it.
    for (let i = 1; i < SPATIAL_GROUPS; i += 1) {
      const spread = Array.from({ length: 40 }, (_, k) =>
        Math.abs(spatialFloat('float', i, k / 40) - spatialFloat('float', i - 1, k / 40)),
      )
      expect(Math.max(...spread), `words ${i - 1} and ${i}`).toBeGreaterThan(0.01)
    }
    // And the other two moves leave the words alone: a line that swayed AND
    // floated would be words breathing inside a swinging line.
    for (const spin of ['sway', 'tilt']) expect(spatialFloat(spin, 2, 0.3)).toBe(0)
    // Never in FRONT of the plane, which is the arrival's rule and not a
    // separate one: a word closer to the camera than the line it belongs to is
    // magnified past the canvas.
    for (let k = 0; k <= 60; k += 1) expect(spatialFloat('float', k % 3, k / 60)).toBeGreaterThanOrEqual(0)
  })

  /**
   * Every angle stays inside the band a word can be read at. Past about
   * twenty-five degrees the counters of the round letters close and the line is
   * a texture, which is the one thing this block may not become.
   */
  it('never turns a line past the angle a word can be read at', () => {
    for (const spin of EXTRUDED_SPINS) {
      for (let i = 0; i <= 100; i += 1) {
        const at = spatialSpin(spin, i / 100)
        expect(Math.abs(at.yaw), spin).toBeLessThanOrEqual(spatialLineTurn(spin))
        expect((Math.abs(at.yaw) + Math.abs(at.pitch)) * (180 / Math.PI), spin).toBeLessThanOrEqual(30)
      }
    }
    // And no move turns a WORD at rest, which is the whole reason the third one
    // is a depth: a resting rotation is a dilation on every contour of the frame
    // for the whole scene. See `spatialRestTurn`.
    for (const spin of EXTRUDED_SPINS) expect(spatialRestTurn(spin), spin).toBe(0)
  })

  /**
   * THE DEFECT THIS FAMILY WAS REPORTED FOR, AS ARITHMETIC.
   *
   * The swing is a sine, so before the resting attitude every move crossed zero
   * once a scene — and at that frame the extrusion is exactly behind the face and
   * the block draws a flat title with a coloured edge. Three crops of a real
   * export came back reading as a drop shadow, which is what `funTitle` draws
   * with a `text-shadow` and no renderer.
   *
   * The clip is in the sweep and it is the case that decides the floor: on the
   * widest line the schema can state the keystone bound takes the whole attitude
   * away, and what is left is the PITCH, which no bound on a measure touches.
   */
  it('never lets the extrusion close, on any move, on any frame, in any box', () => {
    for (const spin of EXTRUDED_SPINS) {
      for (const swing of [1, SPATIAL_SWAY_FLOOR]) {
        for (const rest of [1, 0.5, 0]) {
          let least = Infinity
          for (let i = 0; i <= 200; i += 1) least = Math.min(least, spatialRelief(spin, i / 200, { swing, rest }))
          expect(least, `${spin} @ swing ${swing} rest ${rest}`).toBeGreaterThanOrEqual(SPATIAL_RELIEF_FLOOR)
        }
      }
    }
    // And the ordinary line — nothing clipped — shows a good deal more than the
    // floor: about a fifth of its own thickness at rest and a third at the peak,
    // against the 12% peak and 0% trough of a line swinging around nothing.
    for (const spin of EXTRUDED_SPINS) {
      let least = Infinity
      let most = 0
      for (let i = 0; i <= 200; i += 1) {
        const at = spatialRelief(spin, i / 200)
        least = Math.min(least, at)
        most = Math.max(most, at)
      }
      expect(least, spin).toBeGreaterThan(0.12)
      expect(most, spin).toBeGreaterThan(0.2)
    }
  })

  /**
   * The attitude is an attitude and not a second swing: it is above every
   * amplitude on its own axis, so the line never comes square to the camera and
   * the pitch never levels. That is the whole mechanism, in two inequalities.
   */
  it('rests further from the camera’s axis than it swings', () => {
    for (const spin of EXTRUDED_SPINS) {
      expect(spatialLineTurn(spin), spin).toBeLessThanOrEqual(2 * SPATIAL_REST_YAW_DEG * (Math.PI / 180))
      expect(spatialLinePitch(spin), spin).toBeLessThanOrEqual(2 * SPATIAL_REST_PITCH_DEG * (Math.PI / 180))
      for (let i = 0; i <= 100; i += 1) {
        const at = spatialSpin(spin, i / 100)
        expect(at.yaw, spin).toBeGreaterThan(0)
        expect(at.pitch, spin).toBeGreaterThan(0)
        expect(Math.abs(at.pitch), spin).toBeLessThanOrEqual(spatialLinePitch(spin) + 1e-12)
      }
    }
  })

  /**
   * And the layout's two budgets do what they say: the MOVE keeps at least its
   * floor whatever the box, the attitude is what yields, and a line short enough
   * to have room gets both whole.
   */
  it('takes the attitude away before the move, when a box has no room for both', () => {
    const wide = spatialLayout(line('A'.repeat(BLOCK_LIMITS.extrudedType)), composedSafeArea(1920, 1080))
    const short = spatialLayout(line('Go'), composedSafeArea(1920, 1080))
    expect(wide.turn.swing).toBeGreaterThanOrEqual(SPATIAL_SWAY_FLOOR)
    expect(wide.turn.rest).toBeLessThan(short.turn.rest)
    expect(short.turn.rest).toBe(1)
    expect(short.turn.swing).toBe(1)
    for (const [name, box] of SHAPES) {
      for (const block of CORPUS) {
        const layout = spatialLayout(block, box)
        expect(layout.turn.swing, `${name} ${block.text.length}`).toBeGreaterThanOrEqual(SPATIAL_SWAY_FLOOR)
        expect(layout.turned).toBeLessThanOrEqual(spatialLineTurn(block.spin) + 1e-12)
      }
    }
  })
})

describe('the words arrive out of the depth, and only out of it', () => {
  /**
   * BEHIND, always, and it is the arrival's whole safety argument. A word
   * arriving from in FRONT of the plane is magnified by the camera on its first
   * frames, so it draws outside the box — the `funTitleHeadroom` lesson arriving
   * through a camera. A word arriving from behind is smaller than it ends up, so
   * every frame of the entrance is inside the frame the last one occupies and
   * there is nothing to reserve.
   */
  it('never brings a word in front of the plane it settles on', () => {
    for (let count = 1; count <= SPATIAL_GROUPS; count += 1) {
      for (let index = 0; index < count; index += 1) {
        for (let p = 0; p <= 20; p += 1) {
          const at = spatialGroupEnter(count, index, p / 20)
          expect(at.behind, `${index}/${count} @ ${p / 20}`).toBeGreaterThanOrEqual(0)
          expect(at.behind).toBeLessThanOrEqual(SPATIAL_ENTER_DEPTH)
        }
      }
    }
  })

  /**
   * And every word has landed by the end of its own cue: a word still carrying a
   * fraction of its entrance on the four hundredth frame is a line whose
   * baseline never resolves, which is `bounceLift`'s defect one file over.
   */
  it('has every word on the plane, unturned, once the block has arrived', () => {
    for (const count of [1, 2, 3, SPATIAL_GROUPS]) {
      for (let index = 0; index < count; index += 1) {
        const landed = spatialGroupEnter(count, index, 1)
        expect(landed.behind, `${index}/${count}`).toBe(0)
        // `Math.abs`, because half the words turn the other way and `-0` is
        // not `0` to `Object.is`. It is the same number.
        expect(Math.abs(landed.turn), `${index}/${count}`).toBe(0)
        expect(landed.at).toBe(1)
      }
    }
  })

  /** The line assembles from both sides rather than combing one way. */
  it('turns neighbouring words opposite ways on the way in', () => {
    const a = spatialGroupEnter(4, 0, 0.2)
    const b = spatialGroupEnter(4, 1, 0.2)
    expect(Math.sign(a.turn)).toBe(-Math.sign(b.turn))
  })
})

describe('a line is drawn as words, and there is a bound on how many', () => {
  /**
   * THE OBJECT COUNT IS THE RENDER BUDGET, and this is the bound that holds it.
   *
   * Per-glyph geometry was written first and measured in the container at 0.084 s
   * of render per second of film per object: a sixteen-letter line at ten layers
   * is 176 objects and cost +10.3 s/s against a budget of about 2.4 on that
   * bench. A word is the object now, and the ceiling on their number is what
   * makes the cost a property of the BLOCK rather than of the sentence somebody
   * typed into it.
   */
  it('never draws more objects than the measured budget allows', () => {
    const worst = 'a b c d e f g h i j k l'
    expect(spatialGroups(worst).length).toBe(SPATIAL_GROUPS)
    expect(SPATIAL_GROUPS * (SPATIAL_LAYERS + 1)).toBeLessThanOrEqual(28)
  })

  /** The overflow joins the LAST group: a line of six words is two words and a phrase. */
  it('merges the words past the bound into the last group, keeping every one of them', () => {
    const groups = spatialGroups('un deux trois quatre cinq six')
    expect(groups.length).toBe(SPATIAL_GROUPS)
    expect(groups.join(' ')).toBe('un deux trois quatre cinq six')
    expect(groups[SPATIAL_GROUPS - 1]).toBe('trois quatre cinq six')
  })

  /** And a group is never empty: an empty one is a beat in the arrival with nothing in it. */
  it('drops the space a document typed twice', () => {
    expect(spatialGroups('  MOTION   EN  RELIEF ')).toEqual(['MOTION', 'EN', 'RELIEF'])
    expect(spatialGroups('   ')).toEqual([])
    expect(spatialGroups(undefined)).toEqual([])
  })
})

describe('the extrusion is a stack, and it has no seams', () => {
  /**
   * The thickness is `SPATIAL_LAYERS` copies of the type, because there is no
   * outline to sweep — the argument, with the measurements that refused drei, is
   * at the top of `spatialType.js`. A stack shows its steps unless each copy is
   * dilated by at least the step it takes, and the dilation the component
   * computes is what closes them.
   *
   * This is the inequality the component's `dilate` is derived from, written
   * where a reader of the block can find it: at the RESTING angle — the one the
   * stack is spread furthest across the frame at — one step of the stack is under
   * one dilation.
   */
  it('dilates each copy by at least the step the stack takes', () => {
    for (const block of CORPUS) {
      const layout = spatialLayout(block, { left: 0, top: 0, width: 1690, height: 950 })
      const swing = Math.sin(layout.turned + spatialRestTurn(block.spin))
      const step = (layout.depthPx * swing) / SPATIAL_LAYERS
      const dilate = Math.max(1, Math.ceil(((step * 1.4) / Math.max(1, layout.size)) * layout.rasterEm))
      // In raster pixels on both sides of the comparison.
      expect(dilate).toBeGreaterThanOrEqual((step / layout.size) * layout.rasterEm)
    }
  })

  /**
   * And the dilation is small enough that no counter closes. It shows as a
   * hairline of the accent around every word — a bevel, and a treatment rather
   * than an accident — but a ring wider than a few per cent of the em fills the
   * hole in an `e`, and a word of filled letters is a word nobody reads.
   *
   * The resting angle again, and this is the case that made the two bounds two
   * functions: dilating for the ENTRANCE puts a stroke of six per cent of the em
   * around every word for the whole scene, to close a seam that is only ever
   * open while the word is at the back of its own travel and drawn at three
   * quarters of its size.
   */
  it('keeps the bevel under a twentieth of the em', () => {
    for (const block of CORPUS) {
      const layout = spatialLayout(block, { left: 0, top: 0, width: 1690, height: 950 })
      const swing = Math.sin(layout.turned + spatialRestTurn(block.spin))
      const step = (layout.depthPx * swing) / SPATIAL_LAYERS
      expect((step * 1.4) / Math.max(1, layout.size), `${block.depth}/${block.spin}`).toBeLessThan(0.05)
    }
  })
})

describe('the world the type stands in', () => {
  /**
   * The canvas is exactly two world units tall, which is the whole of the
   * pixel-to-world conversion: the camera distance is derived from the field of
   * view so that it is, and a lens changed without the distance would put the
   * type at a size nothing else in the file knows about.
   */
  it('places the camera so the canvas is two world units tall', () => {
    expect(SPATIAL_CAMERA_Z * Math.tan((SPATIAL_FOV / 2) * (Math.PI / 180))).toBeCloseTo(SPATIAL_HALF, 9)
    const layout = spatialLayout(line('Motion'), { left: 0, top: 0, width: 1200, height: 400 })
    expect(layout.worldPerPx * layout.canvas.height).toBeCloseTo(2 * SPATIAL_HALF, 9)
  })

  /**
   * A long lens, and it is a typographic decision rather than a taste: a wide one
   * keystones a line of type, so the near end of a turned word is set visibly
   * larger than the far end and one word comes back at two sizes.
   */
  it('keeps the keystoning of a full-frame line under a twentieth', () => {
    const box = composedSafeArea(1920, 1080)
    // A LINE, which is what keystoning is about: the near end set visibly larger
    // than the far one. A single glyph has no far end — it is one object, and
    // what the lens does to it is foreshortening rather than a size difference
    // inside a word — so the bound that matters is measured on lines of words.
    for (const block of CORPUS) {
      if (block.text.length < 6) continue
      const layout = spatialLayout(block, box)
      expect(layout.keystone, `${block.text.length}/${block.spin}`).toBeLessThanOrEqual(SPATIAL_KEYSTONE_MAX)
      // And the bound bites rather than being decorative: the widest line the
      // schema allows is one the lens alone does not rescue, which is what
      // `spatialLayout`'s two budgets are for. The ATTITUDE is what it takes
      // first — it is not the move — so that is where the clip shows.
      if (block.text.length >= 24) expect(layout.turn.rest, `${block.spin}`).toBeLessThan(1)
    }
    // Never all the way down on the MOVE, though: a line reduced to a fraction
    // of a degree is a flat title somebody paid a renderer for.
    for (const block of CORPUS) {
      expect(spatialLayout(block, box).turn.swing, `${block.text.length}`).toBeGreaterThanOrEqual(SPATIAL_SWAY_FLOOR)
    }
  })

  it('reads the glyph box tall enough for an ascender and a descender', () => {
    expect(SPATIAL_GLYPH_BOX).toBeGreaterThan(1.2)
  })

  /** A line of one word is a line: nothing here divides by the count. */
  it('lays out a single word', () => {
    const layout = spatialLayout(line('M'), { left: 0, top: 0, width: 800, height: 400 })
    expect(layout.size).toBeGreaterThan(0)
    expect(layout.canvas.width).toBeGreaterThan(0)
    expect(spatialGroups('M')).toEqual(['M'])
    expect(spatialGroups(null)).toEqual([])
  })

  /**
   * A box of nothing is a size of one pixel and not of `NaN`, which is a scene
   * with everything piled at the origin (Q1). It is reachable: `stackIn` can hand
   * a block a degenerate box when eight of them share one cell of a portrait
   * frame.
   */
  it('answers a finite layout for a degenerate box', () => {
    for (const box of [undefined, {}, { width: 0, height: 0 }, { width: 3, height: 1 }]) {
      const layout = spatialLayout(line('Motion'), box)
      for (const value of [layout.size, layout.canvas.width, layout.canvas.height, layout.worldPerPx, layout.fit]) {
        expect(Number.isFinite(value), JSON.stringify(box)).toBe(true)
      }
      expect(layout.canvas.width).toBeGreaterThanOrEqual(1)
      expect(layout.fit).toBeGreaterThan(0)
    }
  })
})

/**
 * THE SIDE IS SHADED, WHICH IS WHAT MAKES IT AN EXTRUSION.
 *
 * Four real exports came back with a white word and a flat accent silhouette
 * offset behind it — which is what `funTitle`'s `stack` treatment draws with a
 * `text-shadow`, on a block that costs a whole renderer. A solid side has a
 * gradient: the far end is turned away from the light. `spatialShade` is that
 * ramp, and every claim below is one the frame cannot be asked about.
 */
describe('spatialShade', () => {
  it('is a grey, so the block writes no colour', () => {
    // A grey multiplied into a texture is what `<meshLambertMaterial>` does to
    // `palette.solid.color` one block over. A ramp with a hue in it would be a
    // colour nobody measured, arriving through a multiplier.
    for (let layer = 0; layer < SPATIAL_LAYERS; layer += 1) {
      const hex = spatialShade(layer)
      expect(hex, String(layer)).toMatch(/^#[0-9a-f]{6}$/)
      expect(hex.slice(1, 3), String(layer)).toBe(hex.slice(3, 5))
      expect(hex.slice(3, 5), String(layer)).toBe(hex.slice(5, 7))
    }
  })

  it('only ever darkens: the brightest side pixel is the accent itself', () => {
    // The face carries the word and is not shaded at all; the side carries no
    // glyph. What this rules out is a multiplier that could BRIGHTEN a run the
    // palette resolved — that would be spending contrast nobody measured.
    expect(spatialShade(SPATIAL_LAYERS - 1)).toBe(SPATIAL_NO_SHADE)
    for (let layer = 0; layer < SPATIAL_LAYERS; layer += 1) {
      const value = parseInt(spatialShade(layer).slice(1, 3), 16) / 255
      expect(value, String(layer)).toBeLessThanOrEqual(1)
      expect(value, String(layer)).toBeGreaterThanOrEqual(SPATIAL_SHADE_FLOOR - 1 / 255)
    }
  })

  it('runs monotonically from the floor at the back to the face at the front', () => {
    let previous = -Infinity
    for (let layer = 0; layer < SPATIAL_LAYERS; layer += 1) {
      const value = parseInt(spatialShade(layer).slice(1, 3), 16)
      expect(value, String(layer)).toBeGreaterThan(previous)
      previous = value
    }
  })

  it('leaves one copy exactly where it was before the ramp existed', () => {
    // A side made of a single quad has no depth to ramp over, so shading it would
    // be darkening the whole thing for nothing.
    expect(spatialShade(0, 1)).toBe(SPATIAL_NO_SHADE)
  })

  it('takes an index off a document the way everything else here does', () => {
    // Clamped rather than trusted: an index outside the stack is a copy drawn at
    // a shade the ramp never defined, which is a band of the wrong tone rather
    // than an error anybody would see.
    expect(spatialShade(-4)).toBe(spatialShade(0))
    expect(spatialShade(999)).toBe(spatialShade(SPATIAL_LAYERS - 1))
    expect(spatialShade(Number.NaN)).toBe(spatialShade(0))
  })
})
