import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { defaultMcpConfig, mergeMcpConfig, changedMcpFields, resolveEngine } from './config.js'
import { McpPrefsStore } from './prefs.js'

describe('who writes a design’s code (phase 4)', () => {
  it('is Mocky’s model by default: the assistant’s is the administrator’s opt-in', () => {
    expect(defaultMcpConfig().engines).toEqual({ mocky: true, client: false })
    // A config written before engines existed reads as the default.
    const { engines: _gone, ...old } = defaultMcpConfig()
    expect(mergeMcpConfig(old, {}).engines).toEqual({ mocky: true, client: false })
  })

  it('is never neither: a patch that would switch both off keeps Mocky’s', () => {
    const both = mergeMcpConfig(defaultMcpConfig(), { engines: { client: true } })
    expect(both.engines).toEqual({ mocky: true, client: true })
    expect(mergeMcpConfig(both, { engines: { mocky: false } }).engines).toEqual({ mocky: false, client: true })
    expect(mergeMcpConfig(both, { engines: { mocky: false, client: false } }).engines).toEqual({ mocky: true, client: false })
    expect(changedMcpFields(defaultMcpConfig(), both)).toEqual(['engines.client'])
  })

  it('takes the request, then the person’s choice, within what is allowed — and says no rather than swap', () => {
    const mockyOnly = defaultMcpConfig()
    const both = mergeMcpConfig(mockyOnly, { engines: { client: true } })
    const clientOnly = mergeMcpConfig(both, { engines: { mocky: false } })
    expect(resolveEngine(mockyOnly, {})).toBe('mocky')
    expect(resolveEngine(mockyOnly, { preferred: 'client' })).toBe('mocky')
    // Asked for by name and not allowed: null, so the tool can say so.
    expect(resolveEngine(mockyOnly, { requested: 'client' })).toBeNull()
    expect(resolveEngine(both, { preferred: 'client' })).toBe('client')
    expect(resolveEngine(both, { requested: 'mocky', preferred: 'client' })).toBe('mocky')
    expect(resolveEngine(clientOnly, {})).toBe('client')
    expect(resolveEngine(both, { requested: 'gpt' })).toBeNull()
  })

  it('keeps each person’s default in a file of its own, and forgets a deleted account', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mocky-prefs-'))
    const prefs = new McpPrefsStore(dir)
    expect(prefs.get('u1')).toEqual({ engine: null })
    expect(prefs.set('u1', { engine: 'client' })).toEqual({ engine: 'client' })
    expect(new McpPrefsStore(dir).get('u1')).toEqual({ engine: 'client' })
    expect(prefs.set('u1', { engine: 'nonsense' })).toEqual({ engine: null })
    prefs.set('u2', { engine: 'mocky' })
    prefs.forget('u2')
    expect(new McpPrefsStore(dir).get('u2')).toEqual({ engine: null })
  })
})
