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
/** A section's name: several templates kept together under it (Media → Design, the first composer). */
export const SECTION_NAME_MAX = 60
/** Pictures kept per template, the reference screen first: what Media and the composer show. */
export const MAX_TEMPLATE_THUMBS = 4
/** A 480 px JPEG is around 10 kB (src/lib/thumbnails.ts); this only bounds what can be stored. */
export const MAX_TEMPLATE_THUMB_BYTES = 256 * 1024
const SCREEN_ID_RE = /^[A-Za-z0-9_-]{1,64}$/

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
  'fill',
]

const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode })

const cleanName = (name) =>
  typeof name === 'string' ? name.replace(/\s+/g, ' ').trim().slice(0, TEMPLATE_NAME_MAX) : ''

/**
 * A section is a NAME on the template, not a record of its own: a template is
 * in one section or none, a section exists while a template carries it, and
 * renaming one is renaming the field on each of its templates. Nothing to keep
 * in step with anything else, and nothing left behind when its last template goes.
 */
const cleanSection = (name) =>
  typeof name === 'string' ? name.replace(/\s+/g, ' ').trim().slice(0, SECTION_NAME_MAX) : ''

function cleanSettings(s) {
  const out = {}
  if (!s || typeof s !== 'object') return out
  if (s.useBrand === true) out.useBrand = true
  if (s.useBrand === true && typeof s.brandId === 'string' && /^[\w-]{1,40}$/.test(s.brandId)) out.brandId = s.brandId
  if (s.creative === true) out.creative = true
  if (s.creations === true) out.creations = true
  if (typeof s.rules === 'string' && s.rules.trim()) out.rules = s.rules.slice(0, 1200)
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

  /**
   * A template's pictures live BESIDE its file (`<id>.thumbs/<screen>.jpg`), not
   * in it: the list parses every template file, and thirty templates carrying
   * four JPEGs each in base64 would be read in full to show their names.
   */
  function thumbDirOf(userId, id) {
    const file = fileOf(userId, id)
    return file ? file.replace(/\.json$/, '.thumbs') : null
  }

  /** The screens that have a picture, in the template's own order, reference first. */
  function thumbIds(userId, t) {
    const dir = thumbDirOf(userId, t.id)
    let names = []
    try {
      names = dir ? fs.readdirSync(dir) : []
    } catch {
      return []
    }
    const have = new Set(names.filter((n) => n.endsWith('.jpg')).map((n) => n.slice(0, -4)))
    const order = Array.isArray(t.screens) ? t.screens.map((s) => String(s?.id || '')) : []
    if (t.referenceScreenId) order.unshift(String(t.referenceScreenId))
    return [...new Set(order)].filter((sid) => have.has(sid)).slice(0, MAX_TEMPLATE_THUMBS)
  }

  /** What the list shows: everything but the screens' code. */
  const summaryOf = (userId, t) => ({
    id: t.id,
    name: t.name,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    design: t.design,
    settings: t.settings || {},
    ...(t.section ? { section: t.section } : {}),
    screenCount: Array.isArray(t.screens) ? t.screens.length : 0,
    screenNames: Array.isArray(t.screens) ? t.screens.slice(0, 6).map((s) => String(s?.name || '')) : [],
    thumbs: thumbIds(userId, t),
  })

  /** Rewrite one template file, keeping the disk budget's count right. */
  function rewrite(file, next) {
    const before = sizeOfFile(file)
    const after = writeFile(file, next)
    if (after > before) budget?.add(after - before)
    else budget?.remove(before - after)
  }

  return {
    list: (userId) => all(userId).map((t) => summaryOf(userId, t)),

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
        ...(cleanSection(input.section) ? { section: cleanSection(input.section) } : {}),
        ...(reference ? { referenceScreenId: reference } : {}),
        screens,
      }
      const size = Buffer.byteLength(JSON.stringify(template))
      if (size > MAX_TEMPLATE_BYTES) throw fail('This project is too large to keep as a template.', 413)
      // Refused BEFORE writing: a full volume fails writes silently elsewhere.
      if (budget?.wouldExceed(size)) throw fail('This instance has reached its storage limit.', 507)
      const written = writeFile(fileOf(userId, template.id), template)
      budget?.add(written)
      return summaryOf(userId, template)
    },

    /** The name, the section, or both. `section: ''` takes the template out of its section. */
    update(userId, id, patch) {
      const file = fileOf(userId, id)
      const current = file ? readFile(file) : null
      if (!current) return null
      const next = { ...current, updatedAt: now() }
      if (patch && 'name' in patch) {
        const name = cleanName(patch.name)
        if (!name) throw fail('Bad name.')
        next.name = name
      }
      if (patch && 'section' in patch) {
        if (patch.section !== null && typeof patch.section !== 'string') throw fail('Bad section.')
        const section = cleanSection(patch.section)
        if (section) next.section = section
        else delete next.section
      }
      rewrite(file, next)
      return summaryOf(userId, next)
    },

    /**
     * Rewrite a template's CONTENT — its direction, settings, reference screen
     * and screens — from a project that edited it (Media → Design → Edit, or
     * an assistant's update_template). The name, the section and the creation
     * date are the template's own and stay: they say where it is kept, and the
     * project that edited it was only ever a place to change what it holds.
     *
     * The pictures of screens the new set no longer has are removed, so a
     * screen that came back under a new id is photographed again rather than
     * shown as it was before the edit.
     */
    replace(userId, id, input) {
      const file = fileOf(userId, id)
      const current = file ? readFile(file) : null
      if (!current) return null
      const screensIn = input?.screens
      if (!Array.isArray(screensIn)) throw fail('Bad screens.')
      if (screensIn.length > MAX_TEMPLATE_SCREENS) throw fail('This project has too many screens for a template.', 413)
      const screens = screensIn.map(cleanScreen)
      const design = typeof input.design === 'string' && input.design.trim() ? input.design : undefined
      if (design && Buffer.byteLength(design, 'utf8') > MAX_TEMPLATE_DESIGN_BYTES) throw fail('The direction is too large for a template.', 413)
      const ids = new Set(screens.map((s) => s.id))
      const reference = typeof input.referenceScreenId === 'string' && ids.has(input.referenceScreenId) ? input.referenceScreenId : undefined
      const next = {
        id: current.id,
        name: current.name,
        createdAt: current.createdAt,
        updatedAt: now(),
        ...(design ? { design } : {}),
        settings: cleanSettings(input.settings),
        ...(current.section ? { section: current.section } : {}),
        ...(reference ? { referenceScreenId: reference } : {}),
        screens,
      }
      const size = Buffer.byteLength(JSON.stringify(next))
      if (size > MAX_TEMPLATE_BYTES) throw fail('This project is too large to keep as a template.', 413)
      if (budget?.wouldExceed(Math.max(0, size - sizeOfFile(file)))) throw fail('This instance has reached its storage limit.', 507)
      rewrite(file, next)
      const dir = thumbDirOf(userId, id)
      let freed = 0
      try {
        for (const n of fs.readdirSync(dir)) {
          if (n.endsWith('.jpg') && ids.has(n.slice(0, -4))) continue
          freed += sizeOfFile(path.join(dir, n))
          fs.rmSync(path.join(dir, n), { force: true })
        }
      } catch {
        /* no pictures */
      }
      budget?.remove(freed)
      return summaryOf(userId, next)
    },

    rename(userId, id, rawName) {
      return this.update(userId, id, { name: rawName })
    },

    /** Every template of section `from` moves to `to`; an empty `to` dissolves the section. Answers how many moved. */
    renameSection(userId, from, to) {
      const source = cleanSection(from)
      if (!source) throw fail('Bad section.')
      const target = cleanSection(to)
      let moved = 0
      for (const t of all(userId)) {
        if (t.section !== source) continue
        const next = { ...t, updatedAt: now() }
        if (target) next.section = target
        else delete next.section
        rewrite(fileOf(userId, t.id), next)
        moved++
      }
      return moved
    },

    /**
     * Keep the pictures of a template's screens. Only JPEGs, only screens the
     * template has, at most MAX_TEMPLATE_THUMBS; a second call replaces the set.
     */
    putThumbs(userId, id, thumbs) {
      const file = fileOf(userId, id)
      const current = file ? readFile(file) : null
      if (!current) return null
      if (!thumbs || typeof thumbs !== 'object' || Array.isArray(thumbs)) throw fail('Bad pictures.')
      const ids = new Set((current.screens || []).map((s) => String(s?.id || '')))
      const entries = Object.entries(thumbs).filter(([sid]) => SCREEN_ID_RE.test(sid) && ids.has(sid))
      if (entries.length > MAX_TEMPLATE_THUMBS) throw fail('Too many pictures.')
      const files = entries.map(([sid, b64]) => {
        const bytes = Buffer.from(String(b64 || ''), 'base64')
        if (bytes.length < 4 || bytes.length > MAX_TEMPLATE_THUMB_BYTES) throw fail('Bad picture.')
        if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw fail('A picture must be a JPEG.')
        return [sid, bytes]
      })
      const size = files.reduce((n, [, b]) => n + b.length, 0)
      const dir = thumbDirOf(userId, id)
      let freed = 0
      try {
        for (const n of fs.readdirSync(dir)) freed += sizeOfFile(path.join(dir, n))
      } catch {
        /* none yet */
      }
      if (budget?.wouldExceed(Math.max(0, size - freed))) throw fail('This instance has reached its storage limit.', 507)
      fs.rmSync(dir, { recursive: true, force: true })
      budget?.remove(freed)
      fs.mkdirSync(dir, { recursive: true })
      for (const [sid, bytes] of files) {
        const tmp = path.join(dir, `${sid}.${crypto.randomBytes(6).toString('hex')}.tmp`)
        fs.writeFileSync(tmp, bytes, { mode: 0o600 })
        fs.renameSync(tmp, path.join(dir, `${sid}.jpg`))
      }
      budget?.add(size)
      return summaryOf(userId, current)
    },

    readThumb(userId, id, screenId) {
      if (!SCREEN_ID_RE.test(String(screenId || ''))) return null
      const dir = thumbDirOf(userId, id)
      if (!dir) return null
      try {
        return fs.readFileSync(path.join(dir, `${screenId}.jpg`))
      } catch {
        return null
      }
    },

    remove(userId, id) {
      const file = fileOf(userId, id)
      if (!file || !fs.existsSync(file)) return false
      let freed = sizeOfFile(file)
      const dir = thumbDirOf(userId, id)
      try {
        for (const n of fs.readdirSync(dir)) freed += sizeOfFile(path.join(dir, n))
      } catch {
        /* no pictures */
      }
      fs.rmSync(file, { force: true })
      fs.rmSync(dir, { recursive: true, force: true })
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
        for (const n of fs.readdirSync(dir)) {
          const p = path.join(dir, n)
          if (n.endsWith('.thumbs')) for (const m of fs.readdirSync(p)) freed += sizeOfFile(path.join(p, m))
          else freed += sizeOfFile(p)
        }
      } catch {
        return
      }
      fs.rmSync(dir, { recursive: true, force: true })
      budget?.remove(freed)
    },
  }
}
