import { describe, it, expect } from 'vitest'
import { autoGrowHeight } from './useAutoGrow'

describe('a field as tall as its text', () => {
  it('shows every line between the floor and the ceiling, border included', () => {
    expect(autoGrowHeight(120, 2, 66, 240)).toBe(122)
  })

  it('keeps the floor when empty and stops at the ceiling', () => {
    expect(autoGrowHeight(40, 2, 66, 240)).toBe(66)
    expect(autoGrowHeight(900, 2, 66, 240)).toBe(240)
  })
})
