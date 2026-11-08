// What a model made for an account, and an independent review let through
// (src/lib/creations/stage.ts).
//
// One account's creations are offered to that account's screens and to nobody
// else's. That is the whole access model, and what makes it acceptable that the
// checks ran in the browser: a person can only ever vouch for code to themselves.
// Sharing a creation between accounts would need the checks repeated here first.

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/
const NAME_RE = /^Custom[A-Z][A-Za-z0-9]{1,38}$/
const KINDS = new Set(['frame', 'animation', 'transition', 'element'])

export const MAX_CREATIONS_PER_USER = 200
export const MAX_CREATION_SOURCE = 32 * 1024

const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode })

const text = (value, max) => (typeof value === 'string' ? value.slice(0, max) : '')

export function createCreationStore(dataDir, { now = () => Date.now(), budget = null } = {}) {
  const root = path.join(dataDir, 'creations')

  function fileOf(userId) {
    if (!ID_RE.test(String(userId || ''))) throw fail('Unknown account.', 401)
    return path.join(root, `${userId}.json`)
  }

  function read(userId) {
    try {
      const parsed = JSON.parse(fs.readFileSync(fileOf(userId), 'utf8'))
      return Array.isArray(parsed) ? parsed : []
    } catch (err) {
      if (err?.statusCode) throw err
      return []
    }
  }

  function write(userId, list) {
    const file = fileOf(userId)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    const tmp = `${file}.${crypto.randomBytes(6).toString('hex')}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(list), { mode: 0o600 })
    fs.renameSync(tmp, file)
  }

  const sizeOf = (list) => Buffer.byteLength(JSON.stringify(list))

  return {
    list: (userId) => read(userId),

    add(userId, input) {
      const name = String(input?.name || '')
      const source = input?.source
      if (!NAME_RE.test(name)) throw fail('Bad name.')
      if (!KINDS.has(input?.kind)) throw fail('Bad kind.')
      if (typeof source !== 'string' || !source || Buffer.byteLength(source) > MAX_CREATION_SOURCE) throw fail('Bad source.', 413)
      const list = read(userId)
      const creation = {
        id: `c${crypto.randomBytes(12).toString('hex')}`,
        kind: input.kind,
        name,
        description: text(input.description, 240),
        usage: text(input.usage, 800),
        source,
        review: text(input.review, 500),
        createdAt: now(),
      }
      // One name, one creation: a screen says the name and nothing else.
      const next = [creation, ...list.filter((c) => c.name !== name)].slice(0, MAX_CREATIONS_PER_USER)
      const delta = sizeOf(next) - sizeOf(list)
      if (delta > 0 && budget?.wouldExceed(delta)) throw fail('This instance has reached its storage limit.', 507)
      write(userId, next)
      if (delta > 0) budget?.add(delta)
      else budget?.remove(-delta)
      return creation
    },

    remove(userId, id) {
      const list = read(userId)
      const next = list.filter((c) => c.id !== id)
      if (next.length === list.length) return false
      const freed = sizeOf(list) - sizeOf(next)
      write(userId, next)
      budget?.remove(freed)
      return true
    },

    removeAllFor(userId) {
      let file
      try {
        file = fileOf(userId)
      } catch {
        return
      }
      budget?.remove(read(userId).length ? sizeOf(read(userId)) : 0)
      fs.rmSync(file, { force: true })
    },
  }
}
