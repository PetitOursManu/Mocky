import { describe, it, expect } from 'vitest'
import { groupProviders, providerGroupKey, PROVIDER_GROUP_ORDER } from './providerGroups'
import { PROVIDERS } from './settings'
import { settings } from '../i18n/parts/settings'

describe('groupProviders', () => {
  it('orders the groups and keeps each group in its declared order', () => {
    const blocks = groupProviders([
      { id: 'a', group: 'host' },
      { id: 'b', group: 'custom' },
      { id: 'c', group: 'vendor' },
      { id: 'd', group: 'host' },
    ])
    expect(blocks.map((b) => b.group)).toEqual(['vendor', 'host', 'custom'])
    expect(blocks[1].items.map((p) => p.id)).toEqual(['a', 'd'])
  })

  it('drops empty groups', () => {
    expect(groupProviders([{ id: 'a', group: 'vendor' }]).map((b) => b.group)).toEqual(['vendor'])
    expect(groupProviders([])).toEqual([])
  })

  it('never loses an entry with a missing or unknown group', () => {
    const blocks = groupProviders([{ id: 'a' }, { id: 'b', group: 'nonsense' }])
    expect(blocks).toEqual([{ group: 'custom', items: [{ id: 'a' }, { id: 'b', group: 'nonsense' }] }])
  })

  it('shows every real preset exactly once, with "Compatible OpenAI" in the last group', () => {
    const blocks = groupProviders(PROVIDERS)
    expect(blocks.flatMap((b) => b.items).length).toBe(PROVIDERS.length)
    expect(blocks[blocks.length - 1].items.map((p) => p.id)).toEqual(['openai-compatible'])
  })

  it('names every group in both languages', () => {
    for (const g of PROVIDER_GROUP_ORDER) {
      expect((settings.fr as Record<string, string>)[providerGroupKey(g)], g).toBeTruthy()
      expect((settings.en as Record<string, string>)[providerGroupKey(g)], g).toBeTruthy()
    }
  })
})
