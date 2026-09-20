import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Locks the preview pipeline's security posture by reading its own source.
 *
 * ADR invariant I3 says "no CDN <script> for JS", but the only test enforcing it
 * looked at the capability registry — so it never saw the `<script src="https://…">`
 * tags written directly into buildSrcDoc and buildCaptureShell, and both drifted
 * to CDNs unnoticed. These assertions look at the files themselves.
 *
 * Equality is exact, not `includes`: `sandbox="allow-scripts allow-same-origin"`
 * contains `allow-scripts`, so a substring check would have passed while the
 * iframe ran model-generated code with Mocky's own origin.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8')

const preview = read('src/components/Preview.tsx')
const capture = read('src/lib/capture.ts')

/** Every `sandbox` attribute value assigned in a file. */
function sandboxValues(src) {
  const out = []
  for (const m of src.matchAll(/sandbox\s*=\s*["']([^"']*)["']/g)) out.push(m[1])
  for (const m of src.matchAll(/setAttribute\(\s*['"]sandbox['"]\s*,\s*['"]([^'"]*)['"]\s*\)/g)) out.push(m[1])
  return out
}

describe('preview iframe sandbox', () => {
  it('grants allow-scripts and nothing else', () => {
    const values = sandboxValues(preview)
    expect(values.length).toBeGreaterThan(0)
    // Exact equality, not includes: "allow-scripts allow-same-origin" contains
    // "allow-scripts", so a substring check would pass while the frame ran
    // model-generated code with Mocky's own origin.
    for (const v of values) expect(v).toBe('allow-scripts')
  })

  it('keeps the capture iframe same-origin — a documented, measured exception', () => {
    // This is NOT an oversight, and the test records why so nobody "fixes" it
    // blind: html2canvas clones the document into an iframe of its own, and a
    // sandbox without allow-same-origin gives every descendant a fresh opaque
    // origin, so the frame cannot read its own clone. Removing the flag was
    // tried and fails with "Blocked a frame with origin null from accessing a
    // cross-origin frame" — on the default path and with foreignObjectRendering
    // alike. The real fix is to serve the capture shell from a separate origin.
    // Until then the CSP below is what contains the frame.
    const values = sandboxValues(capture)
    expect(values.length).toBeGreaterThan(0)
    for (const v of values) expect(v).toBe('allow-scripts allow-same-origin')
  })

  it('denies the capture frame every outbound channel, since it is privileged', () => {
    // A same-origin frame can read localStorage; what stops that mattering is
    // having nowhere to send it. img-src is pinned to the origin here (unlike in
    // Preview) precisely because a remote <img> doubles as a beacon.
    for (const directive of ["connect-src 'none'", "form-action 'none'", "base-uri 'none'"]) {
      expect(capture).toContain(directive)
    }
    expect(capture).toMatch(/img-src \$\{location\.origin\} data: blob:/)
  })

  it('never grants the flags that would break either sandbox', () => {
    for (const src of [preview, capture]) {
      for (const v of sandboxValues(src)) {
        expect(v).not.toContain('allow-top-navigation') // could replace the whole app
        expect(v).not.toContain('allow-popups') // could open arbitrary windows
        expect(v).not.toContain('allow-modals') // could block the UI with alert()
        expect(v).not.toContain('allow-downloads')
      }
    }
  })

  it('never lets the live preview become same-origin', () => {
    // The previews are always on screen and always running model output; this
    // one has no excuse and no exception.
    for (const v of sandboxValues(preview)) expect(v).not.toContain('allow-same-origin')
  })
})

describe('no external script or style in the preview pipeline', () => {
  const externalTag = /<(?:script|link)[^>]+(?:src|href)\s*=\s*["']https?:\/\/([^"'/]+)/g

  it('loads every bundle from public/vendor', () => {
    for (const [file, src] of [
      ['Preview.tsx', preview],
      ['capture.ts', capture],
    ]) {
      const hosts = [...src.matchAll(externalTag)].map((m) => m[1])
      // daisyUI's stylesheet is a declared, pinned capability in the registry
      // and is injected through cdnLinks — not hard-coded here.
      expect(hosts, `${file} loads from ${hosts.join(', ')}`).toEqual([])
    }
  })

  it('every script capability is really vendored', () => {
    // A capability that names a /vendor file which is not there fails at render
    // time, inside a sandboxed iframe, as a missing global — the least
    // debuggable place in the app.
    const registry = read('src/lib/capabilities/registry.ts')
    const urls = [...registry.matchAll(/url:\s*'(\/vendor\/[\w.-]+)'/g)].map((m) => m[1])
    expect(urls.length).toBeGreaterThan(0)
    for (const url of urls) {
      expect(fs.existsSync(path.join(root, 'public', url.replace(/^\//, ''))), url).toBe(true)
    }
  })

  it('references the vendored bundles that actually exist on disk', () => {
    const referenced = new Set()
    for (const src of [preview, capture])
      for (const m of src.matchAll(/["'](\/vendor\/[\w.-]+\.js)["']/g)) referenced.add(m[1])

    expect(referenced.size).toBeGreaterThan(0)
    for (const ref of referenced) {
      expect(fs.existsSync(path.join(root, 'public', ref.replace('/vendor/', 'vendor/'))), ref).toBe(true)
    }
  })
})

describe('preview Content-Security-Policy', () => {
  it('denies the outbound verbs a mockup has no use for', () => {
    // allow-scripts alone restricts nothing outbound: a generated component
    // could fetch/sendBeacon anywhere, from the user's IP, on every render.
    for (const directive of [
      "connect-src 'none'",
      "form-action 'none'",
      "frame-src 'none'",
      "object-src 'none'",
      "base-uri 'none'",
      "default-src 'none'",
    ]) {
      expect(preview).toContain(directive)
    }
  })

  it('does not use \'self\', which is meaningless in an opaque origin', () => {
    // The document has no origin of its own; 'self' serialises to "null" and
    // would block the vendored scripts outright.
    expect(preview).not.toMatch(/script-src[^"]*'self'/)
  })

  /**
   * BOTH documents, because there are two policies and only one got the fix.
   *
   * `media-src` was added to the preview when a Motion film first had to play
   * inside a mockup. `buildCaptureShell` writes its own policy and was not
   * touched, so every thumbnail of a screen carrying a film logged
   *
   *   Loading media from … violates … "default-src 'none'". Note that
   *   'media-src' was not explicitly set, so 'default-src' is used as a fallback.
   *
   * and captured the hero as a hole. The two policies genuinely differ — the
   * capture's `img-src` is same-origin where the preview's is `*`, and that is
   * argued in both files — so this does not demand they be equal. It demands
   * that the directive a film needs is in each of them, which is the thing that
   * drifted.
   */
  it('lets a Motion film play in the preview AND in the capture', () => {
    for (const [name, source] of [['preview', preview], ['capture', capture]]) {
      expect(source, name).toMatch(/media-src \$\{(location\.)?origin\}/)
    }
  })

  it('never lets a film be loaded from another host', () => {
    // `img-src *` is defended in the preview: a remote image is how a mockup
    // shows a photo. That argument does not transfer to video — a remote one is
    // a megabyte of someone else's bandwidth autoplaying inside the tool a
    // design is being judged in, and no model needs to emit one.
    for (const [name, source] of [['preview', preview], ['capture', capture]]) {
      expect(source, name).not.toMatch(/media-src[^`'"]*\*/)
    }
  })
})

describe('the mockup never navigates itself away', () => {
  /**
   * A srcdoc document inherits the PARENT's URL as its base. So "#pricing" does
   * not resolve to a position in the mockup — it resolves to
   * http://localhost:8787/#pricing, a different document, and the frame loads
   * Mocky's own app into itself. Sandboxed to an opaque origin, that app then
   * fails CORS on its own stylesheet and module script, and the screen the user
   * just generated is gone.
   *
   * The guard used to let fragments through on the reasonable-sounding theory
   * that they only scroll. They only scroll in a document with its own URL.
   */
  it('stops fragment links too, not only path and absolute ones', () => {
    expect(preview).not.toMatch(/if\s*\(\s*href\.charAt\(0\)\s*!==\s*'#'\s*\)\s*\{\s*e\.preventDefault\(\)/)
    // The anchor branch preventDefaults unconditionally…
    expect(preview).toMatch(/closest\('a\[href\], area\[href\]'\)[\s\S]{0,1200}?e\.preventDefault\(\)/)
    // …and does the scroll itself, so in-page anchors still work.
    expect(preview).toContain('scrollIntoView')
  })

  it('stops form submissions, which navigate for the same reason', () => {
    expect(preview).toMatch(/addEventListener\('submit'[\s\S]{0,120}preventDefault/)
  })

  it('still neutralises window.open before generated code runs', () => {
    expect(preview).toContain('window.open = function () { return null; }')
  })
})

describe('"no animation" holds the whole mockup still', () => {
  /**
   * The flag alone only reaches <Animated>. A screen animated with a Tailwind
   * `animate-*` class, a hand-written @keyframes, a CSS transition, or the
   * retired motion pack kept moving — and from the user's side the switch was
   * simply broken.
   */
  it('collapses animations instead of removing them', () => {
    // Measured: `animation: none` on a fade-in whose resting state is
    // `opacity: 0` leaves the content permanently invisible. Collapsing the
    // duration and forcing the final frame lands it at opacity 1 — still, not
    // blank. Same recipe as the app's own prefers-reduced-motion block.
    expect(preview).toContain('animation-duration:0.01ms !important')
    expect(preview).toContain('animation-fill-mode:forwards !important')
    expect(preview).toContain('animation-iteration-count:1 !important')
    expect(preview).toContain('transition-duration:0.01ms !important')
    expect(preview).not.toMatch(/animation:\s*none\s*!important/)
  })

  it('applies it only when animations are off', () => {
    expect(preview).toMatch(/const stillCss = animations\s*\?\s*''/)
  })

  it('rebuilds the document when the switch flips', () => {
    // Without `animations` in the dependency list, the screens already on the
    // canvas keep the setting they were built with.
    expect(preview).toMatch(/\[code, frameId, hideScrollbars, resolvedCaps, animations\]/)
  })
})

describe('postMessage bridge', () => {
  it('checks the sending window rather than trusting an id in the payload', () => {
    // frameId is written in clear into every srcDoc, so it is not a secret; and
    // e.origin is "null" for every sandboxed frame, so it cannot separate them.
    expect(preview).toContain('e.source !== iframeRef.current?.contentWindow')
    expect(preview).toContain('e.source !== window.parent')
    expect(capture).toContain('e.source !== iframe.contentWindow')
  })
})
