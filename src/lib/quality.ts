import { loadSettings, type Settings } from './settings'
import { proxyHeaders } from './proxy'
import { lintSlop } from './lint'
import { translate, type TranslationKey } from '../i18n'

/**
 * The quality pass, from the browser's side.
 *
 * Detection itself runs on the server (see server/muse/quality/) because the
 * detector is a Node module — it reads `node:fs` at import — and because a
 * megabyte of rule engine has no business in a bundle whose previews are the
 * product. This module calls it, folds in the one check that has always run
 * locally, and hands back a single list.
 *
 * `lintSlop` stays exactly where it was. It is five regexes over a string: it
 * costs nothing, needs no network, and catches the one thing the detector has
 * no rule for — "Lorem ipsum" and its friends. Rather than move it server-side
 * or reimplement it there, its violations are lifted into the same shape as
 * everything else and merged. One list, one banner, one loop.
 *
 * Nothing here throws. A quality run happens after a generation has already
 * succeeded; a failure to check the screen must never look like a failure to
 * make it (invariant Q1).
 */

export type QualitySource = 'impeccable' | 'critique' | 'mocky'
export type QualitySeverity = 'error' | 'warning' | 'advisory'
export type QualityDisposition = 'enforce' | 'advise'
export type QualityPriority = 'P0' | 'P1' | 'P2' | 'P3'

export interface QualityFinding {
  /** Stable rule id, e.g. 'side-tab', 'three-feature-cards', 'lorem-ipsum'. */
  rule: string
  source: QualitySource
  name: string
  description: string
  severity: QualitySeverity
  category: string
  /** Which audit dimension it counts against. */
  dimension?: string
  priority?: QualityPriority
  /** Whether a correction pass may spend an iteration on it. */
  disposition?: QualityDisposition
  /** 1-based line in the generated source, when the rule points at one. */
  line?: number
  snippet?: string
}

export interface QualityDimension {
  score: number
  max: number
  findings: number
  confidence: 'low' | 'medium' | 'high'
  confidenceNote: string
}

export interface QualityAudit {
  score: number
  max: number
  band: 'excellent' | 'good' | 'acceptable' | 'poor' | 'critical'
  dimensions: Record<string, QualityDimension>
  counts: Record<QualityPriority, number>
  findings: QualityFinding[]
  coverage: { deterministic: boolean; judged: boolean }
}

export interface QualityReport {
  findings: QualityFinding[]
  audit: QualityAudit
  notices: string[]
  /** Rules the policy dropped for this project. */
  ignored: string[]
}

/** The five placeholder patterns lintSlop knows, keyed for the merged list. */
const SLOP_RULE_IDS: Record<string, string> = {
  'Lorem ipsum': 'lorem-ipsum',
  '“Sample text”': 'sample-text',
  '“Your text/content here”': 'your-text-here',
  '“Content goes here”': 'content-goes-here',
  '“Placeholder text”': 'placeholder-text',
}

/** Lift a lintSlop violation into a QualityFinding. */
function slopFinding(label: string): QualityFinding {
  return {
    rule: SLOP_RULE_IDS[label] || 'placeholder-text',
    source: 'mocky',
    name: 'Placeholder text',
    description: `${label} was left in the generated copy.`,
    // Filler text is the one thing the generation prompt promises outright not
    // to produce, so it is reported as an error rather than a warning.
    severity: 'error',
    category: 'slop',
    dimension: 'antiPatterns',
    priority: 'P0',
    disposition: 'enforce',
  }
}

/** An empty report, used whenever the server half could not contribute. */
function emptyAudit(): QualityAudit {
  return {
    score: 20,
    max: 20,
    band: 'excellent',
    dimensions: {},
    counts: { P0: 0, P1: 0, P2: 0, P3: 0 },
    findings: [],
    coverage: { deterministic: false, judged: false },
  }
}

export interface QualityOptions {
  /** The project has an established art direction — demotes the taste rules. */
  hasDirection?: boolean
  /** Run the judged pass. Costs one model call; on by default. */
  critique?: boolean
  signal?: AbortSignal
  settings?: Settings
}

/**
 * Check one generated screen.
 *
 * Always resolves. When the server half fails, the report still carries the
 * local placeholder findings and records that the deterministic pass did not
 * run, so "clean" and "not checked" stay distinguishable.
 */
export async function checkQuality(code: string, opts: QualityOptions = {}): Promise<QualityReport> {
  const local = lintSlop(code).violations.map(slopFinding)
  const s = opts.settings ?? loadSettings()

  let server: Partial<QualityReport> | null = null
  const notices: string[] = []

  try {
    const res = await fetch('/api/muse/quality', {
      method: 'POST',
      headers: proxyHeaders(s),
      body: JSON.stringify({
        code,
        model: s.model,
        hasDirection: opts.hasDirection === true,
        critique: opts.critique !== false,
      }),
      signal: opts.signal,
    })
    if (res.ok) {
      server = (await res.json()) as QualityReport
    } else {
      notices.push(`Quality check unavailable (HTTP ${res.status}).`)
    }
  } catch (err) {
    // An aborted check is the user cancelling, not a failure worth reporting.
    if (!(err instanceof Error && err.name === 'AbortError')) {
      notices.push(`Quality check unavailable (${err instanceof Error ? err.message : String(err)}).`)
    }
  }

  const serverFindings = Array.isArray(server?.findings) ? server!.findings : []
  const findings = [...local, ...serverFindings]

  return {
    findings,
    audit: withLocalFindings(server?.audit ?? emptyAudit(), local, findings),
    notices: [...(server?.notices ?? []), ...notices],
    ignored: server?.ignored ?? [],
  }
}

/**
 * Fold the locally-found placeholders into the server's score.
 *
 * The server scored what it could see, and it never saw these. Rebuilt rather
 * than patched in place: the input is a parsed response, and quietly editing
 * one is the kind of shared-object surprise that only shows up later.
 */
function withLocalFindings(
  audit: QualityAudit,
  local: QualityFinding[],
  all: QualityFinding[],
): QualityAudit {
  if (!local.length) return audit

  const dimensions: Record<string, QualityDimension> = {}
  for (const [name, d] of Object.entries(audit.dimensions)) {
    dimensions[name] =
      name === 'antiPatterns'
        ? {
            ...d,
            findings: d.findings + local.length,
            // Placeholder text is a P0, and a P0 costs 2 (see audit.js).
            score: Math.max(0, d.score - 2 * local.length),
          }
        : { ...d }
  }

  const scored = Object.values(dimensions)
  return {
    ...audit,
    dimensions,
    // Only recomputable when the server actually reported dimensions; with none
    // (the server half failed) the local findings are still listed, and the
    // score stays what it was rather than being invented from one dimension.
    score: scored.length ? scored.reduce((sum, d) => sum + d.score, 0) : audit.score,
    counts: { ...audit.counts, P0: audit.counts.P0 + local.length },
    findings: all,
  }
}

/** The findings a correction pass is allowed to act on. */
export function enforceableFindings(findings: QualityFinding[]): QualityFinding[] {
  return findings.filter((f) => f.disposition === 'enforce')
}

/**
 * A stable signature of a finding set.
 *
 * Rule ids only, sorted — never line numbers. A rewrite that fixes nothing
 * still shifts every line, and a loop comparing lines would read that as
 * progress and keep spending iterations on it.
 */
export function findingsSignature(findings: QualityFinding[]): string {
  return Array.from(new Set(findings.map((f) => f.rule))).sort().join(',')
}

/**
 * Render findings into the instruction block a correction pass receives.
 *
 * Findings with a line are pointed at; judged findings, which are about the
 * screen rather than a token in it, are described. Both end up as one numbered
 * list so the model is not asked to reconcile two formats.
 */
export function findingsToPrompt(findings: QualityFinding[]): string {
  /**
   * Resolve an i18n key to English, and pass prose through untouched.
   *
   * The audit rules carry KEYS in `name`/`description` so the panel can render
   * them in the reader's language (src/lib/audit/rules.ts). The model must not
   * see those: `1. [img-alt] audit.rule.imgAlt: audit.rule.imgAltDesc` tells it
   * the id and nothing else — not what is wrong, and not the part that matters
   * most here, that `alt=""` is the right answer for a decorative image. The
   * fix button spent a model call to be told an identifier.
   *
   * English rather than the reader's language, so one screen does not get a
   * different instruction from another because someone changed the UI language.
   *
   * `translate` returns the key unchanged when it is not one, which is exactly
   * the fallback the quality-pass findings need — theirs are already sentences
   * (`lintSlop`, `critique.js`), which is why this was never needed before.
   */
  const en = (s: string) => translate('en', s as TranslationKey)
  return findings
    .map((f, i) => {
      const where = f.line ? ` (line ${f.line}${f.snippet ? `, near \`${f.snippet}\`` : ''})` : ''
      return `${i + 1}. [${f.rule}]${where} ${en(f.name)}: ${en(f.description)}`
    })
    .join('\n')
}
