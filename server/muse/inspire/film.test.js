import { describe, it, expect, vi } from 'vitest'
import { filmJsonSchema, filmPromptLines, readMotionRequest, settleFilm } from './film.js'
import { buildDossier, buildFallbackDossier, dossierToMarkdown } from './dossier.js'
import { MOTION_KINDS } from '../../video/kinds.js'

const AUTO = { mode: 'auto', kinds: ['hero', 'globe', 'figure'] }
const FORCE = { mode: 'force', kinds: ['hero', 'globe', 'figure'] }

describe('the request, read strictly', () => {
  it('keeps two modes and the server’s own kinds, and nothing else', () => {
    expect(readMotionRequest({ mode: 'auto', kinds: ['globe', 'hero', 'teleport'] })).toEqual({
      mode: 'auto',
      // In the enum's own order, whatever order the panel sent.
      kinds: MOTION_KINDS.filter((k) => k === 'hero' || k === 'globe'),
    })
    expect(readMotionRequest({ mode: 'always', kinds: ['hero'] })).toBeNull()
    expect(readMotionRequest({ mode: 'auto', kinds: ['teleport'] })).toBeNull()
    expect(readMotionRequest(null)).toBeNull()
  })
})

describe('what the model is told', () => {
  it('says nothing at all when the composer did not ask', () => {
    expect(filmPromptLines(null)).toEqual([])
    expect(filmJsonSchema(null)).toBeNull()
  })

  /** Prudence is the default: a film is a model call and minutes of render. */
  it('is conservative in auto and unconditional under the button', () => {
    expect(filmPromptLines(AUTO).join('\n')).toMatch(/Be CONSERVATIVE/)
    expect(filmPromptLines(AUTO).join('\n')).toMatch(/A form, a settings page, a dashboard, a pricing table/)
    expect(filmPromptLines(FORCE).join('\n')).toMatch(/`film.wanted` MUST be true/)
  })

  it('offers only the kinds this account can render', () => {
    const text = filmPromptLines({ mode: 'auto', kinds: ['figure'] }).join('\n')
    expect(text).toContain('- figure:')
    expect(text).not.toContain('- globe:')
    expect(filmJsonSchema({ mode: 'auto', kinds: ['figure'] }).properties.kind.enum).toEqual(['figure'])
  })
})

describe('the decision, settled by the server', () => {
  it('lets auto say no, and yes only with a kind on offer', () => {
    expect(settleFilm({ wanted: false }, AUTO)).toEqual({ wanted: false })
    expect(settleFilm({ wanted: true, kind: 'globe', section: 'Coverage', why: 'Worldwide.' }, AUTO)).toEqual({
      wanted: true,
      kind: 'globe',
      section: 'coverage',
      why: 'Worldwide.',
    })
    // An unusable kind is a no rather than a guess.
    expect(settleFilm({ wanted: true, kind: 'showcase' }, AUTO)).toEqual({ wanted: false })
  })

  it('never lets a model overrule the button', () => {
    expect(settleFilm({ wanted: false }, FORCE)).toEqual({ wanted: true, kind: 'hero' })
    expect(settleFilm(null, FORCE)).toEqual({ wanted: true, kind: 'hero' })
    expect(settleFilm({ wanted: true, kind: 'figure' }, FORCE).kind).toBe('figure')
  })

  it('drops a section that is not one word', () => {
    expect(settleFilm({ wanted: true, kind: 'hero', section: 'the top of the page' }, AUTO)).toEqual({ wanted: true, kind: 'hero' })
  })

  it('decides nothing when nobody asked', () => {
    expect(settleFilm({ wanted: true, kind: 'hero' }, null)).toBeUndefined()
  })
})

describe('inside the dossier', () => {
  const answer = {
    productName: 'Orbe',
    concept: 'A calm atlas.',
    tokens: { colors: [{ label: 'Background', hex: '#0b0b0f' }] },
    layoutGrammar: [],
    voice: {},
    imageryPlan: [{ id: 'hero', prompt: 'a globe, high quality, no text, no watermark' }],
    forbidden: [],
    film: { wanted: true, kind: 'globe', section: 'coverage', why: 'Worldwide presence.' },
  }

  it('asks in the same call, and keeps the settled decision', async () => {
    const llm = vi.fn(async () => answer)
    const dossier = await buildDossier(llm, { prompt: 'logistics in 40 countries', blacklist: [], motion: AUTO })
    expect(llm).toHaveBeenCalledTimes(1)
    expect(llm.mock.calls[0][0].schema.required).toContain('film')
    expect(llm.mock.calls[0][0].system).toMatch(/Be CONSERVATIVE/)
    expect(dossier.film).toEqual({ wanted: true, kind: 'globe', section: 'coverage', why: 'Worldwide presence.' })
  })

  it('is left out of the direction: DESIGN.md is the project’s, a film is one screen’s', async () => {
    const dossier = await buildDossier(vi.fn(async () => answer), { prompt: 'x', blacklist: [], motion: AUTO })
    const md = dossierToMarkdown(dossier, { projectName: 'Orbe' })
    expect(md).not.toMatch(/Worldwide presence|wanted|## Film/i)
  })

  it('carries no decision, and no film question, when the composer did not ask', async () => {
    const llm = vi.fn(async () => answer)
    const dossier = await buildDossier(llm, { prompt: 'x', blacklist: [] })
    expect(llm.mock.calls[0][0].schema.properties).not.toHaveProperty('film')
    expect(dossier.film).toBeUndefined()
  })

  it('still honours the button with no model at all', () => {
    expect(buildFallbackDossier({ prompt: 'x', blacklist: [], motion: FORCE }).film).toEqual({ wanted: true, kind: 'hero' })
    expect(buildFallbackDossier({ prompt: 'x', blacklist: [], motion: AUTO }).film).toEqual({ wanted: false })
  })
})
