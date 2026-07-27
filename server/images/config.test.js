import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import {
  ImagesConfigStore,
  mergeImagesConfig,
  publicImagesConfig,
  defaultImagesConfig,
  resolveImageProfile,
  PROVIDER_IDS,
  IMAGE_PROFILES,
} from './config.js'

let dir
beforeEach(() => {
  dir = path.join(os.tmpdir(), `mocky-imgcfg-${crypto.randomBytes(6).toString('hex')}`)
  fs.mkdirSync(dir, { recursive: true })
})
afterEach(() => {
  try { fs.rmSync(dir, { recursive: true, force: true }) } catch { /* ignore */ }
})

/** Shorthand: a patch aimed at the content profile. */
const content = (patch) => ({ content: patch })

describe('mergeImagesConfig', () => {
  it('defaults content to the zero-key provider and leaves inspiration inheriting', () => {
    expect(defaultImagesConfig().content.provider).toBe('pollinations')
    expect(defaultImagesConfig().inspiration.provider).toBe('')
  })

  it('accepts a known provider and ignores an unknown one', () => {
    expect(mergeImagesConfig(null, content({ provider: 'sd-webui' })).content.provider).toBe('sd-webui')
    expect(mergeImagesConfig(null, content({ provider: 'evil-provider' })).content.provider).toBe('pollinations')
  })

  it('KEEPS a stored secret when the patch omits it or sends an empty string', () => {
    const withKey = mergeImagesConfig(null, content({ openai: { apiKey: 'sk-secret' } }))
    expect(mergeImagesConfig(withKey, content({ openai: { model: 'dall-e-3' } })).content.openai.apiKey).toBe('sk-secret')
    expect(mergeImagesConfig(withKey, content({ openai: { apiKey: '' } })).content.openai.apiKey).toBe('sk-secret')
  })

  it('CLEARS a secret when the patch sends null', () => {
    const withKey = mergeImagesConfig(null, content({ cloudflare: { apiToken: 'tok' } }))
    expect(mergeImagesConfig(withKey, content({ cloudflare: { apiToken: null } })).content.cloudflare.apiToken).toBe('')
  })

  it('clamps sd-webui steps and falls back to defaults for junk', () => {
    expect(mergeImagesConfig(null, content({ sdWebui: { steps: 999 } })).content.sdWebui.steps).toBe(150)
    expect(mergeImagesConfig(null, content({ sdWebui: { steps: -5 } })).content.sdWebui.steps).toBe(20)
    expect(mergeImagesConfig(null, content({ openai: { baseUrl: '' } })).content.openai.baseUrl).toBe('https://api.openai.com')
  })

  it('keeps the two profiles independent', () => {
    let c = mergeImagesConfig(null, content({ provider: 'pollinations', fal: { apiKey: 'k-content' } }))
    c = mergeImagesConfig(c, { inspiration: { provider: 'fal', fal: { apiKey: 'k-insp', model: 'bytedance/seedream/v5/pro/text-to-image' } } })
    expect(c.content.provider).toBe('pollinations')
    expect(c.content.fal.apiKey).toBe('k-content')
    expect(c.inspiration.provider).toBe('fal')
    expect(c.inspiration.fal.model).toBe('bytedance/seedream/v5/pro/text-to-image')
    expect(c.inspiration.fal.apiKey).toBe('k-insp')
  })

  it('lets inspiration be cleared back to "inherit", but never content', () => {
    const c = mergeImagesConfig(null, { inspiration: { provider: 'fal' }, content: { provider: 'sd-webui' } })
    expect(mergeImagesConfig(c, { inspiration: { provider: '' } }).inspiration.provider).toBe('')
    // '' is not a real provider — content must keep the one it had.
    expect(mergeImagesConfig(c, content({ provider: '' })).content.provider).toBe('sd-webui')
  })

  it('lifts a legacy single-profile config into `content`', () => {
    const legacy = { provider: 'fal', fal: { apiKey: 'old-key', model: 'fal-ai/flux/schnell', timeoutSec: 300 } }
    const c = mergeImagesConfig(null, legacy)
    expect(c.content.provider).toBe('fal')
    expect(c.content.fal.apiKey).toBe('old-key')
    expect(c.inspiration.provider).toBe('')
  })
})

describe('resolveImageProfile', () => {
  it('falls back to content until inspiration has its own provider', () => {
    const onlyContent = mergeImagesConfig(null, content({ provider: 'fal', fal: { model: 'fal-ai/flux/schnell' } }))
    expect(resolveImageProfile(onlyContent, 'inspiration').fal.model).toBe('fal-ai/flux/schnell')

    const both = mergeImagesConfig(onlyContent, {
      inspiration: { provider: 'fal', fal: { model: 'bytedance/seedream/v5/pro/text-to-image' } },
    })
    expect(resolveImageProfile(both, 'inspiration').fal.model).toBe('bytedance/seedream/v5/pro/text-to-image')
    expect(resolveImageProfile(both, 'content').fal.model).toBe('fal-ai/flux/schnell') // unchanged
  })

  it('treats an unknown profile name as content', () => {
    const c = mergeImagesConfig(null, content({ provider: 'sd-webui' }))
    expect(resolveImageProfile(c, 'nope').provider).toBe('sd-webui')
  })
})

describe('publicImagesConfig', () => {
  it('never exposes secrets — only has… booleans, for both profiles', () => {
    const cfg = mergeImagesConfig(null, {
      content: {
        openai: { apiKey: 'sk-secret' },
        cloudflare: { apiToken: 'cf-secret', accountId: 'acc1' },
        pollinations: { token: 'po-secret' },
        fal: { apiKey: 'fal-secret', model: 'fal-ai/flux/dev' },
      },
      inspiration: { provider: 'fal', fal: { apiKey: 'insp-secret' } },
    })
    const view = publicImagesConfig(cfg)
    const serialized = JSON.stringify(view)
    for (const s of ['sk-secret', 'cf-secret', 'po-secret', 'fal-secret', 'insp-secret']) {
      expect(serialized).not.toContain(s)
    }
    expect(view.content.fal.hasApiKey).toBe(true)
    expect(view.content.fal.model).toBe('fal-ai/flux/dev') // non-secret field is shown
    expect(view.content.openai.hasApiKey).toBe(true)
    expect(view.content.cloudflare.hasApiToken).toBe(true)
    expect(view.content.pollinations.hasToken).toBe(true)
    expect(view.content.cloudflare.accountId).toBe('acc1') // non-secret identifier is shown
    expect(view.inspiration.hasApiKey).toBeUndefined()
    expect(view.inspiration.fal.hasApiKey).toBe(true)
    expect(view.providers).toEqual(PROVIDER_IDS)
    expect(view.profiles).toEqual(IMAGE_PROFILES)
  })
})

describe('ImagesConfigStore', () => {
  it('persists across instances', () => {
    const s1 = new ImagesConfigStore(dir)
    s1.update(content({ provider: 'openai-image', openai: { apiKey: 'sk-1', model: 'dall-e-3' } }))
    const s2 = new ImagesConfigStore(dir)
    expect(s2.get().content.provider).toBe('openai-image')
    expect(s2.get().content.openai.apiKey).toBe('sk-1')
    expect(s2.get().content.openai.model).toBe('dall-e-3')
  })

  it('keeps a pre-split config file working (lifted into `content`)', () => {
    fs.writeFileSync(
      path.join(dir, 'images-config.json'),
      JSON.stringify({ provider: 'fal', fal: { apiKey: 'k', model: 'fal-ai/nano-banana-2', timeoutSec: 300 } }),
    )
    const s = new ImagesConfigStore(dir)
    expect(s.profile('content')).toMatchObject({ provider: 'fal' })
    expect(s.profile('content').fal.model).toBe('fal-ai/nano-banana-2')
    expect(s.profile('inspiration').fal.model).toBe('fal-ai/nano-banana-2') // inherits
  })

  it('resolves a separate inspiration model', () => {
    const s = new ImagesConfigStore(dir)
    s.update(content({ provider: 'pollinations' }))
    s.update({ inspiration: { provider: 'fal', fal: { model: 'bytedance/seedream/v5/pro/text-to-image', apiKey: 'k' } } })
    expect(s.profile('content').provider).toBe('pollinations')
    expect(s.profile('inspiration').provider).toBe('fal')
    expect(s.profile('inspiration').fal.model).toBe('bytedance/seedream/v5/pro/text-to-image')
  })

  it('applies partial updates without losing other settings', () => {
    const s = new ImagesConfigStore(dir)
    s.update(content({ openai: { apiKey: 'sk-1' } }))
    s.update(content({ provider: 'openai-image' }))
    expect(s.get().content.openai.apiKey).toBe('sk-1')
    expect(s.get().content.provider).toBe('openai-image')
  })

  it('never throws when the path is unwritable', () => {
    const asFile = path.join(dir, 'afile')
    fs.writeFileSync(asFile, 'x')
    const s = new ImagesConfigStore(asFile) // parent is a file → ENOTDIR on write
    expect(() => s.update(content({ provider: 'none' }))).not.toThrow()
    expect(s.get().content.provider).toBe('none') // still applied in memory
  })
})
