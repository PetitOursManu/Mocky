import { describe, it, expect, vi } from 'vitest'
import { runPolishLoop, DEFAULT_MAX_ITERATIONS } from './polish'
import type { QualityFinding, QualityReport } from './quality'

function finding(rule: string, over: Partial<QualityFinding> = {}): QualityFinding {
  return {
    rule,
    source: 'impeccable',
    name: rule,
    description: `${rule} description`,
    severity: 'warning',
    category: 'slop',
    disposition: 'enforce',
    ...over,
  }
}

function report(findings: QualityFinding[]): QualityReport {
  return {
    findings,
    audit: {
      score: 20 - findings.length,
      max: 20,
      band: 'good',
      dimensions: {},
      counts: { P0: 0, P1: findings.length, P2: 0, P3: 0 },
      findings,
      coverage: { deterministic: true, judged: false },
    },
    notices: [],
    ignored: [],
  }
}

/**
 * A check that returns a scripted sequence of finding-sets, one per call, and
 * repeats the last forever. Lets a test describe "first pass finds two, second
 * finds one, third finds none" without any transport.
 */
function scriptedCheck(sequence: string[][]) {
  let call = 0
  return vi.fn(async () => {
    const rules = sequence[Math.min(call, sequence.length - 1)]
    call += 1
    return report(rules.map((r) => finding(r)))
  })
}

/** A correction that just appends a marker, so the code always changes. */
function markingPolish() {
  let n = 0
  return vi.fn(async (code: string) => {
    n += 1
    return `${code}\n// pass ${n}`
  })
}

describe('runPolishLoop — convergence', () => {
  it('stops immediately when the screen is already clean', async () => {
    const check = scriptedCheck([[]])
    const polish = vi.fn(async (c: string) => c)
    const out = await runPolishLoop('const a = 1', { check, polish })

    expect(out.stopped).toBe('clean')
    expect(out.iterations).toBe(0)
    expect(polish).not.toHaveBeenCalled()
    expect(out.residual).toEqual([])
  })

  it('converges: findings are fixed and the loop reports clean', async () => {
    // Two findings, then one, then none.
    const check = scriptedCheck([['side-tab', 'gradient-text'], ['side-tab'], []])
    const polish = markingPolish()
    const out = await runPolishLoop('SCREEN', { check, polish }, { maxIterations: 3 })

    expect(out.stopped).toBe('clean')
    expect(out.residual).toEqual([])
    expect(out.iterations).toBe(2)
    expect(out.initial.map((f) => f.rule)).toEqual(['side-tab', 'gradient-text'])
    // The converged code is the one that checked clean.
    expect(out.code).toContain('// pass 2')
    expect(out.history[out.history.length - 1]).toEqual({ iteration: 2, signature: '', remaining: 0 })
  })

  it('keeps the corrected code when it converges on the first pass', async () => {
    const check = scriptedCheck([['side-tab'], []])
    const polish = markingPolish()
    const out = await runPolishLoop('SCREEN', { check, polish })

    expect(out.stopped).toBe('clean')
    expect(out.iterations).toBe(1)
    expect(out.code).toBe('SCREEN\n// pass 1')
  })
})

describe('runPolishLoop — budget', () => {
  it('stops at the iteration budget with findings still open', async () => {
    // Always one fewer, but never zero: real progress, never finished.
    const check = scriptedCheck([
      ['a', 'b', 'c', 'd', 'e'],
      ['a', 'b', 'c', 'd'],
      ['a', 'b', 'c'],
      ['a', 'b'],
      ['a'],
    ])
    const polish = markingPolish()
    const out = await runPolishLoop('SCREEN', { check, polish }, { maxIterations: 2 })

    expect(out.stopped).toBe('budget')
    expect(out.iterations).toBe(2)
    expect(polish).toHaveBeenCalledTimes(2)
    expect(out.residual.map((f) => f.rule)).toEqual(['a', 'b', 'c'])
    expect(out.history).toHaveLength(2)
  })

  it('honours a budget of zero by checking but never correcting', async () => {
    const check = scriptedCheck([['side-tab']])
    const polish = vi.fn(async (c: string) => c)
    const out = await runPolishLoop('SCREEN', { check, polish }, { maxIterations: 0 })

    expect(out.stopped).toBe('budget')
    expect(out.iterations).toBe(0)
    expect(polish).not.toHaveBeenCalled()
    expect(out.residual).toHaveLength(1)
  })

  it('defaults to two iterations', async () => {
    const check = scriptedCheck([['a', 'b', 'c'], ['a', 'b'], ['a'], []])
    const polish = markingPolish()
    const out = await runPolishLoop('SCREEN', { check, polish })

    expect(DEFAULT_MAX_ITERATIONS).toBe(2)
    expect(out.iterations).toBe(2)
    expect(out.stopped).toBe('budget')
  })
})

describe('runPolishLoop — refusing to spin', () => {
  it('stops when the same rules keep failing', async () => {
    const check = scriptedCheck([['side-tab']]) // never changes
    const polish = markingPolish()
    const out = await runPolishLoop('SCREEN', { check, polish }, { maxIterations: 5 })

    expect(out.stopped).toBe('no-progress')
    // One pass was enough to learn that asking again is pointless.
    expect(out.iterations).toBe(1)
    expect(polish).toHaveBeenCalledTimes(1)
  })

  it('stops when the correction returns the code unchanged', async () => {
    const check = scriptedCheck([['side-tab']])
    const polish = vi.fn(async (code: string) => code)
    const out = await runPolishLoop('SCREEN', { check, polish }, { maxIterations: 5 })

    expect(out.stopped).toBe('no-progress')
    expect(out.iterations).toBe(1)
    // The check is not re-run for code that did not change.
    expect(check).toHaveBeenCalledTimes(1)
  })

  it('stops when the correction returns nothing', async () => {
    const check = scriptedCheck([['side-tab']])
    const polish = vi.fn(async () => '   ')
    const out = await runPolishLoop('SCREEN', { check, polish }, { maxIterations: 5 })

    expect(out.stopped).toBe('no-progress')
    expect(out.code).toBe('SCREEN')
  })

  it('discards a pass that made things worse', async () => {
    const check = scriptedCheck([['side-tab'], ['side-tab', 'gradient-text', 'dark-glow']])
    const polish = markingPolish()
    const out = await runPolishLoop('SCREEN', { check, polish }, { maxIterations: 3 })

    expect(out.stopped).toBe('regressed')
    // The screen from before the bad pass is what survives.
    expect(out.code).toBe('SCREEN')
    expect(out.residual.map((f) => f.rule)).toEqual(['side-tab'])
  })
})

describe('runPolishLoop — failure and cancellation', () => {
  it('returns the original code when the first check throws', async () => {
    const check = vi.fn(async () => {
      throw new Error('server down')
    })
    const polish = vi.fn(async (c: string) => c)
    const out = await runPolishLoop('SCREEN', { check, polish })

    expect(out.stopped).toBe('error')
    expect(out.code).toBe('SCREEN')
    expect(polish).not.toHaveBeenCalled()
  })

  it('keeps the last verified code when a correction throws', async () => {
    const check = scriptedCheck([['side-tab']])
    const polish = vi.fn(async () => {
      throw new Error('provider timeout')
    })
    const out = await runPolishLoop('SCREEN', { check, polish })

    expect(out.stopped).toBe('error')
    expect(out.code).toBe('SCREEN')
    expect(out.residual).toHaveLength(1)
  })

  it('keeps the verified original when the re-check throws', async () => {
    let call = 0
    const check = vi.fn(async () => {
      call += 1
      if (call === 1) return report([finding('side-tab')])
      throw new Error('server down')
    })
    const polish = markingPolish()
    const out = await runPolishLoop('SCREEN', { check, polish })

    expect(out.stopped).toBe('error')
    // An unverified rewrite is not worth keeping over a checked original.
    expect(out.code).toBe('SCREEN')
  })

  it('stops when the signal is aborted', async () => {
    const ctrl = new AbortController()
    ctrl.abort()
    const check = scriptedCheck([['side-tab']])
    const polish = vi.fn(async (c: string) => c)
    const out = await runPolishLoop('SCREEN', { check, polish }, { signal: ctrl.signal })

    expect(polish).not.toHaveBeenCalled()
    expect(out.stopped).toBe('budget')
    expect(out.iterations).toBe(0)
  })
})

describe('runPolishLoop — reporting what changed', () => {
  it('names what it resolved, not just what is left', async () => {
    const check = scriptedCheck([['side-tab', 'gradient-text'], ['side-tab'], []])
    const polish = markingPolish()
    const out = await runPolishLoop('SCREEN', { check, polish }, { maxIterations: 3 })

    expect(out.stopped).toBe('clean')
    expect(out.residual).toEqual([])
    // The question a user asks after a polish is "what did it change?".
    expect(out.fixed.map((f) => f.rule).sort()).toEqual(['gradient-text', 'side-tab'])
  })

  it('distinguishes a converged run from one with nothing to do', async () => {
    const already = await runPolishLoop('SCREEN', {
      check: scriptedCheck([[]]),
      polish: markingPolish(),
    })
    const converged = await runPolishLoop('SCREEN', {
      check: scriptedCheck([['side-tab'], []]),
      polish: markingPolish(),
    })

    // Both are 'clean' with an empty residual — `fixed` is the only thing that
    // tells them apart, which is why it exists.
    expect(already.stopped).toBe('clean')
    expect(converged.stopped).toBe('clean')
    expect(already.residual).toEqual(converged.residual)
    expect(already.fixed).toEqual([])
    expect(converged.fixed.map((f) => f.rule)).toEqual(['side-tab'])
  })

  it('counts only what actually went away on a partial run', async () => {
    const check = scriptedCheck([['a', 'b', 'c'], ['a', 'b'], ['a']])
    const polish = markingPolish()
    const out = await runPolishLoop('SCREEN', { check, polish }, { maxIterations: 2 })

    expect(out.stopped).toBe('budget')
    expect(out.residual.map((f) => f.rule)).toEqual(['a'])
    expect(out.fixed.map((f) => f.rule).sort()).toEqual(['b', 'c'])
  })

  it('reports nothing fixed when a pass regressed and was discarded', async () => {
    const check = scriptedCheck([['side-tab'], ['side-tab', 'gradient-text', 'dark-glow']])
    const out = await runPolishLoop('SCREEN', { check, polish: markingPolish() }, { maxIterations: 3 })

    expect(out.stopped).toBe('regressed')
    expect(out.fixed).toEqual([])
  })

  it('reports nothing fixed when the loop errored', async () => {
    const out = await runPolishLoop('SCREEN', {
      check: scriptedCheck([['side-tab']]),
      polish: vi.fn(async () => {
        throw new Error('provider timeout')
      }),
    })
    expect(out.stopped).toBe('error')
    expect(out.fixed).toEqual([])
  })
})

describe('runPolishLoop — inputs', () => {
  it('reuses a check the caller already ran', async () => {
    const check = scriptedCheck([[]])
    const polish = vi.fn(async (c: string) => c)
    const out = await runPolishLoop('SCREEN', { check, polish }, {
      initialReport: report([]),
    })

    expect(check).not.toHaveBeenCalled()
    expect(out.stopped).toBe('clean')
  })

  it('never sends advisory findings to the correction pass', async () => {
    const check = vi.fn(async () =>
      report([
        finding('side-tab', { disposition: 'enforce' }),
        finding('em-dash-overuse', { disposition: 'advise' }),
      ]),
    )
    let block = ''
    const polish = vi.fn(async (code: string, findingsBlock: string) => {
      block = findingsBlock
      return `${code}\n// fixed`
    })
    await runPolishLoop('SCREEN', { check, polish }, { maxIterations: 1 })

    expect(block).toContain('side-tab')
    expect(block).not.toContain('em-dash-overuse')
  })

  it('reports each pass for observability', async () => {
    const check = scriptedCheck([['a', 'b'], ['a'], []])
    const polish = markingPolish()
    const seen: number[] = []
    const out = await runPolishLoop('SCREEN', {
      check,
      polish,
      onPass: (_iteration, remaining) => seen.push(remaining),
    }, { maxIterations: 3 })

    expect(seen).toEqual([2, 1])
    expect(out.history).toEqual([
      { iteration: 1, signature: 'a', remaining: 1 },
      { iteration: 2, signature: '', remaining: 0 },
    ])
  })
})

/**
 * Fixing ONE finding on a screen that has several.
 *
 * The audit panel puts a "Fix" button on each finding, so the loop is handed a
 * subset — while `check` re-audits the whole screen and answers about all of
 * them. Comparing the two directly is what `scope` exists to stop.
 */
describe('a run scoped to some of the findings', () => {
  /** The screen keeps its two other problems whatever happens to the first. */
  const stillTwo = () => report([finding('input-no-label'), finding('control-no-name')])

  it('does not read a full re-check as a regression', async () => {
    // The bug: open = [img-alt] (1), nextOpen = the whole screen (2), so
    // `nextOpen.length > open.length` fired, the loop returned the ORIGINAL
    // code, and the panel said there had been nothing to fix — after paying
    // for a model call that had in fact corrected the alt.
    const check = vi.fn(async () => stillTwo())
    const out = await runPolishLoop(
      'original',
      { check, polish: async () => 'corrected' },
      {
        initialReport: report([finding('img-alt')]),
        scope: ['img-alt'],
      },
    )
    expect(out.stopped).toBe('clean')
    expect(out.code).toBe('corrected')
    expect(out.fixed.map((f) => f.rule)).toEqual(['img-alt'])
    expect(out.residual).toEqual([])
  })

  it('still reports the rest of the screen through the full report', async () => {
    // Scoping decides what the run is answerable for; it must not hide what
    // else the screen needs, which the panel goes on showing.
    const out = await runPolishLoop(
      'original',
      { check: async () => stillTwo(), polish: async () => 'corrected' },
      { initialReport: report([finding('img-alt')]), scope: ['img-alt'] },
    )
    expect(out.report?.findings.map((f) => f.rule)).toEqual(['input-no-label', 'control-no-name'])
  })

  it('still stops when the scoped finding survives the pass', async () => {
    // The guard has to keep working inside the scope: a correction that did not
    // land is still a correction that did not land.
    const out = await runPolishLoop(
      'original',
      {
        check: async () => report([finding('img-alt'), finding('input-no-label')]),
        polish: async () => 'rewritten',
      },
      { initialReport: report([finding('img-alt')]), scope: ['img-alt'] },
    )
    expect(out.stopped).toBe('no-progress')
    expect(out.fixed).toEqual([])
  })

  it('is unchanged when no scope is given', async () => {
    // Every existing caller passes a full report and no scope; they must keep
    // measuring against the whole screen.
    const out = await runPolishLoop(
      'original',
      { check: async () => stillTwo(), polish: async () => 'corrected' },
      { initialReport: report([finding('img-alt')]) },
    )
    expect(out.stopped).toBe('regressed')
    expect(out.code).toBe('original')
  })
})
