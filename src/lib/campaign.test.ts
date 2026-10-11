import { describe, it, expect } from 'vitest'
import {
  CAMPAIGN_FORMATS,
  CAMPAIGN_FORMAT_IDS,
  campaignSection,
  factChanges,
  factSnapshot,
  getCampaignFormat,
  normalizeCampaign,
  normalizeScreenCampaign,
  parseFacts,
  sortFormats,
  type CampaignFact,
} from './campaign'
import { getScreenTheme } from './screenThemes'
import { getPageFormat } from './pageFormats'
import { normalizeScreen } from './project'

const facts: CampaignFact[] = [
  { id: 'title', label: 'Titre', value: 'Festival Lumières' },
  { id: 'date', label: 'Date', value: '12 mars 2027' },
  { id: 'place', label: 'Lieu', value: 'Parc de la Tête d’Or, Lyon' },
]

describe('the formats', () => {
  it('are each a document type on a page of its own family', () => {
    for (const f of CAMPAIGN_FORMATS) {
      const theme = getScreenTheme(f.theme)
      expect(theme?.document, f.id).toBeTruthy()
      const own = getPageFormat(theme!.document!.page)
      expect(getPageFormat(f.page).kind, f.id).toBe(own.kind)
    }
  })

  it('start with the poster, which makes the picture the others reuse', () => {
    expect(CAMPAIGN_FORMAT_IDS[0]).toBe('poster')
    expect(sortFormats(['story', 'flyer', 'poster'])).toEqual(['poster', 'flyer', 'story'])
  })

  it('make the story a story, not a feed post', () => {
    const story = getCampaignFormat('story')!
    expect(story.page).toBe('social-story')
    expect(story.role).toMatch(/STORY/)
  })
})

describe('what a piece is told', () => {
  it('names its own role and its siblings, and asks for the facts verbatim', () => {
    const text = campaignSection(getCampaignFormat('story')!, ['poster', 'flyer', 'story'], facts)
    expect(text).toContain('INSTAGRAM STORY')
    expect(text).toContain('the A3 POSTER')
    expect(text).toContain('the A4 FLYER')
    expect(text).toContain('never a scaled, cropped or stretched copy')
    expect(text).toContain('EXACTLY as given')
    expect(text).toContain('- Date: 12 mars 2027')
  })

  it('leaves out a fact with no value', () => {
    const text = campaignSection(getCampaignFormat('poster')!, ['poster'], [...facts, { id: 'x', label: 'Prix', value: ' ' }])
    expect(text).not.toContain('Prix')
  })
})

describe('which pieces a changed fact leaves behind', () => {
  const written = { format: 'poster' as const, facts: factSnapshot(facts) }

  it('is the facts whose value moved', () => {
    const now = facts.map((f) => (f.id === 'date' ? { ...f, value: '19 mars 2027' } : f))
    expect(factChanges(now, written)).toEqual([{ id: 'date', label: 'Date', from: '12 mars 2027', to: '19 mars 2027' }])
  })

  it('is not a fact the piece was never written with, nor one deleted from the brief', () => {
    const now = [...facts.filter((f) => f.id !== 'place'), { id: 'price', label: 'Prix', value: '15 €' }]
    expect(factChanges(now, written)).toEqual([])
  })

  it('is nothing for a screen that is not a piece', () => {
    expect(factChanges(facts, undefined)).toEqual([])
  })
})

describe('reading the model’s answer', () => {
  it('takes a fenced object, drops blanks and repeats', () => {
    const read = parseFacts('Voici :\n```json\n{"facts":[{"label":"Date","value":"12 mars"},{"label":"date","value":"13 mars"},{"label":"Lieu","value":""}]}\n```')
    expect(read).toEqual([{ label: 'Date', value: '12 mars' }])
  })

  it('answers nothing for an answer it cannot read', () => {
    expect(parseFacts('Je ne sais pas.')).toEqual([])
    expect(parseFacts('{"facts": "none"}')).toEqual([])
  })
})

describe('what is kept', () => {
  it('a campaign with a brief or facts, with the formats in order', () => {
    const c = normalizeCampaign({ brief: 'Un festival', facts, formats: ['story', 'poster', 'nope'] })
    expect(c?.formats).toEqual(['poster', 'story'])
    expect(c?.facts).toHaveLength(3)
    expect(normalizeCampaign({ brief: '  ', facts: [] })).toBeUndefined()
    expect(normalizeCampaign({ brief: 'b', formats: [] })?.formats).toEqual([])
    expect(normalizeCampaign({ brief: 'b' })?.formats).toEqual(CAMPAIGN_FORMAT_IDS)
  })

  it('a piece’s record through a reload, and nothing that is not one', () => {
    const s = normalizeScreen({ id: 'a', campaign: { format: 'flyer', facts: { date: '12 mars' } } }, 0)
    expect(s.campaign).toEqual({ format: 'flyer', facts: { date: '12 mars' } })
    expect(normalizeScreenCampaign({ format: 'billboard', facts: {} })).toBeUndefined()
  })
})
