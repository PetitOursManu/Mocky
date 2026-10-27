/**
 * A website attached as SOURCE — an .html file, or a .zip of one with its
 * stylesheets, scripts and pictures — to reproduce or redesign it.
 *
 * It becomes a screenshot, and nothing else: the page is rendered, photographed
 * and cut like any capture (lib/siteReference.ts), so every stage downstream —
 * the reading, the pictures, both intents — is the one screenshots already run.
 * The file is never sent, stored or uploaded; the parts are, exactly as a
 * capture's are.
 *
 * The file is somebody else's code, and rendering it is the hazard. It runs in
 * TWO frames, and the split is the whole design (siteSourceRender.ts):
 *
 * 1. LIVE — the page with its own scripts, so a page its JavaScript builds is
 *    built. `sandbox="allow-scripts"` and no `allow-same-origin`: an opaque
 *    origin, so it reads neither Mocky's storage (where the provider key may
 *    live) nor its DOM, and `LIVE_CSP` closes every channel that SENDS
 *    (connect, forms, frames). It may load https resources like the browser it
 *    was written for would — a stylesheet or a CDN Tailwind is how a lone .html
 *    file gets its look. All it hands back is its DOM, serialised.
 * 2. STILL — that serialisation, scrubbed of every script, handler and address
 *    that is not a `data:` URL (`scrubCss`, `safeDataUrl`), in a frame WITHOUT
 *    `allow-scripts`. html2canvas runs from Mocky's side over it — which is why
 *    it has `allow-same-origin`, and why nothing in it may run or fetch:
 *    html2canvas loads pictures from Mocky's realm, where no CSP applies.
 *
 * The capture frame Mocky uses for its own screens (capture.ts) is same-origin
 * WITH scripts, a known limitation written down there. This one does not
 * inherit it: the code that runs never shares the origin, the frame that
 * shares the origin never runs code.
 */

export type SiteSourceKind = 'html' | 'zip'

/** What the file picker offers beside images. Extensions too: Windows often sends a zip with no type. */
export const SITE_SOURCE_ACCEPT = ['.html', '.htm', '.zip', 'text/html', 'application/zip', 'application/x-zip-compressed']

/** The width the page is laid out at — a desktop, which is what a reference page is. */
export const SITE_RENDER_WIDTH = 1440

/** The viewport height: what `100vh` means while the page renders. */
export const SITE_RENDER_HEIGHT = 900

/**
 * The tallest capture taken. Past it the page is photographed down to here:
 * eight parts at `SITE_PART_RATIO` is ~14 000 px at this width, and canvases
 * past 16 384 px fail silently on some browsers.
 */
export const SITE_RENDER_MAX_HEIGHT = 14000

/** How long the live frame may take, scripts included, before the file is given up. */
export const SITE_RENDER_TIMEOUT_MS = 15000

/** Whether a file is a site source, by its type or — failing that — its name. */
export function siteSourceKind(file: { name?: string; type: string }): SiteSourceKind | null {
  const name = (file.name || '').toLowerCase()
  if (file.type === 'text/html' || /\.html?$/.test(name)) return 'html'
  if (file.type === 'application/zip' || file.type === 'application/x-zip-compressed' || name.endsWith('.zip')) return 'zip'
  return null
}

/**
 * The page a zip is about: `index.html` nearest the root, else the shallowest
 * page. A site exported by a builder is often one folder down (`dist/`,
 * `site/`), and a zip of a folder always is.
 */
export function pickEntry(paths: string[]): string | null {
  const pages = paths.filter((p) => /\.html?$/i.test(p))
  if (!pages.length) return null
  const depth = (p: string) => p.split('/').length
  const rank = (p: string) => depth(p) * 2 + (/(^|\/)index\.html?$/i.test(p) ? 0 : 1)
  return [...pages].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))[0]
}

function dirOf(path: string): string {
  const i = path.lastIndexOf('/')
  return i < 0 ? '' : path.slice(0, i + 1)
}

/**
 * Where a reference written in `from` points inside the archive, or null when it
 * points outside it (a URL with a scheme, `//host`, a fragment alone). A path
 * beginning with `/` is taken from `root`, the entry page's folder: a site
 * built for its own domain says `/assets/app.js` and means the folder it was
 * exported from, not the top of the zip.
 */
export function resolveRef(from: string, ref: string, root: string): string | null {
  const raw = ref.trim()
  if (!raw || raw.startsWith('#') || raw.startsWith('//') || /^[a-z][a-z0-9+.-]*:/i.test(raw)) return null
  let clean = raw.replace(/[?#].*$/, '')
  try {
    clean = decodeURIComponent(clean)
  } catch {
    // A stray "%" is a literal character in a file name.
  }
  const base = clean.startsWith('/') ? root : dirOf(from)
  const out: string[] = []
  for (const seg of (base + clean).split('/')) {
    if (!seg || seg === '.') continue
    if (seg === '..') {
      if (!out.length) return null
      out.pop()
      continue
    }
    out.push(seg)
  }
  return out.length ? out.join('/') : null
}

const MIME: Record<string, string> = {
  html: 'text/html',
  htm: 'text/html',
  css: 'text/css',
  js: 'text/javascript',
  mjs: 'text/javascript',
  json: 'application/json',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  ico: 'image/x-icon',
  bmp: 'image/bmp',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  otf: 'font/otf',
  eot: 'application/vnd.ms-fontobject',
  mp4: 'video/mp4',
  webm: 'video/webm',
}

export function mimeOf(path: string): string {
  return MIME[path.slice(path.lastIndexOf('.') + 1).toLowerCase()] ?? 'application/octet-stream'
}

export function bytesToDataUrl(bytes: Uint8Array, mime: string): string {
  let bin = ''
  // In slices: String.fromCharCode(...bytes) overflows the stack past ~100 KB.
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return `data:${mime};base64,${btoa(bin)}`
}

/** `url(…)` in all three spellings. A quoted data: URL of an SVG may contain ")". */
const CSS_URL = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)'"]*?))\s*\)/gi

async function replaceAsync(s: string, re: RegExp, fn: (...m: string[]) => Promise<string>): Promise<string> {
  const jobs: Promise<string>[] = []
  s.replace(re, (...m) => {
    jobs.push(fn(...(m as string[])))
    return ''
  })
  const done = await Promise.all(jobs)
  let i = 0
  return s.replace(re, () => done[i++])
}

/**
 * A stylesheet with every `url()` and `@import` that names a file of the
 * archive replaced by that file, inline. `load` answers a data: URL for an
 * archive path (or null), and is handed stylesheets back as their text so an
 * import can be inlined in turn — `depth` stops a sheet importing itself.
 */
export async function inlineCssRefs(
  css: string,
  cssPath: string,
  root: string,
  load: (path: string) => Promise<string | null>,
  loadText: (path: string) => Promise<string | null>,
  depth = 0,
): Promise<string> {
  let out = css
  if (depth < 4) {
    out = await replaceAsync(out, /@import\s+(?:url\(\s*)?["']?([^"')\s;]+)["']?\s*\)?([^;]*);/gi, async (whole, ref) => {
      const path = resolveRef(cssPath, ref, root)
      const text = path ? await loadText(path) : null
      return text == null ? whole : inlineCssRefs(text, path!, root, load, loadText, depth + 1)
    })
  }
  return replaceAsync(out, CSS_URL, async (whole, dq, sq, bare) => {
    const ref = dq ?? sq ?? bare ?? ''
    const path = resolveRef(cssPath, ref, root)
    const url = path ? await load(path) : null
    return url ? `url("${url}")` : whole
  })
}

/**
 * A data: URL that may stay in the still frame. Pictures and fonts only: the
 * frame runs nothing, but html2canvas loads what it finds from MOCKY's realm,
 * and a data: URL is the one kind of address that never leaves the machine.
 */
export function safeDataUrl(value: string, fonts = false): boolean {
  const v = value.trim().toLowerCase()
  if (v.startsWith('data:image/')) return true
  return fonts && (v.startsWith('data:font/') || v.startsWith('data:application/font') || v.startsWith('data:application/x-font') || v.startsWith('data:application/vnd.ms-fontobject'))
}

/**
 * A stylesheet for the still frame: no `@import`, and every `url()` that is not
 * a picture or a font as data: becomes `none` — a property that took a picture
 * takes none, an `@font-face` source becomes invalid and the face falls back.
 * Pure, so the rule that keeps html2canvas off the network is tested.
 */
export function scrubCss(css: string): string {
  return css
    .replace(/@import\b[^;]*;?/gi, '')
    .replace(CSS_URL, (_whole, dq, sq, bare) => {
      const ref = (dq ?? sq ?? bare ?? '').trim()
      return safeDataUrl(ref, true) ? `url("${ref.replace(/"/g, '%22')}")` : 'none'
    })
    // IE's expression() and the old XBL bindings: dead everywhere that matters,
    // and nothing a page's look depends on.
    .replace(/expression\s*\(/gi, 'none(')
    .replace(/-moz-binding\s*:/gi, '-mozilla-binding:')
}

/**
 * The live frame's policy. Sending is closed — no fetch, XHR, WebSocket, beacon,
 * form or frame — and loading is open to https and data:, because a page that
 * cannot reach its own CDN stylesheet renders as a page nobody would recognise.
 * `'unsafe-eval'` because bundlers and the CDN Tailwind compile at runtime.
 */
export const LIVE_CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline' 'unsafe-eval' https: data: blob:",
  "style-src 'unsafe-inline' https: data:",
  'img-src https: data: blob:',
  'font-src https: data:',
  'media-src https: data: blob:',
  "connect-src 'none'",
  "form-action 'none'",
  "frame-src 'none'",
  "child-src 'none'",
  "worker-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
].join('; ')

/** The still frame's policy: nothing runs, nothing loads that is not already in the document. */
export const STILL_CSP = [
  "default-src 'none'",
  "style-src 'unsafe-inline'",
  'img-src data:',
  'font-src data:',
  "form-action 'none'",
  "base-uri 'none'",
].join('; ')
