import { describe, it, expect, beforeEach } from 'vitest'
import {
  applyAnimationMode,
  loadAnimationMode,
  saveAnimationMode,
  nextAnimationMode,
} from './animations'

class MemoryStorage {
  private map = new Map<string, string>()
  getItem(k: string) {
    return this.map.has(k) ? (this.map.get(k) as string) : null
  }
  setItem(k: string, v: string) {
    this.map.set(k, String(v))
  }
  removeItem(k: string) {
    this.map.delete(k)
  }
  clear() {
    this.map.clear()
  }
}
const storage = new MemoryStorage()
// @ts-expect-error — the test environment is plain Node.
globalThis.localStorage = storage

beforeEach(() => storage.clear())

describe('the animation override', () => {
  it('defaults to auto, so Mocky keeps deciding', () => {
    expect(loadAnimationMode()).toBe('auto')
  })

  it('leaves the shortlist untouched in auto', () => {
    const ids = ['icons', 'charts']
    expect(applyAnimationMode(ids, 'auto')).toEqual(ids)
    expect(applyAnimationMode(['icons', 'animate', 'motion-lib'], 'auto')).toEqual([
      'icons',
      'animate',
      'motion-lib',
    ])
  })

  it('adds the vocabulary AND the library when forced on', () => {
    // <Animated> without Motion is a plain div; adding one without the other
    // would switch the feature on and give nothing.
    const out = applyAnimationMode(['icons'], 'on')
    expect(out).toContain('animate')
    expect(out).toContain('motion-lib')
  })

  it('does not duplicate what is already selected', () => {
    expect(applyAnimationMode(['animate', 'motion-lib'], 'on')).toEqual(['animate', 'motion-lib'])
  })

  it('removes the library too when switched off', () => {
    // Leaving motion-lib behind would load 129 kB into a preview with nothing
    // to animate.
    expect(applyAnimationMode(['icons', 'animate', 'motion-lib'], 'off')).toEqual(['icons'])
  })

  it('is harmless when nothing animation-related is selected', () => {
    expect(applyAnimationMode(['icons'], 'off')).toEqual(['icons'])
  })

  it('cycles auto → on → off → auto', () => {
    expect(nextAnimationMode('auto')).toBe('on')
    expect(nextAnimationMode('on')).toBe('off')
    expect(nextAnimationMode('off')).toBe('auto')
  })

  it('round-trips through storage and ignores nonsense', () => {
    saveAnimationMode('off')
    expect(loadAnimationMode()).toBe('off')
    storage.setItem('mocky.animations.v1', 'sideways')
    expect(loadAnimationMode()).toBe('auto')
  })
})
