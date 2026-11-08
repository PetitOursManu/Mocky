import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { chromium as playwright } from 'playwright-core'
import { findChromium } from '../server/mcp/runner.js'

/**
 * What the model's code can reach during a capture, asked of a real browser.
 *
 * The static checks in preview-sandbox.test.js pin the flags. They cannot say
 * what the flags DO, and that is exactly where this went wrong twice: removing
 * allow-same-origin was "obviously" enough until html2canvas failed, and a second
 * port was the plan until one remembers cookies are not scoped by port.
 *
 * So a screen that tries to steal is captured by the real capture.ts, in a page
 * holding a provider key in localStorage and a session cookie, and the answers
 * it wrote into its own DOM are read back. Skipped, and says so, with no browser.
 */

const root = fileURLToPath(new URL('..', import.meta.url))
const executablePath = (() => {
  try {
    return findChromium()
  } catch {
    return null
  }
})()

const KEY = 'sk-provider-key-that-must-not-leak'
const COOKIE = 'cookie-that-must-not-leak'
const HASH = 'a'.repeat(64)
const HAZY = 'b'.repeat(64)

let server, canary, browser, page, base, canaryPort
const secretHits = []
let canaryHits = 0

/** A screen that tries everything a same-origin frame could do. */
const stealing = () => `export default function App() {
  const attempt = (f) => { try { return String(f()) } catch (e) { return 'DENIED' } };
  useEffect(() => {
    try { fetch('${base}/api/secret?via=fetch', { credentials: 'include' }).catch(() => {}) } catch (e) {}
  }, []);
  return (
    <main id="witness" className="p-8 bg-white"
      data-storage={attempt(() => localStorage.getItem('mocky.settings.v1'))}
      data-cookie={attempt(() => document.cookie)}
      data-parent={attempt(() => parent.document.title)}
      data-write={attempt(() => { parent.__pwned = 'live'; return 'WROTE' })}>
      <h1 className="text-3xl font-bold">Bonjour</h1>
      <div id="tailwind" className="bg-emerald-500" style={{ width: 120, height: 120 }} />
      <img id="own" alt="" src="${base}/api/images/${HASH}" width="200" height="100" />
      <img id="remote" alt="" src="http://127.0.0.1:${canaryPort}/ping" width="10" height="10" />
      <img id="route" alt="" src="${base}/api/secret?via=img" width="10" height="10" />
      <div dangerouslySetInnerHTML={{ __html: '<img src="x:y" onerror="try{parent.__pwned=1}catch(e){}"><script>parent.__pwned=2</scr' + 'ipt>' }} />
      <input id="box" type="checkbox" defaultChecked />
      <a id="link" href="https://example.com/offre">Offre</a>
    </main>
  );
}`

const documentScreen = `export default function App() {
  return (
    <Doc format="a4">
      <Page className="bg-white p-16">
        <h1 className="text-5xl font-bold">Affiche de test</h1>
        <div className="bg-emerald-500" style={{ width: 200, height: 200 }} />
      </Page>
    </Doc>
  );
}`

describe.skipIf(!executablePath)('a capture cannot reach Mocky', () => {
  beforeAll(async () => {
    const bundle = await build({
      stdin: {
        contents: `export { captureRegion, checkLegibility, openDocumentFrame } from './src/lib/capture'
          export { renderDocument } from './src/lib/docExport/render'
          export { resolveCapabilities } from './src/lib/capabilities/select'
          export { getPageFormat } from './src/lib/pageFormats'`,
        resolveDir: root,
        loader: 'ts',
      },
      bundle: true,
      format: 'iife',
      globalName: 'Capture',
      write: false,
      platform: 'browser',
      define: { 'import.meta.env': '{}' },
      logLevel: 'silent',
    })
    const script = bundle.outputFiles[0].text

    canary = http.createServer((_req, res) => {
      canaryHits++
      res.end()
    })
    await new Promise((r) => canary.listen(0, '127.0.0.1', r))
    canaryPort = canary.address().port

    server = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://x')
      if (url.pathname === '/') {
        res.setHeader('content-type', 'text/html')
        res.setHeader('set-cookie', `mocky_probe=${COOKIE}; Path=/; SameSite=Lax`)
        return res.end('<!doctype html><title>Mocky</title><script src="/bundle.js"></script>')
      }
      if (url.pathname === '/bundle.js') {
        res.setHeader('content-type', 'text/javascript')
        return res.end(script)
      }
      if (url.pathname.startsWith('/vendor/')) {
        const file = path.join(root, 'public', path.normalize(url.pathname))
        if (!fs.existsSync(file)) {
          res.statusCode = 404
          return res.end()
        }
        res.setHeader('content-type', 'text/javascript')
        return res.end(fs.readFileSync(file))
      }
      if (url.pathname === `/api/images/${HASH}`) {
        res.setHeader('content-type', 'image/svg+xml')
        return res.end('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><rect width="200" height="100" fill="#ff0000"/></svg>')
      }
      if (url.pathname === `/api/images/${HAZY}`) {
        res.setHeader('content-type', 'image/svg+xml')
        return res.end('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300"><linearGradient id="g"><stop offset="0" stop-color="rgb(190,180,165)"/><stop offset="1" stop-color="rgb(236,230,220)"/></linearGradient><rect width="600" height="300" fill="url(#g)"/></svg>')
      }
      if (url.pathname === '/api/secret') {
        secretHits.push({ via: url.searchParams.get('via'), cookie: req.headers.cookie || '' })
        return res.end()
      }
      res.statusCode = 404
      res.end()
    })
    await new Promise((r) => server.listen(0, '127.0.0.1', r))
    base = `http://127.0.0.1:${server.address().port}`

    // Software GL: a machine with no GPU still has to draw the 3D scene.
    browser = await playwright.launch({ executablePath, headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
    page = await browser.newPage()
    await page.goto(base + '/')
    await page.evaluate((key) => localStorage.setItem('mocky.settings.v1', JSON.stringify({ apiKey: key })), KEY)
  }, 60_000)

  afterAll(async () => {
    await browser?.close()
    // A browser's keep-alive sockets would otherwise hold close() open past the hook.
    server?.closeAllConnections()
    canary?.closeAllConnections()
    await new Promise((r) => server?.close(r))
    await new Promise((r) => canary?.close(r))
  }, 30_000)

  it('has a witness that WOULD report a same-origin frame', async () => {
    // Without this, every "DENIED" below could mean the screen never ran.
    const seen = await page.evaluate(
      () =>
        new Promise((resolve) => {
          const f = document.createElement('iframe')
          f.setAttribute('sandbox', 'allow-scripts allow-same-origin')
          f.srcdoc = `<script>parent.postMessage({ls: localStorage.getItem('mocky.settings.v1'), c: document.cookie}, '*')</scr` + `ipt>`
          window.addEventListener('message', (e) => {
            if (e.source !== f.contentWindow) return
            resolve(e.data)
            f.remove()
          })
          document.body.appendChild(f)
        }),
    )
    expect(seen.ls).toContain(KEY)
    expect(seen.c).toContain(COOKIE)
  })

  it('denies the code storage, cookies and the parent, and leaves nothing that runs', async () => {
    const out = await page.evaluate(async (code) => {
      const frame = await window.Capture.openDocumentFrame(code, [], 800, 600)
      const w = frame.doc.getElementById('witness')
      const result = {
        storage: w.getAttribute('data-storage'),
        cookie: w.getAttribute('data-cookie'),
        parent: w.getAttribute('data-parent'),
        write: w.getAttribute('data-write'),
        sandbox: frame.win.frameElement.getAttribute('sandbox'),
        scripts: frame.doc.querySelectorAll('script').length,
        handlers: frame.doc.querySelectorAll('[onerror],[onclick],[onload]').length,
        html: frame.doc.documentElement.outerHTML,
        tailwind: frame.win.getComputedStyle(frame.doc.getElementById('tailwind')).backgroundColor,
        box: frame.doc.getElementById('box').checked,
        link: frame.doc.getElementById('link').getAttribute('href'),
        own: frame.doc.getElementById('own').getAttribute('src'),
        ownLoaded: frame.doc.getElementById('own').naturalWidth,
        route: frame.doc.getElementById('route').getAttribute('src'),
        remoteNamed: frame.doc.getElementById('remote').getAttribute('src'),
        remoteLoaded: frame.doc.getElementById('remote').naturalWidth,
      }
      await new Promise((r) => setTimeout(r, 300))
      frame.dispose()
      return { ...result, pwned: window.__pwned ?? null, framesLeft: document.querySelectorAll('iframe').length }
    }, stealing())

    expect(out.storage).toBe('DENIED')
    expect(out.cookie).toBe('DENIED')
    expect(out.parent).toBe('DENIED')
    expect(out.write).toBe('DENIED')
    expect(out.html).not.toContain(KEY)
    expect(out.html).not.toContain(COOKIE)
    expect(out.pwned).toBeNull()

    expect(out.sandbox).toBe('allow-same-origin')
    expect(out.scripts).toBe(0)
    expect(out.handlers).toBe(0)
    expect(out.framesLeft).toBe(0)

    // What the export needs is still there.
    expect(out.tailwind).toBe('rgb(16, 185, 129)')
    expect(out.box).toBe(true)
    expect(out.link).toBe('https://example.com/offre')
    expect(out.own).toContain(`/api/images/${HASH}`)
    expect(out.ownLoaded).toBeGreaterThan(0)
    // Named, for the export's notice, and never fetched.
    expect(out.remoteNamed).toContain('/ping')
    expect(out.remoteLoaded).toBe(0)
    // A route that is not one of Mocky's files is not a picture.
    expect(out.route).toBeNull()
  }, 60_000)

  it('still takes a picture, with Tailwind and Mocky’s own images in it', async () => {
    const counts = await page.evaluate(async (code) => {
      const url = await window.Capture.captureRegion(code, 800, 600, { x: 0, y: 0, w: 1, h: 1 }, [], 1)
      const img = new Image()
      img.src = url
      await img.decode()
      const c = document.createElement('canvas')
      c.width = img.naturalWidth
      c.height = img.naturalHeight
      const ctx = c.getContext('2d')
      ctx.drawImage(img, 0, 0)
      const d = ctx.getImageData(0, 0, c.width, c.height).data
      let red = 0
      let emerald = 0
      for (let i = 0; i < d.length; i += 4) {
        if (d[i] > 240 && d[i + 1] < 15 && d[i + 2] < 15) red++
        if (Math.abs(d[i] - 16) < 6 && Math.abs(d[i + 1] - 185) < 6 && Math.abs(d[i + 2] - 129) < 6) emerald++
      }
      return { red, emerald, w: c.width, h: c.height }
    }, stealing())
    expect(counts.w).toBe(800)
    expect(counts.emerald).toBeGreaterThan(10_000)
    expect(counts.red).toBeGreaterThan(10_000)
  }, 60_000)

  it('still measures legibility', async () => {
    const code = `export default function App() {
      return <main style={{ position: 'relative', width: 600, height: 300 }}>
        <img alt="" src="${base}/api/images/${HAZY}" style={{ position: 'absolute', inset: 0, width: 600, height: 300 }} />
        <p style={{ position: 'relative', color: 'rgb(240, 236, 228)', fontSize: 16, width: 560 }}>Texte illisible sur son fond</p>
      </main>
    }`
    const found = await page.evaluate((c) => window.Capture.checkLegibility(c, 800, 600), code)
    expect(found.map((f) => f.text)).toContain('Texte illisible sur son fond')
  }, 60_000)

  it('still draws what only a script can draw: icons and a 3D scene', async () => {
    const out = await page.evaluate(async () => {
      const code = `export default function App() {
        return <main className="p-8"><Icon.Check id="icon" /><Scene3D preset="orb" color="#3366ff" className="h-64 w-64" /></main>
      }`
      const caps = window.Capture.resolveCapabilities(['icons', 'scene3d'])
      const frame = await window.Capture.openDocumentFrame(code, caps, 800, 600)
      const result = {
        svgs: frame.doc.querySelectorAll('svg').length,
        still: Array.from(frame.doc.images).filter((i) => i.src.startsWith('data:image/') && i.naturalWidth > 0).length,
        canvases: frame.doc.querySelectorAll('canvas').length,
        gl: !!document.createElement('canvas').getContext('webgl2'),
      }
      frame.dispose()
      return result
    })
    expect(out.svgs).toBeGreaterThan(0)
    // The scene's own still, carried over as a picture. Only where WebGL exists.
    if (out.gl) expect(out.still).toBeGreaterThan(0)
  }, 60_000)

  it('still exports a document, measured and rasterised', async () => {
    const out = await page.evaluate(async (code) => {
      const caps = window.Capture.resolveCapabilities(['document'])
      const format = window.Capture.getPageFormat('a4')
      const res = await window.Capture.renderDocument(code, caps, format, { purpose: 'pdf' })
      return {
        pages: res.pages.length,
        bytes: res.pages[0].image.length,
        text: res.pages[0].snapshot.lines.map((l) => l.text).join(' '),
        notices: res.notices.map((n) => n.code),
      }
    }, documentScreen)
    expect(out.pages).toBe(1)
    expect(out.bytes).toBeGreaterThan(1000)
    expect(out.text).toContain('Affiche de test')
    expect(out.notices).not.toContain('raster')
    expect(out.notices).not.toContain('measure')
  }, 90_000)

  it('reaches no other host, and no route it could read an answer from', () => {
    expect(canaryHits).toBe(0)
    expect(secretHits.filter((h) => h.via === 'fetch')).toEqual([])
    // An <img> is the one thing left, and it is what a preview can do too: the
    // browser treats an opaque frame's picture as same-site and attaches the
    // cookie, but the code reads neither the cookie nor the answer. Once per
    // capture, from the live frame: the copy dropped that address.
    expect(secretHits.filter((h) => h.via === 'img').length).toBe(2)
  })
})
