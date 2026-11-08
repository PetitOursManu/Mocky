// The small picture of a screen, for the home page of any device.
//
// A thumbnail is taken in the browser, right after a screen settles, and used to
// stay there: a cache in localStorage, forty entries, on one machine. Opening
// the account somewhere else showed drawn rectangles until each project had been
// opened again. Capturing on the server would mean running model-written code
// here for a picture, so the picture travels instead: the device that took it
// sends the JPEG, the others read it.
//
// Not in the projects blob, for the reason versions are not (server/versions.js):
// the blob lives in a browser's 5 MB, and the point of this store is to hold more
// pictures than that budget ever could.
//
// A picture is valid for one state of one screen. The browser asks with the
// checksum of the code it holds, and a stale picture is simply not found, so a
// device that edited a screen never shows another device's older image of it.

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/
const HASH_RE = /^[a-z0-9]{1,16}-[a-z0-9]{1,16}$/

/** A 480 px JPEG is around 10 kB; this is only a bound on what can be stored. */
export const MAX_THUMB_BYTES = 256 * 1024
/** Per account. The oldest picture goes first. */
export const MAX_THUMBS_PER_USER = 3000
/** How many one question may ask about. */
export const MAX_KNOWN_QUERY = 1000

const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode })

export function createThumbStore(dataDir, { now = () => Date.now(), budget = null } = {}) {
  const root = path.join(dataDir, 'thumbs')

  function dirOf(userId) {
    if (!ID_RE.test(String(userId || ''))) throw fail('Unknown account.', 401)
    return path.join(root, userId)
  }

  function writeAtomic(file, data) {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    const tmp = `${file}.${crypto.randomBytes(6).toString('hex')}.tmp`
    fs.writeFileSync(tmp, data, { mode: 0o600 })
    fs.renameSync(tmp, file)
  }

  function readIndex(userId) {
    try {
      const parsed = JSON.parse(fs.readFileSync(path.join(dirOf(userId), 'index.json'), 'utf8'))
      return parsed && typeof parsed === 'object' ? parsed : {}
    } catch {
      return {}
    }
  }

  function drop(dir, index, screenId) {
    try {
      fs.rmSync(path.join(dir, `${screenId}.jpg`), { force: true })
      budget?.remove(index[screenId]?.size || 0)
    } catch {
      /* already gone */
    }
    delete index[screenId]
  }

  return {
    /** Stores the picture of one state of one screen. Throws with a statusCode. */
    put(userId, screenId, hash, bytes) {
      if (!ID_RE.test(String(screenId || ''))) throw fail('Bad screen id.')
      if (!HASH_RE.test(String(hash || ''))) throw fail('Bad checksum.')
      if (!Buffer.isBuffer(bytes) || bytes.length === 0 || bytes.length > MAX_THUMB_BYTES) throw fail('Bad picture size.', 413)
      // JPEG only, by its bytes: this file is served back from Mocky's origin.
      if (bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) throw fail('Not a JPEG.', 415)
      if (budget?.wouldExceed(bytes.length)) throw fail('This instance has reached its storage limit.', 507)

      const dir = dirOf(userId)
      const index = readIndex(userId)
      const had = index[screenId]?.size || 0
      writeAtomic(path.join(dir, `${screenId}.jpg`), bytes)
      budget?.remove(had)
      budget?.add(bytes.length)
      index[screenId] = { hash, size: bytes.length, at: now() }

      const ids = Object.keys(index)
      if (ids.length > MAX_THUMBS_PER_USER) {
        ids.sort((a, b) => (index[a].at || 0) - (index[b].at || 0))
        for (const id of ids.slice(0, ids.length - MAX_THUMBS_PER_USER)) drop(dir, index, id)
      }
      writeAtomic(path.join(dir, 'index.json'), JSON.stringify(index))
    },

    /** Which of these exact states have a picture here. */
    known(userId, items) {
      if (!Array.isArray(items)) return []
      const index = readIndex(userId)
      const out = []
      for (const item of items.slice(0, MAX_KNOWN_QUERY)) {
        const id = String(item?.id ?? '')
        if (ID_RE.test(id) && index[id]?.hash === item?.hash) out.push(id)
      }
      return out
    },

    /** The bytes of that state, or null: a stale picture is not an answer. */
    read(userId, screenId, hash) {
      if (!ID_RE.test(String(screenId || ''))) return null
      if (readIndex(userId)[screenId]?.hash !== hash) return null
      try {
        return fs.readFileSync(path.join(dirOf(userId), `${screenId}.jpg`))
      } catch {
        return null
      }
    },

    removeAllFor(userId) {
      let dir
      try {
        dir = dirOf(userId)
      } catch {
        return
      }
      const index = readIndex(userId)
      for (const id of Object.keys(index)) budget?.remove(index[id]?.size || 0)
      fs.rmSync(dir, { recursive: true, force: true })
    },
  }
}
