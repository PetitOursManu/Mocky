import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { MOTION_KINDS } from '../server/video/kinds.js'

/**
 * The enum lives on the server; the sentences a person reads live in the
 * dictionaries. This is the seam between them.
 *
 * `server/video/kinds.js` is deliberately the ONLY copy of the list — the panel
 * reads it off `GET /api/video/status` rather than holding one, which is how
 * this feature avoids a sixth hand-kept mirror. What that buys in one place it
 * owes in another: a kind added to the enum with no translation draws a selector
 * row printing its own key, in both languages, and nothing anywhere fails.
 *
 * So the check is here instead. Read as text, like `i18n-parity.test.js` beside
 * it, so it runs without a DOM and without pulling React in.
 */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const source = fs.readFileSync(path.join(root, 'src/i18n/parts/muse.ts'), 'utf8')

/** Every `'key': …` in the file, whichever dictionary it is in. */
const declared = new Set([...source.matchAll(/^\s*'([\w.-]+)':/gm)].map((m) => m[1]))

/** How many times a key appears — two means once per language. */
const occurrences = (key) => [...source.matchAll(new RegExp(`^\\s*'${key.replace(/\./g, '\\.')}':`, 'gm'))].length

describe('every kind of Motion has a name a person can read', () => {
  it('is named and explained, in both dictionaries', () => {
    for (const kind of MOTION_KINDS) {
      for (const key of [`muse.motionKind.${kind}`, `muse.motionKindHelp.${kind}`]) {
        expect(declared.has(key), `${key} is missing`).toBe(true)
        // Twice: the French block and the English one. One occurrence is a key
        // that exists in one language, which the parity test catches only for
        // keys it can see — and it sees these, so this is belt and braces on the
        // half that is specific to the enum.
        expect(occurrences(key), `${key} is declared in one language only`).toBe(2)
      }
    }
  })

  it('explains no kind this build does not offer', () => {
    // The other direction, and the one that rots quietly: a kind removed from
    // `kinds.js` leaves two dead strings, and the next person reads them as a
    // feature that exists.
    const orphans = [...declared]
      .filter((key) => key.startsWith('muse.motionKind.') || key.startsWith('muse.motionKindHelp.'))
      .map((key) => key.split('.').pop())
      .filter((id) => !MOTION_KINDS.includes(id))
    expect([...new Set(orphans)]).toEqual([])
  })
})
