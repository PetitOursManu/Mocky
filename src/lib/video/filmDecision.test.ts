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
