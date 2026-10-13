#!/usr/bin/env node
/**
 * Copies the typefaces generated screens may use out of their @fontsource
 * packages and into public/fonts/, and writes the catalogue that names them.
 *
 *   npm run vendor:fonts            copy the files, rewrite the catalogue if it drifted
 *   npm run vendor:fonts -- --check fail if the committed catalogue is not what the
 *                                   installed packages produce; write nothing
 *
 * Run by `predev`, `prebuild` and `pretest`, so nobody has to remember it.
 *
 * ── Why the files are generated and the catalogue is committed ───────────────
 *
 * The woff2 files are NOT in git (public/fonts/ is ignored). Two hundred
 * families at two subsets and up to two styles is ~650 binary files, and
 * committing them would put tens of megabytes into the history for bytes that
 * already exist, pinned, elsewhere: every package is an exact version in
 * package.json and a sha512 `integrity` in package-lock.json, which is a
 * stronger pin than a hash table kept by hand next to the files — the reason
 * public/vendor/ has one is that its bundles are BUILT or PATCHED, and these
 * are copied untouched. The Dockerfile's builder stage runs `npm ci` with the
 * devDependencies and then `npm run build`, whose `prebuild` runs this, and
 * Vite copies public/ into dist/ — so a build that has the catalogue has the
 * files, and `tests/fonts-catalogue.test.js` fails when a listed file is absent.
 *
 * The catalogue (src/lib/fonts/catalogue.json) IS committed, because TypeScript
 * imports it: `tsc --noEmit` must not depend on a script having run first. Its
 * server projection (server/fonts/families.json) is committed for the same
 * reason one level down — the runtime image ships server/ and never src/.
 *
 * ── What is copied ──────────────────────────────────────────────────────────
 *
 * Only woff2, only the `latin` and `latin-ext` subsets (declared with their
 * unicode-range, so a page that writes no Polish never downloads latin-ext),
 * and only the faces a mockup needs:
 *  - a variable family: its `wght` file (every weight in one file), or the
 *    `standard` axis file when it has no weight axis;
 *  - a static family: the weight nearest 400 and the one nearest 700 (at least
 *    600), and when it has a single weight, that one declared across 100–900 so
 *    `font-bold` shows the face as drawn instead of a bold the browser smears;
 *  - the italic of the regular, for the families text is SET in (sans, serif,
 *    slab, monospace) — a display or a script face is not run as body copy.
 *
 * Each file is renamed with a hash of its bytes, so the server can cache it
 * as immutable and a package update cannot leave a browser on a stale face.
 *
 * ── Licences ────────────────────────────────────────────────────────────────
 *
 * Read from each package's metadata, never assumed: OFL-1.1, Apache-2.0 and
 * the Ubuntu Font Licence are accepted, anything else stops the script. All
 * three permit bundling a font with software as long as the licence travels
 * with it, so public/fonts/LICENSES.txt is written with every package's own
 * LICENSE file, verbatim. See NOTICE and docs/license.md.
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const NM = path.join(root, 'node_modules')
const OUT_DIR = path.join(root, 'public', 'fonts')
const CATALOGUE = path.join(root, 'src', 'lib', 'fonts', 'catalogue.json')
const SERVER_FAMILIES = path.join(root, 'server', 'fonts', 'families.json')

/**
 * The families, by fontsource id, under Mocky's own categories.
 *
 * Fontsource's five (sans-serif, serif, display, handwriting, monospace) are
 * too coarse to choose with: "display" puts a pixel font, a blackletter and a
 * condensed poster face in one bucket, and an art direction asking for a
 * "condensed grotesque" or a "slab" cannot be answered from it. So the
 * category is decided here, by a person, once.
 *
 * Chosen for what art directions actually name, plus breadth for the
 * documents (flyers, posters, posts) where a decorative face is the point.
 * The ones left out were left out for weight, not taste: Dela Gothic One and
 * Bagel Fat One carry a CJK charset whose latin subset is all a mockup would
 * use, and the Noto superfamilies duplicate what Inter and Source Serif cover.
 */
export const FAMILIES = {
  sans: [
    'inter', 'inter-tight', 'roboto', 'open-sans', 'lato', 'montserrat', 'poppins', 'nunito-sans', 'raleway',
    'work-sans', 'dm-sans', 'manrope', 'plus-jakarta-sans', 'outfit', 'sora', 'figtree', 'rubik', 'ibm-plex-sans',
    'source-sans-3', 'public-sans', 'karla', 'mulish', 'lexend', 'onest', 'geist', 'instrument-sans',
    'hanken-grotesk', 'schibsted-grotesk', 'space-grotesk', 'archivo', 'urbanist', 'red-hat-display', 'epilogue',
    'be-vietnam-pro', 'albert-sans', 'barlow', 'josefin-sans', 'cabin', 'fira-sans', 'pt-sans', 'exo-2', 'jost',
    'league-spartan', 'chivo', 'bricolage-grotesque', 'atkinson-hyperlegible', 'overpass', 'libre-franklin',
    'mona-sans',
  ],
  condensed: [
    'oswald', 'barlow-condensed', 'bebas-neue', 'anton', 'roboto-condensed', 'fjalla-one', 'league-gothic',
    'big-shoulders-display', 'saira-condensed', 'archivo-narrow', 'teko', 'antonio',
  ],
  rounded: ['nunito', 'quicksand', 'varela-round', 'fredoka', 'baloo-2', 'comfortaa'],
  serif: [
    'lora', 'merriweather', 'source-serif-4', 'eb-garamond', 'cormorant-garamond', 'crimson-pro',
    'libre-baskerville', 'literata', 'newsreader', 'pt-serif', 'spectral', 'cardo', 'libre-caslon-text',
    'frank-ruhl-libre', 'domine', 'vollkorn', 'alegreya', 'gelasio', 'ibm-plex-serif',
  ],
  'serif-display': [
    'playfair-display', 'fraunces', 'dm-serif-display', 'abril-fatface', 'bodoni-moda', 'instrument-serif',
    'young-serif', 'gloock', 'cormorant', 'prata', 'yeseva-one', 'cinzel', 'rozha-one', 'italiana', 'marcellus',
    'libre-bodoni',
  ],
  slab: [
    'roboto-slab', 'zilla-slab', 'arvo', 'bitter', 'josefin-slab', 'crete-round', 'aleo', 'rokkitt', 'ultra',
    'alfa-slab-one', 'noticia-text',
  ],
  display: [
    'archivo-black', 'syne', 'unbounded', 'righteous', 'bungee', 'lilita-one', 'titan-one', 'passion-one',
    'rubik-mono-one', 'black-ops-one', 'russo-one', 'staatliches', 'krona-one', 'michroma', 'orbitron', 'audiowide',
    'chakra-petch', 'bowlby-one', 'shrikhand', 'tilt-warp', 'bangers', 'luckiest-guy',
  ],
  retro: [
    'press-start-2p', 'vt323', 'silkscreen', 'monoton', 'fascinate', 'limelight', 'poiret-one', 'rye', 'sancreek',
    'special-elite', 'creepster', 'fredericka-the-great',
  ],
  blackletter: [
    'unifrakturmaguntia', 'unifrakturcook', 'pirata-one', 'grenze-gotisch', 'new-rocker', 'uncial-antiqua',
    'almendra',
  ],
  handwriting: [
    'caveat', 'patrick-hand', 'kalam', 'indie-flower', 'shadows-into-light', 'gloria-hallelujah',
    'permanent-marker', 'rock-salt', 'architects-daughter', 'amatic-sc', 'gochi-hand', 'homemade-apple',
    'reenie-beanie', 'covered-by-your-grace', 'nothing-you-could-do', 'la-belle-aurore', 'zeyada',
    'cedarville-cursive',
  ],
  script: [
    'dancing-script', 'great-vibes', 'pacifico', 'sacramento', 'satisfy', 'parisienne', 'allura', 'alex-brush',
    'yellowtail', 'kaushan-script', 'cookie', 'marck-script', 'mrs-saint-delafield', 'pinyon-script', 'tangerine',
    'courgette', 'lobster',
  ],
  mono: [
    'jetbrains-mono', 'fira-code', 'ibm-plex-mono', 'space-mono', 'dm-mono', 'geist-mono', 'roboto-mono',
    'source-code-pro', 'inconsolata', 'ubuntu-mono', 'courier-prime', 'red-hat-mono', 'martian-mono',
    'azeret-mono', 'major-mono-display', 'share-tech-mono', 'victor-mono', 'anonymous-pro',
  ],
}

/** The generic family a stack ends on when the face itself cannot load. */
export const FALLBACK = {
  sans: 'sans-serif',
  condensed: 'sans-serif',
  rounded: 'sans-serif',
  serif: 'serif',
  'serif-display': 'serif',
  slab: 'serif',
  display: 'sans-serif',
  retro: 'sans-serif',
  blackletter: 'serif',
  handwriting: 'cursive',
  script: 'cursive',
  mono: 'monospace',
}

/** The categories whose regular gets its italic — the faces running text is set in. */
const ITALIC_CATEGORIES = new Set(['sans', 'serif', 'serif-display', 'slab', 'mono'])

export const ALLOWED_LICENSES = ['OFL-1.1', 'Apache-2.0', 'UFL-1.0']

const SUBSETS = ['latin', 'latin-ext']

const hash = (buf) => crypto.createHash('sha256').update(buf).digest('hex').slice(0, 10)

function packageDir(id) {
  for (const scope of ['@fontsource-variable', '@fontsource']) {
    const dir = path.join(NM, scope, id)
    if (fs.existsSync(path.join(dir, 'metadata.json'))) return { dir, name: `${scope}/${id}`, variable: scope === '@fontsource-variable' }
  }
  throw new Error(`vendor-fonts: no @fontsource package installed for "${id}" — is it in devDependencies?`)
}

/** The faces of one family: [{ style, weight, stem }] where `stem` + `-<subset>-…` names the file. */
function facesOf(id, meta, variable, category, files) {
  const has = (subset, rest) => files.has(`${id}-${subset}-${rest}.woff2`)
  const italic = ITALIC_CATEGORIES.has(category)
  if (variable) {
    const axisFile = ['wght', 'standard', 'full'].find((a) => has('latin', `${a}-normal`))
    if (!axisFile) throw new Error(`vendor-fonts: ${id} has no wght/standard/full file`)
    const w = meta.variable.wght
    const weight = axisFile === 'wght' && w ? `${Number(w.min)} ${Number(w.max)}` : '100 900'
    const out = [{ style: 'normal', weight, rest: `${axisFile}-normal` }]
    if (italic && has('latin', `${axisFile}-italic`)) out.push({ style: 'italic', weight, rest: `${axisFile}-italic` })
    return out
  }
  const weights = meta.weights.map(Number).filter((n) => has('latin', `${n}-normal`))
  if (!weights.length) throw new Error(`vendor-fonts: ${id} has no latin normal file`)
  const nearest = (target, pool) => pool.reduce((a, b) => (Math.abs(b - target) < Math.abs(a - target) ? b : a))
  const regular = nearest(400, weights)
  const heavier = weights.filter((n) => n >= 600 && n !== regular)
  const bold = heavier.length ? nearest(700, heavier) : null
  const single = bold === null
  const out = [{ style: 'normal', weight: single ? '100 900' : String(regular), rest: `${regular}-normal` }]
  if (bold !== null) out.push({ style: 'normal', weight: String(bold), rest: `${bold}-normal` })
  if (italic && has('latin', `${regular}-italic`)) {
    out.push({ style: 'italic', weight: single ? '100 900' : String(regular), rest: `${regular}-italic` })
  }
  return out
}

/**
 * Everything the catalogue says, worked out from the installed packages, and
 * the list of copies that realise it. Pure apart from reading node_modules.
 */
export function plan() {
  const families = []
  const copies = []
  const licences = []
  const seen = new Set()
  const ranges = { latin: new Map(), 'latin-ext': new Map() }
  for (const [category, ids] of Object.entries(FAMILIES)) {
    for (const id of ids) {
      if (seen.has(id)) throw new Error(`vendor-fonts: "${id}" is listed twice`)
      seen.add(id)
      const pkg = packageDir(id)
      const meta = JSON.parse(fs.readFileSync(path.join(pkg.dir, 'metadata.json'), 'utf8'))
      const version = JSON.parse(fs.readFileSync(path.join(pkg.dir, 'package.json'), 'utf8')).version
      const license = meta.license?.type
      if (!ALLOWED_LICENSES.includes(license)) {
        throw new Error(`vendor-fonts: ${pkg.name} is licensed "${license}", which is not one of ${ALLOWED_LICENSES.join(', ')}`)
      }
      const unicode = JSON.parse(fs.readFileSync(path.join(pkg.dir, 'unicode.json'), 'utf8'))
      const files = new Set(fs.readdirSync(path.join(pkg.dir, 'files')))
      const faces = facesOf(id, meta, pkg.variable, category, files).map((face) => {
        const out = {}
        for (const subset of SUBSETS) {
          const name = `${id}-${subset}-${face.rest}.woff2`
          if (!files.has(name)) continue
          const src = path.join(pkg.dir, 'files', name)
          const bytes = fs.readFileSync(src)
          const rel = `${id}/${name.replace(/\.woff2$/, '')}.${hash(bytes)}.woff2`
          copies.push({ src, rel, size: bytes.length })
          out[subset] = rel
          const r = ranges[subset]
          r.set(unicode[subset], (r.get(unicode[subset]) || 0) + 1)
        }
        return { style: face.style, weight: face.weight, files: out }
      })
      families.push({
        family: meta.family,
        id,
        category,
        fallback: FALLBACK[category],
        package: pkg.name,
        version,
        license,
        faces,
      })
      licences.push({ family: meta.family, package: pkg.name, version, license, text: fs.readFileSync(path.join(pkg.dir, 'LICENSE'), 'utf8') })
    }
  }
  const names = new Set()
  for (const f of families) {
    const key = f.family.toLowerCase()
    if (names.has(key)) throw new Error(`vendor-fonts: two packages are both called "${f.family}"`)
    names.add(key)
  }
  // One range per subset, the one the packages agree on. Three of them name a
  // few newer currency signs the rest do not: a unicode-range wider than a
  // face's glyphs only means the browser falls back for that glyph, so the
  // common one is exact for all but those signs and costs nothing.
  const common = (m) => [...m.entries()].sort((a, b) => b[1] - a[1])[0][0]
  const catalogue = {
    $comment: 'GENERATED by scripts/vendor-fonts.mjs from the @fontsource devDependencies. Do not edit: change the list there and run `npm run vendor:fonts`.',
    ranges: { latin: common(ranges.latin), 'latin-ext': common(ranges['latin-ext']) },
    families,
  }
  return { catalogue, copies, licences }
}

/** What the server reads: names and categories, nothing about files. */
export function serverProjection(catalogue) {
  return {
    $comment: catalogue.$comment,
    families: catalogue.families.map((f) => ({ family: f.family, category: f.category, fallback: f.fallback })),
  }
}

const json = (v) => `${JSON.stringify(v, null, 2)}\n`

function writeIfChanged(file, text) {
  const before = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n') : null
  if (before === text) return false
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, text)
  return true
}

function main() {
  const check = process.argv.includes('--check')
  const { catalogue, copies, licences } = plan()
  const catText = json(catalogue)
  const srvText = json(serverProjection(catalogue))
  if (check) {
    const same = (file, text) => fs.existsSync(file) && fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n') === text
    const bad = [[CATALOGUE, catText], [SERVER_FAMILIES, srvText]].filter(([f, t]) => !same(f, t)).map(([f]) => path.relative(root, f))
    if (bad.length) {
      console.error(`vendor-fonts: out of date — ${bad.join(', ')}. Run \`npm run vendor:fonts\` and commit the result.`)
      process.exit(1)
    }
    console.log(`vendor-fonts: catalogue up to date (${catalogue.families.length} families)`)
    return
  }
  const changed = [writeIfChanged(CATALOGUE, catText), writeIfChanged(SERVER_FAMILIES, srvText)]
  // Copy only what is missing, and remove what the catalogue no longer names:
  // the names carry a hash, so a stale file is one nobody will ever ask for.
  const wanted = new Set(copies.map((c) => c.rel.replace(/\//g, path.sep)))
  let copied = 0
  for (const c of copies) {
    const dest = path.join(OUT_DIR, c.rel)
    if (fs.existsSync(dest) && fs.statSync(dest).size === c.size) continue
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    fs.copyFileSync(c.src, dest)
    copied++
  }
  let removed = 0
  if (fs.existsSync(OUT_DIR)) {
    for (const dir of fs.readdirSync(OUT_DIR, { withFileTypes: true })) {
      if (!dir.isDirectory()) continue
      for (const f of fs.readdirSync(path.join(OUT_DIR, dir.name))) {
        if (!wanted.has(path.join(dir.name, f))) {
          fs.rmSync(path.join(OUT_DIR, dir.name, f))
          removed++
        }
      }
      if (!fs.readdirSync(path.join(OUT_DIR, dir.name)).length) fs.rmdirSync(path.join(OUT_DIR, dir.name))
    }
  }
  const licenceText = [
    'Typefaces served to Mocky\'s generated screens, from public/fonts/.',
    'Each one is distributed unmodified (subset files as published by Fontsource),',
    'under the licence reproduced below with its package. Generated by scripts/vendor-fonts.mjs.',
    '',
    ...licences.flatMap((l) => [
      '='.repeat(78),
      `${l.family} — ${l.package}@${l.version} — ${l.license}`,
      '='.repeat(78),
      l.text.trim(),
      '',
    ]),
  ].join('\n')
  writeIfChanged(path.join(OUT_DIR, 'LICENSES.txt'), licenceText)
  const bytes = copies.reduce((a, c) => a + c.size, 0)
  console.log(
    `vendor-fonts: ${catalogue.families.length} families, ${copies.length} files, ${(bytes / 1e6).toFixed(1)} MB` +
      ` — ${copied} copied, ${removed} removed${changed.some(Boolean) ? ', catalogue rewritten' : ''}`,
  )
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main()
  } catch (err) {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  }
}
