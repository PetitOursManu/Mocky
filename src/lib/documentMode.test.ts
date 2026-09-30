import { describe, expect, it } from 'vitest'
import { composer } from '../i18n/parts/composer'
import { canvas } from '../i18n/parts/canvas'
import { project as projectPart } from '../i18n/parts/project'
import { PAGE_FORMATS, PAGE_GAP_PX, docFrameHeight, getPageFormat } from './pageFormats'
import { PRESETS, hintForDevice } from './presets'
import { SCREEN_THEMES } from './screenThemes'
import { generateComponent, SYSTEM_PROMPT } from './generate'
import { resolveCapabilities } from './capabilities/select'
import {
  DOCUMENT_CAP,
  DOCUMENT_EXCLUDED_CAPS,
  DOCUMENT_RULES,
  SAFE_MARGIN_PX,
  SOCIAL_SAFE_MARGIN_PX,
  STORY_SAFE_BOTTOM_PX,
  STORY_SAFE_TOP_PX,
  composerPageFormat,
  demoDocLayout,
  docFrameUpdate,
  documentHint,
  documentPipeline,
  hintForScreen,
  pageFormatChips,
  pageFormatName,
  pageInView,
  pagesInFrame,
  pickReference,
  thumbFrame,
} from './documentMode'

describe('the composer’s format chips', () => {
  it('show page formats only while a document type is chosen', () => {
    expect(composerPageFormat(null, null)).toBeNull()
    expect(composerPageFormat('dashboard', 'letter')).toBeNull()
    expect(composerPageFormat('hologram', 'letter')).toBeNull()
  })

  it('start a document type on its own format, then keep the one picked', () => {
    expect(composerPageFormat('flyer', null)).toBe('a4')
    expect(composerPageFormat('flyer', 'slides')).toBe('slides')
    // A stored choice from a later version reads as none, not as a guess.
    expect(composerPageFormat('flyer', 'tabloid' as never)).toBe('a4')
  })

  it('never carry a format across families: A4 for a report is not A4 for a post', () => {
    expect(composerPageFormat('instagram', 'a4')).toBe('social-portrait')
    expect(composerPageFormat('instagram', 'social-story')).toBe('social-story')
    expect(composerPageFormat('report', 'social-square')).toBe('a4')
    expect(composerPageFormat('poster', null)).toBe('a3')
  })

  it('offer a document the formats of its own family only', () => {
    expect(pageFormatChips('a4').map((c) => c.id)).toEqual(['a4', 'a4-landscape', 'a3', 'letter', 'letter-landscape', 'slides'])
    expect(pageFormatChips('social-square').map((c) => c.id)).toEqual([
      'social-square',
      'social-portrait',
      'social-story',
      'social-landscape',
    ])
  })

  it('offer every page format somewhere, named in both languages', () => {
    const chips = [...pageFormatChips('a4'), ...pageFormatChips('social-square')]
    expect(chips.map((c) => c.id).sort()).toEqual(PAGE_FORMATS.map((f) => f.id).sort())
    const missing: string[] = []
    for (const c of chips) {
      for (const key of [c.short, c.full]) {
        for (const [lang, dict] of Object.entries(composer) as [string, Record<string, string>][]) {
          if (!dict[key]?.trim()) missing.push(`${lang}: ${key}`)
        }
      }
    }
    expect(missing).toEqual([])
  })

  it('say what the person asked for, in their words', () => {
    const fr = composer.fr as Record<string, string>
    expect(fr['composer.pageFormat.a4']).toBe('A4')
    expect(fr['composer.pageFormat.a4-landscape']).toBe('A4 paysage')
    expect(fr['composer.pageFormat.letter']).toBe('US Letter')
    expect(fr['composer.pageFormat.letter-landscape']).toBe('US paysage')
    expect(fr['composer.pageFormat.slides']).toBe('Présentation 16:9')
  })
})

describe('documentHint', () => {
  it('states the exact page size, the Doc root and the safe margin for every format', () => {
    for (const f of PAGE_FORMATS) {
      const h = documentHint(f)
      expect(h, f.id).toContain(`${f.w}×${f.h}px`)
      expect(h, f.id).toContain(`<Doc format="${f.id}">`)
      expect(h, f.id).toContain('<Page')
      expect(h, f.id).toContain(`${f.kind === 'social' ? SOCIAL_SAFE_MARGIN_PX : SAFE_MARGIN_PX}px`)
      expect(h, f.id).toMatch(/^FORMAT: /)
      expect(h, f.id).toMatch(/no hover/i)
      expect(h, f.id).toMatch(/no animation/i)
      // The frame is exactly the page wide: `lg:` never applies on A4, so a
      // responsive headline ships at its small size.
      expect(h, f.id).toContain('no responsive prefixes (sm:, md:, lg:, xl:, 2xl:)')
    }
  })

  it('calls a slide a slide and a sheet of paper a printed document', () => {
    expect(documentHint(getPageFormat('slides'))).toMatch(/PRESENTATION/)
    expect(documentHint(getPageFormat('slides'))).toMatch(/slide/)
    expect(documentHint(getPageFormat('a4'))).toMatch(/PRINTED DOCUMENT/)
    expect(pageFormatName('letter-landscape')).toMatch(/US Letter landscape/)
  })

  it('tells a social image it is seen on a phone, and a story where the app draws over it', () => {
    const post = documentHint(getPageFormat('social-square'))
    expect(post).toMatch(/SOCIAL MEDIA VISUAL/)
    expect(post).toMatch(/CAROUSEL/)
    expect(post).toMatch(/phone/)
    expect(post).not.toMatch(/96 px per inch|arm's length/)
    const story = documentHint(getPageFormat('social-story'))
    expect(story).toContain(`top ${STORY_SAFE_TOP_PX}px`)
    expect(story).toContain(`bottom ${STORY_SAFE_BOTTOM_PX}px`)
    expect(post).not.toContain(`top ${STORY_SAFE_TOP_PX}px`)
    expect(pageFormatName('social-portrait')).toMatch(/social media visual/)
  })

  it('says nothing new to a sheet of paper or a slide', () => {
    for (const id of ['a4', 'letter', 'slides'] as const) {
      expect(documentHint(getPageFormat(id)), id).not.toMatch(/CAROUSEL|phone|story/i)
    }
  })
})

describe('hintForScreen', () => {
  it('is hintForDevice, byte for byte, for every screen that is not a document', () => {
    for (const p of PRESETS) {
      expect(hintForScreen({ device: p.device })).toBe(hintForDevice(p.device))
      expect(hintForScreen({ device: p.device, page: undefined })).toBe(hintForDevice(p.device))
    }
  })

  it('rebuilds a document’s page hint from the screen, whatever the composer shows', () => {
    expect(hintForScreen({ device: 'none', page: 'letter' })).toBe(documentHint(getPageFormat('letter')))
    expect(hintForScreen({ device: 'iphone', page: 'a4' })).toBe(documentHint(getPageFormat('a4')))
  })
})

describe('documentPipeline', () => {
  it('changes nothing for an ordinary screen', () => {
    const p = documentPipeline(undefined)
    expect(p).toMatchObject({ document: false, motionUltra: true, scrollVideo: true, planner: true, modeGuidance: true })
    expect(p.animations).toBeUndefined()
    expect(p.frame).toBeUndefined()
    const ids = ['icons', 'scene3d', 'animate', 'ultra']
    expect(p.caps(ids)).toBe(ids)
    expect(documentPipeline(null).document).toBe(false)
  })

  it('makes a document one page tall, still, and off the paths that move', () => {
    const p = documentPipeline('a4')
    const f = getPageFormat('a4')
    expect(p.document).toBe(true)
    expect(p.frame).toEqual({ w: f.w, h: docFrameHeight(f, 1) })
    expect(p.animations).toBe(false)
    expect(p).toMatchObject({ motionUltra: false, scrollVideo: false, planner: false, modeGuidance: false })
  })

  it('finds its own picture only for a document', () => {
    expect(documentPipeline(undefined).ownPicture).toBe(false)
    expect(documentPipeline('a4').ownPicture).toBe(true)
  })

  it('offers a document only what can live on paper, and always the page kit', () => {
    const p = documentPipeline('slides')
    const out = p.caps(['icons', 'charts', 'scene3d', 'three-lib', 'scrollvideo', 'motionfilm', 'ultra', 'animate', 'motion-lib'])
    expect(out).toEqual(['icons', 'charts', DOCUMENT_CAP])
    for (const id of DOCUMENT_EXCLUDED_CAPS) expect(out).not.toContain(id)
    expect(p.caps(['icons', DOCUMENT_CAP])).toEqual(['icons', DOCUMENT_CAP])
  })
})

describe('pickReference', () => {
  const app = (id: string, createdAt: number, code = '<main />') => ({ id, createdAt, code })
  const doc = (id: string, createdAt: number) => ({ id, createdAt, code: '<Doc format="a4"><Page /></Doc>', page: 'a4' as const })

  it('is the rule it always was for an app screen among app screens', () => {
    const screens = [app('b', 2), app('a', 1), app('empty', 0, ' ')]
    expect(pickReference(screens, { pinnedId: 'b', document: false })).toEqual({ kind: 'layout', screen: screens[0] })
    expect(pickReference(screens, { document: false })).toEqual({ kind: 'identity', screen: screens[1] })
    expect(pickReference(screens, { pinnedId: 'empty', document: false })).toBeUndefined()
    expect(pickReference(screens, { pinnedId: 'gone', document: false })).toBeUndefined()
    // A regenerating screen is not its own reference: the pin is skipped.
    expect(pickReference(screens, { pinnedId: 'b', excludeId: 'b', document: false })).toEqual({ kind: 'identity', screen: screens[1] })
  })

  it('never hands an app screen a document, pinned or oldest', () => {
    const screens = [doc('flyer', 0), app('home', 5)]
    expect(pickReference(screens, { pinnedId: 'flyer', document: false })).toEqual({ kind: 'identity', screen: screens[1] })
    expect(pickReference(screens, { document: false })).toEqual({ kind: 'identity', screen: screens[1] })
    expect(pickReference([doc('flyer', 0)], { document: false })).toBeUndefined()
  })

  it('never hands a document a layout, only an identity — the pinned screen’s first', () => {
    const screens = [app('home', 0), app('pricing', 3), doc('flyer', 1)]
    expect(pickReference(screens, { pinnedId: 'pricing', document: true })).toEqual({ kind: 'identity', screen: screens[1] })
    expect(pickReference(screens, { document: true })).toEqual({ kind: 'identity', screen: screens[0] })
    expect(pickReference([doc('flyer', 1), doc('recto', 2)], { excludeId: 'flyer', document: true })).toEqual({ kind: 'identity', screen: { ...doc('recto', 2) } })
  })
})

describe('docFrameUpdate', () => {
  const a4 = getPageFormat('a4')
  const doc = { page: 'a4' as const, w: a4.w, h: docFrameHeight(a4, 1) }

  it('grows the frame to the pages the kit counted, and says nothing when it already fits', () => {
    expect(docFrameUpdate(doc, 2, [])).toEqual({ page: null, size: { w: a4.w, h: 2 * a4.h + PAGE_GAP_PX }, overflow: [], overflowKey: '' })
    expect(docFrameUpdate(doc, 1, [])?.size).toBeNull()
  })

  it('names overflowing pages from 1, once each, and ignores what cannot be a page', () => {
    const u = docFrameUpdate(doc, 3, [2, 0, 0, 7, -1, 1.5, 'x'])
    expect(u?.overflow).toEqual([1, 3])
    expect(u?.overflowKey).toBe('1,3')
  })

  it('refuses a report that is not a page count, and ignores ordinary screens', () => {
    expect(docFrameUpdate(doc, 0, [])).toBeNull()
    expect(docFrameUpdate(doc, 'two', [])).toBeNull()
    expect(docFrameUpdate(doc, Number.NaN, [])).toBeNull()
    expect(docFrameUpdate({ w: 1440, h: 900 }, 2, [])).toBeNull()
  })

  it('follows the format the kit laid out, so the frame and Screen.page match the code', () => {
    // An edit that asked for landscape: the code now says a4-landscape.
    const land = getPageFormat('a4-landscape')
    const u = docFrameUpdate(doc, 2, [], 'a4-landscape')
    expect(u?.page).toBe('a4-landscape')
    expect(u?.size).toEqual({ w: land.w, h: docFrameHeight(land, 2) })
    // The same format, or a value that is not one, changes nothing.
    expect(docFrameUpdate(doc, 1, [], 'a4')).toMatchObject({ page: null, size: null })
    expect(docFrameUpdate(doc, 1, [], 'tabloid')).toMatchObject({ page: null, size: null })
    expect(docFrameUpdate(doc, 1, [], undefined)).toMatchObject({ page: null, size: null })
  })

  it('bounds what generated code can make the canvas do', () => {
    expect(docFrameUpdate(doc, 1e6, [])?.size?.h).toBe(docFrameHeight(a4, 50))
  })

  it('reads a frame’s page count back', () => {
    for (let n = 1; n < 6; n++) expect(pagesInFrame(a4, docFrameHeight(a4, n))).toBe(n)
    expect(pagesInFrame(a4, 10)).toBe(1)
  })
})

describe('the thumbnail of a document', () => {
  const band = { x: 0, y: 0, w: 1, h: 0.55 }

  it('is its first page, never the whole stack', () => {
    const a4 = getPageFormat('a4')
    const t = thumbFrame({ page: 'a4', w: a4.w, h: docFrameHeight(a4, 3) }, band)
    expect(t).toEqual({ w: a4.w, h: a4.h, region: band })
  })

  it('shows a landscape page or a slide whole', () => {
    const s = getPageFormat('slides')
    expect(thumbFrame({ page: 'slides', w: s.w, h: docFrameHeight(s, 4) }, band)).toEqual({
      w: s.w,
      h: s.h,
      region: { x: 0, y: 0, w: 1, h: 1 },
    })
  })

  it('is what it was for an ordinary screen', () => {
    expect(thumbFrame({ w: 1440, h: 900 }, band)).toEqual({ w: 1440, h: 900, region: band })
    expect(thumbFrame({ w: 0, h: 0 }, band)).toEqual({ w: 1024, h: 720, region: band })
  })
})

describe('the demo player’s pages', () => {
  const a4 = getPageFormat('a4')

  it('fits the width, and never enlarges a page past its printed size', () => {
    expect(demoDocLayout(a4, 2, 500, 28).scale).toBeCloseTo((500 - 56) / a4.w)
    const wide = demoDocLayout(a4, 2, 3000, 28)
    expect(wide.scale).toBe(1)
    expect(wide.boxH).toBe(docFrameHeight(a4, 2))
  })

  it('names the page under the middle of the view', () => {
    const scale = 0.5
    const pitch = (a4.h + PAGE_GAP_PX) * scale
    expect(pageInView(0, 600, 28, a4, scale, 3)).toBe(1)
    expect(pageInView(pitch, 600, 28, a4, scale, 3)).toBe(2)
    expect(pageInView(pitch * 10, 600, 28, a4, scale, 3)).toBe(3)
  })
})

describe('the words a person reads', () => {
  it('exist in both languages for the download button, the menu and the notices', () => {
    const keys = [
      [canvas, ['canvas.docDownload', 'canvas.docDownloadTitle', 'canvas.docPage']],
      [projectPart, ['project.docDownload', 'project.docOverflow', 'project.docOverflowMany', 'project.docFit', 'project.docFitting', 'project.docFitMeasuring', 'project.docFitDone', 'project.docFitCloser', 'project.docFitRejected', 'project.docFitNothing', 'project.docFitFailed', 'project.docUltraSkipped', 'project.docPictureMissing', 'project.busyDocPicture', 'project.exportDocsOnly', 'project.exportDocsSkipped']],
      [composer, ['composer.themeGroupDocuments', 'composer.themeGroupScreens']],
    ] as const
    for (const [part, list] of keys) {
      for (const k of list) {
        expect((part.fr as Record<string, string>)[k], k).toBeTruthy()
        expect((part.en as Record<string, string>)[k], k).toBeTruthy()
      }
    }
    expect((projectPart.fr as Record<string, string>)['project.docOverflow']).toContain('{pages}')
  })
})

/**
 * The override has to come AFTER the base rules, on the paths that build a
 * system turn from a screen's capabilities — and nowhere for a screen that is
 * not a document. Read off the request the transport actually sends.
 */
describe('DOCUMENT_RULES in the system turn', () => {
  const settings = { baseUrl: 'http://x', apiKey: 'k', model: 'm', provider: 'openrouter' } as never

  async function systemFor(capIds: string[]): Promise<string> {
    const original = globalThis.fetch
    let body = ''
    globalThis.fetch = (async (_url: unknown, init?: { body?: unknown }) => {
      body = String(init?.body ?? '')
      const line = JSON.stringify({ message: { content: '<<<MOCKY>>>\nfunction App(){ return null }\nexport default App\n<<<END>>>' }, done: true })
      return new Response(line + '\n', { status: 200 })
    }) as typeof fetch
    try {
      await generateComponent(settings, 'un flyer', 'FORMAT: …', undefined, undefined, undefined, resolveCapabilities(capIds))
    } finally {
      globalThis.fetch = original
    }
    const parsed = JSON.parse(body) as { messages?: { role: string; content: string }[]; body?: { messages?: { role: string; content: string }[] } }
    const messages = parsed.messages ?? parsed.body?.messages ?? []
    return messages.find((m) => m.role === 'system')?.content ?? ''
  }

  it('follows the app-oriented base rules on a document', async () => {
    const system = await systemFor(['icons', DOCUMENT_CAP])
    expect(system).toContain(DOCUMENT_RULES)
    expect(system.indexOf(DOCUMENT_RULES)).toBeGreaterThan(system.indexOf(SYSTEM_PROMPT))
  })

  it('is absent from every other screen', async () => {
    const system = await systemFor(['icons', 'charts', 'animate'])
    expect(system).toContain(SYSTEM_PROMPT)
    expect(system).not.toContain('DOCUMENT MODE')
  })

  it('names the kit it overrides with, and forbids what paper cannot do', () => {
    expect(DOCUMENT_RULES).toMatch(/OVERRIDE/)
    expect(DOCUMENT_RULES).toMatch(/<Doc/)
    expect(DOCUMENT_RULES).toMatch(/<Field>/)
    expect(DOCUMENT_RULES).toMatch(/no hover/i)
    expect(DOCUMENT_RULES).toMatch(/No animation/)
  })
})

describe('the document types', () => {
  it('each start on a page format this build knows', () => {
    const docs = SCREEN_THEMES.filter((th) => th.document)
    expect(docs.map((th) => th.id)).toContain('flyer')
    for (const th of docs) expect(PAGE_FORMATS.map((f) => f.id)).toContain(th.document!.page)
  })
})
