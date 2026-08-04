import { describe, it, expect } from 'vitest'
import { MIN_SCORE, isInPageAnchor, overlap, proposeLinks, slugTokens, tokens, withoutExisting } from './autolink'
import type { LinkableElement } from './autolink'
import type { Screen } from './project'

function screen(id: string, over: Partial<Screen> = {}): Screen {
  return {
    id,
    name: id,
    prompt: '',
    code: 'function App(){return null}',
    componentName: 'App',
    createdAt: 0,
    x: 0,
    y: 0,
    w: 1440,
    h: 900,
    device: 'none',
    links: [],
    ...over,
  }
}

const el = (label: string, over: Partial<LinkableElement> = {}): LinkableElement => ({
  selector: `#${label.replace(/\W+/g, '-').toLowerCase()}`,
  label,
  rect: { x: 0, y: 0, w: 0.2, h: 0.05 },
  ...over,
})

describe('tokens', () => {
  it('folds accents, because the same intention gets typed both ways', () => {
    expect(tokens('Tarifs détaillés')).toEqual(['tarifs', 'detailles'])
  })

  it('drops words too common to be evidence', () => {
    expect(tokens('Voir la page de tarifs')).toEqual(['tarifs'])
  })

  it('drops words of two letters or fewer', () => {
    expect(tokens('Go to UX')).toEqual([])
  })

  it('survives nothing', () => {
    expect(tokens('')).toEqual([])
    expect(tokens('   —  ')).toEqual([])
  })
})

describe('overlap', () => {
  it('measures how much of the shorter phrase the longer one contains', () => {
    // Jaccard would score this near zero — the union is huge — and the feature
    // would stay silent on exactly the screens it exists for.
    expect(overlap(['tarifs'], ['une', 'page', 'de', 'tarifs', 'trois', 'formules'])).toBe(1)
  })

  it('is zero when nothing is shared, and safe when either side is empty', () => {
    expect(overlap(['tarifs'], ['contact'])).toBe(0)
    expect(overlap([], ['tarifs'])).toBe(0)
  })
})

describe('slugTokens', () => {
  it('reads the words out of a path', () => {
    expect(slugTokens('/tarifs/annuel?ref=nav')).toEqual(['tarifs', 'annuel'])
  })

  it('ignores anything that leaves the mockup', () => {
    // An external link is not a screen reference, and proposing one would send
    // the demo somewhere that does not exist.
    expect(slugTokens('https://example.com/tarifs')).toEqual([])
    expect(slugTokens('mailto:bonjour@example.com')).toEqual([])
  })

  it('handles a missing href', () => {
    expect(slugTokens(undefined)).toEqual([])
  })
})

describe('proposeLinks', () => {
  const accueil = screen('accueil', { prompt: 'une page d’accueil pour une boulangerie' })
  const tarifs = screen('tarifs', { prompt: 'une page de tarifs avec trois formules' })
  const contact = screen('contact', { prompt: 'un formulaire de contact' })

  it('follows the href the model itself wrote', () => {
    const out = proposeLinks([el('Nos formules', { href: '/tarifs' })], accueil, [accueil, tarifs, contact])
    expect(out).toHaveLength(1)
    expect(out[0].target).toBe('tarifs')
    expect(out[0].why).toBe('href')
  })

  it('falls back to the words on the button against the target prompt', () => {
    const out = proposeLinks([el('Voir les tarifs')], accueil, [accueil, tarifs, contact])
    expect(out[0]?.target).toBe('tarifs')
    expect(out[0]?.why).toBe('prompt')
  })

  it('finds the target in its markup when the prompt says nothing', () => {
    const mentions = screen('mentions', {
      prompt: 'un écran supplémentaire',
      code: 'function App(){return <div><h1>Conditions générales de vente</h1></div>}',
    })
    const out = proposeLinks([el('Conditions générales')], accueil, [accueil, mentions])
    expect(out[0]?.target).toBe('mentions')
    expect(out[0]?.why).toBe('content')
  })

  it('proposes nothing rather than something wrong', () => {
    // A missing proposal costs a click. A wrong one sends the demo somewhere
    // nobody expected, in front of whoever is being shown it.
    const out = proposeLinks([el('Envoyer')], accueil, [accueil, tarifs])
    expect(out).toEqual([])
  })

  it('never links a screen to itself', () => {
    const out = proposeLinks([el('Boulangerie accueil')], accueil, [accueil, tarifs])
    expect(out.every((c) => c.target !== 'accueil')).toBe(true)
  })

  it('keeps only the best target per element', () => {
    // Two screens could plausibly match; offering both is a puzzle, not a
    // proposal.
    const tarifsBis = screen('tarifs-bis', { prompt: 'une autre page de tarifs' })
    const out = proposeLinks([el('Tarifs')], accueil, [accueil, tarifs, tarifsBis])
    expect(out).toHaveLength(1)
  })

  it('sorts the surest first', () => {
    const out = proposeLinks(
      [el('Envoyer un message', { href: '/contact' }), el('tarifs')],
      accueil,
      [accueil, tarifs, contact],
    )
    expect(out.length).toBeGreaterThan(1)
    expect(out[0].score).toBeGreaterThanOrEqual(out[1].score)
  })

  it('ignores an element with nothing to go on', () => {
    expect(proposeLinks([el('  ')], accueil, [accueil, tarifs])).toEqual([])
  })

  it('returns nothing when there is nowhere to go', () => {
    expect(proposeLinks([el('Tarifs')], accueil, [accueil])).toEqual([])
    // A screen that never generated is not a destination.
    expect(proposeLinks([el('Tarifs')], accueil, [accueil, screen('vide', { code: '' })])).toEqual([])
  })

  it('every proposal clears the floor', () => {
    const out = proposeLinks(
      [el('Nos formules', { href: '/tarifs' }), el('Envoyer'), el('Voir les tarifs')],
      accueil,
      [accueil, tarifs, contact],
    )
    for (const c of out) expect(c.score).toBeGreaterThanOrEqual(MIN_SCORE)
  })
})

describe('withoutExisting', () => {
  it('drops what the screen is already wired for', () => {
    // addHotspot appends without checking anything, so re-proposing a wired
    // element is how a second pass silently doubles every link.
    const from = screen('a', {
      links: [{ id: 'h1', x: 0, y: 0, w: 1, h: 1, target: 'b', selector: '#tarifs' }],
    })
    const candidates = [
      { selector: '#tarifs', label: 'Tarifs', rect: { x: 0, y: 0, w: 1, h: 1 }, target: 'b', score: 0.9, why: 'href' as const },
      { selector: '#contact', label: 'Contact', rect: { x: 0, y: 0, w: 1, h: 1 }, target: 'c', score: 0.8, why: 'href' as const },
    ]
    expect(withoutExisting(candidates, from).map((c) => c.selector)).toEqual(['#contact'])
  })

  it('is a no-op on a screen with no links', () => {
    const candidates = [{ selector: '#x', label: 'X', rect: { x: 0, y: 0, w: 1, h: 1 }, target: 'b', score: 0.9, why: 'href' as const }]
    expect(withoutExisting(candidates, screen('a'))).toHaveLength(1)
  })
})

describe('in-page anchors', () => {
  it('recognises a fragment, and only a real one', () => {
    expect(isInPageAnchor('#waitlist')).toBe(true)
    expect(isInPageAnchor('#faq')).toBe(true)
    // A bare "#" is the placeholder href of a button that goes nowhere yet —
    // exactly what this feature exists to give a destination.
    expect(isInPageAnchor('#')).toBe(false)
    expect(isInPageAnchor('/pricing')).toBe(false)
    expect(isInPageAnchor('https://example.com#x')).toBe(false)
    expect(isInPageAnchor(undefined)).toBe(false)
  })

  it('never proposes a cross-screen link for a jump within the page', () => {
    // The trap: slugTokens strips the fragment, so "#waitlist" contributes
    // nothing and the element would be scored on its label alone — "Rejoindre
    // la liste" then matches a screen that talks about joining, and Mocky
    // offers to replace a working in-page scroll with a navigation elsewhere.
    const from = screen('a', { prompt: 'page daccueil avec une liste dattente' })
    const target = screen('b', { prompt: 'rejoindre la liste dattente inscription' })

    const anchored = proposeLinks([el('Rejoindre la liste', { href: '#waitlist' })], from, [target])
    expect(anchored).toEqual([])

    // The same element with a real path is still proposed, so the exclusion is
    // about the fragment and not about the words.
    const routed = proposeLinks([el('Rejoindre la liste', { href: '/liste-dattente' })], from, [target])
    expect(routed.length).toBeGreaterThan(0)
  })

  it('still proposes for a placeholder href', () => {
    const from = screen('a', { prompt: 'accueil' })
    const target = screen('b', { prompt: 'page de contact avec un formulaire' })
    const out = proposeLinks([el('Contact', { href: '#' })], from, [target])
    expect(out.map((c) => c.target)).toEqual(['b'])
  })
})
