import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Every string must exist in both languages, and no component may ship a
 * hard-coded sentence.
 *
 * The interface used to be bilingual *inside single components*: the same row of
 * buttons on the canvas read "Rename", "Voir le prompt qui a créé cet écran",
 * "More options (or right-click the screen)", "Delete screen". Five components
 * were French, twelve English, two mixed. Nothing caught it because nothing was
 * looking.
 *
 * The files are read as text rather than imported so this runs without a DOM and
 * without pulling React in.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8')

/** Keys of an object literal, at any indentation. */
function keysOf(src, from = 0, to = src.length) {
  return [...src.slice(from, to).matchAll(/^\s*'([\w.-]+)':/gm)].map((m) => m[1])
}

describe('core dictionary', () => {
  const frKeys = keysOf(read('src/i18n/fr.ts'))
  const enKeys = keysOf(read('src/i18n/en.ts'))

  it('declares the same keys in both languages', () => {
    const missingEn = frKeys.filter((k) => !enKeys.includes(k))
    const missingFr = enKeys.filter((k) => !frKeys.includes(k))
    expect({ missingEn, missingFr }).toEqual({ missingEn: [], missingFr: [] })
  })

  it('has no duplicate key', () => {
    const dupes = frKeys.filter((k, i) => frKeys.indexOf(k) !== i)
    expect(dupes).toEqual([])
  })
})

// Every file in src/i18n/parts/ except index.ts. Forgetting a line here is
// silent — the area simply never gets checked — so the list is derived from the
// directory rather than kept by hand.
const AREAS = fs
  .readdirSync(path.join(root, 'src/i18n/parts'))
  .filter((f) => f.endsWith('.ts') && f !== 'index.ts')
  .map((f) => f.replace(/\.ts$/, ''))

describe('area dictionaries', () => {
  // A glob that matches nothing turns every check below into a loop over zero
  // areas — a green suite that verifies nothing at all, which is worse than the
  // hand-written list it replaced.
  it('found the area files', () => {
    expect(AREAS.length).toBeGreaterThan(5)
  })

  /**
   * The other half of the same silent failure: a dictionary can be perfectly
   * bilingual and still never reach the app, because only `parts/index.ts`
   * merges it. A file nobody imports ships no strings, and every `t()` call
   * against it renders the key.
   */
  it('merges every area file into the dictionary', () => {
    const index = read('src/i18n/parts/index.ts')
    const orphans = AREAS.filter((a) => !new RegExp(`\\bimport \\{ ${a} \\} from './${a}'`).test(index))
    expect(orphans).toEqual([])
  })

  for (const area of AREAS) {
    const src = read(`src/i18n/parts/${area}.ts`)
    const frAt = src.indexOf('fr: {')
    const enAt = src.indexOf('en: {')

    it(`${area}: declares both languages`, () => {
      expect(frAt, 'fr block missing').toBeGreaterThan(-1)
      expect(enAt, 'en block missing').toBeGreaterThan(-1)
    })

    it(`${area}: declares the same keys in both languages`, () => {
      const frKeys = keysOf(src, frAt, enAt)
      const enKeys = keysOf(src, enAt)
      const missingEn = frKeys.filter((k) => !enKeys.includes(k))
      const missingFr = enKeys.filter((k) => !frKeys.includes(k))
      expect({ area, missingEn, missingFr }).toEqual({ area, missingEn: [], missingFr: [] })
    })

    it(`${area}: namespaces every key under "${area}."`, () => {
      // Without this two areas can silently overwrite each other when merged.
      const stray = keysOf(src, frAt, enAt).filter((k) => !k.startsWith(`${area}.`))
      expect(stray).toEqual([])
    })
  }

  it('no area key collides with a core key', () => {
    const core = new Set(keysOf(read('src/i18n/fr.ts')))
    const clashes = []
    for (const area of AREAS) {
      const src = read(`src/i18n/parts/${area}.ts`)
      for (const k of keysOf(src, src.indexOf('fr: {'), src.indexOf('en: {'))) {
        if (core.has(k)) clashes.push(`${area}: ${k}`)
      }
    }
    expect(clashes).toEqual([])
  })
})
