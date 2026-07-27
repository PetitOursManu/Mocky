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

describe('fal provider (queue flow)', () => {
  const imgRes = (bytes = [1, 2, 3]) => ({
    ok: true,
    arrayBuffer: async () => new Uint8Array(bytes).buffer,
    headers: { get: () => 'image/jpeg' },
  })
  const noSleep = { sleep: async () => {} } // don't actually wait between polls

  /** Scripted queue: submit → status(IN_PROGRESS…) → status(COMPLETED) → result → image. */
  function queueFetch({ statusSteps = ['COMPLETED'], imageUrl = 'https://fal.media/x.jpg', bytes = [9, 9] } = {}) {
    const calls = []
    let step = 0
    const fetchImpl = vi.fn(async (url, init) => {
      calls.push({ url, init })
      if (url.startsWith('https://queue.fal.run/') && init?.method === 'POST') {
        return jsonRes({
          request_id: 'r1',
          status_url: 'https://queue.fal.run/x/requests/r1/status',
          response_url: 'https://queue.fal.run/x/requests/r1',
        })
      }
      if (url.endsWith('/status')) return jsonRes({ status: statusSteps[Math.min(step++, statusSteps.length - 1)] })
      if (url.endsWith('/r1')) return jsonRes({ images: [{ url: imageUrl, content_type: 'image/jpeg' }] })
      return imgRes(bytes)
    })
    fetchImpl.calls = calls
    return fetchImpl
  }

  it('submits to queue.fal.run with the "Key" scheme, polls, then downloads', async () => {
    const fetchImpl = queueFetch({ statusSteps: ['IN_QUEUE', 'IN_PROGRESS', 'COMPLETED'] })
    const out = await createFal({ fetchImpl, apiKey: 'fk-1', ...noSleep }).generate({
      prompt: 'p', width: 1280, height: 720, seed: 7,
    })
    const submit = fetchImpl.calls[0]
    expect(submit.url).toBe('https://queue.fal.run/fal-ai/flux/schnell') // default model, QUEUE endpoint
    expect(submit.init.headers.authorization).toBe('Key fk-1') // NOT "Bearer"
    const body = JSON.parse(submit.init.body)
    expect(body).toMatchObject({ prompt: 'p', num_images: 1, seed: 7 })
    expect(body.image_size).toEqual({ width: 1280, height: 720 }) // custom size object
    // polled until COMPLETED, then fetched the result, then the image
    expect(fetchImpl.calls.filter((c) => c.url.endsWith('/status')).length).toBe(3)
    expect(fetchImpl.calls.at(-1).url).toBe('https://fal.media/x.jpg')
    expect(Buffer.compare(out.buffer, Buffer.from([9, 9]))).toBe(0)
    expect(out.provider).toBe('fal')
  })

  it('accepts a model id OUTSIDE the fal-ai namespace verbatim (e.g. bytedance/…)', async () => {
    const fetchImpl = queueFetch()
    await createFal({ fetchImpl, apiKey: 'k', model: 'bytedance/seedream/v5/pro/text-to-image', ...noSleep }).generate({ prompt: 'p' })
    expect(fetchImpl.calls[0].url).toBe('https://queue.fal.run/bytedance/seedream/v5/pro/text-to-image')
  })

  it('retries once under fal-ai/ only when the id 404s', async () => {
    const urls = []
    const fetchImpl = vi.fn(async (url, init) => {
      urls.push(url)
      if (url === 'https://queue.fal.run/flux/schnell') return { ok: false, status: 404, text: async () => 'not found' }
      if (init?.method === 'POST') {
        return jsonRes({ status_url: 'https://q/status', response_url: 'https://q/r' })
      }
      if (url.endsWith('/status')) return jsonRes({ status: 'COMPLETED' })
      if (url.endsWith('/r')) return jsonRes({ images: [{ url: 'https://fal.media/y.jpg' }] })
      return imgRes([4])
    })
    await createFal({ fetchImpl, apiKey: 'k', model: 'flux/schnell', ...noSleep }).generate({ prompt: 'p' })
    expect(urls[0]).toBe('https://queue.fal.run/flux/schnell')
    expect(urls[1]).toBe('https://queue.fal.run/fal-ai/flux/schnell')
  })

  it('does NOT retry on a non-404 error (a real failure must surface as-is)', async () => {
    let calls = 0
    const fetchImpl = vi.fn(async () => {
      calls++
      return { ok: false, status: 401, text: async () => 'unauthorized' }
    })
    await expect(createFal({ fetchImpl, apiKey: 'k', model: 'x/y', ...noSleep }).generate({ prompt: 'p' })).rejects.toThrow(/401/)
    expect(calls).toBe(1)
  })

  it('handles a model that answers immediately without a queue round-trip', async () => {
    const fetchImpl = vi.fn(async (url, init) => {
      if (init?.method === 'POST') return jsonRes({ images: [{ url: 'https://fal.media/now.jpg' }] })
      return imgRes([7])
    })
    const out = await createFal({ fetchImpl, apiKey: 'k', ...noSleep }).generate({ prompt: 'p' })
    expect(Buffer.compare(out.buffer, Buffer.from([7]))).toBe(0)
  })

  it('gives an actionable message when the overall deadline passes (slow model)', async () => {
    let t = 0
    const fetchImpl = queueFetch({ statusSteps: ['IN_PROGRESS'] }) // never completes
    const p = createFal({
      fetchImpl, apiKey: 'k', model: 'bytedance/seedream/v5/pro/text-to-image',
      timeoutMs: 1000, sleep: async () => { t += 600 }, now: () => t,
    })
    await expect(p.generate({ prompt: 'p' })).rejects.toThrow(/n'a pas terminé en 1s.*seedream.*augmentez le délai/is)
  })

  it('surfaces a failed queue status', async () => {
    const fetchImpl = queueFetch({ statusSteps: ['FAILED'] })
    await expect(createFal({ fetchImpl, apiKey: 'k', ...noSleep }).generate({ prompt: 'p' })).rejects.toThrow(/failed/i)
  })

  it('folds a negative prompt into the prompt (no negative_prompt field on flux/seedream)', async () => {
    const fetchImpl = queueFetch()
    await createFal({ fetchImpl, apiKey: 'k', ...noSleep }).generate({ prompt: 'a cat', negative: 'text, watermark' })
    const body = JSON.parse(fetchImpl.calls[0].init.body)
    expect(body.prompt).toBe('a cat. Avoid: text, watermark')
    expect(body.negative_prompt).toBeUndefined()
  })

  it('normalizes a pasted full URL into a model id', async () => {
    const fetchImpl = queueFetch()
    await createFal({ fetchImpl, apiKey: 'k', model: 'https://fal.run/fal-ai/flux/dev', ...noSleep }).generate({ prompt: 'p' })
    expect(fetchImpl.calls[0].url).toBe('https://queue.fal.run/fal-ai/flux/dev')
  })

  it('throws when the result carries no image', async () => {
    const fetchImpl = vi.fn(async (url, init) => {
      if (init?.method === 'POST') return jsonRes({ status_url: 'https://q/status', response_url: 'https://q/r' })
      if (url.endsWith('/status')) return jsonRes({ status: 'COMPLETED' })
      return jsonRes({ images: [] })
    })
    await expect(createFal({ fetchImpl, apiKey: 'k', ...noSleep }).generate({ prompt: 'p' })).rejects.toThrow(/no image/)
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
