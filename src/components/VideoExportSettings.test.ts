import { describe, it, expect } from 'vitest'
import {
  REMOTION_FREE_TIER_SEATS,
  exposedAccountCount,
  licenceReminderDue,
} from './VideoExportSettings'

/**
 * The licence reminder is legal text, so what makes it appear is worth pinning
 * down. Every case below is a way the banner was wrong, or would have been.
 *
 * Only the two pure helpers are exercised: rendering the panel needs a DOM and
 * a server, and neither would say anything more about the rule than this does.
 */
describe('exposedAccountCount', () => {
  it('counts the whole instance under "everyone", not the empty allowlist', () => {
    // The trap: 'all' leaves allowedUserIds untouched, so a count that read the
    // list would report 0 for the widest setting the panel offers.
    expect(exposedAccountCount('all', [], 12)).toBe(12)
  })

  it('counts the ticked accounts under "allowlist", not the instance', () => {
    expect(exposedAccountCount('allowlist', ['a', 'b'], 40)).toBe(2)
  })
})

describe('licenceReminderDue', () => {
  const many = ['a', 'b', 'c', 'd']

  it('stays quiet at the free tier ceiling', () => {
    // Inclusive: three accounts is the free tier, not one past it.
    expect(licenceReminderDue(true, 'allowlist', ['a', 'b', 'c'], 9)).toBe(false)
    expect(REMOTION_FREE_TIER_SEATS).toBe(3)
  })

  it('appears one account past it', () => {
    expect(licenceReminderDue(true, 'allowlist', many, 9)).toBe(true)
  })

  it('appears under "everyone" as soon as the instance is over the ceiling', () => {
    expect(licenceReminderDue(true, 'all', [], 4)).toBe(true)
    expect(licenceReminderDue(true, 'all', [], 3)).toBe(false)
  })

  /**
   * An instance with the master switch off renders nothing, so there is no
   * licensed render to have an opinion about. Raising the question there is how
   * an administrator learns to dismiss the banner — including on the day the
   * switch goes on and it matters.
   */
  it('says nothing while export is disabled, however wide the scope', () => {
    expect(licenceReminderDue(false, 'all', [], 500)).toBe(false)
    expect(licenceReminderDue(false, 'allowlist', many, 500)).toBe(false)
  })
})
