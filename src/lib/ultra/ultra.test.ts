import { describe, it, expect } from 'vitest'
import { ULTRA_RECIPES, ULTRA_RECIPE_IDS, recipeCatalogue } from './recipes'
import { fallbackStoryboard, parseJsonObject, validateStoryboard, ULTRA_IMAGE_COUNTS } from './storyboard'
import { buildUltraImagePrompt } from './images'
import { buildUltraPreamble } from './preamble'
import { ULTRA_CLASSES, BACKDROP_PRESETS } from '../capabilities/snippets/Ultra'
import { SCREEN_MODES } from '../plan'

describe('the recipe catalogue', () => {
  it('gives every recipe a card of three sentences: what it is, how it is built, how it fails', () => {
    for (const id of ULTRA_RECIPE_IDS) {
      const r = ULTRA_RECIPES[id]
      expect(r.id).toBe(id)
      expect(r.card).toHaveLength(3)
      for (const s of r.card) expect(s.trim().length, id).toBeGreaterThan(20)
      expect(r.card[2], id).toMatch(/fails/)
    }
  })

  /** A recipe that names a class or a preset the kit does not have teaches the model a typo. */
  it('only names kit classes and backdrop presets that exist', () => {
    for (const id of ULTRA_RECIPE_IDS) {
      const text = ULTRA_RECIPES[id].card.join(' ')
      for (const [, cls] of text.matchAll(/`(u-[a-z0-9-]+)`/g)) expect(ULTRA_CLASSES, `${id}: ${cls}`).toHaveProperty(cls)
      for (const [, preset] of text.matchAll(/<Backdrop preset="([a-z-]+)"/g)) {
        expect(BACKDROP_PRESETS as readonly string[], `${id}: ${preset}`).toContain(preset)
      }
    }
  })

  it('offers something for every kind of screen, the application ones included', () => {
    for (const mode of SCREEN_MODES) {
      expect(ULTRA_RECIPE_IDS.some((id) => ULTRA_RECIPES[id].modes.includes(mode)), mode).toBe(true)
    }
    // A page offers everything, the fitting recipes first; an app screen only its own.
    const page = recipeCatalogue('persuade').split('\n')
    expect(page[0]).toContain('(fits this surface)')
    expect(page).toHaveLength(ULTRA_RECIPE_IDS.length)
    const app = recipeCatalogue('operate').split('\n')
    expect(app).toHaveLength(ULTRA_RECIPE_IDS.filter((id) => ULTRA_RECIPES[id].modes.includes('operate')).length)
    for (const line of app) expect(line).toContain('(fits this surface)')
  })
})

describe('the storyboard', () => {
  const answer = {
    style: 'Soft studio light, violet and ice blue, matte ceramic',
    sections: [
      { id: 'Hero Section', recipe: 'object-hero', content: 'Aurel, the ceramic speaker.' },
      { id: 'hero', recipe: 'glass-cards', content: 'Three reasons.' },
      { id: 'nonsense', recipe: 'a-recipe-that-does-not-exist', content: 'x' },
      { id: 'cta', recipe: 'cinematic-cta', content: 'Pre-order.' },
    ],
    images: [
      { section: 'hero-section', role: 'subject', subject: 'The speaker, three-quarter view' },
      { section: 'nowhere', role: 'backdrop', subject: 'A violet haze' },
      { section: 'cta', role: 'unknown-role', subject: 'dropped' },
    ],
  }

  it('drops what it cannot use and keeps the rest', () => {
    const b = validateStoryboard(answer, 3)!
    expect(b.sections.map((s) => s.recipe)).toEqual(['object-hero', 'glass-cards', 'cinematic-cta'])
    // Slugged, and renamed rather than refused when two collide.
    expect(b.sections.map((s) => s.id)).toEqual(['hero-section', 'hero', 'cta'])
    expect(b.fallback).toBe(false)
  })

  it('makes EXACTLY the number of pictures the user chose, never the model', () => {
    for (const count of ULTRA_IMAGE_COUNTS) {
      expect(validateStoryboard(answer, count)!.images).toHaveLength(count)
      const lavish = { ...answer, images: Array.from({ length: 10 }, () => answer.images[0]) }
      expect(validateStoryboard(lavish, count)!.images).toHaveLength(count)
    }
  })

  it('gives a picture that names no real section to one whose recipe wants it', () => {
    const b = validateStoryboard(answer, 3)!
    const haze = b.images.find((im) => im.subject === 'A violet haze')!
    // glass-cards takes a backdrop; the opening's object-hero takes one too and comes first.
    expect(['hero-section', 'hero', 'cta']).toContain(haze.section)
    for (const im of b.images) expect(b.sections.map((s) => s.id)).toContain(im.section)
  })

  it('returns null only when no section survives', () => {
    expect(validateStoryboard({ sections: [{ id: 'x', recipe: 'nope' }] }, 3)).toBeNull()
    expect(validateStoryboard('prose', 3)).toBeNull()
  })

  it('falls back to a usable storyboard for every kind of screen', () => {
    for (const mode of SCREEN_MODES) {
      for (const count of ULTRA_IMAGE_COUNTS) {
        const b = fallbackStoryboard('A dashboard for a bakery', count, mode)
        expect(b.fallback).toBe(true)
        expect(b.images).toHaveLength(count)
        expect(b.sections.length).toBeGreaterThan(0)
      }
    }
  })

  it('reads a JSON answer wrapped in prose or a fence', () => {
    expect(parseJsonObject('Here you go:\n```json\n{"a":1}\n```')).toEqual({ a: 1 })
    expect(parseJsonObject('{"a":2}')).toEqual({ a: 2 })
    expect(parseJsonObject('no json here')).toBeNull()
  })
})

describe('the pictures and the generation section', () => {
  const board = validateStoryboard(
    {
      style: 'Soft studio light, violet.',
      sections: [
        { id: 'hero', recipe: 'object-hero', content: 'Aurel.' },
        { id: 'cta', recipe: 'cinematic-cta', content: 'Buy.' },
      ],
      images: [
        { section: 'hero', role: 'subject', subject: 'The speaker.' },
        { section: 'cta', role: 'backdrop', subject: 'A haze.' },
        { section: 'hero', role: 'backdrop', subject: 'A glow.' },
      ],
    },
    3,
  )!

  it('prompts every picture with the ONE shared style and keeps lettering out', () => {
    const p = buildUltraImagePrompt(board.images[0], board.style)
    expect(p).toContain('The speaker')
    expect(p).toContain('Soft studio light, violet')
    expect(p).toMatch(/no text/)
    expect(p).not.toContain('..')
  })

  it('lists every picture that was made, and says which were not', () => {
    const made = [{ ...board.images[0], hash: 'a'.repeat(64), url: `http://x/api/images/${'a'.repeat(64)}` }]
    const text = buildUltraPreamble(board, made)
    expect(text).toContain('id="hero"')
    expect(text).toContain('recipe "cinematic-cta"')
    expect(text).toContain(made[0].url)
    expect(text).toContain('Only 1 of the 3 planned pictures')
    expect(buildUltraPreamble(board, [])).toContain('No picture could be made')
  })
})

describe('an exported Motion Ultra screen', () => {
  /** The stylesheet lives in the module; a screen of classes alone must still load it. */
  it('imports the kit for its side effect when it uses only the classes', async () => {
    const { rewriteScreenToEsm } = await import('../export/rewrite')
    const out = await rewriteScreenToEsm('function App(){ return <div className="u-glass p-6">Hi</div> }\nexport default App')
    expect(out.source).toContain("import '@/components/ui/ultra'")
    const plain = await rewriteScreenToEsm('function App(){ return <div className="p-6">Hi</div> }\nexport default App')
    expect(plain.source).not.toContain('ui/ultra')
    const named = await rewriteScreenToEsm('function App(){ return <section className="relative u-glass"><Backdrop preset="mesh" /></section> }\nexport default App')
    expect(named.source).toContain("import { Backdrop } from '@/components/ui/ultra'")
    expect(named.source).not.toContain("import '@/components/ui/ultra'")
  })
})

describe("the screen's mode", () => {
  /** A product page with no "landing" in its prompt was guessed as an app and got an app shell. */
  it("is the storyboard's to decide, over the keyword guess", () => {
    const answer = { mode: 'persuade', style: 'x', sections: [{ id: 'hero', recipe: 'object-hero', content: 'Aurel.' }], images: [] }
    const b = validateStoryboard(answer, 3, 'operate')!
    expect(b.mode).toBe('persuade')
    expect(b.sections.map((s) => s.recipe)).toEqual(['object-hero'])
    expect(fallbackStoryboard('x', 3, 'read').mode).toBe('read')
  })
})

describe('an application screen', () => {
  /** The first real dashboard became a landing page with its orders listed twice. */
  it('refuses the recipes written for pages the visitor reads', () => {
    const answer = {
      style: 'x',
      sections: [
        { id: 'shell', recipe: 'ambient-shell', content: 'Workshop app.' },
        { id: 'stock', recipe: 'glass-cards', content: 'Pieces per stage.' },
        { id: 'orders', recipe: 'editorial-read', content: 'Latest pre-orders.' },
        { id: 'cta', recipe: 'cinematic-cta', content: 'Buy.' },
      ],
      images: [],
    }
    expect(validateStoryboard({ ...answer, mode: 'operate' }, 3)!.sections.map((s) => s.recipe)).toEqual(['ambient-shell', 'glass-cards'])
    expect(validateStoryboard({ ...answer, mode: 'persuade' }, 3)!.sections).toHaveLength(4)
    // No valid mode in the answer: the keyword guess decides.
    expect(validateStoryboard({ ...answer, mode: 'nonsense' }, 3, 'operate')!.sections).toHaveLength(2)
    expect(recipeCatalogue('operate')).not.toContain('editorial-read')
    for (const s of fallbackStoryboard('x', 3, 'operate').sections) expect(ULTRA_RECIPES[s.recipe].modes).toContain('operate')
  })

  it('tells the generator the sections are panels inside one frame', () => {
    const board = fallbackStoryboard('Workshop dashboard', 3, 'operate')
    expect(buildUltraPreamble(board, [])).toContain('ONE application screen')
    expect(buildUltraPreamble(fallbackStoryboard('Landing', 3, 'persuade'), [])).not.toContain('ONE application screen')
  })
})

describe('what a Motion Ultra screen must still hold', () => {
  const A = 'a'.repeat(64)
  const B = 'b'.repeat(64)
  const record = { images: [A, B] }
  const page = `<section className="u-glass"><img src="http://x/api/images/${A}" /><img src="http://x/api/images/${B}" /></section>`

  it('names the pictures a generation left out', async () => {
    const { missingUltraImages } = await import('./check')
    expect(missingUltraImages(page, record)).toEqual([])
    expect(missingUltraImages(page.replace(B, 'zz'), record)).toEqual([B])
  })

  it('reports what an edit took away, and only that', async () => {
    const { ultraLoss } = await import('./check')
    expect(ultraLoss(page, page.replace('Hello', 'Bonjour'), record)).toBeNull()
    expect(ultraLoss(page, page.replace(`<img src="http://x/api/images/${B}" />`, ''), record)).toEqual({ images: [B], kit: false })
    expect(ultraLoss(page, page.replace('u-glass', 'bg-white'), record)).toEqual({ images: [], kit: true })
    // A picture the screen had already dropped is not the edit's loss.
    const without = page.replace(`<img src="http://x/api/images/${B}" />`, '')
    expect(ultraLoss(without, without, record)).toBeNull()
  })
})

describe('how much of a Motion Ultra page moves at once', () => {
  it('counts backdrops and looping classes, and nothing that merely resembles them', async () => {
    const { ultraMotionCount, ULTRA_BUDGET } = await import('./check')
    const calm = '<section><Backdrop preset="mesh" /><h1 className="u-display u-reveal">Hi</h1><img className="u-float" /></section>'
    expect(ultraMotionCount(calm)).toEqual({ backdrops: 1, loops: 1, over: false })
    expect(ultraMotionCount('<p className="menu-sheen u-sheenish">x</p>').loops).toBe(0)
    const busy = Array.from({ length: ULTRA_BUDGET.loops + 1 }, () => '<div className="u-float">x</div>').join('')
    expect(ultraMotionCount(busy).over).toBe(true)
    const backdrops = Array.from({ length: ULTRA_BUDGET.backdrops + 1 }, () => '<Backdrop preset="aurora" />').join('')
    expect(ultraMotionCount(backdrops).over).toBe(true)
  })
})

describe('the video background (v2)', () => {
  const page = [
    'function App() {',
    '  return (<main>',
    '    <section id="hero" className="relative overflow-hidden">',
    '      <Backdrop slot="film" preset="aurora" colors={["#111111"]} veil={0.4} />',
    '      <h1>Hi</h1>',
    '    </section>',
    '    <section id="cta"><Backdrop preset="beams" /></section>',
    '  </main>)',
    '}',
  ].join('\n')

  it('plugs the film into the slot the page kept, and touches nothing else', async () => {
    const { plugFilmIntoSlot } = await import('./filmSlot')
    const out = (await plugFilmIntoSlot(page, 'http://x/api/video/abc'))!
    expect(out).toContain('<Backdrop video="http://x/api/video/abc" slot="film" preset="aurora"')
    expect(out.replace(' video="http://x/api/video/abc"', '')).toBe(page)
    // A second film replaces the first rather than stacking a second attribute.
    const again = (await plugFilmIntoSlot(out, 'http://x/api/video/def'))!
    expect(again.match(/video=/g)).toHaveLength(1)
    expect(again).toContain('video="http://x/api/video/def"')
  })

  it('does nothing without a slot, or on a source that does not parse', async () => {
    const { plugFilmIntoSlot } = await import('./filmSlot')
    expect(await plugFilmIntoSlot(page.replace('slot="film" ', ''), 'u')).toBeNull()
    expect(await plugFilmIntoSlot('function App( { return <Backdrop slot="film" /', 'u')).toBeNull()
  })

  it('gives the film to the first section built on a full-bleed ground, never a grid or a shell', async () => {
    const { filmSectionOf } = await import('./filmSlot')
    expect(filmSectionOf([{ id: 'hero', recipe: 'object-hero' }, { id: 'band', recipe: 'parallax-band' }, { id: 'cta', recipe: 'cinematic-cta' }])).toBe('band')
    expect(filmSectionOf([{ id: 'shell', recipe: 'ambient-shell' }, { id: 'overview', recipe: 'banner-panel' }])).toBe('overview')
    expect(filmSectionOf([{ id: 'features', recipe: 'glass-cards' }])).toBeNull()
  })

  it('tells the generator to keep the place, only in that section', () => {
    const board = fallbackStoryboard('Landing', 3, 'persuade')
    const text = buildUltraPreamble(board, [], { filmSection: board.sections[0].id })
    expect(text.match(/slot="film"/g)?.length).toBeGreaterThanOrEqual(1)
    expect(text).toContain('Do NOT write <video> or <MotionFilm>')
    expect(buildUltraPreamble(board, [])).not.toContain('slot="film"')
  })
})
