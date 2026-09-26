import { describe, it, expect } from 'vitest'
import { withAnimations } from './animations'

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
