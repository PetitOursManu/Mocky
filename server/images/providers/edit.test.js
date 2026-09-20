import { describe, it, expect, vi } from 'vitest'
import { createPollinations } from './pollinations.js'
import { createNone } from './none.js'
import { createOpenAiImages } from './openai.js'
import { createCloudflareImages, DEFAULT_CF_MODEL, DEFAULT_CF_EDIT_MODEL } from './cloudflare.js'
import { createSdWebUi } from './sdwebui.js'
import { createFal } from './fal.js'
import { createProvider, createProviderRegistry } from './index.js'
import { readInit, sampleSourceImage, MAX_INIT_BYTES } from './init.js'

/**
 * The image-to-image half of the provider contract.
 *
 * The defect every test here exists to keep out is the same one: a provider that
 * accepts a source image it cannot use, drops it, and returns a picture made
 * from the prompt alone. Nothing downstream can tell that apart from a real
 * derivative — same bytes, same content type, same reported success — so the
 * only place it can be caught is here.
 */

const jsonRes = (body, headers = { 'content-type': 'application/json' }) => ({
  ok: true,
  status: 200,
  json: async () => body,
  text: async () => JSON.stringify(body),
  headers: { get: (k) => headers[k.toLowerCase()] || null },
})

const SOURCE = { buffer: Buffer.from('SOURCE-BYTES'), contentType: 'image/png' }

describe('the capability flag', () => {
  it('is declared by every provider, without a network call', () => {
    // The panel greys out what cannot edit, and it must be able to do that
    // before an admin saves a configuration that is condemned in advance.
    const flags = Object.fromEntries(
      ['pollinations', 'fal', 'openai-image', 'cloudflare-workers-ai', 'sd-webui', 'none'].map((id) => [
        id,
        createProvider(id, {}).supportsInit,
      ]),
    )
    expect(flags).toEqual({
      pollinations: false,
      fal: true,
      'openai-image': true,
      'cloudflare-workers-ai': true,
      'sd-webui': true,
      none: false,
    })
  })

  it('travels in the registry listing', () => {
    expect(createProviderRegistry([createFal({}), createNone()]).list()).toEqual([
      { id: 'fal', requiresKey: true, supportsInit: true },
      { id: 'none', requiresKey: false, supportsInit: false },
    ])
  })
})

describe('a provider that cannot edit refuses', () => {
  it('pollinations throws instead of quietly generating from the prompt alone', async () => {
    // It never reaches fetch: the refusal has to happen before any money or
    // latency is spent, and before an image exists to be mistaken for an edit.
    const fetchImpl = vi.fn()
    const p = createPollinations({ fetchImpl })
    await expect(p.generate({ prompt: 'a cat', init: SOURCE })).rejects.toThrow(/ne sait pas dériver/i)
    await expect(p.generate({ prompt: 'a cat', init: SOURCE })).rejects.toThrow(/URL publiquement joignable/i)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('pollinations still generates normally without a source image', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      arrayBuffer: async () => new Uint8Array([1]).buffer,
      headers: { get: () => 'image/png' },
    }))
    await expect(createPollinations({ fetchImpl }).generate({ prompt: 'x' })).resolves.toMatchObject({
      provider: 'pollinations',
    })
  })

  it('`none` is the one exemption: it produces nothing, so it lies about nothing', async () => {
    // Throwing here would turn "imagery is off on this instance" into an error,
    // which M3 spends a whole invariant avoiding — and there is no image for the
    // user to mistake for an edit of their own.
    expect(createNone().supportsInit).toBe(false)
    await expect(createNone().generate({ prompt: 'p', init: SOURCE })).resolves.toEqual({
      skipped: true,
      provider: 'none',
    })
  })

  it('cloudflare refuses a text-to-image MODEL even though the provider can edit', async () => {
    const fetchImpl = vi.fn()
    const p = createCloudflareImages({ fetchImpl, accountId: 'a', apiToken: 't', model: DEFAULT_CF_MODEL })
    await expect(p.generate({ prompt: 'p', init: SOURCE })).rejects.toThrow(/ne fait que du texte-vers-image/i)
    await expect(p.generate({ prompt: 'p', init: SOURCE })).rejects.toThrow(/img2img/)
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})

describe('readInit', () => {
  it('refuses an empty source rather than silently generating from text', () => {
    expect(() => readInit({ init: { buffer: Buffer.alloc(0), contentType: 'image/png' } }, 'x')).toThrow(/vide/)
  })

  it('refuses a format the narrowest capable provider rejects', () => {
    expect(() => readInit({ init: { buffer: Buffer.from('x'), contentType: 'image/gif' } }, 'x')).toThrow(/image\/gif/)
  })

  it('tolerates a charset-decorated content type', () => {
    expect(readInit({ init: { buffer: Buffer.from('x'), contentType: 'IMAGE/JPEG; charset=binary' } }, 'x')).toMatchObject(
      { contentType: 'image/jpeg' },
    )
  })

  it('caps the size before base64 multiplies it', () => {
    const huge = { buffer: Buffer.alloc(MAX_INIT_BYTES + 1), contentType: 'image/png' }
    expect(() => readInit({ init: huge }, 'x')).toThrow(/limite/)
  })

  it('returns null when there is no source image at all', () => {
    expect(readInit({ prompt: 'p' }, 'x')).toBeNull()
  })
})

describe('sd-webui image-to-image', () => {
  it('switches endpoint, sends the bytes and honours the strength direction', async () => {
    let seen
    const fetchImpl = vi.fn(async (url, init) => {
      seen = { url, body: JSON.parse(init.body) }
      return jsonRes({ images: [Buffer.from('SD').toString('base64')] })
    })
    const out = await createSdWebUi({ fetchImpl, baseUrl: 'http://127.0.0.1:7860' }).generate({
      prompt: 'p',
      init: SOURCE,
      strength: 0.4,
    })
    expect(seen.url).toBe('http://127.0.0.1:7860/sdapi/v1/img2img')
    expect(seen.body.init_images).toEqual([SOURCE.buffer.toString('base64')])
    // denoising_strength runs the same way as the contract: 1 = furthest.
    expect(seen.body.denoising_strength).toBe(0.4)
    expect(out).toMatchObject({ edited: true, strengthApplied: true })
  })

  it('still posts txt2img, with no init_images, when there is no source', async () => {
    let seen
    const fetchImpl = vi.fn(async (url, init) => {
      seen = { url, body: JSON.parse(init.body) }
      return jsonRes({ images: [Buffer.from('SD').toString('base64')] })
    })
    const out = await createSdWebUi({ fetchImpl }).generate({ prompt: 'p' })
    expect(seen.url).toBe('http://127.0.0.1:7860/sdapi/v1/txt2img')
    expect(seen.body.init_images).toBeUndefined()
    expect(out.edited).toBeUndefined()
  })

  it('clamps a strength outside the contract instead of forwarding it', async () => {
    let body
    const fetchImpl = vi.fn(async (u, init) => {
      body = JSON.parse(init.body)
      return jsonRes({ images: [Buffer.from('x').toString('base64')] })
    })
    await createSdWebUi({ fetchImpl }).generate({ prompt: 'p', init: SOURCE, strength: 7 })
    expect(body.denoising_strength).toBe(1)
  })
})

describe('cloudflare image-to-image', () => {
  it('sends image_b64 and strength, and does NOT impose a geometry', async () => {
    let body
    const fetchImpl = vi.fn(async (url, init) => {
      body = JSON.parse(init.body)
      return { ok: true, status: 200, arrayBuffer: async () => new Uint8Array([7]).buffer, headers: { get: () => 'image/png' } }
    })
    const out = await createCloudflareImages({
      fetchImpl,
      accountId: 'a',
      apiToken: 't',
      model: DEFAULT_CF_EDIT_MODEL,
    }).generate({ prompt: 'p', init: SOURCE, strength: 0.6, width: 1024, height: 1024 })
    expect(body.image_b64).toBe(SOURCE.buffer.toString('base64'))
    expect(body.strength).toBe(0.6)
    // The source sets the geometry on img2img; passing the slot's dimensions
    // would stretch the user's own picture to fit them.
    expect(body.width).toBeUndefined()
    expect(body.height).toBeUndefined()
    expect(out).toMatchObject({ edited: true, strengthApplied: true })
  })

  it('leaves the text-to-image path exactly as it was', async () => {
    let body
    const fetchImpl = vi.fn(async (url, init) => {
      body = JSON.parse(init.body)
      return jsonRes({ result: { image: Buffer.from('CF').toString('base64') } })
    })
    await createCloudflareImages({ fetchImpl, accountId: 'a', apiToken: 't' }).generate({
      prompt: 'p',
      width: 512,
      height: 512,
    })
    expect(body).toMatchObject({ width: 512, height: 512 })
    expect(body.image_b64).toBeUndefined()
  })
})

describe('fal image-to-image', () => {
  const noSleep = { sleep: async () => {} }
  function queueFetch() {
    const calls = []
    const fetchImpl = vi.fn(async (url, init) => {
      calls.push({ url, init })
      if (url.startsWith('https://queue.fal.run/') && init?.method === 'POST') {
        return jsonRes({ status_url: 'https://q/status', response_url: 'https://q/r' })
      }
      if (url.endsWith('/status')) return jsonRes({ status: 'COMPLETED' })
      if (url.endsWith('/r')) return jsonRes({ images: [{ url: 'https://fal.media/x.jpg', content_type: 'image/jpeg' }] })
      return { ok: true, arrayBuffer: async () => new Uint8Array([9]).buffer, headers: { get: () => 'image/jpeg' } }
    })
    fetchImpl.calls = calls
    return fetchImpl
  }

  it('sends a data URI and NO image_size (the field does not exist there)', async () => {
    // fal validates strictly: an unknown key is a 422, not a warning — the same
    // reason negative_prompt is folded into the prompt.
    const fetchImpl = queueFetch()
    const out = await createFal({ fetchImpl, apiKey: 'k', model: 'fal-ai/flux/dev/image-to-image', ...noSleep }).generate({
      prompt: 'p',
      init: SOURCE,
      width: 1280,
      height: 720,
    })
    const body = JSON.parse(fetchImpl.calls[0].init.body)
    expect(body.image_url).toBe(`data:image/png;base64,${SOURCE.buffer.toString('base64')}`)
    expect(body.image_size).toBeUndefined()
    expect(out.edited).toBe(true)
  })

  it('reports that it did not apply the strength, rather than guessing its direction', async () => {
    // fal's own documentation says higher = MORE like the source, which is the
    // opposite of the contract and of every other provider here; another fal
    // page says the reverse. A guessed mapping produces a slider that works
    // backwards with no error anywhere.
    const fetchImpl = queueFetch()
    const out = await createFal({ fetchImpl, apiKey: 'k', ...noSleep }).generate({
      prompt: 'p',
      init: SOURCE,
      strength: 0.2,
    })
    const body = JSON.parse(fetchImpl.calls[0].init.body)
    expect(body.strength).toBeUndefined()
    expect(out.strengthApplied).toBe(false)
  })
})

describe('openai image-to-image', () => {
  it('switches to multipart on /v1/images/edits and lets undici set the boundary', async () => {
    let seen
    const fetchImpl = vi.fn(async (url, init) => {
      seen = { url, init }
      return jsonRes({ data: [{ b64_json: Buffer.from('OUT').toString('base64') }] })
    })
    const out = await createOpenAiImages({ fetchImpl, apiKey: 'sk-x', model: 'gpt-image-1' }).generate({
      prompt: 'a cat',
      init: { buffer: Buffer.from('PNGBYTES'), contentType: 'image/png' },
      width: 1024,
      height: 1024,
    })
    expect(seen.url).toBe('https://api.openai.com/v1/images/edits')
    expect(seen.init.body).toBeInstanceOf(FormData)
    // A hand-written content-type replaces the computed boundary with one that
    // matches nothing in the body, and the request fails as "malformed".
    expect(seen.init.headers['content-type']).toBeUndefined()
    expect(seen.init.headers.authorization).toBe('Bearer sk-x')
    expect(seen.init.body.get('prompt')).toBe('a cat')
    const file = seen.init.body.get('image')
    expect(file.type).toBe('image/png')
    expect(file.name).toBe('source.png') // the extension must agree with the mime
    expect(await file.text()).toBe('PNGBYTES')
    expect(out).toMatchObject({ edited: true, strengthApplied: false })
  })

  it('keeps sending JSON to /v1/images/generations without a source image', async () => {
    let seen
    const fetchImpl = vi.fn(async (url, init) => {
      seen = { url, init }
      return jsonRes({ data: [{ b64_json: Buffer.from('x').toString('base64') }] })
    })
    await createOpenAiImages({ fetchImpl, apiKey: 'k' }).generate({ prompt: 'p', width: 1, height: 1 })
    expect(seen.url).toBe('https://api.openai.com/v1/images/generations')
    expect(seen.init.headers['content-type']).toBe('application/json')
  })
})

describe('sampleSourceImage', () => {
  it('is a real PNG, so the admin test exercises the real edit endpoint', () => {
    // A text-to-image test passes against a model that cannot edit at all, which
    // is exactly the misconfiguration the button is there to catch.
    const img = sampleSourceImage(32)
    expect(img.contentType).toBe('image/png')
    expect(img.buffer.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    expect(img.buffer.subarray(12, 16).toString('latin1')).toBe('IHDR')
    expect(img.buffer.readUInt32BE(16)).toBe(32) // width
    expect(img.buffer.subarray(-8, -4).toString('latin1')).toBe('IEND')
    expect(() => readInit({ init: img }, 'x')).not.toThrow()
  })
})
