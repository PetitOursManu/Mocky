import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NewScreenHooks, NewScreenRequest } from './newScreen'
import type { Screen } from '../project'

const calls: NewScreenRequest[] = []
vi.mock('./newScreen', () => ({
  runNewScreen: vi.fn(async (req: NewScreenRequest) => {
    calls.push(req)
    return { screenId: `s${calls.length}`, code: '' }
  }),
}))
const edits: Array<{ instruction: string; code: string }> = []
vi.mock('./screenPasses', () => ({
  editScreen: vi.fn(async (req: { instruction: string; screen: Screen }) => {
    edits.push({ instruction: req.instruction, code: req.screen.code })
    return { code: req.screen.code.replace('<b>12</b> mars', '19 mars'), componentName: 'App', caps: ['doc'], loss: null }
  }),
}))

const { runCampaign } = await import('./campaign')
const { updateCampaignPiece } = await import('./campaignUpdate')

const facts = [
  { id: 'title', label: 'Titre', value: 'Festival Lumières' },
  { id: 'date', label: 'Date', value: '12 mars' },
]

function hooks(screens: Screen[] = []): NewScreenHooks {
  return {
    signal: new AbortController().signal,
    t: (k: string) => k,
    currentScreens: () => screens,
  } as unknown as NewScreenHooks
}

const base = {
  text: 'typed',
  museConfig: { enabled: true },
  docPictureSource: 'ai',
  docImageChoice: 'ai',
  pinnedImages: [{ url: '/api/images/abc' }],
  images: ['data:image/png;base64,x'],
  flows: true,
} as unknown as NewScreenRequest

beforeEach(() => {
  calls.length = 0
  edits.length = 0
})

describe('making a campaign', () => {
  it('makes one piece per format, in order, each its own type and page', async () => {
    const made = await runCampaign(base, hooks(), { brief: 'Un festival', facts }, ['story', 'poster'], {
      getProject: () => ({}) as never,
      nameFor: (f) => f,
      all: ['poster', 'story'],
    })
    expect(made.map((m) => m.format)).toEqual(['poster', 'story'])
    expect(calls.map((c) => [c.themeId, c.pageFormatId])).toEqual([
      ['poster', 'a3'],
      ['instagram', 'social-story'],
    ])
    for (const c of calls) {
      expect(c.text).toBe('Un festival')
      expect(c.campaign?.facts).toEqual({ title: 'Festival Lumières', date: '12 mars' })
      expect(c.campaignContext).toContain('KEY FACTS')
      // What belonged to a typed request does not follow a campaign.
      expect(c.images).toEqual([])
      expect(c.flows).toBeUndefined()
    }
  })

  it('lets only the first piece make a picture or run Muse', async () => {
    await runCampaign(base, hooks(), { brief: 'b', facts }, ['poster', 'flyer'], {
      getProject: () => ({}) as never,
      nameFor: (f) => f,
      all: ['poster', 'flyer'],
    })
    expect(calls[0].docPictureSource).toBe('ai')
    expect(calls[0].museConfig.enabled).toBe(true)
    expect(calls[1].docPictureSource).toBeNull()
    expect(calls[1].museConfig.enabled).toBe(false)
    expect(calls[1].pinnedImages).toEqual([])
  })

  it('reuses the pictures when pieces already exist', async () => {
    const existing = [{ id: 'old', campaign: { format: 'poster', facts: {} } }] as unknown as Screen[]
    await runCampaign(base, hooks(existing), { brief: 'b', facts }, ['story'], {
      getProject: () => ({}) as never,
      nameFor: (f) => f,
      all: ['poster', 'story'],
    })
    expect(calls[0].docPictureSource).toBeNull()
  })
})

describe('updating a piece', () => {
  const piece = (code: string): Screen =>
    ({ id: 'p', code, page: 'a4', campaign: { format: 'flyer', facts: { title: 'Festival Lumières', date: '12 mars' } } }) as unknown as Screen
  const moved = facts.map((f) => (f.id === 'date' ? { ...f, value: '19 mars' } : f))

  it('writes directly, with no model call, when the piece says the value plainly', async () => {
    const res = await updateCampaignPiece({
      settings: {} as never,
      screen: piece('export default function App() { return <p>12 mars</p> }'),
      facts: moved,
      designMd: undefined,
    })
    expect(res?.how).toBe('direct')
    expect(res?.code).toContain('<p>19 mars</p>')
    expect(res?.campaign.facts.date).toBe('19 mars')
    expect(edits).toHaveLength(0)
  })

  it('asks the model only for what it could not write', async () => {
    const res = await updateCampaignPiece({
      settings: {} as never,
      screen: piece('export default function App() { return <p><b>12</b> mars</p> }'),
      facts: moved,
      designMd: undefined,
    })
    expect(res?.how).toBe('model')
    expect(edits).toHaveLength(1)
    expect(edits[0].instruction).toContain('"12 mars" becomes "19 mars"')
    expect(edits[0].instruction).not.toContain('Festival')
    expect(res?.campaign.facts.date).toBe('19 mars')
  })

  it('does nothing for a piece already up to date', async () => {
    const res = await updateCampaignPiece({ settings: {} as never, screen: piece('<p>12 mars</p>'), facts, designMd: undefined })
    expect(res).toBeNull()
  })
})
