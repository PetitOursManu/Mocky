import { describe, it, expect } from 'vitest'
import { withAnimations } from './animations'
import { ANIMATION_LEVELS, buildAnimationInstruction } from './generate'
import { resolveCapabilities } from './capabilities/select'
import { ANIMATE_EXPORTS, ANIMATE_PRESETS, ANIMATED_TEXT_PRESETS } from './capabilities/snippets/Animate'
import { MOTION_EXPORTS } from './capabilities/snippets/Motion'

describe('page animations are always offered', () => {
  it('adds the animation vocabulary to any shortlist', () => {
    expect(withAnimations(['icons', 'charts'])).toEqual(['icons', 'charts', 'animate', 'motion-lib'])
  })

  it('never duplicates what is already there, and does not touch the input', () => {
    const ids = ['icons', 'animate', 'motion-lib']
    expect(withAnimations(ids)).toEqual(['icons', 'animate', 'motion-lib'])
    const input = ['icons']
    withAnimations(input)
    expect(input).toEqual(['icons'])
  })
})

/*
 * "Add animations" named the retired pack's components for a long time. That
 * pack is the one the capability documentation skips, so the model had the names
 * and no signature. A name written here and absent from what the model is shown
 * fails in silence: an unknown preset renders a plain element.
 */
describe('the "Add animations" instruction', () => {
  const instructions = ANIMATION_LEVELS.map((level) => buildAnimationInstruction(level))

  it('names only presets of the catalogue', () => {
    const known = new Set<string>([...ANIMATE_PRESETS, ...ANIMATED_TEXT_PRESETS])
    for (const text of instructions) {
      const named = [...text.matchAll(/preset="([^"]+)"/g)].map((m) => m[1])
      expect(named.length).toBeGreaterThan(0)
      for (const preset of named) expect(known.has(preset), preset).toBe(true)
    }
  })

  it('names only components the model is documented', () => {
    const known = new Set<string>(ANIMATE_EXPORTS)
    for (const text of instructions) {
      for (const [, name] of text.matchAll(/<([A-Z][A-Za-z]*)/g)) expect(known.has(name), name).toBe(true)
    }
  })

  it('never asks for a component of the retired pack', () => {
    for (const text of instructions) {
      for (const name of MOTION_EXPORTS) expect(text).not.toMatch(new RegExp(`\\b${name}\\b`))
    }
  })

  it('comes with a vocabulary that is documented, not a retired one', () => {
    const caps = resolveCapabilities(withAnimations([]))
    expect(caps.map((c) => c.id)).toEqual(['animate', 'motion-lib'])
    expect(caps.some((c) => c.retired)).toBe(false)
  })
})
