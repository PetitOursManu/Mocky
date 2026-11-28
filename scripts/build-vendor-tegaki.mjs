#!/usr/bin/env node
/**
 * Builds public/vendor/tegaki.js and one public/vendor/tegaki-<font>.js per
 * handwriting font — what `<Handwriting>` (snippets/Handwriting.ts) writes with.
 *
 * WHY THIS SCRIPT EXISTS
 *
 * The same reason as `build-vendor-three.mjs`: the preview iframe has no module
 * resolution, it loads plain scripts and reads globals, and Tegaki (MIT,
 * https://github.com/gkurt/tegaki) publishes ESM only. So it is bundled into
 * IIFEs once, here, committed, and hash-pinned in `public/vendor/VENDOR.md`
 * (invariant I3; `npm run check:vendor` enforces it).
 *
 * WHY THE FONTS ARE FILES OF THEIR OWN
 *
 * A font is its strokes — every glyph as a list of points with a pen width —
 * and five of them weigh a megabyte next to a 40 KB renderer. A screen writes
 * in one font, usually, so `tegaki.js` carries the renderer and a loader, and a
 * font arrives the first time a screen names it, from the same directory as the
 * renderer (read off its own `<script src>`, which is how it finds Mocky's
 * origin from inside an opaque-origin frame).
 *
 * WHAT IS LEFT OUT
 *
 * Only `textToSvg` is reached: it writes a self-drawing SVG — paths and CSS
 * keyframes — which every renderer of a page copies as it is (the canvas,
 * html2canvas in the capture shell, the native rasteriser of the exports). The
 * DOM engine, the harfbuzz shaper (a WebAssembly module the preview's CSP would
 * have to be widened for) and the font files themselves are not: without the
 * shaper the ink is drawn as the bundle's strokes rather than clipped to the
 * outlines, which at text sizes is the same picture. The bundles' `fontUrl`s
 * point at files this build does not ship, so they are emptied.
 *
 * WHICH FONTS
 *
 * The five Latin ones. Caveat, Parisienne and Italianno carry ASCII only; EMS
 * Allure and Hershey Script carry Latin-1 and Latin Extended-A, which is why the
 * component falls back to EMS Allure for a text with an accent the chosen font
 * lacks (see `HANDWRITING_FALLBACK`). Their licences are in FONTS-LICENSE.md in
 * the tegaki package: SIL OFL 1.1, and the Hershey fonts' own terms.
 *
 * Usage:  node scripts/build-vendor-tegaki.mjs   (or: npm run vendor:tegaki)
 * Then:   update the SHA-256s in public/vendor/VENDOR.md (this prints them).
 */
import { build } from 'esbuild'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const vendor = path.join(root, 'public', 'vendor')
const pkgDir = path.join(root, 'node_modules', 'tegaki')
const version = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8')).version
const licence = fs.readFileSync(path.join(pkgDir, 'LICENSE'), 'utf8').trim()

/** Kept in step with `HANDWRITING_FONTS` in snippets/Handwriting.ts — a test holds the two. */
export const TEGAKI_FONTS = ['caveat', 'parisienne', 'italianno', 'ems-allure', 'hershey-script']

const banner = `/*! Tegaki ${version} — https://github.com/gkurt/tegaki
${licence
  .split('\n')
  .map((l) => ` * ${l}`.trimEnd())
  .join('\n')}
 *
 * Bundled for Mocky's preview by scripts/build-vendor-tegaki.mjs. */`

const common = {
  bundle: true,
  format: 'iife',
  minify: true,
  legalComments: 'none',
  target: ['es2019'],
  // The bundles build their font URLs off `import.meta.url`, which an IIFE does
  // not have; the URLs are emptied below and never fetched.
  define: { 'import.meta.url': '"https://mocky.invalid/"' },
  loader: { '.ttf': 'empty', '.otf': 'empty', '.wasm': 'empty' },
  logLevel: 'error',
  write: false,
}

async function write(file, contents, header) {
  const result = await build({ ...common, stdin: { contents, resolveDir: root, loader: 'js' } })
  const code = `${header}\n${result.outputFiles[0].text}`
  fs.writeFileSync(path.join(vendor, file), code)
  const hash = crypto.createHash('sha256').update(code).digest('hex')
  console.log(`${file.padEnd(28)} ${(code.length / 1024).toFixed(0).padStart(4)} KB  ${hash}`)
}

/*
 * The renderer, and the loader the fonts register with.
 *
 * `loadFont(id)` resolves with the bundle, loading `tegaki-<id>.js` beside this
 * file at most once; an unknown id or a failed load rejects, and the component
 * falls back to plain text (Q1: degrade, never fail).
 */
await write(
  'tegaki.js',
  `import { textToSvg } from 'tegaki/core'
var base = ''
try { var s = document.currentScript && document.currentScript.src; if (s) base = s.slice(0, s.lastIndexOf('/') + 1) } catch (e) {}
var fonts = {}
var pending = {}
var known = ${JSON.stringify(TEGAKI_FONTS)}
function registerFont(id, bundle) {
  fonts[id] = bundle
  if (pending[id]) { pending[id].resolve(bundle); delete pending[id] }
}
function loadFont(id) {
  if (fonts[id]) return Promise.resolve(fonts[id])
  if (known.indexOf(id) < 0) return Promise.reject(new Error('Unknown handwriting font: ' + id))
  if (pending[id]) return pending[id].promise
  var entry = {}
  entry.promise = new Promise(function (resolve, reject) {
    entry.resolve = resolve
    var tag = document.createElement('script')
    tag.src = base + 'tegaki-' + id + '.js'
    tag.async = true
    tag.onerror = function () { delete pending[id]; reject(new Error('Could not load the handwriting font ' + id)) }
    document.head.appendChild(tag)
  })
  pending[id] = entry
  return entry.promise
}
window.MockyTegaki = { version: ${JSON.stringify(version)}, textToSvg: textToSvg, loadFont: loadFont, registerFont: registerFont, fonts: known.slice() }
`,
  banner,
)

for (const id of TEGAKI_FONTS) {
  await write(
    `tegaki-${id}.js`,
    `import bundle from 'tegaki/fonts/${id}'
var data = Object.assign({}, bundle, { fontUrl: '', fullFontUrl: '', fontFaceCSS: '' })
if (window.MockyTegaki) window.MockyTegaki.registerFont(${JSON.stringify(id)}, data)
`,
    `/*! Tegaki ${version} font bundle "${id}" — the font's licence is in FONTS-LICENSE.md of the tegaki package (SIL OFL 1.1; Hershey Script: the Hershey fonts' terms). Renderer: MIT, see tegaki.js. */`,
  )
}
