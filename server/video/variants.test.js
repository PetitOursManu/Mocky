import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { ImageLibrary } from '../images/library.js'
import {
  makeVariants,
  axesFor,
  clampVariantCount,
  variantSeed,
  variantPrompt,
  VARIATION_AXES,
  MAX_VARIANTS,
  VARIANT_STRENGTH,
} from './variants.js'

/**
 * The defect every test in this file exists to keep out is one sentence:
 * "here are variants of your image" printed over pictures that never saw it.
 *
 * That happens two ways. A provider handed a source image it cannot use and
 * dropping it — which providers/init.js closes — or Mocky itself falling back to
 * text-only siblings and reporting them as derivations. This is the second one.
 */

/**
 * A provider whose output is deterministic for a given request, and which
 * RECORDS what it was asked. The whole question "did the source image actually
 * leave the machine" is answered by looking at those calls.
 */
function fakeProvider(id = 'fake-edit', { supportsInit = true } = {}) {
  const calls = []
  return {
    id,
    requiresKey: false,
    supportsInit,
    calls,
    async healthy() {
      return true
    },
    async generate(req) {
      calls.push(req)
      if (req.init && !supportsInit) throw new Error(`${id} ne sait pas dériver une image d'une autre.`)
      return {
        buffer: Buffer.from(`img:${req.prompt}:${req.seed}:${req.init ? req.init.buffer.toString('hex') : 'none'}`),
        contentType: 'image/jpeg',
        provider: id,
        ...(req.init ? { edited: true, strengthApplied: true } : {}),
      }
    },
  }
}

const registryOf = (provider) => ({
  get: (id) => (id === provider.id ? provider : null),
  pick: async () => provider,
  list: () => [{ id: provider.id, requiresKey: false, supportsInit: !!provider.supportsInit }],
})

let dir, library, sourceId
const SOURCE_BYTES = Buffer.from('the-source-photograph')

beforeEach(() => {
  dir = path.join(os.tmpdir(), `mocky-variants-${crypto.randomBytes(6).toString('hex')}`)
  fs.mkdirSync(dir, { recursive: true })
  library = new ImageLibrary(dir)
  sourceId = library.ingestUpload(SOURCE_BYTES, {
    name: 'a matte black kettle on concrete',
    width: 1024,
    height: 768,
    mime: 'image/png',
  }).hash
})
afterEach(() => {
  try {
    fs.rmSync(dir, { recursive: true, force: true })
  } catch {
    /* ignore */
  }
})

describe('the nominal path — a real derivation', () => {
  it('sends the SOURCE BYTES to the provider, with a moderate strength', async () => {
    // The one assertion this whole feature turns on. A variant path that looked
    // right in every response body and never put the image on the wire is
    // indistinguishable from this one from the outside.
    const provider = fakeProvider()
    const out = await makeVariants({ imageId: sourceId, count: 3 }, { library, editRegistry: registryOf(provider) })

    expect(out.derived).toBe(true)
    expect(out.images).toHaveLength(3)
    expect(provider.calls).toHaveLength(3)
    for (const call of provider.calls) {
      expect(call.init.buffer.equals(SOURCE_BYTES)).toBe(true)
      expect(call.strength).toBe(VARIANT_STRENGTH)
    }
  })

  it("carries the source's own prompt, plus one variation instruction per axis", async () => {
    const provider = fakeProvider()
    await makeVariants({ imageId: sourceId, count: 3 }, { library, editRegistry: registryOf(provider) })
    const prompts = provider.calls.map((c) => c.prompt)
    for (const p of prompts) expect(p).toContain('a matte black kettle on concrete')
    expect(prompts[0]).toContain(VARIATION_AXES[0].hint)
    expect(prompts[1]).toContain(VARIATION_AXES[1].hint)
    // Distinct, always: two variants with the same prompt are two pictures a
    // human cannot choose between, in a panel whose only job is choosing.
    expect(new Set(prompts).size).toBe(3)
  })

  it("keeps the source's geometry rather than a default", async () => {
    // A derivative returned in a different shape from its source is a crop
    // nobody asked for.
    const provider = fakeProvider()
    const out = await makeVariants({ imageId: sourceId, count: 2 }, { library, editRegistry: registryOf(provider) })
    expect(provider.calls[0]).toMatchObject({ width: 1024, height: 768 })
    // And nothing to report: a shape that was inherited is not news.
    expect(out.notices).toEqual([])
  })

  it('says so when there is no geometry to keep, instead of quietly asking for a square', async () => {
    /*
     * The reachable case: `ingestUpload` records 0 when the browser could not
     * decode the file, and rows from before the field existed carry nothing. The
     * spec then falls back to 1024×1024 — the library's square default, which is
     * exactly what `SOURCE_DIMENSIONS` exists to stop a film asking for, since a
     * 16:9 frame crops 44% of a square and enlarges what is left by 1.88.
     *
     * This server decodes no images, so there is no better answer to send. What
     * there is, is the difference between degrading and degrading in silence.
     */
    const unmeasured = library.ingestUpload(Buffer.from('an-undecodable-import'), { name: 'a wide photograph' }).hash
    const provider = fakeProvider()
    const out = await makeVariants({ imageId: unmeasured, count: 2 }, { library, editRegistry: registryOf(provider) })
    expect(provider.calls[0]).toMatchObject({ width: 1024, height: 1024 })
    expect(out.notices.join(' ')).toMatch(/dimensions enregistrées/)
    // Still a full set: this is a notice, never a refusal (Q1).
    expect(out.images).toHaveLength(2)
  })

  it('never falls back to text-only siblings when the edit provider fails', async () => {
    /*
     * A configured-but-broken edit profile must surface as an error, not as a
     * quiet switch to the fallback. Falling back would produce a set marked
     * `derived: false` — honest about itself — while making the admin's actual
     * problem invisible forever, since nothing would ever fail again.
     */
    const broken = {
      id: 'broken',
      supportsInit: true,
      async healthy() {
        return true
      },
      async generate() {
        throw new Error('401 bad key')
      },
    }
    const sibling = fakeProvider('would-be-fallback')
    const out = await makeVariants(
      { imageId: sourceId, count: 2 },
      { library, editRegistry: registryOf(broken), fallbackRegistry: registryOf(sibling) },
    )
    expect(out.derived).toBe(true)
    expect(out.images).toHaveLength(0)
    expect(out.notices.join(' ')).toMatch(/401 bad key/)
    expect(sibling.calls).toHaveLength(0)
  })
})

describe('the fallback — siblings born of the same text', () => {
  it('says so, and sends no image to the provider', async () => {
    const provider = fakeProvider('text-only', { supportsInit: false })
    const out = await makeVariants({ imageId: sourceId, count: 2 }, { library, fallbackRegistry: registryOf(provider) })

    expect(out.derived).toBe(false)
    expect(out.images).toHaveLength(2)
    for (const call of provider.calls) {
      expect(call.init).toBeUndefined()
      expect(call.strength).toBeUndefined()
    }
  })

  it('is reproducible: the same call twice yields the same pictures', async () => {
    // The seed is derived from the source id, so a second request is a cache hit
    // rather than a second bill (M8) — and "give me the other two" keeps
    // meaning something.
    const provider = fakeProvider('text-only', { supportsInit: false })
    const a = await makeVariants({ imageId: sourceId, count: 3 }, { library, fallbackRegistry: registryOf(provider) })
    const b = await makeVariants({ imageId: sourceId, count: 3 }, { library, fallbackRegistry: registryOf(provider) })
    expect(b.images.map((i) => i.hash)).toEqual(a.images.map((i) => i.hash))
    expect(b.images.every((i) => i.fromCache)).toBe(true)
    expect(provider.calls).toHaveLength(3)
  })

  it('gives two different sources two different series', async () => {
    // Same prompt, same size, same axis: without the source id in the seed both
    // images would be handed the same pictures.
    const other = library.ingestUpload(Buffer.from('another-photograph'), {
      name: 'a matte black kettle on concrete',
      width: 1024,
      height: 768,
    }).hash
    expect(variantSeed(other, 0)).not.toBe(variantSeed(sourceId, 0))
  })

  it('refuses when there is neither an image nor a description to work from', async () => {
    const blank = library.ingestUpload(Buffer.from('no-caption'), { name: '', width: 10, height: 10 })
    // ingestUpload defaults an empty name; blank it the hard way to reach the case.
    library.get(blank.hash).prompt = ''
    await expect(
      makeVariants({ imageId: blank.hash, count: 2 }, { library, fallbackRegistry: registryOf(fakeProvider()) }),
    ).rejects.toThrow(/ni image d'entrée ni texte/i)
  })
})

describe('what comes back', () => {
  it('marks every variant pending and owned, and keeps them out of the library listing', async () => {
    const before = library.list().length
    const out = await makeVariants(
      { imageId: sourceId, count: 2 },
      { library, editRegistry: registryOf(fakeProvider()), owner: 'u1', project: 'p1' },
    )
    for (const v of out.images) {
      const meta = library.get(v.hash)
      expect(meta.pending).toBe(true)
      expect(meta.owners).toEqual(['u1'])
      expect(meta.projects).toEqual(['p1'])
      expect(meta.derivedFrom).toBe(sourceId)
    }
    expect(library.list()).toHaveLength(before)
    expect(library.list({ includePending: true })).toHaveLength(before + 2)
  })

  it('leaves the other variants alone when one fails, and names which (Q1)', async () => {
    let n = 0
    const flaky = {
      id: 'flaky',
      supportsInit: true,
      async healthy() {
        return true
      },
      async generate(req) {
        if (++n === 2) throw new Error('provider exploded')
        return { buffer: Buffer.from(`ok:${req.seed}`), contentType: 'image/jpeg', provider: 'flaky', edited: true }
      },
    }
    const out = await makeVariants({ imageId: sourceId, count: 3 }, { library, editRegistry: registryOf(flaky) })
    expect(out.images).toHaveLength(2)
    expect(out.notices).toHaveLength(1)
    expect(out.notices[0]).toMatch(/Variante 2 \(framing\).*provider exploded/)
  })

  it('stops spending provider calls once the caller has gone away', async () => {
    const provider = fakeProvider()
    let seen = 0
    const out = await makeVariants(
      { imageId: sourceId, count: 6 },
      {
        library,
        editRegistry: registryOf(provider),
        aborted: () => ++seen > 2,
      },
    )
    expect(provider.calls.length).toBeLessThan(6)
    expect(out.notices.join(' ')).toMatch(/interrompue/i)
  })
})

describe('the axes and the bounds', () => {
  it('clamps the count to 2..6, and an unreadable one to the cheapest answer', () => {
    expect(clampVariantCount(4)).toBe(4)
    expect(clampVariantCount(0)).toBe(2)
    expect(clampVariantCount(-3)).toBe(2)
    expect(clampVariantCount(99)).toBe(MAX_VARIANTS)
    expect(clampVariantCount(undefined)).toBe(2)
    expect(clampVariantCount('lots')).toBe(2)
  })

  it('never repeats an axis on its own — the sixth variant pairs two', () => {
    // MAX_VARIANTS is one above the table, so a plain modulo would have made
    // variant #6 a byte-identical prompt to variant #1.
    const ids = Array.from({ length: MAX_VARIANTS }, (_, i) => axesFor(i).map((a) => a.id).join('+'))
    expect(new Set(ids).size).toBe(MAX_VARIANTS)
    expect(ids[5]).toBe('angle+framing')
  })

  it('asks the provider for something different depending on whether an image is attached', () => {
    // Without a source image, "the supplied image" refers to nothing the
    // provider can see.
    expect(variantPrompt('a kettle', 0, true)).toMatch(/supplied image/)
    expect(variantPrompt('a kettle', 0, false)).not.toMatch(/supplied image/)
  })
})
