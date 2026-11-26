import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { CREDITS, CREDIT_GROUPS } from '../src/lib/credits'
import { credits as dict } from '../src/i18n/parts/credits'

/**
 * The thanks exist twice — on the Settings page and in the documentation — and
 * a list kept by hand in two places is the list that drifts. So every project
 * the app thanks must be thanked, at the same address, on both language pages
 * of `docs/credits.md`, and the documentation may not thank one the app forgot.
 */

const ROOT = path.resolve(import.meta.dirname, '..')
const page = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')
const PAGES = { en: page('docs/credits.md'), fr: page('docs/fr/credits.md') }

/** Every external link in a page's tables: `| [Name](https://…) …`. */
const tableLinks = (md) =>
  [...md.matchAll(/^\| \[([^\]]+)\]\((https?:[^)]+)\)/gm)].map(([, name, url]) => ({ name, url }))

describe('the credits', () => {
  it.each(Object.entries(PAGES))('names every credited project on the %s documentation page, at the same address', (_lang, md) => {
    const links = tableLinks(md)
    for (const credit of CREDITS) {
      expect(links, credit.name).toContainEqual({ name: credit.name, url: credit.url })
    }
  })

  it.each(Object.entries(PAGES))('thanks nobody on the %s page whom the app forgot', (_lang, md) => {
    const known = new Set(CREDITS.map((c) => c.url))
    expect(tableLinks(md).filter((link) => !known.has(link.url))).toEqual([])
  })

  it('says what every project is for, in both languages', () => {
    for (const credit of CREDITS) {
      expect(dict.fr, credit.id).toHaveProperty(`credits.use.${credit.id}`)
      expect(dict.en, credit.id).toHaveProperty(`credits.use.${credit.id}`)
    }
    for (const group of CREDIT_GROUPS) {
      expect(dict.fr).toHaveProperty(`credits.group.${group}`)
      expect(dict.en).toHaveProperty(`credits.group.${group}`)
    }
  })

  it('gives every project one id and one group', () => {
    expect(new Set(CREDITS.map((c) => c.id)).size).toBe(CREDITS.length)
    for (const credit of CREDITS) expect(CREDIT_GROUPS).toContain(credit.group)
  })
})
