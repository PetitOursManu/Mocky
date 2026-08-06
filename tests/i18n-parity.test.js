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

const AREAS = ['app', 'auth', 'canvas', 'project', 'muse', 'library', 'design', 'settings', 'preview', 'audit']

describe('area dictionaries', () => {
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
