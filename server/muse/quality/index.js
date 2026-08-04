/**
 * The quality pass, assembled.
 *
 * Three steps, in order, each of which is allowed to contribute nothing:
 *
 *   1. `detectQuality`  — deterministic rules over the generated source.
 *   2. `critiqueScreen` — one model call for the rules a regex cannot settle.
 *   3. `buildAudit`     — score what came back, and say what was not looked at.
 *
 * The whole thing is a Muse stage in the sense that matters: it degrades. A
 * missing detector, an absent model, a provider that times out — each removes a
 * contribution and adds a notice, and the run still returns a report. Nothing
 * here is permitted to throw at the caller, because the caller is a generation
 * that has already succeeded (invariant Q1).
 */

import { detectQuality } from './detect.js'
import { critiqueScreen } from './critique.js'
import { buildAudit } from './audit.js'

export { detectQuality, enforceable, signature } from './detect.js'
export { critiqueScreen } from './critique.js'
export { buildAudit, DIMENSIONS, priorityOf, bandFor } from './audit.js'
export { JUDGED_RULES } from './catalog.js'
export { RULE_POLICY, dispositionFor, applyPolicy } from './policy.js'

/**
 * @param {object} args
 * @param {string} args.code            The generated component source.
 * @param {boolean} [args.hasDirection] Project has an established art direction.
 * @param {boolean} [args.critique]     Run the judged pass (needs a model).
 * @param {object} deps
 * @param {((req:object)=>Promise<any>)|null} [deps.llm]
 * @param {AbortSignal} [deps.signal]
 */
export async function runQuality(args, deps = {}) {
  const notices = []
  const onNotice = (m) => notices.push(m)

  const code = typeof args?.code === 'string' ? args.code : ''
  const hasDirection = args?.hasDirection === true
  const wantCritique = args?.critique !== false

  const detected = await detectQuality(code, { hasDirection, onNotice })

  let judged = { findings: [], verdicts: [], available: false }
  if (wantCritique) {
    judged = await critiqueScreen(deps.llm || null, code, { hasDirection, onNotice, signal: deps.signal })
  }

  const audit = buildAudit([...detected.findings, ...judged.findings], {
    detectAvailable: detected.available,
    critiqueAvailable: judged.available,
  })

  return {
    // `audit.findings` is the same list, tagged with priority and dimension —
    // one list, so a consumer never has to reconcile two.
    findings: audit.findings,
    audit,
    verdicts: judged.verdicts,
    // Rules the policy dropped for this project, so "why didn't it flag X" has
    // an answer that does not require reading policy.js.
    ignored: detected.ignored,
    notices,
  }
}
