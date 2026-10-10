import { describe, it, expect } from 'vitest'
import { buildSkillMarkdown, buildSkillZip, SKILL_NAME } from './skill.js'
import { GUIDED_TOOLS } from './guide.js'
import { PROMPTS } from './prompts.js'

/**
 * The frontmatter, read the way a YAML loader reads it — narrowly: every value
 * must be a bare word or a double-quoted (JSON-compatible) string. A plain value
 * with ": " in it is exactly what a YAML parser refuses, so it fails here too.
 */
const frontmatter = (md) =>
  Object.fromEntries(
    md
      .split('---')[1]
      .trim()
      .split('\n')
      .map((l) => {
        const key = l.slice(0, l.indexOf(':'))
        const raw = l.slice(l.indexOf(':') + 1).trim()
        if (raw.startsWith('"')) return [key, JSON.parse(raw)]
        if (/: /.test(raw)) throw new Error(`unquoted "${key}" would not parse as YAML`)
        return [key, raw]
      }),
  )

describe('the downloadable Claude skill', () => {
  it('declares itself within the limits Claude puts on a skill', () => {
    const fm = frontmatter(buildSkillMarkdown())
    expect(fm.name).toBe(SKILL_NAME)
    expect(fm.name).toMatch(/^[a-z0-9-]{1,64}$/)
    expect(fm.description.length).toBeLessThanOrEqual(1024)
    expect(fm.description).not.toMatch(/[<>]/)
  })

  it('carries the connector’s guide and its prompts, so the two teach the same thing', () => {
    const md = buildSkillMarkdown()
    for (const tool of GUIDED_TOOLS) expect(md, tool).toContain(`\`${tool}\``)
    for (const p of Object.values(PROMPTS)) expect(md).toContain(p.title)
    // One title: the guide's own heading is dropped under the skill's.
    expect(md.match(/^# /gm)).toHaveLength(1)
    expect(md).not.toContain('submit_screen')
    expect(buildSkillMarkdown({ client: true })).toContain('submit_screen')
  })

  it('names this instance’s connector address when it has one', () => {
    expect(buildSkillMarkdown({ mcpUrl: 'https://mocky.example/mcp' })).toContain('`https://mocky.example/mcp`')
    expect(buildSkillMarkdown()).toContain('Settings → Connected assistants')
  })

  it('is a zip with one folder and its SKILL.md', () => {
    const zip = buildSkillZip({ mcpUrl: 'https://mocky.example/mcp' })
    expect(zip.subarray(0, 4).toString('hex')).toBe('504b0304')
    expect(zip.includes(Buffer.from('mocky/SKILL.md'))).toBe(true)
    expect(zip.includes(Buffer.from('https://mocky.example/mcp'))).toBe(true)
  })
})
