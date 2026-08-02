import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * The documentation obeys the same rule as the interface: one language per file,
 * and every section says *why* before it says *what*.
 *
 * `i18n-parity.test.js` exists because Mocky's UI used to be bilingual inside
 * single components — one row of buttons read "Rename", "Voir le prompt qui a
 * créé cet écran", "More options", "Delete screen". The docs were heading the
 * same way: a French design system, an English ADR, a French audit, an English
 * README, and no way to tell which reader each was for. The fix is the one
 * already in `src/i18n` — a complete file per language, kept in step by a test —
 * transposed to Markdown: each document keeps its path and its language and
 * gains a twin suffixed with the other one.
 *
 * On top of parity this guards the thing the twins exist for: under every
 * heading, a one-line block giving the reason the section is arranged the way it
 * is. Written by hand across four documents and eight files, that convention
 * decays silently — a heading added without its block, an ASCII hyphen typed
 * instead of an em dash, an English block pasted into the French file. Each of
 * those is a test failure here.
 *
 * The files are read as text, like the two tests above, so this needs no
 * Markdown parser and no DOM.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8')
const exists = (p) => fs.existsSync(path.join(root, p))

/**
 * The template, to the character. The dash is an em dash (U+2014) with a space
 * on each side, and a single space closes the prefix.
 */
const WHY = {
  en: '> **Why it works this way —** ',
  fr: "> **Pourquoi c'est ainsi —** ",
}

/** Anything that opens like a "why" block without matching one of the above. */
const WHY_ISH = /^>\s*\*{0,2}\s*(Why it works|Pourquoi c)/

/** The language switch, once normalised out of its optional HTML wrapper. */
const SELECTOR = {
  en: (twin) => `**English** · [Français](${twin})`,
  fr: (twin) => `[English](${twin}) · **Français**`,
}

/** The minimum a reason has to be to count as one. */
const MIN_REASON = 40

/**
 * ATX headings, ignoring anything inside a fenced code block.
 *
 * This is the whole reason the parser is hand-written: the README is full of
 * shell comments — `# edit .env, then:`, `# The public origin of your Dashy
 * instance` — sitting inside ```bash fences. Counting those as headings would
 * fail this test on documents that are perfectly correct, so the fence state has
 * to be tracked line by line. Indentation of four spaces or more is a code block
 * too, hence the `{0,3}` bound.
 */
function headings(src) {
  const lines = src.split(/\r?\n/)
  const found = []
  let fence = null

  lines.forEach((line, i) => {
    const rule = /^ {0,3}(`{3,}|~{3,})/.exec(line)
    if (rule) {
      const marker = rule[1][0]
      const size = rule[1].length
      if (!fence) fence = { marker, size }
      else if (marker === fence.marker && size >= fence.size) fence = null
      return
    }
    if (fence) return

    // `#` must be followed by a space: `#1` and `#tag` are prose, not titles.
    const atx = /^ {0,3}(#{1,6})(?:[ \t]+(.*))?$/.exec(line)
    if (atx) found.push({ line: i + 1, level: atx[1].length, text: (atx[2] ?? '').trim() })
  })

  return found
}

/** `<p align="center"><strong>English</strong>…` and the Markdown form compared alike. */
function normalizeSelector(line) {
  return line
    .replace(/<\/?p[^>]*>/g, '')
    .replace(/<strong>([^<]*)<\/strong>/g, '**$1**')
    .replace(/<a href="([^"]+)"[^>]*>([^<]*)<\/a>/g, '[$2]($1)')
    .trim()
}

/** The four documents. Each keeps its own language; the twin carries the other. */
const DOCS = [
  { en: 'README.md', fr: 'README.fr.md', htmlTitle: true },
  { fr: 'docs/DESIGN-SYSTEM.md', en: 'docs/DESIGN-SYSTEM.en.md' },
  { en: 'docs/adr/001-muse.md', fr: 'docs/adr/001-muse.fr.md' },
  { fr: 'docs/AUDIT-2026-07.md', en: 'docs/AUDIT-2026-07.en.md' },
]

/** One entry per file, each knowing its language and the path back to its twin. */
const FILES = DOCS.flatMap((doc) =>
  ['en', 'fr'].map((lang) => {
    const file = doc[lang]
    const twin = doc[lang === 'en' ? 'fr' : 'en']
    return {
      file,
      lang,
      twin,
      // Written from inside the document, so relative to its own directory.
      href: path.relative(path.dirname(file), twin).split(path.sep).join('/'),
      htmlTitle: Boolean(doc.htmlTitle),
    }
  }),
)

describe('the heading parser ignores fenced code', () => {
  // Guarding the guard: if this regresses, every other case below goes wrong in
  // the direction that is hardest to spot — a correct document reported broken.
  const SAMPLE = [
    '# Title',
    '',
    'Prose with a # in the middle.',
    '',
    '```bash',
    '# edit .env, then:',
    'docker compose up -d',
    '# The public origin of your instance',
    '```',
    '',
    '## After the fence',
    '',
    '~~~',
    '### tilde-fenced, not a heading',
    '~~~',
    '',
    '#not-a-heading',
    '    # four-space indent, a code block',
    '',
    '#### Fourth level',
  ].join('\n')

  const found = headings(SAMPLE)

  it('finds only the real headings', () => {
    expect(found.map((h) => h.text)).toEqual(['Title', 'After the fence', 'Fourth level'])
  })

  it('reads their levels', () => {
    expect(found.map((h) => h.level)).toEqual([1, 2, 4])
  })

  it('closes a fence only on its own marker', () => {
    const mixed = ['```', '~~~', '# still inside the backtick fence', '```', '## out'].join('\n')
    expect(headings(mixed).map((h) => h.text)).toEqual(['out'])
  })
})

describe.each(FILES)('$file ($lang)', ({ file, lang, twin, href, htmlTitle }) => {
  it('exists, together with its twin', () => {
    expect(exists(file), `${file} is missing`).toBe(true)
    expect(exists(twin), `${file} has no twin at ${twin}`).toBe(true)
  })

  const src = read(file)
  const lines = src.split(/\r?\n/)
  const found = headings(src)
  const want = WHY[lang]
  const other = WHY[lang === 'en' ? 'fr' : 'en']

  // The switch sits on the first useful line, so it legitimately comes between
  // an h1 and that title's own "why" block.
  const selectorAt = lines.findIndex((l) => /English/.test(l) && /Français/.test(l))

  it('carries a language switch pointing at the twin', () => {
    expect(selectorAt, `no language switch found in ${file}`).toBeGreaterThan(-1)
    expect(normalizeSelector(lines[selectorAt])).toBe(SELECTOR[lang](href))

    const target = path.join(path.dirname(file), href)
    expect(exists(target), `the switch in ${file} points at ${href}, which does not exist`).toBe(true)
  })

  it('puts the switch on the first useful line', () => {
    const firstHeading = found[0]
    if (htmlTitle) {
      // The README's h1 is HTML; the switch only has to precede the body.
      expect(selectorAt + 1).toBeLessThan(firstHeading.line)
    } else {
      // Everywhere else: h1, then the switch, blank lines aside.
      expect(firstHeading.level, `${file} should open on an h1`).toBe(1)
      let i = firstHeading.line
      while (i < lines.length && lines[i].trim() === '') i++
      expect(i, `the switch is not directly under the h1 of ${file}`).toBe(selectorAt)
    }
  })

  it('has a "why" block under every heading', () => {
    const missing = []

    for (const h of found) {
      let i = h.line // 0-based index of the line after the heading
      while (i < lines.length && (lines[i].trim() === '' || i === selectorAt)) i++
      const next = lines[i] ?? ''

      if (!next.startsWith(want)) {
        missing.push(
          `${file}:${h.line} ${'#'.repeat(h.level)} ${h.text}\n` +
            `      expected: ${JSON.stringify(want)}\n` +
            `      found:    ${JSON.stringify(next.slice(0, 90))}`,
        )
      }
    }

    expect(missing.join('\n'), `${missing.length} heading(s) without a "why" block`).toBe('')
  })

  it('gives an actual reason, not a stub', () => {
    const thin = []

    for (const [i, line] of lines.entries()) {
      if (!line.startsWith(want)) continue
      const reason = line.slice(want.length).trim()
      if (reason.length < MIN_REASON) thin.push(`${file}:${i + 1} — ${reason.length} chars: ${JSON.stringify(reason)}`)
    }

    expect(thin).toEqual([])
  })

  it('never carries a "why" block in the other language', () => {
    // The invariant the whole convention rests on: one language per artefact.
    const strays = lines
      .map((line, i) => (line.startsWith(other) ? `${file}:${i + 1}` : null))
      .filter(Boolean)

    expect(strays, `${file} is ${lang}, but holds a ${lang === 'en' ? 'French' : 'English'} block`).toEqual([])
  })

  it('has no misspelt "why" block', () => {
    // An ASCII hyphen instead of an em dash, or a missing space, reads fine to a
    // human and silently drops out of every check above.
    const malformed = lines
      .map((line, i) =>
        WHY_ISH.test(line) && !line.startsWith(want) && !line.startsWith(other)
          ? `${file}:${i + 1} ${JSON.stringify(line.slice(0, 90))}`
          : null,
      )
      .filter(Boolean)

    expect(malformed, 'a "why" block does not match the template character for character').toEqual([])
  })
})

describe.each(DOCS)('$en ↔ $fr', (doc) => {
  const a = headings(read(doc.en))
  const b = headings(read(doc.fr))

  it('has the same number of headings on both sides', () => {
    // A heading translated in one file and forgotten in the other is how the two
    // versions start drifting into different documents.
    expect({ [doc.en]: a.length, [doc.fr]: b.length }).toEqual({ [doc.en]: a.length, [doc.fr]: a.length })
  })

  it('has the same heading levels in the same order', () => {
    // The wording differs — it is translated — so only the shape is compared.
    const drift = []
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const x = a[i]
      const y = b[i]
      if (!x || !y || x.level !== y.level) {
        drift.push(
          `#${i}: ${x ? `${doc.en}:${x.line} h${x.level} ${x.text}` : '—'}` +
            `  ||  ${y ? `${doc.fr}:${y.line} h${y.level} ${y.text}` : '—'}`,
        )
      }
    }
    expect(drift.join('\n')).toBe('')
  })
})

describe('README opening block', () => {
  // The README's title is a centred HTML header, not an ATX heading, so nothing
  // above would require it to explain why the project exists in this shape.
  for (const { file, lang } of FILES.filter((f) => f.htmlTitle)) {
    it(`${file} opens on a "why" block, before the first section`, () => {
      const lines = read(file).split(/\r?\n/)
      const firstHeading = headings(read(file))[0]
      const opening = lines.findIndex((l) => l.startsWith(WHY[lang]))

      expect(opening, `${file} has no opening block`).toBeGreaterThan(-1)
      expect(opening + 1, 'the opening block must come before the first section').toBeLessThan(firstHeading.line)
      expect(lines[opening].slice(WHY[lang].length).trim().length).toBeGreaterThanOrEqual(MIN_REASON)
    })
  }
})
