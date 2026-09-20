import { describe, it, expect } from 'vitest'
import { toggleSlot, closeSlot, type RightSlot } from './rightSlot'

/**
 * The defect these keep out: two panels in one place.
 *
 * `AuditPanel` and the Links list were both `absolute right-4 top-11` with no
 * z-index, and the Audit button cleared the Design System panel but not Link
 * mode. Opening Audit from Link mode drew them on top of each other and the
 * controls underneath stopped being clickable.
 */
describe('the canvas right-hand slot', () => {
  it('never holds two panels — opening one evicts whatever was there', () => {
    // The exact sequence that broke: Link mode open, then the Audit button.
    expect(toggleSlot('links', 'audit')).toBe('audit')
    // And every other pair, because the bug was never about those two panels in
    // particular — it was about which clears each author remembered to write.
    const all: NonNullable<RightSlot>[] = ['system', 'audit', 'links']
    for (const from of all) {
      for (const to of all) {
        if (from === to) continue
        expect(toggleSlot(from, to)).toBe(to)
      }
    }
  })

  it('closes on a second press of the same button', () => {
    expect(toggleSlot('audit', 'audit')).toBe(null)
    expect(toggleSlot(null, 'audit')).toBe('audit')
  })

  /**
   * A close handler survives its own panel by a render — React runs the click
   * before the unmount. An unconditional `setSlot(null)` in the Links list would
   * therefore close the Audit panel that had just replaced it.
   */
  it('a panel close button only ever closes that panel', () => {
    expect(closeSlot('audit', 'links')).toBe('audit')
    expect(closeSlot('links', 'links')).toBe(null)
    expect(closeSlot(null, 'system')).toBe(null)
  })
})
