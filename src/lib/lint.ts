// Anti-slop lint (Muse §5.2). A post-generation guard that flags placeholder
// "slop" text in generated component code — most importantly "Lorem ipsum".
// The generation system prompt already forbids it and Muse supplies real copy,
// so this is a safety net: if it ever slips through, the run is flagged so the
// user can regenerate instead of shipping filler.
//
// Deliberately conservative to avoid false positives on legitimate copy.

const SLOP_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /lorem\s+ipsum/i, label: 'Lorem ipsum' },
  { re: /\bsample text\b/i, label: '“Sample text”' },
  { re: /\byour (?:text|content) here\b/i, label: '“Your text/content here”' },
  { re: /\bcontent goes here\b/i, label: '“Content goes here”' },
  { re: /\bplaceholder text\b/i, label: '“Placeholder text”' },
]

export interface SlopLintResult {
  ok: boolean
  violations: string[]
}

/** Scan generated code for placeholder slop. `ok` is false if any is found. */
export function lintSlop(code: string): SlopLintResult {
  const violations: string[] = []
  for (const p of SLOP_PATTERNS) {
    if (p.re.test(code)) violations.push(p.label)
  }
  return { ok: violations.length === 0, violations }
}
