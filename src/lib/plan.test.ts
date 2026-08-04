import { describe, it, expect, vi, afterEach } from 'vitest'
import { planScreen, planToPromptSection, inferMode, modeToPromptSection } from './plan'
import type { Settings } from './settings'

const settings: Settings = {
  provider: 'ollama-cloud',
  baseUrl: 'https://ollama.com',
  apiKey: '',
  model: 'test-model',
  usePlanner: true,
}

const shortlist = ['icons', 'charts', 'motion']

/** Mock global fetch to return one non-streamed chat response with `content`. */
function mockChatContent(content: string, ok = true) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok, json: async () => ({ message: { content } }) })),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('planScreen', () => {
  it('uses a valid plan and returns the parsed structure', async () => {
    mockChatContent(
      JSON.stringify({
        capabilities: ['charts'],
        layout: 'a centered dashboard',
        sections: ['header', 'stats', 'chart'],
        contentNotes: 'Revenue $124,592; 45.2k users',
      }),
    )
    const plan = await planScreen(settings, 'an analytics dashboard', shortlist)
    expect(plan).not.toBeNull()
    expect(plan!.layout).toBe('a centered dashboard')
    expect(plan!.sections).toEqual(['header', 'stats', 'chart'])
    expect(plan!.contentNotes).toContain('124,592')
    // baseline (icons) is always kept; chosen capability is included
    expect(plan!.capabilities).toContain('icons')
    expect(plan!.capabilities).toContain('charts')
  })

  it('falls back (null) on malformed JSON', async () => {
    mockChatContent('{ this is not: valid json')
    const plan = await planScreen(settings, 'a login screen', shortlist)
    expect(plan).toBeNull()
  })

  it('drops hallucinated / off-shortlist capability ids', async () => {
    mockChatContent(
      JSON.stringify({
        capabilities: ['charts', 'totally-made-up', 'daisyui'], // daisyui is real but NOT in the shortlist
        layout: 'x',
        sections: ['a'],
        contentNotes: 'y',
      }),
    )
    const plan = await planScreen(settings, 'a chart page', shortlist)
    expect(plan).not.toBeNull()
    expect(plan!.capabilities).toContain('charts')
    expect(plan!.capabilities).not.toContain('totally-made-up')
    expect(plan!.capabilities).not.toContain('daisyui')
  })

  it('falls back (null) on a non-ok HTTP response', async () => {
    mockChatContent('{}', false)
    const plan = await planScreen(settings, 'anything', shortlist)
    expect(plan).toBeNull()
  })

  it('falls back (null) on timeout without throwing', async () => {
    // fetch never resolves on its own; it only rejects when its signal aborts.
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init: { signal?: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () =>
              reject(new DOMException('aborted', 'AbortError')),
            )
          }),
      ),
    )
    const plan = await planScreen(settings, 'slow one', shortlist, { timeoutMs: 20 })
    expect(plan).toBeNull()
  })
})

describe('screen mode', () => {
  it('reads the mode the planner chose', async () => {
    mockChatContent(
      JSON.stringify({
        capabilities: ['icons'],
        layout: 'centered card',
        sections: ['hero'],
        contentNotes: 'real copy',
        mode: 'persuade',
      }),
    )
    const plan = await planScreen(settings, 'a pricing page', shortlist)
    expect(plan?.mode).toBe('persuade')
  })

  it('drops an invented mode rather than losing the whole plan', async () => {
    mockChatContent(
      JSON.stringify({
        capabilities: ['icons'],
        layout: 'centered card',
        sections: ['hero'],
        contentNotes: 'real copy',
        mode: 'delight',
      }),
    )
    const plan = await planScreen(settings, 'a screen', shortlist)
    // The plan survives; only the label is discarded.
    expect(plan).not.toBeNull()
    expect(plan?.mode).toBeUndefined()
    expect(plan?.layout).toBe('centered card')
  })

  it('tolerates a plan with no mode at all', async () => {
    mockChatContent(
      JSON.stringify({
        capabilities: ['icons'],
        layout: 'sidebar + main',
        sections: ['nav'],
        contentNotes: 'real copy',
      }),
    )
    const plan = await planScreen(settings, 'a screen', shortlist)
    expect(plan).not.toBeNull()
    expect(plan?.mode).toBeUndefined()
  })

  it('classifies the obvious surfaces without a model', () => {
    expect(inferMode('a pricing page for our SaaS')).toBe('persuade')
    expect(inferMode('landing page with a waitlist')).toBe('persuade')
    expect(inferMode('the API documentation index')).toBe('read')
    expect(inferMode('a changelog')).toBe('read')
    expect(inferMode('photography portfolio')).toBe('experience')
    expect(inferMode('an admin dashboard for orders')).toBe('operate')
  })

  it('defaults to operate, the common and safer guess', () => {
    // Guessing 'persuade' wrongly yields an expressive settings page, which is
    // worse than a plain landing page.
    expect(inferMode('')).toBe('operate')
    expect(inferMode('something entirely unclear')).toBe('operate')
  })

  it('renders guidance for a mode and nothing for none', () => {
    expect(modeToPromptSection('operate')).toContain('MODE — Operate')
    expect(modeToPromptSection('experience')).toContain('MODE — Experience')
    expect(modeToPromptSection(undefined)).toBe('')
  })

  it('puts the mode into the generation prompt section', () => {
    const section = planToPromptSection({
      capabilities: [],
      layout: 'centered card',
      sections: ['hero'],
      contentNotes: 'real copy',
      mode: 'persuade',
    })
    expect(section).toContain('MODE — Persuade')
    expect(section).toContain('centered card')
  })
})
