import { describe, it, expect } from 'vitest'
import serverSource from '../../server/decision/composer.js?raw'
import { AUTO_OPTIONS, autoDocImageDefault, autoImageDefault, offeredOptions, readDecision, runOptionsFor, type RunOptions } from './composerAuto'

const MANUAL: RunOptions = { redesign: false, creative: true, creations: false, muse: true, ultra: false, flows: true }

describe('runOptionsFor', () => {
  it('is Manual when the decision failed', () => {
    expect(runOptionsFor(null, [...AUTO_OPTIONS], MANUAL)).toEqual(MANUAL)
  })

  it('takes the answers for what was offered, and Manual for the rest', () => {
    const decision = readDecision({ options: { muse: { on: false, p: 0.1 }, ultra: { on: true, p: 0.9 }, flows: { on: false, p: 0.2 } }, unanswered: ['creative'] })
    const run = runOptionsFor(decision, ['muse', 'ultra', 'creative'], MANUAL)
    expect(run).toEqual({ ...MANUAL, muse: false, ultra: true })
    // `flows` was answered but not offered: an answer cannot switch on what the composer did not draw.
    expect(run.flows).toBe(MANUAL.flows)
  })
})

describe('readDecision', () => {
  it('drops what it does not know', () => {
    const d = readDecision({ options: { evil: { on: true, p: 1 }, muse: { on: 'yes', p: 1 }, flows: { on: true, p: 0.7 } }, unanswered: ['x', 'muse'], engines: ['jev', 3] })
    expect(Object.keys(d.options)).toEqual(['flows'])
    expect(d.unanswered).toEqual(['muse'])
    expect(d.engines).toEqual(['jev'])
  })
})

describe('offeredOptions', () => {
  const base = { document: false, hasDirection: true, ultraAllowed: true, creative: true, creations: true }
  it('offers everything on a screen of a project with a direction', () => {
    expect(offeredOptions(base)).toEqual([...AUTO_OPTIONS])
  })
  it('offers no Motion Ultra nor flow on a document, and no redesign before a direction', () => {
    expect(offeredOptions({ ...base, document: true })).not.toContain('ultra')
    expect(offeredOptions({ ...base, document: true })).not.toContain('flows')
    expect(offeredOptions({ ...base, hasDirection: false })).not.toContain('redesign')
    expect(offeredOptions({ ...base, ultraAllowed: false })).not.toContain('ultra')
  })
})

describe('the pictures in Auto', () => {
  it('start on the free libraries, never on a paid generation', () => {
    expect(autoImageDefault(['ai', 'stock', 'none'])).toBe('stock')
    expect(autoImageDefault(['ai', 'none'])).toBe('none')
    expect(autoDocImageDefault(['none', 'ai', 'stock'])).toBe('stock')
    expect(autoDocImageDefault(['none', 'ai'])).toBe('none')
  })
})

describe('the mirror', () => {
  it('names the same options as server/decision/composer.js', () => {
    const m = (serverSource as string).match(/AUTO_OPTIONS = \[([^\]]+)\]/)
    expect(m).toBeTruthy()
    expect(m![1].split(',').map((x: string) => x.trim().replace(/'/g, ''))).toEqual([...AUTO_OPTIONS])
  })
})
