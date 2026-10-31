import { describe, it, expect } from 'vitest'
import { CREATIVE_SECTION, CREATIVE_TEMPERATURE } from './creative'
import { joinSystem } from './pipeline/newScreen'

describe('Créatif — generation', () => {
  it('asks for bolder layout inside the direction, not for another one', () => {
    expect(CREATIVE_SECTION).toMatch(/Keep the direction/)
    expect(CREATIVE_TEMPERATURE).toBeGreaterThan(0.4)
    expect(CREATIVE_TEMPERATURE).toBeLessThan(1)
  })

  it('leaves Normal’s system prompt unchanged (an absent section joins to nothing)', () => {
    expect(joinSystem(['A', undefined, 'B', undefined])).toBe(joinSystem(['A', 'B']))
  })
})
