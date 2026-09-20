/**
 * Generates the worker's font catalogue from the @fontsource packages it installs.
 *
 * NOT part of the build, and not run by any test. The catalogue it writes is
 * committed; this file is what regenerates it when a family is added, and it is
 * the record of how the one number in it — `advance` — was measured.
 *
 * ── Why a measurement at all ────────────────────────────────────────────────
 *
 * The layout never sees a font. It estimates how wide a line of type is from
 * `MEAN_GLYPH_EM` and `GLYPH_CLASS_EM` in `remotion/composition.js`, constants
 * calibrated on Liberation Sans — the only family this container used to carry.
 * A family wider than that breaks the estimate in the direction that shows: a
 * word the layout thought fitted is cut, or runs past its box. So every family is
 * set on the same four sentences at the weights the blocks use (400 and 800) and
 * compared with Liberation Sans at the matching weight; `advance` is the WORST of
 * those ratios, and `fonts.js` turns it into a `size-adjust` that shrinks a wider
 * face back onto the estimate. A narrower face is left alone — enlarging it would
 * push its glyphs out of the line box the leading reserved, which the heading's
 * mask then clips.
 *
 * ── Running it ──────────────────────────────────────────────────────────────
 *
 *   mkdir /tmp/fonts && cd /tmp/fonts && npm init -y
 *   npm install fontkit@2 wawoff2@2 <every package in FAMILIES below>
 *   copy LiberationSans-Regular.ttf and LiberationSans-Bold.ttf next to it
 *     (docker cp mocky-video-worker:/usr/share/fonts/truetype/liberation/…)
 *   node worker/video/scripts/fonts.mjs /tmp/fonts
 *
 * It rewrites `remotion/fonts/catalogue.js` and `remotion/fonts/files.js`, and
 * prints the dependency block for `worker/video/package.json`.
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

/**
 * The families, by fontsource id. Chosen for what art directions actually name —
 * the grotesques and geometric sans of product sites, the editorial serifs, a few
 * display faces and monospaces — and every one OFL-1.1, checked below rather than
 * trusted.
 */
export const VARIABLE = [
  'inter', 'inter-tight', 'manrope', 'space-grotesk', 'dm-sans', 'plus-jakarta-sans', 'outfit', 'sora', 'syne',
  'work-sans', 'ibm-plex-sans', 'figtree', 'rubik', 'montserrat', 'open-sans', 'roboto', 'raleway', 'archivo',
  'urbanist', 'lexend', 'onest', 'geist', 'instrument-sans', 'bricolage-grotesque', 'schibsted-grotesk',
  'hanken-grotesk', 'unbounded', 'epilogue', 'red-hat-display', 'public-sans', 'nunito', 'karla', 'mulish', 'oswald',
  'fraunces', 'playfair-display', 'cormorant-garamond', 'eb-garamond', 'lora', 'newsreader', 'source-serif-4',
  'merriweather', 'crimson-pro', 'bodoni-moda', 'literata', 'libre-baskerville',
  'jetbrains-mono', 'fira-code', 'geist-mono', 'caveat',
]
export const STATIC = [
  'poppins', 'lato', 'bebas-neue', 'anton', 'archivo-black', 'abril-fatface', 'dm-serif-display', 'instrument-serif',
  'young-serif', 'gloock', 'space-mono', 'ibm-plex-mono', 'dm-mono',
]

/** The weights the blocks set. A static family ships the ones it has among these. */
const USED_WEIGHTS = [400, 600, 700, 800, 900]

const SAMPLES = [
  'Le thé, autrement. Choisies à la main, pour une saison entière.',
  'Launching our kettle: three arguments, a calm tone, thirty seconds.',
  'NOUVELLE SAISON — PROCHAINEMENT 2026',
  'Tarifs 29 € / mois · 1 280 clients · 98 %',
]

async function main() {
  const probe = path.resolve(process.argv[2] || '.')
  const require = createRequire(path.join(probe, 'package.json'))
  const fontkit = require('fontkit')
  const wawoff2 = require('wawoff2')
  const nm = path.join(probe, 'node_modules')
  // `fileURLToPath` and not `.pathname`: a URL path keeps `%20` for a space, and
  // the first run of this script wrote its output into a directory named that.
  const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

  const ref = {
    400: fontkit.openSync(path.join(probe, 'LiberationSans-Regular.ttf')),
    800: fontkit.openSync(path.join(probe, 'LiberationSans-Bold.ttf')),
  }
  const width = (font, wght) => {
    const f = wght && font.variationAxes?.wght ? font.getVariation({ wght }) : font
    return SAMPLES.reduce((sum, s) => sum + f.layout(s).advanceWidth / f.unitsPerEm, 0)
  }
  const woff2 = async (file) => fontkit.create(Buffer.from(await wawoff2.decompress(fs.readFileSync(file))))

  const catalogue = []
  const imports = []
  const files = []
  const deps = {}
  for (const [scope, ids] of [['@fontsource-variable', VARIABLE], ['@fontsource', STATIC]]) {
    for (const id of ids) {
      const pkg = path.join(nm, scope, id)
      const meta = JSON.parse(fs.readFileSync(path.join(pkg, 'metadata.json'), 'utf8'))
      if (meta.license?.type !== 'OFL-1.1') throw new Error(`${id} is ${meta.license?.type}, not OFL-1.1`)
      deps[`${scope}/${id}`] = JSON.parse(fs.readFileSync(path.join(pkg, 'package.json'), 'utf8')).version
      const variable = scope === '@fontsource-variable'
      const weights = variable
        ? [{ file: 'wght', weight: `${meta.variable.wght.min} ${meta.variable.wght.max}`, measure: [400, 800] }]
        : (() => {
            const have = meta.weights.filter((w) => USED_WEIGHTS.includes(Number(w)))
            const list = have.length ? have : [meta.weights[0]]
            // One weight only: registered across the whole range, so a block asking
            // for 800 gets the face as drawn rather than a bold the browser fakes by
            // smearing an already heavy display face.
            return list.map((w) => ({ file: String(w), weight: list.length === 1 ? '100 900' : String(w), measure: [Number(w)] }))
          })()
      const faces = []
      let advance = 0
      for (const face of weights) {
        const key = `${id}-${face.file}`
        const latin = `${scope}/${id}/files/${id}-latin-${face.file}-normal.woff2`
        const latinExt = `${scope}/${id}/files/${id}-latin-ext-${face.file}-normal.woff2`
        const font = await woff2(path.join(nm, latin))
        for (const w of face.measure) {
          advance = Math.max(advance, width(font, variable ? w : null) / width(ref[w >= 600 ? 800 : 400], null))
        }
        const hasExt = fs.existsSync(path.join(nm, latinExt))
        const n = files.length
        imports.push(`import f${n} from '${latin}'`)
        if (hasExt) imports.push(`import f${n}x from '${latinExt}'`)
        files.push(`  '${key}': { latin: f${n}${hasExt ? `, latinExt: f${n}x` : ''} },`)
        faces.push({ key, weight: face.weight })
      }
      catalogue.push({ family: meta.family, category: meta.category, advance: Math.round(advance * 1000) / 1000, faces })
    }
  }

  const unicode = JSON.parse(fs.readFileSync(path.join(nm, '@fontsource-variable/inter/unicode.json'), 'utf8'))
  const header = (what) =>
    `// GENERATED by worker/video/scripts/fonts.mjs — ${what}. Do not edit by hand:\n// change the family list there and run it again (its header says how).\n`
  fs.mkdirSync(path.join(repo, 'remotion/fonts'), { recursive: true })
  fs.writeFileSync(
    path.join(repo, 'remotion/fonts/catalogue.js'),
    header('what each installed family is, and how wide it sets') +
      `\n/** The two unicode ranges each face is split into, as fontsource ships them. */\n` +
      `export const UNICODE_RANGES = ${JSON.stringify({ latin: unicode.latin, latinExt: unicode['latin-ext'] }, null, 2)}\n\n` +
      `/**\n * One entry per family. \`advance\` is the worst ratio of its width to Liberation Sans on\n * the sample sentences, at weights 400 and 800 — see the script for the method.\n */\n` +
      `export const FONT_CATALOGUE = ${JSON.stringify(catalogue, null, 2)}\n`,
  )
  fs.writeFileSync(
    path.join(repo, 'remotion/fonts/files.js'),
    header('the font files, as bundle URLs') +
      `//\n// Imported by the compositions only: every line below is a .woff2 the bundler turns\n// into a URL, and Mocky's own test suite has no @fontsource package to resolve.\n\n` +
      `${imports.join('\n')}\n\nexport const FONT_FILES = {\n${files.join('\n')}\n}\n`,
  )
  console.log(JSON.stringify(deps, null, 2))
  console.log(`${catalogue.length} families, ${files.length} faces`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
