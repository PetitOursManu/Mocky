// Where one render's pictures live while Chromium is loading them.
//
// Its own module for the reason `validate.js` and `remotion/composition.js` are
// their own modules: `render.js` imports `@remotion/*` at the top, so nothing in
// it can be reached by a test running inside Mocky's vitest suite, where those
// packages are not installed and never will be. Everything here is `node:fs` and
// string joins — which is precisely the part that had a defect.
//
// THE DEFECT. The first version staged every render into one shared
// `mocky-frames/` directory, wiped at the start of each render and removed in
// the `finally` of each render, on the stated grounds that "the worker renders
// one video at a time, so nothing else can be reading it". `server.js` says the
// opposite in its own comment, and it is right: when a render overruns, the
// route answers 504 and frees the `busy` flag immediately, because aborting is a
// REQUEST and not a guarantee. The abandoned render is still unwinding — killing
// Chromium and the encoder takes seconds — and its `finally` then deleted the
// pictures of the render that had replaced it in the meantime. The victim is a
// perfectly valid timeline failing on "No image was staged", moments after an
// unrelated timeout, with nothing in its own request to explain it.
//
// So each render owns a directory nobody else touches, and removes only that
// one. What the shared directory did buy — no stale megabytes accumulating
// inside a bundle that lives as long as the container — is bought back by
// `sweep`, which drops the leftovers of renders that are provably not running.
import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'

/**
 * Sibling directories at the root of the bundle, not one nested level deeper.
 *
 * The depth is load-bearing and the reason is empirical: `/mocky-frames/<file>`
 * is the shape that was proven to load, and Remotion's static server is the one
 * piece of this path that cannot be exercised without Remotion installed. A
 * per-render directory is the fix; adding a level of nesting to get it would
 * have been an untested change smuggled in beside a tested one.
 */
export const STAGING_PREFIX = 'mocky-frames-'

/**
 * The tokens of the renders currently holding a directory.
 *
 * Module state, and it can be: the worker is one process, and this set is only
 * ever read to decide what `sweep` may delete. A token missing from it means
 * "no render in this process owns that directory", which after a restart is true
 * of every leftover on disk.
 */
const live = new Set()

/**
 * Write this request's pictures beside the bundle and return their addresses.
 *
 * The file name is `<hash><extension>` and both halves are already validated:
 * the hash matched `[0-9a-f]{64}` in `validate.js` and the extension came from a
 * MIME allow-list there. The directory name is random bytes this function
 * generated. Nothing from the request is concatenated into a path in any other
 * form, which is what keeps `../` out of a directory the render server is about
 * to expose.
 *
 * @param {string} serveUrl  the bundle directory
 * @param {Array<{id:string, extension:string, bytes:Buffer}>} images
 * @returns {Promise<{token:string, dir:string, imageSrc:Record<string,string>}>}
 */
export async function stageImages(serveUrl, images = []) {
  const token = crypto.randomBytes(8).toString('hex')
  const name = `${STAGING_PREFIX}${token}`
  const dir = path.join(serveUrl, name)

  // Registered BEFORE the sweep, so a second render starting between these two
  // lines cannot decide this directory is abandoned and delete it — which would
  // be the same bug in a narrower window.
  live.add(token)
  await sweep(serveUrl)
  await fs.mkdir(dir, { recursive: true })

  const imageSrc = {}
  for (const image of images) {
    const file = `${image.id}${image.extension}`
    await fs.writeFile(path.join(dir, file), image.bytes)
    imageSrc[image.id] = `/${name}/${file}`
  }
  return { token, dir, imageSrc }
}

/**
 * Give back one render's directory. Best effort, and only ever its own.
 *
 * Swallowed: a cleanup failure after a successful render must not turn a video
 * the user is waiting for into an error, and `sweep` collects whatever is left
 * on the next render anyway.
 */
export async function unstage(staged) {
  if (!staged?.token) return
  live.delete(staged.token)
  await fs.rm(staged.dir, { recursive: true, force: true }).catch(() => {})
}

/**
 * Drop the staging directories of renders that are provably not running.
 *
 * Provably: `live` holds a token for the whole life of a render, added before
 * this function can run and removed only by `unstage`. Anything carrying the
 * prefix and an unknown token therefore belongs to a render this process is not
 * doing — a container restarted mid-render, or an `unstage` that lost its own
 * file system race.
 *
 * The prefix is what bounds the damage. This reads the bundle directory, which
 * also holds webpack's output, and a sweep that removed anything else would be a
 * worker that deletes its own renderer.
 */
async function sweep(serveUrl) {
  let entries
  try {
    entries = await fs.readdir(serveUrl, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    if (!entry.name.startsWith(STAGING_PREFIX)) continue
    if (live.has(entry.name.slice(STAGING_PREFIX.length))) continue
    await fs.rm(path.join(serveUrl, entry.name), { recursive: true, force: true }).catch(() => {})
  }
}
