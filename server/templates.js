// Project templates: a project kept as a starting point (src/lib/templates.ts).
//
// Per account, like creations and versions: a template is offered to the
// account that saved it and to nobody else. Not in the projects blob, for V3's
// reason — a template is a copy of every screen's code, and the blob lives in a
// localStorage budget the working copy already fills.
//
// One file per template, under one directory per account. The list is read from
// the files rather than from an index: thirty files is a short walk, and an index
// is a second thing that can disagree with the first.
//
// The server checks SHAPE and SIZE and keeps a whitelist of keys; what each
// field means is checked again where it is used, by `normalizeScreen` when a
// template becomes a project. Code is opaque here exactly as it is in the
// projects blob.

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/
const TEMPLATE_ID_RE = /^t[a-f0-9]{24}$/

export const MAX_TEMPLATES_PER_USER = 30
export const MAX_TEMPLATE_SCREENS = 80
/** The same per-screen ceilings as a saved version (server/versions.js). */
export const MAX_TEMPLATE_CODE_BYTES = 512 * 1024
export const MAX_TEMPLATE_DESIGN_BYTES = 128 * 1024
/** A whole template, everything included. */
export const MAX_TEMPLATE_BYTES = 6 * 1024 * 1024
export const TEMPLATE_NAME_MAX = 80

/**
 * What a template's screen may carry. Everything else on a Screen is about the
 * project it came from — notes, quality verdicts, the previous code, a campaign
 * or a publication — and is dropped on the way in, not only on the way out.
 */
export const TEMPLATE_SCREEN_KEYS = [
  'id',
  'name',
  'prompt',
  'code',
  'componentName',
  'caps',
  'design',
  'imageHash',
  'imageRole',
  'videoHash',
  'videoFrames',
  'attachedMedia',
  'animations',
  'ultra',
  'theme',
  'page',
  'fold',
  'x',
  'y',
  'w',
  'h',
  'device',
  'links',
  'route',
]

const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode })

const cleanName = (name) =>
  typeof name === 'string' ? name.replace(/\s+/g, ' ').trim().slice(0, TEMPLATE_NAME_MAX) : ''

function cleanSettings(s) {
  const out = {}
  if (!s || typeof s !== 'object') return out
  if (s.useBrand === true) out.useBrand = true
  if (s.creative === true) out.creative = true
  if (s.creations === true) out.creations = true
  if (s.ultra && typeof s.ultra === 'object') {
    out.ultra = { count: s.ultra.count === 6 ? 6 : 3, ...(s.ultra.video === true ? { video: true } : {}) }
  }
  return out
}

function cleanScreen(s) {
  if (!s || typeof s !== 'object' || Array.isArray(s)) throw fail('Bad screen.')
  if (typeof s.code !== 'string') throw fail('Bad screen.')
  if (Buffer.byteLength(s.code, 'utf8') > MAX_TEMPLATE_CODE_BYTES) throw fail('A screen is too large for a template.', 413)
  if (typeof s.design === 'string' && Buffer.byteLength(s.design, 'utf8') > MAX_TEMPLATE_DESIGN_BYTES) {
    throw fail('A design is too large for a template.', 413)
  }
  const out = {}
  for (const k of TEMPLATE_SCREEN_KEYS) if (s[k] !== undefined) out[k] = s[k]
  return out
}

export function createTemplateStore(dataDir, { now = () => Date.now(), budget = null } = {}) {
  const root = path.join(dataDir, 'templates')

  function dirOf(userId) {
    if (!ID_RE.test(String(userId || ''))) throw fail('Unknown account.', 401)
    return path.join(root, String(userId))
  }

  function fileOf(userId, id) {
    const dir = dirOf(userId)
    if (!TEMPLATE_ID_RE.test(String(id || ''))) return null
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

  function writeFile(file, value) {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    const tmp = `${file}.${crypto.randomBytes(6).toString('hex')}.tmp`
    const body = JSON.stringify(value)
    fs.writeFileSync(tmp, body, { mode: 0o600 })
    fs.renameSync(tmp, file)
    return Buffer.byteLength(body)
  }

  function sizeOfFile(file) {
    try {
      return fs.statSync(file).size
    } catch {
      return 0
    }
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
      .filter((t) => t && TEMPLATE_ID_RE.test(String(t.id)))
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
  }

  /** What the list shows: everything but the screens' code. */
  const summaryOf = (t) => ({
    id: t.id,
    name: t.name,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    design: t.design,
    settings: t.settings || {},
    screenCount: Array.isArray(t.screens) ? t.screens.length : 0,
    screenNames: Array.isArray(t.screens) ? t.screens.slice(0, 6).map((s) => String(s?.name || '')) : [],
  })

  return {
    list: (userId) => all(userId).map(summaryOf),

    get(userId, id) {
      const file = fileOf(userId, id)
      return file ? readFile(file) : null
    },

    add(userId, input) {
      const name = cleanName(input?.name)
      if (!name) throw fail('Bad name.')
      const screensIn = input?.screens
      if (!Array.isArray(screensIn)) throw fail('Bad screens.')
      if (screensIn.length > MAX_TEMPLATE_SCREENS) throw fail('This project has too many screens for a template.', 413)
      const screens = screensIn.map(cleanScreen)
      const design = typeof input.design === 'string' && input.design.trim() ? input.design : undefined
      if (design && Buffer.byteLength(design, 'utf8') > MAX_TEMPLATE_DESIGN_BYTES) throw fail('The direction is too large for a template.', 413)
      const ids = new Set(screens.map((s) => s.id))
      const reference = typeof input.referenceScreenId === 'string' && ids.has(input.referenceScreenId) ? input.referenceScreenId : undefined
      const existing = all(userId)
      if (existing.length >= MAX_TEMPLATES_PER_USER) {
        throw fail(`You already have ${MAX_TEMPLATES_PER_USER} templates. Delete one first.`, 409)
      }
      const at = now()
      const template = {
        id: `t${crypto.randomBytes(12).toString('hex')}`,
        name,
        createdAt: at,
        updatedAt: at,
        ...(design ? { design } : {}),
        settings: cleanSettings(input.settings),
        ...(reference ? { referenceScreenId: reference } : {}),
        screens,
      }
      const size = Buffer.byteLength(JSON.stringify(template))
      if (size > MAX_TEMPLATE_BYTES) throw fail('This project is too large to keep as a template.', 413)
      // Refused BEFORE writing: a full volume fails writes silently elsewhere.
      if (budget?.wouldExceed(size)) throw fail('This instance has reached its storage limit.', 507)
      const written = writeFile(fileOf(userId, template.id), template)
      budget?.add(written)
      return summaryOf(template)
    },

    rename(userId, id, rawName) {
      const name = cleanName(rawName)
      if (!name) throw fail('Bad name.')
      const file = fileOf(userId, id)
      const current = file ? readFile(file) : null
      if (!current) return null
      const before = sizeOfFile(file)
      const next = { ...current, name, updatedAt: now() }
      const after = writeFile(file, next)
      if (after > before) budget?.add(after - before)
      else budget?.remove(before - after)
      return summaryOf(next)
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
