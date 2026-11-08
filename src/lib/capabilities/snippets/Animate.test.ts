import { afterEach, describe, expect, it } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { AnimateSource, ANIMATE_EXPORTS, ANIMATE_PRESETS, ANIMATED_TEXT_PRESETS } from './Animate'
import { CAPABILITY_MAP } from '../registry'
import { capabilitiesUsedBy } from '../select'

/**
 * The animation pack rendered by the real React, from the very string the
 * preview prepends. A server render has no IntersectionObserver and no frame
 * loop, so what it shows is the first frame — which is exactly the frame a
 * capture or a still keeps, and the one that must never be empty.
 */

const pack = new Function('React', `${AnimateSource}\nreturn { Animated, AnimatedText, AnimatedWord, AnimatedProgress, AnimatedScrollText, AnimatedCollapse, AnimatedCursorGlow, wanted: mockyFxWanted, presets: MOCKY_PRESETS, fx: MOCKY_FX, reveal: MOCKY_ANIMATED_TEXT, triggerOf: mockyFxTrigger, frames: mockyFxFrames, progress: mockyProgress }`)(React) as {
  Animated: React.FC<Record<string, unknown>>
  AnimatedText: React.FC<Record<string, unknown>>
  AnimatedWord: React.FC<Record<string, unknown>>
  AnimatedProgress: React.FC<Record<string, unknown>>
  AnimatedScrollText: React.FC<Record<string, unknown>>
  AnimatedCollapse: React.FC<Record<string, unknown>>
  AnimatedCursorGlow: React.FC<Record<string, unknown>>
  wanted: (p: Record<string, unknown>) => boolean
  presets: Record<string, unknown>
  fx: Record<string, FxConfig>
  reveal: Record<string, unknown>
  triggerOf: (cfg: FxConfig, asked?: string) => string
  frames: (cfg: FxConfig) => Record<string, unknown>[]
  progress: (node: unknown, mode: string) => number
}
interface FxConfig { f: string; k?: Record<string, unknown>[]; ms?: number; fn?: string; e?: string; o?: string }
const g = globalThis as Record<string, unknown>
const html = (C: React.FC<Record<string, unknown>>, props: Record<string, unknown>, children?: React.ReactNode) =>
  renderToStaticMarkup(React.createElement(C, props, children))

/** A visible document with no Motion: the CSS engine, the one a test can read. */
function liveWindow(extra: Record<string, unknown> = {}) {
  g.window = { matchMedia: () => ({ matches: false }), ...extra }
  g.document = { hidden: false }
}

afterEach(() => {
  delete g.window
  delete g.document
})

describe('the animation vocabulary', () => {
  it('draws exactly the presets it tells the model about', () => {
    expect([...new Set([...Object.keys(pack.presets), ...Object.keys(pack.fx)])].sort()).toEqual([...ANIMATE_PRESETS].sort())
    expect(Object.keys(pack.reveal).sort()).toEqual([...ANIMATED_TEXT_PRESETS].sort())
    const card = CAPABILITY_MAP.animate.components!.find((c) => c.name === 'Animated')!.description
    for (const p of ANIMATE_PRESETS) expect(card, p).toContain(`"${p}"`)
    const reveal = CAPABILITY_MAP.animate.components!.find((c) => c.name === 'AnimatedText')!.description
    for (const p of ANIMATED_TEXT_PRESETS) expect(reveal, p).toContain(`"${p}"`)
  })

  it('loads the pack for a screen that names AnimatedText alone', () => {
    expect(ANIMATE_EXPORTS).toContain('AnimatedText')
    expect(capabilitiesUsedBy('<AnimatedText as="h1">Bonjour</AnimatedText>')).toContain('animate')
  })

  it('renders an entrance at its first frame with a transition for every property it moves', () => {
    liveWindow()
    const out = html(pack.Animated, { preset: 'reveal-up' }, 'Hello')
    expect(out).toContain('clip-path:inset(100% 0% 0% 0%)')
    expect(out).toContain('clip-path 800ms')
    expect(html(pack.Animated, { preset: 'blur-in' }, 'x')).toContain('filter 500ms')
  })

  it('loops with a keyframe animation, and holds a loop still in a capture frame', () => {
    liveWindow()
    expect(html(pack.Animated, { preset: 'float' }, 'x')).toContain('animation:mocky-float 5s ease-in-out infinite')
    liveWindow({ __mockyStill: true })
    expect(html(pack.Animated, { preset: 'spin-slow' }, 'x')).not.toContain('animation')
  })

  it('renders the final state, untouched, when nothing may move', () => {
    liveWindow({ __mockyAnimations: false })
    expect(html(pack.Animated, { preset: 'bounce-in', className: 'p-4' }, 'x')).toBe('<div class="p-4">x</div>')
  })
})

describe('the trigger engine', () => {
  it('leaves a screen with no trigger on the engine it was made with', () => {
    expect(pack.wanted({ preset: 'fade-up' })).toBe(false)
    expect(pack.wanted({ preset: 'fade-up', trigger: 'view' })).toBe(true)
    expect(pack.wanted({ preset: 'fade-up', stagger: 0.1 })).toBe(true)
    expect(pack.wanted({ preset: 'iris-in' })).toBe(true)
    expect(pack.wanted({ preset: 'tilt-3d', trigger: 'view' })).toBe(false)
    expect(pack.wanted({ preset: 'nothing-like-this', trigger: 'view' })).toBe(false)
  })

  it('reaches the children of a list, which the old engine never animated', () => {
    expect(pack.wanted({ preset: 'stagger-list' })).toBe(true)
  })

  it('gives every keyframe preset a usable table entry', () => {
    for (const [name, cfg] of Object.entries(pack.fx)) {
      if (cfg.f === 'fn') {
        expect(cfg.fn, name).toBeTruthy()
        continue
      }
      expect(cfg.k?.length, name).toBeGreaterThan(0)
      if (cfg.f !== 'scrub') expect(cfg.ms, name).toBeGreaterThan(0)
      const frames = pack.frames(cfg)
      expect(frames.length, name).toBeGreaterThanOrEqual(2)
      const offsets = frames.map((f) => f.offset).filter((o): o is number => typeof o === 'number')
      expect([...offsets].sort((a, b) => a - b), name).toEqual(offsets)
    }
  })

  it('falls back to the family default on a trigger the family cannot use', () => {
    expect(pack.triggerOf(pack.fx['float'], 'click')).toBe('load')
    expect(pack.triggerOf(pack.fx['parallax-slow'], 'view')).toBe('scroll')
    expect(pack.triggerOf(pack.fx['hover-lift'], 'scroll')).toBe('hover')
    expect(pack.triggerOf(pack.fx['fade-up'])).toBe('view')
    expect(pack.triggerOf(pack.fx['shake'])).toBe('click')
  })

  it('keeps Tailwind positioning alive: the 2D presets never write transform', () => {
    /* Named exceptions: a perspective or a skew has nowhere else to go. */
    for (const name of ['fade-up', 'rise', 'scale-in', 'slide-left', 'spring-up', 'hover-lift', 'parallax', 'float']) {
      for (const f of pack.fx[name].k!) expect(f, name).not.toHaveProperty('transform')
    }
  })

  it('renders the element whole on the first frame, with every attribute it was given', () => {
    liveWindow()
    expect(html(pack.Animated, { preset: 'iris-in', trigger: 'view', id: 'x', 'data-a': 1, className: 'p-4' }, 'Hello'))
      .toBe('<div id="x" data-a="1" class="p-4">Hello</div>')
  })

  it('finishes the last block of a page even when the page ends first', () => {
    g.window = { innerHeight: 800, pageYOffset: 1200 }
    g.document = { documentElement: { scrollHeight: 2000 }, body: { scrollHeight: 2000 } }
    expect(pack.progress({ offsetTop: 1900, offsetHeight: 100, offsetParent: null }, 'enter')).toBe(1)
  })

  it('is at the end, not the start, on a page that does not scroll', () => {
    g.window = { innerHeight: 800, pageYOffset: 0 }
    g.document = { documentElement: { scrollHeight: 800 }, body: { scrollHeight: 800 } }
    expect(pack.progress({ offsetTop: 400, offsetHeight: 100, offsetParent: null }, 'enter')).toBe(1)
  })
})

describe('the components with no animation left to play', () => {
  it('draws nothing that only exists to move', () => {
    liveWindow({ __mockyAnimations: false })
    expect(html(pack.AnimatedProgress, {})).toBe('')
    expect(html(pack.AnimatedCursorGlow, {})).toBe('')
  })

  it('shows the first word and the whole line, as plain text', () => {
    liveWindow({ __mockyAnimations: false })
    expect(html(pack.AnimatedWord, { words: ['un', 'deux'], className: 'x' })).toBe('<span class="x">un</span>')
    expect(html(pack.AnimatedScrollText, {}, 'Une bande')).toContain('>Une bande<')
  })

  it('closes a collapse so that nothing in it can be reached', () => {
    liveWindow()
    const out = html(pack.AnimatedCollapse, { open: false }, 'Texte')
    expect(out).toContain('grid-template-rows:0fr')
    expect(out).toContain('visibility:hidden')
    expect(out).toContain('aria-hidden="true"')
  })

  it('keeps the plain path for the text presets drawn by their own component', () => {
    liveWindow({ __mockyAnimations: false })
    for (const preset of ['scramble', 'typewriter', 'scroll-fill']) {
      expect(html(pack.AnimatedText, { as: 'p', preset }, 'Bonjour')).toBe('<p>Bonjour</p>')
    }
  })
})

describe('AnimatedText', () => {
  it('splits a line into words, named as a whole for screen readers, with a word that never breaks', () => {
    liveWindow()
    const out = html(pack.AnimatedText, { as: 'h1', className: 'text-6xl' }, 'Le design en une phrase')
    expect(out).toMatch(/^<h1 class="text-6xl" aria-label="Le design en une phrase">/)
    expect(out).toContain('aria-hidden="true"')
    expect(out.match(/white-space:nowrap/g)?.length).toBe(5)
    expect(out).toContain('opacity:0')
  })

  it('splits into letters on request, and masks each word for the editorial reveal', () => {
    liveWindow()
    const out = html(pack.AnimatedText, { by: 'letter', preset: 'mask' }, 'Oui')
    expect(out.match(/display:inline-block/g)?.length).toBe(4) // one word box, three letters
    expect(out).toContain('overflow:hidden')
  })

  it('is the plain text when animations are off or the children are not text', () => {
    liveWindow({ __mockyAnimations: false })
    expect(html(pack.AnimatedText, { as: 'h2', className: 'x' }, 'Bonjour')).toBe('<h2 class="x">Bonjour</h2>')
    liveWindow()
    expect(html(pack.AnimatedText, { as: 'p' }, React.createElement('b', null, 'gras'))).toBe('<p><b>gras</b></p>')
  })
})
