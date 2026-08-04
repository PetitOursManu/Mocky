/**
 * Scoring: turn a pile of findings into a report someone can act on.
 *
 * The structure follows the audit rubric Impeccable publishes — five
 * dimensions, each scored 0–4, findings tagged P0 to P3, a health score out of
 * 20 with named bands. The rubric is a documented idea, not code; what is below
 * is written for Mocky's findings and Mocky's engines.
 *
 * One departure, and it is the important one: every dimension also reports a
 * CONFIDENCE. Mocky runs the source engine only, which reads the generated JSX
 * as text. That engine is strong on theming and on the visual tells of
 * machine-written UI, because those live in class names it can see. It is weak
 * on accessibility and responsiveness, because contrast ratios, line lengths
 * and overflow are properties of a RENDERED page — they need computed styles
 * and geometry, which no amount of reading the source will produce.
 *
 * Without that field the report would happily award 4/4 for accessibility to a
 * screen nobody checked for accessibility. A score whose basis is not stated is
 * worse than no score, so the basis is stated.
 */

/** The five dimensions, in report order. */
export const DIMENSIONS = ['accessibility', 'performance', 'theming', 'responsive', 'antiPatterns']

/**
 * Which dimension each rule speaks to.
 *
 * Rules absent from this map land in `antiPatterns`, which is the right default:
 * the detector's whole `slop` category is about the tells of machine-written UI,
 * and that is what the fifth dimension measures.
 */
const RULE_DIMENSION = {
  // --- accessibility ---
  'low-contrast': 'accessibility',
  'gray-on-color': 'accessibility',
  'tiny-text': 'accessibility',
  'undersized-ui-text': 'accessibility',
  'skipped-heading': 'accessibility',
  'all-caps-body': 'accessibility',
  'justified-text': 'accessibility',
  'text-occlusion': 'accessibility',
  'content-hidden-at-rest': 'accessibility',
  'wide-tracking': 'accessibility',
  'tight-leading': 'accessibility',

  // --- performance ---
  'layout-transition': 'performance',
  marquee: 'performance',
  'pulsing-dot': 'performance',
  'blinking-cursor': 'performance',
  'image-hover-transform': 'performance',
  'bounce-easing': 'performance',

  // --- theming ---
  'ai-color-palette': 'theming',
  'cream-palette': 'theming',
  'overused-font': 'theming',
  'gradient-text': 'theming',
  'dark-glow': 'theming',
  'radial-halo': 'theming',
  'radial-spotlight-glow': 'theming',
  'flat-type-hierarchy': 'theming',
  'italic-serif-display': 'theming',
  'extreme-negative-tracking': 'theming',
  'oversized-h1': 'theming',
  'design-system-color': 'theming',
  'design-system-font': 'theming',
  'design-system-radius': 'theming',
  'design-system-font-size': 'theming',
  'default-shadcn-look': 'theming',

  // --- responsive ---
  'line-length': 'responsive',
  'cramped-padding': 'responsive',
  'body-text-viewport-edge': 'responsive',
  'text-overflow': 'responsive',
  'first-viewport-column-overflow': 'responsive',
  'clipped-overflow-container': 'responsive',
  'edge-flush-cards': 'responsive',
}

/**
 * How much the engines Mocky actually runs can see of each dimension.
 *
 * Source-only detection reads class names and inline styles. That covers
 * theming and the slop tells almost completely, catches the animation-cost
 * rules that are visible as CSS, and barely touches anything that depends on
 * how the page came out. The judged rules add composition, which is why
 * antiPatterns stays high.
 */
const DIMENSION_CONFIDENCE = {
  accessibility: 'low',
  performance: 'medium',
  theming: 'high',
  responsive: 'low',
  antiPatterns: 'high',
}

/** What each confidence level means, carried in the report so it travels. */
export const CONFIDENCE_NOTE = {
  low: 'Source-only analysis. Most rules in this dimension need a rendered page (computed styles, geometry) and were not evaluated.',
  medium: 'Source-only analysis. Rules visible as CSS were evaluated; those needing a rendered page were not.',
  high: 'Well covered by source analysis — these rules live in the class names and structure.',
}

/** Priority tag for one finding, following the published P0–P3 vocabulary. */
export function priorityOf(finding) {
  if (finding.severity === 'error') return 'P0'
  if (finding.disposition === 'advise' || finding.severity === 'advisory') {
    return finding.severity === 'advisory' ? 'P3' : 'P2'
  }
  return 'P1'
}

/** What each priority costs the dimension it lands in. */
const PENALTY = { P0: 2, P1: 1, P2: 0.5, P3: 0.25 }

/** The band a 0–20 health score falls into. */
export function bandFor(score) {
  if (score >= 18) return 'excellent'
  if (score >= 14) return 'good'
  if (score >= 10) return 'acceptable'
  if (score >= 6) return 'poor'
  return 'critical'
}

export function dimensionOf(ruleId) {
  return RULE_DIMENSION[ruleId] || 'antiPatterns'
}

/**
 * Build the audit report.
 *
 * @param {object[]} findings  Merged findings (deterministic + judged), each
 *   already carrying `rule`, `severity` and `disposition`.
 * @param {{critiqueAvailable?: boolean, detectAvailable?: boolean}} [context]
 * @returns {object} A plain JSON report. No UI is implied by any of it.
 */
export function buildAudit(findings, context = {}) {
  const list = Array.isArray(findings) ? findings : []

  const dimensions = {}
  for (const name of DIMENSIONS) {
    dimensions[name] = {
      score: 4,
      max: 4,
      findings: 0,
      confidence: DIMENSION_CONFIDENCE[name],
      confidenceNote: CONFIDENCE_NOTE[DIMENSION_CONFIDENCE[name]],
    }
  }

  const tagged = []
  const penalties = Object.fromEntries(DIMENSIONS.map((d) => [d, 0]))

  for (const f of list) {
    const priority = priorityOf(f)
    const dimension = f.dimension && dimensions[f.dimension] ? f.dimension : dimensionOf(f.rule)
    tagged.push({ ...f, priority, dimension })
    penalties[dimension] += PENALTY[priority]
    dimensions[dimension].findings += 1
  }

  for (const name of DIMENSIONS) {
    const raw = 4 - penalties[name]
    dimensions[name].score = Math.max(0, Math.min(4, Math.round(raw)))
  }

  const score = DIMENSIONS.reduce((sum, name) => sum + dimensions[name].score, 0)

  const counts = { P0: 0, P1: 0, P2: 0, P3: 0 }
  for (const f of tagged) counts[f.priority] += 1

  return {
    score,
    max: 20,
    band: bandFor(score),
    dimensions,
    counts,
    findings: tagged,
    // Stated so a consumer can tell "clean" from "not looked at".
    coverage: {
      deterministic: context.detectAvailable !== false,
      judged: context.critiqueAvailable === true,
    },
  }
}
