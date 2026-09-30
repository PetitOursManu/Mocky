import { describe, expect, it } from 'vitest'
import {
  SVG_NS,
  absolutiseCssUrls,
  carryFormState,
  classifyNativeFailure,
  collectCss,
  cssUrls,
  inlinePolicy,
  raceAbort,
  relocateMockyMedia,
  replaceCssUrls,
  svgDataUrl,
  svgDocument,
  viewportProps,
  withTimeout,
  type SheetLike,
} from './svgRaster'

/** An element that records what was written on it. */
function target() {
  const attrs: Record<string, string> = {}
  return {
    attrs,
    textContent: null as string | null,
    setAttribute: (n: string, v: string) => void (attrs[n] = v),
    removeAttribute: (n: string) => void delete attrs[n],
  }
}

const control = (tagName: string, attrs: Record<string, string>, props: Record<string, unknown> = {}) => ({
  tagName,
  getAttribute: (n: string) => attrs[n] ?? null,
  ...props,
})

describe('carryFormState', () => {
  it('writes a typed value back as the attribute a parser reads', () => {
    const t = target()
    carryFormState(control('INPUT', { type: 'email' }, { value: 'zoe@exemple.fr' }), t)
    expect(t.attrs.value).toBe('zoe@exemple.fr')
  })

  it('writes the LIVE check state, including a tick the PDF pass took out', () => {
    const on = target()
    carryFormState(control('INPUT', { type: 'checkbox', checked: '' }, { checked: true }), on)
    expect('checked' in on.attrs).toBe(true)
    const off = target()
    off.attrs.checked = '' // cloned from a box that STARTED ticked
    carryFormState(control('INPUT', { type: 'checkbox', checked: '' }, { checked: false }), off)
    expect('checked' in off.attrs).toBe(false)
  })

  it('puts a textarea’s value in its text and marks the selected option only', () => {
    const area = target()
    carryFormState(control('TEXTAREA', {}, { value: 'Deux\nlignes' }), area)
    expect(area.textContent).toBe('Deux\nlignes')
    const opts = [target(), target(), target()]
    opts[0].attrs.selected = ''
    carryFormState(control('SELECT', {}, { options: [{ selected: false }, { selected: false }, { selected: true }] }), target(), opts)
    expect(opts.map((o) => 'selected' in o.attrs)).toEqual([false, false, true])
  })

  it('never writes a file input’s path', () => {
    const t = target()
    carryFormState(control('INPUT', { type: 'file' }, { value: 'C:\\fakepath\\cv.pdf' }), t)
    expect(t.attrs).toEqual({})
  })
})

describe('collectCss', () => {
  const sheet = (href: string | null, rules: Array<{ cssText: string; styleSheet?: SheetLike }>): SheetLike => ({ href, cssRules: rules })

  it('keeps every readable rule in order, follows @import, and counts what it cannot read', () => {
    const imported = sheet('http://mocky.test/css/kit.css', [{ cssText: '.kit { background: url(img/dot.png); }' }])
    const locked: SheetLike = {
      href: 'https://cdn.example/x.css',
      get cssRules(): never {
        throw new DOMException('cross-origin', 'SecurityError')
      },
    }
    const out = collectCss(
      [sheet(null, [{ cssText: '@import url("css/kit.css");', styleSheet: imported }, { cssText: '.a { color: red; }' }]), locked],
      'http://mocky.test/app/',
    )
    expect(out.css).toBe('.kit { background: url("http://mocky.test/css/img/dot.png"); }\n.a { color: red; }')
    expect(out.unreadable).toBe(1)
  })

  it('leaves fragments and data: URLs as they are', () => {
    expect(absolutiseCssUrls('fill: url(#grad); background: url(data:image/png;base64,AA==)', 'http://h/')).toBe(
      'fill: url(#grad); background: url(data:image/png;base64,AA==)',
    )
  })
})

describe('urls', () => {
  it('lists what would need fetching, and swaps in what was fetched', () => {
    const css = '.a{background:url("http://h/a.png")} .b{background:url(http://h/b.png)} .c{fill:url(#g)}'
    expect(cssUrls(css)).toEqual(['http://h/a.png', 'http://h/b.png'])
    const out = replaceCssUrls(css, new Map([['http://h/a.png', 'data:image/png;base64,QQ==']]))
    expect(out).toContain('url("data:image/png;base64,QQ==")')
    expect(out).toContain('url(http://h/b.png)')
  })

  it('fetches only this origin and the frame’s own blobs', () => {
    const origin = 'http://mocky.test'
    expect(inlinePolicy('data:image/png;base64,AA==', origin)).toBe('keep')
    expect(inlinePolicy('http://mocky.test/api/images/1', origin)).toBe('fetch')
    expect(inlinePolicy('blob:http://mocky.test/4f1c', origin)).toBe('fetch')
    expect(inlinePolicy('https://tracker.example/pixel.gif', origin)).toBe('refuse')
    expect(inlinePolicy('blob:https://elsewhere.example/4f1c', origin)).toBe('refuse')
    expect(inlinePolicy('not a url', origin)).toBe('refuse')
  })
})

describe('viewportProps', () => {
  it('names the properties written in viewport units', () => {
    const decl = { height: 'calc(100vh - 2rem)', width: '100%', 'min-height': '50dvh', 'font-size': '4vw', 'max-width': '65ch' }
    const keys = Object.keys(decl) as Array<keyof typeof decl>
    const like = { length: keys.length, item: (i: number) => keys[i], getPropertyValue: (p: string) => decl[p as keyof typeof decl] }
    expect(viewportProps(like)).toEqual(['height', 'min-height', 'font-size'])
  })
})

describe('the SVG wrapper', () => {
  it('is an SVG of the page’s exact size holding the markup in a foreignObject', () => {
    const svg = svgDocument('<div xmlns="http://www.w3.org/1999/xhtml">x</div>', 793.7, 1122.5)
    expect(svg.startsWith(`<svg xmlns="${SVG_NS}" width="794" height="1123" viewBox="0 0 794 1123">`)).toBe(true)
    expect(svg).toContain('<foreignObject x="0" y="0" width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml">x</div></foreignObject>')
    expect(svg.endsWith('</svg>')).toBe(true)
  })

  it('is encoded so a # or a quote in the markup survives the data: URL', () => {
    const url = svgDataUrl('<svg><text fill="#f00">50% & "plus"</text></svg>')
    expect(url.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true)
    expect(url).not.toContain('#')
    expect(decodeURIComponent(url.slice(url.indexOf(',') + 1))).toBe('<svg><text fill="#f00">50% & "plus"</text></svg>')
  })
})

describe('the fallback decision', () => {
  it('stops on a cancel, gives up on the browser when it taints, retries per page otherwise', () => {
    expect(classifyNativeFailure(new DOMException('x', 'AbortError'), false)).toBe('abort')
    expect(classifyNativeFailure(new Error('anything'), true)).toBe('abort')
    expect(classifyNativeFailure(new DOMException('tainted', 'SecurityError'), false)).toBe('tainted')
    expect(classifyNativeFailure(new DOMException('bad', 'EncodingError'), false)).toBe('failed')
    expect(classifyNativeFailure(new DOMException('slow', 'TimeoutError'), false)).toBe('failed')
    expect(classifyNativeFailure(null, false)).toBe('failed')
  })
})

describe('raceAbort / withTimeout', () => {
  it('rejects at once on abort, whatever the work is still doing', async () => {
    const ctrl = new AbortController()
    const never = new Promise<number>(() => {})
    const raced = raceAbort(never, ctrl.signal)
    ctrl.abort()
    await expect(raced).rejects.toMatchObject({ name: 'AbortError' })
    await expect(raceAbort(Promise.resolve(1), new AbortController().signal)).resolves.toBe(1)
    const gone = new AbortController()
    gone.abort()
    await expect(raceAbort(Promise.resolve(1), gone.signal)).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('times out a picture that never decodes', async () => {
    await expect(withTimeout(new Promise(() => {}), 5)).rejects.toMatchObject({ name: 'TimeoutError' })
    await expect(withTimeout(Promise.resolve('ok'), 50)).resolves.toBe('ok')
  })
})

describe('relocateMockyMedia', () => {
  const here = 'http://192.168.1.20:8787'
  const hash = 'a'.repeat(64)
  it('reads a library picture addressed through another name of the server on this origin', () => {
    expect(relocateMockyMedia(`http://localhost:8787/api/images/${hash}`, here)).toBe(`${here}/api/images/${hash}`)
    expect(relocateMockyMedia(`https://mocky.example/api/video/${hash}`, here)).toBe(`${here}/api/video/${hash}`)
  })
  it('leaves every other picture alone', () => {
    expect(relocateMockyMedia('https://images.pexels.com/photos/1/a.jpg', here)).toBe('https://images.pexels.com/photos/1/a.jpg')
    expect(relocateMockyMedia(`http://localhost:8787/api/images/not-a-hash`, here)).toBe('http://localhost:8787/api/images/not-a-hash')
    expect(relocateMockyMedia(`${here}/api/images/${hash}`, here)).toBe(`${here}/api/images/${hash}`)
    expect(relocateMockyMedia('data:image/png;base64,AAA', here)).toBe('data:image/png;base64,AAA')
  })
})
