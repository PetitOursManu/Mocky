import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { plan, FAMILIES, ALLOWED_LICENSES } from '../scripts/vendor-fonts.mjs'

/**
 * The typefaces generated screens are set in (src/lib/fonts).
 *
 * The woff2 files are generated, not committed (scripts/vendor-fonts.mjs says
 * why), so this is what stands between a catalogue entry and a screen that
 * names a face nobody serves: every file the catalogue lists must be on disk,
 * and the committed catalogue must be the one the installed packages produce.
 * `npm test` runs the script first (`pretest`), so a failure here is a real
 * drift, never a step somebody forgot.
 */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const catalogue = JSON.parse(fs.readFileSync(path.join(root, 'src/lib/fonts/catalogue.json'), 'utf8'))
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8').replace(/\r\n/g, '\n')

describe('the font catalogue', () => {
  it('is what the installed @fontsource packages produce', () => {
    // Drop the copies: only the description is committed.
    expect(catalogue).toEqual(plan().catalogue)
  })

  it('is large, and covers every kind of type', () => {
    expect(catalogue.families.length).toBeGreaterThanOrEqual(150)
    const categories = new Set(catalogue.families.map((f) => f.category))
    expect([...categories].sort()).toEqual(Object.keys(FAMILIES).sort())
    for (const c of Object.keys(FAMILIES)) {
      expect(catalogue.families.filter((f) => f.category === c).length, c).toBeGreaterThanOrEqual(5)
    }
  })

  it('names each family and each directory once', () => {
    const ids = catalogue.families.map((f) => f.id)
    const names = catalogue.families.map((f) => f.family.toLowerCase())
    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(names).size).toBe(names.length)
  })

  it('carries only licences that allow bundling, read from each package', () => {
    for (const f of catalogue.families) expect(ALLOWED_LICENSES, f.family).toContain(f.license)
  })

  it('is backed by every file it lists, under public/fonts', () => {
    let files = 0
    for (const f of catalogue.families) {
      expect(f.faces.length, f.family).toBeGreaterThan(0)
      for (const face of f.faces) {
        expect(face.files.latin, `${f.family} has no latin file`).toBeTruthy()
        for (const rel of Object.values(face.files)) {
          files++
          expect(fs.existsSync(path.join(root, 'public/fonts', rel)), rel).toBe(true)
        }
      }
    }
    expect(files).toBeGreaterThan(400)
    expect(fs.existsSync(path.join(root, 'public/fonts/LICENSES.txt'))).toBe(true)
  })

  it('keeps the font package devDependencies pinned to an exact version', () => {
    const pkg = JSON.parse(read('package.json'))
    for (const f of catalogue.families) {
      expect(pkg.devDependencies[f.package], f.package).toBe(f.version)
      // Never a runtime dependency: the runtime image installs --omit=dev and
      // serves the files the builder stage copied.
      expect(pkg.dependencies[f.package]).toBeUndefined()
    }
  })
})

describe('the fonts reach every document a screen is drawn in', () => {
  const preview = read('src/components/Preview.tsx')
  const capture = read('src/lib/capture.ts')
  const server = read('server/index.js')
  const vite = read('vite.config.ts')

  it('the preview and the capture shell declare the faces the code names', () => {
    expect(preview).toContain("const fontCss = fontFaceCssFor(sourceCode,")
    expect(preview).toContain('${fontStyle}\n</head>')
    expect(capture).toContain('const fontCss = fontFaceCssFor(base64ToUtf8(b64), location.origin)')
    expect(capture).toMatch(/\$\{fontCss \? `<style data-mocky-fonts>\$\{fontCss\}<\/style>` : ''\}/)
  })

  it('both CSPs let a font load', () => {
    for (const src of [preview, capture]) expect(src).toContain("'font-src * data:'")
  })

  it('a capture waits for the faces before it draws', () => {
    expect(capture).toContain("document.fonts.status === 'loading' && fontsOwed < 3000")
  })

  it('/fonts answers an opaque-origin frame, in production and under vite', () => {
    expect(server).toContain("res.setHeader('Access-Control-Allow-Origin', '*')")
    expect(server).toMatch(/app\.use\(\s*'\/fonts'/)
    // Before the SPA fallback, which would answer a missing face with index.html.
    expect(server.indexOf("'/fonts',")).toBeLessThan(server.indexOf("res.sendFile(path.join(dist, 'index.html'))"))
    expect(vite).toContain("req.url.startsWith('/fonts/')")
  })

  it('the build copies them: prebuild runs the script, public/ becomes dist/', () => {
    const pkg = JSON.parse(read('package.json'))
    expect(pkg.scripts.prebuild).toBe('npm run vendor:fonts')
    expect(pkg.scripts.pretest).toBe('npm run vendor:fonts')
    expect(pkg.scripts.predev).toBe('npm run vendor:fonts')
    const docker = read('Dockerfile')
    // The builder installs devDependencies (plain `npm ci`) and then builds.
    expect(docker).toMatch(/RUN npm ci\n/)
    expect(docker.indexOf('RUN npm run build')).toBeGreaterThan(docker.indexOf('RUN npm ci\n'))
  })
})

describe('a srcDoc', () => {
  let previewDocument
  beforeAll(async () => {
    // buildSrcDoc reads two things off `window`; nothing else of the DOM.
    globalThis.window = globalThis.window || {
      btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
      location: { origin: 'http://mocky.test' },
    }
    ;({ previewDocument } = await import('../src/components/Preview'))
  })

  it('carries the named faces, from this origin', () => {
    const html = previewDocument(`export default function A(){ return <h1 className="font-['Playfair_Display',serif]">Hi</h1> }`, [], { frameId: 'f' })
    expect(html).toMatch(/<style data-mocky-fonts>@font-face\{font-family:'Playfair Display';/)
    expect(html).toContain('src:url(http://mocky.test/fonts/playfair-display/')
    expect(html).toContain('document.fonts.ready.then')
  })

  it('is the document it always was when the code names no face', () => {
    const html = previewDocument('export default function A(){ return <h1 className="font-sans">Hi</h1> }', [], { frameId: 'f' })
    expect(html).not.toContain('data-mocky-fonts')
    expect(html).not.toContain('document.fonts')
  })
})
