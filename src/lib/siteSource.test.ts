import { describe, expect, it } from 'vitest'
import { LIVE_CSP, STILL_CSP, inlineCssRefs, pickEntry, resolveRef, safeDataUrl, scrubCss, siteSourceKind } from './siteSource'

describe('siteSourceKind', () => {
  it('knows a page and a zip by type, or by name when the type is empty', () => {
    expect(siteSourceKind({ name: 'a.HTM', type: '' })).toBe('html')
    expect(siteSourceKind({ name: 'x', type: 'text/html' })).toBe('html')
    expect(siteSourceKind({ name: 'site.zip', type: '' })).toBe('zip')
    expect(siteSourceKind({ name: 'x', type: 'application/x-zip-compressed' })).toBe('zip')
    expect(siteSourceKind({ name: 'shot.png', type: 'image/png' })).toBeNull()
  })
})

describe('pickEntry', () => {
  it('takes the index nearest the root, a folder down being the common case', () => {
    expect(pickEntry(['site/about.html', 'site/index.html', 'site/blog/index.html'])).toBe('site/index.html')
    expect(pickEntry(['dist/index.html', 'about.html'])).toBe('about.html')
    expect(pickEntry(['b.html', 'a.html'])).toBe('a.html')
    expect(pickEntry(['style.css'])).toBeNull()
  })
})

describe('resolveRef', () => {
  it('resolves relative and root-relative paths inside the archive', () => {
    expect(resolveRef('site/index.html', 'css/a.css?v=3#x', 'site/')).toBe('site/css/a.css')
    expect(resolveRef('site/css/a.css', '../img/b%20c.png', 'site/')).toBe('site/img/b c.png')
    // A site built for its own domain: "/" is the folder it was exported from.
    expect(resolveRef('dist/index.html', '/assets/app.js', 'dist/')).toBe('dist/assets/app.js')
  })

  it('leaves everything outside the archive alone', () => {
    for (const ref of ['https://cdn.example/x.css', '//cdn.example/x.css', 'data:image/png;base64,AA', '#top', 'javascript:alert(1)', '', '../../../x'])
      expect(resolveRef('index.html', ref, '')).toBeNull()
  })
})

describe('inlineCssRefs', () => {
  it('inlines the archive’s files and its imports, and keeps what it cannot find', async () => {
    const files: Record<string, string> = { 'site/css/base.css': 'body{background:url(../img/bg.png)}' }
    const load = async (p: string) => (p === 'site/img/bg.png' || p === 'site/img/logo.svg' ? `data:x;${p}` : null)
    const loadText = async (p: string) => files[p] ?? null
    const out = await inlineCssRefs(
      '@import "base.css"; .a{background:url("../img/logo.svg")} .b{background:url(https://cdn.example/x.png)}',
      'site/css/main.css',
      'site/',
      load,
      loadText,
    )
    expect(out).toContain('url("data:x;site/img/bg.png")')
    expect(out).toContain('url("data:x;site/img/logo.svg")')
    expect(out).toContain('url(https://cdn.example/x.png)')
    expect(out).not.toContain('@import')
  })

  it('stops a stylesheet that imports itself', async () => {
    const out = await inlineCssRefs('@import "a.css"; .x{}', 'a.css', '', async () => null, async () => '@import "a.css"; .x{}')
    expect(out).toContain('.x{}')
  })
})

describe('the still frame stays off the network', () => {
  // html2canvas loads what this leaves from MOCKY's realm, where no CSP applies.
  it('keeps pictures and fonts as data: and nothing else', () => {
    const css = scrubCss(
      '@import url(https://evil.example/a.css); .a{background:url(https://evil.example/t.png) no-repeat} ' +
        '.b{background-image:url( "//evil.example/x" )} .c{background:url(data:image/png;base64,AAAA)} ' +
        '@font-face{src:url("data:font/woff2;base64,BB") format("woff2"), url(f.woff)} ' +
        ".d{cursor:url('javascript:x'), auto} .e{width:expression(alert(1))}",
    )
    expect(css).not.toMatch(/evil|javascript|@import|expression\(|f\.woff/)
    expect(css).toContain('url("data:image/png;base64,AAAA")')
    expect(css).toContain('url("data:font/woff2;base64,BB")')
  })

  it('accepts only pictures — and fonts where asked — as data:', () => {
    expect(safeDataUrl('data:image/svg+xml,<svg/>')).toBe(true)
    expect(safeDataUrl('data:text/html,<script>')).toBe(false)
    expect(safeDataUrl('data:font/woff2;base64,AA')).toBe(false)
    expect(safeDataUrl('data:font/woff2;base64,AA', true)).toBe(true)
    expect(safeDataUrl('https://example.com/a.png')).toBe(false)
  })

  it('lets the live frame send nothing, and the still frame load nothing', () => {
    for (const d of ["connect-src 'none'", "form-action 'none'", "frame-src 'none'", "worker-src 'none'", "base-uri 'none'"]) expect(LIVE_CSP).toContain(d)
    expect(STILL_CSP).not.toMatch(/script-src|https:/)
    expect(STILL_CSP).toContain('img-src data:')
  })
})
