import { describe, it, expect } from 'vitest'
import { CODEX_FOLDER, CODEX_MARKETPLACE_NAME, CODEX_PLUGIN_NAME, codexMarketplace, codexPluginFiles, codexReadme } from './codex-plugin.js'
import { buildSkillMarkdown } from './skill.js'

/**
 * The Codex plugin is files another program reads, so what is tested is what
 * that program reads: the names, the paths that point at each other, the
 * address it connects to, and that the guide inside is the Claude skill's.
 */

const origin = 'https://mocky.example'
const mcpUrl = `${origin}/mcp`
const files = codexPluginFiles({ origin, mcpUrl })
const read = (path) => JSON.parse(files[path])

describe('the Codex plugin', () => {
  it('names itself in kebab-case, the same in both manifests', () => {
    expect(CODEX_PLUGIN_NAME).toMatch(/^[a-z][a-z0-9-]*$/)
    expect(read('plugin.json').name).toBe(CODEX_PLUGIN_NAME)
    expect(read('.codex-plugin/plugin.json').name).toBe(CODEX_PLUGIN_NAME)
    expect(read('plugin.json').version).toBe(read('.codex-plugin/plugin.json').version)
  })

  it('connects to this instance’s /mcp, over the transport each format names, and signs in with OAuth', () => {
    const portable = read('mcp.json').mcpServers.mocky
    expect(portable).toMatchObject({ type: 'streamable-http', url: mcpUrl })
    expect(portable.extensions['com.openai'].auth).toEqual({ type: 'oauth', client: { mode: 'dcr' }, registrationUrl: `${origin}/register` })
    expect(read('.mcp.json').mcpServers.mocky).toMatchObject({ type: 'http', url: mcpUrl })
  })

  it('points the legacy manifest at files the plugin carries', () => {
    const legacy = read('.codex-plugin/plugin.json')
    expect(files[legacy.mcpServers.replace('./', '')]).toBeTruthy()
    expect(Object.keys(files).some((p) => p.startsWith(legacy.skills.replace('./', '')))).toBe(true)
  })

  it('carries the Claude skill’s guide, word for word', () => {
    expect(files['skills/mocky/SKILL.md']).toBe(buildSkillMarkdown({ mcpUrl }))
  })

  it('holds no secret: no key, no client secret, no token', () => {
    const all = Object.values(files).join('\n') + codexMarketplace() + codexReadme(mcpUrl)
    expect(all).not.toMatch(/mocky_ak_|clientSecret|client_secret|"token"/)
  })

  it('is listed by a marketplace that points at the folder the zip writes', () => {
    const market = JSON.parse(codexMarketplace())
    expect(market.name).toBe(CODEX_MARKETPLACE_NAME)
    expect(market.plugins).toEqual([
      expect.objectContaining({ name: CODEX_PLUGIN_NAME, source: { source: 'local', path: `./plugins/${CODEX_PLUGIN_NAME}` } }),
    ])
    expect(market.plugins[0].policy).toEqual({ installation: 'AVAILABLE', authentication: 'ON_INSTALL' })
    expect(codexReadme(mcpUrl)).toContain(`codex plugin marketplace add /path/to/${CODEX_FOLDER}`)
  })
})
