import {
  enforceableFindings,
  findingsSignature,
  findingsToPrompt,
  type QualityFinding,
  type QualityReport,
} from './quality'

/**
 * The correction loop: check, fix what was found, check again, stop.
 *
 * Written as a pure function over two injected calls — one that checks a screen
 * and one that rewrites it — so the interesting behaviour (does it converge?
 * does it stop?) can be tested without a provider or a server.
 *
 * The stopping conditions are the point of this module, and there are four.
 * Only one of them is the iteration budget; the other three exist because a
 * loop that only counts is a loop that can spend its whole budget making a
 * screen worse:
 *
 *   'clean'       nothing enforceable is left. The good ending.
 *   'no-progress' the pass came back with the same set of rules failing, or
 *                 with code it did not actually change. Asking a second time
 *                 produces the same answer, so it stops. This mirrors the guard
 *                 the render-error repair loop already uses, which bails when
 *                 an identical error comes back.
 *   'regressed'   the pass introduced more problems than it solved. The screen
 *                 from BEFORE that pass is kept and the loop stops. Without
 *                 this, a model having a bad day can hand back something worse
 *                 than what it was given and the loop will dutifully persist it.
 *   'budget'      the iteration cap was reached with findings still open.
 *
 * Progress is measured on the SET OF RULES failing, never on line numbers or
 * finding counts alone — see findingsSignature.
 */

export type PolishStop = 'clean' | 'no-progress' | 'regressed' | 'budget' | 'error'

export interface PolishPass {
  /** 1-based. */
  iteration: number
  /** Rule ids still failing after this pass. */
  signature: string
  /** How many enforceable findings remained. */
  remaining: number
}

export interface PolishOutcome<R extends PolishReport = QualityReport> {
  /** The best code the loop produced — never worse than what it was given. */
  code: string
  /** How many correction passes actually ran. */
  iterations: number
  /** Enforceable findings before the first pass. */
  initial: QualityFinding[]
  /** Enforceable findings still open when the loop stopped. */
  residual: QualityFinding[]
  /**
   * What the loop actually resolved: the initial findings whose rule no longer
   * appears in `residual`.
   *
   * This exists because `residual` alone cannot answer the only question a user
   * asks after a polish — "what did it change?". A converged run leaves
   * `residual` empty, which reads exactly like a run that found nothing to do.
   * The first version of this module reported both as "clean", and the
   * difference was invisible even though six things had been rewritten.
   */
  fixed: QualityFinding[]
  /** Every finding, enforceable or advisory, from the final check. */
  report: R | null
  stopped: PolishStop
  /** One entry per pass, for observability. */
  history: PolishPass[]
}

export const DEFAULT_MAX_ITERATIONS = 2

/**
 * Any report the loop can steer by.
 *
 * Generic, and deliberately narrow: the loop only ever reads `findings`, and
 * typing it to the quality pass's own report meant a second kind of check — the
 * SEO/accessibility audit — could not reuse the four stop conditions without
 * copying them. Two copies of "did this pass actually land" is exactly the
 * duplication that lets one of them drift.
 */
export interface PolishReport {
  findings: QualityFinding[]
}

export interface PolishDeps<R extends PolishReport = QualityReport> {
  /** Check a screen. Must resolve; see checkQuality. */
  check: (code: string) => Promise<R>
  /** Rewrite a screen given a rendered findings block. Returns the new source. */
  polish: (code: string, findingsBlock: string) => Promise<string>
  /** Called before each pass, for a progress label. */
  onPass?: (iteration: number, remaining: number) => void
}

export interface PolishOptions<R extends PolishReport = QualityReport> {
  maxIterations?: number
  /** A check already performed by the caller, so the loop does not repeat it. */
  initialReport?: R
  /**
   * The rule ids this run is answerable for. Absent means the whole report.
   *
   * Without it, a caller that asks for ONE finding to be fixed is measured
   * against a check that reports everything, and the two are not comparable.
   * The audit panel's per-finding button did exactly that: `open` held the one
   * rule the user clicked, `nextOpen` held all three the screen still had, and
   * `nextOpen.length > open.length` fired — so a correction that had genuinely
   * landed was thrown away, the original code was kept, and the panel reported
   * that there had been nothing to fix. One paid model call, discarded, with a
   * message saying the opposite of what happened.
   *
   * Scoping every measurement to the same set is what makes the three stop
   * conditions mean anything: they compare like with like, and progress is
   * still counted on rule ids, never on line numbers (Q3).
   *
   * `report` on the outcome stays the FULL report either way — the panel has to
   * go on showing what else the screen needs.
   */
  scope?: string[]
  signal?: AbortSignal
}

/**
 * Run the loop.
 *
 * Always resolves. A thrown check or a thrown correction stops the loop with
 * `stopped: 'error'` and returns the last good code — the screen is already on
 * the user's canvas and must survive a failed attempt to improve it.
 */
export async function runPolishLoop<R extends PolishReport = QualityReport>(
  code: string,
  deps: PolishDeps<R>,
  opts: PolishOptions<R> = {},
): Promise<PolishOutcome<R>> {
  const max = Math.max(0, Math.floor(opts.maxIterations ?? DEFAULT_MAX_ITERATIONS))
  const history: PolishPass[] = []

  let current = code
  let report: R | null = opts.initialReport ?? null

  /**
   * Narrow a report's findings to what this run answers for. See `scope`.
   *
   * Applied to BOTH sides of every comparison below, which is the whole point:
   * the bug it closes was measuring a subset against a full re-check.
   */
  const scope = opts.scope?.length ? new Set(opts.scope) : null
  const inScope = (findings: QualityFinding[]) =>
    scope ? findings.filter((f) => scope.has(f.rule)) : findings

  /**
   * Single exit point, so `fixed` is derived the same way on every path rather
   * than recomputed at each of the seven returns below.
   */
  const done = (
    out: Omit<PolishOutcome<R>, 'fixed' | 'history'> & { initial: QualityFinding[] },
  ): PolishOutcome<R> => {
    const stillOpen = new Set(out.residual.map((f) => f.rule))
    return { ...out, fixed: out.initial.filter((f) => !stillOpen.has(f.rule)), history }
  }

  try {
    if (!report) report = await deps.check(current)
  } catch {
    return done({ code: current, iterations: 0, initial: [], residual: [], report: null, stopped: 'error' })
  }

  let open = inScope(enforceableFindings(report.findings))
  const initial = open

  if (!open.length) {
    return done({ code: current, iterations: 0, initial, residual: [], report, stopped: 'clean' })
  }

  let iterations = 0

  while (iterations < max) {
    if (opts.signal?.aborted) break

    deps.onPass?.(iterations + 1, open.length)

    let candidate: string
    try {
      candidate = await deps.polish(current, findingsToPrompt(open))
    } catch {
      return done({ code: current, iterations, initial, residual: open, report, stopped: 'error' })
    }

    iterations += 1

    // Nothing came back, or nothing moved. Asking again gets the same answer.
    if (!candidate || !candidate.trim() || candidate.trim() === current.trim()) {
      history.push({ iteration: iterations, signature: findingsSignature(open), remaining: open.length })
      return done({ code: current, iterations, initial, residual: open, report, stopped: 'no-progress' })
    }

    let next: R
    try {
      next = await deps.check(candidate)
    } catch {
      // The rewrite may well be fine — it just could not be verified. Keeping
      // an unverified rewrite would be worse than keeping the checked original.
      return done({ code: current, iterations, initial, residual: open, report, stopped: 'error' })
    }

    const nextOpen = inScope(enforceableFindings(next.findings))
    history.push({ iteration: iterations, signature: findingsSignature(nextOpen), remaining: nextOpen.length })

    if (!nextOpen.length) {
      return done({ code: candidate, iterations, initial, residual: [], report: next, stopped: 'clean' })
    }

    // Worse than before this pass: keep what we had and stop.
    if (nextOpen.length > open.length) {
      return done({ code: current, iterations, initial, residual: open, report, stopped: 'regressed' })
    }

    // The same rules are still failing — the pass did not land.
    if (findingsSignature(nextOpen) === findingsSignature(open)) {
      return done({ code: candidate, iterations, initial, residual: nextOpen, report: next, stopped: 'no-progress' })
    }

    current = candidate
    report = next
    open = nextOpen
  }

  return done({ code: current, iterations, initial, residual: open, report, stopped: 'budget' })
}
