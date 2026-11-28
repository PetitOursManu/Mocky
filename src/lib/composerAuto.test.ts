import { describe, it, expect } from 'vitest'
import serverSource from '../../server/decision/composer.js?raw'
import { AUTO_OPTIONS, autoDocImageDefault, autoImageDefault, museVideoFor, offeredOptions, readDecision, runOptionsFor, type RunOptions } from './composerAuto'

const MANUAL: RunOptions = { redesign: false, creative: true, creations: false, muse: true, ultra: false, flows: true, diagrams: false }

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
  it('offers everything on a screen of a project with a direction, diagrams aside', () => {
    expect(offeredOptions(base)).toEqual(AUTO_OPTIONS.filter((o) => o !== 'diagrams'))
  })
  it('offers diagrams only on a document that draws them when asked', () => {
    expect(offeredOptions({ ...base, document: true, diagrams: true })).toContain('diagrams')
    expect(offeredOptions({ ...base, document: true })).not.toContain('diagrams')
  })
  it('reads a screen type only when it is one of the composer’s own', () => {
    expect(readDecision({ options: {}, screenType: { value: 'flyer', p: 0.9, on: true } }).screenType).toEqual({ value: 'flyer', p: 0.9, on: true })
    expect(readDecision({ options: {}, screenType: { value: 'rm -rf', p: 0.9, on: true } }).screenType).toBeUndefined()
    expect(readDecision({ options: {}, screenType: { value: 'none', p: 0.9, on: true } }).screenType?.on).toBe(false)
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

describe('the hero video Auto chose', () => {
  const config = { video: true, videoPin: { hash: 'x' }, videoMotion: false, videoFind: false, enabled: true }

  it('reads only a known source', () => {
    expect(readDecision({ options: {}, video: { value: 'motion', p: 0.8 } }).video).toEqual({ value: 'motion', p: 0.8 })
    expect(readDecision({ options: {}, video: { value: 'youtube', p: 0.8 } }).video).toBeUndefined()
  })

  it('becomes exactly one source for the run, and none clears them all', () => {
    expect(museVideoFor(config, 'motion')).toMatchObject({ video: false, videoPin: null, videoMotion: true, videoFind: false })
    expect(museVideoFor(config, 'free')).toMatchObject({ video: false, videoPin: null, videoMotion: false, videoFind: true })
    expect(museVideoFor(config, 'ai')).toMatchObject({ video: true, videoPin: null, videoMotion: false, videoFind: false })
    expect(museVideoFor(config, 'none')).toMatchObject({ video: false, videoPin: null, videoMotion: false, videoFind: false })
    // The person's own settings are not touched: a copy is returned.
    expect(config.video).toBe(true)
  })
})
