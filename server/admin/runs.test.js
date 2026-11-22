import { describe, expect, it } from 'vitest'
import { cleanRunId, createRunLog } from './runs.js'

describe('the per-generation trace', () => {
  it('threads the calls and the tokens of one run, for the account that ran it', () => {
    let t = 1000
    const log = createRunLog({ now: () => t })
    log.call('u1', 'run_abcdef12', { kind: 'mocky', action: 'storyboard', provider: 'anthropic', ms: 4000, ttfb: 300, status: 200, outcome: 'ok' })
    t += 30_000
    log.call('u1', 'run_abcdef12', { kind: 'mocky', action: 'generate', provider: 'anthropic', ms: 25_000, ttfb: 900, status: 200, outcome: 'ok' })
    log.usage('u1', 'run_abcdef12', { model: 'claude-x', input: 1200, output: 9000, cost: 0.12 })
    log.usage('u1', 'run_abcdef12', { model: 'claude-x', input: 300, output: 400, estimated: true })
    const trace = log.get('u1', 'run_abcdef12')
    expect(trace.calls.map((c) => c.action)).toEqual(['storyboard', 'generate'])
    expect(trace.totals).toMatchObject({ requests: 2, requestMs: 29_000, calls: 2, input: 1500, output: 9400, cost: 0.12, priced: 1, estimated: 1 })
    expect(trace.wallMs).toBe(30_000)
    expect(trace.model).toBe('claude-x')
    // Another account cannot read it, even with the id.
    expect(log.get('u2', 'run_abcdef12')).toBeNull()
  })

  it('refuses ids it would not file, and stays bounded', () => {
    expect(cleanRunId('short')).toBeNull()
    expect(cleanRunId('run_../../etc')).toBeNull()
    expect(cleanRunId('run_abcdef12')).toBe('run_abcdef12')
    const log = createRunLog({ maxRuns: 2, maxCalls: 3 })
    for (let i = 0; i < 5; i++) log.call('u', `run_000000${i}x`, { action: 'generate', ms: 1 })
    expect(log.get('u', 'run_0000000x')).toBeNull()
    expect(log.get('u', 'run_0000004x')).not.toBeNull()
    for (let i = 0; i < 10; i++) log.call('u', 'run_0000004x', { action: 'fix', ms: 1 })
    expect(log.get('u', 'run_0000004x').calls).toHaveLength(3)
  })

  it('keeps words, never content', () => {
    const log = createRunLog()
    log.call('u', 'run_abcdef12', { action: 'generate <script>alert(1)</script> a long prompt', provider: 'x', ms: 1 })
    expect(log.get('u', 'run_abcdef12').calls[0].action).not.toMatch(/[<>() ]/)
  })
})
