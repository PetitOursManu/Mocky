import { describe, it, expect } from 'vitest'
import { PROMPTS } from './prompts.js'
import { GUIDED_TOOLS } from './guide.js'
import { SCREEN_TYPES } from './screen-types.js'

/** snake_case words a prompt names as tools — `create_design`, not "the design". */
const toolsNamed = (text) => [...text.matchAll(/\b[a-z]+(?:_[a-z]+)+\b/g)].map((m) => m[0])
const NOT_TOOLS = new Set(['screen_type', 'page_format', 'picture_subject', 'project_id', 'free_image_id'])

describe('the prompts an assistant’s client offers', () => {
  it('start a conversation with nothing filled in, and with everything filled in', () => {
    for (const [name, p] of Object.entries(PROMPTS)) {
      expect(name).toMatch(/^[a-z]+(?:-[a-z]+)*$/)
      expect(p.message({}).length, name).toBeGreaterThan(40)
      const full = Object.fromEntries(Object.keys(p.args).map((k) => [k, `value-of-${k}`]))
      // `focus` chooses a pass rather than being repeated: tested below.
      for (const k of Object.keys(p.args)) if (k !== 'focus') expect(p.message(full), `${name}.${k}`).toContain(`value-of-${k}`)
    }
  })

  it('name only tools the server offers — a prompt about a missing tool is a call that fails', () => {
    for (const [name, p] of Object.entries(PROMPTS)) {
      for (const word of toolsNamed(p.message({ focus: 'accessibility' }) + p.message({}))) {
        if (NOT_TOOLS.has(word)) continue
        expect(GUIDED_TOOLS, `${name} names ${word}`).toContain(word)
      }
    }
  })

  it('name only screen types that exist', () => {
    const named = PROMPTS['landing-page'].message({}).match(/screen_type "([a-z]+)"/)
    expect(SCREEN_TYPES).toHaveProperty(named[1])
    for (const network of ['instagram', 'facebook', 'linkedin']) expect(SCREEN_TYPES).toHaveProperty(network)
  })

  it('send a review to the right pass', () => {
    expect(PROMPTS['review-screen'].message({})).toContain('polish_design')
    expect(PROMPTS['review-screen'].message({ focus: 'accessibilité' })).toContain('audit_design')
    expect(PROMPTS['review-screen'].message({ focus: 'accessibilité' })).not.toContain('polish_design')
  })
})
