import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { STAGING_PREFIX, stageImages, unstage } from './staging.js'

/**
 * The staging directory, tested without Remotion.
 *
 * This module exists as a separate file so these four cases can run at all —
 * `render.js` imports `@remotion/bundler` at the top and is unimportable in
 * Mocky's suite. The bug being pinned here was invisible in every unit that
 * could be tested and only appeared in a container, minutes into a timeout.
 */

const image = (id, extension = '.jpg') => ({ id, extension, bytes: Buffer.from(`bytes-${id}`) })
const ID_A = 'a'.repeat(64)
const ID_B = 'b'.repeat(64)

let bundle
beforeEach(() => {
  bundle = fs.mkdtempSync(path.join(os.tmpdir(), 'mocky-staging-'))
  // Stands in for webpack's output: the sweep reads this directory, and a sweep
  // that took anything but its own prefix would delete the renderer.
  fs.writeFileSync(path.join(bundle, 'bundle.js'), 'pretend-webpack-output')
  fs.mkdirSync(path.join(bundle, 'public'))
})
afterEach(() => {
  fs.rmSync(bundle, { recursive: true, force: true })
})

describe('stageImages', () => {
  it('writes one file per image and addresses it by hash and extension', async () => {
    const staged = await stageImages(bundle, [image(ID_A), image(ID_B, '.png')])

    expect(fs.readFileSync(path.join(staged.dir, `${ID_A}.jpg`), 'utf8')).toBe(`bytes-${ID_A}`)
    expect(staged.imageSrc[ID_A]).toBe(`/${path.basename(staged.dir)}/${ID_A}.jpg`)
    // Root-relative, so Chromium asks the render server that is already serving
    // the bundle. An absolute URL here would be a network fetch, which this
    // container has no egress for and no business making.
    expect(staged.imageSrc[ID_B].startsWith('/')).toBe(true)
    expect(staged.imageSrc[ID_B].endsWith('.png')).toBe(true)

    await unstage(staged)
  })

  /**
   * THE defect this module was extracted to fix.
   *
   * One shared directory, wiped at the start of every render and removed in the
   * `finally` of every render, on the grounds that the worker renders one video
   * at a time. It does not: `server.js` answers 504 on an overrun and frees the
   * `busy` flag at once, because aborting a Remotion render is a request rather
   * than a guarantee. The abandoned render kept unwinding, its `finally` deleted
   * the pictures of the render that had replaced it, and a valid timeline failed
   * on "No image was staged" with nothing in its own request to explain it.
   */
  it('leaves the pictures of a render that is still running alone', async () => {
    const abandoned = await stageImages(bundle, [image(ID_A)])
    const current = await stageImages(bundle, [image(ID_B)])

    // The newcomer's own staging did not disturb the one already there…
    expect(fs.existsSync(path.join(abandoned.dir, `${ID_A}.jpg`))).toBe(true)

    // …and the abandoned render finishing does not disturb the newcomer.
    await unstage(abandoned)
    expect(fs.existsSync(path.join(current.dir, `${ID_B}.jpg`))).toBe(true)
    expect(fs.existsSync(abandoned.dir)).toBe(false)

    await unstage(current)
  })

  /**
   * The property the shared directory did buy, kept: a render whose cleanup
   * never ran — a container killed mid-flight — must not leave a hundred
   * megabytes inside a bundle that lives as long as the process.
   */
  it('sweeps a staging directory no live render owns', async () => {
    const orphan = path.join(bundle, `${STAGING_PREFIX}deadbeef`)
    fs.mkdirSync(orphan)
    fs.writeFileSync(path.join(orphan, `${ID_A}.jpg`), 'left behind')

    const staged = await stageImages(bundle, [image(ID_A)])
    expect(fs.existsSync(orphan)).toBe(false)

    await unstage(staged)
  })

  /**
   * The sweep reads the bundle directory, which is webpack's output. Matching on
   * the prefix is the whole reason it is safe to do that at all.
   */
  it('never touches anything that is not its own', async () => {
    const staged = await stageImages(bundle, [image(ID_A)])
    expect(fs.existsSync(path.join(bundle, 'bundle.js'))).toBe(true)
    expect(fs.existsSync(path.join(bundle, 'public'))).toBe(true)
    await unstage(staged)
  })

  /** A missing bundle directory is a bug elsewhere; it must not be an exception here. */
  it('does not throw when there is nothing to sweep', async () => {
    const staged = await stageImages(path.join(bundle, 'not-built-yet'), [])
    expect(fs.existsSync(staged.dir)).toBe(true)
    await unstage(staged)
    await expect(unstage(null)).resolves.toBeUndefined()
  })
})
