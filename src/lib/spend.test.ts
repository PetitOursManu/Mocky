import { describe, expect, it } from 'vitest'
import type { SpendEntry } from './api'
import { groupSpend, modelsByProject, pricedModels, sortSpend, splitPriceKey, totalOf } from './spend'

const e = (over: Partial<SpendEntry>): SpendEntry => ({
  day: '2026-10-10',
  userId: 'u1',
  username: 'alice',
  projectId: 'p1',
  project: 'Boutique',
  projectDeleted: false,
  provider: 'openrouter',
  source: 'instance',
  model: 'opus',
  calls: 1,
  input: 100,
  output: 10,
  cost: 0.01,
  reported: 1,
  unpriced: false,
  estimated: 0,
  ...over,
})

const LINES = [
  e({}),
  e({ day: '2026-10-09', model: 'gpt-oss', input: 1000, output: 50, cost: 0.002, reported: 0 }),
  e({ day: '2026-09-30', projectId: 'p2', project: 'Blog', model: 'gpt-oss', cost: null, unpriced: true, reported: 0 }),
  e({
    userId: 'u2',
    username: 'bob',
    projectId: 'p3',
    project: 'Menu',
    source: 'browser',
    model: 'mine',
    calls: 4,
    input: 0,
    output: 0,
    cost: null,
    reported: 0,
  }),
]

describe('the spending panel', () => {
  it('groups by month, day, account, project and model, and keeps own-key calls out of the sums', () => {
    const months = groupSpend(LINES, 'month')
    expect(months.map((r) => [r.key, r.calls, r.input, r.ownCalls])).toEqual([
      ['2026-10', 2, 1100, 4],
      ['2026-09', 1, 100, 0],
    ])
    const users = groupSpend(LINES, 'user')
    expect(users.find((r) => r.label === 'bob')).toMatchObject({ calls: 0, input: 0, cost: 0, ownCalls: 4 })
    expect(groupSpend(LINES, 'project').find((r) => r.label === 'Blog')).toMatchObject({ owner: 'alice', unpriced: true })
  })

  it('says a total is incomplete as soon as one line could not be priced', () => {
    const total = totalOf(groupSpend(LINES, 'model'))
    expect(total).toMatchObject({ calls: 3, input: 1200, output: 70, ownCalls: 4, unpriced: true, reported: 1 })
    expect(total.cost).toBeCloseTo(0.012, 10)
  })

  it('sorts numbers largest first, days newest first, names alphabetically', () => {
    const models = groupSpend(LINES, 'model')
    expect(sortSpend(models, 'input', 'model').map((r) => r.key)).toEqual(['gpt-oss', 'opus', 'mine'])
    expect(sortSpend(models, 'input', 'model', true).map((r) => r.key)).toEqual(['mine', 'opus', 'gpt-oss'])
    expect(sortSpend(groupSpend(LINES, 'day'), 'key', 'day').map((r) => r.key)).toEqual(['2026-10-10', '2026-10-09', '2026-09-30'])
    expect(sortSpend(models, 'key', 'model').map((r) => r.key)).toEqual(['gpt-oss', 'mine', 'opus'])
  })

  it('lists the models of each project, the person’s own key told apart', () => {
    const view = modelsByProject(LINES)
    expect(view.map((u) => u.username)).toEqual(['bob', 'alice'])
    const alice = view[1]
    expect(alice.projects.map((p) => [p.name, p.models.map((m) => m.model)])).toEqual([
      ['Boutique', ['opus', 'gpt-oss']],
      ['Blog', ['gpt-oss']],
    ])
    expect(view[0].projects[0].models[0]).toMatchObject({ model: 'mine', own: true, calls: 4 })
  })

  it('offers a price only for the models the instance paid for', () => {
    expect(pricedModels(LINES)).toEqual([
      { key: 'openrouter::gpt-oss', provider: 'openrouter', model: 'gpt-oss', reported: 0, calls: 2 },
      { key: 'openrouter::opus', provider: 'openrouter', model: 'opus', reported: 1, calls: 1 },
    ])
    // The same model from another provider is another price.
    expect(pricedModels([...LINES, e({ provider: 'together', model: 'gpt-oss' })]).map((m) => m.key)).toContain('together::gpt-oss')
    expect(splitPriceKey('together::openai/gpt-oss')).toEqual({ provider: 'together', model: 'openai/gpt-oss' })
    expect(splitPriceKey('opus')).toEqual({ provider: null, model: 'opus' })
  })
})
