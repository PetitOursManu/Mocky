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
} from '../src/lib/video/resolution.ts'

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
