/**
 * The free plan: who pays for a generation.
 *
 * Every account is on one of two plans. `standard` is what every account was
 * before this file existed: the instance's own text model, its image and video
 * generators, paid for by whoever holds the keys. `free` spends nothing but the
 * server's hardware — its text goes to the administrator's FREE model, its
 * pictures and footage come from the free libraries, and the paid generators
 * answer it with a refusal. It is what lets an instance open its sign-ups to
 * strangers without opening its wallet to them.
 *
 * Four rules, each the reason something below is written the way it is:
 *
 *  - The plan is read off the ACCOUNT, on the server. Never off a header or a
 *    body: anything the browser says about what it is allowed to spend, a
 *    curious person edits.
 *  - The free profile has NO fallback onto the paid one. `resolveTextTarget`
 *    lets 'inspiration' borrow 'generation' when it is empty, which is right for
 *    a second model and exactly wrong here: an unconfigured free model would
 *    have quietly billed every free account to the instance. With no free model
 *    a free account falls back to its own browser Settings — its own key, which
 *    costs the instance nothing — or to nothing at all.
 *  - An account with no `plan` field is standard. Every account created before
 *    the free plan existed has none, and waking up on a new version to find the
 *    family's accounts downgraded is not an upgrade.
 *  - An administrator is never free unless they ask to be, for themselves:
 *    they are the one configuring and testing the paid models, and a plan that
 *    locks them out of their own instance's keys protects nothing. What they
 *    may want is to SEE the free plan — the model, the limit, the refusals —
 *    without making a second account, so `testPlan` is their own switch
 *    (Admin → Accounts). It is not `plan`: no route sets it on someone else,
 *    and an account that stops being an administrator stops reading it.
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

export const PLANS = ['free', 'standard']

/**
 * What an instance does until its administrator says otherwise: new accounts
 * start free, with twenty generations a day.
 *
 * Free by default because the dangerous mistake is the other one — an admin who
 * opens sign-ups to show the instance to a friend should not have to remember a
 * second switch to keep strangers off the paid model. Twenty because a shared
 * free key is SMALL: OpenRouter gives a key with no credit 50 calls a day, and
 * one screen is several calls.
 */
export const DEFAULT_FREE_PLAN = Object.freeze({ newAccounts: 'free', dailyLimit: 20 })

/** Upper bound on the daily limit an admin can type; a typo of 2000000 is not a setting. */
export const MAX_DAILY_LIMIT = 10_000

/**
 * The plan an account is on. Unknown or missing → standard; an administrator →
 * standard, unless they switched on the free plan for themselves (`testPlan`).
 */
export function planOf(user) {
  if (!user) return 'standard'
  if ((user.role || 'user') === 'admin') return user.testPlan === 'free' ? 'free' : 'standard'
  return user.plan === 'free' ? 'free' : 'standard'
}

/** The free-plan settings stored in config.json, normalised. */
export function freePlanSettings(config) {
  const raw = config && typeof config.freePlan === 'object' && config.freePlan ? config.freePlan : {}
  const newAccounts = PLANS.includes(raw.newAccounts) ? raw.newAccounts : DEFAULT_FREE_PLAN.newAccounts
  const n = Number(raw.dailyLimit)
  const dailyLimit = Number.isInteger(n) && n >= 0 && n <= MAX_DAILY_LIMIT ? n : DEFAULT_FREE_PLAN.dailyLimit
  return { newAccounts, dailyLimit }
}

/**
 * Apply an admin's patch. Fields that are absent or invalid keep their value —
 * a form that sends one field must not reset the other.
 */
export function mergeFreePlanSettings(current, patch) {
  const base = freePlanSettings({ freePlan: current })
  const p = patch && typeof patch === 'object' ? patch : {}
  const out = { ...base }
  if (PLANS.includes(p.newAccounts)) out.newAccounts = p.newAccounts
  const n = Number(p.dailyLimit)
  if (p.dailyLimit !== undefined && p.dailyLimit !== null && Number.isInteger(n) && n >= 0 && n <= MAX_DAILY_LIMIT) {
    out.dailyLimit = n
  }
  return out
}

/**
 * Model calls that count as a GENERATION against the daily limit: the ones a
 * person asked for, each of which rewrites a screen. The calls that serve them
 * — the planner, a repair, reading a screenshot, choosing a photo — ride along,
 * or one new screen would cost four generations and nobody could predict their
 * own day. The purposes are the closed list of server/admin/activity.js.
 */
export const COUNTED_PURPOSES = new Set(['generate', 'edit', 'polish', 'audit-fix', 'fit'])

/**
 * Every call made on the shared free model counts against a second, hidden
 * ceiling: the daily limit times this. The purpose header is the browser's word,
 * and a browser that labels every call `plan` would otherwise never spend a
 * generation. Generous on purpose — a screen with Muse, the planner and two
 * repairs is under ten calls — so an honest account never meets it.
 */
export const CALLS_PER_GENERATION = 12

/** Today's date on the SERVER's clock, as the quota's key: it resets at local midnight. */
function dayOf(date) {
  const p = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`
}

/**
 * What each free account spent today, on disk.
 *
 * On disk and not in memory because a restart — an update, a crash, the
 * container being moved — would otherwise hand every account a fresh day. One
 * small file rewritten atomically, like every other store here; yesterday's
 * entries are dropped the first time today is read, so it never grows past one
 * line per account that worked today.
 */
export class FreeQuota {
  /** @param {string} dataDir @param {{ now?: () => Date }} [opts] */
  constructor(dataDir, { now = () => new Date() } = {}) {
    this.file = path.join(dataDir, 'free-quota.json')
    this.now = now
  }

  _read() {
    const today = dayOf(this.now())
    try {
      const raw = JSON.parse(fs.readFileSync(this.file, 'utf8'))
      if (raw && raw.day === today && raw.users && typeof raw.users === 'object') return raw
    } catch {
      // Missing or unreadable: a fresh day. Losing a count errs toward the
      // account, which is the safe direction for a counter that only throttles.
    }
    return { day: today, users: {} }
  }

  _write(state) {
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true })
      const tmp = `${this.file}.${crypto.randomBytes(6).toString('hex')}.tmp`
      fs.writeFileSync(tmp, JSON.stringify(state), { mode: 0o600 })
      fs.renameSync(tmp, this.file)
    } catch (err) {
      // Degrade, never fail (Q1): the call goes through, the count lives on in
      // memory for this one request, and the log says why it did not persist.
      console.error(`mocky: could not save the free-plan quota to ${this.file} — ${err.message}`)
    }
  }

  /** What `userId` spent today: `{ generations, calls }`. */
  usage(userId) {
    const u = this._read().users[userId]
    return { generations: Number(u?.g) || 0, calls: Number(u?.c) || 0 }
  }

  /**
   * Spend one call — and one generation when `generation` is set — if the day
   * allows it. Checked and recorded in one step, so two tabs racing cannot both
   * take the last one. `limit` 0 means unlimited: nothing is refused, and
   * nothing is written either.
   *
   * Once the generations are spent, EVERY call is refused, not only the counted
   * ones: otherwise the next new screen would still run its direction and its
   * planner on the shared key, and only then fail — spending a stranger's share
   * of the day to produce an error.
   *
   * @returns {{ ok: boolean, used: number, limit: number }}
   */
  take(userId, limit, { generation = false } = {}) {
    if (!limit) return { ok: true, used: 0, limit: 0 }
    const state = this._read()
    const cur = state.users[userId] || { g: 0, c: 0 }
    const g = Number(cur.g) || 0
    const c = Number(cur.c) || 0
    if (g >= limit || c >= limit * CALLS_PER_GENERATION) return { ok: false, used: g, limit }
    state.users[userId] = { g: g + (generation ? 1 : 0), c: c + 1 }
    this._write(state)
    return { ok: true, used: state.users[userId].g, limit }
  }
}

/**
 * The refusal a free account meets when its day is spent, in the language its
 * browser asked for. The `code` is what the client keys on; the words are for
 * whoever reads the error as it is.
 */
export function quotaRefusal(req, limit) {
  const en = /^en\b/i.test(String(req?.headers?.['accept-language'] || ''))
  return {
    code: 'free-quota',
    limit,
    error: en
      ? `Daily limit reached: the free plan allows ${limit} generations a day. It resets at midnight.`
      : `Limite du jour atteinte : le forfait gratuit permet ${limit} générations par jour. Le compteur repart à minuit.`,
  }
}

/** The refusal for a paid generator (images, video) on the free plan. */
export function paidRefusal(req) {
  const en = /^en\b/i.test(String(req?.headers?.['accept-language'] || ''))
  return {
    code: 'free-plan',
    error: en
      ? 'Not on the free plan: pictures come from the free photo libraries. An administrator can move your account to the standard plan.'
      : 'Pas avec le forfait gratuit : les images viennent des banques de photos libres. Un administrateur peut passer votre compte au forfait standard.',
  }
}
