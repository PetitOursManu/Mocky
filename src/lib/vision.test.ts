import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DICHROMACY,
  feColorMatrixValues,
  readVision,
  simulate,
  VISION_MODES,
  visionFilterCss,
  visionFilterId,
  writeVision,
} from './vision'

describe('the dichromacy matrices', () => {
  it.each(Object.keys(DICHROMACY) as (keyof typeof DICHROMACY)[])('%s keeps white white and grey grey', (mode) => {
    const m = DICHROMACY[mode]
    for (let r = 0; r < 3; r++) expect(m[r * 3] + m[r * 3 + 1] + m[r * 3 + 2]).toBeCloseTo(1, 5)
    simulate(mode, [0.5, 0.5, 0.5]).forEach((c) => expect(c).toBeCloseTo(0.5, 5))
  })

  it('makes the red and the green of a status hard to tell apart', () => {
    // The whole point of the view: a pure red and a pure green land close
    // together for a deuteranope, while they are as far apart as can be.
    const red = simulate('deuteranopia', [1, 0, 0])
    const green = simulate('deuteranopia', [0, 1, 0])
    const dist = Math.hypot(red[0] - green[0], red[1] - green[1], red[2] - green[2])
    expect(dist).toBeLessThan(Math.hypot(1, 1) / 2)
  })

  it('writes a 4×5 matrix with alpha untouched', () => {
    const values = feColorMatrixValues(DICHROMACY.protanopia).split(' ')
    expect(values).toHaveLength(20)
    expect(values.slice(15)).toEqual(['0', '0', '0', '1', '0'])
  })
})

describe('the CSS filter', () => {
  it('has none for the plain view, and one for every other mode', () => {
    expect(visionFilterCss('none')).toBeUndefined()
    for (const mode of VISION_MODES.filter((m) => m !== 'none')) expect(visionFilterCss(mode)).toBeTruthy()
  })

  it('points a dichromacy at its own filter id', () => {
    expect(visionFilterCss('tritanopia')).toBe(`url(#${visionFilterId('tritanopia')})`)
  })
})

describe('the preference', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('falls back to the plain view on an unknown or unreadable value', () => {
    const store = new Map<string, string>([['mocky.vision', 'x-ray']])
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    })
    expect(readVision()).toBe('none')
    writeVision('blur')
    expect(readVision()).toBe('blur')
    writeVision('none')
    expect(store.has('mocky.vision')).toBe(false)

    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked')
      },
    })
    expect(readVision()).toBe('none')
  })
})
