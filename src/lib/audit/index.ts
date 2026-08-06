/**
 * Evaluating a screen for SEO and accessibility, and correcting it.
 *
 * WHERE IT RUNS, AND WHY THAT IS DIFFERENT FROM THE QUALITY PASS
 *
 * The quality pass detects on the SERVER, because its detector (`impeccable`)
 * reads `node:fs` at import and cannot be bundled for a browser at all. These
 * rules are Mocky's own and are pure markup analysis over an AST Babel already
 * parses in the browser — so they run here. That is worth more than symmetry:
 * an evaluation with no round trip is instant, works with the backend down, and
 * costs nothing, which is what makes it reasonable to offer as the default and
 * put the model behind a second, explicit button.
 *
 * WHAT THE DEEP PASS ADDS
 *
 * The deterministic half can see that an `alt` exists. It cannot see whether it
 * describes the picture, whether a heading describes the section under it, or
 * whether link text would still make sense read out of context. Those are
 * judgement calls, and they are what `POST /api/muse/audit` asks a model.
 * Optional, explicit, and — invariant Q1 — never able to make the evaluation
 * fail: a deep pass that cannot run degrades to the deterministic report with
 * a notice attached.
 *
 * WHAT IT NEVER CLAIMS
 *
 * No conformance level. Contrast, focus visibility, reflow and target size are
 * properties of a rendered page, and nothing here renders anything (Q4). Every
 * dimension reports `confidence: 'partial'` and the panel says what that means.
 */

import type { QualityFinding } from '../quality'
import { proxyHeaders } from '../proxy'
import type { Settings } from '../settings'
import { inspectScreen } from './inspect'
import {
  RULE_FAMILIES,
  runRules,
  scoreDimension,
  scoreFamilies,
  toFindings,
  type AuditFamily,
  type DimensionScore,
  type FamilyScore,
} from './rules'

export type { AuditDimension, AuditFamily, DimensionScore, FamilyScore, FamilyState } from './rules'
export { RULES, RULE_FAMILIES } from './rules'

export interface AuditReport {
  /** Every finding, enforceable and advisory alike. */
  findings: QualityFinding[]
  seo: DimensionScore
  a11y: DimensionScore
  /**
   * The same findings, cut by what they are ABOUT rather than by which number
   * they move — one entry per declared family, always in the same order.
   *
   * Beside `seo` and `a11y`, never instead of them. Those two are what the user
   * has been reading since the panel shipped, and re-deriving them from a new
   * arrangement would change what a familiar number means without saying so.
   *
   * A family carries no score at all when nothing was examined (Q4). "Nothing
   * to check here" and "checked and clean" are the same empty finding list and
   * opposite facts, and only one of them has earned a 100.
   */
  families: FamilyScore[]
  /**
   * False when Babel could not read the source. The panel says "could not be
   * read" rather than "no problems found": a clean bill of health for a file
   * nobody could open is the worst answer available.
   */
  parsed: boolean
  /** Whether the model half contributed. Named after `coverage` in the quality audit (Q4). */
  coverage: { deterministic: boolean; judged: boolean }
  /** Soft failures — a deep pass that could not run says so here. */
  notices: string[]
}

/** What the panel shows about the project's exported HTML, as opposed to a screen. */
export interface ExportReport {
  findings: QualityFinding[]
}

export interface AuditOptions {
  /** Ask the model the questions a regex cannot settle. Off by default. */
  deep?: boolean
  /** Required when `deep` is on — the proxy needs to know which endpoint to call. */
  settings?: Settings
  signal?: AbortSignal
}

/**
 * Evaluate one screen.
 *
 * Never throws (Q1). Anything that goes wrong becomes a notice on an otherwise
 * honest report — an evaluation failing must never look like the screen failing.
 */
export async function auditScreen(code: string, opts: AuditOptions = {}): Promise<AuditReport> {
  const facts = await inspectScreen(code)
  const hits = facts.parsed ? runRules(facts) : []
  const findings = toFindings(hits)
  const notices: string[] = []
  let judged = false
  // Which family each judged finding belongs to, when the route said so. Empty
  // is the ordinary case — no deep pass ran, or the server predates the field —
  // and the cost is contained: those findings still show in the list and still
  // move the dimension scores, they simply move no family's number.
  let judgedFamilies: Record<string, AuditFamily> = {}

  if (opts.deep && facts.parsed) {
    try {
      const deep = await judgeScreen(code, opts)
      findings.push(...deep.findings)
      judgedFamilies = deep.families
      // From the route, never from the fact that it answered. It answers 200
      // with an empty list when no model is configured, when the provider
      // failed, and when the answer could not be used — and claiming those as
      // "judged" is the one thing Q4 forbids: a screen nobody looked at would
      // read exactly like a spotless one.
      judged = deep.judged
      notices.push(...deep.notices)
    } catch (err) {
      // Degrade, never fail: the deterministic half is a complete report on its
      // own, and losing it because the model was unreachable would be absurd.
      notices.push(err instanceof Error ? err.message : String(err))
    }
  }

  return {
    findings,
    seo: scoreDimension(findings, 'seo'),
    a11y: scoreDimension(findings, 'a11y'),
    families: scoreFamilies(findings, facts, judgedFamilies),
    parsed: facts.parsed,
    coverage: { deterministic: facts.parsed, judged },
    notices,
  }
}

/**
 * The dictionary key for one judged question's label.
 *
 * Derived from the rule id rather than listed, so adding a ninth question to
 * `server/muse/quality/audit-questions.js` cannot leave the browser with a
 * label it has no key for. The cost of deriving is that a missing translation
 * shows as `audit.judged.somethingNew` — which is a visible bug report, and the
 * behaviour the i18n module deliberately chose over rendering an empty string.
 */
const judgedKey = (rule: string) =>
  `audit.judged.${rule.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase())}`

/**
 * The judged half: questions a pattern cannot settle.
 *
 * The screen's source travels as DATA, in the `user` turn, under a header that
 * says so — invariant Q5, and the same discipline as `critique.js`. A verdict
 * naming a rule that was never asked about is dropped rather than shown: a
 * model inventing rule ids is how a report starts containing things nobody
 * wrote.
 */
async function judgeScreen(
  code: string,
  opts: AuditOptions,
): Promise<{
  findings: QualityFinding[]
  notices: string[]
  judged: boolean
  families: Record<string, AuditFamily>
}> {
  const res = await fetch('/api/muse/audit', {
    method: 'POST',
    // Without settings the route still answers: an admin-configured instance
    // model needs no headers from the browser, and one that has neither says
    // so in its own reply rather than being called with half a configuration.
    headers: { 'content-type': 'application/json', ...(opts.settings ? proxyHeaders(opts.settings) : {}) },
    // `model` in the BODY, which is where the server looks first and the only
    // place it finds it: `proxyHeaders` sends the base URL, the dialect and the
    // key, but never the model name. Without this line `credsFromReq` returned
    // null for every browser-configured provider, so the deep pass could not
    // run at all under "your key stays in your browser" — the default setup.
    // `checkQuality` has always sent it; this route was written without it.
    body: JSON.stringify({ code, model: opts.settings?.model }),
    signal: opts.signal,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.error ? String(data.error) : `HTTP ${res.status}`)
  const raw = Array.isArray(data?.findings) ? data.findings : []
  const notices = Array.isArray(data?.notices) ? data.notices.map((n: unknown) => String(n)) : []
  // Older servers predate the field. Treating a missing `judged` as false is
  // the safe direction: it under-claims coverage instead of inventing it.
  const judged = data?.judged === true
  const findings = raw
    .filter((f: any) => f && typeof f.rule === 'string' && typeof f.description === 'string')
    .map(
      (f: any): QualityFinding => ({
        rule: String(f.rule),
        source: 'critique',
        /**
         * An i18n key for the label, the model's own words for the detail.
         *
         * The two halves have different natures and were being treated alike.
         * The eight question NAMES are fixed strings from a catalogue on the
         * server — they are as translatable as any deterministic rule, and
         * sending them through raw printed "Headings describe their sections"
         * in the middle of a French panel. The `note`, on the other hand, is
         * something a model wrote about this particular screen: prose, in
         * whatever language it answered in, and not a key to anything.
         *
         * `t()` returns an unknown key unchanged, so one expression serves
         * both: the label resolves, the note passes through. Same convention
         * `findingsToPrompt` relies on to reach English for the fix prompt.
         */
        name: judgedKey(String(f.rule)),
        // Empty when the model gave no note. The server used to fall back to
        // the question we asked it — so the panel showed the prompt, answering
        // instruction included, as if it were the explanation of the defect.
        description: String(f.description || '').trim()
          ? String(f.description).slice(0, 400)
          : `${judgedKey(String(f.rule))}Desc`,
        severity: f.severity === 'error' ? 'error' : f.severity === 'advisory' ? 'advisory' : 'warning',
        category: f.dimension === 'seo' ? 'seo' : f.dimension === 'a11y' ? 'a11y' : 'seo+a11y',
        dimension: f.dimension === 'seo' ? 'seo' : 'a11y',
        priority: 'P2',
        // Judged findings advise. They are the ones most likely to be a matter
        // of taste, and the correction loop measures progress by rule id — a
        // rule only a model can see is a rule only a model can confirm fixed.
        disposition: 'advise',
      }),
    )
    .slice(0, 12)

  // The family the question catalogue declared, checked against the families
  // this side knows. Same discipline as dropping a verdict naming an unasked
  // rule: a name the browser cannot place is dropped rather than filed under a
  // heading invented to hold it, and the finding still shows in the list.
  const families: Record<string, AuditFamily> = {}
  const known = new Set<string>(RULE_FAMILIES.map((f) => f.id))
  for (const f of raw) {
    if (typeof f?.rule !== 'string' || typeof f?.family !== 'string') continue
    if (known.has(f.family)) families[f.rule] = f.family as AuditFamily
  }

  return { findings, notices, judged, families }
}

/**
 * What the project's exported HTML says for itself.
 *
 * A Mocky screen has no `<head>`, so the document-level half of SEO — the title,
 * the description, the language — exists only in what `buildProjectFiles`
 * writes. This checks that real output rather than a description of it, so the
 * report follows the template if the template changes.
 *
 * Project-level, not per-screen: the same `index.html` backs every screen, and
 * repeating three identical findings on each of them would bury the ones that
 * are actually about the screen in front of you.
 */
export async function auditExport(
  projectName: string,
  opts: { lang?: string; description?: string } = {},
): Promise<ExportReport> {
  const { indexHtml } = await import('../export/project')
  const html = indexHtml(projectName, opts)
  const findings: QualityFinding[] = []

  const head = (rule: string, name: string, desc: string, severity: 'error' | 'warning'): QualityFinding => ({
    rule,
    source: 'mocky',
    name,
    description: desc,
    severity,
    category: 'seo',
    dimension: 'seo',
    priority: severity === 'error' ? 'P1' : 'P2',
    // Nothing here is fixable by rewriting a screen, so no correction pass may
    // spend an iteration trying.
    disposition: 'advise',
  })

  const title = /<title>([^<]*)<\/title>/.exec(html)?.[1]?.trim() ?? ''
  if (!title) findings.push(head('export-title', 'audit.rule.exportTitle', 'audit.rule.exportTitleDesc', 'error'))
  if (!/<meta\s+name="description"/i.test(html)) {
    findings.push(head('export-description', 'audit.rule.exportDesc', 'audit.rule.exportDescDesc', 'warning'))
  }
  if (!/<html[^>]+lang="[a-z]{2}/i.test(html)) {
    findings.push(head('export-lang', 'audit.rule.exportLang', 'audit.rule.exportLangDesc', 'error'))
  }
  return { findings }
}
