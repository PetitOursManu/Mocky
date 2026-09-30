import { describe, expect, it } from 'vitest'
import {
  CAPTION_ROOM,
  FRAME_PAD,
  FRAME_PAD_NARROW,
  FRAME_PREF_KEY,
  MAX_FRAME_SCALE,
  deviceFrame,
  fitFrameScale,
  frameDimensions,
  frameKindFor,
  readFramePref,
  writeFramePref,
  type DeviceFrame,
  type FrameKind,
  type Point,
  type Rect,
} from './deviceFrames'
import { PRESETS } from './presets'
import { FRAME_HEADER } from './project'

const eps = 1e-6

function inside(r: { x: number; y: number; w: number; h: number }, f: DeviceFrame) {
  expect(r.x).toBeGreaterThanOrEqual(-eps)
  expect(r.y).toBeGreaterThanOrEqual(-eps)
  expect(r.x + r.w).toBeLessThanOrEqual(f.width + eps)
  expect(r.y + r.h).toBeLessThanOrEqual(f.height + eps)
}

function pointsInside(pts: Point[], f: DeviceFrame) {
  for (const p of pts) inside({ x: p.x, y: p.y, w: 0, h: 0 }, f)
}

function rects(f: DeviceFrame): Rect[] {
  if (f.kind === 'computer') return [f.lid, f.hinge, f.lip]
  return [f.shell, f.rail, ...f.buttons]
}

describe('frameKindFor', () => {
  it('trusts the mobile preset whatever its size', () => {
    expect(frameKindFor('iphone', 390, 844)).toBe('phone')
    expect(frameKindFor('iphone', 1440, 900)).toBe('phone')
  })

  it('reads the presets back to the device they were made for', () => {
    const kinds = Object.fromEntries(
      PRESETS.map((p) => [p.id, frameKindFor(p.device, p.w, p.h - FRAME_HEADER)]),
    )
    expect(kinds).toEqual({ mobile: 'phone', tablet: 'tablet', desktop: 'computer' })
  })

  it('classifies a free frame by its width', () => {
    expect(frameKindFor('none', 375, 667)).toBe('phone')
    expect(frameKindFor('none', 599, 900)).toBe('phone')
    expect(frameKindFor('none', 600, 900)).toBe('tablet')
    expect(frameKindFor('none', 1024, 1366)).toBe('tablet')
    expect(frameKindFor('none', 1100, 1400)).toBe('computer')
    expect(frameKindFor('none', 1280, 800)).toBe('computer')
    expect(frameKindFor('none', 1920, 1080)).toBe('computer')
  })

  it('keeps an iPad on its side a tablet, and a 4:3 desktop a computer', () => {
    expect(frameKindFor('none', 1180, 820)).toBe('tablet')
    expect(frameKindFor('none', 1366, 1024)).toBe('tablet')
    expect(frameKindFor(undefined, 1920, 1440)).toBe('computer')
    // Tall full-page desktop screens are still a computer.
    expect(frameKindFor('none', 1440, 3200)).toBe('computer')
  })
})

describe('deviceFrame', () => {
  const sizes: [FrameKind, number, number][] = [
    ['phone', 390, 844],
    ['phone', 360, 640],
    ['phone', 540, 300],
    ['phone', 390, 2400],
    ['tablet', 820, 1180],
    ['tablet', 1180, 820],
    ['tablet', 700, 400],
    ['computer', 1440, 900],
    ['computer', 1920, 1080],
    ['computer', 1440, 3200],
    ['computer', 1200, 300],
  ]

  it.each(sizes)('%s %i×%i: the screen sits exactly in the opening, at its own size', (kind, w, h) => {
    const f = deviceFrame(kind, w, h)
    expect(f.kind).toBe(kind)
    expect(f.body).toMatchObject({ x: f.insets.left, y: f.insets.top, w, h })
    expect(f.width).toBeCloseTo(w + f.insets.left + f.insets.right)
    expect(f.height).toBeCloseTo(h + f.insets.top + f.insets.bottom)
    for (const v of Object.values(f.insets)) expect(v).toBeGreaterThan(0)
  })

  it.each(sizes)('%s %i×%i: every part is inside the device box', (kind, w, h) => {
    const f = deviceFrame(kind, w, h)
    for (const r of rects(f)) inside(r, f)
    if (f.kind === 'computer') {
      pointsInside([...f.deck, ...f.keyboard, ...f.trackpad], f)
      expect(f.camera.cy).toBeLessThan(f.body.y)
    } else if (f.kind === 'tablet') {
      expect(f.camera.cy).toBeLessThan(f.body.y)
      expect(f.camera.cy).toBeGreaterThan(f.shell.y)
    } else {
      inside(f.island, f)
    }
  })

  it.each(sizes)('%s %i×%i: the shell surrounds the opening', (kind, w, h) => {
    const f = deviceFrame(kind, w, h)
    const outer = f.kind === 'computer' ? f.lid : f.shell
    expect(outer.x).toBeLessThan(f.body.x)
    expect(outer.y).toBeLessThan(f.body.y)
    expect(outer.x + outer.w).toBeGreaterThan(f.body.x + f.body.w)
    expect(outer.y + outer.h).toBeGreaterThan(f.body.y + f.body.h)
  })

  it('keeps the island and the home indicator in the safe areas the mobile preset promises', () => {
    // MOBILE_HINT: keep the top ~54px and the bottom ~24px clear.
    const mobile = PRESETS.find((p) => p.id === 'mobile')!
    const f = deviceFrame('phone', mobile.w, mobile.h - FRAME_HEADER)
    if (f.kind !== 'phone') throw new Error('expected a phone')
    const islandBottom = f.island.y + f.island.h - f.body.y
    expect(islandBottom).toBeLessThanOrEqual(54)
    expect(f.island.y).toBeGreaterThan(f.body.y)
    const homeTop = f.body.y + f.body.h - (f.home.y - f.home.thickness / 2)
    expect(homeTop).toBeLessThanOrEqual(24)
    expect(f.home.y + f.home.thickness / 2).toBeLessThan(f.body.y + f.body.h)
    // Centred, and the status glyphs stay clear of the island.
    expect(f.island.x - f.body.x).toBeCloseTo(f.body.x + f.body.w - (f.island.x + f.island.w))
    expect(f.status.left).toBeLessThan(f.island.x)
    expect(f.status.right).toBeGreaterThan(f.island.x + f.island.w)
    // The preset gets its full set of side buttons.
    expect(f.buttons).toHaveLength(4)
  })

  // MOBILE_HINT's bands are fixed pixels, so they hold at any size an iPhone
  // frame is resized to — 600 wide put the island's bottom at 74 px when the
  // island grew with the screen.
  it.each([
    [390, 844],
    [600, 1100],
    [900, 1600],
    [320, 600],
  ])('keeps the system UI inside the safe areas on a %i×%i iPhone screen', (w, h) => {
    const f = deviceFrame('phone', w, h)
    if (f.kind !== 'phone') throw new Error('expected a phone')
    expect(f.island.y + f.island.h - f.body.y).toBeLessThanOrEqual(54)
    expect(f.body.y + f.body.h - (f.home.y - f.home.thickness / 2)).toBeLessThanOrEqual(24)
    expect(f.status.left).toBeLessThan(f.island.x)
    expect(f.status.right).toBeGreaterThan(f.island.x + f.island.w)
  })

  it('puts the camera dot of a bare phone in the top bezel', () => {
    for (const [w, h] of [[390, 844], [480, 900], [540, 300]]) {
      const f = deviceFrame('phone', w, h)
      if (f.kind !== 'phone') throw new Error('expected a phone')
      expect(f.camera.cy - f.camera.r).toBeGreaterThan(f.shell.y)
      expect(f.camera.cy + f.camera.r).toBeLessThan(f.body.y)
    }
  })

  it('drops a phone button that would hang off a short device rather than draw it on the corner', () => {
    const f = deviceFrame('phone', 540, 300)
    if (f.kind !== 'phone') throw new Error('expected a phone')
    expect(f.buttons.length).toBeLessThan(4)
    for (const b of f.buttons) {
      expect(b.y).toBeGreaterThanOrEqual(f.shell.r)
      expect(b.y + b.h).toBeLessThanOrEqual(f.shell.h - f.shell.r)
    }
  })

  it('gives a phone bezel the same width however tall the phone is', () => {
    const a = deviceFrame('phone', 390, 844)
    const b = deviceFrame('phone', 390, 2400)
    expect(b.insets).toEqual(a.insets)
  })

  it('draws the laptop deck as a trapezoid that widens towards the viewer', () => {
    const f = deviceFrame('computer', 1440, 900)
    if (f.kind !== 'computer') throw new Error('expected a computer')
    const [tl, tr, br, bl] = f.deck
    expect(br.x - bl.x).toBeGreaterThan(tr.x - tl.x)
    expect(tl.y).toBeCloseTo(f.hinge.y + f.hinge.h)
    // The trackpad converges like the deck it sits on.
    const [pl, pr, qr, ql] = f.trackpad
    expect(qr.x - ql.x).toBeGreaterThan(pr.x - pl.x)
    expect(pl.y).toBeGreaterThan(f.keyboard[3].y)
    // Everything under the lid costs about a tenth of the device's height —
    // the reason it is a laptop and not a monitor on a stand.
    const underLid = f.height - (f.lid.y + f.lid.h)
    expect(underLid / f.height).toBeLessThan(0.12)
  })

  it('never makes a zero-sized screen', () => {
    const f = deviceFrame('tablet', 0, -5)
    expect(f.bodyW).toBe(1)
    expect(f.bodyH).toBe(1)
  })
})

describe('fitFrameScale', () => {
  it('fits the whole device, caption included, inside the padded area', () => {
    const f = deviceFrame('computer', 1440, 900)
    const s = fitFrameScale(1200, 800, f)
    expect(f.width * s).toBeLessThanOrEqual(1200 - 2 * FRAME_PAD + eps)
    expect(f.height * s + CAPTION_ROOM).toBeLessThanOrEqual(800 - 2 * FRAME_PAD + eps)
    // And one of the two limits is actually reached.
    const slackW = 1200 - 2 * FRAME_PAD - f.width * s
    const slackH = 800 - 2 * FRAME_PAD - CAPTION_ROOM - f.height * s
    expect(Math.min(slackW, slackH)).toBeCloseTo(0)
  })

  it('never draws a device larger than its own pixels', () => {
    const f = deviceFrame('phone', 390, 844)
    expect(fitFrameScale(4000, 3000, f)).toBe(MAX_FRAME_SCALE)
  })

  it('uses a narrower margin in a narrow window', () => {
    const f = deviceFrame('phone', 390, 844)
    const s = fitFrameScale(375, 5000, f)
    expect(f.width * s).toBeCloseTo(375 - 2 * FRAME_PAD_NARROW)
  })

  it('answers 0 when there is no room yet', () => {
    const f = deviceFrame('tablet', 820, 1180)
    expect(fitFrameScale(0, 0, f)).toBe(0)
    expect(fitFrameScale(40, 40, f)).toBe(0)
  })
})

describe('the preference', () => {
  function memory() {
    const m = new Map<string, string>()
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m }
  }

  it('is on by default and round-trips', () => {
    const s = memory()
    expect(readFramePref(s)).toBe(true)
    writeFramePref(s, false)
    expect(s.m.get(FRAME_PREF_KEY)).toBe('0')
    expect(readFramePref(s)).toBe(false)
    writeFramePref(s, true)
    expect(readFramePref(s)).toBe(true)
  })

  it('degrades to the default when storage throws or is missing', () => {
    const broken = {
      getItem: () => {
        throw new Error('SecurityError')
      },
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
    }
    expect(readFramePref(broken)).toBe(true)
    expect(() => writeFramePref(broken, false)).not.toThrow()
    expect(readFramePref(undefined)).toBe(true)
  })
})

describe('frameDimensions', () => {
  it('prints the designed size, rounded', () => {
    expect(frameDimensions(1440, 900)).toBe('1440 × 900')
    expect(frameDimensions(390.4, 843.6)).toBe('390 × 844')
  })
})
