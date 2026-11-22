import { describe, expect, it } from 'vitest'
import { ADMIN_SETTINGS, fold, searchSettings } from './settingsIndex'
import { translate } from '../../i18n'

/**
 * Every component's source, read by Vite as text — the way the other source
 * checks in this tree read theirs (`?raw`), so the suite needs no Node types.
 */
const SOURCES = import.meta.glob('../**/*.tsx', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

/** Every `data-admin-setting="…"` written in the components, with where. */
function anchorsInSource(): Map<string, string[]> {
  const found = new Map<string, string[]>()
  for (const [file, text] of Object.entries(SOURCES)) {
    if (/\.test\./.test(file)) continue
    for (const m of text.matchAll(/data-admin-setting="([a-z0-9-]+)"/g)) {
      found.set(m[1], [...(found.get(m[1]) || []), file])
    }
  }
  return found
}

describe('the index of Admin settings', () => {
  const anchors = anchorsInSource()

  it('names every block the page marks, once, and nothing else', () => {
    const ids = ADMIN_SETTINGS.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    // An entry with no block on the page: the search would open a section and
    // land nowhere.
    expect(ids.filter((id) => !anchors.has(id))).toEqual([])
    // A block marked on the page that the search cannot find.
    expect([...anchors.keys()].filter((id) => !ids.includes(id))).toEqual([])
    // One block per entry: two would make the jump land on whichever comes first.
    expect([...anchors].filter(([, where]) => where.length > 1).map(([id]) => id)).toEqual([])
  })

  it('reads labels that exist in both languages, in sections that exist', () => {
    for (const s of ADMIN_SETTINGS) {
      for (const lang of ['fr', 'en'] as const) {
        for (const key of [s.label, s.detail, `dashboard.nav.${s.section}`].filter(Boolean) as string[]) {
          expect(translate(lang, key), `${s.id}: ${key} (${lang})`).not.toBe(key)
        }
      }
    }
  })
})

describe('searching the settings', () => {
  const first = (q: string, lang: 'fr' | 'en' = 'fr') => searchSettings(q, lang)[0]?.setting.id

  it('finds a setting by a word its block does not say', () => {
    expect(first('pexels')).toBe('stock-photos')
    expect(first('jev')).toBe('decision-model')
    expect(first('remotion')).toBe('video-export')
  })

  it('reads both languages, and answers in the interface’s', () => {
    const hit = searchSettings('signups', 'fr')[0]
    expect(hit.setting.id).toBe('signups')
    expect(hit.label).toBe(translate('fr', 'admin.allowSignups'))
    expect(hit.sectionLabel).toBe(translate('fr', 'dashboard.nav.users'))
  })

  it('ignores accents and case, and matches the start of words only', () => {
    expect(first('CLE OPENROUTER')).toBeDefined()
    expect(searchSettings('cle openrouter', 'fr').map((h) => h.setting.id)).toEqual(
      expect.arrayContaining(['text-models', 'decision-model']),
    )
    expect(fold('Clé d’API')).toBe('cle d api')
    // "ai" is the start of no word in "mail"; "outer" is inside "OpenRouter" only.
    expect(searchSettings('outer', 'fr')).toEqual([])
  })

  it('needs every word, and ranks a label above a keyword', () => {
    expect(searchSettings('maintenance migrer', 'fr').map((h) => h.setting.id)).not.toContain('announcement')
    expect(first('maintenance')).toBe('maintenance')
  })

  it('returns nothing for an empty query', () => {
    expect(searchSettings('   ', 'fr')).toEqual([])
  })
})
