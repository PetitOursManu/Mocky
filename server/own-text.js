// An account that chose its OWN text provider over the instance's.
//
// The browser always sent its own provider, key and model, and the server threw
// them away whenever an administrator had configured one: on an instance with a
// model, nobody could use a key of their own, even one they paid for. This is
// the per-account switch that keeps them instead. It is read in ONE place —
// `textTargetFor` in server/index.js — so the proxy, Muse, film composition,
// vision, `/api/config` and the activity tracker all follow without knowing.
//
// What the server holds is what the administrator is shown, and nothing more:
// the provider's id and the model's name, as the person's Settings declare
// them. The key never leaves the browser — this record is not a credential, and
// with it set the calls are addressed with the key the browser sends, behind
// the same SSRF guard as before (a personal key cannot reach a private address).
//
// The administrator can close the door for everybody (`ownKeys: false` in
// config.json). An account that had opted in then goes back to the instance's
// model on its next call; its record is kept, so reopening the door restores it.
import { TEXT_PROVIDER_IDS } from './text/config.js'

const MAX_MODEL = 200
// Model ids are slugs with separators: `openai/gpt-4o-mini`, `gpt-oss:120b`,
// `accounts/fireworks/models/x`. Nothing else is shown to an administrator.
const MODEL_CHARS = /^[\w.:/@+-]*$/

/** Whether personal keys are allowed on this instance. On unless an administrator closed it. */
export function ownKeysAllowed(cfg) {
  return cfg?.ownKeys !== false
}

/** Whether `user` answers with its own key right now. */
export function usesOwnText(user, cfg) {
  return Boolean(user?.ownText) && ownKeysAllowed(cfg)
}

/**
 * The record kept on the account, from what Settings sent — or null when the
 * body does not describe a provider a person can choose. `fal` is the one
 * administrator-only entry: it authenticates with `Key`, and the browser
 * transport only speaks `Bearer`.
 */
export function cleanOwnText(body, now = Date.now()) {
  const provider = String(body?.provider || '')
  if (!TEXT_PROVIDER_IDS.includes(provider) || provider === 'fal') return null
  const model = String(body?.model || '').trim().slice(0, MAX_MODEL)
  return { provider, model: MODEL_CHARS.test(model) ? model : '', at: now }
}

/** What the administrator's list shows of it: no date, nothing else. */
export function ownTextView(user, cfg) {
  if (!usesOwnText(user, cfg)) return null
  return { provider: user.ownText.provider, model: user.ownText.model || null }
}
