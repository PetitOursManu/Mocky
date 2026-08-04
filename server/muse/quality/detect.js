/**
 * Deterministic anti-pattern detection over a generated screen.
 *
 * Wraps the `impeccable` package (Apache-2.0, github.com/pbakaus/impeccable),
 * which ships 59 deterministic rules for the visual tells of machine-written
 * UI. We use exactly one of its engines, `detectText`, and none of its agentic
 * layer.
 *
 * Why `detectText` and not the richer engines:
 *
 *   - It is synchronous and takes the source as a STRING. Mocky already holds
 *     the generated screen in memory; the alternative, `detectHtml`, reads from
 *     disk (`fs.readFileSync`) and would mean writing a temp file per check.
 *   - It reports a `line` and a `snippet` pointing into the generated JSX. That
 *     is what makes the correction pass possible at all: a finding the model
 *     can locate is a finding it can fix. The browser engine sees a rendered
 *     DOM with no path back to the source, so its findings could be shown but
 *     never repaired.
 *   - It needs no DOM, no jsdom, no headless browser. The runtime dependency
 *     set stays pure JavaScript, which is the project's standing posture (see
 *     "No database, no native dependencies" in docs/architecture/invariants.md).
 *
 * The import is dynamic and cached. Importing Muse must stay free when the
 * feature is unused (invariant M1), and this module is reached only when a
 * quality run is actually requested.
 */

import { applyPolicy } from './policy.js'

/** Cached module namespace, or null until the first successful import. */
let mod = null
/** Set once the import has failed, so we stop retrying on every call. */
let importFailed = false

/**
 * Load the detector, once. Returns null when it is unavailable — a missing or
 * broken optional-ish dependency degrades the quality pass to "no deterministic
 * findings", it never fails the run (invariant Q1).
 */
async function loadDetector() {
  if (mod) return mod
  if (importFailed) return null
  try {
    mod = await import('impeccable')
    return mod
  } catch {
    importFailed = true
    return null
  }
}

/**
 * Normalize one detector finding into Mocky's shape.
 *
 * The detector keys the rule as `antipattern`; the browser build of the same
 * package keys it as `id`. Neither name survives here — everything downstream
 * reads `rule`, so the two engines could be merged later without touching the
 * consumers.
 */
function normalize(raw) {
  return {
    rule: raw.antipattern,
    source: 'impeccable',
    name: raw.name || raw.antipattern,
    description: raw.description || '',
    severity: raw.advisory ? 'advisory' : raw.severity || 'warning',
    category: raw.category || 'slop',
    line: Number.isFinite(raw.line) && raw.line > 0 ? raw.line : undefined,
    snippet: raw.snippet || undefined,
  }
}

/**
 * Run deterministic detection over one generated screen.
 *
 * @param {string} code            The generated component source (JSX).
 * @param {object} [opts]
 * @param {boolean} [opts.hasDirection]  Whether the project has an established
 *   art direction. Flips the taste-related rules from enforce to advise, see
 *   policy.js.
 * @param {(msg: string) => void} [opts.onNotice]  Soft-failure channel, the
 *   same one the Inspiration Engine uses (invariant M3).
 *
 * @returns {Promise<{findings: object[], ignored: string[], available: boolean}>}
 *   `available` is false when the detector could not be loaded, which lets the
 *   caller distinguish "clean screen" from "never checked".
 */
export async function detectQuality(code, opts = {}) {
  const { hasDirection = false, onNotice } = opts

  if (typeof code !== 'string' || !code.trim()) {
    return { findings: [], ignored: [], available: true }
  }

  const detector = await loadDetector()
  if (!detector) {
    onNotice?.('Anti-pattern detector unavailable — deterministic checks were skipped.')
    return { findings: [], ignored: [], available: false }
  }

  let raw
  try {
    // The filename is what tells the detector how to read the content. Mocky
    // generates a JSX component, so it is named as one; nothing is written.
    raw = detector.detectText(code, 'screen.jsx')
  } catch (err) {
    onNotice?.(`Anti-pattern detection failed: ${err instanceof Error ? err.message : String(err)}`)
    return { findings: [], ignored: [], available: false }
  }

  const normalized = (Array.isArray(raw) ? raw : []).map(normalize).filter((f) => f.rule)
  return { ...applyPolicy(normalized, { hasDirection }), available: true }
}

/**
 * The findings a correction pass is allowed to act on.
 *
 * Advisory findings are deliberately excluded: they are shown to the user but
 * never spent an iteration on. See policy.js for why each one is demoted.
 */
export function enforceable(findings) {
  return findings.filter((f) => f.disposition === 'enforce')
}

/**
 * A stable signature of a finding set, used by the correction loop to decide
 * whether a pass made progress.
 *
 * Rule ids only, sorted and deduplicated — deliberately NOT line numbers. A
 * rewrite that fixes nothing still shifts every line, and comparing lines would
 * read that as progress and keep burning iterations.
 */
export function signature(findings) {
  return Array.from(new Set(findings.map((f) => f.rule))).sort().join(',')
}
