/**
 * What Mocky does with each Impeccable rule.
 *
 * The detector ships 59 deterministic rules written for hand-authored product
 * code. Mocky's code is model-written, Tailwind-only, and — crucially — is
 * generated under a set of instructions of its own. Some of those instructions
 * contradict some of those rules. Enforcing everything blindly would mean the
 * correction loop spending its whole budget undoing what the generation prompt
 * just asked for, and losing.
 *
 * Two conflicts are not hypothetical, both verified against the shipped code:
 *
 *   1. `overused-font` fires on Inter — and `src/lib/design.ts` ships
 *      "Font: system-ui / Inter, sans-serif" as Mocky's own default DESIGN.md.
 *      Enforced as-is, every screen generated with the stock design system
 *      reports a violation of a choice Mocky made for the user.
 *
 *   2. `src/lib/generate.ts` tells the model, verbatim: "If an art direction is
 *      supplied below … its palette, radius and typography OVERRIDE every
 *      stylistic suggestion in these rules. Follow it exactly, even when it
 *      contradicts what you would otherwise choose."
 *
 *      That sentence settles the question. When a project has an established
 *      direction, a rule about which colours or typefaces are tasteful is not
 *      Mocky's call to make — the user already made it, and a screen that
 *      honours a violet direction is correct, not sloppy.
 *
 * Hence four dispositions rather than a boolean:
 *
 *   'enforce'    fix it — the correction loop is allowed to spend an iteration.
 *   'advise'     report it, never feed it to the loop, never fail the audit on
 *                it. The user sees it; the model is not asked to act.
 *   'ignore'     drop it entirely. Only for rules that are actively wrong here.
 *   'direction'  conditional: 'enforce' when the project has no established art
 *                direction, 'advise' when it does. This is the disposition that
 *                encodes generate.ts's override sentence.
 *
 * Anything not listed defaults to 'enforce'. That default is deliberate: a new
 * rule arriving in a future version of the detector should be applied, and
 * demoted only once someone can say why. Silence should not exempt a rule.
 */

/** Disposition per rule id. Unlisted ids default to `DEFAULT_DISPOSITION`. */
export const RULE_POLICY = {
  // --- Choices the project's art direction owns (generate.ts:50) -----------
  // Each of these judges taste in colour or type. With a direction in force,
  // taste has already been decided and the model was told to obey it.
  'ai-color-palette': { disposition: 'direction', reason: 'Palette is the direction\'s call; violet/cyan can be a deliberate brand choice.' },
  'cream-palette': { disposition: 'direction', reason: 'Same: a cream palette is a legitimate direction, not automatically slop.' },
  'overused-font': { disposition: 'direction', reason: 'Mocky\'s own default DESIGN.md specifies Inter (src/lib/design.ts).' },
  'gradient-text': { disposition: 'direction', reason: 'A direction may specify gradient display type; only generic when unmotivated.' },
  'dark-glow': { disposition: 'direction', reason: 'Glow on dark is a valid direction; the tell is glow as the ONLY art direction.' },
  'radial-halo': { disposition: 'direction', reason: 'A halo can be the deliberate background treatment a direction asked for.' },
  'radial-spotlight-glow': { disposition: 'direction', reason: 'A spotlight gradient is a legitimate hero treatment when the direction calls for one.' },
  'italic-serif-display': { disposition: 'direction', reason: 'Editorial directions legitimately use italic serif display type.' },
  'extreme-negative-tracking': { disposition: 'direction', reason: 'Tight tracking is a real editorial choice; the direction owns typography.' },

  // --- Rules Mocky cannot honour, or that measure something it does not have -
  'design-system-color': { disposition: 'ignore', reason: 'Needs a DESIGN.md on disk in the detector\'s own frontmatter format; Mocky\'s DESIGN.md is prose and its palette is enforced by the generation prompt instead.' },
  'design-system-font': { disposition: 'ignore', reason: 'Same — no on-disk DESIGN.md frontmatter to compare against.' },
  'design-system-radius': { disposition: 'ignore', reason: 'Same, and src/lib/muse.ts mandates ONE radius throughout ("Do not soften it"), which a radius-conformance rule would fight.' },
  'design-system-font-size': { disposition: 'ignore', reason: 'Same — no on-disk type ramp to compare against.' },
  'broken-image': { disposition: 'ignore', reason: 'Image slots are filled from the Muse image library by hash after generation (invariant M6); a src the detector cannot resolve is expected, not broken.' },
  'script-error': { disposition: 'ignore', reason: 'Render failures already have a dedicated, better path: the iframe error boundary feeds fixComponent (invariant I5).' },

  // --- Reported, but never worth an iteration of the correction loop -------
  'em-dash-overuse': { disposition: 'advise', reason: 'A real AI tell, but rewriting copy to dodge punctuation is a poor use of a correction pass.' },
  'aphoristic-cadence': { disposition: 'advise', reason: 'Judgement-heavy and prone to firing on legitimately terse UI copy.' },
  'marketing-buzzword': { disposition: 'advise', reason: 'Overlaps the dossier\'s Forbidden list, which already steers copy at generation time.' },
  'theater-slop-phrase': { disposition: 'advise', reason: 'Copy-level; the dossier owns voice.' },

  // --- The judged rules (server/muse/quality/catalog.js) -------------------
  //
  // They belong here too, and for a better reason than symmetry: they are the
  // most opinionated rules in the system. "Blur is decoration, not layering"
  // and "that radius is too large for that card" are taste calls, and a project
  // whose direction genuinely wants a glass treatment should be able to say so
  // without arguing with the correction loop every time.
  //
  // Listing one as 'ignore' means the question is never even asked, which also
  // saves the tokens. Unlisted — the state below — means 'enforce', so the
  // catalogue works out of the box.
  //
  // To keep a treatment the judge dislikes, add its id here. For example:
  //
  //   'glassmorphism-everywhere': { disposition: 'ignore', reason: 'This product\'s direction is built on frosted layers.' },
  //   'extreme-card-radius': { disposition: 'advise', reason: 'Large radii are part of the brand; report, do not rewrite.' },
}

/** Disposition for any rule the table above does not mention. */
export const DEFAULT_DISPOSITION = 'enforce'

/**
 * Resolve a rule's disposition for one particular run.
 *
 * `hasDirection` is the only context that matters: it flips every 'direction'
 * rule between 'enforce' and 'advise'. Everything else is static.
 */
export function dispositionFor(ruleId, { hasDirection = false } = {}) {
  const entry = RULE_POLICY[ruleId]
  if (!entry) return DEFAULT_DISPOSITION
  if (entry.disposition === 'direction') return hasDirection ? 'advise' : 'enforce'
  return entry.disposition
}

/** The human-readable justification, or null when the rule takes the default. */
export function reasonFor(ruleId) {
  return RULE_POLICY[ruleId]?.reason ?? null
}

/**
 * Apply the policy to a list of normalized findings.
 *
 * Returns the findings that survive, each tagged with its disposition, plus the
 * ids that were dropped so the caller can report the fact rather than silently
 * shrinking the list. Nothing here throws: a quality run can never fail a
 * generation (invariant Q1).
 */
export function applyPolicy(findings, { hasDirection = false } = {}) {
  const kept = []
  const ignored = []
  for (const f of findings) {
    const disposition = dispositionFor(f.rule, { hasDirection })
    if (disposition === 'ignore') {
      ignored.push(f.rule)
      continue
    }
    kept.push({ ...f, disposition })
  }
  return { findings: kept, ignored }
}
