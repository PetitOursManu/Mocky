import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { cleanPrices, cleanProjectId, costOf, createSpendLedger, lineFor, priceKey } from './spend.js'

const at = new Date(2026, 9, 10, 15, 0, 0)
const call = (over = {}) => ({
  at,
  userId: 'u1',
  projectId: 'p1',
  provider: 'openrouter',
  source: 'instance',
  model: 'openai/gpt-oss-120b',
  input: 1000,
  output: 200,
  cost: null,
  estimated: false,
  ...over,
})

describe('a ledger line', () => {
  it('keeps counts and names, never anything else', () => {
    const line = lineFor({ ...call(), prompt: 'secret brief' })
    expect(line).toEqual({ d: '2026-10-10', u: 'u1', p: 'p1', prov: 'openrouter', m: 'openai/gpt-oss-120b', src: 'instance', n: 1, in: 1000, out: 200, uin: 1000, uout: 200 })
    expect(JSON.stringify(line)).not.toContain('secret')
  })

  it('believes a reported price, and leaves nothing for the table to price', () => {
    const line = lineFor(call({ cost: 0.0031 }))
    expect(line).toMatchObject({ cost: 0.0031, costN: 1 })
    expect(line.uin).toBeUndefined()
  })

  it('drops the numbers of a call made on a person’s own key: model and project only', () => {
    const line = lineFor(call({ source: 'browser', cost: 0.5 }))
    expect(line).toEqual({ d: '2026-10-10', u: 'u1', p: 'p1', prov: 'openrouter', m: 'openai/gpt-oss-120b', src: 'browser', n: 1 })
  })

  it('takes a project id for what it is — a name to file under, checked against a charset', () => {
    expect(cleanProjectId('mk7x_a-1')).toBe('mk7x_a-1')
    expect(cleanProjectId('../../etc')).toBeNull()
    expect(cleanProjectId('')).toBeNull()
    expect(lineFor(call({ projectId: '<b>' })).p).toBeNull()
  })
})

describe('the price of a folded line', () => {
  const prices = { 'openai/gpt-oss-120b': { in: 0.1, out: 0.5 } }
  it('is the reported price plus the table’s price of the rest', () => {
    const e = { src: 'instance', m: 'openai/gpt-oss-120b', n: 2, in: 3000, out: 400, cost: 0.002, costN: 1, uin: 2000, uout: 200 }
    expect(costOf(e, prices).cost).toBeCloseTo(0.002 + (2000 * 0.1 + 200 * 0.5) / 1e6, 10)
  })
  it('says when a model has no price, instead of counting it as free', () => {
    expect(costOf({ src: 'instance', m: 'x', uin: 10, uout: 10 }, prices)).toEqual({ cost: null, unpriced: true })
    expect(costOf({ src: 'instance', m: 'x', cost: 0.01, costN: 1, uin: 10 }, prices)).toEqual({ cost: 0.01, unpriced: true })
  })
  it('is nobody’s business on a person’s own key', () => {
    expect(costOf({ src: 'browser', m: 'x', n: 4 }, prices)).toEqual({ cost: null, unpriced: false })
  })
  it('takes the provider’s own price first, then a price set for the name alone', () => {
    const e = { src: 'instance', prov: 'together', m: 'gpt-oss', uin: 1e6, uout: 0 }
    expect(costOf(e, { 'gpt-oss': { in: 1, out: 1 } }).cost).toBe(1)
    expect(costOf(e, { 'gpt-oss': { in: 1, out: 1 }, [priceKey('together', 'gpt-oss')]: { in: 0.15, out: 0.6 } }).cost).toBe(0.15)
    expect(costOf({ ...e, prov: 'openrouter' }, { [priceKey('together', 'gpt-oss')]: { in: 0.15, out: 0.6 } }).unpriced).toBe(true)
  })
  it('remembers where a fetched price came from, and nothing else', () => {
    expect(cleanPrices({ 'together::x': { in: 1, out: 2, source: 'together', at: 1700000000000, junk: 1 } })).toEqual({
      'together::x': { in: 1, out: 2, source: 'together', at: 1700000000000 },
    })
    expect(cleanPrices({ x: { in: 1, out: 2, source: '<script>' } })).toEqual({ x: { in: 1, out: 2 } })
  })
  it('keeps only what a price table can hold', () => {
    expect(cleanPrices({ 'a/b': { in: '0.2', out: 1 }, '<x>': { in: 1 }, c: { in: -3, out: 'nope' } })).toEqual({
      'a/b': { in: 0.2, out: 1 },
      c: { in: 0, out: 0 },
    })
  })
})

describe('the ledger on disk', () => {
  let dir
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mocky-spend-'))
  })
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

  it('folds the calls of one day, account, project and model into one line, and survives a restart', () => {
    const ledger = createSpendLedger(dir, { now: () => at })
    ledger.record(call())
    ledger.record(call({ cost: 0.01 }))
    ledger.record(call({ model: 'other', estimated: true }))
    const e = ledger.entries()
    expect(e).toHaveLength(2)
    expect(e.find((x) => x.m === 'openai/gpt-oss-120b')).toMatchObject({ n: 2, in: 2000, out: 400, cost: 0.01, costN: 1, uin: 1000, uout: 200 })
    expect(e.find((x) => x.m === 'other')).toMatchObject({ n: 1, estN: 1 })

    const again = createSpendLedger(dir, { now: () => at })
    expect(again.entries()).toEqual(e)
  })

  it('rewrites itself as folded lines once it grows, losing nothing', () => {
    const ledger = createSpendLedger(dir, { now: () => at, maxLines: 5 })
    for (let i = 0; i < 12; i++) ledger.record(call())
    const lines = fs.readFileSync(path.join(dir, 'spend.jsonl'), 'utf8').trim().split('\n')
    expect(lines.length).toBeLessThan(12)
    expect(createSpendLedger(dir).entries()[0]).toMatchObject({ n: 12, in: 12000 })
  })

  it('skips a torn line and keeps the rest', () => {
    const ledger = createSpendLedger(dir, { now: () => at })
    ledger.record(call())
    fs.appendFileSync(path.join(dir, 'spend.jsonl'), '{"d":"2026-10-1')
    expect(createSpendLedger(dir).entries()[0]).toMatchObject({ n: 1 })
  })

  it('filters by day, newest first, and keeps the prices apart', () => {
    let now = new Date(2026, 9, 8)
    const ledger = createSpendLedger(dir, { now: () => now })
    ledger.record(call())
    now = new Date(2026, 9, 10)
    ledger.record(call())
    expect(ledger.entries().map((e) => e.d)).toEqual(['2026-10-10', '2026-10-08'])
    expect(ledger.entries('2026-10-09').map((e) => e.d)).toEqual(['2026-10-10'])
    expect(ledger.setPrices({ m: { in: 1, out: 2 } })).toEqual({ m: { in: 1, out: 2 } })
    expect(createSpendLedger(dir).prices()).toEqual({ m: { in: 1, out: 2 } })
  })

  it('never throws, even with nowhere to write', () => {
    const ledger = createSpendLedger(path.join(dir, 'file-not-dir', 'x'))
    fs.writeFileSync(path.join(dir, 'file-not-dir'), '')
    expect(() => ledger.record(call())).not.toThrow()
  })
})
