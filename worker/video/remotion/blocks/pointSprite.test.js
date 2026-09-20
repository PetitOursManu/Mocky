// The round dot, as the two point clouds get it.
//
// There is no frame to look at from inside vitest — `SPRITE_CANVAS` is `null`
// here, because a browser is what draws it — so what this file can check is the
// half that decided anything: the ARITHMETIC the two calibrations were rescaled
// by, and the degradation that keeps `blocks/index.js` loadable in this suite at
// all.
import { describe, it, expect } from 'vitest'
import { SPRITE_ARGS, SPRITE_CANVAS, SPRITE_MARGIN, SPRITE_SIDE, SPRITE_AREA_GAIN } from './pointSprite.js'

describe('the round point sprite', () => {
  /**
   * The whole reason this file exists is a rendered frame: at 1080p a particle is
   * eight to fourteen device pixels and a globe's land dot five to nine, and a
   * hard-edged axis-aligned square of that size reads as a pixel rather than as a
   * mote. The mask is a texture, so nothing here can look at it — what it can do
   * is stop the two facts the blocks depend on from drifting.
   */
  it('gives nothing at all when there is no browser, rather than throwing', () => {
    // vitest runs in node: no `document`, so no canvas. `blocks.test.js` loads the
    // whole registry through this module, and a module that threw at import time
    // would take the test that proves the registry matches the schema with it.
    expect(SPRITE_CANVAS).toBeNull()
    expect(SPRITE_ARGS).toBeNull()
  })

  it('is a power of two, because the filter is not the machine’s business', () => {
    expect(Number.isInteger(Math.log2(SPRITE_SIDE))).toBe(true)
    // Two texels per device pixel at the largest dot the catalogue draws.
    expect(SPRITE_SIDE).toBeGreaterThanOrEqual(32)
  })

  /**
   * The number both calibrations were rescaled by, and the one thing about this
   * change that could silently spend a measurement.
   *
   * `particleSize`'s ceiling came off a BITRATE measured with square points, and
   * `GLOBE_DOT_SHARE` came off a lattice of them. A disc inscribed in a square
   * covers pi/4 of it, so drawing the same numbers round is 21% less ink than
   * either was signed off on. The gain is the side of the disc with the square's
   * own area — and the margin has to be in it, since the disc does not reach the
   * edge of its texture.
   */
  it('restores exactly the area a square point covered', () => {
    const square = 1
    const drawn = square * SPRITE_AREA_GAIN
    const disc = drawn * (1 - SPRITE_MARGIN)
    expect((Math.PI / 4) * disc * disc).toBeCloseTo(square * square, 12)
  })

  it('leaves a margin, so `ClampToEdge` has nothing to smear', () => {
    // A circle drawn edge to edge puts its antialiased rim in the outermost row
    // of texels, which the clamp then repeats outwards when the sprite is
    // magnified — a faint square halo, which is the defect coming back through
    // the fix.
    expect(SPRITE_MARGIN).toBeGreaterThan(0)
    // And under a device pixel at the sizes this family draws.
    expect(SPRITE_MARGIN * SPRITE_SIDE).toBeLessThan(4)
  })
})
