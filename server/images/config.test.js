import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { ImagesConfigStore, mergeImagesConfig, publicImagesConfig, defaultImagesConfig, PROVIDER_IDS } from './config.js'

let dir
beforeEach(() => {
  dir = path.join(os.tmpdir(), `mocky-imgcfg-${crypto.randomBytes(6).toString('hex')}`)
  fs.mkdirSync(dir, { recursive: true })
})
afterEach(() => {
  try { fs.rmSync(dir, { recursive: true, force: true }) } catch { /* ignore */ }
})

describe('mergeImagesConfig', () => {
  it('defaults to the zero-key provider', () => {
    expect(defaultImagesConfig().provider).toBe('pollinations')
  })

  it('accepts a known provider and ignores an unknown one', () => {
    expect(mergeImagesConfig(null, { provider: 'sd-webui' }).provider).toBe('sd-webui')
    expect(mergeImagesConfig(null, { provider: 'evil-provider' }).provider).toBe('pollinations')
  })

  it('KEEPS a stored secret when the patch omits it or sends an empty string', () => {
    const withKey = mergeImagesConfig(null, { openai: { apiKey: 'sk-secret' } })
    expect(mergeImagesConfig(withKey, { openai: { model: 'dall-e-3' } }).openai.apiKey).toBe('sk-secret')
    expect(mergeImagesConfig(withKey, { openai: { apiKey: '' } }).openai.apiKey).toBe('sk-secret')
  })

  it('CLEARS a secret when the patch sends null', () => {
    const withKey = mergeImagesConfig(null, { cloudflare: { apiToken: 'tok' } })
    expect(mergeImagesConfig(withKey, { cloudflare: { apiToken: null } }).cloudflare.apiToken).toBe('')
  })

  it('clamps sd-webui steps and falls back to defaults for junk', () => {
    expect(mergeImagesConfig(null, { sdWebui: { steps: 999 } }).sdWebui.steps).toBe(150)
    expect(mergeImagesConfig(null, { sdWebui: { steps: -5 } }).sdWebui.steps).toBe(20)
    expect(mergeImagesConfig(null, { openai: { baseUrl: '' } }).openai.baseUrl).toBe('https://api.openai.com')
  })
})

describe('publicImagesConfig', () => {
  it('never exposes secrets — only has… booleans', () => {
    const cfg = mergeImagesConfig(null, {
      openai: { apiKey: 'sk-secret' },
      cloudflare: { apiToken: 'cf-secret', accountId: 'acc1' },
      pollinations: { token: 'po-secret' },
      fal: { apiKey: 'fal-secret', model: 'fal-ai/flux/dev' },
    })
    const view = publicImagesConfig(cfg)
    const serialized = JSON.stringify(view)
    expect(serialized).not.toContain('sk-secret')
    expect(serialized).not.toContain('cf-secret')
    expect(serialized).not.toContain('po-secret')
    expect(serialized).not.toContain('fal-secret')
    expect(view.fal.hasApiKey).toBe(true)
    expect(view.fal.model).toBe('fal-ai/flux/dev') // non-secret field is shown
    expect(view.openai.hasApiKey).toBe(true)
    expect(view.cloudflare.hasApiToken).toBe(true)
    expect(view.pollinations.hasToken).toBe(true)
    expect(view.cloudflare.accountId).toBe('acc1') // non-secret identifier is shown
    expect(view.providers).toEqual(PROVIDER_IDS)
  })
})

describe('ImagesConfigStore', () => {
  it('persists across instances', () => {
    const s1 = new ImagesConfigStore(dir)
    s1.update({ provider: 'openai-image', openai: { apiKey: 'sk-1', model: 'dall-e-3' } })
    const s2 = new ImagesConfigStore(dir)
    expect(s2.get().provider).toBe('openai-image')
    expect(s2.get().openai.apiKey).toBe('sk-1')
    expect(s2.get().openai.model).toBe('dall-e-3')
  })

  it('applies partial updates without losing other settings', () => {
    const s = new ImagesConfigStore(dir)
    s.update({ openai: { apiKey: 'sk-1' } })
    s.update({ provider: 'openai-image' })
    expect(s.get().openai.apiKey).toBe('sk-1')
    expect(s.get().provider).toBe('openai-image')
  })

  it('never throws when the path is unwritable', () => {
    const asFile = path.join(dir, 'afile')
    fs.writeFileSync(asFile, 'x')
    const s = new ImagesConfigStore(asFile) // parent is a file → ENOTDIR on write
    expect(() => s.update({ provider: 'none' })).not.toThrow()
    expect(s.get().provider).toBe('none') // still applied in memory
  })
})
