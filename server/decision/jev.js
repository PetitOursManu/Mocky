// The client for TypeSafe's System One API — the one Jev answers on.
//
// POST <base>/v1/systemone with a `state` (any JSON value) and `questions`
// keyed by name; the answers come back under the same names
// (https://docs.typesafe.ai/api). Mocky's question shapes (questions.js) map
// onto theirs one to one:
//
//   score   → `score`,  criteria = the levels, worst first (position = value)
//   check   → `noul`,   criteria = { true, false } when the question gives them
//   choice  → `choice`, criteria = option key → what it means
//
// Nothing here degrades: a failure THROWS, with a `code`, and decide.js is
// where a failed call becomes a call to Muse's text model instead. Keeping the
// two apart is what lets the tests say "a 429 falls back" without a network.
import { readAnswer } from './questions.js'

export const SYSTEM_ONE_PATH = '/v1/systemone'

/**
 * The most state one call carries, in characters. Jev's default window is 64k
 * tokens for the state plus every question; source code runs at about three
 * and a half characters a token, so this leaves the questions their room
 * without asking for the slower, "less accurate" long-context mode.
 */
export const JEV_STATE_CHARS = 180_000

/** Mocky's questions, in TypeSafe's grammar. */
export function toSystemOneQuestions(questions) {
  const out = {}
  for (const q of questions) {
    if (q.type === 'score') out[q.id] = { type: 'score', instructions: q.instructions, criteria: q.levels }
    else if (q.type === 'check') {
      out[q.id] = {
        type: 'noul',
        instructions: q.instructions,
        ...(q.yes || q.no ? { criteria: { true: q.yes || null, false: q.no || null } } : {}),
      }
    } else if (q.type === 'choice') out[q.id] = { type: 'choice', instructions: q.instructions, criteria: q.options }
  }
  return out
}

/** One of TypeSafe's answers, in Mocky's shape — before `readAnswer` checks it. */
export function fromSystemOneAnswer(question, raw) {
  if (!raw || typeof raw !== 'object') return null
  if (question.type === 'score' && raw.type === 'score') {
    const p = raw.probabilities && typeof raw.probabilities === 'object' ? raw.probabilities : null
    return readAnswer(question, {
      value: raw.score,
      confidence: raw.confidence,
      probabilities: p ? question.levels.map((_, i) => p[String(i)]) : undefined,
    })
  }
  if (question.type === 'check' && raw.type === 'noul') return readAnswer(question, { value: raw.noul })
  if (question.type === 'choice' && raw.type === 'choice') {
    return readAnswer(question, { value: raw.choice, confidence: raw.confidence, probabilities: raw.probabilities })
  }
  return null
}

function fail(code, message) {
  const err = new Error(message)
  err.code = code
  return err
}

/**
 * One System One call.
 *
 * @param {{baseUrl:string, apiKey:string, model:string}} target  from config.js
 * @param {{state:any, questions:object[]}} req  questions already through `cleanQuestions`
 * @param {{fetchImpl?:typeof fetch, signal?:AbortSignal, timeoutMs?:number, onUsage?:(u:object)=>void}} [opts]
 * @returns {Promise<{answers:Record<string,object>, model:string}>}
 */
export async function askSystemOne(target, req, opts = {}) {
  const fetchImpl = opts.fetchImpl || fetch
  const questions = Array.isArray(req?.questions) ? req.questions : []
  if (!questions.length) return { answers: {}, model: target.model }
  const state = typeof req.state === 'string' ? req.state.slice(0, JEV_STATE_CHARS) : req.state

  const ctrl = new AbortController()
  // A decision is meant to take well under a second; twenty is a provider in
  // trouble, and the text model behind it is a better answer than a wait.
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 20_000)
  const onAbort = () => ctrl.abort()
  opts.signal?.addEventListener('abort', onAbort)
  try {
    let res
    try {
      res = await fetchImpl(`${target.baseUrl}${SYSTEM_ONE_PATH}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${target.apiKey}` },
        body: JSON.stringify({ model: target.model, state, questions: toSystemOneQuestions(questions) }),
        signal: ctrl.signal,
      })
    } catch (err) {
      throw fail(opts.signal?.aborted ? 'aborted' : 'unreachable', err instanceof Error ? err.message : String(err))
    }
    if (res.status === 401 || res.status === 403) throw fail('auth', `Decision model refused the key (HTTP ${res.status})`)
    if (res.status === 429 || res.status === 529) throw fail('busy', `Decision model is rate-limited (HTTP ${res.status})`)
    if (!res.ok) {
      // The detail can say `max_tokens_exceeded`; it never quotes the state back
      // in a way worth keeping, and only the code reaches a person.
      const text = await res.text().catch(() => '')
      throw fail(/max_tokens/.test(text) ? 'too-long' : 'http', `Decision model HTTP ${res.status}${text ? `: ${text.slice(0, 160)}` : ''}`)
    }
    const raw = await res.json().catch(() => null)
    if (!raw || typeof raw.answers !== 'object') throw fail('shape', 'Decision model returned no answers')
    if (typeof opts.onUsage === 'function') {
      try {
        const input = Math.max(0, Number(raw.usage?.input_tokens) || 0)
        const output = Math.max(0, Number(raw.usage?.output_tokens) || 0)
        opts.onUsage({
          model: typeof raw.model === 'string' ? raw.model : target.model,
          input,
          output,
          cost: typeof target.inputPricePerToken === 'number' ? input * target.inputPricePerToken : null,
          estimated: false,
        })
      } catch {
        /* counting never fails a call */
      }
    }
    const answers = {}
    for (const q of questions) {
      const a = fromSystemOneAnswer(q, raw.answers[q.id])
      if (a) answers[q.id] = a
    }
    return { answers, model: typeof raw.model === 'string' ? raw.model : target.model }
  } finally {
    clearTimeout(timer)
    opts.signal?.removeEventListener('abort', onAbort)
  }
}
