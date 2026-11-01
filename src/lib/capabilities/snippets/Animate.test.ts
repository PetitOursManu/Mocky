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

const pack = new Function('React', `${AnimateSource}\nreturn { Animated, AnimatedText, presets: MOCKY_PRESETS, reveal: MOCKY_ANIMATED_TEXT }`)(React) as {
  Animated: React.FC<Record<string, unknown>>
  AnimatedText: React.FC<Record<string, unknown>>
  presets: Record<string, unknown>
  reveal: Record<string, unknown>
}
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
    expect(Object.keys(pack.presets).sort()).toEqual([...ANIMATE_PRESETS].sort())
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
