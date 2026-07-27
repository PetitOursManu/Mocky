import { describe, it, expect, vi } from 'vitest'
import { createOpenAiImages, snapSize } from './openai.js'
import { createCloudflareImages } from './cloudflare.js'
import { createSdWebUi } from './sdwebui.js'
import { createFal } from './fal.js'
import { providersFromConfig, createProvider } from './index.js'
import { intervalForProvider } from '../index.js'

const jsonRes = (body, headers = { 'content-type': 'application/json' }) => ({
  ok: true,
  status: 200,
  json: async () => body,
  text: async () => JSON.stringify(body),
  headers: { get: (k) => headers[k.toLowerCase()] || null },
})

describe('openai-image provider', () => {
  it('snaps arbitrary sizes to supported ones', () => {
    expect(snapSize(1600, 900)).toBe('1536x1024') // landscape
    expect(snapSize(900, 1600)).toBe('1024x1536') // portrait
    expect(snapSize(800, 800)).toBe('1024x1024') // square
  })

  it('posts to /v1/images/generations with the key and returns the decoded image', async () => {
    let seen
    const b64 = Buffer.from('IMG').toString('base64')
    const fetchImpl = vi.fn(async (url, init) => {
      seen = { url, init, body: JSON.parse(init.body) }
      return jsonRes({ data: [{ b64_json: b64 }] })
    })
    const p = createOpenAiImages({ fetchImpl, apiKey: 'sk-x', model: 'gpt-image-1' })
    const out = await p.generate({ prompt: 'a cat', width: 1024, height: 1024 })
    expect(seen.url).toBe('https://api.openai.com/v1/images/generations')
    expect(seen.init.headers.authorization).toBe('Bearer sk-x')
    expect(seen.body.model).toBe('gpt-image-1')
    expect(seen.body.response_format).toBeUndefined() // not sent for gpt-image-1
    expect(out.buffer.toString()).toBe('IMG')
    expect(out.provider).toBe('openai-image')
  })

  it('sends response_format for dall-e models', async () => {
    let body
    const fetchImpl = vi.fn(async (u, init) => {
      body = JSON.parse(init.body)
      return jsonRes({ data: [{ b64_json: Buffer.from('x').toString('base64') }] })
    })
    await createOpenAiImages({ fetchImpl, apiKey: 'k', model: 'dall-e-3' }).generate({ prompt: 'p', width: 1, height: 1 })
    expect(body.response_format).toBe('b64_json')
  })

  it('downloads the image when the API returns a url instead of base64', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonRes({ data: [{ url: 'https://cdn.test/i.png' }] }))
      .mockResolvedValueOnce({ ok: true, arrayBuffer: async () => new Uint8Array([1, 2]).buffer, headers: { get: () => 'image/png' } })
    const out = await createOpenAiImages({ fetchImpl, apiKey: 'k' }).generate({ prompt: 'p', width: 1, height: 1 })
    expect(Buffer.compare(out.buffer, Buffer.from([1, 2]))).toBe(0)
  })

  it('throws with the upstream detail on an HTTP error', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 401, text: async () => 'bad key' }))
    await expect(createOpenAiImages({ fetchImpl, apiKey: 'k' }).generate({ prompt: 'p' })).rejects.toThrow(/401.*bad key/)
  })

  it('is only healthy once a key is configured', async () => {
    expect(await createOpenAiImages({ apiKey: '' }).healthy()).toBe(false)
    expect(await createOpenAiImages({ apiKey: 'k' }).healthy()).toBe(true)
  })
})

describe('cloudflare-workers-ai provider', () => {
  it('calls the account endpoint and decodes a JSON base64 result', async () => {
    let seen
    const fetchImpl = vi.fn(async (url, init) => {
      seen = { url, init }
      return jsonRes({ result: { image: Buffer.from('CF').toString('base64') } })
    })
    const p = createCloudflareImages({ fetchImpl, accountId: 'acc', apiToken: 'tok', model: '@cf/m' })
    const out = await p.generate({ prompt: 'p', width: 512, height: 512 })
    expect(seen.url).toBe('https://api.cloudflare.com/client/v4/accounts/acc/ai/run/@cf/m')
    expect(seen.init.headers.authorization).toBe('Bearer tok')
    expect(out.buffer.toString()).toBe('CF')
  })

  it('handles a raw binary (non-JSON) response', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      arrayBuffer: async () => new Uint8Array([9, 8, 7]).buffer,
      headers: { get: () => 'image/png' },
    }))
    const out = await createCloudflareImages({ fetchImpl, accountId: 'a', apiToken: 't' }).generate({ prompt: 'p' })
    expect(Buffer.compare(out.buffer, Buffer.from([9, 8, 7]))).toBe(0)
  })

  it('needs both an account id and a token to be healthy', async () => {
    expect(await createCloudflareImages({ accountId: 'a', apiToken: '' }).healthy()).toBe(false)
    expect(await createCloudflareImages({ accountId: 'a', apiToken: 't' }).healthy()).toBe(true)
  })
})

describe('sd-webui provider', () => {
  it('posts to /sdapi/v1/txt2img and decodes the first image', async () => {
    let seen
    const fetchImpl = vi.fn(async (url, init) => {
      seen = { url, body: JSON.parse(init.body) }
      return jsonRes({ images: [Buffer.from('SD').toString('base64')] })
    })
    const p = createSdWebUi({ fetchImpl, baseUrl: 'http://127.0.0.1:7860/', steps: 30 })
    const out = await p.generate({ prompt: 'p', negative: 'n', width: 640, height: 480, seed: 3 })
    expect(seen.url).toBe('http://127.0.0.1:7860/sdapi/v1/txt2img')
    expect(seen.body).toMatchObject({ prompt: 'p', negative_prompt: 'n', width: 640, height: 480, steps: 30, seed: 3 })
    expect(out.buffer.toString()).toBe('SD')
  })

  it('strips a data-URL prefix if the server adds one', async () => {
    const fetchImpl = vi.fn(async () => jsonRes({ images: [`data:image/png;base64,${Buffer.from('OK').toString('base64')}`] }))
    const out = await createSdWebUi({ fetchImpl }).generate({ prompt: 'p' })
    expect(out.buffer.toString()).toBe('OK')
  })

  it('healthy() reflects whether the local API answers', async () => {
    expect(await createSdWebUi({ fetchImpl: async () => ({ ok: true }) }).healthy()).toBe(true)
    expect(await createSdWebUi({ fetchImpl: async () => { throw new Error('refused') } }).healthy()).toBe(false)
  })
})

describe('fal provider', () => {
  const imgRes = (bytes = [1, 2, 3]) => ({
    ok: true,
    arrayBuffer: async () => new Uint8Array(bytes).buffer,
    headers: { get: () => 'image/jpeg' },
  })

  it('posts to fal.run/{model} with the "Key" auth scheme (not Bearer)', async () => {
    let seen
    const fetchImpl = vi.fn()
      .mockImplementationOnce(async (url, init) => {
        seen = { url, init, body: JSON.parse(init.body) }
        return jsonRes({ images: [{ url: 'https://fal.media/x.jpg', content_type: 'image/jpeg' }], seed: 7 })
      })
      .mockImplementationOnce(async () => imgRes([9, 9]))
    const out = await createFal({ fetchImpl, apiKey: 'fk-1' }).generate({ prompt: 'p', width: 1280, height: 720, seed: 7 })

    expect(seen.url).toBe('https://fal.run/fal-ai/flux/schnell') // default model
    expect(seen.init.headers.authorization).toBe('Key fk-1') // NOT "Bearer"
    expect(seen.body).toMatchObject({ prompt: 'p', num_images: 1, seed: 7 })
    expect(seen.body.image_size).toEqual({ width: 1280, height: 720 }) // custom size object
    expect(Buffer.compare(out.buffer, Buffer.from([9, 9]))).toBe(0)
    expect(out.provider).toBe('fal')
  })

  it('downloads the result URL server-side (M2/M6 — never hotlinked)', async () => {
    const urls = []
    const fetchImpl = vi.fn(async (url) => {
      urls.push(url)
      return urls.length === 1 ? jsonRes({ images: [{ url: 'https://fal.media/a.jpg' }] }) : imgRes()
    })
    await createFal({ fetchImpl, apiKey: 'k' }).generate({ prompt: 'p' })
    expect(urls[1]).toBe('https://fal.media/a.jpg') // the image is fetched by the server
  })

  it('folds a negative prompt into the prompt (flux has no negative_prompt field)', async () => {
    let body
    const fetchImpl = vi.fn()
      .mockImplementationOnce(async (u, init) => {
        body = JSON.parse(init.body)
        return jsonRes({ images: [{ url: 'https://fal.media/x.jpg' }] })
      })
      .mockImplementationOnce(async () => imgRes())
    await createFal({ fetchImpl, apiKey: 'k' }).generate({ prompt: 'a cat', negative: 'text, watermark' })
    expect(body.prompt).toBe('a cat. Avoid: text, watermark')
    expect(body.negative_prompt).toBeUndefined()
  })

  it('normalizes a pasted full URL or leading slash into a model id', async () => {
    const seen = []
    const mk = (model) => {
      const fetchImpl = vi.fn(async (url) => {
        seen.push(url)
        return seen.length % 2 === 1 ? jsonRes({ images: [{ url: 'https://fal.media/x.jpg' }] }) : imgRes()
      })
      return createFal({ fetchImpl, apiKey: 'k', model })
    }
    await mk('https://fal.run/fal-ai/flux/dev').generate({ prompt: 'p' })
    await mk('/fal-ai/flux-pro/v1.1/').generate({ prompt: 'p' })
    expect(seen[0]).toBe('https://fal.run/fal-ai/flux/dev')
    expect(seen[2]).toBe('https://fal.run/fal-ai/flux-pro/v1.1')
  })

  it('surfaces the upstream detail on an HTTP error', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 422, text: async () => 'validation error' }))
    await expect(createFal({ fetchImpl, apiKey: 'k' }).generate({ prompt: 'p' })).rejects.toThrow(/422.*validation error/)
  })

  it('throws when the response carries no image', async () => {
    const fetchImpl = vi.fn(async () => jsonRes({ images: [] }))
    await expect(createFal({ fetchImpl, apiKey: 'k' }).generate({ prompt: 'p' })).rejects.toThrow(/no image/)
  })

  it('is only healthy once a key is configured', async () => {
    expect(await createFal({ apiKey: '' }).healthy()).toBe(false)
    expect(await createFal({ apiKey: 'k' }).healthy()).toBe(true)
  })
})

describe('providersFromConfig', () => {
  it('puts the selected provider first with `none` as the guaranteed fallback', () => {
    const ids = (cfg) => providersFromConfig(cfg).map((p) => p.id)
    expect(ids({ provider: 'pollinations' })).toEqual(['pollinations', 'none'])
    expect(ids({ provider: 'fal' })).toEqual(['fal', 'none'])
    expect(ids({ provider: 'openai-image' })).toEqual(['openai-image', 'none'])
    expect(ids({ provider: 'cloudflare-workers-ai' })).toEqual(['cloudflare-workers-ai', 'none'])
    expect(ids({ provider: 'sd-webui' })).toEqual(['sd-webui', 'none'])
    expect(ids({ provider: 'none' })).toEqual(['none'])
    expect(ids({})).toEqual(['pollinations', 'none']) // default
  })

  it('createProvider maps ids to instances', () => {
    expect(createProvider('sd-webui', {}).id).toBe('sd-webui')
    expect(createProvider('unknown-id', {}).id).toBe('pollinations') // safe default
  })
})

describe('intervalForProvider', () => {
  it('only paces Pollinations (its anonymous tier is rate-limited)', () => {
    expect(intervalForProvider('pollinations')).toBe(15000)
    expect(intervalForProvider('fal')).toBe(0)
    expect(intervalForProvider('openai-image')).toBe(0)
    expect(intervalForProvider('sd-webui')).toBe(0)
  })
})
