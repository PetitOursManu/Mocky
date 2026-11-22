// The questions a decision is made of, and the answers it comes back as —
// one shape for every engine (decide.js), so an audit never knows which model
// answered it.
//
//   score   a scale given in WORDS, worst first: `levels[0]` is the bottom.
//           The answer's `value` is a position on it, possibly fractional
//           (a probability-weighted mean, as Jev returns it).
//   check   a yes/no. The answer's `value` is the probability of yes.
//   choice  one key out of `options` (key → what it means).
//
// Words and not numbers on a scale, because a number means nothing to a model
// that was never told what a 3 is — and nothing to a person reading the grid
// either. The ids are ours: they travel as the question's NAME, which neither
// engine shows to the model as instructions.

/** Up to ten levels on a scale (Jev's own bound), at least two. */
export const MAX_LEVELS = 10
/** Up to 255 options (Jev's own bound). */
export const MAX_OPTIONS = 255

const ID_RE = /^[a-z][a-z0-9_-]{0,63}$/i

const clip = (s, n) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n)

/**
 * A question list made safe to send: unknown types dropped, ids checked and
 * unique, text bounded. Returns what survived — an empty list is a decision
 * nobody needs to make.
 */
export function cleanQuestions(list) {
  const out = []
  const seen = new Set()
  for (const q of Array.isArray(list) ? list : []) {
    const id = typeof q?.id === 'string' ? q.id : ''
    if (!ID_RE.test(id) || seen.has(id)) continue
    const instructions = clip(q.instructions, 600)
    if (!instructions) continue
    if (q.type === 'score') {
      const levels = (Array.isArray(q.levels) ? q.levels : []).map((l) => clip(l, 240)).filter(Boolean).slice(0, MAX_LEVELS)
      if (levels.length < 2) continue
      out.push({ id, type: 'score', instructions, levels })
    } else if (q.type === 'check') {
      const yes = clip(q.yes, 240)
      const no = clip(q.no, 240)
      out.push({ id, type: 'check', instructions, ...(yes ? { yes } : {}), ...(no ? { no } : {}) })
    } else if (q.type === 'choice') {
      const entries = Object.entries(q.options && typeof q.options === 'object' ? q.options : {})
        .filter(([k]) => ID_RE.test(k))
        .slice(0, MAX_OPTIONS)
        .map(([k, v]) => [k, clip(v, 240)])
      if (entries.length < 2) continue
      out.push({ id, type: 'choice', instructions, options: Object.fromEntries(entries) })
    } else continue
    seen.add(id)
  }
  return out
}

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const unit = (v) => {
  const n = num(v)
  return n == null ? null : Math.min(1, Math.max(0, n))
}

/**
 * How sure a yes/no is, out of its probability alone: 0 at one chance in two,
 * 1 at certainty. Jev returns a confidence for a choice and a score but not for
 * a yes/no, and showing a yes/no with no measure of doubt is the one thing the
 * transparency rule forbids (docs/decision-model.md).
 */
export const checkConfidence = (p) => (p == null ? null : Math.abs(2 * p - 1))

/**
 * Read one answer against the question that was asked, or null when it does
 * not fit: a value off the scale, an option nobody offered, a type that is not
 * the one asked. An engine that invents an answer must not be able to put it
 * in a report.
 */
export function readAnswer(question, raw) {
  if (!question || !raw || typeof raw !== 'object') return null
  if (question.type === 'score') {
    const top = question.levels.length - 1
    const value = num(raw.value)
    if (value == null || value < 0 || value > top) return null
    const probabilities = Array.isArray(raw.probabilities) && raw.probabilities.length === question.levels.length
      ? raw.probabilities.map((p) => unit(p) ?? 0)
      : null
    return { type: 'score', value, max: top, confidence: unit(raw.confidence), probabilities }
  }
  if (question.type === 'check') {
    const value = unit(raw.value)
    if (value == null) return null
    return { type: 'check', value, confidence: raw.confidence === undefined ? checkConfidence(value) : unit(raw.confidence) }
  }
  if (question.type === 'choice') {
    const keys = Object.keys(question.options)
    if (typeof raw.value !== 'string' || !keys.includes(raw.value)) return null
    let probabilities = null
    if (raw.probabilities && typeof raw.probabilities === 'object') {
      probabilities = Object.fromEntries(keys.map((k) => [k, unit(raw.probabilities[k]) ?? 0]))
    }
    return { type: 'choice', value: raw.value, confidence: unit(raw.confidence), probabilities }
  }
  return null
}
