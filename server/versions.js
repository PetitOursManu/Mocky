// Saved versions of a project or of one screen, and the branches they form.
//
// WHY ON THE SERVER, AND NOT IN THE PROJECTS BLOB
//
// A project lives in the browser's localStorage first (`src/lib/project.ts`),
// inside a budget of about 5 MB that the component sources already strain —
// `reportStorageFailure` exists because it fills up. A version is a full copy of
// every screen's code at a moment in time, so ten of them in the blob would be
// ten times the project, and the first thing a person would lose by saving a
// version would be the ability to save anything at all. Versions are therefore
// kept here, beside the blob and never inside it: the working copy stays small,
// and a version costs disk on the instance, where the disk budget counts it.
//
// WHY CONTENT-ADDRESSED
//
// Two versions of a ten-screen project usually differ by one screen. The code
// and the design document — the two heavy fields — are written once per distinct
// text, under their SHA-256, and a version only names them. Saving a version of
// a project nobody touched costs one line of index; the store also refuses to
// write that line at all when it would be identical to the branch's last one
// (`unchanged`), so the automatic saves taken before a restore or a branch switch
// do not pile up copies of the same state.
//
// Blobs are per ACCOUNT, not shared across the instance. Sharing them would save
// a little disk and make deletion a global reference count: deleting an account
// would have to ask every other account whether it still used a hash. Per
// account, "delete this account" is `rm -r` of one directory.
//
// WHAT A BRANCH IS
//
// A name on each version, nothing more. The project's working copy says which
// branch it is on (`Project.branch`, absent = the main one); a branch's head is
// its newest version. Switching is done by the browser — save the working copy
// on the branch it is leaving, load the head of the one it is going to — so the
// server never has to know which branch a project is "on", and a branch with no
// versions left simply stops existing, like a folder with no projects.

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

/** Why a version was taken. Shown to the person, so it has to stay honest. */
export const VERSION_KINDS = ['manual', 'auto', 'branch', 'review']

/** What a version holds: the whole project, or one screen of it. */
export const VERSION_SCOPES = ['project', 'screen']

/** The branch a project is on when it never asked for another. */
export const MAIN_BRANCH = 'main'

/*
 * Ceilings. Each one is far above what a person would do by hand; they exist so
 * an account cannot turn the store into unbounded storage, and so that reading
 * an index stays cheap.
 */
export const MAX_VERSIONS_PER_PROJECT = 200
export const MAX_VERSIONS_PER_USER = 1500
export const MAX_SCREENS_PER_VERSION = 80
/** Same ceiling as a share link: one component's source. */
export const MAX_CODE_BYTES = 512 * 1024
export const MAX_DESIGN_BYTES = 128 * 1024
/** Everything else on a screen — position, links, notes. Notes are the large part. */
export const MAX_META_BYTES = 256 * 1024
export const LABEL_MAX = 80
export const BRANCH_MAX = 40

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/
const HASH_RE = /^[a-f0-9]{64}$/
const VERSION_ID_RE = /^v[a-f0-9]{24}$/

export const isVersionId = (id) => VERSION_ID_RE.test(String(id || ''))

const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode })

const sha256 = (text) => crypto.createHash('sha256').update(text, 'utf8').digest('hex')

/**
 * A branch name, tidied, or null when nothing is left.
 *
 * Trimmed and collapsed for the reason `normalizeFolder` is: "Sombre " and
 * "Sombre" would be two branches that look identical in every list.
 */
export function normalizeBranch(name) {
  if (typeof name !== 'string') return null
  const clean = name.replace(/\s+/g, ' ').trim().slice(0, BRANCH_MAX)
  return clean || null
}

function cleanLabel(label) {
  return typeof label === 'string' ? label.replace(/\s+/g, ' ').trim().slice(0, LABEL_MAX) : ''
}

/** The fields of a project a version restores, besides its screens. */
function cleanProjectMeta(p) {
  const src = p && typeof p === 'object' ? p : {}
  const out = { name: typeof src.name === 'string' ? src.name.slice(0, 200) : '' }
  if (typeof src.design === 'string' && src.design.trim()) out.design = src.design
  if (typeof src.productName === 'string' && src.productName.trim()) out.productName = src.productName.slice(0, 120)
  if (typeof src.referenceScreenId === 'string' && ID_RE.test(src.referenceScreenId)) {
    out.referenceScreenId = src.referenceScreenId
  }
  if (src.ultra && typeof src.ultra === 'object') {
    out.ultra = { count: src.ultra.count === 6 ? 6 : 3, ...(src.ultra.video ? { video: true } : {}) }
  }
  return out
}

export function createVersionStore(dataDir, { now = () => Date.now(), budget = null } = {}) {
  const root = path.join(dataDir, 'versions')

  function userDir(userId) {
    // The id becomes a directory name: anything that is not a plain id is
    // refused rather than escaped, so `..` can never be one.
    if (!ID_RE.test(String(userId || ''))) throw fail('Unknown account.', 401)
    return path.join(root, userId)
  }

  function writeAtomic(file, text) {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    const tmp = `${file}.${crypto.randomBytes(6).toString('hex')}.tmp`
    // 0600 like every other store: a version holds a person's whole project.
    fs.writeFileSync(tmp, text, { mode: 0o600 })
    fs.renameSync(tmp, file)
  }

  function loadIndex(userId) {
    try {
      const parsed = JSON.parse(fs.readFileSync(path.join(userDir(userId), 'index.json'), 'utf8'))
      return Array.isArray(parsed?.versions) ? parsed.versions : []
    } catch {
      return []
    }
  }

  function saveIndex(userId, versions) {
    writeAtomic(path.join(userDir(userId), 'index.json'), JSON.stringify({ versions }))
  }

  const blobFile = (userId, hash) => path.join(userDir(userId), 'blobs', hash)

  /** Store a text once under its hash; returns the hash and the bytes it newly cost. */
  function putBlob(userId, text) {
    const hash = sha256(text)
    const file = blobFile(userId, hash)
    if (fs.existsSync(file)) return { hash, bytes: 0 }
    writeAtomic(file, text)
    return { hash, bytes: Buffer.byteLength(text, 'utf8') }
  }

  function readBlob(userId, hash) {
    if (!HASH_RE.test(String(hash || ''))) return null
    try {
      return fs.readFileSync(blobFile(userId, hash), 'utf8')
    } catch {
      return null
    }
  }

  /**
   * Delete every blob no remaining version names. Called after a removal, never
   * on a write: a blob written for a version being created is referenced by the
   * time anything could look.
   */
  function collect(userId, versions) {
    const used = new Set()
    for (const v of versions) {
      for (const s of v.screens || []) {
        if (s.code) used.add(s.code)
        if (s.design) used.add(s.design)
      }
      if (v.project?.design) used.add(v.project.design)
    }
    let entries = []
    try {
      entries = fs.readdirSync(path.join(userDir(userId), 'blobs'))
    } catch {
      return
    }
    for (const name of entries) {
      if (!HASH_RE.test(name) || used.has(name)) continue
      const file = blobFile(userId, name)
      try {
        const size = fs.statSync(file).size
        fs.rmSync(file, { force: true })
        budget?.remove(size)
      } catch {
        /* already gone */
      }
    }
  }

  /** What the browser sees of a version: everything but the heavy texts. */
  function summary(v) {
    return {
      id: v.id,
      projectId: v.projectId,
      branch: v.branch,
      label: v.label,
      kind: v.kind,
      scope: v.scope,
      ...(v.screenId ? { screenId: v.screenId } : {}),
      createdAt: v.createdAt,
      projectName: v.project?.name || '',
      designHash: v.project?.design || null,
      screens: (v.screens || []).map((s) => ({
        id: s.id,
        name: typeof s.meta?.name === 'string' ? s.meta.name : '',
        codeHash: s.code,
        ...(s.meta?.page ? { page: s.meta.page } : {}),
      })),
    }
  }

  /** What makes two versions "the same state", for the `unchanged` answer. */
  function digest(v) {
    return sha256(
      JSON.stringify({
        scope: v.scope,
        screenId: v.screenId || null,
        project: v.project || null,
        screens: v.screens,
      }),
    )
  }

  return {
    /**
     * Save a version.
     *
     * `input.screens` are whole screen records as the browser holds them. The
     * code and the screen's recorded design go to blobs; the rest is kept as it
     * came, because the browser rebuilds every screen through `normalizeScreen`
     * on the way back in — the whitelist lives there, once.
     *
     * Never the screen's `previousCode`: it is the working copy's undo, and
     * a version that carried one would double its size for a button that
     * means nothing once restored.
     */
    create(userId, input) {
      const projectId = String(input?.projectId || '')
      if (!ID_RE.test(projectId)) throw fail('Unknown project.')
      const scope = VERSION_SCOPES.includes(input?.scope) ? input.scope : 'project'
      const kind = VERSION_KINDS.includes(input?.kind) ? input.kind : 'manual'
      const branch = normalizeBranch(input?.branch) || MAIN_BRANCH
      const screenId = scope === 'screen' ? String(input?.screenId || '') : ''
      if (scope === 'screen' && !ID_RE.test(screenId)) throw fail('Unknown screen.')

      const raw = Array.isArray(input?.screens) ? input.screens : []
      const screensIn = scope === 'screen' ? raw.filter((s) => s && s.id === screenId).slice(0, 1) : raw
      if (scope === 'screen' && screensIn.length === 0) throw fail('Unknown screen.')
      if (screensIn.length > MAX_SCREENS_PER_VERSION) throw fail('This project has too many screens to version.', 413)

      // Validate everything before writing anything: a version refused halfway
      // must not leave blobs behind that nothing names.
      const prepared = []
      for (const s of screensIn) {
        if (!s || typeof s !== 'object' || !ID_RE.test(String(s.id || ''))) throw fail('A screen has no valid id.')
        const code = typeof s.code === 'string' ? s.code : ''
        if (Buffer.byteLength(code, 'utf8') > MAX_CODE_BYTES) throw fail('A screen is too large to version.', 413)
        const design = typeof s.design === 'string' && s.design.trim() ? s.design : null
        if (design && Buffer.byteLength(design, 'utf8') > MAX_DESIGN_BYTES) throw fail('A design is too large to version.', 413)
        // eslint-disable-next-line no-unused-vars
        const { code: _c, design: _d, previousCode: _p, ...meta } = s
        const metaText = JSON.stringify(meta)
        if (Buffer.byteLength(metaText, 'utf8') > MAX_META_BYTES) throw fail('A screen carries too much to version.', 413)
        prepared.push({ id: s.id, code, design, meta: JSON.parse(metaText) })
      }
      const project = scope === 'project' ? cleanProjectMeta(input?.project) : null
      if (project?.design && Buffer.byteLength(project.design, 'utf8') > MAX_DESIGN_BYTES) {
        throw fail('The design is too large to version.', 413)
      }

      const versions = loadIndex(userId)
      const mine = versions.filter((v) => v.projectId === projectId)
      if (mine.length >= MAX_VERSIONS_PER_PROJECT) {
        throw fail(`This project already has ${MAX_VERSIONS_PER_PROJECT} versions. Delete some first.`, 429)
      }
      if (versions.length >= MAX_VERSIONS_PER_USER) {
        throw fail(`This account already has ${MAX_VERSIONS_PER_USER} versions. Delete some first.`, 429)
      }

      // Refused BEFORE writing, like every store sharing this budget: a full
      // volume fails writes silently everywhere else in this repository.
      const incoming = prepared.reduce(
        (n, s) => n + Buffer.byteLength(s.code, 'utf8') + (s.design ? Buffer.byteLength(s.design, 'utf8') : 0),
        project?.design ? Buffer.byteLength(project.design, 'utf8') : 0,
      )
      if (budget?.wouldExceed(incoming)) throw fail('This instance has reached its storage limit.', 507)

      let written = 0
      const screens = prepared.map((s) => {
        const code = putBlob(userId, s.code)
        written += code.bytes
        const out = { id: s.id, code: code.hash, meta: s.meta }
        if (s.design) {
          const d = putBlob(userId, s.design)
          written += d.bytes
          out.design = d.hash
        }
        return out
      })
      let projectRec = null
      if (project) {
        projectRec = { ...project }
        if (project.design) {
          const d = putBlob(userId, project.design)
          written += d.bytes
          projectRec.design = d.hash
        }
      }
      budget?.add(written)

      const record = {
        id: 'v' + crypto.randomBytes(12).toString('hex'),
        projectId,
        branch,
        label: cleanLabel(input?.label),
        kind,
        scope,
        ...(screenId ? { screenId } : {}),
        createdAt: now(),
        project: projectRec,
        screens,
      }

      // The same state as the newest version of the same thing on the same
      // branch: say so instead of writing a twin. Only for automatic saves — a
      // person who presses "Save a version" twice under two names meant two.
      if (kind !== 'manual') {
        const last = versions
          .filter((v) => v.projectId === projectId && v.branch === branch && v.scope === scope && (v.screenId || '') === screenId)
          .sort((a, b) => b.createdAt - a.createdAt)[0]
        if (last && digest(last) === digest(record)) return { version: summary(last), unchanged: true }
      }

      versions.push(record)
      saveIndex(userId, versions)
      return { version: summary(record), unchanged: false }
    },

    /** A project's versions, newest first. Never the code. */
    list(userId, projectId) {
      return loadIndex(userId)
        .filter((v) => v.projectId === projectId)
        .sort((a, b) => b.createdAt - a.createdAt)
        .map(summary)
    },

    /**
     * One version, with its screens rebuilt whole. A blob that has gone missing
     * (a disk restored from an older backup) leaves its screen with empty code
     * and says so, rather than failing the whole version.
     */
    get(userId, id) {
      if (!isVersionId(id)) return null
      const v = loadIndex(userId).find((x) => x.id === id)
      if (!v) return null
      const missing = []
      const screens = v.screens.map((s) => {
        const code = readBlob(userId, s.code)
        if (code === null) missing.push(s.id)
        const out = { ...s.meta, id: s.id, code: code ?? '' }
        if (s.design) {
          const d = readBlob(userId, s.design)
          if (d !== null) out.design = d
        }
        return out
      })
      let project = null
      if (v.project) {
        project = { ...v.project }
        if (v.project.design) {
          const d = readBlob(userId, v.project.design)
          if (d !== null) project.design = d
          else delete project.design
        }
      }
      return { ...summary(v), project, screens, ...(missing.length ? { missing } : {}) }
    },

    /** Rename a version. The label is the only thing about a version that changes. */
    rename(userId, id, label) {
      if (!isVersionId(id)) return null
      const versions = loadIndex(userId)
      const v = versions.find((x) => x.id === id)
      if (!v) return null
      v.label = cleanLabel(label)
      saveIndex(userId, versions)
      return summary(v)
    },

    remove(userId, id) {
      if (!isVersionId(id)) return false
      const versions = loadIndex(userId)
      const next = versions.filter((v) => v.id !== id)
      if (next.length === versions.length) return false
      saveIndex(userId, next)
      collect(userId, next)
      return true
    },

    /** Every version of one branch of one project. The branch is gone afterwards. */
    removeBranch(userId, projectId, branch) {
      const name = normalizeBranch(branch)
      if (!name) return 0
      const versions = loadIndex(userId)
      const next = versions.filter((v) => !(v.projectId === projectId && v.branch === name))
      const removed = versions.length - next.length
      if (removed) {
        saveIndex(userId, next)
        collect(userId, next)
      }
      return removed
    },

    /** An account deleted takes its versions with it. */
    removeAllFor(userId) {
      let dir
      try {
        dir = userDir(userId)
      } catch {
        return
      }
      try {
        // Counted before removal so the budget gets its credit back.
        const blobs = path.join(dir, 'blobs')
        for (const name of fs.readdirSync(blobs)) {
          try {
            budget?.remove(fs.statSync(path.join(blobs, name)).size)
          } catch {
            /* vanished */
          }
        }
      } catch {
        /* no blobs */
      }
      fs.rmSync(dir, { recursive: true, force: true })
    },
  }
}
