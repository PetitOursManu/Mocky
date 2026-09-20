import { describe, it, expect } from 'vitest'
import {
  FRAME_DIMENSIONS,
  KEN_BURNS_PEAK,
  MAGNIFICATION_FLOOR,
  OVERLAY_DRIFT_PEAK,
  SOURCE_DIMENSIONS,
  formatMagnification,
  magnification,
  motionOverscale,
  pictureBox,
  undersizedScenes,
  worstMagnification,
} from './resolution'
import type { KenBurns } from './timeline'

const scene = (imageId: string, kenBurns: KenBurns = 'static') => ({ imageId, kenBurns })

/** The library's own default, and the picture the whole report was about. */
const SQUARE_1024 = { width: 1024, height: 1024 }

describe('pictureBox', () => {
  it('is the whole frame for the three full-bleed compositions', () => {
    for (const template of ['slideshow', 'overlay', 'vertical'] as const) {
      expect(pictureBox(template, '16:9')).toEqual({ width: 1920, height: 1080 })
    }
  })

  it('is half a landscape frame for a product card, and a band otherwise', () => {
    expect(pictureBox('product', '16:9')).toEqual({ width: 960, height: 1080 })
    expect(pictureBox('product', '9:16')).toEqual({ width: 1080, height: 864 })
    // Square lands in `column` deliberately — see `productLayout` in the worker.
    expect(pictureBox('product', '1:1')).toEqual({ width: 1080, height: 486 })
  })

  it('is nothing at all for titles, the one composition with no picture', () => {
    expect(pictureBox('titles', '16:9')).toBeNull()
  })
})

describe('motionOverscale', () => {
  it('costs nothing when the document asked for a still frame', () => {
    expect(motionOverscale('slideshow', 'static')).toBe(1)
    expect(motionOverscale('vertical', 'static')).toBe(1)
  })

  it('spends the same overscale for a zoom and for a pan', () => {
    for (const move of ['zoom-in', 'zoom-out', 'pan-left', 'pan-right'] as const) {
      expect(motionOverscale('slideshow', move)).toBe(KEN_BURNS_PEAK)
    }
  })

  it('ignores the document for the two compositions that decide for themselves', () => {
    // `overlay` drifts and `product` zooms whatever the scene says — neither
    // schema even has a `kenBurns` field.
    expect(motionOverscale('overlay', 'static')).toBe(OVERLAY_DRIFT_PEAK)
    expect(motionOverscale('product', 'static')).toBe(KEN_BURNS_PEAK)
  })

  it('reports the floor under `auto`, never a guess', () => {
    // The composition is not decided yet. Under-reporting is the safe direction:
    // a picture flagged here is at least this enlarged whichever one comes back.
    expect(motionOverscale('auto', 'zoom-in')).toBe(1)
  })
})

describe('magnification', () => {
  it('is the LARGER of the two ratios, because `cover` fills both edges', () => {
    // 1920/1024 = 1.875 wins over 1080/1024 = 1.055; the rest of the square is
    // cropped away top and bottom.
    expect(magnification(SQUARE_1024, FRAME_DIMENSIONS['16:9'])).toBeCloseTo(1.875, 3)
  })

  it('multiplies the camera move in', () => {
    expect(magnification(SQUARE_1024, FRAME_DIMENSIONS['16:9'], KEN_BURNS_PEAK)).toBeCloseTo(2.1, 2)
  })

  it('is below 1 for a source larger than its box — a picture being reduced', () => {
    expect(magnification({ width: 3840, height: 2160 }, FRAME_DIMENSIONS['16:9'])).toBeCloseTo(0.5, 3)
  })

  it('answers 0 rather than NaN or Infinity for anything unmeasurable', () => {
    expect(magnification(null, FRAME_DIMENSIONS['16:9'])).toBe(0)
    expect(magnification({ width: 0, height: 0 }, FRAME_DIMENSIONS['16:9'])).toBe(0)
    expect(magnification(SQUARE_1024, null)).toBe(0)
    // A nonsense overscale is dropped, not propagated: this number ends up in a
    // sentence a user reads.
    expect(magnification(SQUARE_1024, FRAME_DIMENSIONS['16:9'], Number.NaN)).toBeCloseTo(1.875, 3)
  })
})

describe('SOURCE_DIMENSIONS', () => {
  it('matches the shape of the frame it is generated for', () => {
    for (const ratio of ['16:9', '9:16', '1:1'] as const) {
      const frame = FRAME_DIMENSIONS[ratio]
      const source = SOURCE_DIMENSIONS[ratio]
      // Within a percent of the frame's own aspect: this is what stops `cover`
      // throwing away 44% of a square picture in a landscape film.
      expect(source.width / source.height).toBeCloseTo(frame.width / frame.height, 1)
    }
  })

  it('closes most of the gap the 1024 square left open, without pretending to close it', () => {
    const before = magnification(SQUARE_1024, FRAME_DIMENSIONS['16:9'])
    const after = magnification(SOURCE_DIMENSIONS['16:9'], FRAME_DIMENSIONS['16:9'])
    expect(after).toBeLessThan(before)
    // Still an enlargement — which is exactly why the notice stays.
    expect(after).toBeGreaterThan(1)
    expect(after).toBeCloseTo(1.43, 2)
  })
})

describe('undersizedScenes', () => {
  const sizes: Record<string, { width: number; height: number }> = {
    small: SQUARE_1024,
    big: { width: 3840, height: 2160 },
    exact: { width: 1920, height: 1080 },
  }
  const sizeOf = (id: string) => sizes[id] ?? null

  it('names the scenes whose picture is about to be blown up', () => {
    const found = undersizedScenes(
      [scene('big'), scene('small'), scene('exact')],
      { template: 'slideshow', aspectRatio: '16:9' },
      sizeOf,
    )
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({ index: 1, imageId: 'small' })
    expect(found[0].magnification).toBeCloseTo(1.875, 3)
  })

  it('turns a borderline picture into a finding once a camera move is asked for', () => {
    // 1536×864 sits exactly ON the floor: enlarged 1.25 and silent. Add the
    // 12% a Ken Burns move spends and it is 1.4, which is a finding. This is the
    // case that makes the overscale worth counting at all — and it is a real
    // shape, since 1536×1024 is the best OpenAI's models return for a landscape.
    const borderline = () => ({ width: 1536, height: 864 })
    expect(undersizedScenes([scene('x')], { template: 'slideshow', aspectRatio: '16:9' }, borderline)).toEqual([])
    const moving = undersizedScenes([scene('x', 'zoom-in')], { template: 'slideshow', aspectRatio: '16:9' }, borderline)
    expect(moving).toHaveLength(1)
    expect(moving[0].magnification).toBeCloseTo(1.4, 2)
    // And a pan on the library's own default is where the report started.
    const panned = undersizedScenes([scene('small', 'pan-left')], { template: 'slideshow', aspectRatio: '16:9' }, sizeOf)
    expect(panned[0].magnification).toBeCloseTo(2.1, 2)
  })

  it('lets the same picture pass on a product card that fails in a slideshow', () => {
    // Half a landscape frame asks for half the pixels. A composition-blind check
    // would have warned about a still that is genuinely sharp where it lands.
    const wide = { width: 1000, height: 1080 }
    const source = () => wide
    expect(undersizedScenes([scene('x')], { template: 'slideshow', aspectRatio: '16:9' }, source)).toHaveLength(1)
    expect(undersizedScenes([scene('x')], { template: 'product', aspectRatio: '16:9' }, source)).toHaveLength(0)
  })

  it('says nothing about a composition that paints no picture', () => {
    expect(undersizedScenes([scene('small')], { template: 'titles', aspectRatio: '16:9' }, sizeOf)).toEqual([])
  })

  it('skips a scene with no picture and one whose size could not be read', () => {
    // A title card carries no id, and an image the browser has not decoded yet
    // has no honest sentence to go with it. Neither is a finding.
    const found = undersizedScenes(
      [scene(''), scene('never-loaded'), scene('small')],
      { template: 'slideshow', aspectRatio: '16:9' },
      sizeOf,
    )
    expect(found.map((f) => f.imageId)).toEqual(['small'])
  })

  it('follows the aspect ratio, because the frame is what changed', () => {
    // The same square still is enlarged 1.875 in a landscape film and 1.875 in a
    // portrait one — by the height there, by the width here.
    const portrait = undersizedScenes([scene('small')], { template: 'slideshow', aspectRatio: '9:16' }, sizeOf)
    expect(portrait[0].magnification).toBeCloseTo(1.875, 3)
    // …and 1.055 in a square one, which is under the floor and therefore silent.
    expect(undersizedScenes([scene('small')], { template: 'slideshow', aspectRatio: '1:1' }, sizeOf)).toEqual([])
  })

  it('holds the floor: exactly at it is not a finding', () => {
    const atFloor = { width: 1920 / MAGNIFICATION_FLOOR, height: 1080 / MAGNIFICATION_FLOOR }
    expect(
      undersizedScenes([scene('x')], { template: 'slideshow', aspectRatio: '16:9' }, () => atFloor),
    ).toEqual([])
  })
})

describe('worstMagnification', () => {
  it('is the one that decides how the film reads', () => {
    expect(
      worstMagnification([
        { index: 0, imageId: 'a', source: SQUARE_1024, magnification: 1.4 },
        { index: 1, imageId: 'b', source: SQUARE_1024, magnification: 2.1 },
      ]),
    ).toBeCloseTo(2.1, 3)
  })

  it('is 0 for nothing found, so a caller can test it like a count', () => {
    expect(worstMagnification([])).toBe(0)
  })
})

describe('formatMagnification', () => {
  it('uses the reader’s own decimal separator', () => {
    expect(formatMagnification(1.875, 'fr')).toBe('1,9')
    expect(formatMagnification(1.875, 'en')).toBe('1.9')
  })

  it('refuses to print a number it does not have', () => {
    expect(formatMagnification(0, 'fr')).toBe('—')
    expect(formatMagnification(Number.NaN, 'en')).toBe('—')
  })
})
