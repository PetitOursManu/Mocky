import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  planOf,
  freePlanSettings,
  mergeFreePlanSettings,
  FreeQuota,
  DEFAULT_FREE_PLAN,
  CALLS_PER_GENERATION,
  MAX_DAILY_LIMIT,
  quotaRefusal,
  paidRefusal,
} from './plan.js'

let dir
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mocky-plan-'))
})
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

describe('planOf', () => {
  it('reads free only off an ordinary account that says so', () => {
    expect(planOf({ role: 'user', plan: 'free' })).toBe('free')
    expect(planOf({ plan: 'free' })).toBe('free') // a missing role is a user
  })

  // Every account created before the free plan existed has no field at all.
  it('an account with no plan is standard — nobody is downgraded by an upgrade', () => {
    expect(planOf({ role: 'user' })).toBe('standard')
    expect(planOf({ role: 'user', plan: 'gold' })).toBe('standard')
    expect(planOf(null)).toBe('standard')
  })

  it('an administrator is free only by their own test switch, never by `plan`', () => {
    expect(planOf({ role: 'admin', plan: 'free' })).toBe('standard')
    expect(planOf({ role: 'admin', testPlan: 'free' })).toBe('free')
    expect(planOf({ role: 'admin', testPlan: 'gold' })).toBe('standard')
  })

  // A test switch left on by someone who is no longer an administrator must not
  // make them a free user — `plan` is what decides that, and it was never set.
  it('a demoted administrator stops reading the test switch', () => {
    expect(planOf({ role: 'user', testPlan: 'free' })).toBe('standard')
  })
})

describe('free-plan settings', () => {
  it('defaults to free newcomers and twenty a day', () => {
    expect(freePlanSettings({})).toEqual(DEFAULT_FREE_PLAN)
    expect(freePlanSettings(null)).toEqual({ newAccounts: 'free', dailyLimit: 20 })
  })

  it('refuses nonsense rather than storing it', () => {
    expect(freePlanSettings({ freePlan: { newAccounts: 'gold', dailyLimit: -3 } })).toEqual(DEFAULT_FREE_PLAN)
    expect(freePlanSettings({ freePlan: { dailyLimit: 2.5 } }).dailyLimit).toBe(20)
    expect(freePlanSettings({ freePlan: { dailyLimit: MAX_DAILY_LIMIT + 1 } }).dailyLimit).toBe(20)
  })

  it('a patch with one field keeps the other, and 0 is a real value (unlimited)', () => {
    const a = mergeFreePlanSettings({ newAccounts: 'standard', dailyLimit: 5 }, { dailyLimit: 0 })
    expect(a).toEqual({ newAccounts: 'standard', dailyLimit: 0 })
    const b = mergeFreePlanSettings(a, { newAccounts: 'free' })
    expect(b).toEqual({ newAccounts: 'free', dailyLimit: 0 })
    expect(mergeFreePlanSettings(b, { dailyLimit: 'lots' })).toEqual(b)
    expect(mergeFreePlanSettings(b, { dailyLimit: null })).toEqual(b)
  })
})

describe('FreeQuota', () => {
  it('counts generations up to the limit, then refuses', () => {
    const q = new FreeQuota(dir)
    expect(q.take('u1', 2, { generation: true })).toMatchObject({ ok: true, used: 1 })
    expect(q.take('u1', 2, { generation: true })).toMatchObject({ ok: true, used: 2 })
    expect(q.take('u1', 2, { generation: true })).toMatchObject({ ok: false, used: 2, limit: 2 })
    expect(q.usage('u1')).toEqual({ generations: 2, calls: 2 })
  })

  // Spending the shared key on a planner call whose screen can only be refused
  // is spending somebody else's share of the day for an error message.
  it('once the generations are spent, every call is refused, counted or not', () => {
    const q = new FreeQuota(dir)
    q.take('u1', 1, { generation: true })
    expect(q.take('u1', 1).ok).toBe(false)
  })

  it('calls that serve a screen ride along, up to a hidden ceiling', () => {
    const q = new FreeQuota(dir)
    for (let i = 0; i < CALLS_PER_GENERATION; i++) expect(q.take('u1', 1).ok).toBe(true)
    expect(q.usage('u1')).toEqual({ generations: 0, calls: CALLS_PER_GENERATION })
    // A browser that labels every call as a planner call still meets a wall.
    expect(q.take('u1', 1).ok).toBe(false)
  })

  it('accounts are counted apart', () => {
    const q = new FreeQuota(dir)
    q.take('u1', 1, { generation: true })
    expect(q.take('u2', 1, { generation: true }).ok).toBe(true)
  })

  it('0 means unlimited, and an unlimited day writes nothing', () => {
    const q = new FreeQuota(dir)
    for (let i = 0; i < 50; i++) expect(q.take('u1', 0, { generation: true }).ok).toBe(true)
    expect(fs.existsSync(path.join(dir, 'free-quota.json'))).toBe(false)
  })

  // A restart must not hand every account a fresh day.
  it('survives a restart', () => {
    new FreeQuota(dir).take('u1', 3, { generation: true })
    expect(new FreeQuota(dir).usage('u1').generations).toBe(1)
  })

  it('starts over the next day, on the server’s own clock', () => {
    let now = new Date(2026, 9, 10, 23, 59)
    const q = new FreeQuota(dir, { now: () => now })
    q.take('u1', 1, { generation: true })
    expect(q.take('u1', 1, { generation: true }).ok).toBe(false)
    now = new Date(2026, 9, 11, 0, 1)
    expect(q.usage('u1')).toEqual({ generations: 0, calls: 0 })
    expect(q.take('u1', 1, { generation: true }).ok).toBe(true)
  })

  it('a corrupt file reads as a fresh day instead of throwing', () => {
    fs.writeFileSync(path.join(dir, 'free-quota.json'), '{not json')
    expect(new FreeQuota(dir).take('u1', 1, { generation: true }).ok).toBe(true)
  })
})

describe('refusals', () => {
  it('carry a code the client keys on, in the language the browser asked for', () => {
    const fr = quotaRefusal({ headers: { 'accept-language': 'fr-FR,fr;q=0.9' } }, 20)
    expect(fr).toMatchObject({ code: 'free-quota', limit: 20 })
    expect(fr.error).toMatch(/20 générations par jour/)
    expect(quotaRefusal({ headers: { 'accept-language': 'en-US' } }, 20).error).toMatch(/20 generations a day/)
    expect(paidRefusal({ headers: {} }).code).toBe('free-plan')
  })
})
