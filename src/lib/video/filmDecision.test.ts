import { describe, it, expect } from 'vitest'
import { decideFilm, dossierMotionRequest } from './filmDecision'

const KINDS = ['hero', 'background', 'globe']

describe('whether a screen gets a film', () => {
  it('never under "sans animation", whatever the dossier said', () => {
    expect(decideFilm({ mode: 'off', kinds: KINDS, dossier: { wanted: true, kind: 'globe' } })).toBeNull()
  })

  it('never when Motion cannot run for this account', () => {
    expect(decideFilm({ mode: 'on', kinds: [], dossier: { wanted: true, kind: 'globe' } })).toBeNull()
  })

  /** Auto follows the dossier, which is prudent by design — and without Muse there is nobody to ask. */
  it('follows the dossier in auto, and makes none without it', () => {
    expect(decideFilm({ mode: 'auto', kinds: KINDS, dossier: { wanted: true, kind: 'globe', section: 'coverage' } })).toEqual({
      kind: 'globe',
      section: 'coverage',
    })
    expect(decideFilm({ mode: 'auto', kinds: KINDS, dossier: { wanted: false } })).toBeNull()
    expect(decideFilm({ mode: 'auto', kinds: KINDS })).toBeNull()
  })

  it('always makes one under "forcées", with the dossier’s kind or the first on offer', () => {
    expect(decideFilm({ mode: 'on', kinds: KINDS, dossier: { wanted: true, kind: 'globe' } })?.kind).toBe('globe')
    expect(decideFilm({ mode: 'on', kinds: KINDS })).toEqual({ kind: 'hero' })
    expect(decideFilm({ mode: 'on', kinds: ['globe', 'figure'] })).toEqual({ kind: 'globe' })
  })

  it('refuses a kind the account can no longer render', () => {
    expect(decideFilm({ mode: 'auto', kinds: ['hero'], dossier: { wanted: true, kind: 'globe' } })).toBeNull()
    expect(decideFilm({ mode: 'on', kinds: ['hero'], dossier: { wanted: true, kind: 'globe' } })).toEqual({ kind: 'hero' })
  })
})

describe('what the dossier is asked', () => {
  it('nothing under "sans animation" or when Motion cannot run', () => {
    expect(dossierMotionRequest('off', KINDS)).toBeNull()
    expect(dossierMotionRequest('auto', [])).toBeNull()
  })

  it('a prudent question in auto, an order under "forcées"', () => {
    expect(dossierMotionRequest('auto', KINDS)).toEqual({ mode: 'auto', kinds: KINDS })
    expect(dossierMotionRequest('on', KINDS)).toEqual({ mode: 'force', kinds: KINDS })
  })
})

/**
 * A page that already animates its own background.
 *
 * The user's brief said "un fond animé en 3D", the model answered it with a
 * `<Scene3D>` laid full-bleed behind the content, and Muse then asked for a
 * `background` film — a second animated background on the same screen, with no
 * way for a visitor to tell which of the two is the site.
 */
describe('a film is never the second animated background', () => {
  const ALL = ['hero', 'background', 'banner', 'showcase', 'figure', 'globe', 'mark', 'story']

  it('moves the film to another kind, and drops the section chosen for a background', () => {
    const decided = decideFilm({
      mode: 'auto',
      kinds: ALL,
      dossier: { wanted: true, kind: 'background', section: 'hero', why: 'depth behind the words' },
      pageAnimatesBackground: true,
    })
    // The section and the reason went with the kind: "#hero, behind the words"
    // was chosen FOR a background, and anything else put there is a film over a
    // moving backdrop — the same collision one level down.
    expect(decided).toEqual({ kind: 'showcase' })
  })

  it('leaves every other kind exactly where the dossier put it', () => {
    const dossier = { wanted: true, kind: 'hero', section: 'hero', why: 'it should breathe' }
    expect(decideFilm({ mode: 'auto', kinds: ALL, dossier, pageAnimatesBackground: true })).toEqual({
      kind: 'hero',
      section: 'hero',
      why: 'it should breathe',
    })
  })

  it('changes nothing at all on a page that animates nothing', () => {
    const dossier = { wanted: true, kind: 'background', section: 'hero', why: 'depth' }
    expect(decideFilm({ mode: 'auto', kinds: ALL, dossier })).toEqual({
      kind: 'background',
      section: 'hero',
      why: 'depth',
    })
  })

  it('takes the substitute the account can actually render', () => {
    const dossier = { wanted: true, kind: 'background' }
    expect(
      decideFilm({ mode: 'auto', kinds: ['background', 'mark'], dossier, pageAnimatesBackground: true }),
    ).toEqual({ kind: 'mark' })
    // Nothing else on offer: no film beats a second background.
    expect(
      decideFilm({ mode: 'auto', kinds: ['background'], dossier, pageAnimatesBackground: true }),
    ).toBeNull()
  })

  it('applies under "forcées" too, where the kind is chosen without a dossier', () => {
    expect(
      decideFilm({ mode: 'on', kinds: ['background', 'figure'], pageAnimatesBackground: true }),
    ).toEqual({ kind: 'figure' })
  })
})

/** A real run: a hero film placed over Motion Ultra's hero left it empty, with no headline. */
describe('a film on a Motion Ultra screen', () => {
  const ALL = ['hero', 'background', 'showcase', 'globe']

  it('never takes the opening Motion Ultra built', () => {
    const hero = { wanted: true, kind: 'hero', section: 'hero', why: 'Open on the product.' }
    expect(decideFilm({ mode: 'auto', kinds: ALL, dossier: hero, openingTaken: 'hero' })).toEqual({ kind: 'showcase' })
    const bg = { wanted: true, kind: 'background', section: '#features' }
    expect(decideFilm({ mode: 'auto', kinds: ALL, dossier: bg, openingTaken: 'hero' })).toEqual({ kind: 'showcase' })
    // Another kind aimed AT the opening moves too.
    const there = { wanted: true, kind: 'globe', section: '#Hero' }
    expect(decideFilm({ mode: 'auto', kinds: ALL, dossier: there, openingTaken: 'hero' })).toEqual({ kind: 'showcase' })
  })

  it('leaves a film elsewhere alone, and makes none when only the opening kinds exist', () => {
    const elsewhere = { wanted: true, kind: 'globe', section: 'reach', why: 'Where we ship.' }
    expect(decideFilm({ mode: 'auto', kinds: ALL, dossier: elsewhere, openingTaken: 'hero' })).toEqual({
      kind: 'globe', section: 'reach', why: 'Where we ship.',
    })
    expect(decideFilm({ mode: 'on', kinds: ['hero', 'background'], openingTaken: 'hero' })).toBeNull()
    // Without Motion Ultra, nothing changes.
    expect(decideFilm({ mode: 'on', kinds: ALL })).toEqual({ kind: 'hero' })
  })
})
