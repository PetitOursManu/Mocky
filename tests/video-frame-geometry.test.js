// The third hand-kept mirror in this feature, and the one nothing else was
// holding.
//
// `server/video/timeline.js` mirrors `src/lib/video/timeline.ts` because Node
// cannot import a `.ts` file; `worker/video/remotion/contrast.js` mirrors
// `src/lib/audit/colors.ts` because a Remotion bundle cannot either. This one
// goes the other way: `src/lib/video/resolution.ts` mirrors the frame geometry
// out of `worker/video/remotion/composition.js` so that Mocky's export panel can
// say, BEFORE a two-minute render, how much a still is about to be enlarged.
//
// A copy with no test is a copy that drifts, and this one drifts in the silent
// direction: raise the worker's output to 4K and the panel keeps measuring
// against 1080p, so it stops reporting exactly the films that got worse. The
// three tables below are the whole of what the browser assumes about the
// worker's geometry — if a number moves there, one of these fails here.
//
// A `.js` test rather than a `.ts` one, for the reason `server/video/timeline.test.js`
// is one: vitest resolves both, `tsc` only typechecks `src`, and the worker half
// of this comparison is plain JavaScript with no declarations to import.
import { describe, it, expect } from 'vitest'
// No Remotion and no React in either import — that is what lets this file run
// inside Mocky's own suite, where neither is installed. `composition.js` says so
// at the top and `PICTURE_SHARE` was moved into it precisely to keep that true.
import { DIMENSIONS, KEN_BURNS_ZOOM, OVERLAY_DRIFT_SCALE, PAN_SCALE, PICTURE_SHARE } from '../worker/video/remotion/composition.js'
import {
  FRAME_DIMENSIONS,
  KEN_BURNS_PEAK,
  OVERLAY_DRIFT_PEAK,
  PICTURE_SHARE as WEB_PICTURE_SHARE,
  SOURCE_DIMENSIONS,
} from '../src/lib/video/resolution.ts'
// The one provider that does not render what it is asked for. See below.
import { snapSize } from '../server/images/providers/openai.js'

describe('the browser and the worker agree on the frame', () => {
  it('has the same output geometry for every aspect ratio', () => {
    expect(FRAME_DIMENSIONS).toEqual(DIMENSIONS)
  })

  it('knows every ratio the worker renders, and no others', () => {
    // Not implied by the equality above once somebody reaches for a spread: a
    // browser table with an extra key would report on a film the worker refuses.
    expect(Object.keys(FRAME_DIMENSIONS).sort()).toEqual(Object.keys(DIMENSIONS).sort())
  })
})

describe('the browser and the worker agree on the overscale', () => {
  it('spends the same peak on a Ken Burns move', () => {
    // The zoom reaches 1 + KEN_BURNS_ZOOM at one end of the scene; a pan holds
    // PAN_SCALE throughout. They are deliberately the same number in the worker,
    // and the panel quotes one peak for both.
    expect(KEN_BURNS_PEAK).toBe(1 + KEN_BURNS_ZOOM)
    expect(KEN_BURNS_PEAK).toBe(PAN_SCALE)
  })

  it('spends the same drift on a band', () => {
    expect(OVERLAY_DRIFT_PEAK).toBe(OVERLAY_DRIFT_SCALE)
  })
})

describe('the browser and the worker agree on how much frame a product picture takes', () => {
  it('shares one table', () => {
    expect(WEB_PICTURE_SHARE).toEqual(PICTURE_SHARE)
  })
})

/**
 * The other end of the same mirror: what is ASKED of a provider, against what a
 * provider that does not take orders will answer.
 *
 * `SOURCE_DIMENSIONS` exists so that a picture made for a film arrives in the
 * film's shape. Every provider here passes width and height through except
 * OpenAI's, which snaps to one of three sizes — and the snap is done on the
 * RATIO, so it is `SOURCE_DIMENSIONS` that decides which of the three comes
 * back. A landscape tier whose ratio drifted towards 1 would be answered with
 * 1024×1024: the exact square this table was written to stop asking for, cropped
 * of 44% of itself, and nothing in the request would look wrong.
 *
 * It is here rather than in `resolution.test.ts` because it crosses the same
 * kind of boundary the file above does — a browser table against a server one —
 * and `tsc` only typechecks `src`.
 */
describe('a provider that snaps the request still answers in the film’s shape', () => {
  it('keeps a landscape film landscape and a portrait one portrait', () => {
    expect(snapSize(SOURCE_DIMENSIONS['16:9'].width, SOURCE_DIMENSIONS['16:9'].height)).toBe('1536x1024')
    expect(snapSize(SOURCE_DIMENSIONS['9:16'].width, SOURCE_DIMENSIONS['9:16'].height)).toBe('1024x1536')
    expect(snapSize(SOURCE_DIMENSIONS['1:1'].width, SOURCE_DIMENSIONS['1:1'].height)).toBe('1024x1024')
  })

  it('never turns a wide film’s request into a square', () => {
    // The regression that would be invisible: a square answer to a 16:9 request
    // is the library default this whole table replaced, and the enlargement it
    // costs (1.88× before the camera move) is the number the report used.
    for (const ratio of ['16:9', '9:16']) {
      expect(snapSize(SOURCE_DIMENSIONS[ratio].width, SOURCE_DIMENSIONS[ratio].height)).not.toBe('1024x1024')
    }
  })

  it('answers something at least as large as the tier that was asked for', () => {
    // A provider recaling DOWNWARD would quietly undo the change while the
    // library kept recording the size that was requested. The panel measures the
    // file rather than the index precisely because of that, but a snap that lost
    // pixels should fail here first.
    for (const ratio of ['16:9', '9:16', '1:1']) {
      const asked = SOURCE_DIMENSIONS[ratio]
      const [w, h] = snapSize(asked.width, asked.height).split('x').map(Number)
      expect(Math.max(w, h), ratio).toBeGreaterThanOrEqual(Math.max(asked.width, asked.height))
    }
  })
})
