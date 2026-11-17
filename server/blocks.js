// Reusable blocks: a header, a partner band, a card or a footer kept on its
// own (src/lib/blocks.ts).
//
// Per account, like templates and creations: a block is offered to the account
// that saved it and to nobody else. Not in the projects blob, for V3's reason —
// the blob lives in a localStorage budget the working copy already fills, and a
// library of blocks is exactly the kind of thing that grows.
//
// One file per block, under one directory per account; the list is read from
// the files. The server checks SHAPE and SIZE only: the JSX is opaque here, as
// a screen's code is in the projects blob, and the browser parses it again
// before writing it anywhere (I1).

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/
const BLOCK_ID_RE = /^b[a-f0-9]{24}$/
const REV_RE = /^[0-9a-z]{1,16}\.[0-9a-z]{1,16}$/

export const BLOCK_KINDS = ['header', 'band', 'card', 'footer', 'other']
export const MAX_BLOCKS_PER_USER = 100
/** A block is one element and what it reads: a whole screen is 512 KB at most. */
export const MAX_BLOCK_BYTES = 128 * 1024
export const MAX_BLOCK_DECLS = 40
export const BLOCK_NAME_MAX = 80

const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode })

const cleanName = (name) => (typeof name === 'string' ? name.replace(/\s+/g, ' ').trim().slice(0, BLOCK_NAME_MAX) : '')
const cleanLabel = (s) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().slice(0, BLOCK_NAME_MAX) : '')

function cleanContent(input, { partial = false } = {}) {
  const out = {}
  if (input.jsx !== undefined || !partial) {
    if (typeof input.jsx !== 'string' || !input.jsx.trim()) throw fail('Bad block.')
    out.jsx = input.jsx
  }
  if (input.decls !== undefined || !partial) {
    if (!Array.isArray(input.decls) || input.decls.some((d) => typeof d !== 'string')) throw fail('Bad block.')
    if (input.decls.length > MAX_BLOCK_DECLS) throw fail('This block reads too many declarations.', 413)
    out.decls = input.decls
  }
  if (input.rev !== undefined || !partial) {
    if (typeof input.rev !== 'string' || !REV_RE.test(input.rev)) throw fail('Bad block.')
    out.rev = input.rev
  }
  // Content and rev move together: a rev that describes other content would
  // tell every copy it is up to date when it is not.
  if (partial && ('jsx' in out || 'decls' in out || 'rev' in out) && !('jsx' in out && 'decls' in out && 'rev' in out)) {
    throw fail('Bad block.')
  }
  return out
}

export function createBlockStore(dataDir, { now = () => Date.now(), budget = null } = {}) {
  const root = path.join(dataDir, 'blocks')

  function dirOf(userId) {
    if (!ID_RE.test(String(userId || ''))) throw fail('Unknown account.', 401)
    return path.join(root, String(userId))
  }

  function fileOf(userId, id) {
    const dir = dirOf(userId)
    if (!BLOCK_ID_RE.test(String(id || ''))) return null
    return path.join(dir, `${id}.json`)
  }

  function readFile(file) {
    try {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8'))
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
    } catch {
      return null
    }
  }

  const sizeOfFile = (file) => {
    try {
      return fs.statSync(file).size
    } catch {
      return 0
    }
  }

  /** Written atomically, and refused BEFORE writing when the disk budget would be crossed. */
  function writeFile(file, value) {
    const body = JSON.stringify(value)
    const size = Buffer.byteLength(body)
    if (size > MAX_BLOCK_BYTES) throw fail('This block is too large.', 413)
    const before = sizeOfFile(file)
    if (size > before && budget?.wouldExceed(size - before)) throw fail('This instance has reached its storage limit.', 507)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    const tmp = `${file}.${crypto.randomBytes(6).toString('hex')}.tmp`
    fs.writeFileSync(tmp, body, { mode: 0o600 })
    fs.renameSync(tmp, file)
    if (size > before) budget?.add(size - before)
    else budget?.remove(before - size)
  }

  function all(userId) {
    const dir = dirOf(userId)
    let names = []
    try {
      names = fs.readdirSync(dir).filter((n) => n.endsWith('.json'))
    } catch {
      return []
    }
    return names
      .map((n) => readFile(path.join(dir, n)))
      .filter((b) => b && BLOCK_ID_RE.test(String(b.id)))
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
  }

  return {
    list: (userId) => all(userId),

    add(userId, input) {
      const name = cleanName(input?.name)
      if (!name) throw fail('Bad name.')
      const content = cleanContent(input || {})
      if (all(userId).length >= MAX_BLOCKS_PER_USER) {
        throw fail(`You already have ${MAX_BLOCKS_PER_USER} blocks. Delete one first.`, 409)
      }
      const at = now()
      const from = input.from && typeof input.from === 'object' ? input.from : {}
      const block = {
        id: `b${crypto.randomBytes(12).toString('hex')}`,
        name,
        kind: BLOCK_KINDS.includes(input.kind) ? input.kind : 'other',
        ...content,
        ...(cleanLabel(from.project) || cleanLabel(from.screen)
          ? { from: { ...(cleanLabel(from.project) ? { project: cleanLabel(from.project) } : {}), ...(cleanLabel(from.screen) ? { screen: cleanLabel(from.screen) } : {}) } }
          : {}),
        createdAt: at,
        updatedAt: at,
      }
      writeFile(fileOf(userId, block.id), block)
      return block
    },

    update(userId, id, input) {
      const file = fileOf(userId, id)
      const current = file ? readFile(file) : null
      if (!current) return null
      const patch = cleanContent(input || {}, { partial: true })
      if (input?.name !== undefined) {
        patch.name = cleanName(input.name)
        if (!patch.name) throw fail('Bad name.')
      }
      if (input?.kind !== undefined) {
        if (!BLOCK_KINDS.includes(input.kind)) throw fail('Bad kind.')
        patch.kind = input.kind
      }
      const next = { ...current, ...patch, updatedAt: now() }
      writeFile(file, next)
      return next
    },

    remove(userId, id) {
      const file = fileOf(userId, id)
      if (!file || !fs.existsSync(file)) return false
      const freed = sizeOfFile(file)
      fs.rmSync(file, { force: true })
      budget?.remove(freed)
      return true
    },

    removeAllFor(userId) {
      let dir
      try {
        dir = dirOf(userId)
      } catch {
        return
      }
      let freed = 0
      try {
        for (const n of fs.readdirSync(dir)) freed += sizeOfFile(path.join(dir, n))
      } catch {
        return
      }
      fs.rmSync(dir, { recursive: true, force: true })
      budget?.remove(freed)
    },
  }
}
